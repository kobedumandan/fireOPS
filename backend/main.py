from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
import hashlib
import logging
import os

from fastapi import Depends, FastAPI, HTTPException, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import check_connection, get_db
from models import Users, Personnel, HeatmapData, Station
from ai import GeoAIRoutingEngine, load_qgis_graph, load_panabo_graph, register_env, Config
from ai.config import BASE_DIR

JWT_SECRET      = os.getenv("JWT_SECRET", "change-me")
JWT_ALGORITHM   = "HS256"
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "8"))

_bearer = HTTPBearer()

logger = logging.getLogger(__name__)

# ── Application lifespan ──────────────────────────────────────────────────────

routing_engine: GeoAIRoutingEngine = None  # populated in lifespan


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global routing_engine

    nodes_file = BASE_DIR / "data" / "panabo_nodes.geojson"
    edges_file = BASE_DIR / "data" / "panabo_edges.geojson"

    try:
        if nodes_file.exists() and edges_file.exists():
            logger.info("Loading road network from QGIS GeoJSON exports …")
            graph = load_qgis_graph(nodes_file, edges_file)
        else:
            logger.info("QGIS files not found — downloading from OSM (first run only) …")
            graph = load_panabo_graph()

        routing_engine = GeoAIRoutingEngine(
            gnn_type=Config.GNN_TYPE,
            use_rl=Config.USE_RL,
            use_sumo=Config.USE_SUMO,
            in_channels=Config.NODE_FEATURE_DIM,
            hidden_channels=Config.GNN_HIDDEN,
            out_channels=Config.GNN_OUT,
            device=Config.DEVICE,
        )
        routing_engine.graph = graph

        register_env()
        logger.info("GeoAI routing engine ready. Graph: %s", graph.summary())
    except Exception as exc:
        logger.warning("Routing engine failed to start (non-fatal): %s", exc)
        logger.warning("Routing endpoints will be unavailable until graph data is loaded.")

    yield  # server runs here

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


@app.post("/api/routing/compute", response_model=RouteResponse)
def compute_route(req: RouteRequest):
    try:
        result = routing_engine.compute_route(req.source_node, req.target_node)
        return RouteResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Routing error: {exc}")


@app.get("/api/routing/graph/summary")
def graph_summary():
    return routing_engine.graph.summary()


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
    payload = {
        "sub": str(user.user_id),
        "email": user.user_email,
        "role": user.user_role,
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
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
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


@app.get("/api/routing/nearest-station")
def nearest_station(lat: float, lon: float):
    node_id = routing_engine.nearest_station_node(lat, lon)
    if node_id is None:
        raise HTTPException(status_code=404, detail="No station node found near that location.")
    node_data = routing_engine.graph.G.nodes[node_id]
    return {"node_id": node_id, "lat": node_data["lat"], "lon": node_data["lon"]}


@app.get("/api/personnel")
def get_personnel(
    db: Session = Depends(get_db),
    _auth: Users = Depends(get_current_user),
):
    rows = db.query(Personnel).all()
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

        designation = (p.per_designation or "standby").lower()
        valid_statuses = {"dispatched", "onscene", "standby", "offduty"}
        status = designation if designation in valid_statuses else "standby"

        joined = None
        if p.user and p.user.created_at:
            joined = p.user.created_at.strftime("%b %Y")

        result.append({
            "id":       f"FU-{p.per_id:03d}",
            "per_id":   p.per_id,
            "name":     f"{first} {last}".strip(),
            "initials": initials or "??",
            "rank":     p.per_rank        or "—",
            "status":   status,
            "station":  p.station.station_name if p.station else "—",
            "incident": "—",
            "iot":      iot,
            "battery":  0,
            "phone":    p.per_contact or "—",
            "joined":   joined or "—",
        })
    return result


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
    return {
        "station_id":        r.station_id,
        "station_name":      r.station_name,
        "station_type":      r.station_type or "main",
        "parent_station_id": r.parent_station_id,
        "station_address":   r.station_address  or "",
        "station_barangay":  r.station_barangay or "",
        "station_latitude":  r.station_latitude,
        "station_longitude": r.station_longitude,
        "station_contact":   r.station_contact  or "",
        "station_status":    r.station_status   or "operational",
        "created_at":        r.created_at.isoformat() if r.created_at else None,
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
