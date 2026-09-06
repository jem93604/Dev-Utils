import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_token_sub
from app.models.entities import User

bearer_scheme = HTTPBearer(auto_error=False)


def _default_user(db: Session) -> User:
    user = db.query(User).filter(User.email == settings.default_user_email).first()
    if user:
        return user
    user = User(email=settings.default_user_email, display_name="Local User")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_current_user(
    db: Session = Depends(get_db),
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> User:
    """Single-user mode (AUTH_ENABLED=false) returns the seeded default user.
    Otherwise validates the Bearer JWT and returns the active user."""
    if not settings.auth_enabled:
        return _default_user(db)
    if not creds or creds.scheme.lower() != "bearer":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    sub = decode_token_sub(creds.credentials, settings.jwt_secret, settings.jwt_algorithm)
    if not sub:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    try:
        uid = uuid.UUID(sub)
    except ValueError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token subject")
    user = db.get(User, uid)
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account inactive or deleted")
    return user


def get_current_user_id(
    db: Session = Depends(get_db),
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> uuid.UUID:
    """Auth-aware user resolution used by every router. Single-user mode
    (AUTH_ENABLED=false) returns the seeded default user; otherwise the id
    comes from the validated Bearer JWT."""
    return get_current_user(db, creds).id


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin only")
    return user
