"""Admin-facing audit and error logs.

- GET /audit-logs — business actions ("which admin created what payment for
  whom"), written by app.services.audit.log_action from the create/update/
  delete endpoints that call it (currently dividends, investments).
- GET /error-logs — request failures (unhandled exceptions and 4xx/5xx
  responses), written by the middleware in app/main.py.
"""

from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_roles
from app.models import AuditLog, ErrorLog

router = APIRouter(tags=["Logs"], dependencies=[Depends(require_roles("owner", "manager", "admin"))])


class AuditLogOut(BaseModel):
    id: int
    actor_id: Optional[int]
    actor_name: Optional[str]
    action: str
    entity_type: str
    entity_id: int
    target_label: Optional[str]
    amount: Optional[int]
    details: Optional[dict]
    created_at: datetime

    model_config = {"from_attributes": True}


class ErrorLogOut(BaseModel):
    id: int
    method: str
    path: str
    status_code: Optional[int]
    user_id: Optional[int]
    error_type: Optional[str]
    error_message: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/audit-logs", response_model=List[AuditLogOut])
def list_audit_logs(
    actor_id: Optional[int] = None,
    entity_type: Optional[str] = None,
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    offset: int = 0,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(AuditLog)
    if actor_id:
        q = q.filter(AuditLog.actor_id == actor_id)
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if from_date:
        q = q.filter(AuditLog.created_at >= from_date)
    if to_date:
        q = q.filter(AuditLog.created_at < to_date)
    return q.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()


@router.get("/error-logs", response_model=List[ErrorLogOut])
def list_error_logs(
    status_code: Optional[int] = None,
    path: Optional[str] = None,
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    offset: int = 0,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(ErrorLog)
    if status_code:
        q = q.filter(ErrorLog.status_code == status_code)
    if path:
        q = q.filter(ErrorLog.path.contains(path))
    if from_date:
        q = q.filter(ErrorLog.created_at >= from_date)
    if to_date:
        q = q.filter(ErrorLog.created_at < to_date)
    return q.order_by(ErrorLog.created_at.desc()).offset(offset).limit(limit).all()
