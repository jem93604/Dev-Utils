"""Auth stub: disabled in V1 (AUTH_ENABLED=false). Schema is multi-user ready."""

from passlib.context import CryptContext
from jose import jwt

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(pw: str) -> str:
    return pwd_ctx.hash(pw)


def verify_password(pw: str, hashed: str) -> bool:
    return pwd_ctx.verify(pw, hashed)


def create_token(sub: str, secret: str, algorithm: str = "HS256") -> str:
    return jwt.encode({"sub": sub}, secret, algorithm=algorithm)
