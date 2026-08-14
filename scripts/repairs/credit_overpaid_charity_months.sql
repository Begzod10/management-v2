-- PART B: credit the students who paid a month that should have carried a charity.
--
-- Companion to apply_missed_charity_discounts.sql, whose PART A is already applied.
-- Same 451-row population, same pricing; this is the half where the month was paid
-- IN FULL, so there is no debt left for the discount to cancel.
--
-- 193 rows, 128 students, 6,184,205 so'm, Jan–Aug 2026.
--
-- WHAT "CREDIT" MEANS HERE
-- The student paid X for a month they only owed X - d. The d they should not have
-- paid becomes a surplus on their account — which is exactly what
-- gennis_student_credit holds, and exactly what payments.py does when a payment
-- exceeds all known debt. Nothing is paid out; the balance simply goes up, and it
-- nets off against anything they still owe elsewhere.
--
--   78 students still owe money elsewhere — 4,489,578 quietly reduces that
--   50 students owe nothing            — 1,694,627 sits as a positive balance
--
-- THE ROW STAYS CONSISTENT
-- On a settled row total_debt = payment and remaining_debt = 0. Reducing total_debt
-- alone would leave remaining_debt at -d, the "overpaid month" state that already
-- exists in this data and that silently corrupted an earlier measurement of what was
-- owed. So the freed payment is moved off the row and into credit together:
--
--     total_debt     -= d        (what they actually owed)
--     total_discount += d        (the record of the discount)
--     payment        -= d        (that much of their payment was not needed here)
--     remaining_debt  = 0        (unchanged — still settled)
--     credit         += d        (where the freed payment goes)
--
-- payment on the row is not "cash received", it is cash APPLIED to this month; the
-- gennis_student_payment rows are untouched, so the audit trail of what was actually
-- paid, when and by which channel is unchanged.
--
-- NOT A CASH REFUND. If any of these students should be paid out rather than
-- credited, that is a separate act — this only puts the money on their account.
--
-- Usage:  psql -v apply=0   -- dry run (DEFAULT)
--         psql -v apply=1   -- write

\if :{?apply} \else \set apply 0 \endif

BEGIN;

CREATE TEMP TABLE part_b ON COMMIT DROP AS
WITH les AS (
    SELECT student_id, group_id,
           extract(year  from lesson_date)::int AS y,
           extract(month from lesson_date)::int AS m,
           count(*) AS lessons
    FROM gennis_lesson_attendance
    GROUP BY 1, 2, 3, 4
)
SELECT h.id AS row_id, h.student_id, h.group_id, h.location_id,
       g.name AS group_name, h.calendar_year AS yr, h.calendar_month AS mo,
       l.lessons, c.discount AS monthly_charity,
       h.total_debt, h.payment, h.remaining_debt,
       least((l.lessons * (c.discount / g.attendance_days))::int,
             h.total_debt, h.payment) AS credit_now
FROM gennis_attendance_history_student h
JOIN gennis_group g           ON g.id = h.group_id AND g.attendance_days > 0
JOIN gennis_student_charity c ON c.student_id = h.student_id
                             AND c.group_id  = h.group_id AND c.deleted = false
JOIN les l                    ON l.student_id = h.student_id
                             AND l.group_id  = h.group_id
                             AND l.y = h.calendar_year AND l.m = h.calendar_month
WHERE h.total_discount = 0
  AND h.total_debt > 0
  AND h.remaining_debt <= 0
  AND make_date(h.calendar_year, h.calendar_month, 1) >= date '2026-01-01';

DELETE FROM part_b WHERE credit_now <= 0;

CREATE TEMP TABLE per_student ON COMMIT DROP AS
SELECT student_id,
       min(location_id) AS location_id,
       count(*)         AS rows,
       sum(credit_now)  AS credit_now
FROM part_b GROUP BY 1;

\echo ''
\echo '=== guard: capped at payment, so no row can go negative (expect 0) ==='
SELECT count(*) AS would_go_negative FROM part_b WHERE credit_now > payment;

\echo ''
\echo '=== guard: none of these rows may still carry unpaid debt (expect 0) ==='
SELECT count(*) AS not_settled FROM part_b WHERE remaining_debt > 0;

\echo ''
\echo '=== what gets credited, by month ==='
SELECT yr, mo, count(*) AS rows, count(DISTINCT student_id) AS students,
       sum(credit_now) AS credited
FROM part_b GROUP BY 1,2 ORDER BY 1,2;

\echo ''
\echo '=== totals ==='
SELECT (SELECT count(*) FROM part_b)              AS rows,
       (SELECT count(*) FROM per_student)         AS students,
       (SELECT sum(credit_now) FROM per_student)  AS total_credited;

\echo ''
\echo '=== where the credit lands ==='
SELECT CASE WHEN owed.d > 0 THEN 'nets off against existing debt'
            ELSE 'becomes a positive balance' END AS effect,
       count(*) AS students, sum(p.credit_now) AS amount
FROM per_student p
LEFT JOIN LATERAL (
    SELECT coalesce(sum(remaining_debt), 0) AS d
    FROM gennis_attendance_history_student x
    WHERE x.student_id = p.student_id AND x.remaining_debt > 0
) owed ON true
GROUP BY 1 ORDER BY 3 DESC;

\echo ''
\echo '=== largest 10 ==='
SELECT p.student_id, trim(coalesce(s.name,'') || ' ' || coalesce(s.surname,'')) AS student,
       p.rows, p.credit_now,
       coalesce(cr.balance, 0) AS balance_before,
       coalesce(cr.balance, 0) + p.credit_now AS balance_after
FROM per_student p
JOIN gennis_student s ON s.id = p.student_id
LEFT JOIN gennis_student_credit cr ON cr.student_id = p.student_id
ORDER BY p.credit_now DESC LIMIT 10;

\if :apply
    \echo ''
    \echo '>>> APPLYING <<<'

    UPDATE gennis_attendance_history_student h
    SET total_debt     = h.total_debt     - b.credit_now,
        total_discount = h.total_discount + b.credit_now,
        payment        = h.payment        - b.credit_now
    FROM part_b b
    WHERE h.id = b.row_id;

    INSERT INTO gennis_student_credit (student_id, location_id, balance)
    SELECT student_id, location_id, credit_now FROM per_student
    ON CONFLICT (student_id) DO UPDATE
      SET balance = gennis_student_credit.balance + EXCLUDED.balance;

    \echo ''
    \echo '=== after: rows still without a discount (expect 0) ==='
    SELECT count(*) AS remaining
    FROM gennis_attendance_history_student h
    JOIN part_b b ON b.row_id = h.id WHERE h.total_discount = 0;

    \echo ''
    \echo '=== after: invariant remaining_debt = total_debt - payment (expect 0) ==='
    SELECT count(*) AS rows_violating
    FROM gennis_attendance_history_student h
    JOIN part_b b ON b.row_id = h.id
    WHERE h.remaining_debt <> greatest(0, h.total_debt - h.payment);

    \echo ''
    \echo '=== after: no row left with a negative payment (expect 0) ==='
    SELECT count(*) AS negative_payment
    FROM gennis_attendance_history_student h
    JOIN part_b b ON b.row_id = h.id WHERE h.payment < 0;

    \echo ''
    \echo '=== after: credited students ==='
    SELECT count(*) AS students, sum(cr.balance) AS total_balance_now
    FROM gennis_student_credit cr
    WHERE cr.student_id IN (SELECT student_id FROM per_student);

    COMMIT;
\else
    \echo ''
    \echo '(dry run - nothing written. -v apply=1 to perform it)'
    ROLLBACK;
\endif
