"""Auth: bcrypt passwords + JWT access tokens."""

from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(pw: str) -> str:
    return pwd_ctx.hash(pw)


def verify_password(pw: str, hashed: str) -> bool:
    return pwd_ctx.verify(pw, hashed)


def create_token(sub: str, secret: str, expires_days: int, algorithm: str = "HS256") -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=expires_days)
    return jwt.encode({"sub": sub, "exp": exp}, secret, algorithm=algorithm)


def decode_token_sub(token: str, secret: str, algorithm: str = "HS256") -> str | None:
    """Return the subject UUID string, or None if invalid/expired."""
    try:
        return str(jwt.decode(token, secret, algorithms=[algorithm]).get("sub"))
    except JWTError:
        return None
