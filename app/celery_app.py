import os
from celery import Celery
from celery.schedules import crontab

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery = Celery(
    "gennis",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["app.tasks"],
)

celery.conf.beat_schedule = {
    "generate-monthly-salaries": {
        "task": "app.tasks.generate_monthly_salaries",
        "schedule": crontab(day_of_month=1, hour=0, minute=0),
    },
    # DISABLED 2026-08-13 — sync_salary_totals pulls teacher/assistent
    # total_salary from OLD GENNIS and overwrites this DB's values for the
    # current and previous month. That was right while old gennis was the system
    # of record. It is not any more: since the cutover, gennis-v2's
    # attendance/mark.py accrues those same totals as lessons are marked, so
    # running this only rolls v2's live figures back to an increasingly stale
    # source. Teacher 19 already showed the symptom — 7,517,044 in v2 against
    # 7,472,428 in old gennis for June, with this job pushing v2 back down.
    #
    # Do not re-enable. If old gennis salary data is ever needed again, run
    # scripts/sync_gennis_accounting.py by hand and check what it would change
    # first.
    # "sync-salary-totals-nightly": {
    #     "task": "app.tasks.sync_salary_totals",
    #     "schedule": crontab(hour=2, minute=30),
    # },
    "generate-lesson-plan-skeletons-daily": {
        "task": "app.tasks.generate_lesson_plan_skeletons",
        "schedule": crontab(hour=6, minute=0),
    },
}
celery.conf.timezone = "Asia/Tashkent"
