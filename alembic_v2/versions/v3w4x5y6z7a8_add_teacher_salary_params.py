"""add teacher salary parameters and a unique month key

Revision ID: v3w4x5y6z7a8
Revises: u2v3w4x5y6z7
Create Date: 2026-08-08 13:20:00.000000

turon_teacher_profile_v2 was created without the salary fields — its
docstring says salary_type was left for a later migration step. This is that
step: the four values the monthly calculation needs, ported from the old
teachers_teacher table.

working_hours is an Integer here; Django declared it CharField and stored
'0', '20', '18' and NULL side by side. It is a weekly teaching norm (a
stavka): the common values 18/20/22 are hours per week, and 53 of ~85
teachers have it 0 or NULL, which in Django meant their salary silently
never recalculated.

The unique key on (teacher_id, month_date) is new. Django had no constraint
and instead swept up duplicates inside a GET handler — listing teachers
deleted salary rows. The table is empty today, so the constraint can go on
cleanly and the sweep is unnecessary.

teacher_id on turon_teacher_salary_v2 refers to `user`.id, the same
convention as turon_class_time_table_v2.teacher_id.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'v3w4x5y6z7a8'
down_revision: Union[str, None] = 'u2v3w4x5y6z7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'turon_teacher_profile_v2',
        sa.Column(
            'salary_type_id', sa.BigInteger(),
            sa.ForeignKey('turon_teacher_salary_type_v2.id', ondelete='SET NULL'),
            nullable=True,
        ),
    )
    # Weekly teaching norm. Nullable and 0 both mean "not on an hours-based
    # salary"; the calculation skips those teachers rather than dividing by
    # zero, which is what Django's `if int(working_hours) != 0` guard did.
    op.add_column(
        'turon_teacher_profile_v2',
        sa.Column('working_hours', sa.Integer(), nullable=True),
    )
    # Bonus on top of the computed base, as a percentage. 50 for almost every
    # teacher in the old data.
    op.add_column(
        'turon_teacher_profile_v2',
        sa.Column('salary_percentage', sa.Integer(), nullable=False, server_default='50'),
    )
    # Flat allowance for acting as a class teacher, added after the bonus.
    op.add_column(
        'turon_teacher_profile_v2',
        sa.Column('class_salary', sa.BigInteger(), nullable=False, server_default='0'),
    )

    # One salary row per teacher per month. Partial so a soft-deleted row does
    # not block recreating the month.
    op.create_index(
        'uq_turon_teacher_salary_month',
        'turon_teacher_salary_v2',
        ['teacher_id', 'month_date'],
        unique=True,
        postgresql_where=sa.text('deleted = false'),
    )


def downgrade() -> None:
    op.drop_index('uq_turon_teacher_salary_month', table_name='turon_teacher_salary_v2')
    op.drop_column('turon_teacher_profile_v2', 'class_salary')
    op.drop_column('turon_teacher_profile_v2', 'salary_percentage')
    op.drop_column('turon_teacher_profile_v2', 'working_hours')
    op.drop_column('turon_teacher_profile_v2', 'salary_type_id')
