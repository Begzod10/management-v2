"""
Copy groups, students, deleted students and leads from gennis → local management DB.

Run per location:
    python scripts/copy_gennis_groups_students.py --location-id 3   # Chirchiq
    python scripts/copy_gennis_groups_students.py --location-id 2   # Gazalkent
    python scripts/copy_gennis_groups_students.py --all
    python scripts/copy_gennis_groups_students.py --all --full      # TRUNCATE + full reload

Creates tables on first run (IF NOT EXISTS). Safe to re-run — upserts by gennis_id.

Reads GENNIS_DB_URL (source) and DATABASE_URL (destination) from the
environment — same convention as sync_wave2_tables.py. No credentials
belong in this file; point GENNIS_DB_URL at a staging DB (e.g. one
restored from a fresh dump) to import from something other than the
live remote gennis DB.
"""
import argparse
import os
import sys

import psycopg2
from psycopg2.extras import execute_values


def _psycopg2_dsn(url: str) -> str:
    """psycopg2 doesn't understand the +asyncpg driver suffix SQLAlchemy uses."""
    return url.replace("postgresql+asyncpg://", "postgresql://")


if not os.environ.get("GENNIS_DB_URL") or not os.environ.get("DATABASE_URL"):
    sys.exit(
        "GENNIS_DB_URL and DATABASE_URL must be set in the environment."
    )

GENNIS_DSN = _psycopg2_dsn(os.environ["GENNIS_DB_URL"])
MGMT_DSN   = _psycopg2_dsn(os.environ["DATABASE_URL"])


# ── DDL ───────────────────────────────────────────────────────────────────────

DDL = """
CREATE TABLE IF NOT EXISTS gennis_subject (
    id          BIGSERIAL PRIMARY KEY,
    gennis_id   INTEGER NOT NULL UNIQUE,
    name        VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS gennis_group (
    id                   BIGSERIAL PRIMARY KEY,
    gennis_id            INTEGER NOT NULL UNIQUE,
    name                 VARCHAR(255) NOT NULL,
    location_id          INTEGER,
    location_name        VARCHAR(100),
    subject_id           INTEGER REFERENCES gennis_subject(id),
    teacher_gennis_id    INTEGER,
    teacher_mgmt_id      BIGINT REFERENCES "user"(id),
    assistent_gennis_id  INTEGER,
    assistent_mgmt_id    BIGINT REFERENCES "user"(id),
    status               BOOLEAN DEFAULT true,
    deleted              BOOLEAN DEFAULT false,
    price                INTEGER,
    created_at           TIMESTAMP DEFAULT NOW(),
    updated_at           TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gennis_student (
    id           BIGSERIAL PRIMARY KEY,
    gennis_id    INTEGER NOT NULL UNIQUE,
    user_id      INTEGER,
    name         VARCHAR(255),
    surname      VARCHAR(255),
    father_name  VARCHAR(255),
    phone        VARCHAR(50),
    parent_phone VARCHAR(50),
    photo_url    VARCHAR(500),
    created_at   TIMESTAMP DEFAULT NOW(),
    updated_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gennis_student_group (
    student_id  BIGINT NOT NULL REFERENCES gennis_student(id),
    group_id    BIGINT NOT NULL REFERENCES gennis_group(id),
    PRIMARY KEY (student_id, group_id)
);

CREATE TABLE IF NOT EXISTS gennis_deleted_student_group (
    id              BIGSERIAL PRIMARY KEY,
    student_id      BIGINT NOT NULL REFERENCES gennis_student(id),
    group_id        BIGINT NOT NULL REFERENCES gennis_group(id),
    reason          TEXT,
    teacher_mgmt_id BIGINT REFERENCES "user"(id),
    UNIQUE (student_id, group_id)
);

CREATE TABLE IF NOT EXISTS gennis_lead (
    id            BIGSERIAL PRIMARY KEY,
    gennis_id     INTEGER NOT NULL UNIQUE,
    name          VARCHAR(255),
    phone         VARCHAR(50),
    location_id   INTEGER,
    location_name VARCHAR(100),
    comment       TEXT,
    deleted       BOOLEAN DEFAULT false,
    created_at    TIMESTAMP DEFAULT NOW(),
    updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gennis_teacher_subject (
    teacher_mgmt_id BIGINT NOT NULL REFERENCES "user"(id),
    subject_id      BIGINT NOT NULL REFERENCES gennis_subject(id),
    PRIMARY KEY (teacher_mgmt_id, subject_id)
);

CREATE TABLE IF NOT EXISTS gennis_student_subject (
    student_id BIGINT NOT NULL REFERENCES gennis_student(id),
    subject_id BIGINT NOT NULL REFERENCES gennis_subject(id),
    PRIMARY KEY (student_id, subject_id)
);
"""


