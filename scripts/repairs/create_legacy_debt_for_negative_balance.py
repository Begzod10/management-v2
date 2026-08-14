"""The negative half of set_credit_to_true_balance.py: write the deficit into an
actual debt row instead of a negative credit value.

WHY NOT NEGATIVE CREDIT
set_credit_to_true_balance.py found 1,291 students whose true balance (old
gennis's own lifetime formula, computed from v2's current data) is negative, and
declined to write that as negative credit: apply_payment replaces the credit row
outright on every payment (services/payments.py: _upsert_credit(..., new_credit))
and treats a negative starting value as 0 (prior_credit_used = max(0, prior_credit)).
A negative credit would display correctly today and silently revert the moment
that student pays anything.

THE MECHANISM
For each of the 1,291, insert one gennis_attendance_history_student row:

    total_debt = payment = remaining_debt = D   (D = the deficit, positive)
    payment = 0, status = False, total_discount = 0
    group_id = NULL, subject_id = NULL
    group_name = 'Eski balans'  -- so it reads as a labeled legacy adjustment on
                                    Qarzlar, not a mystery unattributed group
    calendar_year/month = the earliest month the student already has a row for,
                           or their registration month (gennis_student.created_at)
                           if they have no rows at all
    location_id = derived the same way, falling back to old gennis's
                  users.location_id (translated) when no row exists to read it
                  from -- verified this resolves for all of them

and set gennis_student_credit.balance = 0 for the student (superseding whatever
was there -- these are debtors, no surplus is left once the deficit is written).

This makes the row a completely ordinary unpaid month as far as apply_payment is
concerned: it is picked up by the normal oldest-unpaid-first loop
(student_id, location_id, status=False, remaining_debt>0, ordered by
calendar_year, calendar_month) exactly like a real group charge, and a payment
reduces it the normal way. Nothing about apply_payment needs to change.

WHY 56% OF THIS SUBSET HAS NO GROUP TO ANCHOR ON
730 of the 1,291 have ZERO rows in gennis_attendance_history_student at all --
their entire deficit comes from old gennis's old_money/old_debt/book_payment
fields, none of which are tied to a specific class. This is not a data gap in v2;
it mirrors old gennis's own schema, where those three fields were never tied to a
group either. 'Eski balans' is the honest label for exactly that.

WHAT THIS DOES NOT DO
  - Does not touch any EXISTING debt row.
  - Does not change what any group actually charges going forward.
  - Does not invent an enrollment -- group_id stays NULL rather than guessing
    which class the money belongs to.

APPLIED 2026-08-14: 1,291 legacy debt rows written, 108,129,663 total, credit
zeroed for each. Verified afterwards: v2's LIVE displayed balance
(credit - positive remaining_debt) now matches old gennis's own stored
balance for 14,252/15,075 (94.5%) August-clean students -- up from
12,742/15,075 (84.5%) before any of today's balance work, and identical to
the formula's own accuracy ceiling measured before this row was ever
written. The storage mechanism added zero error.

Usage:
    python create_legacy_debt_for_negative_balance.py            dry run (default)
    python create_legacy_debt_for_negative_balance.py --apply     write
"""
import asyncio
import sys
from sqlalchemy import text
from app.db.session import _GennisSession, AsyncSessionLocal

APPLY = "--apply" in sys.argv
MARKER = "Eski balans"


