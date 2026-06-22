"""add gennis_overhead and gennis_capital_expenditure tables

Revision ID: c7e2d1a3f445
Revises: b3d1c9e4f021
Create Date: 2026-06-22 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c7e2d1a3f445"
down_revision: Union[str, None] = "b3d1c9e4f021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "gennis_overhead",
        sa.Column("id",               sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("item_name",        sa.String(500), nullable=False),
        sa.Column("item_sum",         sa.BigInteger(), nullable=False),
        sa.Column("overhead_type_id", sa.Integer(), sa.ForeignKey("overhead_type.id"), nullable=True),
        sa.Column("channel",          sa.String(100), nullable=True),
        sa.Column("location_id",      sa.Integer(), nullable=False),
        sa.Column("date",             sa.Date(), nullable=False),
        sa.Column("calendar_month",   sa.Integer(), nullable=False),
        sa.Column("calendar_year",    sa.Integer(), nullable=False),
        sa.Column("deleted",          sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("deleted_reason",   sa.String(500), nullable=True),
        sa.Column("created_by",       sa.BigInteger(), nullable=True),
        sa.Column("created_at",       sa.DateTime(), server_default=sa.text("now()")),
    )

    op.create_table(
        "gennis_capital_expenditure",
        sa.Column("id",             sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("item_name",      sa.String(500), nullable=False),
        sa.Column("item_sum",       sa.BigInteger(), nullable=False),
        sa.Column("channel",        sa.String(100), nullable=True),
        sa.Column("location_id",    sa.Integer(), nullable=False),
        sa.Column("date",           sa.Date(), nullable=False),
        sa.Column("calendar_month", sa.Integer(), nullable=False),
        sa.Column("calendar_year",  sa.Integer(), nullable=False),
        sa.Column("deleted",        sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("deleted_reason", sa.String(500), nullable=True),
        sa.Column("created_by",     sa.BigInteger(), nullable=True),
        sa.Column("created_at",     sa.DateTime(), server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("gennis_capital_expenditure")
    op.drop_table("gennis_overhead")
