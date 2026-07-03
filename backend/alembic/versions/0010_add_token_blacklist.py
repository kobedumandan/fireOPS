"""add token_blacklist table

Revision ID: 0010
Revises: 0009
Create Date: 2026-05-24
"""

from alembic import op
import sqlalchemy as sa

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "token_blacklist",
        sa.Column("id",         sa.Integer(),                    nullable=False, autoincrement=True),
        sa.Column("jti",        sa.String(64),                   nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True),      nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True),      nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("jti"),
    )
    op.create_index("ix_token_blacklist_jti", "token_blacklist", ["jti"])


def downgrade():
    op.drop_index("ix_token_blacklist_jti", table_name="token_blacklist")
    op.drop_table("token_blacklist")
