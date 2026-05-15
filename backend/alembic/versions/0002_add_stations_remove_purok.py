"""add stations, remove purok_boundaries

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-14

Changes:
  - Create stations table
  - Add station_id FK to personnel, truck, response_teams
  - Drop purok_id from fire_incidents
  - Drop purok_boundaries table
"""

from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ---------------------------------------------------------------- stations
    op.create_table(
        "stations",
        sa.Column("station_id",       sa.Integer(),             primary_key=True, autoincrement=True),
        sa.Column("station_name",     sa.String(150),           nullable=False),
        sa.Column("station_address",  sa.String(255),           nullable=True),
        sa.Column("station_barangay", sa.String(150),           nullable=True),
        sa.Column("station_latitude",  sa.Float(),              nullable=True),
        sa.Column("station_longitude", sa.Float(),              nullable=True),
        sa.Column("station_contact",  sa.String(50),            nullable=True),
        sa.Column("station_status",   sa.String(50),            nullable=True),
        sa.Column("created_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at",       sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("station_name", name="uq_stations_name"),
    )

    # ----------------------------------------- add station_id to personnel
    op.add_column("personnel", sa.Column("station_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_personnel_station", "personnel", "stations", ["station_id"], ["station_id"])

    # ----------------------------------------- add station_id to truck
    op.add_column("truck", sa.Column("station_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_truck_station", "truck", "stations", ["station_id"], ["station_id"])

    # ----------------------------------------- add station_id to response_teams
    op.add_column("response_teams", sa.Column("station_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_teams_station", "response_teams", "stations", ["station_id"], ["station_id"])

    # ----------------------------------------- drop purok from fire_incidents
    op.drop_constraint("fk_fi_purok", "fire_incidents", type_="foreignkey")
    op.drop_column("fire_incidents", "purok_id")

    # ----------------------------------------- drop purok_boundaries
    op.drop_table("purok_boundaries")


def downgrade() -> None:
    # Re-create purok_boundaries
    op.create_table(
        "purok_boundaries",
        sa.Column("purok_id",      sa.Integer(),   primary_key=True, autoincrement=True),
        sa.Column("purok_name",    sa.String(150), nullable=True),
        sa.Column("purok_geojson", sa.Text(),      nullable=True),
    )

    # Restore purok_id on fire_incidents
    op.add_column("fire_incidents", sa.Column("purok_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_fi_purok", "fire_incidents", "purok_boundaries", ["purok_id"], ["purok_id"])

    # Remove station_id from response_teams
    op.drop_constraint("fk_teams_station", "response_teams", type_="foreignkey")
    op.drop_column("response_teams", "station_id")

    # Remove station_id from truck
    op.drop_constraint("fk_truck_station", "truck", type_="foreignkey")
    op.drop_column("truck", "station_id")

    # Remove station_id from personnel
    op.drop_constraint("fk_personnel_station", "personnel", type_="foreignkey")
    op.drop_column("personnel", "station_id")

    # Drop stations
    op.drop_table("stations")