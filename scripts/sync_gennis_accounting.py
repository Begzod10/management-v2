"""
Sync accounting transactions from old Gennis → management-v2 DB (incremental).

Tables synced:
  gennis_student_payment         ← studentpayments
  gennis_teacher_salary_payment  ← teachersalaries
  gennis_assistent_salary_payment← assistent_salaries
  gennis_staff_salary_payment    ← staffsalaries
  gennis_overhead                ← overhead
  gennis_capital_expenditure     ← capital_expenditure
  gennis_teacher_salary.total_salary   ← teachersalary   (drift fix, last 2 months)
  gennis_assistent_salary.total_salary ← asistent_salary (drift fix, last 2 months)

Run:
  python scripts/sync_gennis_accounting.py             # since last synced date
  python scripts/sync_gennis_accounting.py --since 2026-01-01
  python scripts/sync_gennis_accounting.py --all       # since 2026-01-01
"""
import argparse
import os
import psycopg2
from psycopg2.extras import execute_values
from datetime import date, timedelta
from dotenv import load_dotenv

load_dotenv()

GENNIS_DSN = os.environ["GENNIS_SYNC_DSN"]   # e.g. host=... dbname=gennis user=postgres password=...
MGMT_DSN   = os.environ["MGMT_SYNC_DSN"]     # e.g. host=localhost dbname=management-v2 user=postgres password=...

DEFAULT_SINCE = date(2026, 1, 1)


# ── helpers ───────────────────────────────────────────────────────────────────

def get_last_date(mgmt_cur, table, date_col="paid_date"):
    mgmt_cur.execute(f"SELECT MAX({date_col}) FROM {table}")
    row = mgmt_cur.fetchone()
    if row and row[0]:
        # Cap at today-7 so future-dated records don't push the watermark past today
        watermark = row[0] - timedelta(days=3)
        cap = date.today() - timedelta(days=7)
        return min(watermark, cap)
    return DEFAULT_SINCE


def attendance_id_maps(mc):
    """gennis_id -> local PK maps for translating attendancehistorystudent rows.

    gennis_attendance_history_student.student_id and .group_id hold THIS DB's
    ids (gennis_student.id / gennis_group.id), not the gennis-old ones. The two
    spaces are disjoint, so copying the source ids straight across silently
    writes rows that point at nothing — or worse, at a different group that
    happens to share the number.

    817 rows already carry an untranslated group_id from earlier runs. Because
    attendance/mark.py writes the correct local id, the same (student, group,
    month) ends up stored twice under two conventions, and the debt is counted
    twice: 143 duplicate sets in August 2026 alone, 4,855,142 so'm of 2026 debt.
    """
    mc.execute("SELECT gennis_id, id FROM gennis_student WHERE gennis_id IS NOT NULL")
    students = dict(mc.fetchall())
    mc.execute("SELECT gennis_id, id FROM gennis_group WHERE gennis_id IS NOT NULL")
    groups = dict(mc.fetchall())
    return students, groups


def remap_attendance_rows(rows, students, groups):
    """Translate (id, student_id, …, group_id, …) tuples onto local ids.

    Rows whose student cannot be resolved are dropped rather than inserted with a
    dangling key — the caller reports the count. An unresolvable group is left
    NULL, which the table already allows (1,554 such rows exist), because the
    month's charge still belongs to the student even if the group is unknown.
    """
    out, unmapped = [], 0
    for r in rows:
        r = list(r)
        student_id = students.get(r[1])
        if student_id is None:
            unmapped += 1
            continue
        r[1] = student_id
        r[3] = groups.get(r[3])
        out.append(tuple(r))
    return out, unmapped


def reset_sequence(mgmt_cur, table, seq_name):
    mgmt_cur.execute(
        "SELECT EXISTS(SELECT 1 FROM pg_sequences WHERE sequencename = %s)", (seq_name,)
    )
    if mgmt_cur.fetchone()[0]:
        mgmt_cur.execute(f"SELECT setval('{seq_name}', (SELECT MAX(id) FROM {table}))")


# ── student payments ──────────────────────────────────────────────────────────

def sync_student_payments(gc, mc, since):
    gc.execute("""
        SELECT
            sp.id,
            sp.student_id,
            u.name || ' ' || u.surname AS student_name,
            sp.location_id,
            sp.payment_sum,
            LOWER(pt.name)             AS channel,
            sp.payment                 AS is_real_payment,
            cd.date::date              AS paid_date,
            EXTRACT(MONTH FROM cm.date)::int AS calendar_month,
            EXTRACT(YEAR  FROM cy.date)::int AS calendar_year
        FROM studentpayments sp
        JOIN calendarday cd  ON cd.id  = sp.calendar_day
        JOIN calendarmonth cm ON cm.id = sp.calendar_month
        JOIN calendaryear cy  ON cy.id = sp.calendar_year
        JOIN paymenttypes pt  ON pt.id = sp.payment_type_id
        LEFT JOIN students s  ON s.id  = sp.student_id
        LEFT JOIN users u     ON u.id  = s.user_id
        WHERE cd.date::date >= %s
        ORDER BY sp.id
    """, (since,))

    rows = gc.fetchall()
    if not rows:
        print("  Student payments:     0 records")
        return

    execute_values(mc, """
        INSERT INTO gennis_student_payment
            (id, student_id, student_name, location_id, payment_sum,
             channel, is_real_payment, paid_date, calendar_month, calendar_year, deleted)
        VALUES %s
        ON CONFLICT (id) DO UPDATE SET
            student_id      = EXCLUDED.student_id,
            location_id     = EXCLUDED.location_id,
            student_name    = EXCLUDED.student_name,
            payment_sum     = EXCLUDED.payment_sum,
            channel         = EXCLUDED.channel,
            is_real_payment = EXCLUDED.is_real_payment,
            paid_date       = EXCLUDED.paid_date,
            calendar_month  = EXCLUDED.calendar_month,
            calendar_year   = EXCLUDED.calendar_year,
            synced_at       = NOW()
    """, [(
        r[0], r[1], r[2], r[3], r[4],
        r[5], r[6], r[7], r[8], r[9], False
    ) for r in rows])

    reset_sequence(mc, "gennis_student_payment", "gennis_student_payment_id_seq")
    print(f"  Student payments:     {len(rows)} upserted (since {since})")


