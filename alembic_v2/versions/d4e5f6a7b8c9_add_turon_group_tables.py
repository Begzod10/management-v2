"""add turon class_type, group, and group_subject tables

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-08-06

"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c5d6e7f8a9b0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "turon_class_type_v2",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("branch_id", sa.Integer(), nullable=True),
        sa.Column("deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_turon_class_type_v2_id", "turon_class_type_v2", ["id"])
    op.create_index("ix_turon_class_type_v2_branch_id", "turon_class_type_v2", ["branch_id"])

    op.create_table(
        "turon_group_v2",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("branch_id", sa.Integer(), nullable=True),
        sa.Column("class_number_id", sa.BigInteger(), nullable=True),
        sa.Column("class_type_id", sa.BigInteger(), nullable=True),
        sa.Column("color", sa.String(100), nullable=True),
        sa.Column("price", sa.Integer(), nullable=True),
        sa.Column("teacher_salary", sa.Integer(), nullable=True),
        sa.Column("attendance_days", sa.Integer(), nullable=True),
        sa.Column("teacher_id", sa.BigInteger(), nullable=True),
        sa.Column("status", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_date", sa.Date(), nullable=False, server_default=sa.text("current_date")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["class_number_id"], ["turon_class_number_v2.id"]),
        sa.ForeignKeyConstraint(["class_type_id"], ["turon_class_type_v2.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_turon_group_v2_id", "turon_group_v2", ["id"])
    op.create_index("ix_turon_group_v2_branch_id", "turon_group_v2", ["branch_id"])

    op.create_table(
        "turon_group_subject_v2",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("group_id", sa.BigInteger(), nullable=False),
        sa.Column("subject_id", sa.BigInteger(), nullable=False),
        sa.Column("hours", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["group_id"], ["turon_group_v2.id"]),
        sa.ForeignKeyConstraint(["subject_id"], ["turon_subject_v2.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("group_id", "subject_id", name="uq_turon_group_subject"),
    )
    op.create_index("ix_turon_group_subject_v2_id", "turon_group_subject_v2", ["id"])
    op.create_index("ix_turon_group_subject_v2_group_id", "turon_group_subject_v2", ["group_id"])


def downgrade() -> None:
    op.drop_index("ix_turon_group_subject_v2_group_id", "turon_group_subject_v2")
    op.drop_index("ix_turon_group_subject_v2_id", "turon_group_subject_v2")
    op.drop_table("turon_group_subject_v2")

    op.drop_index("ix_turon_group_v2_branch_id", "turon_group_v2")
    op.drop_index("ix_turon_group_v2_id", "turon_group_v2")
    op.drop_table("turon_group_v2")

    op.drop_index("ix_turon_class_type_v2_branch_id", "turon_class_type_v2")
    op.drop_index("ix_turon_class_type_v2_id", "turon_class_type_v2")
    op.drop_table("turon_class_type_v2")
