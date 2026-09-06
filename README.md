# Dev-Utils (SQL Hub)

Query library + developer utilities. FastAPI backend (Postgres-ready, SQLite for local dev), React + Vite + Tailwind frontend.

## What it does (for users)

- **Query library** — sections grouping versioned SQL snippets with `{{variable}}` placeholders, live substitution, copy-with-values, pinning to Home, full-text search across titles, purpose, and SQL.
- **Notes & Snippets** — sticky-note grid on Home and `/notes`, sort by created/modified/custom drag-drop order.
- **Script Library** — server script paths with purpose + steps.
- **14 developer utilities** — Data Formatter, SQL Differ, Time Converter, JSON Formatter, Base64 + URL Codec, JWT Decoder, UUID Generator, Regex Tester, Base Converter, JSON↔YAML, Text Toolkit, Hash Generator (hub at 🧰 Utilities, fuzzy-searchable via `Ctrl+K`).
- **Snapshots** — one-click version snapshots with remark + destructive-restore guard (🕘 Versions).
- **20 color themes** — picker in the topbar with live preview; add your own in 3 steps (`frontend/THEMES.md`).

## Layout

- `backend/` — FastAPI + SQLAlchemy 2 + Pydantic v2, managed with `uv`
- `frontend/` — React 19 + TypeScript + Tailwind v4 + React Router
- `SQL_HUB_v1.html` — original single-file prototype (reference only)
- `frontend/THEMES.md` — how to add a color theme in 3 steps

## Prerequisites

- Python 3.11+ with `uv` (`curl -LsSf astral.sh/uv/install.sh | sh`)
- Node 20+ with npm

## Run it

Backend (http://127.0.0.1:8001, docs at `/docs`):

```sh
cd backend
cp .env.example .env   # first time only
uv sync
uv run uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Frontend (http://127.0.0.1:5174, proxies `/api` to the backend):

```sh
cd frontend
npm install            # first time only
npm run dev -- --host 127.0.0.1 --port 5174
```

Seed demo data (optional):

```sh
cd backend
PYTHONPATH=. uv run python scripts/seed_db.py
```

## Env (`backend/.env`)

| Key | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./sqlhub.db` | Use `postgresql+psycopg2://user:pass@host:5432/db` for Postgres |
| `AUTH_ENABLED` | `true` | Email+password login; set `false` for legacy single-user mode |
| `ALLOW_SIGNUP` | `true` | Open registration; set `false` to close it after onboarding |
| `JWT_EXPIRE_DAYS` | `7` | Bearer token lifetime |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Default does not include 5174 — rely on the vite proxy in dev, or add your frontend origin |
| `JWT_SECRET` | `change-me-in-prod` | Signs login tokens — set a long random value in prod |

## Accounts & access control

- **Private workspaces** — every account sees only its own queries, notes, scripts, and snapshots.
- **First account becomes admin** — register in the UI, or headless: `PYTHONPATH=. uv run python scripts/create_admin.py --email you@team.com --password '...'`. The first admin inherits any legacy single-user content.
- **Admins** manage accounts on the 👥 Users page (deactivate/reactivate). Deactivated users are signed out immediately; admins cannot deactivate themselves.
- **Closing signup** — set `ALLOW_SIGNUP=false` and restart; existing logins keep working.
- **Single-user mode** — set `AUTH_ENABLED=false` to skip login entirely (everything attributed to the local user, as before).

Never commit `.env` (gitignored). `.env.example` is the template.

## Test / lint / build

```sh
cd backend && uv sync --group dev && uv run pytest   # API tests (SQLite, isolated)
cd frontend && npm ci && npm run lint                # oxlint (first install: npm install locally)
cd frontend && npm test              # vitest (pure lib functions)
cd frontend && npm run build         # tsc + vite production build
```

CI (`.github/workflows/ci.yml`) runs all of the above on every push/PR.

## Conventions for collaborators

- Small, single-purpose commits; `main` is always deployable.
- Backend: routers in `app/api/v1/`, models in `app/models/`, validation in `app/schemas/`, shared logic in `app/services/`. UUID path params (FastAPI parses them; never pass raw strings to SQLAlchemy `Uuid` columns).
- Frontend: reusable primitives in `components/ui.tsx`; pure logic in `lib/` with vitest coverage; new utility = 1 row in `lib/utils-registry.ts` + panel + route; new theme = see `THEMES.md`.

## Self-hosting (production)

No Docker files yet — plain processes behind a reverse proxy. Steps below assume Ubuntu + a domain pointing at the box.

**1. Backend** — needs Python 3.11+, Postgres recommended:

```sh
cd backend
cp .env.example .env && nano .env   # set DATABASE_URL, JWT_SECRET, CORS_ORIGINS
uv sync
uv run uvicorn app.main:app --host 127.0.0.1 --port 8001 --workers 2
```

For Postgres: `DATABASE_URL=postgresql+psycopg2://user:pass@localhost:5432/sqlhub`. Tables + the `sort_order`-style columns self-create on startup (`ensure_columns()`); data migrates by simply pointing at the new DB and re-seeding if needed.

**2. Frontend** — static build served by the proxy (no Node needed at runtime):

```sh
cd frontend
npm ci && npm run build   # outputs frontend/dist/
```

**3. Reverse proxy** (Caddy example — handles HTTPS automatically):

```
yourdomain.com {
    root * /path/to/Dev-Utils/frontend/dist
    file_server
    handle /api/* {
        reverse_proxy 127.0.0.1:8001
    }
    handle {
        try_files {path} /index.html
    }
}
```

The built app calls same-origin `/api/v1`, so no extra CORS work when proxied this way.

**4. Keep it running** — minimal systemd unit for the API (adjust paths/user):

```ini
[Unit]
Description=Dev-Utils API
After=network.target postgresql.service

[Service]
User=www-data
WorkingDirectory=/path/to/Dev-Utils/backend
ExecStart=/home/www-data/.local/bin/uv run uvicorn app.main:app --host 127.0.0.1 --port 8001 --workers 2
Restart=always

[Install]
WantedBy=multi-user.target
```

**5. Backups** — SQLite: copy `backend/sqlhub.db` nightly. Postgres: `pg_dump`. Plus periodic **Versions snapshots** in-app (stored in-DB, so they ride along with DB backups).

**Security notes** — read before exposing publicly:

- With auth on (default), all data endpoints require a Bearer token and data is per-account — but there is no rate-limiting or 2FA, so still prefer private network/VPN for sensitive deployments, or add proxy-level basic-auth in front.
- Set a real `JWT_SECRET` and correct `CORS_ORIGINS` in production.
- With `AUTH_ENABLED=false` there is no login at all: anyone with the URL can read *and* modify everything.
- Never commit `.env` (gitignored). `.env.example` is the template.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Frontend shows empty lists, API `connection refused` | Backend isn't running or wrong port — check `curl 127.0.0.1:8001/health`; vite proxies `/api` → `localhost:8001` (`frontend/vite.config.ts`) |
| `500` on detail/update/delete routes | You passed a raw string where a UUID column was expected — annotate path params as `uuid.UUID` (regression-tested) |
| `Outdated Optimize Dep` in dev after `npm install` | Restart vite with `--force` to re-optimize |
| Old theme stuck after upgrade | Clear `sqlhub_theme` in localStorage (legacy `'light'` auto-migrates to `'gray-light'`) |
