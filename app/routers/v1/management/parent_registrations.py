"""Approval workflow for self-service parent registrations, and the
parent→child links that come out of it.

`gennis_parent_registration` used to be write-only: gennis-v2's public
registration form inserted a row and nothing in management-v2 ever read it
back — there was no way for a submission to become an actual account. This
router is that missing other half: staff review a pending submission,
attach the child(ren) it's for (the registration's own `student_id` is a
single, optional, best-effort guess — a parent can have more than one
child, so the real source of truth is `parent_child_link`, one row per
child), and approve it into a real `User(role="parent")`.

`ParentChildLink.child_ref_id` intentionally matches the id student_platform
already returns when that child logs in themself (gennis_student.gennis_id
for gennis, this same `user.id` for turon — see student_platform_login's
docstring) so nothing downstream needs a second translation step.
"""
import re
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_roles
from app.gennis_v2_models import GennisParentRegistration, ParentChildLink
from app.models import GennisStudent, User
from app.schemas import (
    ParentChildLinkCreate,
    ParentChildLinkOut,
    ParentRegistrationApprove,
    ParentRegistrationOut,
)

router = APIRouter(prefix="/parent-registrations", tags=["Parent Portal"])
links_router = APIRouter(prefix="/parent-child-links", tags=["Parent Portal"])

# Approving a registration creates a login-capable account and decides whose
# child data that account can see — same bar as creating/editing staff
# accounts (users.py's ADMIN_ROLES), not the no-auth-at-all bar some older
# link-management endpoints in this package were left at.
ADMIN_ROLES = ("owner", "manager")

# Every prefix student_platform_login's own password check (_verify_external
# in app/mobile/auth.py) actually knows how to verify: bcrypt, Django's and
# passlib's own pbkdf2_sha256, and the two Werkzeug formats. This table is
# filled by gennis-v2's public registration form — code we don't control —
# so before trusting `password_hash` enough to copy it verbatim into
# `user.hashed_password`, confirm it's actually one of these, not (say) a
# plaintext password the form failed to hash before sending it here.
_HASH_PREFIX_RE = re.compile(r"^(\$2[aby]?\$|\$pbkdf2-sha256\$|pbkdf2_sha256\$|pbkdf2:sha256:|sha256\$|md5\$)")


def _looks_like_a_password_hash(value: str) -> bool:
    return bool(value) and bool(_HASH_PREFIX_RE.match(value))


def _resolve_child(source: str, child_ref_id: int, db: Session) -> None:
    """Raise 404 if child_ref_id doesn't name a real person in `source`.

    Deliberately lenient about WHAT that person is (student vs. anything
    else) — same looseness as gennis_user_links.create_link's existing
    "does this id exist at all" check — the goal here is just to catch a
    typo'd id before it's saved, not to re-derive role logic that already
    lives in student_platform_login.
    """
    if source == "gennis":
        exists = db.query(GennisStudent.id).filter(GennisStudent.gennis_id == child_ref_id).first()
        if not exists:
            raise HTTPException(status_code=404, detail=f"No gennis_student with gennis_id={child_ref_id}")
    elif source == "turon":
        exists = db.query(User.id).filter(User.id == child_ref_id, User.deleted == False).first()  # noqa: E712
        if not exists:
            raise HTTPException(status_code=404, detail=f"No user with id={child_ref_id}")
    else:
        raise HTTPException(status_code=422, detail="source must be 'gennis' or 'turon'")


@router.get("/", response_model=List[ParentRegistrationOut])
def list_registrations(
    status: str = Query("pending", description="pending | approved | rejected"),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*ADMIN_ROLES)),
):
    return (
        db.query(GennisParentRegistration)
        .filter(GennisParentRegistration.status == status)
        .order_by(GennisParentRegistration.created_at)
        .all()
    )


