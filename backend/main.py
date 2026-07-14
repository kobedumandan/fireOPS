import asyncio
from concurrent.futures import ProcessPoolExecutor
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
import hashlib
import json
import logging
import os
import uuid

from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, Query, Security, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from jose import JWTError, jwt
from pydantic import BaseModel
import html as _html
import httpx
import math

from sqlalchemy import case, func, or_, text
from sqlalchemy.orm import Session

from database import check_connection, get_db, SessionLocal, engine
from models import (
    Users, Personnel, HeatmapData, Station, ResponseTeam, ResponseTeamMember,
    Shift, FireIncident, DispatchRecord, DispatchTruck, Route, TokenBlacklist,
    CurrentLocation, Truck, LocationLog, RoadObstruction, GnnConstraint,
    BarangayBoundary, Device, IncidentReport, ReportPhoto,
)
from ai import GeoAIRoutingEngine, Config
from auto_dispatch import select_best_team
from routing_setup import build_routing_engine
from coverage_engine import compute_coverage
import routing_pool

JWT_SECRET      = os.getenv("JWT_SECRET", "change-me")
JWT_ALGORITHM   = "HS256"
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "8"))

# ── PhilSMS / reporter location requests ──────────────────────────────────────
# Public base URL (ngrok tunnel to this backend) the reporter's phone reaches.
PUBLIC_BASE_URL   = os.getenv("PUBLIC_BASE_URL", "http://localhost:8000").rstrip("/")
PHILSMS_API_TOKEN = (os.getenv("PHILSMS_API_TOKEN", "") or "").strip()
PHILSMS_SENDER_ID = os.getenv("PHILSMS_SENDER_ID", "PhilSMS")
SEND_SMS          = os.getenv("SEND_SMS", "false").lower() == "true"
PHILSMS_SEND_URL  = "https://dashboard.philsms.com/api/v3/sms/send"

# ── Uploaded report photos ────────────────────────────────────────────────────
# Scene photographs personnel attach to an incident report are written here and
# served back over the public tunnel at /uploads/report_photos/<file>.
UPLOAD_ROOT       = os.path.join(os.path.dirname(__file__), "uploads")
REPORT_PHOTO_DIR  = os.path.join(UPLOAD_ROOT, "report_photos")
MAX_REPORT_PHOTOS = 8
MAX_PHOTO_BYTES   = 10 * 1024 * 1024  # 10 MB per photo
ALLOWED_PHOTO_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"}
_PHOTO_EXT = {
    "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/png": ".png",
    "image/webp": ".webp", "image/heic": ".heic", "image/heif": ".heif",
}
os.makedirs(REPORT_PHOTO_DIR, exist_ok=True)

_bearer = HTTPBearer()

logger = logging.getLogger(__name__)

# ── Application lifespan ──────────────────────────────────────────────────────

routing_engine: GeoAIRoutingEngine = None  # populated in lifespan

# ── Routing process pool ──────────────────────────────────────────────────────
# CPU-bound route computation (connector builds, full rebuilds) is offloaded to
# a pool of worker processes so it runs with real parallelism instead of
# serializing behind this process's GIL. Each worker loads its own graph copy.
# ROUTING_POOL_SIZE=0 disables the pool (falls back to in-process compute).
ROUTING_POOL_SIZE    = int(os.getenv("ROUTING_POOL_SIZE", "2"))
ROUTING_POOL_TIMEOUT = float(os.getenv("ROUTING_POOL_TIMEOUT", "30"))
_routing_pool: "ProcessPoolExecutor | None" = None

# Postgres advisory-lock key so that, when the API runs with multiple worker
# processes, exactly ONE worker runs the stale-driver watchdog (otherwise every
# worker would scan and reroute the same dispatches). The lock is held for the
# lifetime of the winning worker via a dedicated raw connection.
_WATCHDOG_LOCK_KEY = 912736
_watchdog_lock_conn = None


def _acquire_watchdog_lock() -> bool:
    """Try to claim the singleton watchdog role for this worker process."""
    global _watchdog_lock_conn
    try:
        conn = engine.raw_connection()
        cur = conn.cursor()
        cur.execute("SELECT pg_try_advisory_lock(%s)", (_WATCHDOG_LOCK_KEY,))
        got = bool(cur.fetchone()[0])
        cur.close()
        if got:
            _watchdog_lock_conn = conn  # keep open to hold the session-level lock
            return True
        conn.close()
        return False
    except Exception as exc:
        logger.warning("Watchdog lock acquire failed (%s); running watchdog anyway.", exc)
        return True  # single-worker fallback: don't lose the watchdog on lock error


def _release_watchdog_lock() -> None:
    global _watchdog_lock_conn
    if _watchdog_lock_conn is not None:
        try:
            _watchdog_lock_conn.close()  # closing the session releases the lock
        except Exception:
            pass
        _watchdog_lock_conn = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global routing_engine, main_event_loop, _routing_pool
    main_event_loop = asyncio.get_running_loop()

    # Main-process engine: serves the /api/routing/* endpoints and the
    # stale-driver watchdog. The per-request deviation routing goes through the
    # process pool below instead.
    routing_engine = build_routing_engine(register_gym=True)
    if routing_engine is not None:
        logger.info("GeoAI routing engine ready. Graph: %s", routing_engine.graph.summary())
    else:
        logger.warning("Routing engine failed to start (non-fatal); routing endpoints unavailable.")

    # Process pool for CPU-bound route computation (see _run_routing_via_pool).
    if ROUTING_POOL_SIZE > 0:
        try:
            _routing_pool = ProcessPoolExecutor(
                max_workers=ROUTING_POOL_SIZE, initializer=routing_pool.init_worker
            )
            # Warm the pool so all workers load their graph now, not on the
            # first deviation request (avoids cold-start latency spikes).
            warm_futs = [
                _routing_pool.submit(routing_pool.warmup, 0.3)
                for _ in range(ROUTING_POOL_SIZE * 2)
            ]
            ready = sum(1 for f in warm_futs if f.result(timeout=180))
            logger.info(
                "Routing process pool started and warmed (workers=%s, ready=%s).",
                ROUTING_POOL_SIZE, ready,
            )
        except Exception as exc:
            logger.warning("Routing pool failed to start (%s); using in-process fallback.", exc)
            _routing_pool = None

    watchdog_task = None
    if _acquire_watchdog_lock():
        watchdog_task = asyncio.create_task(_stale_driver_watchdog())
        logger.info("Stale-driver watchdog started (interval=%ss).", WATCHDOG_INTERVAL_SECONDS)
    else:
        logger.info("Stale-driver watchdog held by another worker — not started here.")

    yield  # server runs here

    if watchdog_task is not None:
        watchdog_task.cancel()
        try:
            await watchdog_task
        except asyncio.CancelledError:
            pass
    _release_watchdog_lock()

    if _routing_pool is not None:
        _routing_pool.shutdown(wait=False, cancel_futures=True)
        logger.info("Routing process pool shut down.")

    if routing_engine:
        routing_engine.shutdown()
    logger.info("Routing engine shut down.")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="BFP Capstone — GeoAI Fire Response API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded report photos as static files (read-only).
app.mount("/uploads", StaticFiles(directory=UPLOAD_ROOT), name="uploads")


# ── WebSocket connection manager ──────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self._active: set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self._active.add(ws)

    def disconnect(self, ws: WebSocket):
        self._active.discard(ws)

    async def broadcast(self, message: dict):
        dead: set[WebSocket] = set()
        for ws in self._active:
            try:
                await ws.send_json(message)
            except Exception:
                dead.add(ws)
        self._active -= dead


manager = ConnectionManager()

# token → {"lat", "lng", "accuracy", "received_at"} or None
_report_sessions: dict[str, dict | None] = {}
# token → reporter phone number (set when an SMS link is generated/sent)
_report_session_phones: dict[str, str] = {}


@app.websocket("/ws")
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


# ── Schemas ───────────────────────────────────────────────────────────────────

class RouteRequest(BaseModel):
    source_node: int
    target_node: int


class RouteResponse(BaseModel):
    route_nodes: list[int]
    eta_seconds: int
    gnn_confidence: float
    route_wkt: str
    computation_ms: float


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "BFP Capstone API is running"}


@app.get("/health")
def health():
    db_ok = check_connection()
    return {"api": "ok", "database": "ok" if db_ok else "unavailable"}


@app.get("/api/routing/status")
def routing_status():
    if routing_engine is None:
        return {"status": "offline", "reason": "routing_engine is None"}
    g = routing_engine.graph.G
    return {
        "status": "online",
        "nodes": g.number_of_nodes(),
        "edges": g.number_of_edges(),
        "precomputed_weights": routing_engine._precomputed_weights,
        "gnn_type": type(routing_engine.gnn).__name__,
    }

def _load_active_obstructions(db: Session) -> list:
    rows = (
        db.query(RoadObstruction)
        .filter(RoadObstruction.is_active == True)
        .all()
    )
    return [
        {"type": r.type, "latitude": r.latitude, "longitude": r.longitude}
        for r in rows
    ]


@app.post("/api/routing/compute", response_model=RouteResponse)
def compute_route(req: RouteRequest, db: Session = Depends(get_db)):
    try:
        obs = _load_active_obstructions(db)
        result = routing_engine.compute_route(req.source_node, req.target_node, obstructions=obs)
        return RouteResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Routing error: {exc}")


@app.get("/api/routing/graph/summary")
def graph_summary():
    return routing_engine.graph.summary()


_gnn_constraints_cache: dict | None = None
_constraint_style_cache: dict | None = None
_coverage_cache: dict | None = None

# Properties carried through to the frontend per predicted-constraint feature.
_CONSTRAINT_PROP_KEYS = (
    "road_id", "barangay", "name", "highway",
    "display_constraint_type", "routing_constraint_type",
    "map_color", "map_weight", "map_opacity",
    "model_predicted_constrained", "model_probability_pct",
    "final_display_confidence_pct", "hover_confidence_text",
    "is_manual_verified", "is_gat_only_prediction",
)

# Labels for display_constraint_type values not covered by the style config
# (the GAT-only prediction buckets the export adds for the map legend).
_DISPLAY_LABELS = {
    "predicted_constraint_high_confidence": "Predicted constraint (high confidence)",
    "predicted_constraint_review": "Predicted constraint (needs review)",
    "normal": "Normal road",
}

# Map a user-drawn custom constraint_type onto the GAT style vocabulary.
_CUSTOM_STYLE_KEY = {
    "narrow_road": "narrow_road",
    "traffic_area": "traffic_general",
}


def _load_constraint_style() -> dict:
    global _constraint_style_cache
    if _constraint_style_cache is None:
        path = Config.CONSTRAINT_STYLE_PATH
        if path.exists():
            with open(path, encoding="utf-8") as f:
                _constraint_style_cache = json.load(f)
        else:
            _constraint_style_cache = {}
    return _constraint_style_cache


def _label_for(dtype: str, style: dict) -> str:
    """Human label for a display_constraint_type, preferring the style config."""
    if dtype in _DISPLAY_LABELS:
        return _DISPLAY_LABELS[dtype]
    s = style.get(dtype)
    if isinstance(s, dict) and s.get("label"):
        return s["label"]
    return (dtype or "").replace("_", " ").strip().capitalize() or "Unknown"


@app.get("/api/routing/gnn-constraints")
def gnn_constraints(db: Session = Depends(get_db)):
    """Return GAT-predicted per-road constraints + user-drawn custom constraints.

    Each feature carries its own map_color / map_weight / map_opacity and
    display_constraint_type so the map can render the constraint palette
    directly. A routing_multiplier (resolved from the style config by
    routing_constraint_type) is attached for the routing engine's edge costs,
    and meta.legend is built server-side so the map legend is independent of
    the style config (it also covers the GAT-only prediction buckets).
    """
    global _gnn_constraints_cache
    if _gnn_constraints_cache is not None:
        return _gnn_constraints_cache

    style = _load_constraint_style()
    multiplier_by_type = {
        k: v.get("routing_multiplier", 1.0)
        for k, v in style.items()
        if isinstance(v, dict)
    }

    constraints_path = Config.PREDICTED_CONSTRAINTS_PATH
    if not constraints_path.exists():
        raise HTTPException(status_code=404, detail="Predicted constraints file not found")

    with open(constraints_path, encoding="utf-8") as f:
        raw = json.load(f)

    features: list = []
    type_counts: dict[str, int] = {}
    type_color: dict[str, str] = {}   # display type → its map_color (for legend)
    constrained = 0
    threshold = None
    model_name = "GAT"

    for feat in raw.get("features", []):
        props = feat.get("properties", {}) or {}
        geom = feat.get("geometry") or {}
        if geom.get("type") != "LineString" or not geom.get("coordinates"):
            continue

        dtype = props.get("display_constraint_type") or "normal"
        type_counts[dtype] = type_counts.get(dtype, 0) + 1
        type_color.setdefault(dtype, props.get("map_color") or "#B0BEC5")
        if props.get("model_predicted_constrained"):
            constrained += 1
        if threshold is None:
            threshold = props.get("model_threshold")
            model_name = props.get("actual_model_used", model_name)

        rtype = props.get("routing_constraint_type") or dtype
        out = {k: props.get(k) for k in _CONSTRAINT_PROP_KEYS}
        out["routing_multiplier"] = multiplier_by_type.get(rtype, 1.0)
        out["display_label"] = _label_for(dtype, style)
        features.append({
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": geom["coordinates"]},
            "properties": out,
        })

    # ── Merge user-drawn custom constraints, styled from the GAT palette ───────
    custom_rows = (
        db.query(GnnConstraint)
        .filter(GnnConstraint.is_active == True)
        .all()
    )
    for c in custom_rows:
        style_key = _CUSTOM_STYLE_KEY.get(c.constraint_type, "narrow_road")
        s = style.get(style_key, {})
        type_counts[style_key] = type_counts.get(style_key, 0) + 1
        type_color.setdefault(style_key, s.get("color", "#E53935"))
        constrained += 1
        features.append({
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": json.loads(c.coordinates)},
            "properties": {
                "display_constraint_type": style_key,
                "routing_constraint_type": style_key,
                "display_label": c.name or s.get("label", style_key),
                "map_color": s.get("color", "#E53935"),
                "map_weight": s.get("weight", 4),
                "map_opacity": s.get("opacity", 0.95),
                "routing_multiplier": s.get("routing_multiplier", 1.45),
                "model_predicted_constrained": 1,
                "hover_confidence_text": "User-drawn constraint",
                "custom": True,
                "constraint_id": c.constraint_id,
            },
        })

    # ── Legend (server-built, sorted: constrained types by count, normal last) ─
    legend = [
        {
            "type": t,
            "label": _label_for(t, style),
            "color": type_color.get(t, "#B0BEC5"),
            "count": type_counts[t],
            "routing_multiplier": multiplier_by_type.get(t, 1.0),
        }
        for t in type_counts
    ]
    legend.sort(key=lambda it: (it["type"] == "normal", -it["count"]))

    result = {
        "constraints": {
            "type": "FeatureCollection",
            "features": features,
        },
        "style_config": style,
        "meta": {
            "model": model_name,
            "threshold": threshold,
            "total": len(features),
            "constrained": constrained,
            "type_counts": type_counts,
            "legend": legend,
        },
    }
# ── Custom GNN constraints (user-drawn) ──────────────────────────────────────

