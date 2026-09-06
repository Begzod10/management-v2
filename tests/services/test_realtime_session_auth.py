"""Tests for the voice-assistant auth/assignment gate in
app.services.realtime_session: authenticate_voice_ws_creator (the WS
impersonation fix) and check_voice_assignment (the shared role-eligibility
rule used by every voice-driven mission-creation path).

These are unit tests: SQLAlchemy query chains and cross-module role lookups
are mocked so the branch logic can be exercised without a live database.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from app.models import User
from app.services import realtime_session as rt


def make_user(id: int, role: str = "employee", is_active: bool = True,
              email: str = "user@example.com", username: str | None = None,
              name: str = "Test", surname: str = "User") -> User:
    """Build a transient (unpersisted) User with an empty extra_roles list —
    real ORM instances work fine for attribute access without a DB session as
    long as relationship attributes are set directly instead of lazy-loaded."""
    user = User(
        id=id, role=role, is_active=is_active, deleted=False,
        email=email, username=username, name=name, surname=surname,
    )
    user.extra_roles = []
    return user


# ── authenticate_voice_ws_creator ──────────────────────────────────────────

def test_authenticate_returns_user_when_token_matches_creator_id(monkeypatch):
    # Arrange
    creator = make_user(id=1, email="creator@gennis.uz")
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = creator
    monkeypatch.setattr(rt, "decode_access_token", lambda token: {"sub": "creator@gennis.uz"})

    # Act
    result = rt.authenticate_voice_ws_creator("valid-token", creator_id=1, db=db)

    # Assert
    assert result is creator


def test_authenticate_rejects_invalid_token(monkeypatch):
    # Arrange
    db = MagicMock()
    def _raise(token):
        raise ValueError("bad signature")
    monkeypatch.setattr(rt, "decode_access_token", _raise)

    # Act
    result = rt.authenticate_voice_ws_creator("garbage", creator_id=1, db=db)

    # Assert
    assert result is None
    db.query.assert_not_called()


def test_authenticate_rejects_token_with_no_subject(monkeypatch):
    # Arrange
    db = MagicMock()
    monkeypatch.setattr(rt, "decode_access_token", lambda token: {})

    # Act
    result = rt.authenticate_voice_ws_creator("token-no-sub", creator_id=1, db=db)

    # Assert
    assert result is None
    db.query.assert_not_called()


def test_authenticate_rejects_when_subject_not_found(monkeypatch):
    # Arrange
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None
    monkeypatch.setattr(rt, "decode_access_token", lambda token: {"sub": "ghost@gennis.uz"})

    # Act
    result = rt.authenticate_voice_ws_creator("valid-token", creator_id=1, db=db)

    # Assert
    assert result is None


def test_authenticate_rejects_impersonation_of_a_different_creator_id(monkeypatch):
    """The exact attack this fix closes: a valid token for user A used to open
    a voice session claiming to be user B (creator_id=B) must be refused, not
    silently accepted as B."""
    # Arrange
    real_user = make_user(id=1, email="real-user@gennis.uz")
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = real_user
    monkeypatch.setattr(rt, "decode_access_token", lambda token: {"sub": "real-user@gennis.uz"})

    # Act — token proves identity 1, but the query param claims to be user 999
    result = rt.authenticate_voice_ws_creator("valid-token-for-user-1", creator_id=999, db=db)

    # Assert
    assert result is None


def test_authenticate_rejects_deactivated_account(monkeypatch):
    # Arrange
    inactive = make_user(id=1, email="inactive@gennis.uz", is_active=False)
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = inactive
    monkeypatch.setattr(rt, "decode_access_token", lambda token: {"sub": "inactive@gennis.uz"})

    # Act
    result = rt.authenticate_voice_ws_creator("valid-token", creator_id=1, db=db)

    # Assert
    assert result is None


# ── check_voice_assignment ─────────────────────────────────────────────────

def test_check_voice_assignment_allows_self_assignment_for_any_role(monkeypatch):
    # Arrange
    user = make_user(id=1, role="employee")
    monkeypatch.setattr(rt, "voice_eligible_executors", lambda creator, db: [])

    # Act
    err = rt.check_voice_assignment(creator=user, executor=user, db=MagicMock())

    # Assert
    assert err is None


def test_check_voice_assignment_allows_owner_to_assign_to_anyone(monkeypatch):
    # Arrange
    owner = make_user(id=1, role="owner")
    someone_else = make_user(id=2, role="employee")
    # Owners must bypass eligibility lookups entirely — force a failure if
    # voice_eligible_executors were ever consulted for this branch.
    def _boom(creator, db):
        raise AssertionError("owner branch should not need voice_eligible_executors")
    monkeypatch.setattr(rt, "voice_eligible_executors", _boom)

    # Act
    err = rt.check_voice_assignment(creator=owner, executor=someone_else, db=MagicMock())

    # Assert
    assert err is None


def test_check_voice_assignment_allows_manager_assigning_within_scope(monkeypatch):
    # Arrange
    manager = make_user(id=1, role="manager")
    in_scope_executor = make_user(id=2, role="employee")
    monkeypatch.setattr(rt, "voice_eligible_executors", lambda creator, db: [in_scope_executor])

    # Act
    err = rt.check_voice_assignment(creator=manager, executor=in_scope_executor, db=MagicMock())

    # Assert
    assert err is None


def test_check_voice_assignment_blocks_manager_assigning_outside_scope(monkeypatch):
    # Arrange
    manager = make_user(id=1, role="manager")
    out_of_scope_executor = make_user(id=3, role="employee", name="Aziza", surname="Karimova")
    monkeypatch.setattr(rt, "voice_eligible_executors", lambda creator, db: [])  # nobody eligible

    # Act
    err = rt.check_voice_assignment(creator=manager, executor=out_of_scope_executor, db=MagicMock())

    # Assert
    assert err is not None
    assert "manager" in err
    assert "Aziza Karimova" in err


def test_check_voice_assignment_blocks_flat_role_assigning_to_anyone_but_self(monkeypatch):
    # Arrange
    flat_role_user = make_user(id=1, role="employee")
    other_employee = make_user(id=2, role="employee", name="Sardor", surname="Toshev")
    monkeypatch.setattr(rt, "voice_eligible_executors", lambda creator, db: [])

    # Act
    err = rt.check_voice_assignment(creator=flat_role_user, executor=other_employee, db=MagicMock())

    # Assert
    assert err is not None
    assert "Sardor Toshev" in err
