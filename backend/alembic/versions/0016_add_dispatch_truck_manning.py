"""Add explicit truck-manning columns to dispatch_trucks

Tracks which personnel has claimed they are manning/driving a dispatched truck,
so the truck position only follows that person's GPS instead of inferring
occupancy from driver/team-leader role.

Revision ID: 0016
Revises: 0015
Create Date: 2026-06-01
"""

from alembic import op
import sqlalchemy as sa


revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "dispatch_trucks",
        sa.Column("manned_by_per_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "dispatch_trucks",
        sa.Column("manned_since", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_dispatch_trucks_manned_by_per_id",
        "dispatch_trucks",
        "personnel",
        ["manned_by_per_id"],
        ["per_id"],
    )


def downgrade():
    op.drop_constraint(
        "fk_dispatch_trucks_manned_by_per_id", "dispatch_trucks", type_="foreignkey"
    )
    op.drop_column("dispatch_trucks", "manned_since")
    op.drop_column("dispatch_trucks", "manned_by_per_id")
