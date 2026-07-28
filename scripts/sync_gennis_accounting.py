"""
Sync accounting transactions from old Gennis → management-v2 DB (incremental).

Tables synced:
  gennis_student_payment         ← studentpayments
  gennis_teacher_salary_payment  ← teachersalaries
  gennis_assistent_salary_payment← assistent_salaries
  gennis_staff_salary_payment    ← staffsalaries
  gennis_overhead                ← overhead
  gennis_capital_expenditure     ← capital_expenditure

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
        return row[0] - timedelta(days=3)  # overlap 3 days to catch partial syncs
    return DEFAULT_SINCE


def reset_sequence(mgmt_cur, table, seq_name):
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


# ── overhead ──────────────────────────────────────────────────────────────────

def sync_overhead(gc, mc, since):
    gc.execute("""
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
        WHERE cd.date::date >= %s
        ORDER BY o.id
    """, (since,))

    rows = gc.fetchall()
    if not rows:
        print("  Overhead:             0 records")
        return

    # Use INSERT WHERE NOT EXISTS to avoid duplicating management-created records.
    # Match on (location_id, date, item_sum, channel) — good enough for dedup.
    inserted = 0
    for r in rows:
        mc.execute("""
            INSERT INTO gennis_overhead
                (item_name, item_sum, overhead_type_id, channel,
                 location_id, date, calendar_month, calendar_year, deleted)
            SELECT %s, %s, NULL, %s, %s, %s, %s, %s, false
            WHERE NOT EXISTS (
                SELECT 1 FROM gennis_overhead
                WHERE location_id=%s AND date=%s AND item_sum=%s AND channel=%s
            )
        """, (
            r[1], r[2], r[3], r[4], r[5], r[6], r[7],
            r[4], r[5], r[2], r[3],
        ))
        inserted += mc.rowcount

    print(f"  Overhead:             {inserted} inserted (since {since})")


# ── capital expenditure ───────────────────────────────────────────────────────

def sync_capital(gc, mc, since):
    gc.execute("""
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
        WHERE cd.date::date >= %s
        ORDER BY ce.id
    """, (since,))

    rows = gc.fetchall()
    if not rows:
        print("  Capital expenditure:  0 records")
        return

    inserted = 0
    for r in rows:
        mc.execute("""
            INSERT INTO gennis_capital_expenditure
                (item_name, item_sum, channel,
                 location_id, date, calendar_month, calendar_year, deleted)
            SELECT %s, %s, %s, %s, %s, %s, %s, false
            WHERE NOT EXISTS (
                SELECT 1 FROM gennis_capital_expenditure
                WHERE location_id=%s AND date=%s AND item_sum=%s AND channel=%s
            )
        """, (
            r[1], r[2], r[3], r[4], r[5], r[6], r[7],
            r[4], r[5], r[2], r[3],
        ))
        inserted += mc.rowcount

    print(f"  Capital expenditure:  {inserted} inserted (since {since})")


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--since", type=date.fromisoformat,
                        help="Sync records since this date (YYYY-MM-DD)")
    parser.add_argument("--all", action="store_true",
                        help="Sync all records since 2026-01-01")
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

            sync_student_payments(gc, mc, sp_since)
            sync_teacher_salary(gc, mc, ts_since)
            sync_assistent_salary(gc, mc, as_since)
            sync_staff_salary(gc, mc, ss_since)
            sync_overhead(gc, mc, oh_since)
            sync_capital(gc, mc, cap_since)

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
