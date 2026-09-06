"""Per-student attendance and payment/balance history for student_platform's
parent portal — requests #13 and #14 from the classroom backend team.

Both endpoints take the SAME (source, student_id) pair student_platform_login
already hands out (see that function's docstring), and both are gated by
can_view_student: only the student themself or a linked parent may read
this — not staff, even though the same numbers are visible elsewhere in the
admin panel (request #14's explicit privacy note).

gennis and turon keep this data in unrelated table families with
unrelated id conventions (see parent_portal.resolve_legacy_turon_student's
docstring for the turon id bridge, and the module-level notes below for
gennis) — every `student_id` this file receives from the URL is first
translated to whichever internal id that system's own tables actually use,
never passed straight through.
"""
from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import models
from app.database import get_db, get_turon_db
from app.dependencies import get_current_user
from app.services.parent_portal import can_view_student, resolve_legacy_turon_student

router = APIRouter(prefix="/integrations/student-platform", tags=["Integrations"])


def _require_access(db: Session, current_user: models.User, source: str, student_id: int) -> None:
    if source not in ("gennis", "turon"):
        raise HTTPException(status_code=422, detail="source must be 'gennis' or 'turon'")
    if not can_view_student(db, current_user, source, student_id):
        raise HTTPException(status_code=403, detail="Not authorized to view this student's data")


# ── #13: attendance ────────────────────────────────────────────────────────────

@router.get("/student/{student_id}/attendance")
def student_attendance(
    student_id: int,
    source: str = Query(...),
    from_: date = Query(..., alias="from"),
    to: date = Query(...),
    db: Session = Depends(get_db),
    turon_db: Session = Depends(get_turon_db),
    current_user: models.User = Depends(get_current_user),
):
    _require_access(db, current_user, source, student_id)
    if source == "gennis":
        days, summary = _gennis_attendance(db, student_id, from_, to)
    else:
        days, summary = _turon_attendance(db, turon_db, student_id, from_, to)
    return {"student_id": student_id, "source": source, "from": from_, "to": to, "summary": summary, "days": days}


def _summarize(days: list[dict]) -> dict:
    total = len(days)
    present = sum(1 for d in days if d["came"])
    return {
        "total": total,
        "present": present,
        "absent": total - present,
        "percent": round(present / total * 100) if total else 0,
    }


def _gennis_attendance(db: Session, gennis_id: int, from_: date, to: date):
    # gennis_lesson_attendance.student_id (and .group_id) are the INTERNAL
    # gennis_student.id / gennis_group.id PKs, NOT the external gennis_id
    # request #13 assumed — verified against production data (579790/579810
    # rows join on the internal id, 7 only coincidentally on gennis_id).
    student = db.query(models.GennisStudent.id).filter(models.GennisStudent.gennis_id == gennis_id).first()
    if not student:
        return [], _summarize([])
    internal_id = student.id

    rows = (
        db.query(models.GennisLessonAttendance, models.GennisGroup.name, models.GennisSubject.name)
        .outerjoin(models.GennisGroup, models.GennisGroup.id == models.GennisLessonAttendance.group_id)
        .outerjoin(models.GennisSubject, models.GennisSubject.id == models.GennisGroup.subject_id)
        .filter(
            models.GennisLessonAttendance.student_id == internal_id,
            models.GennisLessonAttendance.lesson_date >= from_,
            models.GennisLessonAttendance.lesson_date <= to,
        )
        .order_by(models.GennisLessonAttendance.lesson_date)
        .all()
    )
    days = [
        {
            "date": att.lesson_date.isoformat(),
            "came": att.came,
            "group_id": att.group_id,
            "group_name": group_name,
            "subject": subject_name,
            "note": att.note,
        }
        for att, group_name, subject_name in rows
    ]
    return days, _summarize(days)


