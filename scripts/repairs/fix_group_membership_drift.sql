-- Make v2's group membership match old gennis'.
--
-- SYMPTOM
-- v2 group E73A201 lists 6 students; old gennis' insideGroup/784 shows
-- "Studentlar soni: 0" for the same group. All six are in old gennis group 752
-- (E73A208) -- and v2 has them in 752 as well. The E73A201 enrolment is left over
-- from before they moved.
--
-- CAUSE
-- scripts/copy_gennis_groups_students.py is insert-only. sync_active_links inserts
-- ON CONFLICT DO NOTHING and never deletes; sync_deleted_students writes the drop
-- into gennis_deleted_student_group but does not remove the matching row from
-- gennis_student_group. So once a student is enrolled in v2, leaving or moving group
-- in old gennis never propagates -- the stale enrolment simply stays.
--
-- SCOPE  (175 groups compared, matched on gennis_id, never on name: names are not
-- unique -- two distinct groups are called "E26A1-01")
--   102 groups differ
--   199 enrolments v2 has that old gennis does not:
--         144  the student was dropped, and v2 records the drop itself
--          50  the student is in a different group in old gennis
--          21  the student is in no group at all in old gennis
--   12 enrolments old gennis has that v2 lacks
--
-- Of the 63 extras whose student is still in some group, 62 are pure duplicates --
-- v2 already holds the correct enrolment too, so dropping the stale one loses
-- nothing. The one remaining student is covered by the INSERT below.
--
-- 140 students end up in no group at all. That is correct: old gennis has them in
-- none either. They keep their history, payments and profile; they stop appearing on
-- a roster they had left, and stop being billed for it.
--
-- Synthetic test rows (Test O'quvchi..., gennis_id 900086768+) are excluded -- they
-- never existed in old gennis and would otherwise be swept up.
--
-- WHAT THIS CHANGES
-- Membership only. Attendance, charges, payments and balances already recorded are
-- untouched. It does change what future lesson marking bills, which is the point.
--
-- Ids are literal because old gennis is frozen, so the correct answer cannot move.
-- Re-runnable: the DELETE is a no-op once gone, the INSERT is ON CONFLICT DO NOTHING.
--
-- Usage:  psql -v apply=0   -- dry run (DEFAULT)
--         psql -v apply=1   -- write

\if :{?apply} \else \set apply 0 \endif

BEGIN;

CREATE TEMP TABLE drop_link (student_id bigint, group_id bigint) ON COMMIT DROP;
INSERT INTO drop_link VALUES
    (220061, 12258),  -- Albina Saparaliyeva         C44B103 
    (221757, 12301),  -- Bonu Saidazimova            E13A2-12
    (222274, 12238),  -- Sevara Hamidullayeva        C44B101
    (223352, 12179),  -- Gulmira Andakulova          C44B105
    (223540, 12314),  -- Barno Oybekova              Beginner
    (224580, 12228),  -- Sheroz Abdulxayev           Dchj 10:30
    (225281, 12130),  -- Robiya Yuldasheva           C44A106New
    (226295, 12238),  -- Islombek Ormonov            C44B101
    (226380, 12211),  -- Malika Abrorova             Mt06A104
    (226739, 12252),  -- Mamur Abdumominov           Bb22302
    (226825, 12130),  -- Aslzoda Sohiboyeva          C44A106New
    (226966, 12242),  -- Kumush Sultanazarova        Cefr
    (227033, 12215),  -- Azizbek Sodiqov             Math01
    (227033, 12200),  -- Azizbek Sodiqov             Tarix01
    (227204, 12319),  -- Madina Uskanboyeva          Mt06A103
    (227369, 12301),  -- Jafar Tojimboyev            E13A2-12
    (227645, 12136),  -- Novfar Xasanboyev           E19B1-10
    (227716, 12270),  -- Humora  Muhammadova         E31B204
    (227791, 12177),  -- Afruza Miragzamova          Huquq-1
    (227866, 12238),  -- Otabek Ismailov             C44B101
    (228045, 12131),  -- Ibrohim     Melisov         E26A1-01
    (228059, 12208),  -- Ziyoda Rustamova            M-K008
    (228325, 12014),  -- Asal Abezxonova             E13A1-10
    (228777, 12179),  -- Maftuna Qodirova            C44B105
    (228795, 12247),  -- Javlon ToYchiboyev          E31A210
    (229277, 12126),  -- Karomat Tojialiyeva         E19A2-12
    (229322, 12278),  -- Feruza Tojialiyeva          E11A1-13
    (229333, 12290),  -- Hojakbar Shuhratov          E30A1-09
    (229339, 12280),  -- Solixa Usmonaliyeva         R-Ment002
    (229434, 12117),  -- Sevdo Baxtiyorova           E73A211
    (229460, 12297),  -- DIYORA MUXIDDINOVA          Sh-Web001
    (229605, 12297),  -- Behruz Ibrohimov            Sh-Web001
    (229625, 12199),  -- Muhammad Olimjonov          E15A101
    (229665, 12278),  -- Ozodbek Rixsiboyev          E11A1-13
    (229681, 12139),  -- Sevinch Mirqosimova         E73A201
    (229699, 12168),  -- suxrob nazarov              Sh-Web004
    (229722, 12278),  -- Shabnam Shavkatova          E11A1-13
    (229752, 12139),  -- Sardor Sherzodov            E73A201
    (229795, 12258),  -- Sunnat  Beysenov            C44B103 
    (229807, 12278),  -- Dilxushbek JoRayev          E11A1-13
    (229820, 12139),  -- Shoxistabonu Abduxoliqova   E73A201
    (229838, 12078),  -- Mubina Keldiboyeva          M-B-012
    (229892, 12078),  -- Dima Shao                   M-B-012
    (229895, 12074),  -- Omina Toshtemirova          R11.B1-08
    (229944, 12139),  -- Aruna Abdanbekova           E73A201
    (230166, 12019),  -- Arstanbek Sotbarov          Beginner0002
    (230267, 12199),  -- Rushana  Ismailovan         E15A101
    (230301, 12139),  -- DilroZa Nortajiyeva         E73A201
    (230314, 12130),  -- Xosiyatxon  Toshtamova      C44A106New
    (230406, 12297),  -- ELBEK MAVLYANKULOV          Sh-Web001
    (230418, 12117),  -- Rayhona  Norimboyeva        E73A211
    (230479, 12130),  -- Aqmaral Tagaeva             C44A106New
    (230531, 12117),  -- Sabina Uskanboyeva          E73A211
    (230589, 12063),  -- Ibroxim Nigmatullayev       Dchj9:00
    (230631, 12168),  -- Qayumjon Sultonov           Sh-Web004
    (230636, 12063),  -- Bexruz BoypoLatov           Dchj9:00
    (230690, 12117),  -- Arujan  Kanatbayeva         E73A211
    (230718, 12162),  -- Aziza Ortiqboyeva           E13A1-13
    (230723, 12208),  -- Muhammadtoxir Ilxomov       M-K008
    (230759, 12168),  -- Nursulton Anorboyev         Sh-Web004
    (230803, 12322),  -- Moxinur Mahamatova          E77A102
    (230805, 12168),  -- Diyora Asqarova             Sh-Web004
    (230837, 12131),  -- Maftuna   Rajaboyeva        E26A1-01
    (230900, 12168),  -- DURDONA TURSONOVA           Sh-Web004
    (230991, 12316),  -- BExruz BAxromov             Sh-Web004
    (230992, 12316),  -- FArrux Inomjonov            Sh-Web004
    (230994, 12168),  -- Abdugaffor Abdumannopov     Sh-Web004
    (231036, 12316),  -- Asad Tojiboyev              Sh-Web004
    (231042, 12278),  -- Dilnura Sagatova            E11A1-13
    (231063, 12130),  -- Ezoza Mirzatillayeva        C44A106New
    (231109, 12268),  -- Dilnura Sobirova            E31B109
    (231117, 12268),  -- Navruz Saprbekov            E31B109
    (231128, 12208),  -- Muhammad Rahmonaliyev       M-K008
    (231133, 13284),  -- Moxinur Ashirboyeva         kimyo sardor
    (231215, 12117),  -- Diyora Riskaliyeva          E73A211
    (231255, 12173),  -- Muazzam  Mamasodiqova       E19A1-13
    (231258, 12079),  -- Kamronbek Muxriddinov       R-Ment001
    (231301, 12126),  -- Ruhsora    Ukkiyeva         E19A2-12
    (231372, 12247),  -- Anvar  TurgInmirzayev       E31A210
    (231384, 12157),  -- Kenan Sezgin                M99A201
    (231384, 12233),  -- Kenan Sezgin                R11A1-12
    (231393, 12322),  -- Sevinch Shokirova           E77A102
    (231395, 12130),  -- Lola  Anvarxojayeva         C44A106New
    (231403, 12173),  -- Mirali Nortojiyev           E19A1-13
    (231420, 12316),  -- Farxod Nigmatullayev        Sh-Web004
    (231470, 12139),  -- Robiya Risqimboyeva         E73A201
    (231603, 12060),  -- Oysha Tillaboyeva           Intermediate gazalkent
    (231622, 12236),  -- Shahzoda Tojiboyeva         E77A101
    (231623, 12316),  -- GULSANAM NAZIMOVA           Sh-Web004
    (231639, 12173),  -- Mubina   Nurmuhammedova     E19A1-13
    (231646, 12107),  -- ABBOS MAXAMADOV             Sh-Web005
    (231667, 12199),  -- Mushtariybonu Saidakbarova  E15A101
    (231684, 12107),  -- Abdulla Abduqaxorov         Sh-Web005
    (231690, 12195),  -- Aziz Hakimboyev             E45A106
    (231734, 12160),  -- Umida Gayratjonova          F-R002
    (231738, 12117),  -- Meruert Nurlanova           E73A211
    (231746, 12195),  -- Aslzoda Abdullayeva         E45A106
    (231746, 12157),  -- Aslzoda Abdullayeva         M99A201
    (231747, 12324),  -- Mohina Abdullayeva          Math Kids
    (231748, 12199),  -- Sherali ORaqov              E15A101
    (231766, 12130),  -- Mirxan Miradilov            C44A106New
    (231786, 12117),  -- Farangiz Akromova           E73A211
    (231849, 12217),  -- Rahimaxon Rahimova          R-Math001
    (231849, 12244),  -- Rahimaxon Rahimova          M-Prez
    (231850, 12200),  -- Dusmamatova Mashxura        Tarix01
    (231853, 12244),  -- Davlatbek Musulmonov        M-Prez
    (231885, 12293),  -- Shoxrux Murodov             Advanced
    (231887, 12107),  -- Madina Rahimberdiyeva       Sh-Web005
    (231888, 12107),  -- Saida Rahimberdiyeva        Sh-Web005
    (231911, 12233),  -- Diyora Abdujamilova         R11A1-12
    (231934, 12293),  -- Madina Orazimbetova         Advanced
    (231950, 12183),  -- Dilmurod Qodirov            E15A201
    (231958, 12107),  -- Suxrob Komilov              Sh-Web005
    (231965, 12017),  -- Javohir Nazarov             R11A1-13
    (231999, 12191),  -- Fazliddin  Obidxonov        M33A1-02 (Abt)
    (232001, 12304),  -- Iymona  Nuraliyeva          Xr11A1-03
    (232001, 12290),  -- Iymona  Nuraliyeva          E30A1-09
    (232032, 12201),  -- Shoxrux Tilavoldiyev        M99A202
    (232043, 12018),  -- Muhammad  Zokirov           B-Poch002
    (232051, 12324),  -- Javlon Nurkiddinov          Math Kids
    (232063, 12018),  -- MuhammmadAmin Abdurazzokov  B-Poch002
    (232077, 12239),  -- Asel Aldakulova             R09A1
    (232077, 12320),  -- Asel Aldakulova             Kids
    (232119, 12324),  -- Shirin Nurkiddinova         Math Kids
    (232122, 12324),  -- Zinnura NigMatullayeva      Math Kids
    (232128, 12306),  -- Shodiyor Abdumurodov        R11A1-14
    (232128, 12263),  -- Shodiyor Abdumurodov        E45A201
    (232132, 12263),  -- Ayzada Ermuhammedova        E45A201
    (232135, 12263),  -- Islom Komiljonov            E45A201
    (232139, 12320),  -- Sarvar Otabekov             Kids
    (232141, 12239),  -- GoZal Toirova               R09A1
    (232141, 12320),  -- GoZal Toirova               Kids
    (232142, 12320),  -- Islombek Abduvaliyev        Kids
    (232143, 12239),  -- Samandarbek Bahodirov       R09A1
    (232143, 12320),  -- Samandarbek Bahodirov       Kids
    (232149, 12298),  -- Murodali Rohataliyev        Sh-Web002
    (232162, 12264),  -- Charos Sultonmurodova       Beginner new
    (232170, 12064),  -- Abdulloh Abduqahhorov       Sh-Web003
    (232186, 12104),  -- Amirbek Turgunov            Math02
    (232198, 12226),  -- Umidjon Abdumalikov         Dchj 12:00
    (232199, 12324),  -- Fariza Baxromova            Math Kids
    (232223, 12306),  -- Robiya  Nokanova            R11A1-14
    (232228, 12017),  -- Feruza Komildjonova         R11A1-13
    (232234, 12298),  -- Doniyor  Janqulov           Sh-Web002
    (232235, 11952),  -- Mubina Nuraliyeva           B44B101
    (232245, 12264),  -- Ismat Hikmatullayev         Beginner new
    (232255, 12017),  -- Roza Muhsimova              R11A1-13
    (232256, 12320),  -- Abdurahim Abdunosirov       Kids
    (232260, 12186),  -- Fayozbek  Alisherov         Ma32A1-01(mental)
    (232271, 12295),  -- Muslima Xusniddinova        E45-A103
    (232271, 12306),  -- Muslima Xusniddinova        R11A1-14
    (232282, 12017),  -- Shohdamir Baxtiyorov        R11A1-13
    (232284, 12017),  -- Farangiz Sharipova          R11A1-13
    (232287, 12272),  -- Miravfzal  Xalilov          E19A1-16
    (232299, 12017),  -- Shodiyona  Rishiboyeva      R11A1-13
    (232304, 12295),  -- Jasur Solmetov              E45-A103
    (232304, 12324),  -- Jasur Solmetov              Math Kids
    (232308, 12264),  -- Ziyoda Shomaxsudova         Beginner new
    (232309, 12264),  -- Madina Mirzayeva            Beginner new
    (232336, 12314),  -- Aqdidar Xasanova            Beginner
    (232349, 12263),  -- Nigina Omonova              E45A201
    (232350, 12263),  -- Xadicha Nurdillayeva        E45A201
    (232352, 12295),  -- Shirin Muxtarova            E45-A103
    (232353, 12295),  -- Nazim Djusumbekova          E45-A103
    (232373, 12239),  -- Sirim Miltiqbayev           R09A1
    (232375, 12324),  -- Mexroj Holikulov            Math Kids
    (232376, 12324),  -- Dilbar Holikulova           Math Kids
    (232394, 12275),  -- Dilrozbegim Usmonova        Cb22301
    (232396, 12252),  -- Nurdavlet Jorabekov         Bb22302
    (232396, 12275),  -- Nurdavlet Jorabekov         Cb22301
    (232397, 12268),  -- Javohir Gofurjonov          E31B109
    (232408, 12200),  -- Zafarbek Yoldashev          Tarix01
    (232415, 12272),  -- Aziz  Maxmudov              E19A1-16
    (232419, 12264),  -- Mushtariy Yergeshova        Beginner new
    (232421, 12060),  -- Muxlisa Nurmatova           Intermediate gazalkent
    (232422, 12314),  -- Oynisa Nurmatova            Beginner
    (232432, 12290),  -- Timur  Dilshodov            E30A1-09
    (232438, 12017),  -- Dinara Savlanova            R11A1-13
    (232447, 12282),  -- Orazbek  Lesov              Turon Rus Tili 01 Guruh 
    (232448, 12282),  -- Sindora Rozmatova           Turon Rus Tili 01 Guruh 
    (232449, 12282),  -- Shaxboz  Abduqayumov        Turon Rus Tili 01 Guruh 
    (232450, 12282),  -- Robiyabonu  Xasanova        Turon Rus Tili 01 Guruh 
    (232451, 12282),  -- Umar  Azatbekov             Turon Rus Tili 01 Guruh 
    (232452, 12282),  -- Dilnura Mirtursunova        Turon Rus Tili 01 Guruh 
    (232466, 11952),  -- Robiya Karimjonova          B44B101
    (232466, 12130),  -- Robiya Karimjonova          C44A106New
    (232469, 12318),  -- Asadulloh  Obidov           Turon Ingliz Tili-01
    (232473, 12186),  -- Ibrohim   Yusupov           Ma32A1-01(mental)
    (232473, 12304),  -- Ibrohim   Yusupov           Xr11A1-03
    (232475, 12318),  -- Baxtiyor  Shoxdiyorov       Turon Ingliz Tili-01
    (232476, 12318),  -- Mushtariy Akramova          Turon Ingliz Tili-01
    (232477, 12318),  -- Dilnura Mirtursunova        Turon Ingliz Tili-01
    (232478, 12318),  -- Shaxboz Abuqayumov          Turon Ingliz Tili-01
    (232479, 12318),  -- Abdulloh  Ergashev          Turon Ingliz Tili-01
    (232510, 12207),  -- Umar Uchkunov               Math01
    (232513, 12273),  -- Mahmud Almuxammedov         IELTS
    (232517, 12020),  -- Xolida Torayeva             Rus0002
    (232518, 12299),  -- Ruslan Normuradov           Eng
    (232530, 12262)   -- Komola MAxkamova            B-001
;

CREATE TEMP TABLE add_link (student_id bigint, group_id bigint) ON COMMIT DROP;
INSERT INTO add_link VALUES
    (231853, 12217),  -- Davlatbek Musulmonov        R-Math001
    (232556, 11883),  -- Shahzoda Jahongirova        E73B204new
    (227963, 11946),  -- Jayna Elesova               E73B102
    (230769, 11957),  -- Marjona  Ortiqboyeva        E80A102
    (231658, 11957),  -- Mohinur Toshmetova          E80A102
    (231745, 12297),  -- Rozimat Abdugafurov         Sh-Web001
    (230238, 12221),  -- Doston Mirboyev             E80A107
    (230666, 12118),  -- Shaxboz Abdulxayev          Kids
    (232365, 12118),  -- Amirbek Botirov             Kids
    (231951, 12193),  -- Sabina Rahmatullayeva       E80A108
    (231473, 12178),  -- Samira  Sobirova            Mt32A1-01 (POCHEMUCHKA)
    (232052, 12157)   -- Farzona Axmadjonova         M99A201
;

\echo ''
\echo '=== enrolments to remove, by reason ==='
SELECT CASE
         WHEN EXISTS (SELECT 1 FROM gennis_deleted_student_group d
                       WHERE d.student_id = l.student_id AND d.group_id = l.group_id)
           THEN 'dropped in old gennis (v2 already records the drop)'
         WHEN EXISTS (SELECT 1 FROM gennis_student_group o
                       WHERE o.student_id = l.student_id AND o.group_id <> l.group_id)
           THEN 'student stays enrolled in another group'
         ELSE 'student ends up in no group'
       END AS reason,
       count(*) AS rows
FROM drop_link l
JOIN gennis_student_group sg
  ON sg.student_id = l.student_id AND sg.group_id = l.group_id
GROUP BY 1 ORDER BY 2 DESC;

\echo ''
\echo '=== totals ==='
SELECT (SELECT count(*) FROM drop_link l JOIN gennis_student_group sg
          ON sg.student_id = l.student_id AND sg.group_id = l.group_id) AS will_remove,
       (SELECT count(*) FROM add_link)                                  AS will_add,
       (SELECT count(DISTINCT student_id) FROM drop_link)               AS students_touched;

\echo ''
\echo '=== groups losing the most ==='
SELECT g.name, count(*) AS removed
FROM drop_link l
JOIN gennis_group g ON g.id = l.group_id
GROUP BY 1 ORDER BY 2 DESC LIMIT 10;

\if :apply
    \echo ''
    \echo '>>> APPLYING <<<'

    DELETE FROM gennis_student_group sg
    USING drop_link l
    WHERE sg.student_id = l.student_id AND sg.group_id = l.group_id;

    INSERT INTO gennis_student_group (student_id, group_id)
    SELECT student_id, group_id FROM add_link
    ON CONFLICT DO NOTHING;

    \echo ''
    \echo '=== after: stale enrolments left (expect 0) ==='
    SELECT count(*) AS remaining
    FROM drop_link l JOIN gennis_student_group sg
      ON sg.student_id = l.student_id AND sg.group_id = l.group_id;

    \echo ''
    \echo '=== after: E73A201 roster (expect 0) ==='
    SELECT count(*) AS members FROM gennis_student_group sg
    JOIN gennis_group g ON g.id = sg.group_id WHERE g.gennis_id = 784;

    COMMIT;
\else
    \echo ''
    \echo '(dry run - nothing written. -v apply=1 to perform it)'
    ROLLBACK;
\endif
