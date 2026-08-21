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

### 9. Teacher salary — stale sync, one groupd-config error (Temur Abdullayev)
First look outside student balances, into `gennis_teacher_salary`. Same shape
of bug, different table.

- **Stale sync**: his July row (`id=2311`) showed `total_salary=2,501,901`,
  last `synced_at` 2026-08-19 12:43. Old gennis's own `teachersalary` for the
  same month was `4,782,322` — and had been since 2026-08-04 (all 168
  underlying `attendancedays` rows created by then), so the Aug-19 sync run
  should have picked up the final number and didn't. `management_celery` /
  `management_celery_beat` had only been up ~17 minutes when checked —
  looks like the periodic sync job (`scripts/sync_gennis_accounting.py`,
  `sync_total_salary`) had a gap and this row missed a refresh cycle before
  restarting. Corrected directly to match old gennis's (verified, formula
  confirmed identical between both systems) figure: total_salary 4,782,322,
  remaining_salary 4,232,609.
- **Group-config error**: his Tarix01 group (`gennis_group.id=12200`,
  `gennis_id=840`) had `teacher_salary=192,500` in v2 vs old gennis's
  `385,000` — exactly half, from the 2026-07-25 group sync. Corrected to
  385,000 so future accrual (once old gennis fully retires and v2 has to
  self-compute) prices correctly.

**Open question, not resolved today**: how many *other* teacher rows have
the same stale-sync gap from the same celery restart. Not checked — this was
a single-teacher investigation prompted by one screenshot.

### 10. Per-lesson discount-shortfall bug — 173 rows, ~2.15M so'm
Distinct from #2 above (that one was `total_discount` tracked but not
applied; this one is `total_discount` under-tracked from the start — some
individual lessons within a month get the standing Xayriya discount, others
in the *same row* don't). Found via two manual balance checks (Kamola
Abdulazizova, Gulnora Turg'unova) where the displayed remaining_debt didn't
match a re-derivation from the group's own price/discount/attendance_days.

