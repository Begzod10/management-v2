"""add attendance_days to gennis_group

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-07-25

"""
from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e4f5a6b7c8d9'
down_revision: Union[str, None] = 'd3e4f5a6b7c8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {c["name"] for c in inspector.get_columns("gennis_group")}

    if "attendance_days" not in existing:
        op.add_column('gennis_group', sa.Column('attendance_days', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('gennis_group', 'attendance_days')
