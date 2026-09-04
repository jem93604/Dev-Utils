# Dev-Utils (SQL Hub)

Query library + developer utilities. FastAPI backend (Postgres-ready, SQLite for local dev), React + Vite + Tailwind frontend.

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
| `AUTH_ENABLED` | `false` | Single-user mode; JWT auth lands with multi-user |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Add your frontend origin |
| `JWT_SECRET` | `change-me-in-prod` | Required when `AUTH_ENABLED=true` |

Never commit `.env` (gitignored). `.env.example` is the template.

## Test / lint / build

```sh
cd backend && uv run pytest          # API tests (SQLite, isolated)
cd frontend && npm run lint          # oxlint
cd frontend && npm test              # vitest (pure lib functions)
cd frontend && npm run build         # tsc + vite production build
```

CI (`.github/workflows/ci.yml`) runs all of the above on every push/PR.

## Conventions for collaborators

- Small, single-purpose commits; `main` is always deployable.
- Backend: routers in `app/api/v1/`, models in `app/models/`, validation in `app/schemas/`, shared logic in `app/services/`. UUID path params (FastAPI parses them; never pass raw strings to SQLAlchemy `Uuid` columns).
- Frontend: reusable primitives in `components/ui.tsx`; pure logic in `lib/` with vitest coverage; new utility = 1 row in `lib/utils-registry.ts` + panel + route; new theme = see `THEMES.md`.
