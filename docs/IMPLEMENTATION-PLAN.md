# Implementation plan — from spec to operational stack

The repository documents a live product. There is **no application code, no
infrastructure, no data, and no tests** — only contracts, schemas, enums, copy,
route maps, and measured behaviour. This document converts that into a build
plan.

Two viable goals:

- **A. Reimplementation** — rebuild SpyTok-equivalent functionality with our own
  code and data sources.
- **B. Functional clone for a different corpus** — same stack, different niche.

Both require every item below. Differences are noted where they matter (ingest
source, seed data).

---

## 1. What already exists (use as the contract)

| Artifact | Use |
| --- | --- |
| `docs/API.md` — 49 endpoints, methods, bodies, status codes | endpoint contract + test matrix |
| `docs/DATA-MODEL.md` — entities, fields, enums, limits | schema + fixture source |
| `docs/ONBOARDING-STATES.md` — flows, guards, copy, choreography | wizard spec |
| `docs/ARCHITECTURE.md` — rendering, headers, chunking | infra shape |
| `docs/MCP.md` + `docs/SECOND-PASS.md` — OAuth metadata, 401 contract, key rules | agent surface spec |
| `docs/SECURITY.md` — 15 findings | hardening backlog |
| `docs/EVIDENCE.md` — captured responses | golden fixtures for contract tests |

Implementation should be **test-first against these documents**. A renamed field
or changed status code is a spec change and needs a doc diff.

## 2. Gap table

Legend: **S** small (≤3 d), **M** medium (~1–2 wk), **L** large (>2 wk).

| # | Component | Current state | To build | Acceptance criteria | Size |
| --- | --- | --- | --- | --- | --- |
| 1 | Repo scaffold | docs only | Next.js App Router + TS strict, Turbopack, lint/format, `/.github` CI, preview envs, `CODEOWNERS` | `pnpm build` green in CI, PR preview deploys, 0 lint errors | S |
| 2 | Environments | none | local docker (mongo, mailpit, minio), staging, prod; seeded fixtures | one-command up; staging parity; no prod creds in dev | M |
| 3 | Data layer | model documented | Mongo collections + indexes (`platform+date`, `outlierMultiplier`, `tags`, `account`, `sound`, text index on description), migrations, seeders | feed query < 80 ms p95 on 500 k docs; indexes verified by `explain()` | M |
| 4 | Auth core | behaviour documented | argon2id hashing, JWT issue/verify (`tv` checked per request), lockout, verification + reset tokens, logout revoke | replay of all `/api/auth/*` rows in API.md; revoked token → 401; lockout after N | M |
| 5 | Google SSO | client_id known | server-side GSI token verification, account linking, `mode` handling | invalid credential → 401; new email → signup; existing → login | S |
| 6 | Route guards + redirects | matrix documented | server-side guards, `next` sanitizer server-side, CSRF for cookie POSTs | matrix table reproduced; `//evil`, `/\evil`, `/api/x` rejected | S |
| 7 | Ingestion | implied | source client (TikTok), scheduler, normalizer, dedupe by TikTok id, media fetch → S3, retry/DLQ | 1 k posts/day sustained; idempotent by id; failures quarantined | L |
| 8 | Scoring | `outlierMultiplier` observed | per-account baseline (median views/engagement), multiplier computation, recompute on new posts | reproducible score; new account cold-start rule; unit tests on fixtures | M |
| 9 | AI classification | fields observed (`hook`, formats, industries, tags) | batch classifier with strict JSON schema, confidence, moderation, backfill | ≥95 % schema-valid; <2 % manual-review flags; cost/post logged | L |
| 10 | Media pipeline | S3 layout known | upload, content-type, derivatives (cover/slide), CDN, cache headers, lifecycle | 100 % objects typed + cached 1 y; origin offload ≥90 % | M |
| 11 | Feed API | query string + payload known | `/api/frontend/posts` + `/feed` with filters, cursor, fallback, `description/predictions/yourVersion` | contract tests green; p95 < 300 ms; cursor stable under insert | L |
| 12 | Ranking + personalization | prefs model known | base ranking by score, profile prefs boost, dedupe by account, decay | relevance fixture suite; no duplicate accounts per page | M |
| 13 | Profile CRUD | lifecycle observed | create/get/list/patch/delete, status machine, 409 on limit, `urlHash` | all states covered; list hidden until `complete` | M |
| 14 | Scrape service | response shape known | App Store/Play/site fetchers, SSRF guard, `s1.` signed token, size/time caps | 3 source types; SSRF suite; token tamper → 400 | L |
| 15 | Pass-A/B generation | streamed schema known | LLM call with JSON schema streaming, validation, repair, retries, `aiCredits` debit, `triggerPassB` | schema-valid ≥98 % after repair; credit debited once; replayable | L |
| 16 | Briefs + hooks | events known | brief generation, `adapted-hook`, versioning, exports | brief renders; credit accounting matches | M |
| 17 | Collections / saves | hints only | CRUD, membership, `postsPerCollection` caps, public flag, export | caps enforced; export ≤ limits | M |
| 18 | Alerts + digest | hints only | rule storage, evaluator, email digest, thresholds/frequency | alert fires once per matching post; unsubscribe works | M |
| 19 | Niches | route + copy | niche CRUD, monitoring feed | CRUD + feed filters | S |
| 20 | Billing core | plans/price ids observed | Stripe products/prices, checkout (auth + guest), webhook handler with idempotency, portal, cancel/keep/switch/invoices | webhook replay safe; entitlements switch exactly on `active/trialing` | L |
| 21 | Entitlements | limit map observed | tier→limits resolver, paywall gates (hard/soft/manual), usage counters | matrix test per tier; `-1` = unlimited; gate copy rendered | M |
| 22 | MCP server | transport + 401 observed | JSON-RPC over HTTP, `initialize`, `tools/list`, tools (search, get post, profile, brief), `outputSchema` | MCP Inspector handshake; tools documented; 401 + `WWW-Authenticate` | L |
| 23 | OAuth AS | metadata observed | authorize, token (PKCE S256, public clients, refresh), consent screen, client registry | PKCE happy path; wrong verifier → 400; refresh rotation | L |
| 24 | API keys | rules observed | create (max 5, show-once), hash at rest, prefix display, revoke, lastUsedAt | plaintext never stored; cap + revoke enforced | M |
| 25 | Bot gate | behaviour observed | challenge that does not 403 normal clients; explicit challenge token; metrics | 0 % false 403 on headed/curl-with-cookie; key creation reliable | M |
| 26 | Admin console | redirect only | users, plans, bans, moderation queue, AI job replay, flags | role-gated server-side; actions audited | L |
| 27 | Marketing + SEO | copy, routes, stats known | pages, ISR, JSON-LD, canonical, sitemaps (incl. video), OG image | Lighthouse ≥95; sitemap valid; OG renders | M |
| 28 | Observability | vendors known | Sentry, structured logs, RED metrics, PostHog events, alerting | error budget dashboards; on-call runbook | M |
| 29 | Security hardening | 15 findings | nonce CSP (drop `unsafe-inline/eval` where possible), COOP/CORP, rate limits, secret rotation, SBOM, `npm audit` gate | findings 1–15 closed or accepted with rationale | M |
| 30 | Compliance | policies exist | ToS/privacy/refund pages, consent, export + delete-account, retention jobs, DPA | delete completes ≤30 d; export machine-readable | M |
| 31 | Testing | none | contract tests per endpoint, Playwright E2E (signup→profile→feed→checkout), load tests, webhook + migration tests | ≥80 % coverage on server; E2E green; 10× feed load passes | L |
| 32 | Runbooks + launch | none | deploy/rollback, incident, key rotation, data restore drill | rollback <10 min; restore drill documented | S |

