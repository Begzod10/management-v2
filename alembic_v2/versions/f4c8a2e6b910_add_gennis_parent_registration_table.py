"""add gennis_parent_registration table

Revision ID: f4c8a2e6b910
Revises: d8b2f4a91c73
Create Date: 2026-07-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'f4c8a2e6b910'
down_revision: Union[str, Sequence[str], None] = 'd8b2f4a91c73'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'gennis_parent_registration',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('surname', sa.String(length=255), nullable=False),
        sa.Column('phone', sa.String(length=50), nullable=False),
        sa.Column('address', sa.String(length=500), nullable=True),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('username', sa.String(length=100), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('username', name='uq_gpr_username'),
    )
    op.create_index('ix_gpr_phone', 'gennis_parent_registration', ['phone'])
    op.create_index('ix_gpr_student', 'gennis_parent_registration', ['student_id'])


def downgrade() -> None:
    op.drop_index('ix_gpr_student', table_name='gennis_parent_registration')
    op.drop_index('ix_gpr_phone', table_name='gennis_parent_registration')
    op.drop_table('gennis_parent_registration')
