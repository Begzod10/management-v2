"""add gennis_deleted_overhead and gennis_deleted_capital_expenditure tables

Revision ID: d4f8e2b1c390
Revises: c7e2d1a3f445
Create Date: 2026-06-22 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "d4f8e2b1c390"
down_revision: Union[str, None] = "c7e2d1a3f445"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "gennis_deleted_overhead",
        sa.Column("id",               sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("original_id",      sa.BigInteger(), nullable=True),
        sa.Column("item_name",        sa.String(500), nullable=False),
        sa.Column("item_sum",         sa.BigInteger(), nullable=False),
        sa.Column("overhead_type_id", sa.Integer(), nullable=True),
        sa.Column("channel",          sa.String(100), nullable=True),
        sa.Column("location_id",      sa.Integer(), nullable=False),
        sa.Column("date",             sa.Date(), nullable=False),
        sa.Column("calendar_month",   sa.Integer(), nullable=False),
        sa.Column("calendar_year",    sa.Integer(), nullable=False),
        sa.Column("created_by",       sa.BigInteger(), nullable=True),
        sa.Column("created_at",       sa.DateTime(), nullable=True),
        sa.Column("deleted_date",     sa.DateTime(), server_default=sa.text("now()")),
        sa.Column("deleted_reason",   sa.String(500), nullable=True),
    )

    op.create_table(
        "gennis_deleted_capital_expenditure",
        sa.Column("id",             sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("original_id",    sa.BigInteger(), nullable=True),
        sa.Column("item_name",      sa.String(500), nullable=False),
        sa.Column("item_sum",       sa.BigInteger(), nullable=False),
        sa.Column("channel",        sa.String(100), nullable=True),
        sa.Column("location_id",    sa.Integer(), nullable=False),
        sa.Column("date",           sa.Date(), nullable=False),
        sa.Column("calendar_month", sa.Integer(), nullable=False),
        sa.Column("calendar_year",  sa.Integer(), nullable=False),
        sa.Column("created_by",     sa.BigInteger(), nullable=True),
        sa.Column("created_at",     sa.DateTime(), nullable=True),
        sa.Column("deleted_date",   sa.DateTime(), server_default=sa.text("now()")),
        sa.Column("deleted_reason", sa.String(500), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("gennis_deleted_capital_expenditure")
    op.drop_table("gennis_deleted_overhead")
