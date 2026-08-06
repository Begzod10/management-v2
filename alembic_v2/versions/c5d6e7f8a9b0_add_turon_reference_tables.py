"""add turon subject, class_number, and class_subject reference tables

Revision ID: c5d6e7f8a9b0
Revises: c3d4e5f6a7b8
Create Date: 2026-08-06

"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "c5d6e7f8a9b0"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "turon_subject_v2",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("name", sa.String(250), nullable=False),
        sa.Column("desc", sa.Text(), nullable=True),
        sa.Column("disabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("old_id", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("old_id", name="uq_turon_subject_old_id"),
    )
    op.create_index("ix_turon_subject_v2_id", "turon_subject_v2", ["id"])

    op.create_table(
        "turon_class_number_v2",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("branch_id", sa.Integer(), nullable=True),
        sa.Column("price", sa.Integer(), nullable=True),
        sa.Column("curriculum_hours", sa.Integer(), nullable=True),
        sa.Column("old_id", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("old_id", name="uq_turon_class_number_old_id"),
    )
    op.create_index("ix_turon_class_number_v2_id", "turon_class_number_v2", ["id"])

    op.create_table(
        "turon_class_subject_v2",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("class_number_id", sa.BigInteger(), nullable=False),
        sa.Column("subject_id", sa.BigInteger(), nullable=False),
        sa.Column("hours", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["class_number_id"], ["turon_class_number_v2.id"]),
        sa.ForeignKeyConstraint(["subject_id"], ["turon_subject_v2.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("class_number_id", "subject_id", name="uq_turon_class_subject_pair"),
    )
    op.create_index("ix_turon_class_subject_v2_id", "turon_class_subject_v2", ["id"])


def downgrade() -> None:
    op.drop_index("ix_turon_class_subject_v2_id", "turon_class_subject_v2")
    op.drop_table("turon_class_subject_v2")

    op.drop_index("ix_turon_class_number_v2_id", "turon_class_number_v2")
    op.drop_table("turon_class_number_v2")

    op.drop_index("ix_turon_subject_v2_id", "turon_subject_v2")
    op.drop_table("turon_subject_v2")
