"""add group_id to turon_attendance_per_month_v2

Revision ID: h8c9d0e1f2g3
Revises: g7b8c9d0e1f2
Create Date: 2026-08-06

"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "h8c9d0e1f2g3"
down_revision: Union[str, None] = "g7b8c9d0e1f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "turon_attendance_per_month_v2",
        sa.Column("group_id", sa.Integer(), nullable=True),
    )
    op.create_index("ix_turon_attendance_per_month_v2_group_id", "turon_attendance_per_month_v2", ["group_id"])


def downgrade() -> None:
    op.drop_index("ix_turon_attendance_per_month_v2_group_id", "turon_attendance_per_month_v2")
    op.drop_column("turon_attendance_per_month_v2", "group_id")
