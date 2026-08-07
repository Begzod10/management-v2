"""add turon_week_day_v2 and turon_hour_v2

Revision ID: n5o6p7q8r9s0
Revises: m4n5o6p7q8r9
Create Date: 2026-08-07 14:30:00.000000

Timetable reference data. Ports time_table.WeekDays and school_time_table.Hours.

Week days are seeded here. Django re-ran a get_or_create on every read of
/week_days/ instead; the set is fixed, so a one-off seed is enough.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'n5o6p7q8r9s0'
down_revision: Union[str, None] = 'm4n5o6p7q8r9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


WEEK_DAYS = [
    ("Monday", "Dushanba", 1),
    ("Tuesday", "Seshanba", 2),
    ("Wednesday", "Chorshanba", 3),
    ("Thursday", "Payshanba", 4),
    ("Friday", "Juma", 5),
    ("Saturday", "Shanba", 6),
    ("Sunday", "Yakshanba", 7),
]


def upgrade() -> None:
    week_day = op.create_table(
        'turon_week_day_v2',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name_en', sa.String(20), nullable=False),
        sa.Column('name_uz', sa.String(20), nullable=False),
        sa.Column('order', sa.Integer(), nullable=False),
        sa.UniqueConstraint('name_en', name='uq_turon_week_day_name_en'),
        sa.UniqueConstraint('order', name='uq_turon_week_day_order'),
    )
    op.bulk_insert(week_day, [
        {"name_en": en, "name_uz": uz, "order": order}
        for en, uz, order in WEEK_DAYS
    ])

    op.create_table(
        'turon_hour_v2',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('branch_id', sa.Integer(), nullable=True),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default='false'),
        # school_time_table_hours.id in the old turon DB, for sync re-runs.
        sa.Column('old_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
    )
    op.create_index('ix_turon_hour_branch_order', 'turon_hour_v2', ['branch_id', 'order'])


def downgrade() -> None:
    op.drop_index('ix_turon_hour_branch_order', table_name='turon_hour_v2')
    op.drop_table('turon_hour_v2')
    op.drop_table('turon_week_day_v2')
