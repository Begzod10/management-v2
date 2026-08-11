"""add gennis_lesson_plan_student

Revision ID: c0d1e2f3a4b5
Revises: b9c0d1e2f3a4
Create Date: 2026-08-11 12:30:00.000000

The per-student notes attached to a lesson plan — 158,528 rows in old gennis and
the single largest table with no v2 home. Old gennis is being switched off, so
without this they stop being reachable at cutover.

It cannot reuse the existing unprefixed `lesson_plan_student`: that table's FK
points at `lesson_plan`, the v2-native table of 400 rows, whereas these rows
hang off `gennis_lesson_plan` (75,299 mirrored rows). Same idea, different
parent, so they get their own mirror rather than being forced to share.

References are kept raw in *_gennis_id columns, matching the other gennis
mirrors: the join to gennis_lesson_plan and gennis_student goes through their
`gennis_id`. The source is unusually clean for this database — all 158,528 rows
have a non-null student, a non-null lesson plan, a comment, and a lesson plan
that actually exists — so nothing here is nullable out of defensiveness.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c0d1e2f3a4b5'
down_revision: Union[str, None] = 'b9c0d1e2f3a4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "gennis_lesson_plan_student",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("gennis_id", sa.Integer(), nullable=False),
        sa.Column("lesson_plan_gennis_id", sa.Integer(), nullable=True, index=True),
        sa.Column("student_gennis_id", sa.Integer(), nullable=True, index=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("synced_at", sa.DateTime(), server_default=sa.func.now()),
    )
    # The re-run key for the sync: ON CONFLICT (gennis_id) DO NOTHING. Plain
    # UNIQUE rather than a partial index — a partial one cannot be inferred by
    # ON CONFLICT unless the predicate is repeated, which is how the
    # gennis_overhead duplication went unnoticed.
    op.create_unique_constraint(
        "uq_gennis_lesson_plan_student_gennis_id",
        "gennis_lesson_plan_student",
        ["gennis_id"],
    )


def downgrade() -> None:
    op.drop_table("gennis_lesson_plan_student")
