-- Resolve case-colliding usernames so login can be made case-insensitive.
--
-- WHY THIS IS NEEDED
-- Login matches usernames EXACTLY — auth.py:71 and integrations/student_platform.py:90
-- both use `User.username == login`. So "Doston" and "DOSTON" are two working accounts
-- and nothing breaks today. But it means a student whose account is "JASMINE" cannot
-- log in by typing "jasmine", and after restoring original usernames 3,119 student
-- logins are ALL CAPS and 12,495 are mixed case. Making the lookup case-insensitive
-- fixes that — and would immediately break these colliding accounts, because two rows
-- would match one input and scalar_one_or_none() raises instead of logging anyone in.
--
-- This clears the way. It does NOT change the lookup; that is a separate step, and it
-- should come after a case-insensitive unique index exists.
--
-- SCOPE — 77 accounts across the 73 groups whose accounts belong to DIFFERENT
-- people (e.g. teacher "Feruz Soatov" vs student "Feruzbek Ulug'bekov"). The 11 groups
-- that are the SAME person twice are deliberately left alone: those are a merge
-- decision, not a rename. One of them, "aziza12", is one person holding both a student
-- and a teacher account, which may well be intentional.
--
-- The same-person test compares normalised names, so it is approximate: "Asliddin
-- Mirmukhsinov" and "asliddin mir" read as two people and are renamed rather than
-- merged. That is harmless here — it separates the logins without asserting anything
-- about the accounts — but it means the 11 is a floor, not an exact count.
--
-- RULES USED (computed once, frozen into the list below)
--   * an account that has EVER logged in keeps its name — a credential in use is not
--     changed underneath someone. 0 of the renamed accounts have ever logged in.
--   * within a group the keeper is the logged-in account, else the lowest id
--   * everyone else takes a numeric suffix, skipping anything already taken
--
-- Re-runnable: only fires where the name still differs, and refuses a target already
-- held by another account.
--
-- Usage:  psql -v apply=0   -- dry run (DEFAULT)
--         psql -v apply=1   -- write

\if :{?apply} \else \set apply 0 \endif

BEGIN;

CREATE TEMP TABLE want (user_id bigint PRIMARY KEY, new_username text) ON COMMIT DROP;
INSERT INTO want VALUES
    (17877, 'ASiko2'),
    (16731, 'dr_max2'),
    (16938, 'muslima24'),
    (16743, 'Ali2'),
    (17492, 'yasmina8'),
    (17236, 'xasan4'),
    (18130, 'firdavs7'),
    (16776, 'test6'),
    (18016, 'testStudent5'),
    (18232, 'odilbek5'),
    (16932, 'mannopboy3'),
    (17522, 'farzona13'),
    (17281, 'shoxrux14'),
    (16799, 'Malika17'),
    (17266, 'abdurahmon6'),
    (18354, 'DIYORBEK6'),
    (17265, 'odil3'),
    (17202, 'ravshan4'),
    (16935, 'MuhammadAli17'),
    (17277, 'timur7'),
    (17097, 'javoxir6'),
    (16937, 'shaxzoda8'),
    (17497, 'diyor5'),
    (18357, 'DIYOR8'),
    (17287, 'madina110'),
    (17434, 'gulrux3'),
    (17072, 'Nilufar18'),
    (17247, 'feruza10'),
    (18509, 'laylo15'),
    (17257, 'malika18'),
    (17489, 'Asilbek11'),
    (18260, 'Safiya4'),
    (17477, 'Kumush9'),
    (18052, 'Shaxnoza4'),
    (17488, 'Asal10'),
    (18437, 'Nurmuhammad4'),
    (17480, 'Zilola11'),
    (18458, 'Jafar3'),
    (18026, 'Robiya5'),
    (18254, 'fariza12'),
    (18436, 'Muhammad14'),
    (17517, 'Umid8'),
    (18353, 'Asadbek14'),
    (18502, 'Muhammadamin13'),
    (18381, 'Muhammadamin8'),
    (18315, 'Amirbek5'),
    (17854, 'Muhammadyusuf8'),
    (18519, 'Kamronbek7'),
    (17907, 'Muhammadyusuf12'),
    (18048, 'MuhammadYusuf13'),
    (18481, 'Samira15'),
    (18318, 'Sadiya4'),
    (17848, 'Aziza18'),
    (18190, 'aziza19'),
    (18249, 'umar12'),
    (17526, 'Ulug`bek3'),
    (18171, 'JAVOHIR26'),
    (18426, 'Javohir27'),
    (17542, 'Turon132'),
    (18224, 'islombek15'),
    (17881, 'testUser3'),
    (18488, 'madinaaa4'),
    (18253, 'JAhongir110'),
    (18255, 'ezoza5'),
    (18294, 'mubina26'),
    (18202, 'firdavss4'),
    (18478, 'asilbekk7'),
    (18017, 'feruz4'),
    (18078, 'Regina4'),
    (18287, 'MAryam2'),
    (18390, 'ibrohim7'),
    (18280, 'Alisher6'),
    (18335, 'Makhmud3'),
    (18379, 'Soliha5'),
    (18508, 'mustafo5'),
    (18393, 'Kamronn5'),
    (18428, 'Jasur8');

CREATE TEMP TABLE plan ON COMMIT DROP AS
SELECT w.user_id, u.username AS current_username, w.new_username, u.role,
       trim(coalesce(u.name,'') || ' ' || coalesce(u.surname,'')) AS person
FROM want w
JOIN "user" u ON u.id = w.user_id
WHERE u.username IS DISTINCT FROM w.new_username
  AND u.last_login IS NULL          -- belt and braces: never touch a used credential
  AND NOT EXISTS (
      SELECT 1 FROM "user" o
      WHERE lower(o.username) = lower(w.new_username) AND o.id <> w.user_id
  );

\echo ''
\echo '=== what will change ==='
SELECT (SELECT count(*) FROM want) AS in_list,
       (SELECT count(*) FROM plan) AS will_rename,
       (SELECT count(*) FROM want) - (SELECT count(*) FROM plan) AS skipped;

\echo ''
\echo '=== case-insensitive duplicates remaining after this (should be 11) ==='
SELECT count(*) AS groups_left FROM (
    SELECT lower(CASE WHEN p.new_username IS NOT NULL THEN p.new_username ELSE u.username END)
    FROM "user" u LEFT JOIN plan p ON p.user_id = u.id
    WHERE u.username IS NOT NULL AND u.username <> ''
    GROUP BY 1 HAVING count(*) > 1) x;

\echo ''
\echo '=== sample ==='
SELECT role, current_username, new_username, person FROM plan ORDER BY user_id LIMIT 12;

\if :apply
    \echo ''
    \echo '>>> APPLYING <<<'
    UPDATE "user" u SET username = p.new_username FROM plan p WHERE u.id = p.user_id;

    \echo ''
    \echo '=== case-insensitive duplicate groups now (expect the 11 same-person ones) ==='
    SELECT count(*) FROM (
        SELECT lower(username) FROM "user"
        WHERE username IS NOT NULL AND username <> ''
        GROUP BY 1 HAVING count(*) > 1) x;
    COMMIT;
\else
    \echo ''
    \echo '(dry run - nothing written. -v apply=1 to perform it)'
    ROLLBACK;
\endif
