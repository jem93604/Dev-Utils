"""Auth tests: registration, login, isolation, admin controls.

Runs with AUTH_ENABLED=true (monkeypatched); the legacy suite keeps the
single-user default. Each test gets a fresh isolated database.
"""
import pytest

from app.core.config import settings
from app.core.security import create_token
from app.models.entities import Note, User


@pytest.fixture()
def auth_on(monkeypatch):
    monkeypatch.setattr(settings, "auth_enabled", True)
    monkeypatch.setattr(settings, "allow_signup", True)
    monkeypatch.setattr(settings, "jwt_secret", "test-secret")
    monkeypatch.setattr(settings, "jwt_expire_days", 7)


def register(client, email="admin@x.com", password="password123", name="Admin"):
    r = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "display_name": name},
    )
    assert r.status_code == 201, r.text
    return r.json()


def auth_h(token):
    return {"Authorization": f"Bearer {token}"}


def test_register_first_user_becomes_admin(client, auth_on):
    body = register(client)
    assert body["user"]["is_admin"] is True
    assert body["user"]["email"] == "admin@x.com"
    assert body["token_type"] == "bearer"

    me = client.get("/api/v1/auth/me", headers=auth_h(body["access_token"]))
    assert me.status_code == 200
    assert me.json()["email"] == "admin@x.com"


def test_register_validation(client, auth_on):
    assert client.post("/api/v1/auth/register", json={"email": "bad", "password": "password123"}).status_code == 422
    assert client.post("/api/v1/auth/register", json={"email": "a@b.com", "password": "short"}).status_code == 422
    register(client, email="dup@x.com")
    r = client.post("/api/v1/auth/register", json={"email": "dup@x.com", "password": "password123"})
    assert r.status_code == 409


def test_login_flow(client, auth_on):
    register(client, email="admin0@x.com")
    register(client, email="u@x.com", password="correct-horse")
    ok = client.post("/api/v1/auth/login", json={"email": "u@x.com", "password": "correct-horse"})
    assert ok.status_code == 200
    assert ok.json()["user"]["is_admin"] is False

    bad = client.post("/api/v1/auth/login", json={"email": "u@x.com", "password": "wrong"})
    assert bad.status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": "nobody@x.com", "password": "whatever123"}).status_code == 401


def test_unauthenticated_rejected(client, auth_on):
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.get("/api/v1/notes").status_code == 401
    assert client.get("/api/v1/auth/me", headers=auth_h("garbage")).status_code == 401
    expired = create_token("00000000-0000-0000-0000-000000000000", "test-secret", -1)
    assert client.get("/api/v1/auth/me", headers=auth_h(expired)).status_code == 401


def test_users_are_isolated(client, auth_on):
    a = register(client, email="a@x.com")
    b = register(client, email="b@x.com")
    assert b["user"]["is_admin"] is False

    n = client.post("/api/v1/notes", json={"title": "A secret", "content": ""}, headers=auth_h(a["access_token"]))
    assert n.status_code == 200
    assert client.get("/api/v1/notes", headers=auth_h(b["access_token"])).json() == []
    assert client.get("/api/v1/search", params={"q": "secret"}, headers=auth_h(b["access_token"])).json()["notes"] == []
    assert [x["title"] for x in client.get("/api/v1/search", params={"q": "secret"}, headers=auth_h(a["access_token"])).json()["notes"]] == ["A secret"]


def test_non_admin_cannot_manage_users(client, auth_on):
    a = register(client, email="a@x.com")
    b = register(client, email="b@x.com")
    assert client.get("/api/v1/auth/users", headers=auth_h(b["access_token"])).status_code == 403
    assert len(client.get("/api/v1/auth/users", headers=auth_h(a["access_token"])).json()) == 2


def test_admin_deactivate_blocks_user(client, auth_on):
    a = register(client, email="a@x.com")
    b = register(client, email="b@x.com")
    r = client.patch(
        f"/api/v1/auth/users/{b['user']['id']}",
        json={"is_active": False},
        headers=auth_h(a["access_token"]),
    )
    assert r.status_code == 200
    assert client.post("/api/v1/auth/login", json={"email": "b@x.com", "password": "password123"}).status_code == 403
    assert client.get("/api/v1/auth/me", headers=auth_h(b["access_token"])).status_code == 401
    # admin cannot deactivate themselves
    r2 = client.patch(
        f"/api/v1/auth/users/{a['user']['id']}",
        json={"is_active": False},
        headers=auth_h(a["access_token"]),
    )
    assert r2.status_code == 400


def test_signup_closed_blocks_second_user(client, auth_on, monkeypatch):
    register(client, email="first@x.com")
    monkeypatch.setattr(settings, "allow_signup", False)
    r = client.post("/api/v1/auth/register", json={"email": "second@x.com", "password": "password123"})
    assert r.status_code == 403


