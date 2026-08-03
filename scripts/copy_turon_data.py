"""
Copy turon_platform data → management-v2 turon_* mirror tables.
Only syncs system_id=2 (school). system_id=1 (center) is covered by gennis-v2.

Run per branch:
    python scripts/copy_turon_data.py --branch-id 1
    python scripts/copy_turon_data.py --all
    python scripts/copy_turon_data.py --all --full    # TRUNCATE + full reload

Safe to re-run — upserts by turon_id. Tables must already exist
(created by Alembic migration a1b2c3d4e5f6).

Reads TURON_DB_URL (source) and DATABASE_URL_V2 (destination) from env.
"""
import argparse
import os
import sys

import psycopg2
from psycopg2.extras import execute_values


def _psycopg2_dsn(url: str) -> str:
    return url.replace("postgresql+asyncpg://", "postgresql://")


if not os.environ.get("TURON_DB_URL") or not os.environ.get("DATABASE_URL_V2"):
    sys.exit("TURON_DB_URL and DATABASE_URL_V2 must be set in the environment.")

TURON_DSN = _psycopg2_dsn(os.environ["TURON_DB_URL"])
MGMT_DSN  = _psycopg2_dsn(os.environ["DATABASE_URL_V2"])


FULL_REPLACE_TABLES = [
    "turon_deleted_student_group",
    "turon_student_group",
    "turon_lead",
    "turon_student_payment",
    "turon_attendance_history_student",
    "turon_teacher_salary_payment",
    "turon_teacher_salary",
    "turon_teacher_group_statistics",
    "turon_teacher_observation_day",
    "turon_lesson_plan",
    "turon_capital_term",
    "turon_overhead",
    "turon_student",
    "turon_teacher",
    "turon_group",
    "turon_lead",
    "turon_room",
    "turon_capital",
    "turon_overhead_type",
    "turon_group_reason",
    "turon_subject_level",
    "turon_subject",
    "turon_language",
    "turon_branch",
]


# ── Reference / catalog ───────────────────────────────────────────────────────

def sync_branches(turon_cur, mgmt_cur):
    turon_cur.execute("""
        SELECT id, name, code, address, phone_number, district
        FROM branch_branch
    """)
    rows = turon_cur.fetchall()
    execute_values(mgmt_cur, """
        INSERT INTO turon_branch (turon_id, name, code, address, phone_number, district, synced_at)
        VALUES %s
        ON CONFLICT (turon_id) DO UPDATE SET
            name=EXCLUDED.name, code=EXCLUDED.code, address=EXCLUDED.address,
            phone_number=EXCLUDED.phone_number, district=EXCLUDED.district,
            synced_at=NOW()
    """, rows, template="(%s,%s,%s,%s,%s,%s,NOW())")
    print(f"  Branches:         {len(rows)} upserted")


def sync_languages(turon_cur, mgmt_cur):
    turon_cur.execute("SELECT id, name FROM language_language")
    rows = turon_cur.fetchall()
    execute_values(mgmt_cur, """
        INSERT INTO turon_language (turon_id, name, synced_at)
        VALUES %s
        ON CONFLICT (turon_id) DO UPDATE SET name=EXCLUDED.name, synced_at=NOW()
    """, rows, template="(%s,%s,NOW())")
    print(f"  Languages:        {len(rows)} upserted")


def sync_subjects(turon_cur, mgmt_cur):
    turon_cur.execute("SELECT id, name, disabled FROM subjects_subject")
    rows = turon_cur.fetchall()
    execute_values(mgmt_cur, """
        INSERT INTO turon_subject (turon_id, name, disabled, synced_at)
        VALUES %s
        ON CONFLICT (turon_id) DO UPDATE SET name=EXCLUDED.name, disabled=EXCLUDED.disabled, synced_at=NOW()
    """, [(r[0], r[1], r[2] or False) for r in rows], template="(%s,%s,%s,NOW())")
    print(f"  Subjects:         {len(rows)} upserted")


