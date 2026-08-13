-- Zero out 2026 monthly charges for months the student did not attend at all.
--
-- WHY THESE EXIST
-- Until commit 558c681 ("deleting a lesson now reverses the money/salary it
-- caused"), deleting a lesson left its charge on the student's monthly row. The
-- residue is a row that bills for lessons that no longer exist. July 2026 is the
-- hotspot, which fits: that is the window before the fix landed.
--
-- WHAT COUNTS AS PHANTOM
-- The student has ZERO lesson records in that calendar month, in ANY group.
-- Matching on group as well would be wrong - students move between groups and the
-- history row can carry a different group_id than the lessons (that mistake made
-- the problem look 14x bigger on a first pass: 727 August rows that turned out to
-- be students who did attend, just under another group id).
--
-- SCOPE: 2026 only, per instruction. 2023 has 116 similar rows (1.3m so'm) which
-- are old and largely settled; unpicking them now would disturb closed books.
-- 2022 is excluded automatically - gennis_lesson_attendance has no 2022 data, so
-- "no lessons" there means "no data", not "did not attend".
--
-- WHAT IT WRITES
-- total_debt, remaining_debt, total_discount and payment all go to 0 and the row
-- is marked settled. Payment is zeroed too, deliberately: any money that had been
-- allocated to a phantom month must return to the student's pool rather than be
-- stranded against a charge that never should have existed. Re-running
-- apply_student_payments.sql afterwards redistributes it to real unpaid months,
-- and whatever is left becomes credit in rebuild_student_credit.sql.
--
-- The BEFORE listing below is the audit trail - the original values are printed
-- in full before they are overwritten.
--
-- Usage:  psql -v apply=0   -- dry run (DEFAULT)
--         psql -v apply=1   -- write

\if :{?apply} \else \set apply 0 \endif

BEGIN;

CREATE TEMP TABLE phantom ON COMMIT DROP AS
WITH lessons AS (
    SELECT student_id,
           extract(year  FROM lesson_date)::int AS yr,
           extract(month FROM lesson_date)::int AS mo,
           count(*) AS n
    FROM gennis_lesson_attendance
    GROUP BY 1, 2, 3
)
SELECT h.id, h.student_id, h.student_name, h.group_name,
       h.calendar_year AS yr, h.calendar_month AS mo,
       h.total_debt, h.payment, h.total_discount, h.remaining_debt, h.status
FROM gennis_attendance_history_student h
LEFT JOIN lessons l
       ON l.student_id = h.student_id
      AND l.yr = h.calendar_year
      AND l.mo = h.calendar_month
WHERE h.calendar_year = 2026
  AND h.total_debt > 0
  AND l.n IS NULL;          -- attended nothing that month, in any group

\echo ''
\echo '=== BEFORE (audit trail - these are the values being cleared) ==='
SELECT id, student_id, student_name, group_name, yr, mo,
       total_debt, payment, total_discount, remaining_debt
FROM phantom ORDER BY yr, mo, student_id, id;

\echo ''
\echo '=== totals ==='
SELECT count(*) AS rows, count(DISTINCT student_id) AS students,
       sum(total_debt) AS charge_removed,
       sum(remaining_debt) AS debt_removed,
       sum(payment) AS payment_returned_to_pool
FROM phantom;

\if :apply
    \echo ''
    \echo '>>> APPLYING <<<'

    UPDATE gennis_attendance_history_student h
    SET total_debt     = 0,
        remaining_debt = 0,
        total_discount = 0,
        payment        = 0,
        status         = true
    FROM phantom p
    WHERE h.id = p.id;

    \echo ''
    \echo '=== after: Visola (232277) ==='
    SELECT calendar_year AS yr, calendar_month AS mo, group_name,
           total_debt, payment, remaining_debt, status
    FROM gennis_attendance_history_student
    WHERE student_id = 232277 ORDER BY calendar_year, calendar_month, group_name;

    \echo ''
    \echo '=== any 2026 phantom rows left? (expect none) ==='
    WITH lessons AS (
        SELECT student_id, extract(year FROM lesson_date)::int AS yr,
               extract(month FROM lesson_date)::int AS mo, count(*) AS n
        FROM gennis_lesson_attendance GROUP BY 1,2,3)
    SELECT count(*) AS remaining_phantom
    FROM gennis_attendance_history_student h
    LEFT JOIN lessons l ON l.student_id=h.student_id AND l.yr=h.calendar_year
                       AND l.mo=h.calendar_month
    WHERE h.calendar_year = 2026 AND h.total_debt > 0 AND l.n IS NULL;

    COMMIT;
\else
    \echo ''
    \echo '(dry run - nothing written. re-run with -v apply=1)'
    ROLLBACK;
\endif
