"""
Migrate gennis staff users → local management DB.

Source : remote gennis DB   (5.129.242.151:5432/gennis)
Target : local management DB (localhost:5432/gennis_management)

Run with:
    cd /home/rimefara/projects/gennis_management
    source venv/bin/activate
    python scripts/migrate_gennis_users.py

What it does:
- Reads all non-student, non-parent, non-deleted gennis users
- Skips placeholder accounts (Belgilanmagan, test)
- Skips the duplicate ranoqosimova (ID 10553, keeps 9199)
- For people already in management: creates GennisUserLink only
- For multi-branch people (same name): merges into one management user
- Stores Werkzeug password hash in hashed_password (login already handles it)
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text

# ── Connection strings ────────────────────────────────────────────────────────

GENNIS_URL = "postgresql+psycopg2://postgres:or9T%23u-x5PZo--@5.129.242.151:5432/gennis"
MGMT_URL   = "postgresql+psycopg2://postgres:22100122@localhost:5432/gennis_management"

# ── Role mapping: gennis type_role → management role string ───────────────────

GENNIS_ROLE_MAP = {
    "main_admin": "super_admin",
    "admin":      "admin",
    "director":   "director",
    "teacher":    "teacher",
    "assistent":  "teacher",    # teaching assistant
    "programmer": "programmer",
    "smm":        "smm",
    "methodist":  "methodist",
    "zavxos":     "zavxos",
    "muxarir":    "muxarir",
    "accountant": "accountant",
    # user/unknown → employee
}
DEFAULT_ROLE = "employee"

# ── Accounts to skip entirely ─────────────────────────────────────────────────

SKIP_NAMES = {("Belgilanmagan", "Belgilanmagan"), ("test", "test")}
SKIP_IDS   = {10553}  # duplicate ranoqosimova — keep 9199



def get_management_user_id_by_name(mgmt_conn, name: str, surname: str):
    row = mgmt_conn.execute(
        text('SELECT id FROM "user" WHERE LOWER(name)=LOWER(:n) AND LOWER(surname)=LOWER(:s) AND deleted=false LIMIT 1'),
        {"n": name, "s": surname},
    ).fetchone()
    return row[0] if row else None


def username_exists_in_mgmt(mgmt_conn, username: str) -> bool:
    row = mgmt_conn.execute(
        text('SELECT 1 FROM "user" WHERE username=:u LIMIT 1'),
        {"u": username},
    ).fetchone()
    return row is not None


def gennis_link_exists(mgmt_conn, gennis_id: int) -> bool:
    row = mgmt_conn.execute(
        text("SELECT 1 FROM gennis_user_link WHERE gennis_user_id=:g LIMIT 1"),
        {"g": gennis_id},
    ).fetchone()
    return row is not None


def insert_link(mgmt_conn, management_user_id: int, gennis_user_id: int, location_id, location_name):
    if gennis_link_exists(mgmt_conn, gennis_user_id):
        return False
    mgmt_conn.execute(
        text(
            "INSERT INTO gennis_user_link (management_user_id, gennis_user_id, location_id, location_name) "
            "VALUES (:m, :g, :l, :ln)"
        ),
        {"m": management_user_id, "g": gennis_user_id, "l": location_id, "ln": location_name},
    )
    return True


def main():
    gennis_engine = create_engine(GENNIS_URL, echo=False)
    mgmt_engine   = create_engine(MGMT_URL,   echo=False)

    # Ensure gennis_user_link table exists (it's in models but may not be migrated yet locally)
    with mgmt_engine.connect() as mgmt_conn:
        mgmt_conn.execute(text("""
            CREATE TABLE IF NOT EXISTS gennis_user_link (
                id                 BIGSERIAL PRIMARY KEY,
                management_user_id BIGINT NOT NULL REFERENCES "user"(id),
                gennis_user_id     INTEGER NOT NULL UNIQUE,
                location_id        INTEGER,
                location_name      VARCHAR(255),
                created_at         TIMESTAMP DEFAULT NOW()
            )
        """))
        mgmt_conn.execute(text("""
            ALTER TABLE "user" ADD COLUMN IF NOT EXISTS username VARCHAR(100) UNIQUE
        """))
        mgmt_conn.commit()

    with gennis_engine.connect() as g, mgmt_engine.connect() as m:
        # Student and parent role IDs to exclude
        exclude_type_roles = {"student", "parent"}

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

        created = 0
        linked  = 0
        skipped = 0

        for row in rows:
            g_id        = row.id
            name        = (row.name or "").strip()
            surname     = (row.surname or "").strip()
            username    = (row.username or "").strip()
            password    = row.password
            location_id = row.location_id
            loc_name    = row.location_name
            type_role   = row.type_role
            mgmt_role   = GENNIS_ROLE_MAP.get(type_role, DEFAULT_ROLE)

            # Skip placeholder and test accounts
            if (name, surname) in SKIP_NAMES:
                skipped += 1
                continue

            # Skip blacklisted IDs
            if g_id in SKIP_IDS:
                skipped += 1
                continue

            # Check if this person already exists in management by name (case-insensitive)
            mgmt_id = get_management_user_id_by_name(m, name, surname)
            if mgmt_id:
                if insert_link(m, mgmt_id, g_id, location_id, loc_name):
                    # Preserve extra role for this linked branch
                    if mgmt_role != DEFAULT_ROLE:
                        m.execute(
                            text("INSERT INTO user_role (user_id, role) VALUES (:u, :r) ON CONFLICT DO NOTHING"),
                            {"u": mgmt_id, "r": mgmt_role},
                        )
                    linked += 1
                    print(f"  LINK  gennis#{g_id} ({name} {surname}) → mgmt#{mgmt_id} [name match]")
                else:
                    skipped += 1
                continue

            # Skip if gennis link already exists (re-run safety)
            if gennis_link_exists(m, g_id):
                skipped += 1
                continue

            # Resolve username conflicts — append _2 if taken
            final_username = username
            if username and username_exists_in_mgmt(m, username):
                final_username = username + "_g"
                if username_exists_in_mgmt(m, final_username):
                    final_username = f"{username}_{g_id}"

            # Create new management user
            result = m.execute(
                text("""
                    INSERT INTO "user" (
                        name, surname, username, hashed_password,
                        role, is_active, auth_provider, is_verified,
                        failed_login_attempts, timezone, deleted
                    ) VALUES (
                        :name, :surname, :username, :hashed_password,
                        :role, true, 'gennis', true,
                        0, 'Asia/Tashkent', false
                    ) RETURNING id
                """),
                {
                    "name":            name or "—",
                    "surname":         surname or "—",
                    "username":        final_username or None,
                    "hashed_password": password,
                    "role":            mgmt_role,
                },
            )
            new_id = result.fetchone()[0]

            insert_link(m, new_id, g_id, location_id, loc_name)

            # If role differs from primary (e.g. teacher alongside employee), record it
            if mgmt_role != DEFAULT_ROLE:
                m.execute(
                    text("INSERT INTO user_role (user_id, role) VALUES (:u, :r) ON CONFLICT DO NOTHING"),
                    {"u": new_id, "r": mgmt_role},
                )

            created += 1
            print(f"  CREATE mgmt#{new_id}  gennis#{g_id}  {username:<20} {name} {surname}  [{type_role}]")

        m.commit()

    print(f"\nDone. Created: {created}  Linked: {linked}  Skipped: {skipped}")


if __name__ == "__main__":
    main()
