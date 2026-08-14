-- Reattach 153 real payments (53,182,000 so'm) to the students who actually
-- made them, and rebuild credit for everyone the mix-up touched.
--
-- SYMPTOM
-- Oltinbek Sorgulov's balance read +1,246,156. He is credited with a 1,440,000
-- payment that belongs to Aqmaral Tagaeva; his own real 194,000 payment sits
-- attached to Aqmaral instead.
--
-- CAUSE
-- Different from every other id defect fixed today (charity, groups, the 87
-- payments in f9376ea). Those pointed at NOTHING -- the join failed and the row
-- went invisible. This points at a REAL student, just the wrong one, so nothing
-- errors and no sweep for dangling ids catches it. It was found by comparing two
-- screenshots by hand.
--
-- Each row's WRONG student is the PREVIOUS row's CORRECT student -- a clean
-- cascading shift, not scattered swaps:
--     id 60660  should -> 231003
--     id 60661  should -> 232126   (== 60660's wrong value)
--     id 60662  should -> 229650   (== 60661's wrong value)
--     ...
-- consistent with a sync run where amount/date stayed correctly keyed to the
-- old-gennis payment id, but student_id was assigned from a separately-ordered
-- source that slipped out of alignment by one position partway through. The
-- correct value for every row below comes directly from old gennis's own record
-- at that same payment id -- independent of the chain pattern, not inferred from
-- it -- so misreading the chain cannot produce a wrong fix here.
--
-- SCOPE
-- 153 rows, 53,182,000 so'm, ids 60660-61240 (two sync batches, 29-31 Jul and a
-- smaller one in August), touching 171 students -- some are the wrong holder of
-- one payment and the rightful owner of another. All 171 already carry a credit
-- row.
--
-- WHAT THIS DOES
--   1. Re-points each payment's student_id to the student old gennis names for
--      that id.
--   2. Rebuilds gennis_student_credit for exactly those 171 students, with the
--      same formula rebuild_student_credit.sql already established for the whole
--      table -- balance = GREATEST(0, payments made - payments applied) -- scoped
--      to the 171 so this touches only the students the swap actually affected.
--
-- The preview below computes both parts from a single "effective" view of the
-- payment table (current student_id, with the 153 rows re-pointed in memory), so
-- the numbers shown are exactly what applying will produce -- not a parallel
-- calculation that could drift from it.
--
-- APPLIED 2026-08-14: 153/153 re-pointed, 0 remain on the wrong student.
-- Credit rebuilt for 171 students, 129 of whom changed: 15,642,383 -> 21,450,353.
-- The total rose because clamping at 0 is not linear -- reassigning money among
-- people with different debt does not conserve the clamped sum.
--
-- NOTE: this does not cover every case in the screenshot that surfaced it.
-- Oltinbek Sorgulov's own 1,440,000 payment (id 60715) has no old-gennis row at
-- ALL to anchor against -- see fix_orphan_payment_names.sql for that residual.
--
-- Usage:  psql -v apply=0   -- dry run (DEFAULT)
--         psql -v apply=1   -- write

\if :{?apply} \else \set apply 0 \endif

BEGIN;

CREATE TEMP TABLE swap (payment_id bigint, was int, should_be int) ON COMMIT DROP;
INSERT INTO swap (payment_id, was, should_be) VALUES
    (60660, 232126, 231003),  --   430,000  2026-07-16
    (60661, 229650, 232126),  --   360,000  2026-07-29
    (60662, 229658, 229650),  --   325,000  2026-07-29
    (60663, 231690, 229658),  --   325,000  2026-07-29
    (60664, 232351, 231690),  --   260,000  2026-07-29
    (60665, 228681, 232351),  --   260,000  2026-07-29
    (60666, 232122, 228681),  --   350,000  2026-07-29
    (60667, 227866, 232122),  --       400  2026-07-29
    (60668, 232396, 227866),  --       900  2026-07-29
    (60669, 231405, 232396),  --   319,000  2026-07-28
    (60670, 231404, 231405),  --   360,000  2026-07-29
    (60671, 228157, 231404),  --   360,000  2026-07-29
    (60672, 229434, 228157),  --   400,000  2026-07-29
    (60673, 231431, 229434),  --   360,000  2026-07-29
    (60674, 232408, 231431),  --   360,000  2026-07-29
    (60675, 232295, 232408),  --   150,000  2026-07-29
    (60676, 225167, 232295),  --   305,000  2026-07-29
    (60677, 230739, 225167),  --   682,000  2026-07-29
    (60678, 227247, 230739),  --   348,000  2026-07-29
    (60679, 219646, 227247),  --   300,000  2026-07-29
    (60680, 231705, 219646),  --   555,000  2026-07-29
    (60681, 227646, 231705),  --   110,000  2026-07-29
    (60682, 230000, 227646),  --   400,000  2026-07-29
    (60683, 231983, 230000),  --   360,000  2026-07-29
    (60684, 232107, 231983),  --   290,000  2026-07-29
    (60685, 232231, 232107),  --   400,000  2026-07-29
    (60686, 232280, 232231),  --   400,000  2026-07-29
    (60687, 232189, 232280),  --   360,000  2026-07-29
    (60688, 232288, 232189),  --   360,000  2026-07-29
    (60689, 260702, 232288),  --   385,000  2026-07-27
    (60690, 231372, 260702),  --   236,000  2026-07-27
    (60691, 231348, 231372),  --   360,000  2026-07-29
    (60692, 232084, 231348),  --   400,000  2026-07-29
    (60693, 228926, 232084),  --   360,000  2026-07-30
    (60694, 232131, 228926),  --   360,000  2026-07-30
    (60695, 232130, 232131),  --   325,000  2026-07-30
    (60696, 229076, 232130),  --   325,000  2026-07-30
    (60697, 226957, 229076),  --   340,000  2026-07-30
    (60698, 231808, 226957),  --   770,000  2026-07-18
    (60699, 230234, 231808),  --   430,000  2026-07-28
    (60700, 230358, 230234),  --   360,000  2026-07-30
    (60701, 230535, 230358),  --   200,000  2026-07-30
    (60702, 230187, 230535),  --   400,000  2026-07-30
    (60703, 232112, 230187),  --   400,000  2026-07-30
    (60704, 229443, 232112),  --   166,000  2026-07-30
    (60705, 232541, 229443),  --   298,000  2026-07-29
    (60706, 227050, 232541),  --   400,000  2026-07-29
    (60707, 228134, 227050),  --   135,000  2026-07-30
    (60708, 230501, 228134),  --   360,000  2026-07-30
    (60709, 228872, 230501),  --   400,000  2026-07-30
    (60710, 232307, 228872),  --   400,000  2026-07-30
    (60711, 215526, 232307),  --   522,000  2026-07-30
    (60712, 222360, 215526),  --   360,000  2026-07-30
    (60713, 232069, 222360),  --   360,000  2026-07-30
    (60714, 231733, 232069),  --   330,000  2026-07-30
    (60716, 230479, 232542),  --   194,000  2026-07-30
    (60717, 232025, 230479),  --   360,000  2026-07-30
    (60718, 232464, 232025),  --   720,000  2026-07-30
    (60719, 231297, 232464),  --   400,000  2026-07-30
    (60720, 227170, 231297),  --   360,000  2026-07-30
    (60721, 228793, 227170),  --   247,000  2026-07-30
    (60722, 231797, 228793),  --   279,000  2026-07-30
    (60723, 228808, 231797),  --   400,000  2026-07-30
    (60724, 232349, 228808),  --    86,000  2026-07-30
    (60725, 229967, 232349),  --   300,000  2026-07-31
    (60726, 231738, 229967),  --   360,000  2026-07-31
    (60727, 228058, 231738),  --   360,000  2026-07-31
    (60728, 229821, 228058),  --   100,000  2026-07-31
    (60729, 231170, 229821),  --   420,000  2026-07-31
    (60730, 230418, 231170),  --   166,000  2026-07-30
    (60731, 229875, 230418),  --   300,000  2026-07-31
    (60736, 228146, 229875),  --   360,000  2026-07-30
    (60737, 230138, 221368),  --   300,000  2026-07-30
    (60738, 230756, 232033),  --   600,000  2026-07-30
    (60739, 227025, 231902),  --   300,000  2026-07-30
    (60740, 228110, 229981),  --   340,000  2026-07-30
    (60741, 226972, 228146),  --   202,000  2026-07-30
    (60742, 230301, 230138),  --   360,000  2026-07-30
    (60743, 232412, 230756),  --   360,000  2026-07-30
    (60744, 232471, 227025),  --   330,000  2026-07-30
    (60745, 232468, 228110),  --   360,000  2026-07-30
    (60746, 232469, 226972),  --   350,000  2026-07-30
    (60747, 232475, 230301),  --   360,000  2026-07-31
    (60748, 217164, 232412),  --   360,000  2026-07-31
    (60749, 227972, 232471),  --   290,000  2026-07-30
    (60750, 231975, 232468),  --   290,000  2026-07-30
    (60751, 228153, 232469),  --   290,000  2026-07-30
    (60754, 229854, 217164),  --   300,000  2026-07-30
    (60755, 230454, 227972),  --   360,000  2026-07-30
    (60756, 231384, 231975),  --   290,000  2026-07-30
    (60757, 230217, 228153),  --   360,000  2026-07-30
    (60758, 232232, 228401),  --   360,000  2026-07-30
    (60759, 230680, 229925),  --   151,000  2026-07-30
    (60760, 229665, 229854),  --   760,000  2026-07-30
    (60761, 230430, 230454),  --   610,000  2026-07-31
    (60762, 228810, 231384),  --   975,000  2026-07-31
    (60765, 232402, 230680),  --   360,000  2026-07-31
    (60766, 232438, 229665),  --   248,000  2026-07-31
    (60767, 231335, 230430),  --   400,000  2026-07-31
    (60768, 222918, 228810),  --   355,000  2026-07-31
    (60769, 231265, 232513),  --   387,000  2026-07-31
    (60770, 231410, 228645),  --   360,000  2026-07-31
    (60771, 231068, 232402),  --   370,000  2026-07-31
    (60772, 229484, 232438),  --   332,000  2026-07-31
    (60773, 232413, 231335),  --   400,000  2026-07-31
    (60774, 232268, 222918),  --   438,000  2026-07-31
    (60775, 227022, 231265),  --   370,000  2026-07-31
    (60776, 228145, 231410),  --   720,000  2026-07-31
    (60777, 232545, 231068),  --   400,000  2026-07-31
    (60778, 231928, 229484),  --   360,000  2026-07-31
    (60779, 232547, 232413),  --   360,000  2026-08-01
    (60781, 227422, 232268),  --   400,000  2026-08-01
    (60782, 231090, 227022),  --   330,000  2026-07-31
    (60783, 230507, 228145),  --   450,000  2026-08-01
    (60784, 225457, 232545),  --   450,000  2026-08-01
    (60785, 232156, 231928),  --   360,000  2026-08-01
    (60786, 225456, 232547),  --   450,000  2026-08-01
    (60787, 232156, 229926),  --   300,000  2026-08-01
    (60788, 232528, 227422),  --   348,500  2026-08-01
    (60789, 230081, 231090),  --   400,000  2026-08-01
    (60790, 232528, 230507),  --   245,000  2026-08-01
    (60791, 231039, 225457),  --   631,000  2026-08-01
    (60792, 228723, 232156),  --    46,800  2026-08-01
    (60793, 228722, 225456),  --   299,000  2026-08-01
    (60794, 231421, 232156),  --   261,000  2026-08-01
    (60795, 232316, 232528),  --    18,400  2026-08-01
    (60796, 230073, 230081),  --   250,000  2026-08-01
    (60797, 224772, 232528),  --   260,000  2026-08-01
    (60798, 230712, 231039),  --   180,000  2026-08-01
    (60799, 216835, 228723),  --   275,000  2026-08-01
    (60800, 231350, 228722),  --   325,000  2026-08-01
    (60801, 227510, 231421),  --   357,000  2026-08-01
    (60802, 232052, 232316),  --   450,000  2026-08-01
    (60803, 226142, 230073),  --   323,000  2026-08-01
    (60804, 226351, 224772),  --   300,000  2026-08-01
    (60805, 227507, 230712),  --   305,000  2026-08-01
    (60806, 223002, 216835),  --   300,000  2026-08-01
    (60808, 228503, 231350),  --   360,000  2026-08-01
    (60809, 217805, 227510),  --   400,000  2026-08-01
    (60810, 228443, 232052),  --   325,000  2026-08-01
    (60811, 232315, 226142),  --   305,000  2026-08-01
    (60812, 229896, 226351),  --   360,000  2026-08-01
    (61227, 232543, 231153),  --   360,000  2026-08-12
    (61228, 231962, 231015),  --   360,000  2026-08-12
    (61229, 226192, 228274),  --   100,000  2026-08-12
    (61230, 226192, 229505),  --   100,000  2026-08-12
    (61231, 232444, 232321),  --   385,000  2026-08-12
    (61232, 232278, 231301),  --   385,000  2026-08-12
    (61233, 231449, 229807),  --   385,000  2026-08-12
    (61234, 232007, 232123),  --   800,000  2026-08-13
    (61236, 278036, 232081),  --    90,000  2026-08-13
    (61238, 232485, 231988),  --   300,000  2026-08-13
    (61240, 232123, 231684)   --   450,000  2026-08-13
;

CREATE TEMP TABLE touched ON COMMIT DROP AS
SELECT DISTINCT student_id FROM (
    SELECT was AS student_id FROM swap
    UNION
    SELECT should_be FROM swap
) x;

-- every non-deleted payment for a touched student, with the 153 fixes applied
-- in memory -- this is what the table looks like immediately after the UPDATE
CREATE TEMP TABLE effective_payments ON COMMIT DROP AS
SELECT p.id,
       coalesce(s.should_be, p.student_id) AS student_id,
       p.payment_sum
FROM gennis_student_payment p
LEFT JOIN swap s ON s.payment_id = p.id
WHERE NOT p.deleted
  AND coalesce(s.should_be, p.student_id) IN (SELECT student_id FROM touched);

\echo ''
\echo '=== guard: every payment_id is unique in the fix list (expect 0) ==='
SELECT count(*) AS duplicated FROM (
  SELECT payment_id FROM swap GROUP BY 1 HAVING count(*) > 1) x;

\echo ''
\echo '=== guard: each target is a real student (expect rows = targets = resolves) ==='
SELECT count(*) AS rows, count(DISTINCT s.should_be) AS targets,
       count(*) FILTER (WHERE st.id IS NOT NULL) AS resolves
FROM swap s LEFT JOIN gennis_student st ON st.id = s.should_be;

\echo ''
\echo '=== guard: the row still holds the value we expect (expect 0 mismatched) ==='
SELECT count(*) AS mismatched
FROM swap s
JOIN gennis_student_payment p ON p.id = s.payment_id
WHERE p.student_id <> s.was OR p.deleted;

\echo ''
\echo '=== what moves ==='
SELECT count(*) AS payments, count(DISTINCT was) AS wrong_holders,
       count(DISTINCT should_be) AS rightful_owners,
       sum(p.payment_sum) AS amount
FROM swap s JOIN gennis_student_payment p ON p.id = s.payment_id;

\echo ''
\echo '=== credit before vs after, largest changes ==='
CREATE TEMP TABLE credit_after ON COMMIT DROP AS
SELECT t.student_id, a.location_id,
       coalesce(ep.paid, 0) AS paid,
       coalesce(a.applied, 0) AS applied,
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
       coalesce(cr.balance,0) AS credit_before,
       ca.balance AS credit_after,
       ca.balance - coalesce(cr.balance,0) AS change
FROM credit_after ca
JOIN gennis_student s ON s.id = ca.student_id
LEFT JOIN gennis_student_credit cr ON cr.student_id = ca.student_id
WHERE ca.balance <> coalesce(cr.balance,0)
ORDER BY abs(ca.balance - coalesce(cr.balance,0)) DESC
LIMIT 15;

\echo ''
\echo '=== totals ==='
SELECT count(*) AS students,
       count(*) FILTER (WHERE ca.balance <> coalesce(cr.balance,0)) AS changing,
       sum(ca.balance) AS total_credit_after,
       sum(coalesce(cr.balance,0)) AS total_credit_before
FROM credit_after ca
LEFT JOIN gennis_student_credit cr ON cr.student_id = ca.student_id;

\if :apply
    \echo ''
    \echo '>>> APPLYING <<<'

    UPDATE gennis_student_payment p
    SET student_id = s.should_be
    FROM swap s
    WHERE p.id = s.payment_id AND p.student_id = s.was;

    INSERT INTO gennis_student_credit (student_id, location_id, balance)
    SELECT student_id, location_id, balance FROM credit_after
    ON CONFLICT (student_id) DO UPDATE
      SET balance = EXCLUDED.balance,
          location_id = coalesce(EXCLUDED.location_id, gennis_student_credit.location_id);

    \echo ''
    \echo '=== after: payments still on the wrong student (expect 0) ==='
    SELECT count(*) AS remaining
    FROM swap s JOIN gennis_student_payment p ON p.id = s.payment_id
    WHERE p.student_id <> s.should_be;

    \echo ''
    \echo '=== after: credit for the touched students ==='
    SELECT count(*) AS students, sum(balance) AS total
    FROM gennis_student_credit WHERE student_id IN (SELECT student_id FROM touched);

    COMMIT;
\else
    \echo ''
    \echo '(dry run - nothing written. -v apply=1 to perform it)'
    ROLLBACK;
\endif
