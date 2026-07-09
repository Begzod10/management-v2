"""add gennis_teacher_registration and gennis_assistant_registration tables

Revision ID: d8b2f4a91c73
Revises: c4a7e9f13d56
Create Date: 2026-07-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'd8b2f4a91c73'
down_revision: Union[str, Sequence[str], None] = 'c4a7e9f13d56'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'gennis_teacher_registration',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('surname', sa.String(length=255), nullable=False),
        sa.Column('father_name', sa.String(length=255), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=False),
        sa.Column('address', sa.String(length=500), nullable=True),
        sa.Column('birth_day', sa.Date(), nullable=True),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('username', sa.String(length=100), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('language_id', sa.Integer(), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('subjects', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('username', name='uq_gtr_username'),
    )
    op.create_index('ix_gtr_location', 'gennis_teacher_registration', ['location_id'])
    op.create_index('ix_gtr_phone', 'gennis_teacher_registration', ['phone'])

    op.create_table(
        'gennis_assistant_registration',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('surname', sa.String(length=255), nullable=False),
        sa.Column('father_name', sa.String(length=255), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=False),
        sa.Column('address', sa.String(length=500), nullable=True),
        sa.Column('birth_day', sa.Date(), nullable=True),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('username', sa.String(length=100), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('language_id', sa.Integer(), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('teacher_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('username', name='uq_gar_username'),
    )
    op.create_index('ix_gar_location', 'gennis_assistant_registration', ['location_id'])
    op.create_index('ix_gar_phone', 'gennis_assistant_registration', ['phone'])


def downgrade() -> None:
    op.drop_index('ix_gar_phone', table_name='gennis_assistant_registration')
    op.drop_index('ix_gar_location', table_name='gennis_assistant_registration')
    op.drop_table('gennis_assistant_registration')

    op.drop_index('ix_gtr_phone', table_name='gennis_teacher_registration')
    op.drop_index('ix_gtr_location', table_name='gennis_teacher_registration')
    op.drop_table('gennis_teacher_registration')
