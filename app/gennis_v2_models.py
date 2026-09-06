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
        Index("ix_gpr_status", "status"),
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

    # Review workflow — this row used to just sit here with nothing ever
    # reading it (no approval flow existed at all until this was added).
    # `reviewed_by`/`linked_user_id` are plain ids rather than ORM
    # relationships: this is BaseV2 (its own declarative base bound to a
    # separate alembic track — see the module docstring), so it can't
    # cross-reference `User` the way app/models.py's own bridge tables do.
    status         = Column(String(20), nullable=False, server_default="pending")  # pending | approved | rejected
    reviewed_by    = Column(BigInteger, nullable=True)   # user.id of the staff member who decided this
    reviewed_at    = Column(DateTime, nullable=True)
    linked_user_id = Column(BigInteger, nullable=True)   # user.id created for this parent, once approved


class ParentChildLink(BaseV2):
    """Maps a management user with role="parent" to one of their children.

    Lives here (BaseV2/alembic_v2), not in app/models.py's main `Base`,
    despite covering turon children too: the main `alembic/` track has no
    tracked migration history in this repo at all (gitignored, zero files
    ever committed) and isn't run by the deploy pipeline — alembic_v2 is
    the only migration track actually applied to production on every
    deploy (see .github/workflows/deploy.yml). A table only the main track
    knows how to create would need a manual one-off DDL run instead of
    shipping through the normal PR → merge → deploy flow.

    `child_ref_id` is deliberately the SAME id student_platform already sees
    when that child logs in themself — gennis_student.gennis_id for a gennis
    child, this same `user.id` for a turon child (turon has no separate id
    space, see student_platform.py's login docstring) — not our own
    internal PKs. That way this table can answer "who are this parent's
    children" directly in the id space the caller already has, with no
    translation step, and a mistake here fails obviously (wrong/missing
    child) rather than silently (right child, wrong id format).

    One row per child, so a parent with several children just gets several
    rows — there is no cap on how many. No ORM-level relationship to
    `User` (BaseV2 classes here never declare one — see the module
    docstring); `parent_user_id` is still a real FK at the DB level.

    No status/active flag: a child leaving the school has no automatic
    effect on this row (neither GennisStudent nor turon's Student row
    tracks "left" or a current branch to key off) — a staff-initiated
    delete is the only way a link ends. A branch TRANSFER needs no
    handling at all — attendance/payment records are per-group, not
    filtered by the child's current branch (see
    app/routers/v1/management/parent_registrations.py's
    delete_parent_child_link docstring for the full reasoning).

    Table name is `parent_child_link_v2`, not the plain `parent_child_link`
    every other docstring/comment/commit message in this feature refers to
    by that shorter name — a table with that exact name already exists in
    production (created 2026-07-29, 25 real rows, untracked by any
    migration or code in this repo, schema incompatible with this one:
    gennis-only, no `source` column). Caught before this migration ever
    ran anywhere, so renamed rather than colliding. That pre-existing
    table is left untouched pending its own investigation — see the
    migration file (alembic_v2/versions/e6f7a8b9c0d1_*.py) for the full
    story.
    """
    __tablename__ = "parent_child_link_v2"
    __table_args__ = (
        UniqueConstraint("parent_user_id", "source", "child_ref_id", name="uq_parent_child_link_v2"),
        Index("ix_pcl_v2_parent_user_id", "parent_user_id"),
    )

    id             = Column(BigInteger, primary_key=True, autoincrement=True)
    parent_user_id = Column(BigInteger, nullable=False)   # user.id (FK enforced in the migration, not the ORM)
    source         = Column(String(20), nullable=False)   # "gennis" | "turon"
    child_ref_id   = Column(Integer, nullable=False)      # gennis_student.gennis_id, or user.id for turon
    created_at     = Column(DateTime, server_default=func.now())


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


class LessonPlan(BaseV2):
    """Skeleton lesson plan created daily by Celery for each group with a lesson today.

    Maps to the `lesson_plan` table owned by gennis-v2 (created via gennis-v2's
    startup create_all). This side only inserts blank skeletons; teachers fill in
    the content through the gennis-v2 UI.
    """
    __tablename__ = "lesson_plan"
    __table_args__ = (
        UniqueConstraint("group_id", "year", "month", "day", name="uq_lesson_plan_group_date"),
    )

    id         = Column(BigInteger, primary_key=True, autoincrement=True)
    group_id   = Column(BigInteger, nullable=False)
    teacher_id = Column(BigInteger, nullable=False)
    year       = Column(String(4), nullable=False)
    month      = Column(String(2), nullable=False)
    day        = Column(String(2), nullable=False)
    date       = Column(Date, nullable=True)
    deleted    = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, server_default=func.now())
