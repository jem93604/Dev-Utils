"""Create (or promote) an admin user non-interactively.

Usage:
  PYTHONPATH=. uv run python scripts/create_admin.py --email admin@x.com --password 'secret...' [--name Admin]

First admin also inherits the legacy single-user content. Safe to re-run
(promotes + resets password of an existing account).
"""
import argparse
import sys

from app.api.v1.auth import adopt_legacy_content
from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.models.entities import User
from app.schemas.auth import UserCreate


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--email", required=True)
    ap.add_argument("--password", required=True)
    ap.add_argument("--name", default="")
    args = ap.parse_args()

    try:
        data = UserCreate(email=args.email, password=args.password, display_name=args.name)
    except Exception as e:
        print(f"Invalid input: {e}")
        return 2

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == data.email).first()
        if user:
            user.password_hash = hash_password(data.password)
            if data.display_name:
                user.display_name = data.display_name
            user.is_active = True
            user.is_admin = True
            action = "updated"
        else:
            user = User(
                email=data.email,
                password_hash=hash_password(data.password),
                display_name=data.display_name or data.email.split("@")[0],
                is_admin=True,
            )
            db.add(user)
            db.flush()
            action = "created"
        adopt_legacy_content(db, user.id)
        db.commit()
        print(f"Admin {action}: {user.email} (id={user.id})")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
