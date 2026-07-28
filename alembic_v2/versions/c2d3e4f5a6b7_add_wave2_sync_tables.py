"""add wave2 sync tables: location, education_language, profession, role, calendar, user,
teacher, staff, assistent, room, week, group_room_week, attendance, group_reason,
teacher_group_statistics, teacher_observation_day, lesson_plan, group_time,
teacher_location, teacher_subject_link, teacher_group_link

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-06-30 10:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c2d3e4f5a6b7'
down_revision: Union[str, None] = 'b1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'gennis_location',
        sa.Column('id',        sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('gennis_id', sa.Integer(),    nullable=False, unique=True),
        sa.Column('name',      sa.String(255),  nullable=True),
        sa.Column('code',      sa.Integer(),    nullable=True),
        sa.Column('address',   sa.String(500),  nullable=True),
        sa.Column('synced_at', sa.DateTime(),   server_default=sa.text('now()')),
    )

    op.create_table(
        'gennis_education_language',
        sa.Column('id',        sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('gennis_id', sa.Integer(),    nullable=False, unique=True),
        sa.Column('name',      sa.String(100),  nullable=False),
        sa.Column('synced_at', sa.DateTime(),   server_default=sa.text('now()')),
    )

    op.create_table(
        'gennis_profession',
        sa.Column('id',        sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('gennis_id', sa.Integer(),    nullable=False, unique=True),
        sa.Column('name',      sa.String(255),  nullable=False),
        sa.Column('synced_at', sa.DateTime(),   server_default=sa.text('now()')),
    )

    op.create_table(
        'gennis_role',
        sa.Column('id',        sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('gennis_id', sa.Integer(),    nullable=False, unique=True),
        sa.Column('role',      sa.String(100),  nullable=True),
        sa.Column('type_role', sa.String(100),  nullable=True),
        sa.Column('synced_at', sa.DateTime(),   server_default=sa.text('now()')),
    )

    op.create_table(
        'gennis_calendar_year',
        sa.Column('id',        sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('gennis_id', sa.Integer(),    nullable=False, unique=True),
        sa.Column('date',      sa.DateTime(),   nullable=True),
        sa.Column('synced_at', sa.DateTime(),   server_default=sa.text('now()')),
    )

    op.create_table(
        'gennis_calendar_month',
        sa.Column('id',             sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('gennis_id',      sa.Integer(),    nullable=False, unique=True),
        sa.Column('date',           sa.DateTime(),   nullable=True),
        sa.Column('year_gennis_id', sa.Integer(),    nullable=True),
        sa.Column('synced_at',      sa.DateTime(),   server_default=sa.text('now()')),
    )

    op.create_table(
        'gennis_calendar_day',
        sa.Column('id',        sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('gennis_id', sa.Integer(),    nullable=False, unique=True),
        sa.Column('date',      sa.DateTime(),   nullable=True),
        sa.Column('synced_at', sa.DateTime(),   server_default=sa.text('now()')),
    )

    op.create_table(
        'gennis_user',
        sa.Column('id',                     sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('gennis_id',              sa.Integer(),    nullable=False, unique=True),
        sa.Column('name',                   sa.String(255),  nullable=True),
        sa.Column('surname',                sa.String(255),  nullable=True),
        sa.Column('father_name',            sa.String(255),  nullable=True),
        sa.Column('username',               sa.String(100),  nullable=True),
        sa.Column('age',                    sa.Integer(),    nullable=True),
        sa.Column('location_id',            sa.Integer(),    nullable=True),
        sa.Column('role_id',                sa.Integer(),    nullable=True),
        sa.Column('education_language_id',  sa.Integer(),    nullable=True),
        sa.Column('photo_profile',          sa.String(500),  nullable=True),
        sa.Column('balance',                sa.Integer(),    nullable=True),
        sa.Column('deleted',                sa.Boolean(),    nullable=False, server_default='false'),
        sa.Column('level',                  sa.Integer(),    nullable=True),
        sa.Column('calendar_day_gennis_id', sa.Integer(),    nullable=True),
        sa.Column('synced_at',              sa.DateTime(),   server_default=sa.text('now()')),
    )

    op.create_table(
        'gennis_teacher',
        sa.Column('id',             sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('gennis_id',      sa.Integer(),    nullable=False, unique=True),
        sa.Column('user_gennis_id', sa.Integer(),    nullable=True),
        sa.Column('name',           sa.String(255),  nullable=True),
        sa.Column('surname',        sa.String(255),  nullable=True),
        sa.Column('username',       sa.String(100),  nullable=True),
        sa.Column('age',            sa.Integer(),    nullable=True),
        sa.Column('photo_profile',  sa.String(500),  nullable=True),
        sa.Column('language_name',  sa.String(100),  nullable=True),
        sa.Column('table_color',    sa.String(50),   nullable=True),
        sa.Column('total_students', sa.Integer(),    nullable=True),
        sa.Column('is_active',      sa.Boolean(),    nullable=False, server_default='true'),
        sa.Column('reg_date',       sa.DateTime(),   nullable=True),
        sa.Column('synced_at',      sa.DateTime(),   server_default=sa.text('now()')),
    )

    op.create_table(
        'gennis_staff',
        sa.Column('id',              sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('gennis_id',       sa.Integer(),    nullable=False, unique=True),
        sa.Column('user_gennis_id',  sa.Integer(),    nullable=True),
        sa.Column('name',            sa.String(255),  nullable=True),
        sa.Column('surname',         sa.String(255),  nullable=True),
        sa.Column('username',        sa.String(100),  nullable=True),
        sa.Column('age',             sa.Integer(),    nullable=True),
        sa.Column('photo_profile',   sa.String(500),  nullable=True),
        sa.Column('language_name',   sa.String(100),  nullable=True),
        sa.Column('role_name',       sa.String(100),  nullable=True),
        sa.Column('type_role',       sa.String(100),  nullable=True),
        sa.Column('profession_id',   sa.Integer(),    nullable=True),
        sa.Column('profession_name', sa.String(255),  nullable=True),
        sa.Column('location_id',     sa.Integer(),    nullable=True),
        sa.Column('level',           sa.Integer(),    nullable=True),
        sa.Column('deleted',         sa.Boolean(),    nullable=False, server_default='false'),
        sa.Column('deleted_comment', sa.String(500),  nullable=True),
        sa.Column('reg_date',        sa.DateTime(),   nullable=True),
        sa.Column('synced_at',       sa.DateTime(),   server_default=sa.text('now()')),
    )

    op.create_table(
        'gennis_assistent',
        sa.Column('id',                sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('gennis_id',         sa.Integer(),    nullable=False, unique=True),
        sa.Column('user_gennis_id',    sa.Integer(),    nullable=True),
        sa.Column('teacher_gennis_id', sa.Integer(),    nullable=True),
        sa.Column('name',              sa.String(255),  nullable=True),
        sa.Column('surname',           sa.String(255),  nullable=True),
        sa.Column('username',          sa.String(100),  nullable=True),
        sa.Column('age',               sa.Integer(),    nullable=True),
        sa.Column('photo_profile',     sa.String(500),  nullable=True),
        sa.Column('language_name',     sa.String(100),  nullable=True),
        sa.Column('location_id',       sa.Integer(),    nullable=True),
        sa.Column('deleted',           sa.Boolean(),    nullable=False, server_default='false'),
        sa.Column('synced_at',         sa.DateTime(),   server_default=sa.text('now()')),
    )

    op.create_table(
        'gennis_room',
        sa.Column('id',          sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('gennis_id',   sa.Integer(),    nullable=False, unique=True),
        sa.Column('name',        sa.String(255),  nullable=True),
        sa.Column('capacity',    sa.Integer(),    nullable=True),
        sa.Column('location_id', sa.Integer(),    nullable=True),
        sa.Column('deleted',     sa.Boolean(),    nullable=False, server_default='false'),
        sa.Column('synced_at',   sa.DateTime(),   server_default=sa.text('now()')),
    )

    op.create_table(
        'gennis_week',
        sa.Column('id',          sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('gennis_id',   sa.Integer(),    nullable=False, unique=True),
        sa.Column('name',        sa.String(100),  nullable=True),
        sa.Column('eng_name',    sa.String(50),   nullable=True),
        sa.Column('order',       sa.Integer(),    nullable=True),
        sa.Column('location_id', sa.Integer(),    nullable=True),
        sa.Column('synced_at',   sa.DateTime(),   server_default=sa.text('now()')),
    )

    op.create_table(
        'gennis_group_room_week',
        sa.Column('id',                  sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('gennis_id',           sa.Integer(),    nullable=False, unique=True),
        sa.Column('group_gennis_id',     sa.Integer(),    nullable=True),
        sa.Column('room_gennis_id',      sa.Integer(),    nullable=True),
        sa.Column('week_gennis_id',      sa.Integer(),    nullable=True),
        sa.Column('location_id',         sa.Integer(),    nullable=True),
        sa.Column('start_time',          sa.String(20),   nullable=True),
        sa.Column('end_time',            sa.String(20),   nullable=True),
        sa.Column('group_name',          sa.String(255),  nullable=True),
        sa.Column('subject_name',        sa.String(255),  nullable=True),
        sa.Column('room_name',           sa.String(255),  nullable=True),
        sa.Column('week_name',           sa.String(100),  nullable=True),
        sa.Column('week_order',          sa.Integer(),    nullable=True),
        sa.Column('teacher_gennis_id',   sa.Integer(),    nullable=True),
        sa.Column('teacher_name',        sa.String(255),  nullable=True),
        sa.Column('teacher_surname',     sa.String(255),  nullable=True),
        sa.Column('assistent_gennis_id', sa.Integer(),    nullable=True),
        sa.Column('assistent_name',      sa.String(255),  nullable=True),
        sa.Column('synced_at',           sa.DateTime(),   server_default=sa.text('now()')),
    )

    op.create_table(
        'gennis_attendance',
        sa.Column('id',                       sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('gennis_id',                sa.Integer(),    nullable=True, unique=True),
        sa.Column('student_gennis_id',        sa.Integer(),    nullable=True),
        sa.Column('teacher_gennis_id',        sa.Integer(),    nullable=True),
        sa.Column('group_gennis_id',          sa.Integer(),    nullable=True),
        sa.Column('subject_gennis_id',        sa.Integer(),    nullable=True),
        sa.Column('location_id',              sa.Integer(),    nullable=True),
        sa.Column('calendar_month_gennis_id', sa.Integer(),    nullable=True),
        sa.Column('calendar_year_gennis_id',  sa.Integer(),    nullable=True),
        sa.Column('ball_percentage',          sa.Integer(),    nullable=True),
        sa.Column('synced_at',                sa.DateTime(),   server_default=sa.text('now()')),
    )

    op.create_table(
        'gennis_group_reason',
        sa.Column('id',        sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('gennis_id', sa.Integer(),    nullable=False, unique=True),
        sa.Column('reason',    sa.String(500),  nullable=True),
        sa.Column('synced_at', sa.DateTime(),   server_default=sa.text('now()')),
    )

    op.create_table(
        'gennis_teacher_group_statistics',
        sa.Column('id',                       sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('gennis_id',                sa.Integer(),    nullable=False, unique=True),
        sa.Column('teacher_gennis_id',        sa.Integer(),    nullable=True),
        sa.Column('reason_gennis_id',         sa.Integer(),    nullable=True),
        sa.Column('percentage',               sa.Integer(),    nullable=True),
        sa.Column('calendar_month_gennis_id', sa.Integer(),    nullable=True),
        sa.Column('calendar_year_gennis_id',  sa.Integer(),    nullable=True),
        sa.Column('number_students',          sa.Integer(),    nullable=True),
        sa.Column('synced_at',                sa.DateTime(),   server_default=sa.text('now()')),
    )

    op.create_table(
        'gennis_teacher_observation_day',
        sa.Column('id',                       sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('gennis_id',                sa.Integer(),    nullable=False, unique=True),
        sa.Column('teacher_gennis_id',        sa.Integer(),    nullable=True),
        sa.Column('group_gennis_id',          sa.Integer(),    nullable=True),
        sa.Column('calendar_day_gennis_id',   sa.Integer(),    nullable=True),
        sa.Column('calendar_month_gennis_id', sa.Integer(),    nullable=True),
        sa.Column('calendar_year_gennis_id',  sa.Integer(),    nullable=True),
        sa.Column('user_gennis_id',           sa.Integer(),    nullable=True),
        sa.Column('average',                  sa.Integer(),    nullable=True),
        sa.Column('synced_at',                sa.DateTime(),   server_default=sa.text('now()')),
    )

    op.create_table(
        'gennis_lesson_plan',
        sa.Column('id',                sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('gennis_id',         sa.Integer(),    nullable=False, unique=True),
        sa.Column('teacher_gennis_id', sa.Integer(),    nullable=True),
        sa.Column('group_gennis_id',   sa.Integer(),    nullable=True),
        sa.Column('ball',              sa.Integer(),    nullable=True),
        sa.Column('date',              sa.DateTime(),   nullable=True),
        sa.Column('synced_at',         sa.DateTime(),   server_default=sa.text('now()')),
    )

    op.create_table(
        'gennis_group_time',
        sa.Column('id',          sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('group_id',    sa.Integer(),    nullable=False),
        sa.Column('day_of_week', sa.Integer(),    nullable=False),
        sa.Column('start_time',  sa.String(5),    nullable=False),
        sa.Column('end_time',    sa.String(5),    nullable=True),
        sa.Column('room',        sa.String(100),  nullable=True),
        sa.Column('location_id', sa.Integer(),    nullable=True),
        sa.Column('created_at',  sa.DateTime(),   server_default=sa.text('now()')),
        sa.UniqueConstraint('group_id', 'day_of_week', name='uq_group_time_day'),
    )
    op.create_index('ix_ggt_group', 'gennis_group_time', ['group_id'])

    # Junction / association tables (no FK constraints — raw gennis IDs)
    op.create_table(
        'gennis_teacher_location',
        sa.Column('teacher_gennis_id', sa.Integer(), nullable=False),
        sa.Column('location_id',       sa.Integer(), nullable=False),
    )

    op.create_table(
        'gennis_teacher_subject_link',
        sa.Column('teacher_gennis_id', sa.Integer(), nullable=False),
        sa.Column('subject_gennis_id', sa.Integer(), nullable=False),
    )

    op.create_table(
        'gennis_teacher_group_link',
        sa.Column('teacher_gennis_id', sa.Integer(), nullable=False),
        sa.Column('group_gennis_id',   sa.Integer(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('gennis_teacher_group_link')
    op.drop_table('gennis_teacher_subject_link')
    op.drop_table('gennis_teacher_location')
    op.drop_index('ix_ggt_group', table_name='gennis_group_time')
    op.drop_table('gennis_group_time')
    op.drop_table('gennis_lesson_plan')
    op.drop_table('gennis_teacher_observation_day')
    op.drop_table('gennis_teacher_group_statistics')
    op.drop_table('gennis_group_reason')
    op.drop_table('gennis_attendance')
    op.drop_table('gennis_group_room_week')
    op.drop_table('gennis_week')
    op.drop_table('gennis_room')
    op.drop_table('gennis_assistent')
    op.drop_table('gennis_staff')
    op.drop_table('gennis_teacher')
    op.drop_table('gennis_user')
    op.drop_table('gennis_calendar_day')
    op.drop_table('gennis_calendar_month')
    op.drop_table('gennis_calendar_year')
    op.drop_table('gennis_role')
    op.drop_table('gennis_profession')
    op.drop_table('gennis_education_language')
    op.drop_table('gennis_location')
