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

## Still open

- **3,711 payments (836m)** name a month with no history row. 2,941 of them are for
  months *after* the student's last charged month — advance payments, now surfacing as
  credit rather than being applied.
- The old-gennis reads in gennis-v2 (`studying.py:203`, `profile.py:221`,
  `groups/detail.py:140`, `rooms/router.py:89`) can now be removed: every student has a
  credit row, so the fallback is unreachable in practice. That also allows dropping
  `GENNIS_DB_URL`.
- Duplicate student records among the Turon-group registrations of 2026-07-08/09 —
  e.g. "Dilnura Mirtursunova" as both 232452 and 232477. Their charges are cleared but
  the duplicate rows remain.
