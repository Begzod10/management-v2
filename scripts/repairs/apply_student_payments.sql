-- Apply recorded student payments to the monthly attendance-history rows.
--
-- THE RULE (as it worked in old gennis): a payment is not confined to the month
-- it names. It settles the student's outstanding months — every row with
-- remaining debt — oldest first, until the money runs out. Whatever is left over
-- stays as the student's credit.
--
-- Verified against two students before writing this:
--   Visola  232277: 400,000 - 184,614 (Jun B44B101) - 215,383 (Jun C44A106New)
--                   = 3, which is exactly the "3 so'm" old gennis shows for her.
--   Madina  228620: her 2026-08 row computes to 1,526, exactly the "Tolov 1526"
--                   old gennis shows for that month.
-- Across all 70,176 rows the rule reproduces the stored value on 91.5% of them.
--
-- SAFETY: payment is only ever RAISED toward the computed figure, never lowered.
--   509 rows (417 students, 43m so'm) have MORE stored than the payment pool
--   explains. Deleted payments account for only 2.9m of that, so the rest is
--   something this script cannot see — discounts, charity, or payments that were
--   never synced from old gennis. Lowering those would erase a real settlement,
--   so they are left exactly as they are and reported separately.
--
-- Re-runnable: once a row matches its computed value the UPDATE stops touching it.
--
-- Usage:  psql -v apply=0   -- dry run, prints what would change (DEFAULT)
--         psql -v apply=1   -- perform the update

\if :{?apply} \else \set apply 0 \endif

BEGIN;

CREATE TEMP TABLE plan ON COMMIT DROP AS
WITH pool AS (
    -- every real payment the student has made, pooled; deleted ones excluded
    SELECT student_id, sum(payment_sum) AS pool
    FROM gennis_student_payment
    WHERE NOT deleted
    GROUP BY student_id
),
ordered AS (
    SELECT
        h.id, h.student_id, h.location_id,
        h.calendar_year AS yr, h.calendar_month AS mo, h.group_name,
        h.total_debt, h.payment AS stored_payment, h.remaining_debt AS stored_remaining,
        -- debt sitting ahead of this row in chronological order
        COALESCE(sum(h.total_debt) OVER (
            PARTITION BY h.student_id
            ORDER BY h.calendar_year, h.calendar_month, h.id
            ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
        ), 0) AS debt_before
    FROM gennis_attendance_history_student h
)
SELECT
    o.*,
    COALESCE(p.pool, 0) AS pool,
    -- the slice of the pool that reaches this row, capped at what the row owes
    GREATEST(0, LEAST(o.total_debt, COALESCE(p.pool, 0) - o.debt_before)) AS computed_payment
FROM ordered o
LEFT JOIN pool p USING (student_id);

\echo ''
\echo '=== overall impact ==='
SELECT count(*)                                                    AS rows_total,
       count(*) FILTER (WHERE computed_payment = stored_payment)   AS already_correct,
       count(*) FILTER (WHERE computed_payment > stored_payment)   AS will_be_raised,
       count(*) FILTER (WHERE computed_payment < stored_payment)   AS left_alone_stored_higher,
       sum(computed_payment - stored_payment)
           FILTER (WHERE computed_payment > stored_payment)        AS som_to_apply
FROM plan;

\echo ''
\echo '=== students affected ==='
SELECT count(DISTINCT student_id) AS students_with_rows_raised
FROM plan WHERE computed_payment > stored_payment;

\echo ''
\echo '=== sample: the two students verified by hand ==='
SELECT student_id, yr, mo, group_name, total_debt,
       stored_payment, computed_payment,
       stored_remaining,
       total_debt - computed_payment AS new_remaining
FROM plan
WHERE student_id IN (232277, 228620)
ORDER BY student_id, yr, mo, id;

\echo ''
\echo '=== rows deliberately NOT touched (stored exceeds what payments explain) ==='
SELECT count(*) AS rows, count(DISTINCT student_id) AS students,
       sum(stored_payment - computed_payment) AS unexplained_som
FROM plan WHERE computed_payment < stored_payment;

\if :apply
    \echo ''
    \echo '>>> APPLYING <<<'

    UPDATE gennis_attendance_history_student h
    SET payment        = p.computed_payment,
        remaining_debt = h.total_debt - p.computed_payment,
        -- status = the month is settled
        status         = (p.computed_payment >= h.total_debt)
    FROM plan p
    WHERE h.id = p.id
      AND p.computed_payment > p.stored_payment;

    \echo ''
    \echo '=== after: the two sample students ==='
    SELECT student_id, calendar_year AS yr, calendar_month AS mo, group_name,
           total_debt, payment, remaining_debt, status
    FROM gennis_attendance_history_student
    WHERE student_id IN (232277, 228620)
    ORDER BY student_id, calendar_year, calendar_month, id;

    COMMIT;
\else
    \echo ''
    \echo '(dry run — nothing written. re-run with -v apply=1 to perform it)'
    ROLLBACK;
\endif
