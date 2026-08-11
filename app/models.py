from datetime import datetime
from sqlalchemy import Column, BigInteger, String, Date, DateTime, ForeignKey, Boolean, Integer, Text, Table, UniqueConstraint, Float
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class Job(Base):
    __tablename__ = "job"

    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    desc = Column(String(255), nullable=False)
    deleted = Column(Boolean, nullable=False, default=False)

    users = relationship("User", back_populates="job")

class User(Base):
    __tablename__ = "user"

    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    surname = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=True, index=True)
    born_date = Column(Date, nullable=True)
    password = Column(String(255), nullable=True)
    hashed_password = Column(String(255), nullable=True)
    age = Column(BigInteger, nullable=True)
    job_id = Column(BigInteger, ForeignKey("job.id"), nullable=True)
    google_id = Column(String(255), unique=True, nullable=True, index=True)
    is_active = Column(Boolean, nullable=False, default=True)
    role = Column(String(50), nullable=False, default="user")
    deleted = Column(Boolean, nullable=False, default=False)
    timezone = Column(String(100), nullable=False, default="Asia/Tashkent")
    auth_provider = Column(String(50), nullable=False, default="email")
    profile_photo_url = Column(String(500), nullable=True)
    is_verified = Column(Boolean, nullable=False, default=False)
    failed_login_attempts = Column(Integer, nullable=False, default=0)
    locked_until = Column(DateTime, nullable=True)
    last_login = Column(DateTime, nullable=True)
    last_logout_at = Column(DateTime, nullable=True)
    telegram_id = Column(BigInteger, unique=True, nullable=True, index=True)
    username = Column(String(100), unique=True, nullable=True, index=True)
    salary = Column(BigInteger, nullable=True, default=0)
    crm_username = Column(String(100), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, nullable=True)

    job = relationship("Job", back_populates="users")
    salary_months = relationship("SalaryMonth", back_populates="user")
    salary_days = relationship("SalaryDay", back_populates="user")
    project_memberships = relationship("ProjectMember", foreign_keys="ProjectMember.user_id", back_populates="user")
    section_memberships = relationship("SectionMember", foreign_keys="SectionMember.user_id", back_populates="user")
    extra_roles = relationship("UserRole", foreign_keys="UserRole.user_id", back_populates="user")
    teaching_groups   = relationship("GennisGroup", foreign_keys="GennisGroup.teacher_mgmt_id",   back_populates="teacher")
    assisting_groups  = relationship("GennisGroup", foreign_keys="GennisGroup.assistent_mgmt_id", back_populates="assistent")
    subjects          = relationship("GennisSubject", secondary="gennis_teacher_subject", back_populates="teachers")

    @property
    def is_locked(self) -> bool:
        return self.locked_until is not None and self.locked_until > datetime.utcnow()


Person = User


class SalaryMonth(Base):
    __tablename__ = "salary_month"

    id = Column(BigInteger, primary_key=True, index=True)
    salary = Column(BigInteger, nullable=False)
    taken_salary = Column(BigInteger, nullable=False, default=0)
    remaining_salary = Column(BigInteger, nullable=False, default=0)
    user_id = Column(BigInteger, ForeignKey("user.id"), nullable=False)
    date = Column(Date, nullable=False)
    deleted = Column(Boolean, nullable=False, default=False)

    user = relationship("User", back_populates="salary_months")
    salary_days = relationship("SalaryDay", back_populates="salary_month")


class SalaryDay(Base):
    __tablename__ = "salary_day"

    id = Column(BigInteger, primary_key=True, index=True)
    salary_month_id = Column(BigInteger, ForeignKey("salary_month.id"), nullable=False)
    amount = Column(BigInteger, nullable=False)
    user_id = Column(BigInteger, ForeignKey("user.id"), nullable=False)
    date = Column(Date, nullable=False)
    payment_type = Column(String(255), nullable=False)
    deleted = Column(Boolean, nullable=False, default=False)

    salary_month = relationship("SalaryMonth", back_populates="salary_days")
    user = relationship("User", back_populates="salary_days")


# ── Project module ────────────────────────────────────────────────────────────

class Project(Base):
    __tablename__ = "project"

    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    manager_id = Column(BigInteger, ForeignKey("user.id"), nullable=False)
    description = Column(Text, nullable=True)
    deleted = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, server_default=func.now())

    manager = relationship("User", foreign_keys=[manager_id])
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    missions = relationship("Mission", back_populates="project")


class ProjectMember(Base):
    __tablename__ = "project_member"

    id = Column(BigInteger, primary_key=True, index=True)
    project_id = Column(BigInteger, ForeignKey("project.id"), nullable=False)
    user_id = Column(BigInteger, ForeignKey("user.id"), nullable=False)

    __table_args__ = (UniqueConstraint("project_id", "user_id"),)

    project = relationship("Project", back_populates="members")
    user = relationship("User", back_populates="project_memberships")


# ── Mission module ────────────────────────────────────────────────────────────

class SystemModel(Base):
    __tablename__ = "system_model"

    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    desc = Column(String(255), nullable=True)
    deleted = Column(Boolean, nullable=False, default=False)

    branches = relationship("Branch", back_populates="system_model")


class Branch(Base):
    __tablename__ = "branch"

    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    system_model_id = Column(BigInteger, ForeignKey("system_model.id"), nullable=True)
    deleted = Column(Boolean, nullable=False, default=False)

    system_model = relationship("SystemModel", back_populates="branches")


class Tag(Base):
    __tablename__ = "tag"

    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    deleted = Column(Boolean, nullable=False, default=False)

    missions = relationship("Mission", secondary="mission_tag", back_populates="tags")


mission_tag = Table(
    "mission_tag",
    Base.metadata,
    Column("mission_id", BigInteger, ForeignKey("mission.id"), primary_key=True),
    Column("tag_id", BigInteger, ForeignKey("tag.id"), primary_key=True),
)


