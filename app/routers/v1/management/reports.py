"""
Financial statements: Balance Sheet (this file) + Income Statement.

The Income Statement is NOT duplicated here — GET /statistics/overview
already computes exactly that (revenue - expenses = profit/loss, combined
across Gennis + Turon); the frontend renders it as a proper statement.
Recomputing it separately here would risk it silently drifting out of sync
with the number the dashboard already shows for the same period.

The Balance Sheet below is new: nothing in either system previously
aggregated assets/liabilities/net-worth. Scope, deliberately kept simple
(task #501 asked for this to exist, not for a certified accrual GL):

- "Live snapshot only" — always as-of right now, no historical date picker.
  Every line is either a genuinely current-state column (student debt,
  salary remaining, loan status) or a cumulative sum since inception
  (cash) — nothing here requires reconstructing a point-in-time balance
  from transaction history.
- Capital expenditure is fully expensed at purchase (matches both systems'
  existing Income Statement treatment) — it is NOT re-listed as a fixed
  asset here, which would double-count it against that expense.
- Equity is a derived PLUG (Assets total - Liabilities total), shown as
  "net_worth", not an independently rolled-forward owner-equity ledger
  (cumulative investments - dividends + retained earnings). The two would
  not reconcile exactly anyway: cash is cash-basis (every rupee that ever
  moved), while receivables/salaries-owed/loans are accrual-basis current
  balances that never flowed through a cash-basis P&L. Presenting them
  separately and letting Equity be "whatever balances the sheet" is the
  standard shortcut for an internal management snapshot without a full
  double-entry general ledger — it is honest about what it is, not a
  GAAP-audited statement.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    BranchLoan,
    GennisAssistentSalaryLive,
    GennisAttendanceHistoryStudentLive,
    GennisStaffSalaryLive,
    GennisTeacherSalaryLive,
    TuronAttendancePerMonthV2,
    TuronStaffSalaryV2,
    TuronTeacherSalaryV2,
)
from app.schemas_stats import BalanceSheetAssets, BalanceSheetLiabilities, BalanceSheetOut, BalanceSheetSection
from .statistics import gennis_summary, turon_summary

router = APIRouter(prefix="/reports", tags=["Reports"])


def _cash_position(db: Session, summary_fn, location_or_branch_id: Optional[int]) -> int:
    """All-time (no month/year bound) net cash flow via the same _summary
    machinery /statistics/overview already trusts for the Income Statement —
    unbounded by period, this is exactly "every rupee in minus every rupee
    out since inception", i.e. the cumulative cash position.

    from_date/to_date must be passed explicitly (not left to default) —
    gennis_summary/turon_summary are FastAPI endpoint functions whose
    from_date/to_date defaults are `Query(None)` sentinel objects, not
    plain None; that default only ever gets resolved to a real value by
    FastAPI's own dependency injection when called via HTTP. Called
    directly like this, an omitted from_date/to_date stays a truthy
    Query object and breaks the `to_date + timedelta(...)` arithmetic
    inside _month_year_filter_gennis_local/_month_year_filter_turon."""
    s = summary_fn(None, None, location_or_branch_id, db, from_date=None, to_date=None)
    return s["remaining"]


def _loans_by_direction(
    db: Session, source: str, direction: str, location_id: Optional[int], branch_id: Optional[int],
) -> int:
    q = db.query(func.coalesce(func.sum(BranchLoan.principal_amount), 0)).filter(
        BranchLoan.source == source,
        BranchLoan.direction == direction,
        BranchLoan.status == "active",
        BranchLoan.deleted == False,  # noqa: E712
    )
    if location_id is not None:
        q = q.filter(BranchLoan.location_id == location_id)
    if branch_id is not None:
        q = q.filter(BranchLoan.branch_id == branch_id)
    return q.scalar() or 0


def _gennis_section(db: Session, location_id: Optional[int]) -> BalanceSheetSection:
    cash = _cash_position(db, gennis_summary, location_id)
    # func.greatest(col, 0) floors every row at zero before summing — a
    # negative remaining_debt/remaining_salary means a credit/overpayment in
    # the OTHER party's favor, which isn't this line's asset/liability to
    # report (there's no "credits owed by us" line in either system today
    # to move it to instead, so it's excluded rather than misclassified).
    receivables_q = db.query(
        func.coalesce(func.sum(func.greatest(GennisAttendanceHistoryStudentLive.remaining_debt, 0)), 0)
    )
    if location_id is not None:
        receivables_q = receivables_q.filter(GennisAttendanceHistoryStudentLive.location_id == location_id)
    receivables = receivables_q.scalar() or 0
    loans_receivable = _loans_by_direction(db, "gennis", "out", location_id, None)

    teacher_q = db.query(func.coalesce(func.sum(func.greatest(GennisTeacherSalaryLive.remaining_salary, 0)), 0)).filter(
        GennisTeacherSalaryLive.is_deleted == False)  # noqa: E712
    assistent_q = db.query(func.coalesce(func.sum(func.greatest(GennisAssistentSalaryLive.remaining_salary, 0)), 0)).filter(
        GennisAssistentSalaryLive.is_deleted == False)  # noqa: E712
    staff_q = db.query(func.coalesce(func.sum(func.greatest(GennisStaffSalaryLive.remaining_salary, 0)), 0)).filter(
        GennisStaffSalaryLive.is_deleted == False)  # noqa: E712
    if location_id is not None:
        teacher_q = teacher_q.filter(GennisTeacherSalaryLive.location_id == location_id)
        assistent_q = assistent_q.filter(GennisAssistentSalaryLive.location_id == location_id)
        staff_q = staff_q.filter(GennisStaffSalaryLive.location_id == location_id)
    unpaid_salaries = (teacher_q.scalar() or 0) + (assistent_q.scalar() or 0) + (staff_q.scalar() or 0)
    loans_payable = _loans_by_direction(db, "gennis", "in", location_id, None)

    assets_total = cash + receivables + loans_receivable
    liabilities_total = unpaid_salaries + loans_payable
    return BalanceSheetSection(
        assets=BalanceSheetAssets(
            cash=cash, receivables=receivables, loans_receivable=loans_receivable, total=assets_total,
        ),
        liabilities=BalanceSheetLiabilities(
            unpaid_salaries=unpaid_salaries, loans_payable=loans_payable, total=liabilities_total,
        ),
        net_worth=assets_total - liabilities_total,
    )


def _turon_section(db: Session, branch_id: Optional[int]) -> BalanceSheetSection:
    cash = _cash_position(db, turon_summary, branch_id)
    receivables_q = db.query(
        func.coalesce(func.sum(func.greatest(TuronAttendancePerMonthV2.remaining_debt, 0)), 0)
    ).filter(TuronAttendancePerMonthV2.deleted == False)  # noqa: E712
    if branch_id is not None:
        receivables_q = receivables_q.filter(TuronAttendancePerMonthV2.branch_id == branch_id)
    receivables = receivables_q.scalar() or 0
    loans_receivable = _loans_by_direction(db, "turon", "out", None, branch_id)

    teacher_q = db.query(func.coalesce(func.sum(func.greatest(TuronTeacherSalaryV2.remaining_salary, 0)), 0)).filter(
        TuronTeacherSalaryV2.deleted == False)  # noqa: E712
    staff_q = db.query(func.coalesce(func.sum(func.greatest(TuronStaffSalaryV2.remaining_salary, 0)), 0)).filter(
        TuronStaffSalaryV2.deleted == False)  # noqa: E712
    if branch_id is not None:
        teacher_q = teacher_q.filter(TuronTeacherSalaryV2.branch_id == branch_id)
        staff_q = staff_q.filter(TuronStaffSalaryV2.branch_id == branch_id)
    unpaid_salaries = (teacher_q.scalar() or 0) + (staff_q.scalar() or 0)
    loans_payable = _loans_by_direction(db, "turon", "in", None, branch_id)

    assets_total = cash + receivables + loans_receivable
    liabilities_total = unpaid_salaries + loans_payable
    return BalanceSheetSection(
        assets=BalanceSheetAssets(
            cash=cash, receivables=receivables, loans_receivable=loans_receivable, total=assets_total,
        ),
        liabilities=BalanceSheetLiabilities(
            unpaid_salaries=unpaid_salaries, loans_payable=loans_payable, total=liabilities_total,
        ),
        net_worth=assets_total - liabilities_total,
    )


def _combine(g: BalanceSheetSection, t: BalanceSheetSection) -> BalanceSheetSection:
    assets_total = g.assets.total + t.assets.total
    liabilities_total = g.liabilities.total + t.liabilities.total
    return BalanceSheetSection(
        assets=BalanceSheetAssets(
            cash=g.assets.cash + t.assets.cash,
            receivables=g.assets.receivables + t.assets.receivables,
            loans_receivable=g.assets.loans_receivable + t.assets.loans_receivable,
            total=assets_total,
        ),
        liabilities=BalanceSheetLiabilities(
            unpaid_salaries=g.liabilities.unpaid_salaries + t.liabilities.unpaid_salaries,
            loans_payable=g.liabilities.loans_payable + t.liabilities.loans_payable,
            total=liabilities_total,
        ),
        net_worth=assets_total - liabilities_total,
    )


@router.get("/balance-sheet", response_model=BalanceSheetOut)
def balance_sheet(
    gennis_location_id: Optional[int] = Query(None),
    turon_branch_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Live net-worth snapshot combining Gennis + Turon, optionally scoped
    to one Gennis location and/or one Turon branch — same two filters
    /statistics/overview already takes for the Income Statement. See module
    docstring for exactly what each line means and its limitations."""
    g = _gennis_section(db, gennis_location_id)
    t = _turon_section(db, turon_branch_id)
    return BalanceSheetOut(
        as_of=datetime.now(timezone.utc).isoformat(),
        gennis=g,
        turon=t,
        combined=_combine(g, t),
    )
