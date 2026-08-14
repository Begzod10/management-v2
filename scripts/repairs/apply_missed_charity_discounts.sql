-- Give students the charity discount they were granted but never received.
--
-- CAUSE
-- Attendance marking looks a charity up by (student, group), joining on the local
-- gennis_group.id. 1,219 of 1,237 charity rows held an untranslated OLD-gennis
-- group_id, so the join found nothing and the lesson was charged at full price.
-- fix_charity_untranslated_ids.sql corrected the ids and gennis-v2 fbaff7a fixed the
-- lookup, but both only affect marking from now on — every month already marked was
-- billed without the discount.
--
-- 451 rows across 435 students, Jan–Aug 2026. Each has a live charity for exactly
-- that student and group, and total_discount = 0.
--
-- HOW MUCH
-- A charity is a MONTHLY allowance spread over the month's lessons: each lesson is
-- discounted by discount/attendance_days (attendance/mark.py, and old gennis'
-- teacher/teacher.py:302). A month with N lessons is therefore owed
-- N * (discount/attendance_days) — not the whole charity. Deriving it any other way
-- over-credits a partial month.
--
-- THE MODEL
-- total_debt is already NET of any discount — marking subtracts it per lesson and
-- records what it took off in total_discount, which is why remaining_debt is
-- total_debt - payment on 923 of the 924 rows where the two readings differ. So
-- applying a missed discount means reducing total_debt and recording it in
-- total_discount, exactly as marking would have.
--
-- TWO PARTS, DELIBERATELY SEPARATED
--
--   PART A — 145,662 across rows that still carry unpaid debt. Mechanical: the
--            discount comes straight off what the student owes. Applied here.
--
--   PART B — 6,248,964 on months already paid in full. Taking a discount off a
--            settled month does not reduce a debt, it creates a credit — a refund in
--            effect. That is a business decision, so this script only REPORTS them.
--
-- Capped at remaining_debt in PART A so it can never push a row into credit; that is
-- what makes A safe and B a decision.
--
-- PART A APPLIED 2026-08-14: 22 rows, 20 students, 178,738 released (Jul 89,061,
-- Aug 89,677). Afterwards 0 of those rows still carried no discount and 0 violated
-- remaining_debt = total_debt - payment. PART B remains a decision and is untouched.
--
-- Usage:  psql -v apply=0   -- dry run (DEFAULT)
--         psql -v apply=1   -- performs PART A only

\if :{?apply} \else \set apply 0 \endif

BEGIN;

CREATE TEMP TABLE owed ON COMMIT DROP AS
WITH les AS (
    SELECT student_id, group_id,
           extract(year  from lesson_date)::int AS y,
           extract(month from lesson_date)::int AS m,
           count(*) AS lessons
    FROM gennis_lesson_attendance
    GROUP BY 1, 2, 3, 4
)
SELECT h.id                        AS row_id,
       h.student_id,
       h.group_id,
       g.name                      AS group_name,
       h.calendar_year             AS yr,
       h.calendar_month            AS mo,
       l.lessons,
       c.discount                  AS monthly_charity,
       h.total_debt,
       h.payment,
       h.remaining_debt,
       -- the month's share of the allowance, never more than the charge itself
       least((l.lessons * (c.discount / g.attendance_days))::int, h.total_debt) AS should_get
FROM gennis_attendance_history_student h
JOIN gennis_group g            ON g.id = h.group_id AND g.attendance_days > 0
JOIN gennis_student_charity c  ON c.student_id = h.student_id
                              AND c.group_id  = h.group_id
                              AND c.deleted = false
JOIN les l                     ON l.student_id = h.student_id
                              AND l.group_id  = h.group_id
                              AND l.y = h.calendar_year AND l.m = h.calendar_month
WHERE h.total_discount = 0
  AND h.total_debt > 0
  AND make_date(h.calendar_year, h.calendar_month, 1) >= date '2026-01-01';

-- A: still owed, so the discount reduces a real debt. Capped so it cannot overshoot.
CREATE TEMP TABLE part_a ON COMMIT DROP AS
SELECT *, least(should_get, remaining_debt) AS apply_now
FROM owed WHERE remaining_debt > 0 AND should_get > 0;

-- B: month already settled — applying would create a credit, not cancel a debt.
CREATE TEMP TABLE part_b ON COMMIT DROP AS
SELECT * FROM owed WHERE remaining_debt <= 0 AND should_get > 0;

\echo ''
\echo '=== guard: a student must not appear in both parts for the same row (expect 0) ==='
SELECT count(*) AS overlap FROM part_a a JOIN part_b b USING (row_id);

\echo ''
\echo '=== PART A — comes off live debt (this is what gets applied) ==='
SELECT yr, mo, count(*) AS rows, count(DISTINCT student_id) AS students,
       sum(apply_now) AS discount_applied
FROM part_a GROUP BY 1,2 ORDER BY 1,2;

SELECT count(*) AS rows_total, count(DISTINCT student_id) AS students_total,
       sum(apply_now) AS total_applied
FROM part_a;

\echo ''
\echo '=== PART A sample ==='
SELECT student_id, group_name, mo, yr, lessons, monthly_charity,
       total_debt, remaining_debt, apply_now
FROM part_a ORDER BY apply_now DESC LIMIT 10;

\echo ''
\echo '=== PART B — months already paid, NOT touched (refund decision) ==='
SELECT yr, mo, count(*) AS rows, count(DISTINCT student_id) AS students,
       sum(should_get) AS overpaid
FROM part_b GROUP BY 1,2 ORDER BY 1,2;

SELECT count(*) AS rows_total, count(DISTINCT student_id) AS students_total,
       sum(should_get) AS total_overpaid
FROM part_b;

\if :apply
    \echo ''
    \echo '>>> APPLYING PART A ONLY <<<'

    UPDATE gennis_attendance_history_student h
    SET total_debt      = h.total_debt - a.apply_now,
        total_discount  = h.total_discount + a.apply_now,
        remaining_debt  = greatest(0, (h.total_debt - a.apply_now) - h.payment),
        status          = ((h.total_debt - a.apply_now) - h.payment) <= 0
    FROM part_a a
    WHERE h.id = a.row_id;

    \echo ''
    \echo '=== after: rows in PART A still carrying no discount (expect 0) ==='
    SELECT count(*) AS remaining
    FROM gennis_attendance_history_student h
    JOIN part_a a ON a.row_id = h.id
    WHERE h.total_discount = 0;

    \echo ''
    \echo '=== after: the invariant remaining_debt = total_debt - payment holds ==='
    SELECT count(*) AS rows_violating
    FROM gennis_attendance_history_student h
    JOIN part_a a ON a.row_id = h.id
    WHERE h.remaining_debt <> greatest(0, h.total_debt - h.payment);

    \echo ''
    \echo '=== after: debt released, by month ==='
    SELECT h.calendar_year, h.calendar_month, sum(a.apply_now) AS released
    FROM gennis_attendance_history_student h
    JOIN part_a a ON a.row_id = h.id
    GROUP BY 1,2 ORDER BY 1,2;

    COMMIT;
\else
    \echo ''
    \echo '(dry run - nothing written. -v apply=1 performs PART A only)'
    ROLLBACK;
\endif
