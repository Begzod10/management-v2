"""add gennis_group_time table

Revision ID: e1a4b5c6d789
Revises: d7f3a1b2c894
Create Date: 2026-06-22 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'e1a4b5c6d789'
down_revision: Union[str, Sequence[str], None] = 'd7f3a1b2c894'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'gennis_group_time',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('day_of_week', sa.Integer(), nullable=False),
        sa.Column('start_time', sa.String(length=5), nullable=False),
        sa.Column('end_time', sa.String(length=5), nullable=True),
        sa.Column('room', sa.String(length=100), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('group_id', 'day_of_week', name='uq_group_time_day'),
    )
    op.create_index('ix_ggt_group', 'gennis_group_time', ['group_id'])


def downgrade() -> None:
    op.drop_index('ix_ggt_group', table_name='gennis_group_time')
    op.drop_table('gennis_group_time')
