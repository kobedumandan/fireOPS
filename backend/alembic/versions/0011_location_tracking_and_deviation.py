"""location tracking: current_locations table, deviation columns, route origin columns, nullable device_id

Revision ID: 0011
Revises: 0010
Create Date: 2026-05-24
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade():
    # ── current_locations (live position per personnel) ───────────────────────
    op.create_table(
        "current_locations",
        sa.Column("per_id",      sa.Integer(),                   nullable=False),
        sa.Column("latitude",    sa.Numeric(10, 8),              nullable=False),
        sa.Column("longitude",   sa.Numeric(11, 8),              nullable=False),
        sa.Column("source",      sa.String(20),                  nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True),     nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True),     nullable=False),
        sa.Column("battery",     sa.Integer(),                   nullable=True),
        sa.ForeignKeyConstraint(["per_id"], ["personnel.per_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("per_id"),
    )

    # ── dispatch_records: deviation tracking ──────────────────────────────────
    op.add_column(
        "dispatch_records",
        sa.Column("is_deviated", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "dispatch_records",
        sa.Column("deviation_connector_geojson", postgresql.JSONB(), nullable=True),
    )
    op.add_column(
        "dispatch_records",
        sa.Column("deviation_detected_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── routes: origin audit columns ──────────────────────────────────────────
    op.add_column(
        "routes",
        sa.Column("route_origin_source", sa.String(20), nullable=True, server_default="station"),
    )
    op.add_column(
        "routes",
        sa.Column("route_origin_lat", sa.Numeric(10, 8), nullable=True),
    )
    op.add_column(
        "routes",
        sa.Column("route_origin_lng", sa.Numeric(11, 8), nullable=True),
    )

    # ── location_logs: make device_id nullable so mobile can log without a device row ──
    op.alter_column(
        "location_logs",
        "device_id",
        existing_type=sa.Integer(),
        nullable=True,
    )


def downgrade():
    op.alter_column(
        "location_logs",
        "device_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.drop_column("routes", "route_origin_lng")
    op.drop_column("routes", "route_origin_lat")
    op.drop_column("routes", "route_origin_source")
    op.drop_column("dispatch_records", "deviation_detected_at")
    op.drop_column("dispatch_records", "deviation_connector_geojson")
    op.drop_column("dispatch_records", "is_deviated")
    op.drop_table("current_locations")
