"""Mission assignment eligibility rules — who may assign a mission to whom.

Extracted out of app/routers/v1/management/missions.py (the canonical,
most-complete source of this logic — see git history) into its own leaf
module with no router-package imports. Both the REST missions router and the
voice-assistant services (app/services/realtime_session.py,
app/services/telegram_voice.py) depend on this; missions.py used to be the
one importing *from* those voice services indirectly via package __init__
side effects, which created a circular import that only "worked" by
accident of the exact module order in app/routers/v1/management/__init__.py
tuple. Any module that needs these rules should import them from here, not
from missions.py.
"""

from __future__ import annotations

from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.dependencies import has_role
from app.models import Project, ProjectMember, Section, SectionMember, User

# ── Role-based assignment rules ───────────────────────────────────────────────

ROLE_CAN_ASSIGN: dict[str, set[str]] = {
    "super_admin":      {"director", "dept_head", "project_manager"},
    "director":         {"deputy_director", "dept_head"},
    "ad":               {"teacher", "subject_council", "coordinator"},
    "dept_head":        {"team_lead", "specialist"},
    "deputy_director":  {"class_teacher", "psychologist", "student_president", "sardor"},
    "team_lead":        set(),   # project-scoped check below
    "project_manager":  set(),   # project-scoped check below
    "employee":         {"employee"},  # service_request or self only
}

OWNER_ROLES = {"owner"}


def _eligible_executors(creator: User, channel: str, project_id: Optional[int], section_id: Optional[int], db: Session) -> List[User]:
    """Return active users the creator is allowed to assign missions to."""
    base = db.query(User).filter(User.is_active == True, User.deleted == False)

    def _dedup_with_self(users: List[User]) -> List[User]:
        # _validate_role_assignment short-circuits true when creator.id == executor.id,
        # so the eligible list must always include the creator — but never twice
        # when the role-filtered query already contains them.
        ids_seen = {u.id for u in users}
        if creator.is_active and not creator.deleted and creator.id not in ids_seen:
            users.append(creator)
        return users

    if has_role(creator, *OWNER_ROLES):
        # Owners assign top-level / unassigned people only; project and section
        # members are the responsibility of their respective managers / leaders.
        in_project = select(ProjectMember.user_id)
        in_section = select(SectionMember.user_id)
        return base.filter(
            ~User.id.in_(in_project),
            ~User.id.in_(in_section),
        ).all()

    if channel == "service_request":
        return base.all()

    if has_role(creator, "manager"):
        if project_id:
            project = db.query(Project).filter(
                Project.id == project_id,
                Project.manager_id == creator.id,
                Project.deleted == False,
            ).first()
            if not project:
                return _dedup_with_self([])
            member_ids = db.query(ProjectMember.user_id).filter(
                ProjectMember.project_id == project_id
            ).subquery()
            return _dedup_with_self(
                base.filter(
                    User.id.in_(member_ids),
                    User.role.notin_(OWNER_ROLES),
                ).all()
            )
        if section_id:
            section = db.query(Section).filter(
                Section.id == section_id,
                Section.leader_id == creator.id,
                Section.deleted == False,
            ).first()
            if not section:
                return _dedup_with_self([])
            member_ids = db.query(SectionMember.user_id).filter(
                SectionMember.section_id == section_id
            ).subquery()
            return _dedup_with_self(
                base.filter(
                    User.id.in_(member_ids),
                    User.role.notin_(OWNER_ROLES),
                ).all()
            )
        return _dedup_with_self([])  # manager without project/section: self only

    allowed_roles = ROLE_CAN_ASSIGN.get(creator.role, set())
    if not allowed_roles:
        return _dedup_with_self([])  # only self-assign allowed
    return _dedup_with_self(base.filter(User.role.in_(allowed_roles)).all())