def sync_deleted_student_payments(gc, mc):
    """Mark records as deleted=true in management-v2 when hard-deleted from gennis-old.

    Only checks IDs in the gennis-old sequence range (not native management-v2 records).
    """
    gc.execute("SELECT MAX(id) FROM studentpayments")
    max_gennis_id = gc.fetchone()[0] or 0

    gc.execute("SELECT id FROM studentpayments")
    gennis_ids = {r[0] for r in gc.fetchall()}

    mc.execute(
        "SELECT id FROM gennis_student_payment WHERE id <= %s AND deleted = false",
        (max_gennis_id,)
    )
    mgmt_ids = {r[0] for r in mc.fetchall()}

    deleted_ids = list(mgmt_ids - gennis_ids)
    if not deleted_ids:
        print("  Payment deletions:    0 marked")
        return

    mc.execute(
        "UPDATE gennis_student_payment SET deleted = true, synced_at = NOW() WHERE id = ANY(%s)",
        (deleted_ids,)
    )
    print(f"  Payment deletions:    {len(deleted_ids)} marked deleted")


# ── teacher salary payments ───────────────────────────────────────────────────

def sync_teacher_salary(gc, mc, since):
    gc.execute("""
        SELECT
            ts.id,
            ts.teacher_id,
            u.name || ' ' || u.surname AS teacher_name,
            ts.location_id,
            ts.payment_sum,
            LOWER(pt.name) AS channel,
            cd.date::date  AS paid_date,
            EXTRACT(MONTH FROM cm.date)::int AS calendar_month,
            EXTRACT(YEAR  FROM cy.date)::int AS calendar_year
        FROM teachersalaries ts
        JOIN calendarday   cd  ON cd.id  = ts.calendar_day
        JOIN calendarmonth cm  ON cm.id  = ts.calendar_month
        JOIN calendaryear  cy  ON cy.id  = ts.calendar_year
        JOIN paymenttypes  pt  ON pt.id  = ts.payment_type_id
        LEFT JOIN teachers t   ON t.id   = ts.teacher_id
        LEFT JOIN users    u   ON u.id   = t.user_id
        WHERE cd.date::date >= %s
        ORDER BY ts.id
    """, (since,))

    rows = gc.fetchall()
    if not rows:
        print("  Teacher salary:       0 records")
        return

    execute_values(mc, """
        INSERT INTO gennis_teacher_salary_payment
            (id, teacher_id, teacher_name, location_id, payment_sum,
             channel, paid_date, calendar_month, calendar_year, reason, deleted)
        VALUES %s
        ON CONFLICT (id) DO UPDATE SET
            teacher_id     = EXCLUDED.teacher_id,
            location_id    = EXCLUDED.location_id,
            teacher_name   = EXCLUDED.teacher_name,
            payment_sum    = EXCLUDED.payment_sum,
            channel        = EXCLUDED.channel,
            paid_date      = EXCLUDED.paid_date,
            calendar_month = EXCLUDED.calendar_month,
            calendar_year  = EXCLUDED.calendar_year,
            synced_at      = NOW()
    """, [(
        r[0], r[1], r[2], r[3], r[4],
        r[5], r[6], r[7], r[8], None, False
    ) for r in rows])

    reset_sequence(mc, "gennis_teacher_salary_payment", "gennis_teacher_salary_payment_id_seq")
    print(f"  Teacher salary:       {len(rows)} upserted (since {since})")


# ── assistent salary payments ─────────────────────────────────────────────────

def sync_assistent_salary(gc, mc, since):
    gc.execute("""
        SELECT
            a2.id,
            a2.assistent_id,
            u.name || ' ' || u.surname AS assistent_name,
            a2.location_id,
            a2.payment_sum,
            LOWER(pt.name) AS channel,
            cd.date::date  AS paid_date,
            EXTRACT(MONTH FROM cm.date)::int AS calendar_month,
            EXTRACT(YEAR  FROM cy.date)::int AS calendar_year
        FROM assistent_salaries a2
        JOIN calendarday   cd  ON cd.id  = a2.calendar_day
        JOIN calendarmonth cm  ON cm.id  = a2.calendar_month
        JOIN calendaryear  cy  ON cy.id  = a2.calendar_year
        JOIN paymenttypes  pt  ON pt.id  = a2.payment_type_id
        LEFT JOIN assistent a  ON a.id   = a2.assistent_id
        LEFT JOIN users    u   ON u.id   = a.user_id
        WHERE cd.date::date >= %s
        ORDER BY a2.id
    """, (since,))

    rows = gc.fetchall()
    if not rows:
        print("  Assistent salary:     0 records")
        return

    execute_values(mc, """
        INSERT INTO gennis_assistent_salary_payment
            (id, assistent_id, assistent_name, location_id, payment_sum,
             channel, paid_date, calendar_month, calendar_year, reason, deleted)
        VALUES %s
        ON CONFLICT (id) DO UPDATE SET
            assistent_id   = EXCLUDED.assistent_id,
            location_id    = EXCLUDED.location_id,
            assistent_name = EXCLUDED.assistent_name,
            payment_sum    = EXCLUDED.payment_sum,
            channel        = EXCLUDED.channel,
            paid_date      = EXCLUDED.paid_date,
            calendar_month = EXCLUDED.calendar_month,
            calendar_year  = EXCLUDED.calendar_year,
            synced_at      = NOW()
    """, [(
        r[0], r[1], r[2], r[3], r[4],
        r[5], r[6], r[7], r[8], None, False
    ) for r in rows])

    reset_sequence(mc, "gennis_assistent_salary_payment", "gennis_assistent_salary_payment_id_seq")
    print(f"  Assistent salary:     {len(rows)} upserted (since {since})")


# ── staff salary payments ─────────────────────────────────────────────────────

