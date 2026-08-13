-- Import 8 monthly charge rows that exist in old gennis but never reached v2.
--
-- FOUND BY looking for months where a student has lesson attendance in v2 but no
-- gennis_attendance_history_student row, then checking each one against the LIVE
-- old gennis database (not the stale gennis_staging snapshot, which stops at
-- 2026-07-15 and cannot see August at all).
--
-- Of 61 such student-months, 8 have a charge row in old gennis — these. The other
-- 53 have no charge row there either, so they were never billed in either system
-- and are a business decision, not a data fix. Importing only these 8 avoids
-- double-charging students who were already invoiced, several of whom have paid.
--
-- PAYMENT SEMANTICS
-- Old gennis's `payment` column is unreliable — it reads 0 on rows whose
-- remaining_debt is also 0, i.e. rows that are demonstrably settled. What is
-- consistent is the outcome, so payment is derived:
--
--     payment = total_debt - remaining_debt
--
-- That is not a guess: on the two rows where old gennis DOES record a payment it
-- reproduces the stored value exactly (28,456 for student 15931 and 85,380 for
-- 15932). remaining_debt is taken from old gennis as authoritative — it is what
-- that system tells the student they owe.
--
-- SIGN: old gennis stores these amounts negative (63,978 of its 68,677 rows);
-- v2 stores them positive. The values below are already absolute.
--
-- CONSEQUENCE WORTH KNOWING: for some of these students this pushes total applied
-- payment above what their payment records explain, because old gennis recorded a
-- settlement v2 has no payment row for. That is the same category as the 509 rows
-- left alone in apply_student_payments.sql, and it means their surplus - and so
-- their displayed credit - drops. Re-run rebuild_student_credit.sql (surplus-only)
-- afterwards and the balances follow.
--
-- Re-runnable: inserts only where the row is still absent.
--
-- Usage:  psql -v apply=0   -- dry run (DEFAULT)
--         psql -v apply=1   -- write

\if :{?apply} \else \set apply 0 \endif

BEGIN;

CREATE TEMP TABLE incoming (
    old_student_id int, old_group_id int, yr int, mo int,
    total_debt bigint, remaining_debt bigint, total_discount bigint, location_id int
) ON COMMIT DROP;

INSERT INTO incoming VALUES
    (16092, 928, 2026, 7,  61538,      0,     0, 2),
    (13316, 670, 2026, 8, 115385,      0, 26925, 5),
    (16094, 670, 2026, 8, 142310,      0,     0, 5),
    (15932, 670, 2026, 8, 113848,  28468,     0, 5),
    (16046, 670, 2026, 8,  28462,      0,     0, 5),
    (15968, 670, 2026, 8,  28462,      0,     0, 5),
    (15931, 670, 2026, 8, 142310, 113854,     0, 5),
    (15930, 670, 2026, 8, 115385,      0, 26925, 5);

CREATE TEMP TABLE plan ON COMMIT DROP AS
SELECT
    s.id                              AS student_id,
    trim(coalesce(s.name,'') || ' ' || coalesce(s.surname,'')) AS student_name,
    g.id                              AS group_id,
    g.name                            AS group_name,
    g.subject_id,
    i.total_debt,
    i.total_debt - i.remaining_debt   AS payment,
    i.remaining_debt,
    i.total_discount,
    i.location_id,
    i.mo                              AS calendar_month,
    i.yr                              AS calendar_year,
    (i.remaining_debt = 0)            AS status
FROM incoming i
JOIN gennis_student s ON s.gennis_id = i.old_student_id
JOIN gennis_group   g ON g.gennis_id = i.old_group_id
WHERE NOT EXISTS (
    SELECT 1 FROM gennis_attendance_history_student h
    WHERE h.student_id = s.id
      AND h.calendar_year = i.yr
      AND h.calendar_month = i.mo
);

\echo ''
\echo '=== rows to import ==='
SELECT student_id, student_name, group_name, calendar_year AS yr, calendar_month AS mo,
       total_debt, payment, remaining_debt, total_discount, status
FROM plan ORDER BY calendar_year, calendar_month, student_id;

\echo ''
\echo '=== every incoming row resolved to a student and group? (expect 8 / 8) ==='
SELECT (SELECT count(*) FROM incoming) AS incoming,
       (SELECT count(*) FROM plan)     AS resolved_and_absent;

\if :apply
    \echo ''
    \echo '>>> APPLYING <<<'

    INSERT INTO gennis_attendance_history_student
        (student_id, student_name, group_id, group_name, subject_id,
         total_debt, payment, remaining_debt, total_discount,
         location_id, calendar_month, calendar_year, status)
    SELECT student_id, student_name, group_id, group_name, subject_id,
           total_debt, payment, remaining_debt, total_discount,
           location_id, calendar_month, calendar_year, status
    FROM plan;

    \echo ''
    \echo '=== after ==='
    SELECT h.student_id, h.group_name, h.calendar_year AS yr, h.calendar_month AS mo,
           h.total_debt, h.payment, h.remaining_debt, h.status
    FROM gennis_attendance_history_student h
    JOIN plan p ON p.student_id = h.student_id
               AND p.calendar_year = h.calendar_year
               AND p.calendar_month = h.calendar_month
    ORDER BY h.calendar_year, h.calendar_month, h.student_id;

    COMMIT;
\else
    \echo ''
    \echo '(dry run - nothing written. re-run with -v apply=1)'
    ROLLBACK;
\endif
