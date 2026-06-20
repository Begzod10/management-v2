"""
SQLAlchemy models for tables owned by management-v2 inside the
management-v2 PostgreSQL database (DATABASE_URL_V2).

Migrations for these tables live in alembic_v2/.
Run:  alembic -c alembic_v2.ini upgrade head
"""
from sqlalchemy import BigInteger, Boolean, Column, Date, DateTime, Index, Integer, String
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