VALID_CONSTRAINT_TYPES = ("narrow_road", "traffic_area")


class ConstraintCreate(BaseModel):
    constraint_type: str
    name: str | None = None
    coordinates: list          # [[lon, lat], [lon, lat], ...]
    highway: str | None = None
    surface: str | None = None
    maxspeed: str | None = None


class ConstraintUpdate(BaseModel):
    name: str | None = None
    coordinates: list | None = None
    constraint_type: str | None = None
    highway: str | None = None
    surface: str | None = None
    maxspeed: str | None = None


def _constraint_to_dict(c: GnnConstraint) -> dict:
    return {
        "id":              c.constraint_id,
        "constraint_type": c.constraint_type,
        "name":            c.name or "",
        "coordinates":     json.loads(c.coordinates),
        "highway":         c.highway or "",
        "surface":         c.surface or "",
        "maxspeed":        c.maxspeed or "",
        "is_active":       c.is_active,
        "created_at":      c.created_at.isoformat() if c.created_at else None,
        "updated_at":      c.updated_at.isoformat() if c.updated_at else None,
    }


class LoginRequest(BaseModel):
    email: str
    password: str


def _verify_password(plain: str, stored: str) -> bool:
    try:
        _, params = stored.split("$", 1)
        salt, dk_hex = params.split("$")
        dk = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt.encode(), 260_000)
        return dk.hex() == dk_hex
    except Exception:
        return False


