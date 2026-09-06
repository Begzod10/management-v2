"""Tests for the role guard on create_parent_child_link — the
security-reviewer-flagged gap where linking an existing account to a child
never checked that account was actually role="parent" before this fix.
can_view_student (app/services/parent_portal.py) authorizes purely off a
ParentChildLink row existing, so this check is the only thing standing
between "staff links an account to a child" and "that account can now read
the child's attendance/payments through the family-only channel".
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.models import User
from app.routers.v1.management.parent_registrations import create_parent_child_link, create_parent_manually
from app.schemas import ParentChildLinkCreate, ParentManualCreate, ParentRegistrationChild


def make_user(id: int, role: str, deleted: bool = False) -> User:
    return User(id=id, name="Test", surname="User", role=role, deleted=deleted)


def test_rejects_linking_a_child_to_a_non_parent_account():
    # Arrange
    teacher = make_user(id=7, role="teacher")
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = teacher
    data = ParentChildLinkCreate(parent_user_id=7, source="turon", child_ref_id=5011)

    # Act / Assert
    with pytest.raises(HTTPException) as exc_info:
        create_parent_child_link(data, db, None)
    assert exc_info.value.status_code == 422
    assert "role" in exc_info.value.detail.lower()


def test_404s_when_the_parent_user_does_not_exist():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None
    data = ParentChildLinkCreate(parent_user_id=999, source="turon", child_ref_id=5011)

    with pytest.raises(HTTPException) as exc_info:
        create_parent_child_link(data, db, None)
    assert exc_info.value.status_code == 404


def test_accepts_linking_a_child_to_an_actual_parent_account():
    # Arrange — first db.query().filter().first() call resolves the parent
    # (role="parent", passes); second (inside _resolve_child, for the
    # turon child) resolves the child; third (the existing-link check)
    # finds no prior link.
    parent = make_user(id=1, role="parent")
    db = MagicMock()
    db.query.return_value.filter.return_value.first.side_effect = [parent, make_user(id=5011, role="student"), None]
    data = ParentChildLinkCreate(parent_user_id=1, source="turon", child_ref_id=5011)

    # Act
    result = create_parent_child_link(data, db, None)

    # Assert — reached db.add/commit without raising
    db.add.assert_called_once()
    db.commit.assert_called_once()
    assert result.parent_user_id == 1


# ── create_parent_manually — the turon-has-no-registration-form path ────────

def test_manual_create_rejects_a_taken_username():
    admin = make_user(id=1, role="owner")
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = make_user(id=2, role="parent")
    data = ParentManualCreate(name="Ona", surname="Ismi", username="taken_name", password="secret123")

    with pytest.raises(HTTPException) as exc_info:
        create_parent_manually(data, db, admin)
    assert exc_info.value.status_code == 409


def test_manual_create_rejects_duplicate_children_in_one_request():
    admin = make_user(id=1, role="owner")
    db = MagicMock()
    # 1st call: username free. 2nd: first occurrence resolves fine — the
    # duplicate check on the second occurrence must fire before any query
    # for it runs, so no 3rd value is needed.
    db.query.return_value.filter.return_value.first.side_effect = [
        None,
        make_user(id=5011, role="student"),
    ]
    data = ParentManualCreate(
        name="Ona", surname="Ismi", username="new_parent", password="secret123",
        children=[
            ParentRegistrationChild(source="turon", child_ref_id=5011),
            ParentRegistrationChild(source="turon", child_ref_id=5011),
        ],
    )

    with pytest.raises(HTTPException) as exc_info:
        create_parent_manually(data, db, admin)
    assert exc_info.value.status_code == 422


def test_manual_create_with_no_children_succeeds():
    # A turon-only parent onboarded with no children yet — staff link them
    # afterward via POST /parent-child-links, same as an approved
    # registration that had none either.
    admin = make_user(id=1, role="owner")
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None  # username free
    data = ParentManualCreate(name="Ona", surname="Ismi", username="new_parent", password="secret123")

    result = create_parent_manually(data, db, admin)

    db.add.assert_called_once()  # only the User — no ParentChildLink rows
    db.commit.assert_called_once()
    assert result["username"] == "new_parent"
    assert result["children"] == []


def test_manual_create_with_children_hashes_a_real_password_and_links_them():
    admin = make_user(id=1, role="owner")
    db = MagicMock()
    # 1st call: username free. 2nd: _resolve_child's turon existence check.
    db.query.return_value.filter.return_value.first.side_effect = [
        None,
        make_user(id=5011, role="student"),
    ]
    data = ParentManualCreate(
        name="Ona", surname="Ismi", username="new_parent", password="secret123",
        children=[ParentRegistrationChild(source="turon", child_ref_id=5011)],
    )

    result = create_parent_manually(data, db, admin)

    assert db.add.call_count == 2  # the User, then one ParentChildLink
    db.commit.assert_called_once()
    assert result["username"] == "new_parent"
    assert len(result["children"]) == 1
    assert result["children"][0].child_ref_id == 5011
