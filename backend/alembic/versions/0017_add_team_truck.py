"""Add truck_id to response_teams (team -> assigned truck)

A team is assigned one truck; a truck may be shared by teams on different shifts
(many teams -> one truck). Used to attach the truck to each dispatch.

Revision ID: 0017
Revises: 0016
Create Date: 2026-06-01
"""

from alembic import op
import sqlalchemy as sa


revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "response_teams",
        sa.Column("truck_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_response_teams_truck_id",
        "response_teams",
        "truck",
        ["truck_id"],
        ["truck_id"],
    )


def downgrade():
    op.drop_constraint("fk_response_teams_truck_id", "response_teams", type_="foreignkey")
    op.drop_column("response_teams", "truck_id")
