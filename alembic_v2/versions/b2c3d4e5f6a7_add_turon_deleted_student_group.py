"""Add turon_deleted_student_group mirror table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-08-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "turon_deleted_student_group",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("turon_id", sa.Integer, nullable=False, unique=True),
        sa.Column("student_turon_id", sa.Integer, nullable=False, index=True),
        sa.Column("group_turon_id", sa.Integer, nullable=False, index=True),
        sa.Column("reason_turon_id", sa.Integer, nullable=True),
        sa.Column("teacher_turon_id", sa.Integer, nullable=True),
        sa.Column("comment", sa.String(500), nullable=True),
        sa.Column("deleted_date", sa.Date, nullable=True),
        sa.Column("synced_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.UniqueConstraint("student_turon_id", "group_turon_id", name="uq_turon_deleted_student_group"),
    )


def downgrade() -> None:
    op.drop_table("turon_deleted_student_group")
