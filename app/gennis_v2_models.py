"""
SQLAlchemy models for tables owned by management-v2 inside the
management-v2 PostgreSQL database (DATABASE_URL_V2).

Migrations for these tables live in alembic_v2/.
Run:  alembic -c alembic_v2.ini upgrade head
"""
from sqlalchemy import BigInteger, Boolean, Column, Date, DateTime, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.sql import func


class BaseV2(DeclarativeBase):
    pass


class GennisStudentPayment(BaseV2):
    __tablename__ = "gennis_student_payment"
    __table_args__ = (
        Index("ix_gsp_location_id", "location_id"),
        Index("ix_gsp_paid_date", "paid_date"),
        Index("ix_gsp_calendar", "calendar_year", "calendar_month"),
    )

    id              = Column(BigInteger, primary_key=True)
    student_id      = Column(Integer, nullable=True)
    student_name    = Column(String(511), nullable=True)
    location_id     = Column(Integer, nullable=True)
    payment_sum     = Column(BigInteger, nullable=False, default=0)
    channel         = Column(String(100), nullable=True)
    is_real_payment = Column(Boolean, nullable=False, default=True)
    paid_date       = Column(Date, nullable=True)
    calendar_month  = Column(Integer, nullable=True)
    calendar_year   = Column(Integer, nullable=True)
    synced_at       = Column(DateTime, server_default=func.now(), onupdate=func.now())


class GennisAttendanceHistoryStudent(BaseV2):
    __tablename__ = "gennis_attendance_history_student"
    __table_args__ = (
        Index("ix_gahs_location", "location_id"),
        Index("ix_gahs_student", "student_id"),
        Index("ix_gahs_calendar", "calendar_year", "calendar_month"),
        Index("ix_gahs_remaining_debt", "remaining_debt"),
    )

    id             = Column(BigInteger, primary_key=True, autoincrement=True)
    student_id     = Column(Integer, nullable=False)
    student_name   = Column(String(511), nullable=True)
    group_id       = Column(Integer, nullable=True)
    group_name     = Column(String(255), nullable=True)
    subject_id     = Column(Integer, nullable=True)
    total_debt     = Column(Integer, nullable=False, default=0)
    payment        = Column(Integer, nullable=False, default=0)
    remaining_debt = Column(Integer, nullable=False, default=0)
    total_discount = Column(Integer, nullable=False, default=0)
    location_id    = Column(Integer, nullable=True)
    calendar_month = Column(Integer, nullable=False)
    calendar_year  = Column(Integer, nullable=False)
    status         = Column(Boolean, nullable=False, default=False)
    synced_at      = Column(DateTime, server_default=func.now(), onupdate=func.now())


class GennisStudentCredit(BaseV2):
    __tablename__ = "gennis_student_credit"
    __table_args__ = (
        Index("ix_gsc_student", "student_id", unique=True),
    )

    id          = Column(Integer, primary_key=True, autoincrement=True)
    student_id  = Column(Integer, unique=True, nullable=False)
    location_id = Column(Integer, nullable=True)
    balance     = Column(BigInteger, nullable=False, default=0)
    updated_at  = Column(DateTime, server_default=func.now(), onupdate=func.now())


class GennisGroupTime(BaseV2):
    """Fixed weekly schedule for a group — one row per day slot."""
    __tablename__ = "gennis_group_time"
    __table_args__ = (
        UniqueConstraint("group_id", "day_of_week", name="uq_group_time_day"),
        Index("ix_ggt_group", "group_id"),
    )

    id          = Column(BigInteger, primary_key=True, autoincrement=True)
    group_id    = Column(Integer, nullable=False)
    day_of_week = Column(Integer, nullable=False)   # 0=Dushanba … 6=Yakshanba
    start_time  = Column(String(5), nullable=False)  # "14:00"
    end_time    = Column(String(5), nullable=True)   # "15:30"
    room        = Column(String(100), nullable=True)
    location_id = Column(Integer, nullable=True)
    created_at  = Column(DateTime, server_default=func.now())


class GennisStudentRegistration(BaseV2):
    """Self-service student registration submitted from the gennis-v2 app.

    Kept separate from gennis_student (a read-only sync mirror of the old
    gennis DB) because it carries fields — address, birth_day, password,
    shift, comment — that don't exist there.
    """
    __tablename__ = "gennis_student_registration"
    __table_args__ = (
        UniqueConstraint("username", name="uq_gsr_username"),
        Index("ix_gsr_location", "location_id"),
        Index("ix_gsr_phone", "phone"),
    )

    id              = Column(BigInteger, primary_key=True, autoincrement=True)
    name            = Column(String(255), nullable=False)
    surname         = Column(String(255), nullable=False)
    father_name     = Column(String(255), nullable=True)
    phone           = Column(String(50), nullable=False)
    parent_phone    = Column(String(50), nullable=True)
    address         = Column(String(500), nullable=True)
    birth_day       = Column(Date, nullable=True)
    comment         = Column(Text, nullable=True)
    username        = Column(String(100), nullable=False)
    password_hash   = Column(String(255), nullable=False)
    language_id     = Column(Integer, nullable=True)
    location_id     = Column(Integer, nullable=True)
    shift_id        = Column(Integer, nullable=True)
    shift_name      = Column(String(100), nullable=True)
    subjects        = Column(JSON, nullable=True)   # [{"id": 1, "name": "Mental arifmetika"}, ...]
    created_at      = Column(DateTime, server_default=func.now())