def sync_subject_levels(turon_cur, mgmt_cur):
    turon_cur.execute("SELECT id, name, subject_id, disabled FROM subjects_subjectlevel")
    rows = turon_cur.fetchall()
    execute_values(mgmt_cur, """
        INSERT INTO turon_subject_level (turon_id, name, turon_subject_id, disabled, synced_at)
        VALUES %s
        ON CONFLICT (turon_id) DO UPDATE SET
            name=EXCLUDED.name, turon_subject_id=EXCLUDED.turon_subject_id,
            disabled=EXCLUDED.disabled, synced_at=NOW()
    """, [(r[0], r[1], r[2], r[3] or False) for r in rows], template="(%s,%s,%s,%s,NOW())")
    print(f"  Subject levels:   {len(rows)} upserted")


def sync_group_reasons(turon_cur, mgmt_cur):
    turon_cur.execute("SELECT id, name FROM group_groupreason")
    rows = turon_cur.fetchall()
    # turon source uses 'name' column; we store it in turon_group_reason.reason
    execute_values(mgmt_cur, """
        INSERT INTO turon_group_reason (turon_id, reason, synced_at)
        VALUES %s
        ON CONFLICT (turon_id) DO UPDATE SET reason=EXCLUDED.reason, synced_at=NOW()
    """, rows, template="(%s,%s,NOW())")
    print(f"  Group reasons:    {len(rows)} upserted")


# ── Core entities ─────────────────────────────────────────────────────────────

def sync_teachers(turon_cur, mgmt_cur, branch_ids):
    # Only sync teachers who teach school system (system_id=2) groups
    if branch_ids:
        turon_cur.execute("""
            SELECT DISTINCT gg.teacher_id
            FROM group_group_teacher gg
            JOIN group_group g ON g.id = gg.group_id
            WHERE g.system_id = 2 AND g.branch_id = ANY(%s)
        """, (branch_ids,))
    else:
        turon_cur.execute("""
            SELECT DISTINCT gg.teacher_id
            FROM group_group_teacher gg
            JOIN group_group g ON g.id = gg.group_id
            WHERE g.system_id = 2
        """)
    teacher_ids = [r[0] for r in turon_cur.fetchall()]
    if not teacher_ids:
        print(f"  Teachers:         0 upserted")
        return

    turon_cur.execute("""
        SELECT t.id, t.user_id, u.name, u.surname, u.username,
               t.color, t.total_students, t.salary_percentage, t.deleted
        FROM teachers_teacher t
        JOIN user_customuser u ON u.id = t.user_id
        WHERE t.id = ANY(%s)
    """, (teacher_ids,))

    rows = turon_cur.fetchall()
    for r in rows:
        mgmt_cur.execute("""
            INSERT INTO turon_teacher (
                turon_id, turon_user_id, name, surname, username,
                color, total_students, salary_percentage, deleted, synced_at
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
            ON CONFLICT (turon_id) DO UPDATE SET
                name=EXCLUDED.name, surname=EXCLUDED.surname,
                color=EXCLUDED.color, total_students=EXCLUDED.total_students,
                salary_percentage=EXCLUDED.salary_percentage,
                deleted=EXCLUDED.deleted, synced_at=NOW()
        """, (r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8] or False))

    # resolve management_user_id via turon_user_link
    mgmt_cur.execute("""
        UPDATE turon_teacher t
        SET management_user_id = ul.management_user_id
        FROM turon_user_link ul
        WHERE ul.turon_user_id = t.turon_user_id
          AND t.management_user_id IS DISTINCT FROM ul.management_user_id
    """)
    print(f"  Teachers:         {len(rows)} upserted")


