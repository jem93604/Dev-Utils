import asyncio
import re
import shutil
import tempfile
from pathlib import Path
from urllib.parse import parse_qs, parse_qsl, urlencode, urlparse, urlunparse

import httpx

COBALT_INSTANCES = [
    "https://cobalt-api.kwiatekmiki.com",
    "https://cobalt-api.meowing.de",
    "https://api.cobalt.tools",
]

PLATFORMS = [
    {"id": "youtube", "label": "YouTube", "hosts": ["youtube.com", "youtu.be", "music.youtube.com"]},
    {"id": "tiktok", "label": "TikTok", "hosts": ["tiktok.com", "vt.tiktok.com"]},
    {"id": "twitter", "label": "X / Twitter", "hosts": ["twitter.com", "x.com", "t.co"]},
    {"id": "instagram", "label": "Instagram", "hosts": ["instagram.com"]},
    {"id": "reddit", "label": "Reddit", "hosts": ["reddit.com", "redd.it"]},
    {"id": "vimeo", "label": "Vimeo", "hosts": ["vimeo.com"]},
]


def detect_platform(url: str) -> str:
    host = (urlparse(url).hostname or "").lower()
    for p in PLATFORMS:
        if any(host == h or host.endswith("." + h) for h in p["hosts"]):
            return p["id"]
    return "generic"


def _is_playlist(url: str) -> bool:
    q = parse_qs(urlparse(url).query)
    return "list" in q


def strip_playlist_params(url: str) -> str:
    """Drop playlist tracking (list/index) so a playlist URL resolves as a single video."""
    try:
        p = urlparse(url)
        q = [(k, v) for k, v in parse_qsl(p.query, keep_blank_values=True) if k not in ("list", "index")]
        return urlunparse(p._replace(query=urlencode(q)))
    except Exception:
        return url


async def resolve_via_cobalt(url: str, quality: str, instances: list[str] | None = None) -> dict:
    errs: list[str] = []
    for base in instances or COBALT_INSTANCES:
        try:
            async with httpx.AsyncClient(timeout=15) as c:
                r = await c.post(
                    base.rstrip("/") + "/",
                    json={"url": url, "videoQuality": quality, "downloadMode": "auto"},
                    headers={"Accept": "application/json", "Content-Type": "application/json"},
                )
                if r.status_code >= 400:
                    errs.append(f"{base}:{r.status_code}")
                    continue
                d = r.json()
                return {
                    "title": d.get("text", ""),
                    "thumbnail": d.get("thumb", "") or "",
                    "download_url": d.get("url"),
                    "formats": [],
                }
        except Exception as e:  # noqa: BLE001 — try next instance
            errs.append(f"{base}:{e}")
    raise RuntimeError("cobalt failed: " + "; ".join(errs))


async def resolve_via_ytdlp(url: str, quality: str) -> dict:
    def _extract():
        import time

        from yt_dlp import YoutubeDL

        opts = {
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            # One metadata fetch: we need real heights/filesizes for every
            # quality row, so don't restrict formats here.
            "socket_timeout": 30,
            "retries": 2,
        }
        with YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
        fmts = info.get("formats") or []
        now = int(time.time())
        rows = []
        for f in fmts:
            fid = str(f.get("format_id", ""))
            height = f.get("height")
            note = str(f.get("format_note", "") or "")
            vcodec = str(f.get("vcodec", "") or "")
            acodec = str(f.get("acodec", "") or "")
            raw_url = f.get("url")
            protocol = str(f.get("protocol", "") or "")
            # Progressive = muxed A+V in one file (no wasm needed).
            # DASH split = video-only / audio-only (needs mux or direct play).
            has_v = vcodec and vcodec.lower() != "none"
            has_a = acodec and acodec.lower() != "none"
            if has_v and has_a:
                category = "progressive"
            elif has_v:
                category = "video-only"
            elif has_a:
                category = "audio-only"
            else:
                category = "unknown"
            rows.append({
                "id": fid,
                "height": height if isinstance(height, int) else None,
                "note": note,
                "ext": str(f.get("ext", "") or ""),
                "vcodec": vcodec,
                "acodec": acodec,
                "filesize": f.get("filesize") or f.get("filesize_approx"),
                "tbr": f.get("tbr"),
                "protocol": protocol or None,
                "category": category,
                "is_progressive": category == "progressive",
                # Zero-egress direct URL: signed CDN URL, short-lived
                # (typically usable ~5-6 min, max ~1h). Never fetched
                # server-side — client navigates directly.
                "url": raw_url if isinstance(raw_url, str) else None,
                "expires_in": _expiry_ttl(raw_url, now),
            })
        # Keep newest yt-dlp field order but cap payload size.
        rows.sort(key=lambda r: (r["height"] or 0, r["tbr"] or 0), reverse=True)
        return {
            "title": info.get("title", ""),
            "thumbnail": info.get("thumbnail", "") or "",
            "duration": info.get("duration"),
            "download_url": None,
            "formats": rows[:40],
            "resolved_at": now,
        }

    return await asyncio.to_thread(_extract)


