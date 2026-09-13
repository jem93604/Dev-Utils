# Deployment Log for Agents — GCP e2-micro (2026-09-13)

> What actually shipped, how, and what bit us. Read this before touching
> prod deploy files. Companion for humans: `DEPLOYMENT_NOTES_PERSONAL.md`.
> Setup walkthrough: `GCP_SETUP_GUIDE.md`.

## TL;DR

- Target: single GCP `e2-micro` (1 vCPU shared, 1 GB RAM) in
  `us-central1-a`, project `dev-utils-508417`, VM
  `instance-20260912-194202`, static IP (was `35.208.100.56` at deploy
  time — re-check console, it can change if released).
- Stack (`docker-compose.prod.yml`): `db` (postgres:16-alpine + `pgdata`
  volume) + `api` (FastAPI/Uvicorn on internal `:8001`) + `web`
  (Caddy 2 serving `frontend/dist`, proxying `/api/*` + `/health` to
  `api:8001`).
- Branch: `deploy/gcp-e2micro` cut from `main`. Commits so far:
  `46d606d` (containers + compose + guide), `e1f9cef` (Caddy `/health`
  proxy fix), `2d5f3a9` (`httpx` promoted to runtime dep).
- Status at write time: all three services `Up`, `GET /health` →
  `{"ok":true}`, `GET /api/v1/auth/status` → `auth_enabled:true`,
  browser Sign in/Register works.

## Architecture (prod only, dev differs)

| Layer | Prod | Dev (contrast) |
|---|---|---|
| Edge | Caddy 2 (`frontend/Dockerfile` stage `caddy:2-alpine`, `frontend/Caddyfile`), `:80`/`:443`, static `/srv` + `reverse_proxy api:8001` | None — Vite dev `:5174` proxies `/api → localhost:8001` |
| App | Uvicorn `app.main:app --host 0.0.0.0 --port 8001` (`backend/Dockerfile` CMD), port only `expose`d, never published | Same Uvicorn, direct |
| DB | Postgres 16-alpine, internal `:5432`, named volume `pgdata` | SQLite file / in-memory for tests |
| Frontend routing | `HashRouter` (`frontend/src/App.tsx`) — no SPA rewrite needed; Caddy `try_files {path} /index.html` is belt-and-braces | Same |
| API base | Relative `/api/v1` (`frontend/src/lib/api.ts`) — requires same-origin proxy | Same via Vite proxy |

## Files added/changed for deploy

- `backend/Dockerfile` — `python:3.11-slim`, `ffmpeg` + `curl` (yt-dlp
  media + HEALTHCHECK), `uv sync --frozen --no-dev`, `CMD uvicorn`.
- `backend/.dockerignore` — excludes `.venv`, `__pycache__`, `.env`,
  `*.db`, `tests/`.
