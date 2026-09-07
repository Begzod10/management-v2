"""Directory endpoints for student_platform (docs/requests #20): the
active-users diff feed and the teachers directory. Split out of
student_platform.py to keep that file under the project's file-size
guideline — these share its router prefix, its auth (get_current_user;
student_platform already holds a bearer token from /login), and the
identity/active-status decisions documented in
app/services/student_directory.py.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.dependencies import get_current_user
from app.services import student_directory as directory

router = APIRouter(prefix="/integrations/student-platform", tags=["Integrations"])

_SOURCES = {"gennis", "turon"}
_ROLES = {"student", "teacher"}

_ACTIVE_USERS_BY_SOURCE_ROLE = {
    ("gennis", "student"): directory.active_gennis_students,
    ("gennis", "teacher"): directory.active_gennis_teachers,
    ("turon", "student"): directory.active_turon_students,
    ("turon", "teacher"): directory.active_turon_teachers,
}


@router.get("/active-users")
def student_platform_active_users(
    source: str,
    role: str,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    """Everyone in `source` currently active as `role` — see
    app/services/student_directory.py for exactly what "active" means and
    why. Meant for a periodic full-list diff (request #20 doc's own
    proposed use: pull the whole list, deactivate locally whoever's
    missing) — this endpoint's contract is just "who's active right now",
    the doc's own safety note about never treating an empty/failed call as
    "deactivate everyone" is on the caller's side, not enforceable here.
    """
    if source not in _SOURCES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="source must be 'gennis' or 'turon'")
    if role not in _ROLES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="role must be 'student' or 'teacher'")

    users = _ACTIVE_USERS_BY_SOURCE_ROLE[(source, role)](db)
    return {"source": source, "role": role, "count": len(users), "users": users}


@router.get("/teachers")
def student_platform_teachers(
    source: str,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    """Every gennis/turon teacher with a bridged management account (i.e.
    ever loginable through student_platform), active or not — request #20
    doc §3, same shape as the student roster endpoints below `id` in this
    system's own id space (see student_directory.py's docstrings on
    each source's `id` choice)."""
    if source not in _SOURCES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="source must be 'gennis' or 'turon'")

    teachers = (
        directory.gennis_teachers_directory(db)
        if source == "gennis"
        else directory.turon_teachers_directory(db)
    )
    return {"teachers": teachers}
