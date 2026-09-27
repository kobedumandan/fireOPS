"""
Add one-way street data to a region's road GeoPackage.

Panabo's road network is a QGIS export that dropped OSM's `oneway` tag, so
load_roads_gpkg() built every road as two-way and routes happily cut the wrong
way down one-way streets. Every feature in that export still carries its
source `osm_id`, though, so this script looks each way up by ID on Overpass
and writes a normalised `oneway` column back into the file.

Only attributes are touched — the hand-digitised geometry, its vertices and
therefore the graph topology and the GAT constraint matching all stay as they
are. The single exception is a way tagged `oneway=-1` (legal direction runs
against the way's vertex order): its LineString is reversed so that vertex
order always means "direction of travel", which is what load_roads_gpkg
expects.

Rules (OSM semantics):
    oneway=yes|true|1          → one-way, vertex order
    oneway=-1|reverse          → one-way, geometry reversed
    junction=roundabout|circular (unless oneway=no) → one-way
    highway=motorway (unless oneway=no)             → one-way
    anything else / way deleted from OSM            → two-way

Usage
─────
    python enrich_oneway.py                   # active REGION (default panabo)
    python enrich_oneway.py --refresh         # ignore cached tags, re-fetch
    python enrich_oneway.py --dry-run         # report only, write nothing

Fetched tags are cached in cache/<region>_way_tags.json so re-running is
offline and reproducible. The original file is copied to <name>.bak.gpkg the
first time it is modified.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import time
from collections import Counter
from pathlib import Path

import geopandas as gpd
import requests

from ai.config import CACHE_DIR, REGION, REGIONS

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
# Overpass rejects requests without a User-Agent (HTTP 406).
HEADERS = {"User-Agent": "bfp-capstone-routing/1.0 (oneway enrichment)"}
CHUNK = 300

ONEWAY_FORWARD = {"yes", "true", "1"}
ONEWAY_REVERSE = {"-1", "reverse"}
ONEWAY_NO = {"no", "false", "0"}
IMPLIED_ONEWAY_JUNCTIONS = {"roundabout", "circular"}


def fetch_tags(way_ids: list[str], cache: dict, cache_path: Path) -> None:
    """Fill `cache` with {way_id: tags | None} for every id not yet queried.

    None marks a way Overpass no longer knows about (deleted from OSM), so it
    is not re-queried. The cache is flushed after every chunk: the public
    Overpass servers 504 regularly and a rerun resumes where this one died.
    """
    todo = [w for w in way_ids if w not in cache]
    if not todo:
        return
    print(f"  fetching tags for {len(todo):,} ways from Overpass …")
    for i in range(0, len(todo), CHUNK):
        chunk = todo[i:i + CHUNK]
        query = f"[out:json][timeout:90];way(id:{','.join(chunk)});out tags;"
        for attempt in range(6):
            ep = OVERPASS_ENDPOINTS[attempt % len(OVERPASS_ENDPOINTS)]
            try:
                r = requests.post(ep, data={"data": query}, headers=HEADERS, timeout=120)
                if r.status_code == 200:
                    found = {str(el["id"]): el.get("tags", {}) for el in r.json()["elements"]}
                    for w in chunk:
                        cache[w] = found.get(w)
                    break
                print(f"  ! {ep} → HTTP {r.status_code}")
            except requests.RequestException as exc:
                print(f"  ! {ep} → {type(exc).__name__}")
            time.sleep(10 * (attempt + 1))
        else:
            raise RuntimeError(
                "Overpass kept failing — progress is cached, rerun to resume."
            )
        cache_path.write_text(json.dumps(cache), encoding="utf-8")
        print(f"  fetched {min(i + CHUNK, len(todo)):,}/{len(todo):,}")


def classify(tags: dict) -> str:
    """Map raw OSM tags to 'yes' (vertex order), '-1' (reversed) or 'no'."""
    raw = str(tags.get("oneway", "")).strip().lower()
    if raw in ONEWAY_FORWARD:
        return "yes"
    if raw in ONEWAY_REVERSE:
        return "-1"
    if raw in ONEWAY_NO:
        return "no"
    if tags.get("junction") in IMPLIED_ONEWAY_JUNCTIONS:
        return "yes"
    if tags.get("highway") == "motorway":
        return "yes"
    return "no"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--region", default=REGION, choices=sorted(REGIONS))
    ap.add_argument("--refresh", action="store_true", help="re-fetch tags from Overpass")
    ap.add_argument("--dry-run", action="store_true", help="report only, write nothing")
    args = ap.parse_args()

    gpkg: Path = REGIONS[args.region]["roads_gpkg"]
    cache_path = CACHE_DIR / f"{args.region}_way_tags.json"

    gdf = gpd.read_file(gpkg)
    layer = gpd.list_layers(gpkg)["name"].iloc[0]
    if "osm_id" not in gdf.columns:
        print(f"{gpkg.name} has no osm_id column — cannot look up one-way tags.",
              file=sys.stderr)
        return 2
    print(f"{gpkg.name}: {len(gdf):,} roads (layer '{layer}')")

    way_ids = sorted(set(gdf["osm_id"].dropna().astype(str)))
    tags: dict = {}
    if cache_path.exists() and not args.refresh:
        tags = json.loads(cache_path.read_text(encoding="utf-8"))
        print(f"  cached tags: {len(tags):,} ways ({cache_path.name})")
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    fetch_tags(way_ids, tags, cache_path)

    missing = [w for w in way_ids if tags.get(w) is None]
    if missing:
        print(f"  {len(missing)} ways no longer exist in OSM — kept two-way")

    # Idempotent: a previous run already flipped oneway=-1 geometries and
    # recorded that in `oneway_src`, so never flip the same row twice.
    already_flipped = (
        gdf["oneway_src"].astype(str) == "-1"
        if "oneway_src" in gdf.columns else None
    )

    decisions = gdf["osm_id"].astype(str).map(lambda w: classify(tags.get(w) or {}))
    flipped = 0
    for idx in gdf.index[decisions == "-1"]:
        if already_flipped is not None and already_flipped.loc[idx]:
            continue
        gdf.at[idx, "geometry"] = gdf.at[idx, "geometry"].reverse()
        flipped += 1

    gdf["oneway_src"] = decisions
    gdf["oneway"] = decisions.map({"yes": "yes", "-1": "yes", "no": "no"})

    counts = Counter(decisions)
    print(f"  one-way (forward): {counts['yes']:,}")
    print(f"  one-way (reversed, geometry flipped): {counts['-1']:,} ({flipped} flipped now)")
    print(f"  two-way: {counts['no']:,}")

    if args.dry_run:
        print("Dry run — nothing written.")
        return 0

    backup = gpkg.with_suffix(".bak.gpkg")
    if not backup.exists():
        shutil.copy2(gpkg, backup)
        print(f"  backed up original → {backup.name}")
    gdf.to_file(gpkg, layer=layer, driver="GPKG", mode="w")
    print(f"Wrote {gpkg.name}. Restart the backend to rebuild the routing graph.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
