"""Tests for app.services.parent_portal — the access-control rule behind
the parent portal's attendance/payment endpoints (requests #13/#14): only
the student themself, or a parent linked to them, may read their record.
"""

from __future__ import annotations

from app.gennis_v2_models import ParentChildLink
from app.models import GennisStudent, GennisUserLink, User
from app.services.parent_portal import can_view_student, my_id_in_source


def make_user(id: int) -> User:
    return User(id=id, name="Test", surname="User", role="employee")


class FakeQuery:
    """Minimal stand-in for a SQLAlchemy Query — `.filter()` is a no-op
    (tests control results via FakeDB's canned per-model data), `.first()`
    returns whatever FakeDB was told to hand back for the model this query
    started from."""

    def __init__(self, db: "FakeDB", model):
        self.db = db
        self.model = model

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self.db.first_results.get(self.model, None)


class FakeDB:
    def __init__(self, first_results=None):
        self.first_results = first_results or {}

    def query(self, model, *rest):
        return FakeQuery(self, model)


# ── my_id_in_source ─────────────────────────────────────────────────────────

def test_turon_source_is_always_the_users_own_id():
    # Arrange
    user = make_user(id=42)
    db = FakeDB()

    # Act / Assert — turon has no separate id space, per
    # student_platform_login's own docstring.
    assert my_id_in_source(db, user, "turon") == 42


def test_gennis_source_returns_none_when_user_has_no_gennis_link():
    user = make_user(id=1)
    db = FakeDB(first_results={GennisUserLink: None})

    assert my_id_in_source(db, user, "gennis") is None


def test_gennis_source_returns_none_for_a_sentinel_gennis_user_id():
    # A non-positive gennis_user_id marks a v2-only account with no gennis
    # counterpart — same rule student_platform_login itself applies.
    user = make_user(id=1)
    link = GennisUserLink(management_user_id=1, gennis_user_id=0)
    db = FakeDB(first_results={GennisUserLink: link})

    assert my_id_in_source(db, user, "gennis") is None


def test_gennis_source_resolves_through_the_student_row(monkeypatch):
    # Arrange — gennis_user_link.gennis_user_id is the gennis USER id;
    # gennis_student.gennis_id (looked up via that) is the actual STUDENT
    # id student_platform hands out and expects back — the two must not be
    # conflated.
    user = make_user(id=1)
    link = GennisUserLink(management_user_id=1, gennis_user_id=777)

    class FakeGennisStudentQuery(FakeQuery):
        def first(self):
            return type("Row", (), {"gennis_id": 5011})()

    class DB(FakeDB):
        def query(self, model, *rest):
            if model is GennisStudent.gennis_id:
                return FakeGennisStudentQuery(self, model)
            return super().query(model, *rest)

    db = DB(first_results={GennisUserLink: link})
    assert my_id_in_source(db, user, "gennis") == 5011


def test_unknown_source_returns_none():
    user = make_user(id=1)
    assert my_id_in_source(FakeDB(), user, "carmen-sandiego") is None


# ── can_view_student ─────────────────────────────────────────────────────────

def test_student_can_view_their_own_turon_record():
    user = make_user(id=99)
    db = FakeDB(first_results={ParentChildLink.id: None})

    assert can_view_student(db, user, "turon", 99) is True


def test_unrelated_user_cannot_view_a_turon_students_record():
    user = make_user(id=1)
    db = FakeDB(first_results={ParentChildLink.id: None})

    assert can_view_student(db, user, "turon", 99) is False


def test_linked_parent_can_view_their_childs_record():
    parent = make_user(id=1)
    db = FakeDB(first_results={ParentChildLink.id: 123})  # a row id — link exists

    assert can_view_student(db, parent, "turon", 5011) is True


def test_parent_linked_to_a_different_child_cannot_view_this_one():
    parent = make_user(id=1)
    db = FakeDB(first_results={ParentChildLink.id: None})  # no matching link row

    assert can_view_student(db, parent, "gennis", 5011) is False
