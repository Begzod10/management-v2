"""Login shim for student_platform, in the shape old gennis used to return.

This is management-v2's own copy of gennis-v2's
app/api/v1/integrations/student_platform.py — same contract, same response
shape, same resolution rules — kept in sync deliberately rather than shared,
because the two projects don't share a common library. The difference is
where it reads from: gennis-v2 goes through its read-only `Mgmt*` mirror
models; this one reads the shared `user`/`gennis_*`/`turon_*_v2` tables
directly, since management-v2 is the project that actually owns this DB.
student_platform can point its GENNIS_API_URL setting at either
implementation — they answer identically for the same account.

The SAME `user` row (and its password) can be a gennis person, a turon
person, or both — the single management account is what's authenticated,
and only AFTER that does resolution branch on which one it is. `source` in
the response tells student_platform which, because gennis and turon ids are
independent, overlapping numeric spaces — conflating them under one id
field would merge unrelated people.

gennis and turon are resolved completely differently, because they ARE
completely different underlying systems:

  * gennis: management_user_id -> gennis_user_id via gennis_user_link (a
    bridge table backfilled from old gennis's separate user id space).

  * turon: no bridge table, no separate id. turon-v2 writes directly into
    this DB and shares its `user` table for identity — a turon
    student/teacher's id IS user.id already. turon_user_profile_v2 existing
    for this user.id is what marks the account as a turon person at all
    (parallel to gennis_user_link's role, but a plain existence check
    instead of a mapping).

For a gennis student, `id` in the response is the STUDENT id
(gennis_student.gennis_id), NOT the user id — student_platform keys its
local accounts on this value, and sending the wrong one creates a duplicate
account instead of finding the existing one. See gennis-v2's copy of this
file for the incident that taught us this.

`teacher` and `student` each carry ONE location for the whole account —
not one per group/flow entry, since a person has a single home
branch/location regardless of how many groups they're in. gennis and turon
name this differently because their own schemas do:
  * gennis: `location_id` + `location_name`, off `gennis_user_link` (the
    account's branch, set at link time) — not any particular group's.
  * turon: `branch_id` off `turon_user_profile_v2` (the account's own
    branch), `branch_name` looked up from `turon_branch_v2`.
"""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app import models
from app.core.security import create_access_token
from app.database import get_db
from app.dependencies import get_current_user
from app.mobile.auth import _verify_external

router = APIRouter(prefix="/integrations/student-platform", tags=["Integrations"])


class StudentPlatformLoginRequest(BaseModel):
    # old gennis took "username"; keep that name so the caller is unchanged
    username: str
    password: str


def _groups_for_teacher(db: Session, teacher_gennis_id: int) -> list[dict]:
    group_ids_sq = db.query(models.gennis_teacher_group_link_table.c.group_gennis_id).filter(
        models.gennis_teacher_group_link_table.c.teacher_gennis_id == teacher_gennis_id
    )
    rows = (
        db.query(models.GennisGroup.gennis_id, models.GennisGroup.name, models.GennisGroup.price)
        .filter(
            models.GennisGroup.gennis_id.in_(group_ids_sq),
            models.GennisGroup.deleted == False,  # noqa: E712
            models.GennisGroup.status == True,  # noqa: E712
        )
        .order_by(models.GennisGroup.name)
        .all()
    )
    return [{"id": r.gennis_id, "name": r.name, "price": r.price or 0} for r in rows]


def _groups_for_student(db: Session, student_row_id: int) -> list[dict]:
    rows = (
        db.query(models.GennisGroup.gennis_id, models.GennisGroup.name, models.GennisGroup.price)
        .join(
            models.gennis_student_group_table,
            models.gennis_student_group_table.c.group_id == models.GennisGroup.id,
        )
        .filter(
            models.gennis_student_group_table.c.student_id == student_row_id,
            models.GennisGroup.deleted == False,  # noqa: E712
        )
        .order_by(models.GennisGroup.name)
        .all()
    )
    return [{"id": r.gennis_id, "name": r.name, "price": r.price or 0} for r in rows]


