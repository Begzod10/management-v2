"""add turon_lesson_plan_v2

Revision ID: t1u2v3w4x5y6
Revises: s0t1u2v3w4x5
Create Date: 2026-08-08 12:10:00.000000

Ports lesson_plan.LessonPlan from the old turon Django DB — 27,246 rows.

Turon gets its own table rather than reusing the unprefixed `lesson_plan`
that gennis-v2 owns, because the two shapes genuinely differ: 10,233 of
turon's plans (38%) hang off a flow, and the gennis table has no flow_id at
all. The gennis table also keys on (group_id, year, month, day) with no
foreign key on group_id, so turon rows would sit in the same id space as
gennis groups, told apart by nothing.

Three things measured against production data rather than copied from Django:

  * Django declared UNIQUE (group, flow, teacher, date, class_time_table).
    Postgres treats NULLs as distinct, so on rows with a null flow or
    class_time_table it never fired: 27,246 rows collapse to 26,287 distinct
    keys, i.e. 959 duplicates the constraint was supposed to prevent.
  * class_time_table_id is all but unique already — 16,809 rows over 16,800
    distinct values. Those 9 duplicates are the every-60-seconds
    create_lesson_plans beat racing itself between workers. A partial unique
    index on lesson_id is the key that actually holds, and it makes the
    ported task idempotent for free.
  * Django allowed a plan with neither group nor flow, and 1,597 rows are
    like that (orphaned by on_delete=SET_NULL). So the CHECK here forbids
    *both* being set — which no row violates — rather than the strict XOR
    used on turon_class_time_table_v2, which would reject 8.6% of history.

teacher_id is NOT NULL: zero production rows lack one.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 't1u2v3w4x5y6'
down_revision: Union[str, None] = 's0t1u2v3w4x5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'turon_lesson_plan_v2',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            'group_id', sa.BigInteger(),
            sa.ForeignKey('turon_group_v2.id', ondelete='SET NULL'), nullable=True,
        ),
        sa.Column(
            'flow_id', sa.BigInteger(),
            sa.ForeignKey('turon_flow_v2.id', ondelete='SET NULL'), nullable=True,
        ),
        # A teacher-role account in the shared `user` table, same convention
        # as turon_class_time_table_v2.teacher_id.
        sa.Column('teacher_id', sa.BigInteger(), sa.ForeignKey('user.id'), nullable=False),
        # The lesson this plan is for. Named lesson_id to match the tally
        # tables; Django called the column class_time_table_id.
        sa.Column(
            'lesson_id', sa.BigInteger(),
            sa.ForeignKey('turon_class_time_table_v2.id', ondelete='CASCADE'),
            nullable=True,
        ),
        sa.Column('date', sa.Date(), nullable=False),

        # Teacher-authored content. Longest objective in production is 822
        # characters, but Django used TextField throughout and there is no
        # reason to impose a ceiling.
        sa.Column('objective', sa.Text(), nullable=True),
        sa.Column('main_lesson', sa.Text(), nullable=True),
        sa.Column('homework', sa.Text(), nullable=True),
        sa.Column('assessment', sa.Text(), nullable=True),
        sa.Column('activities', sa.Text(), nullable=True),
        sa.Column('resources', sa.Text(), nullable=True),

        # AI verdict. Production balls run 1..8 against a documented 1..10
        # scale, so the range is checked rather than assumed.
        sa.Column('ball', sa.SmallInteger(), nullable=True),
        sa.Column('conclusion', sa.Text(), nullable=True),

        sa.Column('deleted', sa.Boolean(), nullable=False, server_default='false'),
        # lesson_plan_lessonplan.id in the old turon DB, set only by sync scripts.
        sa.Column('old_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=True),

        sa.CheckConstraint(
            'NOT (group_id IS NOT NULL AND flow_id IS NOT NULL)',
            name='ck_turon_lesson_plan_group_or_flow',
        ),
        sa.CheckConstraint(
            'ball IS NULL OR (ball >= 1 AND ball <= 10)',
            name='ck_turon_lesson_plan_ball_range',
        ),
        sa.UniqueConstraint('old_id', name='uq_turon_lesson_plan_old_id'),
    )

    # One plan per lesson. Every plan the generator creates carries a lesson,
    # so this is the constraint that makes re-running it a no-op instead of a
    # duplicate — and it closes the race that produced the 9 duplicates in the
    # old data. Legacy rows without a lesson are excluded rather than blocked.
    op.create_index(
        'uq_turon_lesson_plan_lesson',
        'turon_lesson_plan_v2',
        ['lesson_id'],
        unique=True,
        postgresql_where=sa.text('lesson_id IS NOT NULL AND deleted = false'),
    )

    # "My plans this week" — the teacher-facing read.
    op.create_index(
        'ix_turon_lesson_plan_teacher_date',
        'turon_lesson_plan_v2',
        ['teacher_id', 'date'],
    )

    # The scoring queue: unscored plans inside a short date window. Only 2% of
    # rows ever get filled in, so keeping the index to unscored rows keeps it
    # small.
    op.create_index(
        'ix_turon_lesson_plan_unscored',
        'turon_lesson_plan_v2',
        ['date'],
        postgresql_where=sa.text('ball IS NULL AND deleted = false'),
    )


def downgrade() -> None:
    op.drop_index('ix_turon_lesson_plan_unscored', table_name='turon_lesson_plan_v2')
    op.drop_index('ix_turon_lesson_plan_teacher_date', table_name='turon_lesson_plan_v2')
    op.drop_index('uq_turon_lesson_plan_lesson', table_name='turon_lesson_plan_v2')
    op.drop_table('turon_lesson_plan_v2')
