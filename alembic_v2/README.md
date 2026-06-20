# alembic_v2 — Migrations for management-v2 Database

## Overview

This is a **separate** Alembic setup from the main `alembic/` directory.

| | `alembic/` | `alembic_v2/` |
|---|---|---|
| Config file | `alembic.ini` | `alembic_v2.ini` |
| Target database | `gennis_management` (`DATABASE_URL`) | `management-v2` (`DATABASE_URL_V2`) |
| Owns | management-v2 app tables | gennis-v2 tables (payments, attendance, credit) |

They are completely independent — different databases, different `alembic_version` tables, no conflicts.

---

## Prerequisites

`.env` must have:
```
DATABASE_URL_V2=postgresql://postgres:<password>@localhost:5432/management-v2
```

---

## Common Commands

Use `make` targets instead of running `alembic` directly — they ensure the correct `-c` flag is always used.

```bash
make v2-upgrade      # apply all pending migrations
make v2-current      # show current revision
make v2-history      # show full migration history
make v2-check        # check for schema drift (read-only, safe)
make v2-downgrade    # roll back one migration
make v2-migrate      # autogenerate a new migration (prompts for message)
make v2-merge        # resolve multiple heads (see Team Workflow below)
```

Raw alembic equivalents (if make is not available):
```bash
alembic -c alembic_v2.ini upgrade head
alembic -c alembic_v2.ini revision --autogenerate -m "my change"
alembic -c alembic_v2.ini merge heads -m "merge"
```

---

## Adding a New Table

1. **Define the model** in `app/gennis_v2_models.py` extending `BaseV2`:

```python
class MyNewTable(BaseV2):
    __tablename__ = "my_new_table"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    name       = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
```

2. **Autogenerate the migration**:

```bash
alembic -c alembic_v2.ini revision --autogenerate -m "add my_new_table"
```

3. **Review** the generated file in `alembic_v2/versions/` — always check before applying.

4. **Apply**:

```bash
alembic -c alembic_v2.ini upgrade head
```

---

## Why `include_object` Filter?

The `management-v2` database contains many tables that are synced from gennis
(e.g. `gennis_group`, `gennis_student`, `mission`, etc.) that are **not** owned
by this migration chain. Without the filter, autogenerate would wrongly detect
them as tables to be dropped.

`_include_object` in `env.py` restricts autogenerate to only the tables
defined in `BaseV2` (`app/gennis_v2_models.py`).

---

## Owned Tables

| Table | Model | Description |
|---|---|---|
| `gennis_student_payment` | `GennisStudentPayment` | Payment records per student |
| `gennis_attendance_history_student` | `GennisAttendanceHistoryStudent` | Monthly debt/payment tracking per student per group |
| `gennis_student_credit` | `GennisStudentCredit` | Credit balance (overpayment) per student |

---

## Team Workflow — Avoiding Migration Conflicts

When two developers create a migration from the same head simultaneously,
alembic ends up with two heads and `upgrade head` fails.

**How to detect:**
```bash
make v2-history   # shows branched history with multiple (head) markers
```

**How to fix:**
```bash
make v2-merge     # creates a merge migration joining both heads
make v2-upgrade   # apply the merge + any pending migrations
git add alembic_v2/versions/
git commit -m "chore(migrations): merge heads"
```

**How to prevent:**
- Always `git pull` before creating a new migration
- Run `make v2-current` to confirm you're on the latest head
- Coordinate with teammates when both need schema changes at the same time

---

## How gennis-v2 Uses These Tables

gennis-v2 (`apps/backend/`) connects to the same `management-v2` database and
reads/writes these tables via its own SQLAlchemy models in `app/models/`.
It has **no** alembic setup — schema changes always come from here.
