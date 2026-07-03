"""add shifts table, team_code, team_id/shift_id on personnel

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-16
"""

from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. shifts (fixed lookup table)
    op.create_table(
        "shifts",
        sa.Column("shift_id",   sa.Integer(),     autoincrement=True, nullable=False),
        sa.Column("shift_name", sa.String(50),    nullable=False),
        sa.PrimaryKeyConstraint("shift_id"),
        sa.UniqueConstraint("shift_name"),
    )
    op.execute("INSERT INTO shifts (shift_name) VALUES ('Shift A'), ('Shift B')")

    # 2. team_code on response_teams
    op.add_column("response_teams", sa.Column("team_code", sa.String(50), nullable=True))

    # 3. team_id + shift_id on personnel
    op.add_column("personnel", sa.Column("team_id",  sa.Integer(), nullable=True))
    op.add_column("personnel", sa.Column("shift_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_personnel_team", "personnel", "response_teams",
        ["team_id"], ["team_id"],
    )
    op.create_foreign_key(
        "fk_personnel_shift", "personnel", "shifts",
        ["shift_id"], ["shift_id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_personnel_shift", "personnel", type_="foreignkey")
    op.drop_constraint("fk_personnel_team",  "personnel", type_="foreignkey")
    op.drop_column("personnel", "shift_id")
    op.drop_column("personnel", "team_id")
    op.drop_column("response_teams", "team_code")
    op.drop_table("shifts")
