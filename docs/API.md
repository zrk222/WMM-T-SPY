# API catalogue (observed)

All endpoints are same-origin (`https://spytok.com`), JSON over HTTPS, served
by Next.js route handlers on Vercel (`x-matched-path` mirrors the path). No
authorization header is used — authentication is a browser session cookie sent
with `credentials: "include"`. One request in the client carries
`AbortSignal.timeout(8000)`.

Observed via live traffic + literal `fetch()` strings in shipped chunks.
**[obs]** = exercised in a recorded scenario; **[str]** = string-level evidence.

## Auth

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| GET | `/api/auth/me` [obs] | — | `credentials:"include", cache:"no-store"`. Signed-in: `{user:{...}}`. Anonymous: **401** `{"user":null,"authenticated":false}` |
| POST | `/api/auth/signup` [obs] | `{name, email, password, sessionId}` | 200 creates account + session. Invalid JSON → 400 `{"error":"Validation failed","issues":[{"source":"body","path":"","message":"Request body must be valid JSON"}]}` |
| POST | `/api/auth/login` [obs] | `{email, password, sessionId}` | 200 `{user}`. Lockout responses carry `locked`, `remainingTime`, `attemptsRemaining` |
| POST | `/api/auth/google` | `{credential, sessionId, mode}` | Google Identity Services credential JWT; `mode` defaults `"signup"` |
| POST | `/api/auth/logout` | — | `credentials:"include"` |
| POST | `/api/auth/forgot-password` | `{email}` | |
| POST | `/api/auth/reset-password` | `{token, password}` | |
| POST | `/api/auth/verify-email` | `{token}` | |
| POST | `/api/auth/resend-verification` | — | `credentials:"include"` |

## Onboarding / app profile

| Method | Path | Body / query | Notes |
| --- | --- | --- | --- |
| GET | `/api/onboarding/session` [str] | — | returns `{sessionId}` |
| DELETE | `/api/onboarding/session` [str] | — | used when re-entering with `?new=1` |
| POST | `/api/app-profile` [str] | `{sessionId, url}` | creates draft; **409** when the app is already profiled (client maps 409 to `error:"limit"`, copy `You already have a profile for this app. Go to your App Profile to manage it.`) |
| POST | `/api/app-profile` [str] | `{sessionId, url, scrapeData, status:"analyzing"}` | |
| POST | `/api/app-profile` [str] | `{sessionId, productProfile, audienceProfile, status:"partial"}` | |
| POST | `/api/app-profile` [str] | `... status:"partial", triggerPassB:true` | fires at the audience step |
| POST | `/api/app-profile` [str] | `... , preferences, status:"complete"\|"partial"` | final save; response carries `profile.id` |
| PATCH | `/api/app-profile` [str] | `{sessionId}` | finalize; retried once after `refreshUser()` on 401 |
| GET | `/api/app-profile?all=1[&with=connectOffer]` [obs] | — | `{"profiles":[],"defaultId":null,"limit":1,"connectOffer":{"show":false,"target":"add","inProgress":false}}` |
| POST | `/api/onboarding/build-profile/scrape` [str] | `{url}` | → `{url, scrapeToken, appData, meta}` |
| POST | `/api/onboarding/build-profile/pass-a` [str] | `{url, scrapeToken}` or `{url:"noapp:<12-char-uuid>", description}` | consumed via `useObject` (Vercel AI SDK) streaming `{product_profile, audience_profile}` |
| PATCH | `/api/user/profile-completion` [str] | `{onboardingComplete:true}` | |

## Frontend feed / discovery

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/frontend/home` [obs] | `{"formatPreviews":{face_to_camera,screen_recording,animation_motion_graphics,text_centric,slideshow,other,silent_ugc},"industryPreviews":{games,finance,health_fitness,education,entertainment,lifestyle,shopping_e_commerce,business,other_uncategorized}}` — all values are S3 image URLs |
| GET | `/api/frontend/posts` [obs] | see query string below; returns `{"posts":[…],"nextCursor":"…","totalCount":…}` |
| GET | `/api/frontend/feed` [obs] | requires `?profileId=`; missing → `400 {"error":"profileId is required"}` |
| GET | `/api/frontend/last-update` [str] | |
| GET | `/api/apps/movers` [str] | App Pulse data |
| GET | `/api/apps/movers/creators` [str] | |
| GET | `/api/niches/` [str] | trailing-slash list endpoint (client POSTs `/niches` server action) |
| GET | `/api/adaptation/credits` [obs] | `{"creditsUsed":0,"creditsLimit":1,"creditsRemaining":1,"month":"2026-11"}` |
| POST | `/api/adapted-hook` [str] | AI hook adaptation (consumes `aiCredits`) |

`/api/frontend/posts` full observed query string:

```
cursor=
pageSize=20
outlier_min=1
outlier_max=1000
time_period=30days
sort_by=date
content_type=all
platform=all
tags=
tag_filters=
recent_media_only=true
chart_selection_type=
chart_selection_value=
hide_ads=true
require_blueprint_tags=true
```

Post object shape (all 21 observed fields):

```json
{
  "_id": "6af7dbc3e0319fed4e3b093d",
  "platform": "tiktok",
  "id": "7707758546150231298",
  "account": "6a5354b3edb93d0aef5cb7ea",
  "comments": 72,
  "date": "2026-11-13T20:39:50.000Z",
  "hook": {"text": "", "visual": "", "audio": ""},
  "likes": 2969,
  "link": "https://www.tiktok.com/@6820843603540329477/video/7707758546150231298",
  "numberOfSlides": 0,
  "outlierMultiplier": 2.8933903133903134,
  "saves": 129,
  "shares": 82,
  "slideshowImageLinks": [],
  "sound": "6af7dbbee0319fed4e3b0916",
  "type": "video",
  "videoLength": 65503,
  "views": 50779,
  "videoLink": "https://social-gen.s3.amazonaws.com/videos/7707758546150231298.mp4",
  "coverLink": "https://social-gen.s3.amazonaws.com/images/7707758546150231298-cover.jpg",
  "classificationDetails": null
}
```

## User

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/user/alerts` [obs] | `{"events":[]}` |
| GET/PATCH | `/api/user/profile` [str] | |
| GET/POST/DELETE | `/api/user/api-keys` [str] | `.../api-keys/${id}` for single key |
| GET/DELETE | `/api/user/mcp-connections` [str] | `.../mcp-connections/${id}` revoke |
| GET | `/api/user/mcp-connect/ask-link` [obs-str] | → `{askLink:boolean}`; cache `["mcpAskLink", id]`, `staleTime:18e5`, retry ×2 with `retryDelay:3e4` |
| POST | `/api/user/mcp-connect/asked` [str] | |
| POST | `/api/user/mcp-connect/clicked` [str] | |
| POST | `/api/user/mcp-connect/dismiss` [str] | |
| DELETE | `/api/user/delete-account` [str] | admin CSS also hints ban reasons |

