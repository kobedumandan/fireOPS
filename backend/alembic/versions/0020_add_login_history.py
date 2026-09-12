"""Add login_history table and users.password_changed_at

The Security settings tab showed a hardcoded "Last Login / Device / IP" block
because nothing recorded sign-ins. Every successful authentication now appends a
row here, and the password row reads a real timestamp instead of a literal.

Revision ID: 0020
Revises: 0019
Create Date: 2026-09-12
"""

from alembic import op
import sqlalchemy as sa


revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "login_history",
        sa.Column("login_id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("logged_in_at", sa.DateTime(timezone=True), nullable=True),
        # 45 chars is the longest possible IPv6 form (v4-mapped included).
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.PrimaryKeyConstraint("login_id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
    )
    # The only read is "this user's most recent sign-ins", so index that shape.
    op.create_index(
        "ix_login_history_user_time",
        "login_history",
        ["user_id", sa.text("logged_in_at DESC")],
    )
    op.add_column(
        "users",
        sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_column("users", "password_changed_at")
    op.drop_index("ix_login_history_user_time", table_name="login_history")
    op.drop_table("login_history")
