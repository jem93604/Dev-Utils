# Zero-Egress YouTube Downloads (`feat/zero-egress-downloads`)

Worktree: `/home/jem9/Dev-Utils-zero-egress` — branch `feat/zero-egress-downloads`.
`main` (`/home/jem9/Dev-Utils`) is untouched (deploy in progress).

## Goal

Keep downloads working while server egress for media bytes goes to **zero**.
Server does extraction only (`yt-dlp extract_info(download=False)` → JSON),
bytes flow **YouTube → user device**.

## Flow

```
POST /api/v1/media/resolve  →  title, thumbnail, formats[] (with signed url + expires_in),
                                variants[] (redirect_endpoint + direct_url + needs_mux)
GET  /api/v1/media/go?url=…&quality=720&format_id=18  →  302 to signed googlevideo URL
Browser anchor <a href target=_blank>  →  YouTube → device (no fetch→blob, no CORS needed)
```

- `redirect_endpoint` is primary (hides signatures, re-extracts on expiry).
- `direct_url` is fallback (raw signed URL).
- `expires_in` is best-effort TTL from `?expire=`/`exp=` (5–6 min typical, 1 h max).
  `None` means "use immediately".
- `needs_mux=true` means DASH split (video-only) — needs client mux (see below).

## Why no progress bar / no fetch→blob

`googlevideo.com` sends no CORS headers, so `fetch(url).then(r => r.blob())`
fails. Anchor navigation works without CORS. No progress events, no custom
filename (CD headers control it) — accepted tradeoff.

## IP lock (primary concern)

Signed URLs are often locked to the extracting IP. Server-extracted URL may
403 on the client.

- Tier 1 (this branch): use redirect **immediately** (5–6 min window), measure 403 rate.
- Manual check: `PYTHONPATH=. uv run python scripts/check_direct_ip.py "<youtube-url>"`
  extracts on the server, prints the signed URL + expiry, and tells you what to
  `curl -I` from a second IP. High 403 → go Tier 2.
- Tier 2 (follow-up, not in this branch): browser calls YouTube Innertube Player
  API directly (e.g. `youtubei.js`) so URLs lock to the **client** IP. Server
  becomes metadata-assist only. Still zero egress.

## ffmpeg.wasm mux (client-only, best-effort)

1080p+ YouTube is usually DASH split: video-only + audio-only, no progressive.
Options:

1. Prefer progressive ≤720p — one file, no mux, always works via anchor.
2. For split streams (`needs_mux=true`), mux in the browser with ffmpeg.wasm
   **only if** both URLs allow CORS fetch (most googlevideo URLs do not):

```ts
// lazy-load so the main bundle stays small
// npm i @ffmpeg/ffmpeg @ffmpeg/util
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

const ffmpeg = new FFmpeg();
await ffmpeg.load(); // needs COOP/COEP headers for SharedArrayBuffer in some builds
await ffmpeg.writeFile("video.mp4", await fetchFile(videoOnlyUrl));
await ffmpeg.writeFile("audio.m4a", await fetchFile(audioOnlyUrl));
await ffmpeg.exec(["-i", "video.mp4", "-i", "audio.m4a", "-c", "copy", "out.mp4"]);
const data = await ffmpeg.readFile("out.mp4");
```

If `fetchFile` throws (CORS), fall back to progressive. MP3 conversion still
needs full audio fetch + encode — heavy in wasm; prefer direct `.m4a`/`.webm`
audio link when offered.

No `@ffmpeg` dep is installed in this branch — add it only when building the
mux UI, behind a lazy import.

## Files changed (worktree only)

- `backend/app/services/media.py` — `resolve_via_ytdlp` returns signed `url`,
  `category`/`is_progressive`/`expires_in`; new `_expiry_ttl`,
  `_pick_direct_format`, `resolve_direct_url`; `build_variants` adds
  `redirect_endpoint`/`direct_url`/`expires_in`/`needs_mux`.
- `backend/app/schemas/media.py` — `MediaFormat`/`MediaVariant` extended.
- `backend/app/api/v1/media.py` — new `GET /media/go` (YouTube-only 302,
  reuses `_validate_download_url` + `strip_playlist_params` + `detect_platform`,
  no raw URL passthrough). `GET /media/download` kept as fallback for
  non-YouTube / no-direct-link cases.
- `frontend/src/utils/linksaver/lib.ts` — `formatExpiry`, `directHrefFor`,
  `isZeroEgress`.
- `frontend/src/utils/linksaver/Panel.tsx` — anchor navigation first,
  expiry labels, `mux` badge, zero-egress tag.
- `backend/tests/test_media.py` — redirect tests (appended).
- `frontend/src/utils/linksaver/lib.test.ts` — helper tests (appended).
- `backend/scripts/check_direct_ip.py` — manual IP-lock probe (new).
