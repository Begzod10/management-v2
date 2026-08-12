"""link salary payments back to the salary row they were paid against

Revision ID: c6d7e8f9a0b1
Revises: b5c6d7e8f9a0
Create Date: 2026-08-12 15:20:00.000000

The three gennis_*_salary_payment tables record who was paid, how much and when,
but not WHICH monthly salary the payment settles. v2 therefore groups them by
teacher + calendar_month + calendar_year, and that is not how old gennis works:

    teachersalaries.salary_location_id  -> teachersalary.id
    staffsalaries.salary_id             -> staffsalary.id
    assistent_salaries.salary_location_id -> asistent_salary.id

(account/salary.py filters on exactly this: `TeacherSalaries.salary_location_id
== salary_id`.) The two disagree whenever a payment settles a month other than
the one it was made in, which is common — July's salary is usually paid during
August.

Nodirbek Sultonov's July 2026 row is the worked example. Old gennis lists four
payments against it — 32,000 on 07-23 plus 200,000, 500,000 and 200,000 during
August — totalling exactly the 932,000 it reports as taken. v2, grouping by
month, instead showed the 32,000 and an 8,400,000 payment that carries month 7
but settles salary row 2258, and dropped the three August-dated ones entirely.

That the id link is the real one is not a guess: for all 2,349 teacher salary
rows, taken_money equals the sum of the payments joined by salary_location_id,
with zero exceptions. Grouped by month it matches on only 101 of them.

161 of 17,312 teacher payments carry no link at all and keep NULL here; they
cannot be attributed to a month by any means the source offers.

Adding the column only makes the truth available — the read paths in
accounting/salary_payments.py and payment_history.py still group by month and
must be switched over separately for the UI to change.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c6d7e8f9a0b1'
down_revision: Union[str, None] = 'b5c6d7e8f9a0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = (
    "gennis_teacher_salary_payment",
    "gennis_staff_salary_payment",
    "gennis_assistent_salary_payment",
)


def upgrade() -> None:
    for table in TABLES:
        op.add_column(table, sa.Column("salary_gennis_id", sa.Integer(), nullable=True))
        op.create_index(f"ix_{table}_salary_gennis_id", table, ["salary_gennis_id"])


def downgrade() -> None:
    for table in TABLES:
        op.drop_index(f"ix_{table}_salary_gennis_id", table_name=table)
        op.drop_column(table, "salary_gennis_id")
