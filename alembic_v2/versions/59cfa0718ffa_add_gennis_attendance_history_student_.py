"""add gennis_attendance_history_student table

Revision ID: 59cfa0718ffa
Revises: f2953fd6dd12
Create Date: 2026-06-19 18:28:29.910827

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '59cfa0718ffa'
down_revision: Union[str, Sequence[str], None] = 'f2953fd6dd12'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'gennis_attendance_history_student',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('student_name', sa.String(length=511), nullable=True),
        sa.Column('group_id', sa.Integer(), nullable=True),
        sa.Column('group_name', sa.String(length=255), nullable=True),
        sa.Column('subject_id', sa.Integer(), nullable=True),
        sa.Column('total_debt', sa.Integer(), nullable=False),
        sa.Column('payment', sa.Integer(), nullable=False),
        sa.Column('remaining_debt', sa.Integer(), nullable=False),
        sa.Column('total_discount', sa.Integer(), nullable=False),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('calendar_month', sa.Integer(), nullable=False),
        sa.Column('calendar_year', sa.Integer(), nullable=False),
        sa.Column('status', sa.Boolean(), nullable=False),
        sa.Column('synced_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_gahs_location', 'gennis_attendance_history_student', ['location_id'])
    op.create_index('ix_gahs_student', 'gennis_attendance_history_student', ['student_id'])
    op.create_index('ix_gahs_calendar', 'gennis_attendance_history_student', ['calendar_year', 'calendar_month'])
    op.create_index('ix_gahs_remaining_debt', 'gennis_attendance_history_student', ['remaining_debt'])


def downgrade() -> None:
    op.drop_index('ix_gahs_remaining_debt', table_name='gennis_attendance_history_student')
    op.drop_index('ix_gahs_calendar', table_name='gennis_attendance_history_student')
    op.drop_index('ix_gahs_student', table_name='gennis_attendance_history_student')
    op.drop_index('ix_gahs_location', table_name='gennis_attendance_history_student')
    op.drop_table('gennis_attendance_history_student')
