"""Add barangay_boundaries table and brgy_id FK on fire_incidents

Revision ID: 0015
Revises: 0014
Create Date: 2026-05-27
"""

from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry


revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "barangay_boundaries",
        sa.Column("brgy_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("brgy_name", sa.String(255), nullable=False),
        sa.Column("brgy_estpopulation", sa.Integer(), nullable=True),
        sa.Column("brgy_polygon", Geometry("POLYGON", srid=4326), nullable=False),
    )

    op.add_column(
        "fire_incidents",
        sa.Column("brgy_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_fire_incidents_brgy_id",
        "fire_incidents",
        "barangay_boundaries",
        ["brgy_id"],
        ["brgy_id"],
    )


def downgrade():
    op.drop_constraint("fk_fire_incidents_brgy_id", "fire_incidents", type_="foreignkey")
    op.drop_column("fire_incidents", "brgy_id")
    op.drop_table("barangay_boundaries")
