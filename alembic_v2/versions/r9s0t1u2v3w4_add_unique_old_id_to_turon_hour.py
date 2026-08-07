"""add unique(old_id) to turon_hour_v2

Revision ID: r9s0t1u2v3w4
Revises: q8r9s0t1u2v3
Create Date: 2026-08-07 16:30:00.000000

Every other table the turon sync writes can upsert on old_id — rooms, flows,
lessons and both curriculum tables all have the constraint. turon_hour_v2 was
the one that didn't, so re-running the sync would have duplicated lesson slots
instead of updating them.
"""
from typing import Sequence, Union
from alembic import op

revision: str = 'r9s0t1u2v3w4'
down_revision: Union[str, None] = 'q8r9s0t1u2v3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint('uq_turon_hour_old_id', 'turon_hour_v2', ['old_id'])


def downgrade() -> None:
    op.drop_constraint('uq_turon_hour_old_id', 'turon_hour_v2', type_='unique')
