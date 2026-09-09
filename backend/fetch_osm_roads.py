"""
One-off OpenStreetMap dataset builder for an OSM-sourced region.

Panabo runs on a hand-digitised QGIS road network and must NEVER be built with
this script — it refuses any region whose road_source is not "osm".

For a testing region such as New Corella this downloads the drivable road
network once and writes it as a plain LineString GeoPackage, so the server
loads it at startup through exactly the same `load_roads_gpkg()` path Panabo
uses. That keeps the graph construction identical to production and keeps
osmnx off the request path entirely.

Usage
─────
    python fetch_osm_roads.py --region new_corella
    python fetch_osm_roads.py --region new_corella --force   # re-download

Outputs (under backend/data/):
    roads_<region>.gpkg          road LineStrings  → routing graph
    <region>_boundary.geojson    municipal outline → frontend mask
    <region>_barangays.geojson   admin_level 10    → coverage-by-barangay

It also prints the map centre / zoom / bounds to paste into the frontend's
region config.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from ai.config import CACHE_DIR, DATA_DIR, REGIONS

# Windows consoles default to cp1252, which cannot encode the box-drawing and
# ellipsis characters below and would abort the run *after* a successful (slow)
# download. Degrade unencodable glyphs instead of raising.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):  # already wrapped / not a TextIO
        pass

# Road classes worth routing a fire truck over. Mirrors the custom_filter in
# ai/osm_loader.py so both OSM paths yield a comparable network.
HIGHWAY_FILTER = (
    '["highway"~"motorway|trunk|primary|secondary|tertiary'
    '|unclassified|residential|service|road"]'
)

# Columns load_roads_gpkg() reads off each row. Anything else is dead weight in
# the .gpkg, and OSM's long tail of tags makes the file needlessly large.
KEEP_COLUMNS = ["highway", "name", "maxspeed", "lanes", "oneway", "geometry"]

# In the Philippines, barangays are OSM admin_level 10.
BARANGAY_ADMIN_LEVEL = "10"


def _flatten(value):
    """OSM tags are multi-valued per edge; collapse to a single scalar.

    osmnx yields a list when a way carries several values for a tag (e.g. a
    road that changes classification mid-way). load_roads_gpkg expects scalars,
    and GeoPackage cannot store a list column at all.
    """
    if isinstance(value, list):
        return value[0] if value else None
    return value


def configure_osmnx(timeout: int) -> None:
    """Raise the Overpass timeout and enable on-disk response caching.

    The public Overpass endpoint routinely takes minutes under load and osmnx's
    180s default is not enough for a whole-municipality extract. Caching means
    a retry after a later step fails does not re-hit the API.
    """
    import osmnx as ox

    ox.settings.requests_timeout = timeout
    ox.settings.use_cache = True
    ox.settings.cache_folder = str(CACHE_DIR / "osmnx")


def _with_retries(label: str, fn, attempts: int = 3):
    """Overpass is flaky and rate-limited; a timeout is usually worth retrying."""
    import time

    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except Exception as exc:
            if attempt == attempts:
                raise
            wait = 10 * attempt
            print(f"  ! {label} failed ({type(exc).__name__}) — "
                  f"retry {attempt}/{attempts - 1} in {wait}s")
            time.sleep(wait)


def build_roads(place: str, out_path: Path, force: bool) -> int:
    import osmnx as ox

    if out_path.exists() and not force:
        print(f"  {out_path.name} already exists — pass --force to rebuild")
        return 0

    print(f"  downloading road network for {place!r} …")
    G = _with_retries("road download", lambda: ox.graph_from_place(
        place, network_type="drive", retain_all=True, custom_filter=HIGHWAY_FILTER
    ))

    # retain_all=True keeps ways that are islands within the extract (a lone
    # subdivision loop, a road clipped by the municipal boundary). A station or
    # incident that snaps onto one is unroutable to everywhere else, which
    # surfaces as a mystery "no route found" rather than a data problem — so
    # keep only the largest connected component.
    before = G.number_of_nodes()
    G = ox.truncate.largest_component(G, strongly=False)
    dropped = before - G.number_of_nodes()
    if dropped:
        print(f"  pruned {dropped:,} nodes in disconnected components "
              f"({dropped / before:.1%})")

    edges = ox.graph_to_gdfs(G, nodes=False, edges=True).reset_index(drop=True)

    for col in KEEP_COLUMNS:
        if col == "geometry":
            continue
        edges[col] = edges[col].map(_flatten) if col in edges.columns else None

    edges = edges[KEEP_COLUMNS]
    # GeoPackage has no boolean-with-nulls; oneway rides along as text for
    # provenance only — load_roads_gpkg builds bidirectional edges regardless.
    edges["oneway"] = edges["oneway"].astype(str)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    edges.to_file(out_path, layer="roads", driver="GPKG")
    print(f"  wrote {out_path.name}  ({len(edges):,} road segments)")
    return len(edges)


def build_boundary(place: str, out_path: Path, force: bool):
    """Municipal outline — the frontend's out-of-jurisdiction mask + map bounds."""
    import osmnx as ox

    if out_path.exists() and not force:
        print(f"  {out_path.name} already exists — pass --force to rebuild")
        return json.loads(out_path.read_text(encoding="utf-8"))

    print(f"  downloading boundary polygon for {place!r} …")
    gdf = _with_retries("boundary download", lambda: ox.geocode_to_gdf(place))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    gdf[["geometry"]].to_file(out_path, driver="GeoJSON")
    print(f"  wrote {out_path.name}")
    return json.loads(out_path.read_text(encoding="utf-8"))