class GennisTeacherRegistration(BaseV2):
    """Self-service teacher registration submitted from the gennis-v2 app.

    Kept separate from gennis_teacher (a read-only sync mirror of the old
    gennis DB) because it carries fields — address, birth_day, password,
    comment — that don't exist there.
    """
    __tablename__ = "gennis_teacher_registration"
    __table_args__ = (
        UniqueConstraint("username", name="uq_gtr_username"),
        Index("ix_gtr_location", "location_id"),
        Index("ix_gtr_phone", "phone"),
    )

    id            = Column(BigInteger, primary_key=True, autoincrement=True)
    name          = Column(String(255), nullable=False)
    surname       = Column(String(255), nullable=False)
    father_name   = Column(String(255), nullable=True)
    phone         = Column(String(50), nullable=False)
    address       = Column(String(500), nullable=True)
    birth_day     = Column(Date, nullable=True)
    comment       = Column(Text, nullable=True)
    username      = Column(String(100), nullable=False)
    password_hash = Column(String(255), nullable=False)
    language_id   = Column(Integer, nullable=True)
    location_id   = Column(Integer, nullable=True)
    subjects      = Column(JSON, nullable=True)   # [{"id": 1, "name": "Mental arifmetika"}, ...]
    created_at    = Column(DateTime, server_default=func.now())


class GennisAssistantRegistration(BaseV2):
    """Self-service assistant registration submitted from the gennis-v2 app.

    Kept separate from gennis_assistent (a read-only sync mirror of the old
    gennis DB) because it carries fields — address, birth_day, password,
    comment — that don't exist there.
    """
    __tablename__ = "gennis_assistant_registration"
    __table_args__ = (
        UniqueConstraint("username", name="uq_gar_username"),
        Index("ix_gar_location", "location_id"),
        Index("ix_gar_phone", "phone"),
    )

    id            = Column(BigInteger, primary_key=True, autoincrement=True)
    name          = Column(String(255), nullable=False)
    surname       = Column(String(255), nullable=False)
    father_name   = Column(String(255), nullable=True)
    phone         = Column(String(50), nullable=False)
    address       = Column(String(500), nullable=True)
    birth_day     = Column(Date, nullable=True)
    comment       = Column(Text, nullable=True)
    username      = Column(String(100), nullable=False)
    password_hash = Column(String(255), nullable=False)
    language_id   = Column(Integer, nullable=True)
    location_id   = Column(Integer, nullable=True)
    teacher_id    = Column(Integer, nullable=True)   # gennis_teacher.gennis_id they'll assist
    created_at    = Column(DateTime, server_default=func.now())


class GennisParentRegistration(BaseV2):
    """Self-service parent registration submitted from the gennis-v2 app.

    Optionally links to an existing student (their child) by id; left NULL
    if the child isn't in the system yet — staff can link it later.
    """
    __tablename__ = "gennis_parent_registration"
    __table_args__ = (
        UniqueConstraint("username", name="uq_gpr_username"),
        Index("ix_gpr_phone", "phone"),
        Index("ix_gpr_student", "student_id"),
    )

    id            = Column(BigInteger, primary_key=True, autoincrement=True)
    name          = Column(String(255), nullable=False)
    surname       = Column(String(255), nullable=False)
    phone         = Column(String(50), nullable=False)
    address       = Column(String(500), nullable=True)
    comment       = Column(Text, nullable=True)
    username      = Column(String(100), nullable=False)
    password_hash = Column(String(255), nullable=False)
    student_id    = Column(Integer, nullable=True)   # gennis_student.id (their child), if known
    created_at    = Column(DateTime, server_default=func.now())


class GennisLessonAttendance(BaseV2):
    """Actual per-lesson attendance — one row per student per lesson date per group.

    Named gennis_lesson_attendance (not gennis_attendance) because that name is
    already taken by the wave2-synced teacher ball_percentage statistics table
    (see sync_wave2_tables.py / MgmtGennisAttendanceStat) — two unrelated
    features independently picked the same table name in parallel alembic_v2
    branches, and only the stats table's migration ever actually ran in
    production, so this table never existed until this migration.
    """
    __tablename__ = "gennis_lesson_attendance"
    __table_args__ = (
        UniqueConstraint("group_id", "student_id", "lesson_date", name="uq_gennis_lesson_attendance"),
        Index("ix_gla_group_date", "group_id", "lesson_date"),
        Index("ix_gla_student", "student_id"),
        Index("ix_gla_location", "location_id"),
    )

    id          = Column(BigInteger, primary_key=True, autoincrement=True)
    group_id    = Column(Integer, nullable=False)
    student_id  = Column(Integer, nullable=False)
    lesson_date = Column(Date, nullable=False)
    came        = Column(Boolean, nullable=False, default=True)
    note        = Column(String(255), nullable=True)
    teacher_id  = Column(BigInteger, nullable=True)
    location_id = Column(Integer, nullable=True)
    created_at  = Column(DateTime, server_default=func.now())
