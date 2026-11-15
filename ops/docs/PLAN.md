# Build plan â€” CloudOps Console

A cloud-operations console: services, incidents, deploys, runbooks and SLOs, with
tiered plans and an MCP agent surface.

The architecture is taken from the WMM T-SPY blueprint (`../wmm-t-spy/docs`),
re-pointed from a content corpus to operational entities.

## Blueprint mapping

| Blueprint doc | Here |
| --- | --- |
| `ARCHITECTURE.md` (App Router, RSC, route handlers, headers) | same rendering and routing model; no CMS content |
| `API.md` (status semantics, validation envelopes, cursor paging) | same conventions: 400 `{error, issues[]}`, 401/403/409, `{items,nextCursor}` |
| `DATA-MODEL.md` (ObjectId entities, enums, limits) | ObjectId collections; `severity/state/impact` enums; plan limits |
| `SECURITY.md` (JWT cookie + `tv`, lockout, CSRF, CSP, gate) | same auth shape, plus double-submit CSRF and a challenge that never 403s normal clients |
| `MCP.md` (Bearer keys, max 5, show-once, well-known, scope) | same contract with `ops:read` / `ops:write` scopes |
| `ONBOARDING-STATES.md` (guarded wizard) | workspace onboarding (service â†’ SLO â†’ runbook) |
| `IMPLEMENTATION-PLAN.md` (phases, NFRs, DoD) | P0â€“P7 below, same gates |

## Phases

| Phase | Scope | Gate |
| --- | --- | --- |
| P0 | scaffold, CI-ready scripts, compose Mongo, health | `npm run build` green, `/api/health` 200 |
| P1 | identity: bcrypt, JWT+`tv`, lockout, CSRF, roles, guards | auth contract tests |
| P2 | core entities: services, incidents (+timeline), deploys | CRUD tests, state machine |
| P3 | runbooks, SLOs, activity cursor feed | query tests, p95 budget |
| P4 | entitlements per plan, paywall, usage counters | matrix tests |
| P5 | MCP server + API keys + well-known | handshake, cap, revoke |
| P6 | UI: auth, dashboard, services, incidents, runbooks, settings, admin | E2E journey |
| P7 | hardening: CSP, rate limits, audit scoping, suspend, SLO budget, run logs, version/health, request ids | findings list closed — **done**, Stripe/email deferred |

## Non-goals in P0â€“P7

Multi-region, SSO/SAML, billing provider integration (plan changes are admin-set
until Stripe is wired), log ingestion, on-call escalation policies.

## NFRs

```
reads p95 < 250 ms Â· writes p95 < 400 ms Â· 99.9 % target Â· RPO 15 min
rate limit 120 req/min/IP read, 30 write Â· audit every mutation
```

## Definition of done

Green build, green tests (auth, incidents, entitlements, MCP), seeded demo
workspace, every mutation audited, secrets only in env, and one full
login â†’ service â†’ incident â†’ resolve â†’ MCP read journey on a fresh database.
