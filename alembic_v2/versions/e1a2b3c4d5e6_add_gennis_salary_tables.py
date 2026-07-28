"""add gennis_teacher_salary, gennis_assistent_salary, gennis_staff_salary tables

Revision ID: e1a2b3c4d5e6
Revises: d4f8e2b1c390
Create Date: 2026-06-23 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "e1a2b3c4d5e6"
down_revision: Union[str, None] = "d4f8e2b1c390"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "gennis_teacher_salary",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("teacher_id", sa.Integer(), nullable=True),
        sa.Column("teacher_name", sa.String(511), nullable=True),
        sa.Column("location_id", sa.Integer(), nullable=True),
        sa.Column("total_salary", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("taken_money", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("black_salary", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("debt", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("fine", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("remaining_salary", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("calendar_month", sa.Integer(), nullable=False),
        sa.Column("calendar_year", sa.Integer(), nullable=False),
        sa.Column("synced_at", sa.DateTime(), server_default=sa.text("now()"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_gts_location_month_year", "gennis_teacher_salary", ["location_id", "calendar_year", "calendar_month"])

    op.create_table(
        "gennis_assistent_salary",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("assistent_id", sa.Integer(), nullable=True),
        sa.Column("assistent_name", sa.String(511), nullable=True),
        sa.Column("location_id", sa.Integer(), nullable=True),
        sa.Column("total_salary", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("taken_money", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("black_salary", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("debt", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("fine", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("remaining_salary", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("calendar_month", sa.Integer(), nullable=False),
        sa.Column("calendar_year", sa.Integer(), nullable=False),
        sa.Column("synced_at", sa.DateTime(), server_default=sa.text("now()"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_gas_location_month_year", "gennis_assistent_salary", ["location_id", "calendar_year", "calendar_month"])

    op.create_table(
        "gennis_staff_salary",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("staff_id", sa.Integer(), nullable=True),
        sa.Column("staff_name", sa.String(511), nullable=True),
        sa.Column("location_id", sa.Integer(), nullable=True),
        sa.Column("total_salary", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("taken_money", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("remaining_salary", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("deleted_date", sa.DateTime(), nullable=True),
        sa.Column("deleted_comment", sa.Text(), nullable=True),
        sa.Column("calendar_month", sa.Integer(), nullable=False),
        sa.Column("calendar_year", sa.Integer(), nullable=False),
        sa.Column("synced_at", sa.DateTime(), server_default=sa.text("now()"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_gss_location_month_year", "gennis_staff_salary", ["location_id", "calendar_year", "calendar_month"])


def downgrade() -> None:
    op.drop_index("ix_gss_location_month_year", table_name="gennis_staff_salary")
    op.drop_table("gennis_staff_salary")
    op.drop_index("ix_gas_location_month_year", table_name="gennis_assistent_salary")
    op.drop_table("gennis_assistent_salary")
    op.drop_index("ix_gts_location_month_year", table_name="gennis_teacher_salary")
    op.drop_table("gennis_teacher_salary")
