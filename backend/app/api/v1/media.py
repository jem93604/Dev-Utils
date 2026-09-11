from urllib.parse import parse_qs, urlparse

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.schemas.media import MediaResolveOut, MediaResolveRequest
from app.services.media import (
    PLATFORMS,
    build_variants,
    cleanup_download_dir,
    detect_platform,
    download_media,
    resolve_media,
    sanitize_filename,
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

    if "list" in parse_qs(p.query):
        raise HTTPException(422, "playlists not supported in v1 (single video only)")
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
    if "list" in parse_qs(p.query):
        raise HTTPException(422, "playlists not supported in v1 (single video only)")
    return url


@router.get("/media/download")
async def download(
    url: str = Query(..., description="Source video URL"),
    quality: str = Query("720"),
    audio_only: bool = Query(False),
):
    src = _validate_download_url(url)
    try:
        dl = await download_media(src, quality or "720", bool(audio_only))
    except RuntimeError as e:
        raise HTTPException(502, str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"download failed: {e}")
    filename = sanitize_filename(dl["filename"])
    return FileResponse(
        dl["path"],
        media_type=dl["media_type"],
        filename=filename,
        background=BackgroundTask(cleanup_download_dir, dl["tmpdir"]),
    )