def sync_staff_salary(gc, mc, since):
    gc.execute("""
        SELECT
            ss.id,
            ss.staff_id,
            u.name || ' ' || u.surname AS staff_name,
            p.name AS job,
            ss.location_id,
            ss.payment_sum,
            LOWER(pt.name) AS channel,
            cd.date::date  AS paid_date,
            EXTRACT(MONTH FROM cm.date)::int AS calendar_month,
            EXTRACT(YEAR  FROM cy.date)::int AS calendar_year
        FROM staffsalaries ss
        JOIN calendarday   cd  ON cd.id  = ss.calendar_day
        JOIN calendarmonth cm  ON cm.id  = ss.calendar_month
        JOIN calendaryear  cy  ON cy.id  = ss.calendar_year
        JOIN paymenttypes  pt  ON pt.id  = ss.payment_type_id
        LEFT JOIN staff    st  ON st.id  = ss.staff_id
        LEFT JOIN users    u   ON u.id   = st.user_id
        LEFT JOIN professions p ON p.id  = st.profession_id
        WHERE cd.date::date >= %s
        ORDER BY ss.id
    """, (since,))

    rows = gc.fetchall()
    if not rows:
        print("  Staff salary:         0 records")
        return

    execute_values(mc, """
        INSERT INTO gennis_staff_salary_payment
            (id, staff_id, staff_name, job, location_id, payment_sum,
             channel, paid_date, calendar_month, calendar_year, reason, deleted)
        VALUES %s
        ON CONFLICT (id) DO UPDATE SET
            staff_id       = EXCLUDED.staff_id,
            location_id    = EXCLUDED.location_id,
            staff_name     = EXCLUDED.staff_name,
            job            = EXCLUDED.job,
            payment_sum    = EXCLUDED.payment_sum,
            channel        = EXCLUDED.channel,
            paid_date      = EXCLUDED.paid_date,
            calendar_month = EXCLUDED.calendar_month,
            calendar_year  = EXCLUDED.calendar_year,
            synced_at      = NOW()
    """, [(
        r[0], r[1], r[2], r[3], r[4],
        r[5], r[6], r[7], r[8], r[9], None, False
    ) for r in rows])

    reset_sequence(mc, "gennis_staff_salary_payment", "gennis_staff_salary_payment_id_seq")
    print(f"  Staff salary:         {len(rows)} upserted (since {since})")


def sync_deleted_staff_payments(gc, mc):
    """Mark staff salary payments deleted=true in management-v2 when hard-deleted from gennis-old."""
    gc.execute("SELECT MAX(id) FROM staffsalaries")
    max_gennis_id = gc.fetchone()[0] or 0

    gc.execute("SELECT id FROM staffsalaries")
    gennis_ids = {r[0] for r in gc.fetchall()}

    mc.execute(
        "SELECT id FROM gennis_staff_salary_payment WHERE id <= %s AND deleted = false",
        (max_gennis_id,)
    )
    mgmt_ids = {r[0] for r in mc.fetchall()}

    deleted_ids = list(mgmt_ids - gennis_ids)
    if not deleted_ids:
        print("  Staff deletions:      0 marked")
        return

    mc.execute(
        "UPDATE gennis_staff_salary_payment SET deleted = true, synced_at = NOW() WHERE id = ANY(%s)",
        (deleted_ids,)
    )
    print(f"  Staff deletions:      {len(deleted_ids)} marked deleted")


# ── overhead ──────────────────────────────────────────────────────────────────

def _overhead_query(gc, since=None):
    where = "WHERE cd.date::date >= %s" if since else ""
    params = (since,) if since else ()
    gc.execute(f"""
        SELECT
            o.id,
            COALESCE(o.item_name, ot.name, 'Xarajat') AS item_name,
            o.item_sum,
            LOWER(pt.name) AS channel,
            o.location_id,
            cd.date::date  AS date,
            EXTRACT(MONTH FROM cm.date)::int AS calendar_month,
            EXTRACT(YEAR  FROM cy.date)::int AS calendar_year
        FROM overhead o
        JOIN calendarday   cd  ON cd.id  = o.calendar_day
        JOIN calendarmonth cm  ON cm.id  = o.calendar_month
        JOIN calendaryear  cy  ON cy.id  = o.calendar_year
        JOIN paymenttypes  pt  ON pt.id  = o.payment_type_id
        LEFT JOIN overheadtype ot ON ot.id = o.overhead_type_id
        {where}
        ORDER BY o.id
    """, params)
    return gc.fetchall()


def sync_overhead(gc, mc, since):
    rows = _overhead_query(gc, since)
    if not rows:
        print("  Overhead:             0 records")
        return
    execute_values(mc, """
        INSERT INTO gennis_overhead
            (gennis_id, item_name, item_sum, channel,
             location_id, date, calendar_month, calendar_year, deleted)
        VALUES %s
        ON CONFLICT (gennis_id) WHERE gennis_id IS NOT NULL DO UPDATE SET
            item_name      = EXCLUDED.item_name,
            item_sum       = EXCLUDED.item_sum,
            channel        = EXCLUDED.channel,
            deleted        = false
    """, [(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], False) for r in rows])
    print(f"  Overhead:             {len(rows)} upserted (since {since})")


def seed_overhead(gc, mc):
    """Full re-seed of all overhead from gennis-old using gennis_id for dedup."""
    rows = _overhead_query(gc)
    if not rows:
        print("  Overhead seed:        0 records")
        return
    execute_values(mc, """
        INSERT INTO gennis_overhead
            (gennis_id, item_name, item_sum, channel,
             location_id, date, calendar_month, calendar_year, deleted)
        VALUES %s
        ON CONFLICT (gennis_id) WHERE gennis_id IS NOT NULL DO UPDATE SET
            item_name      = EXCLUDED.item_name,
            item_sum       = EXCLUDED.item_sum,
            channel        = EXCLUDED.channel,
            deleted        = false
    """, [(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], False) for r in rows],
    page_size=2000)
    print(f"  Overhead seed:        {len(rows)} upserted")


def sync_deleted_overhead(gc, mc):
    """Mark overhead records deleted in gennis-old as deleted in mgmt-v2."""
    gc.execute("SELECT id FROM overhead")
    gennis_ids = {r[0] for r in gc.fetchall()}
    mc.execute("SELECT gennis_id FROM gennis_overhead WHERE gennis_id IS NOT NULL AND deleted = false")
    mgmt_ids = {r[0] for r in mc.fetchall()}
    deleted_ids = list(mgmt_ids - gennis_ids)
    if not deleted_ids:
        print("  Overhead deletions:   0 marked")
        return
    mc.execute(
        "UPDATE gennis_overhead SET deleted = true WHERE gennis_id = ANY(%s)",
        (deleted_ids,)
    )
    print(f"  Overhead deletions:   {len(deleted_ids)} marked deleted")


# ── capital expenditure ───────────────────────────────────────────────────────

