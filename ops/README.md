# CloudOps Console (ops/)

Working cloud-operations console built from the WMM T-SPY blueprint. Spans a
vertical slice end-to-end: auth, tenancy, incidents, deploys, runbooks, SLOs,
plan entitlements, audit, admin and a key-scoped MCP surface.

## Run it

```bash
docker compose up -d mongo
cp .env.example .env          # or export the three vars
npm install
npm run seed                  # deterministic demo data
npm run dev                   # http://localhost:3000
```

Seeded logins (password `Passw0rd!123`):

| user | role | plan |
| --- | --- | --- |
| `admin@cloudops.dev` | admin | scale |
| `ops@cloudops.dev` | operator | team |
| `viewer@cloudops.dev` | viewer | free |

## Verify

```bash
npm run typecheck
npm run lint
npm run build
npm test        # 29 integration/unit tests, real HTTP + real Mongo
```

Tests boot `next dev` on port 3100 against `cloudops_test`, then tear both down.
`RATE_LIMIT_MULTIPLIER` keeps the limiter from tripping during the suite.

## What is implemented

- **Auth**: bcrypt (cost 10), HS256 JWT in an `HttpOnly; SameSite=lax` cookie,
  `tv` checked per request so logout/password-change revoke instantly, 5-attempt
  lockout with 15-minute window, double-submit CSRF on mutations.
- **Tenancy**: every row carries `ownerId`; non-admins only see their own rows,
  admins see everything. Caps are evaluated per owner.
- **Incidents**: open → acknowledged → monitoring → resolved (reopen allowed),
  immutable timeline, notes, severity/impact/commander, illegal transitions 409.
- **Deploys** with plan-scoped history window, **runbooks** with ordered steps,
  **SLOs** one per service.
- **Entitlements**: `free` / `team` / `scale` enforced server-side on services,
  open incidents, runbooks, SLOs, API keys, MCP write and history depth.
- **Agent surface**: `POST /api/mcp` JSON-RPC, API-key Bearer only (session
  cookies rejected), scopes `ops:read` / `ops:write`, max 5 keys, SHA-256 at
  rest, show-once, revocable; `/.well-known/oauth-protected-resource`.
- **Admin** console (server-enforced role) with users, plans and audit.
- **Ops**: `/api/health`, structured audit of every mutation, CSP and hardening
  headers, 429 limiter with `retry-after`.

## API surface

`/api/auth/{signup,login,logout,me,password}`, `/api/plans`,
`/api/services[/id]`, `/api/incidents[/id][/notes]`, `/api/deploys`,
`/api/runbooks[/id]`, `/api/slos`, `/api/activity`, `/api/keys[/id]`,
`/api/admin/{users,audit}`, `/api/mcp`.

Conventions: 400 `{error, issues[]}` on validation, 401 unauthenticated, 403
role/CSRF/entitlement, 404 missing, 409 conflict/limit, `{items, nextCursor}`.

## MCP example

```bash
curl -s localhost:3000/api/mcp \
  -H "authorization: Bearer ck_…" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Tools: `list_services`, `list_incidents`, `get_incident`, `create_incident`
(write scope), `list_runbooks`, `get_slo`.

## Known limits (deliberate)

- Plan changes are admin-set; no Stripe integration yet.
- Rate limiting is in-process (single instance); swap for Redis to scale out.
- No email delivery (verification/reset tokens are not sent).
- Suspend/ban flags exist in the model but have no UI.
- No log ingestion; SLOs store targets only, no error-budget computation.

See `docs/PLAN.md` for phases and `docs/ADR.md` for decisions.
