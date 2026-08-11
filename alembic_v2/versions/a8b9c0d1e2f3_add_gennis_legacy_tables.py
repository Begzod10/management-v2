"""add gennis legacy tables (excuses, tests, black students, reports, contracts)

Revision ID: a8b9c0d1e2f3
Revises: z7a8b9c0d1e2
Create Date: 2026-08-11 11:40:00.000000

Creates a v2 home for the old-gennis features that were never migrated. Old
gennis is being switched off and v2 becomes authoritative, so without these
tables ~44,000 rows stop being reachable at cutover:

    studentexcuses + audio            27,445
    student_test/group_test/block      9,237
    deletedstudentpayments             2,527
    black_students + statistics        2,122
    branch_reports                     1,225
    contract_students + data              879
    studentcallinginfo + audio            537

Two conventions, both taken from the mirrors already in this schema
(GennisCalendarDay et al.) rather than invented here:

  * The old row's own id is kept in `gennis_id` (unique), and references to
    other old rows are kept raw in `*_gennis_id` columns. No remapping to v2
    surrogate keys: these are archival mirrors, the join to gennis_student
    goes through its `gennis_id`, and a remap that silently drops rows whose
    target was never migrated would lose exactly the history this is meant
    to preserve.

  * Old gennis stores dates as FKs into calendarday/calendarmonth/calendaryear,
    not as dates. Those tables are partly corrupt in production — calendaryear
    ids 5, 9, 10, 12 and 13 hold years 0002, 0003, 0213, 0026 and 0006, and
    six calendarday and six calendarmonth rows are likewise pre-1900. So each
    table here keeps the raw FK id *and* a resolved date/year/month, with the
    resolved column left NULL where the source is nonsense. Nothing is
    silently normalised to a wrong date, and nothing is dropped for having one.

student_test_block is named gennis_test_applicant here: despite the name it
holds public sign-ups for entrance tests (name, phone, school, language), not
per-student results, and sits with the tests only by association.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a8b9c0d1e2f3'
down_revision: Union[str, None] = 'z7a8b9c0d1e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TABLES = (
    "gennis_student_excuse",
    "gennis_student_excuse_audio",
    "gennis_group_test",
    "gennis_student_test",
    "gennis_test_applicant",
    "gennis_black_student",
    "gennis_black_student_stat",
    "gennis_branch_report",
    "gennis_deleted_student_payment",
    "gennis_contract_student",
    "gennis_contract_counter",
    "gennis_student_calling_info",
    "gennis_student_calling_info_audio",
    "gennis_notification",
)


def _common(*cols):
    """Every mirror carries the same identity and provenance columns."""
    return (
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("gennis_id", sa.Integer(), nullable=False),
        *cols,
        sa.Column("synced_at", sa.DateTime(), server_default=sa.func.now()),
    )


def upgrade() -> None:
    # ── student excuses (absence notes) + the call recordings behind them ──
    op.create_table(
        "gennis_student_excuse",
        *_common(
            sa.Column("student_gennis_id", sa.Integer(), nullable=True, index=True),
            sa.Column("reason", sa.Text(), nullable=True),
            sa.Column("to_date", sa.DateTime(), nullable=True),
            sa.Column("added_date", sa.DateTime(), nullable=True),
            sa.Column("audio_url", sa.String(500), nullable=True),
        ),
    )
    op.create_table(
        "gennis_student_excuse_audio",
        *_common(
            sa.Column("excuse_gennis_id", sa.Integer(), nullable=True, index=True),
            sa.Column("audio_url", sa.String(500), nullable=True),
            sa.Column("client_number", sa.String(100), nullable=True),
            sa.Column("diversion", sa.String(100), nullable=True),
            sa.Column("duration", sa.String(50), nullable=True),
            sa.Column("start_time", sa.DateTime(), nullable=True),
            sa.Column("end_time", sa.DateTime(), nullable=True),
            sa.Column("wait_time", sa.String(50), nullable=True),
            sa.Column("comment", sa.Text(), nullable=True),
            sa.Column("calendar_day_gennis_id", sa.Integer(), nullable=True),
            sa.Column("date", sa.Date(), nullable=True),
        ),
    )

    # ── tests ─────────────────────────────────────────────────────────────
    op.create_table(
        "gennis_group_test",
        *_common(
            sa.Column("group_gennis_id", sa.Integer(), nullable=True, index=True),
            sa.Column("subject_gennis_id", sa.Integer(), nullable=True),
            sa.Column("name", sa.String(255), nullable=True),
            sa.Column("number_tests", sa.Integer(), nullable=True),
            # double precision in old gennis, unlike student_test.percentage
            # which is text there — kept as their real types, not unified
            sa.Column("percentage", sa.Float(), nullable=True),
            sa.Column("level", sa.String(100), nullable=True),
            sa.Column("file", sa.String(500), nullable=True),
            sa.Column("calendar_day_gennis_id", sa.Integer(), nullable=True),
            sa.Column("calendar_month_gennis_id", sa.Integer(), nullable=True),
            sa.Column("calendar_year_gennis_id", sa.Integer(), nullable=True),
            sa.Column("date", sa.Date(), nullable=True, index=True),
            sa.Column("year", sa.Integer(), nullable=True),
            sa.Column("month", sa.Integer(), nullable=True),
        ),
    )
    op.create_table(
        "gennis_student_test",
        *_common(
            sa.Column("student_gennis_id", sa.Integer(), nullable=True, index=True),
            sa.Column("group_test_gennis_id", sa.Integer(), nullable=True, index=True),
            sa.Column("group_gennis_id", sa.Integer(), nullable=True),
            sa.Column("subject_gennis_id", sa.Integer(), nullable=True),
            sa.Column("true_answers", sa.Integer(), nullable=True),
            sa.Column("percentage", sa.String(50), nullable=True),
            sa.Column("calendar_day_gennis_id", sa.Integer(), nullable=True),
            sa.Column("date", sa.Date(), nullable=True, index=True),
        ),
    )
    op.create_table(
        "gennis_test_applicant",
        *_common(
            sa.Column("name", sa.String(255), nullable=True),
            sa.Column("surname", sa.String(255), nullable=True),
            sa.Column("father_name", sa.String(255), nullable=True),
            sa.Column("phone", sa.String(50), nullable=True),
            sa.Column("school_id", sa.Integer(), nullable=True),
            sa.Column("defenation_id", sa.Integer(), nullable=True),
            sa.Column("unique_id", sa.String(100), nullable=True),
            sa.Column("location_id", sa.Integer(), nullable=True),
            sa.Column("language", sa.String(50), nullable=True),
        ),
    )

    # ── debtor ("black") students ─────────────────────────────────────────
    op.create_table(
        "gennis_black_student",
        *_common(
            sa.Column("student_gennis_id", sa.Integer(), nullable=True, index=True),
            sa.Column("user_gennis_id", sa.Integer(), nullable=True),
            sa.Column("location_id", sa.Integer(), nullable=True, index=True),
            sa.Column("comment", sa.Text(), nullable=True),
            sa.Column("deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("calendar_day_gennis_id", sa.Integer(), nullable=True),
            sa.Column("calendar_month_gennis_id", sa.Integer(), nullable=True),
            sa.Column("calendar_year_gennis_id", sa.Integer(), nullable=True),
            sa.Column("date", sa.Date(), nullable=True, index=True),
            sa.Column("year", sa.Integer(), nullable=True),
            sa.Column("month", sa.Integer(), nullable=True),
        ),
    )
    op.create_table(
        "gennis_black_student_stat",
        *_common(
            sa.Column("location_id", sa.Integer(), nullable=True, index=True),
            sa.Column("total_black_students", sa.Integer(), nullable=True),
            sa.Column("calendar_month_gennis_id", sa.Integer(), nullable=True),
            sa.Column("calendar_year_gennis_id", sa.Integer(), nullable=True),
            sa.Column("year", sa.Integer(), nullable=True),
            sa.Column("month", sa.Integer(), nullable=True),
        ),
    )

    # ── daily per-branch rollup ───────────────────────────────────────────
    op.create_table(
        "gennis_branch_report",
        *_common(
            sa.Column("location_id", sa.Integer(), nullable=True, index=True),
            sa.Column("number_of_students", sa.Integer(), nullable=True),
            sa.Column("number_of_deleted_students", sa.Integer(), nullable=True),
            sa.Column("number_of_deleted_registrations", sa.Integer(), nullable=True),
            sa.Column("number_of_teachers", sa.Integer(), nullable=True),
            sa.Column("number_of_staff", sa.Integer(), nullable=True),
            sa.Column("number_of_groups", sa.Integer(), nullable=True),
            sa.Column("number_of_deleted_groups", sa.Integer(), nullable=True),
            sa.Column("number_of_payments", sa.Integer(), nullable=True),
            sa.Column("sum_of_payments", sa.BigInteger(), nullable=True),
            sa.Column("calendar_day_gennis_id", sa.Integer(), nullable=True),
            sa.Column("calendar_month_gennis_id", sa.Integer(), nullable=True),
            sa.Column("calendar_year_gennis_id", sa.Integer(), nullable=True),
            sa.Column("date", sa.Date(), nullable=True, index=True),
            sa.Column("year", sa.Integer(), nullable=True),
            sa.Column("month", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
        ),
    )

    # ── reversed payments ─────────────────────────────────────────────────
    op.create_table(
        "gennis_deleted_student_payment",
        *_common(
            sa.Column("student_gennis_id", sa.Integer(), nullable=True, index=True),
            sa.Column("location_id", sa.Integer(), nullable=True, index=True),
            sa.Column("payment_sum", sa.BigInteger(), nullable=True),
            sa.Column("payment_type_id", sa.Integer(), nullable=True),
            sa.Column("account_period_id", sa.Integer(), nullable=True),
            sa.Column("payment", sa.Boolean(), nullable=True),
            sa.Column("deleted_date", sa.DateTime(), nullable=True),
            sa.Column("reason", sa.Text(), nullable=True),
            sa.Column("calendar_day_gennis_id", sa.Integer(), nullable=True),
            sa.Column("calendar_month_gennis_id", sa.Integer(), nullable=True),
            sa.Column("calendar_year_gennis_id", sa.Integer(), nullable=True),
            sa.Column("date", sa.Date(), nullable=True, index=True),
            sa.Column("year", sa.Integer(), nullable=True),
            sa.Column("month", sa.Integer(), nullable=True),
        ),
    )

    # ── contracts ─────────────────────────────────────────────────────────
    op.create_table(
        "gennis_contract_student",
        *_common(
            sa.Column("student_gennis_id", sa.Integer(), nullable=True, index=True),
            sa.Column("created_date", sa.DateTime(), nullable=True),
            sa.Column("expire_date", sa.DateTime(), nullable=True),
            sa.Column("given_place", sa.String(255), nullable=True),
            sa.Column("given_time", sa.String(100), nullable=True),
            sa.Column("place", sa.String(255), nullable=True),
            sa.Column("father_name", sa.String(255), nullable=True),
            sa.Column("passport_series", sa.String(50), nullable=True),
        ),
    )
    op.create_table(
        "gennis_contract_counter",
        *_common(
            sa.Column("year", sa.DateTime(), nullable=True),
            sa.Column("number", sa.Integer(), nullable=True),
            sa.Column("location_id", sa.Integer(), nullable=True),
        ),
    )

    # ── call logs against a student ───────────────────────────────────────
    op.create_table(
        "gennis_student_calling_info",
        *_common(
            sa.Column("student_gennis_id", sa.Integer(), nullable=True, index=True),
            sa.Column("comment", sa.Text(), nullable=True),
            sa.Column("day", sa.DateTime(), nullable=True),
            sa.Column("date", sa.DateTime(), nullable=True),
            sa.Column("audio_url", sa.String(500), nullable=True),
        ),
    )
    op.create_table(
        "gennis_student_calling_info_audio",
        *_common(
            sa.Column("calling_info_gennis_id", sa.Integer(), nullable=True, index=True),
            sa.Column("audio_url", sa.String(500), nullable=True),
            sa.Column("client_number", sa.String(100), nullable=True),
            sa.Column("diversion", sa.String(100), nullable=True),
            sa.Column("duration", sa.String(50), nullable=True),
            sa.Column("start_time", sa.DateTime(), nullable=True),
            sa.Column("end_time", sa.DateTime(), nullable=True),
            sa.Column("wait_time", sa.String(50), nullable=True),
            sa.Column("comment", sa.Text(), nullable=True),
            sa.Column("calendar_day_gennis_id", sa.Integer(), nullable=True),
            sa.Column("date", sa.Date(), nullable=True),
        ),
    )

    # ── old task notifications ────────────────────────────────────────────
    # Mirrored rather than loaded into the live `notification` table. Old
    # mission ids run 11..50 while v2's mission table holds {4,5,7,8,15}: only
    # 15 collides, and it is a different mission, so raw ids would attach old
    # notifications to unrelated v2 tasks. Nulling mission_id instead would
    # still push 15 unread "you have been assigned a task" messages at real
    # users for tasks that do not exist in v2. Both old and resolved user ids
    # are kept so the archive stays joinable either way.
    op.create_table(
        "gennis_notification",
        *_common(
            sa.Column("user_gennis_id", sa.Integer(), nullable=True, index=True),
            sa.Column("management_user_id", sa.BigInteger(), nullable=True),
            sa.Column("mission_gennis_id", sa.Integer(), nullable=True),
            sa.Column("message", sa.Text(), nullable=True),
            sa.Column("role", sa.String(50), nullable=True),
            sa.Column("deadline", sa.Date(), nullable=True),
            sa.Column("is_read", sa.Boolean(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        ),
    )

    # gennis_id is the re-run key for every sync into these tables, so it has
    # to be unique before the first ON CONFLICT (gennis_id) DO NOTHING lands.
    for table in TABLES:
        op.create_unique_constraint(f"uq_{table}_gennis_id", table, ["gennis_id"])


def downgrade() -> None:
    for table in reversed(TABLES):
        op.drop_table(table)
