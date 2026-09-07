"""Parent -> child links, and staff-driven parent account creation.

management-v2 does NOT own a parent-child link table of its own anymore --
it reads and writes the same two tables gennis-v2's and turon-v2's own
parent admin tools already use (GennisParentChildLink -> parent_child_link,
TuronParentChildLink -> turon_parent_child_v2; see both classes'
docstrings in app/models.py). A same-day parent_child_link_v2 table
briefly existed here in parallel before this duplication was caught -- see
the migration that drops it for the full story.

Removed entirely: the gennis_parent_registration approval workflow
(list_registrations / approve_registration / reject_registration) that
used to live here. It was built on a wrong assumption -- that submissions
sit "pending" until management-v2 approves them. They don't:
gennis-v2's OWN registration endpoint (its own repo's
apps/backend/app/api/v1/parents/router.py) already creates the real
`User` row (and a parent_child_link row, if a child was picked) immediately
at submission time, with no approval step. Confirmed against production:
the one existing gennis_parent_registration row already has a matching
User account, even though this file's own review columns
(status/reviewed_by/reviewed_at/linked_user_id, added earlier the same
day) still say "pending" -- gennis-v2 never touches them. Approving it
here would have just hit "username already taken". Those columns are left
in place on the table, just unused -- a harmless no-op schema is cheaper
to leave than to also unwind in this same change.

create_parent_manually and the parent-child-link CRUD below remain: staff
directly creating a parent account, or attaching/removing a child from an
existing one, is still a real, useful action independent of the broken
registration-approval premise -- it just now targets the correct table
per source instead of a management-v2-only one.
"""
from types import SimpleNamespace
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.database import get_db
from app.dependencies import require_roles
from app.models import GennisParentChildLink, GennisStudent, TuronParentChildLink, User
from app.schemas import ParentChildLinkCreate, ParentChildLinkOut, ParentManualCreate, ParentManualCreateOut

router = APIRouter(prefix="/parent-registrations", tags=["Parent Portal"])
links_router = APIRouter(prefix="/parent-child-links", tags=["Parent Portal"])

# Same bar as creating/editing staff accounts (users.py's ADMIN_ROLES), not
# the no-auth-at-all bar some older link-management endpoints in this
# package were left at -- this creates login-capable accounts and decides
# whose child data they can see.
ADMIN_ROLES = ("owner", "manager")


def _resolve_child_ref(source: str, child_ref_id: int, db: Session) -> int:
    """Validate child_ref_id names a real person in `source`, and return
    the id the matching link table actually stores for them.

    GennisParentChildLink.student_id is gennis_student's INTERNAL id, not
    the external gennis_id student_platform hands out (and that callers of
    this router pass in as child_ref_id) -- so the gennis branch resolves
    one to the other here, once, rather than making every caller do it.
    TuronParentChildLink.student_user_id has no such translation -- turon
    has no separate id space -- so it passes through unchanged.
    """
    if source == "gennis":
        student = db.query(GennisStudent.id).filter(GennisStudent.gennis_id == child_ref_id).first()
        if not student:
            raise HTTPException(status_code=404, detail=f"No gennis_student with gennis_id={child_ref_id}")
        return student[0]
    elif source == "turon":
        exists = db.query(User.id).filter(User.id == child_ref_id, User.deleted == False).first()  # noqa: E712
        if not exists:
            raise HTTPException(status_code=404, detail=f"No user with id={child_ref_id}")
        return child_ref_id
    else:
        raise HTTPException(status_code=422, detail="source must be 'gennis' or 'turon'")


def _make_link(source: str, parent_user_id: int, resolved_ref: int):
    if source == "gennis":
        return GennisParentChildLink(parent_user_id=parent_user_id, student_id=resolved_ref)
    return TuronParentChildLink(parent_user_id=parent_user_id, student_user_id=resolved_ref)


def _link_out(source: str, link, child_ref_id: int) -> SimpleNamespace:
    """Both link tables store different column names for the same idea
    (student_id vs student_user_id) -- this is the one place that maps
    either back to the unified (source, child_ref_id) shape callers see.

    Returns a plain namespace, not a validated ParentChildLinkOut instance
    directly -- endpoints declare `response_model=ParentChildLinkOut` and
    FastAPI applies `from_attributes` validation at the HTTP layer once
    `link.id`/`created_at` are real (post-commit+refresh) values. Building
    the Pydantic model eagerly here would force validation before that,
    which breaks the moment a caller (e.g. a unit test with a mocked db)
    hasn't actually persisted `link` yet.
    """
    return SimpleNamespace(
        id=link.id,
        parent_user_id=link.parent_user_id,
        source=source,
        child_ref_id=child_ref_id,
        created_at=link.created_at,
    )


def _existing_link(source: str, parent_user_id: int, resolved_ref: int, db: Session):
    if source == "gennis":
        return (
            db.query(GennisParentChildLink)
            .filter(
                GennisParentChildLink.parent_user_id == parent_user_id,
                GennisParentChildLink.student_id == resolved_ref,
            )
            .first()
        )
    return (
        db.query(TuronParentChildLink)
        .filter(
            TuronParentChildLink.parent_user_id == parent_user_id,
            TuronParentChildLink.student_user_id == resolved_ref,
        )
        .first()
    )


