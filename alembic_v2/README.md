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

Always use `-c alembic_v2.ini` to target the correct database.

```bash
# Apply all pending migrations
alembic -c alembic_v2.ini upgrade head

# Check current revision in the DB
alembic -c alembic_v2.ini current

# Show migration history
alembic -c alembic_v2.ini history

# Check for schema drift (safe, read-only)
alembic -c alembic_v2.ini check

# Roll back one migration
alembic -c alembic_v2.ini downgrade -1
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

## How gennis-v2 Uses These Tables

gennis-v2 (`apps/backend/`) connects to the same `management-v2` database and
reads/writes these tables via its own SQLAlchemy models in `app/models/`.
It has **no** alembic setup — schema changes always come from here.
