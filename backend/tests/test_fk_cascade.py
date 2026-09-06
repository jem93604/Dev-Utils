"""FK enforcement: hard-deleting a user must cascade to their prefs (and pins),
leaving no orphan rows. SQLite enforces FKs only with PRAGMA foreign_keys=ON."""
from app.models.entities import User, UserPref


def test_user_delete_cascades_prefs(db_session):
    u = User(email="gone@x.com", display_name="Gone")
    db_session.add(u)
    db_session.flush()
    db_session.add(UserPref(user_id=u.id, key="util_order", value=["hash"]))
    db_session.commit()

    assert db_session.query(UserPref).filter_by(user_id=u.id).count() == 1
    db_session.delete(u)
    db_session.commit()
    assert db_session.query(UserPref).filter_by(user_id=u.id).count() == 0


def test_sqlite_enforces_foreign_keys(db_session):
    if db_session.bind.dialect.name != "sqlite":
        return
    from sqlalchemy import text
    assert db_session.execute(text("PRAGMA foreign_keys")).scalar() == 1
