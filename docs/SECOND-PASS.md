# Second pass (2026-11-15, 06:00–06:20 UTC)

A second, broader sweep after the first publication. New surfaces: HTTP method
and well-known discovery, unvisited routes, authenticated areas, the public plan
API, the MCP auth contract, and raw-session cookie inspection.

Everything below is additive. Where pass 2 corrects pass 1, the correction is
listed explicitly. All items are backed by the records in
[EVIDENCE.md](EVIDENCE.md); nothing was bought and no state was mutated beyond
the same throwaway account.

## Corrections to pass 1

| Pass 1 said | Pass 2 shows |
| --- | --- |
| MCP auth via "OAuth or API key", session model inherited by the agent API | MCP accepts **only** an API key. The session JWT sent as `Bearer` returns `401 {"error":"Invalid API key"}`; the cookie alone returns `401 {"error":"Missing Bearer token"}`. |
| Scopes unknown | One scope: `spytok:read` (in both well-known documents). |
| `/api/subscription` implied authenticated | **Public, unauthenticated `200`**, returns the full plan catalogue. |
| MCP page unnamed | `/mcp` exists: "SpyTok for Claude and ChatGPT | Viral content strategist in your AI chat". |
| 5 documented API prefix groups | Plus `/.well-known/oauth-*`, `/api/oauth/{token,register}`, `/api/niches/`, `/api/apps/movers{,/creators}`, `/api/frontend/{feed,last-update}`, `/api/adapted-hook`, `/api/memory/signal`. |

## New: OAuth authorization-server metadata (public)

```
GET /.well-known/oauth-authorization-server → 200
{"issuer":"https://spytok.com",
 "authorization_endpoint":"https://spytok.com/oauth/authorize",
 "token_endpoint":"https://spytok.com/api/oauth/token",
 "registration_endpoint":"https://spytok.com/api/oauth/register",
 "response_types_supported":["code"],
 "grant_types_supported":["authorization_code","refresh_token"],
 "code_challenge_methods_supported":["S256"],
 "token_endpoint_auth_methods_supported":["none"],
 "scopes_supported":["spytok:read"],
 "authorization_response_iss_parameter_supported":true,
 "service_documentation":"https://spytok.com/mcp"}

GET /.well-known/oauth-protected-resource → 200
{"resource":"https://spytok.com/api/mcp",
 "authorization_servers":["https://spytok.com"],
 "bearer_methods_supported":["header"],
 "scopes_supported":["spytok:read"],
 "resource_name":"SpyTok MCP",
 "resource_documentation":"https://spytok.com/mcp"}
```

`POST /api/mcp` without credentials returns `401` plus

```
Www-Authenticate: Bearer resource_metadata="https://spytok.com/.well-known/oauth-protected-resource/api/mcp", scope="spytok:read"
```

`OPTIONS /api/mcp` → `204`, `Allow: DELETE, GET, HEAD, OPTIONS, POST`.
`GET /api/oauth/token` → `405` (POST only). Dynamic client registration rejects
every standard metadata shape tried (`client_name`, `redirect_uris`,
`grant_types`, `response_types`, `token_endpoint_auth_method`, `scope`,
`client_uri`, `software_id`) with `400 {"error":"invalid_client_metadata"}` —
the exact accepted shape remains unknown.

## New: API-key contract (authenticated)

```
POST /api/user/api-keys   {"name":"rea"}   → 403 {"error":"Automated access detected."}
GET  /api/user/api-keys                     → 200 {"keys":[]}
```

- Client code performs `fetch("/api/user/api-keys",{method:"POST",body:{name}})`
  and then `(res.ok || res.status === 403) && refresh()` — the app **expects**
  403 here and refreshes anyway, so keys may still be created server-side.
- Copy: `create:"create key"`, `createMeta:"for tools without sign in"`,
  `limit:"5 keys max. disconnect one first."`, `createFailed:"couldn't make a key. try again."`,
  `shown:"shows once, copy it now"`, `copy:"copy"`,
  `API key · never used`, `API key · used {date}`.
- Auth header for MCP: `Authorization: Bearer YOUR_KEY`.
- Connector commands shipped in the UI:
  `claude mcp add --transport http --scope user spytok https://spytok.com/api/mcp`.

## New: plan catalogue is public

`GET /api/subscription` (no auth, `200`) returns every plan with Mongo ids,
`__v`, timestamps, limits and live Stripe price ids:

| tier | name | monthly | yearly | monthly price id | yearly price id |
| --- | --- | --- | --- | --- | --- |
| `basic` | Starter | 49 | 299 | `price_1R3hb0LPvSXwfzMEONXuda05` | `price_1R3haSLPvSXwfzMEIhLrtG2w` |
| `pro` | Growth | 59 | 399 | `price_1R3hZGLPvSXwfzMEYzaU10Ei` | `price_1R3hYvLPvSXwfzMEVYCJWVX3` |
| `enterprise` | Scale | 899 | 5990 | `price_enterprise_monthly_default` | `price_enterprise_yearly_default` |

Per-plan limits: Starter `scrollResults 50, collections 3, posts/collection 30,
searchQuota 50, aiCredits 10, appProfiles 1`; Growth `-1, 10, 100, -1, 50, 3`;
Scale `-1, -1, -1, -1, 500, -1`. Enterprise price ids are placeholders, and the
`ultra` tier in the client enum has **no** plan row.

## New: guest checkout is open

```
POST /api/subscription/guest-checkout
{"subscriptionTier":"basic","subscriptionPeriod":"monthly",
 "successUrl":"https://spytok.com/home","cancelUrl":"https://spytok.com/pricing"}
→ 200 {"url":"https://checkout.stripe.com/g/pay/cs_live_…"}
```

