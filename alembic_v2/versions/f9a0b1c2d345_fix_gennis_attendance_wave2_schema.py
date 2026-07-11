"""fix gennis_attendance wave2 schema

The old migration d7f3a1b2c894 created gennis_attendance with a simple
came/not-came schema. The wave2 migration b1c2d3e4f5a6 could not replace it
because the table already existed. This migration drops the old table and
recreates it with the correct wave2 sync schema (ball_percentage, teacher_gennis_id, etc.).

Revision ID: f9a0b1c2d345
Revises: c4e2f1a3b567
Create Date: 2026-07-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision: str = "f9a0b1c2d345"
down_revision: Union[str, None] = "c4e2f1a3b567"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop old indexes and table (old schema: group_id, student_id, came, lesson_date)
    op.execute(text("DROP INDEX IF EXISTS ix_ga_group_date"))
    op.execute(text("DROP INDEX IF EXISTS ix_ga_student"))
    op.execute(text("DROP INDEX IF EXISTS ix_ga_location"))
    op.execute(text("DROP TABLE IF EXISTS gennis_attendance CASCADE"))

    op.create_table(
        "gennis_attendance",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("gennis_id", sa.Integer(), nullable=False),
        sa.Column("student_gennis_id", sa.Integer(), nullable=True),
        sa.Column("teacher_gennis_id", sa.Integer(), nullable=True),
        sa.Column("group_gennis_id", sa.Integer(), nullable=True),
        sa.Column("subject_gennis_id", sa.Integer(), nullable=True),
        sa.Column("location_id", sa.Integer(), nullable=True),
        sa.Column("calendar_month_gennis_id", sa.Integer(), nullable=True),
        sa.Column("calendar_year_gennis_id", sa.Integer(), nullable=True),
        sa.Column("ball_percentage", sa.Integer(), nullable=True),
        sa.Column("synced_at", sa.DateTime(), server_default=sa.text("now()"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("gennis_id"),
    )
    op.create_index("ix_gennis_attendance_id", "gennis_attendance", ["id"])
    op.create_index("ix_ga_teacher", "gennis_attendance", ["teacher_gennis_id"])
    op.create_index(
        "ix_ga_calendar",
        "gennis_attendance",
        ["calendar_year_gennis_id", "calendar_month_gennis_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_ga_calendar", table_name="gennis_attendance")
    op.drop_index("ix_ga_teacher", table_name="gennis_attendance")
    op.drop_index("ix_gennis_attendance_id", table_name="gennis_attendance")
    op.drop_table("gennis_attendance")
