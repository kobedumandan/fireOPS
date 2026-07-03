"""Shift roster helper for BFP 24-hour rotating shifts (A / B).

The roster alternates daily with cutover at 08:00 Asia/Manila.
A timestamp before the cutover counts as the previous day's shift.
"""
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from models import Shift

# Anchor: a known date that is Shift A. Days an even number after this -> A; odd -> B.
SHIFT_A_ANCHOR_DATE = date(2026, 1, 1)
SHIFT_CUTOVER_HOUR  = 8
SHIFT_TZ            = ZoneInfo("Asia/Manila")


def current_shift_name(now: datetime | None = None) -> str:
    """Return "A" or "B" for the shift currently on duty."""
    now_local = (now or datetime.now(SHIFT_TZ)).astimezone(SHIFT_TZ)
    shift_day = now_local.date()
    if now_local.hour < SHIFT_CUTOVER_HOUR:
        shift_day -= timedelta(days=1)
    return "A" if (shift_day - SHIFT_A_ANCHOR_DATE).days % 2 == 0 else "B"


def current_shift_id(db: Session, now: datetime | None = None) -> int | None:
    """Look up the shifts row whose name matches the active shift letter.

    Matches "A", "Shift A", or "shift_a" (case-insensitive) so it is robust to
    whatever naming convention is stored in the lookup table.
    """
    letter = current_shift_name(now)
    rows = db.query(Shift).all()
    for row in rows:
        name = (row.shift_name or "").strip().lower()
        if name in {letter.lower(), f"shift {letter.lower()}", f"shift_{letter.lower()}"}:
            return row.shift_id
    return None
