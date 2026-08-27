"""
Detailed per-record views for the Turon school.
Mirrors encashment/views/encashment.py from the Turon project.
No black-salary or assistent-salary — Turon does not have those.

Reads locally (get_db) from turon-v2's own turon_*_v2 tables wherever a
live local equivalent exists — same reasoning as statistics.py's Turon
dashboard fix: old turon has had no real admin activity since 2026-08-20,
turon-v2 is the live system now, and its tables already live in this same
DB (see app/models.py's "Turon V2 people/academic tables" block).

/directors is the one endpoint left on the external old-turon DB
(get_turon_db) — turon-v2 has no local concept of director role/branch
assignment yet (see app/core/roles.py in turon-v2: "director/admin/
assistent/parent/programmer exist on the frontend but no turon-v2
endpoint creates them yet"), so there is no local data to read.

"Branch payments (books)" in /encashment also has no local equivalent —
turon-v2 has no book-sales feature — so that one sub-field returns 0 with
a comment below. It does not feed into payment_total/overall_total in
either the old or new version (informational only), so this doesn't
affect the report's core numbers.
"""
from collections import defaultdict
from datetime import datetime, date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, exists, and_, or_, case, select

from app.database import get_turon_db, get_db
from app.external_models import turon as T
from app.models import (
    User,
    PaymentType,
    TuronBranchV2,
    TuronClassNumberV2,
    TuronClassColorV2,
    TuronTeacherProfileV2,
    TuronStaffProfileV2,
    TuronUserProfileV2,
    TuronGroupV2,
    turon_group_student_v2_table,
    TuronDeletedStudentV2,
    TuronAttendancePerMonthV2,
    TuronStudentPaymentV2,
    TuronTeacherSalaryV2,
    TuronTeacherSalaryPaymentV2,
    TuronStaffSalaryV2,
    TuronStaffSalaryPaymentV2,
    TuronOverheadV2,
    TuronOverheadTypeV2,
    TuronCapitalV2,
)
from typing import List, Optional
from app.schemas_stats import (
    BranchItem,
    TuronSchoolStudentsOut, TuronTeacherSalariesOut,
    TuronEmployerSalariesOut, TuronEncashmentOut,
)

router = APIRouter(prefix="/turon", tags=["Turon Detail"])


# ── Branches ──────────────────────────────────────────────────────────────────

@router.get("/branches", response_model=List[BranchItem])
def turon_branches(db: Session = Depends(get_db)):
    """List Turon school branches, excluding Gazalkent and Test."""
    rows = (
        db.query(TuronBranchV2)
        .filter(
            TuronBranchV2.deleted == False,
            ~TuronBranchV2.name.in_(["Gazalkent", "Test"]),
        )
        .order_by(TuronBranchV2.id)
        .all()
    )
    return [{"id": r.id, "name": r.name} for r in rows]


# ── People lists ─────────────────────────────────────────────────────────────

@router.get("/directors")
def turon_directors(
    branch_id: Optional[int] = Query(None),
    db: Session = Depends(get_turon_db),
):
    """List all active Turon directors (users in the 'director' group),
    optionally filtered by branch via permissions_manybranch.

    Stays on the external DB — turon-v2 has no local director role/branch
    assignment concept yet (see module docstring)."""
    q = (
        db.query(T.CustomUser, T.ManyBranch, T.Branch)
        .join(T.CustomAutoGroup, T.CustomAutoGroup.user_id == T.CustomUser.id)
        .join(T.AuthGroup, T.AuthGroup.id == T.CustomAutoGroup.group_id)
        .join(T.ManyBranch, T.ManyBranch.user_id == T.CustomUser.id)
        .join(T.Branch, T.Branch.id == T.ManyBranch.branch_id)
        .filter(
            T.AuthGroup.name == "Direktor",
            T.CustomUser.is_active == True,
            or_(T.CustomAutoGroup.deleted == False, T.CustomAutoGroup.deleted == None),
        )
    )
    if branch_id:
        q = q.filter(T.ManyBranch.branch_id == branch_id)
    rows = q.order_by(T.CustomUser.name).all()
    return [
        {
            "id": user.id,
            "name": user.name,
            "surname": user.surname,
            "phone": user.phone,
            "branch_id": branch.id,
            "branch_name": branch.name,
        }
        for user, many_branch, branch in rows
    ]


