"""add shift_id to response_teams

Revision ID: 0009
Revises: 0008
Create Date: 2026-05-19
"""

from alembic import op
import sqlalchemy as sa

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("response_teams", sa.Column("shift_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_team_shift", "response_teams", "shifts",
        ["shift_id"], ["shift_id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_team_shift", "response_teams", type_="foreignkey")
    op.drop_column("response_teams", "shift_id")
