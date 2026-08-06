"""add turon_branch_transaction_v2 table

Revision ID: k2l3m4n5o6p7
Revises: j1k2l3m4n5o6
Create Date: 2026-08-06 19:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'k2l3m4n5o6p7'
down_revision: Union[str, None] = 'j1k2l3m4n5o6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'turon_branch_transaction_v2',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('amount', sa.BigInteger(), nullable=False),
        sa.Column('is_give', sa.Boolean(), nullable=False),
        sa.Column('reason', sa.String(500), nullable=True),
        sa.Column('person_id', sa.Integer(), nullable=True),
        sa.Column('person_name', sa.String(200), nullable=True),
        sa.Column('person_surname', sa.String(200), nullable=True),
        sa.Column('person_phone', sa.String(50), nullable=True),
        sa.Column('payment_type_id', sa.Integer(), sa.ForeignKey('payment_type.id'), nullable=True),
        sa.Column('branch_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('loan_id', sa.BigInteger(), sa.ForeignKey('turon_branch_loan_v2.id'), nullable=True),
        sa.Column('created_by_id', sa.BigInteger(), sa.ForeignKey('user.id'), nullable=True),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
    )
    op.create_index(
        'ix_turon_branch_transaction_branch_date',
        'turon_branch_transaction_v2',
        ['branch_id', 'date'],
    )
    op.create_index(
        'ix_turon_branch_transaction_loan_id',
        'turon_branch_transaction_v2',
        ['loan_id'],
    )


def downgrade() -> None:
    op.drop_index('ix_turon_branch_transaction_loan_id', table_name='turon_branch_transaction_v2')
    op.drop_index('ix_turon_branch_transaction_branch_date', table_name='turon_branch_transaction_v2')
    op.drop_table('turon_branch_transaction_v2')
