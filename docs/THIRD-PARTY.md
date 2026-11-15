# Third-party services

Verified by observed network requests, CSP allowlists, and literal URLs in
shipped JavaScript. "Declared" means it appears in CSP/code but was not requested
during the observation window.

| Service | Role | Identifier / URL | Status |
| --- | --- | --- | --- |
| Vercel | Hosting, edge, analytics, speed insights | `server: Vercel`, `/_vercel/insights/script.js`, `/_vercel/speed-insights/script.js`, `va.vercel-scripts.com`, `vitals.vercel-insights.com/v2/vitals?dsn=…` | observed |
| Amazon S3 | Public media CDN | `https://social-gen.s3.amazonaws.com/{images,slides,videos}/…` | observed (72 requests on one page) |
| PostHog (US Cloud) | Product analytics, feature flags, experiments, surveys, session replay config | host `https://us.i.posthog.com`, assets `https://us-assets.i.posthog.com`, project token `phc_9VShzFGhFBmMt5AKgy0hJxOQGec3rVopUxM14uG4w1m`, SDK `1.347.2` | observed |
| Google Identity Services | OAuth sign-in button | `https://accounts.google.com/gsi/client`, client id `357598125842-vu0otkdemvut7fdacint6ln8660cbu1q.apps.googleusercontent.com` | observed (login page) |
| Stripe | Billing, checkout, portal, webhooks | CSP `js.stripe.com`, `*.stripe.com`, `hooks.stripe.com`, `checkout.stripe.com`; `form-action` allows `checkout.stripe.com` | declared + fields observed |
| Crisp | Support chat | `https://client.crisp.chat/l.js`, env `NEXT_PUBLIC_CRISP_WEBSITE_ID` | declared (loads when enabled) |
| Simple Analytics | Privacy analytics | `https://scripts.simpleanalyticscdn.com/latest.js` | **requested but blocked by CSP** |
| ui-avatars.com | Auto-generated avatar for accounts without a picture | `https://ui-avatars.com/api/?name=…&background=random` | observed (proxied via `/_next/image`) |
| Google Fonts | Font CSS/host (fallback) | `fonts.googleapis.com`, `fonts.gstatic.com` | declared in CSP |

## Simple Analytics: broken by CSP

Every page injects `<script src="https://scripts.simpleanalyticscdn.com/latest.js">`
(`strategy:"lazyOnload"`), but the response CSP allows scripts only from `'self'`,
Stripe, PostHog, Vercel and Google GSI. The request fails with
`failure: "csp"` in the network capture. Net effect: the site pays for/goes
through the motion of Simple Analytics and collects **zero** data from it.

Fix would be either adding the origin to `script-src` or removing the tag.

## PostHog configuration (observed)

```
initPostHog({ api_host: "https://us.i.posthog.com", person_profiles: "identified_only",
              persistence: "localStorage+cookie" })
flags request body: { token, distinct_id, groups:{}, person_properties:{},
                      $device_id }   (base64 in `data=` form field)
flags response: { flags:{}, sessionRecording:false, isAuthenticated:false,
                  config:{ enable_collect_everything:true }, … }
endpoints also used: /flags, /e/, /api/early_access_features/,
                     /api/product_tours/, /api/surveys/, /api/web_experiments/
```

Feature flags consume the PostHog project token as the public key; no server
secret is exposed.

## Analytics taxonomy (product funnel)

```
landing_url_pasted, landing_cta_clicked, onboarding_started, signup_completed,
login_completed, onboarding.signupGateReached, feed_viewed, search_performed,
brief_generated, post_saved, collection_exported, paywall_shown,
checkout_started, subscription_started, subscription_cancelled,
cancel_flow_{started,reason,kept,confirmed,skipped,cancel_now,undo},
cancel_offer_{shown,accepted}, mcp_connect_* , ask_claude_clicked
```

## Data leaving the browser (privacy surface)

- PostHog: pageviews, funnel events, `distinct_id`/`$device_id`, user traits
  (`created_at`, `plan_tier`, `billing_cycle`), feature-flag context.
- Vercel: page URL + Web Vitals (proxied first-party).
- Crisp: chat identity when the widget initializes.
- Google GSI: OAuth popup only; no silent tracking observed.
- No ad-tech, no pixel, no Facebook/TikTok SDK observed in the client.
