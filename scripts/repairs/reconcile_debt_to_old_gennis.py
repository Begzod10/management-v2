"""Push old gennis's own per-month debt numbers onto v2's matching history rows.

WHY THIS EXISTS
Fifteen scripts today each found and fixed one CAUSE of a wrong balance: an
untranslated charity id, a shifted payment, a stale group enrolment. Each was real
and each is fixed, but the total balance gap across all 16,157 students was still
339,931,280 (3,376 students) when this was written — because the gap isn't fifteen
causes, it's however many causes exist, most still unknown, each silently wrong in
its own way.

This does not look for a cause. It makes v2's numbers equal old gennis's numbers,
directly, for every (student, group, month) row both systems saw before old gennis
froze on 2026-08-12 — regardless of why they differ.

SCOPE: MONTHS BEFORE AUGUST 2026 ONLY
Old gennis's July data and earlier will never change again — it is a permanent,
complete record. Its August data is a snapshot cut off mid-month, and v2 kept
billing all of August correctly (lesson counts matched 100% in an earlier
comparison). Overwriting August with old gennis's partial figure would UNDO real,
correct v2 activity. So the cut is 2026-08-01: everything before is copied from old
gennis; August onward is left exactly as v2 has it.

WHAT GETS COPIED, ROW FOR ROW
For every (student, group, calendar_month, calendar_year) old gennis has before
August, matched to v2's row for the same (student, group, month) via the id
translations already fixed today (gennis_student.gennis_id, gennis_group.gennis_id):
    total_debt, payment, remaining_debt, total_discount, status
old gennis stores debt as a negative number; v2 stores it positive, so the sign is
flipped on the way in. Nothing else on the row changes.

WHAT THIS DOES NOT DO
  - Does not touch gennis_student_credit directly. Once the debt rows are correct,
    the existing formula (rebuild_student_credit.sql: balance = GREATEST(0, paid -
    applied)) produces the right credit on its own — this script recomputes it for
    exactly the students it touches, using that same formula, as its final step.
  - Does not create rows. A student/group/month that exists in old gennis with no
    counterpart in v2 is reported, not inserted — creating a row needs a location,
    subject, and group resolution this script does not attempt.
  - Does not touch August 2026 or later.
  - Does not touch subject_id, group_name, or anything not in the list above.

VALIDATION
For every student this touches, the script also compares its own result against
old gennis's own users.balance — not the derived formula, the number old gennis
actually stored — as the real test of whether the copy converges.

Usage:
    python reconcile_debt_to_old_gennis.py            dry run (default)
    python reconcile_debt_to_old_gennis.py --apply     write
"""
import asyncio
import datetime
import sys
from sqlalchemy import text
from app.db.session import _GennisSession, AsyncSessionLocal

CUTOFF_YEAR, CUTOFF_MONTH = 2026, 8   # exclusive: months before this are copied
APPLY = "--apply" in sys.argv


