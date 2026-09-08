from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app import models
from app.routers.v1.auth import get_current_user
from app.models import User

router = APIRouter(prefix="/turon/timetable", tags=["Turon Timetable"])

WEEK_DAYS_UZ = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"]

# request #34/#37/#38 (2026-09-08): these endpoints used to read from the
# external turon DB (get_turon_db / app.external_models.turon), which
# stopped receiving new rows when the legacy turon system was decommissioned
# on 2026-08-31 — every lesson from 2026-09-01 onward was invisible here,
# and that DB's schema has no `subject_id` on a lesson at all. The real,
# currently-written data (with subject_id, current dates, and a proper
# per-student roster) lives in this app's own `turon_class_time_table_v2`
# and friends — see app/models.py's TuronClassTimeTable docstring. Switched
# to those; response shape is unchanged so existing callers don't break.


@router.get("/lessons")
def timetable_lessons(
    branch: int = Query(...),
    student: Optional[int] = Query(None),
    teacher: Optional[int] = Query(None),
    date_str: Optional[str] = Query(None, alias="date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Single date → show only that day; no date → show full current week
    if date_str:
        anchor = date.fromisoformat(date_str)
        week_dates = [anchor]
    else:
        today = date.today()
        start_of_week = today - timedelta(days=today.weekday())
        week_dates = [start_of_week + timedelta(days=i) for i in range(7)]

    # Pre-fetch rooms and hours for branch
    rooms = db.query(models.TuronRoomV2).filter(
        models.TuronRoomV2.branch_id == branch, models.TuronRoomV2.deleted == False  # noqa: E712
    ).order_by(models.TuronRoomV2.sort_order, models.TuronRoomV2.id).all()
    hours = db.query(models.TuronHourV2).filter(
        models.TuronHourV2.branch_id == branch, models.TuronHourV2.deleted == False  # noqa: E712
    ).order_by(models.TuronHourV2.sort_order).all()

    if not rooms or not hours:
        return {"time_tables": [], "hours_list": []}

    # Student filter: which specific lessons this student is actually
    # rostered on (per-lesson roster, not group-membership inference —
    # covers both group and flow lessons in one place).
    student_lesson_ids: Optional[set] = None
    if student:
        student_lesson_ids = {r[0] for r in db.execute(
            select(models.turon_class_time_table_student_v2_table.c.lesson_id).where(
                models.turon_class_time_table_student_v2_table.c.student_user_id == student
            )
        ).fetchall()}

    room_ids = [r.id for r in rooms]
    hour_ids = [h.id for h in hours]

    q = (
        db.query(models.TuronClassTimeTable)
        .filter(
            models.TuronClassTimeTable.branch_id == branch,
            models.TuronClassTimeTable.date.in_(week_dates),
            models.TuronClassTimeTable.room_id.in_(room_ids),
            models.TuronClassTimeTable.deleted == False,  # noqa: E712
        )
    )
    if student_lesson_ids is not None:
        q = q.filter(models.TuronClassTimeTable.id.in_(student_lesson_ids))
    if teacher:
        q = q.filter(models.TuronClassTimeTable.teacher_id == teacher)

    all_entries = q.all()

    # Build lookup maps
    entry_map: dict = {}
    for e in all_entries:
        entry_map.setdefault((e.date, e.room_id, e.hours_id), e)

    # Pre-fetch groups, flows, teachers, subjects
    group_ids = {e.group_id for e in all_entries if e.group_id}
    flow_ids = {e.flow_id for e in all_entries if e.flow_id}
    teacher_ids = {e.teacher_id for e in all_entries if e.teacher_id}
    subject_ids = {e.subject_id for e in all_entries if e.subject_id}

    groups = {g.id: g for g in db.query(models.TuronGroupV2).filter(models.TuronGroupV2.id.in_(group_ids)).all()} if group_ids else {}
    flows = {f.id: f for f in db.query(models.TuronFlowV2).filter(models.TuronFlowV2.id.in_(flow_ids)).all()} if flow_ids else {}
    teachers = {u.id: u for u in db.query(User).filter(User.id.in_(teacher_ids)).all()} if teacher_ids else {}
    subj_map = {s.id: s for s in db.query(models.TuronSubjectV2).filter(models.TuronSubjectV2.id.in_(subject_ids)).all()} if subject_ids else {}

    # Build response
    time_tables = []
    for day_date in week_dates:
        rooms_info = []
        for room in rooms:
            lessons = []
            for hour in hours:
                entry = entry_map.get((day_date, room.id, hour.id))
                if entry:
                    tch = teachers.get(entry.teacher_id)
                    subj = subj_map.get(entry.subject_id)
                    is_flow = entry.flow_id is not None and entry.group_id is None
                    if is_flow:
                        fl = flows.get(entry.flow_id)
                        group_data = {"id": fl.id, "name": fl.name} if fl else {}
                    else:
                        grp = groups.get(entry.group_id)
                        group_data = {"id": grp.id, "name": grp.name} if grp else {}
                    lessons.append({
                        "id": entry.id,
                        "status": True,
                        "is_flow": is_flow,
                        "hours": hour.id,
                        "room": room.id,
                        "group": group_data,
                        "teacher": {"id": tch.id, "name": f"{tch.name} {tch.surname}".strip()} if tch else {},
                        "subject": {"id": subj.id, "name": subj.name} if subj else {},
                    })
                else:
                    lessons.append({"status": False, "is_flow": False, "hours": hour.id, "room": room.id, "group": {}, "teacher": {}, "subject": {}})
            rooms_info.append({"id": room.id, "name": room.name, "order": room.sort_order, "lessons": lessons})

        time_tables.append({
            "date": day_date.isoformat(),
            "weekday": WEEK_DAYS_UZ[day_date.weekday()],
            "rooms": rooms_info,
        })

    hours_list = [
        {"id": h.id, "name": h.name, "start_time": str(h.start_time), "end_time": str(h.end_time)}
        for h in hours
    ]

    return {"time_tables": time_tables, "hours_list": hours_list}


@router.get("/group/{group_id}")
def group_timetable_list(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Timetable entries for a specific group (current week)."""
    today = date.today()
    start_of_week = today - timedelta(days=today.weekday())
    week_dates = [start_of_week + timedelta(days=i) for i in range(7)]

    entries = (
        db.query(models.TuronClassTimeTable)
        .filter(
            models.TuronClassTimeTable.group_id == group_id,
            models.TuronClassTimeTable.date.in_(week_dates),
            models.TuronClassTimeTable.deleted == False,  # noqa: E712
        )
        .order_by(models.TuronClassTimeTable.date, models.TuronClassTimeTable.hours_id)
        .all()
    )

    if not entries:
        return []

    teacher_ids = {e.teacher_id for e in entries if e.teacher_id}
    subject_ids = {e.subject_id for e in entries if e.subject_id}
    room_ids = {e.room_id for e in entries if e.room_id}
    hour_ids = {e.hours_id for e in entries if e.hours_id}

    teachers = {u.id: u for u in db.query(User).filter(User.id.in_(teacher_ids)).all()} if teacher_ids else {}
    subjects = {s.id: s for s in db.query(models.TuronSubjectV2).filter(models.TuronSubjectV2.id.in_(subject_ids)).all()} if subject_ids else {}
    rooms = {r.id: r for r in db.query(models.TuronRoomV2).filter(models.TuronRoomV2.id.in_(room_ids)).all()} if room_ids else {}
    hours_map = {h.id: h for h in db.query(models.TuronHourV2).filter(models.TuronHourV2.id.in_(hour_ids)).all()} if hour_ids else {}

    result = []
    for e in entries:
        tch = teachers.get(e.teacher_id)
        subj = subjects.get(e.subject_id)
        room = rooms.get(e.room_id)
        hour = hours_map.get(e.hours_id)
        result.append({
            "id": e.id,
            "date": e.date.isoformat() if e.date else None,
            "weekday": WEEK_DAYS_UZ[e.date.weekday()] if e.date else None,
            "hours": {
                "id": hour.id,
                "name": hour.name,
                "start_time": str(hour.start_time),
                "end_time": str(hour.end_time),
            } if hour else None,
            "room": {"id": room.id, "name": room.name} if room else None,
            "teacher": {
                "id": tch.id,
                "name": f"{tch.name} {tch.surname}".strip(),
            } if tch else None,
            "subject": {"id": subj.id, "name": subj.name} if subj else None,
        })

    return result


@router.get("/next-lesson")
def check_group_next_lesson(
    id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the next upcoming lesson for a group."""
    today = date.today()
    entry = (
        db.query(models.TuronClassTimeTable)
        .filter(
            models.TuronClassTimeTable.group_id == id,
            models.TuronClassTimeTable.date >= today,
            models.TuronClassTimeTable.deleted == False,  # noqa: E712
        )
        .order_by(models.TuronClassTimeTable.date, models.TuronClassTimeTable.hours_id)
        .first()
    )

    if not entry:
        return {"next_lesson": None}

    tch = db.query(User).filter(User.id == entry.teacher_id).first() if entry.teacher_id else None
    subj = db.query(models.TuronSubjectV2).filter(models.TuronSubjectV2.id == entry.subject_id).first() if entry.subject_id else None
    room = db.query(models.TuronRoomV2).filter(models.TuronRoomV2.id == entry.room_id).first() if entry.room_id else None
    hour = db.query(models.TuronHourV2).filter(models.TuronHourV2.id == entry.hours_id).first() if entry.hours_id else None

    return {
        "next_lesson": {
            "id": entry.id,
            "date": entry.date.isoformat() if entry.date else None,
            "weekday": WEEK_DAYS_UZ[entry.date.weekday()] if entry.date else None,
            "hours": {
                "id": hour.id,
                "name": hour.name,
                "start_time": str(hour.start_time),
                "end_time": str(hour.end_time),
            } if hour else None,
            "room": {"id": room.id, "name": room.name} if room else None,
            "teacher": {
                "id": tch.id,
                "name": f"{tch.name} {tch.surname}".strip(),
            } if tch else None,
            "subject": {"id": subj.id, "name": subj.name} if subj else None,
        }
    }


@router.get("/hours")
def hours_list(
    branch: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(20),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(models.TuronHourV2).filter(models.TuronHourV2.deleted == False)  # noqa: E712
    if branch:
        q = q.filter(models.TuronHourV2.branch_id == branch)
    if search:
        q = q.filter(models.TuronHourV2.name.ilike(f"%{search}%"))
    q = q.order_by(models.TuronHourV2.sort_order, models.TuronHourV2.id)
    total = q.count()
    rows = q.offset(offset).limit(limit).all()
    return {
        "count": total,
        "results": [
            {"id": h.id, "name": h.name, "start_time": str(h.start_time), "end_time": str(h.end_time), "order": h.sort_order}
            for h in rows
        ],
    }


@router.get("/week-days")
def week_days_list(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.query(models.TuronWeekDayV2).order_by(models.TuronWeekDayV2.sort_order, models.TuronWeekDayV2.id).all()
    return [{"id": r.id, "name_uz": r.name_uz, "name_en": r.name_en, "order": r.sort_order} for r in rows]
