"""Smart auto-dispatch: pick the best response team for a new incident.

Pipeline:
  A. Hard filters (SQL): correct shift, team not active, station has an
     available truck, all team members on standby.
  B. Haversine prefilter -> top 5 nearest candidate stations.
  C. GNN ETA per finalist (falls back to haversine ETA if routing is down).
  D. Tiebreaker: prefer teams with fewer dispatches in the last 12h.
  E. Lowest score wins. Score = eta_seconds + dispatches_last_12h * 30.
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from models import (
    DispatchRecord, FireIncident, ResponseTeam, ResponseTeamMember,
    Station, Truck,
)
from shift_utils import current_shift_id

logger = logging.getLogger(__name__)

HAVERSINE_TOP_N      = 5
WORKLOAD_PENALTY_SEC = 0       # TEMP: workload penalty disabled — pure ETA wins
WORKLOAD_WINDOW_HRS  = 12
FALLBACK_SPEED_KMH   = 35.0    # used only if routing engine is unavailable


@dataclass
class SelectionResult:
    ok: bool
    team_id: int | None = None
    station_id: int | None = None
    eta_seconds: float | None = None
    reason: str | None = None
    breakdown: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {"ok": self.ok}
        if self.ok:
            d.update({
                "team_id":     self.team_id,
                "station_id":  self.station_id,
                "eta_seconds": self.eta_seconds,
                "eta_minutes": round(self.eta_seconds / 60, 2) if self.eta_seconds else None,
            })
        else:
            d["reason"] = self.reason
        if self.breakdown:
            d["breakdown"] = self.breakdown
        return d


def _haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _eligible_teams(
    db: Session, shift_id: int | None
) -> tuple[list[ResponseTeam], dict[str, int]]:
    """Stage A: hard filters. Returns (eligible, stage_counts) for diagnostics."""
    all_teams = (
        db.query(ResponseTeam)
        .join(Station, ResponseTeam.station_id == Station.station_id)
        .filter(Station.station_latitude != None, Station.station_longitude != None)  # noqa: E711
        .all()
    )

    counts = {
        "total":           len(all_teams),
        "not_active":      0,
        "on_shift":        0,
        "has_truck":       0,
        "members_standby": 0,
    }
    eligible: list[ResponseTeam] = []
    for team in all_teams:
        if (team.team_status or "").lower() == "active":
            continue
        counts["not_active"] += 1

        if shift_id is not None and team.shift_id != shift_id:
            continue
        counts["on_shift"] += 1

        truck_avail = (
            db.query(Truck)
            .filter(Truck.station_id == team.station_id, Truck.truck_status == "available")
            .first()
        )
        if not truck_avail:
            continue
        counts["has_truck"] += 1

        members = team.members or []
        if not members:
            continue
        # NULL / empty member_status is treated as implicit "standby" — the
        # frontend doesn't expose this field, so most members never have it
        # explicitly set. Only an explicit non-standby value disqualifies.
        if any(
            (m.member_status or "").strip().lower() not in ("", "standby")
            for m in members
        ):
            continue
        counts["members_standby"] += 1

        eligible.append(team)

    return eligible, counts


def _recent_dispatch_count(db: Session, team_id: int, now: datetime) -> int:
    cutoff = now - timedelta(hours=WORKLOAD_WINDOW_HRS)
    return (
        db.query(DispatchRecord)
        .filter(DispatchRecord.team_id == team_id, DispatchRecord.dispatch_at >= cutoff)
        .count()
    )


def _route_eta_seconds(routing_engine, origin_lat: float, origin_lng: float,
                       dest_lat: float, dest_lng: float) -> float | None:
    if not routing_engine:
        return None
    try:
        src = routing_engine.graph.nodes_near(origin_lat, origin_lng, radius_km=2.0)
        tgt = routing_engine.graph.nodes_near(dest_lat,   dest_lng,   radius_km=2.0)
        if not src or not tgt:
            return None
        routes = routing_engine.compute_routes_multi_alpha(src[0][0], tgt[0][0])
        selected = next((r for r in routes if r.get("is_selected")), None) or (routes[0] if routes else None)
        if not selected:
            return None
        return float(selected["eta_seconds"])
    except Exception as exc:  # noqa: BLE001
        logger.warning("auto_dispatch: routing failed (%s) — falling back to haversine ETA", exc)
        return None


def select_best_team(db: Session, incident: FireIncident, routing_engine=None) -> SelectionResult:
    if incident.fire_latitude is None or incident.fire_longitude is None:
        return SelectionResult(ok=False, reason="incident_missing_coordinates")

    now = datetime.now(timezone.utc)
    shift_id = current_shift_id(db, now)

    eligible, stage_counts = _eligible_teams(db, shift_id)
    if not eligible:
        # Pick the most informative reason based on where the funnel collapsed.
        if stage_counts["total"] == 0:
            reason = "no_teams_configured"
        elif stage_counts["not_active"] == 0:
            reason = "all_teams_active"
        elif shift_id is not None and stage_counts["on_shift"] == 0:
            reason = "no_team_on_shift"
        elif stage_counts["has_truck"] == 0:
            reason = "no_available_truck"
        else:
            reason = "no_team_on_standby"
        return SelectionResult(
            ok=False,
            reason=reason,
            breakdown={"shift_id": shift_id, "eligible_count": 0, "stage_counts": stage_counts},
        )

    # Stage B: haversine prefilter.
    with_distance = [
        (
            t,
            _haversine_meters(
                incident.fire_latitude, incident.fire_longitude,
                t.station.station_latitude, t.station.station_longitude,
            ),
        )
        for t in eligible
    ]
    with_distance.sort(key=lambda x: x[1])
    finalists = with_distance[:HAVERSINE_TOP_N]

    # Stages C + D + E: real ETA + workload tiebreaker -> final score.
    scored: list[dict[str, Any]] = []
    for team, hav_m in finalists:
        eta = _route_eta_seconds(
            routing_engine,
            team.station.station_latitude, team.station.station_longitude,
            incident.fire_latitude,        incident.fire_longitude,
        )
        eta_source = "gnn"
        if eta is None:
            eta = (hav_m / 1000.0) / FALLBACK_SPEED_KMH * 3600.0
            eta_source = "haversine_fallback"

        workload = _recent_dispatch_count(db, team.team_id, now)
        score = eta + workload * WORKLOAD_PENALTY_SEC
        scored.append({
            "team_id":     team.team_id,
            "team_name":   team.team_name,
            "station_id":  team.station_id,
            "haversine_m": round(hav_m, 1),
            "eta_seconds": round(eta, 1),
            "eta_source":  eta_source,
            "workload":    workload,
            "score":       round(score, 1),
        })

    scored.sort(key=lambda r: r["score"])
    winner = scored[0]

    return SelectionResult(
        ok=True,
        team_id=winner["team_id"],
        station_id=winner["station_id"],
        eta_seconds=winner["eta_seconds"],
        breakdown={"shift_id": shift_id, "candidates": scored},
    )
