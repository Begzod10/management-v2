"""Tests for the small pure helpers behind the #13/#14 attendance/payment
endpoints — the sign conversion and string parsing are exactly the kind of
one-line-looks-obviously-right code that's easy to get backwards, so they
get direct tests instead of only exercising them through the full endpoint.
"""

from __future__ import annotations

from app.routers.v1.integrations.student_family import (
    _gennis_debt_balance,
    _in_range,
    _parse_turon_balance,
    _parse_year_month,
    _summarize,
    _turon_debt_balance,
)


# ── _gennis_debt_balance ─────────────────────────────────────────────────────

def test_zero_gennis_balance_is_not_a_debt():
    result = _gennis_debt_balance(0)
    assert result == {"amount": 0, "is_debt": False, "debt_amount": 0}


def test_none_gennis_balance_is_treated_as_zero():
    result = _gennis_debt_balance(None)
    assert result == {"amount": 0, "is_debt": False, "debt_amount": 0}


def test_positive_gennis_balance_becomes_a_negative_signed_debt():
    # gennis_student_credit.balance is a plain (always >= 0) debt
    # magnitude, verified against production data — request #14 wants a
    # SIGNED amount (negative = debt), so the conversion happens once here.
    result = _gennis_debt_balance(450000)
    assert result == {"amount": -450000, "is_debt": True, "debt_amount": 450000}


# ── _turon_debt_balance ──────────────────────────────────────────────────────
# turon's CustomUser.balance is the OPPOSITE raw convention from gennis:
# already signed, negative = debt — verified against production by
# cross-referencing large-negative-balance accounts against their summed
# attendances_attendancepermonth.remaining_debt (consistently large and
# positive for the same accounts). Running a turon value through gennis's
# conversion would silently flip real debt into "no debt".

def test_zero_turon_balance_is_not_a_debt():
    result = _turon_debt_balance(0)
    assert result == {"amount": 0, "is_debt": False, "debt_amount": 0}


def test_none_turon_balance_is_treated_as_zero():
    result = _turon_debt_balance(None)
    assert result == {"amount": 0, "is_debt": False, "debt_amount": 0}


def test_negative_turon_balance_is_a_debt():
    result = _turon_debt_balance(-45000000)
    assert result == {"amount": -45000000, "is_debt": True, "debt_amount": 45000000}


def test_positive_turon_balance_is_not_a_debt():
    result = _turon_debt_balance(131233)
    assert result == {"amount": 131233, "is_debt": False, "debt_amount": 0}


# ── _parse_turon_balance ─────────────────────────────────────────────────────

def test_parses_plain_digit_string():
    assert _parse_turon_balance("450000") == 450000


def test_parses_space_separated_digit_string():
    assert _parse_turon_balance("450 000") == 450000


def test_parses_comma_separated_digit_string():
    assert _parse_turon_balance("450,000") == 450000


def test_none_input_returns_none():
    assert _parse_turon_balance(None) is None


def test_empty_string_returns_none():
    assert _parse_turon_balance("") is None


def test_garbage_string_returns_none_instead_of_raising():
    assert _parse_turon_balance("n/a") is None


# ── _summarize ───────────────────────────────────────────────────────────────

def test_summarize_empty_days_list():
    assert _summarize([]) == {"total": 0, "present": 0, "absent": 0, "percent": 0}


def test_summarize_counts_present_and_absent():
    days = [{"came": True}, {"came": True}, {"came": False}, {"came": True}]
    result = _summarize(days)
    assert result == {"total": 4, "present": 3, "absent": 1, "percent": 75}


# ── _in_range / _parse_year_month ────────────────────────────────────────────

def test_month_inside_range_is_included():
    assert _in_range(2026, 5, 2026, 1, 2026, 9) is True


def test_month_before_range_is_excluded():
    assert _in_range(2025, 12, 2026, 1, 2026, 9) is False


def test_month_after_range_is_excluded():
    assert _in_range(2026, 10, 2026, 1, 2026, 9) is False


def test_boundary_months_are_included():
    assert _in_range(2026, 1, 2026, 1, 2026, 9) is True
    assert _in_range(2026, 9, 2026, 1, 2026, 9) is True


def test_parse_year_month_valid():
    assert _parse_year_month("2026-09") == (2026, 9)


def test_parse_year_month_invalid_raises_422():
    from fastapi import HTTPException
    import pytest

    with pytest.raises(HTTPException) as exc_info:
        _parse_year_month("not-a-date")
    assert exc_info.value.status_code == 422


def test_parse_year_month_out_of_range_month_raises_422_not_500():
    # A numeric-but-nonsense month used to reach date(year, month, 1)
    # downstream and crash with an unhandled ValueError/500.
    from fastapi import HTTPException
    import pytest

    with pytest.raises(HTTPException) as exc_info:
        _parse_year_month("2024-13")
    assert exc_info.value.status_code == 422


def test_parse_year_month_absurd_year_raises_422_not_500():
    from fastapi import HTTPException
    import pytest

    with pytest.raises(HTTPException) as exc_info:
        _parse_year_month("99999999999-01")
    assert exc_info.value.status_code == 422
