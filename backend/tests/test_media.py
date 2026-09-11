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


def test_resolve_playlist_url_resolves_single_video(monkeypatch):
    """Playlist param (list/index) is ignored — resolves the single video."""
    import app.services.media as m

    async def fake_cobalt(url, quality):
        assert "v=x" in url
        assert "list=" not in url
        return {"title": "t", "thumbnail": "", "download_url": "https://cdn/x.mp4", "formats": []}

    async def fail_ytdlp(url, quality):
        raise AssertionError("yt-dlp should not be called when cobalt succeeds")

    monkeypatch.setattr(m, "resolve_via_cobalt", fake_cobalt)
    monkeypatch.setattr(m, "resolve_via_ytdlp", fail_ytdlp)
    c = _client()
    r = c.post(
        "/api/v1/media/resolve",
        json={"url": "https://www.youtube.com/watch?v=x&list=PL123&index=2"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["source"] == "cobalt"


def test_resolve_youtu_be_share_link_with_si_param(monkeypatch):
    """Share link https://youtu.be/dQw4w9WgXcQ?si=... must resolve, not 422."""
    import app.services.media as m

    assert m.detect_platform("https://youtu.be/dQw4w9WgXcQ?si=soOTn3G2tEVN9d6A") == "youtube"

    async def fake_cobalt(url, quality):
        assert "youtu.be/dQw4w9WgXcQ" in url
        return {
            "title": "Rick Astley - Never Gonna Give You Up",
            "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
            "download_url": "https://cdn/x/dQw4w9WgXcQ.mp4",
            "formats": [],
        }

    monkeypatch.setattr(m, "resolve_via_cobalt", fake_cobalt)
    c = _client()
    r = c.post(
        "/api/v1/media/resolve",
        json={"url": "https://youtu.be/dQw4w9WgXcQ?si=soOTn3G2tEVN9d6A"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["platform"] == "youtube"
    assert body["source"] == "cobalt"
    # downloading case: direct URL must be present
    assert body["download_url"] == "https://cdn/x/dQw4w9WgXcQ.mp4"


def test_resolve_youtu_be_share_link_falls_back_to_ytdlp(monkeypatch):
    """Same share link must fall back to yt-dlp when Cobalt fails."""
    import app.services.media as m

    async def fail_cobalt(url, quality):
        assert "youtu.be/dQw4w9WgXcQ" in url
        raise RuntimeError("cobalt blocked")

    async def fake_ytdlp(url, quality):
        assert "youtu.be/dQw4w9WgXcQ" in url
        return {
            "title": "Rick Astley - Never Gonna Give You Up",
            "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
            "download_url": None,
            "formats": [{"id": "18", "quality": "360", "ext": "mp4", "url": None}],
        }

    monkeypatch.setattr(m, "resolve_via_cobalt", fail_cobalt)
    monkeypatch.setattr(m, "resolve_via_ytdlp", fake_ytdlp)
    c = _client()
    r = c.post(
        "/api/v1/media/resolve",
        json={"url": "https://youtu.be/dQw4w9WgXcQ?si=soOTn3G2tEVN9d6A"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["platform"] == "youtube"
    assert body["source"] == "ytdlp"
    assert body["download_url"] is None
    assert len(body["formats"]) == 1
