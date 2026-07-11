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
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'done', 'cancelled');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS task (
            id BIGSERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            status task_status NOT NULL DEFAULT 'todo',
            priority task_priority NOT NULL DEFAULT 'medium',
            due_date TIMESTAMP,
            created_by BIGINT NOT NULL REFERENCES "user"(id),
            assigned_to BIGINT REFERENCES "user"(id),
            deleted BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMP DEFAULT now(),
            updated_at TIMESTAMP
        )
    """)


def downgrade() -> None:
    op.drop_table("task")
    op.execute("DROP TYPE task_priority")
    op.execute("DROP TYPE task_status")