@router.get("/teachers")
def turon_teachers(
    branch_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """List active turon-v2 teachers (has a turon_teacher_profile_v2 row,
    not soft-deleted)."""
    q = (
        db.query(User, TuronUserProfileV2)
        .join(TuronTeacherProfileV2, TuronTeacherProfileV2.user_id == User.id)
        .join(TuronUserProfileV2, TuronUserProfileV2.user_id == User.id)
        .filter(
            User.role == "teacher",
            User.deleted == False,
            TuronTeacherProfileV2.deleted == False,
        )
    )
    if branch_id:
        q = q.filter(TuronUserProfileV2.branch_id == branch_id)
    rows = q.order_by(User.name).all()
    return [
        {
            "id": user.id,
            "user_id": user.id,
            "name": user.name,
            "surname": user.surname,
            "phone": profile.phone,
            "branch_id": profile.branch_id,
        }
        for user, profile in rows
    ]


@router.get("/staff")
def turon_staff(
    branch_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """List active turon-v2 staff (role='staff'). TuronStaffProfileV2 only
    tracks deletions (see its model docstring) — no row, or a row with
    deleted=false, both mean "still active"; only deleted=true excludes."""
    q = (
        db.query(User, TuronUserProfileV2)
        .join(TuronUserProfileV2, TuronUserProfileV2.user_id == User.id)
        .outerjoin(TuronStaffProfileV2, TuronStaffProfileV2.user_id == User.id)
        .filter(
            User.role == "staff",
            User.deleted == False,
            or_(TuronStaffProfileV2.id == None, TuronStaffProfileV2.deleted == False),
        )
    )
    if branch_id:
        q = q.filter(TuronUserProfileV2.branch_id == branch_id)
    rows = q.order_by(User.name).all()
    return [
        {
            "id": user.id,
            "name": user.name,
            "surname": user.surname,
            "phone": profile.phone,
            "branch_id": profile.branch_id,
        }
        for user, profile in rows
    ]


# ── helpers ───────────────────────────────────────────────────────────────────

def _salary_dates(db: Session, date_col, filter_clause) -> list:
    rows = (
        db.query(
            extract("year",  date_col).label("year"),
            extract("month", date_col).label("month"),
        )
        .filter(filter_clause)
        .distinct()
        .order_by("year", "month")
        .all()
    )
    ym: dict = defaultdict(list)
    for r in rows:
        ym[int(r.year)].append(int(r.month))
    return [{"year": y, "months": m} for y, m in ym.items()]


# ── School students ───────────────────────────────────────────────────────────

@router.get("/school-students", response_model=TuronSchoolStudentsOut)
def turon_school_students(
    branch: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000),
    db: Session = Depends(get_db),
):
    """
    Per-class student payment breakdown for the school system.
    Mirrors GetSchoolStudents from turon/encashment/views/encashment.py.
    """
    first_day = date(year, month, 1)

    # ── Subquery: student is still active in this group (M2M exists) ──────────
    is_active_sub = (
        select(turon_group_student_v2_table.c.student_user_id)
        .where(
            and_(
                turon_group_student_v2_table.c.group_id == TuronAttendancePerMonthV2.group_id,
                turon_group_student_v2_table.c.student_user_id == TuronAttendancePerMonthV2.student_id,
            )
        )
        .correlate(TuronAttendancePerMonthV2)
        .exists()
    )

    # ── Subquery: most recent deleted group for this student this month ────────
    last_deleted_group_sub = (
        select(TuronDeletedStudentV2.group_id)
        .where(
            and_(
                TuronDeletedStudentV2.student_user_id == TuronAttendancePerMonthV2.student_id,
                TuronDeletedStudentV2.deleted_date >= first_day,
            )
        )
        .correlate(TuronAttendancePerMonthV2)
        .order_by(TuronDeletedStudentV2.id.desc())
        .limit(1)
        .scalar_subquery()
    )

    # ── Main attendance query ─────────────────────────────────────────────────
    rows = (
        db.query(
            TuronAttendancePerMonthV2,
            User.name.label("user_name"),
            User.surname.label("user_surname"),
            TuronUserProfileV2.phone.label("user_phone"),
            TuronClassNumberV2.number.label("class_number"),
            TuronClassColorV2.name.label("color_name"),
            TuronGroupV2.id.label("group_id"),
        )
        .join(User, User.id == TuronAttendancePerMonthV2.student_id)
        .join(TuronUserProfileV2, TuronUserProfileV2.user_id == TuronAttendancePerMonthV2.student_id)
        .join(TuronGroupV2, TuronGroupV2.id == TuronAttendancePerMonthV2.group_id)
        .outerjoin(TuronClassNumberV2, TuronClassNumberV2.id == TuronGroupV2.class_number_id)
        .outerjoin(TuronClassColorV2, TuronClassColorV2.id == TuronGroupV2.color_id)
        .filter(
            TuronAttendancePerMonthV2.branch_id == branch,
            TuronAttendancePerMonthV2.deleted == False,
            extract("year",  TuronAttendancePerMonthV2.month_date) == year,
            extract("month", TuronAttendancePerMonthV2.month_date) == month,
        )
        .filter(or_(is_active_sub, TuronAttendancePerMonthV2.group_id == last_deleted_group_sub))
        .order_by(TuronClassNumberV2.number, TuronGroupV2.id, User.surname)
        .all()
    )

    attendance_ids = [r.TuronAttendancePerMonthV2.id for r in rows]

    # ── Payment aggregates per attendance_id ──────────────────────────────────
    payment_rows = (
        db.query(
            TuronStudentPaymentV2.attendance_id,
            func.sum(case((and_(PaymentType.name == "cash",  TuronStudentPaymentV2.status == False), TuronStudentPaymentV2.payment_sum), else_=0)).label("cash"),
            func.sum(case((and_(PaymentType.name == "bank",  TuronStudentPaymentV2.status == False), TuronStudentPaymentV2.payment_sum), else_=0)).label("bank"),
            func.sum(case((and_(PaymentType.name == "click", TuronStudentPaymentV2.status == False), TuronStudentPaymentV2.payment_sum), else_=0)).label("click"),
            func.sum(case((TuronStudentPaymentV2.status == True, TuronStudentPaymentV2.payment_sum), else_=0)).label("paid"),
        )
        .join(PaymentType, PaymentType.id == TuronStudentPaymentV2.payment_type_id)
        .filter(TuronStudentPaymentV2.attendance_id.in_(attendance_ids), TuronStudentPaymentV2.deleted == False)
        .group_by(TuronStudentPaymentV2.attendance_id)
        .all()
    )

    payments_dict: dict = defaultdict(lambda: {"cash": 0, "bank": 0, "click": 0, "paid": 0})
    for p in payment_rows:
        payments_dict[p.attendance_id] = {
            "cash": p.cash or 0, "bank": p.bank or 0,
            "click": p.click or 0, "paid": p.paid or 0,
        }

    # ── Build per-class structure ─────────────────────────────────────────────
    classes = {}
    total_sum = total_debt = total_remaining = total_donation = total_discount = 0
    total_cash = total_bank = total_click = 0

    for row in rows:
        apm = row.TuronAttendancePerMonthV2
        class_key = f"{row.class_number}-{row.color_name}"

        if class_key not in classes:
            classes[class_key] = {
                "class_number": class_key,
                "students": [],
                "_order": (row.class_number or 999, row.group_id),
            }

        p = payments_dict[apm.id]
        cash, bank, click, paid = p["cash"], p["bank"], p["click"], p["paid"]
        donation = apm.discount or 0
        debt     = apm.total_debt or 0

        covered   = cash + bank + click + paid + donation
        remaining = max(0, debt - covered)
        payment   = max(0, debt - remaining - donation - paid)

        total_debt      += debt
        total_remaining += remaining
        total_donation  += donation
        total_discount  += paid
        total_sum       += payment
        total_cash      += cash
        total_bank      += bank
        total_click     += click

        classes[class_key]["students"].append({
            "id":             apm.student_id,
            "name":           row.user_name,
            "surname":        row.user_surname,
            "phone":          row.user_phone,
            "total_debt":     debt,
            "remaining_debt": remaining,
            "cash":           cash,
            "bank":           bank,
            "click":          click,
            "total_dis":      donation,
            "total_discount": paid,
            "month_id":       apm.id,
        })

    sorted_classes = sorted(
        classes.values(),
        key=lambda x: (
            0 if x["_order"][0] == 0 else (2 if x["_order"][0] == 999 else 1),
            x["_order"][0] if x["_order"][0] != 999 else float("inf"),
            x["_order"][1],
        ),
    )
    for c in sorted_classes:
        del c["_order"]

    dates = _salary_dates(db, TuronAttendancePerMonthV2.month_date, TuronAttendancePerMonthV2.deleted == False)

    return {
        "class":                sorted_classes,
        "dates":                dates,
        "total_sum":            total_sum,
        "total_debt":           total_debt,
        "reaming_debt":         total_remaining,
        "total_dis":            total_donation,
        "total_discount":       total_discount,
        "total_with_discount":  total_debt - (total_discount + total_donation),
        "by_payment_type": [
            {"payment_type": "cash",  "total": total_cash},
            {"payment_type": "bank",  "total": total_bank},
            {"payment_type": "click", "total": total_click},
        ],
    }


# ── Teacher salaries ──────────────────────────────────────────────────────────

@router.get("/teacher-salaries", response_model=TuronTeacherSalariesOut)
def turon_teacher_salaries(
    branch: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000),
    db: Session = Depends(get_db),
):
    """
    Per-teacher salary breakdown with cash/bank/click split.
    Mirrors GetTeacherSalary from turon/encashment/views/encashment.py.
    """
    salary_rows = (
        db.query(
            TuronTeacherSalaryV2,
            User.name.label("user_name"),
            User.surname.label("user_surname"),
            TuronUserProfileV2.phone.label("user_phone"),
            TuronTeacherProfileV2.subjects.label("subjects"),
        )
        .join(User, User.id == TuronTeacherSalaryV2.teacher_id)
        .join(TuronUserProfileV2, TuronUserProfileV2.user_id == TuronTeacherSalaryV2.teacher_id)
        .outerjoin(TuronTeacherProfileV2, TuronTeacherProfileV2.user_id == TuronTeacherSalaryV2.teacher_id)
        .filter(
            TuronTeacherSalaryV2.branch_id == branch,
            TuronTeacherSalaryV2.deleted == False,
            extract("month", TuronTeacherSalaryV2.month_date) == month,
            extract("year",  TuronTeacherSalaryV2.month_date) == year,
        )
        .all()
    )

    salary_ids = [r.TuronTeacherSalaryV2.id for r in salary_rows]

    # Batch payment breakdown for all salaries at once
    pay_rows = (
        db.query(
            TuronTeacherSalaryPaymentV2.teacher_salary_id,
            func.sum(case((PaymentType.name == "cash",  TuronTeacherSalaryPaymentV2.salary), else_=0)).label("cash"),
            func.sum(case((PaymentType.name == "bank",  TuronTeacherSalaryPaymentV2.salary), else_=0)).label("bank"),
            func.sum(case((PaymentType.name == "click", TuronTeacherSalaryPaymentV2.salary), else_=0)).label("click"),
        )
        .join(PaymentType, PaymentType.id == TuronTeacherSalaryPaymentV2.payment_type_id)
        .filter(
            TuronTeacherSalaryPaymentV2.teacher_salary_id.in_(salary_ids),
            TuronTeacherSalaryPaymentV2.deleted == False,
        )
        .group_by(TuronTeacherSalaryPaymentV2.teacher_salary_id)
        .all()
    )
    pay_dict = {r.teacher_salary_id: {"cash": r.cash or 0, "bank": r.bank or 0, "click": r.click or 0} for r in pay_rows}

    salary_list = []
    for row in salary_rows:
        s = row.TuronTeacherSalaryV2
        p = pay_dict.get(s.id, {"cash": 0, "bank": 0, "click": 0})
        # subjects is a JSON array of {id, name} on the teacher's profile —
        # turon-v2 has no teacher_subjects M2M to join, this is the actual
        # source its own UI reads. First entry only, matching old code's
        # "one representative subject" behavior (there it was func.min by
        # name; here it's whatever's first in the profile's own list).
        subjects = row.subjects or []
        subject_name = subjects[0]["name"] if subjects else None
        salary_list.append({
            "id":               s.id,
            "name":             row.user_name,
            "surname":          row.user_surname,
            "phone":            row.user_phone,
            "total_salary":     s.total_salary,
            "taken_salary":     s.taken_salary,
            "remaining_salary": s.remaining_salary,
            "subject":          subject_name,
            "cash":             p["cash"],
            "bank":             p["bank"],
            "click":            p["click"],
        })

    dates = _salary_dates(db, TuronTeacherSalaryV2.month_date, TuronTeacherSalaryV2.branch_id == branch)

    return {"salary": salary_list, "dates": dates, "branch": branch}


