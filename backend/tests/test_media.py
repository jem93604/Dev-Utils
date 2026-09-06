"""RED: Link Saver media resolve — Cobalt failover -> yt-dlp fallback."""

from fastapi.testclient import TestClient


def _client():
    from app.main import app

    return TestClient(app)


def test_platforms_lists_expected():
    c = _client()
    r = c.get("/api/v1/media/platforms")
    assert r.status_code == 200, r.text
    names = {p["id"] for p in r.json()}
    assert {"youtube", "tiktok", "twitter", "instagram", "reddit", "vimeo"} <= names


def test_resolve_rejects_bad_url():
    c = _client()
    r = c.post("/api/v1/media/resolve", json={"url": "not-a-url"})
    assert r.status_code == 422


def test_resolve_uses_cobalt_first(monkeypatch):
    import app.services.media as m

    async def fake_cobalt(url, quality):
        return {"title": "t", "thumbnail": "", "download_url": "https://cdn/x.mp4", "formats": []}

    async def fail_ytdlp(url, quality):
        raise AssertionError("yt-dlp should not be called when cobalt succeeds")

    monkeypatch.setattr(m, "resolve_via_cobalt", fake_cobalt)
    monkeypatch.setattr(m, "resolve_via_ytdlp", fail_ytdlp)
    c = _client()
    r = c.post("/api/v1/media/resolve", json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"})
    assert r.status_code == 200, r.text
    assert r.json()["source"] == "cobalt"


def test_resolve_falls_back_to_ytdlp(monkeypatch):
    import app.services.media as m

    async def fail_cobalt(url, quality):
        raise RuntimeError("cobalt blocked")

    async def fake_ytdlp(url, quality):
        return {"title": "t", "thumbnail": "", "download_url": None, "formats": [{"id": "18"}]}

    monkeypatch.setattr(m, "resolve_via_cobalt", fail_cobalt)
    monkeypatch.setattr(m, "resolve_via_ytdlp", fake_ytdlp)
    c = _client()
    r = c.post("/api/v1/media/resolve", json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"})
    assert r.status_code == 200, r.text
    assert r.json()["source"] == "ytdlp"


def test_resolve_single_only_rejects_playlist():
    c = _client()
    r = c.post(
        "/api/v1/media/resolve",
        json={"url": "https://www.youtube.com/watch?v=x&list=PL123"},
    )
    assert r.status_code == 422
