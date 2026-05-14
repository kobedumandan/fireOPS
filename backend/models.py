from sqlalchemy import (
    Column, Integer, String, Float, Text, DateTime,
    Boolean, ForeignKey,
)
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from database import Base


def _now():
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Users & roles
# ---------------------------------------------------------------------------

class Users(Base):
    __tablename__ = "users"

    user_id      = Column(Integer, primary_key=True, autoincrement=True)
    user_email   = Column(String(255), unique=True, nullable=False)
    user_password = Column(String(255), nullable=False)
    user_role    = Column(String(50))          # "admin" | "personnel" | ...
    created_at   = Column(DateTime(timezone=True), default=_now)
    updated_at   = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    admin                = relationship("Admin",        back_populates="user", uselist=False)
    personnel            = relationship("Personnel",    back_populates="user", uselist=False)
    confirmed_incidents  = relationship("FireIncident", back_populates="confirmed_by")


class Admin(Base):
    __tablename__ = "admin"

    admin_id        = Column(Integer, primary_key=True, autoincrement=True)
    admin_firstname = Column(String(100))
    admin_lastname  = Column(String(100))
    admin_contact   = Column(String(50))
    user_id         = Column(Integer, ForeignKey("users.user_id"), nullable=False)

    user = relationship("Users", back_populates="admin")


# ---------------------------------------------------------------------------
# Personnel & devices
# ---------------------------------------------------------------------------

class Personnel(Base):
    __tablename__ = "personnel"

    per_id          = Column(Integer, primary_key=True, autoincrement=True)
    per_firstname   = Column(String(100))
    per_lastname    = Column(String(100))
    per_contact     = Column(String(50))
    per_rank        = Column(String(100))
    per_designation = Column(String(100))
    user_id         = Column(Integer, ForeignKey("users.user_id"), nullable=False)

    user             = relationship("Users",              back_populates="personnel")
    devices          = relationship("Device",             back_populates="personnel")
    team_memberships = relationship("ResponseTeamMember", back_populates="personnel")


class Device(Base):
    __tablename__ = "devices"

    device_id       = Column(Integer, primary_key=True, autoincrement=True)
    device_imei     = Column(String(20), unique=True)
    device_sim      = Column(String(20))
    device_status   = Column(String(50))
    device_lastseen = Column(DateTime(timezone=True))
    per_id          = Column(Integer, ForeignKey("personnel.per_id"), nullable=False)

    personnel     = relationship("Personnel",   back_populates="devices")
    location_logs = relationship("LocationLog", back_populates="device")


class LocationLog(Base):
    __tablename__ = "location_logs"

    log_id         = Column(Integer, primary_key=True, autoincrement=True)
    device_id      = Column(Integer, ForeignKey("devices.device_id"), nullable=False)
    log_latitude   = Column(Float, nullable=False)
    log_longitude  = Column(Float, nullable=False)
    log_receive_at = Column(DateTime(timezone=True), default=_now)

    device = relationship("Device", back_populates="location_logs")


# ---------------------------------------------------------------------------
# Response teams
# ---------------------------------------------------------------------------

class ResponseTeam(Base):
    __tablename__ = "response_teams"

    team_id         = Column(Integer, primary_key=True, autoincrement=True)
    team_name       = Column(String(150))
    team_status     = Column(String(50))
    team_created_at = Column(DateTime(timezone=True), default=_now)
    team_updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    members   = relationship("ResponseTeamMember", back_populates="team")
    dispatches = relationship("DispatchRecord",    back_populates="team")


class ResponseTeamMember(Base):
    __tablename__ = "response_team_members"

    members_id    = Column(Integer, primary_key=True, autoincrement=True)
    team_id       = Column(Integer, ForeignKey("response_teams.team_id"), nullable=False)
    per_id        = Column(Integer, ForeignKey("personnel.per_id"),       nullable=False)
    member_role   = Column(String(100))
    member_status = Column(String(50))

    team      = relationship("ResponseTeam", back_populates="members")
    personnel = relationship("Personnel",    back_populates="team_memberships")


# ---------------------------------------------------------------------------
# Trucks
# ---------------------------------------------------------------------------

class Truck(Base):
    __tablename__ = "truck"

    truck_id           = Column(Integer, primary_key=True, autoincrement=True)
    truck_platenum     = Column(String(20), unique=True)
    truck_status       = Column(String(50))
    truck_latitude     = Column(Float)
    truck_longitude    = Column(Float)
    truck_last_updated = Column(DateTime(timezone=True))

    truck_logs      = relationship("TruckLog",      back_populates="truck")
    dispatch_trucks = relationship("DispatchTruck", back_populates="truck")


class TruckLog(Base):
    __tablename__ = "truck_logs"

    truck_log_id       = Column(Integer, primary_key=True, autoincrement=True)
    truck_id           = Column(Integer, ForeignKey("truck.truck_id"), nullable=False)
    truck_log_lat      = Column(Float, nullable=False)
    truck_log_long     = Column(Float, nullable=False)
    truck_log_recorded = Column(DateTime(timezone=True), default=_now)

    truck = relationship("Truck", back_populates="truck_logs")