Required fields are enforced with per-field issues
(`subscriptionTier is required`, `subscriptionPeriod is required`,
`successUrl is required`, `cancelUrl is required`). A live `cs_live_` session is
created for an anonymous visitor.

`POST /api/subscription` accepts the same body plus optional `paywallVariant`.
`/api/subscription/portal` → 401 unauth, 403 on the bot gate.
`/api/subscription/switch` is GET `?tier=&period=` (preview) and POST (confirm).
Success/cancel redirects: `/subscription/success?session_id={CHECKOUT_SESSION_ID}`
and `/subscription/cancel` (both auth-gated).

## New: session cookie is a readable JWT

```
Set-Cookie: token=eyJhbGciOiJIUzI1NiJ9.<payload>.<sig>;
  Path=/; Max-Age=604800; Secure; HttpOnly; SameSite=lax
```

Decoded payload:

```json
{"id":"6af9265776db035dc160e682","email":"…","name":"REA Bot","role":"user",
 "verified":false,"subscriptionTier":"none","subscriptionStatus":"none",
 "tv":0,"iat":1794723238,"exp":1795328038}
```

Consequences: HS256, 7-day lifetime, authorization data (`role`, tier, status,
`tv`) is **inside** the token; revocation only via `tv`/expiry. `POST
/api/auth/logout` invalidates immediately (`/api/auth/me` → 401 afterwards).
Cookie flags themselves are all present and correct.

## New: route and method semantics

```
/admin (unauth)           307 → /          (authenticated non-admin) 307 → /home
/explore                  307 → /onboarding?next=%2Fexplore
/oauth/authorize          307 → /onboarding?next=%2Foauth%2Fauthorize
/niches                   307 → /login?next=%2Fniches
/connect, /connect/setup  307 → /login?... ; with auth, setup → /connect when no profile
/subscription/manage      307 → /login?... ; with auth → /pricing when unsubscribed
/api/unknown              404 HTML page (not JSON) with meta robots noindex
HEAD /api/frontend/posts  403 gate (no cookie); with cookie 200
OPTIONS /api/frontend/posts 204, Allow: GET, HEAD, OPTIONS
```

`/connect/setup` requires an app profile; `/subscription/manage` requires an
active subscription.

## New: bot gate is route-scoped

`403 {"error":"Automated access detected."}` reproduced with cookie, Chrome UA,
Origin/Referer/Sec-Fetch-* and `X-Requested-With` on:

- `POST /api/user/api-keys`
- `POST /api/subscription/portal`
- `GET`/`HEAD /api/frontend/posts` **without** a session cookie

Same routes succeed in a normal browser context, and `GET /api/frontend/posts`
with the cookie succeeds over raw HTTP, so the gate is not UA- or cookie-based
alone. A JS-issued challenge (BotID-style) is the likely mechanism; the exact
signal is unresolved.

## New: content exposure via SEO surfaces

- `robots.txt` disallows `/api/`, `/profile`, `/niches` and advertises two
  sitemaps.
- `/sitemap.xml`: **114** URLs (all category, combo, ranking and legal pages).
- `/sitemap-videos.xml`: **1000** entries with post caption, S3 cover/video URL,
  duration, publication date, `view_count` and rating.
- Category pages are fully prerendered: `/top-posts/lifestyle` is 336,694 bytes,
  16,088 posts referenced, and exposes average views (25.9M), engagement (10.2 %),
  pattern mix, top hooks and per-post captions/transcripts/metrics.

## New: product/nav surface

Nav is `Today · Explore · App Pulse`. `/apps` is App Pulse (public shell,
client-fed by `/api/apps/movers{,/creators}`). `/mcp` markets the connector for
Claude **and ChatGPT**. `/niches` is "My Niches — Monitor and explore your
curated content niches". `/app-profile` empty state: "No app profiles yet. Set
up your first app". `/connect` headline: "Ask Claude what to post"; entitlement
copy "SpyTok in Claude comes with Starter and Growth."

## New: MCP connection state model

`GET /api/user/mcp-connections` (200) returns:

```json
{"access":"free","arm":null,"connected":false,"clickedAt":null,"tool":null,
 "allowViewedAt":null,"deniedAt":null,"claudeAllowViewedAt":null,
 "dismissedAt":null,"connections":[],"keys":[],"lastAnswer":null,
 "firstAnswerAt":null,"inProgress":false,"serverNow":"…"}
```

`access` gates the feature; `arm`/`tool` describe the connector; the timestamp
columns drive the nudge sequence.

## New: misc

- `POST /api/auth/logout` → `200 {"success":true}`.
- `/api/frontend/feed` in a browser context without `profileId` → `400
  {"error":"profileId is required"}`; over raw HTTP the same call hits the gate
  (`403`) first, so the 400 is browser-context only.
- A revoked token (after logout) yields `401` on every authenticated route, so
  invalidation is checked server-side per request rather than trusting the JWT
  alone.
- `/api/og?title=&subtitle=` → public `200 image/png` (~37 KB).
- Frontend filters are permissive: `content_type=bogus` and `platform=youtube`
  on a TikTok-only corpus still return `200` with TikTok posts; `sort_by=views`
  and `time_period=7days` work and surface 378×–1491× outliers.
- Unknown route 404 page is branded ("Page not found", "Back to SpyTok").

## Still unresolved after two passes

1. Exact bot-gate signal and whether a blocked `api-keys` POST still creates a key.
2. MCP `tools/list` (needs a successfully minted key) — tool names and schemas.
3. Accepted dynamic-client-registration body.
4. Admin surface beyond the redirect.
5. LLM provider/model behind `pass-a`.
