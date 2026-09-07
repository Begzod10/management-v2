"""Tests for app.services.user_lookup — every login entry point's username/
email resolution. Request doc #24 §B1: three "duplicate username" reports
turned out to be different real accounts whose stored username carries
invisible whitespace, not one person twice — these check both halves of the
fix: the trimmed fallback finding a lone match, and it refusing to guess
among a colliding group.
"""

from __future__ import annotations

from app.models import User
from app.services.user_lookup import find_user_by_username_or_email


class FakeQuery:
    def __init__(self, db: "FakeDB", filters):
        self.db = db
        self.filters = filters

    def filter(self, *args, **kwargs):
        return FakeQuery(self.db, self.filters + args)

    def first(self):
        rows = self.db.exact_results if not self.db._trim_call else self.db.trim_results
        return rows[0] if rows else None

    def limit(self, n):
        self.db._trim_call = True
        return self

    def all(self):
        return self.db.trim_results[: getattr(self, "_limit", None)]


class FakeDB:
    """exact_results backs the first (untrimmed) query; trim_results backs
    the fallback. Real dispatch would key off the actual SQL, but this
    suite's job is the two-step *decision* logic in find_user_by_username_or_email,
    not SQLAlchemy's own query building — so a simple call-order flag is
    enough, matching this suite's existing FakeDB conventions elsewhere."""

    def __init__(self, exact_results=None, trim_results=None):
        self.exact_results = exact_results or []
        self.trim_results = trim_results or []
        self._trim_call = False

    def query(self, model):
        return FakeQuery(self, ())


def _user(id: int, username: str) -> User:
    return User(id=id, username=username, name="Test", surname="User", role="student")


def test_exact_match_returns_immediately_without_a_trim_fallback():
    db = FakeDB(exact_results=[_user(1, "Sanjar")])
    result = find_user_by_username_or_email(db, "Sanjar")
    assert result.id == 1


def test_no_exact_match_falls_back_to_a_unique_trimmed_match():
    # Stored username carries a trailing space the caller's own input doesn't.
    db = FakeDB(exact_results=[], trim_results=[_user(2, "Sanjar ")])
    result = find_user_by_username_or_email(db, "Sanjar")
    assert result.id == 2


def test_no_match_at_all_returns_none():
    db = FakeDB(exact_results=[], trim_results=[])
    assert find_user_by_username_or_email(db, "nobody") is None


def test_ambiguous_trimmed_match_refuses_to_guess():
    # Two different real accounts ("Sanjar Xolmurodov" / "Sanjar O'ktamov" in
    # doc #24) whose stored usernames both trim to "Sanjar" — picking either
    # one would silently log the caller into the wrong person's account, so
    # this must return None, same as no match at all.
    db = FakeDB(exact_results=[], trim_results=[_user(2, "Sanjar  "), _user(3, "Sanjar   ")])
    assert find_user_by_username_or_email(db, "Sanjar") is None
