-- Put 60 synced student payments back on the branch old gennis records.
--
-- SYMPTOM
-- Inkassatsiya for Gazalkent, 01-12 Aug, click read 24,744,500 against old gennis'
-- 25,337,500. Three payments dated 2026-08-01 were missing from the branch and one
-- belonging to another branch had appeared in it. All four exist in v2 with the
-- right amount, date and student -- only location_id differs.
--
-- CAUSE
-- scripts/sync_gennis_accounting.py upserts payments with
--   ON CONFLICT (id) DO UPDATE SET student_name=..., payment_sum=..., channel=...
-- and location_id is not in that list. The first insert carries the correct branch;
-- if the branch is corrected in old gennis afterwards, the sync re-reads the row,
-- updates everything else and silently leaves location_id at its original value.
-- (student_id and reason are omitted the same way -- fixed in the same commit.)
--
-- SCOPE
-- Measured across every synced accounting table: only student payments drifted.
-- Teacher, assistent and staff salary payments, overheads and capital: 0 rows each.
--
--   60 payments, 20,365,800 so'm, all Jul-Aug 2026.
--
-- This only changes which branch a payment is reported under. Amounts, dates,
-- students and the debt each payment settled are untouched, and gennis_student_credit
-- is not derived from this column.
--
-- Values are literal because old gennis is frozen, so the correct answers cannot
-- move. Each row is (payment_id, location_now, location_should_be) and the update
-- only fires when location_now still matches -- so a re-run is a no-op, and a row
-- someone has already corrected by hand is left alone.
--
-- Usage:  psql -v apply=0   -- dry run (DEFAULT)
--         psql -v apply=1   -- write

\if :{?apply} \else \set apply 0 \endif

BEGIN;

