-- Recompute August 2026 charge rows from the lesson records.
--
-- WHY NEITHER EXISTING SOURCE IS USABLE AS-IS
--   v2 as it stands      :  59,244,533  — only the lessons mark.py processed
--   old gennis           : 103,264,261  — only the lessons it saw before shutdown
--   lessons say          : 138,620,395  — the whole month
--
-- Three mechanisms each captured a slice and none holds the month: sync_attendance.py
-- imported lessons without charges, mark.py charged only what was marked through v2,
-- and the accounting sync froze old gennis's figures at whenever it last ran. Copying
-- old gennis over would still leave ~35m missing, because 992 August lessons exist
-- only in v2 (marked on the 12th-13th, after old gennis stopped seeing them).
--
-- v2's gennis_lesson_attendance is now the complete record — it holds old gennis's
-- lessons (synced) plus those 992 — so the month is recomputed from it.
--
-- THE FORMULA is attendance/mark.py's, including its integer truncation, so future
-- marking continues on the same basis rather than drifting from a different rounding:
--     per_lesson  = int(group.price / group.attendance_days)
--     disc/lesson = int(charity.discount / group.attendance_days)
--     total_debt      = lessons * max(0, per_lesson - disc_per_lesson)
--     total_discount  = lessons * disc_per_lesson
-- Absences are charged (confirmed), so every lesson row counts, came or not.
-- attendance_days is the correct divisor (confirmed).
--
-- SCOPE — only (student, group) pairs that HAVE August lessons. About 151 August rows
-- have no lesson records at all; those cannot be recomputed, so they are left exactly
-- as they are rather than being zeroed out on an assumption.
--
-- This also dissolves the 190 remaining old-convention collisions: for an affected
-- pair both the old-group_id row and the management-group_id row are removed and one
-- correct row is written, so no per-pair merge rule is needed.
--
-- payment is deliberately set to 0 and left for apply_student_payments.sql to
-- allocate from the student's actual payment records — the same rule used everywhere
-- else here, and the reason payment is never taken from either side.
--
-- RUN AFTERWARDS: apply_student_payments.sql then rebuild_student_credit.sql.
--
-- Usage:  psql -v apply=0   -- dry run (DEFAULT)
--         psql -v apply=1   -- write

\if :{?apply} \else \set apply 0 \endif

BEGIN;

CREATE TEMP TABLE want ON COMMIT DROP AS
WITH les AS (
    SELECT a.student_id, a.group_id, count(*) AS lessons
    FROM gennis_lesson_attendance a
    WHERE a.lesson_date >= date '2026-08-01' AND a.lesson_date < date '2026-09-01'
    GROUP BY 1, 2
)
SELECT
    l.student_id,
    l.group_id,
    g.gennis_id                                   AS old_group_id,
    g.name                                        AS group_name,
    g.subject_id,
    g.location_id,
    l.lessons,
    (g.price / g.attendance_days)::int            AS per_lesson,
    (COALESCE(ch.discount, 0) / g.attendance_days)::int AS disc_per_lesson,
    trim(coalesce(s.name,'') || ' ' || coalesce(s.surname,'')) AS student_name
FROM les l
JOIN gennis_group   g ON g.id = l.group_id
JOIN gennis_student s ON s.id = l.student_id
LEFT JOIN gennis_student_charity ch
       ON ch.student_id = l.student_id AND ch.group_id = l.group_id
      AND ch.calendar_year = 2026 AND ch.calendar_month = 8 AND ch.deleted = false
WHERE g.price > 0 AND g.attendance_days > 0;

-- Discounts must NOT be recomputed from gennis_student_charity alone. 316 August
-- rows carry a discount (1,926,335 in total) and only 10 of them have a charity
-- row: the rest were granted through old gennis's own per-lesson mechanism, which
-- never landed in that table. Deriving from charity would quietly withdraw ~1.7m
-- of discounts and overcharge 306 students.
--
-- So the discount already recorded on the rows being replaced is carried over, and
-- the charity-derived figure is used only when it is larger. Whichever way the two
-- disagree, the student keeps the bigger discount — the error that costs them money
-- is the one worth avoiding.
CREATE TEMP TABLE existing_discount ON COMMIT DROP AS
SELECT w.student_id, w.group_id,
       COALESCE(sum(h.total_discount), 0) AS recorded
