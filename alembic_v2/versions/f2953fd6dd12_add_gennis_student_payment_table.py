"""add gennis_student_payment table

Revision ID: f2953fd6dd12
Revises:
Create Date: 2026-06-19 18:06:50.404150

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'f2953fd6dd12'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'gennis_student_payment',
        sa.Column('id', sa.BigInteger(), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=True),
        sa.Column('student_name', sa.String(length=511), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('payment_sum', sa.BigInteger(), nullable=False),
        sa.Column('channel', sa.String(length=100), nullable=True),
        sa.Column('is_real_payment', sa.Boolean(), nullable=False),
        sa.Column('paid_date', sa.Date(), nullable=True),
        sa.Column('calendar_month', sa.Integer(), nullable=True),
        sa.Column('calendar_year', sa.Integer(), nullable=True),
        sa.Column('synced_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_gsp_location_id', 'gennis_student_payment', ['location_id'])
    op.create_index('ix_gsp_paid_date', 'gennis_student_payment', ['paid_date'])
    op.create_index('ix_gsp_calendar', 'gennis_student_payment', ['calendar_year', 'calendar_month'])


def downgrade() -> None:
    op.drop_index('ix_gsp_calendar', table_name='gennis_student_payment')
    op.drop_index('ix_gsp_paid_date', table_name='gennis_student_payment')
    op.drop_index('ix_gsp_location_id', table_name='gennis_student_payment')
    op.drop_table('gennis_student_payment')
