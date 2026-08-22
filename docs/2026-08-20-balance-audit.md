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

### 15. Duplicate student payment deleted alongside its original — Asadbek O'ktamov, and confirming the payment-reversal engine is correct

Reported as a live discrepancy: student profile showed `-314,379` in one tab
and `-714,379` in another. Traced to two identical `400,000` click payments
logged 2 minutes apart (`gennis_student_payment` ids 61518, 61525) — a
double-click duplicate. Both got deleted, when only the duplicate should
have been — the original, legitimate payment went with it.

`reverse_payment()` (`services/payments.py`) restores debt "newest-month-first"
by design (it has no per-payment ledger of which row a payment actually paid
off, so it can't target just the deleted payment's own contribution) —
deleting the August payment walked backward, drained July's `331,770`
first, then reached into **June** and pulled `68,230` out of a row that had
been closed and fully paid for weeks, using money that payment never touched.

Verified this is the *engine working correctly*, not a bug in the reversal
itself: replayed the student's entire debt history from scratch — all 30
months' `total_debt`, oldest-first, filled with the current (post-deletion)
real-payment total of `7,603,000` — and it landed on the exact same numbers
already sitting in the database, to the so'm. Payments are pooled, not
tied to a specific debt row, so removing any amount from the pool has to make
the paid watermark recede from the newest month backward to stay consistent;
that's what happened. The only actual problem was the accidental double
deletion, not the mechanics of reversing it.

**Fix, applied**: re-added the one legitimate `400,000` payment through the
real `apply_payment()` (so credit reconciliation and teacher black-salary
activation ran normally, not a raw SQL shortcut) — `scripts/fix_asadbek_224322.py`.
This surfaced a second, separate bug (§16) while investigating: the June row's
`total_debt` itself was wrong before any of this happened.

### 16. Group price never versioned — already-billed months silently repriced at today's rate — 567 rows, ~40 groups, 338 credit reconciliations

While explaining §15's June shortfall, the student pushed back: attendance
data for that month is identical in old gennis and v2, so the debt figures
should be too. They weren't — old gennis's frozen (pre-2026-08-12) snapshot
showed `153,845` for 5 marked lessons (400,000 ÷ 13/lesson); v2 showed
`161,535` for the identical 5 lessons (420,000 ÷ 13/lesson). `gennis_group`
confirms the group's price changed after June ended, but the row's
`total_debt` reflected the new rate anyway.

Root cause: `_update_history_debt_rows` (rewritten in §13 to recompute
`total_debt` from scratch on every touch, specifically so a discount change
would retroactively apply to the whole month) always read the group's
*current live* `price`, with no memory of what the price was when that
calendar month was actually billed. Any already-closed month that got
touched again later — a backdated or re-marked lesson — silently repriced
its **entire** month at today's rate, not just the newly-touched lesson.
§13's fix solved the discount-staleness bug and introduced this one as a
side effect: discount is *supposed* to be retroactive within the month;
price is not.

**Scope, found by comparing v2 against old gennis's frozen numbers**
(student's own gennis_id/group gennis_id, same present+absent day count on
both sides used as a shared divisor to isolate rate differences):

| Scan | Rows | Coverage |
|---|---|---|
| Jun/Jul 2026, discount-free rows only | 145 (+1 manual: Asadbek) | 38 groups |
| Widened: all months 2023–Jul 2026, discount-matched rows included | 421 | 40 groups |
| **Total corrected** | **567** | **338 credit reconciliations** |

