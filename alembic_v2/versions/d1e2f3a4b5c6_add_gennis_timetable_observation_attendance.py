"""add gennis timetable participants, observation detail, group attendance, deleted salaries

Revision ID: d1e2f3a4b5c6
Revises: c0d1e2f3a4b5
Create Date: 2026-08-11 13:00:00.000000

Four more groups with no v2 home, ~11,000 rows, all lost when old gennis is
switched off:

    time_table_student/_teacher/_assistent   4,689   who attends which slot
    teacher_observation + info + options     3,259   the per-criterion detail
    group_attendance                         1,604   monthly attendance blobs
    deletedteachersalaries/staffsalaries     1,411   reversed salary payments

Three decisions worth recording:

  * The time_table_* tables have NO id column — they are raw many-to-many links
    with no key of their own. Each mirror therefore gets a surrogate id plus a
    unique constraint on the pair, which is also what makes the sync re-runnable.
    time_table_student holds 186 exact duplicate (student, slot) pairs; the
    constraint collapses them, which loses nothing since the rows are identical.

  * They stay as three tables rather than one with a role column, even though
    the shapes are identical. student_id, teacher_id and assistent_id live in
    three different id spaces, so a merged table would need every reader to know
    which mirror to join on — three narrow tables cost nothing and cannot be
    joined wrongly.

  * teacher_observation keeps rows whose observation/info/option references
    dangle (35 of 3,246). The comment on such a row is still the observation;
    dropping it to satisfy a foreign key would discard the only content it has.
    Hence no FK constraints here, matching the other gennis mirrors.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, None] = 'c0d1e2f3a4b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (table, unique columns) — the re-run key for each sync
GENNIS_ID_TABLES = [
    "gennis_observation_info",
    "gennis_observation_option",
    "gennis_teacher_observation",
    "gennis_group_attendance",
    "gennis_deleted_teacher_salary",
    "gennis_deleted_staff_salary",
]
PAIR_TABLES = [
    ("gennis_timetable_student", ["student_gennis_id", "group_room_week_gennis_id"]),
    ("gennis_timetable_teacher", ["teacher_gennis_id", "group_room_week_gennis_id"]),
    ("gennis_timetable_assistent", ["assistent_gennis_id", "group_room_week_gennis_id"]),
]


def upgrade() -> None:
    # ── who attends which timetable slot ──────────────────────────────────
    for table, (person_col, slot_col) in PAIR_TABLES:
        op.create_table(
            table,
            sa.Column("id", sa.BigInteger(), primary_key=True),
            sa.Column(person_col, sa.Integer(), nullable=True, index=True),
            sa.Column(slot_col, sa.Integer(), nullable=True, index=True),
            sa.Column("synced_at", sa.DateTime(), server_default=sa.func.now()),
        )

    # ── teacher observation detail ────────────────────────────────────────
    op.create_table(
        "gennis_observation_info",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("gennis_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("synced_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_table(
        "gennis_observation_option",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("gennis_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("value", sa.Integer(), nullable=True),
        sa.Column("synced_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_table(
        "gennis_teacher_observation",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("gennis_id", sa.Integer(), nullable=False),
        # teacher_observation_day.id on the old side
        sa.Column("observation_day_gennis_id", sa.Integer(), nullable=True, index=True),
        sa.Column("observation_info_gennis_id", sa.Integer(), nullable=True),
        sa.Column("observation_option_gennis_id", sa.Integer(), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("synced_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── monthly group attendance ──────────────────────────────────────────
    op.create_table(
        "gennis_group_attendance",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("gennis_id", sa.Integer(), nullable=False),
        sa.Column("group_gennis_id", sa.Integer(), nullable=True, index=True),
        sa.Column("status", sa.Boolean(), nullable=True),
        # old gennis stores the month's grid as a json blob:
        # {"attendances": [...], "dates": [...], "students_num": N}
        sa.Column("data", postgresql.JSONB(), nullable=True),
        sa.Column("calendar_month_gennis_id", sa.Integer(), nullable=True),
        sa.Column("calendar_year_gennis_id", sa.Integer(), nullable=True),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("month", sa.Integer(), nullable=True),
        sa.Column("synced_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── reversed salary payments ──────────────────────────────────────────
    for table, person_col, extra in (
        ("gennis_deleted_teacher_salary", "teacher_gennis_id", "group_gennis_id"),
        ("gennis_deleted_staff_salary", "staff_gennis_id", "profession_id"),
    ):
        op.create_table(
            table,
            sa.Column("id", sa.BigInteger(), primary_key=True),
            sa.Column("gennis_id", sa.Integer(), nullable=False),
            sa.Column(person_col, sa.Integer(), nullable=True, index=True),
            sa.Column(extra, sa.Integer(), nullable=True),
            sa.Column("payment_sum", sa.BigInteger(), nullable=True),
            sa.Column("reason", sa.Text(), nullable=True),
            sa.Column("payment_type_id", sa.Integer(), nullable=True),
            sa.Column("location_id", sa.Integer(), nullable=True, index=True),
            sa.Column("account_period_id", sa.Integer(), nullable=True),
            sa.Column("deleted_date", sa.DateTime(), nullable=True),
            sa.Column("reason_deleted", sa.Text(), nullable=True),
            sa.Column("calendar_day_gennis_id", sa.Integer(), nullable=True),
            sa.Column("calendar_month_gennis_id", sa.Integer(), nullable=True),
            sa.Column("calendar_year_gennis_id", sa.Integer(), nullable=True),
            sa.Column("date", sa.Date(), nullable=True, index=True),
            sa.Column("year", sa.Integer(), nullable=True),
            sa.Column("month", sa.Integer(), nullable=True),
            sa.Column("synced_at", sa.DateTime(), server_default=sa.func.now()),
        )

    for table in GENNIS_ID_TABLES:
        op.create_unique_constraint(f"uq_{table}_gennis_id", table, ["gennis_id"])
    for table, cols in PAIR_TABLES:
        op.create_unique_constraint(f"uq_{table}_pair", table, cols)


def downgrade() -> None:
    for table in reversed(GENNIS_ID_TABLES):
        op.drop_table(table)
    for table, _ in reversed(PAIR_TABLES):
        op.drop_table(table)
