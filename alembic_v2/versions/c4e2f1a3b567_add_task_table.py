"""add task table

Revision ID: c4e2f1a3b567
Revises: b3d1c9e4f021
Create Date: 2026-06-30 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c4e2f1a3b567"
down_revision: Union[str, None] = "b3d1c9e4f021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'done', 'cancelled')")
    op.execute("CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high')")

    op.create_table(
        "task",
        sa.Column("id", sa.BigInteger(), primary_key=True, index=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.Enum("todo", "in_progress", "done", "cancelled", name="task_status", create_type=False), nullable=False, server_default="todo"),
        sa.Column("priority", sa.Enum("low", "medium", "high", name="task_priority", create_type=False), nullable=False, server_default="medium"),
        sa.Column("due_date", sa.DateTime(), nullable=True),
        sa.Column("created_by", sa.BigInteger(), sa.ForeignKey("user.id"), nullable=False),
        sa.Column("assigned_to", sa.BigInteger(), sa.ForeignKey("user.id"), nullable=True),
        sa.Column("deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("task")
    op.execute("DROP TYPE task_priority")
    op.execute("DROP TYPE task_status")
