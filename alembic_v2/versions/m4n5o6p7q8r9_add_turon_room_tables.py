"""add turon_room_v2, turon_room_image_v2, turon_room_subject_v2

Revision ID: m4n5o6p7q8r9
Revises: l3m4n5o6p7q8
Create Date: 2026-08-07 14:00:00.000000

Ports Django's rooms app. Rooms are a prerequisite for both GroupTimeTable and
ClassTimeTable, which each carry a room FK.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'm4n5o6p7q8r9'
down_revision: Union[str, None] = 'l3m4n5o6p7q8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'turon_room_v2',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(250), nullable=False),
        sa.Column('seats_number', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('branch_id', sa.Integer(), nullable=True),
        sa.Column('electronic_board', sa.Boolean(), nullable=False, server_default='false'),
        # Django had a GLOBAL unique constraint on `order`, which makes it
        # impossible to give two branches a room at the same position. Kept as
        # a plain sort key here; ordering is scoped per branch by the queries.
        sa.Column('order', sa.Integer(), nullable=True),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default='false'),
        # rooms_room.id in the old turon DB, for idempotent sync re-runs.
        sa.Column('old_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
    )
    op.create_index('ix_turon_room_branch_id', 'turon_room_v2', ['branch_id'])
    op.create_unique_constraint('uq_turon_room_old_id', 'turon_room_v2', ['old_id'])

    op.create_table(
        'turon_room_image_v2',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            'room_id', sa.BigInteger(),
            sa.ForeignKey('turon_room_v2.id', ondelete='CASCADE'),
            nullable=False,
        ),
        # Django stored an ImageField; v2 keeps only the resolved URL.
        sa.Column('img_url', sa.String(500), nullable=False),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
    )
    op.create_index('ix_turon_room_image_room_id', 'turon_room_image_v2', ['room_id'])

    op.create_table(
        'turon_room_subject_v2',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            'room_id', sa.BigInteger(),
            sa.ForeignKey('turon_room_v2.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column(
            'subject_id', sa.BigInteger(),
            sa.ForeignKey('turon_subject_v2.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        # Django allowed duplicate (room, subject) pairs; v2 does not.
        sa.UniqueConstraint('room_id', 'subject_id', name='uq_turon_room_subject'),
    )


def downgrade() -> None:
    op.drop_table('turon_room_subject_v2')
    op.drop_index('ix_turon_room_image_room_id', table_name='turon_room_image_v2')
    op.drop_table('turon_room_image_v2')
    op.drop_constraint('uq_turon_room_old_id', 'turon_room_v2', type_='unique')
    op.drop_index('ix_turon_room_branch_id', table_name='turon_room_v2')
    op.drop_table('turon_room_v2')
