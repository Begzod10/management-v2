"""add turon student payment and attendance per month tables

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-08-06

"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "turon_attendance_per_month_v2",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("branch_id", sa.Integer(), nullable=True),
        sa.Column("month_date", sa.Date(), nullable=False),
        sa.Column("total_debt", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("remaining_debt", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("payment", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("discount", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("status", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_turon_attendance_per_month_v2_id", "turon_attendance_per_month_v2", ["id"])
    op.create_index("ix_turon_attendance_per_month_v2_student_id", "turon_attendance_per_month_v2", ["student_id"])

    op.create_table(
        "turon_student_payment_v2",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("branch_id", sa.Integer(), nullable=True),
        sa.Column("payment_type_id", sa.Integer(), nullable=True),
        sa.Column("payment_sum", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("extra_payment", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_turon_student_payment_v2_id", "turon_student_payment_v2", ["id"])
    op.create_index("ix_turon_student_payment_v2_student_id", "turon_student_payment_v2", ["student_id"])
    op.create_index("ix_turon_student_payment_v2_branch_id", "turon_student_payment_v2", ["branch_id"])


def downgrade() -> None:
    op.drop_index("ix_turon_student_payment_v2_branch_id", "turon_student_payment_v2")
    op.drop_index("ix_turon_student_payment_v2_student_id", "turon_student_payment_v2")
    op.drop_index("ix_turon_student_payment_v2_id", "turon_student_payment_v2")
    op.drop_table("turon_student_payment_v2")

    op.drop_index("ix_turon_attendance_per_month_v2_student_id", "turon_attendance_per_month_v2")
    op.drop_index("ix_turon_attendance_per_month_v2_id", "turon_attendance_per_month_v2")
    op.drop_table("turon_attendance_per_month_v2")