def _expiry_ttl(signed_url: str | None, now: int) -> int | None:
    """Best-effort TTL for signed CDN URLs (?expire=/exp=...).

    Returns seconds until expiry, or None when the URL carries no
    parseable expiry. Callers treat None as 'use immediately'.
    """
    if not signed_url or not isinstance(signed_url, str):
        return None
    try:
        from urllib.parse import parse_qs, urlparse

        q = parse_qs(urlparse(signed_url).query)
        for key in ("expire", "exp", "expiry", "e"):
            vals = q.get(key)
            if not vals:
                continue
            try:
                ttl = int(float(vals[0])) - int(now)
            except (TypeError, ValueError):
                continue
            if ttl > 0:
                return min(ttl, 8 * 3600)
            return 0
    except Exception:
        return None
    return None


def _pick_direct_format(
    formats: list[dict], format_id: str | None, quality: str, audio_only: bool
) -> dict | None:
    """Pick the single format backing a /go redirect.

    Priority: exact format_id match -> best progressive <= height ->
    best video-only <= height -> best audio-only (audio_only mode).
    """
    fmts = [f for f in (formats or []) if isinstance(f, dict) and f.get("url")]
    if not fmts:
        return None
    if format_id:
        for f in fmts:
            if str(f.get("id", "")) == str(format_id):
                return f
    h = _quality_height(quality)
    if audio_only:
        audio = [f for f in fmts if str(f.get("category", "")) == "audio-only"]
        pool = audio or [f for f in fmts if f.get("acodec") not in (None, "", "none")]
        pool.sort(key=lambda r: (r.get("tbr") or 0), reverse=True)
        return pool[0] if pool else None
    progressive = [
        f
        for f in fmts
        if f.get("is_progressive") and isinstance(f.get("height"), int) and f["height"] <= h
    ]
    if progressive:
        progressive.sort(key=lambda r: (r.get("height") or 0, r.get("tbr") or 0), reverse=True)
        return progressive[0]
    # No progressive <= ceiling: fall back to any progressive (closest match),
    # then video-only (client muxes via ffmpeg.wasm where CORS permits).
    any_prog = [f for f in fmts if f.get("is_progressive")]
    if any_prog:
        any_prog.sort(
            key=lambda r: (abs((r.get("height") or 0) - h), -(r.get("tbr") or 0))
        )
        return any_prog[0]
    video_only = [
        f for f in fmts if str(f.get("category", "")) == "video-only" and isinstance(f.get("height"), int)
    ]
    if video_only:
        video_only.sort(key=lambda r: (r.get("height") or 0, r.get("tbr") or 0), reverse=True)
        eligible = [f for f in video_only if f["height"] <= h] or video_only
        return eligible[0]
    return None


