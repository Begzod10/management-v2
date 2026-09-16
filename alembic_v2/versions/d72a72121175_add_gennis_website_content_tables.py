"""add gennis website content tables

Revision ID: d72a72121175
Revises: 50e1548888d6
Create Date: 2026-09-16 00:00:00.000000

Ports the old "gennis" project's public marketing site (admin.gennis.uz,
managed through home_advantages / home_page/add_news / home_page/gallery /
home_page/get_home_info) onto v2-native tables so v2.gennis.uz can serve the
public home page directly once old gennis is retired. Nothing here syncs
from the old external DB — these are authored fresh through the new
/gennis/website admin endpoints, hence the "_v2" tablename suffix used for
every other v2-native (non-synced) table in this codebase.

Design notes:
  - gennis_website_gallery_image_v2.slot is nullable and unconstrained
    rather than a hard 1-8 CHECK: old gennis rendered a fixed 8-slot grid,
    but baking that count into the schema would make a future layout change
    a migration instead of a product decision.
  - gennis_website_teacher_profile_v2.teacher_user_id is a nullable, unique
    FK into `user` rather than the primary key: a public profile may be
    authored for a teacher who has no (or not yet a) matching internal
    account. teacher_gennis_id is kept alongside it as a raw external-id
    fallback, mirroring the gennis_id convention already used throughout
    models.py for references into the old system.
  - News links and teacher results are child tables (not JSON columns) with
    ON DELETE CASCADE, so deleting a news post or teacher profile cleans up
    its links/results without an application-level fan-out delete.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd72a72121175'
down_revision: Union[str, None] = '50e1548888d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'gennis_website_advantage_v2',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('image', sa.String(500), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index('ix_gennis_website_advantage_v2_id', 'gennis_website_advantage_v2', ['id'])

    op.create_table(
        'gennis_website_news_v2',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('image', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index('ix_gennis_website_news_v2_id', 'gennis_website_news_v2', ['id'])

    op.create_table(
        'gennis_website_news_link_v2',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            'news_id', sa.BigInteger(),
            sa.ForeignKey('gennis_website_news_v2.id', ondelete='CASCADE'), nullable=False,
        ),
        sa.Column('link_type', sa.String(50), nullable=False),
        sa.Column('url', sa.String(500), nullable=False),
    )
    op.create_index('ix_gennis_website_news_link_v2_id', 'gennis_website_news_link_v2', ['id'])
    op.create_index('ix_gennis_website_news_link_v2_news_id', 'gennis_website_news_link_v2', ['news_id'])

    op.create_table(
        'gennis_website_gallery_image_v2',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('image', sa.String(500), nullable=True),
        sa.Column('slot', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()')),
    )
    op.create_index('ix_gennis_website_gallery_image_v2_id', 'gennis_website_gallery_image_v2', ['id'])

    op.create_table(
        'gennis_website_teacher_profile_v2',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('teacher_user_id', sa.BigInteger(), sa.ForeignKey('user.id'), nullable=True, unique=True),
        sa.Column('teacher_gennis_id', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('subject_display', sa.String(255), nullable=True),
        sa.Column('photo', sa.String(500), nullable=True),
        sa.Column('bio', sa.Text(), nullable=True),
        sa.Column('telegram', sa.String(500), nullable=True),
        sa.Column('instagram', sa.String(500), nullable=True),
        sa.Column('facebook', sa.String(500), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index('ix_gennis_website_teacher_profile_v2_id', 'gennis_website_teacher_profile_v2', ['id'])

    op.create_table(
        'gennis_website_teacher_result_v2',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            'teacher_profile_id', sa.BigInteger(),
            sa.ForeignKey('gennis_website_teacher_profile_v2.id', ondelete='CASCADE'), nullable=False,
        ),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('student_photo', sa.String(500), nullable=True),
        sa.Column('result_image', sa.String(500), nullable=True),
        sa.Column('student_name', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
    )
    op.create_index('ix_gennis_website_teacher_result_v2_id', 'gennis_website_teacher_result_v2', ['id'])
    op.create_index(
        'ix_gennis_website_teacher_result_v2_teacher_profile_id',
        'gennis_website_teacher_result_v2', ['teacher_profile_id'],
    )


def downgrade() -> None:
    op.drop_index('ix_gennis_website_teacher_result_v2_teacher_profile_id', table_name='gennis_website_teacher_result_v2')
    op.drop_index('ix_gennis_website_teacher_result_v2_id', table_name='gennis_website_teacher_result_v2')
    op.drop_table('gennis_website_teacher_result_v2')

    op.drop_index('ix_gennis_website_teacher_profile_v2_id', table_name='gennis_website_teacher_profile_v2')
    op.drop_table('gennis_website_teacher_profile_v2')

    op.drop_index('ix_gennis_website_gallery_image_v2_id', table_name='gennis_website_gallery_image_v2')
    op.drop_table('gennis_website_gallery_image_v2')

    op.drop_index('ix_gennis_website_news_link_v2_news_id', table_name='gennis_website_news_link_v2')
    op.drop_index('ix_gennis_website_news_link_v2_id', table_name='gennis_website_news_link_v2')
    op.drop_table('gennis_website_news_link_v2')

    op.drop_index('ix_gennis_website_news_v2_id', table_name='gennis_website_news_v2')
    op.drop_table('gennis_website_news_v2')

    op.drop_index('ix_gennis_website_advantage_v2_id', table_name='gennis_website_advantage_v2')
    op.drop_table('gennis_website_advantage_v2')
