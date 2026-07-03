"""Add report_photos table

Stores scene photographs personnel attach to an incident report. The image
bytes live on disk under the backend uploads directory; each row records the
stored filename so the file can be served and cleaned up with the report.

Revision ID: 0019
Revises: 0018
Create Date: 2026-06-03
"""

from alembic import op
import sqlalchemy as sa


revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "report_photos",
        sa.Column("photo_id", sa.Integer(), nullable=False),
        sa.Column("report_id", sa.Integer(), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("original_name", sa.String(length=255), nullable=True),
        sa.Column("content_type", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["report_id"], ["incident_reports.report_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("photo_id"),
    )
    op.create_index(
        "ix_report_photos_report_id", "report_photos", ["report_id"], unique=False
    )


def downgrade():
    op.drop_index("ix_report_photos_report_id", table_name="report_photos")
    op.drop_table("report_photos")
