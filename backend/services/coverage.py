"""Station reachability coverage: whole-graph compute, cached per process."""
import json

from fastapi import HTTPException
from sqlalchemy.orm import Session

import state
from ai import Config
from coverage_engine import compute_coverage
from models import Station


_BARANGAYS_GEOJSON_PATH = Config.BARANGAYS_PATH


def _station_source_nodes(db: Session) -> list[int]:
    """Snap every station with coordinates to its nearest graph node."""
    nodes: list[int] = []
    for s in db.query(Station).all():
        if s.station_latitude is None or s.station_longitude is None:
            continue
        near = state.routing_engine.graph.nodes_near(
            float(s.station_latitude), float(s.station_longitude), radius_km=2.0
        )
        if near:
            nodes.append(near[0][0])
    return nodes


def _compute_or_get_coverage(db: Session, refresh: bool = False) -> dict:
    """Return the cached coverage result, computing (and caching) it if needed."""
    if state.coverage_cache is not None and not refresh:
        return state.coverage_cache

    if state.routing_engine is None:
        raise HTTPException(status_code=503, detail="Routing engine not loaded.")

    sources = _station_source_nodes(db)
    if not sources:
        raise HTTPException(
            status_code=404,
            detail="No stations with coordinates to compute coverage from.",
        )

    barangays = None
    if _BARANGAYS_GEOJSON_PATH.exists():
        with open(_BARANGAYS_GEOJSON_PATH, encoding="utf-8") as f:
            barangays = json.load(f)

    edge_costs, _ = state.routing_engine._compute_edge_costs()
    result = compute_coverage(state.routing_engine.graph, edge_costs, sources, barangays)
    if result is None:
        raise HTTPException(status_code=500, detail="Coverage computation produced no data.")

    state.coverage_cache = result
    return result