def _capital_query(gc, since=None):
    where = "WHERE cd.date::date >= %s" if since else ""
    params = (since,) if since else ()
    gc.execute(f"""
        SELECT
            ce.id,
            COALESCE(ce.item_name, 'Kapital') AS item_name,
            ce.item_sum,
            LOWER(pt.name) AS channel,
            ce.location_id,
            cd.date::date  AS date,
            EXTRACT(MONTH FROM cm.date)::int AS calendar_month,
            EXTRACT(YEAR  FROM cy.date)::int AS calendar_year
        FROM capital_expenditure ce
        JOIN calendarday   cd  ON cd.id  = ce.calendar_day
        JOIN calendarmonth cm  ON cm.id  = ce.calendar_month
        JOIN calendaryear  cy  ON cy.id  = ce.calendar_year
        JOIN paymenttypes  pt  ON pt.id  = ce.payment_type_id
        {where}
        ORDER BY ce.id
    """, params)
    return gc.fetchall()


def sync_capital(gc, mc, since):
    rows = _capital_query(gc, since)
    if not rows:
        print("  Capital expenditure:  0 records")
        return
    execute_values(mc, """
        INSERT INTO gennis_capital_expenditure
            (gennis_id, item_name, item_sum, channel,
             location_id, date, calendar_month, calendar_year, deleted)
        VALUES %s
        ON CONFLICT (gennis_id) WHERE gennis_id IS NOT NULL DO UPDATE SET
            item_name = EXCLUDED.item_name,
            item_sum  = EXCLUDED.item_sum,
            channel   = EXCLUDED.channel,
            deleted   = false
    """, [(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], False) for r in rows])
    print(f"  Capital expenditure:  {len(rows)} upserted (since {since})")


def seed_capital(gc, mc):
    """Full re-seed of all capital_expenditure from gennis-old."""
    rows = _capital_query(gc)
    if not rows:
        print("  Capital seed:         0 records")
        return
    execute_values(mc, """
        INSERT INTO gennis_capital_expenditure
            (gennis_id, item_name, item_sum, channel,
             location_id, date, calendar_month, calendar_year, deleted)
        VALUES %s
        ON CONFLICT (gennis_id) WHERE gennis_id IS NOT NULL DO UPDATE SET
            item_name = EXCLUDED.item_name,
            item_sum  = EXCLUDED.item_sum,
            channel   = EXCLUDED.channel,
            deleted   = false
    """, [(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], False) for r in rows],
    page_size=2000)
    print(f"  Capital seed:         {len(rows)} upserted")


def sync_deleted_capital(gc, mc):
    """Mark capital records deleted in gennis-old as deleted in mgmt-v2."""
    gc.execute("SELECT id FROM capital_expenditure")
    gennis_ids = {r[0] for r in gc.fetchall()}
    mc.execute("SELECT gennis_id FROM gennis_capital_expenditure WHERE gennis_id IS NOT NULL AND deleted = false")
    mgmt_ids = {r[0] for r in mc.fetchall()}
    deleted_ids = list(mgmt_ids - gennis_ids)
    if not deleted_ids:
        print("  Capital deletions:    0 marked")
        return
    mc.execute(
        "UPDATE gennis_capital_expenditure SET deleted = true WHERE gennis_id = ANY(%s)",
        (deleted_ids,)
    )
    print(f"  Capital deletions:    {len(deleted_ids)} marked deleted")


# ── salary total drift fix ────────────────────────────────────────────────────

def sync_total_salary(gc, mc):
    """Sync total_salary from old gennis monthly salary tables → management DB.

    Old gennis recomputes total_salary nightly from AttendanceDays; the management
    DB copy drifts if old gennis updates it after the last sync.  This function
    covers the current month and the previous month so mid-month changes stay
    current regardless of when the sync runs.

    old gennis:  teachersalary.teacher_id     → mgmt: gennis_teacher_salary.teacher_id
    old gennis:  asistent_salary.assisten_id  → mgmt: gennis_assistent_salary.assistent_id
    """
    gc.execute("""
        SELECT
            ts.teacher_id,
            ts.location_id,
            EXTRACT(MONTH FROM cm.date)::int AS calendar_month,
            EXTRACT(YEAR  FROM cy.date)::int AS calendar_year,
            COALESCE(ts.total_salary, 0)     AS total_salary,
            COALESCE(ts.taken_money, 0)      AS taken_money,
            COALESCE(ts.remaining_salary, 0) AS remaining_salary,
            COALESCE(ts.debt, 0)             AS debt,
            COALESCE(ts.extra, 0)            AS extra,
            COALESCE(ts.total_fine, 0)       AS total_fine
        FROM teachersalary ts
        JOIN calendarmonth cm ON cm.id = ts.calendar_month
        JOIN calendaryear  cy ON cy.id = ts.calendar_year
        WHERE cm.date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
    """)
    teacher_rows = gc.fetchall()
    if teacher_rows:
        execute_values(mc, """
            UPDATE gennis_teacher_salary AS t
            SET total_salary     = d.total_salary,
                taken_money      = d.taken_money,
                remaining_salary = d.remaining_salary,
                debt             = d.debt,
                fine             = d.total_fine,
                synced_at        = NOW()
            FROM (VALUES %s) AS d(teacher_id, location_id, calendar_month, calendar_year,
                                   total_salary, taken_money, remaining_salary, debt, extra, total_fine)
            WHERE t.teacher_id     = d.teacher_id
              AND t.location_id    = d.location_id
              AND t.calendar_month = d.calendar_month
              AND t.calendar_year  = d.calendar_year
        """, teacher_rows)
    print(f"  Teacher total_salary: {len(teacher_rows)} rows synced")

    gc.execute("""
        SELECT
            a.assisten_id,
            a.location_id,
            EXTRACT(MONTH FROM cm.date)::int AS calendar_month,
            EXTRACT(YEAR  FROM cy.date)::int AS calendar_year,
            COALESCE(a.total_salary, 0)      AS total_salary,
            COALESCE(a.taken_money, 0)       AS taken_money,
            COALESCE(a.remaining_salary, 0)  AS remaining_salary,
            COALESCE(a.debt, 0)              AS debt,
            COALESCE(a.total_fine, 0)        AS total_fine
        FROM asistent_salary a
        JOIN calendarmonth cm ON cm.id = a.calendar_month
        JOIN calendaryear  cy ON cy.id = a.calendar_year
        WHERE cm.date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
    """)
    assistent_rows = gc.fetchall()
    if assistent_rows:
        execute_values(mc, """
            UPDATE gennis_assistent_salary AS t
            SET total_salary     = d.total_salary,
                taken_money      = d.taken_money,
                remaining_salary = d.remaining_salary,
                debt             = d.debt,
                fine             = d.total_fine,
                synced_at        = NOW()
            FROM (VALUES %s) AS d(assistent_id, location_id, calendar_month, calendar_year,
                                   total_salary, taken_money, remaining_salary, debt, total_fine)
            WHERE t.assistent_id   = d.assistent_id
              AND t.location_id    = d.location_id
              AND t.calendar_month = d.calendar_month
              AND t.calendar_year  = d.calendar_year
        """, assistent_rows)
    print(f"  Assistent total_salary: {len(assistent_rows)} rows synced")