def _create_token(user: Users) -> str:
    import secrets
    payload = {
        "sub": str(user.user_id),
        "email": user.user_email,
        "role": user.user_role,
        "jti": secrets.token_hex(16),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(_bearer),
    db: Session = Depends(get_db),
) -> Users:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = int(payload["sub"])
        jti = payload.get("jti")
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if jti and db.query(TokenBlacklist).filter(TokenBlacklist.jti == jti).first():
        raise HTTPException(status_code=401, detail="Token has been revoked")
    user = db.get(Users, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def _user_profile(user: Users) -> dict:
    """Return a serialisable profile dict that includes name/contact from the related table."""
    profile = {
        "user_id":    user.user_id,
        "email":      user.user_email,
        "role":       user.user_role,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "first_name": None,
        "last_name":  None,
        "contact":    None,
        "designation": None,
        "rank":        None,
    }
    if user.admin:
        profile["first_name"] = user.admin.admin_firstname
        profile["last_name"]  = user.admin.admin_lastname
        profile["contact"]    = user.admin.admin_contact
    elif user.personnel:
        profile["first_name"]  = user.personnel.per_firstname
        profile["last_name"]   = user.personnel.per_lastname
        profile["contact"]     = user.personnel.per_contact
        profile["designation"] = user.personnel.per_designation
        profile["rank"]        = user.personnel.per_rank
    return profile


@app.post("/api/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(Users).filter(Users.user_email == req.email).first()
    if not user or not _verify_password(req.password, user.user_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {
        "access_token": _create_token(user),
        "token_type": "bearer",
        "user": _user_profile(user),
    }


@app.post("/login_user")
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
    }


@app.get("/api/auth/me")
def me(current_user: Users = Depends(get_current_user)):
    return _user_profile(current_user)


@app.post("/api/auth/logout", status_code=204)
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


@app.get("/api/routing/nearest-station")
def nearest_station(lat: float, lon: float):
    node_id = routing_engine.nearest_station_node(lat, lon)
    if node_id is None:
        raise HTTPException(status_code=404, detail="No station node found near that location.")
    node_data = routing_engine.graph.G.nodes[node_id]
    return {"node_id": node_id, "lat": node_data["lat"], "lon": node_data["lon"]}


# ── Response coverage (reachability isochrones) ──────────────────────────────
# Planning-mode coverage: how quickly a truck can reach each area from the fire
# stations, over the same constraint-aware road costs the router uses. The
# computation is a whole-graph multi-source Dijkstra + polygon build, so it is
# computed once and cached (stations don't move); ?refresh=1 recomputes.

_BARANGAYS_GEOJSON_PATH = Config.PREDICTED_CONSTRAINTS_PATH.parent / "panabo_barangays.geojson"


def _station_source_nodes(db: Session) -> list[int]:
    """Snap every station with coordinates to its nearest graph node."""
    nodes: list[int] = []
    for s in db.query(Station).all():
        if s.station_latitude is None or s.station_longitude is None:
            continue
        near = routing_engine.graph.nodes_near(
            float(s.station_latitude), float(s.station_longitude), radius_km=2.0
        )
        if near:
            nodes.append(near[0][0])
    return nodes


def _compute_or_get_coverage(db: Session, refresh: bool = False) -> dict:
    """Return the cached coverage result, computing (and caching) it if needed."""
    global _coverage_cache
    if _coverage_cache is not None and not refresh:
        return _coverage_cache

    if routing_engine is None:
        raise HTTPException(status_code=503, detail="Routing engine not loaded.")

    sources = _station_source_nodes(db)
    if not sources:
        raise HTTPException(
            status_code=404,
            detail="No stations with coordinates to compute coverage from.",
        )

    barangays = None
    if _BARANGAYS_GEOJSON_PATH.exists():
        with open(_BARANGAYS_GEOJSON_PATH, encoding="utf-8") as f:
            barangays = json.load(f)

    edge_costs, _ = routing_engine._compute_edge_costs()
    result = compute_coverage(routing_engine.graph, edge_costs, sources, barangays)
    if result is None:
        raise HTTPException(status_code=500, detail="Coverage computation produced no data.")

    _coverage_cache = result
    return result


@app.get("/api/coverage/isochrones")
def coverage_isochrones(
    refresh: bool = False,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    """GeoJSON reachability bands (nested <=3 / <=5 / <=8 min) from the stations."""
    data = _compute_or_get_coverage(db, refresh)
    return {"isochrones": data["isochrones"], "meta": data["meta"]}


@app.get("/api/coverage/gaps")
def coverage_gaps(
    minutes: int = 5,
    refresh: bool = False,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    """Per-barangay coverage % within `minutes`, worst-covered first."""
    data = _compute_or_get_coverage(db, refresh)
    gaps_by_min = data["gaps_by_min"]
    rows = gaps_by_min.get(minutes)
    if rows is None:
        # Requested band wasn't computed — fall back to the widest available.
        rows = gaps_by_min[max(gaps_by_min)] if gaps_by_min else []
    return {"minutes": minutes, "gaps": rows, "meta": data["meta"]}


@app.get("/api/personnel")
def get_personnel(
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    rows = db.query(Personnel).all()

    # Map each team with an active dispatch to its incident reference, so a
    # dispatched/on-scene member can show which incident they're assigned to.
    # Ordered newest-first; first write per team_id wins (the latest dispatch).
    team_incident = {}
    active_dispatches = (
        db.query(DispatchRecord)
        .filter(DispatchRecord.dispatch_status.in_(["dispatched", "en_route", "on_scene"]))
        .order_by(DispatchRecord.dispatch_at.desc())
        .all()
    )
    for d in active_dispatches:
        if d.team_id in team_incident:
            continue
        fi = d.fire_incident
        if not fi:
            continue
        year = fi.fire_incident_datetime.year if fi.fire_incident_datetime else None
        team_incident[d.team_id] = (
            f"INC-{year}-{fi.fire_id:03d}" if year else f"INC-{fi.fire_id:03d}"
        )

    result = []
    for p in rows:
        first = p.per_firstname or ""
        last  = p.per_lastname  or ""
        initials = ((first[0] if first else "") + (last[0] if last else "")).upper()

        device = p.devices[0] if p.devices else None
        if device and device.device_status == "active":
            iot = "active"
        elif device and device.device_status == "sms":
            iot = "sms"
        else:
            iot = "offline"

        # Personnel status comes from their team membership's member_status
        # (cascaded by the dispatch path and the team-status PATCH endpoint).
        # Fall back to per_designation for legacy rows, then "standby".
        valid_statuses = {"dispatched", "onscene", "standby", "offduty"}
        member_status = (
            (p.team_memberships[0].member_status or "").lower()
            if p.team_memberships else ""
        )
        if member_status in valid_statuses:
            status = member_status
        else:
            designation = (p.per_designation or "standby").lower()
            status = designation if designation in valid_statuses else "standby"

        joined = None
        if p.user and p.user.created_at:
            joined = p.user.created_at.strftime("%b %Y")

        team_id = p.team_memberships[0].team_id if p.team_memberships else None
        # Only surface the incident for members who are actually deployed.
        incident = (
            team_incident.get(team_id, "—")
            if status in ("dispatched", "onscene")
            else "—"
        )

        result.append({
            "id":          f"FU-{p.per_id:03d}",
            "per_id":      p.per_id,
            "name":        f"{first} {last}".strip(),
            "initials":    initials or "??",
            "rank":        p.per_rank        or "—",
            "designation": p.per_designation or "",
            "status":      status,
            "station":     p.station.station_name if p.station else "—",
            "station_id":  p.station_id,
            "team_id":     p.team_memberships[0].team_id   if p.team_memberships else None,
            "team_name":   p.team_memberships[0].team.team_name if p.team_memberships else "—",
            "shift_id":    p.shift_id,
            "shift_name":  p.shift.shift_name if p.shift else "—",
            "incident":    incident,
            "iot":         iot,
            "battery":     0,
            "phone":       p.per_contact or "—",
            "email":       p.user.user_email if p.user else "",
            "joined":      joined or "—",
        })
    return result


class PersonnelUpdate(BaseModel):
    per_firstname:   str | None = None
    per_lastname:    str | None = None
    per_contact:     str | None = None
    per_rank:        str | None = None
    per_designation: str | None = None
    station_id:      int | None = None
    shift_id:        int | None = None
    user_email:      str | None = None
    user_password:   str | None = None


def _hash_password(plain: str) -> str:
    import secrets
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt.encode(), 260_000)
    return f"pbkdf2:sha256:260000${salt}${dk.hex()}"


@app.patch("/api/personnel/{per_id}")
def update_personnel(
    per_id: int,
    body: PersonnelUpdate,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    p = db.get(Personnel, per_id)
    if not p:
        raise HTTPException(status_code=404, detail="Personnel not found.")

    if body.per_firstname   is not None: p.per_firstname   = body.per_firstname
    if body.per_lastname    is not None: p.per_lastname    = body.per_lastname
    if body.per_contact     is not None: p.per_contact     = body.per_contact
    if body.per_rank        is not None: p.per_rank        = body.per_rank
    if body.per_designation is not None: p.per_designation = body.per_designation
    if "station_id" in body.model_fields_set:
        if body.station_id is not None and not db.get(Station, body.station_id):
            raise HTTPException(status_code=404, detail="Station not found.")
        p.station_id = body.station_id
    if "shift_id" in body.model_fields_set:
        if body.shift_id is not None and not db.get(Shift, body.shift_id):
            raise HTTPException(status_code=404, detail="Shift not found.")
        p.shift_id = body.shift_id

    if p.user:
        if body.user_email is not None:
            conflict = db.query(Users).filter(
                Users.user_email == body.user_email,
                Users.user_id != p.user.user_id,
            ).first()
            if conflict:
                raise HTTPException(status_code=409, detail="Email already in use.")
            p.user.user_email = body.user_email
        if body.user_password is not None:
            p.user.user_password = _hash_password(body.user_password)

    db.commit()
    db.refresh(p)

    first = p.per_firstname or ""
    last  = p.per_lastname  or ""
    team_mem = p.team_memberships[0] if p.team_memberships else None
    return {
        "id":          f"FU-{p.per_id:03d}",
        "per_id":      p.per_id,
        "name":        f"{first} {last}".strip(),
        "rank":        p.per_rank        or "—",
        "designation": p.per_designation or "",
        "station":     p.station.station_name if p.station else "—",
        "station_id":  p.station_id,
        "team_id":     team_mem.team_id        if team_mem else None,
        "team_name":   team_mem.team.team_name if team_mem else "—",
        "phone":       p.per_contact or "—",
        "email":       p.user.user_email if p.user else "",
    }


class PersonnelCreate(BaseModel):
    per_firstname:   str
    per_lastname:    str
    per_contact:     str | None = None
    per_rank:        str
    per_designation: str | None = None
    station_id:      int | None = None
    user_email:      str
    user_password:   str
    user_role:       str = "personnel"


@app.post("/api/personnel", status_code=201)
def create_personnel(
    body: PersonnelCreate,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    conflict = db.query(Users).filter(Users.user_email == body.user_email).first()
    if conflict:
        raise HTTPException(status_code=409, detail="Email already in use.")

    if body.station_id is not None and not db.get(Station, body.station_id):
        raise HTTPException(status_code=404, detail="Station not found.")

    user = Users(
        user_email=body.user_email,
        user_password=_hash_password(body.user_password),
        user_role="personnel",
    )
    db.add(user)
    db.flush()

    p = Personnel(
        per_firstname=body.per_firstname,
        per_lastname=body.per_lastname,
        per_contact=body.per_contact or "",
        per_rank=body.per_rank,
        per_designation=body.per_designation or "",
        station_id=body.station_id,
        user_id=user.user_id,
    )
    db.add(p)
    db.commit()
    db.refresh(p)

    first = p.per_firstname or ""
    last  = p.per_lastname  or ""
    initials = ((first[0] if first else "") + (last[0] if last else "")).upper()
    return {
        "id":          f"FU-{p.per_id:03d}",
        "per_id":      p.per_id,
        "name":        f"{first} {last}".strip(),
        "initials":    initials or "??",
        "rank":        p.per_rank        or "—",
        "designation": p.per_designation or "",
        "status":      "standby",
        "station":     p.station.station_name if p.station else "—",
        "station_id":  p.station_id,
        "team_id":     None,
        "team_name":   "—",
        "shift_id":    None,
        "shift_name":  "—",
        "incident":    "—",
        "iot":         "offline",
        "battery":     0,
        "phone":       p.per_contact or "—",
        "email":       user.user_email,
        "joined":      user.created_at.strftime("%b %Y") if user.created_at else "—",
    }


@app.delete("/api/personnel/{per_id}", status_code=204)
def delete_personnel(
    per_id: int,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    p = db.get(Personnel, per_id)
    if not p:
        raise HTTPException(status_code=404, detail="Personnel not found.")

    user_id = p.user_id

    # Detach optional references that would otherwise block the delete.
    db.query(Station).filter(Station.station_commander_id == per_id).update(
        {"station_commander_id": None}, synchronize_session=False
    )
    db.query(DispatchTruck).filter(DispatchTruck.manned_by_per_id == per_id).update(
        {"manned_by_per_id": None}, synchronize_session=False
    )

    # Remove owned child rows: team memberships, live location, devices + logs.
    db.query(ResponseTeamMember).filter(ResponseTeamMember.per_id == per_id).delete(
        synchronize_session=False
    )
    db.query(CurrentLocation).filter(CurrentLocation.per_id == per_id).delete(
        synchronize_session=False
    )
    device_ids = [
        d.device_id for d in db.query(Device).filter(Device.per_id == per_id).all()
    ]
    if device_ids:
        db.query(LocationLog).filter(LocationLog.device_id.in_(device_ids)).delete(
            synchronize_session=False
        )
        db.query(Device).filter(Device.per_id == per_id).delete(
            synchronize_session=False
        )

    db.delete(p)
    db.flush()

    # The login account is created alongside the personnel record — remove it too.
    if user_id is not None:
        user = db.get(Users, user_id)
        if user:
            db.delete(user)

    db.commit()


class StationCreate(BaseModel):
    station_name: str
    station_type: str = "main"
    parent_station_id: int | None = None
    station_address: str
    station_barangay: str
    station_latitude: float
    station_longitude: float
    station_contact: str
    station_status: str = "operational"


def _station_dict(r: Station) -> dict:
    cmd = r.commander
    return {
        "station_id":          r.station_id,
        "station_name":        r.station_name,
        "station_type":        r.station_type or "main",
        "parent_station_id":   r.parent_station_id,
        "station_address":     r.station_address  or "",
        "station_barangay":    r.station_barangay or "",
        "station_latitude":    r.station_latitude,
        "station_longitude":   r.station_longitude,
        "station_contact":     r.station_contact  or "",
        "station_status":      r.station_status   or "operational",
        "station_commander_id": r.station_commander_id,
        "commander_name":      f"{cmd.per_firstname or ''} {cmd.per_lastname or ''}".strip() if cmd else None,
        "commander_rank":      cmd.per_rank if cmd else None,
        "created_at":          r.created_at.isoformat() if r.created_at else None,
    }


@app.get("/api/stations")
def get_stations(
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    rows = db.query(Station).order_by(Station.station_id).all()
    return [_station_dict(r) for r in rows]


@app.post("/api/stations", status_code=201)
def create_station(
    body: StationCreate,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    if db.query(Station).filter(Station.station_name == body.station_name).first():
        raise HTTPException(status_code=409, detail="A station with that name already exists.")
    if body.station_type == "sub" and body.parent_station_id is None:
        raise HTTPException(status_code=422, detail="A sub-station must have a parent station.")
    if body.parent_station_id and not db.get(Station, body.parent_station_id):
        raise HTTPException(status_code=404, detail="Parent station not found.")
    station = Station(
        station_name=body.station_name,
        station_type=body.station_type,
        parent_station_id=body.parent_station_id,
        station_address=body.station_address,
        station_barangay=body.station_barangay,
        station_latitude=body.station_latitude,
        station_longitude=body.station_longitude,
        station_contact=body.station_contact,
        station_status=body.station_status,
    )
    db.add(station)
    db.commit()
    db.refresh(station)
    return _station_dict(station)


class StationUpdate(BaseModel):
    station_name:         str | None = None
    station_type:         str | None = None
    parent_station_id:    int | None = None
    station_address:      str | None = None
    station_barangay:     str | None = None
    station_latitude:     float | None = None
    station_longitude:    float | None = None
    station_contact:      str | None = None
    station_status:       str | None = None
    station_commander_id: int | None = None


@app.patch("/api/stations/{station_id}")
def update_station(
    station_id: int,
    body: StationUpdate,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    station = db.get(Station, station_id)
    if not station:
        raise HTTPException(status_code=404, detail="Station not found.")
    if body.station_name is not None:
        conflict = db.query(Station).filter(
            Station.station_name == body.station_name,
            Station.station_id != station_id,
        ).first()
        if conflict:
            raise HTTPException(status_code=409, detail="A station with that name already exists.")
        station.station_name = body.station_name
    if body.station_type is not None:
        station.station_type = body.station_type
    if "parent_station_id" in body.model_fields_set:
        if body.parent_station_id is not None and not db.get(Station, body.parent_station_id):
            raise HTTPException(status_code=404, detail="Parent station not found.")
        station.parent_station_id = body.parent_station_id
    if body.station_address is not None:
        station.station_address = body.station_address
    if body.station_barangay is not None:
        station.station_barangay = body.station_barangay
    if body.station_latitude is not None:
        station.station_latitude = body.station_latitude
    if body.station_longitude is not None:
        station.station_longitude = body.station_longitude
    if body.station_contact is not None:
        station.station_contact = body.station_contact
    if body.station_status is not None:
        station.station_status = body.station_status
    if "station_commander_id" in body.model_fields_set:
        if body.station_commander_id is not None:
            from models import Personnel as _Personnel
            if not db.get(_Personnel, body.station_commander_id):
                raise HTTPException(status_code=404, detail="Personnel not found.")
        station.station_commander_id = body.station_commander_id
    db.commit()
    db.refresh(station)
    return _station_dict(station)


@app.delete("/api/stations/{station_id}", status_code=204)
def delete_station(
    station_id: int,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    station = db.get(Station, station_id)
    if not station:
        raise HTTPException(status_code=404, detail="Station not found.")

    # Block deletion while other records still reference this station, so we
    # never orphan personnel / trucks / teams or violate FK constraints.
    blockers = []
    n_personnel = db.query(Personnel).filter(Personnel.station_id == station_id).count()
    if n_personnel:
        blockers.append(f"{n_personnel} personnel")
    n_trucks = db.query(Truck).filter(Truck.station_id == station_id).count()
    if n_trucks:
        blockers.append(f"{n_trucks} truck{'s' if n_trucks != 1 else ''}")
    n_teams = db.query(ResponseTeam).filter(ResponseTeam.station_id == station_id).count()
    if n_teams:
        blockers.append(f"{n_teams} team{'s' if n_teams != 1 else ''}")
    n_subs = db.query(Station).filter(Station.parent_station_id == station_id).count()
    if n_subs:
        blockers.append(f"{n_subs} sub-station{'s' if n_subs != 1 else ''}")

    if blockers:
        raise HTTPException(
            status_code=409,
            detail=(
                "Cannot delete this station while it still has "
                + ", ".join(blockers)
                + " assigned. Reassign or remove them first."
            ),
        )

    db.delete(station)
    db.commit()


# ── Shifts ───────────────────────────────────────────────────────────────────

@app.get("/api/shifts")
def get_shifts(
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    rows = db.query(Shift).order_by(Shift.shift_id).all()
    return [{"shift_id": r.shift_id, "shift_name": r.shift_name} for r in rows]


# ── Teams ─────────────────────────────────────────────────────────────────────

def _team_dict(t: ResponseTeam) -> dict:
    members = []
    for m in t.members:
        p = m.personnel
        if not p:
            continue
        first = p.per_firstname or ""
        last  = p.per_lastname  or ""
        members.append({
            "per_id":        p.per_id,
            "name":          f"{first} {last}".strip() or "—",
            "initials":      ((first[0] if first else "") + (last[0] if last else "")).upper() or "??",
            "rank":          p.per_rank        or "—",
            "designation":   p.per_designation or "—",
            "member_role":   m.member_role     or "",
            "member_status": m.member_status   or "",
            "shift_id":      p.shift_id,
            "shift_name":    p.shift.shift_name if p.shift else "—",
        })
    return {
        "team_id":           t.team_id,
        "team_name":         t.team_name   or "",
        "team_code":         t.team_code   or "",
        "team_status":       t.team_status or "standby",
        "station_id":        t.station_id,
        "station_name":      t.station.station_name      if t.station else "—",
        "station_latitude":  t.station.station_latitude  if t.station else None,
        "station_longitude": t.station.station_longitude if t.station else None,
        "shift_id":          t.shift_id,
        "shift_name":        t.shift.shift_name if t.shift else "—",
        "truck_id":          t.truck_id,
        "truck_platenum":    t.truck.truck_platenum if t.truck else None,
        "member_count": len(t.members),
        "members":      members,
        "created_at":   t.team_created_at.isoformat() if t.team_created_at else None,
    }


class TeamCreate(BaseModel):
    team_name:  str
    team_code:  str | None = None
    team_status: str = "standby"
    station_id: int | None = None
    shift_id:   int | None = None
    truck_id:   int | None = None


class TeamUpdate(BaseModel):
    team_name:  str | None = None
    team_code:  str | None = None
    team_status: str | None = None
    station_id: int | None = None
    shift_id:   int | None = None
    truck_id:   int | None = None


@app.get("/api/teams")
def get_teams(
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    rows = db.query(ResponseTeam).order_by(ResponseTeam.team_id).all()
    return [_team_dict(r) for r in rows]


@app.post("/api/teams", status_code=201)
def create_team(
    body: TeamCreate,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    if body.station_id and not db.get(Station, body.station_id):
        raise HTTPException(status_code=404, detail="Station not found.")
    if body.shift_id is not None and not db.get(Shift, body.shift_id):
        raise HTTPException(status_code=404, detail="Shift not found.")
    if body.truck_id is not None and not db.get(Truck, body.truck_id):
        raise HTTPException(status_code=404, detail="Truck not found.")
    team = ResponseTeam(
        team_name=body.team_name,
        team_code=body.team_code,
        team_status=body.team_status,
        station_id=body.station_id,
        shift_id=body.shift_id,
        truck_id=body.truck_id,
    )
    db.add(team)
    db.commit()
    db.refresh(team)
    return _team_dict(team)


@app.patch("/api/teams/{team_id}")
def update_team(
    team_id: int,
    body: TeamUpdate,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    team = db.get(ResponseTeam, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")
    if body.team_name   is not None: team.team_name   = body.team_name
    if body.team_code   is not None: team.team_code   = body.team_code
    if body.team_status is not None and body.team_status != team.team_status:
        team.team_status = body.team_status
        # Cascade to all team members so member_status mirrors the team's
        # current state (used by auto-dispatch eligibility checks).
        for m in team.members or []:
            m.member_status = body.team_status
    if "station_id" in body.model_fields_set:
        if body.station_id is not None and not db.get(Station, body.station_id):
            raise HTTPException(status_code=404, detail="Station not found.")
        team.station_id = body.station_id
    if "shift_id" in body.model_fields_set:
        if body.shift_id != team.shift_id:
            if team.members:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot change a team's shift while it has members. Remove all members first.",
                )
            if body.shift_id is not None and not db.get(Shift, body.shift_id):
                raise HTTPException(status_code=404, detail="Shift not found.")
        team.shift_id = body.shift_id
    if "truck_id" in body.model_fields_set:
        if body.truck_id is not None and not db.get(Truck, body.truck_id):
            raise HTTPException(status_code=404, detail="Truck not found.")
        team.truck_id = body.truck_id
    db.commit()
    db.refresh(team)
    return _team_dict(team)


@app.delete("/api/teams/{team_id}", status_code=204)
def delete_team(
    team_id: int,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    team = db.get(ResponseTeam, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")
    db.delete(team)
    db.commit()


# ── Team members ──────────────────────────────────────────────────────────────

class TeamMemberBody(BaseModel):
    per_id:        int
    member_role:   str | None = None
    member_status: str | None = None


class TeamMemberRoleUpdate(BaseModel):
    member_role:   str | None = None
    member_status: str | None = None


@app.post("/api/teams/{team_id}/members", status_code=201)
def add_team_member(
    team_id: int,
    body: TeamMemberBody,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    team = db.get(ResponseTeam, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")
    person = db.get(Personnel, body.per_id)
    if not person:
        raise HTTPException(status_code=404, detail="Personnel not found.")
    if team.shift_id is not None and person.shift_id != team.shift_id:
        raise HTTPException(
            status_code=400,
            detail="Personnel shift does not match the team's shift.",
        )
    existing = db.query(ResponseTeamMember).filter(
        ResponseTeamMember.team_id == team_id,
        ResponseTeamMember.per_id  == body.per_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Already a member of this team.")
    m = ResponseTeamMember(
        team_id=team_id,
        per_id=body.per_id,
        member_role=body.member_role,
        member_status=body.member_status or "standby",
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return {"members_id": m.members_id, "team_id": m.team_id, "per_id": m.per_id, "member_role": m.member_role}


@app.patch("/api/teams/{team_id}/members/{per_id}", status_code=200)
def update_team_member(
    team_id: int,
    per_id: int,
    body: TeamMemberRoleUpdate,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    m = db.query(ResponseTeamMember).filter(
        ResponseTeamMember.team_id == team_id,
        ResponseTeamMember.per_id  == per_id,
    ).first()
    if not m:
        raise HTTPException(status_code=404, detail="Member not found.")
    if body.member_role   is not None: m.member_role   = body.member_role
    if body.member_status is not None: m.member_status = body.member_status
    db.commit()
    return {"members_id": m.members_id, "team_id": m.team_id, "per_id": m.per_id, "member_role": m.member_role}


@app.delete("/api/teams/{team_id}/members/{per_id}", status_code=204)
def remove_team_member(
    team_id: int,
    per_id: int,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    m = db.query(ResponseTeamMember).filter(
        ResponseTeamMember.team_id == team_id,
        ResponseTeamMember.per_id  == per_id,
    ).first()
    if not m:
        raise HTTPException(status_code=404, detail="Member not found.")
    db.delete(m)
    db.commit()


@app.get("/api/barangays")
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


@app.get("/api/heatmap")
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


# ── Road obstructions ────────────────────────────────────────────────────────

@app.get("/api/obstructions")
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


class ObstructionCreate(BaseModel):
    type:        str
    latitude:    float
    longitude:   float
    description: str | None = None
    expires_at:  str | None = None


@app.post("/api/obstructions", status_code=201)
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


@app.delete("/api/obstructions/{obstruction_id}", status_code=204)
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


# ── Custom GNN constraints (CRUD) ────────────────────────────────────────────

@app.get("/api/constraints")
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


@app.post("/api/constraints", status_code=201)
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

    global _gnn_constraints_cache
    _gnn_constraints_cache = None

    data = _constraint_to_dict(c)
    await manager.broadcast({"type": "constraint_created", "data": data})
    return data


@app.patch("/api/constraints/{constraint_id}")
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

    global _gnn_constraints_cache
    _gnn_constraints_cache = None

    data = _constraint_to_dict(c)
    await manager.broadcast({"type": "constraint_updated", "data": data})
    return data


@app.delete("/api/constraints/{constraint_id}", status_code=204)
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

    global _gnn_constraints_cache
    _gnn_constraints_cache = None

    await manager.broadcast({"type": "constraint_deleted", "data": {"id": constraint_id}})


# ── Reporter sessions ────────────────────────────────────────────────────────

class ReporterLocationBody(BaseModel):
    lat: float
    lng: float
    accuracy: float | None = None


class ReporterSmsBody(BaseModel):
    phone_number: str


def _normalize_ph_number(raw: str) -> str:
    """Normalize a Philippine mobile number to +63XXXXXXXXXX (PhilSMS format)."""
    n = "".join(str(raw or "").split()).replace("-", "")
    if n.startswith("+63"):
        return n
    if n.startswith("63"):
        return "+" + n
    if n.startswith("09") and len(n) == 11:
        return "+63" + n[1:]
    raise ValueError("Invalid Philippine number. Use 09XXXXXXXXX or +639XXXXXXXXX.")


async def _send_philsms(recipient: str, message: str) -> dict:
    """Send an SMS via PhilSMS. Raises RuntimeError on failure."""
    if not PHILSMS_API_TOKEN or "PASTE_" in PHILSMS_API_TOKEN:
        raise RuntimeError("PhilSMS API token is not configured (set PHILSMS_API_TOKEN).")
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            PHILSMS_SEND_URL,
            headers={
                "Authorization": f"Bearer {PHILSMS_API_TOKEN}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            json={
                "recipient": recipient,
                "sender_id": PHILSMS_SENDER_ID,
                "type": "plain",
                "message": message,
            },
        )
    try:
        data = resp.json()
    except Exception:
        data = {}
    if resp.status_code >= 400 or (isinstance(data, dict) and data.get("status") == "error"):
        detail = (data.get("message") if isinstance(data, dict) else None) or \
            f"PhilSMS request failed ({resp.status_code}): {resp.text}"
        raise RuntimeError(detail)
    return data


@app.post("/api/report-sessions/{token}/location", status_code=204)
async def submit_reporter_location(token: str, body: ReporterLocationBody):
    """Called by the reporter page — no auth required."""
    phone = _report_session_phones.get(token)
    _report_sessions[token] = {
        "lat": body.lat,
        "lng": body.lng,
        "accuracy": body.accuracy,
        "phone": phone,
        "received_at": datetime.now(timezone.utc).isoformat(),
    }
    await manager.broadcast({
        "type": "reporter_location",
        "data": {
            "token":    token,
            "lat":      body.lat,
            "lng":      body.lng,
            "accuracy": body.accuracy,
            "phone":    phone,
        },
    })


@app.get("/api/report-sessions")
def list_report_sessions(_auth: Users = Depends(get_current_user)):
    """All reporter sessions with a received location — used to rehydrate map
    pins after a dashboard reload (WS only pushes new events)."""
    out = []
    for token, loc in _report_sessions.items():
        if not loc:
            continue
        out.append({
            "token":       token,
            "coords":      [loc["lat"], loc["lng"]],
            "accuracy":    loc.get("accuracy"),
            "phone":       loc.get("phone"),
            "received_at": loc.get("received_at"),
        })
    return out


@app.get("/api/report-sessions/{token}")
def get_report_session(token: str, _auth: Users = Depends(get_current_user)):
    """Dispatch can poll this as a fallback if WS is unavailable."""
    if token not in _report_sessions:
        raise HTTPException(status_code=404, detail="Session not found.")
    loc = _report_sessions[token]
    return {
        "coords":      [loc["lat"], loc["lng"]] if loc else None,
        "accuracy":    loc["accuracy"] if loc else None,
        "received_at": loc["received_at"] if loc else None,
    }


@app.post("/api/report-sessions/{token}/send-sms")
async def send_reporter_sms(
    token: str,
    body: ReporterSmsBody,
    _auth: Users = Depends(get_current_user),
):
    """Text the reporter a link to the backend-served location page.

    The link points at PUBLIC_BASE_URL (the ngrok tunnel to this backend), so it
    opens on the reporter's phone. When SEND_SMS is false the SMS is not sent and
    the generated link is returned for manual sharing.
    """
    try:
        recipient = _normalize_ph_number(body.phone_number)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    link = f"{PUBLIC_BASE_URL}/report/{token}"
    message = (
        "BFP FireGIS: Please share your location to help emergency responders "
        f"reach you. Tap: {link}"
    )

    # Mark the session pending so the dispatcher poll-fallback doesn't 404,
    # and remember the phone so it can prefill the incident form later.
    _report_sessions.setdefault(token, None)
    _report_session_phones[token] = recipient

    if not SEND_SMS:
        return {"status": "not_sent", "sms_sent": False, "link": link,
                "phone_number": recipient, "detail": "SEND_SMS is disabled."}

    try:
        await _send_philsms(recipient, message)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return {"status": "sent", "sms_sent": True, "link": link, "phone_number": recipient}


@app.get("/report/{token}", response_class=HTMLResponse)
def reporter_page(token: str):
    """Self-contained reporter location page served over the public tunnel.

    The reporter opens this on their phone, taps to share GPS, and the page
    POSTs to /api/report-sessions/{token}/location (same origin), which
    broadcasts the position to the dispatch dashboard over WebSocket.
    """
    token_js = json.dumps(token)
    token_safe = _html.escape(token)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <title>BFP FireGIS — Share Location</title>
  <style>
    * {{ box-sizing: border-box; }}
    body {{ font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      margin: 0; min-height: 100vh; display: flex; align-items: center;
      justify-content: center; background: #0f1115; color: #e8eaed; padding: 20px; }}
    .card {{ width: 100%; max-width: 420px; background: #181b22; border: 1px solid #2a2e37;
      border-radius: 16px; padding: 28px 24px; text-align: center; }}
    .org {{ font-size: 13px; letter-spacing: .5px; color: #9aa0aa; margin-bottom: 18px; }}
    .brand {{ font-size: 24px; font-weight: 800; margin-bottom: 4px; }}
    .brand span {{ color: #ff5a4d; }}
    .icon {{ font-size: 46px; margin: 14px 0 6px; }}
    h1 {{ font-size: 19px; margin: 8px 0; }}
    p {{ font-size: 14px; line-height: 1.5; color: #c4c8d0; }}
    .chip {{ display: inline-block; margin: 14px 0; padding: 6px 12px; border-radius: 999px;
      background: #21262f; font-size: 12px; color: #9aa0aa; }}
    button {{ width: 100%; padding: 15px; font-size: 16px; font-weight: 700; border: 0;
      border-radius: 10px; cursor: pointer; margin-top: 10px; }}
    .cta {{ background: #00c853; color: #04210f; }}
    .cta:disabled {{ opacity: .6; }}
    .retry {{ background: #2a2e37; color: #e8eaed; }}
    .privacy {{ font-size: 12px; color: #777d88; margin-top: 16px; }}
    .coords {{ text-align: left; background: #11141a; border: 1px solid #2a2e37;
      border-radius: 10px; padding: 12px 14px; margin-top: 16px; font-size: 13px; }}
    .coords div {{ display: flex; justify-content: space-between; padding: 3px 0; }}
    .hidden {{ display: none; }}
    .spinner {{ width: 38px; height: 38px; border: 4px solid #2a2e37; border-top-color: #00c853;
      border-radius: 50%; margin: 14px auto; animation: spin 1s linear infinite; }}
    @keyframes spin {{ to {{ transform: rotate(360deg); }} }}
    .ok {{ color: #00c853; }} .err {{ color: #ff5a4d; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">FIRE<span>GIS</span></div>
    <div class="org">Bureau of Fire Protection</div>

    <div id="idle">
      <div class="icon">📍</div>
      <h1>Emergency Location Request</h1>
      <p>BFP dispatch has requested your location for emergency response coordination.
         Sharing your location helps responders reach you faster.</p>
      <div class="chip">Session · {token_safe}</div>
      <button class="cta" id="shareBtn" onclick="shareLocation()">Share My Location</button>
      <div class="privacy">Your location is shared only with BFP dispatch and is not stored permanently.</div>
    </div>

    <div id="requesting" class="hidden">
      <div class="spinner"></div>
      <h1>Getting Your Location…</h1>
      <p>Please allow location access when your browser prompts you.</p>
    </div>

    <div id="success" class="hidden">
      <div class="icon ok">✓</div>
      <h1 class="ok">Location Sent</h1>
      <p>Your location has been shared with BFP dispatch. You may close this tab.</p>
      <div class="coords" id="coords"></div>
      <div class="privacy">Thank you for cooperating with BFP.</div>
    </div>

    <div id="error" class="hidden">
      <div class="icon err">!</div>
      <h1 class="err">Could Not Share Location</h1>
      <p id="errMsg"></p>
      <button class="retry" onclick="show('idle')">Try Again</button>
    </div>
  </div>

  <script>
    const token = {token_js};
    function show(id) {{
      for (const s of ['idle','requesting','success','error'])
        document.getElementById(s).classList.toggle('hidden', s !== id);
    }}
    function shareLocation() {{
      if (!navigator.geolocation) {{
        document.getElementById('errMsg').textContent = 'Geolocation is not supported on this device.';
        return show('error');
      }}
      show('requesting');
      navigator.geolocation.getCurrentPosition(async (pos) => {{
        const {{ latitude: lat, longitude: lng, accuracy }} = pos.coords;
        try {{
          const res = await fetch('/api/report-sessions/' + encodeURIComponent(token) + '/location', {{
            method: 'POST',
            headers: {{ 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' }},
            body: JSON.stringify({{ lat, lng, accuracy }}),
          }});
          if (!res.ok) throw new Error('Server responded ' + res.status);
          document.getElementById('coords').innerHTML =
            '<div><span>Latitude</span><span>' + lat.toFixed(6) + '</span></div>' +
            '<div><span>Longitude</span><span>' + lng.toFixed(6) + '</span></div>' +
            '<div><span>Accuracy</span><span>±' + Math.round(accuracy) + ' m</span></div>';
          show('success');
        }} catch (e) {{
          document.getElementById('errMsg').textContent =
            'Location captured but could not be sent to dispatch. Please try again.';
          show('error');
        }}
      }}, (err) => {{
        const msgs = {{
          1: 'Location access was denied. Please allow location access and try again.',
          2: 'Your location could not be determined. Check that GPS is enabled.',
          3: 'Location request timed out. Please try again.',
        }};
        document.getElementById('errMsg').textContent = msgs[err.code] || 'An unknown error occurred.';
        show('error');
      }}, {{ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }});
    }}
  </script>
</body>
</html>"""


# ── Incidents ─────────────────────────────────────────────────────────────────

def _incident_dict(r: FireIncident) -> dict:
    return {
        "id":             f"INC-{r.fire_incident_datetime.year}-{r.fire_id:03d}" if r.fire_incident_datetime else f"INC-{r.fire_id:03d}",
        "fire_id":        r.fire_id,
        "loc":            r.fire_location_name  or f"{r.fire_latitude:.4f}, {r.fire_longitude:.4f}",
        "addr":           r.fire_address        or "",
        "sev":            r.fire_severity       or "Minor",
        "status":         r.fire_status         or "pending",
        "alarm":          r.fire_alarm_level    or "1st Alarm",
        "structure":      r.fire_structure_type or "",
        "casualties":     r.fire_casualties     or "None",
        "units":          r.fire_units_assigned or 0,
        "reporter":       r.fire_reporter_name  or r.fire_reporter_contact or "—",
        "latitude":       r.fire_latitude,
        "longitude":      r.fire_longitude,
        "reported_at":    r.fire_incident_datetime.isoformat() if r.fire_incident_datetime else None,
        "remarks":        r.fire_remarks or "",
    }


_SEV_SORT = case(
    (FireIncident.fire_severity == "Critical", 0),
    (FireIncident.fire_severity == "Moderate", 1),
    else_=2,
)

@app.get("/api/incidents")
def get_incidents(
    period:    str | None = None,   # "day" | "month" | "year"
    status:    str | None = None,
    search:    str | None = None,
    sev:       str | None = None,
    alarm:     str | None = None,
    sort_col:  str = "reported_at",
    sort_dir:  str = "desc",
    page:      int = Query(1,  ge=1),
    page_size: int = Query(15, ge=1, le=100),
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    q = db.query(FireIncident)

    # period filter
    if period in ("day", "month", "year"):
        now = datetime.now(timezone.utc)
        if period == "day":
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "month":
            start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        q = q.filter(FireIncident.fire_incident_datetime >= start)

    # stats reflect period but not the active status tab
    stats_q = q
    stats = {
        s: stats_q.filter(FireIncident.fire_status == s).count()
        for s in ("pending", "active", "dispatched", "contained", "closed")
    }

    if status and status != "all":
        q = q.filter(FireIncident.fire_status == status)
    if sev:
        q = q.filter(FireIncident.fire_severity == sev)
    if alarm:
        q = q.filter(FireIncident.fire_alarm_level == alarm)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(
            FireIncident.fire_location_name.ilike(like),
            FireIncident.fire_address.ilike(like),
        ))

    total = q.count()

    _sort_map = {
        "id":          FireIncident.fire_id,
        "loc":         FireIncident.fire_location_name,
        "sev":         _SEV_SORT,
        "reported_at": FireIncident.fire_incident_datetime,
        "units":       FireIncident.fire_units_assigned,
    }
    col = _sort_map.get(sort_col, FireIncident.fire_incident_datetime)
    q = q.order_by(col.asc() if sort_dir == "asc" else col.desc())

    rows = q.offset((page - 1) * page_size).limit(page_size).all()
    return {
        "total":     total,
        "page":      page,
        "page_size": page_size,
        "stats":     stats,
        "items":     [_incident_dict(r) for r in rows],
    }


@app.get("/api/incidents/active")
def get_active_incidents(
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    """Plain array of non-closed incidents for the dashboard map/sidebar."""
    rows = (
        db.query(FireIncident)
        .filter(FireIncident.fire_status != "closed")
        .order_by(FireIncident.fire_incident_datetime.desc())
        .all()
    )
    return [_incident_dict(r) for r in rows]


class IncidentCreate(BaseModel):
    fire_location_name:  str | None = None
    fire_address:        str | None = None
    fire_latitude:       float
    fire_longitude:      float
    fire_severity:       str = "Minor"
    fire_status:         str = "pending"
    fire_alarm_level:    str | None = None
    fire_structure_type: str | None = None
    fire_casualties:     str | None = None
    fire_units_assigned: int = 0
    fire_reporter_name:  str | None = None
    fire_reporter_contact: str | None = None
    fire_location_source: str = "manual"
    fire_remarks:        str | None = None
    auto_dispatch:       bool = False
    # When the incident was logged from a reporter pin, the session token so the
    # transient location can be cleared (it's now persisted as an incident).
    reporter_token:      str | None = None


@app.post("/api/incidents", status_code=201)
async def create_incident(
    body: IncidentCreate,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    incident = FireIncident(
        fire_location_name=body.fire_location_name,
        fire_address=body.fire_address,
        fire_latitude=body.fire_latitude,
        fire_longitude=body.fire_longitude,
        fire_severity=body.fire_severity,
        fire_status=body.fire_status,
        fire_alarm_level=body.fire_alarm_level,
        fire_structure_type=body.fire_structure_type,
        fire_casualties=body.fire_casualties,
        fire_units_assigned=body.fire_units_assigned,
        fire_reporter_name=body.fire_reporter_name,
        fire_reporter_contact=body.fire_reporter_contact,
        fire_location_source=body.fire_location_source,
        fire_remarks=body.fire_remarks,
        confirmed_user_id=_auth.user_id,
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    data = _incident_dict(incident)
    await manager.broadcast({"type": "incident_created", "data": data})

    # The reporter location is now persisted as an incident — drop the transient
    # session and tell every dashboard to remove its pin.
    if body.reporter_token:
        _report_sessions.pop(body.reporter_token, None)
        _report_session_phones.pop(body.reporter_token, None)
        await manager.broadcast({
            "type": "reporter_cleared",
            "data": {"token": body.reporter_token},
        })

    if body.auto_dispatch:
        selection = select_best_team(db, incident, routing_engine=routing_engine)
        if selection.ok:
            dispatch_result = await _perform_dispatch(db, incident.fire_id, selection.team_id)
            data["auto_dispatch"] = {
                "status":      "dispatched",
                "dispatch_id": dispatch_result["dispatch_id"],
                "team_id":     selection.team_id,
                "station_id":  selection.station_id,
                "eta_minutes": round(selection.eta_seconds / 60, 2) if selection.eta_seconds else None,
                "breakdown":   selection.breakdown,
                "routes":      dispatch_result.get("routes", []),
            }
        else:
            data["auto_dispatch"] = {"status": "no_team_available", "reason": selection.reason}
            await manager.broadcast({
                "type": "auto_dispatch_failed",
                "data": {"fire_id": incident.fire_id, "reason": selection.reason},
            })
    else:
        data["auto_dispatch"] = {"status": "skipped"}

    return data


class IncidentUpdate(BaseModel):
    fire_location_name:  str | None = None
    fire_address:        str | None = None
    fire_severity:       str | None = None
    fire_status:         str | None = None
    fire_alarm_level:    str | None = None
    fire_structure_type: str | None = None
    fire_casualties:     str | None = None
    fire_units_assigned: int | None = None
    fire_reporter_name:  str | None = None
    fire_reporter_contact: str | None = None
    fire_remarks:        str | None = None


# ── Dispatch ──────────────────────────────────────────────────────────────────

class DispatchCreate(BaseModel):
    fire_id:  int
    team_id:  int


async def _perform_dispatch(
    db: Session,
    fire_id: int,
    team_id: int,
) -> dict:
    """Shared dispatch logic used by manual POST /api/dispatch and auto-dispatch.

    Creates the DispatchRecord, marks the incident dispatched, locks the team,
    computes up to 3 GNN routes, and returns the response payload. Broadcasts
    an `incident_updated` event over the websocket.

    Raises HTTPException(404) if incident or team not found.
    """
    incident = db.get(FireIncident, fire_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found.")
    team = db.get(ResponseTeam, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")

    dispatch = DispatchRecord(
        fire_id=fire_id,
        team_id=team_id,
        dispatch_status="dispatched",
        dispatch_truck_count=0,
    )
    db.add(dispatch)

    incident.fire_units_assigned = (incident.fire_units_assigned or 0) + 1
    incident.fire_status = "dispatched"
    team.team_status = "dispatched"
    for m in team.members or []:
        m.member_status = "dispatched"

    db.commit()
    db.refresh(dispatch)
    db.refresh(incident)

    # Attach the team's assigned truck to this dispatch (if any). This is what the
    # driver later "mans" and what _sync_truck follows.
    if team.truck_id:
        db.add(DispatchTruck(dispatch_id=dispatch.dispatch_id, truck_id=team.truck_id))
        dispatch.dispatch_truck_count = 1
        if team.truck:
            team.truck.truck_status = "dispatched"
        db.commit()
        db.refresh(dispatch)

    await manager.broadcast({"type": "incident_updated", "data": _incident_dict(incident)})

    # ── Route origin selection (150 m threshold) ──────────────────────────────
    # Origin is the driver's live position if they are more than 150 m from the
    # station; otherwise the station is used (e.g. truck still in the bay).
    ORIGIN_THRESHOLD_M = 150

    station = team.station
    origin_lat = origin_lng = None
    origin_source = "station"

    if station and station.station_latitude and station.station_longitude:
        # Try to find the driver's current location
        driver_membership = next(
            (m for m in team.members if m.member_role == "driver"), None
        )
        if driver_membership:
            driver_loc = db.get(CurrentLocation, driver_membership.per_id)
            now_ts = datetime.now(timezone.utc)
            if driver_loc:
                rec_at = driver_loc.recorded_at
                if rec_at.tzinfo is None:
                    rec_at = rec_at.replace(tzinfo=timezone.utc)
                loc_age_ok = (now_ts - rec_at) <= timedelta(minutes=STALE_MINUTES)
                if loc_age_ok:
                    dist_to_station = _haversine_meters(
                        float(driver_loc.latitude), float(driver_loc.longitude),
                        station.station_latitude,   station.station_longitude,
                    )
                    if dist_to_station > ORIGIN_THRESHOLD_M:
                        origin_lat    = float(driver_loc.latitude)
                        origin_lng    = float(driver_loc.longitude)
                        origin_source = "driver_location"

        if origin_lat is None:
            origin_lat    = station.station_latitude
            origin_lng    = station.station_longitude
            origin_source = "station"

    # ── Compute up to 3 GNN routes ────────────────────────────────────────────
    saved_routes = []
    if routing_engine and origin_lat is not None and incident.fire_latitude and incident.fire_longitude:
        try:
            src_candidates = routing_engine.graph.nodes_near(origin_lat, origin_lng, radius_km=2.0)
            tgt_candidates = routing_engine.graph.nodes_near(
                incident.fire_latitude, incident.fire_longitude, radius_km=2.0)
            if src_candidates and tgt_candidates:
                obs = _load_active_obstructions(db)
                route_results = routing_engine.compute_routes_multi_alpha(
                    src_candidates[0][0], tgt_candidates[0][0], obstructions=obs)
                for r in route_results:
                    route_obj = Route(
                        fire_id=fire_id,
                        dispatch_id=dispatch.dispatch_id,
                        route_rank=r["rank"],
                        route_type=r["route_type"],
                        route_path_geojson=r["route_wkt"],
                        route_distance_meters=r.get("route_distance_meters"),
                        route_est_minutes=round(r["eta_seconds"] / 60, 2),
                        route_is_selected=r["is_selected"],
                        route_origin_source=origin_source,
                        route_origin_lat=origin_lat,
                        route_origin_lng=origin_lng,
                    )
                    db.add(route_obj)
                    saved_routes.append((route_obj, r))
                db.commit()
                for route_obj, _ in saved_routes:
                    db.refresh(route_obj)
                selected_obj = next((ro for ro, r in saved_routes if r["is_selected"]), None)
                if selected_obj:
                    dispatch.route_id = selected_obj.route_id
                    db.commit()
        except Exception as exc:
            logger.warning("Route computation failed (dispatch will proceed): %s", exc)

    def _route_dict(ro, r):
        return {
            "route_id":      ro.route_id,
            "rank":          r["rank"],
            "route_type":    r["route_type"],
            "is_selected":   r["is_selected"],
            "route_wkt":     r["route_wkt"],
            "eta_minutes":   round(r["eta_seconds"] / 60, 2),
            "origin_source": origin_source,
        }

    return {
        "dispatch_id":     dispatch.dispatch_id,
        "fire_id":         dispatch.fire_id,
        "team_id":         dispatch.team_id,
        "dispatch_status": dispatch.dispatch_status,
        "dispatch_at":     dispatch.dispatch_at.isoformat() if dispatch.dispatch_at else None,
        "origin_source":   origin_source,
        "routes":          [_route_dict(ro, r) for ro, r in saved_routes],
    }


@app.post("/api/dispatch", status_code=201)
async def create_dispatch(
    body: DispatchCreate,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    return await _perform_dispatch(db, body.fire_id, body.team_id)


@app.get("/api/dispatch")
def get_dispatches(
    fire_id: int | None = None,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    q = db.query(DispatchRecord)
    if fire_id:
        q = q.filter(DispatchRecord.fire_id == fire_id)
    rows = q.order_by(DispatchRecord.dispatch_at.desc()).all()
    def _dispatch_routes(r):
        # Routes owned by this specific dispatch, ordered by rank
        inc_routes = (
            db.query(Route)
            .filter(Route.dispatch_id == r.dispatch_id)
            .order_by(Route.route_rank)
            .all()
        )
        return [
            {
                "route_id":              rt.route_id,
                "rank":                  rt.route_rank,
                "route_type":            rt.route_type,
                "is_selected":           rt.route_is_selected,
                "route_wkt":             rt.route_path_geojson,
                "eta_minutes":           rt.route_est_minutes,
                "distance_meters":       rt.route_distance_meters,
            }
            for rt in inc_routes
        ]

    def _team_members(r):
        if not r.team:
            return []
        return [
            {
                "per_id":      m.per_id,
                "name":        f"{m.personnel.per_firstname} {m.personnel.per_lastname}" if m.personnel else "—",
                "rank":        m.personnel.per_rank        if m.personnel else "—",
                "designation": m.personnel.per_designation if m.personnel else "—",
                "member_role": m.member_role,
                "initials":    (
                    (m.personnel.per_firstname or "?")[0].upper() +
                    (m.personnel.per_lastname  or "?")[0].upper()
                ) if m.personnel else "?",
            }
            for m in r.team.members
        ]

    return [
        {
            "dispatch_id":        r.dispatch_id,
            "fire_id":            r.fire_id,
            "team_id":            r.team_id,
            "team_name":          r.team.team_name if r.team else "—",
            "team_code":          r.team.team_code if r.team else None,
            "dispatch_status":    r.dispatch_status,
            "dispatch_at":        r.dispatch_at.isoformat() if r.dispatch_at else None,
            "station_name":       r.team.station.station_name if (r.team and r.team.station) else None,
            "station_latitude":   r.team.station.station_latitude  if (r.team and r.team.station) else None,
            "station_longitude":  r.team.station.station_longitude if (r.team and r.team.station) else None,
            "incident_latitude":  r.fire_incident.fire_latitude  if r.fire_incident else None,
            "incident_longitude": r.fire_incident.fire_longitude if r.fire_incident else None,
            "members":            _team_members(r),
            "routes":             _dispatch_routes(r),
        }
        for r in rows
    ]


@app.get("/api/incidents/{fire_id}/routes")
def get_incident_routes(
    fire_id: int,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    routes = (
        db.query(Route)
        .filter(Route.fire_id == fire_id)
        .order_by(Route.route_rank)
        .all()
    )
    # Fetch the active dispatch for this incident to attach deviation/connector info
    active_dispatch = (
        db.query(DispatchRecord)
        .filter(
            DispatchRecord.fire_id == fire_id,
            DispatchRecord.dispatch_status.in_(["dispatched", "en_route", "on_scene"]),
        )
        .order_by(DispatchRecord.dispatch_at.desc())
        .first()
    )

    return [
        {
            "route_id":      rt.route_id,
            "fire_id":       rt.fire_id,
            "rank":          rt.route_rank,
            "route_type":    rt.route_type,
            "is_selected":   rt.route_is_selected,
            "route_wkt":     rt.route_path_geojson,
            "eta_minutes":   rt.route_est_minutes,
            "origin_source": rt.route_origin_source,
            "connector_geojson": (
                active_dispatch.deviation_connector_geojson
                if active_dispatch and active_dispatch.route_id == rt.route_id
                   and active_dispatch.is_deviated
                else None
            ),
        }
        for rt in routes
    ]


class SelectRouteBody(BaseModel):
    route_id: int


@app.patch("/api/dispatch/{dispatch_id}/select-route")
def select_dispatch_route(
    dispatch_id: int,
    body: SelectRouteBody,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    dispatch = db.get(DispatchRecord, dispatch_id)
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found.")

    route = db.get(Route, body.route_id)
    if not route or route.dispatch_id != dispatch.dispatch_id:
        raise HTTPException(status_code=404, detail="Route not found for this dispatch.")

    # Deselect all routes for this dispatch, then select the chosen one
    db.query(Route).filter(Route.dispatch_id == dispatch.dispatch_id).update(
        {Route.route_is_selected: False}
    )
    route.route_is_selected = True
    dispatch.route_id = body.route_id
    db.commit()
    db.refresh(route)

    return {
        "route_id":    route.route_id,
        "fire_id":     route.fire_id,
        "rank":        route.route_rank,
        "route_type":  route.route_type,
        "is_selected": route.route_is_selected,
        "route_wkt":   route.route_path_geojson,
        "eta_minutes": route.route_est_minutes,
    }


@app.get("/api/mobile/me/status")
def mobile_me_status(
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    """Single endpoint for the mobile app to get the authenticated personnel's
    team, active dispatch, and assigned incident in one call."""
    if current_user.user_role != "personnel" or not current_user.personnel:
        raise HTTPException(status_code=403, detail="Only personnel accounts can use this endpoint.")

    p = current_user.personnel

    # Resolve team membership (a personnel can be in multiple teams; pick the first active one)
    team_data = None
    dispatch_data = None

    for membership in p.team_memberships:
        team = membership.team
        if not team:
            continue

        # Look for an active dispatch for this team (anything not completed/cancelled)
        active_dispatch = (
            db.query(DispatchRecord)
            .filter(
                DispatchRecord.team_id == team.team_id,
                DispatchRecord.dispatch_status.in_(["dispatched", "en_route", "on_scene"]),
            )
            .order_by(DispatchRecord.dispatch_at.desc())
            .first()
        )

        team_data = {
            "team_id":   team.team_id,
            "team_name": team.team_name,
            "team_code": team.team_code,
            "member_role": membership.member_role,
        }

        if active_dispatch:
            inc = active_dispatch.fire_incident
            # Include the selected route WKT so the mobile app can render it
            selected_route = None
            if active_dispatch.route_id:
                selected_route = db.get(Route, active_dispatch.route_id)
            dt = active_dispatch.dispatch_trucks[0] if active_dispatch.dispatch_trucks else None
            truck_data = None
            if dt and dt.truck:
                truck_data = {
                    "truck_id":         dt.truck.truck_id,
                    "truck_platenum":   dt.truck.truck_platenum,
                    "manned_by_per_id": dt.manned_by_per_id,
                    "is_manning":       dt.manned_by_per_id == p.per_id,
                }
            dispatch_data = {
                "dispatch_id":     active_dispatch.dispatch_id,
                "dispatch_status": active_dispatch.dispatch_status,
                "dispatch_at":     active_dispatch.dispatch_at.isoformat() if active_dispatch.dispatch_at else None,
                "route_wkt":       selected_route.route_path_geojson if selected_route else None,
                "is_driver":       _is_driver(db, active_dispatch, p.per_id),
                "is_team_leader":  _normalize_role(membership.member_role) == "team leader",
                "truck":           truck_data,
                "incident": {
                    "fire_id":            inc.fire_id,
                    "fire_address":       inc.fire_address,
                    "fire_location_name": inc.fire_location_name,
                    "fire_latitude":      inc.fire_latitude,
                    "fire_longitude":     inc.fire_longitude,
                    "fire_level":         inc.fire_alarm_level,
                    "fire_severity":      inc.fire_severity,
                    "fire_structure_type": inc.fire_structure_type,
                    "fire_status":        inc.fire_status,
                    "fire_incident_datetime": inc.fire_incident_datetime.isoformat() if inc.fire_incident_datetime else None,
                } if inc else None,
            }
            break  # found team with active dispatch — stop here

        # No active dispatch on this team; keep looking but save first team found
        if team_data and dispatch_data is None:
            break

    return {
        "per_id":     p.per_id,
        "first_name": p.per_firstname,
        "last_name":  p.per_lastname,
        "rank":       p.per_rank,
        "designation": p.per_designation,
        "station": {
            "station_id":        p.station.station_id,
            "station_name":      p.station.station_name,
            "station_latitude":  p.station.station_latitude,
            "station_longitude": p.station.station_longitude,
        } if p.station else None,
        "shift": {
            "shift_id":   p.shift.shift_id,
            "shift_name": p.shift.shift_name,
        } if p.shift else None,
        "team":     team_data,
        "dispatch": dispatch_data,
    }


def _complete_dispatch_and_release(dispatch: DispatchRecord, now: datetime) -> None:
    """Wrap up a dispatch when its incident is closed: complete the dispatch and
    return its team, members, and truck to standby/available — the reverse of the
    "dispatched" state set in _perform_dispatch. Also clears any active manning so
    the truck stops following a driver's phone. Idempotent; safe to call once per
    active dispatch from either close path (report filing or a direct status edit)."""
    dispatch.dispatch_status       = "completed"
    dispatch.dispatch_completed_at = now

    team = dispatch.team
    if team:
        team.team_status = "standby"
        for m in team.members or []:
            m.member_status = "standby"

    for dt in dispatch.dispatch_trucks or []:
        if dt.truck:
            dt.truck.truck_status = "available"
        dt.manned_by_per_id = None
        dt.manned_since     = None


# Severity → heatmap weight. Closed incidents become weighted points so the
# fire-density heatmap accumulates from real history.
_SEVERITY_WEIGHT = {"Minor": 0.4, "Moderate": 0.7, "Critical": 1.0}


def _add_incident_to_heatmap(db: Session, inc: FireIncident, now: datetime):
    """Record a newly closed incident as a heatmap point. Idempotent — skips if
    this incident already has a heatmap row (an incident only closes once, but
    this guards against either close path running twice)."""
    if inc.fire_latitude is None or inc.fire_longitude is None:
        return
    already = (
        db.query(HeatmapData)
        .filter(HeatmapData.fire_id == inc.fire_id)
        .first()
    )
    if already:
        return
    weight = _SEVERITY_WEIGHT.get((inc.fire_severity or "").strip(), 0.5)
    db.add(HeatmapData(
        fire_id                 = inc.fire_id,
        heatmap_latitude        = inc.fire_latitude,
        heatmap_longitude       = inc.fire_longitude,
        heatmap_severity_weight = weight,
        heatmap_density_value   = weight,
        heatmap_generated_at    = now,
    ))


@app.patch("/api/incidents/{fire_id}")
async def update_incident(
    fire_id: int,
    body: IncidentUpdate,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    inc = db.get(FireIncident, fire_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found.")
    was_closed = inc.fire_status == "closed"
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(inc, field, val)
    # If this edit closes the incident, release any still-active dispatch crews
    # and trucks — mirrors the report-filing close path.
    if not was_closed and inc.fire_status == "closed":
        now = datetime.now(timezone.utc)
        active_dispatches = (
            db.query(DispatchRecord)
            .filter(
                DispatchRecord.fire_id == fire_id,
                DispatchRecord.dispatch_status.in_(["dispatched", "en_route", "on_scene"]),
            )
            .all()
        )
        for d in active_dispatches:
            _complete_dispatch_and_release(d, now)
        _add_incident_to_heatmap(db, inc, now)
    db.commit()
    db.refresh(inc)
    data = _incident_dict(inc)
    await manager.broadcast({"type": "incident_updated", "data": data})
    return data


@app.delete("/api/incidents/{fire_id}", status_code=204)
async def delete_incident(
    fire_id: int,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    inc = db.get(FireIncident, fire_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found.")

    dispatch_ids = [
        d.dispatch_id
        for d in db.query(DispatchRecord).filter(DispatchRecord.fire_id == fire_id).all()
    ]

    # Break the dispatch -> route FK so routes can be removed freely.
    db.query(DispatchRecord).filter(DispatchRecord.fire_id == fire_id).update(
        {"route_id": None}, synchronize_session=False
    )
    if dispatch_ids:
        db.query(DispatchTruck).filter(
            DispatchTruck.dispatch_id.in_(dispatch_ids)
        ).delete(synchronize_session=False)

    # Remove all child rows tied to this incident, then the incident itself.
    db.query(Route).filter(Route.fire_id == fire_id).delete(synchronize_session=False)
    db.query(DispatchRecord).filter(DispatchRecord.fire_id == fire_id).delete(
        synchronize_session=False
    )
    db.query(HeatmapData).filter(HeatmapData.fire_id == fire_id).delete(
        synchronize_session=False
    )

    db.delete(inc)
    db.commit()

    await manager.broadcast({"type": "incident_deleted", "data": {"fire_id": fire_id}})


# ── Location tracking helpers ─────────────────────────────────────────────────

_SOURCE_PRIORITY = {"mobile_app": 2, "iot_sms": 1}

DEVIATION_THRESHOLD_M = 280
REJOIN_THRESHOLD_M    = 50
STALE_MINUTES         = 15
RACE_WINDOW_SECONDS   = 30

# Watchdog: if a route is currently origin="driver_location" but the driver's
# last reported position is older than STALE_MINUTES + STATION_FALLBACK_GRACE_MINUTES,
# revert the route back to station-origin.
STATION_FALLBACK_GRACE_MINUTES = 2
WATCHDOG_INTERVAL_SECONDS      = 15


def _haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi    = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _race_condition_winner(
    existing: "CurrentLocation | None",
    incoming_source: str,
    incoming_recorded_at: datetime,
    now: datetime,
) -> bool:
    """Return True if the incoming update should overwrite current_locations."""
    if existing is None:
        return True

    rec_at = existing.recorded_at
    if rec_at.tzinfo is None:
        rec_at = rec_at.replace(tzinfo=timezone.utc)

    if (now - rec_at) > timedelta(minutes=STALE_MINUTES):
        return True

    diff_s = abs((incoming_recorded_at - rec_at).total_seconds())
    if diff_s <= RACE_WINDOW_SECONDS:
        return (
            _SOURCE_PRIORITY.get(incoming_source, 0)
            >= _SOURCE_PRIORITY.get(existing.source, 0)
        )

    return incoming_recorded_at > rec_at


def _sync_truck(
    db: Session,
    dispatch: DispatchRecord,
    per_id: int,
    lat: float,
    lon: float,
    now: datetime,
) -> None:
    dispatch_truck = dispatch.dispatch_trucks[0] if dispatch.dispatch_trucks else None
    if not dispatch_truck or not dispatch_truck.truck:
        return

    # Only the person who has explicitly claimed to be manning this truck drives
    # its position. If no one has, we leave the truck where it is rather than
    # inferring that the driver/leader is aboard.
    if dispatch_truck.manned_by_per_id is None or per_id != dispatch_truck.manned_by_per_id:
        return

    truck = dispatch_truck.truck
    truck.truck_latitude     = lat
    truck.truck_longitude    = lon
    truck.truck_last_updated = now
    db.commit()


def _is_manning_truck(dispatch: DispatchRecord, per_id: int) -> bool:
    """True iff `per_id` has claimed they are manning the dispatch's truck."""
    dt = dispatch.dispatch_trucks[0] if dispatch.dispatch_trucks else None
    return bool(dt and dt.manned_by_per_id == per_id)


def _normalize_role(role: str | None) -> str:
    """Normalize a member_role for comparison (e.g. "Team Leader", "team_leader")."""
    return (role or "").strip().lower().replace("_", " ")


def _is_driver(db: Session, dispatch: DispatchRecord, per_id: int) -> bool:
    """True iff `per_id` is the designated driver of the dispatch's team."""
    member = (
        db.query(ResponseTeamMember)
        .filter(
            ResponseTeamMember.team_id == dispatch.team_id,
            ResponseTeamMember.per_id  == per_id,
        )
        .first()
    )
    return bool(member and (member.member_role or "").lower() == "driver")


def _rebuild_routes(
    db: Session,
    dispatch: DispatchRecord,
    origin_lat: float,
    origin_lng: float,
    origin_source: str,
):
    """
    Recompute the main + alternative routes from `origin_*` to the dispatch's
    incident, replacing the existing route set for this fire.

    `origin_source` is stored on each new Route row ("driver_location" or
    "station").

    Returns (selected_route, saved_results) or None on failure.
      saved_results is a list of (Route, raw_dict) so callers can build payloads.
    """
    if not routing_engine:
        logger.warning(
            "Route rebuild skipped (dispatch=%s, origin=%s): routing_engine not loaded",
            dispatch.dispatch_id, origin_source,
        )
        return None
    incident = dispatch.fire_incident
    if not incident:
        logger.warning(
            "Route rebuild skipped (dispatch=%s, origin=%s): no fire_incident attached",
            dispatch.dispatch_id, origin_source,
        )
        return None

    src_nodes = routing_engine.graph.nodes_near(origin_lat, origin_lng, radius_km=2.0)
    tgt_nodes = routing_engine.graph.nodes_near(
        incident.fire_latitude, incident.fire_longitude, radius_km=2.0
    )
    if not src_nodes or not tgt_nodes:
        logger.warning(
            "Route rebuild skipped (dispatch=%s, origin=%s): no graph nodes within 2km "
            "(src=%.6f,%.6f found=%d; tgt=%.6f,%.6f found=%d)",
            dispatch.dispatch_id, origin_source,
            origin_lat, origin_lng, len(src_nodes or []),
            incident.fire_latitude, incident.fire_longitude, len(tgt_nodes or []),
        )
        return None

    try:
        obs = _load_active_obstructions(db)
        route_results = routing_engine.compute_routes_multi_alpha(
            src_nodes[0][0], tgt_nodes[0][0], obstructions=obs
        )
    except Exception as exc:
        logger.warning(
            "Route rebuild failed (dispatch=%s, origin=%s): %s",
            dispatch.dispatch_id, origin_source, exc,
        )
        return None
    if not route_results:
        logger.warning(
            "Route rebuild skipped (dispatch=%s, origin=%s): compute_routes_multi_alpha returned no routes",
            dispatch.dispatch_id, origin_source,
        )
        return None

    return _persist_rebuilt_routes(
        db, dispatch, route_results, origin_lat, origin_lng, origin_source
    )


def _persist_rebuilt_routes(
    db: Session,
    dispatch: DispatchRecord,
    route_results: list,
    origin_lat: float,
    origin_lng: float,
    origin_source: str,
):
    """Replace this dispatch's Route rows with a freshly computed set and point
    the dispatch at the new selected route. `route_results` is the raw output of
    the routing compute (in-process or from the pool). Returns (selected, saved)
    or None. All DB work; safe to call from any process's own session.
    """
    if not route_results:
        return None

    # Release the FK on this dispatch, then delete only THIS dispatch's
    # routes (other dispatches on the same fire keep their own route sets).
    dispatch.route_id = None
    db.commit()
    db.query(Route).filter(Route.dispatch_id == dispatch.dispatch_id).delete(
        synchronize_session=False
    )
    db.commit()

    saved = []
    for r in route_results:
        ro = Route(
            fire_id=dispatch.fire_id,
            dispatch_id=dispatch.dispatch_id,
            route_rank=r["rank"],
            route_type=r["route_type"],
            route_path_geojson=r["route_wkt"],
            route_distance_meters=r.get("route_distance_meters"),
            route_est_minutes=round(r["eta_seconds"] / 60, 2),
            route_is_selected=r["is_selected"],
            route_origin_source=origin_source,
            route_origin_lat=origin_lat,
            route_origin_lng=origin_lng,
        )
        db.add(ro)
        saved.append((ro, r))
    db.commit()
    for ro, _ in saved:
        db.refresh(ro)

    selected = next((ro for ro, r in saved if r["is_selected"]), saved[0][0])
    dispatch.route_id = selected.route_id
    db.commit()
    return selected, saved


def _run_routing_via_pool(
    kind: str, a: float, b: float, c: float, d: float, obstructions: list
):
    """Run a CPU-bound routing computation in the process pool so it executes
    with real parallelism, off this process's GIL. Falls back to the
    main-process engine if the pool is unavailable or errors.

    `kind` is "routes" (returns route_results list) or "connector" (returns a
    connector GeoJSON dict). a,b = source lat,lng; c,d = target lat,lng.
    """
    pool = _routing_pool
    if pool is not None:
        fn = routing_pool.compute_routes if kind == "routes" else routing_pool.compute_connector
        try:
            return pool.submit(fn, a, b, c, d, obstructions).result(timeout=ROUTING_POOL_TIMEOUT)
        except Exception as exc:
            logger.warning("Pool routing (%s) failed (%s); falling back in-process.", kind, exc)

    if routing_engine is None:
        return None
    if kind == "connector":
        return routing_engine.compute_connector(a, b, c, d, obstructions=obstructions)
    src = routing_engine.graph.nodes_near(a, b, radius_km=2.0)
    tgt = routing_engine.graph.nodes_near(c, d, radius_km=2.0)
    if not src or not tgt:
        return None
    return routing_engine.compute_routes_multi_alpha(src[0][0], tgt[0][0], obstructions=obstructions)


async def _stale_driver_watchdog():
    """
    Periodically scan active dispatches whose currently-selected route is
    based on `driver_location`. If the driver's last reported position is
    older than `STALE_MINUTES + STATION_FALLBACK_GRACE_MINUTES`, rebuild the
    route set from the team's station so the planned route doesn't keep
    pointing at a phone that went dark.
    """
    threshold = timedelta(minutes=STALE_MINUTES + STATION_FALLBACK_GRACE_MINUTES)
    active = ("dispatched", "en_route", "on_scene")
    while True:
        try:
            await asyncio.sleep(WATCHDOG_INTERVAL_SECONDS)
            now_ts = datetime.now(timezone.utc)
            broadcasts: list[dict] = []
            db = SessionLocal()
            try:
                dispatches = (
                    db.query(DispatchRecord)
                    .filter(DispatchRecord.dispatch_status.in_(active))
                    .all()
                )
                for dispatch in dispatches:
                    if not dispatch.route_id:
                        continue
                    route = db.get(Route, dispatch.route_id)
                    if not route or route.route_origin_source != "driver_location":
                        continue

                    team = dispatch.team
                    station = team.station if team else None
                    if not (station and station.station_latitude and station.station_longitude):
                        continue

                    driver_member = next(
                        (
                            m for m in (team.members if team else [])
                            if (m.member_role or "").lower() == "driver"
                        ),
                        None,
                    )

                    is_stale = True
                    if driver_member:
                        loc = db.get(CurrentLocation, driver_member.per_id)
                        if loc and loc.recorded_at is not None:
                            rec_at = loc.recorded_at
                            if rec_at.tzinfo is None:
                                rec_at = rec_at.replace(tzinfo=timezone.utc)
                            if (now_ts - rec_at) <= threshold:
                                is_stale = False

                    if not is_stale:
                        continue

                    rebuilt = _rebuild_routes(
                        db, dispatch,
                        station.station_latitude, station.station_longitude,
                        "station",
                    )
                    if rebuilt is not None:
                        selected, saved = rebuilt
                        dispatch.is_deviated                 = False
                        dispatch.deviation_connector_geojson = None
                        dispatch.deviation_detected_at       = None
                        db.commit()
                        broadcasts.append(
                            _build_rerouted_payload(dispatch, selected, saved, "station")
                        )
            finally:
                db.close()

            for payload in broadcasts:
                await manager.broadcast(payload)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("Stale-driver watchdog iteration failed: %s", exc)


def _build_rerouted_payload(dispatch: DispatchRecord, selected: Route, saved, origin_source: str) -> dict:
    return {
        "type": "dispatch_rerouted",
        "data": {
            "dispatch_id":   dispatch.dispatch_id,
            "fire_id":       dispatch.fire_id,
            "new_route_id":  selected.route_id,
            "origin_source": origin_source,
            "routes": [
                {
                    "route_id":    ro.route_id,
                    "route_wkt":   ro.route_path_geojson,
                    "rank":        r["rank"],
                    "route_type":  r["route_type"],
                    "is_selected": r["is_selected"],
                    "eta_minutes": round(r["eta_seconds"] / 60, 2),
                    "distance_meters": r.get("route_distance_meters"),
                }
                for ro, r in saved
            ],
        },
    }


# ── Off-request-thread routing ────────────────────────────────────────────────
# Operational switch: when true, the deviation-triggered routing runs INLINE in
# the request (blocking it — the pre-optimisation behaviour, useful for A/B
# comparison). Default false = deferred to a background task.
_REROUTE_INLINE = os.getenv("LOCATION_REROUTE_INLINE", "false").lower() == "true"


# The event loop of the worker that owns `manager`, captured in lifespan. Sync
# background tasks (which run in the threadpool) use it to schedule WS broadcasts
# back onto the loop.
main_event_loop: "asyncio.AbstractEventLoop | None" = None


def _broadcast_threadsafe(payload: dict) -> None:
    """Schedule an async manager.broadcast() from a synchronous worker thread."""
    loop = main_event_loop
    if loop is None:
        return
    try:
        asyncio.run_coroutine_threadsafe(manager.broadcast(payload), loop)
    except Exception as exc:
        logger.warning("Thread-safe broadcast failed: %s", exc)


def _recompute_deviation_routing_bg(
    dispatch_id: int, per_id: int, lat: float, lon: float, manning: bool
) -> None:
    """Runs AFTER the /api/location/update response is sent (in the threadpool,
    with its own DB session). Performs the CPU-bound routing a deviation
    triggers — a full route rebuild if this person mans the truck, otherwise a
    connector to the fire — so the GNN/graph compute never blocks the
    location-update request thread. Delivers the result to dashboards via WS.
    """
    db = SessionLocal()
    payload = None
    try:
        dispatch = db.get(DispatchRecord, dispatch_id)
        if dispatch is None or dispatch.dispatch_status not in ("dispatched", "en_route", "on_scene"):
            return
        if not dispatch.is_deviated:
            return  # rejoined the route before this task ran — nothing to do

        obs = _load_active_obstructions(db)

        if manning:
            incident = dispatch.fire_incident
            if not incident or incident.fire_latitude is None or incident.fire_longitude is None:
                return
            # CPU-bound full route rebuild — run in the process pool (parallel,
            # off this process's GIL); DB persistence stays here.
            route_results = _run_routing_via_pool(
                "routes", lat, lon, incident.fire_latitude, incident.fire_longitude, obs
            )
            rebuilt = _persist_rebuilt_routes(
                db, dispatch, route_results, lat, lon, "driver_location"
            )
            if rebuilt is None:
                return
            selected, saved = rebuilt
            dispatch.is_deviated                 = False
            dispatch.deviation_connector_geojson = None
            dispatch.deviation_detected_at       = None
            db.commit()
            payload = _build_rerouted_payload(dispatch, selected, saved, "driver_location")
        else:
            connector = None
            fire = db.get(FireIncident, dispatch.fire_id)
            if fire and fire.fire_latitude is not None and fire.fire_longitude is not None:
                # CPU-bound connector build — run in the process pool.
                connector = _run_routing_via_pool(
                    "connector", lat, lon, fire.fire_latitude, fire.fire_longitude, obs
                )
            dispatch.deviation_connector_geojson = connector
            db.commit()
            payload = {
                "type": "dispatch_deviation",
                "data": {
                    "dispatch_id":           dispatch.dispatch_id,
                    "per_id":                per_id,
                    "is_deviated":           True,
                    "connector_geojson":     connector,
                    "deviation_detected_at": dispatch.deviation_detected_at.isoformat()
                                             if dispatch.deviation_detected_at else None,
                },
            }
    except Exception as exc:
        logger.warning("Background deviation routing failed (dispatch=%s): %s", dispatch_id, exc)
        db.rollback()
        return
    finally:
        db.close()

    if payload is not None:
        _broadcast_threadsafe(payload)


def _check_deviation(
    db: Session,
    dispatch: DispatchRecord,
    lat: float,
    lon: float,
    compute_connector: bool = True,
) -> "tuple[bool, dict | None]":
    """
    Returns (is_deviated, connector_geojson | None).
    Uses PostGIS geography distance for metre-accurate checks.
    Buffer zone (50–280 m) preserves the existing deviation state.

    When `compute_connector` is False, deviation is still detected (cheap
    PostGIS distance) but the expensive connector routing is skipped — the
    caller is expected to build it off the request thread.
    """
    if not dispatch.route_id:
        return False, None

    route = db.get(Route, dispatch.route_id)
    if not route or not route.route_path_geojson:
        return False, None

    row = db.execute(
        text("""
            SELECT ST_Distance(
                ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                ST_SetSRID(ST_GeomFromText(:wkt),    4326)::geography
            ) AS dist_m
        """),
        {"lng": lon, "lat": lat, "wkt": route.route_path_geojson},
    ).fetchone()

    if row is None:
        return dispatch.is_deviated, None

    dist = row.dist_m

    if dist > DEVIATION_THRESHOLD_M:
        connector = None
        if compute_connector and routing_engine:
            fire = db.get(FireIncident, dispatch.fire_id)
            if fire and fire.fire_latitude is not None and fire.fire_longitude is not None:
                try:
                    obs = _load_active_obstructions(db)
                    connector = routing_engine.compute_connector(
                        lat, lon, fire.fire_latitude, fire.fire_longitude,
                        obstructions=obs,
                    )
                except Exception as exc:
                    logger.warning("Connector computation failed: %s", exc)
        return True, connector

    if dist <= REJOIN_THRESHOLD_M:
        return False, None

    # Buffer zone — keep existing state unchanged
    if dispatch.is_deviated:
        return True, dispatch.deviation_connector_geojson
    return False, None


# ── POST /api/location/update ─────────────────────────────────────────────────

class LocationUpdateBody(BaseModel):
    latitude:    float
    longitude:   float
    recorded_at: str          # ISO 8601 from device clock
    dispatch_id: int
    battery:     int | None = None


@app.post("/api/location/update")
def location_update(
    body: LocationUpdateBody,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    if current_user.user_role != "personnel" or not current_user.personnel:
        raise HTTPException(status_code=403, detail="Only personnel accounts can update location.")

    per_id = current_user.personnel.per_id

    dispatch = db.get(DispatchRecord, body.dispatch_id)
    if dispatch is None or dispatch.dispatch_status not in ("dispatched", "en_route", "on_scene"):
        return {"status": "dispatch_ended"}

    membership = (
        db.query(ResponseTeamMember)
        .filter(
            ResponseTeamMember.team_id == dispatch.team_id,
            ResponseTeamMember.per_id  == per_id,
        )
        .first()
    )
    if not membership:
        return {"status": "dispatch_ended"}

    now = datetime.now(timezone.utc)
    try:
        recorded_at = datetime.fromisoformat(body.recorded_at)
        if recorded_at.tzinfo is None:
            recorded_at = recorded_at.replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=422, detail="recorded_at must be an ISO 8601 timestamp.")

    # Always preserve history
    db.add(LocationLog(
        device_id=None,
        log_latitude=body.latitude,
        log_longitude=body.longitude,
        log_receive_at=now,
    ))

    existing = db.get(CurrentLocation, per_id)
    position_changed = False
    if _race_condition_winner(existing, "mobile_app", recorded_at, now):
        if existing:
            existing.latitude    = body.latitude
            existing.longitude   = body.longitude
            existing.source      = "mobile_app"
            existing.recorded_at = recorded_at
            existing.received_at = now
            existing.battery     = body.battery
        else:
            db.add(CurrentLocation(
                per_id=per_id,
                latitude=body.latitude,
                longitude=body.longitude,
                source="mobile_app",
                recorded_at=recorded_at,
                received_at=now,
                battery=body.battery,
            ))
        db.commit()
        position_changed = True

        _sync_truck(db, dispatch, per_id, body.latitude, body.longitude, now)

        # Cheap deviation DETECTION (PostGIS distance) stays inline; the
        # EXPENSIVE routing a deviation triggers — a connector to the fire, or
        # a full route rebuild if this person mans the truck — is deferred to a
        # background task so the GNN/graph compute never blocks this request
        # thread. The rebuilt route / connector reaches dashboards over WS and
        # is reflected on the mobile side at the next status poll.
        is_deviated, _ = _check_deviation(
            db, dispatch, body.latitude, body.longitude, compute_connector=False
        )
        manning = is_deviated and _is_manning_truck(dispatch, per_id)

        schedule_routing = False
        if is_deviated and not dispatch.is_deviated:
            dispatch.is_deviated           = True
            dispatch.deviation_detected_at = now
            db.commit()
            schedule_routing = True
        elif is_deviated and dispatch.is_deviated:
            schedule_routing = True   # refresh connector / rebuild from new position
        elif not is_deviated and dispatch.is_deviated:
            dispatch.is_deviated                 = False
            dispatch.deviation_connector_geojson = None
            dispatch.deviation_detected_at       = None
            db.commit()

        if schedule_routing:
            if _REROUTE_INLINE:
                _recompute_deviation_routing_bg(
                    dispatch.dispatch_id, per_id, body.latitude, body.longitude, manning
                )
            else:
                background_tasks.add_task(
                    _recompute_deviation_routing_bg,
                    dispatch.dispatch_id, per_id, body.latitude, body.longitude, manning,
                )
    else:
        db.commit()  # location_log only

    if position_changed:
        per = current_user.personnel
        payload = {
            "type": "personnel_location",
            "data": {
                "per_id":      per_id,
                "name":        f"{per.per_firstname or ''} {per.per_lastname or ''}".strip(),
                "latitude":    body.latitude,
                "longitude":   body.longitude,
                "source":      "mobile_app",
                "recorded_at": recorded_at.isoformat(),
                "age_minutes": 0.0,
                "is_stale":    False,
                "battery":     body.battery,
                "is_deviated": dispatch.is_deviated,
                "dispatch_id": dispatch.dispatch_id,
                "connector_geojson":     dispatch.deviation_connector_geojson if dispatch.is_deviated else None,
                "deviation_detected_at": dispatch.deviation_detected_at.isoformat() if dispatch.deviation_detected_at else None,
            },
        }
        background_tasks.add_task(manager.broadcast, payload)

    # TODO: replace polling with WebSocket push when scaling requires it
    if dispatch.is_deviated:
        return {
            "status": "ok",
            "deviation": True,
            "connector_geojson": dispatch.deviation_connector_geojson,
        }
    return {"status": "ok"}


# ── PATCH /api/dispatch/{dispatch_id}/arrived ─────────────────────────────────

@app.patch("/api/dispatch/{dispatch_id}/arrived")
def mark_arrived(
    dispatch_id: int,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    if current_user.user_role != "personnel" or not current_user.personnel:
        raise HTTPException(status_code=403, detail="Only personnel accounts can mark arrival.")

    per_id = current_user.personnel.per_id

    dispatch = db.get(DispatchRecord, dispatch_id)
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found.")

    membership = (
        db.query(ResponseTeamMember)
        .filter(
            ResponseTeamMember.team_id == dispatch.team_id,
            ResponseTeamMember.per_id  == per_id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="You are not assigned to this dispatch.")

    now = datetime.now(timezone.utc)
    dispatch.dispatch_status     = "on_scene"
    dispatch.dispatch_arrived_at = now

    if dispatch.is_deviated:
        dispatch.is_deviated                 = False
        dispatch.deviation_connector_geojson = None
        dispatch.deviation_detected_at       = None

    dispatch_truck = dispatch.dispatch_trucks[0] if dispatch.dispatch_trucks else None
    if dispatch_truck and dispatch_truck.truck:
        dispatch_truck.truck.truck_status = "on_scene"

    db.commit()
    return {
        "dispatch_id":         dispatch.dispatch_id,
        "dispatch_status":     dispatch.dispatch_status,
        "dispatch_arrived_at": dispatch.dispatch_arrived_at.isoformat(),
    }


# ── PATCH /api/dispatch/{dispatch_id}/truck-manning ───────────────────────────

class TruckManningBody(BaseModel):
    manning: bool


@app.patch("/api/dispatch/{dispatch_id}/truck-manning")
def set_truck_manning(
    dispatch_id: int,
    body: TruckManningBody,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    """Driver claims/releases that they are manning (driving) the dispatched truck.
    Only while manned does the truck's live position follow the driver's GPS."""
    if current_user.user_role != "personnel" or not current_user.personnel:
        raise HTTPException(status_code=403, detail="Only personnel accounts can man a truck.")

    per_id = current_user.personnel.per_id

    dispatch = db.get(DispatchRecord, dispatch_id)
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found.")

    membership = (
        db.query(ResponseTeamMember)
        .filter(
            ResponseTeamMember.team_id == dispatch.team_id,
            ResponseTeamMember.per_id  == per_id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="You are not assigned to this dispatch.")

    dispatch_truck = dispatch.dispatch_trucks[0] if dispatch.dispatch_trucks else None
    if not dispatch_truck or not dispatch_truck.truck:
        raise HTTPException(status_code=404, detail="No truck assigned to this dispatch.")

    now = datetime.now(timezone.utc)
    released = False

    if body.manning:
        if not _is_driver(db, dispatch, per_id):
            raise HTTPException(status_code=403, detail="Only the team's driver can man the truck.")
        dispatch_truck.manned_by_per_id = per_id
        dispatch_truck.manned_since     = now
        # Seed the truck position from the driver's last known location so the
        # truck snaps to them immediately rather than waiting for the next ping.
        cur = db.get(CurrentLocation, per_id)
        if cur is not None:
            dispatch_truck.truck.truck_latitude     = float(cur.latitude)
            dispatch_truck.truck.truck_longitude    = float(cur.longitude)
            dispatch_truck.truck.truck_last_updated = now
    else:
        # Only release if this person is the one currently manning it.
        if dispatch_truck.manned_by_per_id == per_id:
            dispatch_truck.manned_by_per_id = None
            dispatch_truck.manned_since     = None
            released = True

    db.commit()

    # When the driver explicitly unmans, the truck is no longer following their
    # phone, so a route that was rebuilt around the driver's location is stale
    # immediately. Default it back to the station-origin route now rather than
    # waiting out the stale-driver watchdog. Mirrors the watchdog's fallback.
    if released and dispatch.route_id:
        route = db.get(Route, dispatch.route_id)
        if route and route.route_origin_source == "driver_location":
            team    = dispatch.team
            station = team.station if team else None
            if station and station.station_latitude and station.station_longitude:
                rebuilt = _rebuild_routes(
                    db, dispatch,
                    station.station_latitude, station.station_longitude,
                    "station",
                )
                if rebuilt is not None:
                    selected, saved = rebuilt
                    dispatch.is_deviated                 = False
                    dispatch.deviation_connector_geojson = None
                    dispatch.deviation_detected_at       = None
                    db.commit()
                    background_tasks.add_task(
                        manager.broadcast,
                        _build_rerouted_payload(dispatch, selected, saved, "station"),
                    )

    return {
        "dispatch_id":      dispatch.dispatch_id,
        "truck_id":         dispatch_truck.truck.truck_id,
        "truck_platenum":   dispatch_truck.truck.truck_platenum,
        "manned_by_per_id": dispatch_truck.manned_by_per_id,
        "is_manning":       dispatch_truck.manned_by_per_id == per_id,
        "manned_since":     dispatch_truck.manned_since.isoformat() if dispatch_truck.manned_since else None,
    }


# ── PATCH /api/dispatch/{dispatch_id}/contain ─────────────────────────────────

@app.patch("/api/dispatch/{dispatch_id}/contain")
async def mark_contained(
    dispatch_id: int,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    """Personnel mark the dispatch's incident as contained. The dispatch itself
    stays active (crew remains on scene for overhaul); 'closed' is a later step."""
    if current_user.user_role != "personnel" or not current_user.personnel:
        raise HTTPException(status_code=403, detail="Only personnel accounts can mark an incident contained.")

    per_id = current_user.personnel.per_id

    dispatch = db.get(DispatchRecord, dispatch_id)
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found.")

    membership = (
        db.query(ResponseTeamMember)
        .filter(
            ResponseTeamMember.team_id == dispatch.team_id,
            ResponseTeamMember.per_id  == per_id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="You are not assigned to this dispatch.")
    if _normalize_role(membership.member_role) != "team leader":
        raise HTTPException(status_code=403, detail="Only the team leader can mark an incident contained.")

    inc = dispatch.fire_incident
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found for this dispatch.")

    inc.fire_status = "contained"
    db.commit()
    db.refresh(inc)

    data = _incident_dict(inc)
    await manager.broadcast({"type": "incident_updated", "data": data})
    return {"fire_id": inc.fire_id, "fire_status": inc.fire_status}


# ── POST /api/dispatch/{dispatch_id}/report ───────────────────────────────────

def _report_photo_url(file_name: str) -> str:
    """Public URL the mobile app / dashboard can load a stored photo from."""
    return f"{PUBLIC_BASE_URL}/uploads/report_photos/{file_name}"


@app.post("/api/dispatch/{dispatch_id}/report")
async def submit_incident_report(
    dispatch_id: int,
    narrative: str = Form(...),
    cause: str | None = Form(None),
    casualties: str | None = Form(None),
    damage_estimate: str | None = Form(None),
    recommendations: str | None = Form(None),
    photos: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    """Assigned personnel file the after-action report for a contained incident.
    The request is multipart/form-data: text fields plus zero or more scene
    photos. Submitting the report closes the incident (fire_status='closed') and
    completes the dispatch."""
    if current_user.user_role != "personnel" or not current_user.personnel:
        raise HTTPException(status_code=403, detail="Only personnel accounts can submit an incident report.")

    if not (narrative or "").strip():
        raise HTTPException(status_code=422, detail="The report narrative is required.")

    # FastAPI passes a single empty UploadFile when the field is sent with no
    # filename; treat anything without a filename as "no photo".
    photos = [p for p in (photos or []) if p and p.filename]
    if len(photos) > MAX_REPORT_PHOTOS:
        raise HTTPException(status_code=422, detail=f"At most {MAX_REPORT_PHOTOS} photos may be attached.")
    for p in photos:
        ctype = (p.content_type or "").lower()
        if ctype not in ALLOWED_PHOTO_TYPES:
            raise HTTPException(status_code=422, detail=f"Unsupported photo type: {p.content_type or 'unknown'}.")

    per_id = current_user.personnel.per_id

    dispatch = db.get(DispatchRecord, dispatch_id)
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found.")

    membership = (
        db.query(ResponseTeamMember)
        .filter(
            ResponseTeamMember.team_id == dispatch.team_id,
            ResponseTeamMember.per_id  == per_id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="You are not assigned to this dispatch.")

    inc = dispatch.fire_incident
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found for this dispatch.")

    if inc.fire_status == "closed":
        raise HTTPException(status_code=409, detail="This incident is already closed.")
    if inc.fire_status != "contained":
        raise HTTPException(status_code=409, detail="The incident must be contained before filing a report.")

    now = datetime.now(timezone.utc)
    report = IncidentReport(
        fire_id                = inc.fire_id,
        dispatch_id            = dispatch.dispatch_id,
        per_id                 = per_id,
        report_cause           = (cause or "").strip() or None,
        report_casualties      = (casualties or "").strip() or None,
        report_damage_estimate = (damage_estimate or "").strip() or None,
        report_narrative       = narrative.strip(),
        report_recommendations = (recommendations or "").strip() or None,
        report_submitted_at    = now,
    )
    db.add(report)
    db.flush()  # assign report_id so photo rows / filenames can reference it

    # Persist each photo to disk and record it. Files written here are removed if
    # the request fails before commit, so we never leave orphaned bytes behind.
    written_paths: list[str] = []
    try:
        for up in photos:
            ext = _PHOTO_EXT.get((up.content_type or "").lower(), ".jpg")
            file_name = f"report{report.report_id}_{uuid.uuid4().hex}{ext}"
            dest = os.path.join(REPORT_PHOTO_DIR, file_name)
            data_bytes = await up.read()
            if len(data_bytes) > MAX_PHOTO_BYTES:
                raise HTTPException(status_code=422, detail=f"Photo '{up.filename}' exceeds the 10 MB limit.")
            with open(dest, "wb") as fh:
                fh.write(data_bytes)
            written_paths.append(dest)
            db.add(ReportPhoto(
                report_id     = report.report_id,
                file_name     = file_name,
                original_name = up.filename,
                content_type  = up.content_type,
            ))
    except Exception:
        for path in written_paths:
            try:
                os.remove(path)
            except OSError:
                pass
        db.rollback()
        raise

    # Filing the report closes out the incident and wraps up the dispatch,
    # returning the crew to standby and freeing their truck.
    inc.fire_status = "closed"
    _complete_dispatch_and_release(dispatch, now)
    _add_incident_to_heatmap(db, inc, now)

    db.commit()
    db.refresh(report)
    db.refresh(inc)

    data = _incident_dict(inc)
    await manager.broadcast({"type": "incident_updated", "data": data})
    return {
        "report_id":   report.report_id,
        "fire_id":     inc.fire_id,
        "fire_status": inc.fire_status,
        "dispatch_id": dispatch.dispatch_id,
        "dispatch_status": dispatch.dispatch_status,
        "photos":      [_report_photo_url(p.file_name) for p in report.photos],
    }


# ── GET /api/incidents/{fire_id}/report ───────────────────────────────────────

def _report_dict(r: IncidentReport) -> dict:
    author = r.author
    author_name = (
        f"{author.per_firstname or ''} {author.per_lastname or ''}".strip()
        if author else None
    ) or None
    return {
        "report_id":       r.report_id,
        "fire_id":         r.fire_id,
        "dispatch_id":     r.dispatch_id,
        "author":          author_name,
        "author_rank":     author.per_rank if author else None,
        "cause":           r.report_cause,
        "casualties":      r.report_casualties,
        "damage_estimate": r.report_damage_estimate,
        "narrative":       r.report_narrative,
        "recommendations": r.report_recommendations,
        "submitted_at":    r.report_submitted_at.isoformat() if r.report_submitted_at else None,
        "photos":          [_report_photo_url(p.file_name) for p in r.photos],
    }


@app.get("/api/incidents/{fire_id}/report")
def get_incident_report(
    fire_id: int,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    """The after-action report filed for a (closed) incident, with photo URLs.
    Returns the most recently submitted report, or null when none exists yet."""
    report = (
        db.query(IncidentReport)
        .filter(IncidentReport.fire_id == fire_id)
        .order_by(IncidentReport.report_submitted_at.desc(), IncidentReport.report_id.desc())
        .first()
    )
    if not report:
        return {"report": None}
    return {"report": _report_dict(report)}


# ── POST /api/dispatch/{dispatch_id}/full-reroute ─────────────────────────────

@app.post("/api/dispatch/{dispatch_id}/full-reroute")
async def full_reroute(
    dispatch_id: int,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    """Dispatcher-only: replace the current route from the driver's live position."""
    dispatch = db.get(DispatchRecord, dispatch_id)
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found.")
    if dispatch.dispatch_status not in ("dispatched", "en_route", "on_scene"):
        raise HTTPException(status_code=409, detail="Dispatch is not active.")

    incident = dispatch.fire_incident
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found.")

    if not routing_engine:
        raise HTTPException(status_code=503, detail="Routing engine not available.")

    # Resolve origin: driver → team_leader → any member → station
    members = (
        db.query(ResponseTeamMember)
        .filter(ResponseTeamMember.team_id == dispatch.team_id)
        .all()
    )
    drivers = [m for m in members if m.member_role == "driver"]
    leaders = [m for m in members if m.member_role == "team_leader"]
    ordered = drivers or leaders or members

    origin_lat = origin_lng = None
    for m in ordered:
        loc = db.get(CurrentLocation, m.per_id)
        if loc:
            origin_lat = float(loc.latitude)
            origin_lng = float(loc.longitude)
            break

    origin_source = "driver_location"
    if origin_lat is None:
        station = dispatch.team.station if dispatch.team else None
        if not station or not station.station_latitude:
            raise HTTPException(status_code=422, detail="No driver location and no station coordinates.")
        origin_lat    = station.station_latitude
        origin_lng    = station.station_longitude
        origin_source = "station"

    src_nodes = routing_engine.graph.nodes_near(origin_lat, origin_lng, radius_km=2.0)
    tgt_nodes = routing_engine.graph.nodes_near(
        incident.fire_latitude, incident.fire_longitude, radius_km=2.0
    )
    if not src_nodes or not tgt_nodes:
        raise HTTPException(status_code=422, detail="Could not resolve origin/destination graph nodes.")

    obs = _load_active_obstructions(db)
    route_results = routing_engine.compute_routes_multi_alpha(src_nodes[0][0], tgt_nodes[0][0], obstructions=obs)
    if not route_results:
        raise HTTPException(status_code=422, detail="Route computation returned no results.")

    # Delete only THIS dispatch's existing routes (release FK first).
    dispatch.route_id = None
    db.commit()
    db.query(Route).filter(Route.dispatch_id == dispatch.dispatch_id).delete(
        synchronize_session=False
    )
    db.commit()

    saved = []
    for r in route_results:
        ro = Route(
            fire_id=dispatch.fire_id,
            dispatch_id=dispatch.dispatch_id,
            route_rank=r["rank"],
            route_type=r["route_type"],
            route_path_geojson=r["route_wkt"],
            route_distance_meters=r.get("route_distance_meters"),
            route_est_minutes=round(r["eta_seconds"] / 60, 2),
            route_is_selected=r["is_selected"],
            route_origin_source=origin_source,
            route_origin_lat=origin_lat,
            route_origin_lng=origin_lng,
        )
        db.add(ro)
        saved.append((ro, r))
    db.commit()
    for ro, _ in saved:
        db.refresh(ro)

    selected = next((ro for ro, r in saved if r["is_selected"]), saved[0][0])
    dispatch.route_id                    = selected.route_id
    dispatch.is_deviated                 = False
    dispatch.deviation_connector_geojson = None
    dispatch.deviation_detected_at       = None
    db.commit()

    await manager.broadcast({
        "type": "route_updated",
        "data": {
            "dispatch_id": dispatch_id,
            "route_id":    selected.route_id,
            "route_wkt":   selected.route_path_geojson,
        },
    })

    return {
        "dispatch_id":   dispatch_id,
        "new_route_id":  selected.route_id,
        "origin_source": origin_source,
        "routes": [
            {
                "route_id":    ro.route_id,
                "rank":        r["rank"],
                "route_type":  r["route_type"],
                "is_selected": r["is_selected"],
                "eta_minutes": round(r["eta_seconds"] / 60, 2),
            }
            for ro, r in saved
        ],
    }


# ── GET /api/personnel/locations ──────────────────────────────────────────────
# TODO: replace polling with WebSocket push when scaling requires it

@app.get("/api/personnel/locations")
def get_personnel_locations(
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    """Dashboard polls this every 10 seconds to refresh personnel markers on the map."""
    now = datetime.now(timezone.utc)

    rows = db.query(CurrentLocation).all()
    result = []
    for loc in rows:
        per = loc.personnel
        if not per:
            continue

        rec_at = loc.recorded_at
        if rec_at.tzinfo is None:
            rec_at = rec_at.replace(tzinfo=timezone.utc)
        age_s       = (now - rec_at).total_seconds()
        age_minutes = round(age_s / 60, 1)
        is_stale    = age_s > STALE_MINUTES * 60

        active_dispatch = (
            db.query(DispatchRecord)
            .join(ResponseTeamMember,
                  ResponseTeamMember.team_id == DispatchRecord.team_id)
            .filter(
                ResponseTeamMember.per_id == per.per_id,
                DispatchRecord.dispatch_status.in_(["dispatched", "en_route", "on_scene"]),
            )
            .order_by(DispatchRecord.dispatch_at.desc())
            .first()
        )

        result.append({
            "per_id":           per.per_id,
            "name":             f"{per.per_firstname or ''} {per.per_lastname or ''}".strip(),
            "latitude":         float(loc.latitude),
            "longitude":        float(loc.longitude),
            "source":           loc.source,
            "recorded_at":      rec_at.isoformat(),
            "age_minutes":      age_minutes,
            "is_stale":         is_stale,
            "battery":          loc.battery,
            "is_deviated":      active_dispatch.is_deviated if active_dispatch else False,
            "dispatch_id":      active_dispatch.dispatch_id if active_dispatch else None,
            "connector_geojson": active_dispatch.deviation_connector_geojson if active_dispatch and active_dispatch.is_deviated else None,
            "deviation_detected_at": active_dispatch.deviation_detected_at.isoformat() if active_dispatch and active_dispatch.deviation_detected_at else None,
        })

    return result


# ── Trucks ──────────────────────────────────────────────────────────────────

class TruckCreate(BaseModel):
    truck_platenum: str
    truck_status: str = "available"
    station_id: int | None = None

class TruckUpdate(BaseModel):
    truck_platenum: str | None = None
    truck_status: str | None = None
    station_id: int | None = None


def _truck_dict(t: Truck) -> dict:
    return {
        "truck_id":           t.truck_id,
        "truck_platenum":     t.truck_platenum,
        "truck_status":       t.truck_status or "available",
        "truck_latitude":     t.truck_latitude,
        "truck_longitude":    t.truck_longitude,
        "truck_last_updated": t.truck_last_updated.isoformat() if t.truck_last_updated else None,
        "station_id":         t.station_id,
        "station_name":       t.station.station_name if t.station else None,
    }


@app.get("/api/trucks")
def get_trucks(
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    rows = db.query(Truck).order_by(Truck.truck_id).all()
    return [_truck_dict(r) for r in rows]


@app.post("/api/trucks", status_code=201)
def create_truck(
    body: TruckCreate,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    if db.query(Truck).filter(Truck.truck_platenum == body.truck_platenum).first():
        raise HTTPException(status_code=409, detail="A truck with that plate number already exists.")
    if body.station_id and not db.get(Station, body.station_id):
        raise HTTPException(status_code=404, detail="Station not found.")
    truck = Truck(
        truck_platenum=body.truck_platenum,
        truck_status=body.truck_status,
        station_id=body.station_id,
    )
    db.add(truck)
    db.commit()
    db.refresh(truck)
    return _truck_dict(truck)


@app.patch("/api/trucks/{truck_id}")
def update_truck(
    truck_id: int,
    body: TruckUpdate,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    truck = db.get(Truck, truck_id)
    if not truck:
        raise HTTPException(status_code=404, detail="Truck not found.")
    if body.truck_platenum is not None:
        conflict = db.query(Truck).filter(
            Truck.truck_platenum == body.truck_platenum,
            Truck.truck_id != truck_id,
        ).first()
        if conflict:
            raise HTTPException(status_code=409, detail="A truck with that plate number already exists.")
        truck.truck_platenum = body.truck_platenum
    if body.truck_status is not None:
        truck.truck_status = body.truck_status
    if "station_id" in body.model_fields_set:
        if body.station_id is not None and not db.get(Station, body.station_id):
            raise HTTPException(status_code=404, detail="Station not found.")
        truck.station_id = body.station_id
    db.commit()
    db.refresh(truck)
    return _truck_dict(truck)


@app.delete("/api/trucks/{truck_id}", status_code=204)
def delete_truck(
    truck_id: int,
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    truck = db.get(Truck, truck_id)
    if not truck:
        raise HTTPException(status_code=404, detail="Truck not found.")
    db.delete(truck)
    db.commit()
