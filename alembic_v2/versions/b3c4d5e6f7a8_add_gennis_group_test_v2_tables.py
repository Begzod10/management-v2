"""add gennis_group_test_v2 / gennis_student_test_v2 tables

Revision ID: b3c4d5e6f7a8
Revises: 9c1d4f7a2b6e
Create Date: 2026-08-17 15:00:00.000000

Old gennis had a group-test feature (group/test.py: create_test,
filter_test_group, submit_test_group, groups_by_test) — a teacher creates a
periodic test for a group, then enters each student's correct-answer count,
which is scored into a per-student percentage and rolled up into the test's
own average. That data was archived read-only as gennis_group_test /
gennis_student_test (migration a8b9c0d1e2f3) when old gennis was switched
off, keyed on old-gennis ids — but the feature itself, the ability to create
a *new* test and score it, was never rebuilt. Since old gennis is frozen,
v2 needs its own live tables to do that going forward; the "_v2" suffix
follows the existing turon_test_v2 naming for a native table superseding an
old one, distinct from the frozen archive pair above.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b3c4d5e6f7a8'
down_revision: Union[str, Sequence[str], None] = '9c1d4f7a2b6e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'gennis_group_test_v2',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('subject_id', sa.BigInteger(), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=True),
        sa.Column('level', sa.String(length=100), nullable=True),
        sa.Column('number_tests', sa.Integer(), nullable=False),
        sa.Column('percentage', sa.Float(), server_default='0', nullable=False),
        sa.Column('file_url', sa.String(length=500), nullable=True),
        sa.Column('test_date', sa.Date(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_ggtv2_group', 'gennis_group_test_v2', ['group_id'])
    op.create_index('ix_ggtv2_group_date', 'gennis_group_test_v2', ['group_id', 'test_date'])
    op.create_index('ix_ggtv2_location_date', 'gennis_group_test_v2', ['location_id', 'test_date'])

    op.create_table(
        'gennis_student_test_v2',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('group_test_id', sa.BigInteger(), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('true_answers', sa.Integer(), nullable=False),
        sa.Column('percentage', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['group_test_id'], ['gennis_group_test_v2.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('group_test_id', 'student_id', name='uq_student_test_v2_test_student'),
    )
    op.create_index('ix_gstv2_student', 'gennis_student_test_v2', ['student_id'])


def downgrade() -> None:
    op.drop_index('ix_gstv2_student', table_name='gennis_student_test_v2')
    op.drop_table('gennis_student_test_v2')
    op.drop_index('ix_ggtv2_location_date', table_name='gennis_group_test_v2')
    op.drop_index('ix_ggtv2_group_date', table_name='gennis_group_test_v2')
    op.drop_index('ix_ggtv2_group', table_name='gennis_group_test_v2')
    op.drop_table('gennis_group_test_v2')
