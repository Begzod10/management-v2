# ── Database shortcuts ────────────────────────────────────────────────────────
#
#  Two separate Alembic chains:
#    alembic/     → gennis_management DB  (DATABASE_URL)
#    alembic_v2/  → management-v2 DB     (DATABASE_URL_V2)
#
#  Always use these make targets instead of running alembic directly.
# ─────────────────────────────────────────────────────────────────────────────

# ── management-v2 DB (gennis tables owned by gennis-v2) ──────────────────────

v2-upgrade:
	alembic -c alembic_v2.ini upgrade head

v2-downgrade:
	alembic -c alembic_v2.ini downgrade -1

v2-current:
	alembic -c alembic_v2.ini current

v2-history:
	alembic -c alembic_v2.ini history

v2-check:
	alembic -c alembic_v2.ini check

v2-migrate:
	@read -p "Migration message: " msg; \
	alembic -c alembic_v2.ini revision --autogenerate -m "$$msg"

v2-merge:
	alembic -c alembic_v2.ini merge heads -m "merge"

# ── gennis_management DB (main management-v2 app tables) ─────────────────────

upgrade:
	alembic upgrade head

downgrade:
	alembic downgrade -1

current:
	alembic current

history:
	alembic history

migrate:
	@read -p "Migration message: " msg; \
	alembic revision --autogenerate -m "$$msg"

merge:
	alembic merge heads -m "merge"

.PHONY: upgrade downgrade current history migrate merge \
        v2-upgrade v2-downgrade v2-current v2-history v2-check v2-migrate v2-merge
