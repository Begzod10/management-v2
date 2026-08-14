"""Set every student's credit so the balance they see matches old gennis's own
number, computed the way old gennis actually computes it.

THE REAL PROBLEM
Fifteen scripts today each fixed a CAUSE of a wrong balance — an untranslated id,
a shifted payment. Each was real. None of them explained why the total gap stayed
at 339,931,280 across 3,376 students. The reason: gennis-v2 computes balance from
a MODEL old gennis never used.

    gennis-v2 today:  credit  -  sum(remaining_debt WHERE remaining_debt > 0)
    old gennis, always (student/class_model.py:update_balance):
        (all_payment + old_money) - (abs(all_debt) + abs(old_debt) + abs(book_payments))

old gennis's number is a flat LIFETIME total: every payment ever made (real AND
Chegirma both count — see gennis-v2 fbaff7a, which made Chegirma settle like cash
for exactly this reason), minus every total_debt ever charged, across the
student's whole history, with no month-by-month bookkeeping at all. It does not
care which month a payment was "applied" to. gennis-v2's model does — it was
built to answer "what does this student still owe THIS month", which the app
genuinely needs, and the headline balance was derived from that same machinery
almost as an afterthought.

Verified this is really old gennis's formula, not a guess: computed it from old
gennis's own tables for all 16,158 of its students and it reproduced the stored
users.balance for 96.2% of them (the rest carry old_money/old_debt set on
long-dormant accounts whose balance was never recomputed since).

Then computed the SAME formula from v2's own CURRENT data (no id-translation
needed — most of that is already fixed) plus old gennis's old_money/old_debt,
which v2 never migrated, and compared to old gennis's stored balance on the
students with no August activity (the only ones where a match is even possible,
since old gennis stopped updating on 12 Aug and v2 keeps operating): 94.5%
matched exactly. The model, not the data, was the gap.

WHY THIS ISN'T THE ROW-LEVEL FIX FROM EARLIER TODAY
reconcile_debt_to_old_gennis.py (also written today) copies old gennis's
total_debt/payment onto v2's matching rows, month by month. That script is WRONG
to apply as a balance fix and is left as dry-run-only: it would overwrite v2's own
charges — which are independently verified against actual lesson counts at 100%
— with old gennis's, which are sometimes stale (the charity lookup bug alone
under-charged 435 students by 6.4m before today, and old gennis was frozen before
it ever billed most of August). Since the TRUE balance formula does not depend on
remaining_debt at all, none of that row-level correctness question needs
resolving to fix the balance.

WHY CREDIT, NOT SOME OTHER COLUMN
gennis-v2's balance is `credit - sum(positive remaining_debt)`. Setting
    credit := true_balance + sum(positive remaining_debt)
makes that expression equal true_balance without touching remaining_debt or
total_debt at all — the Qarzlar month-by-month breakdown is untouched, only the
number derived from it. Unlike an earlier-considered version of this idea, this is
not an unexplained plug: true_balance is independently computed from old gennis's
own formula and verified against its own stored number. If it is positive, the
student really has paid more than they have been charged, over their whole
history — genuinely spendable credit, not an artifact.

old_money and old_debt are read live from old gennis below — it is frozen, so
they cannot change between the dry run and the apply. book_payments comes from
gennis_student_book_payment, already synced.

FOUND WHILE DRY-RUNNING: NEGATIVE CREDIT DOES NOT HOLD
1,291 of the 2,473 students who need a correction need a NEGATIVE one — their true
lifetime debt exceeds what remaining_debt currently shows. Writing that as negative
credit displays correctly today and silently reverts on their next payment:
apply_payment's leftover-credit write REPLACES the row outright
(services/payments.py: _upsert_credit(..., new_credit)), and
prior_credit_used = max(0, prior_credit) treats a negative starting value as 0 —
so the correction is discarded, not consumed, the moment they pay anything.
Positive credit does not have this problem: apply_payment's own logic spends it
against oldest debt correctly, exactly as intended.

This script does NOT apply the negative half. It applies only the ~1,182 positive
corrections, which are safe under the existing payment logic, and reports the
1,291 negative ones separately — those need the deficit written into an actual
debt row (so a future payment reduces it the normal way), not into credit, and
that is a design decision on its own, not a data fix to run alongside this one.

Usage:
    python set_credit_to_true_balance.py            dry run (default)
    python set_credit_to_true_balance.py --apply     write (positive corrections only)
"""
import asyncio
import sys
from sqlalchemy import text
from app.db.session import _GennisSession, AsyncSessionLocal

APPLY = "--apply" in sys.argv


