"""Login, logout, and the current-user profile."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from config import JWT_ALGORITHM, JWT_SECRET
from database import get_db
from models import TokenBlacklist, Users
from schemas import LoginRequest
from security import (
    _bearer, _create_token, _home_station, _user_profile, _verify_password,
    get_current_user,
)


router = APIRouter(tags=["auth"])


@router.post("/api/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(Users).filter(Users.user_email == req.email).first()
    if not user or not _verify_password(req.password, user.user_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {
        "access_token": _create_token(user),
        "token_type": "bearer",
        "user": _user_profile(user),
    }


@router.post("/login_user")
def login_user(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(Users).filter(Users.user_email == req.email).first()
    if not user or not _verify_password(req.password, user.user_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if user.user_role != "personnel":
        raise HTTPException(status_code=403, detail="Access denied")
    return {
        "access_token": _create_token(user),
        "token_type": "bearer",
        "user": _user_profile(user),
        "station": _home_station(user),
    }


@router.get("/api/auth/me")
def me(current_user: Users = Depends(get_current_user)):
    return _user_profile(current_user)


@router.post("/api/auth/logout", status_code=204)
def logout(
    credentials: HTTPAuthorizationCredentials = Security(_bearer),
    db: Session = Depends(get_db),
):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        jti = payload.get("jti")
        exp = payload.get("exp")
    except JWTError:
        return  # already invalid — nothing to blacklist
    if jti and exp:
        expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)
        if not db.query(TokenBlacklist).filter(TokenBlacklist.jti == jti).first():
            db.add(TokenBlacklist(jti=jti, expires_at=expires_at))
            db.commit()
