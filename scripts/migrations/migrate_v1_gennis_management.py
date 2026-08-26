"""
Migrate gennis_management (V1) -> management (V2).

V2's `user` table is NOT the same id-space as V1's — V2 is the unified
identity table for the whole platform (gennis students/teachers, turon,
and this task-management domain: 18k+ rows), while V1 only ever had its
own small internal-staff `user` table (43 rows). id=2 in V1 is a
completely different person than id=2 in V2. Every V1 row that carries a
user_id (or any other V1-assigned id referenced by a child table) must be
re-pointed through a lookup built during this run — never copied as-is.

User matching: by email (case-insensitive, exact). A V1 user whose email
already exists in V2 maps to that V2 id. A V1 user with an email V2 doesn't
have gets a brand-new V2 user row. A V1 user with NO email at all cannot be
matched or safely deduplicated — it is skipped and reported; any of its
data (missions, salary rows, ...) is skipped along with it.

Always performs the writes so a dry run reports exactly what a live run
would do (same code path, same generated ids) — only the final
commit-vs-rollback differs.

Usage:
    python migrate_v1_management.py            # dry run (default) — writes, then rolls back
    python migrate_v1_management.py --live      # writes, then commits
"""
import argparse
import os

import psycopg2
import psycopg2.extras

V1_DSN = "postgresql://postgres:or9T#u-x5PZo--@host.docker.internal:5432/gennis_management"
V2_DSN = os.environ.get("DATABASE_URL", "postgresql://postgres:CHANGE_ME@db:5432/management")

GREEN, YELLOW, CYAN, RESET, BOLD = ("\033[92m", "\033[93m", "\033[96m", "\033[0m", "\033[1m")


