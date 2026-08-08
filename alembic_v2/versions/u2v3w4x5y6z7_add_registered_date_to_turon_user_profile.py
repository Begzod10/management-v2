"""add registered_date to turon_user_profile_v2

Revision ID: u2v3w4x5y6z7
Revises: t1u2v3w4x5y6
Create Date: 2026-08-08 12:50:00.000000

The August class promotion has to skip students who registered in July or
August, because they were enrolled straight into the grade they are about to
start and promoting them would push them a year ahead. Django read that off
user_customuser.registered_date.

Nothing in v2 carried it. The port substituted
turon_student_profile_v2.created_at, which is when the row was synced into v2
rather than when the student registered — every one of the 1,480 profiles is
stamped 2026-08, so the rule matched everybody and the task would have
promoted nobody.

Source data is complete: all 1,808 rows in the old user_customuser have a
registered_date, spread across every month, with 534 in July/August.

Lives on turon_user_profile_v2 rather than the student profile because that
is where the rest of the ported user_customuser columns sit, and staff and
teachers have a registration date too.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'u2v3w4x5y6z7'
down_revision: Union[str, None] = 't1u2v3w4x5y6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable: rows created in v2 rather than synced from turon have no
    # registration date to carry over, and the promotion task treats unknown
    # as "do not promote" — the same thing Django's NULL comparison did.
    op.add_column(
        'turon_user_profile_v2',
        sa.Column('registered_date', sa.Date(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('turon_user_profile_v2', 'registered_date')