Detection method (robust — doesn't depend on the sometimes-unreliable
`gennis_lesson_attendance` attendance log): for every unpaid row with an
active charity for that (student, group), let `P = price // attendance_days`,
`D = charity // attendance_days`, `E = P - D`. If `total_discount` decomposes
cleanly as `k·D` and `total_debt - k·E` decomposes cleanly as `m·P` (both
within ±2 so'm of an integer), the row got `k` lessons discounted and `m`
lessons charged full price when they shouldn't have been. Correct value is
`(k+m)·E` / `(k+m)·D`.

Ran against all 580 unpaid rows with an active charity:
- **173 fixed** — 2,148,803 so'm in total debt reduction; 70,970 so'm of that
  (rows where payment already exceeded the corrected debt) moved into
  `gennis_student_credit` as surplus rather than left as a negative
  remaining_debt.
- 339 left untouched — didn't decompose cleanly, not this bug.
- 68 initially flagged "reconstructed total ≥ stored total" (a different,
  more dangerous direction — would mean *reducing* a discount, i.e.
  increasing debt) — re-checked individually after the fact: all 68 were
  exact matches already (a dead-code bug in the first verification script
  conflated "already correct" with "genuinely higher"); zero real cases of
  discount being over-applied.
- 0 failures on reverify.

Spot-checked 3 of the 173 by hand against the group's raw price/discount —
all decomposed exactly, no rounding slop.

**Mistake caught mid-fix**: manually correcting Gulnora Turg'unova's 3 rows,
wrote `remaining_debt` as negative. Convention throughout this table is
positive-for-owed (`remaining_debt = total_debt - payment`); caught and
corrected before it reached the batch script (which used the correct sign
from the start).

**Root cause not found** — confirmed the bug is intermittent (one row for a
student can be 100% correctly discounted while another row, same student,
same group, adjacent month, has some lessons missing it entirely), but
didn't trace which mark.py code path produces the miss. Not urgent to chase
further since the 173-row fix already covers the known extent, but worth
knowing if the same pattern reappears for lessons marked after today.

### 11. Duplicate teacher-salary payment rows — 3 rows, ~1.5M so'm

Found while checking whether the collection-account ("Inkassatsiya") screen
counts deleted salary payments (it doesn't — `deleted=False` filter, correct).
While checking a screen showing the same round amount twice for one teacher,
found the real pattern: the same real payment recorded **twice** — once via
v2's own native entry flow (small sequential `id`), once again via a
sync-from-old-gennis pass (`id` in the hundreds-of-millions to billions range,
`synced_at` set, `reason='avans'` populated) — landing in
`gennis_teacher_salary_payment` as two separate rows for the identical amount,
1-2 days apart.

Checked system-wide (not just the one location the screenshot came from): only
**4 candidate pairs**, all dated 2026-08-19 to 2026-08-21 (i.e. live/recent,
not historical). 3 confirmed and fixed:

- **Amirbek Akbaraliyev**, 200,000 so'm — proven via shared `salary_gennis_id`
  (both rows point at the same underlying salary record, 6 hours apart).
- **Sardor Ikromov**, 649,188 and 650,000 so'm — non-round amounts, same
  teacher, 1-2 days apart, both dated 2026-08-19 to 08-21.

Left alone: Ruslan Orifov's 50,000 so'm pair — round number, different
channel, no shared `salary_gennis_id`; not confident enough to call it a
duplicate.

Fix: soft-deleted the 3 duplicate rows, recomputed the corresponding
`gennis_teacher_salary.taken_money`/`remaining_salary` (linear in
`taken_money`, so just subtracting the duplicated amount and re-deriving
`remaining_salary` from the existing formula was exact — no other fields
touched).

**Not resolved**: why duplicates are still being created *after* the
2026-08-12 freeze date — either old gennis is still receiving live entries
despite being nominally frozen, or staff are still double-entering payments
into both systems by habit. Worth flagging to whoever owns the freeze.

### 12. Attendance-delete reversal never decremented present_days/absent_days

Found via a student profile ("Kelgan kunlar" showing 3 when only 2 lessons
existed live) after asking how the attendance-delete endpoint
(`DELETE /attendance/records/{id}`, `attendance/history.py`) works. It
correctly reverses the money (student debt, teacher/assistant salary) when a
lesson gets deleted, but never touched `present_days`/`absent_days` — so the
counter kept counting a lesson that no longer existed, drifting further out of
step with every subsequent deletion.

Scanned for the same pattern platform-wide, scoped to 2026 rows where live
attendance data actually exists (to exclude legacy pre-v2 rows with no
baseline to compare against): **27 rows / 17 group-month combinations** — one
cluster stood out, group 12049 in July with 6 students all showing the
identical 14→13 drift, almost certainly one shared lesson-date deletion for
the whole group at once rather than 6 independent single-student deletes.

Of those 27, **4 also had a stale-counter side effect**: the deleted lesson's
reversal had correctly reduced `total_debt`, but since `payment` (money
already received) is deliberately never touched by the reversal, the excess
sat as a negative `remaining_debt` instead of clean zero. Corrected those 4 by
moving the surplus into `gennis_student_credit` and zeroing `remaining_debt` —
**note**: this pattern was later found to be unnecessary churn, not a real
bug — see §13's note on `GennisStudentCredit`.

**Code fix, deployed** (`history.py`, commit `f9cf0df`): `_reverse_lesson_charge`
now decrements `present_days`/`absent_days` (whichever the deleted record
was), matching what `mark.py` increments on mark. Docstring also corrected —
it previously claimed the student-charge/salary reversal was "exact"; it
isn't, for the same reason black-salary/fine reversal was already documented
as best-effort (both re-derive from the group's *current* config, not what
was in effect when the lesson was originally marked).

### 13. mark.py root cause for the discount-shortfall bug — found and fixed

The §10 fix (173 rows) cleaned up the historical backlog but didn't touch the
cause. Traced it this session: `_update_history_debt_rows` in `mark.py`
**accumulated** each lesson's charge (`total_debt = total_debt +
effective_charge`) using whichever `GennisStudentCharity` discount was
standing at the exact moment *that one lesson* got marked. Nothing ever
revisited already-accumulated lessons — so when a discount got granted
mid-month, lessons marked before that moment kept their old (undiscounted)
contribution forever. Confirmed live-recurring on a lesson marked *after* the
§10 fix (Kamola Abdulazizova's July Mt01A1-03 row: 11 of 12 lessons
discounted, 1 not, ~11 so'm off).

**Fix, deployed** (commit `2b80f2c`): `_update_history_debt_rows` now
recomputes `total_debt`/`total_discount` from scratch every time any lesson
in that group/month gets marked — `(present_days + absent_days) × current
rate` — instead of accumulating a delta. A discount change now retroactively
fixes the whole month automatically the next time any lesson in it is
touched, instead of only affecting lessons marked afterward.

**Urgent side effect this fix created**: it depends on `present_days`/
`absent_days` being accurate, since it multiplies by them directly. Scanning
for rows where that counter didn't match live attendance (same class of check
as §12, but checking understatement, not just staleness-from-deletion) turned
up **27,658 rows platform-wide** — most off by 1 (today's lesson not yet
reflected, harmless), but thousands showing `present_days=0` despite a fully
attended, fully paid month underneath (money already correct, only the
counter wrong — pre-existing, unrelated to today's changes, just newly
dangerous given the new recompute logic). Any of those getting one more
lesson marked would have collapsed a correct `total_debt` down to almost
nothing. Ran a single bulk backfill — `present_days`/`absent_days` set to
match live `gennis_lesson_attendance` counts, no money fields touched — across
all 27,658 rows before this could bite. Verified zero mismatches remain.

**Attempted and deliberately not applied**: a retroactive recompute of
existing open (unpaid) rows using the same exact formula, to fix the backlog
missed by §10's decomposition-based detection. Sized it at 598 open rows with
an active charity, but the numbers don't support blind recompute even
restricted to the current 2 months — many rows show the *discount itself*
having changed (added, removed, or resized) between when lessons were marked
and now, which the aggregate total can't distinguish from "lesson missed its
discount." Recomputing with "current discount" would retroactively erase
legitimately-earned-at-the-time discounts on some rows while correctly fixing
others, with no way to tell them apart from the aggregate alone. Left
untouched — the live fix is safe (always uses whichever discount is genuinely
current at the moment each lesson is (re-)touched); a blind historical
recompute is not.

**Correction to §12's methodology**: moving a negative `remaining_debt` into
`GennisStudentCredit` (done for 5 rows total between §12 and the original
Kamola/Gulnora checks) turned out to be unnecessary — `mark.py` already has an
explicit comment documenting a real prior production incident from exactly
this double-write pattern (debt tracked in both `remaining_debt` and
`GennisStudentCredit` independently, drifting out of sync). A negative
`remaining_debt` on one row is the *correct* state — it's the single source of
truth for debt and nets naturally against other rows via `effective_balance()`
and `debt_total = sum(remaining_debt)`, which every debt-facing screen already
uses. Checked the algebra: moving the surplus into credit and zeroing the row
is balance-neutral for the final displayed number, so those 5 rows aren't
wrong today — but the pattern shouldn't be repeated, and `_reverse_lesson_charge`'s
docstring now says so explicitly.

### 14. attended_days double-counted present_days + scored_days — platform-wide, 2022-2026

Found via a student balance screen showing "24 kelgan kunlar" for a group
capped at 13 lessons/month. Database was correct (`present_days=12`); the API
field (`students/profile.py`) computed `attended_days = present_days +
scored_days`, a formula ported from a (mistaken) assumption that old gennis
kept the two mutually exclusive — a graded lesson landing in `scored_days`
*instead of* `present_days`. Checked old gennis's own admin screen directly
(screenshots from the student in question): its "Kegan kunlar" column equals
"Kunlar" with no addition at all — the mutually-exclusive assumption was never
true even in old gennis, so this wasn't a faithful port, just a mistake baked
into v2 from the start. `mark.py` itself never touches `scored_days` — it
always increments `present_days` for every attended lesson regardless of
grading — so the two counters overlap rather than partition, and adding them
double-counted (sometimes far worse than 2× — one row showed
`present_days=4, scored_days=19` displaying as 23).

Scope: **28,546 rows / 5,726 distinct students**, 2022 through 2026 — this
wasn't a recent or isolated glitch.

**Fix, deployed** (`profile.py`, commit `c0c2ff4`): `attended_days` is now
just `present_days`. Pure display-formula fix — no database rows touched,
`total_debt`/`payment`/`remaining_debt` were never affected by this bug, and
since the fix lives in the API response computation rather than stored data,
it corrected all 5,726 students' displays the moment it deployed, no backfill
needed.

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
