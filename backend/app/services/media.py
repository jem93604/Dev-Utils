import asyncio
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
        from yt_dlp import YoutubeDL

        opts = {"quiet": True, "skip_download": True, "noplaylist": True}
        with YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
        fmts = [
            {"id": str(f.get("format_id", "")), "quality": str(f.get("height", "") or f.get("format_note", "")),
             "ext": f.get("ext", ""), "url": None}
            for f in (info.get("formats") or [])[:20]
        ]
        return {"title": info.get("title", ""), "thumbnail": info.get("thumbnail", "") or "",
                "download_url": None, "formats": fmts}

    return await asyncio.to_thread(_extract)


async def resolve_media(url: str, quality: str = "720") -> dict:
    platform = detect_platform(url)
    try:
        data = await resolve_via_cobalt(url, quality)
        return {"platform": platform, **data, "source": "cobalt"}
    except Exception:
        data = await resolve_via_ytdlp(url, quality)
        return {"platform": platform, **data, "source": "ytdlp"}
