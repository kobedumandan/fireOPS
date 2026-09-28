"""Shift lookup list."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import Shift, Users
from security import require_admin


router = APIRouter(tags=["shifts"])


@router.get("/api/shifts")
def get_shifts(
    db: Session = Depends(get_db),
    _auth: Users = Depends(require_admin),
):
    rows = db.query(Shift).order_by(Shift.shift_id).all()
    return [{"shift_id": r.shift_id, "shift_name": r.shift_name} for r in rows]
