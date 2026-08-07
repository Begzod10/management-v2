"""widen turon_student_subject_hours_v2's unique key to include the group

Revision ID: s0t1u2v3w4x5
Revises: r9s0t1u2v3w4
Create Date: 2026-08-07 17:00:00.000000

The key was (student_user_id, subject_id), which assumed a student studies a
subject in exactly one place. The real data disagrees: 41 students take the
same subject in two different groups — each duplicate carries a distinct
group_subjects_id — so the sync aborted on the first one.

Django had no constraint here at all. (student, subject, group_subject) is the
tightest key the data actually supports: 0 duplicate triples, and 0 rows with
a null group_subjects_id, so the null-distinctness of unique constraints does
not weaken it in practice.
"""
from typing import Sequence, Union
from alembic import op

revision: str = 's0t1u2v3w4x5'
down_revision: Union[str, None] = 'r9s0t1u2v3w4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint(
        'uq_turon_student_subject_hours',
        'turon_student_subject_hours_v2',
        type_='unique',
    )
    op.create_unique_constraint(
        'uq_turon_student_subject_hours',
        'turon_student_subject_hours_v2',
        ['student_user_id', 'subject_id', 'group_subject_id'],
    )


def downgrade() -> None:
    op.drop_constraint(
        'uq_turon_student_subject_hours',
        'turon_student_subject_hours_v2',
        type_='unique',
    )
    op.create_unique_constraint(
        'uq_turon_student_subject_hours',
        'turon_student_subject_hours_v2',
        ['student_user_id', 'subject_id'],
    )
