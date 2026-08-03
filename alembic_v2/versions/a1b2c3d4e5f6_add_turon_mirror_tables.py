"""Add turon_* mirror tables for management-v2 integration

Revision ID: a1b2c3d4e5f6
Revises: f9a0b1c2d345
Create Date: 2026-08-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "c2d3e4f5a6b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Bridge table ──────────────────────────────────────────────────────────
    op.create_table(
        "turon_user_link",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("management_user_id", sa.BigInteger, sa.ForeignKey("user.id"), nullable=False, index=True),
        sa.Column("turon_user_id", sa.Integer, nullable=False, unique=True),
        sa.Column("branch_id", sa.Integer, nullable=True),
        sa.Column("branch_name", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    # ── Reference / catalog tables ────────────────────────────────────────────
    op.create_table(
        "turon_branch",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("turon_id", sa.Integer, nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("code", sa.Integer, nullable=True),
        sa.Column("address", sa.String(500), nullable=True),
        sa.Column("phone_number", sa.String(50), nullable=True),
        sa.Column("district", sa.String(255), nullable=True),
        sa.Column("deleted", sa.Boolean, server_default=sa.false()),
        sa.Column("synced_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "turon_language",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("turon_id", sa.Integer, nullable=False, unique=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("synced_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "turon_subject",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("turon_id", sa.Integer, nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("disabled", sa.Boolean, server_default=sa.false()),
        sa.Column("synced_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "turon_subject_level",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("turon_id", sa.Integer, nullable=False, unique=True),
        sa.Column("turon_subject_id", sa.Integer, nullable=True, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("disabled", sa.Boolean, server_default=sa.false()),
        sa.Column("synced_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "turon_group_reason",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("turon_id", sa.Integer, nullable=False, unique=True),
        sa.Column("reason", sa.String(500), nullable=True),
        sa.Column("synced_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ── Core entity tables ────────────────────────────────────────────────────
    op.create_table(
        "turon_teacher",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("turon_id", sa.Integer, nullable=False, unique=True),
        sa.Column("turon_user_id", sa.Integer, nullable=True),
        sa.Column("management_user_id", sa.BigInteger, nullable=True, index=True),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("surname", sa.String(255), nullable=True),
        sa.Column("username", sa.String(100), nullable=True),
        sa.Column("color", sa.String(50), nullable=True),
        sa.Column("total_students", sa.Integer, nullable=True),
        sa.Column("salary_percentage", sa.Integer, nullable=True),
        sa.Column("deleted", sa.Boolean, server_default=sa.false()),
        sa.Column("synced_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "turon_room",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("turon_id", sa.Integer, nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("capacity", sa.Integer, nullable=True),
        sa.Column("branch_turon_id", sa.Integer, nullable=True, index=True),
        sa.Column("deleted", sa.Boolean, server_default=sa.false()),
        sa.Column("synced_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "turon_group",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("turon_id", sa.Integer, nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("branch_turon_id", sa.Integer, nullable=True, index=True),
        sa.Column("subject_turon_id", sa.Integer, nullable=True),
        sa.Column("teacher_turon_id", sa.Integer, nullable=True),
        sa.Column("teacher_mgmt_id", sa.BigInteger, nullable=True),
        sa.Column("language_turon_id", sa.Integer, nullable=True),
        sa.Column("price", sa.Integer, nullable=True),
        sa.Column("teacher_salary", sa.Integer, nullable=True),
        sa.Column("attendance_days", sa.Integer, nullable=True),
        sa.Column("status", sa.Boolean, server_default=sa.true()),
        sa.Column("deleted", sa.Boolean, server_default=sa.false()),
        sa.Column("created_date", sa.Date, nullable=True),
        sa.Column("synced_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "turon_student",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("turon_id", sa.Integer, nullable=False, unique=True),
        sa.Column("turon_user_id", sa.Integer, nullable=True),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("surname", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("parents_number", sa.String(50), nullable=True),
        sa.Column("born_date", sa.Date, nullable=True),
        sa.Column("debt_status", sa.BigInteger, nullable=True),
        sa.Column("synced_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "turon_student_group",
        sa.Column("student_turon_id", sa.Integer, nullable=False),
        sa.Column("group_turon_id", sa.Integer, nullable=False),
        sa.UniqueConstraint("student_turon_id", "group_turon_id", name="uq_turon_student_group"),
    )

    op.create_table(
        "turon_lead",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("turon_id", sa.Integer, nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("branch_turon_id", sa.Integer, nullable=True, index=True),
        sa.Column("finished", sa.Boolean, server_default=sa.false()),
        sa.Column("deleted", sa.Boolean, server_default=sa.false()),
        sa.Column("created", sa.Date, nullable=True),
        sa.Column("synced_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ── Finance tables ────────────────────────────────────────────────────────
    op.create_table(
        "turon_overhead_type",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("turon_id", sa.Integer, nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("cost", sa.BigInteger, nullable=True),
        sa.Column("changeable", sa.Boolean, server_default=sa.true()),
        sa.Column("branch_turon_id", sa.Integer, nullable=True),
        sa.Column("management_id", sa.Integer, nullable=True),
        sa.Column("deleted", sa.Boolean, server_default=sa.false()),
        sa.Column("synced_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "turon_overhead",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("turon_id", sa.Integer, nullable=False, unique=True),
        sa.Column("overhead_type_turon_id", sa.Integer, nullable=True, index=True),
        sa.Column("branch_turon_id", sa.Integer, nullable=True, index=True),
        sa.Column("amount", sa.BigInteger, nullable=True),
        sa.Column("date", sa.Date, nullable=True),
        sa.Column("deleted", sa.Boolean, server_default=sa.false()),
        sa.Column("synced_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "turon_capital_category",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("turon_id", sa.Integer, nullable=False, unique=True),
        sa.Column("name", sa.String(100), nullable=True),
        sa.Column("synced_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "turon_capital",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("turon_id", sa.Integer, nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("price", sa.BigInteger, nullable=True),
        sa.Column("total_down_cost", sa.BigInteger, nullable=True),
        sa.Column("branch_turon_id", sa.Integer, nullable=True, index=True),
        sa.Column("category_turon_id", sa.Integer, nullable=True),
        sa.Column("added_date", sa.Date, nullable=True),
        sa.Column("deleted", sa.Boolean, server_default=sa.false()),
        sa.Column("synced_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "turon_capital_term",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("turon_id", sa.Integer, nullable=False, unique=True),
        sa.Column("capital_turon_id", sa.Integer, nullable=True, index=True),
        sa.Column("down_cost", sa.BigInteger, nullable=True),
        sa.Column("month_date", sa.Date, nullable=True),
        sa.Column("synced_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "turon_student_payment",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("turon_id", sa.Integer, nullable=False, unique=True),
        sa.Column("student_turon_id", sa.Integer, nullable=True, index=True),
        sa.Column("group_turon_id", sa.Integer, nullable=True),
        sa.Column("branch_turon_id", sa.Integer, nullable=True, index=True),
        sa.Column("payment_sum", sa.BigInteger, nullable=True),
        sa.Column("extra_payment", sa.BigInteger, nullable=True),
        sa.Column("payment_date", sa.Date, nullable=True),
        sa.Column("deleted", sa.Boolean, server_default=sa.false()),
        sa.Column("synced_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "turon_attendance_history_student",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("turon_id", sa.Integer, nullable=False, unique=True),
        sa.Column("student_turon_id", sa.Integer, nullable=True, index=True),
        sa.Column("teacher_turon_id", sa.Integer, nullable=True),
        sa.Column("group_turon_id", sa.Integer, nullable=True, index=True),
        sa.Column("branch_turon_id", sa.Integer, nullable=True, index=True),
        sa.Column("month_date", sa.Date, nullable=True),
        sa.Column("total_debt", sa.BigInteger, nullable=True),
        sa.Column("remaining_debt", sa.BigInteger, nullable=True),
        sa.Column("payment", sa.BigInteger, nullable=True),
        sa.Column("ball_percentage", sa.Integer, nullable=True),
        sa.Column("present_days", sa.Integer, nullable=True),
        sa.Column("absent_days", sa.Integer, nullable=True),
        sa.Column("discount", sa.Integer, nullable=True),
        sa.Column("synced_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ── Teacher analytics tables ───────────────────────────────────────────────
    op.create_table(
        "turon_teacher_salary",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("turon_id", sa.Integer, nullable=False, unique=True),
        sa.Column("teacher_turon_id", sa.Integer, nullable=True, index=True),
        sa.Column("branch_turon_id", sa.Integer, nullable=True, index=True),
        sa.Column("month_date", sa.Date, nullable=True),
        sa.Column("total_salary", sa.BigInteger, nullable=True),
        sa.Column("remaining_salary", sa.BigInteger, nullable=True),
        sa.Column("taken_salary", sa.BigInteger, nullable=True),
        sa.Column("percentage", sa.Integer, nullable=True),
        sa.Column("synced_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "turon_teacher_salary_payment",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("turon_id", sa.Integer, nullable=False, unique=True),
        sa.Column("teacher_turon_id", sa.Integer, nullable=True, index=True),
        sa.Column("salary_turon_id", sa.Integer, nullable=True),
        sa.Column("branch_turon_id", sa.Integer, nullable=True),
        sa.Column("salary", sa.BigInteger, nullable=True),
        sa.Column("date", sa.Date, nullable=True),
        sa.Column("comment", sa.String(300), nullable=True),
        sa.Column("deleted", sa.Boolean, server_default=sa.false()),
        sa.Column("synced_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "turon_lesson_plan",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("turon_id", sa.Integer, nullable=False, unique=True),
        sa.Column("teacher_turon_id", sa.Integer, nullable=True, index=True),
        sa.Column("group_turon_id", sa.Integer, nullable=True),
        sa.Column("ball", sa.Integer, nullable=True),
        sa.Column("date", sa.Date, nullable=True),
        sa.Column("synced_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "turon_teacher_observation_day",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("turon_id", sa.Integer, nullable=False, unique=True),
        sa.Column("teacher_turon_id", sa.Integer, nullable=True, index=True),
        sa.Column("group_turon_id", sa.Integer, nullable=True),
        sa.Column("user_turon_id", sa.Integer, nullable=True),
        sa.Column("day", sa.Date, nullable=True),
        sa.Column("average", sa.Integer, nullable=True),
        sa.Column("synced_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "turon_teacher_group_statistics",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("turon_id", sa.Integer, nullable=False, unique=True),
        sa.Column("teacher_turon_id", sa.Integer, nullable=True, index=True),
        sa.Column("reason_turon_id", sa.Integer, nullable=True),
        sa.Column("branch_turon_id", sa.Integer, nullable=True),
        sa.Column("number_students", sa.Integer, nullable=True),
        sa.Column("percentage", sa.Integer, nullable=True),
        sa.Column("date", sa.Date, nullable=True),
        sa.Column("synced_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("turon_teacher_group_statistics")
    op.drop_table("turon_teacher_observation_day")
    op.drop_table("turon_lesson_plan")
    op.drop_table("turon_teacher_salary_payment")
    op.drop_table("turon_teacher_salary")
    op.drop_table("turon_attendance_history_student")
    op.drop_table("turon_student_payment")
    op.drop_table("turon_capital_term")
    op.drop_table("turon_capital")
    op.drop_table("turon_capital_category")
    op.drop_table("turon_overhead")
    op.drop_table("turon_overhead_type")
    op.drop_table("turon_lead")
    op.drop_table("turon_student_group")
    op.drop_table("turon_student")
    op.drop_table("turon_group")
    op.drop_table("turon_room")
    op.drop_table("turon_teacher")
    op.drop_table("turon_group_reason")
    op.drop_table("turon_subject_level")
    op.drop_table("turon_subject")
    op.drop_table("turon_language")
    op.drop_table("turon_branch")
    op.drop_table("turon_user_link")
