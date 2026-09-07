"""Tests for app.services.student_directory — request #20's active-users
diff feed and teachers directory.

Same FakeDB/FakeQuery convention as test_parent_children.py: `.join()`,
`.outerjoin()`, `.distinct()` and `.filter()` are no-ops (the fake can't
verify a SQL WHERE/JOIN condition), `.all()`/`.first()` return canned rows
keyed off the query's first selected column/model. These tests exercise the
Python-level shaping each function does with what the DB hands back
(id/username selection, the null-username exclusion, the is_active
combination) — not the SQL filter conditions themselves, which is the same
limitation test_parent_children.py already accepted.
"""
from __future__ import annotations

from app import models
from app.services import student_directory


class FakeQuery:
    def __init__(self, db: "FakeDB", model):
        self.db = db
        self.model = model

    def join(self, *args, **kwargs):
        return self

    def outerjoin(self, *args, **kwargs):
        return self

    def filter(self, *args, **kwargs):
        return self

    def distinct(self):
        return self

    def all(self):
        return self.db.all_results.get(self.model, [])

    def first(self):
        rows = self.db.all_results.get(self.model, [])
        return rows[0] if rows else None


class FakeDB:
    def __init__(self, all_results=None):
        self.all_results = all_results or {}

    def query(self, *models_):
        # Same first-element dispatch every other fake in this suite uses —
        # a whole-model query and a tuple-of-columns query both key off the
        # first thing passed to .query().
        return FakeQuery(self, models_[0])


def _row(**kwargs):
    return type("Row", (), kwargs)()


# ── active_gennis_students ──────────────────────────────────────────────────

def test_active_gennis_students_returns_id_and_username():
    row = _row(gennis_id=5011, username="Anora2012")
    db = FakeDB(all_results={models.GennisStudent.gennis_id: [row]})

    result = student_directory.active_gennis_students(db)

    assert result == [{"id": 5011, "username": "Anora2012"}]


def test_active_gennis_students_empty_when_none_active():
    db = FakeDB()
    assert student_directory.active_gennis_students(db) == []


# ── active_gennis_teachers ──────────────────────────────────────────────────

def test_active_gennis_teachers_uses_gennis_user_link_id_not_teacher_gennis_id():
    row = _row(gennis_user_id=168, username="ali_teach")
    db = FakeDB(all_results={models.GennisUserLink.gennis_user_id: [row]})

    result = student_directory.active_gennis_teachers(db)

    assert result == [{"id": 168, "username": "ali_teach"}]


# ── active_turon_students / active_turon_teachers ───────────────────────────

def test_active_turon_students_uses_user_id_directly():
    row = _row(id=872, username="zilola_t")
    db = FakeDB(all_results={models.User.id: [row]})

    result = student_directory.active_turon_students(db)

    assert result == [{"id": 872, "username": "zilola_t"}]


def test_active_turon_teachers_uses_user_id_directly():
    row = _row(id=44, username="teach_turon")
    db = FakeDB(all_results={models.User.id: [row]})

    result = student_directory.active_turon_teachers(db)

    assert result == [{"id": 44, "username": "teach_turon"}]


# ── gennis_username_map ─────────────────────────────────────────────────────

def test_gennis_username_map_empty_ids_short_circuits_without_querying():
    db = FakeDB()  # no canned results at all — a query would KeyError-safe-default to []
    assert student_directory.gennis_username_map(db, []) == {}


def test_gennis_username_map_resolves_given_ids():
    row = _row(gennis_user_id=777, username="Anora2012")
    db = FakeDB(all_results={models.GennisUserLink.gennis_user_id: [row]})

    result = student_directory.gennis_username_map(db, [777])

    assert result == {777: "Anora2012"}


def test_gennis_username_map_missing_id_is_absent_not_empty_string():
    db = FakeDB()
    assert student_directory.gennis_username_map(db, [9999]) == {}


# ── gennis_teachers_directory ───────────────────────────────────────────────

def test_gennis_teachers_directory_active_when_all_three_flags_agree():
    row = _row(
        gennis_user_id=168, username="ali_teach", name="Ali", surname="Valiyev",
        is_active=True, deleted=False, synced_active=True,
    )
    db = FakeDB(all_results={models.GennisUserLink.gennis_user_id: [row]})

    result = student_directory.gennis_teachers_directory(db)

    assert result == [{
        "id": 168, "username": "ali_teach", "name": "Ali", "surname": "Valiyev",
        "is_active": True,
    }]


def test_gennis_teachers_directory_inactive_when_account_deleted_even_if_synced_active():
    row = _row(
        gennis_user_id=168, username="ali_teach", name="Ali", surname="Valiyev",
        is_active=True, deleted=True, synced_active=True,
    )
    db = FakeDB(all_results={models.GennisUserLink.gennis_user_id: [row]})

    result = student_directory.gennis_teachers_directory(db)

    assert result[0]["is_active"] is False


def test_gennis_teachers_directory_inactive_when_synced_inactive_even_if_account_active():
    row = _row(
        gennis_user_id=168, username="ali_teach", name="Ali", surname="Valiyev",
        is_active=True, deleted=False, synced_active=False,
    )
    db = FakeDB(all_results={models.GennisUserLink.gennis_user_id: [row]})

    result = student_directory.gennis_teachers_directory(db)

    assert result[0]["is_active"] is False


# ── turon_teachers_directory ────────────────────────────────────────────────

def test_turon_teachers_directory_active_when_all_flags_agree():
    row = _row(
        id=44, username="teach_turon", name="Bek", surname="Rustamov",
        is_active=True, deleted=False, profile_deleted=False,
    )
    db = FakeDB(all_results={models.User.id: [row]})

    result = student_directory.turon_teachers_directory(db)

    assert result == [{
        "id": 44, "username": "teach_turon", "name": "Bek", "surname": "Rustamov",
        "is_active": True,
    }]


def test_turon_teachers_directory_inactive_when_profile_removed():
    row = _row(
        id=44, username="teach_turon", name="Bek", surname="Rustamov",
        is_active=True, deleted=False, profile_deleted=True,
    )
    db = FakeDB(all_results={models.User.id: [row]})

    result = student_directory.turon_teachers_directory(db)

    assert result[0]["is_active"] is False
