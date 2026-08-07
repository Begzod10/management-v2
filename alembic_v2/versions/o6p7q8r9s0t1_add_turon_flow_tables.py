"""add turon_flow_v2 and turon_flow_student_v2

Revision ID: o6p7q8r9s0t1
Revises: n5o6p7q8r9s0
Create Date: 2026-08-07 15:00:00.000000

Ports Django's flows app. A flow ("patok") is a cross-class grouping: students
drawn from several classes meet as one lesson for a subject.

Load-bearing for the timetable: 18,744 of 34,976 ClassTimeTable rows (54%) hang
off a flow rather than a group, and the two are strictly exclusive.

Not ported: flows.FlowTypes — zero rows in production, and already commented
out of the Flow model itself.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'o6p7q8r9s0t1'
down_revision: Union[str, None] = 'n5o6p7q8r9s0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'turon_flow_v2',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('activity', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('branch_id', sa.Integer(), nullable=True),
        sa.Column(
            'subject_id', sa.BigInteger(),
            sa.ForeignKey('turon_subject_v2.id', ondelete='SET NULL'), nullable=True,
        ),
        # A teacher-role account in the shared `user` table — matching how
        # turon_group_v2.teacher_id already refers to teachers.
        sa.Column('teacher_id', sa.BigInteger(), sa.ForeignKey('user.id'), nullable=True),
        # subjects.SubjectLevel is not migrated yet (25 of 250 flows use it).
        # Plain int so the value round-trips until that model lands.
        sa.Column('level_id', sa.Integer(), nullable=True),
        # Derived cache: the distinct turon_group_v2 ids the flow's students
        # belong to. Django recomputed this on every write (flow_classes()).
        sa.Column('classes', sa.JSON(), nullable=True),
        sa.Column('order', sa.Integer(), nullable=True),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default='false'),
        # flows_flow.id in the old turon DB, for idempotent sync re-runs.
        sa.Column('old_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.UniqueConstraint('old_id', name='uq_turon_flow_old_id'),
    )
    op.create_index('ix_turon_flow_branch_id', 'turon_flow_v2', ['branch_id'])
    op.create_index('ix_turon_flow_teacher_id', 'turon_flow_v2', ['teacher_id'])

    op.create_table(
        'turon_flow_student_v2',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            'flow_id', sa.BigInteger(),
            sa.ForeignKey('turon_flow_v2.id', ondelete='CASCADE'),
            nullable=False,
        ),
        # A student-role account in the shared `user` table, matching
        # turon_group_student_v2.student_user_id.
        sa.Column(
            'student_user_id', sa.BigInteger(),
            sa.ForeignKey('user.id'), nullable=False,
        ),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.UniqueConstraint('flow_id', 'student_user_id', name='uq_turon_flow_student'),
    )
    op.create_index(
        'ix_turon_flow_student_user_id', 'turon_flow_student_v2', ['student_user_id']
    )


def downgrade() -> None:
    op.drop_index('ix_turon_flow_student_user_id', table_name='turon_flow_student_v2')
    op.drop_table('turon_flow_student_v2')
    op.drop_index('ix_turon_flow_teacher_id', table_name='turon_flow_v2')
    op.drop_index('ix_turon_flow_branch_id', table_name='turon_flow_v2')
    op.drop_table('turon_flow_v2')
