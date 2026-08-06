"""add gennis_branch_transaction table

Revision ID: j1k2l3m4n5o6
Revises: i9d0e1f2g3h4
Create Date: 2026-08-06 18:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'j1k2l3m4n5o6'
down_revision: Union[str, None] = 'i9d0e1f2g3h4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'gennis_branch_transaction',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('amount', sa.BigInteger(), nullable=False),
        sa.Column('is_give', sa.Boolean(), nullable=False),
        sa.Column('reason', sa.String(500), nullable=True),
        sa.Column('person_id', sa.Integer(), nullable=True),
        sa.Column('person_name', sa.String(200), nullable=True),
        sa.Column('person_surname', sa.String(200), nullable=True),
        sa.Column('person_phone', sa.String(50), nullable=True),
        sa.Column('payment_type_id', sa.Integer(), sa.ForeignKey('payment_type.id'), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=False),
        sa.Column('calendar_day', sa.Integer(), nullable=False),
        sa.Column('calendar_month', sa.Integer(), nullable=False),
        sa.Column('calendar_year', sa.Integer(), nullable=False),
        sa.Column('created_by_id', sa.BigInteger(), sa.ForeignKey('user.id'), nullable=True),
        sa.Column('loan_id', sa.BigInteger(), sa.ForeignKey('branch_loan.id'), nullable=True),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
    )
    op.create_index(
        'ix_gennis_branch_transaction_location_period',
        'gennis_branch_transaction',
        ['location_id', 'calendar_year', 'calendar_month'],
    )


def downgrade() -> None:
    op.drop_index('ix_gennis_branch_transaction_location_period', table_name='gennis_branch_transaction')
    op.drop_table('gennis_branch_transaction')
