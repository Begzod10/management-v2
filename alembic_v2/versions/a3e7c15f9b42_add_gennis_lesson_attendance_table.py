"""add gennis_lesson_attendance table (renamed from gennis_attendance); merge heads

Revision ID: a3e7c15f9b42
Revises: f4c8a2e6b910, a2b3c4d5e6f7, f9a0b1c2d345
Create Date: 2026-07-14 00:00:00.000000

The per-lesson attendance table was originally meant to be named
gennis_attendance (see the old d7f3a1b2c894 migration), but that name
collided with the wave2-synced teacher ball_percentage statistics table
(b1c2d3e4f5a6 / sync_wave2_tables.py) — both were added in parallel
alembic_v2 branches. Only the statistics table's CREATE TABLE ever
actually succeeded in production, so gennis_attendance today has the
stats shape (gennis_id, ball_percentage, ...), not the per-lesson shape
(came, note, lesson_date, ...). This migration creates the per-lesson
table under its own, non-colliding name.

Also merges three heads that had diverged: f4c8a2e6b910 (parent
registration chain, this branch's parent), a2b3c4d5e6f7 (call_record
table), and f9a0b1c2d345 (the wave2/gennis_attendance schema fix from
another branch — see f9a0b1c2d345_fix_gennis_attendance_wave2_schema.py,
which independently reconciled the exact same table-name collision by
dropping and recreating gennis_attendance as the stats table; this
migration doesn't touch gennis_attendance at all, so there's no
conflict with that fix).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a3e7c15f9b42'
down_revision: Union[str, Sequence[str], None] = ('f4c8a2e6b910', 'a2b3c4d5e6f7', 'f9a0b1c2d345')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'gennis_lesson_attendance',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('lesson_date', sa.Date(), nullable=False),
        sa.Column('came', sa.Boolean(), nullable=False),
        sa.Column('note', sa.String(length=255), nullable=True),
        sa.Column('teacher_id', sa.BigInteger(), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('group_id', 'student_id', 'lesson_date', name='uq_gennis_lesson_attendance'),
    )
    op.create_index('ix_gla_group_date', 'gennis_lesson_attendance', ['group_id', 'lesson_date'])
    op.create_index('ix_gla_student', 'gennis_lesson_attendance', ['student_id'])
    op.create_index('ix_gla_location', 'gennis_lesson_attendance', ['location_id'])


def downgrade() -> None:
    op.drop_index('ix_gla_location', table_name='gennis_lesson_attendance')
    op.drop_index('ix_gla_student', table_name='gennis_lesson_attendance')
    op.drop_index('ix_gla_group_date', table_name='gennis_lesson_attendance')
    op.drop_table('gennis_lesson_attendance')
