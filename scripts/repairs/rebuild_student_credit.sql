-- Rebuild gennis_student_credit as a complete NET balance for every student.
--
-- WHY THIS EXISTS
-- The students list reads `credit_balance` and, when a student has no credit
-- row, falls back to querying the OLD GENNIS database live (studying.py:202-218).
-- Only 287 of ~16,000 students had a row, so in practice almost every balance on
-- that page came from a system that is supposed to be decommissioned. Giving every
-- student a correct row here is what makes it possible to delete that fallback.
--
-- THE FORMULA
--     balance = (payments made - payments applied to months) - remaining debt
--
-- The first bracket is the student's unspent money: after apply_student_payments.sql
-- poured every payment into their oldest unpaid months, whatever did not fit is
-- genuinely surplus. Most of it is advance payment - of the 3,711 payments naming a
-- month with no history row, 2,941 are for months AFTER the student's last charged
-- month. The second term is what they still owe.
--
-- The two never overlap: a check across all 10,580 students found ZERO with both a
-- surplus and outstanding debt, which is what you would expect if the allocation is
-- right, and is the main reason to trust this figure.
--
-- POSITIVE = the school owes the student (prepaid). NEGATIVE = the student owes.
-- studying.py already renders a negative credit_balance as debt (red), so the sign
-- convention matches what the UI expects.
--
-- OVERWRITING EXISTING ROWS
-- All 97 pre-existing rows that overlap disagree with the computed value, and every
-- one of them is stale: they were written between 2026-07-27 and 2026-08-13 against
-- the data as it stood BEFORE payments were applied, so they recorded debt that has
-- since been settled. The computed figure supersedes them. The remaining ~190 rows
-- for students with neither surplus nor debt are refreshed to their computed value
-- too, so the table is internally consistent rather than part-old part-new.
--
-- Re-runnable: recomputes from ground truth each time, so running it twice is a no-op.
--
-- Usage:  psql -v apply=0   -- dry run (DEFAULT)
--         psql -v apply=1   -- write

\if :{?apply} \else \set apply 0 \endif

BEGIN;

CREATE TEMP TABLE credit_plan ON COMMIT DROP AS
WITH paid AS (
    SELECT student_id, sum(payment_sum) AS paid
    FROM gennis_student_payment WHERE NOT deleted GROUP BY student_id
),
applied AS (
    SELECT student_id, sum(payment) AS applied, sum(remaining_debt) AS debt,
           max(location_id) AS location_id
    FROM gennis_attendance_history_student GROUP BY student_id
)
SELECT
    COALESCE(p.student_id, a.student_id)                       AS student_id,
    a.location_id,
    COALESCE(p.paid, 0)                                        AS paid,
    COALESCE(a.applied, 0)                                     AS applied,
    COALESCE(a.debt, 0)                                        AS debt,
    (COALESCE(p.paid,0) - COALESCE(a.applied,0)) - COALESCE(a.debt,0) AS balance
FROM paid p FULL OUTER JOIN applied a USING (student_id);

\echo ''
\echo '=== what the rebuilt table will contain ==='
SELECT count(*)                                   AS students,
       count(*) FILTER (WHERE balance > 0)        AS in_credit,
       count(*) FILTER (WHERE balance < 0)        AS in_debt,
       count(*) FILTER (WHERE balance = 0)        AS square,
       sum(balance) FILTER (WHERE balance > 0)    AS credit_som,
       sum(balance) FILTER (WHERE balance < 0)    AS debt_som
FROM credit_plan;

\echo ''
\echo '=== change vs the 287 rows currently stored ==='
SELECT count(*)                                              AS existing_rows,
       count(*) FILTER (WHERE c.balance = p.balance)         AS unchanged,
       count(*) FILTER (WHERE c.balance <> p.balance)        AS changed
FROM gennis_student_credit c JOIN credit_plan p USING (student_id);

\echo ''
\echo '=== the two students verified by hand ==='
SELECT student_id, paid, applied, debt, balance FROM credit_plan
WHERE student_id IN (232277, 228620);

\if :apply
    \echo ''
    \echo '>>> APPLYING <<<'

    -- refresh existing rows
    UPDATE gennis_student_credit c
    SET balance = p.balance, updated_at = now()
    FROM credit_plan p
    WHERE c.student_id = p.student_id AND c.balance IS DISTINCT FROM p.balance;

    -- and add the students who never had one
    INSERT INTO gennis_student_credit (student_id, location_id, balance, updated_at)
    SELECT p.student_id, p.location_id, p.balance, now()
    FROM credit_plan p
    WHERE NOT EXISTS (SELECT 1 FROM gennis_student_credit c WHERE c.student_id = p.student_id);

    \echo ''
    \echo '=== after ==='
    SELECT count(*) AS rows,
           count(*) FILTER (WHERE balance > 0) AS in_credit,
           count(*) FILTER (WHERE balance < 0) AS in_debt
    FROM gennis_student_credit;

    SELECT student_id, balance FROM gennis_student_credit
    WHERE student_id IN (232277, 228620);

    COMMIT;
\else
    \echo ''
    \echo '(dry run - nothing written. re-run with -v apply=1)'
    ROLLBACK;
\endif
