"""add the account-payable columns the models and API already use

Revision ID: d7e8f9a0b1c2
Revises: c6d7e8f9a0b1
Create Date: 2026-08-12 16:20:00.000000

GET /accounting/accounts/{id} returned a 500 for every account:

    UndefinedColumnError: column gennis_account_payable.desc does not exist

The models and the API agree with each other and with old gennis — payable.py
reads p.desc and p.finished, and writes desc, type_account and the calendar
fields when creating a payable — but the tables were created without them. A
model declaring a column the table lacks fails at QUERY time, not at import, so
this stayed invisible until someone opened the page.

    gennis_account_payable          desc, type_account, finished, deleted_comment
    gennis_account_payable_history  type_account, calendar_day, calendar_month,
                                    calendar_year, deleted_reason

All correspond to real columns in old gennis's account_payable /
account_payable_history, so the surviving row can carry its actual values
(desc 'oylik', type_account 'payable') instead of NULL.

Added nullable even though the models mark calendar_month/_year NOT NULL: the
rows already in the table have no value to give them, and every ORM insert
supplies both. Tightening that is a separate migration once the data is filled.

The existing `done` and `payable_id` columns are left alone — `done` lives on
GennisAccount and is used by the same endpoint, and `payable_id` is a v2
addition with no old-gennis counterpart. Neither is the cause here.

A companion check, scripts/check_model_table_drift.py, compares all 89
management models against their tables; these two were the only ones broken.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd7e8f9a0b1c2'
down_revision: Union[str, None] = 'c6d7e8f9a0b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PAYABLE = [
    ("desc", sa.String(500)),
    ("type_account", sa.String(20)),
    ("finished", sa.Boolean()),
    ("deleted_comment", sa.String(500)),
]
HISTORY = [
    ("type_account", sa.String(20)),
    ("calendar_day", sa.Integer()),
    ("calendar_month", sa.Integer()),
    ("calendar_year", sa.Integer()),
    ("deleted_reason", sa.String(500)),
]


def upgrade() -> None:
    for col, type_ in PAYABLE:
        op.add_column("gennis_account_payable", sa.Column(col, type_, nullable=True))
    op.execute("UPDATE gennis_account_payable SET finished = false WHERE finished IS NULL")
    for col, type_ in HISTORY:
        op.add_column("gennis_account_payable_history", sa.Column(col, type_, nullable=True))


def downgrade() -> None:
    for col, _ in reversed(HISTORY):
        op.drop_column("gennis_account_payable_history", col)
    for col, _ in reversed(PAYABLE):
        op.drop_column("gennis_account_payable", col)
