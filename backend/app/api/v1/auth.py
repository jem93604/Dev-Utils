"""Email+password auth with JWT access tokens.

- POST /auth/register: open signup (unless ALLOW_SIGNUP=false). The first
  user ever becomes admin and inherits the legacy single-user content.
- POST /auth/login: returns a Bearer token (JWT, JWT_EXPIRE_DAYS).
- GET /auth/me, GET /auth/status.
- Admin: GET /auth/users, PATCH /auth/users/{id} (activate/deactivate).
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.core.rate_limit import check_rate_limit
from app.core.security import create_token, hash_password, verify_password
from app.models.entities import (
    InputHistory, Note, Pin, Query, Script, Section, User, Version,
)
from app.schemas.auth import LoginIn, TokenOut, UserAdminUpdate, UserCreate, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


def _auth_rate_limit(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(f"auth:{ip}", settings.auth_rate_limit_per_min):
        raise HTTPException(429, "Too many auth attempts — try again in a minute")


def _token_for(user: User) -> TokenOut:
    return TokenOut(
        access_token=create_token(
            str(user.id), settings.jwt_secret, settings.jwt_expire_days, settings.jwt_algorithm
        ),
        user=UserOut.model_validate(user),
    )


def adopt_legacy_content(db: Session, new_owner_id: uuid.UUID) -> None:
    """Move all rows owned by the legacy default user to the new admin."""
    legacy = db.query(User).filter(User.email == settings.default_user_email).first()
    if not legacy or legacy.id == new_owner_id:
        return
    for model, col in (
        (Section, "owner_id"), (Query, "owner_id"), (Note, "owner_id"),
        (Script, "owner_id"), (Version, "owner_id"), (Pin, "user_id"),
        (InputHistory, "owner_id"),
    ):
        db.query(model).filter(getattr(model, col) == legacy.id).update({col: new_owner_id})
    db.delete(legacy)


@router.get("/status")
def auth_status() -> dict:
    return {"auth_enabled": settings.auth_enabled, "allow_signup": settings.allow_signup}


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, request: Request, db: Session = Depends(get_db)):
    _auth_rate_limit(request)
    if not settings.auth_enabled:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Auth is disabled")
    existing = db.query(User).filter(User.email == payload.email).first()
    legacy = db.query(User).filter(User.email == settings.default_user_email).first()
    is_legacy_email = legacy is not None and payload.email == legacy.email

    first_ever = db.query(User).filter(User.is_admin.is_(True)).count() == 0
    if not first_ever and not settings.allow_signup:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Registration is closed")

    if existing and not is_legacy_email:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    if is_legacy_email:
        # Upgrade the legacy row in place: set password, make admin if first.
        user = legacy
        user.password_hash = hash_password(payload.password)
        user.display_name = payload.display_name.strip() or user.display_name
        if first_ever:
            user.is_admin = True
    else:
        user = User(
            email=payload.email,
            password_hash=hash_password(payload.password),
            display_name=payload.display_name.strip() or payload.email.split("@")[0],
            is_admin=first_ever,
        )
        db.add(user)
        db.flush()
        if first_ever:
            adopt_legacy_content(db, user.id)
    db.commit()
    db.refresh(user)
    return _token_for(user)


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, request: Request, db: Session = Depends(get_db)):
    _auth_rate_limit(request)
    if not settings.auth_enabled:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Auth is disabled")
    user = db.query(User).filter(User.email == payload.email.strip().lower()).first()
    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account deactivated")
    return _token_for(user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.get("/users", response_model=list[UserOut])
def list_users(_admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.query(User).order_by(User.created_at.asc()).all()


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: uuid.UUID,
    payload: UserAdminUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if payload.is_active is not None:
        if user.id == admin.id and payload.is_active is False:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot deactivate yourself")
        user.is_active = payload.is_active
    if payload.display_name is not None:
        user.display_name = payload.display_name.strip() or user.display_name
    db.commit()
    db.refresh(user)
    return user
