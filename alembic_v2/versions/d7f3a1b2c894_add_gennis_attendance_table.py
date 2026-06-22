"""add gennis_attendance table

Revision ID: d7f3a1b2c894
Revises: b3d1c9e4f021
Create Date: 2026-06-22 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'd7f3a1b2c894'
down_revision: Union[str, Sequence[str], None] = 'b3d1c9e4f021'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'gennis_attendance',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('lesson_date', sa.Date(), nullable=False),
        sa.Column('came', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('note', sa.String(length=255), nullable=True),
        sa.Column('teacher_id', sa.BigInteger(), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('group_id', 'student_id', 'lesson_date', name='uq_gennis_attendance'),
    )
    op.create_index('ix_ga_group_date', 'gennis_attendance', ['group_id', 'lesson_date'])
    op.create_index('ix_ga_student', 'gennis_attendance', ['student_id'])
    op.create_index('ix_ga_location', 'gennis_attendance', ['location_id'])


def downgrade() -> None:
    op.drop_index('ix_ga_location', table_name='gennis_attendance')
    op.drop_index('ix_ga_student', table_name='gennis_attendance')
    op.drop_index('ix_ga_group_date', table_name='gennis_attendance')
    op.drop_table('gennis_attendance')
