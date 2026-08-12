"""add gennis_student_drop_log — the full drop history behind gennis_deleted_student_group

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
Create Date: 2026-08-12 12:40:00.000000

The live table gennis_deleted_student_group keeps only (student_id, group_id,
reason) and is UNIQUE on the pair, which is right for what it is used for —
"is this student currently dropped from this group, and why" — but it means
old gennis's deleted_students table arrives here with most of itself missing:

    calendar_day   WHEN the student left. Never migrated at all, which is why
                   students/history.py returns "left_day": "" for every
                   group-level drop. 11,682 dates lost.
    teacher_id     whose group they were dropped from
    reason_id      the structured reason (FK to group_reason), as opposed to
                   the free-text `reason` string
    id             the drop event's own identity

and, because of the pair-unique constraint, 326 rows collapse into their
twins — 199 of which carried a genuinely different reason from the row that
survived. A student who joined and left the same group twice keeps one drop.

Widening that constraint was the obvious fix and is the wrong one: the
deleted-students list and the student history both read one row per pair
(students/history.py: `if d.group_id not in seen_groups`), so a second row
would show the same student twice in the UI. The live table is shaped
correctly for its readers.

So this is a plain archive mirror instead, in the same spirit as the other
fourteen: every deleted_students row exactly as it was, keyed on the old id,
with the calendar_day FK resolved to a real date the same way the rest of
wave 4 does it. Nothing reads it yet; it exists so the history is still
answerable after old gennis is switched off.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'f3a4b5c6d7e8'
down_revision: Union[str, None] = 'e2f3a4b5c6d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "gennis_student_drop_log",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("gennis_id", sa.Integer(), nullable=False),
        sa.Column("student_gennis_id", sa.Integer(), nullable=True, index=True),
        sa.Column("group_gennis_id", sa.Integer(), nullable=True, index=True),
        sa.Column("teacher_gennis_id", sa.Integer(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        # group_reason.id — the structured counterpart to `reason`
        sa.Column("reason_id", sa.Integer(), nullable=True),
        sa.Column("calendar_day_gennis_id", sa.Integer(), nullable=True),
        # resolved from calendar_day; NULL when the source date is nonsense
        sa.Column("date", sa.Date(), nullable=True, index=True),
        sa.Column("synced_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_unique_constraint(
        "uq_gennis_student_drop_log_gennis_id", "gennis_student_drop_log", ["gennis_id"]
    )


def downgrade() -> None:
    op.drop_table("gennis_student_drop_log")
