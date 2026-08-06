"""add teacher_salary and assistent_salary to gennis_group

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-07-25 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd3e4f5a6b7c8'
down_revision: Union[str, None] = 'c2d3e4f5a6b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {c["name"] for c in inspector.get_columns("gennis_group")}

    if "teacher_salary" not in existing:
        op.add_column('gennis_group', sa.Column('teacher_salary', sa.Integer(), nullable=True))
    if "assistent_salary" not in existing:
        op.add_column('gennis_group', sa.Column('assistent_salary', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('gennis_group', 'assistent_salary')
    op.drop_column('gennis_group', 'teacher_salary')
