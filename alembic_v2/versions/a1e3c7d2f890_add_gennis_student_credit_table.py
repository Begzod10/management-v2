"""add gennis_student_credit table

Revision ID: a1e3c7d2f890
Revises: 59cfa0718ffa
Create Date: 2026-06-20 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a1e3c7d2f890'
down_revision: Union[str, Sequence[str], None] = '59cfa0718ffa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'gennis_student_credit',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('balance', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('student_id', name='uq_student_credit_student_id'),
    )
    op.create_index('ix_gsc_student', 'gennis_student_credit', ['student_id'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_gsc_student', table_name='gennis_student_credit')
    op.drop_table('gennis_student_credit')
