"""add station_commander_id to stations

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-15
"""

from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("stations", sa.Column("station_commander_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_station_commander", "stations", "personnel",
        ["station_commander_id"], ["per_id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_station_commander", "stations", type_="foreignkey")
    op.drop_column("stations", "station_commander_id")
