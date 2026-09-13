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


def test_resolve_download_endpoint_aliases_go_redirect(monkeypatch):
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
    body = r.json()
    assert body["download_endpoint"].startswith("/api/v1/media/go?")
    assert "url=" in body["download_endpoint"]
    # One fetch -> all qualities + mp3, no re-fetch needed.
    variants = body["variants"]
    assert len(variants) == 7
    assert [v["quality"] for v in variants if v["kind"] == "video"] == [
        "360", "480", "720", "1080", "1440", "2160",
    ]
    assert any(v["kind"] == "audio" and v["audio_only"] for v in variants)
    # Legacy download_endpoint must never point at the disabled route.
    assert all("/media/download" not in v["download_endpoint"] for v in variants)


def test_resolve_marks_unsupported_qualities(monkeypatch):
    import app.services.media as m

    async def fail_cobalt(url, quality):
        raise RuntimeError("cobalt blocked")

    async def fake_ytdlp(url, quality):
        return {
            "title": "t",
            "thumbnail": "",
            "download_url": None,
            "formats": [{"id": "18", "height": 360, "note": "", "ext": "mp4"}],
        }

    monkeypatch.setattr(m, "resolve_via_cobalt", fail_cobalt)
    monkeypatch.setattr(m, "resolve_via_ytdlp", fake_ytdlp)
    c = _client()
    r = c.post("/api/v1/media/resolve", json={"url": "https://vimeo.com/1"})
    assert r.status_code == 200, r.text
    by_q = {v["quality"]: v for v in r.json()["variants"] if v["kind"] == "video"}
    assert by_q["360"]["available"] is True
    assert by_q["1080"]["available"] is False


def test_download_route_disabled_zero_egress_only(caplog):
    """GET /media/download must never stream bytes — zero-egress only."""
    import logging

    c = _client()
    with caplog.at_level(logging.WARNING, logger="sqlhub.media"):
        r = c.get("/api/v1/media/download", params={"url": "https://vimeo.com/1"})
    assert r.status_code == 410, r.text
    assert "zero-egress" in r.json()["detail"].lower()
    assert any("blocked server-egress" in m for m in caplog.messages)


def test_download_rejects_bad_url():
    c = _client()
    r = c.get("/api/v1/media/download", params={"url": "not-a-url"})
    assert r.status_code == 422


def test_go_redirects_zero_egress(monkeypatch, caplog):
    import logging

    import app.api.v1.media as api

    async def fake_direct(url, quality, audio_only, format_id=None):
        return {
            "url": "https://rr1---sn.googlevideo.com/videoplayback?expire=123",
            "format_id": "18",
            "category": "progressive",
            "is_progressive": True,
            "expires_in": 300,
            "ext": "mp4",
        }

    monkeypatch.setattr(api, "resolve_direct_url", fake_direct)
    c = _client()
    with caplog.at_level(logging.INFO, logger="sqlhub.media"):
        r = c.get(
            "/api/v1/media/go",
            params={"url": "https://www.youtube.com/watch?v=x", "quality": "720"},
            follow_redirects=False,
        )
    assert r.status_code == 302, r.text
    assert r.headers["location"].startswith("https://rr1---sn.googlevideo.com/")
    assert r.headers["X-Direct-Format"] == "18"
    assert r.headers["X-Direct-Expires-In"] == "300"
    assert any("zero-egress redirect" in m for m in caplog.messages)


def test_go_redirects_any_platform(monkeypatch):
    """Zero-egress is platform-agnostic: /go works for YouTube AND others."""
    import app.api.v1.media as api

    async def fake_direct(url, quality, audio_only, format_id=None):
        return {
            "url": "https://cdn.example.com/v.mp4?expire=123",
            "format_id": "best",
            "category": "progressive",
            "is_progressive": True,
            "expires_in": 300,
            "ext": "mp4",
        }

    monkeypatch.setattr(api, "resolve_direct_url", fake_direct)
    c = _client()
    for src in ("https://www.youtube.com/watch?v=x", "https://vimeo.com/1"):
        r = c.get(
            "/api/v1/media/go",
            params={"url": src, "quality": "720"},
            follow_redirects=False,
        )
        assert r.status_code == 302, r.text
        assert r.headers["location"].startswith("https://cdn.example.com/")


def test_go_skips_hls_manifests(monkeypatch):
    """m3u8/mpd manifests must never back a redirect — browser opens a
    playlist instead of downloading a file."""
    import app.services.media as m

    hls = {
        "id": "hls-720",
        "height": 720,
        "ext": "m3u8",
        "protocol": "m3u8_native",
        "category": "video-only",
        "is_progressive": False,
        "url": "https://example.com/stream.m3u8?expire=9999999999",
        "expires_in": 3600,
    }
    prog = {
        "id": "18",
        "height": 360,
        "ext": "mp4",
        "protocol": "https",
        "category": "progressive",
        "is_progressive": True,
        "url": "https://example.com/v.mp4?expire=9999999999",
        "expires_in": 3600,
    }

    async def fake_ytdlp(url, quality):
        return {"title": "t", "thumbnail": "", "formats": [hls, prog]}

    # Drive through the real resolve_direct_url with stubbed extraction.
    async def fake_extract(url, quality):
        return {"title": "t", "thumbnail": "", "formats": [hls, prog]}

    monkeypatch.setattr(m, "resolve_via_ytdlp", fake_extract)
    c = _client()
    r = c.get(
        "/api/v1/media/go",
        params={"url": "https://www.youtube.com/watch?v=x", "quality": "720"},
        follow_redirects=False,
    )
    assert r.status_code == 302, r.text
    assert r.headers["location"] == prog["url"]
    assert r.headers["X-Direct-Format"] == "18"


def test_download_never_streams_bytes_even_with_valid_url():
    """Even valid URLs get 410 — no code path may produce FileResponse."""
    c = _client()
    r = c.get(
        "/api/v1/media/download",
        params={"url": "https://www.youtube.com/watch?v=x"},
    )
    assert r.status_code == 410, r.text
