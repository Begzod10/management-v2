import logging
import os
from datetime import date
import httpx
import psycopg2
from psycopg2.extras import execute_values
from sqlalchemy import text
from .celery_app import celery
from .database import SessionLocal
from .models import User, SalaryMonth
from .gennis_v2_models import GennisGroupTime, LessonPlan
from .config import settings

logger = logging.getLogger(__name__)


@celery.task(name="app.tasks.generate_monthly_salaries")
def generate_monthly_salaries():
    db = SessionLocal()
    try:
        period = date.today().replace(day=1)

        users = db.query(User).filter(
            User.deleted == False,
            User.is_active == True,
            User.salary != None,
            User.salary > 0,
        ).all()

        created = 0
        for user in users:
            exists = db.query(SalaryMonth).filter(
                SalaryMonth.user_id == user.id,
                SalaryMonth.date == period,
                SalaryMonth.deleted == False,
            ).first()
            if not exists:
                db.add(SalaryMonth(
                    user_id=user.id,
                    salary=user.salary,
                    taken_salary=0,
                    remaining_salary=user.salary,
                    date=period,
                ))
                created += 1

        db.commit()
        return {"created": created, "period": str(period)}
    finally:
        db.close()


@celery.task(name="app.tasks.sync_salary_totals")
def sync_salary_totals():
    """Sync total_salary from old gennis into the management DB.

    Old gennis recomputes total_salary nightly from AttendanceDays; without this
    task the management DB copy drifts whenever old gennis updates the value after
    our last sync run.  Covers current month + previous month.
    """
    gennis_dsn = os.environ.get("GENNIS_SYNC_DSN")
    mgmt_dsn   = os.environ.get("MGMT_SYNC_DSN")
    if not gennis_dsn or not mgmt_dsn:
        logger.warning("sync_salary_totals: GENNIS_SYNC_DSN or MGMT_SYNC_DSN not set, skipping")
        return {"skipped": True}

    gennis = psycopg2.connect(gennis_dsn)
    mgmt   = psycopg2.connect(mgmt_dsn)
    gennis.autocommit = True
    teacher_count = assistent_count = 0
    try:
        with gennis.cursor() as gc, mgmt.cursor() as mc:
            gc.execute("""
                SELECT
                    ts.teacher_id,
                    ts.location_id,
                    EXTRACT(MONTH FROM cm.date)::int AS calendar_month,
                    EXTRACT(YEAR  FROM cy.date)::int AS calendar_year,
                    COALESCE(ts.total_salary, 0)
                FROM teachersalary ts
                JOIN calendarmonth cm ON cm.id = ts.calendar_month
                JOIN calendaryear  cy ON cy.id = ts.calendar_year
                WHERE cm.date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
            """)
            teacher_rows = gc.fetchall()
            if teacher_rows:
                execute_values(mc, """
                    UPDATE gennis_teacher_salary AS t
                    SET total_salary = d.total_salary,
                        synced_at    = NOW()
                    FROM (VALUES %s) AS d(teacher_id, location_id, calendar_month, calendar_year, total_salary)
                    WHERE t.teacher_id     = d.teacher_id
                      AND t.location_id    = d.location_id
                      AND t.calendar_month = d.calendar_month
                      AND t.calendar_year  = d.calendar_year
                """, teacher_rows)
                teacher_count = len(teacher_rows)

            gc.execute("""
                SELECT
                    a.assisten_id,
                    a.location_id,
                    EXTRACT(MONTH FROM cm.date)::int AS calendar_month,
                    EXTRACT(YEAR  FROM cy.date)::int AS calendar_year,
                    COALESCE(a.total_salary, 0)
                FROM asistent_salary a
                JOIN calendarmonth cm ON cm.id = a.calendar_month
                JOIN calendaryear  cy ON cy.id = a.calendar_year
                WHERE cm.date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
            """)
            assistent_rows = gc.fetchall()
            if assistent_rows:
                execute_values(mc, """
                    UPDATE gennis_assistent_salary AS t
                    SET total_salary = d.total_salary,
                        synced_at    = NOW()
                    FROM (VALUES %s) AS d(assistent_id, location_id, calendar_month, calendar_year, total_salary)
                    WHERE t.assistent_id   = d.assistent_id
                      AND t.location_id    = d.location_id
                      AND t.calendar_month = d.calendar_month
                      AND t.calendar_year  = d.calendar_year
                """, assistent_rows)
                assistent_count = len(assistent_rows)

            mgmt.commit()
    except Exception as exc:
        mgmt.rollback()
        logger.error("sync_salary_totals failed: %s", exc)
        raise
    finally:
        gennis.close()
        mgmt.close()

    logger.info(
        "sync_salary_totals done: teachers=%d assistents=%d",
        teacher_count, assistent_count,
    )
    return {"teacher_rows": teacher_count, "assistent_rows": assistent_count}