## 3. Phase order and gates

| Phase | Contents | Exit gate | Rough effort |
| --- | --- | --- | --- |
| **M0** | 1, 2 | CI + preview + local stack | 1 wk |
| **M1** | 3, 4, 5, 6 | auth contract tests green, guards matrix reproduced | 3 wk |
| **M2** | 7, 8, 9, 10 | 1 k posts/day, scores and tags reproducible | 6–8 wk (highest risk) |
| **M3** | 11, 12, 13 | feed + profile contract tests, p95 budget met | 4 wk |
| **M4** | 14, 15, 16 | onboarding end-to-end with credit debit | 4 wk |
| **M5** | 20, 21 | test-mode checkout→webhook→entitlement→portal | 3 wk |
| **M6** | 22, 23, 24, 25 | MCP Inspector session + OAuth PKCE + key cap | 3 wk |
| **M7** | 17, 18, 19, 26, 27 | collections/alerts/niches/admin/SEO complete | 4 wk |
| **M8** | 28–32 | SLOs live, findings closed, launch review | 3 wk |

≈ 30–34 engineer-weeks serial; ~12–14 weeks with four engineers if M2 starts
first and M7 runs parallel to M4–M6.

## 4. Decisions to make before writing code (ADRs needed)

1. **Data source** — official TikTok API (limited), third-party aggregator
   (Apify/EnsembleData), or own scraper. Drives cost, ToS exposure, coverage.
2. **LLM provider** — schema-streaming fidelity, cost per profile, data-residency.
3. **Mongo hosting** — Atlas vs self-hosted; backup tier.
4. **Token strategy** — keep HS256 cookie (observed) vs EdDSA + KMS; refresh vs
   sliding expiry.
5. **Bot protection** — vendor (BotID/Turnstile) or homegrown challenge. Must
   avoid the observed self-tolerated 403.
6. **DCR** — support dynamic registration or ship static client ids (the live
   service rejects standard metadata).
7. **Media** — public bucket (observed) vs signed/CDN private.
8. **Admin authz** — server-enforced role, separate host, or SSO group.

## 5. Non-functional targets

```
feed p95 300 ms · ingest 1 k posts/day sustained · brief p95 60 s
availability 99.9 % · RPO 15 min · RTO 4 h · error budget 0.1 %
per-post ingest cost < $0.01 · per-profile AI < $0.05 · media egress tracked
```

## 6. Risks

| Risk | Mitigation |
| --- | --- |
| TikTok access/ToS | two sources behind one interface; cache aggressively |
| AI cost blowout | per-tier `aiCredits`, per-job budget, cheap model for classification |
| Media egress | CDN + long cache + image limits |
| Schema drift from spec | contract tests are the gate; doc diff required |
| Bot gate false negatives | challenge token, metric on 403 rate, alarm |
| Single-region | warm secondary region for read paths |

## 7. Definition of "operational"

All of: green pipeline, contract + E2E + load suites, SLO dashboards, on-call
runbook, restore drill, findings closed/accepted, DPA + delete/export flows,
Stripe live-mode walkthrough, MCP handshake with a real client, and one full
signup→profile→feed→brief→checkout→MCP journey executed on production by a
non-author.