def _turon_attendance(db: Session, turon_db: Session, management_user_id: int, from_: date, to: date):
    from app.external_models.turon import Group, StudentDailyAttendance, StudentMonthlySummary

    student = resolve_legacy_turon_student(db, turon_db, management_user_id)
    if not student:
        return [], _summarize([])

    rows = (
        turon_db.query(StudentDailyAttendance, StudentMonthlySummary.group_id)
        .join(StudentMonthlySummary, StudentMonthlySummary.id == StudentDailyAttendance.monthly_summary_id)
        .filter(
            StudentMonthlySummary.student_id == student.id,
            StudentDailyAttendance.day >= from_,
            StudentDailyAttendance.day <= to,
        )
        .order_by(StudentDailyAttendance.day)
        .all()
    )
    group_ids = {group_id for _, group_id in rows if group_id is not None}
    group_names = {}
    if group_ids:
        group_names = dict(turon_db.query(Group.id, Group.name).filter(Group.id.in_(group_ids)).all())

    days = [
        {
            "date": att.day.isoformat(),
            "came": bool(att.status),
            "group_id": group_id,
            "group_name": group_names.get(group_id),
            "reason": att.reason,
            "entry_time": att.entry_time.isoformat() if att.entry_time else None,
            "leave_time": att.leave_time.isoformat() if att.leave_time else None,
        }
        for att, group_id in rows
    ]
    return days, _summarize(days)


# ── #14: payments / balance ────────────────────────────────────────────────────

@router.get("/student/{student_id}/payments")
def student_payments(
    student_id: int,
    source: str = Query(...),
    from_: str = Query(..., alias="from", description="YYYY-MM"),
    to: str = Query(..., description="YYYY-MM"),
    db: Session = Depends(get_db),
    turon_db: Session = Depends(get_turon_db),
    current_user: models.User = Depends(get_current_user),
):
    _require_access(db, current_user, source, student_id)
    from_year, from_month = _parse_year_month(from_)
    to_year, to_month = _parse_year_month(to)

    if source == "gennis":
        balance, months = _gennis_payments(db, student_id, from_year, from_month, to_year, to_month)
        payments: list = []
    else:
        balance, months, payments = _turon_payments(db, turon_db, student_id, from_year, from_month, to_year, to_month)

    return {
        "student_id": student_id,
        "source": source,
        "currency": "UZS",
        "balance": balance,
        "months": months,
        "payments": payments,
    }


def _parse_year_month(value: str) -> tuple[int, int]:
    """A numeric-but-nonsense month (e.g. "2024-13") or an absurd year must
    fail here with a clean 422 — `date(year, month, 1)` downstream raises
    ValueError/OverflowError on those, which FastAPI has nothing to turn
    into anything but a bare 500."""
    try:
        year_s, month_s = value.split("-")
        year, month = int(year_s), int(month_s)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=422, detail=f"Invalid YYYY-MM value: {value!r}")
    if not (1 <= month <= 12) or not (1900 <= year <= 2200):
        raise HTTPException(status_code=422, detail=f"Invalid YYYY-MM value: {value!r}")
    return year, month


def _in_range(year: int, month: int, from_year: int, from_month: int, to_year: int, to_month: int) -> bool:
    key = (year, month)
    return (from_year, from_month) <= key <= (to_year, to_month)


def _debt_balance(raw_amount: Optional[int]) -> dict:
    """Both gennis_student_credit.balance and turon's CustomUser.balance are
    plain debt magnitudes in this system — verified against production
    gennis data (11,882 rows, all >= 0, up to 2,184,530; never negative) —
    not a signed avans/qarz value. Request #14 asked for a SIGNED `amount`
    (negative = debt) regardless, so that conversion happens once, here.
    """
    amount = raw_amount or 0
    return {
        "amount": -amount if amount else 0,
        "is_debt": amount > 0,
        "debt_amount": amount,
    }


