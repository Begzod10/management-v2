"""add call_record table

Revision ID: a2b3c4d5e6f7
Revises: c4e2f1a3b567
Create Date: 2026-07-13 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = "a2b3c4d5e6f7"
down_revision: Union[str, None] = "c4e2f1a3b567"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS call_record (
            id BIGSERIAL PRIMARY KEY,
            call_type VARCHAR(20) NOT NULL,
            target_id INTEGER NOT NULL,
            target_name VARCHAR(511),
            phone VARCHAR(50) NOT NULL,
            callid VARCHAR(100),
            status VARCHAR(20),
            duration INTEGER,
            record_url VARCHAR(500),
            location_id INTEGER,
            call_date DATE NOT NULL,
            called_by_id BIGINT,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_call_record_type_loc_date
        ON call_record (call_type, location_id, call_date)
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_call_record_type_loc_date")
    op.drop_table("call_record")