# ── full salary seed (initial load) ───────────────────────────────────────────

def seed_teacher_salaries(gc, mc):
    """Full UPSERT of all teachersalary records → gennis_teacher_salary.

    Includes aggregated black_salary per salary record.
    Safe to re-run — uses ON CONFLICT (id) DO UPDATE.
    """
    gc.execute("""
        SELECT
            ts.id,
            ts.teacher_id,
            COALESCE(u.name || ' ' || u.surname, '') AS teacher_name,
            ts.location_id,
            COALESCE(ts.total_salary, 0)     AS total_salary,
            COALESCE(ts.taken_money, 0)      AS taken_money,
            COALESCE(bs.black_salary, 0)     AS black_salary,
            COALESCE(ts.debt, 0)             AS debt,
            COALESCE(ts.total_fine, 0)       AS fine,
            COALESCE(ts.remaining_salary, 0) AS remaining_salary,
            COALESCE(ts.status, false)       AS is_deleted,
            EXTRACT(MONTH FROM cm.date)::int AS calendar_month,
            EXTRACT(YEAR  FROM cy.date)::int AS calendar_year
        FROM teachersalary ts
        JOIN calendarmonth cm ON cm.id = ts.calendar_month
        JOIN calendaryear  cy ON cy.id = ts.calendar_year
        LEFT JOIN teachers t  ON t.id  = ts.teacher_id
        LEFT JOIN users u     ON u.id  = t.user_id
        LEFT JOIN (
            SELECT salary_id, SUM(total_salary) AS black_salary
            FROM teacher_black_salary
            GROUP BY salary_id
        ) bs ON bs.salary_id = ts.id
        ORDER BY ts.id
    """)
    rows = gc.fetchall()
    if not rows:
        print("  Teacher salary seed:  0 records")
        return
    execute_values(mc, """
        INSERT INTO gennis_teacher_salary
            (id, teacher_id, teacher_name, location_id,
             total_salary, taken_money, black_salary, debt, fine,
             remaining_salary, is_deleted, calendar_month, calendar_year)
        VALUES %s
        ON CONFLICT (id) DO UPDATE SET
            teacher_name     = EXCLUDED.teacher_name,
            total_salary     = EXCLUDED.total_salary,
            taken_money      = EXCLUDED.taken_money,
            black_salary     = EXCLUDED.black_salary,
            debt             = EXCLUDED.debt,
            fine             = EXCLUDED.fine,
            remaining_salary = EXCLUDED.remaining_salary,
            is_deleted       = EXCLUDED.is_deleted,
            synced_at        = NOW()
    """, rows)
    reset_sequence(mc, "gennis_teacher_salary", "gennis_teacher_salary_id_seq")
    print(f"  Teacher salary seed:  {len(rows)} upserted")


def seed_assistent_salaries(gc, mc):
    """Full UPSERT of all asistent_salary records → gennis_assistent_salary."""
    gc.execute("""
        SELECT
            a.id,
            a.assisten_id,
            COALESCE(u.name || ' ' || u.surname, '') AS assistent_name,
            a.location_id,
            COALESCE(a.total_salary, 0)     AS total_salary,
            COALESCE(a.taken_money, 0)      AS taken_money,
            COALESCE(abs.black_salary, 0)   AS black_salary,
            COALESCE(a.debt, 0)             AS debt,
            COALESCE(a.total_fine, 0)       AS fine,
            COALESCE(a.remaining_salary, 0) AS remaining_salary,
            COALESCE(a.status, false)       AS is_deleted,
            EXTRACT(MONTH FROM cm.date)::int AS calendar_month,
            EXTRACT(YEAR  FROM cy.date)::int AS calendar_year
        FROM asistent_salary a
        JOIN calendarmonth cm ON cm.id = a.calendar_month
        JOIN calendaryear  cy ON cy.id = a.calendar_year
        LEFT JOIN assistent ast ON ast.id = a.assisten_id
        LEFT JOIN users u       ON u.id   = ast.user_id
        LEFT JOIN (
            SELECT salary_id, SUM(total_salary) AS black_salary
            FROM asistent_black_salary
            GROUP BY salary_id
        ) abs ON abs.salary_id = a.id
        ORDER BY a.id
    """)
    rows = gc.fetchall()
    if not rows:
        print("  Assistent salary seed: 0 records")
        return
    execute_values(mc, """
        INSERT INTO gennis_assistent_salary
            (id, assistent_id, assistent_name, location_id,
             total_salary, taken_money, black_salary, debt, fine,
             remaining_salary, is_deleted, calendar_month, calendar_year)
        VALUES %s
        ON CONFLICT (id) DO UPDATE SET
            assistent_name   = EXCLUDED.assistent_name,
            total_salary     = EXCLUDED.total_salary,
            taken_money      = EXCLUDED.taken_money,
            black_salary     = EXCLUDED.black_salary,
            debt             = EXCLUDED.debt,
            fine             = EXCLUDED.fine,
            remaining_salary = EXCLUDED.remaining_salary,
            is_deleted       = EXCLUDED.is_deleted,
            synced_at        = NOW()
    """, rows)
    reset_sequence(mc, "gennis_assistent_salary", "gennis_assistent_salary_id_seq")
    print(f"  Assistent salary seed: {len(rows)} upserted")


# ── staff salary totals seed ──────────────────────────────────────────────────