# ---------------------------------------------------------------------------
# Geographic reference
# ---------------------------------------------------------------------------

class PurokBoundary(Base):
    """Purok (sub-barangay) polygon boundaries for incident location tagging."""
    __tablename__ = "purok_boundaries"

    purok_id      = Column(Integer, primary_key=True, autoincrement=True)
    purok_name    = Column(String(150))
    purok_geojson = Column(Text)    # GeoJSON polygon

    fire_incidents = relationship("FireIncident", back_populates="purok")


# ---------------------------------------------------------------------------
# Fire incidents
# ---------------------------------------------------------------------------

class FireIncident(Base):
    __tablename__ = "fire_incidents"

    fire_id                = Column(Integer, primary_key=True, autoincrement=True)
    confirmed_user_id      = Column(Integer, ForeignKey("users.user_id"),             nullable=True)
    purok_id               = Column(Integer, ForeignKey("purok_boundaries.purok_id"), nullable=True)
    fire_reporter_contact  = Column(String(50))
    fire_location_source   = Column(String(100))   # "gps" | "manual" | "report"
    fire_latitude          = Column(Float, nullable=False)
    fire_longitude         = Column(Float, nullable=False)
    fire_severity          = Column(String(50))    # "low" | "moderate" | "high" | "critical"
    fire_status            = Column(String(50))    # "active" | "contained" | "resolved"
    fire_incident_datetime = Column(DateTime(timezone=True), default=_now)

    confirmed_by  = relationship("Users",          back_populates="confirmed_incidents")
    purok         = relationship("PurokBoundary",  back_populates="fire_incidents")
    routes        = relationship("Route",          back_populates="fire_incident")
    heatmap_data  = relationship("HeatmapData",    back_populates="fire_incident")
    dispatches    = relationship("DispatchRecord", back_populates="fire_incident")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

class Route(Base):
    __tablename__ = "routes"

    route_id              = Column(Integer, primary_key=True, autoincrement=True)
    fire_id               = Column(Integer, ForeignKey("fire_incidents.fire_id"), nullable=False)
    route_rank            = Column(Integer)          # 1 = best, 2 = alternate, …
    route_type            = Column(String(50))       # "fastest" | "shortest" | "ai_optimized"
    route_path_geojson    = Column(Text)             # GeoJSON LineString
    route_distance_meters = Column(Float)
    route_est_minutes     = Column(Float)
    route_is_selected     = Column(Boolean, default=False)
    route_created_at      = Column(DateTime(timezone=True), default=_now)

    fire_incident    = relationship("FireIncident",  back_populates="routes")
    dispatch_records = relationship("DispatchRecord", back_populates="route")


# ---------------------------------------------------------------------------
# Heatmap
# ---------------------------------------------------------------------------

class HeatmapData(Base):
    __tablename__ = "heatmap_data"

    heatmap_id              = Column(Integer, primary_key=True, autoincrement=True)
    fire_id                 = Column(Integer, ForeignKey("fire_incidents.fire_id"), nullable=False)
    heatmap_latitude        = Column(Float, nullable=False)
    heatmap_longitude       = Column(Float, nullable=False)
    heatmap_severity_weight = Column(Float)
    heatmap_density_value   = Column(Float)
    heatmap_generated_at    = Column(DateTime(timezone=True), default=_now)

    fire_incident = relationship("FireIncident", back_populates="heatmap_data")


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------

class DispatchRecord(Base):
    __tablename__ = "dispatch_records"

    dispatch_id           = Column(Integer, primary_key=True, autoincrement=True)
    fire_id               = Column(Integer, ForeignKey("fire_incidents.fire_id"),   nullable=False)
    team_id               = Column(Integer, ForeignKey("response_teams.team_id"),   nullable=False)
    route_id              = Column(Integer, ForeignKey("routes.route_id"),          nullable=True)
    dispatch_status       = Column(String(50))   # "pending" | "en_route" | "arrived" | "completed"
    dispatch_at           = Column(DateTime(timezone=True), default=_now)
    dispatch_arrived_at   = Column(DateTime(timezone=True), nullable=True)
    dispatch_completed_at = Column(DateTime(timezone=True), nullable=True)
    dispatch_truck_count  = Column(Integer, default=0)

    fire_incident   = relationship("FireIncident", back_populates="dispatches")
    team            = relationship("ResponseTeam", back_populates="dispatches")
    route           = relationship("Route",        back_populates="dispatch_records")
    dispatch_trucks = relationship("DispatchTruck", back_populates="dispatch_record")


class DispatchTruck(Base):
    __tablename__ = "dispatch_trucks"

    dispatch_truck_id = Column(Integer, primary_key=True, autoincrement=True)
    dispatch_id       = Column(Integer, ForeignKey("dispatch_records.dispatch_id"), nullable=False)
    truck_id          = Column(Integer, ForeignKey("truck.truck_id"),               nullable=False)
    truck_assigned_at = Column(DateTime(timezone=True), default=_now)

    dispatch_record = relationship("DispatchRecord", back_populates="dispatch_trucks")
    truck           = relationship("Truck",          back_populates="dispatch_trucks")
