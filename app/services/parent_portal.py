"""Shared identity-resolution and access-control helpers for the parent
portal's read-only student endpoints (attendance, payments — see
docs/requests #13/#14 from student_platform's classroom backend).

Kept out of the integrations router module so it has no FastAPI/router
dependency, matching the mission_eligibility.py precedent — a plain service
importable from anywhere without pulling in routing machinery.
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app import models


def my_id_in_source(db: Session, user: "models.User", source: str) -> Optional[int]:
    """The id `user` would see as their OWN `id` if they logged into
    student_platform as this source. Lets a student view their own record
    through the same (source, student_id) pair a parent would use for them.

    Mirrors student_platform_login's own id resolution exactly (turon: the
    shared `user.id` itself; gennis: gennis_student.gennis_id, NOT the
    gennis user id) — see that function's docstring for why they differ.

    The turon branch returns `user.id` unconditionally, without checking
    turon_user_profile_v2 the way the gennis branch checks gennis_user_link
    — turon has no separate id space at all (any `user.id` IS already a
    valid turon-shaped id), so there's nothing to verify. This is still
    safe for a non-turon caller: can_view_student only ever compares this
    against the specific student_id in the request, so at most it confirms
    "this student_id is the caller's own id" — it can't grant access to
    anyone else's.
    """
    if source == "turon":
        return user.id
    if source == "gennis":
        link = (
            db.query(models.GennisUserLink)
            .filter(models.GennisUserLink.management_user_id == user.id)
            .first()
        )
        if not link or not link.gennis_user_id or link.gennis_user_id <= 0:
            return None
        student = (
            db.query(models.GennisStudent.gennis_id)
            .filter(models.GennisStudent.user_id == link.gennis_user_id)
            .first()
        )
        return student.gennis_id if student else None
    return None


def can_view_student(db: Session, current_user: "models.User", source: str, student_id: int) -> bool:
    """Only the student themself or a parent linked to them may see this.

    Per request-doc #14's privacy note, staff (teacher/methodist) are
    deliberately excluded even though they can see the same numbers
    elsewhere in the admin panel — this integration channel is scoped to
    the family only, not to "anyone with a valid token".

    Reads the SAME link tables gennis-v2's and turon-v2's own parent admin
    tools already write to (GennisParentChildLink -> parent_child_link,
    TuronParentChildLink -> turon_parent_child_v2) rather than a
    management-v2-only table — those already have real, in-use data;
    management-v2 briefly had its own separate (and empty) one, see
    app/models.py's docstrings on both classes for the full story.
    """
    if my_id_in_source(db, current_user, source) == student_id:
        return True
    if source == "gennis":
        internal_id = (
            db.query(models.GennisStudent.id).filter(models.GennisStudent.gennis_id == student_id).first()
        )
        if not internal_id:
            return False
        return bool(
            db.query(models.GennisParentChildLink.id)
            .filter(
                models.GennisParentChildLink.parent_user_id == current_user.id,
                models.GennisParentChildLink.student_id == internal_id[0],
            )
            .first()
        )
    if source == "turon":
        return bool(
            db.query(models.TuronParentChildLink.id)
            .filter(
                models.TuronParentChildLink.parent_user_id == current_user.id,
                models.TuronParentChildLink.student_user_id == student_id,
            )
            .first()
        )
    return False


def resolve_legacy_turon_student(db: Session, turon_db: Session, management_user_id: int):
    """Bridge a turon-v2 identity (management `user.id`, shared with the
    main user table — see student_platform_login's docstring) to the
    legacy turon `Student` row that actually carries attendance/payment
    history.

    These live in genuinely separate databases (app/external_models/turon.py
    is bound to TURON_DB_URL, a different Postgres instance entirely — see
    get_turon_db, whose session the caller already holds via FastAPI's
    Depends and passes in as `turon_db`) with independent id spaces.
    `turon_user_link` (in the MAIN db, hence the separate `db` param) is the
    only thing connecting them: the same bridge missions.py already relies
    on to resolve a legacy turon executor. There is no such bridge from
    turon_user_profile_v2 (the *v2* identity docs #13/#14 assumed student_id
    resolves through) — it and turon_user_link are separate integrations
    that happen to overlap for most, not all, turon people.

    Returns None if this management user has no legacy turon counterpart at
    all, or the legacy DB has no Student row for them.
    """
    from app.external_models.turon import Student

    link = (
        db.query(models.TuronUserLink)
        .filter(models.TuronUserLink.management_user_id == management_user_id)
        .first()
    )
    if not link:
        return None

    return turon_db.query(Student).filter(Student.user_id == link.turon_user_id).first()
