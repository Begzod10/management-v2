"""add gennis sync wave2 tables

Revision ID: b1c2d3e4f5a6
Revises: 59cfa0718ffa
Create Date: 2026-06-29 00:00:00.000000

Wave 2: locations, users, teachers, staff, assistent, rooms, timetable,
calendar, professions, roles, education languages + statistics tables.
These are synced from the old gennis DB by management-v2 sync jobs.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, Sequence[str], None] = '59cfa0718ffa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Lookup tables ──────────────────────────────────────────────────────────
    op.create_table(
        'gennis_location',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('gennis_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=True),
        sa.Column('code', sa.Integer(), nullable=True),
        sa.Column('address', sa.String(500), nullable=True),
        sa.Column('synced_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('gennis_id'),
    )
    op.create_index('ix_gennis_location_id', 'gennis_location', ['id'])

    op.create_table(
        'gennis_education_language',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('gennis_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('synced_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('gennis_id'),
    )
    op.create_index('ix_gennis_education_language_id', 'gennis_education_language', ['id'])

    op.create_table(
        'gennis_profession',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('gennis_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('synced_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('gennis_id'),
    )
    op.create_index('ix_gennis_profession_id', 'gennis_profession', ['id'])

    op.create_table(
        'gennis_role',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('gennis_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(100), nullable=True),
        sa.Column('type_role', sa.String(100), nullable=True),
        sa.Column('synced_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('gennis_id'),
    )
    op.create_index('ix_gennis_role_id', 'gennis_role', ['id'])

    # ── Calendar ───────────────────────────────────────────────────────────────
    op.create_table(
        'gennis_calendar_year',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('gennis_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.DateTime(), nullable=True),
        sa.Column('synced_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('gennis_id'),
    )
    op.create_index('ix_gennis_calendar_year_id', 'gennis_calendar_year', ['id'])

    op.create_table(
        'gennis_calendar_month',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('gennis_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.DateTime(), nullable=True),
        sa.Column('year_gennis_id', sa.Integer(), nullable=True),
        sa.Column('synced_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('gennis_id'),
    )
    op.create_index('ix_gennis_calendar_month_id', 'gennis_calendar_month', ['id'])
    op.create_index('ix_gcm_year', 'gennis_calendar_month', ['year_gennis_id'])

    op.create_table(
        'gennis_calendar_day',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('gennis_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.DateTime(), nullable=True),
        sa.Column('synced_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('gennis_id'),
    )
    op.create_index('ix_gennis_calendar_day_id', 'gennis_calendar_day', ['id'])

    # ── Users / People ─────────────────────────────────────────────────────────
    op.create_table(
        'gennis_user',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('gennis_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=True),
        sa.Column('surname', sa.String(255), nullable=True),
        sa.Column('father_name', sa.String(255), nullable=True),
        sa.Column('username', sa.String(100), nullable=True),
        sa.Column('age', sa.Integer(), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('role_id', sa.Integer(), nullable=True),
        sa.Column('education_language_id', sa.Integer(), nullable=True),
        sa.Column('photo_profile', sa.String(500), nullable=True),
        sa.Column('balance', sa.Integer(), nullable=True),
        sa.Column('deleted', sa.Boolean(), nullable=True, default=False),
        sa.Column('level', sa.Integer(), nullable=True),
        sa.Column('calendar_day_gennis_id', sa.Integer(), nullable=True),
        sa.Column('synced_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('gennis_id'),
    )
    op.create_index('ix_gennis_user_id', 'gennis_user', ['id'])
    op.create_index('ix_gu_location', 'gennis_user', ['location_id'])

    op.create_table(
        'gennis_teacher',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('gennis_id', sa.Integer(), nullable=False),
        sa.Column('user_gennis_id', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(255), nullable=True),
        sa.Column('surname', sa.String(255), nullable=True),
        sa.Column('username', sa.String(100), nullable=True),
        sa.Column('age', sa.Integer(), nullable=True),
        sa.Column('photo_profile', sa.String(500), nullable=True),
        sa.Column('language_name', sa.String(100), nullable=True),
        sa.Column('table_color', sa.String(50), nullable=True),
        sa.Column('total_students', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
        sa.Column('reg_date', sa.DateTime(), nullable=True),
        sa.Column('synced_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('gennis_id'),
    )
    op.create_index('ix_gennis_teacher_id', 'gennis_teacher', ['id'])
    op.create_index('ix_gt_is_active', 'gennis_teacher', ['is_active'])

    op.create_table(
        'gennis_staff',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('gennis_id', sa.Integer(), nullable=False),
        sa.Column('user_gennis_id', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(255), nullable=True),
        sa.Column('surname', sa.String(255), nullable=True),
        sa.Column('username', sa.String(100), nullable=True),
        sa.Column('age', sa.Integer(), nullable=True),
        sa.Column('photo_profile', sa.String(500), nullable=True),
        sa.Column('language_name', sa.String(100), nullable=True),
        sa.Column('role_name', sa.String(100), nullable=True),
        sa.Column('type_role', sa.String(100), nullable=True),
        sa.Column('profession_id', sa.Integer(), nullable=True),
        sa.Column('profession_name', sa.String(255), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('level', sa.Integer(), nullable=True),
        sa.Column('deleted', sa.Boolean(), nullable=True, default=False),
        sa.Column('deleted_comment', sa.String(500), nullable=True),
        sa.Column('reg_date', sa.DateTime(), nullable=True),
        sa.Column('synced_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('gennis_id'),
    )
    op.create_index('ix_gennis_staff_id', 'gennis_staff', ['id'])
    op.create_index('ix_gs_location', 'gennis_staff', ['location_id'])

    op.create_table(
        'gennis_assistent',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('gennis_id', sa.Integer(), nullable=False),
        sa.Column('user_gennis_id', sa.Integer(), nullable=True),
        sa.Column('teacher_gennis_id', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(255), nullable=True),
        sa.Column('surname', sa.String(255), nullable=True),
        sa.Column('username', sa.String(100), nullable=True),
        sa.Column('age', sa.Integer(), nullable=True),
        sa.Column('photo_profile', sa.String(500), nullable=True),
        sa.Column('language_name', sa.String(100), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('deleted', sa.Boolean(), nullable=True, default=False),
        sa.Column('synced_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('gennis_id'),
    )
    op.create_index('ix_gennis_assistent_id', 'gennis_assistent', ['id'])
    op.create_index('ix_ga_location', 'gennis_assistent', ['location_id'])

    # ── Rooms / Timetable ──────────────────────────────────────────────────────
    op.create_table(
        'gennis_room',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('gennis_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=True),
        sa.Column('capacity', sa.Integer(), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('deleted', sa.Boolean(), nullable=True, default=False),
        sa.Column('synced_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('gennis_id'),
    )
    op.create_index('ix_gennis_room_id', 'gennis_room', ['id'])

    op.create_table(
        'gennis_week',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('gennis_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=True),
        sa.Column('eng_name', sa.String(50), nullable=True),
        sa.Column('order', sa.Integer(), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('synced_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('gennis_id'),
    )
    op.create_index('ix_gennis_week_id', 'gennis_week', ['id'])

    op.create_table(
        'gennis_group_room_week',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('gennis_id', sa.Integer(), nullable=False),
        sa.Column('group_gennis_id', sa.Integer(), nullable=True),
        sa.Column('room_gennis_id', sa.Integer(), nullable=True),
        sa.Column('week_gennis_id', sa.Integer(), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('start_time', sa.String(20), nullable=True),
        sa.Column('end_time', sa.String(20), nullable=True),
        sa.Column('group_name', sa.String(255), nullable=True),
        sa.Column('subject_name', sa.String(255), nullable=True),
        sa.Column('room_name', sa.String(255), nullable=True),
        sa.Column('week_name', sa.String(100), nullable=True),
        sa.Column('week_order', sa.Integer(), nullable=True),
        sa.Column('teacher_gennis_id', sa.Integer(), nullable=True),
        sa.Column('teacher_name', sa.String(255), nullable=True),
        sa.Column('teacher_surname', sa.String(255), nullable=True),
        sa.Column('assistent_gennis_id', sa.Integer(), nullable=True),
        sa.Column('assistent_name', sa.String(255), nullable=True),
        sa.Column('synced_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('gennis_id'),
    )
    op.create_index('ix_gennis_group_room_week_id', 'gennis_group_room_week', ['id'])
    op.create_index('ix_ggrw_location', 'gennis_group_room_week', ['location_id'])
    op.create_index('ix_ggrw_week', 'gennis_group_room_week', ['week_gennis_id'])
    op.create_index('ix_ggrw_teacher', 'gennis_group_room_week', ['teacher_gennis_id'])

    # ── Teacher junction tables ────────────────────────────────────────────────
    op.create_table(
        'gennis_teacher_location',
        sa.Column('teacher_gennis_id', sa.Integer(), nullable=False),
        sa.Column('location_id', sa.Integer(), nullable=False),
        sa.UniqueConstraint('teacher_gennis_id', 'location_id', name='uq_gtl_teacher_location'),
    )
    op.create_index('ix_gtl_location', 'gennis_teacher_location', ['location_id'])

    op.create_table(
        'gennis_teacher_subject_link',
        sa.Column('teacher_gennis_id', sa.Integer(), nullable=False),
        sa.Column('subject_gennis_id', sa.Integer(), nullable=False),
        sa.UniqueConstraint('teacher_gennis_id', 'subject_gennis_id', name='uq_gtsl_teacher_subject'),
    )

    op.create_table(
        'gennis_teacher_group_link',
        sa.Column('teacher_gennis_id', sa.Integer(), nullable=False),
        sa.Column('group_gennis_id', sa.Integer(), nullable=False),
        sa.UniqueConstraint('teacher_gennis_id', 'group_gennis_id', name='uq_gtgl_teacher_group'),
    )

    # ── Statistics tables ──────────────────────────────────────────────────────
    # Drop old gennis_attendance if it exists with the legacy came/lesson_date schema
    op.execute(text("DROP INDEX IF EXISTS ix_ga_group_date"))
    op.execute(text("DROP INDEX IF EXISTS ix_ga_student"))
    op.execute(text("DROP INDEX IF EXISTS ix_ga_location"))
    op.execute(text("DROP TABLE IF EXISTS gennis_attendance CASCADE"))
    op.create_table(
        'gennis_attendance',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('gennis_id', sa.Integer(), nullable=False),
        sa.Column('student_gennis_id', sa.Integer(), nullable=True),
        sa.Column('teacher_gennis_id', sa.Integer(), nullable=True),
        sa.Column('group_gennis_id', sa.Integer(), nullable=True),
        sa.Column('subject_gennis_id', sa.Integer(), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('calendar_month_gennis_id', sa.Integer(), nullable=True),
        sa.Column('calendar_year_gennis_id', sa.Integer(), nullable=True),
        sa.Column('ball_percentage', sa.Integer(), nullable=True),
        sa.Column('synced_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('gennis_id'),
    )
    op.create_index('ix_gennis_attendance_id', 'gennis_attendance', ['id'])
    op.create_index('ix_ga_teacher', 'gennis_attendance', ['teacher_gennis_id'])
    op.create_index('ix_ga_calendar', 'gennis_attendance', ['calendar_year_gennis_id', 'calendar_month_gennis_id'])

    op.create_table(
        'gennis_group_reason',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('gennis_id', sa.Integer(), nullable=False),
        sa.Column('reason', sa.String(500), nullable=True),
        sa.Column('synced_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('gennis_id'),
    )
    op.create_index('ix_gennis_group_reason_id', 'gennis_group_reason', ['id'])

    op.create_table(
        'gennis_teacher_group_statistics',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('gennis_id', sa.Integer(), nullable=False),
        sa.Column('teacher_gennis_id', sa.Integer(), nullable=True),
        sa.Column('reason_gennis_id', sa.Integer(), nullable=True),
        sa.Column('percentage', sa.Integer(), nullable=True),
        sa.Column('calendar_month_gennis_id', sa.Integer(), nullable=True),
        sa.Column('calendar_year_gennis_id', sa.Integer(), nullable=True),
        sa.Column('number_students', sa.Integer(), nullable=True),
        sa.Column('synced_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('gennis_id'),
    )
    op.create_index('ix_gennis_tgs_id', 'gennis_teacher_group_statistics', ['id'])
    op.create_index('ix_gtgs_teacher', 'gennis_teacher_group_statistics', ['teacher_gennis_id'])

    op.create_table(
        'gennis_teacher_observation_day',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('gennis_id', sa.Integer(), nullable=False),
        sa.Column('teacher_gennis_id', sa.Integer(), nullable=True),
        sa.Column('group_gennis_id', sa.Integer(), nullable=True),
        sa.Column('calendar_day_gennis_id', sa.Integer(), nullable=True),
        sa.Column('calendar_month_gennis_id', sa.Integer(), nullable=True),
        sa.Column('calendar_year_gennis_id', sa.Integer(), nullable=True),
        sa.Column('user_gennis_id', sa.Integer(), nullable=True),
        sa.Column('average', sa.Integer(), nullable=True),
        sa.Column('synced_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('gennis_id'),
    )
    op.create_index('ix_gennis_tod_id', 'gennis_teacher_observation_day', ['id'])
    op.create_index('ix_gtod_teacher', 'gennis_teacher_observation_day', ['teacher_gennis_id'])

    op.create_table(
        'gennis_lesson_plan',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('gennis_id', sa.Integer(), nullable=False),
        sa.Column('teacher_gennis_id', sa.Integer(), nullable=True),
        sa.Column('group_gennis_id', sa.Integer(), nullable=True),
        sa.Column('ball', sa.Integer(), nullable=True),
        sa.Column('date', sa.DateTime(), nullable=True),
        sa.Column('synced_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('gennis_id'),
    )
    op.create_index('ix_gennis_lesson_plan_id', 'gennis_lesson_plan', ['id'])
    op.create_index('ix_glp_teacher', 'gennis_lesson_plan', ['teacher_gennis_id'])
    op.create_index('ix_glp_date', 'gennis_lesson_plan', ['date'])


def downgrade() -> None:
    op.drop_table('gennis_lesson_plan')
    op.drop_table('gennis_teacher_observation_day')
    op.drop_table('gennis_teacher_group_statistics')
    op.drop_table('gennis_group_reason')
    op.drop_table('gennis_attendance')
    op.drop_table('gennis_teacher_group_link')
    op.drop_table('gennis_teacher_subject_link')
    op.drop_table('gennis_teacher_location')
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