@celery.task(name="app.tasks.send_telegram_notification", max_retries=2)
def send_telegram_notification(chat_id: int, text: str):
    """Send a Telegram message synchronously. Logs failures, never raises."""
    if not settings.TELEGRAM_BOT_TOKEN:
        logger.warning("telegram skip: TELEGRAM_BOT_TOKEN is empty")
        return
    if not chat_id:
        logger.warning("telegram skip: chat_id is empty")
        return
    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    proxy = settings.TELEGRAM_PROXY or None
    try:
        with httpx.Client(timeout=5.0, proxy=proxy) as client:
            resp = client.post(url, json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"})
        if resp.status_code != 200:
            snippet = resp.text[:300].replace("\n", " ")
            logger.warning(
                "telegram send failed chat_id=%s status=%s body=%s",
                chat_id, resp.status_code, snippet,
            )
        else:
            logger.info("telegram sent chat_id=%s len=%s", chat_id, len(text))
    except Exception as exc:
        logger.warning("telegram transport error chat_id=%s err=%s", chat_id, exc)


@celery.task(name="app.tasks.generate_lesson_plan_skeletons")
def generate_lesson_plan_skeletons():
    """Create a blank lesson_plan skeleton for every group that has a lesson today.

    Runs daily at 06:00 Tashkent time. Teachers then open the lesson-plan page
    and fill in the content — the skeleton just ensures the row exists so the
    page doesn't show "not found" on lesson days.

    Skips groups that already have a plan for today (idempotent via the unique
    constraint on group_id+year+month+day) and groups with no assigned teacher.
    """
    today = date.today()
    weekday = today.weekday()   # 0=Mon … 6=Sun, matches day_of_week in gennis_group_time
    year  = str(today.year)
    month = str(today.month).zfill(2)
    day   = str(today.day).zfill(2)

    db = SessionLocal()
    try:
        group_ids = [
            row[0]
            for row in db.query(GennisGroupTime.group_id)
            .filter(GennisGroupTime.day_of_week == weekday)
            .distinct()
            .all()
        ]

        if not group_ids:
            logger.info("lesson_plan skeletons: no groups scheduled for weekday=%s", weekday)
            return {"created": 0, "skipped": 0, "date": str(today)}

        rows = db.execute(
            text("""
                SELECT g.id,
                       COALESCE(
                           g.teacher_mgmt_id,
                           ul.management_user_id
                       ) AS teacher_mgmt_id
                FROM gennis_group g
                LEFT JOIN gennis_teacher gt ON gt.gennis_id = g.teacher_gennis_id
                LEFT JOIN gennis_user_link ul ON ul.gennis_user_id = gt.user_gennis_id
                WHERE g.id = ANY(:ids) AND g.deleted = false
            """),
            {"ids": group_ids},
        ).fetchall()
        groups_by_id = {r.id: r for r in rows}

        existing = {
            row[0]
            for row in db.query(LessonPlan.group_id)
            .filter(
                LessonPlan.group_id.in_(group_ids),
                LessonPlan.year == year,
                LessonPlan.month == month,
                LessonPlan.day == day,
                LessonPlan.deleted == False,
            )
            .all()
        }

        created = skipped = 0
        for gid in group_ids:
            if gid in existing:
                skipped += 1
                continue
            group = groups_by_id.get(gid)
            if not group or not group[1]:
                skipped += 1
                continue
            db.add(LessonPlan(
                group_id=gid,
                teacher_id=group[1],
                year=year,
                month=month,
                day=day,
                date=today,
                deleted=False,
            ))
            created += 1

        db.commit()
        logger.info("lesson_plan skeletons: created=%s skipped=%s date=%s", created, skipped, today)
        return {"created": created, "skipped": skipped, "date": str(today)}
    except Exception:
        db.rollback()
        logger.exception("lesson_plan skeleton generation failed")
        raise
    finally:
        db.close()
