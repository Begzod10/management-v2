"""add gennis_user.comment

Old gennis' users.comment holds a free-text staff note (e.g. left when a
new sign-up is registered) that gennis-v2's new-students page shows as
"Izoh" — the mirror table never carried this column, so every legacy
(already-synced) row showed a blank comment there regardless of what old
gennis actually had recorded. sync_wave2_tables.py's gennis_user sync now
copies it too; this migration only adds the column for that sync to land in.

Revision ID: 67adaafba713
Revises: 0e6343dbb45e
Create Date: 2026-08-15
"""
from alembic import op
import sqlalchemy as sa

revision = '67adaafba713'
down_revision = '0e6343dbb45e'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('gennis_user', sa.Column('comment', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('gennis_user', 'comment')
