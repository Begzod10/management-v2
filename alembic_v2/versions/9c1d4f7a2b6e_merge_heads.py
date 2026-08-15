"""merge heads (gennis_user.comment + attendance_days history)

Revision ID: 9c1d4f7a2b6e
Revises: 67adaafba713, b4e1c7a92f60
Create Date: 2026-08-15
"""
from alembic import op
import sqlalchemy as sa

revision = '9c1d4f7a2b6e'
down_revision = ('67adaafba713', 'b4e1c7a92f60')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
