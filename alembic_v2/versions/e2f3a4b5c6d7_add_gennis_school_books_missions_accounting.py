"""add gennis school, book flow, missions and accounting leftovers

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-08-11 14:00:00.000000

488 rows in three groups.

Referenced by data already migrated:
    school                 299   every one of the 1,359 test applicants already
                                 in gennis_test_applicant carries a school_id,
                                 pointing at 17 distinct schools; without this
                                 none of them resolves to a name
    book flow              127   v2 already holds the 162 book *payments* but
                                 not the orders behind them

Missions (27) and the accounting leftovers (35) complete the set.

Missions are mirrored, not loaded into the live `mission` table, despite that
table having gennis_executor_id/gennis_reviewer_id columns. Those exist because
management-v2 assigns *its own* missions to gennis or turon users — it also has
turon_executor_id — not to receive imported gennis missions. Loading these 11
would put old missions into real users' lists in v2. Three of them also have a
NULL creator_id, which is NOT NULL there, and old id 15 collides with an
existing v2 mission. Same reasoning as gennis_notification.

Old `capital` becomes gennis_capital_asset, not gennis_capital: an earlier
migration already took the index name uq_gennis_capital_gennis_id for
gennis_capital_expenditure, and Postgres keeps constraint names in the same
namespace as tables, so the natural name collides. The longer name is more
accurate anyway — this is the fixed-asset register (term, total_down_cost,
img), distinct from capital_expenditure (the spend) and capital_term (the
depreciation schedule).

Two columns are renamed because the source names are reserved words in SQL:
book.desc -> description, mission_subtasks.order -> sort_order.

Old gennis names several integer columns "_date" that are really calendarday
FKs — collected_book_payments.created_date and received_date among them
(verified: both resolve against calendarday). They keep the raw id in a
*_day_gennis_id column alongside the resolved date, the same as everywhere else
in these mirrors.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e2f3a4b5c6d7'
down_revision: Union[str, None] = 'd1e2f3a4b5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TABLES = (
    "gennis_school",
    "gennis_book",
    "gennis_book_order",
    "gennis_user_book",
    "gennis_collected_book_payment",
    "gennis_branch_payment",
    "gennis_mission",
    "gennis_mission_history",
    "gennis_mission_comment",
    "gennis_mission_proof",
    "gennis_mission_attachment",
    "gennis_mission_subtask",
    "gennis_management_investment",
    "gennis_management_dividend",
    "gennis_capital_asset",
    "gennis_main_overhead",
    "gennis_overhead_type_log_payment",
    "gennis_report",
    "gennis_report_member",
)


def _common(*cols):
    return (
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("gennis_id", sa.Integer(), nullable=False),
        *cols,
        sa.Column("synced_at", sa.DateTime(), server_default=sa.func.now()),
    )


# the calendar trio every dated mirror carries: raw ids plus resolved values
def _calendar():
    return (
        sa.Column("calendar_day_gennis_id", sa.Integer(), nullable=True),
        sa.Column("calendar_month_gennis_id", sa.Integer(), nullable=True),
        sa.Column("calendar_year_gennis_id", sa.Integer(), nullable=True),
        sa.Column("date", sa.Date(), nullable=True, index=True),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("month", sa.Integer(), nullable=True),
    )


def upgrade() -> None:
    # ── schools behind the test applicants ────────────────────────────────
    op.create_table(
        "gennis_school",
        *_common(
            sa.Column("name", sa.String(255), nullable=True),
            sa.Column("number", sa.Integer(), nullable=True),
        ),
    )

    # ── book flow ─────────────────────────────────────────────────────────
    op.create_table(
        "gennis_book",
        *_common(
            sa.Column("name", sa.String(255), nullable=True),
            # "desc" is reserved in SQL
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("img", sa.String(500), nullable=True),
            sa.Column("img2", sa.String(500), nullable=True),
            sa.Column("img3", sa.String(500), nullable=True),
            sa.Column("own_price", sa.BigInteger(), nullable=True),
            sa.Column("share_price", sa.BigInteger(), nullable=True),
            sa.Column("price", sa.BigInteger(), nullable=True),
        ),
    )
    op.create_table(
        "gennis_book_order",
        *_common(
            sa.Column("student_gennis_id", sa.Integer(), nullable=True, index=True),
            sa.Column("group_gennis_id", sa.Integer(), nullable=True),
            sa.Column("teacher_gennis_id", sa.Integer(), nullable=True),
            sa.Column("book_gennis_id", sa.Integer(), nullable=True, index=True),
            sa.Column("user_gennis_id", sa.Integer(), nullable=True),
            sa.Column("location_id", sa.Integer(), nullable=True, index=True),
            sa.Column("count", sa.Integer(), nullable=True),
            sa.Column("accounting_period_id", sa.Integer(), nullable=True),
            sa.Column("editor_confirm", sa.Boolean(), nullable=True),
            sa.Column("admin_confirm", sa.Boolean(), nullable=True),
            sa.Column("collected_payments_gennis_id", sa.Integer(), nullable=True),
            sa.Column("deleted", sa.Boolean(), nullable=True),
            sa.Column("reason", sa.Text(), nullable=True),
            sa.Column("calendar_day_gennis_id", sa.Integer(), nullable=True),
            sa.Column("date", sa.Date(), nullable=True, index=True),
        ),
    )
    op.create_table(
        "gennis_user_book",
        *_common(
            sa.Column("user_gennis_id", sa.Integer(), nullable=True, index=True),
            sa.Column("location_id", sa.Integer(), nullable=True),
            sa.Column("payment_sum", sa.BigInteger(), nullable=True),
            sa.Column("book_order_gennis_id", sa.Integer(), nullable=True),
            sa.Column("account_period_id", sa.Integer(), nullable=True),
            sa.Column("salary_location_id", sa.Integer(), nullable=True),
            sa.Column("salary_id", sa.Integer(), nullable=True),
            *_calendar(),
        ),
    )
    op.create_table(
        "gennis_collected_book_payment",
        *_common(
            sa.Column("debt", sa.BigInteger(), nullable=True),
            sa.Column("location_id", sa.Integer(), nullable=True, index=True),
            sa.Column("status", sa.Boolean(), nullable=True),
            sa.Column("account_period_id", sa.Integer(), nullable=True),
            sa.Column("payment_type_id", sa.Integer(), nullable=True),
            # both named "_date" in old gennis but holding calendarday ids
            sa.Column("created_day_gennis_id", sa.Integer(), nullable=True),
            sa.Column("received_day_gennis_id", sa.Integer(), nullable=True),
            sa.Column("created_date", sa.Date(), nullable=True),
            sa.Column("received_date", sa.Date(), nullable=True),
            sa.Column("calendar_month_gennis_id", sa.Integer(), nullable=True),
            sa.Column("calendar_year_gennis_id", sa.Integer(), nullable=True),
            sa.Column("year", sa.Integer(), nullable=True),
            sa.Column("month", sa.Integer(), nullable=True),
        ),
    )
    op.create_table(
        "gennis_branch_payment",
        *_common(
            sa.Column("location_id", sa.Integer(), nullable=True, index=True),
            sa.Column("payment_type_id", sa.Integer(), nullable=True),
            sa.Column("editor_balance_id", sa.Integer(), nullable=True),
            sa.Column("book_order_gennis_id", sa.Integer(), nullable=True),
            sa.Column("payment_sum", sa.BigInteger(), nullable=True),
            sa.Column("account_period_id", sa.Integer(), nullable=True),
            *_calendar(),
        ),
    )

    # ── missions ──────────────────────────────────────────────────────────
    op.create_table(
        "gennis_mission",
        *_common(
            sa.Column("title", sa.String(500), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("category", sa.String(100), nullable=True),
            sa.Column("creator_gennis_id", sa.Integer(), nullable=True),
            sa.Column("executor_gennis_id", sa.Integer(), nullable=True, index=True),
            sa.Column("reviewer_gennis_id", sa.Integer(), nullable=True),
            sa.Column("original_executor_gennis_id", sa.Integer(), nullable=True),
            sa.Column("redirected_by_gennis_id", sa.Integer(), nullable=True),
            sa.Column("is_redirected", sa.Boolean(), nullable=True),
            sa.Column("redirected_at", sa.DateTime(), nullable=True),
            sa.Column("location_id", sa.Integer(), nullable=True, index=True),
            sa.Column("start_datetime", sa.DateTime(), nullable=True),
            sa.Column("deadline_datetime", sa.DateTime(), nullable=True),
            sa.Column("finish_datetime", sa.DateTime(), nullable=True),
            sa.Column("status", sa.String(50), nullable=True),
            sa.Column("kpi_weight", sa.Integer(), nullable=True),
            sa.Column("penalty_per_day", sa.Integer(), nullable=True),
            sa.Column("early_bonus_per_day", sa.Integer(), nullable=True),
            sa.Column("max_bonus", sa.Integer(), nullable=True),
            sa.Column("max_penalty", sa.Integer(), nullable=True),
            sa.Column("delay_days", sa.Integer(), nullable=True),
            sa.Column("is_recurring", sa.Boolean(), nullable=True),
            sa.Column("recurring_type", sa.String(50), nullable=True),
            sa.Column("repeat_every", sa.Integer(), nullable=True),
            sa.Column("last_generated", sa.Date(), nullable=True),
            sa.Column("final_sc", sa.Integer(), nullable=True),
            sa.Column("management_id", sa.BigInteger(), nullable=True),
            sa.Column("creator_name", sa.String(255), nullable=True),
            sa.Column("reviewer_name", sa.String(255), nullable=True),
            sa.Column("deleted", sa.Boolean(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
        ),
    )
    op.create_table(
        "gennis_mission_history",
        *_common(
            sa.Column("mission_gennis_id", sa.Integer(), nullable=True, index=True),
            sa.Column("executor_gennis_id", sa.Integer(), nullable=True),
            sa.Column("reviewer_gennis_id", sa.Integer(), nullable=True),
            sa.Column("management_id", sa.BigInteger(), nullable=True),
            sa.Column("management_executor_id", sa.BigInteger(), nullable=True),
            sa.Column("management_executor_name", sa.String(255), nullable=True),
            sa.Column("management_reviewer_id", sa.BigInteger(), nullable=True),
            sa.Column("management_reviewer_name", sa.String(255), nullable=True),
            sa.Column("turon_executor_id", sa.BigInteger(), nullable=True),
            sa.Column("turon_executor_name", sa.String(255), nullable=True),
            sa.Column("turon_reviewer_id", sa.BigInteger(), nullable=True),
            sa.Column("turon_reviewer_name", sa.String(255), nullable=True),
            sa.Column("changed_by_name", sa.String(255), nullable=True),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        ),
    )
    op.create_table(
        "gennis_mission_comment",
        *_common(
            sa.Column("mission_gennis_id", sa.Integer(), nullable=True, index=True),
            sa.Column("user_gennis_id", sa.Integer(), nullable=True),
            sa.Column("text", sa.Text(), nullable=True),
            sa.Column("attachment_path", sa.String(500), nullable=True),
            sa.Column("management_id", sa.BigInteger(), nullable=True),
            sa.Column("creator_name", sa.String(255), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        ),
    )
    op.create_table(
        "gennis_mission_proof",
        *_common(
            sa.Column("mission_gennis_id", sa.Integer(), nullable=True, index=True),
            sa.Column("file_path", sa.String(500), nullable=True),
            sa.Column("comment", sa.Text(), nullable=True),
            sa.Column("management_id", sa.BigInteger(), nullable=True),
            sa.Column("creator_name", sa.String(255), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        ),
    )
    op.create_table(
        "gennis_mission_attachment",
        *_common(
            sa.Column("mission_gennis_id", sa.Integer(), nullable=True, index=True),
            sa.Column("file_path", sa.String(500), nullable=True),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column("management_id", sa.BigInteger(), nullable=True),
            sa.Column("creator_name", sa.String(255), nullable=True),
            sa.Column("uploaded_at", sa.DateTime(), nullable=True),
        ),
    )
    op.create_table(
        "gennis_mission_subtask",
        *_common(
            sa.Column("mission_gennis_id", sa.Integer(), nullable=True, index=True),
            sa.Column("title", sa.String(500), nullable=True),
            sa.Column("is_done", sa.Boolean(), nullable=True),
            # "order" is reserved in SQL
            sa.Column("sort_order", sa.Integer(), nullable=True),
            sa.Column("management_id", sa.BigInteger(), nullable=True),
            sa.Column("creator_name", sa.String(255), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        ),
    )

    # ── accounting leftovers ──────────────────────────────────────────────
    for table in ("gennis_management_investment", "gennis_management_dividend"):
        op.create_table(
            table,
            *_common(
                sa.Column("management_gennis_id", sa.Integer(), nullable=True),
                sa.Column("amount", sa.BigInteger(), nullable=True),
                sa.Column("date", sa.Date(), nullable=True, index=True),
                sa.Column("description", sa.Text(), nullable=True),
                sa.Column("payment_type", sa.String(100), nullable=True),
                sa.Column("location_id", sa.Integer(), nullable=True, index=True),
                sa.Column("deleted", sa.Boolean(), nullable=True),
            ),
        )
    op.create_table(
        "gennis_capital_asset",
        *_common(
            sa.Column("name", sa.String(255), nullable=True),
            sa.Column("number", sa.String(100), nullable=True),
            sa.Column("price", sa.BigInteger(), nullable=True),
            sa.Column("term", sa.Integer(), nullable=True),
            sa.Column("category_id", sa.Integer(), nullable=True),
            sa.Column("location_id", sa.Integer(), nullable=True, index=True),
            sa.Column("account_period_id", sa.Integer(), nullable=True),
            sa.Column("payment_type_id", sa.Integer(), nullable=True),
            sa.Column("total_down_cost", sa.BigInteger(), nullable=True),
            sa.Column("img", sa.String(500), nullable=True),
            sa.Column("deleted", sa.Boolean(), nullable=True),
            *_calendar(),
        ),
    )
    op.create_table(
        "gennis_main_overhead",
        *_common(
            sa.Column("amount_sum", sa.BigInteger(), nullable=True),
            sa.Column("payment_type_id", sa.Integer(), nullable=True),
            sa.Column("reason", sa.Text(), nullable=True),
            sa.Column("deleted", sa.Boolean(), nullable=True),
            sa.Column("deleted_comment", sa.Text(), nullable=True),
            *_calendar(),
        ),
    )
    op.create_table(
        "gennis_overhead_type_log_payment",
        *_common(
            sa.Column("overhead_type_log_gennis_id", sa.Integer(), nullable=True, index=True),
            sa.Column("overhead_gennis_id", sa.Integer(), nullable=True),
            sa.Column("payment_type_id", sa.Integer(), nullable=True),
            sa.Column("amount", sa.BigInteger(), nullable=True),
            sa.Column("paid_date", sa.DateTime(), nullable=True),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column("created_by_gennis_id", sa.Integer(), nullable=True),
            sa.Column("management_id", sa.Integer(), nullable=True),
            sa.Column("deleted", sa.Boolean(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        ),
    )
    op.create_table(
        "gennis_report",
        *_common(
            sa.Column("name", sa.String(255), nullable=True),
            sa.Column("category", sa.String(100), nullable=True),
            sa.Column("program_type", sa.String(100), nullable=True),
            sa.Column("text", sa.Text(), nullable=True),
        ),
    )
    op.create_table(
        "gennis_report_member",
        *_common(
            sa.Column("report_gennis_id", sa.Integer(), nullable=True, index=True),
            sa.Column("member_gennis_id", sa.Integer(), nullable=True),
            sa.Column("daily_message_count", sa.Integer(), nullable=True),
        ),
    )

    for table in TABLES:
        op.create_unique_constraint(f"uq_{table}_gennis_id", table, ["gennis_id"])


def downgrade() -> None:
    for table in reversed(TABLES):
        op.drop_table(table)
