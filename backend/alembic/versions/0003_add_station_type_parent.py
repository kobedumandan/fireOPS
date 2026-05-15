"""add station_type and parent_station_id to stations

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-15
"""

from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("stations", sa.Column("station_type", sa.String(10), nullable=False, server_default="main"))
    op.add_column("stations", sa.Column("parent_station_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_station_parent", "stations", "stations",
        ["parent_station_id"], ["station_id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_station_parent", "stations", type_="foreignkey")
    op.drop_column("stations", "parent_station_id")
    op.drop_column("stations", "station_type")