class Mission(Base):
    __tablename__ = "mission"

    id = Column(BigInteger, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    final_sc = Column(Integer, default=0)
    description = Column(Text, nullable=True)
    category = Column(String(50), default="academic")

    creator_id = Column(BigInteger, ForeignKey("user.id"), nullable=False)
    executor_id = Column(BigInteger, ForeignKey("user.id"), nullable=False)
    reviewer_id = Column(BigInteger, ForeignKey("user.id"), nullable=True)
    original_executor_id = Column(BigInteger, ForeignKey("user.id"), nullable=True)
    redirected_by_id = Column(BigInteger, ForeignKey("user.id"), nullable=True)

    is_redirected = Column(Boolean, default=False)
    redirected_at = Column(DateTime, nullable=True)

    branch_id = Column(BigInteger, nullable=True)
    branch_name = Column(String(255), nullable=True)
    system_id = Column(BigInteger, ForeignKey("system_model.id"), nullable=True)
    location_id = Column(Integer, nullable=True)   # Gennis location ID for routing
    location_name = Column(String(255), nullable=True)

    channel = Column(String(30), default="line_management", nullable=False)
    project_id = Column(BigInteger, ForeignKey("project.id"), nullable=True)
    section_id = Column(BigInteger, ForeignKey("section.id"), nullable=True)
    approval_status = Column(String(20), nullable=True)
    approved_by_id = Column(BigInteger, ForeignKey("user.id"), nullable=True)
    gennis_executor_id = Column(Integer, nullable=True)
    gennis_executor_name = Column(String(255), nullable=True)
    gennis_reviewer_id = Column(Integer, nullable=True)
    gennis_reviewer_name = Column(String(255), nullable=True)
    turon_executor_id = Column(BigInteger, nullable=True)
    turon_executor_name = Column(String(255), nullable=True)
    turon_reviewer_id = Column(BigInteger, nullable=True)
    turon_reviewer_name = Column(String(255), nullable=True)

    start_date = Column(Date, server_default=func.current_date())
    deadline = Column(Date, nullable=False)
    finish_date = Column(Date, nullable=True)
    approved_date = Column(Date, nullable=True)

    status = Column(String(30), default="not_started")

    kpi_weight = Column(Integer, default=10)
    penalty_per_day = Column(Integer, default=2)
    early_bonus_per_day = Column(Integer, default=1)
    max_bonus = Column(Integer, default=3)
    max_penalty = Column(Integer, default=10)
    delay_days = Column(Integer, default=0)

    is_recurring = Column(Boolean, default=False)
    recurring_type = Column(String(20), nullable=True)
    repeat_every = Column(Integer, default=1)
    last_generated = Column(Date, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    deleted = Column(Boolean, nullable=False, default=False)

    creator = relationship("User", foreign_keys=[creator_id])
    executor = relationship("User", foreign_keys=[executor_id])
    reviewer = relationship("User", foreign_keys=[reviewer_id])
    original_executor = relationship("User", foreign_keys=[original_executor_id])
    redirected_by = relationship("User", foreign_keys=[redirected_by_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    system_model = relationship("SystemModel", foreign_keys=[system_id])
    project = relationship("Project", back_populates="missions")
    tags = relationship("Tag", secondary="mission_tag", back_populates="missions")
    subtasks = relationship("MissionSubtask", back_populates="mission", cascade="all, delete-orphan")
    attachments = relationship("MissionAttachment", back_populates="mission", cascade="all, delete-orphan")
    comments = relationship("MissionComment", back_populates="mission", cascade="all, delete-orphan")
    proofs = relationship("MissionProof", back_populates="mission", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="mission")

    def calculate_delay_days(self):
        if self.finish_date and self.deadline:
            self.delay_days = (self.finish_date - self.deadline).days
        else:
            self.delay_days = 0
        return self.delay_days

    def final_score(self):
        delay = self.delay_days
        base = self.kpi_weight
        if delay < 0:
            bonus = min(abs(delay) * self.early_bonus_per_day, self.max_bonus)
            return base + bonus
        if delay == 0:
            return base
        penalty = min(delay * self.penalty_per_day, self.max_penalty)
        return max(0, base - penalty)


class MissionSubtask(Base):
    __tablename__ = "mission_subtask"

    id = Column(BigInteger, primary_key=True, index=True)
    mission_id = Column(BigInteger, ForeignKey("mission.id"), nullable=False)
    creator_id = Column(BigInteger, ForeignKey("user.id"), nullable=True)
    executor_id = Column(BigInteger, ForeignKey("user.id"), nullable=True)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_done = Column(Boolean, default=False)
    order = Column(Integer, default=0)
    status = Column(String(30), default="not_started")

    start_date = Column(Date, server_default=func.current_date(), nullable=True)
    deadline = Column(Date, nullable=True)
    finish_date = Column(Date, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    deleted = Column(Boolean, nullable=False, default=False)

    mission = relationship("Mission", back_populates="subtasks")
    creator = relationship("User", foreign_keys=[creator_id])
    executor = relationship("User", foreign_keys=[executor_id])
    comments = relationship("MissionSubtaskComment", back_populates="subtask", cascade="all, delete-orphan")
    attachments = relationship("MissionSubtaskAttachment", back_populates="subtask", cascade="all, delete-orphan")
    proofs = relationship("MissionSubtaskProof", back_populates="subtask", cascade="all, delete-orphan")


class MissionSubtaskComment(Base):
    __tablename__ = "mission_subtask_comment"

    id = Column(BigInteger, primary_key=True, index=True)
    subtask_id = Column(BigInteger, ForeignKey("mission_subtask.id"), nullable=False)
    user_id = Column(BigInteger, ForeignKey("user.id"), nullable=True)
    text = Column(Text, nullable=False)
    attachment = Column(String(500), nullable=True)
    creator_name = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    deleted = Column(Boolean, nullable=False, default=False)

    subtask = relationship("MissionSubtask", back_populates="comments")
    user = relationship("User")


class MissionSubtaskAttachment(Base):
    __tablename__ = "mission_subtask_attachment"

    id = Column(BigInteger, primary_key=True, index=True)
    subtask_id = Column(BigInteger, ForeignKey("mission_subtask.id"), nullable=False)
    file = Column(String(500), nullable=False)
    uploaded_at = Column(DateTime, server_default=func.now())
    note = Column(String(255), nullable=True)
    creator_name = Column(String(255), nullable=True)
    deleted = Column(Boolean, nullable=False, default=False)

    subtask = relationship("MissionSubtask", back_populates="attachments")


class MissionSubtaskProof(Base):
    __tablename__ = "mission_subtask_proof"

    id = Column(BigInteger, primary_key=True, index=True)
    subtask_id = Column(BigInteger, ForeignKey("mission_subtask.id"), nullable=False)
    file = Column(String(500), nullable=False)
    comment = Column(String(255), nullable=True)
    creator_name = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    deleted = Column(Boolean, nullable=False, default=False)

    subtask = relationship("MissionSubtask", back_populates="proofs")


class MissionAttachment(Base):
    __tablename__ = "mission_attachment"

    id = Column(BigInteger, primary_key=True, index=True)
    mission_id = Column(BigInteger, ForeignKey("mission.id"), nullable=False)
    file = Column(String(500), nullable=False)
    uploaded_at = Column(DateTime, server_default=func.now())
    note = Column(String(255), nullable=True)
    creator_name = Column(String(255), nullable=True)
    deleted = Column(Boolean, nullable=False, default=False)

    mission = relationship("Mission", back_populates="attachments")


class MissionComment(Base):
    __tablename__ = "mission_comment"

    id = Column(BigInteger, primary_key=True, index=True)
    mission_id = Column(BigInteger, ForeignKey("mission.id"), nullable=False)
    user_id = Column(BigInteger, ForeignKey("user.id"), nullable=True)
    text = Column(Text, nullable=False)
    attachment = Column(String(500), nullable=True)
    creator_name = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    deleted = Column(Boolean, nullable=False, default=False)

    mission = relationship("Mission", back_populates="comments")
    user = relationship("User")


class MissionProof(Base):
    __tablename__ = "mission_proof"

    id = Column(BigInteger, primary_key=True, index=True)
    mission_id = Column(BigInteger, ForeignKey("mission.id"), nullable=False)
    file = Column(String(500), nullable=False)
    comment = Column(String(255), nullable=True)
    creator_name = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    deleted = Column(Boolean, nullable=False, default=False)

    mission = relationship("Mission", back_populates="proofs")


class MissionHistory(Base):
    __tablename__ = "mission_history"

    id = Column(BigInteger, primary_key=True, index=True)
    mission_id = Column(BigInteger, ForeignKey("mission.id"), nullable=False)
    changed_by_id = Column(BigInteger, ForeignKey("user.id"), nullable=True)
    executor_id = Column(BigInteger, ForeignKey("user.id"), nullable=True)
    reviewer_id = Column(BigInteger, ForeignKey("user.id"), nullable=True)
    gennis_executor_id = Column(Integer, nullable=True)
    gennis_executor_name = Column(String(255), nullable=True)
    gennis_reviewer_id = Column(Integer, nullable=True)
    gennis_reviewer_name = Column(String(255), nullable=True)
    turon_executor_id = Column(BigInteger, nullable=True)
    turon_executor_name = Column(String(255), nullable=True)
    turon_reviewer_id = Column(BigInteger, nullable=True)
    turon_reviewer_name = Column(String(255), nullable=True)
    note = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    mission = relationship("Mission", foreign_keys=[mission_id])
    changed_by = relationship("User", foreign_keys=[changed_by_id])
    executor = relationship("User", foreign_keys=[executor_id])
    reviewer = relationship("User", foreign_keys=[reviewer_id])


class Section(Base):
    __tablename__ = "section"

    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    leader_id = Column(BigInteger, ForeignKey("user.id"), nullable=True)
    deleted = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, server_default=func.now())

    leader = relationship("User", foreign_keys=[leader_id])
    members = relationship("SectionMember", back_populates="section", cascade="all, delete-orphan")


class SectionMember(Base):
    __tablename__ = "section_member"

    id = Column(BigInteger, primary_key=True, index=True)
    section_id = Column(BigInteger, ForeignKey("section.id"), nullable=False)
    user_id = Column(BigInteger, ForeignKey("user.id"), nullable=False)

    __table_args__ = (UniqueConstraint("section_id", "user_id"),)

    section = relationship("Section", back_populates="members")
    user = relationship("User", back_populates="section_memberships")


class Dividend(Base):
    __tablename__ = "dividend"

    id = Column(BigInteger, primary_key=True, index=True)
    amount = Column(BigInteger, nullable=False)
    source = Column(String(50), nullable=False)  # "gennis" or "turon"
    date = Column(Date, nullable=False)
    description = Column(Text, nullable=True)
    payment_type = Column(String(255), nullable=True)
    location_id = Column(Integer, nullable=True)   # Gennis: links to Gennis locations
    branch_id = Column(BigInteger, nullable=True)  # Turon: links to Turon branches
    deleted = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, server_default=func.now())


class Investment(Base):
    __tablename__ = "investment"

    id = Column(BigInteger, primary_key=True, index=True)
    amount = Column(BigInteger, nullable=False)
    source = Column(String(50), nullable=False)  # "gennis" or "turon"
    date = Column(Date, nullable=False)
    description = Column(Text, nullable=True)
    payment_type = Column(String(255), nullable=True)
    location_id = Column(Integer, nullable=True)   # Gennis: links to Gennis locations
    branch_id = Column(BigInteger, nullable=True)  # Turon: links to Turon branches
    deleted = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, server_default=func.now())


class Notification(Base):
    __tablename__ = "notification"

    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(BigInteger, ForeignKey("user.id"), nullable=False)
    mission_id = Column(BigInteger, ForeignKey("mission.id"), nullable=True)
    message = Column(Text, nullable=False)
    role = Column(String(20), nullable=False)
    deadline = Column(Date, nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    deleted = Column(Boolean, nullable=False, default=False)

    user = relationship("User")
    mission = relationship("Mission", back_populates="notifications")


class OverheadType(Base):
    __tablename__ = "overhead_type"

    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    cost = Column(BigInteger, nullable=True)
    changeable = Column(Boolean, default=True, nullable=False)
    deleted = Column(Boolean, default=False, nullable=False)


class ApiLog(Base):
    __tablename__ = "api_log"

    id = Column(BigInteger, primary_key=True, index=True)
    method = Column(String(10), nullable=False)
    path = Column(String(500), nullable=False, index=True)
    status_code = Column(Integer, nullable=True)
    user_id = Column(BigInteger, nullable=True, index=True)
    response_time_ms = Column(Float, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), index=True)


class BranchLoan(Base):
    """A loan agreement (branch-level). Each loan is a long-lived agreement
    settled by one or more BranchLoanTransaction rows on the source side."""
    __tablename__ = "branch_loan"

    id = Column(BigInteger, primary_key=True, index=True)
    source = Column(String(50), nullable=False)  # 'gennis' or 'turon'
    location_id = Column(Integer, nullable=True)   # Gennis: locations.id
    branch_id = Column(BigInteger, nullable=True)  # Turon: branch.id

    # Counterparty: either a User in the source system, or a manual name
    counterparty_user_id = Column(BigInteger, nullable=True)
    counterparty_name = Column(String(255), nullable=True)
    counterparty_surname = Column(String(255), nullable=True)
    counterparty_phone = Column(String(50), nullable=True)

    direction = Column(String(8), nullable=False)  # 'out' branch lent | 'in' branch borrowed
    principal_amount = Column(BigInteger, nullable=False)
    payment_type = Column(String(50), nullable=True)  # for the disbursement transaction

    issued_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=True)
    settled_date = Column(Date, nullable=True)

    reason = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)

    status = Column(String(12), nullable=False, default="active")  # active | settled | cancelled
    cancelled_reason = Column(String(500), nullable=True)

    created_by_id = Column(BigInteger, ForeignKey("user.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    deleted = Column(Boolean, nullable=False, default=False)

    created_by = relationship("User", foreign_keys=[created_by_id])


class MobileTelegramLink(Base):
    """Bridge between a mobile user (any of the three systems) and a Telegram chat id.

    Management users keep using `user.telegram_id` directly — this table only
    holds links for Gennis / Turon users whose source-system user rows don't
    carry a telegram_id column.
    """
    __tablename__ = "mobile_telegram_link"

    id = Column(BigInteger, primary_key=True, index=True)
    system = Column(String(20), nullable=False)
    external_id = Column(BigInteger, nullable=False)
    telegram_id = Column(BigInteger, nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (UniqueConstraint("system", "external_id", name="uq_mobile_tg_user"),)


class UserRole(Base):
    """Additional roles for a user beyond their primary user.role."""
    __tablename__ = "user_role"

    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(BigInteger, ForeignKey("user.id"), nullable=False, index=True)
    role = Column(String(50), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (UniqueConstraint("user_id", "role", name="uq_user_role"),)

    user = relationship("User", foreign_keys=[user_id], back_populates="extra_roles")


class GennisUserLink(Base):
    """Maps a management user to one or more Gennis user IDs (multi-branch accounts)."""
    __tablename__ = "gennis_user_link"

    id = Column(BigInteger, primary_key=True, index=True)
    management_user_id = Column(BigInteger, ForeignKey("user.id"), nullable=False, index=True)
    gennis_user_id = Column(Integer, nullable=False, unique=True)
    location_id = Column(Integer, nullable=True)
    location_name = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", foreign_keys=[management_user_id])


class GennisSubject(Base):
    __tablename__ = "gennis_subject"

    id        = Column(BigInteger, primary_key=True, index=True)
    gennis_id = Column(Integer, nullable=False, unique=True)
    name      = Column(String(255), nullable=False)

    groups   = relationship("GennisGroup",   back_populates="subject")
    teachers = relationship("User",          secondary="gennis_teacher_subject", back_populates="subjects")
    students = relationship("GennisStudent", secondary="gennis_student_subject", back_populates="subjects")


class GennisGroup(Base):
    __tablename__ = "gennis_group"

    id                  = Column(BigInteger, primary_key=True, index=True)
    gennis_id           = Column(Integer, nullable=False, unique=True)
    name                = Column(String(255), nullable=False)
    location_id         = Column(Integer, nullable=True)
    location_name       = Column(String(100), nullable=True)
    subject_id          = Column(BigInteger, ForeignKey("gennis_subject.id"), nullable=True)
    teacher_gennis_id   = Column(Integer, nullable=True)
    teacher_mgmt_id     = Column(BigInteger, ForeignKey("user.id"), nullable=True)
    assistent_gennis_id = Column(Integer, nullable=True)
    assistent_mgmt_id   = Column(BigInteger, ForeignKey("user.id"), nullable=True)
    status              = Column(Boolean, default=True)
    deleted             = Column(Boolean, default=False)
    price               = Column(Integer, nullable=True)
    teacher_salary      = Column(Integer, nullable=True)
    assistent_salary    = Column(Integer, nullable=True)
    attendance_days     = Column(Integer, nullable=True)
    created_at          = Column(DateTime, server_default=func.now())
    updated_at          = Column(DateTime, server_default=func.now(), onupdate=func.now())

    subject   = relationship("GennisSubject", back_populates="groups")
    teacher   = relationship("User", foreign_keys=[teacher_mgmt_id],   back_populates="teaching_groups")
    assistent = relationship("User", foreign_keys=[assistent_mgmt_id], back_populates="assisting_groups")
    active_students  = relationship("GennisStudent", secondary="gennis_student_group",         back_populates="groups")
    deleted_students = relationship("GennisStudent", secondary="gennis_deleted_student_group", back_populates="deleted_groups")


class GennisStudent(Base):
    __tablename__ = "gennis_student"

    id           = Column(BigInteger, primary_key=True, index=True)
    gennis_id    = Column(Integer, nullable=False, unique=True)
    user_id      = Column(Integer, nullable=True)
    name         = Column(String(255), nullable=True)
    surname      = Column(String(255), nullable=True)
    father_name  = Column(String(255), nullable=True)
    phone        = Column(String(50), nullable=True)
    parent_phone = Column(String(50), nullable=True)
    photo_url    = Column(String(500), nullable=True)
    created_at   = Column(DateTime, server_default=func.now())
    updated_at   = Column(DateTime, server_default=func.now(), onupdate=func.now())

    groups         = relationship("GennisGroup",   secondary="gennis_student_group",         back_populates="active_students")
    deleted_groups = relationship("GennisGroup",   secondary="gennis_deleted_student_group", back_populates="deleted_students")
    subjects       = relationship("GennisSubject", secondary="gennis_student_subject",       back_populates="students")


# Association tables
gennis_student_group_table = Table(
    "gennis_student_group", Base.metadata,
    Column("student_id", BigInteger, ForeignKey("gennis_student.id"), primary_key=True),
    Column("group_id",   BigInteger, ForeignKey("gennis_group.id"),   primary_key=True),
)

gennis_deleted_student_group_table = Table(
    "gennis_deleted_student_group", Base.metadata,
    Column("id",              BigInteger, primary_key=True, autoincrement=True),
    Column("student_id",      BigInteger, ForeignKey("gennis_student.id"), nullable=False),
    Column("group_id",        BigInteger, ForeignKey("gennis_group.id"),   nullable=False),
    Column("reason",          Text,       nullable=True),
    Column("teacher_mgmt_id", BigInteger, ForeignKey("user.id"),           nullable=True),
    UniqueConstraint("student_id", "group_id", name="uq_deleted_student_group"),
)


gennis_teacher_subject_table = Table(
    "gennis_teacher_subject", Base.metadata,
    Column("teacher_mgmt_id", BigInteger, ForeignKey("user.id"),           primary_key=True),
    Column("subject_id",      BigInteger, ForeignKey("gennis_subject.id"), primary_key=True),
)

gennis_student_subject_table = Table(
    "gennis_student_subject", Base.metadata,
    Column("student_id", BigInteger, ForeignKey("gennis_student.id"), primary_key=True),
    Column("subject_id", BigInteger, ForeignKey("gennis_subject.id"), primary_key=True),
)


class GennisLead(Base):
    __tablename__ = "gennis_lead"

    id            = Column(BigInteger, primary_key=True, index=True)
    gennis_id     = Column(Integer, nullable=False, unique=True)
    name          = Column(String(255), nullable=True)
    # 100, not 50: old gennis puts no length limit on lead.phone and has values
    # up to 52 chars. One such row blocked all 14 pending leads from syncing —
    # psycopg2's execute_batch sends a batch as a single statement, so one
    # over-length value fails the whole table.
    phone         = Column(String(100), nullable=True)
    location_id   = Column(Integer, nullable=True)
    location_name = Column(String(100), nullable=True)
    comment       = Column(Text, nullable=True)
    deleted       = Column(Boolean, default=False)
    created_at    = Column(DateTime, server_default=func.now())
    updated_at    = Column(DateTime, server_default=func.now(), onupdate=func.now())


# ── Gennis Sync Wave 2: locations, users, staff, timetable ───────────────────

class GennisLocation(Base):
    __tablename__ = "gennis_location"

    id          = Column(BigInteger, primary_key=True, index=True)
    gennis_id   = Column(Integer, nullable=False, unique=True)
    name        = Column(String(255), nullable=True)
    code        = Column(Integer, nullable=True)
    address     = Column(String(500), nullable=True)
    synced_at   = Column(DateTime, server_default=func.now(), onupdate=func.now())


class GennisEducationLanguage(Base):
    __tablename__ = "gennis_education_language"

    id        = Column(BigInteger, primary_key=True, index=True)
    gennis_id = Column(Integer, nullable=False, unique=True)
    name      = Column(String(100), nullable=False)
    synced_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class GennisProfessionSync(Base):
    __tablename__ = "gennis_profession"

    id        = Column(BigInteger, primary_key=True, index=True)
    gennis_id = Column(Integer, nullable=False, unique=True)
    name      = Column(String(255), nullable=False)
    synced_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class GennisRoleSync(Base):
    __tablename__ = "gennis_role"

    id        = Column(BigInteger, primary_key=True, index=True)
    gennis_id = Column(Integer, nullable=False, unique=True)
    role      = Column(String(100), nullable=True)
    type_role = Column(String(100), nullable=True)
    synced_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class GennisCalendarYear(Base):
    __tablename__ = "gennis_calendar_year"

    id        = Column(BigInteger, primary_key=True, index=True)
    gennis_id = Column(Integer, nullable=False, unique=True)
    date      = Column(DateTime, nullable=True)
    synced_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class GennisCalendarMonth(Base):
    __tablename__ = "gennis_calendar_month"

    id             = Column(BigInteger, primary_key=True, index=True)
    gennis_id      = Column(Integer, nullable=False, unique=True)
    date           = Column(DateTime, nullable=True)
    year_gennis_id = Column(Integer, nullable=True)
    synced_at      = Column(DateTime, server_default=func.now(), onupdate=func.now())


class GennisCalendarDay(Base):
    __tablename__ = "gennis_calendar_day"

    id        = Column(BigInteger, primary_key=True, index=True)
    gennis_id = Column(Integer, nullable=False, unique=True)
    date      = Column(DateTime, nullable=True)
    synced_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class GennisStudentExcuse(Base):
    """Absence notes. Mirror of old gennis `studentexcuses` (migration w4x5y6z7a8b9).

    This and the twelve mirrors below cover the features old gennis had and v2
    never did. They are archives of a system being switched off, so they hold
    the old row's id in `gennis_id` and reference other old rows raw, in
    `*_gennis_id` columns, rather than remapping to v2 surrogate keys — a remap
    would silently drop any row whose target was never migrated, losing exactly
    the history these tables exist to keep.
    """

    __tablename__ = "gennis_student_excuse"

    id                = Column(BigInteger, primary_key=True, index=True)
    gennis_id         = Column(Integer, nullable=False, unique=True)
    student_gennis_id = Column(Integer, nullable=True, index=True)
    reason            = Column(Text, nullable=True)
    to_date           = Column(DateTime, nullable=True)
    added_date        = Column(DateTime, nullable=True)
    audio_url         = Column(String(500), nullable=True)
    synced_at         = Column(DateTime, server_default=func.now())


class GennisStudentExcuseAudio(Base):
    __tablename__ = "gennis_student_excuse_audio"

    id                     = Column(BigInteger, primary_key=True, index=True)
    gennis_id              = Column(Integer, nullable=False, unique=True)
    excuse_gennis_id       = Column(Integer, nullable=True, index=True)
    audio_url              = Column(String(500), nullable=True)
    client_number          = Column(String(100), nullable=True)
    diversion              = Column(String(100), nullable=True)
    duration               = Column(String(50), nullable=True)
    start_time             = Column(DateTime, nullable=True)
    end_time               = Column(DateTime, nullable=True)
    wait_time              = Column(String(50), nullable=True)
    comment                = Column(Text, nullable=True)
    calendar_day_gennis_id = Column(Integer, nullable=True)
    date                   = Column(Date, nullable=True)
    synced_at              = Column(DateTime, server_default=func.now())


class GennisGroupTest(Base):
    __tablename__ = "gennis_group_test"

    id                       = Column(BigInteger, primary_key=True, index=True)
    gennis_id                = Column(Integer, nullable=False, unique=True)
    group_gennis_id          = Column(Integer, nullable=True, index=True)
    subject_gennis_id        = Column(Integer, nullable=True)
    name                     = Column(String(255), nullable=True)
    number_tests             = Column(Integer, nullable=True)
    percentage               = Column(Float, nullable=True)
    level                    = Column(String(100), nullable=True)
    file                     = Column(String(500), nullable=True)
    calendar_day_gennis_id   = Column(Integer, nullable=True)
    calendar_month_gennis_id = Column(Integer, nullable=True)
    calendar_year_gennis_id  = Column(Integer, nullable=True)
    date                     = Column(Date, nullable=True, index=True)
    year                     = Column(Integer, nullable=True)
    month                    = Column(Integer, nullable=True)
    synced_at                = Column(DateTime, server_default=func.now())


class GennisStudentTest(Base):
    __tablename__ = "gennis_student_test"

    id                     = Column(BigInteger, primary_key=True, index=True)
    gennis_id              = Column(Integer, nullable=False, unique=True)
    student_gennis_id      = Column(Integer, nullable=True, index=True)
    group_test_gennis_id   = Column(Integer, nullable=True, index=True)
    group_gennis_id        = Column(Integer, nullable=True)
    subject_gennis_id      = Column(Integer, nullable=True)
    true_answers           = Column(Integer, nullable=True)
    # text in old gennis, unlike gennis_group_test.percentage which is a float
    percentage             = Column(String(50), nullable=True)
    calendar_day_gennis_id = Column(Integer, nullable=True)
    date                   = Column(Date, nullable=True, index=True)
    synced_at              = Column(DateTime, server_default=func.now())


class GennisTestApplicant(Base):
    """Public entrance-test sign-ups. Old gennis called this `student_test_block`,
    but it holds applicants (name, phone, school, language), not test results."""

    __tablename__ = "gennis_test_applicant"

    id            = Column(BigInteger, primary_key=True, index=True)
    gennis_id     = Column(Integer, nullable=False, unique=True)
    name          = Column(String(255), nullable=True)
    surname       = Column(String(255), nullable=True)
    father_name   = Column(String(255), nullable=True)
    phone         = Column(String(50), nullable=True)
    school_id     = Column(Integer, nullable=True)
    defenation_id = Column(Integer, nullable=True)
    unique_id     = Column(String(100), nullable=True)
    location_id   = Column(Integer, nullable=True)
    language      = Column(String(50), nullable=True)
    synced_at     = Column(DateTime, server_default=func.now())


class GennisBlackStudent(Base):
    """Debtor students. `black` is old gennis's term, kept for traceability."""

    __tablename__ = "gennis_black_student"

    id                       = Column(BigInteger, primary_key=True, index=True)
    gennis_id                = Column(Integer, nullable=False, unique=True)
    student_gennis_id        = Column(Integer, nullable=True, index=True)
    user_gennis_id           = Column(Integer, nullable=True)
    location_id              = Column(Integer, nullable=True, index=True)
    comment                  = Column(Text, nullable=True)
    deleted                  = Column(Boolean, nullable=False, default=False)
    calendar_day_gennis_id   = Column(Integer, nullable=True)
    calendar_month_gennis_id = Column(Integer, nullable=True)
    calendar_year_gennis_id  = Column(Integer, nullable=True)
    date                     = Column(Date, nullable=True, index=True)
    year                     = Column(Integer, nullable=True)
    month                    = Column(Integer, nullable=True)
    synced_at                = Column(DateTime, server_default=func.now())


class GennisBlackStudentStat(Base):
    __tablename__ = "gennis_black_student_stat"

    id                       = Column(BigInteger, primary_key=True, index=True)
    gennis_id                = Column(Integer, nullable=False, unique=True)
    location_id              = Column(Integer, nullable=True, index=True)
    total_black_students     = Column(Integer, nullable=True)
    calendar_month_gennis_id = Column(Integer, nullable=True)
    calendar_year_gennis_id  = Column(Integer, nullable=True)
    year                     = Column(Integer, nullable=True)
    month                    = Column(Integer, nullable=True)
    synced_at                = Column(DateTime, server_default=func.now())


class GennisBranchReport(Base):
    """Daily per-branch rollup (headcounts and payment totals)."""

    __tablename__ = "gennis_branch_report"

    id                              = Column(BigInteger, primary_key=True, index=True)
    gennis_id                       = Column(Integer, nullable=False, unique=True)
    location_id                     = Column(Integer, nullable=True, index=True)
    number_of_students              = Column(Integer, nullable=True)
    number_of_deleted_students      = Column(Integer, nullable=True)
    number_of_deleted_registrations = Column(Integer, nullable=True)
    number_of_teachers              = Column(Integer, nullable=True)
    number_of_staff                 = Column(Integer, nullable=True)
    number_of_groups                = Column(Integer, nullable=True)
    number_of_deleted_groups        = Column(Integer, nullable=True)
    number_of_payments              = Column(Integer, nullable=True)
    sum_of_payments                 = Column(BigInteger, nullable=True)
    calendar_day_gennis_id          = Column(Integer, nullable=True)
    calendar_month_gennis_id        = Column(Integer, nullable=True)
    calendar_year_gennis_id         = Column(Integer, nullable=True)
    date                            = Column(Date, nullable=True, index=True)
    year                            = Column(Integer, nullable=True)
    month                           = Column(Integer, nullable=True)
    created_at                      = Column(DateTime, nullable=True)
    updated_at                      = Column(DateTime, nullable=True)
    synced_at                       = Column(DateTime, server_default=func.now())


class GennisDeletedStudentPayment(Base):
    """Reversed student payments — the audit trail for money taken back."""

    __tablename__ = "gennis_deleted_student_payment"

    id                       = Column(BigInteger, primary_key=True, index=True)
    gennis_id                = Column(Integer, nullable=False, unique=True)
    student_gennis_id        = Column(Integer, nullable=True, index=True)
    location_id              = Column(Integer, nullable=True, index=True)
    payment_sum              = Column(BigInteger, nullable=True)
    payment_type_id          = Column(Integer, nullable=True)
    account_period_id        = Column(Integer, nullable=True)
    payment                  = Column(Boolean, nullable=True)
    deleted_date             = Column(DateTime, nullable=True)
    reason                   = Column(Text, nullable=True)
    calendar_day_gennis_id   = Column(Integer, nullable=True)
    calendar_month_gennis_id = Column(Integer, nullable=True)
    calendar_year_gennis_id  = Column(Integer, nullable=True)
    date                     = Column(Date, nullable=True, index=True)
    year                     = Column(Integer, nullable=True)
    month                    = Column(Integer, nullable=True)
    synced_at                = Column(DateTime, server_default=func.now())


class GennisContractStudent(Base):
    __tablename__ = "gennis_contract_student"

    id                = Column(BigInteger, primary_key=True, index=True)
    gennis_id         = Column(Integer, nullable=False, unique=True)
    student_gennis_id = Column(Integer, nullable=True, index=True)
    created_date      = Column(DateTime, nullable=True)
    expire_date       = Column(DateTime, nullable=True)
    given_place       = Column(String(255), nullable=True)
    given_time        = Column(String(100), nullable=True)
    place             = Column(String(255), nullable=True)
    father_name       = Column(String(255), nullable=True)
    passport_series   = Column(String(50), nullable=True)
    synced_at         = Column(DateTime, server_default=func.now())


class GennisContractCounter(Base):
    """Per-branch contract numbering (old `contract_students_data`)."""

    __tablename__ = "gennis_contract_counter"

    id          = Column(BigInteger, primary_key=True, index=True)
    gennis_id   = Column(Integer, nullable=False, unique=True)
    year        = Column(DateTime, nullable=True)
    number      = Column(Integer, nullable=True)
    location_id = Column(Integer, nullable=True)
    synced_at   = Column(DateTime, server_default=func.now())


class GennisStudentCallingInfo(Base):
    __tablename__ = "gennis_student_calling_info"

    id                = Column(BigInteger, primary_key=True, index=True)
    gennis_id         = Column(Integer, nullable=False, unique=True)
    student_gennis_id = Column(Integer, nullable=True, index=True)
    comment           = Column(Text, nullable=True)
    day               = Column(DateTime, nullable=True)
    date              = Column(DateTime, nullable=True)
    audio_url         = Column(String(500), nullable=True)
    synced_at         = Column(DateTime, server_default=func.now())


class GennisStudentCallingInfoAudio(Base):
    __tablename__ = "gennis_student_calling_info_audio"

    id                     = Column(BigInteger, primary_key=True, index=True)
    gennis_id              = Column(Integer, nullable=False, unique=True)
    calling_info_gennis_id = Column(Integer, nullable=True, index=True)
    audio_url              = Column(String(500), nullable=True)
    client_number          = Column(String(100), nullable=True)
    diversion              = Column(String(100), nullable=True)
    duration               = Column(String(50), nullable=True)
    start_time             = Column(DateTime, nullable=True)
    end_time               = Column(DateTime, nullable=True)
    wait_time              = Column(String(50), nullable=True)
    comment                = Column(Text, nullable=True)
    calendar_day_gennis_id = Column(Integer, nullable=True)
    date                   = Column(Date, nullable=True)
    synced_at              = Column(DateTime, server_default=func.now())


class GennisNotification(Base):
    """Old task notifications, mirrored rather than merged into `notification`.

    Old mission ids run 11..50 while v2's mission table holds {4,5,7,8,15}: the
    single overlap is a different mission, so reusing the ids would attach old
    notifications to unrelated v2 tasks, and merging them with a null mission
    would still show real users unread "you have been assigned a task" messages
    for tasks that do not exist here. Both the old user id and its resolved v2
    counterpart are kept so the archive stays joinable either way.
    """

    __tablename__ = "gennis_notification"

    id                 = Column(BigInteger, primary_key=True, index=True)
    gennis_id          = Column(Integer, nullable=False, unique=True)
    user_gennis_id     = Column(Integer, nullable=True, index=True)
    management_user_id = Column(BigInteger, nullable=True)
    mission_gennis_id  = Column(Integer, nullable=True)
    message            = Column(Text, nullable=True)
    role               = Column(String(50), nullable=True)
    deadline           = Column(Date, nullable=True)
    is_read            = Column(Boolean, nullable=True)
    created_at         = Column(DateTime, nullable=True)
    synced_at          = Column(DateTime, server_default=func.now())


class GennisLessonPlanStudent(Base):
    """Per-student notes on a lesson plan. Mirror of old `lesson_plan_students`.

    Separate from the unprefixed `lesson_plan_student` because that table's FK
    points at the v2-native `lesson_plan`, while these rows hang off
    `gennis_lesson_plan`. Same idea, different parent.
    """

    __tablename__ = "gennis_lesson_plan_student"

    id                    = Column(BigInteger, primary_key=True, index=True)
    gennis_id             = Column(Integer, nullable=False, unique=True)
    lesson_plan_gennis_id = Column(Integer, nullable=True, index=True)
    student_gennis_id     = Column(Integer, nullable=True, index=True)
    comment               = Column(Text, nullable=True)
    synced_at             = Column(DateTime, server_default=func.now())


class GennisTimetableStudent(Base):
    """Which students attend which timetable slot.

    This and the two below mirror old gennis's time_table_* link tables, which
    have no id of their own — hence a surrogate id plus a unique constraint on
    the pair, which is also what makes the sync re-runnable. They stay separate
    rather than merging into one table with a role column because student,
    teacher and assistent ids live in three different id spaces; three narrow
    tables cannot be joined to the wrong mirror.
    """

    __tablename__ = "gennis_timetable_student"
    __table_args__ = (
        UniqueConstraint(
            "student_gennis_id", "group_room_week_gennis_id",
            name="uq_gennis_timetable_student_pair",
        ),
    )

    id                        = Column(BigInteger, primary_key=True, index=True)
    student_gennis_id         = Column(Integer, nullable=True, index=True)
    group_room_week_gennis_id = Column(Integer, nullable=True, index=True)
    synced_at                 = Column(DateTime, server_default=func.now())


class GennisTimetableTeacher(Base):
    __tablename__ = "gennis_timetable_teacher"
    __table_args__ = (
        UniqueConstraint(
            "teacher_gennis_id", "group_room_week_gennis_id",
            name="uq_gennis_timetable_teacher_pair",
        ),
    )

    id                        = Column(BigInteger, primary_key=True, index=True)
    teacher_gennis_id         = Column(Integer, nullable=True, index=True)
    group_room_week_gennis_id = Column(Integer, nullable=True, index=True)
    synced_at                 = Column(DateTime, server_default=func.now())


class GennisTimetableAssistent(Base):
    __tablename__ = "gennis_timetable_assistent"
    __table_args__ = (
        UniqueConstraint(
            "assistent_gennis_id", "group_room_week_gennis_id",
            name="uq_gennis_timetable_assistent_pair",
        ),
    )

    id                        = Column(BigInteger, primary_key=True, index=True)
    assistent_gennis_id       = Column(Integer, nullable=True, index=True)
    group_room_week_gennis_id = Column(Integer, nullable=True, index=True)
    synced_at                 = Column(DateTime, server_default=func.now())


class GennisObservationInfo(Base):
    """The observation criteria list (9 rows in old gennis)."""

    __tablename__ = "gennis_observation_info"

    id        = Column(BigInteger, primary_key=True, index=True)
    gennis_id = Column(Integer, nullable=False, unique=True)
    title     = Column(Text, nullable=True)
    synced_at = Column(DateTime, server_default=func.now())


class GennisObservationOption(Base):
    """The rating scale an observation criterion is scored against."""

    __tablename__ = "gennis_observation_option"

    id        = Column(BigInteger, primary_key=True, index=True)
    gennis_id = Column(Integer, nullable=False, unique=True)
    name      = Column(String(255), nullable=True)
    value     = Column(Integer, nullable=True)
    synced_at = Column(DateTime, server_default=func.now())


class GennisTeacherObservation(Base):
    """Per-criterion detail behind gennis_teacher_observation_day.

    Rows whose day/info/option reference dangles are kept (35 of 3,246): the
    comment is still the observation, and dropping it to satisfy a foreign key
    would discard the only content the row has.
    """

    __tablename__ = "gennis_teacher_observation"

    id                           = Column(BigInteger, primary_key=True, index=True)
    gennis_id                    = Column(Integer, nullable=False, unique=True)
    observation_day_gennis_id    = Column(Integer, nullable=True, index=True)
    observation_info_gennis_id   = Column(Integer, nullable=True)
    observation_option_gennis_id = Column(Integer, nullable=True)
    comment                      = Column(Text, nullable=True)
    synced_at                    = Column(DateTime, server_default=func.now())


class GennisGroupAttendance(Base):
    """A group's month of attendance, stored by old gennis as one json blob:
    {"attendances": [...], "dates": [...], "students_num": N}."""

    __tablename__ = "gennis_group_attendance"

    id                       = Column(BigInteger, primary_key=True, index=True)
    gennis_id                = Column(Integer, nullable=False, unique=True)
    group_gennis_id          = Column(Integer, nullable=True, index=True)
    status                   = Column(Boolean, nullable=True)
    data                     = Column(JSONB, nullable=True)
    calendar_month_gennis_id = Column(Integer, nullable=True)
    calendar_year_gennis_id  = Column(Integer, nullable=True)
    year                     = Column(Integer, nullable=True)
    month                    = Column(Integer, nullable=True)
    synced_at                = Column(DateTime, server_default=func.now())


class GennisDeletedTeacherSalary(Base):
    """Reversed teacher salary payments — the audit trail for money taken back.
    Companion to the gennis_deleted_* mirrors already here for overhead,
    capital, teachers and student payments."""

    __tablename__ = "gennis_deleted_teacher_salary"

    id                       = Column(BigInteger, primary_key=True, index=True)
    gennis_id                = Column(Integer, nullable=False, unique=True)
    teacher_gennis_id        = Column(Integer, nullable=True, index=True)
    group_gennis_id          = Column(Integer, nullable=True)
    payment_sum              = Column(BigInteger, nullable=True)
    reason                   = Column(Text, nullable=True)
    payment_type_id          = Column(Integer, nullable=True)
    location_id              = Column(Integer, nullable=True, index=True)
    account_period_id        = Column(Integer, nullable=True)
    deleted_date             = Column(DateTime, nullable=True)
    reason_deleted           = Column(Text, nullable=True)
    calendar_day_gennis_id   = Column(Integer, nullable=True)
    calendar_month_gennis_id = Column(Integer, nullable=True)
    calendar_year_gennis_id  = Column(Integer, nullable=True)
    date                     = Column(Date, nullable=True, index=True)
    year                     = Column(Integer, nullable=True)
    month                    = Column(Integer, nullable=True)
    synced_at                = Column(DateTime, server_default=func.now())


class GennisDeletedStaffSalary(Base):
    __tablename__ = "gennis_deleted_staff_salary"

    id                       = Column(BigInteger, primary_key=True, index=True)
    gennis_id                = Column(Integer, nullable=False, unique=True)
    staff_gennis_id          = Column(Integer, nullable=True, index=True)
    profession_id            = Column(Integer, nullable=True)
    payment_sum              = Column(BigInteger, nullable=True)
    reason                   = Column(Text, nullable=True)
    payment_type_id          = Column(Integer, nullable=True)
    location_id              = Column(Integer, nullable=True, index=True)
    account_period_id        = Column(Integer, nullable=True)
    deleted_date             = Column(DateTime, nullable=True)
    reason_deleted           = Column(Text, nullable=True)
    calendar_day_gennis_id   = Column(Integer, nullable=True)
    calendar_month_gennis_id = Column(Integer, nullable=True)
    calendar_year_gennis_id  = Column(Integer, nullable=True)
    date                     = Column(Date, nullable=True, index=True)
    year                     = Column(Integer, nullable=True)
    month                    = Column(Integer, nullable=True)
    synced_at                = Column(DateTime, server_default=func.now())


class GennisSchool(Base):
    """Schools referenced by gennis_test_applicant.school_id — all 1,359
    applicants carry one, across 17 distinct schools."""

    __tablename__ = "gennis_school"

    id        = Column(BigInteger, primary_key=True, index=True)
    gennis_id = Column(Integer, nullable=False, unique=True)
    name      = Column(String(255), nullable=True)
    number    = Column(Integer, nullable=True)
    synced_at = Column(DateTime, server_default=func.now())


class GennisBook(Base):
    __tablename__ = "gennis_book"

    id          = Column(BigInteger, primary_key=True, index=True)
    gennis_id   = Column(Integer, nullable=False, unique=True)
    name        = Column(String(255), nullable=True)
    # old gennis called this "desc", which is reserved in SQL
    description = Column(Text, nullable=True)
    img         = Column(String(500), nullable=True)
    img2        = Column(String(500), nullable=True)
    img3        = Column(String(500), nullable=True)
    own_price   = Column(BigInteger, nullable=True)
    share_price = Column(BigInteger, nullable=True)
    price       = Column(BigInteger, nullable=True)
    synced_at   = Column(DateTime, server_default=func.now())


class GennisBookOrder(Base):
    """Book orders. v2 already held the 162 book payments but not the orders."""

    __tablename__ = "gennis_book_order"

    id                           = Column(BigInteger, primary_key=True, index=True)
    gennis_id                    = Column(Integer, nullable=False, unique=True)
    student_gennis_id            = Column(Integer, nullable=True, index=True)
    group_gennis_id              = Column(Integer, nullable=True)
    teacher_gennis_id            = Column(Integer, nullable=True)
    book_gennis_id               = Column(Integer, nullable=True, index=True)
    user_gennis_id               = Column(Integer, nullable=True)
    location_id                  = Column(Integer, nullable=True, index=True)
    count                        = Column(Integer, nullable=True)
    accounting_period_id         = Column(Integer, nullable=True)
    editor_confirm               = Column(Boolean, nullable=True)
    admin_confirm                = Column(Boolean, nullable=True)
    collected_payments_gennis_id = Column(Integer, nullable=True)
    deleted                      = Column(Boolean, nullable=True)
    reason                       = Column(Text, nullable=True)
    calendar_day_gennis_id       = Column(Integer, nullable=True)
    date                         = Column(Date, nullable=True, index=True)
    synced_at                    = Column(DateTime, server_default=func.now())


class GennisUserBook(Base):
    __tablename__ = "gennis_user_book"

    id                       = Column(BigInteger, primary_key=True, index=True)
    gennis_id                = Column(Integer, nullable=False, unique=True)
    user_gennis_id           = Column(Integer, nullable=True, index=True)
    location_id              = Column(Integer, nullable=True)
    payment_sum              = Column(BigInteger, nullable=True)
    book_order_gennis_id     = Column(Integer, nullable=True)
    account_period_id        = Column(Integer, nullable=True)
    salary_location_id       = Column(Integer, nullable=True)
    salary_id                = Column(Integer, nullable=True)
    calendar_day_gennis_id   = Column(Integer, nullable=True)
    calendar_month_gennis_id = Column(Integer, nullable=True)
    calendar_year_gennis_id  = Column(Integer, nullable=True)
    date                     = Column(Date, nullable=True, index=True)
    year                     = Column(Integer, nullable=True)
    month                    = Column(Integer, nullable=True)
    synced_at                = Column(DateTime, server_default=func.now())


class GennisCollectedBookPayment(Base):
    """created_date and received_date are named like dates in old gennis but
    hold calendarday ids; both the raw id and the resolved date are kept."""

    __tablename__ = "gennis_collected_book_payment"

    id                       = Column(BigInteger, primary_key=True, index=True)
    gennis_id                = Column(Integer, nullable=False, unique=True)
    debt                     = Column(BigInteger, nullable=True)
    location_id              = Column(Integer, nullable=True, index=True)
    status                   = Column(Boolean, nullable=True)
    account_period_id        = Column(Integer, nullable=True)
    payment_type_id          = Column(Integer, nullable=True)
    created_day_gennis_id    = Column(Integer, nullable=True)
    received_day_gennis_id   = Column(Integer, nullable=True)
    created_date             = Column(Date, nullable=True)
    received_date            = Column(Date, nullable=True)
    calendar_month_gennis_id = Column(Integer, nullable=True)
    calendar_year_gennis_id  = Column(Integer, nullable=True)
    year                     = Column(Integer, nullable=True)
    month                    = Column(Integer, nullable=True)
    synced_at                = Column(DateTime, server_default=func.now())


class GennisBranchPayment(Base):
    __tablename__ = "gennis_branch_payment"

    id                       = Column(BigInteger, primary_key=True, index=True)
    gennis_id                = Column(Integer, nullable=False, unique=True)
    location_id              = Column(Integer, nullable=True, index=True)
    payment_type_id          = Column(Integer, nullable=True)
    editor_balance_id        = Column(Integer, nullable=True)
    book_order_gennis_id     = Column(Integer, nullable=True)
    payment_sum              = Column(BigInteger, nullable=True)
    account_period_id        = Column(Integer, nullable=True)
    calendar_day_gennis_id   = Column(Integer, nullable=True)
    calendar_month_gennis_id = Column(Integer, nullable=True)
    calendar_year_gennis_id  = Column(Integer, nullable=True)
    date                     = Column(Date, nullable=True, index=True)
    year                     = Column(Integer, nullable=True)
    month                    = Column(Integer, nullable=True)
    synced_at                = Column(DateTime, server_default=func.now())


class GennisMission(Base):
    """Old gennis missions, mirrored rather than loaded into the live `mission`
    table. That table's gennis_executor_id columns exist so management-v2 can
    assign its own missions to gennis users — it has turon_executor_id too —
    not to receive imported ones. Loading these would put old missions into real
    users' lists; 3 of 11 also have a NULL creator_id, which is NOT NULL there,
    and old id 15 collides with an existing v2 mission."""

    __tablename__ = "gennis_mission"

    id                          = Column(BigInteger, primary_key=True, index=True)
    gennis_id                   = Column(Integer, nullable=False, unique=True)
    title                       = Column(String(500), nullable=True)
    description                 = Column(Text, nullable=True)
    category                    = Column(String(100), nullable=True)
    creator_gennis_id           = Column(Integer, nullable=True)
    executor_gennis_id          = Column(Integer, nullable=True, index=True)
    reviewer_gennis_id          = Column(Integer, nullable=True)
    original_executor_gennis_id = Column(Integer, nullable=True)
    redirected_by_gennis_id     = Column(Integer, nullable=True)
    is_redirected               = Column(Boolean, nullable=True)
    redirected_at               = Column(DateTime, nullable=True)
    location_id                 = Column(Integer, nullable=True, index=True)
    start_datetime              = Column(DateTime, nullable=True)
    deadline_datetime           = Column(DateTime, nullable=True)
    finish_datetime             = Column(DateTime, nullable=True)
    status                      = Column(String(50), nullable=True)
    kpi_weight                  = Column(Integer, nullable=True)
    penalty_per_day             = Column(Integer, nullable=True)
    early_bonus_per_day         = Column(Integer, nullable=True)
    max_bonus                   = Column(Integer, nullable=True)
    max_penalty                 = Column(Integer, nullable=True)
    delay_days                  = Column(Integer, nullable=True)
    is_recurring                = Column(Boolean, nullable=True)
    recurring_type              = Column(String(50), nullable=True)
    repeat_every                = Column(Integer, nullable=True)
    last_generated              = Column(Date, nullable=True)
    final_sc                    = Column(Integer, nullable=True)
    management_id               = Column(BigInteger, nullable=True)
    creator_name                = Column(String(255), nullable=True)
    reviewer_name               = Column(String(255), nullable=True)
    deleted                     = Column(Boolean, nullable=True)
    created_at                  = Column(DateTime, nullable=True)
    updated_at                  = Column(DateTime, nullable=True)
    synced_at                   = Column(DateTime, server_default=func.now())


class GennisMissionHistory(Base):
    __tablename__ = "gennis_mission_history"

    id                       = Column(BigInteger, primary_key=True, index=True)
    gennis_id                = Column(Integer, nullable=False, unique=True)
    mission_gennis_id        = Column(Integer, nullable=True, index=True)
    executor_gennis_id       = Column(Integer, nullable=True)
    reviewer_gennis_id       = Column(Integer, nullable=True)
    management_id            = Column(BigInteger, nullable=True)
    management_executor_id   = Column(BigInteger, nullable=True)
    management_executor_name = Column(String(255), nullable=True)
    management_reviewer_id   = Column(BigInteger, nullable=True)
    management_reviewer_name = Column(String(255), nullable=True)
    turon_executor_id        = Column(BigInteger, nullable=True)
    turon_executor_name      = Column(String(255), nullable=True)
    turon_reviewer_id        = Column(BigInteger, nullable=True)
    turon_reviewer_name      = Column(String(255), nullable=True)
    changed_by_name          = Column(String(255), nullable=True)
    note                     = Column(Text, nullable=True)
    created_at               = Column(DateTime, nullable=True)
    synced_at                = Column(DateTime, server_default=func.now())


class GennisMissionComment(Base):
    __tablename__ = "gennis_mission_comment"

    id                = Column(BigInteger, primary_key=True, index=True)
    gennis_id         = Column(Integer, nullable=False, unique=True)
    mission_gennis_id = Column(Integer, nullable=True, index=True)
    user_gennis_id    = Column(Integer, nullable=True)
    text              = Column(Text, nullable=True)
    attachment_path   = Column(String(500), nullable=True)
    management_id     = Column(BigInteger, nullable=True)
    creator_name      = Column(String(255), nullable=True)
    created_at        = Column(DateTime, nullable=True)
    synced_at         = Column(DateTime, server_default=func.now())


class GennisMissionProof(Base):
    __tablename__ = "gennis_mission_proof"

    id                = Column(BigInteger, primary_key=True, index=True)
    gennis_id         = Column(Integer, nullable=False, unique=True)
    mission_gennis_id = Column(Integer, nullable=True, index=True)
    file_path         = Column(String(500), nullable=True)
    comment           = Column(Text, nullable=True)
    management_id     = Column(BigInteger, nullable=True)
    creator_name      = Column(String(255), nullable=True)
    created_at        = Column(DateTime, nullable=True)
    synced_at         = Column(DateTime, server_default=func.now())


class GennisMissionAttachment(Base):
    __tablename__ = "gennis_mission_attachment"

    id                = Column(BigInteger, primary_key=True, index=True)
    gennis_id         = Column(Integer, nullable=False, unique=True)
    mission_gennis_id = Column(Integer, nullable=True, index=True)
    file_path         = Column(String(500), nullable=True)
    note              = Column(Text, nullable=True)
    management_id     = Column(BigInteger, nullable=True)
    creator_name      = Column(String(255), nullable=True)
    uploaded_at       = Column(DateTime, nullable=True)
    synced_at         = Column(DateTime, server_default=func.now())


class GennisMissionSubtask(Base):
    __tablename__ = "gennis_mission_subtask"

    id                = Column(BigInteger, primary_key=True, index=True)
    gennis_id         = Column(Integer, nullable=False, unique=True)
    mission_gennis_id = Column(Integer, nullable=True, index=True)
    title             = Column(String(500), nullable=True)
    is_done           = Column(Boolean, nullable=True)
    # old gennis called this "order", which is reserved in SQL
    sort_order        = Column(Integer, nullable=True)
    management_id     = Column(BigInteger, nullable=True)
    creator_name      = Column(String(255), nullable=True)
    created_at        = Column(DateTime, nullable=True)
    synced_at         = Column(DateTime, server_default=func.now())


class GennisManagementInvestment(Base):
    __tablename__ = "gennis_management_investment"

    id                   = Column(BigInteger, primary_key=True, index=True)
    gennis_id            = Column(Integer, nullable=False, unique=True)
    management_gennis_id = Column(Integer, nullable=True)
    amount               = Column(BigInteger, nullable=True)
    date                 = Column(Date, nullable=True, index=True)
    description          = Column(Text, nullable=True)
    payment_type         = Column(String(100), nullable=True)
    location_id          = Column(Integer, nullable=True, index=True)
    deleted              = Column(Boolean, nullable=True)
    synced_at            = Column(DateTime, server_default=func.now())


class GennisManagementDividend(Base):
    __tablename__ = "gennis_management_dividend"

    id                   = Column(BigInteger, primary_key=True, index=True)
    gennis_id            = Column(Integer, nullable=False, unique=True)
    management_gennis_id = Column(Integer, nullable=True)
    amount               = Column(BigInteger, nullable=True)
    date                 = Column(Date, nullable=True, index=True)
    description          = Column(Text, nullable=True)
    payment_type         = Column(String(100), nullable=True)
    location_id          = Column(Integer, nullable=True, index=True)
    deleted              = Column(Boolean, nullable=True)
    synced_at            = Column(DateTime, server_default=func.now())


class GennisCapital(Base):
    __tablename__ = "gennis_capital"

    id                       = Column(BigInteger, primary_key=True, index=True)
    gennis_id                = Column(Integer, nullable=False, unique=True)
    name                     = Column(String(255), nullable=True)
    number                   = Column(String(100), nullable=True)
    price                    = Column(BigInteger, nullable=True)
    term                     = Column(Integer, nullable=True)
    category_id              = Column(Integer, nullable=True)
    location_id              = Column(Integer, nullable=True, index=True)
    account_period_id        = Column(Integer, nullable=True)
    payment_type_id          = Column(Integer, nullable=True)
    total_down_cost          = Column(BigInteger, nullable=True)
    img                      = Column(String(500), nullable=True)
    deleted                  = Column(Boolean, nullable=True)
    calendar_day_gennis_id   = Column(Integer, nullable=True)
    calendar_month_gennis_id = Column(Integer, nullable=True)
    calendar_year_gennis_id  = Column(Integer, nullable=True)
    date                     = Column(Date, nullable=True, index=True)
    year                     = Column(Integer, nullable=True)
    month                    = Column(Integer, nullable=True)
    synced_at                = Column(DateTime, server_default=func.now())


class GennisMainOverhead(Base):
    __tablename__ = "gennis_main_overhead"

    id                       = Column(BigInteger, primary_key=True, index=True)
    gennis_id                = Column(Integer, nullable=False, unique=True)
    amount_sum               = Column(BigInteger, nullable=True)
    payment_type_id          = Column(Integer, nullable=True)
    reason                   = Column(Text, nullable=True)
    deleted                  = Column(Boolean, nullable=True)
    deleted_comment          = Column(Text, nullable=True)
    calendar_day_gennis_id   = Column(Integer, nullable=True)
    calendar_month_gennis_id = Column(Integer, nullable=True)
    calendar_year_gennis_id  = Column(Integer, nullable=True)
    date                     = Column(Date, nullable=True, index=True)
    year                     = Column(Integer, nullable=True)
    month                    = Column(Integer, nullable=True)
    synced_at                = Column(DateTime, server_default=func.now())


class GennisOverheadTypeLogPayment(Base):
    __tablename__ = "gennis_overhead_type_log_payment"

    id                         = Column(BigInteger, primary_key=True, index=True)
    gennis_id                  = Column(Integer, nullable=False, unique=True)
    overhead_type_log_gennis_id = Column(Integer, nullable=True, index=True)
    overhead_gennis_id         = Column(Integer, nullable=True)
    payment_type_id            = Column(Integer, nullable=True)
    amount                     = Column(BigInteger, nullable=True)
    paid_date                  = Column(DateTime, nullable=True)
    note                       = Column(Text, nullable=True)
    created_by_gennis_id       = Column(Integer, nullable=True)
    management_id              = Column(Integer, nullable=True)
    deleted                    = Column(Boolean, nullable=True)
    created_at                 = Column(DateTime, nullable=True)
    synced_at                  = Column(DateTime, server_default=func.now())


class GennisReport(Base):
    __tablename__ = "gennis_report"

    id           = Column(BigInteger, primary_key=True, index=True)
    gennis_id    = Column(Integer, nullable=False, unique=True)
    name         = Column(String(255), nullable=True)
    category     = Column(String(100), nullable=True)
    program_type = Column(String(100), nullable=True)
    text         = Column(Text, nullable=True)
    synced_at    = Column(DateTime, server_default=func.now())


class GennisReportMember(Base):
    __tablename__ = "gennis_report_member"

    id                  = Column(BigInteger, primary_key=True, index=True)
    gennis_id           = Column(Integer, nullable=False, unique=True)
    report_gennis_id    = Column(Integer, nullable=True, index=True)
    member_gennis_id    = Column(Integer, nullable=True)
    daily_message_count = Column(Integer, nullable=True)
    synced_at           = Column(DateTime, server_default=func.now())


class GennisUserSync(Base):
    __tablename__ = "gennis_user"

    id                     = Column(BigInteger, primary_key=True, index=True)
    gennis_id              = Column(Integer, nullable=False, unique=True)
    name                   = Column(String(255), nullable=True)
    surname                = Column(String(255), nullable=True)
    father_name            = Column(String(255), nullable=True)
    username               = Column(String(100), nullable=True)
    age                    = Column(Integer, nullable=True)
    location_id            = Column(Integer, nullable=True)
    role_id                = Column(Integer, nullable=True)
    education_language_id  = Column(Integer, nullable=True)
    photo_profile          = Column(String(500), nullable=True)
    balance                = Column(Integer, nullable=True)
    deleted                = Column(Boolean, default=False)
    level                  = Column(Integer, nullable=True)
    calendar_day_gennis_id = Column(Integer, nullable=True)
    synced_at              = Column(DateTime, server_default=func.now(), onupdate=func.now())


class GennisTeacherSync(Base):
    __tablename__ = "gennis_teacher"

    id             = Column(BigInteger, primary_key=True, index=True)
    gennis_id      = Column(Integer, nullable=False, unique=True)
    user_gennis_id = Column(Integer, nullable=True)
    name           = Column(String(255), nullable=True)
    surname        = Column(String(255), nullable=True)
    username       = Column(String(100), nullable=True)
    age            = Column(Integer, nullable=True)
    photo_profile  = Column(String(500), nullable=True)
    language_name  = Column(String(100), nullable=True)
    table_color    = Column(String(50), nullable=True)
    total_students = Column(Integer, nullable=True)
    is_active      = Column(Boolean, default=True)
    reg_date       = Column(DateTime, nullable=True)
    synced_at      = Column(DateTime, server_default=func.now(), onupdate=func.now())


class GennisStaffSync(Base):
    __tablename__ = "gennis_staff"

    id              = Column(BigInteger, primary_key=True, index=True)
    gennis_id       = Column(Integer, nullable=False, unique=True)
    user_gennis_id  = Column(Integer, nullable=True)
    name            = Column(String(255), nullable=True)
    surname         = Column(String(255), nullable=True)
    username        = Column(String(100), nullable=True)
    age             = Column(Integer, nullable=True)
    photo_profile   = Column(String(500), nullable=True)
    language_name   = Column(String(100), nullable=True)
    role_name       = Column(String(100), nullable=True)
    type_role       = Column(String(100), nullable=True)
    profession_id   = Column(Integer, nullable=True)
    profession_name = Column(String(255), nullable=True)
    location_id     = Column(Integer, nullable=True)
    level           = Column(Integer, nullable=True)
    deleted         = Column(Boolean, default=False)
    deleted_comment = Column(String(500), nullable=True)
    reg_date        = Column(DateTime, nullable=True)
    synced_at       = Column(DateTime, server_default=func.now(), onupdate=func.now())


class GennisAssistentSync(Base):
    __tablename__ = "gennis_assistent"

    id                = Column(BigInteger, primary_key=True, index=True)
    gennis_id         = Column(Integer, nullable=False, unique=True)
    user_gennis_id    = Column(Integer, nullable=True)
    teacher_gennis_id = Column(Integer, nullable=True)
    name              = Column(String(255), nullable=True)
    surname           = Column(String(255), nullable=True)
    username          = Column(String(100), nullable=True)
    age               = Column(Integer, nullable=True)
    photo_profile     = Column(String(500), nullable=True)
    language_name     = Column(String(100), nullable=True)
    location_id       = Column(Integer, nullable=True)
    deleted           = Column(Boolean, default=False)
    synced_at         = Column(DateTime, server_default=func.now(), onupdate=func.now())


class GennisRoomSync(Base):
    __tablename__ = "gennis_room"

    id          = Column(BigInteger, primary_key=True, index=True)
    gennis_id   = Column(Integer, nullable=False, unique=True)
    name        = Column(String(255), nullable=True)
    capacity    = Column(Integer, nullable=True)
    location_id = Column(Integer, nullable=True)
    deleted     = Column(Boolean, default=False)
    synced_at   = Column(DateTime, server_default=func.now(), onupdate=func.now())


class GennisWeekSync(Base):
    __tablename__ = "gennis_week"

    id          = Column(BigInteger, primary_key=True, index=True)
    gennis_id   = Column(Integer, nullable=False, unique=True)
    name        = Column(String(100), nullable=True)
    eng_name    = Column(String(50), nullable=True)
    order       = Column(Integer, nullable=True)
    location_id = Column(Integer, nullable=True)
    synced_at   = Column(DateTime, server_default=func.now(), onupdate=func.now())


class GennisGroupRoomWeekSync(Base):
    """Denormalized timetable snapshot — sync job fills all name/teacher fields."""
    __tablename__ = "gennis_group_room_week"

    id                  = Column(BigInteger, primary_key=True, index=True)
    gennis_id           = Column(Integer, nullable=False, unique=True)
    group_gennis_id     = Column(Integer, nullable=True)
    room_gennis_id      = Column(Integer, nullable=True)
    week_gennis_id      = Column(Integer, nullable=True)
    location_id         = Column(Integer, nullable=True)
    start_time          = Column(String(20), nullable=True)
    end_time            = Column(String(20), nullable=True)
    group_name          = Column(String(255), nullable=True)
    subject_name        = Column(String(255), nullable=True)
    room_name           = Column(String(255), nullable=True)
    week_name           = Column(String(100), nullable=True)
    week_order          = Column(Integer, nullable=True)
    teacher_gennis_id   = Column(Integer, nullable=True)
    teacher_name        = Column(String(255), nullable=True)
    teacher_surname     = Column(String(255), nullable=True)
    assistent_gennis_id = Column(Integer, nullable=True)
    assistent_name      = Column(String(255), nullable=True)
    synced_at           = Column(DateTime, server_default=func.now(), onupdate=func.now())


# Teacher junction tables (store raw gennis IDs — no FK constraints)
gennis_teacher_location_table = Table(
    "gennis_teacher_location", Base.metadata,
    Column("teacher_gennis_id", Integer, nullable=False),
    Column("location_id", Integer, nullable=False),
    UniqueConstraint("teacher_gennis_id", "location_id", name="uq_gtl_teacher_location"),
)

gennis_teacher_subject_link_table = Table(
    "gennis_teacher_subject_link", Base.metadata,
    Column("teacher_gennis_id", Integer, nullable=False),
    Column("subject_gennis_id", Integer, nullable=False),
    UniqueConstraint("teacher_gennis_id", "subject_gennis_id", name="uq_gtsl_teacher_subject"),
)

gennis_teacher_group_link_table = Table(
    "gennis_teacher_group_link", Base.metadata,
    Column("teacher_gennis_id", Integer, nullable=False),
    Column("group_gennis_id", Integer, nullable=False),
    UniqueConstraint("teacher_gennis_id", "group_gennis_id", name="uq_gtgl_teacher_group"),
)


# Statistics tables (needed for teachers module statistics endpoints)

class GennisAttendanceSync(Base):
    __tablename__ = "gennis_attendance"

    id                       = Column(BigInteger, primary_key=True, index=True)
    gennis_id                = Column(Integer, nullable=False, unique=True)
    student_gennis_id        = Column(Integer, nullable=True)
    teacher_gennis_id        = Column(Integer, nullable=True)
    group_gennis_id          = Column(Integer, nullable=True)
    subject_gennis_id        = Column(Integer, nullable=True)
    location_id              = Column(Integer, nullable=True)
    calendar_month_gennis_id = Column(Integer, nullable=True)
    calendar_year_gennis_id  = Column(Integer, nullable=True)
    ball_percentage          = Column(Integer, nullable=True)
    synced_at                = Column(DateTime, server_default=func.now(), onupdate=func.now())


class GennisGroupReasonSync(Base):
    __tablename__ = "gennis_group_reason"

    id        = Column(BigInteger, primary_key=True, index=True)
    gennis_id = Column(Integer, nullable=False, unique=True)
    reason    = Column(String(500), nullable=True)
    synced_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class GennisTeacherGroupStatisticsSync(Base):
    __tablename__ = "gennis_teacher_group_statistics"

    id                       = Column(BigInteger, primary_key=True, index=True)
    gennis_id                = Column(Integer, nullable=False, unique=True)
    teacher_gennis_id        = Column(Integer, nullable=True)
    reason_gennis_id         = Column(Integer, nullable=True)
    percentage               = Column(Integer, nullable=True)
    calendar_month_gennis_id = Column(Integer, nullable=True)
    calendar_year_gennis_id  = Column(Integer, nullable=True)
    number_students          = Column(Integer, nullable=True)
    synced_at                = Column(DateTime, server_default=func.now(), onupdate=func.now())


class GennisTeacherObservationDaySync(Base):
    __tablename__ = "gennis_teacher_observation_day"

    id                       = Column(BigInteger, primary_key=True, index=True)
    gennis_id                = Column(Integer, nullable=False, unique=True)
    teacher_gennis_id        = Column(Integer, nullable=True)
    group_gennis_id          = Column(Integer, nullable=True)
    calendar_day_gennis_id   = Column(Integer, nullable=True)
    calendar_month_gennis_id = Column(Integer, nullable=True)
    calendar_year_gennis_id  = Column(Integer, nullable=True)
    user_gennis_id           = Column(Integer, nullable=True)
    average                  = Column(Integer, nullable=True)
    synced_at                = Column(DateTime, server_default=func.now(), onupdate=func.now())


class GennisLessonPlanSync(Base):
    __tablename__ = "gennis_lesson_plan"

    id                = Column(BigInteger, primary_key=True, index=True)
    gennis_id         = Column(Integer, nullable=False, unique=True)
    teacher_gennis_id = Column(Integer, nullable=True)
    group_gennis_id   = Column(Integer, nullable=True)
    ball              = Column(Integer, nullable=True)
    date              = Column(DateTime, nullable=True)
    synced_at         = Column(DateTime, server_default=func.now(), onupdate=func.now())


# ── Rooms (local, managed by gennis-v2) ──────────────────────────────────────

class Room(Base):
    __tablename__ = "room"

    id               = Column(BigInteger, primary_key=True, index=True)
    name             = Column(String(255), nullable=False)
    location_id      = Column(Integer, nullable=True)
    electronic_board = Column(Boolean, default=False)
    seats_number     = Column(Integer, nullable=True)
    deleted          = Column(Boolean, default=False)
    created_at       = Column(DateTime, server_default=func.now())

    images = relationship("RoomImage", back_populates="room", lazy="selectin",
                          primaryjoin="and_(Room.id == RoomImage.room_id, RoomImage.deleted == False)")


class RoomImage(Base):
    __tablename__ = "room_image"

    id         = Column(BigInteger, primary_key=True, index=True)
    room_id    = Column(BigInteger, ForeignKey("room.id"), nullable=False)
    photo_url  = Column(String(500), nullable=False)
    deleted    = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())

    room = relationship("Room", back_populates="images", lazy="selectin")


# ── Turon Mirror Tables ───────────────────────────────────────────────────────

class TuronUserLink(Base):
    """Maps a management user to a Turon user account (auth_user)."""
    __tablename__ = "turon_user_link"

    id                 = Column(BigInteger, primary_key=True, index=True)
    management_user_id = Column(BigInteger, ForeignKey("user.id"), nullable=False, index=True)
    turon_user_id      = Column(Integer, nullable=False, unique=True)
    branch_id          = Column(Integer, nullable=True)
    branch_name        = Column(String(255), nullable=True)
    created_at         = Column(DateTime, server_default=func.now())

    user = relationship("User", foreign_keys=[management_user_id])


class TuronBranch(Base):
    __tablename__ = "turon_branch"

    id           = Column(BigInteger, primary_key=True, index=True)
    turon_id     = Column(Integer, nullable=False, unique=True)
    name         = Column(String(255), nullable=True)
    code         = Column(Integer, nullable=True)
    address      = Column(String(500), nullable=True)
    phone_number = Column(String(50), nullable=True)
    district     = Column(String(255), nullable=True)
    deleted      = Column(Boolean, default=False)
    synced_at    = Column(DateTime, server_default=func.now(), onupdate=func.now())


class TuronLanguage(Base):
    __tablename__ = "turon_language"

    id        = Column(BigInteger, primary_key=True, index=True)
    turon_id  = Column(Integer, nullable=False, unique=True)
    name      = Column(String(100), nullable=False)
    synced_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class TuronSubject(Base):
    __tablename__ = "turon_subject"

    id        = Column(BigInteger, primary_key=True, index=True)
    turon_id  = Column(Integer, nullable=False, unique=True)
    name      = Column(String(255), nullable=False)
    disabled  = Column(Boolean, default=False)
    synced_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class TuronSubjectLevel(Base):
    __tablename__ = "turon_subject_level"

    id               = Column(BigInteger, primary_key=True, index=True)
    turon_id         = Column(Integer, nullable=False, unique=True)
    turon_subject_id = Column(Integer, nullable=True, index=True)
    name             = Column(String(255), nullable=False)
    disabled         = Column(Boolean, default=False)
    synced_at        = Column(DateTime, server_default=func.now(), onupdate=func.now())


class TuronGroupReason(Base):
    __tablename__ = "turon_group_reason"

    id        = Column(BigInteger, primary_key=True, index=True)
    turon_id  = Column(Integer, nullable=False, unique=True)
    reason    = Column(String(500), nullable=True)
    synced_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class TuronTeacher(Base):
    __tablename__ = "turon_teacher"

    id                 = Column(BigInteger, primary_key=True, index=True)
    turon_id           = Column(Integer, nullable=False, unique=True)
    turon_user_id      = Column(Integer, nullable=True)
    management_user_id = Column(BigInteger, nullable=True, index=True)
    name               = Column(String(255), nullable=True)
    surname            = Column(String(255), nullable=True)
    username           = Column(String(100), nullable=True)
    color              = Column(String(50), nullable=True)
    total_students     = Column(Integer, nullable=True)
    salary_percentage  = Column(Integer, nullable=True)
    deleted            = Column(Boolean, default=False)
    synced_at          = Column(DateTime, server_default=func.now(), onupdate=func.now())


class TuronRoom(Base):
    __tablename__ = "turon_room"

    id             = Column(BigInteger, primary_key=True, index=True)
    turon_id       = Column(Integer, nullable=False, unique=True)
    name           = Column(String(255), nullable=True)
    capacity       = Column(Integer, nullable=True)
    branch_turon_id = Column(Integer, nullable=True, index=True)
    deleted        = Column(Boolean, default=False)
    synced_at      = Column(DateTime, server_default=func.now(), onupdate=func.now())


class TuronGroup(Base):
    __tablename__ = "turon_group"

    id               = Column(BigInteger, primary_key=True, index=True)
    turon_id         = Column(Integer, nullable=False, unique=True)
    name             = Column(String(255), nullable=True)
    branch_turon_id  = Column(Integer, nullable=True, index=True)
    subject_turon_id = Column(Integer, nullable=True)
    teacher_turon_id = Column(Integer, nullable=True)
    teacher_mgmt_id  = Column(BigInteger, nullable=True)
    language_turon_id = Column(Integer, nullable=True)
    price            = Column(Integer, nullable=True)
    teacher_salary   = Column(Integer, nullable=True)
    attendance_days  = Column(Integer, nullable=True)
    status           = Column(Boolean, default=True)
    deleted          = Column(Boolean, default=False)
    created_date     = Column(Date, nullable=True)
    synced_at        = Column(DateTime, server_default=func.now(), onupdate=func.now())


class TuronStudent(Base):
    __tablename__ = "turon_student"

    id              = Column(BigInteger, primary_key=True, index=True)
    turon_id        = Column(Integer, nullable=False, unique=True)
    turon_user_id   = Column(Integer, nullable=True)
    name            = Column(String(255), nullable=True)
    surname         = Column(String(255), nullable=True)
    phone           = Column(String(50), nullable=True)
    parents_number  = Column(String(50), nullable=True)
    born_date       = Column(Date, nullable=True)
    debt_status     = Column(BigInteger, nullable=True)
    synced_at       = Column(DateTime, server_default=func.now(), onupdate=func.now())


turon_student_group_table = Table(
    "turon_student_group", Base.metadata,
    Column("student_turon_id", Integer, nullable=False),
    Column("group_turon_id", Integer, nullable=False),
    UniqueConstraint("student_turon_id", "group_turon_id", name="uq_turon_student_group"),
)


class TuronDeletedStudentGroup(Base):
    __tablename__ = "turon_deleted_student_group"

    id               = Column(BigInteger, primary_key=True, index=True)
    turon_id         = Column(Integer, nullable=False, unique=True)
    student_turon_id = Column(Integer, nullable=False, index=True)
    group_turon_id   = Column(Integer, nullable=False, index=True)
    reason_turon_id  = Column(Integer, nullable=True)
    teacher_turon_id = Column(Integer, nullable=True)
    comment          = Column(String(500), nullable=True)
    deleted_date     = Column(Date, nullable=True)
    synced_at        = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (UniqueConstraint("student_turon_id", "group_turon_id", name="uq_turon_deleted_student_group"),)


class TuronLead(Base):
    __tablename__ = "turon_lead"

    id              = Column(BigInteger, primary_key=True, index=True)
    turon_id        = Column(Integer, nullable=False, unique=True)
    name            = Column(String(255), nullable=True)
    phone           = Column(String(50), nullable=True)
    branch_turon_id = Column(Integer, nullable=True, index=True)
    finished        = Column(Boolean, default=False)
    deleted         = Column(Boolean, default=False)
    created         = Column(Date, nullable=True)
    synced_at       = Column(DateTime, server_default=func.now(), onupdate=func.now())


class TuronOverheadType(Base):
    __tablename__ = "turon_overhead_type"

    id              = Column(BigInteger, primary_key=True, index=True)
    turon_id        = Column(Integer, nullable=False, unique=True)
    name            = Column(String(255), nullable=True)
    cost            = Column(BigInteger, nullable=True)
    changeable      = Column(Boolean, default=True)
    branch_turon_id = Column(Integer, nullable=True)
    management_id   = Column(Integer, nullable=True)
    deleted         = Column(Boolean, default=False)
    synced_at       = Column(DateTime, server_default=func.now(), onupdate=func.now())


class TuronOverhead(Base):
    __tablename__ = "turon_overhead"

    id                    = Column(BigInteger, primary_key=True, index=True)
    turon_id              = Column(Integer, nullable=False, unique=True)
    overhead_type_turon_id = Column(Integer, nullable=True, index=True)
    branch_turon_id       = Column(Integer, nullable=True, index=True)
    amount                = Column(BigInteger, nullable=True)
    date                  = Column(Date, nullable=True)
    deleted               = Column(Boolean, default=False)
    synced_at             = Column(DateTime, server_default=func.now(), onupdate=func.now())


class TuronCapitalCategory(Base):
    __tablename__ = "turon_capital_category"

    id        = Column(BigInteger, primary_key=True, index=True)
    turon_id  = Column(Integer, nullable=False, unique=True)
    name      = Column(String(100), nullable=True)
    synced_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class TuronCapital(Base):
    __tablename__ = "turon_capital"

    id               = Column(BigInteger, primary_key=True, index=True)
    turon_id         = Column(Integer, nullable=False, unique=True)
    name             = Column(String(255), nullable=True)
    price            = Column(BigInteger, nullable=True)
    total_down_cost  = Column(BigInteger, nullable=True)
    branch_turon_id  = Column(Integer, nullable=True, index=True)
    category_turon_id = Column(Integer, nullable=True)
    added_date       = Column(Date, nullable=True)
    deleted          = Column(Boolean, default=False)
    synced_at        = Column(DateTime, server_default=func.now(), onupdate=func.now())


class TuronCapitalTerm(Base):
    __tablename__ = "turon_capital_term"

    id               = Column(BigInteger, primary_key=True, index=True)
    turon_id         = Column(Integer, nullable=False, unique=True)
    capital_turon_id = Column(Integer, nullable=True, index=True)
    down_cost        = Column(BigInteger, nullable=True)
    month_date       = Column(Date, nullable=True)
    synced_at        = Column(DateTime, server_default=func.now(), onupdate=func.now())


class TuronStudentPayment(Base):
    __tablename__ = "turon_student_payment"

    id               = Column(BigInteger, primary_key=True, index=True)
    turon_id         = Column(Integer, nullable=False, unique=True)
    student_turon_id = Column(Integer, nullable=True, index=True)
    group_turon_id   = Column(Integer, nullable=True)
    branch_turon_id  = Column(Integer, nullable=True, index=True)
    payment_sum      = Column(BigInteger, nullable=True)
    extra_payment    = Column(BigInteger, nullable=True)
    payment_date     = Column(Date, nullable=True)
    deleted          = Column(Boolean, default=False)
    synced_at        = Column(DateTime, server_default=func.now(), onupdate=func.now())


class TuronAttendanceHistoryStudent(Base):
    __tablename__ = "turon_attendance_history_student"

    id               = Column(BigInteger, primary_key=True, index=True)
    turon_id         = Column(Integer, nullable=False, unique=True)
    student_turon_id = Column(Integer, nullable=True, index=True)
    teacher_turon_id = Column(Integer, nullable=True)
    group_turon_id   = Column(Integer, nullable=True, index=True)
    branch_turon_id  = Column(Integer, nullable=True, index=True)
    month_date       = Column(Date, nullable=True)
    total_debt       = Column(BigInteger, nullable=True)
    remaining_debt   = Column(BigInteger, nullable=True)
    payment          = Column(BigInteger, nullable=True)
    ball_percentage  = Column(Integer, nullable=True)
    present_days     = Column(Integer, nullable=True)
    absent_days      = Column(Integer, nullable=True)
    discount         = Column(Integer, nullable=True)
    synced_at        = Column(DateTime, server_default=func.now(), onupdate=func.now())


class TuronTeacherSalary(Base):
    __tablename__ = "turon_teacher_salary"

    id               = Column(BigInteger, primary_key=True, index=True)
    turon_id         = Column(Integer, nullable=False, unique=True)
    teacher_turon_id = Column(Integer, nullable=True, index=True)
    branch_turon_id  = Column(Integer, nullable=True, index=True)
    month_date       = Column(Date, nullable=True)
    total_salary     = Column(BigInteger, nullable=True)
    remaining_salary = Column(BigInteger, nullable=True)
    taken_salary     = Column(BigInteger, nullable=True)
    percentage       = Column(Integer, nullable=True)
    synced_at        = Column(DateTime, server_default=func.now(), onupdate=func.now())


class TuronTeacherSalaryPayment(Base):
    __tablename__ = "turon_teacher_salary_payment"

    id               = Column(BigInteger, primary_key=True, index=True)
    turon_id         = Column(Integer, nullable=False, unique=True)
    teacher_turon_id = Column(Integer, nullable=True, index=True)
    salary_turon_id  = Column(Integer, nullable=True)
    branch_turon_id  = Column(Integer, nullable=True)
    salary           = Column(BigInteger, nullable=True)
    date             = Column(Date, nullable=True)
    comment          = Column(String(300), nullable=True)
    deleted          = Column(Boolean, default=False)
    synced_at        = Column(DateTime, server_default=func.now(), onupdate=func.now())


class TuronLessonPlan(Base):
    __tablename__ = "turon_lesson_plan"

    id               = Column(BigInteger, primary_key=True, index=True)
    turon_id         = Column(Integer, nullable=False, unique=True)
    teacher_turon_id = Column(Integer, nullable=True, index=True)
    group_turon_id   = Column(Integer, nullable=True)
    ball             = Column(Integer, nullable=True)
    date             = Column(Date, nullable=True)
    synced_at        = Column(DateTime, server_default=func.now(), onupdate=func.now())


class TuronTeacherObservationDay(Base):
    __tablename__ = "turon_teacher_observation_day"

    id               = Column(BigInteger, primary_key=True, index=True)
    turon_id         = Column(Integer, nullable=False, unique=True)
    teacher_turon_id = Column(Integer, nullable=True, index=True)
    group_turon_id   = Column(Integer, nullable=True)
    user_turon_id    = Column(Integer, nullable=True)
    day              = Column(Date, nullable=True)
    average          = Column(Integer, nullable=True)
    synced_at        = Column(DateTime, server_default=func.now(), onupdate=func.now())


class TuronTeacherGroupStatistics(Base):
    __tablename__ = "turon_teacher_group_statistics"

    id               = Column(BigInteger, primary_key=True, index=True)
    turon_id         = Column(Integer, nullable=False, unique=True)
    teacher_turon_id = Column(Integer, nullable=True, index=True)
    reason_turon_id  = Column(Integer, nullable=True)
    branch_turon_id  = Column(Integer, nullable=True)
    number_students  = Column(Integer, nullable=True)
    percentage       = Column(Integer, nullable=True)
    date             = Column(Date, nullable=True)
    synced_at        = Column(DateTime, server_default=func.now(), onupdate=func.now())


class GennisAttendanceHistoryTeacher(Base):
    __tablename__ = "gennis_attendance_history_teacher"

    id               = Column(BigInteger, primary_key=True, index=True)
    teacher_id       = Column(Integer, nullable=True)
    teacher_name     = Column(String(511), nullable=True)
    total_salary     = Column(Integer, nullable=False, default=0)
    subject_id       = Column(Integer, nullable=True)
    group_id         = Column(Integer, nullable=True)
    taken_money      = Column(Integer, nullable=False, default=0)
    remaining_salary = Column(Integer, nullable=False, default=0)
    location_id      = Column(Integer, nullable=True)
    calendar_month   = Column(Integer, nullable=False)
    calendar_year    = Column(Integer, nullable=False)
    status           = Column(Boolean, nullable=False, default=False)
    synced_at        = Column(DateTime, server_default=func.now())


class GennisLocationSubject(Base):
    """Admin-curated list of important subjects per branch.

    Used by subject-selection UIs to filter the subject list to only what
    the branch actually teaches.
    """
    __tablename__ = "gennis_location_subject"
    __table_args__ = (
        UniqueConstraint("subject_id", "location_id", name="uq_gls_subject_location"),
    )

    id          = Column(BigInteger, primary_key=True, index=True)
    subject_id  = Column(BigInteger, ForeignKey("gennis_subject.id"), nullable=False, index=True)
    location_id = Column(BigInteger, ForeignKey("gennis_location.id"), nullable=False, index=True)
    created_at  = Column(DateTime, server_default=func.now())

    subject  = relationship("GennisSubject")
    location = relationship("GennisLocation")