def _combined_debt(db: Session, student_row_id: int) -> int:
    """Old gennis' "umumiy hisob": Sigma group prices - Sigma standing charity,
    over the groups the student is currently in."""
    price = (
        db.query(func.coalesce(func.sum(models.GennisGroup.price), 0))
        .join(
            models.gennis_student_group_table,
            models.gennis_student_group_table.c.group_id == models.GennisGroup.id,
        )
        .filter(
            models.gennis_student_group_table.c.student_id == student_row_id,
            models.GennisGroup.deleted == False,  # noqa: E712
        )
        .scalar()
        or 0
    )

    group_ids_sq = db.query(models.gennis_student_group_table.c.group_id).filter(
        models.gennis_student_group_table.c.student_id == student_row_id
    )
    charity = (
        db.query(func.coalesce(func.sum(models.GennisStudentCharity.discount), 0))
        .filter(
            models.GennisStudentCharity.student_id == student_row_id,
            models.GennisStudentCharity.deleted == False,  # noqa: E712
            models.GennisStudentCharity.group_id.in_(group_ids_sq),
        )
        .scalar()
        or 0
    )

    return max(0, int(price) - int(charity))


def _groups_for_student_turon(db: Session, user_id: int) -> list[dict]:
    rows = (
        db.query(models.TuronGroupV2.id, models.TuronGroupV2.name, models.TuronGroupV2.price)
        .join(
            models.turon_group_student_v2_table,
            models.turon_group_student_v2_table.c.group_id == models.TuronGroupV2.id,
        )
        .filter(
            models.turon_group_student_v2_table.c.student_user_id == user_id,
            models.TuronGroupV2.deleted == False,  # noqa: E712
        )
        .order_by(models.TuronGroupV2.name)
        .all()
    )
    return [{"id": r.id, "name": r.name, "price": r.price or 0} for r in rows]


# student_platform is the Gennis IT platform — only a teacher of one of
# these two subjects has any reason to log into it. Unlike a homeroom
# teacher, they aren't tied to one class: they teach this subject to every
# active class at their branch. Matched case-insensitively against
# TuronTeacherProfileV2.subjects' {"name": ...} entries.
_STUDENT_PLATFORM_SUBJECTS = {"web dasturchilik", "digital literacy"}


def _teaches_student_platform_subject(db: Session, user_id: int) -> bool:
    profile = (
        db.query(models.TuronTeacherProfileV2.subjects)
        .filter(
            models.TuronTeacherProfileV2.user_id == user_id,
            models.TuronTeacherProfileV2.deleted == False,  # noqa: E712
        )
        .first()
    )
    if not profile or not profile.subjects:
        return False
    return any(
        (s.get("name") or "").strip().casefold() in _STUDENT_PLATFORM_SUBJECTS
        for s in profile.subjects
    )


def _groups_for_teacher_turon(db: Session, user_id: int) -> list[dict]:
    """A turon teacher's groups, for student_platform's "Мои студенты".

    A Web Dasturchilik / Digital literacy teacher gets every active,
    non-deleted group at their own branch — they teach that subject to the
    whole branch, not one assigned class, and resolving them the same way as
    a homeroom teacher (below) tied their visibility to
    TuronClassTimeTable rows, which are per-lesson and get deleted/rescheduled
    constantly; losing the one row that named them as a class's teacher
    silently dropped that class (and its students) from their sync (seen live
    2026-09-03, rimefara_teach_turon / group "1-blue").

    Every other subject keeps the narrower per-assignment resolution:
    `TuronGroupV2.teacher_id` (the homeroom/primary assignment) UNION any
    group they've actually been scheduled to teach per the timetable in the
    last 60 days (+ any future lessons) — a subject teacher who isn't a
    branch-wide student_platform teacher is still never set as a class's
    primary teacher, so without the timetable half they'd sync zero groups.
    Branch-wide access isn't extended to them: it would hand them every
    other teacher's roster, which only makes sense for the two subjects
    above.
    """
    if _teaches_student_platform_subject(db, user_id):
        branch_id = (
            db.query(models.TuronUserProfileV2.branch_id)
            .filter(models.TuronUserProfileV2.user_id == user_id)
            .scalar()
        )
        if branch_id is None:
            return []
        rows = (
            db.query(models.TuronGroupV2.id, models.TuronGroupV2.name, models.TuronGroupV2.price)
            .filter(
                models.TuronGroupV2.branch_id == branch_id,
                models.TuronGroupV2.deleted == False,  # noqa: E712
                models.TuronGroupV2.status == True,  # noqa: E712
            )
            .order_by(models.TuronGroupV2.name)
            .all()
        )
        return [{"id": r.id, "name": r.name, "price": r.price or 0} for r in rows]

    cutoff = date.today() - timedelta(days=60)
    timetable_group_ids = db.query(models.TuronClassTimeTable.group_id).filter(
        models.TuronClassTimeTable.teacher_id == user_id,
        models.TuronClassTimeTable.group_id.isnot(None),
        models.TuronClassTimeTable.deleted == False,  # noqa: E712
        models.TuronClassTimeTable.date >= cutoff,
    ).distinct()

    rows = (
        db.query(models.TuronGroupV2.id, models.TuronGroupV2.name, models.TuronGroupV2.price)
        .filter(
            or_(
                models.TuronGroupV2.teacher_id == user_id,
                models.TuronGroupV2.id.in_(timetable_group_ids),
            ),
            models.TuronGroupV2.deleted == False,  # noqa: E712
            models.TuronGroupV2.status == True,  # noqa: E712
        )
        .order_by(models.TuronGroupV2.name)
        .all()
    )
    return [{"id": r.id, "name": r.name, "price": r.price or 0} for r in rows]


