"""Tests for /turon/group/classes, /group/classes2, /flow/flow-list
(request #43 §3/§4, 2026-09-12): these read the decommissioned external
turon DB (get_turon_db) — same bug class as /turon/timetable/* (docs
#34/#37/#38) — while the real, currently-updating roster lives in this
app's own turon_group_v2/turon_flow_v2 and friends. Locks in that they now
read from those v2 models and map ids/fields correctly.
"""

from __future__ import annotations

from app import models
from app.routers.v1.turon.classes import group_classes, flow_list


class FakeQuery:
    def __init__(self, db, model):
        self.db = db
        self.model = model

    def filter(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def offset(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def count(self):
        return len(self.db.all_results.get(self.model, []))

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


def test_group_classes_reads_v2_tables_and_maps_teacher_and_counts():
    group = _row(id=12285, name="E26A2-02", class_number_id=1, color_id=1, teacher_id=16578, status=True, price=162000, deleted=False)
    cn = _row(id=1, number=26)
    color = _row(id=1, name="Green")
    teacher = _row(id=16578, name="Hamro", surname="Xaytivayev")

    db = FakeDB(
        all_results={
            models.TuronGroupV2: [group],
            models.TuronClassNumberV2: [cn],
            models.TuronClassColorV2: [color],
            models.User: [teacher],
        },
        execute_rows=[(12285, 9)],
    )

    result = group_classes(
        branch=None, teacher=None, deleted=False, search=None, limit=20, offset=0,
        db=db, current_user=None,
    )

    assert result["count"] == 1
    row = result["results"][0]
    assert row["id"] == 12285
    assert row["teacher"] == "Hamro Xaytivayev"
    assert row["class_number"] == 26
    assert row["color"] == "Green"
    assert row["count"] == 9


def test_group_classes_group_with_no_teacher_yet():
    group = _row(id=999, name="New Group", class_number_id=None, color_id=None, teacher_id=None, status=True, price=100000, deleted=False)
    db = FakeDB(all_results={models.TuronGroupV2: [group]}, execute_rows=[])

    result = group_classes(
        branch=None, teacher=None, deleted=False, search=None, limit=20, offset=0,
        db=db, current_user=None,
    )

    row = result["results"][0]
    assert row["teacher"] is None
    assert row["count"] == 0


def test_flow_list_reads_v2_tables_and_includes_raw_teacher_id():
    flow = _row(
        id=140, name="PM English", activity=True, classes=None,
        subject_id=1, teacher_id=16578, level_id=None, branch_id=6,
    )
    subject = _row(id=1, name="Ingliz tili")
    teacher = _row(id=16578, name="Hamro", surname="Xaytivayev")

    db = FakeDB(
        all_results={
            models.TuronFlowV2: [flow],
            models.TuronSubjectV2: [subject],
            models.User: [teacher],
            models.TuronSubjectLevelV2: [],
            models.TuronBranchV2: [],
        },
        execute_rows=[(140, 12)],
    )

    result = flow_list(branch=None, limit=50, offset=0, db=db, current_user=None)

    row = result["results"][0]
    assert row["id"] == 140
    # request #43 §4's own fallback ask: expose the raw id, not just names
    assert row["teacher_id"] == 16578
    assert row["teacher_name"] == "Hamro"
    assert row["teacher_surname"] == "Xaytivayev"
    assert row["subject_name"] == "Ingliz tili"
    assert row["student_count"] == 12


def test_flow_list_flow_with_no_teacher_yet():
    flow = _row(id=200, name="New Flow", activity=False, classes=None, subject_id=None, teacher_id=None, level_id=None, branch_id=6)
    db = FakeDB(
        all_results={
            models.TuronFlowV2: [flow],
            models.TuronSubjectV2: [],
            models.User: [],
            models.TuronSubjectLevelV2: [],
            models.TuronBranchV2: [],
        },
        execute_rows=[],
    )

    result = flow_list(branch=None, limit=50, offset=0, db=db, current_user=None)

    row = result["results"][0]
    assert row["teacher_id"] is None
    assert row["teacher_name"] is None
