import ipaddress
import logging
import uuid
from urllib.parse import parse_qs, urlparse

from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.config import settings
from app.core.deps import get_current_user_id
from app.core.rate_limit import check_rate_limit
from app.schemas.media import MediaResolveOut, MediaResolveRequest
from app.services.media import PLATFORMS, detect_platform, resolve_media

router = APIRouter(tags=["media"])
log = logging.getLogger("sqlhub.media")

_BLOCKED_SUFFIXES = (".local", ".internal", ".lan", ".localhost", ".invalid")
_BLOCKED_HOSTS = {
    "localhost",
    "metadata.google.internal",
    "metadata.google.com",
}


def _reject_private_url(url: str) -> None:
    """SSRF guard: block localhost / private / link-local / metadata targets.

    resolve_media hands the URL to cobalt/yt-dlp (server-side fetches), so a
    raw http(s) check is not enough — an attacker could otherwise make the
    server probe internal addresses.
    """
    p = urlparse(url)
    host = (p.hostname or "").lower()
    if not host or p.scheme not in ("http", "https"):
        raise HTTPException(422, "valid http(s) url required")
    if host in _BLOCKED_HOSTS or host.endswith(_BLOCKED_SUFFIXES):
        raise HTTPException(422, "URL host is not allowed")
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        # Hostname: block obvious internal names; DNS-resolved IPs are
        # still filtered by yt-dlp/cobalt timeouts, and full DNS-pinning
        # belongs at the proxy layer for self-hosted deploys.
        return
    if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved:
        raise HTTPException(422, "URL host is not allowed")


def _rate_limit(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(f"media:{ip}", settings.media_rate_limit_per_min):
        raise HTTPException(429, "Too many resolve requests — slow down")


@router.get("/media/platforms")
def platforms(uid: uuid.UUID = Depends(get_current_user_id)):
    return PLATFORMS


@router.post("/media/resolve", response_model=MediaResolveOut)
async def resolve(
    payload: MediaResolveRequest,
    request: Request,
    uid: uuid.UUID = Depends(get_current_user_id),
):
    _rate_limit(request)
    url = (payload.url or "").strip()
    _reject_private_url(url)
    p = urlparse(url)

    if "list" in parse_qs(p.query):
        raise HTTPException(422, "playlists not supported in v1 (single video only)")
    try:
        data = await resolve_media(url, payload.quality or "720")
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        log.warning("media resolve failed for %s: %s", url, e)
        raise HTTPException(502, "resolve failed — upstream unavailable")
    return {"platform": detect_platform(url), **{k: v for k, v in data.items() if k != "platform"}}