async def resolve_direct_url(
    url: str, quality: str = "720", audio_only: bool = False, format_id: str | None = None
) -> dict:
    """Re-extract and return the signed CDN URL for a /go redirect.

    Returns {url, format_id, category, expires_in, is_progressive}.
    Raises RuntimeError when no usable direct URL exists. Never downloads
    bytes — metadata extraction only, so server egress stays JSON-sized.
    """
    data = await resolve_via_ytdlp(url, quality)
    picked = _pick_direct_format(data.get("formats"), format_id, quality, audio_only)
    if not picked or not picked.get("url"):
        raise RuntimeError("no direct stream available (expired, IP-locked, or format gone)")
    target = picked["url"]
    p = urlparse(target)
    if p.scheme not in ("http", "https") or not p.hostname:
        raise RuntimeError("extractor returned non-http(s) URL")
    return {
        "url": target,
        "format_id": picked.get("id", ""),
        "category": picked.get("category", ""),
        "is_progressive": bool(picked.get("is_progressive")),
        "expires_in": picked.get("expires_in"),
        "ext": picked.get("ext", ""),
    }


async def resolve_media(url: str, quality: str = "720") -> dict:
    platform = detect_platform(url)
    try:
        data = await resolve_via_cobalt(url, quality)
        return {"platform": platform, **data, "source": "cobalt"}
    except Exception:
        data = await resolve_via_ytdlp(url, quality)
        return {"platform": platform, **data, "source": "ytdlp"}


# Qualities offered in the Link Saver UI — one download link each, computed
# from a single metadata fetch so the user never re-fetches per quality.
OFFERED_QUALITIES = ["360", "480", "720", "1080", "1440", "2160"]


def _formats_support_height(formats: list[dict], height: int) -> bool | None:
    """True if metadata proves a stream >= height exists.

    Returns None when formats carry no height info (assume available —
    yt-dlp picks the closest match at download time).
    """
    heights = [f.get("height") for f in formats or [] if isinstance(f.get("height"), int)]
    if not heights:
        notes = " ".join(str(f.get("note", "")) for f in formats or []).lower()
        if "audio only" in notes and len(formats or []) > 0:
            return True
        return None
    return max(heights) >= height


def build_variants(
    url: str, formats: list[dict] | None, source: str, default_quality: str = "720"
) -> tuple[list[dict], str]:
    """All download links for one resolve — no re-fetch needed.

    Returns (variants, default_endpoint). Video rows use the actual
    supported ceiling (e.g. a 720p-max video won't advertise 4K as
    available); the MP3 row is always offered.

    Zero-egress: each variant carries a ``redirect_endpoint`` (/media/go 302
    to the signed CDN URL) plus the raw ``direct_url`` when extraction
    produced one. Bytes flow YouTube -> user device; the server only
    serves JSON + redirect headers.
    """
    from urllib.parse import urlencode

    fmts = formats or []
    variants: list[dict] = []
    for q in OFFERED_QUALITIES:
        h = _quality_height(q)
        support = _formats_support_height(fmts, h) if source == "ytdlp" else None
        query = urlencode({"url": url, "quality": q, "audio_only": "false"})
        picked = _pick_direct_format(fmts, None, q, False) if source == "ytdlp" else None
        go_query = urlencode({"url": url, "quality": q, "audio_only": "false"})
        if picked and picked.get("id"):
            go_query = urlencode({
                "url": url, "quality": q, "audio_only": "false",
                "format_id": str(picked.get("id", "")),
            })
        needs_mux = bool(picked) and not bool(picked.get("is_progressive"))
        variants.append({
            "id": f"video-{q}",
            "label": f"{q}p MP4" if q != "2160" else "4K MP4",
            "kind": "video",
            "quality": q,
            "audio_only": False,
            "download_endpoint": f"/api/v1/media/download?{query}",
            "redirect_endpoint": f"/api/v1/media/go?{go_query}" if source == "ytdlp" else None,
            "direct_url": (picked or {}).get("url"),
            "expires_in": (picked or {}).get("expires_in"),
            "needs_mux": needs_mux if picked else None,
            "available": support,
            "approx_size": (picked or {}).get("filesize"),
            "ext": (picked or {}).get("ext") or "mp4",
        })
    query = urlencode({"url": url, "quality": default_quality, "audio_only": "true"})
    picked_audio = (
        _pick_direct_format(fmts, None, default_quality, True) if source == "ytdlp" else None
    )
    go_audio = urlencode({"url": url, "quality": default_quality, "audio_only": "true"})
    if picked_audio and picked_audio.get("id"):
        go_audio = urlencode({
            "url": url, "quality": default_quality, "audio_only": "true",
            "format_id": str(picked_audio.get("id", "")),
        })
    variants.append({
        "id": "audio-mp3",
        "label": "MP3 audio",
        "kind": "audio",
        "quality": default_quality,
        "audio_only": True,
        "download_endpoint": f"/api/v1/media/download?{query}",
        "redirect_endpoint": f"/api/v1/media/go?{go_audio}" if source == "ytdlp" else None,
        "direct_url": (picked_audio or {}).get("url"),
        "expires_in": (picked_audio or {}).get("expires_in"),
        "needs_mux": False,
        "available": True,
        "approx_size": (picked_audio or {}).get("filesize"),
        "ext": "mp3",
    })
    return variants, variants[2]["download_endpoint"]  # 720p default