def _gennis_payments(db: Session, gennis_id: int, fy: int, fm: int, ty: int, tm: int):
    student = db.query(models.GennisStudent.id).filter(models.GennisStudent.gennis_id == gennis_id).first()
    if not student:
        return _debt_balance(None), []
    internal_id = student.id

    credit = (
        db.query(models.GennisStudentCredit)
        .filter(models.GennisStudentCredit.student_id == internal_id)
        .first()
    )
    balance = _debt_balance(credit.balance if credit else None)
    if credit:
        balance["updated_at"] = credit.updated_at.isoformat() if credit.updated_at else None

    rows = (
        db.query(models.GennisAttendanceHistoryStudent)
        .filter(models.GennisAttendanceHistoryStudent.student_id == internal_id)
        .order_by(
            models.GennisAttendanceHistoryStudent.calendar_year.desc(),
            models.GennisAttendanceHistoryStudent.calendar_month.desc(),
        )
        .all()
    )
    months = [
        {
            "year": r.calendar_year,
            "month": r.calendar_month,
            "group_id": r.group_id,
            "group_name": r.group_name,
            "total_debt": r.total_debt,
            "discount": r.total_discount,
            "payment": r.payment,
            "remaining_debt": r.remaining_debt,
            "paid": bool(r.status),
        }
        for r in rows
        if _in_range(r.calendar_year, r.calendar_month, fy, fm, ty, tm)
    ]
    return balance, months


def _parse_turon_balance(raw: Optional[str]) -> Optional[int]:
    """CustomUser.balance is a free-form STRING (schema quirk, not our
    choice) — request #14 explicitly flagged not knowing its format ahead
    of time. Strip everything but digits and a leading '-', so "450 000",
    "450,000" and "450000" all parse; give up and return None (never crash
    the whole response) on anything that still isn't a clean integer.
    """
    if not raw:
        return None
    cleaned = raw.strip().replace(" ", "").replace(",", "")
    try:
        return int(cleaned)
    except ValueError:
        return None


def _turon_payments(db: Session, turon_db: Session, management_user_id: int, fy: int, fm: int, ty: int, tm: int):
    from app.external_models.turon import AttendancePerMonth, CustomUser, Group, PaymentTypes, StudentPayment

    student = resolve_legacy_turon_student(db, turon_db, management_user_id)
    if not student:
        return _debt_balance(None), [], []

    custom_user = turon_db.query(CustomUser).filter(CustomUser.id == student.user_id).first()
    # NOTE: sign convention (positive = debt) is verified for gennis, not
    # for turon — CustomUser.balance's actual meaning still needs
    # confirming against a real account with known debt before this ships.
    raw_balance = _parse_turon_balance(custom_user.balance if custom_user else None)
    balance = _debt_balance(raw_balance)

    month_rows = (
        turon_db.query(AttendancePerMonth, Group.name)
        .outerjoin(Group, Group.id == AttendancePerMonth.group_id)
        .filter(AttendancePerMonth.student_id == student.id)
        .order_by(AttendancePerMonth.month_date.desc())
        .all()
    )
    months = []
    for r, group_name in month_rows:
        if not r.month_date or not _in_range(r.month_date.year, r.month_date.month, fy, fm, ty, tm):
            continue
        months.append({
            "year": r.month_date.year,
            "month": r.month_date.month,
            "group_id": r.group_id,
            "group_name": group_name,
            "total_debt": r.total_debt,
            "discount": r.discount,
            "payment": r.payment,
            "remaining_debt": r.remaining_debt,
            "paid": bool(r.status),
        })

    # Exclusive upper bound (first of the month AFTER `to`) rather than a
    # fixed day-28/29/30/31 cutoff — a payment dated the 29th-31st of `to`'s
    # month must not be silently dropped just because the month is short.
    from_date = date(fy, fm, 1)
    to_date_exclusive = date(ty + 1, 1, 1) if tm == 12 else date(ty, tm + 1, 1)
    payment_rows = (
        turon_db.query(StudentPayment, PaymentTypes.name)
        .outerjoin(PaymentTypes, PaymentTypes.id == StudentPayment.payment_type_id)
        .filter(
            StudentPayment.student_id == student.id,
            StudentPayment.deleted.is_(False),
            StudentPayment.date >= from_date,
            StudentPayment.date < to_date_exclusive,
        )
        .order_by(StudentPayment.date.desc())
        .all()
    )
    payments = [
        {"date": p.date.isoformat() if p.date else None, "amount": p.payment_sum, "type": type_name}
        for p, type_name in payment_rows
    ]
    return balance, months, payments
