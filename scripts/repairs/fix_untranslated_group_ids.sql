-- Repair the 817 attendance-history rows whose group_id is an OLD GENNIS group id.
--
-- BACKGROUND
-- gennis_attendance_history_student.group_id holds this DB's gennis_group.id
-- (67,820 rows do, and student_id is 100% local on every row). The sync wrote the
-- source id straight through for 817 recent rows, so those point at the wrong id
-- space. attendance/mark.py always wrote the correct local id, so where both
-- systems saw the same month the row exists twice and the debt is counted twice.
--
-- The sync itself is fixed (scripts/sync_gennis_accounting.py now translates both
-- ids); this cleans up what it already wrote.
--
-- TWO DIFFERENT PROBLEMS, DELIBERATELY SEPARATED
--
--   PART A — 627 rows with NO management counterpart. Nothing to reconcile: the
--            group_id is simply written in the wrong id space. Translating it is
--            lossless and needs no judgement.
--
--   PART B — 190 pairs (189 students) where a management row already exists for
--            the same student, group and month. These need a merge decision about
--            real money, so this script only REPORTS them. See the note below.
--
-- Pairs are matched through the group mapping (old.group_id = g.gennis_id AND
-- mgmt.group_id = g.id), never on group_name: names are not unique — there are two
-- distinct groups called "E26A1-01" (mgmt 12087/gennis 452 and 12131/gennis 792) —
-- and matching on name both over- and under-matched (143 vs the real 190).
--
-- Usage:  psql -v apply=0   -- dry run (DEFAULT), reports both parts
--         psql -v apply=1   -- performs PART A only

\if :{?apply} \else \set apply 0 \endif

BEGIN;

-- rows whose group_id is an old-gennis id (matches gennis_id, not id)
CREATE TEMP TABLE odd ON COMMIT DROP AS
SELECT o.id, o.student_id, o.calendar_year AS yr, o.calendar_month AS mo,
       o.group_id AS old_group_id, g.id AS mgmt_group_id, g.name AS group_name,
       o.total_debt, o.payment, o.remaining_debt
FROM gennis_attendance_history_student o
JOIN gennis_group g ON g.gennis_id = o.group_id
WHERE NOT EXISTS (SELECT 1 FROM gennis_group g2 WHERE g2.id = o.group_id);

-- PART B: those that collide with an existing management row
CREATE TEMP TABLE collisions ON COMMIT DROP AS
SELECT o.id AS old_row, m.id AS mgmt_row, o.student_id, o.group_name, o.yr, o.mo,
       o.total_debt AS old_debt, m.total_debt AS mgmt_debt,
       o.payment    AS old_paid, m.payment    AS mgmt_paid,
       o.remaining_debt AS old_rem, m.remaining_debt AS mgmt_rem
FROM odd o
JOIN gennis_attendance_history_student m
  ON m.group_id = o.mgmt_group_id AND m.student_id = o.student_id
 AND m.calendar_year = o.yr AND m.calendar_month = o.mo;

-- PART A: the rest
CREATE TEMP TABLE safe ON COMMIT DROP AS
SELECT * FROM odd WHERE id NOT IN (SELECT old_row FROM collisions);

\echo ''
\echo '=== PART A — safe to translate (no counterpart) ==='
SELECT count(*) AS rows, count(DISTINCT student_id) AS students,
       sum(total_debt) AS debt, sum(remaining_debt) AS still_owed
FROM safe;

\echo ''
\echo '=== PART B — collisions, NOT touched by this script ==='
SELECT count(*) AS pairs, count(DISTINCT student_id) AS students,
       count(*) FILTER (WHERE old_debt = mgmt_debt AND old_paid = mgmt_paid) AS identical,
       sum(old_debt) AS old_side_debt,  sum(mgmt_debt) AS mgmt_side_debt,
       sum(old_paid) AS old_side_paid,  sum(mgmt_paid) AS mgmt_side_paid,
       sum(GREATEST(0, old_paid - mgmt_paid)) AS payment_only_on_old_side
FROM collisions;

\echo ''
\echo '=== PART B sample (largest disagreements) ==='
SELECT student_id, group_name, yr, mo, old_debt, mgmt_debt, old_paid, mgmt_paid
FROM collisions
WHERE old_debt <> mgmt_debt OR old_paid <> mgmt_paid
ORDER BY abs(old_debt - mgmt_debt) DESC LIMIT 10;

\if :apply
    \echo ''
    \echo '>>> APPLYING PART A ONLY <<<'
    UPDATE gennis_attendance_history_student h
    SET group_id = s.mgmt_group_id
    FROM safe s WHERE h.id = s.id;

    \echo ''
    \echo '=== rows still carrying an old-gennis group_id (should equal the collisions) ==='
    SELECT count(*) AS remaining
    FROM gennis_attendance_history_student o
    WHERE EXISTS (SELECT 1 FROM gennis_group g WHERE g.gennis_id = o.group_id)
      AND NOT EXISTS (SELECT 1 FROM gennis_group g WHERE g.id = o.group_id);

    COMMIT;
\else
    \echo ''
    \echo '(dry run - nothing written. -v apply=1 performs PART A only)'
    ROLLBACK;
\endif
