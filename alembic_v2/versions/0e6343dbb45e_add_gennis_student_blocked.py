"""add gennis_student.blocked

Old Gennis has a matching feature: an admin can put a severely non-paying
debtor on a blacklist (student.debtor = 4), after which the teacher-facing
mark-attendance endpoint refuses to record any more attendance for them
until unblocked (backend/teacher/teacher.py's make_attendance,
backend/tasks/admin/debts.py's /add_blacklist). gennis-v2 had no equivalent
at all — this column is the V2 side of that same feature.

Revision ID: 0e6343dbb45e
Revises: e4f5a6b7c8d9, b1c2d3e4f6a7, h8c9d0e1f2g3, e8f9a0b1c2d3, cd34ef56gh78, c19d6e4a7f83
Create Date: 2026-08-13
"""
from alembic import op
import sqlalchemy as sa

revision = '0e6343dbb45e'
down_revision = ('e4f5a6b7c8d9', 'b1c2d3e4f6a7', 'h8c9d0e1f2g3', 'e8f9a0b1c2d3', 'cd34ef56gh78', 'c19d6e4a7f83')
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'gennis_student',
        sa.Column('blocked', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade():
    op.drop_column('gennis_student', 'blocked')
