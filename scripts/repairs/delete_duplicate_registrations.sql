-- Remove two self-service signups from people who were already students.
--
-- WHY
-- /students/register lets anyone sign up, and two people who are already enrolled
-- did so anyway. Each signup matches an existing student on phone exactly:
--
--   reg 21  Mirsodiq Mirxoliq   995629410  ->  student 278018 Mirsodiq Mirxoliqov
--   reg 22  shahzod             950017622  ->  student 220370 Shahzod Omonboyev
--
-- Enrolling them would have created a second person each — a second balance, and
-- attendance split across two rows. gennis-v2 now refuses to do that (see
-- find_existing_student), but the duplicate signups themselves are still sitting in
-- the candidate list, so they are removed here.
--
-- WHAT GOES WITH THEM
-- Registration creates a "user" row and a gennis_user_link in the same transaction,
-- so all three are one unit. Both accounts have never been logged into (last_login
-- is NULL) and a full scan of all 69 tables that reference "user" found nothing
-- pointing at them except their own link rows. Nothing references
-- gennis_student_registration at all.
--
-- NOT TOUCHED
-- The real students, 278018 and 220370, are left exactly as they are. Note that
-- 278018 currently logs in as "Mirxoliqov Mirsodiq_16123" — the suffix exists only
-- because user 16730 below was holding the unsuffixed name. Once this runs, the
-- name is free and that student could be given it back. That is a separate change:
-- it alters a credential a student may already have been told.
--
-- Re-runnable: every delete is keyed on ids that will not exist afterwards.
--
-- Usage:  psql -v apply=0   -- dry run (DEFAULT)
--         psql -v apply=1   -- write

\if :{?apply} \else \set apply 0 \endif

BEGIN;

\echo '=== the registrations to delete ==='
SELECT id, name, surname, phone, username, location_id, created_at
FROM gennis_student_registration WHERE id IN (21, 22) ORDER BY id;

\echo ''
\echo '=== the accounts that go with them (never logged in) ==='
SELECT u.id, u.username, u.role, u.is_active, u.last_login, u.created_at
FROM "user" u WHERE u.id IN (16730, 18536) ORDER BY u.id;

\echo ''
\echo '=== their link rows ==='
SELECT id, management_user_id, gennis_user_id, location_name
FROM gennis_user_link WHERE management_user_id IN (16730, 18536) ORDER BY id;

\echo ''
\echo '=== the real students, which stay ==='
SELECT s.id, s.gennis_id, s.name, s.surname, s.phone, u.username AS login
FROM gennis_student s
LEFT JOIN gennis_user_link l ON l.gennis_user_id = s.user_id
LEFT JOIN "user" u ON u.id = l.management_user_id
WHERE s.id IN (278018, 220370) ORDER BY s.id;

\echo ''
\echo '=== safety: anything else referencing those two users? (expect 0) ==='
DO $$
DECLARE r record; n bigint; total bigint := 0;
BEGIN
  FOR r IN
    SELECT tc.table_name AS t, kcu.column_name AS c
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'user'
      AND tc.table_name <> 'gennis_user_link'
  LOOP
    EXECUTE format('SELECT count(*) FROM %I WHERE %I IN (16730, 18536)', r.t, r.c) INTO n;
    IF n > 0 THEN
      total := total + n;
      RAISE NOTICE 'UNEXPECTED: %.% holds % row(s)', r.t, r.c, n;
    END IF;
  END LOOP;
  RAISE NOTICE 'rows outside gennis_user_link: %', total;
  IF total > 0 THEN
    RAISE EXCEPTION 'refusing to delete: something else references these users';
  END IF;
END $$;

\if :apply
    \echo ''
    \echo '>>> APPLYING <<<'

    DELETE FROM gennis_user_link WHERE management_user_id IN (16730, 18536);
    DELETE FROM "user" WHERE id IN (16730, 18536);
    DELETE FROM gennis_student_registration WHERE id IN (21, 22);

    \echo ''
    \echo '=== after: registrations remaining ==='
    SELECT id, name, surname, username, student_id FROM gennis_student_registration ORDER BY id;

    \echo ''
    \echo '=== after: the freed usernames are gone ==='
    SELECT count(*) AS should_be_zero FROM "user"
    WHERE username IN ('Mirxoliqov Mirsodiq', 'shahzod');

    \echo ''
    \echo '=== after: the real students are untouched ==='
    SELECT s.id, s.gennis_id, s.name, s.surname, u.username AS login
    FROM gennis_student s
    JOIN gennis_user_link l ON l.gennis_user_id = s.user_id
    JOIN "user" u ON u.id = l.management_user_id
    WHERE s.id IN (278018, 220370) ORDER BY s.id;
    COMMIT;
\else
    \echo ''
    \echo '(dry run - nothing written. -v apply=1 to perform it)'
    ROLLBACK;
\endif
