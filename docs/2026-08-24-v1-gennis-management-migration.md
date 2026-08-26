# V1 (`gennis_management`) → V2 (`management`) Data Migration — 2026-08-24

`gennis_management` is the predecessor app's own database — same host, a
separate Postgres instance running directly on the box (not the `management_db`
Docker container), reachable at `postgresql://postgres:***@localhost:5432/gennis_management`
from the host, or `host.docker.internal:5432` from inside a container. Its
codebase lives locally at `~/PycharmProjects/gennis_management` (the direct
ancestor of this repo — same schema for the tables covered here).

This documents the one-time migration of its data into this repo's own
`management` database, so anyone continuing the work — or auditing it — has
the reasoning and the exact script, not just the end state.

## Why this wasn't a plain `INSERT ... SELECT`

V2's `user` table is **not** the same id-space as V1's. V2's `user` is the
unified identity table for the whole platform now — gennis students/teachers,
turon, and this task-management domain all share it (18,394 rows at migration
time). V1 only ever had its own small internal-staff `user` table (43 rows).
**`id=2` in V1 and `id=2` in V2 are two different people** — confirmed
directly (V1 id=2 is "ArchAnomuru Mirhamidov"; V2 id=2 is "Admin Gennis").

Every V1 row carrying a `user_id` (or any other V1-assigned id a child table
points at — `mission_id`, `section_id`, `project_id`, `branch_id`,
`salary_month_id`, `subtask_id`, ...) had to be re-pointed through a lookup
built during the migration run. Copying V1's raw ids as-is would have silently
misattributed missions, salary rows, and comments to the wrong person.

## User matching strategy

By **email**, case-insensitive, exact match:

- V1 user's email already exists in V2 → map to that V2 id (no new row).
- V1 user's email doesn't exist in V2 → create a new V2 `user` row, capture
  its new id.
- V1 user has **no email at all** → skipped (can't be matched or safely
  deduplicated). None hit this case in practice — all 43 V1 users had one.

3 of the 43 already existed in V2 (matched by email); 40 new `user` rows were
created.

**Known gap**: for the 3 already-matched users, only their *id* was mapped —
none of their other V1 field values (`telegram_id`, `role`, `salary`,
`job_id`, `is_active`, ...) were copied onto the existing V2 row. This bit us
once already: 2 of the 13 V1 users with a Telegram link
(`isardor859@gmail.com`, `shahzodomonboyev0@gmail.com`) matched an existing
V2 user and so kept `telegram_id = NULL` post-migration; manually backfilled
after the fact. **If you find another V1 field on an already-matched user
that's missing/stale in V2, this is why — check the other 41 V1 columns
too before assuming it's a fresh bug.**

## What actually moved

Migrated (dependency order, matching the FK chain):

| Table | V1 rows | Notes |
|---|---:|---|
| `user` | 43 | 40 created, 3 matched by email |
| `job` | 1 | additive by name (`Bo'lim boshlig'i` was the only one missing) |
| `branch` | 9 | V2 had 0 — straight insert |
| `section` | 8 | V2 had 0; `leader_id` remapped |
| `project` | 8 | V2 had 0; `manager_id` remapped |
| `section_member` / `project_member` | 9 / 20 | both FKs remapped |
| `salary_month` / `salary_day` | 76 / 1 | `user_id` (+ `salary_month_id`) remapped |
| `investment` | 15 | additive, all `source='gennis'` |
| `mission` + full child tree | 249 mission rows, ~1,200 total | `mission_subtask` (107), `mission_attachment` (28), `mission_comment` (101), `mission_proof` (205), `mission_history` (522), `mission_subtask_attachment/comment/proof` (2/5/7) |

**Zero rows were skipped** on any table — every V1 user matched or was
created, so no mission/salary/section/project row lost its owner.

Deliberately **not** migrated:

- **`api_log`** — 45,677 rows, pure request/activity log, not business data.
- **`dividend`**, `mission_tag`, `notification`, `mobile_telegram_link`,
  `user_role`, `user_skill`, `branch_loan`, `tag` — V1 had 0 rows in all of
  these; nothing existed to move.
- **`overhead_type`** — V2 already had every V1 name present (with room to
  spare, several times over) — a genuine superset already, additive-merge
  would have found nothing new.
