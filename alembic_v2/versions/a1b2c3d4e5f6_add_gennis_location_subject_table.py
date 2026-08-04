"""add gennis_location_subject table

Revision ID: ab12cd34ef56
Revises: b2c3d4e5f6a7
Create Date: 2026-08-04 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'ab12cd34ef56'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'gennis_location_subject',
        sa.Column('id',          sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('subject_id',  sa.BigInteger(), sa.ForeignKey('gennis_subject.id'),  nullable=False),
        sa.Column('location_id', sa.BigInteger(), sa.ForeignKey('gennis_location.id'), nullable=False),
        sa.Column('created_at',  sa.DateTime(),   server_default=sa.text('now()')),
        sa.UniqueConstraint('subject_id', 'location_id', name='uq_gls_subject_location'),
    )
    op.create_index('ix_gennis_location_subject_subject_id',  'gennis_location_subject', ['subject_id'])
    op.create_index('ix_gennis_location_subject_location_id', 'gennis_location_subject', ['location_id'])


def downgrade():
    op.drop_index('ix_gennis_location_subject_location_id', table_name='gennis_location_subject')
    op.drop_index('ix_gennis_location_subject_subject_id',  table_name='gennis_location_subject')
    op.drop_table('gennis_location_subject')