@router.post("/manual", response_model=ParentManualCreateOut, status_code=201)
def create_parent_manually(
    data: ParentManualCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    """Create a parent account with no gennis_parent_registration row
    behind it at all.

    gennis-v2's public form is the only self-service parent registration
    surface that exists anywhere in this system -- turon has none
    (confirmed: no equivalent table, no registration flow in
    turon_platform or turon-v2's own API, though turon-v2 does have its
    own staff-facing registration form as of today). Rather than build a
    speculative "TuronParentRegistration" table with no submitter to ever
    write to it, this covers the same need staff-side: a parent calls or
    comes in, staff create the account and attach whichever children
    (gennis, turon, or both) directly, in one call.

    Password here is a fresh plaintext value from this request, not a hash
    carried over from another system -- hashed the normal way
    (get_password_hash).
    """
    if db.query(User.id).filter(User.username == data.username).first():
        raise HTTPException(
            status_code=409,
            detail=f"username '{data.username}' is already taken by an existing account",
        )

    seen = set()
    resolved_children: list[tuple[str, int, int]] = []  # (source, child_ref_id, resolved_ref)
    for child in data.children:
        key = (child.source, child.child_ref_id)
        if key in seen:
            raise HTTPException(status_code=422, detail=f"Duplicate child in request: {key}")
        seen.add(key)
        resolved_ref = _resolve_child_ref(child.source, child.child_ref_id, db)
        resolved_children.append((child.source, child.child_ref_id, resolved_ref))

    user = User(
        name=data.name,
        surname=data.surname,
        username=data.username,
        hashed_password=get_password_hash(data.password),
        role="parent",
        is_active=True,
    )
    db.add(user)
    db.flush()

    links = [_make_link(source, user.id, resolved_ref) for source, _cid, resolved_ref in resolved_children]
    for link in links:
        db.add(link)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=f"username '{data.username}' is already taken by an existing account",
        )
    for link in links:
        db.refresh(link)

    children_out = [
        _link_out(source, link, child_ref_id)
        for (source, child_ref_id, _ref), link in zip(resolved_children, links)
    ]
    return {"user_id": user.id, "username": user.username, "children": children_out}


# ── Parent-child links (add/remove a child after account creation) ────────────

@links_router.get("/", response_model=List[ParentChildLinkOut])
def list_parent_child_links(
    parent_user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*ADMIN_ROLES)),
):
    gennis_q = db.query(GennisParentChildLink)
    turon_q = db.query(TuronParentChildLink)
    if parent_user_id is not None:
        gennis_q = gennis_q.filter(GennisParentChildLink.parent_user_id == parent_user_id)
        turon_q = turon_q.filter(TuronParentChildLink.parent_user_id == parent_user_id)

    gennis_links = gennis_q.all()
    turon_links = turon_q.all()

    # GennisParentChildLink.student_id is internal -- resolve to the
    # external gennis_id in one batch rather than one query per row.
    gennis_id_by_internal = {}
    if gennis_links:
        internal_ids = [link.student_id for link in gennis_links]
        gennis_id_by_internal = dict(
            db.query(GennisStudent.id, GennisStudent.gennis_id).filter(GennisStudent.id.in_(internal_ids)).all()
        )

    out = [
        _link_out("gennis", link, gennis_id_by_internal.get(link.student_id, link.student_id))
        for link in gennis_links
    ]
    out += [_link_out("turon", link, link.student_user_id) for link in turon_links]
    return out


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
        # can_view_student authorizes purely off a link row existing (see
        # app/services/parent_portal.py) -- it never re-checks that the
        # linked account is actually a parent. Without this check here,
        # linking any other account (a teacher, another student) to a
        # child would silently grant it the same family-only read access
        # this endpoint's whole design intent is to withhold from staff.
        raise HTTPException(
            status_code=422,
            detail=f"User {parent.id} has role '{parent.role}', not 'parent' — cannot link children to it",
        )
    resolved_ref = _resolve_child_ref(data.source, data.child_ref_id, db)

    if _existing_link(data.source, data.parent_user_id, resolved_ref, db) is not None:
        raise HTTPException(status_code=409, detail="This child is already linked to this parent")

    link = _make_link(data.source, data.parent_user_id, resolved_ref)
    db.add(link)
    db.commit()
    db.refresh(link)
    return _link_out(data.source, link, data.child_ref_id)


@links_router.delete("/{source}/{link_id}", status_code=204)
def delete_parent_child_link(
    source: str,
    link_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*ADMIN_ROLES)),
):
    """`link_id` alone is no longer enough to find a row -- it's only
    unique WITHIN one of the two link tables, not across both (they're
    gennis-v2's and turon-v2's own tables, with their own independent id
    sequences) -- so `source` picks which table to look in.

    This is the answer to request #12's "child leaves the school"
    question: neither GennisStudent nor turon's Student row carries an
    active/left flag or a branch this table could filter on (checked both
    models directly), so there's no signal anywhere to auto-revoke a link
    on departure -- staff calling this endpoint IS the mechanism.

    A branch TRANSFER needs no handling at all, here or anywhere else:
    attendance/payment records are per-group (`group_id`/`group_name` on
    each individual record -- see student_family.py), not filtered by the
    child's current branch, so old records keep showing the old branch's
    groups and new ones show the new branch's, under the same continuous
    gennis_id/turon user.id identity. Nothing to unlink or migrate.
    """
    if source == "gennis":
        link = db.query(GennisParentChildLink).filter(GennisParentChildLink.id == link_id).first()
    elif source == "turon":
        link = db.query(TuronParentChildLink).filter(TuronParentChildLink.id == link_id).first()
    else:
        raise HTTPException(status_code=422, detail="source must be 'gennis' or 'turon'")

    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    db.delete(link)
    db.commit()