FROM want w
LEFT JOIN gennis_attendance_history_student h
       ON h.student_id = w.student_id
      AND (h.group_id = w.group_id OR h.group_id = w.old_group_id)
      AND h.calendar_year = 2026 AND h.calendar_month = 8
GROUP BY 1, 2;

CREATE TEMP TABLE plan ON COMMIT DROP AS
SELECT w.student_id, w.group_id, w.old_group_id, w.group_name, w.subject_id,
       w.location_id, w.student_name, w.lessons,
       GREATEST(0, w.lessons * w.per_lesson
                   - GREATEST(w.lessons * w.disc_per_lesson, e.recorded)) AS total_debt,
       GREATEST(w.lessons * w.disc_per_lesson, e.recorded)                AS total_discount
FROM want w
JOIN existing_discount e USING (student_id, group_id);

\echo ''
\echo '=== what August becomes ==='
SELECT count(*) AS pairs, sum(lessons) AS lessons,
       sum(total_debt) AS new_charge, sum(total_discount) AS discounts
FROM plan;

\echo ''
\echo '=== what it replaces ==='
SELECT count(*) AS rows_removed, sum(total_debt) AS charge_removed,
       sum(payment) AS payment_released, sum(remaining_debt) AS debt_removed
FROM gennis_attendance_history_student h
WHERE h.calendar_year = 2026 AND h.calendar_month = 8
  AND EXISTS (SELECT 1 FROM plan p
              WHERE p.student_id = h.student_id
                AND (h.group_id = p.group_id OR h.group_id = p.old_group_id));

\echo ''
\echo '=== August rows left alone (no lesson records, cannot be recomputed) ==='
SELECT count(*) AS untouched_rows, sum(total_debt) AS their_charge
FROM gennis_attendance_history_student h
WHERE h.calendar_year = 2026 AND h.calendar_month = 8
  AND NOT EXISTS (SELECT 1 FROM plan p
                  WHERE p.student_id = h.student_id
                    AND (h.group_id = p.group_id OR h.group_id = p.old_group_id));

\echo ''
\echo '=== sample: biggest changes ==='
SELECT p.student_id, p.student_name, p.group_name, p.lessons,
       COALESCE((SELECT sum(total_debt) FROM gennis_attendance_history_student h
                 WHERE h.student_id=p.student_id AND h.calendar_year=2026
                   AND h.calendar_month=8
                   AND (h.group_id=p.group_id OR h.group_id=p.old_group_id)),0) AS was,
       p.total_debt AS becomes
FROM plan p ORDER BY p.total_debt DESC LIMIT 10;

\if :apply
    \echo ''
    \echo '>>> APPLYING <<<'

    DELETE FROM gennis_attendance_history_student h
    USING plan p
    WHERE h.calendar_year = 2026 AND h.calendar_month = 8
      AND h.student_id = p.student_id
      AND (h.group_id = p.group_id OR h.group_id = p.old_group_id);

    INSERT INTO gennis_attendance_history_student
        (student_id, student_name, group_id, group_name, subject_id,
         total_debt, payment, remaining_debt, total_discount,
         location_id, calendar_month, calendar_year, status)
    SELECT student_id, student_name, group_id, group_name, subject_id,
           total_debt, 0, total_debt, total_discount,
           location_id, 8, 2026, (total_debt = 0)
    FROM plan;

    \echo ''
    \echo '=== after ==='
    SELECT count(*) AS aug_rows, sum(total_debt) AS charged, sum(remaining_debt) AS owed
    FROM gennis_attendance_history_student WHERE calendar_year=2026 AND calendar_month=8;

    \echo ''
    \echo '=== old-convention group_ids left anywhere (was 190) ==='
    SELECT count(*) FROM gennis_attendance_history_student o
    WHERE EXISTS (SELECT 1 FROM gennis_group g WHERE g.gennis_id = o.group_id)
      AND NOT EXISTS (SELECT 1 FROM gennis_group g WHERE g.id = o.group_id);

    COMMIT;
\else
    \echo ''
    \echo '(dry run - nothing written. -v apply=1 to perform it)'
    ROLLBACK;
\endif