## Subscription (Stripe)

| Method | Path | Notes |
| --- | --- | --- |
| GET/POST | `/api/subscription` [obs] | **public GET** returns the full plan catalogue (prices, limits, Stripe price ids — see SECOND-PASS.md). POST creates checkout, body `{subscriptionTier, subscriptionPeriod, successUrl, cancelUrl, paywallVariant?}` |
| POST | `/api/subscription/portal` [obs] | Stripe billing portal (`/subscription/manage` links here); 401 unauth, 403 on bot gate |
| POST | `/api/subscription/cancel` [str] | cancel-flow event trail: `cancel_flow_started/…/cancel_now/undo` |
| POST | `/api/subscription/keep` [str] | cancel-flow "kept" offer |
| GET/POST | `/api/subscription/switch` [str] | GET `?tier=&period=` preview, POST confirm |
| GET | `/api/subscription/invoices` [obs] | 401 unauth |
| POST | `/api/subscription/guest-checkout` [obs] | fields required: `subscriptionTier`, `subscriptionPeriod`, `successUrl`, `cancelUrl`; returns `{url:"https://checkout.stripe.com/g/pay/cs_live_…"}` for anonymous users |
| GET/POST | `/api/oauth/register` [obs-str] | dynamic client registration; GET not allowed on token endpoint (405); rejects standard metadata with `invalid_client_metadata` |

## MCP / agent surface

| Method | Path | Notes |
| --- | --- | --- |
| POST/GET/DELETE | `https://spytok.com/api/mcp` | hosted MCP server; `Allow: DELETE, GET, HEAD, OPTIONS, POST`; unauthenticated → `401 {"error":"Missing Bearer token"}` + `Www-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource/api/mcp", scope="spytok:read"` |
| GET | `/oauth/authorize` | OAuth 2.0 authorization endpoint (307 → onboarding when signed out) |
| POST | `/api/oauth/token` | token endpoint (authorization_code + refresh_token, public clients) |
| POST | `/api/oauth/register` | dynamic client registration |
| GET | `/.well-known/oauth-authorization-server` | AS metadata (public) |
| GET | `/.well-known/oauth-protected-resource` | resource metadata (public) |

Authentication for MCP is an **API key only**: a session JWT sent as `Bearer`
yields `401 {"error":"Invalid API key"}`; the cookie alone yields `Missing Bearer
token`. Max 5 keys per account, shown once.

## Misc

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/og?title=…&subtitle=…` | dynamic OpenGraph image generator (1200×630, public, `image/png`) |
| GET | `/api/early_access_features/?token=…`, `/api/product_tours/?token=…`, `/api/surveys/?token=…`, `/api/web_experiments/?token=…` | PostHog companion endpoints |

## Rate limits / quotas visible to the client

- Feature limits map on the user object (`limits[feature]`; `-1` = unlimited),
  consumed by a `used/max/unlimited/full` helper in `3ezjmoz_s_e7q.js`.
- Paywall gates: `aiCredits` (hard), `collectionsCount` (hard),
  `scrollResults` (soft), `filteringEnabled` (hard), `appProfilesCount` (hard),
  `upgrade` (manual), `searchLimit` (manual), `signup` (manual).
- Login lockout: `locked`, `remainingTime`, `attemptsRemaining`.
- API keys: max 5 per account (`5 keys max. disconnect one first.`).
- Bot gate: `403 {"error":"Automated access detected."}` on selected routes
  (`POST /api/user/api-keys`, `POST /api/subscription/portal`, cookie-less
  `GET`/`HEAD /api/frontend/posts`); the client explicitly tolerates 403 on key
  creation and refreshes anyway.
- Unknown `/api/*` paths return the **HTML** 404 page, not JSON.
