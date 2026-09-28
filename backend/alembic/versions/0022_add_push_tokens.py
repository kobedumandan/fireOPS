"""Add push_tokens

Responders only saw a new dispatch if the mobile app happened to be open: the
app learns about dispatches by polling and over the WebSocket, both of which
stop when the phone sleeps. Each phone now registers its Expo push token here,
and _perform_dispatch pushes to every member of the dispatched team.

Revision ID: 0022
Revises: 0021
Create Date: 2026-09-26
"""

from alembic import op
import sqlalchemy as sa


revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "push_tokens",
        sa.Column("token", sa.String(length=255), nullable=False),
        sa.Column("per_id", sa.Integer(), nullable=False),
        sa.Column("platform", sa.String(length=20), nullable=True),
        sa.Column("sound_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("token"),
        sa.ForeignKeyConstraint(["per_id"], ["personnel.per_id"], ondelete="CASCADE"),
    )
    op.create_index("ix_push_tokens_per_id", "push_tokens", ["per_id"])


def downgrade() -> None:
    op.drop_index("ix_push_tokens_per_id", table_name="push_tokens")
    op.drop_table("push_tokens")
