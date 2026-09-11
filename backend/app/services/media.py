import asyncio
import re
import shutil
import tempfile
from pathlib import Path
from urllib.parse import urlparse, parse_qs

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
        rows = []
        for f in fmts:
            fid = str(f.get("format_id", ""))
            height = f.get("height")
            note = str(f.get("format_note", "") or "")
            vcodec = str(f.get("vcodec", "") or "")
            acodec = str(f.get("acodec", "") or "")
            rows.append({
                "id": fid,
                "height": height if isinstance(height, int) else None,
                "note": note,
                "ext": str(f.get("ext", "") or ""),
                "vcodec": vcodec,
                "acodec": acodec,
                "filesize": f.get("filesize") or f.get("filesize_approx"),
                "tbr": f.get("tbr"),
                "url": None,  # never leak signed CDN URLs to the client
            })
        # Keep newest yt-dlp field order but cap payload size.
        rows.sort(key=lambda r: (r["height"] or 0, r["tbr"] or 0), reverse=True)
        return {
            "title": info.get("title", ""),
            "thumbnail": info.get("thumbnail", "") or "",
            "duration": info.get("duration"),
            "download_url": None,
            "formats": rows[:40],
        }

    return await asyncio.to_thread(_extract)


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
    """
    from urllib.parse import urlencode

    fmts = formats or []
    variants: list[dict] = []
    for q in OFFERED_QUALITIES:
        h = _quality_height(q)
        support = _formats_support_height(fmts, h) if source == "ytdlp" else None
        query = urlencode({"url": url, "quality": q, "audio_only": "false"})
        variants.append({
            "id": f"video-{q}",
            "label": f"{q}p MP4" if q != "2160" else "4K MP4",
            "kind": "video",
            "quality": q,
            "audio_only": False,
            "download_endpoint": f"/api/v1/media/download?{query}",
            "available": support,
            "approx_size": None,
            "ext": "mp4",
        })
    query = urlencode({"url": url, "quality": default_quality, "audio_only": "true"})
    variants.append({
        "id": "audio-mp3",
        "label": "MP3 audio",
        "kind": "audio",
        "quality": default_quality,
        "audio_only": True,
        "download_endpoint": f"/api/v1/media/download?{query}",
        "available": True,
        "approx_size": None,
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
