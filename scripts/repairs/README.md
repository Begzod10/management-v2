# Student balance repair — 2026-08-13

One-off repairs to student balance data in the `management` database, run after the
cutover from old gennis. They are kept here as the record of what was changed and
why; all three have been applied to production and are now no-ops.

Each script defaults to a dry run and only writes with `-v apply=1`:

```bash
ssh turon-server 'docker exec -i management_db psql -U postgres -d management' < zero_phantom_charges.sql
ssh turon-server 'docker exec -i management_db psql -U postgres -d management -v apply=1' < zero_phantom_charges.sql
```

## What was wrong

Balances were being read from three places that disagreed. The students list computed
a balance by querying the **old gennis database live** (`studying.py:202-218`), while
the profile and Task Manager summed `remaining_debt` from `gennis_attendance_history_student`.
For one student the same balance showed as `3`, `-1,126,143` and `-1,126,143`.

The calculation itself was never wrong. `apply_payment` (gennis-v2
`services/payments.py:174`) already implements old gennis's rule exactly — a payment
settles the oldest unpaid months first, whatever it names, and the remainder becomes
credit. Its *inputs* were wrong:

1. **Payments were not recorded on the monthly rows.** Old gennis kept those rows with
   negative amounts and `payment = 0`, tracking settlement through the sign of
   `remaining_debt`. v2 expects positive amounts with `payment` populated. The sync
   flipped signs (hence the `ABS()` still visible in `studying.py:209`) but had nothing
   to reconstruct `payment` from, so 5,441 rows claimed nothing had ever been paid.

2. **Some 2026 rows charged for months with no attendance.** Until gennis-v2 commit
   `558c681`, deleting a lesson left its charge behind. July 2026 is the hotspot,
   matching the window before that fix.

## Run order

`zero_phantom_charges.sql` → `apply_student_payments.sql` → `rebuild_student_credit.sql`

Clear the bogus charges first, then allocate payments against what is genuinely owed,
then derive the balance. Running them out of order is not harmful — each recomputes
from ground truth — but it takes an extra pass to converge.

| script | effect when applied |
|---|---|
| `zero_phantom_charges.sql` | 52 rows / 43 students; removed 9,442,644 charged, 7,307,201 owed |
| `apply_student_payments.sql` | 5,441 rows; applied 649,367,418 |
| `rebuild_student_credit.sql` | `gennis_student_credit` 287 → 10,587 rows |
| `clamp_credit_to_surplus.sql` | 3,196 rows set to 0 — see below |
| `import_missing_history_rows.sql` | 8 charge rows that exist in old gennis but never reached v2 |
| `import_august_charge_rows.sql` | ⚠️ **WRONG — do not run.** Inserted 546 duplicates |
| `undo_duplicate_august_rows.sql` | removed those 546; kept the 7 that were genuinely new |

### The group_id trap — read this before measuring "missing" rows

`gennis_attendance_history_student.group_id` holds **two different id spaces**:

- rows synced from old gennis store the **old gennis** group id (e.g. `605`)
- rows created by `attendance/mark.py` store the **management** `gennis_group.id`
  (e.g. `12014`)

`gennis_lesson_attendance.group_id` is always the management id — `sync_attendance.py`
translates it. So comparing the two tables on `group_id` silently fails for every row
stored under the old convention, and makes existing charge rows look missing.

That is exactly what happened: 615 (student, group) pairs looked unbilled for August
2026, 553 were "imported", and 546 of those turned out to be duplicates of rows that
were there all along. Verified concretely — student 215480, August 2026, E13A1-10:

```
id 69049  group_id   605  total_debt  30,769  synced 2026-08-04   already there
id 70185  group_id 12014  total_debt 123,076  synced 2026-08-13   the duplicate
```

Match on `(student_id, calendar_year, calendar_month, group_name)` instead —
`group_name` is denormalized on both sides and does not depend on the id space.

`import_missing_history_rows.sql` escaped this because it keyed on student+month for
students with **no** row at all, so it never compared a group_id. Its 8 rows were
checked afterwards: 0 duplicates.

### Still unresolved: the same collision happens without any script

