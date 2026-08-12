"""add gennis_capital_asset_term and gennis_deleted_overhead_type_log

Revision ID: b5c6d7e8f9a0
Revises: a4b5c6d7e8f9
Create Date: 2026-08-12 14:00:00.000000

The last two tables where old gennis rows had nowhere to land. Both are
archives rather than inserts into the live v2 tables, and in both cases that
is the point.

gennis_capital_asset_term (9 rows)
----------------------------------
capital_term looks like it should sync straight into gennis_capital_term, and
the existing wave-3 plan tries to, filtered by a subquery against
capital_expenditure that matches nothing — so all 9 rows were dropped, under a
note claiming capital_id 7 did not exist. It does exist: it is a `capital` row
named "test".

The filter was wrong but it was protecting something real. The two capital_id
columns mean different things:

    old gennis   capital_term.capital_id       -> capital(id)
    v2           gennis_capital_term.capital_id -> gennis_capital_expenditure(id)

v2 generates straight-line depreciation terms for capital *expenditures*
(services/account_utils.py), while old gennis's rows are terms against the
`capital` register, which arrived here as gennis_capital_asset. Writing the old
rows into gennis_capital_term would silently attach them to whichever
expenditure happens to share the id — for capital_id 7, an unrelated item.

So they get their own table, pointing at gennis_capital_asset where they
belong. All 9 resolve to real months, 2024-07 through 2026-04.

gennis_deleted_overhead_type_log (17 rows)
------------------------------------------
overhead_type_log is a live v2 table: a Celery task pre-creates a row per
overhead type each month and the accounting UI pays them off. The wave-4 plan
filters on `deleted = false`, which leaves exactly 17 soft-deleted rows behind
— and it must, because adding them to that table would present cancelled
overhead as real unpaid expectations.

They land here instead, mirroring gennis_deleted_overhead, which already exists
for deleted overheads for the same reason.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b5c6d7e8f9a0'
down_revision: Union[str, None] = 'a4b5c6d7e8f9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "gennis_capital_asset_term",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        # capital_term.id
        sa.Column("gennis_id", sa.Integer(), nullable=False),
        # capital.id -> gennis_capital_asset.gennis_id, NOT capital_expenditure
        sa.Column("capital_asset_gennis_id", sa.Integer(), nullable=True, index=True),
        sa.Column("calendar_month_gennis_id", sa.Integer(), nullable=True),
        sa.Column("calendar_year_gennis_id", sa.Integer(), nullable=True),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("month", sa.Integer(), nullable=True),
        # signed: production holds -278 on every row
        sa.Column("down_cost", sa.Integer(), nullable=True),
        sa.Column("account_period_id", sa.Integer(), nullable=True),
        sa.Column("synced_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_unique_constraint(
        "uq_gennis_capital_asset_term_gennis_id", "gennis_capital_asset_term", ["gennis_id"]
    )

    op.create_table(
        "gennis_deleted_overhead_type_log",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        # overheadtypelog.id
        sa.Column("gennis_id", sa.Integer(), nullable=False),
        sa.Column("overhead_type_id", sa.Integer(), nullable=True, index=True),
        sa.Column("overhead_gennis_id", sa.Integer(), nullable=True),
        sa.Column("location_id", sa.Integer(), nullable=True, index=True),
        sa.Column("expected_amount", sa.BigInteger(), nullable=True),
        sa.Column("is_paid", sa.Boolean(), nullable=True),
        sa.Column("is_prepaid", sa.Boolean(), nullable=True),
        sa.Column("paid_date", sa.DateTime(), nullable=True),
        sa.Column("calendar_month_gennis_id", sa.Integer(), nullable=True),
        sa.Column("calendar_year_gennis_id", sa.Integer(), nullable=True),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("month", sa.Integer(), nullable=True),
        sa.Column("synced_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_unique_constraint(
        "uq_gennis_deleted_overhead_type_log_gennis_id",
        "gennis_deleted_overhead_type_log", ["gennis_id"],
    )


def downgrade() -> None:
    op.drop_table("gennis_deleted_overhead_type_log")
    op.drop_table("gennis_capital_asset_term")
