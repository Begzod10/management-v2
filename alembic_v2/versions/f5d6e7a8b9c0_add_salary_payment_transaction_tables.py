"""add gennis teacher/assistent/staff salary payment transaction tables

Revision ID: f5d6e7a8b9c0
Revises: e1a2b3c4d5e6
Create Date: 2026-06-23 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "f5d6e7a8b9c0"
down_revision: Union[str, None] = "e1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COMMON_COLS = [
    sa.Column("id", sa.Integer(), nullable=False),
    sa.Column("location_id", sa.Integer(), nullable=True),
    sa.Column("payment_sum", sa.Integer(), nullable=False, server_default="0"),
    sa.Column("channel", sa.String(100), nullable=True),
    sa.Column("paid_date", sa.Date(), nullable=True),
    sa.Column("calendar_month", sa.Integer(), nullable=False),
    sa.Column("calendar_year", sa.Integer(), nullable=False),
    sa.Column("reason", sa.String(500), nullable=True),
    sa.Column("deleted", sa.Boolean(), nullable=False, server_default="false"),
    sa.Column("synced_at", sa.DateTime(), server_default=sa.text("now()"), nullable=True),
]


def upgrade() -> None:
    op.create_table(
        "gennis_teacher_salary_payment",
        sa.Column("teacher_id", sa.Integer(), nullable=True),
        sa.Column("teacher_name", sa.String(511), nullable=True),
        *_COMMON_COLS,
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_gtsp_loc_month_year", "gennis_teacher_salary_payment",
                    ["location_id", "calendar_year", "calendar_month"])

    op.create_table(
        "gennis_assistent_salary_payment",
        sa.Column("assistent_id", sa.Integer(), nullable=True),
        sa.Column("assistent_name", sa.String(511), nullable=True),
        *_COMMON_COLS,
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_gasp_loc_month_year", "gennis_assistent_salary_payment",
                    ["location_id", "calendar_year", "calendar_month"])

    op.create_table(
        "gennis_staff_salary_payment",
        sa.Column("staff_id", sa.Integer(), nullable=True),
        sa.Column("staff_name", sa.String(511), nullable=True),
        sa.Column("job", sa.String(255), nullable=True),
        *_COMMON_COLS,
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_gssp_loc_month_year", "gennis_staff_salary_payment",
                    ["location_id", "calendar_year", "calendar_month"])


def downgrade() -> None:
    op.drop_index("ix_gssp_loc_month_year", table_name="gennis_staff_salary_payment")
    op.drop_table("gennis_staff_salary_payment")
    op.drop_index("ix_gasp_loc_month_year", table_name="gennis_assistent_salary_payment")
    op.drop_table("gennis_assistent_salary_payment")
    op.drop_index("ix_gtsp_loc_month_year", table_name="gennis_teacher_salary_payment")
    op.drop_table("gennis_teacher_salary_payment")
