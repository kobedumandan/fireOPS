"""Add incident_reports table

Stores the after-action report personnel write once a fire is contained.
Submitting the report closes the incident (fire_status -> 'closed').

Revision ID: 0018
Revises: 0017
Create Date: 2026-06-02
"""

from alembic import op
import sqlalchemy as sa


revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "incident_reports",
        sa.Column("report_id", sa.Integer(), nullable=False),
        sa.Column("fire_id", sa.Integer(), nullable=False),
        sa.Column("dispatch_id", sa.Integer(), nullable=True),
        sa.Column("per_id", sa.Integer(), nullable=False),
        sa.Column("report_cause", sa.String(length=255), nullable=True),
        sa.Column("report_casualties", sa.String(length=255), nullable=True),
        sa.Column("report_damage_estimate", sa.String(length=100), nullable=True),
        sa.Column("report_narrative", sa.Text(), nullable=False),
        sa.Column("report_recommendations", sa.Text(), nullable=True),
        sa.Column("report_submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["fire_id"], ["fire_incidents.fire_id"]),
        sa.ForeignKeyConstraint(["dispatch_id"], ["dispatch_records.dispatch_id"]),
        sa.ForeignKeyConstraint(["per_id"], ["personnel.per_id"]),
        sa.PrimaryKeyConstraint("report_id"),
    )
    op.create_index(
        "ix_incident_reports_fire_id", "incident_reports", ["fire_id"], unique=False
    )


def downgrade():
    op.drop_index("ix_incident_reports_fire_id", table_name="incident_reports")
    op.drop_table("incident_reports")
