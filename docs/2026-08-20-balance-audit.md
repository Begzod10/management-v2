# Student Balance Audit — 2026-08-20

Session covering the "Inkassatsiya" reconciliation follow-on work: individual
balance complaints turned up several distinct bugs in how student debt/credit
is tracked in `gennis_attendance_history_student` / `gennis_student_credit`
(management DB). This documents what was found, what was fixed, and what's
still open.

## Confirmed and fixed

### 1. Eski Balans cleanup
`scripts/repairs/create_legacy_debt_for_negative_balance.py` (applied
2026-08-14) wrote 1,291 synthetic "Eski balans" debt rows to reflect old
gennis's lifetime-balance formula for students who never fully reconciled.
- **255 rows removed** — students where old gennis's own `students.old_money`
  / `old_debt` are both null/zero, meaning the whole "legacy debt" figure was
  actually a v2-side artifact (inflated `total_debt` for the student's most
  recent open month vs. old gennis's own, sometimes-stale figure for the same
  period), not real carried-over debt. Verified case-by-case for a sample,
  then removed for the full zero-legacy-basis population.
- **702 rows kept** — real legacy debt, most (607) belonging to students with
  zero current v2 activity (nothing to conflict with), the rest checked
  individually.
- **3 corrected** (Toychiyayev, Abduhoshimov, Oktyabrova) — their Eski Balans
  figures matched old gennis's `old_debt` field once the underlying July/Aug
  application bug (below) was fixed first; one (Abduhoshimov) needed the
  figure itself corrected to match `old_debt` exactly (148,124 → 156,157).

One case (Xasanova) went back and forth — removed, then restored — after
clarification that old gennis genuinely folds this kind of legacy balance
into the displayed total silently; it isn't a display bug, the debt is real
when `old_money`/`old_debt` back it.

### 2. Discount-pattern bug — 12 rows, 5 students
Signature: `remaining_debt` exactly equals `total_discount` on the same row.
`mark.py`'s per-lesson charge is supposed to already be net of any standing
charity discount before it's added to `total_debt`; for these specific rows
it wasn't, so the discount got tracked in `total_discount` but never actually
reduced `remaining_debt`. Verified 8/8 sampled cases against old gennis
(all showed fully resolved there) before fixing the rest. Fixed: Xalbayev
(Dchj 12:00, 4 rows) + Risqaliyev, Begmuratova, Sherzodova, Nusratullayev
(Gazalkent/Chirchiq, 8 rows).

**Caution**: this exact-match signature is reliable; the broader "any row
with total_discount>0 and remaining_debt>0" version is NOT (produced false
positives — some rows genuinely aren't reduced by their charity, matching
old gennis exactly with no discount applied at all).

### 3. Debtors-page endpoint bug (code fix, deployed)
`POST /accounting/debtors/pay-student/{id}` (apps/backend
`app/api/v1/accounting/debtors.py`) was doing a raw `GennisStudentPayment`
insert with no debt-clearing — money counted toward Inkassatsiya totals but
never reduced `remaining_debt` or banked leftover as credit. Now routes
through `apply_payment()`, same as the `/accounting/payments` endpoint.
Commit `c71fea3`, deployed.

Also fixed in the same deploy: the create-expense/overhead modal
(`AccountingPage.tsx`) had no error handling — a rejected create (e.g.
amount mismatch on a fixed-cost overhead type) failed completely silently.
Now surfaces the backend's actual rejection message via toast.

### 4. E11B2-01 group-pricing bug — 7 students
`gennis_group.attendance_days` was bulk-corrected to 13 for essentially every
group on 2026-07-25 (single timestamp across 163 groups — a migration, not
per-group fixes). Before that date, groups whose `attendance_days` fallback
(`_scheduled_lessons_in_month()`) computed a different lesson count priced
identically-attended months at a **consistently wrong ratio** vs old gennis
(exactly 7/6 for E11B2-01). Confirmed via binary search on one student
(Toychiyayev): identical to old gennis through Dec 2025 and Jan-Feb 2026,
diverges starting March 2026, resolves (mostly) by the July 25 fix date.

Corrected March-June `total_debt`/`payment` to match old gennis for:
Toychiyayev, Oktyabrova, 221784, 222829 (later partially reverted — see
below), 222918 (later reverted — see below), 217665, 223449.

System-wide check across all 163 bulk-updated groups: only ~1.1% of
(group, student) pairs showed a real mismatch (not staleness/legitimate price
changes) — this was not a widespread disaster, just concentrated in a few
groups.

### 5. Full-history-replay batch fixes — 452 + 221 students
Reliable formula (validated against known-good and known-bad cases before
trusting it):

