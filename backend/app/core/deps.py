import uuid
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.entities import User


def get_current_user_id(db: Session) -> uuid.UUID:
    """V1 single-user mode: return seeded default user. Later: parse JWT."""
    if not settings.auth_enabled:
        user = db.query(User).filter(User.email == settings.default_user_email).first()
        if user:
            return user.id
        user = User(email=settings.default_user_email, display_name="Local User")
        db.add(user)
        db.commit()
        db.refresh(user)
        return user.id
    raise NotImplementedError("JWT auth not enabled yet (Phase: multi-user)")
