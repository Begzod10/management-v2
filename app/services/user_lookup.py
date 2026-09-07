"""Shared username/email lookup for every login entry point (web /auth/login,
mobile, the student_platform integration shim).

Kept out of any one router module for the same reason parent_portal.py and
student_directory.py are — a plain, FastAPI-free function, reused rather
than copy-pasted across the 3 places a login form resolves an identifier to
a `User` row.
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app import models


def find_user_by_username_or_email(
    db: Session,
    identifier: str,
    *extra_conditions,
) -> Optional["models.User"]:
    """Look up a User by username or email, tolerant of stray whitespace
    baked into a STORED username (request doc #24 §B1: 105 accounts today
    carry an accidental leading/trailing space from whatever created them —
    invisible in any UI — and an exact-match lookup silently fails to find
    them once the caller trims its own input before sending it, as every
    login form here now does after the recent whitespace-collapse fix).

    Tries an exact match first (unchanged behavior for the overwhelming
    majority of clean accounts) — `*extra_conditions` are ANDed onto it
    exactly as each caller already had them (e.g. `User.deleted == False`),
    so this doesn't change what a caller was already willing to match.

    Only falls back to a trimmed-username comparison if the exact match
    finds nothing, and only ACCEPTS that fallback if it resolves to exactly
    one row: 44 groups of stored usernames collide once trimmed (doc #24's
    own "duplicate username" examples turned out to be exactly this — two
    different real students, e.g. "Sanjar " vs "Sanjar  ", not one person
    twice). Picking "whichever row SQL happens to return first" among a
    colliding group would silently log someone into a different real
    person's account, so an ambiguous fallback is treated as no match at
    all, same as if neither string existed.
    """
    exact = (
        db.query(models.User)
        .filter(
            or_(models.User.username == identifier, models.User.email == identifier),
            *extra_conditions,
        )
        .first()
    )
    if exact is not None:
        return exact

    candidates = (
        db.query(models.User)
        .filter(func.trim(models.User.username) == identifier.strip(), *extra_conditions)
        .limit(2)
        .all()
    )
    return candidates[0] if len(candidates) == 1 else None
