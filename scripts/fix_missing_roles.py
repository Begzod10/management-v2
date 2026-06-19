"""
Add missing roles to management users whose gennis type_roles were lost during migration.

The original migration mapped teacher/assistent/programmer/etc → 'employee'.
This script preserves the actual gennis type_role as an extra role in user_role table.

Role mapping:
  teacher    → teacher
  assistent  → teacher    (assistant teachers)
  programmer → programmer
  smm        → smm
  methodist  → methodist
  zavxos     → zavxos
  muxarir    → muxarir
  accountant → accountant
  user       → (skip — already employee)
  admin      → (skip — already in primary role)
  director   → (skip — already in primary role)
  main_admin → (skip — already in primary role)
"""
import os
import psycopg2

GENNIS_DSN = "host=5.129.242.151 dbname=gennis user=postgres password=or9T#u-x5PZo--"
MGMT_DSN = "host=localhost dbname=gennis_management user=postgres password=22100122"

ROLE_MAP = {
    "teacher":    "teacher",
    "assistent":  "teacher",
    "programmer": "programmer",
    "smm":        "smm",
    "methodist":  "methodist",
    "zavxos":     "zavxos",
    "muxarir":    "muxarir",
    "accountant": "accountant",
}

def main():
    gennis = psycopg2.connect(GENNIS_DSN)
    mgmt   = psycopg2.connect(MGMT_DSN)

    with gennis.cursor() as gc, mgmt.cursor() as mc:
        # Fetch gennis users with roles we want to preserve
        gc.execute("""
            SELECT u.id, r.type_role
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE r.type_role NOT IN ('student','parent','admin','director','main_admin','user')
        """)
        rows = gc.fetchall()
        print(f"Gennis users with special roles: {len(rows)}")

        added = 0
        skipped = 0

        for gennis_user_id, type_role in rows:
            target_role = ROLE_MAP.get(type_role)
            if not target_role:
                skipped += 1
                continue

            # Find management user via gennis_user_link
            mc.execute("""
                SELECT management_user_id FROM gennis_user_link
                WHERE gennis_user_id = %s
            """, (gennis_user_id,))
            row = mc.fetchone()
            if not row:
                skipped += 1
                continue

            mgmt_user_id = row[0]

            # Insert role if not already present
            mc.execute("""
                INSERT INTO user_role (user_id, role)
                VALUES (%s, %s)
                ON CONFLICT (user_id, role) DO NOTHING
            """, (mgmt_user_id, target_role))

            if mc.rowcount:
                added += 1

        mgmt.commit()

    # Show summary
    with mgmt.cursor() as mc:
        mc.execute("""
            SELECT role, COUNT(*) FROM user_role
            GROUP BY role ORDER BY COUNT(*) DESC
        """)
        print("\nuser_role distribution after fix:")
        for role, count in mc.fetchall():
            print(f"  {role}: {count}")

    print(f"\nDone — {added} roles added, {skipped} skipped (no link or unmapped)")

    gennis.close()
    mgmt.close()

if __name__ == "__main__":
    main()
