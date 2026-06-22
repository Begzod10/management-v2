"""add deleted column to gennis_student_payment

Revision ID: b3d1c9e4f021
Revises: a1e3c7d2f890
Create Date: 2026-06-22 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b3d1c9e4f021"
down_revision: Union[str, None] = "a1e3c7d2f890"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "gennis_student_payment",
        sa.Column("deleted", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("gennis_student_payment", "deleted")
