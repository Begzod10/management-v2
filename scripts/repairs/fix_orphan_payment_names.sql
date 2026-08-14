-- The 4 payments that fix_shifted_payment_student_ids.sql could not reach.
--
-- That script corrects each payment against old gennis's own row at the same id.
-- These 4 have no such row -- old gennis holds nothing at that id at all, dated
-- BEFORE the freeze, so it isn't simply v2 continuing to operate; something removed
-- them from old gennis after they synced (a hard delete, since they aren't in
-- deletedstudentpayments either).
--
-- The row still carries student_name, frozen at sync time -- the free-text label
-- naming who actually paid, independent of the student_id foreign key. For all 4,
-- that name matches exactly one student, and it is NOT the student the row is
-- currently attached to:
--
--   60715  1,440,000  'Zebo Toxtamurodova'          now on Oltinbek Sorgulov
--   60752    290,000  'Baxtiyor  Shoxdiyorov'        now on someone else
--   60763    370,000  'Farangiz Nusratullayeva'      now on someone else
--   60764    522,000  'Sheroz Ergashev'              now on someone else
--
-- This is the same misattribution as the 153, just missing the anchor that made
-- those mechanical. Two more orphans in the same sweep (60062, 60193) were checked
-- and are already correctly attached -- their name matches their current student_id
-- exactly -- so they are not included here.
--
-- WHAT THIS DOES
-- Re-points the 4 payments to the student the name matches, then rebuilds credit
-- for the 4 students who currently hold them plus the 4 who should, using the same
-- formula as fix_shifted_payment_student_ids.sql and rebuild_student_credit.sql:
-- balance = GREATEST(0, payments made - payments applied).
--
-- APPLIED 2026-08-14: 4/4 re-pointed, 0 remained wrong. Oltinbek Sorgulov's
-- balance went from +1,440,156 to +156, matching old gennis's stored
-- extra_payment of 156 for him exactly.
--
-- Usage:  psql -v apply=0   -- dry run (DEFAULT)
--         psql -v apply=1   -- write

\if :{?apply} \else \set apply 0 \endif

BEGIN;

CREATE TEMP TABLE fix (payment_id bigint, correct_name text, should_be int)
  ON COMMIT DROP;
INSERT INTO fix (payment_id, correct_name, should_be) VALUES
    (60715, 'Zebo Toxtamurodova',        231733),
    (60752, 'Baxtiyor  Shoxdiyorov',     232475),
    (60763, 'Farangiz Nusratullayeva',   230217),
    (60764, 'Sheroz Ergashev',           232232);

\echo ''
\echo '=== guard: the name on the row still matches what we read it as (expect 0) ==='
SELECT count(*) AS drifted
FROM fix f
JOIN gennis_student_payment p ON p.id = f.payment_id
WHERE trim(p.student_name) <> trim(f.correct_name);

\echo ''
\echo '=== guard: each target is still a single, unambiguous name match (expect 4) ==='
SELECT count(*) AS unambiguous_matches
FROM fix f
WHERE (SELECT count(*) FROM gennis_student s
       WHERE trim(s.name || ' ' || s.surname) ILIKE trim(f.correct_name)) = 1;

\echo ''
\echo '=== guard: not already on the right student (expect 4) ==='
SELECT count(*) AS still_wrong
FROM fix f JOIN gennis_student_payment p ON p.id = f.payment_id
WHERE p.student_id <> f.should_be;

\echo ''
\echo '=== what moves ==='
SELECT f.payment_id, p.student_id AS currently_on, f.should_be AS moves_to,
       p.payment_sum, p.paid_date
FROM fix f JOIN gennis_student_payment p ON p.id = f.payment_id
ORDER BY f.payment_id;

\echo ''
\echo '=== credit before/after for the 8 students this touches ==='
CREATE TEMP TABLE touched ON COMMIT DROP AS
SELECT DISTINCT student_id FROM (
    SELECT student_id FROM gennis_student_payment p JOIN fix f ON f.payment_id = p.id
    UNION SELECT should_be FROM fix
) x;

CREATE TEMP TABLE effective_payments ON COMMIT DROP AS
SELECT p.id, coalesce(f.should_be, p.student_id) AS student_id, p.payment_sum
FROM gennis_student_payment p
LEFT JOIN fix f ON f.payment_id = p.id
WHERE NOT p.deleted
  AND coalesce(f.should_be, p.student_id) IN (SELECT student_id FROM touched);

CREATE TEMP TABLE credit_after ON COMMIT DROP AS
SELECT t.student_id, a.location_id,
       greatest(0, coalesce(ep.paid,0) - coalesce(a.applied,0)) AS balance
FROM touched t
LEFT JOIN (SELECT student_id, sum(payment_sum) AS paid
           FROM effective_payments GROUP BY 1) ep ON ep.student_id = t.student_id
LEFT JOIN (SELECT student_id, sum(payment) AS applied, max(location_id) AS location_id
           FROM gennis_attendance_history_student
           WHERE student_id IN (SELECT student_id FROM touched)
           GROUP BY 1) a ON a.student_id = t.student_id;

SELECT ca.student_id,
       trim(coalesce(s.name,'')||' '||coalesce(s.surname,'')) AS student,
       coalesce(cr.balance,0) AS credit_before, ca.balance AS credit_after
FROM credit_after ca
JOIN gennis_student s ON s.id = ca.student_id
LEFT JOIN gennis_student_credit cr ON cr.student_id = ca.student_id
ORDER BY ca.student_id;

\if :apply
    \echo ''
    \echo '>>> APPLYING <<<'

    UPDATE gennis_student_payment p
    SET student_id = f.should_be
    FROM fix f WHERE p.id = f.payment_id;

    INSERT INTO gennis_student_credit (student_id, location_id, balance)
    SELECT student_id, location_id, balance FROM credit_after
    ON CONFLICT (student_id) DO UPDATE
      SET balance = EXCLUDED.balance,
          location_id = coalesce(EXCLUDED.location_id, gennis_student_credit.location_id);

    \echo ''
    \echo '=== after: rows still wrong (expect 0) ==='
    SELECT count(*) AS remaining FROM fix f
    JOIN gennis_student_payment p ON p.id = f.payment_id
    WHERE p.student_id <> f.should_be;

    COMMIT;
\else
    \echo ''
    \echo '(dry run - nothing written. -v apply=1 to perform it)'
    ROLLBACK;
\endif