def log(msg):
    print(msg, flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true", help="Commit (default: dry-run, writes then rolls back)")
    args = parser.parse_args()
    live = args.live

    src = psycopg2.connect(V1_DSN)
    dst = psycopg2.connect(V2_DSN)
    src.set_session(readonly=True, autocommit=True)
    s = src.cursor(cursor_factory=psycopg2.extras.DictCursor)
    d = dst.cursor(cursor_factory=psycopg2.extras.DictCursor)

    stats = {}

    def note(table, **kv):
        stats[table] = kv

    # ── 1. system_model — match by name ───────────────────────────────────────
    s.execute("SELECT id, name FROM system_model")
    v1_system = {r["name"]: r["id"] for r in s.fetchall()}
    d.execute("SELECT id, name FROM system_model")
    v2_system = {r["name"]: r["id"] for r in d.fetchall()}
    system_map = {v1_system[name]: v2_system[name] for name in v1_system if name in v2_system}
    note("system_model", matched=len(system_map), missing=[n for n in v1_system if n not in v2_system])

    # ── 2. job — additive by name ─────────────────────────────────────────────
    s.execute("SELECT id, name, \"desc\", deleted FROM job")
    v1_jobs = s.fetchall()
    d.execute("SELECT id, name FROM job")
    v2_job_by_name = {}
    for r in d.fetchall():
        v2_job_by_name.setdefault(r["name"], r["id"])
    job_map = {}
    new_jobs = [r for r in v1_jobs if r["name"] not in v2_job_by_name]
    for r in v1_jobs:
        if r["name"] in v2_job_by_name:
            job_map[r["id"]] = v2_job_by_name[r["name"]]
    for r in new_jobs:
        d.execute("INSERT INTO job (name, \"desc\", deleted) VALUES (%s,%s,%s) RETURNING id",
                   (r["name"], r["desc"], r["deleted"]))
        job_map[r["id"]] = d.fetchone()["id"]
    note("job", already_matched=len(job_map) - len(new_jobs), created=len(new_jobs))

    # ── 3. user — match by email, create if missing, skip if no email ────────
    s.execute('SELECT id, name, surname, email, born_date, password, hashed_password, '
              'age, job_id, is_active, role, deleted, timezone, telegram_id, username, salary '
              'FROM "user"')
    v1_users = s.fetchall()
    d.execute('SELECT id, lower(email) AS email FROM "user" WHERE email IS NOT NULL')
    v2_user_by_email = {r["email"]: r["id"] for r in d.fetchall()}
    d.execute('SELECT lower(username) AS username FROM "user" WHERE username IS NOT NULL')
    v2_usernames = {r["username"] for r in d.fetchall()}

    user_map = {}
    skipped_no_email = []
    new_users = []
    for r in v1_users:
        email = (r["email"] or "").strip().lower()
        if not email:
            skipped_no_email.append((r["id"], r["name"], r["surname"]))
            continue
        if email in v2_user_by_email:
            user_map[r["id"]] = v2_user_by_email[email]
        else:
            new_users.append(r)

    for r in new_users:
        uname = (r["username"] or "").strip().lower()
        final_username = r["username"]
        if uname and uname in v2_usernames:
            final_username = None
        elif uname:
            v2_usernames.add(uname)
        new_job_id = job_map.get(r["job_id"]) if r["job_id"] else None
        d.execute(
            """INSERT INTO "user"
               (name, surname, email, born_date, hashed_password, age, job_id,
                is_active, role, deleted, timezone, telegram_id, username, salary,
                auth_provider, is_verified, failed_login_attempts)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'Asia/Tashkent',%s,%s,%s,'email',false,0)
               RETURNING id""",
            (r["name"], r["surname"], r["email"], r["born_date"], r["hashed_password"],
             r["age"], new_job_id, r["is_active"], r["role"], r["deleted"],
             r["telegram_id"], final_username, r["salary"]),
        )
        user_map[r["id"]] = d.fetchone()["id"]
    note("user", already_matched=len(user_map) - len(new_users), created=len(new_users),
         skipped_no_email=skipped_no_email)

    def uid(v1_id):
        return user_map.get(v1_id) if v1_id is not None else None

    # ── 4. branch — empty in V2, straight insert ──────────────────────────────
    s.execute("SELECT id, name, system_model_id, deleted FROM branch")
    v1_branches = s.fetchall()
    branch_map = {}
    for r in v1_branches:
        d.execute("INSERT INTO branch (name, system_model_id, deleted) VALUES (%s,%s,%s) RETURNING id",
                   (r["name"], system_map.get(r["system_model_id"]), r["deleted"]))
        branch_map[r["id"]] = d.fetchone()["id"]
    note("branch", created=len(branch_map))

    # ── 5. section ─────────────────────────────────────────────────────────────
    s.execute("SELECT id, name, leader_id, deleted, created_at FROM section")
    v1_sections = s.fetchall()
    section_map, skipped_sections = {}, []
    for r in v1_sections:
        if r["leader_id"] and not uid(r["leader_id"]):
            skipped_sections.append(r["id"])
            continue
        d.execute("INSERT INTO section (name, leader_id, deleted, created_at) VALUES (%s,%s,%s,%s) RETURNING id",
                   (r["name"], uid(r["leader_id"]), r["deleted"], r["created_at"]))
        section_map[r["id"]] = d.fetchone()["id"]
    note("section", created=len(section_map), skipped_no_leader_match=skipped_sections)

    # ── 6. project ─────────────────────────────────────────────────────────────
    s.execute("SELECT id, name, manager_id, description, deleted, created_at FROM project")
    v1_projects = s.fetchall()
    project_map, skipped_projects = {}, []
    for r in v1_projects:
        if not uid(r["manager_id"]):
            skipped_projects.append(r["id"])
            continue
        d.execute("INSERT INTO project (name, manager_id, description, deleted, created_at) "
                   "VALUES (%s,%s,%s,%s,%s) RETURNING id",
                   (r["name"], uid(r["manager_id"]), r["description"], r["deleted"], r["created_at"]))
        project_map[r["id"]] = d.fetchone()["id"]
    note("project", created=len(project_map), skipped_no_manager_match=skipped_projects)

    # ── 7. section_member / project_member ────────────────────────────────────
    s.execute("SELECT section_id, user_id FROM section_member")
    sm_created = 0
    for r in s.fetchall():
        sec, u = section_map.get(r["section_id"]), uid(r["user_id"])
        if sec and u:
            d.execute("INSERT INTO section_member (section_id, user_id) VALUES (%s,%s) "
                      "ON CONFLICT (section_id, user_id) DO NOTHING", (sec, u))
            sm_created += 1
    note("section_member", created=sm_created)

    s.execute("SELECT project_id, user_id FROM project_member")
    pm_created = 0
    for r in s.fetchall():
        proj, u = project_map.get(r["project_id"]), uid(r["user_id"])
        if proj and u:
            d.execute("INSERT INTO project_member (project_id, user_id) VALUES (%s,%s) "
                      "ON CONFLICT (project_id, user_id) DO NOTHING", (proj, u))
            pm_created += 1
    note("project_member", created=pm_created)

    # ── 8. salary_month / salary_day ──────────────────────────────────────────
    s.execute("SELECT id, salary, taken_salary, remaining_salary, user_id, date, deleted FROM salary_month")
    salary_month_map, skipped_sm = {}, []
    for r in s.fetchall():
        u = uid(r["user_id"])
        if not u:
            skipped_sm.append(r["id"])
            continue
        d.execute("INSERT INTO salary_month (salary, taken_salary, remaining_salary, user_id, date, deleted) "
                   "VALUES (%s,%s,%s,%s,%s,%s) RETURNING id",
                   (r["salary"], r["taken_salary"], r["remaining_salary"], u, r["date"], r["deleted"]))
        salary_month_map[r["id"]] = d.fetchone()["id"]
    note("salary_month", created=len(salary_month_map), skipped_no_user_match=skipped_sm)

    s.execute("SELECT id, salary_month_id, amount, user_id, date, payment_type, deleted FROM salary_day")
    sd_created, sd_skipped = 0, 0
    for r in s.fetchall():
        smid, u = salary_month_map.get(r["salary_month_id"]), uid(r["user_id"])
        if not smid or not u:
            sd_skipped += 1
            continue
        d.execute("INSERT INTO salary_day (salary_month_id, amount, user_id, date, payment_type, deleted) "
                   "VALUES (%s,%s,%s,%s,%s,%s)", (smid, r["amount"], u, r["date"], r["payment_type"], r["deleted"]))
        sd_created += 1
    note("salary_day", created=sd_created, skipped=sd_skipped)

    # ── 9. investment — additive (all-new rows, no dedup key available) ──────
    s.execute("SELECT id, amount, source, date, description, payment_type, location_id, branch_id, deleted, created_at "
              "FROM investment")
    inv_created = 0
    for r in s.fetchall():
        d.execute(
            "INSERT INTO investment (amount, source, date, description, payment_type, location_id, branch_id, deleted, created_at) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            (r["amount"], r["source"], r["date"], r["description"], r["payment_type"],
             r["location_id"], branch_map.get(r["branch_id"]) if r["branch_id"] else None,
             r["deleted"], r["created_at"]),
        )
        inv_created += 1
    note("investment", created=inv_created)

    note("dividend", created=0, reason="V1 has 0 rows")
    note("overhead_type", created=0, reason="V2 already has every V1 name")

    # ── 10. mission + its full child tree ─────────────────────────────────────
    s.execute("""SELECT id, title, final_sc, description, category, creator_id, executor_id,
                 reviewer_id, original_executor_id, redirected_by_id, is_redirected, redirected_at,
                 branch_id, branch_name, system_id, location_id, location_name, channel, project_id,
                 section_id, approval_status, approved_by_id, gennis_executor_id, gennis_executor_name,
                 gennis_reviewer_id, gennis_reviewer_name, turon_executor_id, turon_executor_name,
                 turon_reviewer_id, turon_reviewer_name, start_date, deadline, finish_date, approved_date,
                 status, kpi_weight, penalty_per_day, early_bonus_per_day, max_bonus, max_penalty,
                 delay_days, is_recurring, recurring_type, repeat_every, last_generated,
                 created_at, updated_at, deleted
                 FROM mission""")
    mission_map, skipped_missions = {}, 0
    for r in s.fetchall():
        if not uid(r["creator_id"]) or not uid(r["executor_id"]):
            skipped_missions += 1
            continue
        d.execute("""
            INSERT INTO mission
            (title, final_sc, description, category, creator_id, executor_id, reviewer_id,
             original_executor_id, redirected_by_id, is_redirected, redirected_at, branch_id,
             branch_name, system_id, location_id, location_name, channel, project_id, section_id,
             approval_status, approved_by_id, gennis_executor_id, gennis_executor_name,
             gennis_reviewer_id, gennis_reviewer_name, turon_executor_id, turon_executor_name,
             turon_reviewer_id, turon_reviewer_name, start_date, deadline, finish_date, approved_date,
             status, kpi_weight, penalty_per_day, early_bonus_per_day, max_bonus, max_penalty,
             delay_days, is_recurring, recurring_type, repeat_every, last_generated,
             created_at, updated_at, deleted)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                    %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING id
        """, (
            r["title"], r["final_sc"], r["description"], r["category"], uid(r["creator_id"]),
            uid(r["executor_id"]), uid(r["reviewer_id"]), uid(r["original_executor_id"]),
            uid(r["redirected_by_id"]), r["is_redirected"], r["redirected_at"],
            branch_map.get(r["branch_id"]) if r["branch_id"] else None, r["branch_name"],
            system_map.get(r["system_id"]) if r["system_id"] else None, r["location_id"], r["location_name"],
            r["channel"], project_map.get(r["project_id"]) if r["project_id"] else None,
            section_map.get(r["section_id"]) if r["section_id"] else None,
            r["approval_status"], uid(r["approved_by_id"]), r["gennis_executor_id"], r["gennis_executor_name"],
            r["gennis_reviewer_id"], r["gennis_reviewer_name"], r["turon_executor_id"], r["turon_executor_name"],
            r["turon_reviewer_id"], r["turon_reviewer_name"], r["start_date"], r["deadline"], r["finish_date"],
            r["approved_date"], r["status"], r["kpi_weight"], r["penalty_per_day"], r["early_bonus_per_day"],
            r["max_bonus"], r["max_penalty"], r["delay_days"], r["is_recurring"], r["recurring_type"],
            r["repeat_every"], r["last_generated"], r["created_at"], r["updated_at"], r["deleted"],
        ))
        mission_map[r["id"]] = d.fetchone()["id"]
    note("mission", created=len(mission_map), skipped_no_user_match=skipped_missions)

    def mid(v1_id):
        return mission_map.get(v1_id)

    s.execute("SELECT id, mission_id, title, is_done, \"order\", deleted, executor_id, creator_id, "
              "description, status, start_date, deadline, finish_date, created_at, updated_at FROM mission_subtask")
    subtask_map, skipped_subtasks = {}, 0
    for r in s.fetchall():
        m = mid(r["mission_id"])
        if not m:
            skipped_subtasks += 1
            continue
        d.execute("""
            INSERT INTO mission_subtask
            (mission_id, creator_id, executor_id, title, description, is_done, "order",
             status, start_date, deadline, finish_date, created_at, updated_at, deleted)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
        """, (m, uid(r["creator_id"]), uid(r["executor_id"]), r["title"], r["description"], r["is_done"],
              r["order"], r["status"], r["start_date"], r["deadline"], r["finish_date"],
              r["created_at"], r["updated_at"], r["deleted"]))
        subtask_map[r["id"]] = d.fetchone()["id"]
    note("mission_subtask", created=len(subtask_map), skipped_no_mission_match=skipped_subtasks)

    s.execute("SELECT mission_id, file, uploaded_at, note, deleted, creator_name FROM mission_attachment")
    n = 0
    for r in s.fetchall():
        m = mid(r["mission_id"])
        if not m:
            continue
        d.execute("INSERT INTO mission_attachment (mission_id, file, uploaded_at, note, creator_name, deleted) "
                  "VALUES (%s,%s,%s,%s,%s,%s)", (m, r["file"], r["uploaded_at"], r["note"], r["creator_name"], r["deleted"]))
        n += 1
    note("mission_attachment", created=n)

    s.execute("SELECT mission_id, user_id, text, attachment, created_at, deleted, creator_name FROM mission_comment")
    n = 0
    for r in s.fetchall():
        m = mid(r["mission_id"])
        if not m:
            continue
        d.execute("INSERT INTO mission_comment (mission_id, user_id, text, attachment, creator_name, created_at, deleted) "
                  "VALUES (%s,%s,%s,%s,%s,%s,%s)",
                  (m, uid(r["user_id"]), r["text"], r["attachment"], r["creator_name"], r["created_at"], r["deleted"]))
        n += 1
    note("mission_comment", created=n)

    s.execute("SELECT mission_id, file, comment, created_at, deleted, creator_name FROM mission_proof")
    n = 0
    for r in s.fetchall():
        m = mid(r["mission_id"])
        if not m:
            continue
        d.execute("INSERT INTO mission_proof (mission_id, file, comment, creator_name, created_at, deleted) "
                  "VALUES (%s,%s,%s,%s,%s,%s)", (m, r["file"], r["comment"], r["creator_name"], r["created_at"], r["deleted"]))
        n += 1
    note("mission_proof", created=n)

    s.execute("""SELECT mission_id, changed_by_id, executor_id, reviewer_id, gennis_executor_id,
                 gennis_executor_name, gennis_reviewer_id, gennis_reviewer_name, turon_executor_id,
                 turon_executor_name, turon_reviewer_id, turon_reviewer_name, note, created_at
                 FROM mission_history""")
    n = 0
    for r in s.fetchall():
        m = mid(r["mission_id"])
        if not m:
            continue
        d.execute("""
            INSERT INTO mission_history
            (mission_id, changed_by_id, executor_id, reviewer_id, gennis_executor_id, gennis_executor_name,
             gennis_reviewer_id, gennis_reviewer_name, turon_executor_id, turon_executor_name,
             turon_reviewer_id, turon_reviewer_name, note, created_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (m, uid(r["changed_by_id"]), uid(r["executor_id"]), uid(r["reviewer_id"]),
              r["gennis_executor_id"], r["gennis_executor_name"], r["gennis_reviewer_id"], r["gennis_reviewer_name"],
              r["turon_executor_id"], r["turon_executor_name"], r["turon_reviewer_id"], r["turon_reviewer_name"],
              r["note"], r["created_at"]))
        n += 1
    note("mission_history", created=n)

    def stid(v1_id):
        return subtask_map.get(v1_id)

    s.execute("SELECT subtask_id, file, uploaded_at, note, creator_name, deleted FROM mission_subtask_attachment")
    n = 0
    for r in s.fetchall():
        st = stid(r["subtask_id"])
        if not st:
            continue
        d.execute("INSERT INTO mission_subtask_attachment (subtask_id, file, uploaded_at, note, creator_name, deleted) "
                  "VALUES (%s,%s,%s,%s,%s,%s)", (st, r["file"], r["uploaded_at"], r["note"], r["creator_name"], r["deleted"]))
        n += 1
    note("mission_subtask_attachment", created=n)

    s.execute("SELECT subtask_id, user_id, text, attachment, creator_name, created_at, deleted FROM mission_subtask_comment")
    n = 0
    for r in s.fetchall():
        st = stid(r["subtask_id"])
        if not st:
            continue
        d.execute("INSERT INTO mission_subtask_comment (subtask_id, user_id, text, attachment, creator_name, created_at, deleted) "
                  "VALUES (%s,%s,%s,%s,%s,%s,%s)",
                  (st, uid(r["user_id"]), r["text"], r["attachment"], r["creator_name"], r["created_at"], r["deleted"]))
        n += 1
    note("mission_subtask_comment", created=n)

    s.execute("SELECT subtask_id, file, comment, creator_name, created_at, deleted FROM mission_subtask_proof")
    n = 0
    for r in s.fetchall():
        st = stid(r["subtask_id"])
        if not st:
            continue
        d.execute("INSERT INTO mission_subtask_proof (subtask_id, file, comment, creator_name, created_at, deleted) "
                  "VALUES (%s,%s,%s,%s,%s,%s)", (st, r["file"], r["comment"], r["creator_name"], r["created_at"], r["deleted"]))
        n += 1
    note("mission_subtask_proof", created=n)

    note("api_log", created=0, reason="skipped deliberately — 45,677 log rows, not business data")

    # ── report ─────────────────────────────────────────────────────────────────
    log(f"\n{BOLD}{'LIVE RUN' if live else 'DRY RUN'} — gennis_management (V1) -> management (V2){RESET}\n")
    for table, kv in stats.items():
        parts = ", ".join(f"{k}={v if not isinstance(v, list) else len(v)}" for k, v in kv.items())
        log(f"  {CYAN}{table:28s}{RESET} {parts}")

    if skipped_no_email:
        log(f"\n{YELLOW}Users skipped (no email, cannot match/create safely):{RESET}")
        for uid_, name, surname in skipped_no_email:
            log(f"    v1 id={uid_}  {name} {surname}")

    if live:
        dst.commit()
        log(f"\n{GREEN}COMMITTED.{RESET}")
    else:
        dst.rollback()
        log(f"\n{YELLOW}Dry run — nothing written (rolled back). Re-run with --live to commit.{RESET}")

    s.close()
    d.close()
    src.close()
    dst.close()


if __name__ == "__main__":
    main()
