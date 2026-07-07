"""add gennis_student_registration table

Revision ID: c4a7e9f13d56
Revises: e1a4b5c6d789, b1c2d3e4f5a6
Create Date: 2026-07-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c4a7e9f13d56'
down_revision: Union[str, Sequence[str], None] = ('e1a4b5c6d789', 'b1c2d3e4f5a6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'gennis_student_registration',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('surname', sa.String(length=255), nullable=False),
        sa.Column('father_name', sa.String(length=255), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=False),
        sa.Column('parent_phone', sa.String(length=50), nullable=True),
        sa.Column('address', sa.String(length=500), nullable=True),
        sa.Column('birth_day', sa.Date(), nullable=True),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('username', sa.String(length=100), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('language_id', sa.Integer(), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('shift_id', sa.Integer(), nullable=True),
        sa.Column('shift_name', sa.String(length=100), nullable=True),
        sa.Column('subjects', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('username', name='uq_gsr_username'),
    )
    op.create_index('ix_gsr_location', 'gennis_student_registration', ['location_id'])
    op.create_index('ix_gsr_phone', 'gennis_student_registration', ['phone'])


def downgrade() -> None:
    op.drop_index('ix_gsr_phone', table_name='gennis_student_registration')
    op.drop_index('ix_gsr_location', table_name='gennis_student_registration')
    op.drop_table('gennis_student_registration')
