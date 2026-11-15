# Architecture

## Stack (observed)

| Layer | Technology | Evidence |
| --- | --- | --- |
| Framework | Next.js App Router (Turbopack build) | `/_next/static/immutable/chunks/turbopack-*.js`, `x-matched-path`, `?_rsc=` prefetches, `text/x-component` responses |
| UI runtime | React 19.3.0-canary (`278794d7-20261002`) | string inside `33fcdn7r_40o1.js` |
| Hosting | Vercel, region `iad1` | `server: Vercel`, `x-vercel-id: iad1::...`, `x-vercel-cache` |
| Rendering | Static prerender for SEO pages, RSC streaming for app pages | `x-nextjs-prerender: 1`, `x-vercel-cache: PRERENDER/HIT`, `x-nextjs-postponed: 2` |
| API | Next.js route handlers, JSON | `content-type: application/json`, `x-matched-path: /api/...` |
| Data store | MongoDB-style documents (ObjectId hex ids) | `_id`, `6af9265776db035dc160e682`, `account`, `sound` references |
| Media | Amazon S3 bucket `social-gen` | `https://social-gen.s3.amazonaws.com/{images,slides,videos}/...` |
| Billing | Stripe | CSP `js.stripe.com`, `checkout.stripe.com`, `hooks.stripe.com`; `stripeCustomerId`; `/api/subscription/*` |
| Auth | first-party session cookie + Google Identity Services | `credentials:"include"`, `accounts.google.com/gsi/client`, `tokenVersion` |
| Analytics | PostHog cloud (US), Vercel Analytics, Vercel Speed Insights, Crisp, Simple Analytics | script URLs + CSP |
| AI | server-side LLM producing structured JSON (provider unknown) | `/api/onboarding/build-profile/pass-a` streaming `{product_profile, audience_profile}` |

No Supabase, Firebase, Auth0, Clerk, Prisma, Drizzle, Postgres client, or Redis
string appears in any captured chunk. The API is first-party and opaque.

## Deployment identity

```
Build marker:   data-dpl-id="dpl_E5F7n34E42UV5FaByH92KNgcUykd"
RSC header:     x-nextjs-deployment-id: dpl_E5F7n34E42UV5FaByH92KNgcUykd
Document ETag:  W/"953ede9a1d75f51a4b2b00174789608c"
RSC ETag:       W/"490ebdbbca9e2b49e5683ff771770d9d"
x-vercel-id:    iad1::<edge-node>-<epoch-ms>-<hash>
Cache modes:    PRERENDER / HIT / MISS
Stale window:   x-nextjs-stale-time: 300
```

## Rendering model

1. **Marketing routes** (`/`, `/top-posts*`, legal pages) are prerendered. The
   HTML carries a full RSC flight payload (`self.__next_f.push`) with all card
   data, category metadata, FAQ objects and JSON-LD, plus `<link rel=preload>`
   hints for fonts, CSS and hero images.
2. **App routes** (`/home`, `/explore`, `/apps`, `/profile`, `/app-profile`,
   `/connect`) stream RSC. Navigation is prefetch-driven: hovering a footer link
   triggers `?_rsc=<token>` fetches against `*.segment.rsc` endpoints
   (`x-matched-path: /top-posts/lifestyle.segments/_tree.segment.rsc`).
3. **Mutations** use client `fetch` with JSON bodies to `/api/*`. One RSC
   **server action** was observed: `POST /home` with an empty JSON body and a
   flight response (`0:{"a":"$@1","q":"","i":false}`), used for revalidation.
4. **Client state**: React Query-like cache keys were observed
   (`["auth","me"]`, `["app-profile", userId]`, `["mcpAskLink", id]`) with
   `staleTime: 18e5` (30 min) and bounded retries. No global store library
   strings were found.

## CSP and headers (verbatim, every HTML/API response)

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval'
  https://js.stripe.com https://*.stripe.com
  https://app.posthog.com https://*.i.posthog.com https://*.posthog.com
  https://va.vercel-scripts.com https://accounts.google.com/gsi/client;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style;
