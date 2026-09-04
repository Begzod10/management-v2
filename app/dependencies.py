from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.core.security import decode_access_token
from app import models

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
    except ValueError:
        raise credentials_exception

    sub: str = payload.get("sub")
    if not sub:
        raise credentials_exception

    user = (
        db.query(models.User)
        .options(joinedload(models.User.extra_roles))
        .filter(
            (models.User.email == sub) | (models.User.username == sub)
        )
        .first()
    )
    if not user:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")
    return user


def has_role(user: models.User, *roles: str) -> bool:
    """Return True if the user holds any of the given roles."""
    user_roles = {user.role} | {r.role for r in (user.extra_roles or [])}
    return bool(user_roles & set(roles))


def require_roles(*roles: str):
    """FastAPI dependency that raises 403 if user has none of the given roles."""
    def _check(user: models.User = Depends(get_current_user)) -> models.User:
        if not has_role(user, *roles):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user
    return _check


# Mirrors frontend/src/lib/permissions.ts::ROLE_RANK — keep the two in sync
# if either changes. Only used by promote_to_manager below, never for
# auth/permission checks (those stay on has_role/require_roles above).
ROLE_RANK = {
    "owner": 7,
    "admin": 6,
    "director": 5,
    "manager": 4,
    "hr": 3,
    "accountant": 2,
    "spiritualist": 2,
    "employee": 1,
    "user": 0,
    "volunteer": -1,
}


def promote_to_manager(user: models.User) -> None:
    """Set user.role = "manager" when they're made a project/section
    manager — unless they already outrank a manager (owner/admin/director),
    in which case this is a lateral assignment for them, not a promotion,
    and must not demote their actual role."""
    if ROLE_RANK.get(user.role, 0) > ROLE_RANK["manager"]:
        return
    user.role = "manager"
