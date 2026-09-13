# My Deployment Notes — SQL Hub on GCP (2026-09-13)

> Plain-language record of what we set up, for future-me. Agent
> runbook: `DEPLOYMENT_NOTES_AGENTS.md`. Click-by-click setup:
> `GCP_SETUP_GUIDE.md`.

## What is running and where

- **VM:** `instance-20260912-194202`, `e2-micro` (1 GB RAM), zone
  `us-central1-a` (Iowa — one of the 3 always-free zones), 30 GB
  **standard** disk (balanced would bill ~$1/mo), HTTP+HTTPS firewall
  open. Project: `dev-utils-508417`.
- **IP:** static address `sql-hub-ip` (was `35.208.100.56` — check
  **VPC → IP addresses** if unsure). Open `http://<IP>/` in the browser.
- **Code:** branch `deploy/gcp-e2micro` on GitHub (I kept `main` clean;
  we'll merge later). The VM clones that branch.
- **Bill:** $0/mo as long as it stays e2-micro + standard disk ≤30 GB +
  egress under ~1 GB/mo. The console estimate showed $7.11 — that's list
  price; the free-tier discount appears in **Billing → Reports** after
  ~24 h, and the $300 trial covers the first 90 days anyway.

## The three passwords (don't mix them up)

| # | What | Where it lives | How to change |
|---|---|---|---|
| 1 | Postgres | `~/Dev-Utils/.env` on the VM → `POSTGRES_PASSWORD=...` | Edit `.env`, then read the warning below |
| 2 | App signing key | `~/Dev-Utils/backend/.env` → `JWT_SECRET=...`, plus `CORS_ORIGINS=http://<IP>` | Edit file, restart `api` |
| 3 | Your login | Browser → `#/login` → **Register** tab | Just register; first user becomes admin 👑 |

⚠️ **Postgres warning I learned the hard way:** changing the password
in `.env` after the database already exists does NOT change it inside
the database — the app then fails with `password authentication failed`.
If that happens, run this (replace with your real password):

```bash
docker exec -u postgres $(docker compose -f docker-compose.prod.yml ps -q db) \
  psql -U sqlhub -d sqlhub -c "ALTER USER sqlhub WITH PASSWORD 'your-long-password'"
docker compose -f docker-compose.prod.yml up -d api
```

## Commands I actually use (all on the VM over SSH)

```bash
cd ~/Dev-Utils
docker compose -f docker-compose.prod.yml ps                              # who's up?
curl -s http://127.0.0.1/health; echo                                     # expect {"ok":true}
curl -s http://127.0.0.1/api/v1/auth/status; echo                         # expect auth_enabled:true
docker compose -f docker-compose.prod.yml logs --tail=40 api              # app errors
docker compose -f docker-compose.prod.yml logs --tail=30 web              # proxy errors
docker compose -f docker-compose.prod.yml logs --tail=20 db               # database errors
```

Update to the latest pushed code (build one at a time — the little VM
can't handle both at once, and the frontend build takes ~20 min first
time):

```bash
cd ~/Dev-Utils
git pull origin deploy/gcp-e2micro
docker compose -f docker-compose.prod.yml build api
docker compose -f docker-compose.prod.yml build web
docker compose -f docker-compose.prod.yml up -d --no-build
```

Restart just the app after editing `backend/.env`:

```bash
docker compose -f docker-compose.prod.yml up -d api
```

## What went wrong and how we fixed it

1. **`docker-compose-plugin` not found** — Debian doesn't ship it;
   added Docker's official repo first, then install worked.
2. **Docker got stuck / VM stopped** — 1 GB RAM can't build the
   frontend without swap. Added 2 GB swap, built `api` then `web`
   separately. Never `up -d --build` (builds in parallel).
3. **Empty reply from `/health`** — Caddy only forwarded `/api/*`.
   Fixed config to also forward `/health`.
4. **All API calls 502 `No module named 'httpx'`** — the media feature
   needs `httpx` but it was dev-only, so the prod image lacked it.
   Moved it to real dependencies, rebuilt `api`.
5. **DB password errors** — see warning above; resynced with
   `ALTER USER`.
6. **No Sign in button** — there is no global signup button by design:
   top bar shows **Sign in**, and the login page has **Sign in |
   Register** tabs. Old cached frontend also hides it → rebuild `web`
   + hard refresh (`Ctrl+Shift+R`).

## Monthly 2-minute check (stay free)

1. **Billing → Reports** → project `dev-utils-508417` → confirm $0.
2. VM still `e2-micro` in `us-central1`, disk standard ≤30 GB.
3. Static IP still attached to the running VM (unattached IPs bill).
4. Go easy on media downloads — the 1 GB/mo transfer cap is the only
   tight limit.

## Still to do

- [ ] Point a domain at the IP for HTTPS (Caddy does certs automatically).
- [ ] Nightly database backup to free Cloud Storage.
- [ ] Merge `deploy/gcp-e2micro` into `main` when happy.
- [ ] Auto-deploy from GitHub push (currently I SSH + `git pull`).
