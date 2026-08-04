"""add gennis_id to gennis_overhead and gennis_capital_expenditure

Revision ID: cd34ef56gh78
Revises: bc23de45ef56
Create Date: 2026-08-04 00:02:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'cd34ef56gh78'
down_revision = 'bc23de45ef56'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('gennis_overhead',
        sa.Column('gennis_id', sa.Integer(), nullable=True))
    op.create_index('uq_gennis_overhead_gennis_id', 'gennis_overhead', ['gennis_id'],
                    unique=True, postgresql_where=sa.text('gennis_id IS NOT NULL'))

    op.add_column('gennis_capital_expenditure',
        sa.Column('gennis_id', sa.Integer(), nullable=True))
    op.create_index('uq_gennis_capital_gennis_id', 'gennis_capital_expenditure', ['gennis_id'],
                    unique=True, postgresql_where=sa.text('gennis_id IS NOT NULL'))


def downgrade():
    op.drop_index('uq_gennis_capital_gennis_id',  table_name='gennis_capital_expenditure')
    op.drop_column('gennis_capital_expenditure', 'gennis_id')
    op.drop_index('uq_gennis_overhead_gennis_id', table_name='gennis_overhead')
    op.drop_column('gennis_overhead', 'gennis_id')
