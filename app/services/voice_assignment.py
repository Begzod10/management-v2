"""Role-based mission-assignment rules shared by voice-driven mission creation
(currently: Telegram voice-note → AI mission creation, see telegram_voice.py).

Ported from V1 (gennis_management)'s app/services/realtime_session.py — that
file also carries the unrelated live OpenAI-Realtime voice-call assistant
(system prompt, function-call tools, WebSocket session config), which this
port deliberately excludes since only the Telegram voice-note pipeline was
requested. If the live voice-call feature is needed later, port that part
separately from the same source file.
"""

from __future__ import annotations

from app.models import Job, User

try:
    from app.models import UserSkill as _UserSkill
except ImportError:
    _UserSkill = None

# ── Role-based assignment rules (mirrors missions.py in V1) ───────────────────
_OWNER_ROLES = {"owner"}

_ROLE_CAN_ASSIGN: dict[str, set[str]] = {
    "super_admin":      {"director", "dept_head", "project_manager"},
    "director":         {"deputy_director", "dept_head"},
    "ad":               {"teacher", "subject_council", "coordinator"},
    "dept_head":        {"team_lead", "specialist"},
    "deputy_director":  {"class_teacher", "psychologist", "student_president", "sardor"},
    "team_lead":        set(),
    "project_manager":  set(),
    "employee":         {"employee"},
}

# Roles that require a project/section context — voice cannot satisfy that
_PROJECT_SCOPED_ROLES = {"manager", "team_lead", "project_manager"}

_ROLE_PRIORITY = (
    "super_admin", "director", "ad", "dept_head", "deputy_director",
    "manager", "team_lead", "project_manager", "employee",
)

# Roles that assign missions rather than execute them — exclude from executor list
_NON_EXECUTOR_ROLES = {"owner", "director", "manager"}

# Skills every role gets by default — not useful for AI matching between individuals
_GENERIC_SKILLS_EN = {
    "Communication", "Teamwork", "Time management", "Organization",
    "Document management", "Scheduling", "Data entry",
}


def _effective_role(user: User) -> str:
    extra = {r.role for r in user.extra_roles} if getattr(user, "extra_roles", None) else set()
    all_roles = {user.role} | extra
    for r in _ROLE_PRIORITY:
        if r in all_roles:
            return r
    return user.role


def _check_voice_assignment(creator: User, executor: User) -> str | None:
    """Return an error string if creator is not allowed to assign to executor, else None."""
    if creator.id == executor.id:
        return None
    if creator.role in _OWNER_ROLES:
        return None
    creator_role = _effective_role(creator)
    if creator_role in _PROJECT_SCOPED_ROLES:
        return f"Your role ('{creator_role}') requires project context for assignments — not supported in voice mode."
    allowed = _ROLE_CAN_ASSIGN.get(creator_role, set())
    if executor.role not in allowed:
        return f"Your role ('{creator_role}') is not allowed to assign missions to role '{executor.role}'."
    return None


def _executor_dict(u: User, db) -> dict:
    job_name = None
    if u.job_id:
        job = db.query(Job).filter(Job.id == u.job_id).first()
        job_name = job.name if job else None
    specific = []
    if _UserSkill is not None:
        skill_rows = db.query(_UserSkill).filter(_UserSkill.user_id == u.id).all()
        specific = [
            f"{s.skill_uz}/{s.skill_en}"
            for s in skill_rows
            if s.skill_en not in _GENERIC_SKILLS_EN
        ]
    entry = {
        "id": u.id,
        "name": f"{u.name} {u.surname}".strip(),
        "role": u.role,
    }
    if job_name:
        entry["job"] = job_name
    if specific:
        entry["skills"] = ", ".join(specific)
    return entry
