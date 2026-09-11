"""Security regression tests: SSRF guard, auth on media, rate limits,
secret fail-closed, input caps, and security headers.

Uses the shared `client` fixture (AUTH_ENABLED=false single-user mode) plus
an auth-enabled variant for the 401 checks.
"""
import pytest

from app.core.config import settings
from app.core.rate_limit import clear_rate_limits


@pytest.fixture()
def auth_on(monkeypatch):
    monkeypatch.setattr(settings, "auth_enabled", True)
    monkeypatch.setattr(settings, "allow_signup", True)
    monkeypatch.setattr(settings, "jwt_secret", "test-secret")
    monkeypatch.setattr(settings, "jwt_expire_days", 3)
    monkeypatch.setattr(settings, "auth_rate_limit_per_min", 1000)
    monkeypatch.setattr(settings, "media_rate_limit_per_min", 1000)
    clear_rate_limits()


@pytest.fixture(autouse=True)
def _clear_limits():
    clear_rate_limits()
    yield
    clear_rate_limits()


def _register(client, email="sec@x.com", password="password123"):
    r = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password},
    )
    assert r.status_code == 201, r.text
    return r.json()


def _ok_cobalt(monkeypatch):
    import app.services.media as m

    async def fake_cobalt(url, quality):
        return {"title": "t", "thumbnail": "", "download_url": "https://cdn/x.mp4", "formats": []}

    async def fail_ytdlp(url, quality):
        raise AssertionError("should not reach yt-dlp")

    monkeypatch.setattr(m, "resolve_via_cobalt", fake_cobalt)
    monkeypatch.setattr(m, "resolve_via_ytdlp", fail_ytdlp)


# ---- media auth ----

def test_media_platforms_require_auth(client, auth_on):
    assert client.get("/api/v1/media/platforms").status_code == 401


def test_media_resolve_requires_auth(client, auth_on):
    r = client.post("/api/v1/media/resolve", json={"url": "https://www.youtube.com/watch?v=x"})
    assert r.status_code == 401


def test_media_resolve_ok_with_token(client, auth_on, monkeypatch):
    _ok_cobalt(monkeypatch)
    me = _register(client)
    h = {"Authorization": f"Bearer {me['access_token']}"}
    assert client.get("/api/v1/media/platforms", headers=h).status_code == 200
    r = client.post(
        "/api/v1/media/resolve",
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
        headers=h,
    )
    assert r.status_code == 200, r.text
    assert r.json()["source"] == "cobalt"


# ---- SSRF guard ----

@pytest.mark.parametrize("url", [
    "http://localhost:8001/admin",
    "http://localhost/",
    "http://127.0.0.1:8001/",
    "http://10.0.0.5/",
    "http://192.168.1.1/",
    "http://172.16.0.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "http://metadata.google.internal/",
    "http://printer.local/",
    "ftp://example.com/x",
    "not-a-url",
])
def test_media_resolve_blocks_private_urls(client, url):
    r = client.post("/api/v1/media/resolve", json={"url": url})
    assert r.status_code == 422, url


def test_media_resolve_error_does_not_leak_internals(client, monkeypatch):
    import app.services.media as m

    async def fail_cobalt(url, quality):
        raise RuntimeError("cobalt blocked")

    async def fail_ytdlp(url, quality):
        raise RuntimeError("secret internal traceback details")

    monkeypatch.setattr(m, "resolve_via_cobalt", fail_cobalt)
    monkeypatch.setattr(m, "resolve_via_ytdlp", fail_ytdlp)
    r = client.post("/api/v1/media/resolve", json={"url": "https://www.youtube.com/watch?v=x"})
    assert r.status_code == 502
    assert "secret internal" not in r.text
    assert r.json()["detail"] == "resolve failed — upstream unavailable"


# ---- rate limits ----

def test_auth_rate_limit_returns_429(client, auth_on, monkeypatch):
    monkeypatch.setattr(settings, "auth_rate_limit_per_min", 2)
    clear_rate_limits()
    for _ in range(2):
        client.post("/api/v1/auth/login", json={"email": "nobody@x.com", "password": "whatever123"})
    r = client.post("/api/v1/auth/login", json={"email": "nobody@x.com", "password": "whatever123"})
    assert r.status_code == 429


def test_media_rate_limit_returns_429(client, monkeypatch):
    _ok_cobalt(monkeypatch)
    monkeypatch.setattr(settings, "media_rate_limit_per_min", 2)
    clear_rate_limits()
    url = {"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}
    assert client.post("/api/v1/media/resolve", json=url).status_code == 200
    assert client.post("/api/v1/media/resolve", json=url).status_code == 200
    assert client.post("/api/v1/media/resolve", json=url).status_code == 429


def test_rate_limiter_unit():
    from app.core.rate_limit import check_rate_limit
    key = "unit-test-key"
    clear_rate_limits()
    assert check_rate_limit(key, 2, window_s=60) is True
    assert check_rate_limit(key, 2, window_s=60) is True
    assert check_rate_limit(key, 2, window_s=60) is False
    clear_rate_limits()
    assert check_rate_limit(key, 2, window_s=60) is True


# ---- secret fail-closed ----

def test_check_secret_fails_on_default(monkeypatch):
    monkeypatch.setattr(settings, "auth_enabled", True)
    monkeypatch.setattr(settings, "jwt_secret", "change-me-in-prod")
    monkeypatch.setattr(settings, "allow_insecure_default_secret", False)
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        settings.check_secret()


def test_check_secret_ok_with_custom_or_opt_out(monkeypatch):
    monkeypatch.setattr(settings, "auth_enabled", True)
    monkeypatch.setattr(settings, "jwt_secret", "custom-secret")
    monkeypatch.setattr(settings, "allow_insecure_default_secret", False)
    settings.check_secret()  # must not raise
    monkeypatch.setattr(settings, "jwt_secret", "change-me-in-prod")
    monkeypatch.setattr(settings, "allow_insecure_default_secret", True)
    settings.check_secret()  # must not raise


# ---- input caps ----

def test_query_sql_text_cap(client, section):
    big = "SELECT " + "x" * 100001
    r = client.post(
        "/api/v1/queries",
        json={"section_id": section["id"], "title": "big", "sql_text": big},
    )
    assert r.status_code == 422


def test_note_content_cap(client):
    r = client.post("/api/v1/notes", json={"title": "t", "content": "x" * 50001})
    assert r.status_code == 422


def test_section_description_cap(client):
    r = client.post("/api/v1/sections", json={"name": "s", "description": "x" * 5001})
    assert r.status_code == 422


def test_prefs_key_and_item_caps(client):
    assert client.put("/api/v1/prefs/" + "k" * 65, json={"value": []}).status_code == 422
    assert client.put("/api/v1/prefs/ok", json={"value": ["x" * 201]}).status_code == 422


def test_search_query_cap(client, auth_on):
    me = _register(client, email="searchcap@x.com")
    h = {"Authorization": f"Bearer {me['access_token']}"}
    r = client.get("/api/v1/search", params={"q": "x" * 201}, headers=h)
    assert r.status_code == 422


def test_media_quality_cap(client):
    r = client.post(
        "/api/v1/media/resolve",
        json={"url": "https://www.youtube.com/watch?v=x", "quality": "1" * 11},
    )
    assert r.status_code == 422


# ---- security headers ----

def test_security_headers_present(client):
    r = client.get("/health")
    assert r.headers.get("x-content-type-options") == "nosniff"
    assert r.headers.get("x-frame-options") == "DENY"
    assert r.headers.get("referrer-policy") == "no-referrer"
