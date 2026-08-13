-- Create v2 logins for students who never got one.
--
-- WHY
-- seed_student_users.py was a one-off run during the migration. Every student
-- registered after it has no "user" row and no gennis_user_link row, so they cannot
-- log in to student_platform at all — the login form reports "wrong login or
-- password" because the lookup returns nothing, not because the password is wrong.
-- 283 students are in that state; 269 of them were registered in July-August 2026
-- and 211 are in a live group, i.e. currently attending and locked out.
--
-- Found via Shohjaxon Abasov (gennis_student 232444), whose profile page displays
-- login "Abasov_Shohjaxon" — that is gennis_student.username, the legacy value
-- carried over from old gennis, shown as a fallback when no account exists. The
-- name is real, the account is not.
--
-- WHICH KEY LINKS A STUDENT TO A LOGIN
-- gennis_user_link only. Do NOT join "user".id = gennis_student.user_id: the two id
-- spaces overlap by coincidence and the join silently returns a different person.
-- Afruzbek Abdujjaborov has user_id 14084, and "user" 14084 is Aripov_Shoxrux; his
-- actual account is 14731, reachable only through the link row.
--
-- WHO IS EXCLUDED
-- 16 of the 283 have no user_id and so cannot be keyed into gennis_user_link. All 16
-- are synthetic test rows (name "Test", surname "O'quvchi1-Filial1", gennis_id
-- 900086768+). They are skipped, leaving 267 real students. The gennis_id < 900000000
-- guard below is what enforces that.
--
-- USERNAMES
-- Each student's own legacy gennis_student.username, matching what restore_student_
-- usernames.sql did for everyone else — students log in with the name they already
-- know. All 267 have one. None collide with each other; 5 collide with an existing
-- account (case-insensitively, since a case-insensitive login is still planned) and
-- take a _<gennis_id> suffix, the same shape seed_student_users.py used.
--
-- PASSWORD
-- The same hash every other student account carries, which verifies as "12345678".
-- Consistent with the rest of the estate; the estate-wide forced password change is
-- a separate open question.
--
-- LOCATION
-- Copied from the student's group, which is where gennis_user_link.location_id comes
-- from for the existing 15892 student links (all of which have one).
--
-- Re-runnable: inserts are guarded by NOT EXISTS on the link row and ON CONFLICT on
-- the username, so a second run is a no-op.
--
-- Usage:  psql -v apply=0   -- dry run (DEFAULT)
--         psql -v apply=1   -- write

\if :{?apply} \else \set apply 0 \endif

BEGIN;

-- Students with no login, excluding the synthetic test rows.
CREATE TEMP TABLE cand AS
SELECT s.id            AS student_id,
       s.gennis_id,
       s.user_id       AS gennis_user_id,
       coalesce(s.name, '')    AS name,
       coalesce(s.surname, '') AS surname,
       s.username      AS legacy_username,
       (SELECT g.location_id FROM gennis_student_group sg
          JOIN gennis_group g ON g.id = sg.group_id
         WHERE sg.student_id = s.id AND g.location_id IS NOT NULL
         ORDER BY g.deleted, g.id LIMIT 1) AS location_id,
       (SELECT g.location_name FROM gennis_student_group sg
          JOIN gennis_group g ON g.id = sg.group_id
         WHERE sg.student_id = s.id AND g.location_id IS NOT NULL
         ORDER BY g.deleted, g.id LIMIT 1) AS location_name
FROM gennis_student s
LEFT JOIN gennis_user_link l ON l.gennis_user_id = s.user_id
WHERE l.id IS NULL
  AND s.user_id IS NOT NULL
  AND s.gennis_id < 900000000
  AND coalesce(s.username, '') <> '';

-- Suffix only where the legacy name is already taken.
CREATE TEMP TABLE plan AS
SELECT c.*,
       CASE WHEN EXISTS (SELECT 1 FROM "user" u
                          WHERE lower(u.username) = lower(c.legacy_username))
            THEN c.legacy_username || '_' || c.gennis_id
            ELSE c.legacy_username
       END AS username
FROM cand c;

\echo '=== what will be created ==='
SELECT count(*)                                             AS accounts,
       count(*) FILTER (WHERE username <> legacy_username)  AS renamed_to_avoid_collision,
       count(*) FILTER (WHERE location_id IS NULL)          AS no_location_found
FROM plan;

\echo ''
\echo '=== collisions, in full ==='
SELECT student_id, gennis_id, legacy_username, username
FROM plan WHERE username <> legacy_username ORDER BY student_id;

\echo ''
\echo '=== sample of the rest ==='
SELECT student_id, gennis_id, name, surname, username, location_name
FROM plan WHERE username = legacy_username ORDER BY student_id LIMIT 10;

\echo ''
\echo '=== safety: any planned name still taken, or duplicated within the plan? ==='
SELECT (SELECT count(*) FROM plan p
         WHERE EXISTS (SELECT 1 FROM "user" u
                        WHERE lower(u.username) = lower(p.username))) AS still_taken,
       (SELECT count(*) FROM (SELECT lower(username) FROM plan
                              GROUP BY 1 HAVING count(*) > 1) d)      AS duplicated_in_plan;

\echo ''
\echo '=== Shohjaxon Abasov, the student this started from ==='
SELECT student_id, gennis_id, name, surname, username, location_name
FROM plan WHERE student_id = 232444;

\if :apply
    \echo ''
    \echo '>>> APPLYING <<<'

    WITH created AS (
        INSERT INTO "user"
            (name, surname, username, hashed_password, role,
             is_active, deleted, auth_provider, is_verified,
             failed_login_attempts, timezone)
        SELECT p.name, p.surname, p.username,
               '$2b$12$X00AYODqoQa05jprQb/D9uicX0NtQ3gJlOxNRK9IdsDaESb8hcrI2',
               'student', true, false, 'gennis', true, 0, 'Asia/Tashkent'
        FROM plan p
        ON CONFLICT (username) DO NOTHING
        RETURNING id, username
    )
    INSERT INTO gennis_user_link
        (management_user_id, gennis_user_id, location_id, location_name)
    SELECT c.id, p.gennis_user_id, p.location_id, p.location_name
    FROM created c
    JOIN plan p ON p.username = c.username
    WHERE NOT EXISTS (SELECT 1 FROM gennis_user_link l
                       WHERE l.gennis_user_id = p.gennis_user_id);

    \echo ''
    \echo '=== after: students still without a login ==='
    SELECT count(*) AS still_no_login
    FROM gennis_student s
    LEFT JOIN gennis_user_link l ON l.gennis_user_id = s.user_id
    WHERE l.id IS NULL AND s.gennis_id < 900000000;

    \echo ''
    \echo '=== Shohjaxon Abasov, resolved the way the app resolves him ==='
    SELECT s.id, s.gennis_id, u.id AS user_id, u.username, u.is_active
    FROM gennis_student s
    JOIN gennis_user_link l ON l.gennis_user_id = s.user_id
    JOIN "user" u ON u.id = l.management_user_id
    WHERE s.id = 232444;
    COMMIT;
\else
    \echo ''
    \echo '(dry run - nothing written. -v apply=1 to perform it)'
    ROLLBACK;
\endif
