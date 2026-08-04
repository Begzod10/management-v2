"""add gennis_attendance_history_teacher table

Revision ID: bc23de45ef56
Revises: ab12cd34ef56
Create Date: 2026-08-04 00:01:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'bc23de45ef56'
down_revision = 'ab12cd34ef56'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'gennis_attendance_history_teacher',
        sa.Column('id',               sa.BigInteger(), primary_key=True),
        sa.Column('teacher_id',       sa.Integer(),    nullable=True),
        sa.Column('teacher_name',     sa.String(511),  nullable=True),
        sa.Column('total_salary',     sa.Integer(),    nullable=False, server_default='0'),
        sa.Column('subject_id',       sa.Integer(),    nullable=True),
        sa.Column('group_id',         sa.Integer(),    nullable=True),
        sa.Column('taken_money',      sa.Integer(),    nullable=False, server_default='0'),
        sa.Column('remaining_salary', sa.Integer(),    nullable=False, server_default='0'),
        sa.Column('location_id',      sa.Integer(),    nullable=True),
        sa.Column('calendar_month',   sa.Integer(),    nullable=False),
        sa.Column('calendar_year',    sa.Integer(),    nullable=False),
        sa.Column('status',           sa.Boolean(),    nullable=False, server_default='false'),
        sa.Column('synced_at',        sa.DateTime(),   server_default=sa.text('now()')),
    )
    op.create_index('ix_gaht_location_year_month', 'gennis_attendance_history_teacher',
                    ['location_id', 'calendar_year', 'calendar_month'])
    op.create_index('ix_gaht_teacher_id', 'gennis_attendance_history_teacher', ['teacher_id'])


def downgrade():
    op.drop_index('ix_gaht_teacher_id',           table_name='gennis_attendance_history_teacher')
    op.drop_index('ix_gaht_location_year_month',  table_name='gennis_attendance_history_teacher')
    op.drop_table('gennis_attendance_history_teacher')
