from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.core.config import settings


class Base(DeclarativeBase):
    pass


engine_kwargs: dict = {"pool_pre_ping": True}
if settings.database_url.startswith("sqlite"):
    engine_kwargs = {"connect_args": {"check_same_thread": False}}
engine = create_engine(settings.database_url, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_columns():
    """Lightweight in-place migrations for deployments without Alembic.

    create_all() creates missing tables but never adds columns to existing
    ones, so each (table, column, ddl) pair here is checked and added once.
    """
    from sqlalchemy import inspect, text

    pending = [
        ("notes", "sort_order", "ALTER TABLE notes ADD COLUMN sort_order INTEGER DEFAULT 0"),
        ("users", "is_admin", "ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE"),
    ]
    with engine.begin() as conn:
        for table, column, ddl in pending:
            if table not in inspect(conn).get_table_names():
                continue
            cols = {c["name"] for c in inspect(conn).get_columns(table)}
            if column not in cols:
                conn.execute(text(ddl))
