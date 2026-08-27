"""
Detailed per-record views for the Gennis education center.
Mirrors account/overal_datas/home_screen.py from the Gennis project.

/branches, /debtors, /salaries, /overhead read locally (get_db) from
gennis-v2's own tables — same reasoning as the Turon dashboard/detail
fixes: old gennis has had no real activity since 2026-08-19, gennis-v2 is
the live system now, and these specific tables already live in this same
DB, confirmed synced_at TODAY at investigation time (see conversation).

/directors, /teachers, /staff, /employees/{location_id} stay on the
external DB (get_gennis_db) — checked and found a genuine gap, not just
freshness noise: gennis_teacher/gennis_staff (the flattened name/role/
location directory these need) last synced 2026-08-11, 8 days before old
gennis itself went quiet, and gennis-v2 has no native write path into
them (its own registration flow only touches gennis_teacher_registration,
which has 6 rows total — nowhere near a full directory). Switching these
would mean showing an already-stale picture that can only get staler,
since nothing updates either the old or the local copy anymore.
"""
from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.database import get_gennis_db, get_db
from app.external_models import gennis as G
from app.models import (
    GennisLocation,
    GennisSubject,
    GennisAttendanceHistoryStudentLive,
    GennisDeletedStudentGroupLive,
    GennisStudentPaymentLive,
    GennisTeacherSalaryLive,
    GennisAssistentSalaryLive,
    GennisStaffSalaryLive,
    GennisOverheadLive,
)
from typing import List, Optional, Union
from app.schemas_stats import (
    BranchItem,
    GennisDebtorsOut,
    GennisTeacherSalariesOut, GennisAssistentSalariesOut, GennisStaffSalariesOut,
    GennisOverheadDetailOut,
)

router = APIRouter(prefix="/gennis", tags=["Gennis Detail"])


# ── Branches ──────────────────────────────────────────────────────────────────

@router.get("/branches", response_model=List[BranchItem])
def gennis_branches(db: Session = Depends(get_db)):
    """List all Gennis locations (branches). Returns gennis_id, not the
    local autoincrement id — every other gennis_* table's location_id
    column stores gennis_id directly (verified: 1-5, matching old gennis's
    own Locations numbering)."""
    rows = db.query(GennisLocation).order_by(GennisLocation.gennis_id).all()
    return [{"id": r.gennis_id, "name": r.name} for r in rows]


# ── People lists ─────────────────────────────────────────────────────────────
# Stays external — see module docstring.

@router.get("/directors")
def gennis_directors(
    location_id: Optional[int] = Query(None),
    db: Session = Depends(get_gennis_db),
):
    """List active Gennis managers (Staff with profession 'manager'),
    optionally filtered by location."""
    q = (
        db.query(G.Staff, G.Users, G.GennisProfessions, G.GennisRoles, G.EducationLanguage, G.Locations)
        .join(G.Users, G.Staff.user_id == G.Users.id)
        .join(G.GennisProfessions, G.Staff.profession_id == G.GennisProfessions.id)
        .join(G.Locations, G.Users.location_id == G.Locations.id)
        .outerjoin(G.GennisRoles, G.Users.role_id == G.GennisRoles.id)
        .outerjoin(G.EducationLanguage, G.Users.education_language == G.EducationLanguage.id)
        .filter(
            G.GennisProfessions.name.ilike("manager"),
            or_(G.Staff.deleted == False, G.Staff.deleted == None),
            or_(G.Users.deleted == False, G.Users.deleted == None),
        )
    )
    if location_id:
        q = q.filter(G.Users.location_id == location_id)
    rows = q.order_by(G.Users.name).all()
    return [
        {
            "id": user.id,
            "name": user.name.title() if user.name else None,
            "surname": user.surname.title() if user.surname else None,
            "username": user.username,
            "age": user.age,
            "job": profession.name,
            "language": lang.name if lang else None,
            "role": role.role if role else None,
            "type_role": role.type_role if role else None,
            "location_id": user.location_id,
            "location_name": location.name,
        }
        for staff, user, profession, role, lang, location in rows
    ]