def ensure_schema(conn):
    with conn.cursor() as cur:
        cur.execute(DDL)
    conn.commit()


# ── Helpers ───────────────────────────────────────────────────────────────────

def resolve_mgmt_id(mgmt_cur, gennis_user_id):
    if not gennis_user_id:
        return None
    mgmt_cur.execute(
        "SELECT management_user_id FROM gennis_user_link WHERE gennis_user_id=%s",
        (gennis_user_id,),
    )
    row = mgmt_cur.fetchone()
    return row[0] if row else None


def upsert_student(mgmt_cur, s_id, user_id, name, surname, father_name, photo,
                   personal_phone, parent_phone):
    mgmt_cur.execute("""
        INSERT INTO gennis_student (
            gennis_id, user_id, name, surname, father_name,
            phone, parent_phone, photo_url, updated_at
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,NOW())
        ON CONFLICT (gennis_id) DO UPDATE SET
            name=EXCLUDED.name,
            surname=EXCLUDED.surname,
            phone=EXCLUDED.phone,
            parent_phone=EXCLUDED.parent_phone,
            photo_url=EXCLUDED.photo_url,
            updated_at=NOW()
    """, (s_id, user_id, name, surname, father_name,
          personal_phone, parent_phone, photo))


def fetch_phones(gennis_cur, student_ids):
    if not student_ids:
        return {}, {}
    gennis_cur.execute("""
        SELECT p.user_id, p.phone, p.personal, p.parent
        FROM phonelist p
        JOIN students s ON s.user_id = p.user_id
        WHERE s.id = ANY(%s)
    """, (student_ids,))
    personal, parent = {}, {}
    for user_id, phone, is_personal, is_parent in gennis_cur.fetchall():
        if is_personal and user_id not in personal:
            personal[user_id] = phone
        if is_parent and user_id not in parent:
            parent[user_id] = phone
    return personal, parent


# ── Sync subjects ─────────────────────────────────────────────────────────────

def sync_subjects(gennis_cur, mgmt_cur):
    gennis_cur.execute("SELECT id, name FROM subjects WHERE disabled IS NOT TRUE")
    rows = gennis_cur.fetchall()
    execute_values(mgmt_cur, """
        INSERT INTO gennis_subject (gennis_id, name)
        VALUES %s
        ON CONFLICT (gennis_id) DO UPDATE SET name=EXCLUDED.name
    """, rows)
    print(f"  Subjects:         {len(rows)} upserted")


# ── Sync groups ───────────────────────────────────────────────────────────────

def sync_groups(gennis_cur, mgmt_cur, location_ids):
    loc_filter = "AND g.location_id = ANY(%s)" if location_ids else ""
    gennis_cur.execute(f"""
        SELECT g.id, g.name, g.location_id, l.name,
               g.subject_id,
               t.user_id AS teacher_user_id,
               a.user_id AS assistent_user_id,
               g.status, g.deleted, g.price
        FROM groups g
        LEFT JOIN locations l  ON l.id = g.location_id
        LEFT JOIN teachers t   ON t.id = g.teacher_id
        LEFT JOIN assistent a  ON a.id = g.assistent_id
        WHERE 1=1 {loc_filter}
    """, (location_ids,) if location_ids else ())

    upserted = 0
    for (gennis_id, name, loc_id, loc_name, subject_gennis_id,
         teacher_uid, assistent_uid, status, deleted, price) in gennis_cur.fetchall():

        subject_local_id = None
        if subject_gennis_id:
            mgmt_cur.execute("SELECT id FROM gennis_subject WHERE gennis_id=%s", (subject_gennis_id,))
            r = mgmt_cur.fetchone()
            subject_local_id = r[0] if r else None

        teacher_mgmt_id   = resolve_mgmt_id(mgmt_cur, teacher_uid)
        assistent_mgmt_id = resolve_mgmt_id(mgmt_cur, assistent_uid)

        mgmt_cur.execute("""
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
        """, (gennis_id, name, loc_id, loc_name, subject_local_id,
              teacher_uid, teacher_mgmt_id, assistent_uid, assistent_mgmt_id,
              status, deleted, price))
        upserted += 1

    print(f"  Groups:           {upserted} upserted")


# ── Sync active students ──────────────────────────────────────────────────────

def sync_students(gennis_cur, mgmt_cur, location_ids):
    loc_filter = "AND g.location_id = ANY(%s)" if location_ids else ""
    gennis_cur.execute(f"""
        SELECT DISTINCT s.id, s.user_id, u.name, u.surname, u.father_name, u.photo_profile
        FROM students s
        JOIN student_group sg ON sg.student_id = s.id
        JOIN groups g         ON g.id = sg.group_id
        JOIN users u          ON u.id = s.user_id
        WHERE 1=1 {loc_filter}
    """, (location_ids,) if location_ids else ())

    rows = gennis_cur.fetchall()
    student_ids = [r[0] for r in rows]
    personal, parent = fetch_phones(gennis_cur, student_ids)

    for (s_id, user_id, name, surname, father_name, photo) in rows:
        upsert_student(mgmt_cur, s_id, user_id, name, surname, father_name, photo,
                       personal.get(user_id), parent.get(user_id))

    print(f"  Active students:  {len(rows)} upserted")


