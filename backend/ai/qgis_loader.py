"""
QGIS export loader — reads road network files exported from QGIS into a
RoadNetworkGraph for GNN input.

Expected exports from QGIS (two separate files):
  nodes file  — Point layer    (one feature per road intersection / station)
  edges file  — LineString layer (one feature per directed road segment)

Supported formats (pass the file path; geopandas detects the format):
  GeoJSON    : "data/panabo_nodes.geojson", "data/panabo_edges.geojson"
  Shapefile  : "data/panabo_nodes.shp",     "data/panabo_edges.shp"
  GeoPackage : both layers inside one file  "data/panabo.gpkg"

──────────────────────────────────────────────────────────────────────────────
Required attribute columns in QGIS before exporting
──────────────────────────────────────────────────────────────────────────────
Nodes layer:
  node_id         integer   unique intersection ID
  is_station      integer   1 = BFP fire station, 0 = regular intersection
  speed_limit     float     posted speed limit (km/h), e.g. 40.0
  congestion      float     baseline congestion weight 0.0–1.0
  elevation       float     elevation in metres (optional, default 0)

Edges layer:
  u               integer   source node_id
  v               integer   destination node_id
  road_name       string    street name (optional)
  lanes           integer   number of lanes (default 1)
  travel_time_s   float     free-flow travel time in seconds
  distance_km     float     segment length in kilometres
  risk_weight     float     fire-risk weighting 0.0–1.0 (custom QGIS field)
  bidirectional   integer   1 = two-way street, 0 = one-way (default 1)
──────────────────────────────────────────────────────────────────────────────
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

from .graph_builder import RoadNetworkGraph
from .config import Config

logger = logging.getLogger(__name__)

try:
    import geopandas as gpd
    _GPD_AVAILABLE = True
except ImportError:
    _GPD_AVAILABLE = False
    logger.warning("geopandas not installed. Run: pip install geopandas")


def _require_geopandas():
    if not _GPD_AVAILABLE:
        raise RuntimeError("geopandas is required. Run: pip install geopandas")


# ── Nodes ─────────────────────────────────────────────────────────────────────

def load_nodes(
    path: str | Path,
    layer: Optional[str] = None,
) -> "gpd.GeoDataFrame":
    """
    Read the nodes layer from any geopandas-supported file.

    Args:
        path:  Path to GeoJSON / Shapefile / GeoPackage.
        layer: Layer name — only needed for GeoPackage (e.g. 'nodes').
    """
    _require_geopandas()
    kwargs = {"layer": layer} if layer else {}
    gdf = gpd.read_file(path, **kwargs)
    gdf = gdf.to_crs(epsg=Config.COORD_SRID)

    missing = {"node_id"} - set(gdf.columns)
    if missing:
        raise ValueError(
            f"Nodes file is missing required columns: {missing}. "
            "See qgis_loader.py docstring for the full attribute list."
        )
    return gdf


def load_edges(
    path: str | Path,
    layer: Optional[str] = None,
) -> "gpd.GeoDataFrame":
    """Read the edges layer from any geopandas-supported file."""
    _require_geopandas()
    kwargs = {"layer": layer} if layer else {}
    gdf = gpd.read_file(path, **kwargs)
    gdf = gdf.to_crs(epsg=Config.COORD_SRID)

    missing = {"u", "v"} - set(gdf.columns)
    if missing:
        raise ValueError(
            f"Edges file is missing required columns: {missing}. "
            "See qgis_loader.py docstring for the full attribute list."
        )
    return gdf


# ── Builder ───────────────────────────────────────────────────────────────────

def build_graph(
    nodes_gdf: "gpd.GeoDataFrame",
    edges_gdf: "gpd.GeoDataFrame",
) -> RoadNetworkGraph:
    """Convert GeoDataFrames into a RoadNetworkGraph."""
    rng = RoadNetworkGraph()

    for _, row in nodes_gdf.iterrows():
        geom = row.geometry
        rng.add_node(
            node_id=int(row["node_id"]),
            lat=geom.y,
            lon=geom.x,
            is_station=bool(int(row.get("is_station", 0))),
            congestion=float(row.get("congestion", 0.0)),
            speed_limit=float(row.get("speed_limit", 40.0)),
            elevation=float(row.get("elevation", 0.0)),
        )

    for _, row in edges_gdf.iterrows():
        rng.add_edge(
            u=int(row["u"]),
            v=int(row["v"]),
            road_name=str(row.get("road_name", "")),
            lanes=int(row.get("lanes", 1)),
            travel_time=float(row.get("travel_time_s", 60.0)),
            bidirectional=bool(int(row.get("bidirectional", 1))),
        )
        # Store risk_weight on the edge for the routing engine
        if "risk_weight" in row:
            edge_data = rng.G.get_edge_data(int(row["u"]), int(row["v"]))
            if edge_data is not None:
                edge_data["risk_weight"] = float(row["risk_weight"])

    logger.info(
        "QGIS graph loaded: %d nodes, %d edges",
        rng.G.number_of_nodes(),
        rng.G.number_of_edges(),
    )
    return rng


# ── Public API — two separate files (GeoJSON / Shapefile) ─────────────────────

def load_qgis_graph(
    nodes_path: str | Path,
    edges_path: str | Path,
) -> RoadNetworkGraph:
    """
    Load from two separate export files (GeoJSON or Shapefile).

        graph = load_qgis_graph(
            nodes_path="data/panabo_nodes.geojson",
            edges_path="data/panabo_edges.geojson",
        )
    """
    nodes_gdf = load_nodes(nodes_path)
    edges_gdf = load_edges(edges_path)
    return build_graph(nodes_gdf, edges_gdf)


# ── Public API — single GeoPackage file ───────────────────────────────────────

def load_qgis_graph_gpkg(
    gpkg_path: str | Path,
    nodes_layer: str = "nodes",
    edges_layer: str = "edges",
) -> RoadNetworkGraph:
    """
    Load from a single GeoPackage (.gpkg) with named layers.

        graph = load_qgis_graph_gpkg(
            gpkg_path="data/panabo.gpkg",
            nodes_layer="nodes",
            edges_layer="edges",
        )
    """
    nodes_gdf = load_nodes(gpkg_path, layer=nodes_layer)
    edges_gdf = load_edges(gpkg_path, layer=edges_layer)
    return build_graph(nodes_gdf, edges_gdf)


# ── Public API — raw road LineStrings (no pre-built node/edge tables) ────────

_SPEED_DEFAULTS = {
    "motorway": 80, "trunk": 60, "primary": 50, "secondary": 40,
    "tertiary": 35, "unclassified": 30, "residential": 25,
    "service": 20, "road": 30, "trunk_link": 40, "primary_link": 40,
    "secondary_link": 35, "tertiary_link": 30, "living_street": 15,
    "pedestrian": 10, "construction": 10,
}


def load_roads_gpkg(
    gpkg_path: str | Path,
    layer: Optional[str] = None,
) -> RoadNetworkGraph:
    """
    Build a RoadNetworkGraph from a GeoPackage of raw road LineStrings.

    Nodes are created at every unique coordinate endpoint of the road
    segments.  Shared endpoints become graph intersections, giving a
    topologically connected network without needing pre-built node_id /
    u / v columns.

        graph = load_roads_gpkg("data/roads_panabo.gpkg")
    """
    _require_geopandas()
    import pandas as pd

    kwargs = {"layer": layer} if layer else {}
    gdf = gpd.read_file(gpkg_path, **kwargs)
    if gdf.crs and gdf.crs.to_epsg() != Config.COORD_SRID:
        gdf = gdf.to_crs(epsg=Config.COORD_SRID)

    SNAP_DECIMALS = 6  # ~0.11 m precision at the equator

    coord_to_id: dict[tuple[float, float], int] = {}
    next_id = 0
    rng = RoadNetworkGraph()

    def _get_or_create_node(lon: float, lat: float) -> int:
        nonlocal next_id
        key = (round(lon, SNAP_DECIMALS), round(lat, SNAP_DECIMALS))
        if key in coord_to_id:
            return coord_to_id[key]
        nid = next_id
        next_id += 1
        coord_to_id[key] = nid
        rng.add_node(node_id=nid, lat=key[1], lon=key[0])
        return nid

    def _safe(val):
        if val is None or (isinstance(val, float) and pd.isna(val)):
            return ""
        return str(val)

    for _, row in gdf.iterrows():
        geom = row.geometry
        if geom is None or geom.geom_type != "LineString":
            continue

        coords = list(geom.coords)
        if len(coords) < 2:
            continue

        highway = _safe(row.get("highway"))
        speed = _SPEED_DEFAULTS.get(highway, 30)
        maxspeed = _safe(row.get("maxspeed"))
        if maxspeed:
            try:
                speed = int(maxspeed)
            except ValueError:
                pass

        road_name = _safe(row.get("name"))
        lanes = 1
        lanes_raw = row.get("lanes")
        if lanes_raw is not None:
            try:
                lanes = int(lanes_raw)
            except (ValueError, TypeError):
                pass

        prev_nid = _get_or_create_node(coords[0][0], coords[0][1])
        # Update speed_limit on the start node
        rng._node_features[prev_nid][5] = float(speed)

        for lon, lat, *_ in coords[1:]:
            cur_nid = _get_or_create_node(lon, lat)
            rng._node_features[cur_nid][5] = float(speed)
            if prev_nid != cur_nid:
                rng.add_edge(
                    u=prev_nid,
                    v=cur_nid,
                    road_name=road_name,
                    lanes=lanes,
                    bidirectional=True,
                )
            prev_nid = cur_nid

    logger.info(
        "Roads GPKG graph built: %d nodes, %d edges (from %d LineStrings)",
        rng.G.number_of_nodes(),
        rng.G.number_of_edges(),
        len(gdf),
    )
    return rng
