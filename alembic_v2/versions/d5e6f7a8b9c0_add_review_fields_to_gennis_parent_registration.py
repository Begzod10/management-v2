"""add review workflow fields to gennis_parent_registration

This row used to just sit there — nothing in the codebase ever queried or
wrote to gennis_parent_registration after insert, so a parent's self-service
submission had no way to become an actual login-capable account. These
fields let staff approve/reject a submission and record which real `user`
row (if any) it became.

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-09-07

"""
from alembic import op
import sqlalchemy as sa

revision = "d5e6f7a8b9c0"
down_revision = "c4d5e6f7a8b9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "gennis_parent_registration",
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
    )
    op.add_column("gennis_parent_registration", sa.Column("reviewed_by", sa.BigInteger, nullable=True))
    op.add_column("gennis_parent_registration", sa.Column("reviewed_at", sa.DateTime, nullable=True))
    op.add_column("gennis_parent_registration", sa.Column("linked_user_id", sa.BigInteger, nullable=True))
    op.create_index("ix_gpr_status", "gennis_parent_registration", ["status"])


def downgrade() -> None:
    op.drop_index("ix_gpr_status", table_name="gennis_parent_registration")
    op.drop_column("gennis_parent_registration", "linked_user_id")
    op.drop_column("gennis_parent_registration", "reviewed_at")
    op.drop_column("gennis_parent_registration", "reviewed_by")
    op.drop_column("gennis_parent_registration", "status")
