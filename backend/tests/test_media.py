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


def test_resolve_includes_backend_download_endpoint(monkeypatch):
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
    assert body["download_endpoint"].startswith("/api/v1/media/download?")
    assert "url=" in body["download_endpoint"]
    # One fetch -> all qualities + mp3, no re-fetch needed.
    variants = body["variants"]
    assert len(variants) == 7
    assert [v["quality"] for v in variants if v["kind"] == "video"] == [
        "360", "480", "720", "1080", "1440", "2160",
    ]
    assert any(v["kind"] == "audio" and v["audio_only"] for v in variants)
    assert all(v["download_endpoint"].startswith("/api/v1/media/download?") for v in variants)


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


def test_download_streams_file(monkeypatch, tmp_path):
    import app.api.v1.media as api

    f = tmp_path / "vid.mp4"
    f.write_bytes(b"fake-bytes")
    d = tmp_path / "work"
    d.mkdir()

    async def fake_dl(url, quality, audio_only):
        return {
            "path": str(f),
            "tmpdir": str(d),
            "filename": "vid.mp4",
            "media_type": "video/mp4",
            "size": 10,
        }

    monkeypatch.setattr(api, "download_media", fake_dl)
    c = _client()
    r = c.get("/api/v1/media/download", params={"url": "https://vimeo.com/1"})
    assert r.status_code == 200, r.text
    assert r.content == b"fake-bytes"
    assert "attachment" in r.headers.get("content-disposition", "")


def test_download_rejects_bad_url():
    c = _client()
    r = c.get("/api/v1/media/download", params={"url": "not-a-url"})
    assert r.status_code == 422


def test_download_playlist_url_downloads_single_video(monkeypatch, tmp_path):
    """Playlist param on /download is stripped — downloads the single video."""
    import app.api.v1.media as api

    f = tmp_path / "vid.mp4"
    f.write_bytes(b"fake-bytes")
    d = tmp_path / "work"
    d.mkdir()
    seen: dict = {}

    async def fake_dl(url, quality, audio_only):
        seen["url"] = url
        return {
            "path": str(f),
            "tmpdir": str(d),
            "filename": "vid.mp4",
            "media_type": "video/mp4",
            "size": 10,
        }

    monkeypatch.setattr(api, "download_media", fake_dl)
    c = _client()
    r = c.get(
        "/api/v1/media/download",
        params={"url": "https://www.youtube.com/watch?v=x&list=PL1&index=2"},
    )
    assert r.status_code == 200, r.text
    assert "list=" not in seen["url"]


def test_download_surfaces_backend_failure(monkeypatch):
    import app.api.v1.media as api

    async def fail_dl(url, quality, audio_only):
        raise RuntimeError("download failed: boom")

    monkeypatch.setattr(api, "download_media", fail_dl)
    c = _client()
    r = c.get("/api/v1/media/download", params={"url": "https://vimeo.com/1"})
    assert r.status_code == 502
