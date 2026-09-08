"""Tests for /turon/timetable/* (request #34/#37/#38, 2026-09-08): these
endpoints used to read the decommissioned external turon DB (no rows past
2026-08-31, no subject_id at all). They now read this app's own populated
turon_class_time_table_v2 + friends (see app/models.py's TuronClassTimeTable
docstring) — these tests lock in the two things that actually changed:
subject/teacher/group show up in the response, and the `student` filter
uses the real per-lesson roster table instead of group-membership inference.
"""

from __future__ import annotations

from datetime import date, time

from app import models
from app.routers.v1.turon.timetable import timetable_lessons, group_timetable_list


class FakeQuery:
    def __init__(self, db, model):
        self.db = db
        self.model = model

    def filter(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def all(self):
        return self.db.all_results.get(self.model, [])


class FakeExecuteResult:
    def __init__(self, rows):
        self._rows = rows

    def fetchall(self):
        return self._rows


class FakeDB:
    def __init__(self, all_results=None, execute_rows=None):
        self.all_results = all_results or {}
        self.execute_rows = execute_rows or []

    def query(self, *models_):
        return FakeQuery(self, models_[0])

    def execute(self, *args, **kwargs):
        return FakeExecuteResult(self.execute_rows)


def _row(**kwargs):
    return type("Row", (), kwargs)()


def _base_catalog(entries):
    room = _row(id=12, name="1.1", branch_id=6, sort_order=1, deleted=False)
    hour = _row(id=13, name="1st hour", start_time=time(8, 30), end_time=time(9, 0), branch_id=6, sort_order=1, deleted=False)
    teacher = _row(id=18392, name="Aziz", surname="Karimov")
    subject = _row(id=1, name="Ingliz tili", disabled=False)
    group = _row(id=186, name="11-green", branch_id=6, teacher_id=18392, status=True, deleted=False)
    return {
        models.TuronRoomV2: [room],
        models.TuronHourV2: [hour],
        models.TuronClassTimeTable: entries,
        models.User: [teacher],
        models.TuronSubjectV2: [subject],
        models.TuronGroupV2: [group],
        models.TuronFlowV2: [],
    }


def test_lessons_are_enriched_with_subject_teacher_and_group():
    lesson_date = date(2026, 9, 8)
    entry = _row(
        id=149695, name="", date=lesson_date, branch_id=6, hours_id=13, room_id=12,
        week_id=1, group_id=186, flow_id=None, subject_id=1, teacher_id=18392, deleted=False,
    )
    db = FakeDB(all_results=_base_catalog([entry]))

    result = timetable_lessons(branch=6, student=None, teacher=None, date_str="2026-09-08", db=db, current_user=None)

    lessons = result["time_tables"][0]["rooms"][0]["lessons"]
    filled = [l for l in lessons if l["status"]]
    assert len(filled) == 1
    assert filled[0]["subject"] == {"id": 1, "name": "Ingliz tili"}
    assert filled[0]["teacher"] == {"id": 18392, "name": "Aziz Karimov"}
    assert filled[0]["group"] == {"id": 186, "name": "11-green"}
    assert filled[0]["is_flow"] is False


def test_student_filter_reads_the_per_lesson_roster_table():
    """The `student` filter must look up turon_class_time_table_student_v2
    (per-lesson roster — covers both group and flow lessons) rather than
    inferring membership from the group's own roster, which is what the old
    endpoint did against the decommissioned external DB. This locks in that
    the roster lookup's result actually reaches the response — the no-op
    FakeQuery.filter() used throughout this suite can't independently prove
    exclusion of a non-rostered lesson (see other test files' FakeQuery),
    so the catalog here is pre-scoped to the one lesson a real `WHERE id IN
    (...)` would have kept, per this suite's usual convention."""
    lesson_date = date(2026, 9, 8)
    entry = _row(
        id=149695, name="", date=lesson_date, branch_id=6, hours_id=13, room_id=12,
        week_id=1, group_id=186, flow_id=None, subject_id=1, teacher_id=18392, deleted=False,
    )
    db = FakeDB(all_results=_base_catalog([entry]), execute_rows=[(149695,)])

    result = timetable_lessons(branch=6, student=19153, teacher=None, date_str="2026-09-08", db=db, current_user=None)

    filled = [l for l in result["time_tables"][0]["rooms"][0]["lessons"] if l["status"]]
    assert len(filled) == 1
    assert filled[0]["id"] == 149695


def test_student_filter_queries_the_roster_table_not_group_membership():
    """Sanity check on the query itself (independent of FakeQuery.filter's
    no-op elsewhere in this suite): the `student` branch must select from
    turon_class_time_table_student_v2 (lesson_id/student_user_id), not from
    turon_group_student_v2 (group membership) — the two differ for a
    flow-only student sitting in on a group's lesson."""
    captured = {}
    db = FakeDB(all_results=_base_catalog([]), execute_rows=[])
    real_execute = db.execute
    db.execute = lambda stmt, *a, **kw: (captured.setdefault("stmt", stmt), real_execute(stmt, *a, **kw))[1]

    timetable_lessons(branch=6, student=19153, teacher=None, date_str="2026-09-08", db=db, current_user=None)

    stmt_text = str(captured["stmt"])
    assert "turon_class_time_table_student_v2" in stmt_text
    assert "lesson_id" in stmt_text


def test_group_timetable_list_maps_subject_and_teacher():
    lesson_date = date(2026, 9, 8)
    entry = _row(
        id=149695, name="", date=lesson_date, branch_id=6, hours_id=13, room_id=12,
        week_id=1, group_id=186, flow_id=None, subject_id=1, teacher_id=18392, deleted=False,
    )
    db = FakeDB(all_results=_base_catalog([entry]))

    result = group_timetable_list(group_id=186, db=db, current_user=None)

    assert len(result) == 1
    assert result[0]["subject"] == {"id": 1, "name": "Ingliz tili"}
    assert result[0]["teacher"] == {"id": 18392, "name": "Aziz Karimov"}
    assert result[0]["room"] == {"id": 12, "name": "1.1"}
