"""Query helpers for student_platform's "who exists, who's active" directory
endpoints (docs/requests #20): the roster username backfill, the
active-users diff feed, and the teachers directory.

Kept out of the integrations router modules for the same reason
parent_portal.py is: plain, FastAPI-free query functions so they're testable
without spinning up a request.

"Active" here means "would currently succeed at /login" per
student_platform_login's own gates (user.is_active, not user.deleted) PLUS
the domain-specific flag each source already tracks for "still enrolled" /
"still employed":
  * gennis student: member of at least one non-deleted, running group —
    gennis_student itself carries no status/deleted column of its own.
  * gennis teacher: gennis_teacher.is_active (synced from old gennis).
  * turon student/teacher: turon_student_profile_v2 / turon_teacher_profile_v2
    .deleted — the same "chiqarilgan" flag student_platform_group_students
    already filters stale group/flow memberships around.

Deliberately excludes user.is_locked: that's a transient failed-login
lockout (a few mistyped passwords), not a departure, and treating it as one
would make the deactivation list flap for someone who'll unlock in minutes.

Every function here resolves `username` through the SAME identity bridge
student_platform_login itself authenticates against (gennis_user_link /
turon's direct user.id) rather than a raw sync table's own `username`
column (gennis_teacher.username, gennis_staff.username) — those mirror old
gennis and can drift from the bridged management account's actual login
name (renamed via admin_change_username, or never touched at all), which
would hand the caller a key that can't match the real account.

`login_id` (request doc #24 §A): the bridged management `user.id` — the
SAME value embedded in the access_token's own `user_id` claim at /login,
distinct from `id` for a gennis account (`id` there is the STUDENT/profile
id, gennis_student.gennis_id or the teacher's gennis_user_id — see each
function's own docstring). For turon, `login_id` and `id` are always the
same value (turon has no separate id space at all), included anyway so a
caller doesn't have to know that per-source difference itself.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app import models


def active_gennis_students(db: Session) -> list[dict]:
    """gennis_id + bridged username of every gennis student currently in at
    least one active group and whose management account can currently log
    in. `id` is the STUDENT id (gennis_student.gennis_id), matching what
    /login and the group-roster endpoints already hand out for a student."""
    rows = (
        db.query(models.GennisStudent.gennis_id, models.User.id, models.User.username)
        .join(
            models.gennis_student_group_table,
            models.gennis_student_group_table.c.student_id == models.GennisStudent.id,
        )
        .join(
            models.GennisGroup,
            models.GennisGroup.id == models.gennis_student_group_table.c.group_id,
        )
        .join(
            models.GennisUserLink,
            models.GennisUserLink.gennis_user_id == models.GennisStudent.user_id,
        )
        .join(models.User, models.User.id == models.GennisUserLink.management_user_id)
        .filter(
            models.GennisGroup.deleted == False,  # noqa: E712
            models.GennisGroup.status == True,  # noqa: E712
            models.User.username.isnot(None),
            models.User.is_active == True,  # noqa: E712
            models.User.deleted == False,  # noqa: E712
        )
        .distinct()
        .all()
    )
    return [{"id": r.gennis_id, "login_id": r.id, "username": r.username} for r in rows]


def active_gennis_teachers(db: Session) -> list[dict]:
    """`id` is gennis_user_link.gennis_user_id, matching what /login hands a
    gennis teacher back as their own `id` (NOT gennis_teacher.gennis_id —
    see student_platform_login's docstring on the two teacher ids)."""
    rows = (
        db.query(models.GennisUserLink.gennis_user_id, models.User.id, models.User.username)
        .join(
            models.GennisTeacherSync,
            models.GennisTeacherSync.user_gennis_id == models.GennisUserLink.gennis_user_id,
        )
        .join(models.User, models.User.id == models.GennisUserLink.management_user_id)
        .filter(
            models.GennisTeacherSync.is_active == True,  # noqa: E712
            models.User.username.isnot(None),
            models.User.is_active == True,  # noqa: E712
            models.User.deleted == False,  # noqa: E712
        )
        .distinct()
        .all()
    )
    return [{"id": r.gennis_user_id, "login_id": r.id, "username": r.username} for r in rows]


def active_turon_students(db: Session) -> list[dict]:
    """`id` is user.id directly — turon has no separate student id space."""
    rows = (
        db.query(models.User.id, models.User.username)
        .join(models.TuronStudentProfileV2, models.TuronStudentProfileV2.user_id == models.User.id)
        .filter(
            models.TuronStudentProfileV2.deleted == False,  # noqa: E712
            models.User.username.isnot(None),
            models.User.is_active == True,  # noqa: E712
            models.User.deleted == False,  # noqa: E712
        )
        .all()
    )
    return [{"id": r.id, "login_id": r.id, "username": r.username} for r in rows]


def active_turon_teachers(db: Session) -> list[dict]:
    rows = (
        db.query(models.User.id, models.User.username)
        .join(models.TuronTeacherProfileV2, models.TuronTeacherProfileV2.user_id == models.User.id)
        .filter(
            models.TuronTeacherProfileV2.deleted == False,  # noqa: E712
            models.User.username.isnot(None),
            models.User.is_active == True,  # noqa: E712
            models.User.deleted == False,  # noqa: E712
        )
        .all()
    )
    return [{"id": r.id, "login_id": r.id, "username": r.username} for r in rows]


def gennis_username_map(db: Session, gennis_user_ids: list[int]) -> dict[int, str]:
    """gennis_user_id (gennis_student.user_id / gennis_teacher.user_gennis_id)
    -> bridged management username, for exactly the ids given. Used to
    backfill `username` onto a roster that's already been fetched by group/
    flow, rather than re-deriving the whole active/inactive population.
    Missing key means "no bridged account with a username", not "empty
    string" — matches the null-if-unresolved shape the roster endpoints
    already use for other optional fields (e.g. birth_date)."""
    if not gennis_user_ids:
        return {}
    rows = (
        db.query(models.GennisUserLink.gennis_user_id, models.User.username)
        .join(models.User, models.User.id == models.GennisUserLink.management_user_id)
        .filter(
            models.GennisUserLink.gennis_user_id.in_(gennis_user_ids),
            models.User.username.isnot(None),
        )
        .all()
    )
    return {r.gennis_user_id: r.username for r in rows}


def gennis_login_id_map(db: Session, gennis_user_ids: list[int]) -> dict[int, tuple[int, str]]:
    """Like gennis_username_map, but also carries the bridged management
    `user.id` (request doc #24 §A's `login_id`) — used where a caller needs
    both, e.g. _parent_children (student_platform.py), rather than two
    separate round trips through the same join."""
    if not gennis_user_ids:
        return {}
    rows = (
        db.query(models.GennisUserLink.gennis_user_id, models.User.id, models.User.username)
        .join(models.User, models.User.id == models.GennisUserLink.management_user_id)
        .filter(
            models.GennisUserLink.gennis_user_id.in_(gennis_user_ids),
            models.User.username.isnot(None),
        )
        .all()
    )
    return {r.gennis_user_id: (r.id, r.username) for r in rows}


def gennis_teachers_directory(db: Session) -> list[dict]:
    """Every gennis teacher with a bridged management account (i.e. ever
    loginable through student_platform), active or not — unlike
    active_gennis_teachers above, this is the full roster with an
    `is_active` flag per entry, not a pre-filtered list."""
    rows = (
        db.query(
            models.GennisUserLink.gennis_user_id,
            models.User.id,
            models.User.username,
            models.User.name,
            models.User.surname,
            models.User.is_active,
            models.User.deleted,
            models.GennisTeacherSync.is_active.label("synced_active"),
        )
        .join(
            models.GennisTeacherSync,
            models.GennisTeacherSync.user_gennis_id == models.GennisUserLink.gennis_user_id,
        )
        .join(models.User, models.User.id == models.GennisUserLink.management_user_id)
        .filter(models.User.username.isnot(None))
        .all()
    )
    return [
        {
            "id": r.gennis_user_id,
            "login_id": r.id,
            "username": r.username,
            "name": r.name or "",
            "surname": r.surname or "",
            "is_active": bool(r.is_active) and not r.deleted and bool(r.synced_active),
        }
        for r in rows
    ]


def turon_teachers_directory(db: Session) -> list[dict]:
    rows = (
        db.query(
            models.User.id,
            models.User.username,
            models.User.name,
            models.User.surname,
            models.User.is_active,
            models.User.deleted,
            models.TuronTeacherProfileV2.deleted.label("profile_deleted"),
        )
        .join(models.TuronTeacherProfileV2, models.TuronTeacherProfileV2.user_id == models.User.id)
        .filter(models.User.username.isnot(None))
        .all()
    )
    return [
        {
            "id": r.id,
            "login_id": r.id,
            "username": r.username,
            "name": r.name or "",
            "surname": r.surname or "",
            "is_active": bool(r.is_active) and not r.deleted and not r.profile_deleted,
        }
        for r in rows
    ]
