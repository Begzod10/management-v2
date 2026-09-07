"""Directory endpoints for student_platform (docs/requests #20): the
active-users diff feed and the teachers directory. Split out of
student_platform.py to keep that file under the project's file-size
guideline — these share its router prefix and the identity/active-status
decisions documented in app/services/student_directory.py.
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

# request #24 §C: a plain PARENT test account's own token could pull the
# WHOLE school's student and teacher roster (usernames included) through
# these two endpoints — they're meant for classroom's own service-side sync
# (the doc itself asks for a real service account for this; until one
# exists, any staff/admin token still works), never for an individual
# parent or student session. Narrowed to exclude exactly the two roles that
# should never need "list everyone" access, rather than guessing at the
# full staff role list the way an allowlist would have to.
_NO_ROSTER_ACCESS_ROLES = {"parent", "student"}


def _staff_only(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role in _NO_ROSTER_ACCESS_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not available to this account")
    return user

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
    _: models.User = Depends(_staff_only),
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
    _: models.User = Depends(_staff_only),
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