font-src 'self' data: https://fonts.gstatic.com;
img-src 'self' data: blob: https: http:;
connect-src 'self' https://*.stripe.com https://*.posthog.com https://*.i.posthog.com
  https://va.vercel-scripts.com https://accounts.google.com/gsi/ wss: https:;
frame-src 'self' https://js.stripe.com https://*.stripe.com https://hooks.stripe.com https://accounts.google.com/gsi/;
media-src 'self' blob: data: https:;
worker-src 'self' blob:;
object-src 'none'; base-uri 'self';
form-action 'self' https://checkout.stripe.com;
frame-ancestors 'none'; upgrade-insecure-requests
```

```
referrer-policy: strict-origin-when-cross-origin
x-content-type-options: nosniff
x-frame-options: DENY
permissions-policy: camera=(), microphone=(), geolocation=()
strict-transport-security: max-age=31536000; includeSubDomains
access-control-allow-origin: *        (HTML and RSC responses)
vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch
```

Note: `script-src` omits `https://scripts.simpleanalyticscdn.com`, which is the
exact origin the app asks the browser to load — see
[THIRD-PARTY.md](THIRD-PARTY.md#simple-analytics-broken-by-csp).

## Bundle structure

Public chunks are content-hashed but human-readable in shape:

```
/_next/static/immutable/chunks/
  27t0zkpxj85rl.js   main bootstrap shim
  33fcdn7r_40o1.js   React runtime + error plumbing (31 KB)
  0a47qgsbwjjzk.js   framework (132 KB)
  37rewvfz_bn6a.js   framework (234 KB)
  0v-fhfk3imu-4.js   shared app shell (28 KB)
  turbopack-*.js     Turbopack runtime
  15152fj71g8gx.js   router manifest
  0c5oulxe2mwx_.js   shared UI primitives (29 KB)
  0a4quo_3s7-v-.js   AUTH (15 KB): all /api/auth calls, PostHog init, funnel events
  2dqwrej1057ss.js   PostHog SDK bundle (175 KB)
  3lsnzlxlve1iw.js   app shell/footer/chat (34 KB)
  3e63xei-lndmk.js   icons + misc (42 KB)
  3ezjmoz_s_e7q.js   app-profile + plans/limits + MCP ask-link (22 KB)
  1psa607d3bjjy.js   auth guard helper (1.5 KB)
  3j2c7d-axicaj.js   tiny util (2 KB)
  03jwkffnk-dx0.js   FAQSection island (2.7 KB)
  08wf-qlgsq2lx.js   Google sign-in component (11 KB)
  3ohzmgvrp1r1t.js   login route chunk
  40_wx1y8i7u_3.js   ONBOARDING state machine (37 KB)
  2evth3ju9pb5l.js   onboarding steps + auth modal + URL validator (57 KB)
  1hv9w3zoixdom.js   large shared vendor (413 KB)
  feed-only: 28p1thhqsr0bi, 0szxpeug6xy55, 3pvrshplvrf9z, 0ur3v33dyyb8s,
             1g65902-33ea5, 1mq7zfem2_xox, 3yrvlb2f1i1tw, 2fmn7mbdmkcxy,
             0jftmicbx_0uj, 1cqr9n1f4ru27, 2vqt_jngqtm4u, 41xbruf7ff2ls,
             1034a-a4143c5, 1ck45_d-n8eax, 2v967l0jr17pi, 1df8ww12r_lto,
             1g_s6fn1cjqmm
```

No source maps are published (`source_map_url: null` everywhere).

## Request flow for the signed-in feed

```
GET /home                       → HTML (RSC payload, 31.6 KB)
GET /api/auth/me                → { user } or 401 {user:null,authenticated:false}
GET /api/app-profile?all=1&with=connectOffer
GET /api/user/alerts            → { events: [] }
GET /api/frontend/home          → preview images per format/industry
GET /api/frontend/posts?...     → { posts[20], nextCursor, totalCount }
GET /api/adaptation/credits     → { creditsUsed, creditsLimit, creditsRemaining, month }
GET /_next/image?url=...        → avatar proxied through Next image optimizer
```
