-- Reconcile gennis_teacher_salary.taken_money with the payments behind it.
--
-- SYMPTOM
-- Mohinur Ne'Matjonova's August salary page showed "Olingan 400,000" above a list
-- of three payments adding up to 500,000.
--
-- CAUSE
-- taken_money is maintained incrementally: give_salary.py adds to it on create and
-- subtracts on delete, and links the payment to its salary row via
-- salary_gennis_id. Two rows drifted out of step with the payments:
--
--   salary 2369  Mohinur Ne'matjonova  2026-08
--       Payment 527242537 (100,000, "avans", 12 Aug 09:33) carries no
--       salary_gennis_id -- it was created in the few hours before that column was
--       introduced; every v2 payment made after 14:00 that day has it. The payment
--       listing falls back to matching on teacher+month, so the UI showed it, but
--       taken_money never counted it.
--
--   salary 2121  Sardor Ikromov  2026-03
--       Payment 18819 (200,000) is deleted, yet taken_money still includes it.
--       An old-gennis id, so the deletion came across in the sync without the
--       total being adjusted. The delete endpoint decrements correctly, so this is
--       historic rather than ongoing.
--
-- WHAT THIS DOES
--   1. Gives payment 527242537 the link it should have had.
--   2. Recomputes taken_money for the affected rows from their live payments, and
--      remaining_salary with give_salary.py's formula:
--        total_salary - (taken_money + black_salary + fine - debt)
--
-- Scoped to rows that actually disagree; every other salary row is left untouched.
--
-- Usage:  psql -v apply=0   -- dry run (DEFAULT)
--         psql -v apply=1   -- write

\if :{?apply} \else \set apply 0 \endif

BEGIN;

-- The one payment missing its link, identified by value rather than id alone so a
-- re-run cannot attach the wrong row.
CREATE TEMP TABLE relink ON COMMIT DROP AS
SELECT p.id AS payment_id, s.id AS salary_id, p.payment_sum
FROM gennis_teacher_salary_payment p
JOIN gennis_teacher_salary s
  ON s.teacher_id     = p.teacher_id
 AND s.calendar_year  = p.calendar_year
 AND s.calendar_month = p.calendar_month
 AND s.location_id    = p.location_id
WHERE p.deleted = false
  AND p.salary_gennis_id IS NULL
  AND p.id > 100000000;          -- v2-native ids only; old-gennis rows are left alone

\echo ''
\echo '=== payments that will be linked to their salary row ==='
SELECT r.payment_id, r.salary_id, r.payment_sum, s.teacher_name,
       s.calendar_year, s.calendar_month
FROM relink r JOIN gennis_teacher_salary s ON s.id = r.salary_id;

\echo ''
\echo '=== guard: each payment must match exactly one salary row (expect 0) ==='
SELECT count(*) AS ambiguous FROM (
  SELECT payment_id FROM relink GROUP BY payment_id HAVING count(*) > 1) x;

-- Salary rows whose taken_money disagrees with their live payments, counting the
-- relink above as already applied.
CREATE TEMP TABLE fix ON COMMIT DROP AS
SELECT s.id, s.teacher_name, s.calendar_year AS yr, s.calendar_month AS mo,
       s.total_salary, s.taken_money AS taken_now, s.black_salary, s.fine, s.debt,
       s.remaining_salary AS remaining_now,
       coalesce((
         SELECT sum(p.payment_sum) FROM gennis_teacher_salary_payment p
         WHERE p.deleted = false
           AND (p.salary_gennis_id = s.id
                OR p.id IN (SELECT payment_id FROM relink WHERE salary_id = s.id))
       ), 0) AS taken_should_be
FROM gennis_teacher_salary s;

DELETE FROM fix WHERE taken_now = taken_should_be;

\echo ''
\echo '=== salary rows to correct ==='
SELECT id, teacher_name, yr, mo, taken_now, taken_should_be,
       (taken_should_be - taken_now) AS delta,
       remaining_now,
       total_salary - (taken_should_be + black_salary + fine - debt) AS remaining_after
FROM fix ORDER BY yr DESC, mo DESC;

\if :apply
    \echo ''
    \echo '>>> APPLYING <<<'

    UPDATE gennis_teacher_salary_payment p
    SET salary_gennis_id = r.salary_id
    FROM relink r WHERE p.id = r.payment_id;

    UPDATE gennis_teacher_salary s
    SET taken_money      = f.taken_should_be,
        remaining_salary = s.total_salary
                           - (f.taken_should_be + s.black_salary + s.fine - s.debt)
    FROM fix f WHERE s.id = f.id;

    \echo ''
    \echo '=== after: rows still disagreeing (expect 0) ==='
    SELECT count(*) AS still_wrong
    FROM gennis_teacher_salary s
    WHERE s.taken_money <> coalesce((
        SELECT sum(p.payment_sum) FROM gennis_teacher_salary_payment p
        WHERE p.deleted = false AND p.salary_gennis_id = s.id), 0)
      AND EXISTS (SELECT 1 FROM gennis_teacher_salary_payment p
                  WHERE p.salary_gennis_id = s.id);

    \echo ''
    \echo '=== after: the two rows from the report ==='
    SELECT id, teacher_name, calendar_year, calendar_month,
           total_salary, taken_money, black_salary, fine, remaining_salary
    FROM gennis_teacher_salary WHERE id IN (2369, 2121);

    COMMIT;
\else
    \echo ''
    \echo '(dry run - nothing written. -v apply=1 to perform it)'
    ROLLBACK;
\endif