def seed_staff_salaries(gc, mc):
    """Full UPSERT of staffsalary → gennis_staff_salary (monthly totals)."""
    gc.execute("""
        SELECT
            ss.id,
            ss.staff_id,
            COALESCE(u.name || ' ' || u.surname, '') AS staff_name,
            ss.location_id,
            COALESCE(ss.total_salary, 0),
            COALESCE(ss.taken_money, 0),
            COALESCE(ss.remaining_salary, 0),
            COALESCE(ss.status, false),
            EXTRACT(MONTH FROM cm.date)::int,
            EXTRACT(YEAR  FROM cy.date)::int
        FROM staffsalary ss
        JOIN calendarmonth cm ON cm.id = ss.calendar_month
        JOIN calendaryear  cy ON cy.id = ss.calendar_year
        LEFT JOIN staff s ON s.id = ss.staff_id
        LEFT JOIN users u ON u.id = s.user_id
        ORDER BY ss.id
    """)
    rows = gc.fetchall()
    if not rows:
        print("  Staff salary seed:    0 records")
        return
    execute_values(mc, """
        INSERT INTO gennis_staff_salary
            (id, staff_id, staff_name, location_id,
             total_salary, taken_money, remaining_salary,
             is_deleted, calendar_month, calendar_year)
        VALUES %s
        ON CONFLICT (id) DO UPDATE SET
            staff_name       = EXCLUDED.staff_name,
            total_salary     = EXCLUDED.total_salary,
            taken_money      = EXCLUDED.taken_money,
            remaining_salary = EXCLUDED.remaining_salary,
            is_deleted       = EXCLUDED.is_deleted,
            synced_at        = NOW()
    """, rows, page_size=2000)
    reset_sequence(mc, "gennis_staff_salary", "gennis_staff_salary_id_seq")
    print(f"  Staff salary seed:    {len(rows)} upserted")


# ── teacher black salary entries seed ─────────────────────────────────────────

def seed_teacher_black_salaries(gc, mc):
    """Full UPSERT of teacher_black_salary → gennis_teacher_black_salary_entry."""
    gc.execute("""
        SELECT
            id,
            salary_id,
            student_id,
            COALESCE(total_salary, 0),
            COALESCE(status, false),
            payment_id
        FROM teacher_black_salary
        ORDER BY id
    """)
    rows = gc.fetchall()
    if not rows:
        print("  Black salary seed:    0 records")
        return
    execute_values(mc, """
        INSERT INTO gennis_teacher_black_salary_entry
            (id, teacher_salary_id, student_id, amount, status, student_payment_id)
        VALUES %s
        ON CONFLICT (id) DO UPDATE SET
            teacher_salary_id  = EXCLUDED.teacher_salary_id,
            student_id         = EXCLUDED.student_id,
            amount             = EXCLUDED.amount,
            status             = EXCLUDED.status,
            student_payment_id = EXCLUDED.student_payment_id
    """, rows, page_size=2000)
    reset_sequence(mc, "gennis_teacher_black_salary_entry", "gennis_teacher_black_salary_entry_id_seq")
    print(f"  Black salary seed:    {len(rows)} upserted")


# ── fine report seed ───────────────────────────────────────────────────────────

def seed_fine_reports(gc, mc):
    """Full UPSERT of finereport → gennis_fine_report."""
    gc.execute("""
        SELECT
            fr.id,
            fr.teacher_salary_id,
            fr.assistent_salary_id,
            EXTRACT(MONTH FROM cm.date)::int,
            EXTRACT(YEAR  FROM cy.date)::int,
            COALESCE(fr.amount, 0),
            COALESCE(fr.reason, '')
        FROM finereport fr
        JOIN calendarmonth cm ON cm.id = fr.calendar_month
        JOIN calendaryear  cy ON cy.id = fr.calendar_year
        ORDER BY fr.id
    """)
    rows = gc.fetchall()
    if not rows:
        print("  Fine report seed:     0 records")
        return
    execute_values(mc, """
        INSERT INTO gennis_fine_report
            (id, teacher_salary_id, assistent_salary_id,
             calendar_month, calendar_year, amount, reason)
        VALUES %s
        ON CONFLICT (id) DO UPDATE SET
            teacher_salary_id   = EXCLUDED.teacher_salary_id,
            assistent_salary_id = EXCLUDED.assistent_salary_id,
            calendar_month      = EXCLUDED.calendar_month,
            calendar_year       = EXCLUDED.calendar_year,
            amount              = EXCLUDED.amount,
            reason              = EXCLUDED.reason
    """, rows, page_size=2000)
    reset_sequence(mc, "gennis_fine_report", "gennis_fine_report_id_seq")
    print(f"  Fine report seed:     {len(rows)} upserted")


# ── teacher attendance history seed ───────────────────────────────────────────

def seed_attendance_history_teacher(gc, mc):
    """Full UPSERT of attendancehistoryteacher → gennis_attendance_history_teacher."""
    gc.execute("""
        SELECT
            aht.id,
            aht.teacher_id,
            COALESCE(u.name || ' ' || u.surname, '') AS teacher_name,
            COALESCE(aht.total_salary, 0),
            aht.subject_id,
            aht.group_id,
            COALESCE(aht.taken_money, 0),
            COALESCE(aht.remaining_salary, 0),
            aht.location_id,
            EXTRACT(MONTH FROM cm.date)::int,
            EXTRACT(YEAR  FROM cy.date)::int,
            COALESCE(aht.status, false)
        FROM attendancehistoryteacher aht
        JOIN calendarmonth cm ON cm.id = aht.calendar_month
        JOIN calendaryear  cy ON cy.id = aht.calendar_year
        LEFT JOIN teachers t ON t.id   = aht.teacher_id
        LEFT JOIN users u    ON u.id   = t.user_id
        ORDER BY aht.id
    """)
    rows = gc.fetchall()
    if not rows:
        print("  Teacher attendance history seed: 0 records")
        return
    execute_values(mc, """
        INSERT INTO gennis_attendance_history_teacher
            (id, teacher_id, teacher_name, total_salary,
             subject_id, group_id, taken_money, remaining_salary,
             location_id, calendar_month, calendar_year, status)
        VALUES %s
        ON CONFLICT (id) DO UPDATE SET
            teacher_name     = EXCLUDED.teacher_name,
            total_salary     = EXCLUDED.total_salary,
            taken_money      = EXCLUDED.taken_money,
            remaining_salary = EXCLUDED.remaining_salary,
            status           = EXCLUDED.status,
            synced_at        = NOW()
    """, rows, page_size=2000)
    reset_sequence(mc, "gennis_attendance_history_teacher", "gennis_attendance_history_teacher_id_seq")
    print(f"  Teacher attendance history seed: {len(rows)} upserted")


# ── student charities ─────────────────────────────────────────────────────────