def sync_groups(turon_cur, mgmt_cur, branch_ids):
    filter_sql = "AND g.branch_id = ANY(%s)" if branch_ids else ""
    turon_cur.execute(f"""
        SELECT g.id, g.name, g.branch_id, g.subject_id,
               g.language_id, g.price, g.teacher_salary,
               g.attendance_days, g.status, g.deleted, g.created_date
        FROM group_group g
        WHERE g.system_id = 2 {filter_sql}
    """, (branch_ids,) if branch_ids else ())

    rows = turon_cur.fetchall()
    for r in rows:
        # get primary teacher for group (first one in group_group_teacher)
        turon_cur.execute("""
            SELECT teacher_id FROM group_group_teacher WHERE group_id=%s LIMIT 1
        """, (r[0],))
        teacher_row = turon_cur.fetchone()
        teacher_turon_id = teacher_row[0] if teacher_row else None

        mgmt_cur.execute("""
            INSERT INTO turon_group (
                turon_id, name, branch_turon_id, subject_turon_id,
                teacher_turon_id, language_turon_id, price, teacher_salary,
                attendance_days, status, deleted, created_date, synced_at
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
            ON CONFLICT (turon_id) DO UPDATE SET
                name=EXCLUDED.name, branch_turon_id=EXCLUDED.branch_turon_id,
                subject_turon_id=EXCLUDED.subject_turon_id,
                teacher_turon_id=EXCLUDED.teacher_turon_id,
                price=EXCLUDED.price, teacher_salary=EXCLUDED.teacher_salary,
                attendance_days=EXCLUDED.attendance_days,
                status=EXCLUDED.status, deleted=EXCLUDED.deleted,
                synced_at=NOW()
        """, (r[0], r[1], r[2], r[3], teacher_turon_id, r[4],
              r[5], r[6], r[7], r[8] or True, r[9] or False, r[10]))

    print(f"  Groups:           {len(rows)} upserted")


def sync_students(turon_cur, mgmt_cur, branch_ids):
    # Only students in school (system_id=2) groups
    if branch_ids:
        turon_cur.execute("""
            SELECT DISTINCT gs.student_id
            FROM group_group_students gs
            JOIN group_group g ON g.id = gs.group_id
            WHERE g.system_id = 2 AND g.branch_id = ANY(%s)
        """, (branch_ids,))
    else:
        turon_cur.execute("""
            SELECT DISTINCT gs.student_id
            FROM group_group_students gs
            JOIN group_group g ON g.id = gs.group_id
            WHERE g.system_id = 2
        """)
    student_ids = [r[0] for r in turon_cur.fetchall()]
    if not student_ids:
        print(f"  Students:         0 upserted")
        return
    filter_sql = "WHERE s.id = ANY(%s)"
    params = (student_ids,)

    turon_cur.execute(f"""
        SELECT s.id, s.user_id, u.name, u.surname,
               s.debt_status, s.born_date,
               s.parents_number
        FROM students_student s
        JOIN user_customuser u ON u.id = s.user_id
        {filter_sql}
    """, params)

    rows = turon_cur.fetchall()
    for r in rows:
        mgmt_cur.execute("""
            INSERT INTO turon_student (
                turon_id, turon_user_id, name, surname,
                debt_status, born_date, parents_number, synced_at
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,NOW())
            ON CONFLICT (turon_id) DO UPDATE SET
                name=EXCLUDED.name, surname=EXCLUDED.surname,
                debt_status=EXCLUDED.debt_status, parents_number=EXCLUDED.parents_number,
                synced_at=NOW()
        """, (r[0], r[1], r[2], r[3], r[4], r[5], r[6]))
    print(f"  Students:         {len(rows)} upserted")


def sync_student_groups(turon_cur, mgmt_cur, branch_ids):
    filter_sql = "AND g.branch_id = ANY(%s)" if branch_ids else ""
    turon_cur.execute(f"""
        SELECT gs.student_id, gs.group_id
        FROM group_group_students gs
        JOIN group_group g ON g.id = gs.group_id
        WHERE g.system_id = 2 {filter_sql}
    """, (branch_ids,) if branch_ids else ())

    rows = turon_cur.fetchall()
    if rows:
        execute_values(mgmt_cur, """
            INSERT INTO turon_student_group (student_turon_id, group_turon_id)
            VALUES %s
            ON CONFLICT DO NOTHING
        """, rows)
    print(f"  Student-group:    {len(rows)} upserted")