def _flows_for_teacher_turon(db: Session, user_id: int) -> list[dict]:
    """Mirrors _groups_for_teacher_turon for Flow, turon's second independent
    student container. No `status` column on TuronFlowV2 (unlike Group), so
    only `deleted` is filtered — matches _flows_for_student_turon below."""
    cutoff = date.today() - timedelta(days=60)
    timetable_flow_ids = db.query(models.TuronClassTimeTable.flow_id).filter(
        models.TuronClassTimeTable.teacher_id == user_id,
        models.TuronClassTimeTable.flow_id.isnot(None),
        models.TuronClassTimeTable.deleted == False,  # noqa: E712
        models.TuronClassTimeTable.date >= cutoff,
    ).distinct()

    rows = (
        db.query(models.TuronFlowV2.id, models.TuronFlowV2.name)
        .filter(
            or_(
                models.TuronFlowV2.teacher_id == user_id,
                models.TuronFlowV2.id.in_(timetable_flow_ids),
            ),
            models.TuronFlowV2.deleted == False,  # noqa: E712
        )
        .order_by(models.TuronFlowV2.name)
        .all()
    )
    return [{"id": r.id, "name": r.name} for r in rows]


def _flows_for_student_turon(db: Session, user_id: int) -> list[dict]:
    """A student's Flow memberships — a second, independent container from
    Group. No price: unlike a group this isn't a billing unit, so
    student_platform should treat it purely as membership."""
    rows = (
        db.query(models.TuronFlowV2.id, models.TuronFlowV2.name)
        .join(
            models.turon_flow_student_v2_table,
            models.turon_flow_student_v2_table.c.flow_id == models.TuronFlowV2.id,
        )
        .filter(
            models.turon_flow_student_v2_table.c.student_user_id == user_id,
            models.TuronFlowV2.deleted == False,  # noqa: E712
        )
        .order_by(models.TuronFlowV2.name)
        .all()
    )
    return [{"id": r.id, "name": r.name} for r in rows]


