"""add turon overhead_type_log and overhead_type_log_payment tables

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-08-06

"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "turon_overhead_type_log_v2",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("overhead_type_id", sa.BigInteger(), nullable=False),
        sa.Column("cost", sa.Integer(), nullable=True),
        sa.Column("is_paid", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_prepaid", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("paid_date", sa.DateTime(), nullable=True),
        sa.Column("branch_id", sa.Integer(), nullable=True),
        sa.Column("date", sa.Date(), nullable=True),
        sa.Column("deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.ForeignKeyConstraint(["overhead_type_id"], ["turon_overhead_type_v2.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_turon_overhead_type_log_v2_id", "turon_overhead_type_log_v2", ["id"])
    op.create_index("ix_turon_overhead_type_log_v2_overhead_type_id", "turon_overhead_type_log_v2", ["overhead_type_id"])
    op.create_index("ix_turon_overhead_type_log_v2_branch_id", "turon_overhead_type_log_v2", ["branch_id"])
    op.create_index("ix_turon_overhead_type_log_v2_date", "turon_overhead_type_log_v2", ["date"])

    op.create_table(
        "turon_overhead_type_log_payment_v2",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("log_id", sa.BigInteger(), nullable=False),
        sa.Column("payment_type_id", sa.Integer(), nullable=True),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("paid_date", sa.DateTime(), nullable=False),
        sa.Column("note", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.ForeignKeyConstraint(["log_id"], ["turon_overhead_type_log_v2.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_turon_overhead_type_log_payment_v2_id", "turon_overhead_type_log_payment_v2", ["id"])
    op.create_index("ix_turon_overhead_type_log_payment_v2_log_id", "turon_overhead_type_log_payment_v2", ["log_id"])


def downgrade() -> None:
    op.drop_index("ix_turon_overhead_type_log_payment_v2_log_id", "turon_overhead_type_log_payment_v2")
    op.drop_index("ix_turon_overhead_type_log_payment_v2_id", "turon_overhead_type_log_payment_v2")
    op.drop_table("turon_overhead_type_log_payment_v2")

    op.drop_index("ix_turon_overhead_type_log_v2_date", "turon_overhead_type_log_v2")
    op.drop_index("ix_turon_overhead_type_log_v2_branch_id", "turon_overhead_type_log_v2")
    op.drop_index("ix_turon_overhead_type_log_v2_overhead_type_id", "turon_overhead_type_log_v2")
    op.drop_index("ix_turon_overhead_type_log_v2_id", "turon_overhead_type_log_v2")
    op.drop_table("turon_overhead_type_log_v2")
