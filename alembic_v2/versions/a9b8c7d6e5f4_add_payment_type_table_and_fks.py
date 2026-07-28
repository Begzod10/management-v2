"""add payment_type table and payment_type_id FK to all sum tables

Revision ID: a9b8c7d6e5f4
Revises: f5d6e7a8b9c0
Create Date: 2026-06-23 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "a9b8c7d6e5f4"
down_revision: Union[str, None] = "f5d6e7a8b9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Tables that currently have a `channel` column and need payment_type_id
_CHANNEL_TABLES = [
    "gennis_student_payment",
    "gennis_overhead",
    "gennis_capital_expenditure",
    "gennis_deleted_overhead",
    "gennis_deleted_capital_expenditure",
    "gennis_teacher_salary_payment",
    "gennis_assistent_salary_payment",
    "gennis_staff_salary_payment",
]

# Seed data: (slug, display_name)
_PAYMENT_TYPES = [
    ("cash",   "Naqd"),
    ("click",  "Click"),
    ("payme",  "Payme"),
    ("bank",   "Bank"),
    ("humo",   "Humo"),
    ("uzcard", "Uzcard"),
]


def upgrade() -> None:
    # 1. Create payment_type table
    op.create_table(
        "payment_type",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(50), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="uq_payment_type_slug"),
    )

    # 2. Seed payment types
    op.execute("""
        INSERT INTO payment_type (name, slug) VALUES
        ('Naqd',   'cash'),
        ('Click',  'click'),
        ('Payme',  'payme'),
        ('Bank',   'bank'),
        ('Humo',   'humo'),
        ('Uzcard', 'uzcard')
    """)

    # 3. Add payment_type_id FK column to all channel tables
    for table in _CHANNEL_TABLES:
        op.add_column(table, sa.Column("payment_type_id", sa.Integer(), nullable=True))
        op.create_foreign_key(
            f"fk_{table}_payment_type_id",
            table, "payment_type",
            ["payment_type_id"], ["id"],
            ondelete="SET NULL",
        )

    # 4. Back-fill payment_type_id from existing channel values
    for table in _CHANNEL_TABLES:
        op.execute(f"""
            UPDATE {table} t
            SET payment_type_id = pt.id
            FROM payment_type pt
            WHERE LOWER(t.channel) = pt.slug
              AND t.channel IS NOT NULL
        """)

    # 5. Also add payment_type_id to dividend and investment tables
    for table in ("dividend", "investment"):
        op.add_column(table, sa.Column("payment_type_id", sa.Integer(), nullable=True))
        op.create_foreign_key(
            f"fk_{table}_payment_type_id",
            table, "payment_type",
            ["payment_type_id"], ["id"],
            ondelete="SET NULL",
        )
        op.execute(f"""
            UPDATE {table} t
            SET payment_type_id = pt.id
            FROM payment_type pt
            WHERE LOWER(t.payment_type) = pt.slug
              AND t.payment_type IS NOT NULL
        """)


def downgrade() -> None:
    for table in ("dividend", "investment"):
        op.drop_constraint(f"fk_{table}_payment_type_id", table, type_="foreignkey")
        op.drop_column(table, "payment_type_id")

    for table in _CHANNEL_TABLES:
        op.drop_constraint(f"fk_{table}_payment_type_id", table, type_="foreignkey")
        op.drop_column(table, "payment_type_id")

    op.drop_table("payment_type")
