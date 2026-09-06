# AGENTS.md

Two independent apps, no shared workspace tooling. Run commands from the listed subdir.

- `backend/` — FastAPI + SQLAlchemy 2 + Pydantic v2, managed with `uv` (not pip). Python 3.11+.
- `frontend/` — React 19 + TS + Tailwind v4 + React Router, Vite dev on port 5174, proxies `/api` → `http://localhost:8001`.
- `SQL_HUB_v1.html` — frozen prototype, reference only. Never port or edit.

## Commands

Backend (from `backend/`, `uv run` required — `.venv` is not on PATH):
```sh
uv sync                                  # install (CI uses `uv sync --group dev` for pytest/httpx)
uv run uvicorn app.main:app --host 127.0.0.1 --port 8001
uv run pytest                            # full suite (SQLite, isolated); single test: uv run pytest tests/test_x.py -k name
PYTHONPATH=. uv run python scripts/seed_db.py   # seed demo data, needs PYTHONPATH=.
```
Frontend (from `frontend/`):
```sh
npm install   # first time (CI uses `npm ci`)
npm run dev -- --host 127.0.0.1 --port 5174
npm run lint  # oxlint
npm test      # vitest run (pure lib functions only)
npm run build # tsc -b + vite build; CI order is lint -> test -> build
```

Backend first-run: `cp .env.example .env`. Never commit `.env` (gitignored). Default DB is local SQLite (`sqlite:///./sqlhub.db`); Postgres via `DATABASE_URL=postgresql+psycopg2://...`.

## Gotchas

- Backend port is **8001**, not 8000. Frontend default `CORS_ORIGINS` covers 5173/3000 — add 5174 or rely on the vite proxy.
- UUID path params must be typed `uuid.UUID`, never raw `str` — strings 500 against `Uuid` columns (regression-tested).
- No Alembic flow in dev: tables + `sort_order`-style columns self-create at startup (`ensure_columns()` + `create_all`). Alembic is a prod-migration dependency only.
- `AUTH_ENABLED=false` (single-user, no login). `JWT_SECRET` required only when enabling auth.
- Frontend API calls use same-origin `/api/v1`; in dev that only works via the vite proxy, so the backend must be up (`curl 127.0.0.1:8001/health`).
- Stale `Outdated Optimize Dep` after `npm install` → restart vite with `--force`. Legacy `light` theme in localStorage auto-migrates to `gray-light`.

## Layout conventions

- Backend: routers `app/api/v1/`, models `app/models/`, validation `app/schemas/`, shared logic `app/services/`. Tests in `backend/tests/`.
- Frontend: primitives in `components/ui.tsx`; pure logic in `lib/` with vitest coverage; new utility = 1 row in `src/lib/utils-registry.ts` + panel + route; new theme = `frontend/THEMES.md` (3 steps).
- Small single-purpose commits; `main` always deployable.
