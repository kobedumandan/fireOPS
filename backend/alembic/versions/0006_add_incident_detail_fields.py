"""add incident detail fields

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-17
"""

from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("fire_incidents", sa.Column("fire_reporter_name",  sa.String(150), nullable=True))
    op.add_column("fire_incidents", sa.Column("fire_location_name",  sa.String(255), nullable=True))
    op.add_column("fire_incidents", sa.Column("fire_address",        sa.String(255), nullable=True))
    op.add_column("fire_incidents", sa.Column("fire_alarm_level",    sa.String(50),  nullable=True))
    op.add_column("fire_incidents", sa.Column("fire_structure_type", sa.String(100), nullable=True))
    op.add_column("fire_incidents", sa.Column("fire_casualties",     sa.String(100), nullable=True))
    op.add_column("fire_incidents", sa.Column("fire_units_assigned", sa.Integer(),   nullable=True, server_default="0"))


def downgrade() -> None:
    op.drop_column("fire_incidents", "fire_units_assigned")
    op.drop_column("fire_incidents", "fire_casualties")
    op.drop_column("fire_incidents", "fire_structure_type")
    op.drop_column("fire_incidents", "fire_alarm_level")
    op.drop_column("fire_incidents", "fire_address")
    op.drop_column("fire_incidents", "fire_location_name")
    op.drop_column("fire_incidents", "fire_reporter_name")