@router.post("/{registration_id}/approve", response_model=ParentRegistrationOut)
def approve_registration(
    registration_id: int,
    data: ParentRegistrationApprove,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    reg = db.query(GennisParentRegistration).filter(GennisParentRegistration.id == registration_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")
    if reg.status != "pending":
        raise HTTPException(status_code=409, detail=f"Already {reg.status}")

    if db.query(User.id).filter(User.username == reg.username).first():
        raise HTTPException(
            status_code=409,
            detail=f"username '{reg.username}' is already taken by an existing account",
        )
    if not _looks_like_a_password_hash(reg.password_hash):
        raise HTTPException(
            status_code=422,
            detail=(
                "This registration's password_hash isn't a recognized hash format — "
                "refusing to store it as a login credential. Check gennis-v2's registration form."
            ),
        )

    seen = set()
    for child in data.children:
        key = (child.source, child.child_ref_id)
        if key in seen:
            raise HTTPException(status_code=422, detail=f"Duplicate child in request: {key}")
        seen.add(key)
        _resolve_child(child.source, child.child_ref_id, db)

    # `reg.password_hash` is carried over as-is, whatever scheme gennis-v2
    # hashed it with — student_platform_login verifies with _verify_external
    # (bcrypt + django_pbkdf2_sha256 + pbkdf2_sha256), the same
    # multi-scheme check every other cross-system account here relies on,
    # so re-hashing isn't needed and would just require the parent to reset
    # their password immediately after staff approve them.
    user = User(
        name=reg.name,
        surname=reg.surname,
        username=reg.username,
        hashed_password=reg.password_hash,
        role="parent",
        is_active=True,
    )
    db.add(user)
    db.flush()  # need user.id before creating links / stamping the registration

    for child in data.children:
        db.add(ParentChildLink(parent_user_id=user.id, source=child.source, child_ref_id=child.child_ref_id))

    reg.status = "approved"
    reg.reviewed_by = current_user.id
    reg.reviewed_at = datetime.utcnow()
    reg.linked_user_id = user.id
    try:
        db.commit()
    except IntegrityError:
        # The pre-check above closes the common case; this only catches the
        # genuine two-admins-same-instant race on User.username's DB-level
        # unique constraint, turning it into a clean 409 instead of a 500.
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=f"username '{reg.username}' is already taken by an existing account",
        )
    db.refresh(reg)
    return reg


@router.post("/{registration_id}/reject", response_model=ParentRegistrationOut)
def reject_registration(
    registration_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    reg = db.query(GennisParentRegistration).filter(GennisParentRegistration.id == registration_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")
    if reg.status != "pending":
        raise HTTPException(status_code=409, detail=f"Already {reg.status}")

    reg.status = "rejected"
    reg.reviewed_by = current_user.id
    reg.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(reg)
    return reg


# ── Parent-child links (add/remove a child after approval) ────────────────────

@links_router.get("/", response_model=List[ParentChildLinkOut])
def list_parent_child_links(
    parent_user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*ADMIN_ROLES)),
):
    q = db.query(ParentChildLink)
    if parent_user_id is not None:
        q = q.filter(ParentChildLink.parent_user_id == parent_user_id)
    return q.order_by(ParentChildLink.id).all()


@links_router.post("/", response_model=ParentChildLinkOut, status_code=201)
def create_parent_child_link(
    data: ParentChildLinkCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*ADMIN_ROLES)),
):
    parent = db.query(User).filter(User.id == data.parent_user_id, User.deleted == False).first()  # noqa: E712
    if not parent:
        raise HTTPException(status_code=404, detail="Parent user not found")
    if parent.role != "parent":
        # can_view_student authorizes purely off a ParentChildLink row
        # existing (see app/services/parent_portal.py) — it never re-checks
        # that the linked account is actually a parent. Without this check
        # here, linking any other account (a teacher, another student) to a
        # child would silently grant it the same family-only read access
        # this endpoint's whole design intent is to withhold from staff.
        raise HTTPException(
            status_code=422,
            detail=f"User {parent.id} has role '{parent.role}', not 'parent' — cannot link children to it",
        )
    _resolve_child(data.source, data.child_ref_id, db)

    existing = (
        db.query(ParentChildLink)
        .filter(
            ParentChildLink.parent_user_id == data.parent_user_id,
            ParentChildLink.source == data.source,
            ParentChildLink.child_ref_id == data.child_ref_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="This child is already linked to this parent")

    link = ParentChildLink(**data.model_dump())
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


@links_router.delete("/{link_id}", status_code=204)
def delete_parent_child_link(
    link_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*ADMIN_ROLES)),
):
    link = db.query(ParentChildLink).filter(ParentChildLink.id == link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    db.delete(link)
    db.commit()