def test_first_admin_adopts_legacy_content(client, auth_on, db_session):
    from app.core.deps import _default_user

    legacy = _default_user(db_session)
    db_session.add(Note(owner_id=legacy.id, title="legacy note", content="keep me", sort_order=0))
    db_session.commit()

    body = register(client, email="newadmin@x.com")
    assert body["user"]["is_admin"] is True
    notes = client.get("/api/v1/notes", headers=auth_h(body["access_token"])).json()
    assert [n["title"] for n in notes] == ["legacy note"]
    assert db_session.query(User).filter(User.email == settings.default_user_email).first() is None


def test_status_endpoint(client, auth_on):
    assert client.get("/api/v1/auth/status").json() == {"auth_enabled": True, "allow_signup": True}


def _setup_pair(client):
    """Two users; first owns a section+query+note+script+version. Returns (a, b, ids)."""
    a = register(client, email="owner@x.com")
    b = register(client, email="other@x.com")
    ha, hb = auth_h(a["access_token"]), auth_h(b["access_token"])
    sec = client.post("/api/v1/sections", json={"name": "Private"}, headers=ha).json()
    q = client.post(
        "/api/v1/queries",
        json={"section_id": sec["id"], "title": "Secret Q", "sql_text": "SELECT 1"},
        headers=ha,
    ).json()
    note = client.post("/api/v1/notes", json={"title": "Secret N", "content": ""}, headers=ha).json()
    script = client.post(
        "/api/v1/scripts",
        json={"file_name": "s.sh", "path": "/p", "remark": "", "purpose": "", "steps": ""},
        headers=ha,
    ).json()
    ver = client.post("/api/v1/versions", json={"remark": "v1"}, headers=ha).json()
    return (ha, hb, {"sec": sec["id"], "q": q["id"], "note": note["id"], "script": script["id"], "ver": ver["id"]})


def test_sections_and_queries_hidden_from_other_user(client, auth_on):
    ha, hb, ids = _setup_pair(client)
    assert client.get("/api/v1/sections", headers=hb).json() == []
    assert client.get(f"/api/v1/sections/{ids['sec']}/queries", headers=hb).status_code == 404
    assert client.get(f"/api/v1/queries/{ids['q']}", headers=hb).status_code == 404
    assert client.patch(f"/api/v1/queries/{ids['q']}", json={"title": "hijack"}, headers=hb).status_code == 404
    assert client.delete(f"/api/v1/queries/{ids['q']}", headers=hb).status_code == 404
    assert client.patch(f"/api/v1/sections/{ids['sec']}", json={"name": "hijack"}, headers=hb).status_code == 404
    assert client.delete(f"/api/v1/sections/{ids['sec']}", headers=hb).status_code == 404
    # owner still sees everything
    assert len(client.get("/api/v1/sections", headers=ha).json()) == 1
    assert client.get(f"/api/v1/queries/{ids['q']}", headers=ha).status_code == 200


def test_cannot_create_query_in_foreign_section(client, auth_on):
    ha, hb, ids = _setup_pair(client)
    r = client.post(
        "/api/v1/queries",
        json={"section_id": ids["sec"], "title": "smuggle", "sql_text": "SELECT 1"},
        headers=hb,
    )
    assert r.status_code == 404


def test_notes_scripts_mutations_rejected_for_foreign_rows(client, auth_on):
    ha, hb, ids = _setup_pair(client)
    assert client.patch(f"/api/v1/notes/{ids['note']}", json={"title": "x", "content": ""}, headers=hb).status_code == 404
    assert client.delete(f"/api/v1/notes/{ids['note']}", headers=hb).status_code == 404
    assert client.patch(f"/api/v1/scripts/{ids['script']}", json={
        "file_name": "x", "path": "", "remark": "", "purpose": "", "steps": ""}, headers=hb).status_code == 404
    assert client.delete(f"/api/v1/scripts/{ids['script']}", headers=hb).status_code == 404
    # and the rows are untouched
    assert len(client.get("/api/v1/notes", headers=ha).json()) == 1


def test_foreign_pin_and_restore_rejected(client, auth_on):
    ha, hb, ids = _setup_pair(client)
    assert client.put(f"/api/v1/pins/{ids['q']}", headers=hb).status_code == 404
    assert client.get("/api/v1/pins", headers=hb).json() == []
    assert client.post(f"/api/v1/versions/{ids['ver']}/restore", headers=hb).status_code == 404
    # search shows nothing foreign either
    r = client.get("/api/v1/search", params={"q": "Private"}, headers=hb).json()
    assert r["sections"] == [] and r["queries"] == []
