"""add turon_student_exam_result_v2

Revision ID: z7a8b9c0d1e2
Revises: y6z7a8b9c0d1
Create Date: 2026-08-12 00:00:00.000000

Ports students.StudentExamResult (`/api/Students/student-exam-results/`) —
a one-off exam score (Final/Midterm/Mock, teacher's choice of `title`),
distinct from the quarter-test grading in turon_test_v2/turon_assignment_v2:
no term, no weight — just a single score against a subject, group, teacher
and student at a point in time.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'z7a8b9c0d1e2'
down_revision: Union[str, None] = 'y6z7a8b9c0d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'turon_student_exam_result_v2',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        # "Final" / "Midterm" / "Mock" — free text, teacher's own label.
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column(
            'group_id', sa.BigInteger(),
            sa.ForeignKey('turon_group_v2.id', ondelete='CASCADE'), nullable=False,
        ),
        # Teacher and student are both shared `user` table accounts — same
        # convention as turon_flow_v2.teacher_id / turon_group_student_v2.student_user_id.
        sa.Column('teacher_id', sa.BigInteger(), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('student_user_id', sa.BigInteger(), sa.ForeignKey('user.id'), nullable=False),
        sa.Column(
            'subject_id', sa.BigInteger(),
            sa.ForeignKey('turon_subject_v2.id'), nullable=False,
        ),
        sa.Column('score', sa.Float(), nullable=False, server_default='0'),
        sa.Column('datetime', sa.DateTime(), nullable=False),
        # students_studentexamresult.id in the old turon DB, set only by sync scripts.
        sa.Column('old_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),

        sa.UniqueConstraint('old_id', name='uq_turon_student_exam_result_old_id'),
    )
    op.create_index('ix_turon_exam_result_student', 'turon_student_exam_result_v2', ['student_user_id'])
    op.create_index('ix_turon_exam_result_group', 'turon_student_exam_result_v2', ['group_id'])
    op.create_index('ix_turon_exam_result_teacher', 'turon_student_exam_result_v2', ['teacher_id'])
    op.create_index('ix_turon_exam_result_subject', 'turon_student_exam_result_v2', ['subject_id'])
    op.create_index('ix_turon_exam_result_datetime', 'turon_student_exam_result_v2', ['datetime'])


def downgrade() -> None:
    op.drop_index('ix_turon_exam_result_datetime', table_name='turon_student_exam_result_v2')
    op.drop_index('ix_turon_exam_result_subject', table_name='turon_student_exam_result_v2')
    op.drop_index('ix_turon_exam_result_teacher', table_name='turon_student_exam_result_v2')
    op.drop_index('ix_turon_exam_result_group', table_name='turon_student_exam_result_v2')
    op.drop_index('ix_turon_exam_result_student', table_name='turon_student_exam_result_v2')
    op.drop_table('turon_student_exam_result_v2')