- `backend/pyproject.toml` + `backend/uv.lock` — **`httpx` moved from
  `dev` group to runtime deps** (see gotcha #1). Lockfile regenerated
  with `uv lock --project backend`.
- `frontend/Dockerfile` — `node:22-alpine` build (`npm ci` + `npm run
  build`) → `caddy:2-alpine` serving `/srv`.
- `frontend/.dockerignore` — excludes `node_modules`, `dist`, `.git`.
- `frontend/Caddyfile` — matcher MUST be `@api path /api/* /health`
  (see gotcha #2). Static + gzip + immutable `/assets/*` cache.
- `docker-compose.prod.yml` — `db`/`api`/`web` as above. `DATABASE_URL`
  is templated from `${POSTGRES_PASSWORD}` so api+db always agree.
  `backend/.env` supplies the rest (JWT, CORS, auth flags).
- `GCP_SETUP_GUIDE.md` / `.pdf` — browser console walkthrough.

## Env contract (three passwords, three places — do not mix up)

1. **Postgres** → `~/Dev-Utils/.env` (compose project root, auto-loaded
   by Compose): `POSTGRES_PASSWORD=<long-random>`.
   Feeds both `db.POSTGRES_PASSWORD` and `api.DATABASE_URL`.
2. **JWT** → `~/Dev-Utils/backend/.env`: `JWT_SECRET=<long-random>`,
   plus `CORS_ORIGINS=http://<STATIC-IP>` (or domain),
   `AUTH_ENABLED=true`, `ALLOW_SIGNUP=true`.
3. **Login user** → set in browser at `#/login` → `Register` tab.
   First-ever user becomes admin and adopts legacy content
   (`adopt_legacy_content` in `backend/app/api/v1/auth.py`).

Critical: changing `POSTGRES_PASSWORD` in `.env` after `pgdata` exists
does NOT change the password inside Postgres → `FATAL: password
authentication failed for user "sqlhub"`. Either `ALTER USER` inside
the DB or `down -v` (destroys data). Details in gotcha #3.

## Build/deploy procedure that works on e2-micro

VM has 1 GB RAM + throttled burstable CPU. `web` build (`npm ci` +
`tsc -b` + `vite build` over react/mermaid/katex/tailwind) took
**~1160 s** cold and OOM-hangs if parallel.

```bash
# one-time: Docker repo (docker-compose-plugin is NOT in Debian defaults)
sudo apt-get update && sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/debian bookworm stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update && sudo apt-get install -y \
  docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin git

# one-time: 2 GB swap is REQUIRED for the node build on 1 GB RAM
sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile

# deploy / update
cd ~/Dev-Utils
git pull origin deploy/gcp-e2micro
export DOCKER_BUILDKIT=1 BUILDKIT_PROGRESS=plain
docker compose -f docker-compose.prod.yml build api   # then web, NEVER together
docker compose -f docker-compose.prod.yml build web
docker compose -f docker-compose.prod.yml up -d --no-build

# verify
docker compose -f docker-compose.prod.yml ps
curl -s http://127.0.0.1/health; echo
curl -s http://127.0.0.1/api/v1/auth/status; echo
```

## Gotchas hit this session (read before debugging)

1. **`httpx` ModuleNotFoundError crashed every api worker → all
   `/api/*` 502.** `backend/app/services/media.py:8` does `import
   httpx` at module load, but `httpx` was in the `dev` dependency
   group while the image builds `uv sync --no-dev`. Local dev/tests
   never noticed because dev env has it. Fix: promote to runtime deps
   + `uv lock`. Lesson: any top-level import in `backend/app/**` must
   be a runtime dep; grep before adding `--no-dev` images.
2. **Caddy returned empty for `/health`.** Matcher was `@api path
   /api/*` so `/health` fell through to `try_files` static and returned
   nothing. Fix: `@api path /api/* /health`. Lesson: every path the
   frontend or healthcheck hits outside `/api` must be in the proxy
   matcher; `/health` lives at root (`backend/app/main.py`).
3. **`FATAL: password authentication failed for user "sqlhub"` after
   changing `.env`.** Postgres only reads `POSTGRES_PASSWORD` at
   volume init; later env changes affect `api.DATABASE_URL` but not the
   DB role. Also `docker exec db printenv POSTGRES_PASSWORD` shows the
   container env, NOT the real DB password — syncing from it cannot fix
   a mismatch. Fix without data loss:
   `docker exec -u postgres <db> psql -U sqlhub -d sqlhub -c "ALTER USER
   sqlhub WITH PASSWORD '<.env-value>'"` then `up -d api`. Nuclear
   option: `down -v` (deletes `pgdata`).
4. **Tests "failed" when run from repo root.** `backend/tests/conftest.py`
   pins `AUTH_ENABLED=false` via `setdefault`, but a local
   `backend/.env` with `AUTH_ENABLED=true` overrides it because
   pydantic-settings reads the env file. Per `AGENTS.md`, backend tests
   MUST run from `backend/` (`cd backend && uv run pytest`) → 49
   passed. Lesson: never run backend pytest from repo root.
5. **No Sign in button with auth on = stale `web` build or cache.**
   `Topbar` (`frontend/src/components/Nav.tsx`) only renders `Sign in`
   when `authEnabled && !authUser`; `LoginPage` holds the
   `Sign in | Register` tabs. There is no global signup button by
   design. If `/api/v1/auth/status` says `auth_enabled:true` but the UI
   lacks it → `build web` + hard refresh (`Ctrl+Shift+R`).
6. **`<VAR>` placeholders break bash.** `POSTGRES_PASSWORD=<same>`
   parses as input redirection (`-bash: same-as-before: No such
   file`). Always use `$(...)` or a real value; prefer persisting
   `POSTGRES_PASSWORD` in `~/Dev-Utils/.env` so bare `up -d` works.

## Decisions / non-goals

- Co-located Postgres on the VM (not Neon/Supabase, not RDS): only way
  to stay $0 forever in-cloud with always-on. AWS RDS free is 12 months
  only; verified during planning.
- Single VM + Caddy over Cloud Run split: always-on Cloud Run for a
  full month exceeds free vCPU-seconds and would bill.
- Media/yt-dlp kept enabled with `ffmpeg` in image; 1 GB/mo egress cap
  is the known risk, workarounds deferred per user.
- `main` untouched; all deploy work on `deploy/gcp-e2micro`, to be
  merged later.

## Open items

- Custom domain + Caddy auto-TLS (currently plain HTTP on static IP).
- Nightly `pg_dump` to Cloud Storage free bucket (planned, not wired).
- CI deploy job on `deploy/gcp-e2micro` push (`.github/workflows/ci.yml`
  still test-only).
- Consider removing GCP ops-agent module to save RAM on 1 GB VM.