def sync_deleted_students(turon_cur, mgmt_cur, branch_ids):
    filter_sql = "AND g.branch_id = ANY(%s)" if branch_ids else ""
    # First upsert the students themselves so foreign-key-like lookups work
    turon_cur.execute(f"""
        SELECT DISTINCT ds.student_id, s.user_id, u.name, u.surname,
               s.debt_status, s.born_date, s.parents_number
        FROM students_deletedstudent ds
        JOIN group_group g ON g.id = ds.group_id
        JOIN students_student s ON s.id = ds.student_id
        JOIN user_customuser u ON u.id = s.user_id
        WHERE g.system_id = 2 {filter_sql}
    """, (branch_ids,) if branch_ids else ())
    for r in turon_cur.fetchall():
        mgmt_cur.execute("""
            INSERT INTO turon_student (
                turon_id, turon_user_id, name, surname,
                debt_status, born_date, parents_number, synced_at
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,NOW())
            ON CONFLICT (turon_id) DO UPDATE SET
                name=EXCLUDED.name, surname=EXCLUDED.surname,
                debt_status=EXCLUDED.debt_status, parents_number=EXCLUDED.parents_number,
                synced_at=NOW()
        """, (r[0], r[1], r[2], r[3], r[4], r[5], r[6]))

    # Now upsert the deletion records
    turon_cur.execute(f"""
        SELECT ds.id, ds.student_id, ds.group_id,
               ds.group_reason_id, ds.teacher_id, ds.comment, ds.deleted_date
        FROM students_deletedstudent ds
        JOIN group_group g ON g.id = ds.group_id
        WHERE g.system_id = 2 {filter_sql}
    """, (branch_ids,) if branch_ids else ())
    rows = turon_cur.fetchall()
    for r in rows:
        mgmt_cur.execute("""
            INSERT INTO turon_deleted_student_group (
                turon_id, student_turon_id, group_turon_id,
                reason_turon_id, teacher_turon_id, comment, deleted_date, synced_at
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,NOW())
            ON CONFLICT (student_turon_id, group_turon_id) DO UPDATE SET
                turon_id=EXCLUDED.turon_id,
                comment=EXCLUDED.comment, deleted_date=EXCLUDED.deleted_date,
                synced_at=NOW()
        """, (r[0], r[1], r[2], r[3], r[4], r[5], r[6]))
    print(f"  Deleted students: {len(rows)} upserted")


def sync_leads(turon_cur, mgmt_cur, branch_ids):
    filter_sql = "AND l.branch_id = ANY(%s)" if branch_ids else ""
    turon_cur.execute(f"""
        SELECT l.id, l.name, l.phone, l.branch_id, l.finished, l.deleted, l.created
        FROM lead_lead l
        WHERE 1=1 {filter_sql}
    """, (branch_ids,) if branch_ids else ())

    rows = turon_cur.fetchall()
    for r in rows:
        mgmt_cur.execute("""
            INSERT INTO turon_lead (
                turon_id, name, phone, branch_turon_id,
                finished, deleted, created, synced_at
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,NOW())
            ON CONFLICT (turon_id) DO UPDATE SET
                name=EXCLUDED.name, phone=EXCLUDED.phone,
                finished=EXCLUDED.finished, deleted=EXCLUDED.deleted,
                synced_at=NOW()
        """, (r[0], r[1], r[2], r[3], r[4] or False, r[5] or False, r[6]))
    print(f"  Leads:            {len(rows)} upserted ({sum(1 for r in rows if not r[5])} active)")


# ── Finance ───────────────────────────────────────────────────────────────────

