"""Add road_obstructions.bearing_deg

Obstructions are now snapped onto a road segment when they are created, and the
command map draws them as a bar laid across that road rather than as a pin
floating beside it. Drawing that bar needs the road's orientation, so the
bearing is stored at snap time instead of being recomputed on every render.

Nullable because rows created before snapping existed have no road to report.
The map skips the crossing bar for those and the API backfills one the next
time it can snap them.

Revision ID: 0021
Revises: 0020
Create Date: 2026-09-22
"""

from alembic import op
import sqlalchemy as sa

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "road_obstructions",
        sa.Column("bearing_deg", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("road_obstructions", "bearing_deg")