@router.get("/teachers")
def gennis_teachers(
    location_id: Optional[int] = Query(None),
    db: Session = Depends(get_gennis_db),
):
    """List all active teachers in Gennis, optionally filtered by location."""
    q = (
        db.query(G.Teachers, G.Users)
        .join(G.Users, G.Teachers.user_id == G.Users.id)
        .outerjoin(G.DeletedTeachers, G.Teachers.id == G.DeletedTeachers.teacher_id)
        .filter(G.DeletedTeachers.id == None)
    )
    if location_id:
        q = q.filter(G.Users.location_id == location_id)
    rows = q.order_by(G.Users.name).all()
    return [
        {
            "id": teacher.id,
            "user_id": user.id,
            "name": user.name,
            "surname": user.surname,
            "location_id": user.location_id,
        }
        for teacher, user in rows
    ]


@router.get("/staff")
def gennis_staff(
    location_id: Optional[int] = Query(None),
    db: Session = Depends(get_gennis_db),
):
    """List all active staff/workers in Gennis, optionally filtered by location."""
    q = (
        db.query(G.Staff, G.Users, G.GennisProfessions, G.GennisRoles, G.EducationLanguage)
        .join(G.Users, G.Staff.user_id == G.Users.id)
        .join(G.GennisProfessions, G.Staff.profession_id == G.GennisProfessions.id)
        .outerjoin(G.GennisRoles, G.Users.role_id == G.GennisRoles.id)
        .outerjoin(G.EducationLanguage, G.Users.education_language == G.EducationLanguage.id)
        .filter(or_(G.Staff.deleted == False, G.Staff.deleted == None))
    )
    if location_id:
        q = q.filter(G.Users.location_id == location_id)
    rows = q.order_by(G.Users.name).all()
    return [
        {
            "id": user.id,
            "name": user.name.title() if user.name else None,
            "surname": user.surname.title() if user.surname else None,
            "username": user.username,
            "age": user.age,
            "job": profession.name,
            "language": lang.name if lang else None,
            "role": role.role if role else None,
            "type_role": role.type_role if role else None,
            "location_id": user.location_id,
        }
        for staff, user, profession, role, lang in rows
    ]


# ── Employees ─────────────────────────────────────────────────────────────────

@router.get("/employees/{location_id}")
def gennis_employees(
    location_id: int,
    status: Optional[str] = Query(None, description="Pass 'deleted' to list deleted staff"),
    search: Optional[str] = Query(None),
    job: Optional[str] = Query(None, description="Filter by profession name"),
    language: Optional[str] = Query(None),
    offset: int = Query(0, ge=0),
    limit: Optional[int] = Query(50, ge=1),
    db: Session = Depends(get_gennis_db),
):
    """List staff/employees for a Gennis location. Mirrors /api/account/employees/<location_id>."""
    deleted_filter = G.Staff.deleted == True if status == "deleted" else or_(G.Staff.deleted == False, G.Staff.deleted == None)

    q = (
        db.query(G.Staff, G.Users, G.GennisProfessions, G.GennisRoles, G.EducationLanguage)
        .join(G.Users, G.Staff.user_id == G.Users.id)
        .join(G.GennisProfessions, G.Staff.profession_id == G.GennisProfessions.id)
        .outerjoin(G.GennisRoles, G.Users.role_id == G.GennisRoles.id)
        .outerjoin(G.EducationLanguage, G.Users.education_language == G.EducationLanguage.id)
        .filter(
            G.Users.location_id == location_id,
            deleted_filter,
        )
        .order_by(G.Users.id)
    )

    if job:
        q = q.filter(G.GennisProfessions.name == job)
    if language:
        q = q.filter(G.EducationLanguage.name.ilike(language))
    if search:
        pattern = f"%{search}%"
        q = q.filter(or_(
            G.Users.name.ilike(pattern),
            G.Users.surname.ilike(pattern),
            G.Users.username.ilike(pattern),
        ))

    total = q.count()
    rows = q.offset(offset).limit(limit).all()

    data = [
        {
            "id": user.id,
            "name": user.name.title() if user.name else None,
            "surname": user.surname.title() if user.surname else None,
            "username": user.username,
            "age": user.age,
            "job": profession.name,
            "language": lang.name if lang else None,
            "role": role.role if role else None,
            "type_role": role.type_role if role else None,
        }
        for staff, user, profession, role, lang in rows
    ]

    return {
        "data": data,
        "pagination": {
            "total": total,
            "offset": offset,
            "limit": limit,
            "has_more": (offset + limit) < total,
        },
    }