def sync_charities(gc, mc):
    """Full UPSERT of all studentcharity → gennis_student_charity.

    Safe to re-run — uses ON CONFLICT (id) DO UPDATE.
    """
    gc.execute("""
        SELECT
            sc.id,
            sc.student_id,
            sc.group_id,
            sc.location_id,
            COALESCE(sc.discount, 0)                 AS discount,
            EXTRACT(MONTH FROM cm.date)::int         AS calendar_month,
            EXTRACT(YEAR  FROM cy.date)::int         AS calendar_year
        FROM studentcharity sc
        JOIN calendarmonth cm ON cm.id = sc.calendar_month
        JOIN calendaryear  cy ON cy.id = sc.calendar_year
        ORDER BY sc.id
    """)
    rows = gc.fetchall()
    if not rows:
        print("  Charities:            0 records")
        return
    execute_values(mc, """
        INSERT INTO gennis_student_charity
            (id, student_id, group_id, location_id, discount,
             calendar_month, calendar_year, deleted)
        VALUES %s
        ON CONFLICT (id) DO UPDATE SET
            discount       = EXCLUDED.discount,
            calendar_month = EXCLUDED.calendar_month,
            calendar_year  = EXCLUDED.calendar_year,
            group_id       = EXCLUDED.group_id
    """, [(r[0], r[1], r[2], r[3], r[4], r[5], r[6], False) for r in rows])
    reset_sequence(mc, "gennis_student_charity", "gennis_student_charity_id_seq")
    print(f"  Charities:            {len(rows)} upserted")


def sync_deleted_charities(gc, mc):
    """Mark charity records deleted in gennis-old as deleted in mgmt-v2."""
    gc.execute("SELECT MAX(id) FROM studentcharity")
    max_gennis_id = gc.fetchone()[0] or 0
    gc.execute("SELECT id FROM studentcharity")
    gennis_ids = {r[0] for r in gc.fetchall()}
    mc.execute(
        "SELECT id FROM gennis_student_charity WHERE id <= %s AND deleted = false",
        (max_gennis_id,)
    )
    mgmt_ids = {r[0] for r in mc.fetchall()}
    deleted_ids = list(mgmt_ids - gennis_ids)
    if not deleted_ids:
        print("  Charity deletions:    0 marked")
        return
    mc.execute(
        "UPDATE gennis_student_charity SET deleted = true WHERE id = ANY(%s)",
        (deleted_ids,)
    )
    print(f"  Charity deletions:    {len(deleted_ids)} marked deleted")


# ── attendance history drift fix ───────────────────────────────────────────────

def sync_attendance_history_drift(gc, mc, months=3):
    """Upsert attendance_history for the last N months from gennis-old.

    Attendance records are recalculated monthly in gennis-old when attendance is
    marked, so this keeps management-v2 in sync with recent changes.

    This used to be an UPDATE keyed on `t.id = d.id`, which could only ever
    correct rows that were ALREADY here — a row created in gennis-old (a new
    month starting, or a student joining a group mid-month) matched nothing and
    was silently dropped. New rows only arrived when somebody remembered to run
    `--seed-attendance`, a full-table upsert nobody runs routinely.

    Now an INSERT … ON CONFLICT (id) DO UPDATE over the same recent window, so
    new rows arrive on the regular run and existing ones still get corrected.

    No missing-row gap had actually accumulated when this was changed — every
    gennis-old id in the 3-month window was already present — so this is
    defence against a hole in the logic rather than a fix for observed damage.
    Do not use it to justify backfills: see
    scripts/repairs/undo_duplicate_august_rows.sql for what happened when a
    "missing rows" measurement was trusted without checking that
    gennis_attendance_history_student.group_id holds two different id spaces.
    """
    gc.execute("""
        SELECT
            ahs.id,
            ahs.student_id,
            COALESCE(u.name || ' ' || u.surname, '') AS student_name,
            ahs.group_id,
            COALESCE(g.name, '')                     AS group_name,
            ahs.subject_id,
            COALESCE(ahs.total_debt, 0)              AS total_debt,
            COALESCE(ahs.payment, 0)                 AS payment,
            COALESCE(ahs.remaining_debt, 0)          AS remaining_debt,
            COALESCE(ahs.total_discount, 0)          AS total_discount,
            ahs.location_id,
            EXTRACT(MONTH FROM cm.date)::int         AS calendar_month,
            EXTRACT(YEAR  FROM cy.date)::int         AS calendar_year,
            COALESCE(ahs.status, false)              AS status
        FROM attendancehistorystudent ahs
        JOIN calendarmonth cm ON cm.id = ahs.calendar_month
        JOIN calendaryear  cy ON cy.id = ahs.calendar_year
        LEFT JOIN students s  ON s.id  = ahs.student_id
        LEFT JOIN users u     ON u.id  = s.user_id
        LEFT JOIN groups g    ON g.id  = ahs.group_id
        WHERE DATE_TRUNC('month', cm.date::date) >=
              DATE_TRUNC('month', CURRENT_DATE) - (%s || ' months')::interval
        ORDER BY ahs.id
    """, (months,))
    rows = gc.fetchall()
    if not rows:
        print(f"  Attendance drift fix: 0 rows")
        return
    students, groups = attendance_id_maps(mc)
    rows, unmapped = remap_attendance_rows(rows, students, groups)
    if unmapped:
        print(f"  Attendance drift fix: {unmapped} row(s) skipped — student not in this DB")
    if not rows:
        return
    execute_values(mc, """
        INSERT INTO gennis_attendance_history_student
            (id, student_id, student_name, group_id, group_name, subject_id,
             total_debt, payment, remaining_debt, total_discount,
             location_id, calendar_month, calendar_year, status)
        VALUES %s
        ON CONFLICT (id) DO UPDATE SET
            student_name   = EXCLUDED.student_name,
            group_name     = EXCLUDED.group_name,
            total_debt     = EXCLUDED.total_debt,
            payment        = EXCLUDED.payment,
            remaining_debt = EXCLUDED.remaining_debt,
            total_discount = EXCLUDED.total_discount,
            status         = EXCLUDED.status,
            synced_at      = NOW()
    """, rows, page_size=2000)
    # ids come from gennis-old, so the local sequence has to be pushed past them
    # or the next locally-created row (attendance/mark.py) collides on the PK.
    reset_sequence(mc, "gennis_attendance_history_student",
                   "gennis_attendance_history_student_id_seq")
    print(f"  Attendance drift fix: {len(rows)} rows upserted (last {months} months)")


# ── main ──────────────────────────────────────────────────────────────────────

