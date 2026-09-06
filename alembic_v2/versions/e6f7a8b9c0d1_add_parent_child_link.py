"""add parent_child_link table

Lives on this track (not the main `alembic/` one) even though it covers
turon children too — the main track has no tracked migration history in
this repo (gitignored, never committed) and isn't run by the deploy
pipeline; alembic_v2 is the only track actually applied to production on
every deploy (see .github/workflows/deploy.yml). `parent_user_id` is a
real FK at the DB level even though `user` is owned by the main track's
models — both tracks migrate the same physical database.

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-09-07

"""
from alembic import op
import sqlalchemy as sa

revision = "e6f7a8b9c0d1"
down_revision = "d5e6f7a8b9c0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "parent_child_link",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("parent_user_id", sa.BigInteger, sa.ForeignKey("user.id"), nullable=False),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("child_ref_id", sa.Integer, nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint("parent_user_id", "source", "child_ref_id", name="uq_parent_child_link"),
    )
    op.create_index("ix_pcl_parent_user_id", "parent_child_link", ["parent_user_id"])


def downgrade() -> None:
    op.drop_index("ix_pcl_parent_user_id", table_name="parent_child_link")
    op.drop_table("parent_child_link")
