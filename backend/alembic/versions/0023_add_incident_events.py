"""Add incident_events

The dashboard's incident timeline could only show what dispatch_records
timestamps: status changes (Contained, Closed) and alarm escalations kept just
their current value on fire_incidents, so when they happened was lost. Each
change to status, alarm level or severity now appends a row here.

Revision ID: 0023
Revises: 0022
Create Date: 2026-09-28
"""

from alembic import op
import sqlalchemy as sa


revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "incident_events",
        sa.Column("event_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("fire_id", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=30), nullable=False),
        sa.Column("event_from", sa.String(length=50), nullable=True),
        sa.Column("event_to", sa.String(length=50), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("event_actor", sa.String(length=150), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("event_id"),
        sa.ForeignKeyConstraint(["fire_id"], ["fire_incidents.fire_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="SET NULL"),
    )
    op.create_index("ix_incident_events_fire_id", "incident_events", ["fire_id"])


def downgrade() -> None:
    op.drop_index("ix_incident_events_fire_id", table_name="incident_events")
    op.drop_table("incident_events")
