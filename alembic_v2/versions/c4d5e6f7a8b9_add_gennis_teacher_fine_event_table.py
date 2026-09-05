"""add gennis_teacher_fine_event table — per-lesson fine cause log

Records exactly which lesson (group+student+date) triggered a teacher/
assistant salary fine, and why ("late" marking or a missing lesson plan),
at the moment it's accrued in gennis-v2's attendance/mark.py. Before this,
GennisTeacherSalaryMgmt/GennisAssistentSalaryMgmt.fine was only ever a
running total with no way to see which lesson caused it — teachers had no
page explaining why they were fined.

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-09-05

"""
from alembic import op
import sqlalchemy as sa

revision = "c4d5e6f7a8b9"
down_revision = "b3c4d5e6f7a8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "gennis_teacher_fine_event",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("teacher_salary_id", sa.BigInteger, sa.ForeignKey("gennis_teacher_salary.id"), nullable=True),
        sa.Column("assistent_salary_id", sa.BigInteger, sa.ForeignKey("gennis_assistent_salary.id"), nullable=True),
        sa.Column("group_id", sa.Integer, nullable=False),
        sa.Column("group_name", sa.String(255), nullable=True),
        sa.Column("student_id", sa.Integer, nullable=False),
        sa.Column("lesson_date", sa.Date, nullable=False),
        # 'late' — attendance marked for a past date instead of the day it
        # happened; 'missing_plan' — no lesson plan filled in for that lesson.
        sa.Column("reason", sa.String(20), nullable=False),
        sa.Column("amount", sa.Integer, nullable=False),
        sa.Column("calendar_month", sa.Integer, nullable=False),
        sa.Column("calendar_year", sa.Integer, nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        # Set true (not deleted) when the underlying lesson is later removed
        # via attendance/history.py's reversal — keeps the "why was I fined"
        # history honest (the fine really did happen, then got undone)
        # instead of silently erasing it.
        sa.Column("voided", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("voided_at", sa.DateTime, nullable=True),
    )
    op.create_index(
        "ix_gennis_teacher_fine_event_teacher_salary", "gennis_teacher_fine_event", ["teacher_salary_id"]
    )
    op.create_index(
        "ix_gennis_teacher_fine_event_assistent_salary", "gennis_teacher_fine_event", ["assistent_salary_id"]
    )
    op.create_index(
        "ix_gennis_teacher_fine_event_lookup", "gennis_teacher_fine_event", ["group_id", "student_id", "lesson_date"]
    )


def downgrade() -> None:
    op.drop_index("ix_gennis_teacher_fine_event_lookup", table_name="gennis_teacher_fine_event")
    op.drop_index("ix_gennis_teacher_fine_event_assistent_salary", table_name="gennis_teacher_fine_event")
    op.drop_index("ix_gennis_teacher_fine_event_teacher_salary", table_name="gennis_teacher_fine_event")
    op.drop_table("gennis_teacher_fine_event")
