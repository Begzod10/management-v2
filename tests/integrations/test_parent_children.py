"""Tests for _parent_children (student_platform.py) — the piece of request
#12 that fills in `user.parent.children[]` at login. Its whole job is to
keep gennis and turon children in their own id spaces while resolving both
to a display name, so that's what these check.
"""

from __future__ import annotations

from app.gennis_v2_models import ParentChildLink
from app.models import GennisStudent, User
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
        # ParentChildLink is queried whole; the two name lookups query a
        # tuple of columns — key on the first element either way so both
        # call shapes route to the same canned data.
        key = models[0]
        return FakeQuery(self, key)


def _row(**kwargs):
    return type("Row", (), kwargs)()


def test_no_links_returns_empty_list():
    db = FakeDB()
    assert _parent_children(db, parent_user_id=1) == []


def test_resolves_a_single_gennis_child():
    link = ParentChildLink(parent_user_id=1, source="gennis", child_ref_id=5011)
    db = FakeDB(all_results={
        ParentChildLink: [link],
        GennisStudent.gennis_id: [_row(gennis_id=5011, name="Ali", surname="Valiyev")],
    })

    result = _parent_children(db, parent_user_id=1)

    assert result == [{"id": 5011, "source": "gennis", "name": "Ali", "surname": "Valiyev"}]


def test_resolves_a_single_turon_child():
    link = ParentChildLink(parent_user_id=1, source="turon", child_ref_id=872)
    db = FakeDB(all_results={
        ParentChildLink: [link],
        User.id: [_row(id=872, name="Zilola", surname="Valiyeva")],
    })

    result = _parent_children(db, parent_user_id=1)

    assert result == [{"id": 872, "source": "turon", "name": "Zilola", "surname": "Valiyeva"}]


def test_resolves_multiple_children_across_both_sources():
    links = [
        ParentChildLink(parent_user_id=1, source="gennis", child_ref_id=5011),
        ParentChildLink(parent_user_id=1, source="turon", child_ref_id=872),
    ]
    db = FakeDB(all_results={
        ParentChildLink: links,
        GennisStudent.gennis_id: [_row(gennis_id=5011, name="Ali", surname="Valiyev")],
        User.id: [_row(id=872, name="Zilola", surname="Valiyeva")],
    })

    result = _parent_children(db, parent_user_id=1)

    assert len(result) == 2
    assert {"id": 5011, "source": "gennis", "name": "Ali", "surname": "Valiyev"} in result
    assert {"id": 872, "source": "turon", "name": "Zilola", "surname": "Valiyeva"} in result


def test_missing_name_lookup_falls_back_to_empty_strings_not_a_crash():
    # The link exists but the child row itself wasn't found (e.g. deleted
    # after linking) — better an empty name than a 500 for the whole login.
    link = ParentChildLink(parent_user_id=1, source="gennis", child_ref_id=9999)
    db = FakeDB(all_results={
        ParentChildLink: [link],
        GennisStudent.gennis_id: [],
    })

    result = _parent_children(db, parent_user_id=1)

    assert result == [{"id": 9999, "source": "gennis", "name": "", "surname": ""}]
