import re

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from datetime import date, datetime
from pydantic import BaseModel, EmailStr, Field
from app.database import get_db
from sqlalchemy.orm import joinedload
from app.models import User, Section, Project, ProjectMember, SectionMember, SalaryMonth
from app.schemas import UserCreate, UserUpdate, UserOut, UserProfileOut, UserProjectOut, UserSectionOut
from app.core.security import get_password_hash
from app.dependencies import require_roles

router = APIRouter(prefix="/users", tags=["Users"])

ADMIN_ROLES = ("owner", "manager")

# `User` is the single identity table for the whole system — students,
# teachers, parents, and org staff all live in it. Roles that have their own
# dedicated listing page elsewhere (SchoolStudents.tsx, SchoolTeachers.tsx —
# via /turon/teachers, /turon/users/employees) are excluded from the
# Staff.tsx "Xodimlar" page's own query below.
_NON_STAFF_ROLES = ("student", "teacher", "parent", "assistant")


class AdminEmailChange(BaseModel):
    new_email: EmailStr


class AdminUsernameChange(BaseModel):
    new_username: str = Field(..., min_length=3, max_length=100)


@router.post("/", response_model=UserOut, status_code=201)
def create_user(data: UserCreate, db: Session = Depends(get_db)):
    payload = data.model_dump()
    if not payload.get("job_id"):
        payload["job_id"] = None
    if payload.get("password"):
        payload["hashed_password"] = get_password_hash(payload["password"])
    user = User(**payload)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/", response_model=List[UserOut])
def list_users(role: str = None, deleted: bool = False, db: Session = Depends(get_db)):
    q = db.query(User).filter(User.deleted == deleted)
    if role:
        q = q.filter(User.role == role)
    return q.all()


class UsersPageOut(BaseModel):
    results: List[UserOut]
    count: int