# 2GB cap advertised in the UI — enforced both in yt-dlp and before streaming.
MAX_BYTES = 2 * 1024**3


def _quality_height(quality: str) -> int:
    try:
        h = int(str(quality).strip())
    except (TypeError, ValueError):
        h = 720
    return min(max(h, 144), 2160)


def _download_sync(url: str, quality: str, audio_only: bool) -> dict:
    """Blocking yt-dlp fetch. Returns {path, tmpdir, filename, media_type, size}."""
    from yt_dlp import YoutubeDL
    from yt_dlp.utils import DownloadError

    tmpdir = Path(tempfile.mkdtemp(prefix="linksaver-"))
    h = _quality_height(quality)
    if audio_only:
        opts = {
            "format": "bestaudio/best",
            "outtmpl": {"default": str(tmpdir / "%(title).80s [%(id)s].%(ext)s")},
            "restrictfilenames": True,
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            "socket_timeout": 30,
            "retries": 2,
            "max_filesize": MAX_BYTES,
            "postprocessors": [
                {"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"}
            ],
        }
    else:
        opts = {
            "format": f"bv*[height<={h}]+ba/b[height<={h}]/b",
            "merge_output_format": "mp4",
            "outtmpl": {"default": str(tmpdir / "%(title).80s [%(id)s].%(ext)s")},
            "restrictfilenames": True,
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            "socket_timeout": 30,
            "retries": 2,
            "max_filesize": MAX_BYTES,
        }
    try:
        with YoutubeDL(opts) as ydl:
            ydl.download([url])
    except DownloadError as e:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise RuntimeError(f"download failed: {e}") from e
    candidates = sorted(
        (p for p in tmpdir.iterdir() if p.is_file() and not p.suffix == ".part"),
        key=lambda p: p.stat().st_size,
        reverse=True,
    )
    if not candidates:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise RuntimeError("download produced no file")
    target = candidates[0]
    if audio_only and target.suffix.lower() != ".mp3":
        # FFmpeg postprocessor missing/failed — refuse instead of handing back video.
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise RuntimeError("audio conversion failed (ffmpeg/ffprobe required for mp3)")
    import mimetypes

    media_type = mimetypes.guess_type(target.name)[0] or (
        "audio/mpeg" if audio_only else "video/mp4"
    )
    # Clean up stray sidecars, keep only the deliverable.
    for p in candidates[1:]:
        p.unlink(missing_ok=True)
    size = target.stat().st_size
    if size > MAX_BYTES:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise RuntimeError("file exceeds 2GB cap")
    return {
        "path": str(target),
        "tmpdir": str(tmpdir),
        "filename": target.name,
        "media_type": media_type,
        "size": size,
    }


async def download_media(url: str, quality: str = "720", audio_only: bool = False) -> dict:
    return await asyncio.to_thread(_download_sync, url, quality, audio_only)


def sanitize_filename(name: str, fallback: str = "video.mp4") -> str:
    cleaned = re.sub(r"[^\w\-. ]+", "_", (name or "").strip()).strip("._")
    return cleaned or fallback


def cleanup_download_dir(tmpdir: str) -> None:
    shutil.rmtree(tmpdir, ignore_errors=True)