def sync_overhead_types(turon_cur, mgmt_cur, branch_ids):
    filter_sql = "AND branch_id = ANY(%s)" if branch_ids else ""
    turon_cur.execute(f"""
        SELECT id, name, cost, changeable, branch_id, management_id, deleted
        FROM overhead_overheadtype
        WHERE 1=1 {filter_sql}
    """, (branch_ids,) if branch_ids else ())

    rows = turon_cur.fetchall()
    for r in rows:
        mgmt_cur.execute("""
            INSERT INTO turon_overhead_type (
                turon_id, name, cost, changeable,
                branch_turon_id, management_id, deleted, synced_at
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,NOW())
            ON CONFLICT (turon_id) DO UPDATE SET
                name=EXCLUDED.name, cost=EXCLUDED.cost,
                changeable=EXCLUDED.changeable, deleted=EXCLUDED.deleted,
                synced_at=NOW()
        """, (r[0], r[1], r[2], r[3] if r[3] is not None else True,
              r[4], r[5], r[6] or False))
    print(f"  Overhead types:   {len(rows)} upserted")


def sync_capital_categories(turon_cur, mgmt_cur):
    turon_cur.execute("SELECT id, name FROM capital_capitalcategory")
    rows = turon_cur.fetchall()
    execute_values(mgmt_cur, """
        INSERT INTO turon_capital_category (turon_id, name, synced_at)
        VALUES %s
        ON CONFLICT (turon_id) DO UPDATE SET name=EXCLUDED.name, synced_at=NOW()
    """, rows, template="(%s,%s,NOW())")
    print(f"  Capital cats:     {len(rows)} upserted")


def sync_capitals(turon_cur, mgmt_cur, branch_ids):
    filter_sql = "AND branch_id = ANY(%s)" if branch_ids else ""
    turon_cur.execute(f"""
        SELECT id, name, price, total_down_cost, branch_id, category_id, added_date, deleted
        FROM capital_capital
        WHERE 1=1 {filter_sql}
    """, (branch_ids,) if branch_ids else ())

    rows = turon_cur.fetchall()
    for r in rows:
        mgmt_cur.execute("""
            INSERT INTO turon_capital (
                turon_id, name, price, total_down_cost,
                branch_turon_id, category_turon_id, added_date, deleted, synced_at
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,NOW())
            ON CONFLICT (turon_id) DO UPDATE SET
                name=EXCLUDED.name, price=EXCLUDED.price,
                total_down_cost=EXCLUDED.total_down_cost,
                deleted=EXCLUDED.deleted, synced_at=NOW()
        """, (r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7] or False))
    print(f"  Capitals:         {len(rows)} upserted")


def sync_capital_terms(turon_cur, mgmt_cur, branch_ids):
    if branch_ids:
        turon_cur.execute("""
            SELECT ct.id, ct.down_cost, ct.month_date, ct.capital_id
            FROM capital_capitalterm ct
            JOIN capital_capital c ON c.id = ct.capital_id
            WHERE c.branch_id = ANY(%s)
        """, (branch_ids,))
    else:
        turon_cur.execute("SELECT id, down_cost, month_date, capital_id FROM capital_capitalterm")

    rows = turon_cur.fetchall()
    for r in rows:
        mgmt_cur.execute("""
            INSERT INTO turon_capital_term (
                turon_id, down_cost, month_date, capital_turon_id, synced_at
            ) VALUES (%s,%s,%s,%s,NOW())
            ON CONFLICT (turon_id) DO UPDATE SET
                down_cost=EXCLUDED.down_cost, month_date=EXCLUDED.month_date, synced_at=NOW()
        """, (r[0], r[1], r[2], r[3]))
    print(f"  Capital terms:    {len(rows)} upserted")