`mark.py` writes the management group id while the sync writes the old gennis one, so
both can create a row for the same (student, group, month). **143 duplicate sets exist
in August 2026 alone** that nothing in this directory created, holding 4,855,142 so'm
of duplicated 2026 debt. That is a live double-counting bug in the application, not a
migration artefact, and it needs fixing at the source.

`rebuild_student_credit.sql` now computes `GREATEST(0, paid - applied)` directly,
so `clamp_credit_to_surplus.sql` is only of historical interest — it is what
corrected the already-written net balances. A fresh run needs the rebuild alone.

Run order for a fresh repair:
`zero_phantom_charges` → `import_missing_history_rows` → `apply_student_payments`
→ `rebuild_student_credit`.

### Why the fourth script exists

`rebuild_student_credit.sql` wrote a NET balance (negative for students in debt).
Hours later, gennis-v2 commit `e038344` settled the opposite convention:
`gennis_attendance_history_student` is the single source of truth for debt, and
`GennisStudentCredit` holds payment surplus only. The display code reconciles the
two with `-max(debt, -credit)`, taking whichever claims more is owed — safe while
the negative rows agree with the history, but the stale value wins once debt is
paid down. Within hours that had already overstated 415 students by 42,505,188
so'm. Clamping the negatives to zero leaves debt with exactly one writer.

A fresh run should therefore end with the clamp, or simpler: change the rebuild's
formula to `GREATEST(0, paid - applied)` and skip the net-balance step entirely.

## What makes the result trustworthy

- The allocation reproduces the value old gennis stores on **91.5% of all 70,176 rows**
  without changing them.
- Two students were checked by hand and match to the som: Visola (232277) ends at
  `3`, the exact figure old gennis shows; Madina (228620) at `-30,782`, and her
  2026-08 row computes `payment = 1,526`, matching old gennis's `Tolov 1526`.
- After allocation, **zero** students hold both a surplus and outstanding debt —
  what you would expect if the allocation is right.

## Deliberately not touched

- **509 rows / 417 students / 43,039,120** where the stored `payment` exceeds what the
  payment records explain. Deleted payments account for only 2.9m of that; the rest is
  something the data cannot show — discounts, charity, or payments that never synced.
  Lowering them would erase a real settlement, so `payment` is only ever raised.
- **2023 phantom charges** (116 rows, 1.3m). Old and largely settled.
- **2022 entirely.** `gennis_lesson_attendance` holds no 2022 data, so "no lessons"
  there means "no data", not "did not attend".

## A trap worth remembering

The first measurement of phantom charges gave 7,121 rows. It was wrong twice: it joined
lessons on `group_id` (students change groups, so their lessons sit under a different id
than the history row) and it counted 2022, where there is no lesson data at all. Joining
on student + month and restricting to years with lesson coverage gives the real number:
52. Acting on the first figure would have wiped out ~1.27 billion so'm of legitimate
charges.

## Orphan payments — checked, not a fault

3,711 payments (836m) name a month with no history row, but the money is not lost:
the allocation pools every payment and spreads it oldest-first regardless of the
month it names. Afterwards 10,164 of 10,580 students have credit exactly equal to
their surplus, **no** student is under-credited, and **no** student holds both a
surplus and a debt. Most of it is advance payment — 2,941 of the 3,711 are for
months after the student's last charged month.

Looking from the other side — months a student *attended* but was never charged —
found 61 student-months with a gennis_id. Checked individually against the LIVE old
gennis database (not `gennis_staging`, which stops at 2026-07-15 and cannot see
August):

- **8** have a charge row in old gennis → a sync gap, imported by
  `import_missing_history_rows.sql`. Billing these afresh would have double-charged
  students who were already invoiced, several of whom had paid.
- **53** have no charge row there either → never billed in either system. Left alone:
  charging a student for a lesson neither system ever billed is a business decision.

## Still open
- The old-gennis reads in gennis-v2 (`studying.py:203`, `profile.py:221`,
  `groups/detail.py:140`, `rooms/router.py:89`) can now be removed: every student has a
  credit row, so the fallback is unreachable in practice. That also allows dropping
  `GENNIS_DB_URL`.
- Duplicate student records among the Turon-group registrations of 2026-07-08/09 —
  e.g. "Dilnura Mirtursunova" as both 232452 and 232477. Their charges are cleared but
  the duplicate rows remain.