def build_barangays(place: str, out_path: Path, force: bool) -> None:
    """Barangay polygons (OSM admin_level 10).

    Optional: without them the incident→barangay lookup returns NULL, which the
    API already tolerates — only the by-barangay metrics and coverage-gap
    groupings go empty. Coverage is best-effort, so a failure here is a warning.
    """
    import osmnx as ox

    if out_path.exists() and not force:
        print(f"  {out_path.name} already exists — pass --force to rebuild")
        return

    print(f"  downloading barangay boundaries for {place!r} …")
    try:
        gdf = _with_retries("barangay download", lambda: ox.features_from_place(
            place, tags={"boundary": "administrative", "admin_level": BARANGAY_ADMIN_LEVEL}
        ))
    except Exception as exc:
        print(f"  ! barangay download failed ({exc}) — skipping (optional)")
        return

    # osmnx OR-s the tag filters, so the response also contains the enclosing
    # province and municipality relations. Without this AND-filter the export
    # is a handful of admin_level=4 provinces masquerading as barangays.
    if "admin_level" in gdf.columns:
        gdf = gdf[gdf["admin_level"].astype(str) == BARANGAY_ADMIN_LEVEL]
    if "boundary" in gdf.columns:
        gdf = gdf[gdf["boundary"] == "administrative"]
    gdf = gdf[gdf.geometry.geom_type.isin(["Polygon", "MultiPolygon"])]

    if gdf.empty:
        print(f"  ! no admin_level={BARANGAY_ADMIN_LEVEL} polygons in OSM for this "
              f"place — skipping (optional; incident→barangay lookups will be NULL)")
        return

    gdf = gdf.reset_index(drop=True)
    # seed_barangays.py and coverage_engine.py both key the barangay name off
    # `adm4_en` (the PSA field name Panabo's dataset uses). Match it so the OSM
    # export is a drop-in for the same consumers.
    gdf = gdf.rename(columns={"name": "adm4_en"})
    keep = [c for c in ("adm4_en", "admin_level", "geometry") if c in gdf.columns]
    gdf[keep].to_file(out_path, driver="GeoJSON")
    print(f"  wrote {out_path.name}  ({len(gdf)} barangays)")


def report_map_config(boundary_geojson: dict) -> None:
    """Print the centre/zoom/bounds to copy into the frontend region config."""
    from shapely.geometry import shape

    geom = shape(boundary_geojson["features"][0]["geometry"])
    minx, miny, maxx, maxy = geom.bounds
    centroid = geom.centroid
    # Pad the bbox so a pin right on the municipal edge is still accepted.
    pad_lat = (maxy - miny) * 0.15
    pad_lng = (maxx - minx) * 0.15

    print("\n  ── frontend region config ──────────────────────────────────")
    print(f'  center: [{centroid.y:.4f}, {centroid.x:.4f}],')
    print(f'  bounds: {{ latMin: {miny - pad_lat:.3f}, latMax: {maxy + pad_lat:.3f},')
    print(f'             lngMin: {minx - pad_lng:.3f}, lngMax: {maxx + pad_lng:.3f} }},')
    print(f"  (raw bbox: lat {miny:.4f}..{maxy:.4f}, lng {minx:.4f}..{maxx:.4f})")


def main() -> int:
    osm_regions = [k for k, v in REGIONS.items() if v["road_source"] == "osm"]

    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--region", required=True, choices=sorted(REGIONS),
                    help="region key from ai.config.REGIONS")
    ap.add_argument("--force", action="store_true",
                    help="re-download and overwrite existing files")
    ap.add_argument("--skip-barangays", action="store_true",
                    help="roads and boundary only")
    ap.add_argument("--timeout", type=int, default=600,
                    help="Overpass request timeout in seconds (default 600)")
    args = ap.parse_args()

    configure_osmnx(args.timeout)

    cfg = REGIONS[args.region]
    if cfg["road_source"] != "osm":
        print(
            f"Refusing to build region '{args.region}': its road_source is "
            f"'{cfg['road_source']}', not 'osm'.\n"
            f"Only these regions are OSM-sourced: {', '.join(osm_regions) or '(none)'}",
            file=sys.stderr,
        )
        return 2

    place = cfg["place_name"]
    print(f"Building OSM dataset for '{args.region}' — {place}")

    build_roads(place, cfg["roads_gpkg"], args.force)
    boundary = build_boundary(
        place, DATA_DIR / f"{args.region}_boundary.geojson", args.force
    )
    if not args.skip_barangays:
        build_barangays(place, cfg["barangays_path"], args.force)
    if boundary:
        report_map_config(boundary)

    print("\nDone.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