@router.post("/login")
def student_platform_login(body: StudentPlatformLoginRequest, db: Session = Depends(get_db)):
    """Authenticate and answer in old gennis's /base/login shape."""
    user = (
        db.query(models.User)
        .filter(
            or_(models.User.username == body.username, models.User.email == body.username),
            models.User.deleted == False,  # noqa: E712
        )
        .first()
    )
    if not user or not _verify_external(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect login or password",
        )
    if not user.is_active or user.is_locked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not available",
        )

    gennis_link = (
        db.query(models.GennisUserLink)
        .filter(models.GennisUserLink.management_user_id == user.id)
        .first()
    )

    roles = {user.role} | {r.role for r in user.extra_roles}
    role = "teacher" if "teacher" in roles else ("student" if "student" in roles else user.role)

    # student_platform keys everything on the (source, id) pair, so an
    # unlinked account cannot be synced — say so plainly rather than
    # returning a body it would half-process into an account with no groups.
    # A non-positive gennis_user_id is a sentinel, not an id: it marks an
    # account created in v2 with no gennis counterpart. Treat that as
    # unlinked rather than resolving it to nothing and handing back a
    # person with no groups.
    source = "gennis"
    turon_profile = None
    if gennis_link is None or not gennis_link.gennis_user_id or gennis_link.gennis_user_id <= 0:
        source = "turon"
        turon_profile = (
            db.query(models.TuronUserProfileV2)
            .filter(models.TuronUserProfileV2.user_id == user.id)
            .first()
        )
        if turon_profile is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This account is not linked to a gennis or turon teacher/student record",
            )

    # `id` is what student_platform keys its local account on. For turon
    # this is simply user.id. For gennis it's NOT that simple — teachers use
    # the USER id (gennis_teacher.user_gennis_id), students use the STUDENT
    # id (gennis_student.gennis_id). Sending the user id for a gennis
    # student makes student_platform miss the existing account and silently
    # create a second, empty one.
    payload: dict = {
        "id": user.id if source == "turon" else gennis_link.gennis_user_id,
        "name": user.name or "",
        "surname": user.surname or "",
        "role": role,
        "email": user.email,
        # old gennis returned a list of phone objects
        "phone": (
            [{"phone": turon_profile.phone}]
            if (source == "turon" and turon_profile and turon_profile.phone)
            else []
        ),
    }

    if source == "gennis":
        # One location per account, not one per group — gennis_user_link
        # already carries it (a person's branch, backfilled at link time),
        # so there's no need to derive it from whichever group happens to
        # be first in the list, and no risk of it disagreeing across groups.
        location_id = gennis_link.location_id
        location_name = gennis_link.location_name
        if role == "teacher":
            teacher = (
                db.query(models.GennisTeacherSync.gennis_id)
                .filter(models.GennisTeacherSync.user_gennis_id == gennis_link.gennis_user_id)
                .first()
            )
            payload["teacher"] = {
                "group": _groups_for_teacher(db, teacher.gennis_id) if teacher else [],
                "location_id": location_id,
                "location_name": location_name,
            }
        elif role == "student":
            student = (
                db.query(
                    models.GennisStudent.id,
                    models.GennisStudent.gennis_id,
                    models.GennisStudent.phone,
                )
                .filter(models.GennisStudent.user_id == gennis_link.gennis_user_id)
                .first()
            )
            if student and student.gennis_id:
                payload["id"] = student.gennis_id
            if student and student.phone:
                payload["phone"] = [{"phone": student.phone}]
            payload["student"] = {
                "group": _groups_for_student(db, student.id) if student else [],
                "combined_debt": _combined_debt(db, student.id) if student else 0,
                "location_id": location_id,
                "location_name": location_name,
            }
    else:  # turon
        # Same one-per-account shape as gennis above, sourced from
        # turon_user_profile_v2.branch_id (the account's own branch) rather
        # than any particular group/flow's branch.
        branch_id = turon_profile.branch_id if turon_profile else None
        branch_name = (
            db.query(models.TuronBranchV2.name).filter(models.TuronBranchV2.id == branch_id).scalar()
            if branch_id is not None
            else None
        )
        if role == "teacher":
            payload["teacher"] = {
                "group": _groups_for_teacher_turon(db, user.id),
                "flow": _flows_for_teacher_turon(db, user.id),
                "branch_id": branch_id,
                "branch_name": branch_name,
            }
        elif role == "student":
            payload["student"] = {
                "group": _groups_for_student_turon(db, user.id),
                "flow": _flows_for_student_turon(db, user.id),
                # turon-v2 doesn't expose a ready debt figure yet — default
                # to 0 rather than guess at an undocumented JSONB shape,
                # matching gennis-v2's copy of this endpoint.
                "combined_debt": 0,
                "branch_id": branch_id,
                "branch_name": branch_name,
            }

    return {
        "access_token": create_access_token({
            "sub": user.username or user.email,
            "user_id": user.id,
            "system": "management",
            "role": role,
            "roles": list(roles),
        }),
        "type_user": role,
        # which downstream system this account's data came from —
        # student_platform uses this to keep gennis and turon accounts in
        # separate id namespaces.
        "source": source,
        "user": payload,
    }


