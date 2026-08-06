"""add turon branch_loan and branch_loan_transaction tables

Revision ID: g7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-08-06

"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "g7b8c9d0e1f2"
down_revision: Union[str, None] = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "turon_branch_loan_v2",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("branch_id", sa.Integer(), nullable=False),
        sa.Column("direction", sa.String(8), nullable=False),
        sa.Column("status", sa.String(12), nullable=False, server_default="active"),
        sa.Column("principal_amount", sa.BigInteger(), nullable=False),
        sa.Column("issued_date", sa.Date(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("settled_date", sa.Date(), nullable=True),
        sa.Column("reason", sa.String(500), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("cancelled_reason", sa.String(500), nullable=True),
        sa.Column("counterparty_id", sa.Integer(), nullable=True),
        sa.Column("counterparty_name", sa.String(200), nullable=True),
        sa.Column("counterparty_surname", sa.String(200), nullable=True),
        sa.Column("counterparty_phone", sa.String(50), nullable=True),
        sa.Column("management_id", sa.BigInteger(), nullable=True),
        sa.Column("deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("management_id", name="uq_turon_branch_loan_management_id"),
    )
    op.create_index("ix_turon_branch_loan_v2_id", "turon_branch_loan_v2", ["id"])
    op.create_index("ix_turon_branch_loan_v2_branch_id", "turon_branch_loan_v2", ["branch_id"])

    op.create_table(
        "turon_branch_loan_transaction_v2",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("loan_id", sa.BigInteger(), nullable=False),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column("is_give", sa.Boolean(), nullable=False),
        sa.Column("payment_type_id", sa.Integer(), nullable=True),
        sa.Column("reason", sa.String(500), nullable=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["loan_id"], ["turon_branch_loan_v2.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_turon_branch_loan_transaction_v2_id", "turon_branch_loan_transaction_v2", ["id"])
    op.create_index("ix_turon_branch_loan_transaction_v2_loan_id", "turon_branch_loan_transaction_v2", ["loan_id"])


def downgrade() -> None:
    op.drop_index("ix_turon_branch_loan_transaction_v2_loan_id", "turon_branch_loan_transaction_v2")
    op.drop_index("ix_turon_branch_loan_transaction_v2_id", "turon_branch_loan_transaction_v2")
    op.drop_table("turon_branch_loan_transaction_v2")

    op.drop_index("ix_turon_branch_loan_v2_branch_id", "turon_branch_loan_v2")
    op.drop_index("ix_turon_branch_loan_v2_id", "turon_branch_loan_v2")
    op.drop_table("turon_branch_loan_v2")
