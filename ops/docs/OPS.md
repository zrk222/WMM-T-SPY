# Operations runbook (the app itself)

## Deploy

```bash
docker compose up -d mongo
npm ci && npm run build
MONGODB_URI=... JWT_SECRET=... npm start
```

Health: `GET /api/health` (liveness), `GET /api/health?deep=1` (readiness + counts).
Version: `GET /api/version`.

## Backup / restore

```powershell
./scripts/backup.ps1                 # writes backups/cloudops-<stamp>.archive.gz
./scripts/restore.ps1 -File <path>   # destructive, --drop
```

Drill quarterly; restore into a scratch database first.

## Incident response for the console itself

1. Check `/api/health?deep=1` and `/api/version`.
2. Roll back: redeploy previous image/commit; `JWT_SECRET` rotation logs everyone out.
3. If Mongo is down: restore from the latest archive, then re-run `npm run ensure-indexes`.
4. Suspend abuse accounts from `/admin`; the last-admin guard prevents lockout.

## Rotations

- `JWT_SECRET`: rotate, sessions die (7-day tokens signed with the old key stop
  verifying). Announce first.
- API keys: revoke from `/settings` (instant) or `/api/keys/{id}`.

## Rate limits

In-process buckets (60 s window, 120 read / 30 write per IP, ×40 under test).
Single-instance only; move to Redis before scaling horizontally.

## Known single points

Mongo (same compose network), Vercel-like host, in-memory limiter. No alerting
to pager yet; `/api/metrics?format=prom` is scrape-ready.
