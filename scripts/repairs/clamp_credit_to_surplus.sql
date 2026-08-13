-- Make gennis_student_credit surplus-only (never negative).
--
-- WHY
-- rebuild_student_credit.sql wrote a NET balance: positive for students in
-- credit, negative for students in debt. Hours later, gennis-v2 commit e038344
-- ("stop double-tracking debt in credit + history") settled the opposite
-- convention: gennis_attendance_history_student is the single source of truth
-- for debt, and GennisStudentCredit holds payment surplus only.
--
-- Those two conventions collide. The display code reconciles them with
--
--     return -max(debt, -credit) if credit < 0 else credit - debt
--
-- which takes whichever source claims MORE is owed. That is a safe transitional
-- rule while the negative rows agree with the debt history — but the moment debt
-- is paid down, the stale negative credit wins and the student keeps showing a
-- debt they no longer have. Within hours of the rebuild that had already happened
-- to 415 students, overstating debt by 42,505,188 so'm.
--
-- Clamping the negatives to zero removes the second writer entirely: debt then
-- comes only from the history table, exactly as e038344 intends, and the numbers
-- self-correct as payments land.
--
-- NOT A DISPLAYED CHANGE for students whose credit still agreed with their debt:
-- -max(debt, 0) == -debt, the same figure they saw before. It only stops the
-- stale value winning later.
--
-- Re-runnable: once clamped there are no negative rows left to touch.
--
-- Usage:  psql -v apply=0   -- dry run (DEFAULT)
--         psql -v apply=1   -- write

\if :{?apply} \else \set apply 0 \endif

BEGIN;

\echo ''
\echo '=== negative credit rows, and whether they still match live debt ==='
WITH debt AS (
    SELECT student_id, sum(remaining_debt) AS debt
    FROM gennis_attendance_history_student GROUP BY student_id
)
SELECT count(*)                                                    AS negative_rows,
       count(*) FILTER (WHERE -c.balance =  COALESCE(d.debt, 0))   AS still_agree,
       count(*) FILTER (WHERE -c.balance <> COALESCE(d.debt, 0))   AS drifted,
       COALESCE(sum(-c.balance - COALESCE(d.debt, 0))
           FILTER (WHERE -c.balance > COALESCE(d.debt, 0)), 0)     AS overstated_som
FROM gennis_student_credit c
LEFT JOIN debt d USING (student_id)
WHERE c.balance < 0;

\if :apply
    \echo ''
    \echo '>>> APPLYING <<<'

    UPDATE gennis_student_credit
    SET balance = 0, updated_at = now()
    WHERE balance < 0;

    \echo ''
    \echo '=== after: no negative rows should remain ==='
    SELECT count(*) FILTER (WHERE balance < 0) AS negative,
           count(*) FILTER (WHERE balance > 0) AS in_credit,
           count(*) FILTER (WHERE balance = 0) AS zero,
           count(*)                            AS total
    FROM gennis_student_credit;

    COMMIT;
\else
    \echo ''
    \echo '(dry run - nothing written. re-run with -v apply=1)'
    ROLLBACK;
\endif
