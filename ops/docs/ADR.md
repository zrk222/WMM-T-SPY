# Architecture decisions

## ADR-001 Mongo via official driver

No ORM. Documents are small and query shapes are index-driven. `mongodb` driver
with typed wrappers in `lib/collections.ts`. Indexes created in `lib/db.ts` on
first connect. Rejected: Prisma/Mongoose (weight, cold-start).

## ADR-002 Session JWT in HttpOnly cookie

HS256 via `jose`, payload `{id,email,name,role,tv}`, 7-day expiry, `Secure` in
production, `SameSite=lax`. `tv` (token version) is checked against the user row
on every request, so logout and password change revoke immediately.

## ADR-003 Double-submit CSRF

Mutating cookie requests require header `x-csrf` equal to the `csrf` cookie.
Bearer-authenticated MCP calls are exempt. No server session store needed.

## ADR-004 Authorization is server-side only

`role` is re-read from the database per request (`admin`, `operator`, `viewer`).
UI hiding is cosmetic. Every route calls `requireRole`.

## ADR-005 Entitlements as data

Plan limits live in `lib/plans.ts` and are resolved per request; counters are
derived by query, not stored. `-1` means unlimited. Free tier is hard-capped.

## ADR-006 Agent surface uses API keys, not sessions

MCP accepts `Authorization: Bearer ck_*` only. Keys are `ck_` + 32 hex, stored as
SHA-256, shown once, max 5, scoped (`ops:read`, `ops:write`), revocable.

## ADR-007 Rate limiting in process

Fixed-window counters in a Map keyed by `ip:route`, 60 s window. Adequate for a
single instance; documented upgrade path to Upstash Redis.

## ADR-008 Audit log as append-only collection

Every mutation writes `{actor, action, entity, entityId, before, after, at}`.
Reads for the admin console only.

## ADR-009 No UI framework

Server components + small client forms with plain CSS modules. Keeps payloads
tiny and the surface auditable.

## ADR-010 Seed is first-class

`npm run seed` builds a deterministic demo workspace (3 services, 2 runbooks,
1 open incident, 1 SLO breach) so the app is demoable from a cold clone.
