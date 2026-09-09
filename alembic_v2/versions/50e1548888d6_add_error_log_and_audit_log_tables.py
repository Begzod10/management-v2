"""add error_log and audit_log tables

error_log records request failures (unhandled exceptions and 4xx/5xx
responses) written by the middleware in app/main.py -- ApiLog alone can't
capture these since an unhandled exception raises out of call_next before
ApiLog's own write runs.

audit_log records business actions ("which admin created what payment for
whom"), written by app.services.audit.log_action from create/update/delete
endpoints (currently wired into dividends and investments).

Revision ID: 50e1548888d6
Revises: f7a8b9c0d1e2
Create Date: 2026-09-09

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "50e1548888d6"
down_revision = "f7a8b9c0d1e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "error_log",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("method", sa.String(length=10), nullable=False),
        sa.Column("path", sa.String(length=500), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("user_id", sa.BigInteger(), nullable=True),
        sa.Column("error_type", sa.String(length=255), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("traceback", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_error_log_path", "error_log", ["path"])
    op.create_index("ix_error_log_user_id", "error_log", ["user_id"])
    op.create_index("ix_error_log_created_at", "error_log", ["created_at"])

    op.create_table(
        "audit_log",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("actor_id", sa.BigInteger(), sa.ForeignKey("user.id"), nullable=True),
        sa.Column("actor_name", sa.String(length=255), nullable=True),
        sa.Column("action", sa.String(length=20), nullable=False),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("entity_id", sa.BigInteger(), nullable=False),
        sa.Column("target_label", sa.String(length=255), nullable=True),
        sa.Column("amount", sa.BigInteger(), nullable=True),
        sa.Column("details", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_audit_log_actor_id", "audit_log", ["actor_id"])
    op.create_index("ix_audit_log_entity_type", "audit_log", ["entity_type"])
    op.create_index("ix_audit_log_created_at", "audit_log", ["created_at"])


def downgrade() -> None:
    op.drop_table("audit_log")
    op.drop_table("error_log")