def seed_attendance_history(gc, mc):
    """Full UPSERT of all attendancehistorystudent → gennis_attendance_history_student.

    Safe to re-run — uses ON CONFLICT (id) DO UPDATE.
    """
    gc.execute("""
        SELECT
            ahs.id,
            ahs.student_id,
            COALESCE(u.name || ' ' || u.surname, '') AS student_name,
            ahs.group_id,
            COALESCE(g.name, '')                     AS group_name,
            ahs.subject_id,
            COALESCE(ahs.total_debt, 0)              AS total_debt,
            COALESCE(ahs.payment, 0)                 AS payment,
            COALESCE(ahs.remaining_debt, 0)          AS remaining_debt,
            COALESCE(ahs.total_discount, 0)          AS total_discount,
            ahs.location_id,
            EXTRACT(MONTH FROM cm.date)::int         AS calendar_month,
            EXTRACT(YEAR  FROM cy.date)::int         AS calendar_year,
            COALESCE(ahs.status, false)              AS status
        FROM attendancehistorystudent ahs
        JOIN calendarmonth cm ON cm.id = ahs.calendar_month
        JOIN calendaryear  cy ON cy.id = ahs.calendar_year
        LEFT JOIN students s  ON s.id  = ahs.student_id
        LEFT JOIN users u     ON u.id  = s.user_id
        LEFT JOIN groups g    ON g.id  = ahs.group_id
        ORDER BY ahs.id
    """)
    rows = gc.fetchall()
    if not rows:
        print("  Attendance history seed: 0 records")
        return
    students, groups = attendance_id_maps(mc)
    rows, unmapped = remap_attendance_rows(rows, students, groups)
    if unmapped:
        print(f"  Attendance history seed: {unmapped} row(s) skipped — student not in this DB")
    if not rows:
        return
    execute_values(mc, """
        INSERT INTO gennis_attendance_history_student
            (id, student_id, student_name, group_id, group_name, subject_id,
             total_debt, payment, remaining_debt, total_discount,
             location_id, calendar_month, calendar_year, status)
        VALUES %s
        ON CONFLICT (id) DO UPDATE SET
            student_name   = EXCLUDED.student_name,
            group_name     = EXCLUDED.group_name,
            total_debt     = EXCLUDED.total_debt,
            payment        = EXCLUDED.payment,
            remaining_debt = EXCLUDED.remaining_debt,
            total_discount = EXCLUDED.total_discount,
            status         = EXCLUDED.status,
            synced_at      = NOW()
    """, rows, page_size=2000)
    reset_sequence(mc, "gennis_attendance_history_student", "gennis_attendance_history_student_id_seq")
    print(f"  Attendance history seed: {len(rows)} upserted")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--since", type=date.fromisoformat,
                        help="Sync records since this date (YYYY-MM-DD)")
    parser.add_argument("--all", action="store_true",
                        help="Sync all records since 2026-01-01")
    parser.add_argument("--seed-salaries", action="store_true",
                        help="Full UPSERT of all teachersalary/asistent_salary/staffsalary → management-v2")
    parser.add_argument("--seed-attendance", action="store_true",
                        help="Full UPSERT of all attendancehistorystudent/teacher → management-v2")
    parser.add_argument("--seed-extra", action="store_true",
                        help="Full UPSERT of teacher_black_salary and finereport → management-v2")
    parser.add_argument("--seed-all", action="store_true",
                        help="Run all seed functions (salaries + attendance + extra)")
    args = parser.parse_args()

    gennis = psycopg2.connect(GENNIS_DSN)
    mgmt   = psycopg2.connect(MGMT_DSN)
    gennis.autocommit = True  # read-only

    try:
        with gennis.cursor() as gc, mgmt.cursor() as mc:
            if args.all or args.since:
                since = args.since or DEFAULT_SINCE
                sp_since = ts_since = as_since = ss_since = oh_since = cap_since = since
            else:
                sp_since  = get_last_date(mc, "gennis_student_payment",        "paid_date")
                ts_since  = get_last_date(mc, "gennis_teacher_salary_payment",  "paid_date")
                as_since  = get_last_date(mc, "gennis_assistent_salary_payment","paid_date") if True else DEFAULT_SINCE
                ss_since  = get_last_date(mc, "gennis_staff_salary_payment",    "paid_date")
                oh_since  = get_last_date(mc, "gennis_overhead",               "date")
                cap_since = get_last_date(mc, "gennis_capital_expenditure",     "date")

                # assistent has no data — sync from default
                mc.execute("SELECT COUNT(*) FROM gennis_assistent_salary_payment")
                if mc.fetchone()[0] == 0:
                    as_since = DEFAULT_SINCE

            print(f"Syncing accounting data…")
            print(f"  student_payment since:  {sp_since}")
            print(f"  teacher_salary  since:  {ts_since}")
            print(f"  assistent_salary since: {as_since}")
            print(f"  staff_salary    since:  {ss_since}")
            print(f"  overhead        since:  {oh_since}")
            print(f"  capital         since:  {cap_since}")
            print()

            if args.seed_salaries or args.seed_all:
                print("Seeding salary totals (full upsert)…")
                seed_teacher_salaries(gc, mc)
                seed_assistent_salaries(gc, mc)
                seed_staff_salaries(gc, mc)
                print()

            if args.seed_attendance or args.seed_all:
                print("Seeding attendance history (full upsert)…")
                seed_attendance_history(gc, mc)
                seed_attendance_history_teacher(gc, mc)
                print()

            if args.seed_extra or args.seed_all:
                print("Seeding extra tables (full upsert)…")
                seed_teacher_black_salaries(gc, mc)
                seed_fine_reports(gc, mc)
                seed_overhead(gc, mc)
                seed_capital(gc, mc)
                print()

            sync_student_payments(gc, mc, sp_since)
            sync_deleted_student_payments(gc, mc)
            sync_teacher_salary(gc, mc, ts_since)
            sync_assistent_salary(gc, mc, as_since)
            sync_staff_salary(gc, mc, ss_since)
            sync_deleted_staff_payments(gc, mc)
            sync_overhead(gc, mc, oh_since)
            sync_deleted_overhead(gc, mc)
            sync_capital(gc, mc, cap_since)
            sync_deleted_capital(gc, mc)
            sync_total_salary(gc, mc)
            sync_attendance_history_drift(gc, mc)
            sync_charities(gc, mc)
            sync_deleted_charities(gc, mc)

            mgmt.commit()
            print("\nDone.")
    except Exception as e:
        mgmt.rollback()
        print(f"ERROR: {e}")
        raise
    finally:
        gennis.close()
        mgmt.close()


if __name__ == "__main__":
    main()
