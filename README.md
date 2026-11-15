# WMM T-SPY

Black-box reverse engineering of **https://spytok.com** — a commercial TikTok
"virality" analytics SaaS — performed with [REA](https://github.com/morluto/rea)
(Chrome DevTools protocol capture, passive page inspection, static JavaScript
bundle analysis, and controlled browser replay).

Everything in this repository is **observation-first**: every claim is tied to a
recorded evidence record (see [docs/EVIDENCE.md](docs/EVIDENCE.md)). Nothing here
was taken from source code, and nothing was modified on the live service.

> Date of capture: 2026-11-15 (UTC)
> Target deployment: `dpl_E5F7n34E42UV5FaByH92KNgcUykd`
> Region: `iad1` (Vercel, us-east-1)

---

## TL;DR

| Question | Answer |
| --- | --- |
| What is it? | Next.js App Router SaaS that indexes ~500K viral TikTok posts (plus TikTok accounts and sounds), classifies them with AI, and sells search, collections, and AI "adaptation briefs" for app-growth teams. |
| Frontend | Next.js (App Router, Turbopack), React 19.3.0-canary, server components + client islands. |
| Hosting | Vercel (edge/CDN + Node serverless functions), `server: Vercel`. |
| Backend | Same-origin Next.js route handlers under `/api/*`; MongoDB-style `ObjectId` identifiers; no third-party BaaS observed. |
| Auth | First-party email/password + Google Identity Services, HttpOnly session cookie, `tokenVersion` revocation counter, login lockout + attempt tracking. |
| Billing | Stripe (CSP-declared; `stripeCustomerId`, subscription tier/status/period fields, portal + cancel + switch + invoices endpoints). |
| Tiers | `basic`, `pro`, `ultra`, `enterprise` (plus `none`); states `active`, `trialing`, `past_due`, `unpaid`. |
| Media | Public S3 bucket `social-gen` (`images/`, `slides/`, `videos/`). |
| Analytics | PostHog (cloud US), Vercel Analytics + Speed Insights, Crisp chat, Simple Analytics (broken: blocked by CSP). |
| AI feature | Onboarding profile builder streams structured `product_profile` + `audience_profile` JSON from `/api/onboarding/build-profile/pass-a`; "adaptation briefs" are metered by `aiCredits`. |
| Agent surface | Hosted **MCP server** at `https://spytok.com/api/mcp` with OAuth authorization server (`/oauth/authorize`) and an API-key/OAuth connection manager. |

---

## What this repository contains

```
README.md                     this overview
docs/ARCHITECTURE.md          stack, rendering model, request flow, deployment shape
docs/API.md                   complete observed HTTP API catalogue with payloads
docs/DATA-MODEL.md            entities, fields, enums recovered from live responses
docs/ONBOARDING-STATES.md     the 5-step onboarding state machine and its guardrails
docs/MCP.md                   SpyTok as an MCP server / OAuth provider
docs/THIRD-PARTY.md           analytics, billing, chat, media, fonts, CDN
docs/SECURITY.md              auth model, limits, headers, findings and weaknesses
docs/EVIDENCE.md              evidence IDs, digests, captured assets, limitations
docs/REPRODUCE.md             exact REA call sequence used to reproduce this
LICENSE                       Apache License 2.0
```

---

## Product surface (route map)

Public marketing and SEO:

- `/` — landing page (hero, social proof, 3-step explainer, FAQ, CTA)
- `/top-posts` — category index (8 industries + 10 formats), prerendered
- `/top-posts/{lifestyle|education|health-fitness|entertainment|business|finance|gaming|ecommerce}`
- `/top-posts/{tutorial|app-demo|problem-solution|educational|entertainment|testimonials|storytime|before-after|meme|listicle}`
- `/top-posts/rankings/{by-views|by-engagement|this-week|this-month}`
- `/top-posts/{industry}-{format}` combo pages, e.g. `/top-posts/gaming-tutorial`
- `/pricing`, `/contact`, `/terms`, `/privacy`, `/refund-policy`, `/cancellation-policy`

Authenticated application:

- `/login` — Google SSO or email login (modal-driven), `?next=` safe redirects
- `/onboarding` — 5-step profile builder (guest-capable, signup gate at the end)
- `/home` — personalized feed shell
- `/explore` — visual/format exploration (supports `?visualTags=...`)
- `/apps` — app directory; `/apps/movers` data
- `/profile` — user profile
- `/app-profile` — per-app product/audience profile editor
- `/connect` + `/connect/setup` — MCP connection wizard
- `/subscription/manage` — Stripe billing portal entry
- `/feed/{id}` — profile-scoped feed
- `/admin` — internal admin console (client-side `role === "admin"` gate)
- `/oauth/authorize` — OAuth 2.0 authorization endpoint for the MCP server

---

## The ten most interesting findings

1. **The whole product is one Next.js app.** Turbopack build, RSC flight data,
   `x-matched-path` on every API response, `x-vercel-cache: PRERENDER` on SEO
   pages, and `POST /home` server actions. No separate API host is used.

2. **MongoDB-style identifiers.** Every entity (`user.id`, `post._id`,
   `post.account`, `post.sound`) is a 24-hex ObjectId (e.g.
   `6af9265776db035dc160e682`). The API is a thin JSON layer over that store.

3. **The feed query language is fully exposed.** `/api/frontend/posts` accepts
   `outlier_min`, `outlier_max`, `time_period`, `sort_by`, `content_type`,
   `platform`, `tags`, `tag_filters`, `recent_media_only`,
   `chart_selection_type`, `chart_selection_value`, `hide_ads`,
   `require_blueprint_tags`, plus `cursor`/`pageSize` pagination — i.e. the
   product's entire search UI is server-driven by this one endpoint.

4. **AI onboarding streams two schemas.** `/api/onboarding/build-profile/pass-a`
   is consumed with Vercel's `useObject` hook and streams `product_profile`
   (11 fields) and `audience_profile` (9 fields) as structured JSON, preceded by
   a scrape pass (`/build-profile/scrape`) that returns a `scrapeToken`.

5. **Guests can do the whole onboarding before signing up.** The app issues an
   anonymous onboarding `sessionId`, builds the profile, then opens the signup
   modal only at completion ("signup gate after final step") and finalizes with
   a `PATCH /api/app-profile`.

6. **SpyTok is an MCP provider.** `https://spytok.com/api/mcp` speaks MCP; the
   app ships one-click connector instructions for Claude
   (`https://claude.ai/customize/connectors?...`) and exposes OAuth authorize,
   MCP connection listing/revocation and user API keys.

7. **Billing is Stripe, but prices are server-side only.** No `price_*` or
   `prod_*` IDs appear in the client. Client only carries tier/status strings,
   `stripeCustomerId`, and endpoints for `portal`, `cancel`, `keep`, `switch`,
   `invoices`, and `guest-checkout`.

8. **Free tier is aggressively metered.** A brand-new account receives
   `scrollResults: 20`, `collectionsCount: 3`, `postsPerCollection: 10`,
   `filteringEnabled: true`, `searchQuota: 0`, `recurringSearches: 0`,
   `appProfilesCount: 1`, `aiCredits: 1`.

9. **Simple Analytics is silently broken.** The page loads
   `https://scripts.simpleanalyticscdn.com/latest.js`, but the Content-Security
   Policy `script-src` does not allow that origin, so the request fails with a
   CSP violation on every page load.

10. **Login is hardened, but not against everything.** Per-account attempt
    counters, `attemptsRemaining`, temporary lock with countdown, and
    `tokenVersion` session invalidation are client-visible; there is no CAPTCHA
    or Turnstile anywhere in the client bundle.

---

## Architecture in one diagram

```
                ┌──────────────────────── Vercel (iad1) ────────────────────────┐
 browser ──────▶│ Next.js App Router (Turbopack)   RSC + client islands         │
 (Chrome)       │   ├── static chunks /_next/static/immutable/chunks/*.js       │
                │   ├── route handlers  /api/auth/*                             │
                │   │                   /api/frontend/{home,feed,posts,last-update}
                │   │                   /api/app-profile, /api/onboarding/*     │
                │   │                   /api/subscription/*  (Stripe)           │
                │   │                   /api/user/*, /api/apps/movers          │
                │   └── MCP endpoint    /api/mcp   + OAuth /oauth/authorize     │
                └───────┬───────────────┬──────────────────┬───────────────────┘
                        │               │                  │
             MongoDB-style store   Stripe API        PostHog / Crisp / Google
             (ObjectId entities)   (billing)         (analytics, chat, SSO)
                        │
             s3://social-gen (public: images/, slides/, videos/)
```

---

## Reproduce it yourself

You only need Chrome and REA:

```bash
# 1. passive inspection of the public site
rea list-browser-targets --cdp-endpoint http://127.0.0.1:9222
rea inspect-web-page --cdp-endpoint http://127.0.0.1:9222 --target-id <id> \
    --include-script-sources --include-accessibility-text

# 2. static bundle graph (routes, chunks, endpoint candidates)
rea analyze-web-bundle --cdp-endpoint http://127.0.0.1:9222 --target-id <id> \
    --include-script-sources --detail summary

# 3. authenticated replay with network bodies
rea capture-browser-scenario --json scenario.json
```

The exact calls, their parameters, and every returned evidence ID are in
[docs/REPRODUCE.md](docs/REPRODUCE.md) and [docs/EVIDENCE.md](docs/EVIDENCE.md).

---

## Legal / ethical note

This is a **passive external observation** of a public website plus one
self-registered, free, throwaway account. No authentication bypass, no scraping
at scale, no privilege escalation, and no writes to any other user's data were
performed. Trademarks and content belong to their owners; this repository is an
independent analysis and is not affiliated with SpyTok.

## License

Apache License 2.0 — see [LICENSE](LICENSE).