@router.get("/staff", response_model=UsersPageOut)
def list_staff_users(
    deleted: bool = False,
    role: Optional[str] = None,
    search: Optional[str] = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Paginated listing behind Staff.tsx's 'Xodimlar' / 'Volontyorlar' tabs —
    deliberately NOT `GET /users/` above, which every task/project picker
    across the app fetches unfiltered for its dropdown and must keep
    returning a bare list.

    role=None (the 'Xodimlar' tab) excludes _NON_STAFF_ROLES and volunteer:
    `User` is the identity table for the whole system, not just org staff —
    of 18,388 active rows, 17,700 are students. Without this filter the
    'staff' table was quietly rendering every enrolled student in the
    school. role='volunteer' (the 'Volontyorlar' tab) is passed explicitly,
    so it overrides that exclusion rather than being caught by it."""
    q = db.query(User).filter(User.deleted == deleted)
    if role:
        q = q.filter(User.role == role)
    else:
        q = q.filter(User.role.notin_(_NON_STAFF_ROLES + ("volunteer",)))
    if search:
        pattern = f"%{search}%"
        q = q.filter(or_(
            User.name.ilike(pattern),
            User.surname.ilike(pattern),
            User.email.ilike(pattern),
            User.username.ilike(pattern),
        ))
    count = q.count()
    results = q.order_by(User.id.desc()).offset(offset).limit(limit).all()
    return {"results": results, "count": count}


@router.get("/unassigned", response_model=List[UserOut])
def list_unassigned_users(db: Session = Depends(get_db)):
    in_project = db.query(ProjectMember.user_id)
    in_section = db.query(SectionMember.user_id)
    return (
        db.query(User)
        .filter(
            User.deleted == False,
            User.role != "owner",
            User.role != "manager",
            ~User.id.in_(in_project),
            ~User.id.in_(in_section),
        )
        .all()
    )


@router.get("/project-managers", response_model=List[UserOut])
def list_project_managers(db: Session = Depends(get_db)):
    return (
        db.query(User)
        .join(Project, Project.manager_id == User.id)
        .filter(Project.deleted == False, User.deleted == False)
        .distinct()
        .all()
    )


@router.get("/section-leaders", response_model=List[UserOut])
def list_section_leaders(db: Session = Depends(get_db)):
    return (
        db.query(User)
        .join(Section, Section.leader_id == User.id)
        .filter(Section.deleted == False, User.deleted == False)
        .distinct()
        .all()
    )


@router.get("/{user_id}", response_model=UserProfileOut)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id, User.deleted == False).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    projects = (
        db.query(Project)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .filter(ProjectMember.user_id == user_id, Project.deleted == False)
        .all()
    )
    managed_projects = db.query(Project).filter(
        Project.manager_id == user_id, Project.deleted == False
    ).all()
    all_project_ids = {p.id for p in projects}
    for p in managed_projects:
        if p.id not in all_project_ids:
            projects.append(p)

    sections = (
        db.query(Section)
        .join(SectionMember, SectionMember.section_id == Section.id)
        .filter(SectionMember.user_id == user_id, Section.deleted == False)
        .all()
    )
    led_sections = db.query(Section).filter(
        Section.leader_id == user_id, Section.deleted == False
    ).all()
    all_section_ids = {s.id for s in sections}
    for s in led_sections:
        if s.id not in all_section_ids:
            sections.append(s)

    # Auto-create missing SalaryMonth records for each month since user was created
    if user.salary:
        start = user.created_at.date().replace(day=1) if user.created_at else date.today().replace(day=1)
        today = date.today()
        current = start
        existing_months = {
            sm.date
            for sm in db.query(SalaryMonth.date)
            .filter(SalaryMonth.user_id == user_id, SalaryMonth.deleted == False)
            .all()
        }
        created_any = False
        while current <= today.replace(day=1):
            if current not in existing_months:
                db.add(SalaryMonth(
                    user_id=user_id,
                    salary=user.salary,
                    taken_salary=0,
                    remaining_salary=user.salary,
                    date=current,
                ))
                created_any = True
            # advance to next month
            if current.month == 12:
                current = current.replace(year=current.year + 1, month=1)
            else:
                current = current.replace(month=current.month + 1)
        if created_any:
            db.commit()

    profile = UserProfileOut.model_validate(user)
    profile.projects = [UserProjectOut.model_validate(p) for p in projects]
    profile.sections = [UserSectionOut.model_validate(s) for s in sections]
    return profile


# ── Admin: check/change email & username by user_id ────────────────────────────
# Unlike /auth/check-email, /auth/change-email etc. (self-service, acting on the
# authenticated user), these act on an arbitrary user_id and require an
# owner/manager role — no password confirmation from the target user needed.

@router.get("/{user_id}/check-email")
def admin_check_email_availability(
        user_id: int,
        email: EmailStr,
        db: Session = Depends(get_db),
        _: User = Depends(require_roles(*ADMIN_ROLES)),
):
    """Admin: check whether an email is free to assign to this user."""
    exists = db.query(User).filter(
        User.email == email,
        User.id != user_id,
        User.deleted == False,
    ).first() is not None
    return {"user_id": user_id, "email": email, "available": not exists}


@router.get("/{user_id}/check-username")
def admin_check_username_availability(
        user_id: int,
        username: str,
        db: Session = Depends(get_db),
        _: User = Depends(require_roles(*ADMIN_ROLES)),
):
    """Admin: check whether a username is free to assign to this user."""
    username = username.strip()
    if not re.match(r'^[a-zA-Z0-9_.]+$', username):
        raise HTTPException(
            status_code=400,
            detail="Username may only contain letters, numbers, underscores, and periods"
        )
    exists = db.query(User).filter(
        User.username == username,
        User.id != user_id,
        User.deleted == False,
    ).first() is not None
    return {"user_id": user_id, "username": username, "available": not exists}


@router.patch("/{user_id}/email")
def admin_change_email(
        user_id: int,
        data: AdminEmailChange,
        db: Session = Depends(get_db),
        _: User = Depends(require_roles(*ADMIN_ROLES)),
):
    """Admin: change a user's email. No password confirmation required."""
    user = db.query(User).filter(User.id == user_id, User.deleted == False).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = db.query(User).filter(
        User.email == data.new_email,
        User.id != user_id,
        User.deleted == False,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already in use")

    user.email = data.new_email
    user.is_verified = False
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return {"message": "Email changed successfully", "user_id": user.id, "email": user.email}


@router.patch("/{user_id}/username")
def admin_change_username(
        user_id: int,
        data: AdminUsernameChange,
        db: Session = Depends(get_db),
        _: User = Depends(require_roles(*ADMIN_ROLES)),
):
    """Admin: change a user's username."""
    user = db.query(User).filter(User.id == user_id, User.deleted == False).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    new_username = data.new_username.strip()
    if not re.match(r'^[a-zA-Z0-9_.]+$', new_username):
        raise HTTPException(
            status_code=400,
            detail="Username may only contain letters, numbers, underscores, and periods"
        )

    existing = db.query(User).filter(
        User.username == new_username,
        User.id != user_id,
        User.deleted == False,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    user.username = new_username
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return {"message": "Username changed successfully", "user_id": user.id, "username": user.username}


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: int, data: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id, User.deleted == False).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id, User.deleted == False).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.deleted = True
    db.commit()
