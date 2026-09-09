"""Planning-mode response coverage (isochrones and per-barangay gaps)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import Users
from security import get_current_user
from services.coverage import _compute_or_get_coverage


router = APIRouter(tags=["coverage"])


@router.get("/api/coverage/isochrones")
def coverage_isochrones(
    refresh: bool = False,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    """GeoJSON reachability bands (nested <=3 / <=5 / <=8 min) from the stations."""
    data = _compute_or_get_coverage(db, refresh)
    return {"isochrones": data["isochrones"], "meta": data["meta"]}


@router.get("/api/coverage/gaps")
def coverage_gaps(
    minutes: int = 5,
    refresh: bool = False,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    """Per-barangay coverage % within `minutes`, worst-covered first."""
    data = _compute_or_get_coverage(db, refresh)
    gaps_by_min = data["gaps_by_min"]
    rows = gaps_by_min.get(minutes)
    if rows is None:
        # Requested band wasn't computed — fall back to the widest available.
        rows = gaps_by_min[max(gaps_by_min)] if gaps_by_min else []
    return {"minutes": minutes, "gaps": rows, "meta": data["meta"]}
