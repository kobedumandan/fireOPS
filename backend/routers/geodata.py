"""Barangay boundaries and the fire-density heatmap."""
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import get_db
from models import HeatmapData, Users
from security import get_current_user


router = APIRouter(tags=["geodata"])


@router.get("/api/barangays")
def get_barangays(
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    rows = db.execute(
        text(
            """
            SELECT brgy_id, brgy_name, brgy_estpopulation,
                   ST_AsGeoJSON(brgy_polygon)::json AS geom
            FROM barangay_boundaries
            ORDER BY brgy_name
            """
        )
    ).all()
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "brgy_id": r.brgy_id,
                    "brgy_name": r.brgy_name,
                    "brgy_estpopulation": r.brgy_estpopulation,
                },
                "geometry": r.geom,
            }
            for r in rows
        ],
    }


@router.get("/api/heatmap")
def get_heatmap(
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    rows = db.query(HeatmapData).all()
    return [
        {
            "lat":    r.heatmap_latitude,
            "lng":    r.heatmap_longitude,
            "weight": float(r.heatmap_density_value),
        }
        for r in rows
    ]