All drift was confined to **March–July 2026** — nothing in 2023-2025, and
August (in-progress) wasn't scanned. Net debt correction across all batches:
students were net over-billed (`-1.77M` then `-7.04M` so'm as scope widened);
338 of the 567 rows had already been paid in full at the inflated price, so
those surpluses moved into `GennisStudentCredit`, same reasoning as §13's
correction.

**Fix, deployed** (commit `94b76ec`): added a nullable `price_per_lesson`
column to `gennis_attendance_history_student`. `_update_history_debt_rows`
now stamps it from the live price the *first* time a row is ever touched,
then reuses that locked value on every later recompute of the same row — a
group price change only affects months billed after the change. Discount
stays dynamic/self-healing on purpose, unchanged from §13.

**Data fix, applied**: `scripts/fix_price_drift_batch.py`, driven by a JSON
list of `{student, group, month, old_total_debt, new_price_per_lesson}`
built from the old-gennis comparison. Only `total_debt`/`price_per_lesson`/
`remaining_debt`/`status` were touched — `payment` was left alone, so no
FIFO payment-cascade replay was needed (unlike §15's case, which required
one because a *payment* was being restored, not just a debt figure
corrected). Verified after each batch: `remaining_debt < 0` row count held
steady at 21 (the pre-existing, already-flagged cluster — see Open below),
confirming nothing new broke.

**Left open, not auto-fixed at the time**:
- **64 rows** where the discount amount itself also differs between old
  gennis and v2 (charity granted or changed since the freeze) — the
  aggregate total can't distinguish "price drifted" from "discount
  legitimately changed" for these, same reasoning as §13's rejected blind
  recompute. Needs individual review. (Resolved in full — see §17.)
- Rows outside the students/groups the old-gennis comparison could reach
  (no frozen counterpart, or ambiguous multi-row matches) were skipped
  entirely rather than guessed at.

### 17. The 64 discount-differs rows — resolved in full, no batch formula, one by one

§16 left these 64 open because a single aggregate comparison can't tell
"price drifted" apart from "discount legitimately changed since the
freeze" — both move the same total_debt number. Went through all 64
individually instead of guessing at a formula. None were left to chance;
each was placed in a bucket only after a specific, checkable reason:

- **40 — self-healing discount, not a bug.** `old_total_debt + old_discount
  − v2's current discount` (the historically-correct price recombined with
  whatever charity is standing on the row *today*) already equalled what
  was stored. This is §13's discount self-healing working exactly as
  designed — a charity changed since the freeze and v2 correctly
  re-applied it. Nothing to touch.
- **4 — stale old-gennis row, not a bug.** Old's number for that month was
  byte-identical (`total_debt` *and* `total_discount`) to its own *previous*
  month — the tell that old-gennis simply stopped syncing partway through
  and isn't real ground truth for that row. v2 was correct.
- **4 fixed — the same price-lock bug as §16, just missed by the automated
  scan.** Ruxshona Rahimboyeva, group 604 (E26A2-05), March–June: her rows
  were consistently priced at 28,000/lesson while every other student in
  the same group correctly paid 27,692/lesson (confirmed via multiple
  cross-students) — she landed in the discount-diff bucket only because her
  discount also happened to differ, so §16's discount-free scan skipped
  her. Corrected the same way as §16's batch: `11,704` so'm moved to
  credit across the 4 rows.
- **2 — false positive, v2 verified correct.** Jayna Elesova (group 548,
  July): her own 6-month track record is self-consistent at 30,769/lesson
  and July matches that rate exactly with her current discount; old's
  number fits nothing in her own history. Shoxrux Tilavoldiyev (group 838,
  July): v2's total matches the confirmed group rate for a full 13-lesson
  month; old's much lower number only makes sense if old captured 7 of
  those 13 lessons — a partial-month snapshot, not ground truth.
- **9 — plain ±1 attendance-count drift, not a bug.** Tested whether old's
  number fits *any* nearby day-count at the group's confirmed rate, and 9
  did: old computed for one fewer (or one more) day than v2 currently has.
  This is the same already-documented closed-backlog drift from the
  migration period (see `project_gennis_cutover` — old and v2 independently
  tracked the tail end of some months slightly differently), unrelated to
  price or discount. v2 is live/authoritative; old is frozen. No fix.
  (Shirin Ismoilova, Charos Nortojiyeva, Marjona Abduganiyeva, Mubina
  Keldiboyeva [July], Robiya Altay [group 902], Fariza Baxromova [groups
  920 & 911 — same 1-day drift explains why both showed identical diffs],
  Mexroj Holikulov.)
- **3 — false positive, verified against the raw per-lesson attendance
  log.** `gennis_lesson_attendance` is the single most authoritative source
  available (the actual dated record, not a derived total). Asliya
  Abdushokirova's log showed exactly 8 June lesson-days and 1 July
  lesson-day for group 726 — matching v2's `present_days` exactly and
  contradicting old's much higher implied day-counts outright. Shodiyona
  Muhammadova's log confirmed 2 June lesson-days for group 413; recomputing
  from scratch (price, her 120,000 charity, 2 lessons) landed within 3
  so'm of the stored value. v2 correct in both cases.
- **2 fixed — a live, individual instance of §13's original
  accumulation bug.** Robiya Altay (group 249, July) and Jasur Solmetov
  (group 920, July) both had `total_debt` values that fit no single
  uniform rate under any (total_lessons, discount_lessons) combination —
  confirmed by brute-forcing every reasonable parameterization
  computationally, all failing. Both rows predate §13's fix (`price_per_lesson`
  was still `NULL` on both), so they were still running the *old*
  accumulate-per-lesson-at-whatever-discount-was-standing formula. Testing
  a mixed-rate split confirms it: Robiya's 5 lessons decompose as 1 at full
  price + 4 at the discounted rate (within 13 so'm of stored); Jasur's 14
  as 2 full + 12 discounted (within 12 so'm). Both rows are closed and were
  never re-touched after §13 shipped, so they never got the chance to
  self-heal. Corrected to the uniform-discount value the current formula
  would produce — `148,075` (was `151,523`) and `280,000` (was `284,602`)
  — with the resulting surplus (`3,448` and `4,602`) moved to credit.

All 64 accounted for; nothing left open from this list.

### 18. Attendance-delete never decremented the day-counter unconditionally — found via a live billing complaint

A student's debt tab showed 8 billed lesson-days for August; the live
attendance log for the same month showed only 3. `8 × 27,692 (the
confirmed group rate) = 221,536` — exactly the row's `total_debt`. Temur
Sobirjonov (224526) was being billed for 5 lesson-days that had been
deleted, not lessons that happened.

Root cause: `_reverse_lesson_charge` (`history.py`) had the
`present_days`/`absent_days` decrement nested inside `if group.price > 0`
and, one level deeper, `if effective_charge > 0`. Deleting a lesson in a
free group, or one whose discount fully offset the price, silently skipped
the decrement entirely — the day-counter kept counting a lesson
`gennis_lesson_attendance` no longer had, and (if the group *did* have a
price) inflated `total_debt` for lessons never actually billed.

**Fix, deployed** (commit `83e1f2f`): the decrement now runs unconditionally,
before and independent of the price-gated block. Temur's row corrected
directly to match the log (`present_days=3, absent_days=0`,
`total_debt=83,076`).

**Scope, platform-wide scan** (`present_days + absent_days` on a row versus
the actual count of matching `gennis_lesson_attendance` rows, June–August
2026): **28 rows**.

- **1 fixed** — Temur, above.
- **4 fixed** — real, already-paid money, zero raw log for that specific
  month (a partial-month gap, same mechanism as Temur's, just caught by
  total absence of the log rather than a partial mismatch). `total_debt`/
  `present_days`/`absent_days` zeroed, the orphaned payment moved to
  credit: Adibaxon Arziyeva `123,080`, Ismoil Abduraximov `29,615`, Shoxrux
  Tilavoldiyev `9,227`, Robiya Altay `3,460`.
- **1 fixed, cosmetic only** — Jabbor Samandarov, a one-off individually-
  billed ("SH-Ind") group created and paid within the same 10-minute
  window by an admin, with no lesson-attendance log at all. The stored
  `total_debt` (`230,769`) itself divides cleanly by 3 lessons at the
  group's confirmed rate, not the 4 `present_days` on the row — corrected
  `present_days` 4→3 to match what was actually billed. Zero financial
  impact; money was already correctly settled either way.
- **~19 — harmless, `total_debt=0`, no fix needed.** Traced one (a student
  who transferred groups mid-month) to a leftover zero-charge row created
  under the new group before real billing started there — cosmetic, no
  money involved, same pattern in the rest.
- **3 — folded into already-known clusters, not new findings.** Two
  (students in group 12200/Tarix01) turned out to be the same mechanism as
  §19 below; one is Davlatbek Musulmonov's already-documented tangled case.

### 19. 21-row `remaining_debt < 0` cluster — 18 of 21 resolved

This cluster (Tarix01/group-12200 and a handful of others) has sat in
"Open for next session" since before today, flagged only as "needs
individual review." Root-caused today, prompted by the overlap found in
§18: `_reverse_lesson_charge` correctly reverses `total_debt` when a
lesson is deleted, but was never designed to reclaim a `payment` that had
already been applied against that debt. When an *entire month's* worth of
lessons for a group got deleted — an enrollment cancelled or reversed
after the fact, rather than one lesson corrected — `total_debt` correctly
went to 0, but the `payment` that had been validly applied against it
stayed stranded on the now-empty row instead of becoming available credit.
Because every debt-facing view sums only `remaining_debt > 0`, that
stranded money was simply invisible — not wrong in a way that overstated
anyone's debt, but real, already-paid money that wasn't counting toward
the family's balance anywhere.

Verified for every row before moving anything: summed `payment` across
each student's *entire* attendance history and compared against their real
`gennis_student_payment` ledger total. In every case the gap matched (often
exactly, sometimes exactly offset by an already-existing credit balance),
confirming the money was real and simply misplaced, not fabricated.

**Fixed — 18 rows, payment moved from the row to `GennisStudentCredit`:**

| Student | Amount |
|---|---|
| Shoxruza Baxtyorova | 384,995 |
| Jasmina Durdibayeva | 384,995 |
| Mamur Umaralieyav | 384,995 |
| Diyorbek Mirzaxmatov | 384,995 |
| Sardor Mingiboyev | 384,995 |
| MuhammadAziz Sultonov | 384,995 |
| Nodir Imomrasulov | 414,610 |
| Javohir Karimboyev | 261,527 |
| Mexruza Karimova | 236,920 |
| Robiya Altay | 130,757 |
| Azizbek Negmatullayev | 88,845 |
| Javlon To'ychiboyev | 110,769 |
| Diyorbek Xavazmatov | 33,076 |
| Ibroxim Nigmatullayev | 24 |
| Aslbek Asrorov | 133,841 |
| Sogdiyana Norxajayeva | 12 |

16 of these sat in group 12200 (Tarix01); the remaining 2 were the same
mechanism in unrelated groups. `remaining_debt < 0` row count: 21 → 3.

**Left open — 3 rows, all Davlatbek Musulmonov (231853, gennis_id 15385),
already named individually below.** His case doesn't fit this mechanism:
summed across his whole account, his real payment ledger (`1,580,000`) is
*exactly double* his attendance-history payment sum (`790,000`) — a clean
2.0× ratio, not a stray stuck payment, and his existing credit balance is
`0` (not absorbing the gap the way it did for the 18 above). That ratio
points at duplicate student registration — his money likely split across
two `gennis_student` records — rather than this bug. Moving his stranded
amount to credit would still leave him short by the same amount, so it
wouldn't actually resolve anything; left for the duplicate-registration
merge work (see Open below) instead.

### 20. Credit reconciliation could double-credit the same gap on repeated runs

Found while designing §19's fix: the credit-reconciliation logic itself
(in both `mark.py`'s `_update_history_debt_rows` and `history.py`'s
`_reverse_lesson_charge`) credits the *entire* current gap between
`total_debt` and `payment` every time it runs, but never reduces `payment`
to reflect what it just moved to credit. Either function can run
repeatedly against the same row — a month's lessons deleted one at a time,
or more lessons marked across an ongoing month — and each run re-compares
the same still-high `payment` against a newly-lower `total_debt`,
re-crediting the same already-reconciled gap on every subsequent run.

Concretely: a fully-paid 60 so'm row (2 lessons × 30) with both lessons
deleted one at a time credits 30 after the first deletion, then 60 more
after the second (since `payment` is still 60 for that second comparison)
— 90 credited total instead of the correct 60.

None of the 18 rows fixed in §19 were double-credited by this — they were
corrected directly from verified real numbers, not by letting the buggy
code run again — but the bug itself was live and would have kept
corrupting future occurrences of the same pattern.

**Fix, deployed** (commit `b5dbd3d`): both blocks now reduce `payment` by
the same surplus moved to credit, so a row's payment baseline only ever
reflects what its current `total_debt` actually justifies, however many
times it gets recomputed or reversed.

### 21. Davlatbek Musulmonov resolved — not duplicate registration, two separate gaps

§19 flagged his exact 2.0× ratio (real payments `1,580,000` vs
attendance-history payment sum `790,000`) as pointing at duplicate student
registration. Checked directly: no duplicate found. Searched `gennis_student`
by his phone, parent_phone, name+surname, and birth_date — the one same-phone
hit is a different person (a sibling, different name/birth_date/parent_phone).
The 2.0× was a coincidence of two separate, real gaps landing on the same
number by chance, not evidence of a split record.

**Gap 1 (790,000) — his own instance of §19's bug.** His 3 negative rows
(`74253`, `74254`, `72676`) sum to exactly `790,000`, matching payment
`60196` (790,000 click, 2026-07-21). Fixed the same way as the other 18 in
§19: verified against his real ledger, capped `payment` to 0 on the 3 rows,
moved 790,000 to credit.

**Gap 2 (790,000) — a payment never allocated at all.** Payment `58092`
(790,000 cash, paid 2026-06-03) has no matching entry anywhere — not on any
attendance-history row, not in credit. Both of his payments have `synced_at`
weeks after their real `paid_date` (58092: paid Jun 3, synced Aug 13; 60196:
paid Jul 21, synced Aug 4), and all 5 of his attendance-history rows show
`synced_at ≈ Aug 20` — created *after* both payments. Gap 1's three rows sum
to *exactly* one full payment, which only makes sense if some backfill/sync
process wrote raw payment amounts directly onto rows rather than running them
through `apply_payment`'s allocation logic — and for this second payment,
that process apparently never ran at all. Distinct from every other bug found
today: this money was never applied anywhere, not stuck after being applied.

Since he owes nothing (`total_debt=0` on all 5 rows), the fix is the same
`apply_payment` would have produced against a debt-free account: the full
790,000 moved directly to credit.

**Final state, verified**: `sum(row payments) + credit = 0 + 1,580,000 =
1,580,000`, matching his real payment ledger exactly. Fully resolved, no
debt owed, nothing left open for him.

### 22. Self-correction: today's own §17 batch fix had §20's bug

Found while triaging the 269-student negative-gap list (below). The
421+145-row price-drift batch fix (§16, `fix_price_drift_batch.py`) ran
*before* §20's cumulative-over-crediting bug was found and fixed — so it
carried the same flaw: it moved surplus to credit without capping
`payment`. Any of those rows touched again by live attendance-marking
afterward (before `b5dbd3d` deployed) would get double-credited on the next
recompute.

**348 rows actually hit this** (~11M so'm double-counted) — confirmed
credit was already correct from the original §16 fix, then capped
`payment = total_debt` on all 348 (balance-neutral: only removes the
duplicate count, doesn't touch credit or total_debt). This moved the
negative-gap list from a corrupted 451 students / −32M back down to
299 / −22.79M, in line with this doc's original 269/−22.3M scope.

Also fixed, unrelated to today: **39 pre-existing `payment > total_debt`
rows**, same "stuck payment on an invalid row" signature as §19's Tarix01
cluster. Verified each against the student's real payment ledger before
capping `payment` and moving the difference to credit — balance-neutral for
the gap formula (doesn't change `total_paid`), so it didn't move the
299/−22.79M number, but was a correctness fix worth doing regardless.

Platform-wide after both cleanups: `remaining_debt < 0` count = 0,
`payment > total_debt` count = 0.

### 23. 269/299 negative-gap list — triaged, no batch shortcut found

Sampled 3 students from the list (Shahzodabonu Sanjarova `226413`,
Dilmurod Abdulahadov `216255`, Shahzoda Aliyeva `216174`). All 3: real
payment ledger matches old-gennis exactly — the gap is entirely internal to
v2's own debt-row bookkeeping, not a payment problem. Same "old tangled
history" class as 216745/222918/232033/Davlatbek (before §21): payments
fall short of what's shown as applied, spread across many already-closed
rows, no single row to attribute it to.

**New lead, not resolved:** Sanjarova (226413) carries two attendance-history
groups (B44A102, C44A202 — different teachers, different prices) showing
*identical* `present_days` and `total_debt` for every month from Sep 2024
through Sep 2025, despite `gennis_student_group` showing no current
overlapping enrollment in both. Duplicate-shaped, but doesn't self-explain
the way Davlatbek's ratio did. Possibly connects to §24's cluster work —
worth checking first if that starts before this list gets picked up again.

No fast pattern-match fix found across the 3 sampled — recommend the next
pass budget real per-student time (old-gennis + raw-log cross-check, same
method as §17-19) rather than expecting a batch shortcut. 3-for-3 sampled
were genuine tangled history, not bugs, so that's the expected outcome
going in, not evidence the list can be dismissed as unfixable — just that
it needs the slow method.

### 24. 295 duplicate-registration clusters — scoped, not executed

**Could not reproduce "295" exactly.** Two clustering strategies against
`gennis_student` gave different counts: name+surname only (case-insensitive,
requiring overlapping `gennis_student_payment` date ranges) → 109 clusters,
~625.6M so'm; name+surname+phone (stricter) → 37 clusters, ~148.3M so'm. The
original query's exact matching logic isn't recoverable from this doc alone.
Doesn't change what needs to happen next — the phenomenon is real regardless
of which count is "correct."

**Top clusters hand-verified:**
- Robiya Ergasheva — 4 `gennis_student` records; 2 (`220875`, `223703`)
  share phone `975458582` with clearly overlapping payment date ranges,
  summing to `12,997,000` — matches this doc's `12.9M` figure exactly.
  Confirmed genuine. The other 2 records (different phones) unverified.
- Sevinch Bahromboyeva — exactly 2 records, identical phone. Clean,
  unambiguous duplicate.
- Gulzira Abdumannopova — 3 records; 2 share phone+parent_phone exactly
  (clean pair); the 3rd has a different phone — could be an updated
  contact or a coincidental name collision, unresolved without
  father_name/birth_date comparison.
- Akbarshox To'shpo'latov — not checked (apostrophe in the surname broke
  the query, not fixed).

Takeaway: phone match on top of name match is low-false-positive for
2-record clusters; 3+-record clusters need an extra signal (father_name,
birth_date) before assuming every record belongs together.

**Merge design (spec only, nothing executed):**

21 tables carry a `student_id` foreign key needing rows moved — more than
the obvious ones: `gennis_attendance_history_student`,
`gennis_student_payment`, `gennis_student_charity`, `gennis_student_credit`,
`gennis_lesson_attendance`, `gennis_student_group`,
`gennis_deleted_student_group`, `gennis_student_registration`,
`gennis_student_subject`, `gennis_student_test_v2`,
`gennis_teacher_black_salary_entry`, `gennis_student_book_payment`,
`gennis_deleted_student_book_payment`, `gennis_register_deleted_student`,
`debt_call_batch_member`, `gennis_parent_registration`,
`parent_child_link`, `lesson_plan_student` (plus `turon_*` tables that are
likely out of scope — different product, confirm before touching).

`gennis_student_credit` needs different handling than the rest: it has a
UNIQUE constraint on `student_id`, so a merge must **sum** both balances
into one row rather than re-pointing rows onto the canonical id.

Canonical-id selection should be by activity level (payment count +
attendance row count), not `min(id)`/oldest — an early registration with
one payment shouldn't win over a later one with years of real enrollment.

Process per confirmed cluster: verify via phone/parent_phone/birth_date
(never name alone) → snapshot pre-merge sums per table per id → move rows
→ sum-merge credit → mark the losing `gennis_student` inactive (repurpose
`blocked`, or add a `merged_into_id` column) rather than deleting it → 
re-sum the canonical id post-merge and confirm it equals the pre-merge
combined total, same "sum before == sum after" discipline used throughout
this doc. Any mismatch aborts, nothing commits.

No script was written or run. Recommend building it with a `--dry-run`
default (prints planned moves + the sum-check, writes nothing) before any
`--apply` mode, following `fix_price_drift_batch.py`'s pattern.

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

- **§16's 64 discount-differs rows** — resolved in full, see §17. Nothing
  left open from this item.
- **Davlatbek Musulmonov (231853)** — resolved in full, see §21. Not
  duplicate registration (checked and ruled out) — two separate real gaps
  (§19's stuck-payment bug, plus a second payment that was never allocated
  anywhere) that happened to sum to the same 790,000 by coincidence. Fully
  reconciled: `sum(row payments) + credit` matches his real payment ledger
  exactly. Nothing left open for him.
- **269 students remaining in the negative-gap list** — corrected to
  **299 / −22.79M** after fixing a self-inflicted double-count from §16's
  batch fix (see §22). Sampled 3 so far (§23): all genuine "old tangled
  history," no fast fix found — recommend the slow per-student method
  (§17-19's cross-check discipline), not another batch attempt. One new
  lead: Sanjarova (226413) shows a duplicate-shaped pattern (two groups,
  identical numbers for 13 straight months) — check for a connection to the
  295-cluster work below before spending fresh time on her specifically.
- **295 duplicate-student-registration clusters** — scoped in full, see
  §24, not executed. The exact "295" count couldn't be reproduced (109 or
  37 clusters depending on match strictness); top clusters hand-verified
  (Robiya Ergasheva confirmed exactly, 12.9M; Sevinch Bahromboyeva confirmed;
  Gulzira Abdumannopova mostly confirmed, one ambiguous 3rd record;
  Akbarshox To'shpo'latov not checked). Full merge design is written in
  §24 — 21 tables need `student_id` rows moved, `gennis_student_credit`
  needs sum-merging (UNIQUE constraint), canonical id by activity level not
  age. No script written yet; next session should build it with
  `--dry-run` first, following `fix_price_drift_batch.py`'s pattern, then
  test against Sevinch Bahromboyeva's clean 2-record case before anything
  ambiguous.
- **216745, 222918, 232033** — still show the "old tangled history" pattern
  (real payments fall meaningfully short of what's shown as applied, spread
  across many already-"fully paid" rows going back to 2022-2024, with no
  single row to cleanly attribute the gap to). Left untouched; needs a
  different investigative approach than anything used today, possibly a
  full old-gennis-vs-v2 row-by-row diff for each rather than the aggregate
  formula.
