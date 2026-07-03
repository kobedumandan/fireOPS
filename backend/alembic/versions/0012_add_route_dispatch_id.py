"""routes: add dispatch_id so route sets are scoped per dispatch, not per fire

Revision ID: 0012
Revises: 0011
Create Date: 2026-05-27
"""

from alembic import op
import sqlalchemy as sa


revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "routes",
        sa.Column("dispatch_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_routes_dispatch_id",
        source_table="routes",
        referent_table="dispatch_records",
        local_cols=["dispatch_id"],
        remote_cols=["dispatch_id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_routes_dispatch_id", "routes", ["dispatch_id"])

    # Backfill: for every existing route, find a dispatch that points at it
    # via dispatch_records.route_id and copy its dispatch_id over.
    op.execute(
        """
        UPDATE routes r
        SET    dispatch_id = d.dispatch_id
        FROM   dispatch_records d
        WHERE  d.route_id = r.route_id
          AND  r.dispatch_id IS NULL
        """
    )

    # Best-effort: also attach sibling alt routes (same fire, same origin
    # coords as a now-attached route) to the same dispatch. This recovers
    # rank-2/3 alternates that no dispatch directly referenced.
    op.execute(
        """
        UPDATE routes r
        SET    dispatch_id = anchor.dispatch_id
        FROM   routes anchor
        WHERE  r.dispatch_id IS NULL
          AND  anchor.dispatch_id IS NOT NULL
          AND  anchor.fire_id          = r.fire_id
          AND  anchor.route_origin_lat = r.route_origin_lat
          AND  anchor.route_origin_lng = r.route_origin_lng
          AND  anchor.route_created_at = r.route_created_at
        """
    )

    # Clean up orphans: any remaining rows belong to prior rebuilds whose
    # selected route was already replaced. They're not referenced anywhere.
    op.execute("DELETE FROM routes WHERE dispatch_id IS NULL")


def downgrade():
    op.drop_index("ix_routes_dispatch_id", table_name="routes")
    op.drop_constraint("fk_routes_dispatch_id", "routes", type_="foreignkey")
    op.drop_column("routes", "dispatch_id")
