from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException

from app.schemas.media import MediaResolveOut, MediaResolveRequest
from app.services.media import PLATFORMS, detect_platform, resolve_media

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
    from urllib.parse import parse_qs

    if "list" in parse_qs(p.query):
        raise HTTPException(422, "playlists not supported in v1 (single video only)")
    try:
        data = await resolve_media(url, payload.quality or "720")
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"resolve failed: {e}")
    return {"platform": detect_platform(url), **{k: v for k, v in data.items() if k != "platform"}}
