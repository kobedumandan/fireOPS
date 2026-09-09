"""Dispatcher-placed road obstructions."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import RoadObstruction, Users
from schemas import ObstructionCreate
from security import get_current_user
from state import manager


router = APIRouter(tags=["obstructions"])


@router.get("/api/obstructions")
def get_obstructions(
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    rows = (
        db.query(RoadObstruction)
        .filter(RoadObstruction.is_active == True)
        .order_by(RoadObstruction.created_at.desc())
        .all()
    )
    return [
        {
            "id":          r.obstruction_id,
            "type":        r.type,
            "latitude":    r.latitude,
            "longitude":   r.longitude,
            "description": r.description or "",
            "is_active":   r.is_active,
            "created_at":  r.created_at.isoformat() if r.created_at else None,
            "expires_at":  r.expires_at.isoformat() if r.expires_at else None,
        }
        for r in rows
    ]


@router.post("/api/obstructions", status_code=201)
async def create_obstruction(
    body: ObstructionCreate,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    if body.type not in ("repair", "blockade", "flood", "accident"):
        raise HTTPException(status_code=422, detail="Invalid obstruction type.")

    exp = None
    if body.expires_at:
        try:
            exp = datetime.fromisoformat(body.expires_at)
        except ValueError:
            raise HTTPException(status_code=422, detail="expires_at must be ISO 8601.")

    obs = RoadObstruction(
        type=body.type,
        latitude=body.latitude,
        longitude=body.longitude,
        description=body.description,
        expires_at=exp,
        created_by=_auth.user_id,
    )
    db.add(obs)
    db.commit()
    db.refresh(obs)

    data = {
        "id":          obs.obstruction_id,
        "type":        obs.type,
        "latitude":    obs.latitude,
        "longitude":   obs.longitude,
        "description": obs.description or "",
        "is_active":   obs.is_active,
        "created_at":  obs.created_at.isoformat() if obs.created_at else None,
        "expires_at":  obs.expires_at.isoformat() if obs.expires_at else None,
    }
    await manager.broadcast({"type": "obstruction_created", "data": data})
    return data


@router.delete("/api/obstructions/{obstruction_id}", status_code=204)
async def delete_obstruction(
    obstruction_id: int,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    obs = db.get(RoadObstruction, obstruction_id)
    if not obs:
        raise HTTPException(status_code=404, detail="Obstruction not found.")
    db.delete(obs)
    db.commit()
    await manager.broadcast({
        "type": "obstruction_deleted",
        "data": {"id": obstruction_id},
    })