@router.get("/group/{group_gennis_id}/students")
def student_platform_group_students(
    group_gennis_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
    source: str = "gennis",
):
    """The students of one group, shaped like old gennis's GET /group/students/{id}.

    Keyed on the group's id IN ITS OWN SYSTEM, because that is what the login
    response above hands back and what student_platform stores as
    Group.gennis_id / Group.turon_id. `source` disambiguates which system
    that id belongs to — gennis and turon group ids live in independent,
    overlapping numeric spaces, so without it this could return a
    *different* group's roster than the one asked for.

    Authenticated: this returns names and phone numbers, and student_platform
    already sends the bearer token /login above issued.
    """
    if source == "turon":
        group = (
            db.query(models.TuronGroupV2.id)
            .filter(
                models.TuronGroupV2.id == group_gennis_id,
                models.TuronGroupV2.deleted == False,  # noqa: E712
            )
            .first()
        )
        if not group:
            return {"students": []}

        rows = (
            db.query(
                models.User.id,
                models.User.name,
                models.User.surname,
                models.TuronUserProfileV2.phone,
            )
            .join(
                models.turon_group_student_v2_table,
                models.turon_group_student_v2_table.c.student_user_id == models.User.id,
            )
            .outerjoin(
                models.TuronUserProfileV2,
                models.TuronUserProfileV2.user_id == models.User.id,
            )
            .filter(models.turon_group_student_v2_table.c.group_id == group.id)
            .order_by(models.User.surname, models.User.name)
            .all()
        )
        return {
            "students": [
                {
                    "id": r.id,
                    "name": r.name or "",
                    "surname": r.surname or "",
                    "phone": r.phone or "",
                    "balance": 0,
                }
                for r in rows
            ]
        }

    group = (
        db.query(models.GennisGroup.id)
        .filter(
            models.GennisGroup.gennis_id == group_gennis_id,
            models.GennisGroup.deleted == False,  # noqa: E712
        )
        .first()
    )
    if not group:
        return {"students": []}

    rows = (
        db.query(
            models.GennisStudent.gennis_id,
            models.GennisStudent.name,
            models.GennisStudent.surname,
            models.GennisStudent.phone,
        )
        .join(
            models.gennis_student_group_table,
            models.gennis_student_group_table.c.student_id == models.GennisStudent.id,
        )
        .filter(models.gennis_student_group_table.c.group_id == group.id)
        .order_by(models.GennisStudent.surname, models.GennisStudent.name)
        .all()
    )
    return {
        "students": [
            {
                "id": r.gennis_id,
                "name": r.name or "",
                "surname": r.surname or "",
                "phone": r.phone or "",
                "balance": 0,
            }
            for r in rows
        ]
    }


@router.get("/flow/{flow_id}/students")
def student_platform_flow_students(
    flow_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    """The students of one turon Flow — no gennis equivalent, so no `source`
    param here (gennis has no Flow concept at all).

    Same shape as /group/{id}/students: student_platform's login response
    hands back `flow[].id`, which is exactly `turon_flow_v2.id`, so this is
    keyed the same way a group roster fetch is.
    """
    flow = (
        db.query(models.TuronFlowV2.id)
        .filter(
            models.TuronFlowV2.id == flow_id,
            models.TuronFlowV2.deleted == False,  # noqa: E712
        )
        .first()
    )
    if not flow:
        return {"students": []}

    rows = (
        db.query(
            models.User.id,
            models.User.name,
            models.User.surname,
            models.TuronUserProfileV2.phone,
        )
        .join(
            models.turon_flow_student_v2_table,
            models.turon_flow_student_v2_table.c.student_user_id == models.User.id,
        )
        .outerjoin(
            models.TuronUserProfileV2,
            models.TuronUserProfileV2.user_id == models.User.id,
        )
        .filter(models.turon_flow_student_v2_table.c.flow_id == flow.id)
        .order_by(models.User.surname, models.User.name)
        .all()
    )
    return {
        "students": [
            {
                "id": r.id,
                "name": r.name or "",
                "surname": r.surname or "",
                "phone": r.phone or "",
                "balance": 0,
            }
            for r in rows
        ]
    }