# ── Debtors ───────────────────────────────────────────────────────────────────

@router.get("/debtors", response_model=GennisDebtorsOut)
def gennis_debtors(
    location_id: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000),
    db: Session = Depends(get_db),
):
    """Same shape as before, reading gennis-v2's own attendance-history
    table — which carries student_name/group_name denormalized directly,
    so no join to a student/group/user table is needed."""
    month_date_obj = datetime.strptime(f"{year}-{month:02d}", "%Y-%m")

    attendance_records = (
        db.query(GennisAttendanceHistoryStudentLive)
        .filter(
            GennisAttendanceHistoryStudentLive.calendar_month == month,
            GennisAttendanceHistoryStudentLive.calendar_year == year,
            GennisAttendanceHistoryStudentLive.location_id == location_id,
        )
        .order_by(GennisAttendanceHistoryStudentLive.student_id)
        .all()
    )

    student_ids = [r.student_id for r in attendance_records]
    subject_ids = {r.subject_id for r in attendance_records if r.subject_id is not None}

    # subject_id on the attendance row is inconsistent — confirmed some
    # rows match GennisSubject.gennis_id, others match its local id
    # directly (a sync artifact: 61,724 rows by gennis_id vs 8,412 by
    # local id, out of 70,838) — try both, prefer gennis_id (the majority).
    subj_by_gennis_id = dict(
        db.query(GennisSubject.gennis_id, GennisSubject.name)
        .filter(GennisSubject.gennis_id.in_(subject_ids)).all()
    ) if subject_ids else {}
    subj_by_local_id = dict(
        db.query(GennisSubject.id, GennisSubject.name)
        .filter(GennisSubject.id.in_(subject_ids)).all()
    ) if subject_ids else {}

    def _subject_name(sid):
        if sid is None:
            return "—"
        return subj_by_gennis_id.get(sid) or subj_by_local_id.get(sid) or "—"

    # ── Deleted students (batch) — no deletion date available locally
    # (unlike old gennis's DeletedStudents + CalendarDay join) ────────────────
    deleted_ids = {
        row.student_id for row in
        db.query(GennisDeletedStudentGroupLive.student_id)
        .filter(GennisDeletedStudentGroupLive.student_id.in_(student_ids))
        .all()
    } if student_ids else set()

    # ── Discounts per student (batch) ─────────────────────────────────────────
    discount_rows = (
        db.query(GennisStudentPaymentLive.student_id, GennisStudentPaymentLive.payment_sum)
        .filter(
            GennisStudentPaymentLive.student_id.in_(student_ids),
            GennisStudentPaymentLive.calendar_month == month,
            GennisStudentPaymentLive.calendar_year == year,
            GennisStudentPaymentLive.location_id == location_id,
            GennisStudentPaymentLive.is_real_payment == False,
        )
        .all()
    ) if student_ids else []
    discounts_by_student: dict = defaultdict(int)
    for row in discount_rows:
        discounts_by_student[row.student_id] += row.payment_sum or 0

    # ── Build response ────────────────────────────────────────────────────────
    students_dict = {}
    total_debt = payment = total_discount = total_first_discount = 0

    for attendance in attendance_records:
        for_student_total_discount = discounts_by_student[attendance.student_id]
        total_first_discount += for_student_total_discount

        if attendance.student_id not in students_dict:
            students_dict[attendance.student_id] = {
                "id": attendance.student_id,
                "student_name": attendance.student_name or "",
                "month": month_date_obj.strftime("%Y-%m"),
                "is_deleted": attendance.student_id in deleted_ids,
                "deleted_date": None,
                "groups": [],
            }

        total_debt      += attendance.total_debt     or 0
        payment         += attendance.payment        or 0
        total_discount  += attendance.total_discount or 0

        students_dict[attendance.student_id]["groups"].append({
            "group_name":               attendance.group_name or "",
            "subject_name":             _subject_name(attendance.subject_id),
            "remaining_debt":           attendance.remaining_debt or 0,
            "total_debt":               attendance.total_debt or 0,
            "payment":                  attendance.payment or 0,
            "total_discount":           attendance.total_discount or 0,
            "for_student_total_discount": for_student_total_discount,
        })

    return {
        "student_list":        list(students_dict.values()),
        "total_debt":          total_debt,
        "remaining_debt":      total_debt - payment,
        "payment":             payment,
        "total_discount":      total_discount,
        "total_first_discount": total_first_discount,
    }


