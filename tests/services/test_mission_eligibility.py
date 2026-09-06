"""Tests for app.services.mission_eligibility._eligible_executors — the
canonical "who may this creator assign a mission to" rule, extracted from
missions.py so voice-assistant services can import it without a circular
import. These use a minimal fake query builder instead of a real database,
since the branches only need filter/first/all semantics, not real SQL.
"""

from __future__ import annotations

from sqlalchemy import literal, select

from app.models import User
from app.services.mission_eligibility import _eligible_executors


def make_user(id: int, role: str = "employee", is_active: bool = True,
              deleted: bool = False, name: str = "Test", surname: str = "User") -> User:
    user = User(id=id, role=role, is_active=is_active, deleted=deleted, name=name, surname=surname)
    user.extra_roles = []
    return user


class FakeQuery:
    """Stands in for a SQLAlchemy Query. `.filter(...)` is a no-op that
    returns self (the tests control results via the FakeDB's canned data
    instead of interpreting real filter expressions); `.all()`/`.first()`/
    `.subquery()` return whatever the FakeDB was told to hand back for the
    model this query started from."""

    def __init__(self, db: "FakeDB", model):
        self.db = db
        self.model = model

    def filter(self, *args, **kwargs):
        return self

    def all(self):
        return self.db.all_results.get(self.model, [])

    def first(self):
        return self.db.first_results.get(self.model, None)

    def subquery(self):
        # `.in_(subquery)` requires a real SQLAlchemy selectable, not our fake
        # — its actual contents don't matter since we never execute SQL here,
        # only the canned .all()/.first() results the branch logic reads.
        return select(literal(1)).subquery()


class FakeDB:
    def __init__(self, all_results=None, first_results=None):
        self.all_results = all_results or {}
        self.first_results = first_results or {}

    def query(self, model, *rest):
        return FakeQuery(self, model)


def test_owner_gets_all_active_users_not_in_a_project_or_section():
    # Arrange
    owner = make_user(id=1, role="owner")
    candidate = make_user(id=2, role="employee")
    db = FakeDB(all_results={User: [candidate]})

    # Act
    result = _eligible_executors(owner, "line_management", None, None, db)

    # Assert
    assert result == [candidate]


def test_service_request_channel_returns_every_active_user_regardless_of_role():
    # Arrange
    flat_role_user = make_user(id=1, role="employee")
    everyone = [make_user(id=2), make_user(id=3)]
    db = FakeDB(all_results={User: everyone})

    # Act
    result = _eligible_executors(flat_role_user, "service_request", None, None, db)

    # Assert
    assert result == everyone


def test_manager_with_own_project_gets_project_members_plus_self():
    # Arrange
    from app.models import Project
    manager = make_user(id=1, role="manager")
    member = make_user(id=2, role="employee")
    db = FakeDB(
        all_results={User: [member]},
        first_results={Project: object()},  # project found and owned by this manager
    )

    # Act
    result = _eligible_executors(manager, "line_management", project_id=5, section_id=None, db=db)

    # Assert — member plus the manager themself (self-assign is always allowed)
    assert member in result
    assert manager in result
    assert len(result) == 2


def test_manager_with_a_project_they_do_not_own_gets_self_only():
    # Arrange
    from app.models import Project
    manager = make_user(id=1, role="manager")
    other_managers_member = make_user(id=2, role="employee")
    db = FakeDB(
        all_results={User: [other_managers_member]},
        first_results={Project: None},  # no project matched creator_id=manager.id
    )

    # Act
    result = _eligible_executors(manager, "line_management", project_id=99, section_id=None, db=db)

    # Assert
    assert result == [manager]


def test_manager_without_project_or_section_gets_self_only():
    # Arrange
    manager = make_user(id=1, role="manager")
    db = FakeDB()

    # Act
    result = _eligible_executors(manager, "line_management", None, None, db=db)

    # Assert
    assert result == [manager]


def test_flat_role_with_no_configured_targets_gets_self_only():
    # Arrange — "employee" role has service_request/self-only semantics per
    # ROLE_CAN_ASSIGN, but outside the service_request channel it's empty.
    employee = make_user(id=1, role="employee")
    db = FakeDB()

    # Act
    result = _eligible_executors(employee, "line_management", None, None, db=db)

    # Assert
    assert result == [employee]


def test_flat_role_with_configured_targets_gets_matching_roles_plus_self():
    # Arrange — "director" is only reachable via a role not in ROLE_CAN_ASSIGN's
    # keys directly, so use one that is: "dept_head" → {"team_lead", "specialist"}.
    dept_head = make_user(id=1, role="dept_head")
    specialist = make_user(id=2, role="specialist")
    db = FakeDB(all_results={User: [specialist]})

    # Act
    result = _eligible_executors(dept_head, "line_management", None, None, db=db)

    # Assert
    assert specialist in result
    assert dept_head in result
    assert len(result) == 2
