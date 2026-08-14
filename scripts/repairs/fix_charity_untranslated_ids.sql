-- Repair gennis_student_charity rows whose ids were never translated out of the
-- old-gennis id space.
--
-- BACKGROUND
-- This is the same defect fix_untranslated_group_ids.sql cleaned up in
-- gennis_attendance_history_student, on a table that was missed. Of the 1237 live
-- charity rows:
--
--     18   student_id and group_id are both local ids   -> created in v2, correct
--   1200   student_id local, group_id is an OLD gennis id
--     19   both ids are old gennis ids
--
-- Everything that reads a charity joins on the local gennis_group.id — attendance
-- marking (attendance/mark.py), the attendance history view, and the charity upsert
-- itself. So 1219 of 1237 charities never resolve: the discount is recorded and then
-- silently not applied, and students who should be charged less pay full price.
--
-- Measured before this repair: 462 charities belonging to 372 students still
-- enrolled in the group the charity is for, worth 21,636,300 so'm a month. The code
-- finds 18 of them.
--
-- The upsert in accounting/charity.py matches on group_id too, so it never finds the
-- migrated row either and writes a second one instead — which is where most of the
-- 18 local rows came from. Those duplicates are reported here, not merged.
--
-- WHY MATCHING IS UNAMBIGUOUS
-- The two id spaces do not overlap on this table: 18 rows match gennis_group.id,
-- 1219 match gennis_group.gennis_id, 18 + 1219 = 1237, and no row matches both. The
-- guard below re-checks that at run time rather than trusting the count.
--
-- Old gennis keys a charity on (student, group) alone and applies it every month
-- for as long as the student is in the group — the calendar_* columns record when it
-- was entered, not what it applies to (backend/account/payment.py:365,
-- teacher/teacher.py:284, both filter_by student+group only). This script does not
-- touch those columns; the month filter lives in application code.
--
-- Usage:  psql -v apply=0   -- dry run (DEFAULT)
--         psql -v apply=1   -- write

\if :{?apply} \else \set apply 0 \endif

BEGIN;

-- Rows needing a group translation: group_id resolves through gennis_id and not id.
CREATE TEMP TABLE fix_group ON COMMIT DROP AS
SELECT c.id, c.student_id, c.group_id AS old_group_id, g.id AS mgmt_group_id,
       g.name AS group_name, c.discount, c.calendar_year AS yr, c.calendar_month AS mo
FROM gennis_student_charity c
JOIN gennis_group g ON g.gennis_id = c.group_id
WHERE c.deleted = false
  AND NOT EXISTS (SELECT 1 FROM gennis_group g2 WHERE g2.id = c.group_id);

-- Rows whose student_id is also still an old-gennis id.
CREATE TEMP TABLE fix_student ON COMMIT DROP AS
SELECT c.id, c.student_id AS old_student_id, s.id AS mgmt_student_id,
       s.name, s.surname
FROM gennis_student_charity c
JOIN gennis_student s ON s.gennis_id = c.student_id
WHERE c.deleted = false
  AND NOT EXISTS (SELECT 1 FROM gennis_student s2 WHERE s2.id = c.student_id);

-- After translating, would a row land on a (student, group) pair that already has a
-- live charity? That is a real duplicate and needs a human decision, so it is only
-- reported and excluded from the update.
CREATE TEMP TABLE collisions ON COMMIT DROP AS
SELECT f.id AS migrated_row, k.id AS existing_row, f.group_name,
       coalesce(fs.mgmt_student_id, f.student_id) AS student_id,
       f.discount AS migrated_discount, k.discount AS existing_discount
FROM fix_group f
LEFT JOIN fix_student fs ON fs.id = f.id
JOIN gennis_student_charity k
  ON k.group_id = f.mgmt_group_id
 AND k.student_id = coalesce(fs.mgmt_student_id, f.student_id)
 AND k.deleted = false
 AND k.id <> f.id;

\echo ''
\echo '=== guard: no row may resolve in BOTH id spaces (expect 0) ==='
SELECT count(*) AS ambiguous
FROM gennis_student_charity c
WHERE c.deleted = false
  AND EXISTS (SELECT 1 FROM gennis_group g  WHERE g.id        = c.group_id)
  AND EXISTS (SELECT 1 FROM gennis_group g2 WHERE g2.gennis_id = c.group_id);

\echo ''
\echo '=== what will be translated ==='
SELECT (SELECT count(*) FROM fix_group)   AS group_ids_to_fix,
       (SELECT count(*) FROM fix_student) AS student_ids_to_fix,
       (SELECT count(*) FROM collisions)  AS collisions_left_alone;

\echo ''
\echo '=== charities that will start applying again ==='
SELECT count(*) AS charities, count(DISTINCT f.student_id) AS students,
       sum(f.discount) AS discount_per_month
FROM fix_group f
JOIN gennis_student_group sg
  ON sg.student_id = f.student_id AND sg.group_id = f.mgmt_group_id
WHERE f.id NOT IN (SELECT migrated_row FROM collisions);

\echo ''
\echo '=== collisions ==='
\echo '(identical amounts are the re-entry case: the admin typed the charity again'
\echo ' because the upsert could not find the migrated row. The migrated one is'
\echo ' redundant and gets soft-deleted — leaving it would double the discount once'
\echo ' the ids resolve. Differing amounts are reported and left alone.)'
SELECT *, (migrated_discount = existing_discount) AS will_soft_delete_migrated
FROM collisions ORDER BY student_id LIMIT 20;

\echo ''
\echo '=== sample of the translation ==='
SELECT f.id, f.student_id, f.old_group_id AS "group_id now",
       f.mgmt_group_id AS "becomes", f.group_name, f.discount
FROM fix_group f ORDER BY f.id DESC LIMIT 10;

\if :apply
    \echo ''
    \echo '>>> APPLYING <<<'

    UPDATE gennis_student_charity c
    SET group_id = f.mgmt_group_id
    FROM fix_group f
    WHERE c.id = f.id
      AND f.id NOT IN (SELECT migrated_row FROM collisions);

    UPDATE gennis_student_charity c
    SET student_id = s.mgmt_student_id
    FROM fix_student s
    WHERE c.id = s.id
      AND s.id NOT IN (SELECT migrated_row FROM collisions);

    -- Redundant re-entries: same student, same group, same amount. Soft-deleted so
    -- the discount is not applied twice now that both rows resolve.
    UPDATE gennis_student_charity c
    SET deleted = true
    FROM collisions x
    WHERE c.id = x.migrated_row
      AND x.migrated_discount = x.existing_discount;

    \echo ''
    \echo '=== after: rows still holding an old-gennis id (should equal collisions) ==='
    SELECT count(*) AS group_ids_left
    FROM gennis_student_charity c
    WHERE c.deleted = false
      AND EXISTS (SELECT 1 FROM gennis_group g WHERE g.gennis_id = c.group_id)
      AND NOT EXISTS (SELECT 1 FROM gennis_group g WHERE g.id = c.group_id);

    \echo ''
    \echo '=== after: live charities the application can now resolve ==='
    SELECT count(*) AS charities, count(DISTINCT c.student_id) AS students,
           sum(c.discount) AS discount_per_month
    FROM gennis_student_charity c
    JOIN gennis_group g          ON g.id = c.group_id AND g.deleted = false
    JOIN gennis_student_group sg ON sg.student_id = c.student_id AND sg.group_id = g.id
    WHERE c.deleted = false;

    COMMIT;
\else
    \echo ''
    \echo '(dry run - nothing written. -v apply=1 to perform it)'
    ROLLBACK;
\endif