# ── Salaries ──────────────────────────────────────────────────────────────────

@router.get("/salaries", response_model=Union[GennisTeacherSalariesOut, GennisAssistentSalariesOut, GennisStaffSalariesOut])
def gennis_salaries(
    location_id: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000),
    type_salary: str = Query(..., pattern="^(teacher|assistent|staff)$"),
    db: Session = Depends(get_db),
):
    """gennis-v2's monthly salary tables already carry black_salary/debt/
    fine/remaining_salary/is_deleted pre-computed per row — no separate
    black-salary join or deleted-cutoff-date logic needed, unlike old
    gennis's raw TeacherSalary + TeacherBlackSalary + DeletedTeachers."""
    month_date_obj = datetime.strptime(f"{year}-{month:02d}", "%Y-%m")

    if type_salary == "teacher":
        rows = (
            db.query(GennisTeacherSalaryLive)
            .filter(
                GennisTeacherSalaryLive.calendar_month == month,
                GennisTeacherSalaryLive.calendar_year == year,
                GennisTeacherSalaryLive.location_id == location_id,
            )
            .all()
        )
        salary_dict = {}
        total_salary = total_taken = total_black = total_debt = total_fine = total_remaining = 0
        for s in rows:
            salary_dict[s.teacher_id] = {
                "id":               s.teacher_id,
                "teacher_name":     s.teacher_name or "",
                "month":            month_date_obj.strftime("%Y-%m"),
                "is_deleted":       s.is_deleted,
                "deleted_date":     None,
                "teacher_salary":   s.total_salary,
                "taken_money":      s.taken_money,
                "remaining_salary": s.remaining_salary,
                "black_salary":     s.black_salary,
                "debt":             s.debt,
                "fine":             s.fine,
            }
            total_remaining += s.remaining_salary or 0
            total_fine      += s.fine or 0
            total_debt      += s.debt or 0
            total_black     += s.black_salary or 0
            total_salary    += s.total_salary or 0
            total_taken     += s.taken_money or 0

        return {
            "salary_list":      list(salary_dict.values()),
            "total_salary":     total_salary,
            "taken_money":      total_taken,
            "remaining_salary": total_remaining,
            "black_salary":     total_black,
            "debt":             total_debt,
            "fine":             total_fine,
        }

    elif type_salary == "assistent":
        rows = (
            db.query(GennisAssistentSalaryLive)
            .filter(
                GennisAssistentSalaryLive.calendar_month == month,
                GennisAssistentSalaryLive.calendar_year == year,
                GennisAssistentSalaryLive.location_id == location_id,
            )
            .all()
        )
        salary_dict = {}
        total_salary = total_taken = total_black = total_debt = total_fine = total_remaining = 0
        for s in rows:
            salary_dict[s.assistent_id] = {
                "id":               s.assistent_id,
                "assistent_name":   s.assistent_name or "",
                "month":            month_date_obj.strftime("%Y-%m"),
                "is_deleted":       s.is_deleted,
                "assistent_salary": s.total_salary,
                "taken_money":      s.taken_money,
                "remaining_salary": s.remaining_salary,
                "black_salary":     s.black_salary,
                "debt":             s.debt,
                "fine":             s.fine,
            }
            total_remaining += s.remaining_salary or 0
            total_fine      += s.fine or 0
            total_debt      += s.debt or 0
            total_black     += s.black_salary or 0
            total_salary    += s.total_salary or 0
            total_taken     += s.taken_money or 0

        return {
            "salary_list":      list(salary_dict.values()),
            "total_salary":     total_salary,
            "taken_money":      total_taken,
            "remaining_salary": total_remaining,
            "black_salary":     total_black,
            "debt":             total_debt,
            "fine":             total_fine,
        }

    # ── Staff ─────────────────────────────────────────────────────────────────
    else:
        rows = (
            db.query(GennisStaffSalaryLive)
            .filter(
                GennisStaffSalaryLive.calendar_month == month,
                GennisStaffSalaryLive.calendar_year == year,
                GennisStaffSalaryLive.location_id == location_id,
            )
            .all()
        )
        salary_dict = {}
        total_salary = total_taken = 0
        for s in rows:
            if s.staff_id not in salary_dict:
                salary_dict[s.staff_id] = {
                    "id":               s.staff_id,
                    "staff_name":       s.staff_name or "",
                    "month":            month_date_obj.strftime("%Y-%m"),
                    "is_deleted":       s.is_deleted,
                    "deleted_date":     s.deleted_date.strftime("%Y-%m") if s.deleted_date else None,
                    "deleted_comment":  s.deleted_comment,
                    "staff_salary":     s.total_salary,
                    "taken_money":      s.taken_money,
                    "remaining_salary": s.remaining_salary,
                }
            total_salary += s.total_salary or 0
            total_taken  += s.taken_money or 0

        return {
            "salary_list":      list(salary_dict.values()),
            "total_salary":     total_salary,
            "taken_money":      total_taken,
            "remaining_salary": total_salary - total_taken,
        }


