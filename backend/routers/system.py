"""Liveness endpoints and the dashboard WebSocket."""
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt

from config import JWT_ALGORITHM, JWT_SECRET
from database import check_connection
from state import manager


router = APIRouter(tags=["system"])


@router.websocket("/ws")
async def ws_endpoint(websocket: WebSocket, token: str = Query(...)):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        await websocket.close(code=4001)
        return

    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@router.get("/")
def root():
    return {"message": "BFP Capstone API is running"}


@router.get("/health")
def health():
    db_ok = check_connection()
    return {"api": "ok", "database": "ok" if db_ok else "unavailable"}
