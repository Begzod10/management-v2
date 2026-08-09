"""add turon_group_rating_v2

Revision ID: y6z7a8b9c0d1
Revises: x5y6z7a8b9c0
Create Date: 2026-08-11 00:00:00.000000

Ports group.GroupRating — a teacher's per-lesson rating of their own class
(1-5 + a traffic-light color + a comment), read back both as a raw list
(`/group-ratings/`) and aggregated onto the group itself (`/with-ratings/`:
avg_rating, total_ratings, most recent color/comment/date, color breakdown).

rating and color are both nullable — Django's GroupRatingCreateSerializer
never required either despite the model calling them PositiveSmallIntegerField
/ CharField with `choices`; a handful of production rows have one set and not
the other. Enforced as a value-range CHECK rather than a NOT NULL.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'y6z7a8b9c0d1'
down_revision: Union[str, None] = 'x5y6z7a8b9c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'turon_group_rating_v2',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            'group_id', sa.BigInteger(),
            sa.ForeignKey('turon_group_v2.id', ondelete='CASCADE'), nullable=False,
        ),
        # A teacher-role account in the shared `user` table — same convention
        # as turon_flow_v2.teacher_id.
        sa.Column('teacher_id', sa.BigInteger(), sa.ForeignKey('user.id'), nullable=False),
        # Plain int, not FK — same convention as turon_group_v2.branch_id.
        sa.Column('branch_id', sa.Integer(), nullable=True),
        sa.Column('rating', sa.SmallInteger(), nullable=True),
        sa.Column('color', sa.String(20), nullable=True),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('date', sa.Date(), nullable=False),
        # group_grouprating.id in the old turon DB, set only by sync scripts.
        sa.Column('old_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),

        sa.CheckConstraint('rating IS NULL OR (rating >= 1 AND rating <= 5)', name='ck_turon_group_rating_range'),
        sa.CheckConstraint(
            "color IS NULL OR color IN ('red','orange','yellow','green','blue')",
            name='ck_turon_group_rating_color',
        ),
        sa.UniqueConstraint('old_id', name='uq_turon_group_rating_old_id'),
    )
    op.create_index('ix_turon_group_rating_group_date', 'turon_group_rating_v2', ['group_id', 'date'])
    op.create_index('ix_turon_group_rating_branch', 'turon_group_rating_v2', ['branch_id'])
    op.create_index('ix_turon_group_rating_teacher', 'turon_group_rating_v2', ['teacher_id'])


def downgrade() -> None:
    op.drop_index('ix_turon_group_rating_teacher', table_name='turon_group_rating_v2')
    op.drop_index('ix_turon_group_rating_branch', table_name='turon_group_rating_v2')
    op.drop_index('ix_turon_group_rating_group_date', table_name='turon_group_rating_v2')
    op.drop_table('turon_group_rating_v2')
