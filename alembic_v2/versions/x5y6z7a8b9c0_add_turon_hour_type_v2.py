"""add turon_hour_type_v2 and turon_hour_hour_type_v2

Revision ID: x5y6z7a8b9c0
Revises: w4x5y6z7a8b9
Create Date: 2026-08-10 00:00:00.000000

Revives `school_time_table.HoursType` / `Hours.types` (M2M) — added in old
turon's migration 0005, then removed a week later in 0006, leaving
`hours-list-for-type/` (which filters `Hours.objects.filter(types__name=…)`)
querying a field that no longer exists. That view has 500'd on every call
in production ever since; this restores the schema it depends on so the
endpoint can actually work, rather than porting the 500.

Only two type names were ever referenced in code — 'high' and 'initial' —
seeded here so the grouped endpoint has something to group by immediately.
Further types are manageable through /timetable/hour-types/.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'x5y6z7a8b9c0'
down_revision: Union[str, None] = 'w4x5y6z7a8b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'turon_hour_type_v2',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(100), nullable=False),
        # school_time_table_hourstype.id in the old turon DB — only ever
        # populated for the 'high'/'initial' rows Django itself had, if a
        # sync script chooses to map them; NULL for anything created here.
        sa.Column('old_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),

        sa.UniqueConstraint('name', name='uq_turon_hour_type_name'),
        sa.UniqueConstraint('old_id', name='uq_turon_hour_type_old_id'),
    )

    op.create_table(
        'turon_hour_hour_type_v2',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            'hour_id', sa.BigInteger(),
            sa.ForeignKey('turon_hour_v2.id', ondelete='CASCADE'), nullable=False,
        ),
        sa.Column(
            'hour_type_id', sa.BigInteger(),
            sa.ForeignKey('turon_hour_type_v2.id', ondelete='CASCADE'), nullable=False,
        ),
        sa.UniqueConstraint('hour_id', 'hour_type_id', name='uq_turon_hour_hour_type'),
    )
    op.create_index('ix_turon_hour_hour_type_hour', 'turon_hour_hour_type_v2', ['hour_id'])
    op.create_index('ix_turon_hour_hour_type_type', 'turon_hour_hour_type_v2', ['hour_type_id'])

    hour_type_table = sa.table(
        'turon_hour_type_v2', sa.column('name', sa.String)
    )
    op.bulk_insert(hour_type_table, [{'name': 'high'}, {'name': 'initial'}])


def downgrade() -> None:
    op.drop_index('ix_turon_hour_hour_type_type', table_name='turon_hour_hour_type_v2')
    op.drop_index('ix_turon_hour_hour_type_hour', table_name='turon_hour_hour_type_v2')
    op.drop_table('turon_hour_hour_type_v2')
    op.drop_table('turon_hour_type_v2')
