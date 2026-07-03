"""
Seeder: 200 closed fire incidents + heatmap_data rows for Panabo City.

Every incident is guaranteed to fall **inside an actual Panabo barangay
polygon** (sampled from data/panabo_barangays.geojson), so no point can land
outside the city boundary. Incident dates range 2020-01-01 → today, severity is
one of Minor / Moderate / Critical, and every incident has status "closed" with
a Panabo City street address.

Usage (from backend/ with venv active):
    python seed_incidents.py [--clear]

--clear  drops all existing fire_incidents + heatmap_data rows before seeding.
"""

import argparse
import json
import random
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from shapely.geometry import shape, Point

from database import SessionLocal
from models import FireIncident, HeatmapData

GEOJSON_PATH = Path(__file__).parent / "data" / "panabo_barangays.geojson"

STREET_NAMES = [
    "Rizal St.", "Quezon Blvd.", "Mabini St.", "Luna St.", "Bonifacio St.",
    "Aguinaldo Ave.", "Del Pilar St.", "Burgos St.", "Gomez St.", "Zamora St.",
    "Macapagal Rd.", "National Hwy.", "Barangay Rd.", "Sitio Proper", "Purok Uno",
    "Purok Dos", "Purok Tres", "Farmers Rd.", "Coop St.", "Market Rd.",
]

LOCATION_SOURCES = ["gps", "manual", "report"]
REPORTERS = [
    "+63917", "+63918", "+63919", "+63920", "+63921", "+63922", "+63923",
    "+63947", "+63948", "+63949", "+63956", "+63957", "+63961", "+63998",
]

# Severity → (weight_min, weight_max, density_min, density_max, alarm_level)
# Weights map to BFP alarm levels for KDE heatmap rendering:
#   Minor    (1st alarm)         →  1 – 2
#   Moderate (2nd–3rd alarm)     →  5 – 8
#   Critical (taskforce/general) → 15 – 50
SEVERITY_MAP = {
    "Minor":    (1.0,  2.0,  0.10, 0.50, "1st Alarm"),
    "Moderate": (5.0,  8.0,  0.50, 1.50, "3rd Alarm"),
    "Critical": (15.0, 50.0, 1.50, 5.00, "General Alarm"),
}
SEVERITIES = ["Minor", "Moderate", "Critical"]
SEVERITY_WEIGHTS = [45, 35, 20]


def load_barangays():
    """Return [(brgy_name, shapely_geometry), ...] for all Panabo barangays."""
    if not GEOJSON_PATH.exists():
        sys.exit(f"GeoJSON not found: {GEOJSON_PATH}")
    with GEOJSON_PATH.open(encoding="utf-8") as f:
        fc = json.load(f)

    out = []
    for feat in fc.get("features", []):
        name = (feat.get("properties") or {}).get("adm4_en")
        geom = feat.get("geometry")
        if not name or not geom:
            continue
        poly = shape(geom)
        if poly.is_valid and poly.area > 0:
            out.append((name, poly))
    if not out:
        sys.exit("No usable barangay polygons in GeoJSON")
    return out


def random_point_in(rng: random.Random, geom):
    """Rejection-sample a (lat, lon) point that lies inside `geom`."""
    minx, miny, maxx, maxy = geom.bounds
    for _ in range(2000):
        p = Point(rng.uniform(minx, maxx), rng.uniform(miny, maxy))
        if geom.contains(p):
            return round(p.y, 6), round(p.x, 6)  # lat, lon
    # Degenerate fallback: guaranteed-inside representative point
    c = geom.representative_point()
    return round(c.y, 6), round(c.x, 6)


def random_dt(rng: random.Random) -> datetime:
    """Random datetime between 2020-01-01 and now (UTC)."""
    start = datetime(2020, 1, 1, tzinfo=timezone.utc)
    end   = datetime.now(timezone.utc)
    delta = end - start
    return start + timedelta(seconds=rng.randint(0, int(delta.total_seconds())))


def jitter(rng: random.Random, centre: float, spread: float = 0.001) -> float:
    return round(centre + rng.uniform(-spread, spread), 6)


def random_phone(rng: random.Random) -> str:
    prefix = rng.choice(REPORTERS)
    suffix = "".join(str(rng.randint(0, 9)) for _ in range(7))
    return f"{prefix}{suffix}"


def build_rows(rng: random.Random, barangays, n: int = 200):
    incidents = []

    for _ in range(n):
        brgy_name, geom = rng.choice(barangays)
        lat, lon = random_point_in(rng, geom)

        sev_str = rng.choices(SEVERITIES, weights=SEVERITY_WEIGHTS)[0]
        w_min, w_max, d_min, d_max, alarm = SEVERITY_MAP[sev_str]
        weight = round(rng.uniform(w_min, w_max), 3)

        street = rng.choice(STREET_NAMES)
        address = f"{street}, Brgy. {brgy_name}, Panabo City, Davao del Norte"
        inc_dt = random_dt(rng)

        incident = FireIncident(
            confirmed_user_id     = None,
            fire_reporter_contact = random_phone(rng),
            fire_location_source  = rng.choice(LOCATION_SOURCES),
            fire_location_name    = brgy_name,
            fire_address          = address,
            fire_latitude         = lat,
            fire_longitude        = lon,
            fire_severity         = sev_str,
            fire_status           = "closed",
            fire_alarm_level      = alarm,
            fire_incident_datetime= inc_dt,
        )
        incidents.append((incident, weight, d_min, d_max, inc_dt))

    return incidents


def seed(clear: bool = False):
    rng = random.Random(42)
    barangays = load_barangays()
    db  = SessionLocal()
    try:
        if clear:
            deleted_h = db.query(HeatmapData).delete()
            deleted_f = db.query(FireIncident).delete()
            db.commit()
            print(f"[~] Cleared {deleted_f} fire_incidents and {deleted_h} heatmap_data rows.")

        rows = build_rows(rng, barangays, 200)

        for incident, weight, d_min, d_max, inc_dt in rows:
            db.add(incident)
            db.flush()  # get fire_id

            # slight jitter on heatmap coords (KDE cell centroid may differ slightly)
            h_lat = jitter(rng, incident.fire_latitude,  0.001)
            h_lon = jitter(rng, incident.fire_longitude, 0.001)
            density = round(rng.uniform(d_min, d_max), 4)
            gen_at  = inc_dt + timedelta(hours=rng.randint(1, 72))

            hm = HeatmapData(
                fire_id                 = incident.fire_id,
                heatmap_latitude        = h_lat,
                heatmap_longitude       = h_lon,
                heatmap_severity_weight = weight,
                heatmap_density_value   = density,
                heatmap_generated_at    = gen_at,
            )
            db.add(hm)

        db.commit()
        print(f"[+] Inserted 200 fire_incidents and 200 heatmap_data rows.")

    except Exception as exc:
        db.rollback()
        print(f"[!] Error: {exc}")
        sys.exit(1)
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Seed fire incidents + heatmap data.")
    parser.add_argument("--clear", action="store_true",
                        help="Delete existing fire_incidents and heatmap_data before seeding")
    args = parser.parse_args()
    seed(clear=args.clear)


if __name__ == "__main__":
    main()
