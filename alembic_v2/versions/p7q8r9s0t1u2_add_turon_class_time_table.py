"""add turon_class_time_table_v2 and turon_class_time_table_student_v2

Revision ID: p7q8r9s0t1u2
Revises: o6p7q8r9s0t1
Create Date: 2026-08-07 15:30:00.000000

The school timetable itself. Ports school_time_table.ClassTimeTable — 34,976
rows in production, with a 512,124-row students M2M.

A lesson hangs off either a group or a flow, never both and never neither;
that is enforced here as a CHECK constraint, which Django only maintained by
convention.

The indexes are shaped around the conflict engine, which asks three questions
on every write: is the room free, is the teacher free, is any student free —
each scoped to (date, hour).
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'p7q8r9s0t1u2'
down_revision: Union[str, None] = 'o6p7q8r9s0t1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'turon_class_time_table_v2',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(255), nullable=True),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('branch_id', sa.Integer(), nullable=False),
        sa.Column(
            'hours_id', sa.BigInteger(),
            sa.ForeignKey('turon_hour_v2.id'), nullable=False,
        ),
        sa.Column(
            'room_id', sa.BigInteger(),
            sa.ForeignKey('turon_room_v2.id'), nullable=True,
        ),
        sa.Column(
            'week_id', sa.Integer(),
            sa.ForeignKey('turon_week_day_v2.id'), nullable=True,
        ),
        sa.Column(
            'group_id', sa.BigInteger(),
            sa.ForeignKey('turon_group_v2.id', ondelete='CASCADE'), nullable=True,
        ),
        sa.Column(
            'flow_id', sa.BigInteger(),
            sa.ForeignKey('turon_flow_v2.id', ondelete='CASCADE'), nullable=True,
        ),
        sa.Column(
            'subject_id', sa.BigInteger(),
            sa.ForeignKey('turon_subject_v2.id', ondelete='SET NULL'), nullable=True,
        ),
        # A teacher-role account in the shared `user` table, same convention
        # as turon_group_v2.teacher_id and turon_flow_v2.teacher_id.
        sa.Column('teacher_id', sa.BigInteger(), sa.ForeignKey('user.id'), nullable=True),
        # Denormalised group-id list copied off the flow at lesson time.
        sa.Column('classes', sa.JSON(), nullable=True),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default='false'),
        # school_time_table_classtimetable.id in the old turon DB.
        sa.Column('old_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.CheckConstraint(
            '(group_id IS NULL) <> (flow_id IS NULL)',
            name='ck_turon_class_time_table_group_xor_flow',
        ),
        sa.UniqueConstraint('old_id', name='uq_turon_class_time_table_old_id'),
    )
    # Room-free and teacher-free checks, and the week-grid read.
    op.create_index(
        'ix_turon_ctt_date_hour_room',
        'turon_class_time_table_v2', ['date', 'hours_id', 'room_id'],
    )
    op.create_index(
        'ix_turon_ctt_date_hour_teacher',
        'turon_class_time_table_v2', ['date', 'hours_id', 'teacher_id'],
    )
    op.create_index(
        'ix_turon_ctt_branch_date',
        'turon_class_time_table_v2', ['branch_id', 'date'],
    )
    op.create_index('ix_turon_ctt_group_id', 'turon_class_time_table_v2', ['group_id'])
    op.create_index('ix_turon_ctt_flow_id', 'turon_class_time_table_v2', ['flow_id'])

    op.create_table(
        'turon_class_time_table_student_v2',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            'lesson_id', sa.BigInteger(),
            sa.ForeignKey('turon_class_time_table_v2.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column(
            'student_user_id', sa.BigInteger(),
            sa.ForeignKey('user.id'), nullable=False,
        ),
        sa.UniqueConstraint('lesson_id', 'student_user_id', name='uq_turon_ctt_student'),
    )
    # Drives the student-free check: given a student, which lessons do they
    # already have. Without this the conflict engine scans the 512k-row table.
    op.create_index(
        'ix_turon_ctt_student_user_id',
        'turon_class_time_table_student_v2', ['student_user_id'],
    )


def downgrade() -> None:
    op.drop_index('ix_turon_ctt_student_user_id', table_name='turon_class_time_table_student_v2')
    op.drop_table('turon_class_time_table_student_v2')
    for name in (
        'ix_turon_ctt_flow_id',
        'ix_turon_ctt_group_id',
        'ix_turon_ctt_branch_date',
        'ix_turon_ctt_date_hour_teacher',
        'ix_turon_ctt_date_hour_room',
    ):
        op.drop_index(name, table_name='turon_class_time_table_v2')
    op.drop_table('turon_class_time_table_v2')