```
gap = SUM(real+chegirma payment_sum, all time, not deleted)
    − SUM(payment field across all non-Eski-Balans debt rows)
    − current credit balance
```

A **positive** gap always means real money that was never applied anywhere —
safe to auto-fix (worst case: extra credit). A **negative** gap means the
system currently shows more credited than was really paid — NOT safe to
auto-fix (would mean telling a family they owe more); needs individual
verification.

Ran two passes:
- First pass (452 students, 68.3M) used a flawed formula that added
  `total_discount` into "applied money."
- **Correction found mid-session**: `total_discount` is Xayriya (standing
  charity) money, never real payment money — confirmed via `mark.py`
  comment and a live example (student with a 370,000 charity showing up as
  a "missing payment" that was never real). This single error explained
  most of a 1,713-student, −185.7M "negative gap" list that was mostly
  noise, not bugs.
- Second pass (221 students, 18.7M more) with `total_discount` excluded
  from "applied" entirely — corrected formula.

Both passes: every single fix was individually recomputed and re-verified to
gap≈0 (±5 so'm) **before** commit; any that failed verification were rolled
back automatically. Zero failures across 673 total fixes.

### 6. Duplicate payment records — 5 payments marked deleted
Downstream consequence of payments that were earlier found wrongly marked
`deleted=true` (restored visibility, but staff couldn't see them at the time
and re-entered the same amount/date manually). Confirmed via exact
amount+date match against old gennis (which only had the original, not the
re-entry) for: 232007, 231275, 231684, 231988, 231989.

### 7. Batch-fix arithmetic errors — caught and corrected
Made the same conceptual mistake twice: computed a correction amount
correctly, then added it to *existing* credit instead of re-running the
combined total through FIFO against still-outstanding debt.
- Dilxushbek Jo'rayev (229807): credit set to 5,034, should have been
  81,959. Caught by the admin's manual recount, corrected.
- 6 of the 7 E11B2-01 students: same error, caught by re-verifying the whole
  batch with the gap formula immediately after (see lesson learned below).

### 8. 221855 — phantom credit hiding real debt
Not related to any of the above patterns. Stored credit (724,613) had zero
backing in real payment history; the same amount almost exactly matched 4
genuinely-unpaid 2023 rows, confirmed unpaid in old gennis too
(`status=false`, `payment=0`). The displayed balance was **positive** when it
should have been **negative** — the most serious class of error found today,
since it's the opposite direction of everything else (hides debt rather than
overstating it). Credit corrected to 0; the 4 old unpaid rows left as
genuine debt.

## Lesson learned, applied going forward

Every aggregate/batch approach tried today had a real error rate until
individually spot-checked — never trust an aggregate query's output as
correct just because the query runs. The pattern that worked:
**verify a sample against old gennis → batch-apply → immediately re-verify
every single result to gap≈0, roll back anything that doesn't match.**
That discipline caught: the `total_discount` formula error, the E11B2-01
credit-stacking error, and (via the admin's own recheck) the Dilxushbek
error. Positive-direction fixes (money owed to student) are safe to batch;
negative-direction fixes (would increase what a student owes) are not —
always verify those individually.

## Open for next session

- **269 students remaining in the negative-gap list** (−22.3M, corrected
  formula). Two checked so far: one genuine bug (like 221855's phantom
  credit), one "old tangled history" case with no clean row to attribute the
  discrepancy to (same unsolved class as 222918, 232033, 231853/Davlatbek).
  Expect a mix of both patterns throughout — no shortcut found yet.
- **295 duplicate-student-registration clusters** with overlapping financial
  activity (same person under 2+ `gennis_student` records with money split
  across both). Distinguished from ~700 total duplicate-name clusters by
  requiring genuinely overlapping payment date ranges — sequential
  re-registrations (student left, came back a year later under a new ID)
  are NOT bugs and don't need touching. The 295 need a proper merge script
  (move all payment/debt-history rows to one canonical ID, mark the other
  inactive) — not a credit-number patch. Top of the list by money involved:
  Robiya Ergasheva (12.9M), Sevinch Bahromboyeva (8.2M), Gulzira
  Abdumannopova (8M), Akbarshox To'shpo'latov (7.7M).
- **216745, 222918, 232033, 231853 (Davlatbek)** — all show the "old
  tangled history" pattern (real payments fall meaningfully short of what's
  shown as applied, spread across many already-"fully paid" rows going back
  to 2022-2024, with no single row to cleanly attribute the gap to). Left
  untouched; needs a different investigative approach than anything used
  today, possibly a full old-gennis-vs-v2 row-by-row diff for each rather
  than the aggregate formula.