# ── Sync active student-group links ──────────────────────────────────────────

def sync_student_groups(gennis_cur, mgmt_cur, location_ids):
    loc_filter = "AND g.location_id = ANY(%s)" if location_ids else ""
    gennis_cur.execute(f"""
        SELECT sg.student_id, sg.group_id
        FROM student_group sg
        JOIN groups g ON g.id = sg.group_id
        WHERE 1=1 {loc_filter}
    """, (location_ids,) if location_ids else ())

    inserted = 0
    for gennis_student_id, gennis_group_id in gennis_cur.fetchall():
        mgmt_cur.execute("SELECT id FROM gennis_student WHERE gennis_id=%s", (gennis_student_id,))
        sr = mgmt_cur.fetchone()
        mgmt_cur.execute("SELECT id FROM gennis_group WHERE gennis_id=%s", (gennis_group_id,))
        gr = mgmt_cur.fetchone()
        if not sr or not gr:
            continue
        mgmt_cur.execute("""
            INSERT INTO gennis_student_group (student_id, group_id)
            VALUES (%s, %s) ON CONFLICT DO NOTHING
        """, (sr[0], gr[0]))
        inserted += 1

    print(f"  Active links:     {inserted} upserted")


# ── Sync deleted students ─────────────────────────────────────────────────────

def sync_deleted_students(gennis_cur, mgmt_cur, location_ids):
    loc_filter = "AND g.location_id = ANY(%s)" if location_ids else ""
    gennis_cur.execute(f"""
        SELECT DISTINCT s.id, s.user_id, u.name, u.surname, u.father_name, u.photo_profile
        FROM deleted_students ds
        JOIN groups g   ON g.id = ds.group_id
        JOIN students s ON s.id = ds.student_id
        JOIN users u    ON u.id = s.user_id
        WHERE 1=1 {loc_filter}
    """, (location_ids,) if location_ids else ())

    rows = gennis_cur.fetchall()
    student_ids = [r[0] for r in rows]
    personal, parent = fetch_phones(gennis_cur, student_ids)

    for (s_id, user_id, name, surname, father_name, photo) in rows:
        upsert_student(mgmt_cur, s_id, user_id, name, surname, father_name, photo,
                       personal.get(user_id), parent.get(user_id))

    print(f"  Deleted students: {len(rows)} upserted")

    # Now upsert deletion records
    gennis_cur.execute(f"""
        SELECT ds.student_id, ds.group_id, ds.reason, t.user_id
        FROM deleted_students ds
        JOIN groups g   ON g.id = ds.group_id
        LEFT JOIN teachers t ON t.id = ds.teacher_id
        WHERE 1=1 {loc_filter}
    """, (location_ids,) if location_ids else ())

    link_count = 0
    for gennis_student_id, gennis_group_id, reason, teacher_uid in gennis_cur.fetchall():
        mgmt_cur.execute("SELECT id FROM gennis_student WHERE gennis_id=%s", (gennis_student_id,))
        sr = mgmt_cur.fetchone()
        mgmt_cur.execute("SELECT id FROM gennis_group WHERE gennis_id=%s", (gennis_group_id,))
        gr = mgmt_cur.fetchone()
        if not sr or not gr:
            continue
        teacher_mgmt_id = resolve_mgmt_id(mgmt_cur, teacher_uid)
        mgmt_cur.execute("""
            INSERT INTO gennis_deleted_student_group (student_id, group_id, reason, teacher_mgmt_id)
            VALUES (%s, %s, %s, %s) ON CONFLICT (student_id, group_id) DO NOTHING
        """, (sr[0], gr[0], reason, teacher_mgmt_id))
        link_count += 1

    print(f"  Deletion records: {link_count} upserted")


# ── Sync leads ────────────────────────────────────────────────────────────────

def sync_leads(gennis_cur, mgmt_cur, location_ids):
    loc_filter = "AND l2.id = ANY(%s)" if location_ids else ""
    gennis_cur.execute(f"""
        SELECT ld.id, ld.name, ld.phone, ld.location_id, l2.name, ld.comment, ld.deleted
        FROM lead ld
        LEFT JOIN locations l2 ON l2.id = ld.location_id
        WHERE 1=1 {loc_filter}
    """, (location_ids,) if location_ids else ())

    rows = gennis_cur.fetchall()
    for (gennis_id, name, phone, loc_id, loc_name, comment, deleted) in rows:
        mgmt_cur.execute("""
            INSERT INTO gennis_lead (
                gennis_id, name, phone, location_id, location_name, comment, deleted, updated_at
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,NOW())
            ON CONFLICT (gennis_id) DO UPDATE SET
                name=EXCLUDED.name, phone=EXCLUDED.phone,
                comment=EXCLUDED.comment, deleted=EXCLUDED.deleted,
                updated_at=NOW()
        """, (gennis_id, name, phone, loc_id, loc_name, comment, deleted or False))

    print(f"  Leads:            {len(rows)} upserted ({sum(1 for r in rows if not r[6])} active)")