def sync_student_payments(turon_cur, mgmt_cur, branch_ids):
    # Only students in school system (system_id=2) groups
    filter_sql = "AND sp.branch_id = ANY(%s)" if branch_ids else ""
    turon_cur.execute(f"""
        SELECT sp.id, sp.student_id, sp.branch_id, sp.payment_sum, sp.extra_payment, sp.date, sp.deleted
        FROM students_studentpayment sp
        WHERE sp.student_id IN (
            SELECT DISTINCT gs.student_id
            FROM group_group_students gs
            JOIN group_group g ON g.id = gs.group_id
            WHERE g.system_id = 2
        ) {filter_sql}
    """, (branch_ids,) if branch_ids else ())

    rows = turon_cur.fetchall()
    for r in rows:
        mgmt_cur.execute("""
            INSERT INTO turon_student_payment (
                turon_id, student_turon_id, branch_turon_id,
                payment_sum, extra_payment, payment_date, deleted, synced_at
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,NOW())
            ON CONFLICT (turon_id) DO UPDATE SET
                payment_sum=EXCLUDED.payment_sum, extra_payment=EXCLUDED.extra_payment,
                deleted=EXCLUDED.deleted, synced_at=NOW()
        """, (r[0], r[1], r[2], r[3], r[4], r[5], r[6] or False))
    print(f"  Student payments: {len(rows)} upserted")


def sync_attendance_history(turon_cur, mgmt_cur, branch_ids):
    if branch_ids:
        turon_cur.execute("""
            SELECT a.id, a.student_id, a.teacher_id, a.group_id,
                   g.branch_id,
                   a.month_date, a.total_debt, a.remaining_debt,
                   a.payment, a.ball_percentage, a.present_days, a.absent_days, a.discount
            FROM attendances_attendancepermonth a
            JOIN group_group g ON g.id = a.group_id
            WHERE g.system_id = 2 AND g.branch_id = ANY(%s)
        """, (branch_ids,))
    else:
        turon_cur.execute("""
            SELECT a.id, a.student_id, a.teacher_id, a.group_id,
                   g.branch_id,
                   a.month_date, a.total_debt, a.remaining_debt,
                   a.payment, a.ball_percentage, a.present_days, a.absent_days, a.discount
            FROM attendances_attendancepermonth a
            JOIN group_group g ON g.id = a.group_id
            WHERE g.system_id = 2
        """)

    rows = turon_cur.fetchall()
    for r in rows:
        mgmt_cur.execute("""
            INSERT INTO turon_attendance_history_student (
                turon_id, student_turon_id, teacher_turon_id, group_turon_id,
                branch_turon_id, month_date, total_debt, remaining_debt,
                payment, ball_percentage, present_days, absent_days, discount, synced_at
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
            ON CONFLICT (turon_id) DO UPDATE SET
                total_debt=EXCLUDED.total_debt,
                remaining_debt=EXCLUDED.remaining_debt,
                payment=EXCLUDED.payment,
                ball_percentage=EXCLUDED.ball_percentage,
                present_days=EXCLUDED.present_days,
                absent_days=EXCLUDED.absent_days,
                discount=EXCLUDED.discount,
                synced_at=NOW()
        """, (r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7],
              r[8], r[9], r[10], r[11], r[12]))
    print(f"  Attendance hist:  {len(rows)} upserted")


# ── Teacher analytics ─────────────────────────────────────────────────────────

