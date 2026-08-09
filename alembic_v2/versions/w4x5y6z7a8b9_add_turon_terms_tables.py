"""add turon_term_v2, turon_test_v2 and turon_assignment_v2

Revision ID: w4x5y6z7a8b9
Revises: v3w4x5y6z7a8
Create Date: 2026-08-09 00:00:00.000000

Ports the old turon Django `terms` app (terms.Term, terms.Test,
terms.Assignment) — quarter (chorak) grading.

Term: one row per (academic_year, quarter) — Django computed `quarter` and
`academic_year` from `start_date` in Model.save() rather than storing them
independently; kept as plain columns here, computed in the FastAPI layer the
same way, so a UNIQUE(academic_year, quarter) can actually be enforced (the
old DB has no such constraint at all).

Test: a graded assessment. Always belongs to a subject and a term, and to
*either* a group or a flow (old turon's serializer required this in Python,
never in the DB — added as a CHECK here since 0 rows violate it). Also
carries class_number for old code's reporting queries, kept nullable and
best-effort like turon_lesson_plan_v2's flow_id.

Assignment: one student's percentage on one test. Django had no DB-level
uniqueness — AssignmentCreateView.post() did `update_or_create(test, student)`
in application code — so duplicates were only ever accidental, never
intended; UNIQUE(test_id, student_user_id) here makes the same upsert
idempotent at the DB level too.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'w4x5y6z7a8b9'
down_revision: Union[str, None] = 'v3w4x5y6z7a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'turon_term_v2',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('quarter', sa.SmallInteger(), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=False),
        # e.g. "2025-2026" — derived from start_date, same as old turon.
        sa.Column('academic_year', sa.String(9), nullable=False),
        # terms_term.id in the old turon DB, set only by sync scripts.
        sa.Column('old_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),

        sa.CheckConstraint('quarter >= 1 AND quarter <= 4', name='ck_turon_term_quarter_range'),
        sa.UniqueConstraint('academic_year', 'quarter', name='uq_turon_term_year_quarter'),
        sa.UniqueConstraint('old_id', name='uq_turon_term_old_id'),
    )
    op.create_index('ix_turon_term_academic_year', 'turon_term_v2', ['academic_year'])

    op.create_table(
        'turon_test_v2',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('weight', sa.Integer(), nullable=False),
        sa.Column(
            'term_id', sa.BigInteger(),
            sa.ForeignKey('turon_term_v2.id', ondelete='CASCADE'), nullable=False,
        ),
        sa.Column('date', sa.Date(), nullable=False, server_default=sa.text('CURRENT_DATE')),
        sa.Column(
            'subject_id', sa.BigInteger(),
            sa.ForeignKey('turon_subject_v2.id'), nullable=False,
        ),
        sa.Column(
            'group_id', sa.BigInteger(),
            sa.ForeignKey('turon_group_v2.id', ondelete='SET NULL'), nullable=True,
        ),
        sa.Column(
            'flow_id', sa.BigInteger(),
            sa.ForeignKey('turon_flow_v2.id', ondelete='SET NULL'), nullable=True,
        ),
        sa.Column(
            'class_number_id', sa.BigInteger(),
            sa.ForeignKey('turon_class_number_v2.id', ondelete='SET NULL'), nullable=True,
        ),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default='false'),
        # terms_test.id in the old turon DB, set only by sync scripts.
        sa.Column('old_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),

        sa.CheckConstraint(
            'group_id IS NOT NULL OR flow_id IS NOT NULL',
            name='ck_turon_test_group_or_flow',
        ),
        sa.UniqueConstraint('old_id', name='uq_turon_test_old_id'),
    )
    op.create_index('ix_turon_test_term_id', 'turon_test_v2', ['term_id'])
    op.create_index('ix_turon_test_group_id', 'turon_test_v2', ['group_id'])
    op.create_index('ix_turon_test_flow_id', 'turon_test_v2', ['flow_id'])
    op.create_index(
        'ix_turon_test_undeleted', 'turon_test_v2', ['term_id'],
        postgresql_where=sa.text('deleted = false'),
    )

    op.create_table(
        'turon_assignment_v2',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            'test_id', sa.BigInteger(),
            sa.ForeignKey('turon_test_v2.id', ondelete='CASCADE'), nullable=False,
        ),
        # A student-role account in the shared `user` table, same convention
        # as turon_group_student_v2.student_user_id.
        sa.Column('student_user_id', sa.BigInteger(), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('percentage', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False, server_default=sa.text('CURRENT_DATE')),
        # terms_assignment.id in the old turon DB, set only by sync scripts.
        sa.Column('old_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),

        sa.UniqueConstraint('test_id', 'student_user_id', name='uq_turon_assignment_test_student'),
        sa.UniqueConstraint('old_id', name='uq_turon_assignment_old_id'),
    )
    op.create_index('ix_turon_assignment_student', 'turon_assignment_v2', ['student_user_id'])


def downgrade() -> None:
    op.drop_index('ix_turon_assignment_student', table_name='turon_assignment_v2')
    op.drop_table('turon_assignment_v2')

    op.drop_index('ix_turon_test_undeleted', table_name='turon_test_v2')
    op.drop_index('ix_turon_test_flow_id', table_name='turon_test_v2')
    op.drop_index('ix_turon_test_group_id', table_name='turon_test_v2')
    op.drop_index('ix_turon_test_term_id', table_name='turon_test_v2')
    op.drop_table('turon_test_v2')

    op.drop_index('ix_turon_term_academic_year', table_name='turon_term_v2')
    op.drop_table('turon_term_v2')
