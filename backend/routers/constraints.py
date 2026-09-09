"""User-drawn routing constraints layered onto the GAT predictions."""
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import state
from database import get_db
from models import GnnConstraint, Users
from schemas import VALID_CONSTRAINT_TYPES, ConstraintCreate, ConstraintUpdate
from security import get_current_user
from serializers import _constraint_to_dict
from state import manager


router = APIRouter(tags=["constraints"])


@router.get("/api/constraints")
def get_constraints(
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    rows = (
        db.query(GnnConstraint)
        .filter(GnnConstraint.is_active == True)
        .order_by(GnnConstraint.created_at.desc())
        .all()
    )
    return [_constraint_to_dict(r) for r in rows]


@router.post("/api/constraints", status_code=201)
async def create_constraint(
    body: ConstraintCreate,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    if body.constraint_type not in VALID_CONSTRAINT_TYPES:
        raise HTTPException(status_code=422, detail=f"Invalid type. Must be one of: {VALID_CONSTRAINT_TYPES}")
    if not body.coordinates or len(body.coordinates) < 2:
        raise HTTPException(status_code=422, detail="At least 2 coordinate points required.")

    c = GnnConstraint(
        constraint_type=body.constraint_type,
        name=body.name,
        coordinates=json.dumps(body.coordinates),
        highway=body.highway,
        surface=body.surface,
        maxspeed=body.maxspeed,
        created_by=_auth.user_id,
    )
    db.add(c)
    db.commit()
    db.refresh(c)

    state.gnn_constraints_cache = None

    data = _constraint_to_dict(c)
    await manager.broadcast({"type": "constraint_created", "data": data})
    return data


@router.patch("/api/constraints/{constraint_id}")
async def update_constraint(
    constraint_id: int,
    body: ConstraintUpdate,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    c = db.get(GnnConstraint, constraint_id)
    if not c:
        raise HTTPException(status_code=404, detail="Constraint not found.")
    if body.constraint_type is not None:
        if body.constraint_type not in VALID_CONSTRAINT_TYPES:
            raise HTTPException(status_code=422, detail=f"Invalid type. Must be one of: {VALID_CONSTRAINT_TYPES}")
        c.constraint_type = body.constraint_type
    if body.name is not None:
        c.name = body.name
    if body.coordinates is not None:
        if len(body.coordinates) < 2:
            raise HTTPException(status_code=422, detail="At least 2 coordinate points required.")
        c.coordinates = json.dumps(body.coordinates)
    if body.highway is not None:
        c.highway = body.highway
    if body.surface is not None:
        c.surface = body.surface
    if body.maxspeed is not None:
        c.maxspeed = body.maxspeed
    db.commit()
    db.refresh(c)

    state.gnn_constraints_cache = None

    data = _constraint_to_dict(c)
    await manager.broadcast({"type": "constraint_updated", "data": data})
    return data


@router.delete("/api/constraints/{constraint_id}", status_code=204)
async def delete_constraint(
    constraint_id: int,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    c = db.get(GnnConstraint, constraint_id)
    if not c:
        raise HTTPException(status_code=404, detail="Constraint not found.")
    db.delete(c)
    db.commit()

    state.gnn_constraints_cache = None

    await manager.broadcast({"type": "constraint_deleted", "data": {"id": constraint_id}})