def sync_teacher_salaries(turon_cur, mgmt_cur, branch_ids):
    # Only school teachers (system_id=2 group teachers)
    filter_sql = "AND ts.branch_id = ANY(%s)" if branch_ids else ""
    turon_cur.execute(f"""
        SELECT ts.id, ts.teacher_id, ts.branch_id, ts.month_date,
               ts.total_salary, ts.remaining_salary, ts.taken_salary, ts.percentage
        FROM teachers_teachersalary ts
        WHERE ts.teacher_id IN (
            SELECT DISTINCT gg.teacher_id
            FROM group_group_teacher gg
            JOIN group_group g ON g.id = gg.group_id
            WHERE g.system_id = 2
        ) {filter_sql}
    """, (branch_ids,) if branch_ids else ())

    rows = turon_cur.fetchall()
    for r in rows:
        mgmt_cur.execute("""
            INSERT INTO turon_teacher_salary (
                turon_id, teacher_turon_id, branch_turon_id, month_date,
                total_salary, remaining_salary, taken_salary, percentage, synced_at
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,NOW())
            ON CONFLICT (turon_id) DO UPDATE SET
                total_salary=EXCLUDED.total_salary,
                remaining_salary=EXCLUDED.remaining_salary,
                taken_salary=EXCLUDED.taken_salary,
                percentage=EXCLUDED.percentage,
                synced_at=NOW()
        """, (r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7]))
    print(f"  Teacher salaries: {len(rows)} upserted")


def sync_teacher_salary_payments(turon_cur, mgmt_cur, branch_ids):
    # Only school teachers (system_id=2 group teachers)
    filter_sql = "AND tsl.branch_id = ANY(%s)" if branch_ids else ""
    turon_cur.execute(f"""
        SELECT tsl.id, tsl.teacher_id, tsl.salary_id_id, tsl.branch_id,
               tsl.salary, tsl.date, tsl.comment, tsl.deleted
        FROM teachers_teachersalarylist tsl
        WHERE tsl.teacher_id IN (
            SELECT DISTINCT gg.teacher_id
            FROM group_group_teacher gg
            JOIN group_group g ON g.id = gg.group_id
            WHERE g.system_id = 2
        ) {filter_sql}
    """, (branch_ids,) if branch_ids else ())

    rows = turon_cur.fetchall()
    for r in rows:
        mgmt_cur.execute("""
            INSERT INTO turon_teacher_salary_payment (
                turon_id, teacher_turon_id, salary_turon_id, branch_turon_id,
                salary, date, comment, deleted, synced_at
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,NOW())
            ON CONFLICT (turon_id) DO UPDATE SET
                salary=EXCLUDED.salary, deleted=EXCLUDED.deleted, synced_at=NOW()
        """, (r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7] or False))
    print(f"  Salary payments:  {len(rows)} upserted")


def sync_lesson_plans(turon_cur, mgmt_cur, branch_ids):
    if branch_ids:
        turon_cur.execute("""
            SELECT lp.id, lp.teacher_id, lp.group_id, lp.ball, lp.date
            FROM lesson_plan_lessonplan lp
            JOIN group_group g ON g.id = lp.group_id
            WHERE g.system_id = 2 AND g.branch_id = ANY(%s)
        """, (branch_ids,))
    else:
        turon_cur.execute("""
            SELECT lp.id, lp.teacher_id, lp.group_id, lp.ball, lp.date
            FROM lesson_plan_lessonplan lp
            JOIN group_group g ON g.id = lp.group_id
            WHERE g.system_id = 2
        """)

    rows = turon_cur.fetchall()
    for r in rows:
        mgmt_cur.execute("""
            INSERT INTO turon_lesson_plan (
                turon_id, teacher_turon_id, group_turon_id, ball, date, synced_at
            ) VALUES (%s,%s,%s,%s,%s,NOW())
            ON CONFLICT (turon_id) DO UPDATE SET
                ball=EXCLUDED.ball, synced_at=NOW()
        """, (r[0], r[1], r[2], r[3], r[4]))
    print(f"  Lesson plans:     {len(rows)} upserted")


def sync_teacher_observations(turon_cur, mgmt_cur, branch_ids):
    # observation_teacherobservationday uses time_table_id (not group_id) and date (not day)
    turon_cur.execute("""
        SELECT id, teacher_id, user_id, date, average
        FROM observation_teacherobservationday
    """)
    rows = turon_cur.fetchall()
    for r in rows:
        mgmt_cur.execute("""
            INSERT INTO turon_teacher_observation_day (
                turon_id, teacher_turon_id, group_turon_id,
                user_turon_id, day, average, synced_at
            ) VALUES (%s,%s,NULL,%s,%s,%s,NOW())
            ON CONFLICT (turon_id) DO UPDATE SET
                average=EXCLUDED.average, synced_at=NOW()
        """, (r[0], r[1], r[2], r[3], r[4]))
    print(f"  Observations:     {len(rows)} upserted")


