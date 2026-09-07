"""Tests for _parent_children (student_platform.py) — the piece of request
#12 that fills in `user.parent.children[]` at login. Its whole job is to
keep gennis and turon children in their own id spaces while resolving both
to a display name, so that's what these check.

Reads gennis-v2's and turon-v2's own parent-child link tables
(GennisParentChildLink / TuronParentChildLink in app/models.py) directly —
not a management-v2-only table (that existed briefly, then was removed —
see both classes' docstrings for why).
"""

from __future__ import annotations

from app.models import GennisParentChildLink, GennisStudent, TuronParentChildLink, User
from app.routers.v1.integrations.student_platform import _parent_children


class FakeQuery:
    def __init__(self, db, model):
        self.db = db
        self.model = model

    def filter(self, *args, **kwargs):
        return self

    def all(self):
        return self.db.all_results.get(self.model, [])


class FakeDB:
    def __init__(self, all_results=None):
        self.all_results = all_results or {}

    def query(self, *models):
        # A whole-model query (GennisParentChildLink/TuronParentChildLink)
        # and a tuple-of-columns query (GennisStudent.id, .../User.id, ...)
        # both key on the first element — same dispatch every other test
        # file in this suite uses.
        key = models[0]
        return FakeQuery(self, key)


def _row(**kwargs):
    return type("Row", (), kwargs)()


def test_no_links_returns_empty_list():
    db = FakeDB()
    assert _parent_children(db, parent_user_id=1) == []


def test_resolves_a_single_gennis_child():
    # GennisParentChildLink.student_id is the INTERNAL gennis_student.id
    # (77 here) — resolved to the external gennis_id (5011) via GennisStudent.
    link = GennisParentChildLink(parent_user_id=1, student_id=77)
    db = FakeDB(all_results={
        GennisParentChildLink: [link],
        GennisStudent.id: [_row(id=77, gennis_id=5011, name="Ali", surname="Valiyev")],
    })

    result = _parent_children(db, parent_user_id=1)

    assert result == [{"id": 5011, "source": "gennis", "name": "Ali", "surname": "Valiyev"}]


def test_resolves_a_single_turon_child():
    link = TuronParentChildLink(parent_user_id=1, student_user_id=872)
    db = FakeDB(all_results={
        TuronParentChildLink: [link],
        User.id: [_row(id=872, name="Zilola", surname="Valiyeva")],
    })

    result = _parent_children(db, parent_user_id=1)

    assert result == [{"id": 872, "source": "turon", "name": "Zilola", "surname": "Valiyeva"}]


def test_resolves_multiple_children_across_both_sources():
    gennis_link = GennisParentChildLink(parent_user_id=1, student_id=77)
    turon_link = TuronParentChildLink(parent_user_id=1, student_user_id=872)
    db = FakeDB(all_results={
        GennisParentChildLink: [gennis_link],
        TuronParentChildLink: [turon_link],
        GennisStudent.id: [_row(id=77, gennis_id=5011, name="Ali", surname="Valiyev")],
        User.id: [_row(id=872, name="Zilola", surname="Valiyeva")],
    })

    result = _parent_children(db, parent_user_id=1)

    assert len(result) == 2
    assert {"id": 5011, "source": "gennis", "name": "Ali", "surname": "Valiyev"} in result
    assert {"id": 872, "source": "turon", "name": "Zilola", "surname": "Valiyeva"} in result


def test_missing_gennis_student_row_is_skipped_not_a_crash():
    # The link exists but the internal gennis_student row it points at
    # wasn't found (e.g. deleted after linking) — skip it rather than
    # surface an unresolvable id, or crash the whole login.
    link = GennisParentChildLink(parent_user_id=1, student_id=9999)
    db = FakeDB(all_results={
        GennisParentChildLink: [link],
        GennisStudent.id: [],
    })

    result = _parent_children(db, parent_user_id=1)

    assert result == []


def test_missing_turon_name_lookup_falls_back_to_empty_strings_not_a_crash():
    link = TuronParentChildLink(parent_user_id=1, student_user_id=9999)
    db = FakeDB(all_results={
        TuronParentChildLink: [link],
        User.id: [],
    })

    result = _parent_children(db, parent_user_id=1)

    assert result == [{"id": 9999, "source": "turon", "name": "", "surname": ""}]