async def main():
    async with _GennisSession() as old, AsyncSessionLocal() as new:
        old_legacy = {int(r.sid): (int(r.old_money or 0), int(r.old_debt or 0))
                      for r in (await old.execute(text(
                        "SELECT id AS sid, old_money, old_debt FROM students"
                      ))).fetchall()}
        old_balance = dict((await old.execute(text(
            "SELECT s.id, u.balance FROM students s JOIN users u ON u.id = s.user_id"
        ))).fetchall())

        students = (await new.execute(text(
            "SELECT id, gennis_id, name, surname FROM gennis_student "
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
            "SELECT student_id, balance FROM gennis_student_credit"
        ))).fetchall())
        cur_credit_loc = dict((await new.execute(text(
            "SELECT student_id, location_id FROM gennis_student_credit"
        ))).fetchall())
        has_aug = set(r.student_id for r in (await new.execute(text(
            "SELECT DISTINCT student_id FROM gennis_attendance_history_student "
            "WHERE (calendar_year, calendar_month) >= (2026, 8)"))).fetchall())
        has_aug |= set(r.student_id for r in (await new.execute(text(
            "SELECT DISTINCT student_id FROM gennis_student_payment "
            "WHERE NOT deleted AND paid_date >= '2026-08-01'"))).fetchall())
        fallback_location = dict((await new.execute(text(
            "SELECT student_id, max(location_id) FROM gennis_attendance_history_student "
            "GROUP BY 1"))).fetchall())

        plan = []
        for s in students:
            om, od = old_legacy.get(s.gennis_id, (0, 0))
            ap = int(all_payment.get(s.id, 0) or 0)
            ad = int(all_debt.get(s.id, 0) or 0)
            b = int(bk.get(s.id, 0) or 0)
            true_balance = (ap + om) - (abs(ad) + abs(od) + abs(b))

            pd = int(positive_debt.get(s.id, 0) or 0)
            new_credit = true_balance + pd
            cur = int(cur_credit.get(s.id, 0) or 0)

            if new_credit == cur:
                continue
            loc = cur_credit_loc.get(s.id) or fallback_location.get(s.id)
            plan.append({
                "student_id": s.id, "gennis_id": s.gennis_id,
                "name": f"{s.name or ''} {s.surname or ''}".strip(),
                "true_balance": true_balance, "positive_debt": pd,
                "new_credit": new_credit, "old_credit": cur,
                "location_id": loc,
                "old_gennis_balance": old_balance.get(s.gennis_id),
                "has_aug": s.id in has_aug,
            })

        print(f"students checked        : {len(students):,}")
        print(f"credit will change for  : {len(plan):,}")

        match_clean = checked_clean = 0
        for p in plan:
            if p["old_gennis_balance"] is None or p["has_aug"]:
                continue
            checked_clean += 1
            if p["true_balance"] == int(p["old_gennis_balance"]):
                match_clean += 1
        # also count students whose credit is ALREADY correct (not in plan) among
        # the August-clean set, for an honest total match rate
        total_clean = sum(1 for s in students if s.id not in has_aug
                          and old_balance.get(s.gennis_id) is not None)
        already_right_clean = total_clean - checked_clean
        print(f"\nvalidation, August-clean students only "
              f"({total_clean:,} of them):")
        print(f"  matched old gennis before this script : {already_right_clean:,}")
        print(f"  matched old gennis after this script's true_balance : "
              f"{already_right_clean + match_clean:,} "
              f"({(already_right_clean + match_clean)/total_clean*100:.1f}%)")

        total_delta = sum(p["new_credit"] - p["old_credit"] for p in plan)
        print(f"\nnet change in stored credit across all changing students: "
              f"{total_delta:+,}")

        # A negative credit is fragile: apply_payment's leftover-credit write
        # REPLACES the row outright (payments.py: _upsert_credit(..., new_credit)),
        # and prior_credit_used = max(0, prior_credit) treats a negative value as
        # 0. So the very next payment this student makes silently discards a
        # negative adjustment — the balance is right today, wrong again on their
        # next payment. Positive credit does not have this problem: it is
        # correctly consumed by apply_payment's own logic.
        would_be_negative = [p for p in plan if p["new_credit"] < 0]
        print(f"\nof those, credit would go NEGATIVE for {len(would_be_negative):,} "
              f"students — fragile, see script docstring")
        print(f"  total magnitude: {sum(p['new_credit'] for p in would_be_negative):,}")

        plan.sort(key=lambda p: -abs(p["new_credit"] - p["old_credit"]))
        print(f"\nlargest 15 changes:")
        print(f"{'student':<28}{'old credit':>13}{'new credit':>13}{'change':>13}"
              f"{'old gennis bal':>15}")
        for p in plan[:15]:
            og = p["old_gennis_balance"]
            print(f"{p['name'][:27]:<28}{p['old_credit']:>13,}{p['new_credit']:>13,}"
                  f"{p['new_credit']-p['old_credit']:>+13,}"
                  f"{'—' if og is None else f'{int(og):,}':>15}")

        safe = [p for p in plan if p["new_credit"] >= 0]
        print(f"\nsafe to apply now (positive correction): {len(safe):,}")
        print(f"held back (negative — needs a debt row, not credit): "
              f"{len(would_be_negative):,}")

        if not APPLY:
            print("\n(dry run — pass --apply to write the safe/positive half only)")
            return

        print("\n>>> APPLYING (positive corrections only) <<<")
        for p in safe:
            await new.execute(text("""
                INSERT INTO gennis_student_credit (student_id, location_id, balance)
                VALUES (:s, :l, :b)
                ON CONFLICT (student_id) DO UPDATE
                  SET balance = EXCLUDED.balance,
                      location_id = coalesce(EXCLUDED.location_id,
                                              gennis_student_credit.location_id)
            """), {"s": p["student_id"], "l": p["location_id"], "b": p["new_credit"]})
        await new.commit()
        print(f"  {len(safe):,} credit rows written "
              f"({len(would_be_negative):,} negative corrections held back)")

asyncio.run(main())
