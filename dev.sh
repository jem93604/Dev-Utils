#!/usr/bin/env bash
#
# Run backend + frontend together with one command:
#
#   ./dev.sh
#
# Backend:  http://127.0.0.1:8001 (docs at /docs)
# Frontend: http://127.0.0.1:5174 (proxies /api -> backend)
#
# Flags:
#   --no-install     skip auto-install of .venv / node_modules
#   --seed           seed demo data before starting (needs PYTHONPATH=.)
#   --backend-only   run backend only
#   --frontend-only  run frontend only
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"
BACKEND_PORT="${BACKEND_PORT:-8001}"
FRONTEND_PORT="${FRONTEND_PORT:-5174}"
BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}/health"
FRONTEND_URL="http://127.0.0.1:${FRONTEND_PORT}"

DO_INSTALL=true
DO_SEED=false
BACKEND_ONLY=false
FRONTEND_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --no-install) DO_INSTALL=false ;;
    --seed) DO_SEED=true ;;
    --backend-only) BACKEND_ONLY=true ;;
    --frontend-only) FRONTEND_ONLY=true ;;
    -h|--help)
      echo "Usage: ./dev.sh [--no-install] [--seed] [--backend-only] [--frontend-only]"
      echo ""
      echo "Runs backend (127.0.0.1:8001) + frontend (127.0.0.1:5174) together."
      echo "Ctrl+C stops both. First run auto-creates backend/.env,"
      echo "backend .venv (uv sync), and frontend node_modules (npm install)."
      exit 0
      ;;
    *) echo "Unknown flag: $arg (try --help)" >&2; exit 1 ;;
  esac
done

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  # shellcheck disable=SC2086
  if [ -n "$BACKEND_PID$FRONTEND_PID" ]; then
    echo ""
    echo "Shutting down..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    wait 2>/dev/null || true
  fi
}
trap cleanup INT TERM EXIT

need() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing required command: $1" >&2; exit 1; }
}

port_in_use() {
  (command -v ss >/dev/null 2>&1 && ss -ltn "sport = :$1" | grep -q ":$1") || \
  (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

# First-run setup -----------------------------------------------------------
if [ "$FRONTEND_ONLY" = false ]; then
  need uv
  if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo "Backend .env missing — copying from .env.example"
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  fi
  if [ "$DO_INSTALL" = true ] && [ ! -d "$BACKEND_DIR/.venv" ]; then
    echo "Backend .venv missing — running: uv sync (in backend/)"
    (cd "$BACKEND_DIR" && uv sync)
  fi
fi

if [ "$BACKEND_ONLY" = false ]; then
  need npm
  if [ "$DO_INSTALL" = true ] && [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "Frontend node_modules missing — running: npm install (in frontend/)"
    (cd "$FRONTEND_DIR" && npm install)
  fi
fi

if [ "$DO_SEED" = true ]; then
  echo "Seeding demo data..."
  (cd "$BACKEND_DIR" && PYTHONPATH=. uv run python scripts/seed_db.py)
fi

# Preflight: fail fast with a clear message if a port is taken --------------
if [ "$FRONTEND_ONLY" = false ] && port_in_use "$BACKEND_PORT"; then
  echo "Port $BACKEND_PORT is already in use — is the backend already running?" >&2
  echo "Stop it first, or run with BACKEND_PORT=<free-port> ./dev.sh (and update the vite proxy)." >&2
  exit 1
fi
if [ "$BACKEND_ONLY" = false ] && port_in_use "$FRONTEND_PORT"; then
  echo "Port $FRONTEND_PORT is already in use — is the frontend already running?" >&2
  echo "Stop it first, or run with FRONTEND_PORT=<free-port> ./dev.sh." >&2
  exit 1
fi

# Start ----------------------------------------------------------------------
if [ "$FRONTEND_ONLY" = false ]; then
  echo "Starting backend  -> http://127.0.0.1:${BACKEND_PORT} (docs at /docs)"
  (cd "$BACKEND_DIR" && uv run uvicorn app.main:app --host 127.0.0.1 --port "$BACKEND_PORT") &
  BACKEND_PID=$!
fi

if [ "$BACKEND_ONLY" = false ] && [ "$FRONTEND_ONLY" = false ]; then
  echo "Waiting for backend $BACKEND_URL ..."
  for _ in $(seq 1 60); do
    if curl -fsS "$BACKEND_URL" >/dev/null 2>&1; then
      break
    fi
    # Bail out early if the backend died
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
      echo "Backend failed to start — see output above." >&2
      wait "$BACKEND_PID" 2>/dev/null || true
      exit 1
    fi
    sleep 0.5
  done
  if ! curl -fsS "$BACKEND_URL" >/dev/null 2>&1; then
    echo "Backend did not become healthy at $BACKEND_URL" >&2
    kill "$BACKEND_PID" 2>/dev/null || true
    exit 1
  fi
fi

if [ "$BACKEND_ONLY" = false ]; then
  echo "Starting frontend -> $FRONTEND_URL"
  (cd "$FRONTEND_DIR" && npm run dev -- --host 127.0.0.1 --port "$FRONTEND_PORT") &
  FRONTEND_PID=$!
fi

echo ""
echo "Ready:  frontend $FRONTEND_URL  |  backend http://127.0.0.1:${BACKEND_PORT} (health $BACKEND_URL)"
echo "Press Ctrl+C to stop both."
echo ""

wait $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