# ── Employer (staff) salaries ─────────────────────────────────────────────────

@router.get("/employer-salaries", response_model=TuronEmployerSalariesOut)
def turon_employer_salaries(
    branch: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000),
    db: Session = Depends(get_db),
):
    """
    Per-staff salary breakdown with cash/bank/click split.
    Mirrors GetEMployerSalary from turon/encashment/views/encashment.py.
    """
    salary_rows = (
        db.query(
            TuronStaffSalaryV2,
            User.name.label("user_name"),
            User.surname.label("user_surname"),
            TuronUserProfileV2.phone.label("user_phone"),
        )
        .join(User, User.id == TuronStaffSalaryV2.user_id)
        .join(TuronUserProfileV2, TuronUserProfileV2.user_id == TuronStaffSalaryV2.user_id)
        .filter(
            TuronStaffSalaryV2.branch_id == branch,
            TuronStaffSalaryV2.deleted == False,
            extract("month", TuronStaffSalaryV2.month_date) == month,
            extract("year",  TuronStaffSalaryV2.month_date) == year,
        )
        .all()
    )

    salary_ids = [r.TuronStaffSalaryV2.id for r in salary_rows]

    # Batch payment breakdown
    pay_rows = (
        db.query(
            TuronStaffSalaryPaymentV2.staff_salary_id,
            func.sum(case((PaymentType.name == "cash",  TuronStaffSalaryPaymentV2.salary), else_=0)).label("cash"),
            func.sum(case((PaymentType.name == "bank",  TuronStaffSalaryPaymentV2.salary), else_=0)).label("bank"),
            func.sum(case((PaymentType.name == "click", TuronStaffSalaryPaymentV2.salary), else_=0)).label("click"),
        )
        .join(PaymentType, PaymentType.id == TuronStaffSalaryPaymentV2.payment_type_id)
        .filter(
            TuronStaffSalaryPaymentV2.staff_salary_id.in_(salary_ids),
            TuronStaffSalaryPaymentV2.deleted == False,
        )
        .group_by(TuronStaffSalaryPaymentV2.staff_salary_id)
        .all()
    )
    pay_dict = {r.staff_salary_id: {"cash": r.cash or 0, "bank": r.bank or 0, "click": r.click or 0} for r in pay_rows}

    salary_list = []
    for row in salary_rows:
        s = row.TuronStaffSalaryV2
        p = pay_dict.get(s.id, {"cash": 0, "bank": 0, "click": 0})
        salary_list.append({
            "id":               s.id,
            "name":             row.user_name,
            "surname":          row.user_surname,
            "phone":            row.user_phone,
            "total_salary":     s.total_salary,
            "taken_salary":     s.taken_salary,
            "remaining_salary": s.remaining_salary,
            "cash":             p["cash"],
            "bank":             p["bank"],
            "click":            p["click"],
        })

    dates = _salary_dates(db, TuronStaffSalaryV2.month_date, TuronStaffSalaryV2.branch_id == branch)

    return {"salary": salary_list, "dates": dates, "branch": branch}