# ── Sync teacher subjects ─────────────────────────────────────────────────────

def sync_teacher_subjects(gennis_cur, mgmt_cur):
    gennis_cur.execute("""
        SELECT t.user_id, ts.subject_id
        FROM teacher_subject ts
        JOIN teachers t ON t.id = ts.teacher_id
    """)
    inserted = 0
    for teacher_user_id, subject_gennis_id in gennis_cur.fetchall():
        teacher_mgmt_id = resolve_mgmt_id(mgmt_cur, teacher_user_id)
        if not teacher_mgmt_id:
            continue
        mgmt_cur.execute("SELECT id FROM gennis_subject WHERE gennis_id=%s", (subject_gennis_id,))
        sr = mgmt_cur.fetchone()
        if not sr:
            continue
        mgmt_cur.execute("""
            INSERT INTO gennis_teacher_subject (teacher_mgmt_id, subject_id)
            VALUES (%s, %s) ON CONFLICT DO NOTHING
        """, (teacher_mgmt_id, sr[0]))
        inserted += 1
    print(f"  Teacher-subject:  {inserted} upserted")


# ── Sync student subjects ─────────────────────────────────────────────────────

def sync_student_subjects(gennis_cur, mgmt_cur):
    gennis_cur.execute("SELECT student_id, subject_id FROM student_subject")
    inserted = 0
    for gennis_student_id, subject_gennis_id in gennis_cur.fetchall():
        mgmt_cur.execute("SELECT id FROM gennis_student WHERE gennis_id=%s", (gennis_student_id,))
        sr = mgmt_cur.fetchone()
        mgmt_cur.execute("SELECT id FROM gennis_subject WHERE gennis_id=%s", (subject_gennis_id,))
        subr = mgmt_cur.fetchone()
        if not sr or not subr:
            continue
        mgmt_cur.execute("""
            INSERT INTO gennis_student_subject (student_id, subject_id)
            VALUES (%s, %s) ON CONFLICT DO NOTHING
        """, (sr[0], subr[0]))
        inserted += 1
    print(f"  Student-subject:  {inserted} upserted")


# ── Main ──────────────────────────────────────────────────────────────────────

FULL_REPLACE_TABLES = [
    # Order matters: link/junction tables first (they don't have their own FKs
    # enforced here, but truncating parents after children avoids orphaned rows
    # lingering mid-run), then the entity tables.
    "gennis_student_group",
    "gennis_deleted_student_group",
    "gennis_teacher_subject",
    "gennis_student_subject",
    "gennis_lead",
    "gennis_student",
    "gennis_group",
    "gennis_subject",
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--location-id", type=int, help="Sync a single location by ID")
    parser.add_argument("--all", action="store_true", help="Sync all locations")
    parser.add_argument("--full", action="store_true",
                         help="TRUNCATE all target tables first (full replace, not incremental)")
    args = parser.parse_args()

    if not args.all and not args.location_id:
        parser.error("Specify --location-id N or --all")

    if args.full and not args.all:
        parser.error("--full requires --all (can't partially wipe a location-scoped table set)")

    location_ids = None if args.all else [args.location_id]

    gennis = psycopg2.connect(GENNIS_DSN)
    mgmt   = psycopg2.connect(MGMT_DSN)

    print("Creating tables if needed…")
    ensure_schema(mgmt)

    if args.full:
        print("--full: truncating target tables…")
        with mgmt.cursor() as mc:
            for table in FULL_REPLACE_TABLES:
                mc.execute(f"TRUNCATE TABLE {table} CASCADE")
        mgmt.commit()

    loc_label = f"location_id={location_ids}" if location_ids else "ALL locations"
    print(f"Syncing {loc_label}…")

    with gennis.cursor() as gc, mgmt.cursor() as mc:
        sync_subjects(gc, mc)
        sync_groups(gc, mc, location_ids)
        sync_students(gc, mc, location_ids)
        sync_student_groups(gc, mc, location_ids)
        sync_deleted_students(gc, mc, location_ids)
        sync_leads(gc, mc, location_ids)
        sync_teacher_subjects(gc, mc)
        sync_student_subjects(gc, mc)
        mgmt.commit()

    print("\nDone.")
    gennis.close()
    mgmt.close()


if __name__ == "__main__":
    main()