def sync_teacher_group_stats(turon_cur, mgmt_cur, branch_ids):
    filter_sql = "AND branch_id = ANY(%s)" if branch_ids else ""
    turon_cur.execute(f"""
        SELECT id, teacher_id, reason_id, branch_id,
               number_students, percentage, date
        FROM teachers_teachergroupstatistics
        WHERE 1=1 {filter_sql}
    """, (branch_ids,) if branch_ids else ())

    rows = turon_cur.fetchall()
    for r in rows:
        mgmt_cur.execute("""
            INSERT INTO turon_teacher_group_statistics (
                turon_id, teacher_turon_id, reason_turon_id, branch_turon_id,
                number_students, percentage, date, synced_at
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,NOW())
            ON CONFLICT (turon_id) DO UPDATE SET
                number_students=EXCLUDED.number_students,
                percentage=EXCLUDED.percentage,
                synced_at=NOW()
        """, (r[0], r[1], r[2], r[3], r[4], r[5], r[6]))
    print(f"  Teacher stats:    {len(rows)} upserted")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--branch-id", type=int, help="Sync a single branch by ID")
    parser.add_argument("--all", action="store_true", help="Sync all branches")
    parser.add_argument("--full", action="store_true",
                        help="TRUNCATE all target tables first (full replace)")
    args = parser.parse_args()

    if not args.all and not args.branch_id:
        parser.error("Specify --branch-id N or --all")

    if args.full and not args.all:
        parser.error("--full requires --all")

    branch_ids = None if args.all else [args.branch_id]

    turon = psycopg2.connect(TURON_DSN)
    mgmt  = psycopg2.connect(MGMT_DSN)

    if args.full:
        print("--full: truncating target tables…")
        with mgmt.cursor() as mc:
            for table in FULL_REPLACE_TABLES:
                mc.execute(f"TRUNCATE TABLE {table} CASCADE")
        mgmt.commit()

    label = f"branch_id={branch_ids}" if branch_ids else "ALL branches"
    print(f"Syncing {label}…")

    with turon.cursor() as tc, mgmt.cursor() as mc:
        # Catalog (no branch filter — always full sync)
        sync_branches(tc, mc)
        sync_languages(tc, mc)
        sync_subjects(tc, mc)
        sync_subject_levels(tc, mc)
        sync_group_reasons(tc, mc)
        sync_capital_categories(tc, mc)
        mgmt.commit()

        # Entities
        sync_teachers(tc, mc, branch_ids)
        sync_groups(tc, mc, branch_ids)
        sync_students(tc, mc, branch_ids)
        sync_student_groups(tc, mc, branch_ids)
        sync_deleted_students(tc, mc, branch_ids)
        sync_leads(tc, mc, branch_ids)
        mgmt.commit()

        # Finance
        sync_overhead_types(tc, mc, branch_ids)
        sync_capitals(tc, mc, branch_ids)
        sync_capital_terms(tc, mc, branch_ids)
        sync_student_payments(tc, mc, branch_ids)
        sync_attendance_history(tc, mc, branch_ids)
        mgmt.commit()

        # Teacher analytics
        sync_teacher_salaries(tc, mc, branch_ids)
        sync_teacher_salary_payments(tc, mc, branch_ids)
        sync_lesson_plans(tc, mc, branch_ids)
        sync_teacher_observations(tc, mc, branch_ids)
        sync_teacher_group_stats(tc, mc, branch_ids)
        mgmt.commit()

    print("\nDone.")
    turon.close()
    mgmt.close()


if __name__ == "__main__":
    main()
