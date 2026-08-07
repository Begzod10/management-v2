"""add the subject curriculum and lesson-tally tables

Revision ID: q8r9s0t1u2v3
Revises: p7q8r9s0t1u2
Create Date: 2026-08-07 16:00:00.000000

Ports group.GroupSubjects / GroupSubjectsCount and students.StudentSubject /
StudentSubjectCount.

Two layers:
  * curriculum — how many weekly hours a class (or one student) owes a subject
  * tally      — one row per lesson taught, so "hours done this week" is a
                 COUNT over a date range rather than a counter that drifts

Production sizes: 604 group subjects, 16,011 group tallies, 5,455 student
subjects, 332,768 student tallies.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'q8r9s0t1u2v3'
down_revision: Union[str, None] = 'p7q8r9s0t1u2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'turon_group_subject_hours_v2',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            'group_id', sa.BigInteger(),
            sa.ForeignKey('turon_group_v2.id', ondelete='CASCADE'), nullable=False,
        ),
        sa.Column(
            'subject_id', sa.BigInteger(),
            sa.ForeignKey('turon_subject_v2.id', ondelete='CASCADE'), nullable=False,
        ),
        # Weekly quota for this subject.
        sa.Column('hours', sa.Integer(), nullable=True),
        # Django cached the weekly tally here and rewrote it on delete. Kept so
        # the column round-trips, but the tally table below is authoritative.
        sa.Column('count', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('old_id', sa.Integer(), nullable=True),
        sa.UniqueConstraint('group_id', 'subject_id', name='uq_turon_group_subject_hours'),
        sa.UniqueConstraint('old_id', name='uq_turon_group_subject_hours_old_id'),
    )

    op.create_table(
        'turon_group_subject_tally_v2',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            'group_subject_id', sa.BigInteger(),
            sa.ForeignKey('turon_group_subject_hours_v2.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column(
            'lesson_id', sa.BigInteger(),
            sa.ForeignKey('turon_class_time_table_v2.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('date', sa.Date(), nullable=False),
        sa.UniqueConstraint(
            'group_subject_id', 'lesson_id', name='uq_turon_group_subject_tally'
        ),
    )
    op.create_index(
        'ix_turon_group_subject_tally_date',
        'turon_group_subject_tally_v2', ['group_subject_id', 'date'],
    )

    op.create_table(
        'turon_student_subject_hours_v2',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        # A student-role account in the shared `user` table.
        sa.Column(
            'student_user_id', sa.BigInteger(),
            sa.ForeignKey('user.id'), nullable=False,
        ),
        sa.Column(
            'subject_id', sa.BigInteger(),
            sa.ForeignKey('turon_subject_v2.id', ondelete='CASCADE'), nullable=False,
        ),
        sa.Column(
            'group_subject_id', sa.BigInteger(),
            sa.ForeignKey('turon_group_subject_hours_v2.id', ondelete='SET NULL'),
            nullable=True,
        ),
        sa.Column('hours', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('count', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('old_id', sa.Integer(), nullable=True),
        sa.UniqueConstraint(
            'student_user_id', 'subject_id', name='uq_turon_student_subject_hours'
        ),
        sa.UniqueConstraint('old_id', name='uq_turon_student_subject_hours_old_id'),
    )

    op.create_table(
        'turon_student_subject_tally_v2',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            'student_subject_id', sa.BigInteger(),
            sa.ForeignKey('turon_student_subject_hours_v2.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column(
            'lesson_id', sa.BigInteger(),
            sa.ForeignKey('turon_class_time_table_v2.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('date', sa.Date(), nullable=False),
        sa.UniqueConstraint(
            'student_subject_id', 'lesson_id', name='uq_turon_student_subject_tally'
        ),
    )
    op.create_index(
        'ix_turon_student_subject_tally_date',
        'turon_student_subject_tally_v2', ['student_subject_id', 'date'],
    )


def downgrade() -> None:
    op.drop_index(
        'ix_turon_student_subject_tally_date',
        table_name='turon_student_subject_tally_v2',
    )
    op.drop_table('turon_student_subject_tally_v2')
    op.drop_table('turon_student_subject_hours_v2')
    op.drop_index(
        'ix_turon_group_subject_tally_date',
        table_name='turon_group_subject_tally_v2',
    )
    op.drop_table('turon_group_subject_tally_v2')
    op.drop_table('turon_group_subject_hours_v2')
