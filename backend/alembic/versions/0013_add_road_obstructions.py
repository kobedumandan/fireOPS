"""Add road_obstructions table for manual road obstacles

Revision ID: 0013
Revises: 0012
Create Date: 2026-05-27
"""

from alembic import op
import sqlalchemy as sa


revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "road_obstructions",
        sa.Column("obstruction_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.user_id"), nullable=True),
    )


def downgrade():
    op.drop_table("road_obstructions")
