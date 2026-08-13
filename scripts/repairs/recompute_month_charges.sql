-- Recompute ONE month's charge rows from the lesson records.
--
-- Generalised from recompute_august_2026_charges.sql, which is kept as the record of
-- the August run. Read that file's header for why neither v2 nor old gennis holds a
-- usable figure for a month, and — important — why discounts must NOT be derived from
-- gennis_student_charity (316 August rows carried a discount and only 10 had a charity
-- row; deriving would have withdrawn ~1.7m and overcharged 306 students).
--
-- March-July 2026 carry the same shortfall August did: lessons imported by
-- sync_attendance.py were never charged, and the gap grows month by month —
--     Mar  2,438,621   Apr  8,504,624   May 11,027,579
--     Jun 12,215,034   Jul 23,764,122
--
-- Do ONE MONTH AT A TIME and read the dry run before applying. This is real money on
-- real students, and more than once during this work a plausible-looking measurement
-- turned out to be keyed against the wrong id space.
--
-- RUN AFTERWARDS: apply_student_payments.sql then rebuild_student_credit.sql.
--
-- Usage:
--   psql -v yr=2026 -v mo=7             -- dry run (DEFAULT)
--   psql -v yr=2026 -v mo=7 -v apply=1  -- write

\if :{?apply} \else \set apply 0 \endif

BEGIN;

CREATE TEMP TABLE want ON COMMIT DROP AS
WITH les AS (
    SELECT a.student_id, a.group_id, count(*) AS lessons
    FROM gennis_lesson_attendance a
    WHERE a.lesson_date >= (:yr || '-' || lpad(:'mo', 2, '0') || '-01')::date AND a.lesson_date < ((:yr || '-' || lpad(:'mo', 2, '0') || '-01')::date + interval '1 month')::date
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
      AND ch.calendar_year = :yr AND ch.calendar_month = :mo AND ch.deleted = false
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
      AND h.calendar_year = :yr AND h.calendar_month = :mo
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
\echo '=== what the month becomes ==='
SELECT count(*) AS pairs, sum(lessons) AS lessons,
       sum(total_debt) AS new_charge, sum(total_discount) AS discounts
FROM plan;

\echo ''
\echo '=== what it replaces ==='
SELECT count(*) AS rows_removed, sum(total_debt) AS charge_removed,
       sum(payment) AS payment_released, sum(remaining_debt) AS debt_removed
FROM gennis_attendance_history_student h
WHERE h.calendar_year = :yr AND h.calendar_month = :mo
  AND EXISTS (SELECT 1 FROM plan p
              WHERE p.student_id = h.student_id
                AND (h.group_id = p.group_id OR h.group_id = p.old_group_id));

\echo ''
\echo '=== rows left alone (no lesson records, cannot be recomputed) ==='
SELECT count(*) AS untouched_rows, sum(total_debt) AS their_charge
FROM gennis_attendance_history_student h
WHERE h.calendar_year = :yr AND h.calendar_month = :mo
  AND NOT EXISTS (SELECT 1 FROM plan p
                  WHERE p.student_id = h.student_id
                    AND (h.group_id = p.group_id OR h.group_id = p.old_group_id));

\echo ''
\echo '=== sample: biggest changes ==='
SELECT p.student_id, p.student_name, p.group_name, p.lessons,
       COALESCE((SELECT sum(total_debt) FROM gennis_attendance_history_student h
                 WHERE h.student_id=p.student_id AND h.calendar_year = :yr
                   AND h.calendar_month = :mo
                   AND (h.group_id=p.group_id OR h.group_id=p.old_group_id)),0) AS was,
       p.total_debt AS becomes
FROM plan p ORDER BY p.total_debt DESC LIMIT 10;

\if :apply
    \echo ''
    \echo '>>> APPLYING <<<'

    DELETE FROM gennis_attendance_history_student h
    USING plan p
    WHERE h.calendar_year = :yr AND h.calendar_month = :mo
      AND h.student_id = p.student_id
      AND (h.group_id = p.group_id OR h.group_id = p.old_group_id);

    INSERT INTO gennis_attendance_history_student
        (student_id, student_name, group_id, group_name, subject_id,
         total_debt, payment, remaining_debt, total_discount,
         location_id, calendar_month, calendar_year, status)
    SELECT student_id, student_name, group_id, group_name, subject_id,
           total_debt, 0, total_debt, total_discount,
           location_id, :mo, :yr, (total_debt = 0)
    FROM plan;

    \echo ''
    \echo '=== after ==='
    SELECT count(*) AS aug_rows, sum(total_debt) AS charged, sum(remaining_debt) AS owed
    FROM gennis_attendance_history_student WHERE calendar_year = :yr AND calendar_month = :mo;

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
