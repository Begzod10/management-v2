"""drop unused parent_child_link_v2 table

This table was created (see e6f7a8b9c0d1) as part of a same-day parent
portal feature build, before discovering that turon-v2 and gennis-v2 each
already own a real, populated parent-child link table of their own
(turon_parent_child_v2 -- 8 rows, parent_child_link -- 25 rows). This one
never got any real writes (0 rows, confirmed in production before writing
this migration) -- management-v2's parent-portal code now reads/writes the
two existing tables directly instead (see app/models.py's
GennisParentChildLink / TuronParentChildLink), so this table has no reason
to exist. Safe to drop outright: no data to lose, nothing else references
it (it was never wired into anything beyond the same PR that created it).

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-09-07

"""
from alembic import op
import sqlalchemy as sa

revision = "f7a8b9c0d1e2"
down_revision = "e6f7a8b9c0d1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index("ix_pcl_v2_parent_user_id", table_name="parent_child_link_v2")
    op.drop_table("parent_child_link_v2")


def downgrade() -> None:
    op.create_table(
        "parent_child_link_v2",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("parent_user_id", sa.BigInteger, sa.ForeignKey("user.id"), nullable=False),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("child_ref_id", sa.Integer, nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint("parent_user_id", "source", "child_ref_id", name="uq_parent_child_link_v2"),
    )
    op.create_index("ix_pcl_v2_parent_user_id", "parent_child_link_v2", ["parent_user_id"])
