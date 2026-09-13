from urllib.parse import urlparse

import logging

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse

logger = logging.getLogger("sqlhub.media")

from app.schemas.media import MediaResolveOut, MediaResolveRequest
from app.services.media import (
    PLATFORMS,
    build_variants,
    detect_platform,
    resolve_direct_url,
    resolve_media,
    strip_playlist_params,
)

router = APIRouter(tags=["media"])


@router.get("/media/platforms")
def platforms():
    return PLATFORMS


@router.post("/media/resolve", response_model=MediaResolveOut)
async def resolve(payload: MediaResolveRequest):
    url = (payload.url or "").strip()
    p = urlparse(url)
    if p.scheme not in ("http", "https") or not p.hostname:
        raise HTTPException(422, "valid http(s) url required")
    # Playlist URLs resolve as a single video — ignore the list part.
    url = strip_playlist_params(url)
    try:
        data = await resolve_media(url, payload.quality or "720")
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"resolve failed: {e}")
    # One metadata fetch -> every quality/format link at once. The requested
    # quality only selects the highlighted default; no re-fetch needed.
    variants, default_endpoint = build_variants(
        url, data.get("formats"), data.get("source", "ytdlp"), payload.quality or "720"
    )
    return {
        "platform": detect_platform(url),
        "title": data.get("title", ""),
        "thumbnail": data.get("thumbnail", ""),
        "source": data.get("source", "ytdlp"),
        "download_url": data.get("download_url"),
        "duration": data.get("duration"),
        "formats": data.get("formats", []),
        "variants": variants,
        "download_endpoint": default_endpoint,
    }


def _validate_download_url(raw: str) -> str:
    url = (raw or "").strip()
    p = urlparse(url)
    if p.scheme not in ("http", "https") or not p.hostname:
        raise HTTPException(422, "valid http(s) url required")
    # Playlist URLs download as a single video — ignore the list part.
    return strip_playlist_params(url)


@router.get("/media/go")
async def go(
    url: str = Query(..., description="Source video URL"),
    quality: str = Query("720"),
    audio_only: bool = Query(False),
    format_id: str | None = Query(None, description="Exact yt-dlp format id"),
):
    """Zero-egress redirect: re-extract and 302 to the signed CDN URL.

    Bytes flow source CDN -> user device. The server only serves this
    redirect header — no download, no temp file, no media egress.
    URLs are short-lived (use within minutes) and may be IP-locked;
    the client should navigate immediately via anchor tag.
    """
    src = _validate_download_url(url)
    try:
        direct = await resolve_direct_url(src, quality or "720", bool(audio_only), format_id)
    except RuntimeError as e:
        raise HTTPException(502, str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"redirect failed: {e}")
    headers = {}
    if direct.get("expires_in"):
        headers["X-Direct-Expires-In"] = str(direct["expires_in"])
    if direct.get("format_id"):
        headers["X-Direct-Format"] = str(direct["format_id"])
    logger.info(
        "zero-egress redirect: platform=%s quality=%s audio_only=%s format_id=%s category=%s ext=%s expires_in=%s url=%s",
        detect_platform(src),
        quality,
        bool(audio_only),
        direct.get("format_id"),
        direct.get("category"),
        direct.get("ext"),
        direct.get("expires_in"),
        src,
    )
    return RedirectResponse(direct["url"], status_code=302, headers=headers)


@router.get("/media/download")
async def download(
    url: str = Query(..., description="Source video URL"),
    quality: str = Query("720"),
    audio_only: bool = Query(False),
):
    """Disabled: proxied downloads cost server egress. Use /media/go."""
    src = _validate_download_url(url)
    logger.warning("blocked server-egress download attempt: url=%s", src)
    raise HTTPException(
        410,
        "Server-side downloads are disabled (zero-egress mode). "
        "Use the direct link (/media/go redirect) instead.",
    )
