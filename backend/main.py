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
from models import Users
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