# ── Encashment school (full report by payment type) ────────────────────────────

@router.get("/encashment", response_model=TuronEncashmentOut)
def turon_encashment(
    branch: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000),
    db: Session = Depends(get_db),
):
    """
    Full encashment report broken down by payment type.
    Mirrors EncashmentsSchool from turon/encashment/views/encashment.py.
    """
    # ── Totals (payment-type independent) ─────────────────────────────────────
    student_totals = (
        db.query(
            func.coalesce(func.sum(TuronAttendancePerMonthV2.remaining_debt), 0).label("remaining_debt"),
            func.coalesce(func.sum(TuronAttendancePerMonthV2.total_debt),     0).label("total_debt"),
        )
        .filter(
            TuronAttendancePerMonthV2.branch_id == branch,
            TuronAttendancePerMonthV2.deleted == False,
            extract("year",  TuronAttendancePerMonthV2.month_date) == year,
            extract("month", TuronAttendancePerMonthV2.month_date) == month,
        )
        .one()
    )

    teacher_totals = (
        db.query(
            func.coalesce(func.sum(TuronTeacherSalaryV2.remaining_salary), 0).label("remaining"),
            func.coalesce(func.sum(TuronTeacherSalaryV2.total_salary),     0).label("total"),
        )
        .filter(
            TuronTeacherSalaryV2.branch_id == branch,
            TuronTeacherSalaryV2.deleted == False,
            extract("month", TuronTeacherSalaryV2.month_date) == month,
            extract("year",  TuronTeacherSalaryV2.month_date) == year,
        )
        .one()
    )

    user_totals = (
        db.query(
            func.coalesce(func.sum(TuronStaffSalaryV2.remaining_salary), 0).label("remaining"),
            func.coalesce(func.sum(TuronStaffSalaryV2.total_salary),     0).label("total"),
        )
        .filter(
            TuronStaffSalaryV2.branch_id == branch,
            TuronStaffSalaryV2.deleted == False,
            extract("month", TuronStaffSalaryV2.month_date) == month,
            extract("year",  TuronStaffSalaryV2.month_date) == year,
        )
        .one()
    )

    # ── Per payment-type breakdown ─────────────────────────────────────────────
    payment_types = db.query(PaymentType).all()

    overhead_type_names = ["Gaz", "Svet", "Suv", "Arenda", "Oshxona uchun", "Reklama uchun", "Boshqa"]

    info = {
        "student":  {"remaining_debt": student_totals.remaining_debt, "total_debt": student_totals.total_debt, "payments": []},
        "teacher":  {"remaining_salary": teacher_totals.remaining,    "total_salary": teacher_totals.total,    "salaries": []},
        "user":     {"remaining_salary": user_totals.remaining,        "total_salary": user_totals.total,       "salaries": []},
        "overhead": [],
        "capital":  [],
        "total":    [],
    }
    payment_results = []
    overall_total = 0

    for pt in payment_types:
        # students — "encashment" collection (status == True), distinct
        # from the dashboard's revenue definition (status == False).
        s_pay = (
            db.query(func.coalesce(func.sum(TuronStudentPaymentV2.payment_sum), 0))
            .filter(
                TuronStudentPaymentV2.branch_id == branch,
                TuronStudentPaymentV2.payment_type_id == pt.id,
                TuronStudentPaymentV2.deleted == False,
                TuronStudentPaymentV2.status == True,
                extract("month", TuronStudentPaymentV2.date) == month,
                extract("year",  TuronStudentPaymentV2.date) == year,
            )
            .scalar() or 0
        )
        s_debt = (
            db.query(func.coalesce(func.sum(TuronAttendancePerMonthV2.total_debt), 0))
            .filter(
                TuronAttendancePerMonthV2.branch_id == branch,
                extract("month", TuronAttendancePerMonthV2.month_date) == month,
                extract("year",  TuronAttendancePerMonthV2.month_date) == year,
            )
            .scalar() or 0
        )
        s_remaining = (
            db.query(func.coalesce(func.sum(TuronAttendancePerMonthV2.remaining_debt), 0))
            .filter(
                TuronAttendancePerMonthV2.branch_id == branch,
                extract("month", TuronAttendancePerMonthV2.month_date) == month,
                extract("year",  TuronAttendancePerMonthV2.month_date) == year,
            )
            .scalar() or 0
        )

        # teachers
        t_total     = db.query(func.coalesce(func.sum(TuronTeacherSalaryV2.total_salary),     0)).filter(TuronTeacherSalaryV2.branch_id == branch, extract("month", TuronTeacherSalaryV2.month_date) == month, extract("year", TuronTeacherSalaryV2.month_date) == year).scalar() or 0
        t_remaining = db.query(func.coalesce(func.sum(TuronTeacherSalaryV2.remaining_salary), 0)).filter(TuronTeacherSalaryV2.branch_id == branch, extract("month", TuronTeacherSalaryV2.month_date) == month, extract("year", TuronTeacherSalaryV2.month_date) == year).scalar() or 0
        t_taken    = (
            db.query(func.coalesce(func.sum(TuronTeacherSalaryPaymentV2.salary), 0))
            .filter(
                TuronTeacherSalaryPaymentV2.branch_id == branch,
                TuronTeacherSalaryPaymentV2.payment_type_id == pt.id,
                TuronTeacherSalaryPaymentV2.deleted == False,
                extract("month", TuronTeacherSalaryPaymentV2.date) == month,
                extract("year",  TuronTeacherSalaryPaymentV2.date) == year,
            )
            .scalar() or 0
        )

        # workers
        u_total    = db.query(func.coalesce(func.sum(TuronStaffSalaryV2.total_salary),     0)).filter(TuronStaffSalaryV2.branch_id == branch, extract("month", TuronStaffSalaryV2.month_date) == month, extract("year", TuronStaffSalaryV2.month_date) == year).scalar() or 0
        u_remaining = db.query(func.coalesce(func.sum(TuronStaffSalaryV2.remaining_salary), 0)).filter(TuronStaffSalaryV2.branch_id == branch, extract("month", TuronStaffSalaryV2.month_date) == month, extract("year", TuronStaffSalaryV2.month_date) == year).scalar() or 0
        u_taken    = (
            db.query(func.coalesce(func.sum(TuronStaffSalaryPaymentV2.salary), 0))
            .filter(
                TuronStaffSalaryPaymentV2.branch_id == branch,
                TuronStaffSalaryPaymentV2.payment_type_id == pt.id,
                TuronStaffSalaryPaymentV2.deleted == False,
                extract("month", TuronStaffSalaryPaymentV2.date) == month,
                extract("year",  TuronStaffSalaryPaymentV2.date) == year,
            )
            .scalar() or 0
        )

        # branch payments (books) — no turon-v2 equivalent, see module
        # docstring. Doesn't feed payment_total/overall_total below.
        branch_pay = 0

        # overheads by type
        overhead_totals = {}
        for oh_name in overhead_type_names:
            key = oh_name.lower().replace(" ", "_")
            val = (
                db.query(func.coalesce(func.sum(TuronOverheadV2.price), 0))
                .join(TuronOverheadTypeV2, TuronOverheadTypeV2.id == TuronOverheadV2.type_id)
                .filter(
                    TuronOverheadV2.branch_id == branch,
                    TuronOverheadV2.payment_type_id == pt.id,
                    TuronOverheadV2.deleted == False,
                    TuronOverheadTypeV2.name == oh_name,
                    extract("month", TuronOverheadV2.date) == month,
                    extract("year",  TuronOverheadV2.date) == year,
                )
                .scalar() or 0
            )
            overhead_totals[key] = val
        total_overhead = sum(overhead_totals.values())

        # capital
        capital_total = (
            db.query(func.coalesce(func.sum(TuronCapitalV2.price), 0))
            .filter(
                TuronCapitalV2.branch_id == branch,
                TuronCapitalV2.payment_type_id == pt.id,
                TuronCapitalV2.deleted == False,
                extract("month", TuronCapitalV2.added_date) == month,
                extract("year",  TuronCapitalV2.added_date) == year,
            )
            .scalar() or 0
        )

        payment_total = s_pay - (t_taken + u_taken + capital_total + total_overhead)
        overall_total += payment_total

        payment_results.append({
            "payment_type": pt.name,
            "students": {"student_total_payment": s_pay, "total_debt": s_debt, "remaining_debt": s_remaining},
            "teachers": {"taken": t_taken, "remaining_salary": t_remaining, "total_salary": t_total},
            "workers":  {"taken": u_taken, "remaining_salary": u_remaining, "total_salary": u_total},
            "branch":   {"branch_total_payment": branch_pay},
            "overheads": {"total_overhead_payment": total_overhead, **overhead_totals},
            "capitals":  {"total_capital": capital_total},
            "payment_total": payment_total,
        })

        info["student"]["payments"].append({"payment_type": pt.name, "student_total_payment": s_pay})
        info["teacher"]["salaries"].append({"payment_type": pt.name, "teacher_total_salary": t_total})
        info["user"]["salaries"].append({"payment_type": pt.name, "worker_total_salary": u_total})
        info["overhead"].append({"payment_type": pt.name, "total_overhead_payment": total_overhead})
        info["capital"].append({"payment_type": pt.name, "total_capital": capital_total})
        info["total"].append({"payment_type": pt.name, "payment_total": payment_total})

    dates = _salary_dates(db, TuronStaffSalaryV2.month_date, TuronStaffSalaryV2.branch_id == branch)

    return {
        "payment_results": payment_results,
        "summary":         info,
        "overall_total":   overall_total,
        "dates":           dates,
    }
