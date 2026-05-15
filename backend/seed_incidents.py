"""
Seeder: 200 resolved fire incidents + heatmap_data rows for Panabo City.

Usage (from backend/ with venv active):
    python seed_incidents.py [--clear]

--clear  drops all existing fire_incidents + heatmap_data rows before seeding.
"""

import argparse
import random
import sys
from datetime import datetime, timezone, timedelta

from dotenv import load_dotenv

load_dotenv()

from database import SessionLocal
from models import FireIncident, HeatmapData

# ── Panabo City barangays with approximate centre coords ─────────────────────
BARANGAYS = [
    ("Poblacion",            7.3047, 125.6846),
    ("Sto. Niño",            7.2980, 125.6780),
    ("San Francisco",        7.2990, 125.6720),
    ("New Visayas",          7.2870, 125.6680),
    ("Cagangohan",           7.3120, 125.7020),
    ("San Vicente",          7.3200, 125.7080),
    ("Datu Abdul Dadia",     7.3250, 125.7120),
    ("Gredu",                7.3300, 125.7150),
    ("Kakar",                7.3350, 125.7200),
    ("Buenavista",           7.3400, 125.7250),
    ("Little Panay",         7.2750, 125.6580),
    ("Salvacion",            7.2700, 125.6520),
    ("Cacao",                7.2650, 125.6450),
    ("Tibungol",             7.2800, 125.6630),
    ("J.P. Laurel",          7.2880, 125.6740),
    ("A.O. Floirendo",       7.3450, 125.7280),
    ("Datu Balong",          7.3500, 125.7320),
    ("Magdum",               7.2600, 125.6400),
    ("Tuganay",              7.3550, 125.7380),
    ("Consolacion",          7.2550, 125.6350),
]

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

# (fire_severity_str, weight_min, weight_max)
# Weights map to BFP alarm levels for KDE heatmap rendering:
#   1st alarm (low)       →  1 – 2
#   3rd–5th alarm (mod.)  →  5 – 8
#   Taskforce α–δ (high)  → 15 – 25
#   General alarm (crit.) → 50
SEVERITY_MAP = {
    1: ("low",      1.0,  2.0),
    2: ("moderate", 5.0,  8.0),
    3: ("high",    15.0, 25.0),
    4: ("critical",50.0, 50.0),
}

DENSITY_RANGE = {
    1: (0.10, 0.50),
    2: (0.50, 1.50),
    3: (1.50, 3.00),
    4: (3.00, 5.00),
}


def random_dt(rng: random.Random) -> datetime:
    """Random datetime between 2000-01-01 and today (UTC)."""
    start = datetime(2000, 1, 1, tzinfo=timezone.utc)
    end   = datetime(2026, 5, 14, tzinfo=timezone.utc)
    delta = end - start
    return start + timedelta(seconds=rng.randint(0, int(delta.total_seconds())))


def jitter(rng: random.Random, centre: float, spread: float = 0.004) -> float:
    return round(centre + rng.uniform(-spread, spread), 6)


def random_phone(rng: random.Random) -> str:
    prefix = rng.choice(REPORTERS)
    suffix = "".join(str(rng.randint(0, 9)) for _ in range(7))
    return f"{prefix}{suffix}"


def build_rows(rng: random.Random, n: int = 200):
    incidents  = []
    heatmaps   = []

    for _ in range(n):
        brgy_name, blat, blon = rng.choice(BARANGAYS)
        street    = rng.choice(STREET_NAMES)
        sev_num   = rng.choices([1, 2, 3, 4], weights=[30, 35, 25, 10])[0]
        sev_str, w_min, w_max = SEVERITY_MAP[sev_num]
        d_min, d_max          = DENSITY_RANGE[sev_num]
        weight = round(rng.uniform(w_min, w_max), 3)

        lat = jitter(rng, blat)
        lon = jitter(rng, blon)
        inc_dt = random_dt(rng)

        incident = FireIncident(
            confirmed_user_id     = None,
            fire_reporter_contact = random_phone(rng),
            fire_location_source  = rng.choice(LOCATION_SOURCES),
            fire_latitude         = lat,
            fire_longitude        = lon,
            fire_severity         = sev_str,
            fire_status           = "resolved",
            fire_incident_datetime= inc_dt,
        )
        incidents.append((incident, weight, d_min, d_max, inc_dt))

    return incidents


def seed(clear: bool = False):
    rng = random.Random(42)
    db  = SessionLocal()
    try:
        if clear:
            deleted_h = db.query(HeatmapData).delete()
            deleted_f = db.query(FireIncident).delete()
            db.commit()
            print(f"[~] Cleared {deleted_f} fire_incidents and {deleted_h} heatmap_data rows.")

        rows = build_rows(rng, 200)

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