# ── Overhead ──────────────────────────────────────────────────────────────────

@router.get("/overhead", response_model=GennisOverheadDetailOut)
def gennis_overhead(
    location_id: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000),
    db: Session = Depends(get_db),
):
    month_date_obj = datetime.strptime(f"{year}-{month:02d}", "%Y-%m")

    all_overheads = (
        db.query(GennisOverheadLive)
        .filter(
            GennisOverheadLive.calendar_month == month,
            GennisOverheadLive.calendar_year == year,
            GennisOverheadLive.location_id == location_id,
            GennisOverheadLive.deleted == False,
        )
        .all()
    )

    total_gaz = total_svet = total_suv = total_arenda = total_other = 0
    overhead_list = []

    for overhead in all_overheads:
        item_sum = overhead.item_sum or 0
        name = (overhead.item_name or "").lower()

        if name == "gaz":       total_gaz    += item_sum
        elif name == "svet":    total_svet   += item_sum
        elif name == "suv":     total_suv    += item_sum
        elif name == "arenda":  total_arenda += item_sum
        else:                   total_other  += item_sum

        overhead_list.append({
            "id":           overhead.id,
            "item_name":    overhead.item_name,
            "item_sum":     item_sum,
            "month":        month_date_obj.strftime("%Y-%m"),
            "payment_type": overhead.channel or "",
        })

    return {
        "overhead_list": overhead_list,
        "total_gaz":     total_gaz,
        "total_svet":    total_svet,
        "total_suv":     total_suv,
        "total_arenda":  total_arenda,
        "total_other":   total_other,
    }
