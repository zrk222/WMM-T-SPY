# Security review (external, non-invasive)

Scope: publicly observable client code, headers, and a self-registered free
account. No exploitation, no privilege escalation, no third-party data access.

## Authentication model

- First-party session cookie set by `/api/auth/signup|login|google`; sent with
  `credentials:"include"` on every API call, `HttpOnly` (value unobservable).
- `tokenVersion` on the user record indicates versioned sessions/JWTs so that a
  bump invalidates outstanding tokens (logout-everywhere / password change).
- Google sign-in exchanges a GSI credential for a session
  (`POST /api/auth/google`, `mode: "signup" | "login"`).
- Email verification exists but is **soft**: `emailVerify.required = "soft"`,
  `blockingActions: []`, and a fresh unverified account can complete onboarding,
  browse, and hit metered APIs.
- Password reset: `/api/auth/forgot-password` → token → `/api/auth/reset-password`.
- Per-account brute-force protection is real and client-visible:
  `attemptsRemaining`, `locked`, `remainingTime`, with lock copy
  `Your account has been temporarily locked due to too many failed login attempts.`

## Session and redirect handling

Session state is an HS256 JWT in an `HttpOnly; Secure; SameSite=lax` cookie named
`token`, `Max-Age=604800` (7 days). Payload:

```json
{"id":"…","email":"…","name":"…","role":"user","verified":false,
 "subscriptionTier":"none","subscriptionStatus":"none","tv":0,"iat":…,"exp":…}
```

`POST /api/auth/logout` revokes immediately (`/api/auth/me` → 401 afterwards),
and a revoked token returns `401` on authenticated routes — so the JWT is not
trusted in isolation; `tv`/revocation is checked per request. Authorization
therefore depends on `tv`/expiry plus a server-side check; stale tier/role claims
are a design consequence worth re-verifying on each privileged route.

`?next=` sanitizer (client-side) is strict: same-origin relative path only,
≤ 2048 chars, rejects control chars/backslashes, rejects `//`, decodes up to 3
times, and rejects prefixes `/login`, `/onboarding`, `/api`. Fallback `/home`.
This is a good pattern; server-side enforcement is unknown.

## Headers / policy posture

Strong: `frame-ancestors 'none'`, `x-frame-options: DENY`, `nosniff`,
HSTS 1 year with subdomains, `permissions-policy` denies camera/mic/geo,
`object-src 'none'`, `base-uri 'self'`, `referrer-policy: strict-origin-when-cross-origin`.

Weak points:

- `script-src 'unsafe-inline' 'unsafe-eval'` — required by the framework and
  PostHog, but it removes most XSS mitigation value.
- `access-control-allow-origin: *` on **HTML and RSC** responses. Harmless for
  non-credentialed fetches, but it means any origin can read the static
  markup/RSC payload of any public page; keep it in mind if per-user HTML ever
  becomes cacheable.
- No `Cross-Origin-Opener-Policy` / `Cross-Origin-Resource-Policy` /
  `Cross-Origin-Embedder-Policy` (`coop/coep/corp: null`).
- Simple Analytics script is blocked by CSP (functional bug, see THIRD-PARTY).

## Findings

| # | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| 1 | Medium | **Account enumeration** on the login page: failed Google sign-in for a non-existent account renders `we couldn't find a spytok account for that google email. try the email you signed up with, or set up your app below.` | `08wf-qlgsq2lx.js` copy, login DOM |
| 2 | Medium | **Admin gate is client-side only**: `user.role === "admin"` short-circuits paywalls and layout in the browser, and `/admin` is hidden by path checks. If server routes trust role only, fine; if any admin data is reachable by URL, this is an entitlement bypass. Remote verification out of scope. | `0a4quo_3s7-v-.js`, `3ezjmoz_s_e7q.js`, admin CSS class names |
| 3 | Medium | **CSP `unsafe-eval` + `unsafe-inline`** on a page that renders user-controlled TikTok text/hooks. Any HTML-injection sink becomes an executable XSS. Not observed exploited. | CSP header |
| 4 | Medium | **Public S3 bucket** serves all post media by predictable key (`images/<tiktokId>-cover.jpg`, `videos/<tiktokId>.mp4`, `slides/<id>-slide-0.jpg`). Keys are enumerable from public feeds; no signed URLs. Content is public TikTok media, so impact is bandwidth/hotlinking, not data exposure. | 72 observed requests |
| 5 | Low | **No CAPTCHA/Turnstile** anywhere (searched all chunks: `turnstile`, `captcha`, `recaptcha`, `hcaptcha` = 0). Signup + login rely on lockout + IP hash only. | chunk grep |
| 6 | Low | **Duplicate-profile oracle**: `POST /api/app-profile` returns **409 + duplicate** for an app the account already tracks — a small resource-existence side channel, limited to the caller's own account. | onboarding client |
| 7 | Low | **`signupIp` stored hashed** with a 32-hex (MD5-shaped) digest, and MD5 without a visible salt is weak for an IP-address space; `signupIp: null` but hash present shows intent to minimize. | user object |
| 8 | Info | **`x-vercel-id` and deployment id** expose infrastructure topology (`iad1`, `dpl_…`), which aids targeted infra analysis. | headers |
| 9 | Info | **MCP/API keys** are long-lived data-API credentials; only one scope exists (`spytok:read`), max 5 keys, shown once, revocable at `/api/user/api-keys/{id}` and `/api/user/mcp-connections/{id}`. | well-known docs, client copy |
| 11 | Medium | **Session cookie is a readable HS256 JWT** carrying `role`, `subscriptionTier`, `subscriptionStatus`, `verified` and `tv`, valid 7 days. Any XSS (see #3) can read the full authorization state, and claims stay stale until expiry/`tv` bump. `SameSite=lax` still allows top-level GET navigation with the cookie. | `Set-Cookie` on login, decoded payload |
| 12 | Medium | **Bot gate is unreliable and self-tolerated.** `403 Automated access detected.` fires on `POST /api/user/api-keys` for ordinary header-complete requests and the client does `(ok || 403) && refresh()` — so key creation can appear to succeed while no key exists. | run 2/4/5, `3ezjmoz_s_e7q.js` |
| 13 | Low | **Anonymous guest checkout** mints live `cs_live_` Stripe sessions (`POST /api/subscription/guest-checkout`), so checkout sessions can be produced without any account — session spam / COGS lever. | 200 + `checkout.stripe.com/g/pay/cs_live_…` |
| 14 | Low | **Public plan catalogue** returns Stripe `price_*` ids, internal Mongo `_id`s, `__v` counters and `createdAt/updatedAt`. Enterprise ids are placeholders (`price_enterprise_monthly_default`), hinting at a manual sales tier. | `GET /api/subscription` |
| 15 | Low | **SEO corpus exposure**: `sitemap-videos.xml` lists 1000 posts with caption, S3 video URL, duration, date and view count; category pages prerender captions, transcripts and metrics. Trivially harvestable without an account, though the underlying media is public TikTok content. | sitemap, `/top-posts/lifestyle` |
| 10 | Info | **Soft email verification + `searchQuota: 0`** means a disposable account can still exercise every metered feature once (`aiCredits: 1`), which is an abuse/COGS lever rather than a breach. | user object |

## Non-findings (checked and clean)

- No secrets in client bundles (only publishable PostHog token + Google client id).
- No `.env`, no private keys, no Stripe secret keys, no DB URIs in shipped code.
- No `eval` of remote config; no `dangerouslySetInnerHTML` on post content found
  in the captured island chunks (framework-level inline scripts only).
- No source maps published.
- CSP blocks framing, discourages clickjacking.

## Responsible disclosure

Everything above is inferable from the public site. If SpyTok wants a private
report, the actionable items are #1 (generic error copy), #3 (nonce-based CSP),
and #4 (CloudFront + signed URLs or hotlink protection).
