"""
Seeder: Panabo City barangay polygons into barangay_boundaries.

Source: faeldon/philippines-json-maps (PSA PSGC 2023, hires).
Input:  backend/data/panabo_barangays.geojson

Usage (from backend/ with venv active):
    python seed_barangays.py [--clear]

--clear  truncates barangay_boundaries before seeding (CASCADE-safe via NULLing
         fire_incidents.brgy_id first).
"""

import argparse
import json
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import text

from database import SessionLocal

GEOJSON_PATH = Path(__file__).parent / "data" / "panabo_barangays.geojson"

# 2020 PSA Census of Population and Housing — Panabo City barangays.
# Source: PhilAtlas (https://www.philatlas.com/mindanao/r11/davao-del-norte/panabo.html),
# which reproduces the PSA 2020 CPH figures. Sum ≈ 209,230 (matches city total).
POP_2020 = {
    "A. O. Floirendo":     4165,
    "Buenavista":           794,
    "Cacao":               1304,
    "Cagangohan":         13224,
    "Consolacion":         1509,
    "Dapco":               4199,
    "Datu Abdul Dadia":    7394,
    "Gredu":              16252,
    "J. P. Laurel":        9458,
    "Kasilak":             2730,
    "Katipunan":           2449,
    "Katualan":             606,
    "Kauswagan":           1799,
    "Kiotoy":              1503,
    "Little Panay":        2736,
    "Lower Panaga":        1598,
    "Mabunao":             2116,
    "Maduao":              3720,
    "Malativas":           2582,
    "Manay":               6353,
    "Nanyo":               3979,
    "New Malaga":          2088,
    "New Malitbog":        4236,
    "New Pandan":          8550,
    "New Visayas":        18987,
    "Quezon":              6933,
    "Salvacion":          10748,
    "San Francisco":      13953,
    "San Nicolas":         2948,
    "San Pedro":           3408,
    "San Roque":            656,
    "San Vicente":        19334,
    "Santa Cruz":          1175,
    "Santo Niño":          5156,
    "Sindaton":            4312,
    "Southern Davao":      9899,
    "Tagpore":             1773,
    "Tibungol":            2037,
    "Upper Licanan":       1598,
    "Waterfall":            969,
}


def _norm(name: str) -> str:
    return "".join(ch for ch in name.lower() if ch.isalnum())


POP_BY_KEY = {_norm(k): v for k, v in POP_2020.items()}


def seed(clear: bool) -> None:
    if not GEOJSON_PATH.exists():
        sys.exit(f"GeoJSON not found: {GEOJSON_PATH}")

    with GEOJSON_PATH.open(encoding="utf-8") as f:
        fc = json.load(f)

    features = fc.get("features", [])
    if not features:
        sys.exit("GeoJSON has no features")

    db = SessionLocal()
    try:
        if clear:
            db.execute(text("UPDATE fire_incidents SET brgy_id = NULL"))
            db.execute(text("DELETE FROM barangay_boundaries"))
            db.execute(text("ALTER SEQUENCE barangay_boundaries_brgy_id_seq RESTART WITH 1"))

        inserted = 0
        unmatched = []
        for feat in features:
            props = feat.get("properties", {})
            name = props.get("adm4_en")
            geom = feat.get("geometry")
            if not name or not geom:
                continue

            pop = POP_BY_KEY.get(_norm(name))
            if pop is None:
                unmatched.append(name)

            db.execute(
                text(
                    """
                    INSERT INTO barangay_boundaries
                        (brgy_name, brgy_estpopulation, brgy_polygon)
                    VALUES
                        (:name, :pop, ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326))
                    """
                ),
                {"name": name, "pop": pop, "geom": json.dumps(geom)},
            )
            inserted += 1

        db.commit()
        print(f"Inserted {inserted} barangay polygons.")
        if unmatched:
            print(f"WARN: no 2020 population match for: {unmatched}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--clear", action="store_true", help="Truncate table first")
    args = ap.parse_args()
    seed(args.clear)
