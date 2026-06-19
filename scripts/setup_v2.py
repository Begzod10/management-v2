"""
Set up management-v2 database:
1. Create all tables from management models
2. Copy users from gennis → management-v2
3. Copy subjects, groups, students, leads from gennis → management-v2

Run:
    cd /home/rimefara/projects/gennis_management
    source venv/bin/activate
    python scripts/setup_v2.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from psycopg2.extras import execute_values
import psycopg2

GENNIS_URL = "postgresql+psycopg2://postgres:or9T%23u-x5PZo--@5.129.242.151:5432/gennis"
V2_URL     = "postgresql+psycopg2://postgres:123@localhost:5432/management-v2"

GENNIS_DSN = "host=5.129.242.151 dbname=gennis user=postgres password=or9T#u-x5PZo--"
V2_DSN     = "host=localhost dbname=management-v2 user=postgres password=123"

GENNIS_ROLE_MAP = {
    "main_admin": "super_admin",
    "admin":      "admin",
    "director":   "director",
    "teacher":    "teacher",
    "assistent":  "teacher",
    "programmer": "programmer",
    "smm":        "smm",
    "methodist":  "methodist",
    "zavxos":     "zavxos",
    "muxarir":    "muxarir",
    "accountant": "accountant",
}
DEFAULT_ROLE = "employee"
SKIP_NAMES   = {("Belgilanmagan", "Belgilanmagan"), ("test", "test")}
SKIP_IDS     = {10553}


# ── Step 1: create tables ─────────────────────────────────────────────────────

def create_tables():
    print("Step 1: Creating tables in management-v2…")
    from app.models import Base
    from app.external_models.gennis import GennisBase
    engine = create_engine(V2_URL)
    Base.metadata.create_all(engine)
    print("  Tables created.\n")


# ── Step 2: copy users ────────────────────────────────────────────────────────

def _mgmt_user_by_name(conn, name, surname):
    row = conn.execute(
        text('SELECT id FROM "user" WHERE LOWER(name)=LOWER(:n) AND LOWER(surname)=LOWER(:s) AND deleted=false LIMIT 1'),
        {"n": name, "s": surname},
    ).fetchone()
    return row[0] if row else None


def _username_exists(conn, username):
    return conn.execute(
        text('SELECT 1 FROM "user" WHERE username=:u LIMIT 1'), {"u": username}
    ).fetchone() is not None


def _link_exists(conn, gennis_id):
    return conn.execute(
        text("SELECT 1 FROM gennis_user_link WHERE gennis_user_id=:g LIMIT 1"), {"g": gennis_id}
    ).fetchone() is not None


def copy_users():
    print("Step 2: Copying users from gennis → management-v2…")
    gennis_eng = create_engine(GENNIS_URL, echo=False)
    v2_eng     = create_engine(V2_URL,     echo=False)

    with gennis_eng.connect() as g, v2_eng.connect() as m:
        rows = g.execute(text("""
            SELECT u.id, u.name, u.surname, u.username, u.password,
                   u.location_id, l.name AS location_name,
                   r.role AS role_code, r.type_role
            FROM users u
            JOIN roles r ON r.id = u.role_id
            LEFT JOIN locations l ON l.id = u.location_id
            WHERE (u.deleted IS NULL OR u.deleted = false)
              AND r.type_role NOT IN ('student', 'parent')
            ORDER BY u.id
        """)).fetchall()

        created = linked = skipped = 0

        for row in rows:
            g_id      = row.id
            name      = (row.name or "").strip()
            surname   = (row.surname or "").strip()
            username  = (row.username or "").strip()
            password  = row.password
            loc_id    = row.location_id
            loc_name  = row.location_name
            type_role = row.type_role
            mgmt_role = GENNIS_ROLE_MAP.get(type_role, DEFAULT_ROLE)

            if (name, surname) in SKIP_NAMES or g_id in SKIP_IDS:
                skipped += 1
                continue

            mgmt_id = _mgmt_user_by_name(m, name, surname)
            if mgmt_id:
                if not _link_exists(m, g_id):
                    m.execute(text(
                        "INSERT INTO gennis_user_link (management_user_id, gennis_user_id, location_id, location_name) "
                        "VALUES (:m, :g, :l, :ln)"
                    ), {"m": mgmt_id, "g": g_id, "l": loc_id, "ln": loc_name})
                    if mgmt_role != DEFAULT_ROLE:
                        m.execute(text(
                            "INSERT INTO user_role (user_id, role) VALUES (:u, :r) ON CONFLICT DO NOTHING"
                        ), {"u": mgmt_id, "r": mgmt_role})
                    linked += 1
                else:
                    skipped += 1
                continue

            if _link_exists(m, g_id):
                skipped += 1
                continue

            final_username = username
            if username and _username_exists(m, username):
                final_username = username + "_g"
                if _username_exists(m, final_username):
                    final_username = f"{username}_{g_id}"

            result = m.execute(text("""
                INSERT INTO "user" (
                    name, surname, username, hashed_password,
                    role, is_active, auth_provider, is_verified,
                    failed_login_attempts, timezone, deleted
                ) VALUES (
                    :name, :surname, :username, :hashed_password,
                    :role, true, 'gennis', true, 0, 'Asia/Tashkent', false
                ) RETURNING id
            """), {
                "name": name or "—", "surname": surname or "—",
                "username": final_username or None,
                "hashed_password": password, "role": mgmt_role,
            })
            new_id = result.fetchone()[0]
            m.execute(text(
                "INSERT INTO gennis_user_link (management_user_id, gennis_user_id, location_id, location_name) "
                "VALUES (:m, :g, :l, :ln)"
            ), {"m": new_id, "g": g_id, "l": loc_id, "ln": loc_name})
            if mgmt_role != DEFAULT_ROLE:
                m.execute(text(
                    "INSERT INTO user_role (user_id, role) VALUES (:u, :r) ON CONFLICT DO NOTHING"
                ), {"u": new_id, "r": mgmt_role})
            created += 1

        m.commit()
    print(f"  Created: {created}  Linked: {linked}  Skipped: {skipped}\n")


# ── Step 3: copy gennis education data ───────────────────────────────────────

def _resolve_mgmt_id(cur, gennis_user_id):
    if not gennis_user_id:
        return None
    cur.execute(
        "SELECT management_user_id FROM gennis_user_link WHERE gennis_user_id=%s",
        (gennis_user_id,),
    )
    row = cur.fetchone()
    return row[0] if row else None


def _fetch_phones(gc, student_ids):
    if not student_ids:
        return {}, {}
    gc.execute("""
        SELECT p.user_id, p.phone, p.personal, p.parent
        FROM phonelist p
        JOIN students s ON s.user_id = p.user_id
        WHERE s.id = ANY(%s)
    """, (student_ids,))
    personal, parent = {}, {}
    for user_id, phone, is_personal, is_parent in gc.fetchall():
        if is_personal and user_id not in personal:
            personal[user_id] = phone
        if is_parent and user_id not in parent:
            parent[user_id] = phone
    return personal, parent


def _upsert_student(mc, s_id, user_id, name, surname, father_name, photo, personal_phone, parent_phone):
    mc.execute("""
        INSERT INTO gennis_student (
            gennis_id, user_id, name, surname, father_name,
            phone, parent_phone, photo_url, updated_at
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,NOW())
        ON CONFLICT (gennis_id) DO UPDATE SET
            name=EXCLUDED.name, surname=EXCLUDED.surname,
            phone=EXCLUDED.phone, parent_phone=EXCLUDED.parent_phone,
            photo_url=EXCLUDED.photo_url, updated_at=NOW()
    """, (s_id, user_id, name, surname, father_name, personal_phone, parent_phone, photo))


def copy_education_data():
    print("Step 3: Copying subjects, groups, students, leads…")
    gennis = psycopg2.connect(GENNIS_DSN)
    v2     = psycopg2.connect(V2_DSN)

    with gennis.cursor() as gc, v2.cursor() as mc:

        # Subjects
        gc.execute("SELECT id, name FROM subjects WHERE disabled IS NOT TRUE")
        rows = gc.fetchall()
        execute_values(mc, """
            INSERT INTO gennis_subject (gennis_id, name) VALUES %s
            ON CONFLICT (gennis_id) DO UPDATE SET name=EXCLUDED.name
        """, rows)
        print(f"  Subjects:  {len(rows)}")

        # Groups
        gc.execute("""
            SELECT g.id, g.name, g.location_id, l.name,
                   g.subject_id, t.user_id, a.user_id, g.status, g.deleted, g.price
            FROM groups g
            LEFT JOIN locations l ON l.id = g.location_id
            LEFT JOIN teachers t  ON t.id = g.teacher_id
            LEFT JOIN assistent a ON a.id = g.assistent_id
        """)
        upserted = 0
        for (gid, name, loc_id, loc_name, subj_gid, t_uid, a_uid, status, deleted, price) in gc.fetchall():
            mc.execute("SELECT id FROM gennis_subject WHERE gennis_id=%s", (subj_gid,))
            r = mc.fetchone()
            subj_local = r[0] if r else None
            t_mgmt = _resolve_mgmt_id(mc, t_uid)
            a_mgmt = _resolve_mgmt_id(mc, a_uid)
            mc.execute("""
                INSERT INTO gennis_group (
                    gennis_id, name, location_id, location_name,
                    subject_id, teacher_gennis_id, teacher_mgmt_id,
                    assistent_gennis_id, assistent_mgmt_id,
                    status, deleted, price, updated_at
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
                ON CONFLICT (gennis_id) DO UPDATE SET
                    name=EXCLUDED.name, status=EXCLUDED.status,
                    deleted=EXCLUDED.deleted, price=EXCLUDED.price,
                    teacher_mgmt_id=EXCLUDED.teacher_mgmt_id,
                    assistent_mgmt_id=EXCLUDED.assistent_mgmt_id,
                    updated_at=NOW()
            """, (gid, name, loc_id, loc_name, subj_local, t_uid, t_mgmt, a_uid, a_mgmt, status, deleted, price))
            upserted += 1
        print(f"  Groups:    {upserted}")

        # Active students
        gc.execute("""
            SELECT DISTINCT s.id, s.user_id, u.name, u.surname, u.father_name, u.photo_profile
            FROM students s
            JOIN student_group sg ON sg.student_id = s.id
            JOIN users u ON u.id = s.user_id
        """)
        rows = gc.fetchall()
        student_ids = [r[0] for r in rows]
        personal, parent = _fetch_phones(gc, student_ids)
        for (s_id, user_id, name, surname, father_name, photo) in rows:
            _upsert_student(mc, s_id, user_id, name, surname, father_name, photo,
                            personal.get(user_id), parent.get(user_id))
        print(f"  Students:  {len(rows)}")

        # Student-group links
        gc.execute("SELECT sg.student_id, sg.group_id FROM student_group sg")
        count = 0
        for g_sid, g_gid in gc.fetchall():
            mc.execute("SELECT id FROM gennis_student WHERE gennis_id=%s", (g_sid,))
            sr = mc.fetchone()
            mc.execute("SELECT id FROM gennis_group WHERE gennis_id=%s", (g_gid,))
            gr = mc.fetchone()
            if sr and gr:
                mc.execute("""
                    INSERT INTO gennis_student_group (student_id, group_id)
                    VALUES (%s,%s) ON CONFLICT DO NOTHING
                """, (sr[0], gr[0]))
                count += 1
        print(f"  Stu-group: {count}")

        # Deleted students
        gc.execute("""
            SELECT DISTINCT s.id, s.user_id, u.name, u.surname, u.father_name, u.photo_profile
            FROM deleted_students ds
            JOIN students s ON s.id = ds.student_id
            JOIN users u ON u.id = s.user_id
        """)
        rows = gc.fetchall()
        del_ids = [r[0] for r in rows]
        p2, par2 = _fetch_phones(gc, del_ids)
        for (s_id, user_id, name, surname, father_name, photo) in rows:
            _upsert_student(mc, s_id, user_id, name, surname, father_name, photo,
                            p2.get(user_id), par2.get(user_id))
        gc.execute("""
            SELECT ds.student_id, ds.group_id, ds.reason, t.user_id
            FROM deleted_students ds
            LEFT JOIN teachers t ON t.id = ds.teacher_id
        """)
        dlc = 0
        for g_sid, g_gid, reason, t_uid in gc.fetchall():
            mc.execute("SELECT id FROM gennis_student WHERE gennis_id=%s", (g_sid,))
            sr = mc.fetchone()
            mc.execute("SELECT id FROM gennis_group WHERE gennis_id=%s", (g_gid,))
            gr = mc.fetchone()
            if sr and gr:
                t_mgmt = _resolve_mgmt_id(mc, t_uid)
                mc.execute("""
                    INSERT INTO gennis_deleted_student_group (student_id, group_id, reason, teacher_mgmt_id)
                    VALUES (%s,%s,%s,%s) ON CONFLICT (student_id, group_id) DO NOTHING
                """, (sr[0], gr[0], reason, t_mgmt))
                dlc += 1
        print(f"  Del-stud:  {len(rows)} students, {dlc} deletion records")

        # Leads
        gc.execute("""
            SELECT ld.id, ld.name, ld.phone, ld.location_id, l.name, ld.comment, ld.deleted
            FROM lead ld
            LEFT JOIN locations l ON l.id = ld.location_id
        """)
        leads = gc.fetchall()
        for (lid, name, phone, loc_id, loc_name, comment, deleted) in leads:
            mc.execute("""
                INSERT INTO gennis_lead (
                    gennis_id, name, phone, location_id, location_name, comment, deleted, updated_at
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,NOW())
                ON CONFLICT (gennis_id) DO UPDATE SET
                    name=EXCLUDED.name, phone=EXCLUDED.phone,
                    comment=EXCLUDED.comment, deleted=EXCLUDED.deleted, updated_at=NOW()
            """, (lid, name, phone, loc_id, loc_name, comment, deleted or False))
        print(f"  Leads:     {len(leads)}")

        # Teacher-subject links
        gc.execute("""
            SELECT t.user_id, ts.subject_id
            FROM teacher_subject ts
            JOIN teachers t ON t.id = ts.teacher_id
        """)
        tc = 0
        for teacher_uid, subj_gid in gc.fetchall():
            t_mgmt = _resolve_mgmt_id(mc, teacher_uid)
            if not t_mgmt:
                continue
            mc.execute("SELECT id FROM gennis_subject WHERE gennis_id=%s", (subj_gid,))
            sr = mc.fetchone()
            if not sr:
                continue
            mc.execute("""
                INSERT INTO gennis_teacher_subject (teacher_mgmt_id, subject_id)
                VALUES (%s,%s) ON CONFLICT DO NOTHING
            """, (t_mgmt, sr[0]))
            tc += 1
        print(f"  Teacher-subj: {tc}")

        # Student-subject links
        gc.execute("SELECT student_id, subject_id FROM student_subject")
        sc = 0
        for g_sid, subj_gid in gc.fetchall():
            mc.execute("SELECT id FROM gennis_student WHERE gennis_id=%s", (g_sid,))
            sr = mc.fetchone()
            mc.execute("SELECT id FROM gennis_subject WHERE gennis_id=%s", (subj_gid,))
            subr = mc.fetchone()
            if sr and subr:
                mc.execute("""
                    INSERT INTO gennis_student_subject (student_id, subject_id)
                    VALUES (%s,%s) ON CONFLICT DO NOTHING
                """, (sr[0], subr[0]))
                sc += 1
        print(f"  Student-subj: {sc}")

        v2.commit()

    print()
    gennis.close()
    v2.close()


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    create_tables()
    copy_users()
    copy_education_data()
    print("All done.")
