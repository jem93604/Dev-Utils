"""User prefs: per-user key-value store (util order, favorites)."""
import pytest

from app.core.config import settings


@pytest.fixture()
def auth_on(monkeypatch):
    monkeypatch.setattr(settings, "auth_enabled", True)
    monkeypatch.setattr(settings, "allow_signup", True)
    monkeypatch.setattr(settings, "jwt_secret", "test-secret")
    monkeypatch.setattr(settings, "jwt_expire_days", 7)


def register(client, email="admin@x.com", password="password123"):
    r = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password},
    )
    assert r.status_code == 201, r.text
    return r.json()


def auth_h(token):
    return {"Authorization": f"Bearer {token}"}


def test_prefs_round_trip(client, auth_on):
    me = register(client)
    h = auth_h(me["access_token"])

    assert client.get("/api/v1/prefs", headers=h).json() == {"prefs": {}}

    r = client.put("/api/v1/prefs/util_order", json={"value": ["cron", "hash"]}, headers=h)
    assert r.status_code == 200, r.text

    assert client.get("/api/v1/prefs", headers=h).json() == {"prefs": {"util_order": ["cron", "hash"]}}

    # overwrite
    client.put("/api/v1/prefs/util_order", json={"value": ["hash"]}, headers=h)
    assert client.get("/api/v1/prefs", headers=h).json() == {"prefs": {"util_order": ["hash"]}}
    # second key coexists
    client.put("/api/v1/prefs/util_favs", json={"value": ["hash"]}, headers=h)
    assert client.get("/api/v1/prefs", headers=h).json() == {
        "prefs": {"util_order": ["hash"], "util_favs": ["hash"]}
    }


def test_prefs_are_isolated_per_user(client, auth_on):
    a = register(client, email="a@x.com")
    b = register(client, email="b@x.com")
    client.put("/api/v1/prefs/util_order", json={"value": ["cron"]}, headers=auth_h(a["access_token"]))
    assert client.get("/api/v1/prefs", headers=auth_h(b["access_token"])).json() == {"prefs": {}}


def test_prefs_reject_non_string_lists(client, auth_on):
    me = register(client)
    h = auth_h(me["access_token"])
    assert client.put("/api/v1/prefs/util_order", json={"value": "nope"}, headers=h).status_code == 422
    assert client.put("/api/v1/prefs/util_order", json={"value": [1, 2]}, headers=h).status_code == 422
    assert client.put("/api/v1/prefs/util_order", json={}, headers=h).status_code == 422


def test_prefs_require_auth(client, auth_on):
    assert client.get("/api/v1/prefs").status_code == 401
    assert client.put("/api/v1/prefs/util_order", json={"value": []}).status_code == 401


def test_prefs_work_in_single_user_mode(client):
    # No auth_on: AUTH_ENABLED=false, default user owns the prefs.
    r = client.put("/api/v1/prefs/util_order", json={"value": ["hash"]})
    assert r.status_code == 200, r.text
    assert client.get("/api/v1/prefs").json() == {"prefs": {"util_order": ["hash"]}}