CREATE TEMP TABLE loc_fix (payment_id bigint, was int, should_be int) ON COMMIT DROP;
INSERT INTO loc_fix (payment_id, was, should_be) VALUES
    (60660, 2, 3),  --   430,000  2026-07-16  Sarvar Abduakimov
    (60665, 5, 2),  --   260,000  2026-07-29  Durdona Hakimboyeva
    (60666, 2, 5),  --   350,000  2026-07-29  Beknur Meyirbekov
    (60668, 3, 2),  --       900  2026-07-29  Otabek Ismailov
    (60669, 2, 3),  --   319,000  2026-07-28  Nurdavlet Jorabekov
    (60674, 3, 2),  --   360,000  2026-07-29  Abdulloh Majidov
    (60675, 2, 3),  --   150,000  2026-07-29  Zafarbek Yoldashev
    (60676, 1, 2),  --   305,000  2026-07-29  Islomjon Mirzatillayev
    (60680, 2, 1),  --   555,000  2026-07-29  Odilbek Ergashev
    (60681, 1, 2),  --   110,000  2026-07-29  Yasmina Xasanova
    (60686, 2, 1),  --   400,000  2026-07-29  Shahzoda Nigmatova
    (60687, 1, 2),  --   360,000  2026-07-29  Dilroza Abduvaliyeva
    (60688, 3, 1),  --   360,000  2026-07-29  Xushruza      Mirzatillayeva
    (60690, 2, 3),  --   236,000  2026-07-27  KAmola Pardayeva
    (60697, 3, 2),  --   340,000  2026-07-30  Asal Abdiyeva
    (60699, 2, 3),  --   430,000  2026-07-28  Ismoil Nusratullayev
    (60703, 3, 2),  --   400,000  2026-07-30  Moldir Ilisbekova
    (60706, 2, 3),  --   400,000  2026-07-29  Kamronbek Muxriddinov
    (60722, 5, 2),  --   279,000  2026-07-30  Sarkor Zikrillayev
    (60723, 2, 5),  --   400,000  2026-07-30  Madina Baxromova
    (60729, 3, 2),  --   420,000  2026-07-31  Zarina Adilbekova
    (60730, 2, 3),  --   166,000  2026-07-30  Shuhrat  Nasriddinov
    (60731, 1, 2),  --   300,000  2026-07-31  Rayhona  Norimboyeva
    (60742, 2, 1),  --   360,000  2026-07-30  Humoyun      Rozimov
    (60743, 2, 1),  --   360,000  2026-07-30  Moxinur YoLdashboyeva
    (60747, 1, 2),  --   360,000  2026-07-31  DilroZa Nortajiyeva
    (60748, 1, 2),  --   360,000  2026-07-31  Elnora Mamatova
    (60756, 2, 1),  --   290,000  2026-07-30  Jamoliddin  Hikkimov
    (60757, 2, 1),  --   360,000  2026-07-30  Arujan  Amanova
    (60765, 2, 1),  --   360,000  2026-07-31  Muhlisa Namozova
    (60766, 2, 1),  --   248,000  2026-07-31  Ozodbek Rixsiboyev
    (60767, 2, 1),  --   400,000  2026-07-31  Farangiz   Rahmatullayeva
    (60768, 1, 2),  --   355,000  2026-07-31  Madina Baxtiyorova
    (60769, 5, 2),  --   387,000  2026-07-31  Mahmud Almuxammedov
    (60770, 2, 1),  --   360,000  2026-07-31  Farangiz Akbarova
    (60774, 2, 1),  --   438,000  2026-07-31  Ziyoda Husanboyeva
    (60775, 3, 5),  --   370,000  2026-07-31  Nozanin Xoliqova
    (60776, 5, 2),  --   720,000  2026-07-31  Behruz Komiljonov
    (60777, 5, 2),  --   400,000  2026-07-31  Umidjon Shermetov
    (60779, 5, 2),  --   360,000  2026-08-01  Diyor Baxriddinov
    (60782, 2, 3),  --   330,000  2026-07-31  Mansur Erkinov
    (60783, 1, 5),  --   450,000  2026-08-01  Muxlisa Xasanboyeva
    (60784, 1, 5),  --   450,000  2026-08-01  Sohiba Raimova
    (60785, 1, 2),  --   360,000  2026-08-01  Aruna Muxtorova
    (60786, 1, 5),  --   450,000  2026-08-01  Amirbek Mansurov
    (60787, 1, 2),  --   300,000  2026-08-01  Araylum Baltabayeva
    (60788, 1, 2),  --   348,500  2026-08-01  Kumush Abdusalomova
    (60789, 1, 2),  --   400,000  2026-08-01  Oydin Rixstillayeva
    (60795, 5, 1),  --    18,400  2026-08-01  Mubina   Abdulazizova
    (60796, 2, 1),  --   250,000  2026-08-01  Shahzoda  NuManjonova
    (60801, 5, 1),  --   357,000  2026-08-01  Nurmuhammad Djumanov
    (60802, 2, 5),  --   450,000  2026-08-01  Abdurahmon Mavashev
    (60803, 1, 2),  --   323,000  2026-08-01  Jahongir  Mirzaliyev
    (60809, 1, 5),  --   400,000  2026-08-01  Azizbek Ahmedov
    (60811, 2, 1),  --   305,000  2026-08-01  Umida Turumbayeva
    (61229, 4, 1),  --   100,000  2026-08-12  Mohirbek  Davletmuhammedov
    (61230, 4, 1),  --   100,000  2026-08-12  Shirin  Axmadjonova
    (61231, 3, 1),  --   385,000  2026-08-12  Islom   Rustamov
    (61232, 3, 1),  --   385,000  2026-08-12  Ruhsora    Ukkiyeva
    (61233, 3, 1)   --   385,000  2026-08-12  Dilxushbek JoRayev
;

\echo ''
\echo '=== rows that will move ==='
SELECT f.was AS from_branch, f.should_be AS to_branch, count(*) AS payments,
       sum(p.payment_sum) AS amount
FROM loc_fix f
JOIN gennis_student_payment p ON p.id = f.payment_id AND p.location_id = f.was
GROUP BY 1, 2 ORDER BY 3 DESC;

\echo ''
\echo '=== total ==='
SELECT count(*) AS payments, sum(p.payment_sum) AS amount
FROM loc_fix f
JOIN gennis_student_payment p ON p.id = f.payment_id AND p.location_id = f.was;

\echo ''
\echo '=== already correct or changed since (skipped) ==='
SELECT f.payment_id, f.was AS expected_now, p.location_id AS actually_now
FROM loc_fix f
JOIN gennis_student_payment p ON p.id = f.payment_id
WHERE p.location_id <> f.was;

\if :apply
    \echo ''
    \echo '>>> APPLYING <<<'

    UPDATE gennis_student_payment p
    SET location_id = f.should_be
    FROM loc_fix f
    WHERE p.id = f.payment_id AND p.location_id = f.was;

    \echo ''
    \echo '=== after: rows still on the wrong branch (expect 0) ==='
    SELECT count(*) AS remaining
    FROM loc_fix f
    JOIN gennis_student_payment p ON p.id = f.payment_id
    WHERE p.location_id = f.was AND f.was <> f.should_be;

    COMMIT;
\else
    \echo ''
    \echo '(dry run - nothing written. -v apply=1 to perform it)'
    ROLLBACK;
\endif