- **`system_model`** — matched 1:1 by name already (`Gennis`→1, `Turon`→2 on
  both sides, coincidentally even the same ids) — no rows to create, just a
  lookup.

`tvh_management` (a separate, much smaller Postgres database on the same
host — same schema, 6 missions / 5 users, looks like dev/test data) was
found during this work but **deliberately excluded** per explicit
instruction — only `gennis_management` was in scope.

## The script

[`scripts/migrations/migrate_v1_gennis_management.py`](../scripts/migrations/migrate_v1_gennis_management.py) —
run from inside the `management_app` container (`docker cp` it in, then
`python3 migrate_v1_gennis_management.py [--live]`). It's idempotent-ish in
spirit (re-running would re-match existing users/jobs by email/name and only
create genuinely new rows there) but **not** for the entity tables further
down the chain (`branch`, `section`, `project`, `mission`, ...) — those have
no dedup key against V1 ids, so re-running live after a successful live run
would duplicate every mission etc. Don't re-run `--live` against the same
V1 source twice. Key design points, if adapting for a different source db:

1. **Always dry-runs correctly**: every INSERT executes unconditionally
   inside a single transaction; `--live` is the *only* thing that decides
   `commit()` vs `rollback()` at the very end. This guarantees the dry-run's
   report is exactly what a live run would do — not a separate, easier-to-get-wrong
   code path that skips writes and tries to *predict* ids. (Earlier draft got
   this wrong: gating the `INSERT`s themselves behind `if live` meant the
   dry-run's downstream tables — anything needing `mission_map`, `section_map`,
   etc. — always reported near-zero, since those maps are only populated by
   the (skipped) inserts. Fixed before running for real.)
2. Backup first: `pg_dump -Fc` of `management` before the `--live` run.
   Saved at `/root/backups/management_pre_v1_migration_*.dump` on the
   production host.
3. Id maps are plain Python dicts built table-by-table in dependency order
   (`system_map`, `job_map`, `user_map`, `branch_map`, `section_map`,
   `project_map`, `salary_month_map`, `mission_map`, `subtask_map`), each fed
   by the previous table's inserts before the next table's rows need them.

## Investment / dividend / branch_loan — architecture note

This repo's own `investments.py` / `dividends.py` / `branch_loans.py`
routers read from **this repo's own `management` DB tables**
(`investment`, `dividend`, `branch_loan`) — that's the single source of
truth the frontend and the API both use.

Those same routers *also* push a mirrored copy out to the old, separate
`gennis` and `turon` Postgres databases on create/update/delete
(`_sync_create`/`_sync_update`/`_sync_delete` in `investments.py`, writing to
`GennisInvestment`/`TuronInvestment` — tables named `management_investment`
in each of those two other databases, keyed by `management_id`).

**That mirror is legacy and not read by anything live.** gennis-v2 and
turon-v2 (the actual current backends) both read directly from this
repo's own `management` DB now — same pattern as everything else migrated
this session (`MgmtInvestment`/`MgmtDividend` external models in gennis-v2,
pointed straight at `management.investment`/`management.dividend`).
Confirmed explicitly before closing this out: **the 15 migrated investment
rows did not need to be (and were not) backfilled into `gennis.management_investment`**
— nothing reads that table. If that mirror write-through is ever revisited
(e.g. to remove the dead code, or because something *does* turn out to
depend on it), start by grepping both gennis-v2 and turon-v2 for any
consumer of `gennis.management_investment` / `turon.management_investment`
/ `gennis.branch_loan` / `turon.branch_branchloan` — there wasn't one at the
time of writing this.

## Verification performed

- Row counts before/after on every touched table matched the dry-run's
  predicted counts exactly.
- Spot-checked `mission.creator_id`/`executor_id` → `user.email` on the 5
  most recent migrated missions — all resolved to the correct V1 person
  (e.g. `rimefara22@gmail.com` = Begzod Jumaniyozov, matching V1's own data),
  confirming the id remap was correct, not just present.
- Cross-checked all 13 V1 users with a non-null `telegram_id` against the
  post-migration V2 `user` rows — caught and fixed the 2 already-matched-user
  gap described above.
