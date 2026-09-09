"""Aggregates behind the Metrics dashboard."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from database import get_db
from models import FireIncident, Users
from security import get_current_user


router = APIRouter(tags=["metrics"])


# ── Metrics summary (real aggregates for the Metrics dashboard) ───────────────
_MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
               "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
_METRICS_PERIOD_DAYS = {"1d": 1, "1w": 7, "1m": 30, "6m": 182, "1y": 365}


def _pct_delta(cur: int, prev: int) -> float | None:
    """Percent change vs the previous window; None when there's no baseline."""
    if not prev:
        return None
    return round((cur - prev) / prev * 100, 1)


@router.get("/api/metrics/summary")
def metrics_summary(
    period: str = "1m",
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    """Server-side aggregates for the Metrics page: totals, severity, contained,
    per-barangay counts, monthly incident counts, and period-over-period deltas.

    NOTE: avg_response_minutes is intentionally null for now — response time
    requires dispatch arrival timestamps that aren't reliably captured yet (see
    the response-time capture plan). The field is here so the frontend contract
    is stable once that lands.
    """
    now = datetime.now(timezone.utc)
    days = _METRICS_PERIOD_DAYS.get(period, 30)
    start = now - timedelta(days=days)
    prev_start = start - timedelta(days=days)

    def _count(*filters, since, until):
        q = db.query(func.count(FireIncident.fire_id)).filter(
            FireIncident.fire_incident_datetime >= since,
            FireIncident.fire_incident_datetime < until,
            *filters,
        )
        return q.scalar() or 0

    _contained = (FireIncident.fire_status.in_(["contained", "closed"]),)
    _critical = (FireIncident.fire_severity == "Critical",)

    total = _count(since=start, until=now)
    prev_total = _count(since=prev_start, until=start)
    contained = _count(*_contained, since=start, until=now)
    prev_contained = _count(*_contained, since=prev_start, until=start)
    prev_critical = _count(*_critical, since=prev_start, until=start)

    # Severity breakdown for the current window.
    severity = {"Critical": 0, "Moderate": 0, "Minor": 0}
    for name, c in (
        db.query(FireIncident.fire_severity, func.count(FireIncident.fire_id))
          .filter(FireIncident.fire_incident_datetime >= start,
                  FireIncident.fire_incident_datetime < now)
          .group_by(FireIncident.fire_severity)
          .all()
    ):
        if name in severity:
            severity[name] = c

    # Incidents per barangay. fire_incidents.brgy_id is never populated (incident
    # creation doesn't assign one), so locate each incident's barangay spatially
    # by its lat/lon against the boundary polygons instead of by the FK.
    by_barangay = {
        row.name: row.cnt
        for row in db.execute(
            text(
                """
                SELECT bb.brgy_name AS name, COUNT(fi.fire_id) AS cnt
                FROM barangay_boundaries bb
                JOIN fire_incidents fi
                  ON ST_Contains(
                       bb.brgy_polygon,
                       ST_SetSRID(ST_MakePoint(fi.fire_longitude, fi.fire_latitude), 4326)
                     )
                WHERE fi.fire_incident_datetime >= :start
                  AND fi.fire_incident_datetime < :end
                GROUP BY bb.brgy_name
                """
            ),
            {"start": start, "end": now},
        ).all()
    }

    # Incidents per month over the last 12 months (independent of `period`).
    y, m = now.year, now.month
    seq: list[tuple[int, int]] = []
    for i in range(11, -1, -1):
        mm, yy = m - i, y
        while mm <= 0:
            mm += 12
            yy -= 1
        seq.append((yy, mm))
    window_start = datetime(seq[0][0], seq[0][1], 1, tzinfo=timezone.utc)
    month_counts = {key: 0 for key in seq}
    m_bucket = func.date_trunc("month", FireIncident.fire_incident_datetime).label("m")
    for bucket, c in (
        db.query(m_bucket, func.count(FireIncident.fire_id))
          .filter(FireIncident.fire_incident_datetime >= window_start,
                  FireIncident.fire_incident_datetime <= now)
          .group_by(m_bucket)
          .all()
    ):
        if bucket is not None and (bucket.year, bucket.month) in month_counts:
            month_counts[(bucket.year, bucket.month)] = c
    monthly = [
        {"month": _MONTH_ABBR[mm - 1], "count": month_counts[(yy, mm)]}
        for (yy, mm) in seq
    ]

    return {
        "period": period,
        "total": total,
        "severity": severity,
        "contained": contained,
        "by_barangay": by_barangay,
        "monthly": monthly,
        "deltas": {
            "total": _pct_delta(total, prev_total),
            "critical": _pct_delta(severity["Critical"], prev_critical),
            "contained": _pct_delta(contained, prev_contained),
        },
        "avg_response_minutes": None,  # omitted for now — see response-time plan
    }