async def main():
    async with _GennisSession() as old, AsyncSessionLocal() as new:
        print("Loading old gennis history rows before "
              f"{CUTOFF_YEAR}-{CUTOFF_MONTH:02d} ...")
        old_rows = (await old.execute(text("""
            SELECT h.student_id, h.group_id,
                   EXTRACT(YEAR  FROM cy.date)::int AS yr,
                   EXTRACT(MONTH FROM cm.date)::int AS mo,
                   h.total_debt, h.payment, h.remaining_debt,
                   h.total_discount, h.status
            FROM attendancehistorystudent h
            JOIN calendarmonth cm ON cm.id = h.calendar_month
            JOIN calendaryear  cy ON cy.id = h.calendar_year
            WHERE (EXTRACT(YEAR FROM cm.date)::int, EXTRACT(MONTH FROM cm.date)::int)
                  < (:cy, :cm)
        """), {"cy": CUTOFF_YEAR, "cm": CUTOFF_MONTH})).fetchall()
        print(f"  {len(old_rows):,} rows")

        gid_student = dict((await new.execute(text(
            "SELECT gennis_id, id FROM gennis_student WHERE gennis_id IS NOT NULL"
        ))).fetchall())
        gid_group = dict((await new.execute(text(
            "SELECT gennis_id, id FROM gennis_group WHERE gennis_id IS NOT NULL"
        ))).fetchall())

        v2_rows = {}
        for r in (await new.execute(text("""
            SELECT id, student_id, group_id, calendar_year, calendar_month,
                   total_debt, payment, remaining_debt, total_discount, status
            FROM gennis_attendance_history_student
            WHERE (calendar_year, calendar_month) < (:cy, :cm)
        """), {"cy": CUTOFF_YEAR, "cm": CUTOFF_MONTH})).fetchall():
            v2_rows[(r.student_id, r.group_id, r.calendar_year, r.calendar_month)] = r

        plan = []
        no_v2_student = no_v2_group = no_v2_row = unchanged = 0
        for r in old_rows:
            sid = gid_student.get(r.student_id)
            if sid is None:
                no_v2_student += 1
                continue
            gid = gid_group.get(r.group_id) if r.group_id is not None else None
            if r.group_id is not None and gid is None:
                no_v2_group += 1
                continue
            key = (sid, gid, r.yr, r.mo)
            v2r = v2_rows.get(key)
            if v2r is None:
                no_v2_row += 1
                continue

            new_total_debt = abs(int(r.total_debt or 0))
            new_payment = abs(int(r.payment or 0))
            new_remaining = abs(int(r.remaining_debt or 0))
            new_discount = int(r.total_discount or 0)
            new_status = bool(r.status)

            if (v2r.total_debt, v2r.payment, v2r.remaining_debt,
                v2r.total_discount, v2r.status) == \
               (new_total_debt, new_payment, new_remaining, new_discount, new_status):
                unchanged += 1
                continue

            plan.append({
                "row_id": v2r.id, "student_id": sid,
                "old_remaining": v2r.remaining_debt, "new_remaining": new_remaining,
                "total_debt": new_total_debt, "payment": new_payment,
                "remaining_debt": new_remaining, "total_discount": new_discount,
                "status": new_status,
            })

        print(f"\nold-gennis rows matched to a v2 row : {len(plan) + unchanged:,}")
        print(f"  already identical                 : {unchanged:,}")
        print(f"  will change                        : {len(plan):,}")
        print(f"\nunmatched (reported, not touched):")
        print(f"  student not found in v2            : {no_v2_student:,}")
        print(f"  group not found in v2               : {no_v2_group:,}")
        print(f"  no v2 row for that (student,group,"
              f"month)                                : {no_v2_row:,}")

        if not plan:
            print("\nNothing to change.")
            return

        delta = sum(p["new_remaining"] - p["old_remaining"] for p in plan)
        print(f"\nnet change in remaining_debt across changed rows: {delta:+,}")

        # ---- preview: recompute credit for every touched student, compare to
        # old gennis's own stored balance ----
        touched = sorted({p["student_id"] for p in plan})
        print(f"\nstudents touched: {len(touched):,}")

        # Validate the HISTORICAL portion only: old gennis's balance is a snapshot
        # frozen at 2026-08-12, so a student with ANY August activity (a new
        # payment, a newly-marked lesson) will legitimately differ from it — that
        # is v2 correctly continuing to operate, not a defect in this fix. Compare
        # like for like: pre-August payments against pre-August history rows,
        # exactly the slice this script reconstructs, and report August-touched
        # students separately rather than folding them into the same average.
        rows = (await new.execute(text(
            "SELECT id, student_id, payment, remaining_debt, calendar_year, calendar_month "
            "FROM gennis_attendance_history_student "
            "WHERE student_id = ANY(:ids)"), {"ids": touched})).fetchall()
        plan_by_row = {p["row_id"]: p for p in plan}
        pre_applied, pre_debt, has_aug_history = {}, {}, set()
        for r in rows:
            is_pre_aug = (r.calendar_year, r.calendar_month) < (CUTOFF_YEAR, CUTOFF_MONTH)
            if not is_pre_aug:
                has_aug_history.add(r.student_id)
                continue
            p = plan_by_row.get(r.id)
            pay = p["payment"] if p else int(r.payment or 0)
            rem = p["remaining_debt"] if p else int(r.remaining_debt or 0)
            pre_applied[r.student_id] = pre_applied.get(r.student_id, 0) + pay
            if rem > 0:
                pre_debt[r.student_id] = pre_debt.get(r.student_id, 0) + rem

        paid_rows = (await new.execute(text(
            "SELECT student_id, paid_date, payment_sum FROM gennis_student_payment "
            "WHERE NOT deleted AND student_id = ANY(:ids)"), {"ids": touched})).fetchall()
        pre_paid, has_aug_payment = {}, set()
        for r in paid_rows:
            if r.paid_date and r.paid_date < datetime.date(CUTOFF_YEAR, CUTOFF_MONTH, 1):
                pre_paid[r.student_id] = pre_paid.get(r.student_id, 0) + int(r.payment_sum)
            else:
                has_aug_payment.add(r.student_id)

        gid_rev = {v: k for k, v in gid_student.items()}
        old_balance = dict((await old.execute(text(
            "SELECT s.id, u.balance FROM students s JOIN users u ON u.id = s.user_id"
        ))).fetchall())

        clean, match, mismatch, has_aug = 0, 0, 0, 0
        worst = []
        for sid in touched:
            og = gid_rev.get(sid)
            if og is None or og not in old_balance:
                continue
            if sid in has_aug_history or sid in has_aug_payment:
                has_aug += 1
                continue
            clean += 1
            paid = pre_paid.get(sid, 0)
            applied = pre_applied.get(sid, 0)
            debt = pre_debt.get(sid, 0)
            new_balance = max(0, paid - applied) - debt
            ob = int(old_balance[og])
            if new_balance == ob:
                match += 1
            else:
                mismatch += 1
                worst.append((sid, new_balance, ob, new_balance - ob))

        print(f"\nvalidation against old gennis's OWN stored balance (users.balance),")
        print(f"on the {clean:,} touched students with NO August activity at all —")
        print(f"the honest test, since anyone with August activity will legitimately")
        print(f"differ from a balance old gennis stopped updating on 12 Aug:")
        print(f"  matches exactly         : {match:,}")
        print(f"  still differs            : {mismatch:,}")
        print(f"  (excluded — has August activity, expected to differ): {has_aug:,}")

        worst.sort(key=lambda x: -abs(x[3]))
        if worst:
            print("\n  largest remaining differences, August-clean students only:")
            for sid, nb, ob, d in worst[:10]:
                nm = (await new.execute(text(
                    "SELECT name||' '||surname FROM gennis_student WHERE id=:s"),
                    {"s": sid})).scalar()
                print(f"    {nm[:30]:<31} v2-after {nb:>12,}   old {ob:>12,}   "
                      f"diff {d:>+12,}")

        if not APPLY:
            print("\n(dry run — pass --apply to write)")
            return

        print("\n>>> APPLYING <<<")
        CHUNK = 2000
        for i in range(0, len(plan), CHUNK):
            batch = plan[i:i + CHUNK]
            await new.execute(text("""
                UPDATE gennis_attendance_history_student AS t
                SET total_debt = v.total_debt, payment = v.payment,
                    remaining_debt = v.remaining_debt,
                    total_discount = v.total_discount, status = v.status
                FROM (SELECT unnest(cast(:ids as bigint[]))  AS id,
                             unnest(cast(:td as int[]))      AS total_debt,
                             unnest(cast(:pay as int[]))     AS payment,
                             unnest(cast(:rem as int[]))     AS remaining_debt,
                             unnest(cast(:disc as int[]))    AS total_discount,
                             unnest(cast(:st as boolean[]))  AS status) AS v
                WHERE t.id = v.id
            """), {
                "ids": [p["row_id"] for p in batch],
                "td": [p["total_debt"] for p in batch],
                "pay": [p["payment"] for p in batch],
                "rem": [p["remaining_debt"] for p in batch],
                "disc": [p["total_discount"] for p in batch],
                "st": [p["status"] for p in batch],
            })
            print(f"  {min(i+CHUNK, len(plan)):,}/{len(plan):,} rows written")
        await new.commit()
        print(f"  {len(plan):,} history rows updated")

        # rebuild credit for exactly the touched students, same formula as
        # rebuild_student_credit.sql
        rows = (await new.execute(text(
            "SELECT student_id, sum(payment) AS applied, "
            "       sum(remaining_debt) FILTER (WHERE remaining_debt > 0) AS debt, "
            "       max(location_id) AS location_id "
            "FROM gennis_attendance_history_student "
            "WHERE student_id = ANY(:ids) GROUP BY 1"), {"ids": touched})).fetchall()
        applied_map = {r.student_id: (int(r.applied or 0), int(r.debt or 0), r.location_id)
                       for r in rows}
        for sid in touched:
            applied, debt, loc = applied_map.get(sid, (0, 0, None))
            paid = per_student_paid.get(sid, 0)
            balance = max(0, paid - applied)
            await new.execute(text("""
                INSERT INTO gennis_student_credit (student_id, location_id, balance)
                VALUES (:s, :l, :b)
                ON CONFLICT (student_id) DO UPDATE
                  SET balance = EXCLUDED.balance,
                      location_id = coalesce(EXCLUDED.location_id,
                                              gennis_student_credit.location_id)
            """), {"s": sid, "l": loc, "b": balance})
        await new.commit()
        print(f"  credit rebuilt for {len(touched):,} students")

asyncio.run(main())
