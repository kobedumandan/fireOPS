"""remove personnel.team_id (membership via response_team_members only)

Revision ID: 0008
Revises: 0007
Create Date: 2026-05-18
"""

from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("fk_personnel_team", "personnel", type_="foreignkey")
    op.drop_column("personnel", "team_id")


def downgrade() -> None:
    op.add_column("personnel", sa.Column("team_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_personnel_team", "personnel", "response_teams",
        ["team_id"], ["team_id"],
    )
