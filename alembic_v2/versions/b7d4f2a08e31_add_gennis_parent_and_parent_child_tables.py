"""add gennis_parent and gennis_parent_child tables

Revision ID: b7d4f2a08e31
Revises: a3e7c15f9b42
Create Date: 2026-07-15 00:00:00.000000

New wave2-style sync mirrors for the old gennis system's parent/
parent_child tables (parent accounts and which students they're linked
to). Populated by sync_wave2_tables.py.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b7d4f2a08e31'
down_revision: Union[str, Sequence[str], None] = 'a3e7c15f9b42'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'gennis_parent',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('gennis_id', sa.Integer(), nullable=False),
        sa.Column('user_gennis_id', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=True),
        sa.Column('surname', sa.String(length=255), nullable=True),
        sa.Column('username', sa.String(length=100), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('deleted', sa.Boolean(), nullable=True, default=False),
        sa.Column('synced_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('gennis_id'),
    )
    op.create_index('ix_gennis_parent_id', 'gennis_parent', ['id'])

    op.create_table(
        'gennis_parent_child',
        sa.Column('parent_gennis_id', sa.Integer(), nullable=False),
        sa.Column('student_gennis_id', sa.Integer(), nullable=False),
        sa.UniqueConstraint('parent_gennis_id', 'student_gennis_id', name='uq_gpc_parent_student'),
    )
    op.create_index('ix_gpc_student', 'gennis_parent_child', ['student_gennis_id'])


def downgrade() -> None:
    op.drop_index('ix_gpc_student', table_name='gennis_parent_child')
    op.drop_table('gennis_parent_child')
    op.drop_index('ix_gennis_parent_id', table_name='gennis_parent')
    op.drop_table('gennis_parent')