async def main():
    async with _GennisSession() as old, AsyncSessionLocal() as new:
        old_legacy = {int(r.sid): (int(r.old_money or 0), int(r.old_debt or 0))
                      for r in (await old.execute(text(
                        "SELECT id AS sid, old_money, old_debt FROM students"
                      ))).fetchall()}
        old_balance = dict((await old.execute(text(
            "SELECT s.id, u.balance FROM students s JOIN users u ON u.id = s.user_id"
        ))).fetchall())
        old_location = dict((await old.execute(text(
            "SELECT s.id, u.location_id FROM students s JOIN users u ON u.id = s.user_id"
        ))).fetchall())

        students = (await new.execute(text(
            "SELECT id, gennis_id, name, surname, created_at FROM gennis_student "
            "WHERE gennis_id < 900000000"))).fetchall()

        all_payment = dict((await new.execute(text(
            "SELECT student_id, sum(payment_sum) FROM gennis_student_payment "
            "WHERE NOT deleted GROUP BY 1"))).fetchall())
        all_debt = dict((await new.execute(text(
            "SELECT student_id, sum(total_debt) FROM gennis_attendance_history_student "
            "GROUP BY 1"))).fetchall())
        bk = dict((await new.execute(text(
            "SELECT student_id, sum(payment_sum) FROM gennis_student_book_payment "
            "WHERE NOT deleted GROUP BY 1"))).fetchall())
        positive_debt = dict((await new.execute(text(
            "SELECT student_id, sum(remaining_debt) FROM gennis_attendance_history_student "
            "WHERE remaining_debt > 0 GROUP BY 1"))).fetchall())
        cur_credit = dict((await new.execute(text(
            "SELECT student_id, balance FROM gennis_student_credit"))).fetchall())
        # earliest (year, month) computed in Python rather than SQL: a naive
        # separate MIN(year)/MIN(month) can pick a month from the wrong year
        hist_rows = (await new.execute(text(
            "SELECT student_id, calendar_year, calendar_month, location_id "
            "FROM gennis_attendance_history_student"))).fetchall()
        earliest_ym, hist_location = {}, {}
        for r in hist_rows:
            key = (r.calendar_year, r.calendar_month)
            if r.student_id not in earliest_ym or key < earliest_ym[r.student_id]:
                earliest_ym[r.student_id] = key
            hist_location[r.student_id] = r.location_id  # any row's location is fine

        already_marked = set(r[0] for r in (await new.execute(text(
            "SELECT DISTINCT student_id FROM gennis_attendance_history_student "
            "WHERE group_name = :m"), {"m": MARKER})).fetchall())

        gid_loc = dict((await new.execute(text(
            "SELECT gennis_id, id FROM gennis_location WHERE gennis_id IS NOT NULL"
        ))).fetchall())

        plan, no_location = [], []
        for s in students:
            om, od = old_legacy.get(s.gennis_id, (0, 0))
            ap = int(all_payment.get(s.id, 0) or 0)
            ad = int(all_debt.get(s.id, 0) or 0)
            b = int(bk.get(s.id, 0) or 0)
            true_balance = (ap + om) - (abs(ad) + abs(od) + abs(b))
            pd = int(positive_debt.get(s.id, 0) or 0)
            new_credit = true_balance + pd
            cur = int(cur_credit.get(s.id, 0) or 0)

            if new_credit >= 0 or new_credit == cur:
                continue
            if s.id in already_marked:
                continue

            deficit = -new_credit

            if s.id in earliest_ym:
                yr, mo = earliest_ym[s.id]
                loc = hist_location.get(s.id)
            else:
                yr, mo = (s.created_at.year, s.created_at.month) if s.created_at else (2024, 1)
                old_loc = old_location.get(s.gennis_id)
                loc = gid_loc.get(old_loc) if old_loc is not None else None

            if loc is None:
                no_location.append(s)
                continue

            plan.append({
                "student_id": s.id, "name": f"{s.name or ''} {s.surname or ''}".strip(),
                "deficit": deficit, "year": yr, "month": mo, "location_id": loc,
                "had_history": s.id in earliest_ym,
                "old_gennis_balance": old_balance.get(s.gennis_id),
            })

        print(f"negative-subset students to give a legacy debt row: {len(plan):,}")
        print(f"  already marked (idempotent skip)                : "
              f"{len(already_marked):,}")
        print(f"  could not resolve a location — SKIPPED, reported : "
              f"{len(no_location):,}")
        for s in no_location[:10]:
            print(f"    student {s.id} ({s.name} {s.surname})")

        had_hist = sum(1 for p in plan if p["had_history"])
        print(f"\n  anchored on their earliest real month : {had_hist:,}")
        print(f"  anchored on registration month (no history at all) : "
              f"{len(plan) - had_hist:,}")

        total = sum(p["deficit"] for p in plan)
        print(f"\ntotal new debt written: {total:,}")

        plan.sort(key=lambda p: -p["deficit"])
        print(f"\nlargest 15:")
        print(f"{'student':<28}{'deficit':>12}{'anchor month':>14}{'old gennis bal':>16}")
        for p in plan[:15]:
            og = p["old_gennis_balance"]
            print(f"{p['name'][:27]:<28}{p['deficit']:>12,}"
                  f"{p['month']:>3}.{p['year']:<10}"
                  f"{'—' if og is None else f'{int(og):,}':>16}")

        if not APPLY:
            print("\n(dry run — pass --apply to write)")
            return

        print("\n>>> APPLYING <<<")
        for p in plan:
            await new.execute(text("""
                INSERT INTO gennis_attendance_history_student
                    (student_id, group_id, group_name, subject_id,
                     total_debt, payment, remaining_debt, total_discount,
                     location_id, calendar_month, calendar_year, status)
                VALUES (:sid, NULL, :gname, NULL,
                        :d, 0, :d, 0,
                        :loc, :mo, :yr, false)
            """), {"sid": p["student_id"], "gname": MARKER, "d": p["deficit"],
                   "loc": p["location_id"], "mo": p["month"], "yr": p["year"]})
            await new.execute(text("""
                INSERT INTO gennis_student_credit (student_id, location_id, balance)
                VALUES (:s, :l, 0)
                ON CONFLICT (student_id) DO UPDATE SET balance = 0
            """), {"s": p["student_id"], "l": p["location_id"]})
        await new.commit()
        print(f"  {len(plan):,} legacy debt rows written, credit zeroed for each")

asyncio.run(main())
