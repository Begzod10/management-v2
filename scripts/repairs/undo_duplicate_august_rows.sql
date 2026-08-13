-- Undo the duplicate rows created by import_august_charge_rows.sql.
--
-- WHAT WENT WRONG
-- gennis_attendance_history_student.group_id holds MIXED id spaces:
--   * rows synced from old gennis store the OLD GENNIS group id (e.g. 605)
--   * rows created locally by attendance/mark.py store the management
--     gennis_group.id (e.g. 12014)
--
-- The gap query that justified that import compared
-- gennis_lesson_attendance.group_id (always the management id — sync_attendance.py
-- translates it) against gennis_attendance_history_student.group_id. For every row
-- stored under the old-gennis convention the comparison could not match, so 615
-- (student, group) pairs looked like they had no charge row when they did.
--
-- The import then inserted them again using the management group id, producing a
-- second row for the same student, month and group under a different id space.
-- Verified concretely: student 215480, August 2026, group E13A1-10 —
--   id 69049  group_id   605  total_debt  30,769  synced 2026-08-04  (already there)
--   id 70185  group_id 12014  total_debt 123,076  synced 2026-08-13  (the duplicate)
--
-- 546 of the 553 inserted rows duplicate a pre-existing row. The other 7 are
-- genuinely new and are KEPT, as are all 8 rows from the earlier
-- import_missing_history_rows.sql (checked: 0 duplicates — that one keyed on
-- student+month, where no row existed for the student at all, so it was not
-- exposed to the group_id trap).
--
-- Matching is on (student_id, calendar_year, calendar_month, group_name) rather
-- than group_id, precisely because group_id is the field that cannot be trusted
-- across the two conventions. group_name is denormalized on both sides.
--
-- Re-runnable: once deleted there is nothing left in the id range to match.
--
-- Usage:  psql -v apply=0   -- dry run (DEFAULT)
--         psql -v apply=1   -- delete

\if :{?apply} \else \set apply 0 \endif

BEGIN;

CREATE TEMP TABLE doomed ON COMMIT DROP AS
SELECT mine.id, mine.student_id, mine.group_name, mine.total_debt, mine.remaining_debt
FROM gennis_attendance_history_student mine
WHERE mine.id BETWEEN 70185 AND 70737
  AND EXISTS (
      SELECT 1 FROM gennis_attendance_history_student old
      WHERE old.id < 70185
        AND old.student_id     = mine.student_id
        AND old.calendar_year  = mine.calendar_year
        AND old.calendar_month = mine.calendar_month
        AND old.group_name IS NOT DISTINCT FROM mine.group_name
  );

\echo ''
\echo '=== rows to delete ==='
SELECT count(*) AS rows, count(DISTINCT student_id) AS students,
       sum(total_debt) AS charge_removed, sum(remaining_debt) AS debt_removed
FROM doomed;

\echo ''
\echo '=== kept from that import (genuinely new) ==='
SELECT count(*) AS kept
FROM gennis_attendance_history_student
WHERE id BETWEEN 70185 AND 70737 AND id NOT IN (SELECT id FROM doomed);

\if :apply
    \echo ''
    \echo '>>> DELETING <<<'
    DELETE FROM gennis_attendance_history_student WHERE id IN (SELECT id FROM doomed);

    \echo ''
    \echo '=== after: duplicate (student, month, group_name) rows for Aug 2026 ==='
    SELECT count(*) AS remaining_duplicate_sets FROM (
        SELECT student_id, calendar_year, calendar_month, group_name
        FROM gennis_attendance_history_student
        WHERE calendar_year = 2026 AND calendar_month = 8
        GROUP BY 1,2,3,4 HAVING count(*) > 1) x;

    \echo ''
    \echo '=== total outstanding debt now ==='
    SELECT sum(remaining_debt) AS total_remaining FROM gennis_attendance_history_student;

    COMMIT;
\else
    \echo ''
    \echo '(dry run - nothing deleted. re-run with -v apply=1)'
    ROLLBACK;
\endif
