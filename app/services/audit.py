import json
from datetime import date, datetime
from typing import Optional
from sqlalchemy.orm import Session

from app.models import AuditLog, User


def _json_safe(value):
    """Coerce a details dict into something the JSONB column can store —
    date/datetime aren't JSON-serializable by psycopg2's default encoder."""
    return json.loads(json.dumps(value, default=lambda v: v.isoformat() if isinstance(v, (date, datetime)) else str(v)))


def log_action(
    db: Session,
    actor: Optional[User],
    action: str,
    entity_type: str,
    entity_id: int,
    target_label: Optional[str] = None,
    amount: Optional[int] = None,
    details: Optional[dict] = None,
) -> None:
    """Record a business-action audit entry. Never raises — a logging
    failure must not break the request it's logging."""
    try:
        db.add(AuditLog(
            actor_id=actor.id if actor else None,
            actor_name=f"{actor.name} {actor.surname}".strip() if actor else None,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            target_label=target_label,
            amount=amount,
            details=_json_safe(details) if details is not None else None,
        ))
        db.commit()
    except Exception:
        db.rollback()
