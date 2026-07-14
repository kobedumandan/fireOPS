"""Backfill fire_incidents.brgy_id from incident geometry.

Incident creation and the seed scripts leave fire_incidents.brgy_id NULL, which
breaks per-barangay analytics that rely on the FK. This assigns each incident
the barangay whose boundary polygon contains its (lat, lon) via PostGIS
ST_Contains. Idempotent — safe to re-run (e.g. after reseeding incidents); it
only writes rows whose barangay actually changes.

Run:  python backfill_incident_barangays.py
"""
from sqlalchemy import text

from database import SessionLocal


def main() -> None:
    db = SessionLocal()
    try:
        result = db.execute(
            text(
                """
                UPDATE fire_incidents AS fi
                SET brgy_id = bb.brgy_id
                FROM barangay_boundaries AS bb
                WHERE ST_Contains(
                          bb.brgy_polygon,
                          ST_SetSRID(ST_MakePoint(fi.fire_longitude, fi.fire_latitude), 4326)
                      )
                  AND fi.brgy_id IS DISTINCT FROM bb.brgy_id
                """
            )
        )
        db.commit()

        total = db.execute(text("SELECT COUNT(*) FROM fire_incidents")).scalar()
        with_brgy = db.execute(
            text("SELECT COUNT(*) FROM fire_incidents WHERE brgy_id IS NOT NULL")
        ).scalar()
        unmatched = total - with_brgy
        print(
            f"Backfill complete: {result.rowcount} row(s) updated. "
            f"{with_brgy}/{total} incidents now have a barangay"
            + (f" ({unmatched} fell outside all boundaries)." if unmatched else ".")
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
