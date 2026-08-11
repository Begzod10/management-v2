"""widen gennis_lead.phone to 100

Revision ID: b9c0d1e2f3a4
Revises: a8b9c0d1e2f3
Create Date: 2026-08-11 12:05:00.000000

Old gennis puts no length limit on lead.phone and holds values up to 52
characters, so 14 leads could not sync into a varchar(50) column. Only one row
is actually over the limit, but psycopg2's execute_batch sends a batch as a
single statement — that one value failed the insert and the sync rolled the
whole table back, leaving all 14 behind.

Widening rather than truncating on the way in: this column mirrors an external
system whose own constraint is looser, and a silently shortened phone number is
worse than a long one. 100 leaves room before the next surprise.

Widening a varchar is a metadata-only change in Postgres — no table rewrite, no
lock held for the size of the data.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b9c0d1e2f3a4'
down_revision: Union[str, None] = 'a8b9c0d1e2f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "gennis_lead", "phone",
        existing_type=sa.String(50), type_=sa.String(100), existing_nullable=True,
    )


def downgrade() -> None:
    # Narrowing back fails if any synced row is now longer than 50, which is
    # the whole reason this migration exists. Truncate first so the downgrade
    # is at least runnable.
    op.execute("UPDATE gennis_lead SET phone = left(phone, 50) WHERE length(phone) > 50")
    op.alter_column(
        "gennis_lead", "phone",
        existing_type=sa.String(100), type_=sa.String(50), existing_nullable=True,
    )
