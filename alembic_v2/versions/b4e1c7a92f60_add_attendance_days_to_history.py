"""add per-month attendance columns to gennis_attendance_history_student

Old gennis' attendancehistorystudent carries the month's attendance alongside the
money — present_days, absent_days, average_ball, scored_days — and its student
account page shows them as Kegan kunlar / Kemagan kunlar / Kunlar. v2 mirrored only
the money columns, so that history could not be displayed at all.

Nullable: rows created by v2's own attendance marking before this migration have no
value to put here, and 0 would read as "attended nothing" rather than "not recorded".

Revision ID: b4e1c7a92f60
Revises: d7f2a9c4b183
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'b4e1c7a92f60'
down_revision: Union[str, Sequence[str], None] = 'd7f2a9c4b183'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('gennis_attendance_history_student',
                  sa.Column('present_days', sa.Integer(), nullable=True))
    op.add_column('gennis_attendance_history_student',
                  sa.Column('absent_days', sa.Integer(), nullable=True))
    op.add_column('gennis_attendance_history_student',
                  sa.Column('average_ball', sa.Integer(), nullable=True))
    op.add_column('gennis_attendance_history_student',
                  sa.Column('scored_days', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('gennis_attendance_history_student', 'scored_days')
    op.drop_column('gennis_attendance_history_student', 'average_ball')
    op.drop_column('gennis_attendance_history_student', 'absent_days')
    op.drop_column('gennis_attendance_history_student', 'present_days')
