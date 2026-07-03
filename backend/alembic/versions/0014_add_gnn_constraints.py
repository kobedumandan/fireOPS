"""Add gnn_constraints table for user-drawn constraint edges

Revision ID: 0014
Revises: 0013
Create Date: 2026-05-27
"""

from alembic import op
import sqlalchemy as sa


revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "gnn_constraints",
        sa.Column("constraint_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("constraint_type", sa.String(50), nullable=False),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("coordinates", sa.Text(), nullable=False),
        sa.Column("highway", sa.String(100), nullable=True),
        sa.Column("surface", sa.String(100), nullable=True),
        sa.Column("maxspeed", sa.String(50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.user_id"), nullable=True),
    )


def downgrade():
    op.drop_table("gnn_constraints")
