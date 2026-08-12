"""add gennis_lesson_discount — the per-lesson discount ledger from old gennis

Revision ID: a4b5c6d7e8f9
Revises: f3a4b5c6d7e8
Create Date: 2026-08-12 13:30:00.000000

Old gennis has no discount table. Discounts live as columns on attendancedays,
the per-lesson row, and gennis_lesson_attendance kept only the attendance facts
(came, note, who, when) — so the money side of every lesson was left behind:

    discount               bool, set on 154,251 of 573,115 rows
    discount_per_day       the amount, non-zero on 144,709 of those
    balance_per_day        what the lesson would have cost
    balance_with_discount  what it cost after the discount

The flag is a reliable superset of the amount: 9,542 rows are flagged with no
amount, and no row carries an amount without the flag. So the flag is what
selects rows into this table, and the 9,542 amount-less ones come with it
rather than being silently dropped — a discount recorded as zero is still a
decision someone made.

Both balances travel with the discount because a discount is meaningless
without the figure it applied to. `fine` and the salary-per-day columns stay
out: they are on the same source row but they are penalties and payroll, not
discounts, and each belongs with its own subject.

Keyed on the attendancedays id rather than on (group, student, date). That
matters here: gennis_lesson_attendance collapses 573,115 source rows into
466,094 distinct lessons, so a date-keyed discount table would silently lose
the duplicates' amounts. Every flagged source row keeps its own row here.

discount_per_day is signed — production holds values from -4,615 to 46,154 —
so nothing here assumes a discount is positive.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a4b5c6d7e8f9'
down_revision: Union[str, None] = 'f3a4b5c6d7e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "gennis_lesson_discount",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        # attendancedays.id — one row per discounted lesson-day
        sa.Column("gennis_id", sa.Integer(), nullable=False),
        sa.Column("student_gennis_id", sa.Integer(), nullable=True, index=True),
        sa.Column("group_gennis_id", sa.Integer(), nullable=True, index=True),
        sa.Column("teacher_gennis_id", sa.Integer(), nullable=True),
        sa.Column("location_id", sa.Integer(), nullable=True, index=True),
        # same expression gennis_lesson_attendance uses, so the two line up
        sa.Column("lesson_date", sa.Date(), nullable=True, index=True),
        sa.Column("calendar_day_gennis_id", sa.Integer(), nullable=True),
        # the flag is always true here; kept so the column's meaning survives
        sa.Column("has_discount", sa.Boolean(), nullable=True),
        # signed: production ranges -4,615 .. 46,154
        sa.Column("discount_amount", sa.Integer(), nullable=True),
        sa.Column("balance_per_day", sa.Integer(), nullable=True),
        sa.Column("balance_with_discount", sa.Integer(), nullable=True),
        sa.Column("synced_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_unique_constraint(
        "uq_gennis_lesson_discount_gennis_id", "gennis_lesson_discount", ["gennis_id"]
    )


def downgrade() -> None:
    op.drop_table("gennis_lesson_discount")
