-- Reunite 87 payments and the credit they created with the students who made them.
--
-- SYMPTOM
-- 84 students are shown as owing money they have already paid. Their payments do not
-- appear on their profile and never settled a debt.
--
-- CAUSE
-- The same defect as fix_charity_untranslated_ids.sql, on the payments table. A sync
-- run on 2026-08-04 wrote gennis_student_payment.student_id straight from old gennis
-- without translating it, so 87 rows (27,229,000 so'm, paid 29 Jul – 30 Aug) carry an
-- old-gennis students.id. Nothing in v2 joins on that, so the payment is invisible.
--
-- Whatever consumed those payments used the same untranslated id for the surplus:
-- there are 85 gennis_student_credit rows keyed the same way, holding 27,229,000 —
-- the payment total to the so'm. The money is not lost. It is filed under a key no
-- student can reach, which is why the debt still shows.
--
-- WHAT THIS DOES
--   1. Translates the 87 payment rows onto the local student id. The payment then
--      appears on the student's profile and in every report that joins on it.
--   2. MERGES each orphan credit row into the student's real one. All 85 collide with
--      an existing row — gennis_student_credit is unique on student_id — so this must
--      add the balances, never re-key. Merging fixes the balance immediately, because
--      balance is credit minus what is owed.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
-- It does not allocate the payments against individual debt rows. The obvious theory
-- — that each student's applied-payment shortfall equals their unlinked payment —
-- holds for only 27 of the 85; for the other 58 the debt rows have moved for other
-- reasons (the charge divergence, today's charity work). Blanket re-allocation would
-- be wrong for two thirds of them. Once the ids are correct,
-- apply_student_payments.sql can work it out per row, on its own dry run.
--
-- 7 further credit rows (3,126,449) resolve in NEITHER id space — no student exists
-- under that number either way. Reported, not touched.
--
-- Usage:  psql -v apply=0   -- dry run (DEFAULT)
--         psql -v apply=1   -- write

\if :{?apply} \else \set apply 0 \endif

BEGIN;

CREATE TEMP TABLE pay_fix ON COMMIT DROP AS
SELECT p.id AS payment_id, p.student_id AS old_id, s.id AS v2_id,
       p.payment_sum, p.paid_date, p.channel, p.student_name
FROM gennis_student_payment p
JOIN gennis_student s ON s.gennis_id = p.student_id
WHERE p.deleted = false
  AND NOT EXISTS (SELECT 1 FROM gennis_student x WHERE x.id = p.student_id);

CREATE TEMP TABLE credit_fix ON COMMIT DROP AS
SELECT c.student_id AS old_id, s.id AS v2_id, c.balance AS orphan_balance,
       coalesce(k.balance, 0) AS existing_balance
FROM gennis_student_credit c
JOIN gennis_student s ON s.gennis_id = c.student_id
LEFT JOIN gennis_student_credit k ON k.student_id = s.id
WHERE NOT EXISTS (SELECT 1 FROM gennis_student x WHERE x.id = c.student_id);

\echo ''
\echo '=== guard: every payment must resolve to exactly one student (expect 0) ==='
SELECT count(*) AS ambiguous FROM (
  SELECT payment_id FROM pay_fix GROUP BY 1 HAVING count(*) > 1) x;

\echo ''
\echo '=== guard: no payment may already be on a valid student (expect 0) ==='
SELECT count(*) AS already_ok
FROM pay_fix f JOIN gennis_student s ON s.id = f.old_id;

\echo ''
\echo '=== payments to re-point ==='
SELECT count(*) AS payments, count(DISTINCT v2_id) AS students,
       sum(payment_sum) AS amount, min(paid_date) AS first, max(paid_date) AS last
FROM pay_fix;

\echo ''
\echo '=== credit rows to merge (all collide, so balances are added) ==='
SELECT count(*) AS rows, sum(orphan_balance) AS orphan_total,
       sum(existing_balance) AS existing_total,
       sum(orphan_balance + existing_balance) AS after_merge
FROM credit_fix;

\echo ''
\echo '=== the money reconciles ==='
SELECT (SELECT sum(payment_sum) FROM pay_fix)       AS unlinked_payments,
       (SELECT sum(orphan_balance) FROM credit_fix) AS orphan_credit,
       (SELECT sum(payment_sum) FROM pay_fix)
     - (SELECT sum(orphan_balance) FROM credit_fix) AS difference;

\echo ''
\echo '=== largest 10 students, and what their balance becomes ==='
SELECT f.v2_id AS student_id,
       trim(coalesce(s.name,'') || ' ' || coalesce(s.surname,'')) AS student,
       f.orphan_balance AS credit_recovered,
       f.existing_balance AS credit_before,
       f.orphan_balance + f.existing_balance AS credit_after,
       coalesce((SELECT sum(remaining_debt) FROM gennis_attendance_history_student h
                 WHERE h.student_id = f.v2_id AND h.remaining_debt > 0), 0) AS owes_now
FROM credit_fix f JOIN gennis_student s ON s.id = f.v2_id
ORDER BY f.orphan_balance DESC LIMIT 10;

\echo ''
\echo '=== credit rows that resolve in NEITHER id space — left alone ==='
SELECT count(*) AS rows, sum(balance) AS balance
FROM gennis_student_credit c
WHERE NOT EXISTS (SELECT 1 FROM gennis_student s WHERE s.id = c.student_id)
  AND NOT EXISTS (SELECT 1 FROM gennis_student s WHERE s.gennis_id = c.student_id);

\if :apply
    \echo ''
    \echo '>>> APPLYING <<<'

    UPDATE gennis_student_payment p
    SET student_id = f.v2_id
    FROM pay_fix f WHERE p.id = f.payment_id;

    -- add the orphan balance onto the student's real row, then drop the orphan
    UPDATE gennis_student_credit k
    SET balance = k.balance + f.orphan_balance
    FROM credit_fix f WHERE k.student_id = f.v2_id;

    DELETE FROM gennis_student_credit c
    USING credit_fix f WHERE c.student_id = f.old_id;

    \echo ''
    \echo '=== after: payments still unreachable (expect 0) ==='
    SELECT count(*) AS remaining FROM gennis_student_payment p
    WHERE p.deleted = false
      AND NOT EXISTS (SELECT 1 FROM gennis_student s WHERE s.id = p.student_id);

    \echo ''
    \echo '=== after: credit rows still unreachable (expect 7, the unresolvable ones) ==='
    SELECT count(*) AS remaining, sum(balance) AS balance
    FROM gennis_student_credit c
    WHERE NOT EXISTS (SELECT 1 FROM gennis_student s WHERE s.id = c.student_id);

    \echo ''
    \echo '=== after: credit recovered, by student ==='
    SELECT count(*) AS students, sum(k.balance) AS total_credit_now
    FROM gennis_student_credit k
    WHERE k.student_id IN (SELECT v2_id FROM credit_fix);

    COMMIT;
\else
    \echo ''
    \echo '(dry run - nothing written. -v apply=1 to perform it)'
    ROLLBACK;
\endif
