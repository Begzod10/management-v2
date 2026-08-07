"""add turon_capital_category_v2 and turon_student_charity_v2 tables

Revision ID: l3m4n5o6p7q8
Revises: k2l3m4n5o6p7
Create Date: 2026-08-07 13:00:00.000000

Backs the turon-v2 ports of Django's capital_capitalcategory and
students_studentcharity.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'l3m4n5o6p7q8'
down_revision: Union[str, None] = 'k2l3m4n5o6p7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'turon_capital_category_v2',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('id_number', sa.String(100), nullable=True),
        # Django stored an ImageField; v2 keeps only the resolved URL.
        sa.Column('img_url', sa.String(500), nullable=True),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default='false'),
    )

    op.create_table(
        'turon_student_charity_v2',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=True),
        sa.Column('branch_id', sa.Integer(), nullable=True),
        sa.Column('charity_sum', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('name', sa.String(200), nullable=True),
        sa.Column('added_date', sa.Date(), nullable=False),
        sa.Column('created_by_id', sa.BigInteger(), sa.ForeignKey('user.id'), nullable=True),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
    )
    op.create_index(
        'ix_turon_student_charity_student_id',
        'turon_student_charity_v2',
        ['student_id'],
    )
    op.create_index(
        'ix_turon_student_charity_branch_date',
        'turon_student_charity_v2',
        ['branch_id', 'added_date'],
    )

    # turon_capital_v2.category_id already exists but was never constrained.
    op.create_foreign_key(
        'fk_turon_capital_category',
        'turon_capital_v2',
        'turon_capital_category_v2',
        ['category_id'],
        ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_turon_capital_category', 'turon_capital_v2', type_='foreignkey')
    op.drop_index('ix_turon_student_charity_branch_date', table_name='turon_student_charity_v2')
    op.drop_index('ix_turon_student_charity_student_id', table_name='turon_student_charity_v2')
    op.drop_table('turon_student_charity_v2')
    op.drop_table('turon_capital_category_v2')
