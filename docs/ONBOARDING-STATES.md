# Onboarding state machine

The onboarding wizard is the most complex client state in the product. It is a
React reducer (`40_wx1y8i7u_3.js`) driving a five-step flow, with a guest
session, server-side AI generation, and a signup gate at the end.

## Flows (`?flow=`)

```
default    steps: url, product, audience, industry, prefs   paywall: yes
quick      steps: url, product, prefs                       paywall: yes
noUrl      steps: describe, product, audience, industry, prefs  paywall: yes
returning  steps: audience, industry, prefs                 paywall: no
addApp     steps: url, product, audience, industry, prefs   paywall: no
```

Selection precedence: explicit `?flow=` → PostHog flag `onboarding-flow` →
`addApp` when `?new=1` and authenticated → `default`.

Rail labels: `Your App, Product, Audience, Industry, Formats`
(`describe` renders as `Your Idea`).

## State

```js
{
  step: 0,
  sessionId: null,
  url: "", describeText: "", scrapeData: null,
  productProfile: null, audienceProfile: null,
  preferences: { preferredFormats: [...], preferredIndustries: [] },
  phase: "idle" | "scraping" | "pass_a" | "done",
  error: null, cached: false, editedFields: {}
}
```

Reducer actions: `SET_SESSION, SET_URL, SET_DESCRIBE, PHASE, ERROR, SCRAPE, GO,
BACK, RESET_URL, STREAM_A, EDIT, SET_PREFS, CACHED`.

`GO` clamps to `steps.length-1`, `BACK` to 0. `STREAM_A` merges streamed profile
fields while preserving locally edited paths (`editedFields` dot-paths).

## Choreography (happy path)

```
1. GET  /api/onboarding/session                       → { sessionId }
2. POST /api/app-profile {sessionId, url}
       409 → phase "failed", error "limit",
             copy "You already have a profile for this app. Go to your App Profile to manage it."
       cached=true → CACHED (loads saved profile, phase=done)
3. POST /api/onboarding/build-profile/scrape {url}
       → { url, scrapeToken, appData, meta }
       (scrapeToken is intentionally not persisted in client state)
4. POST /api/onboarding/build-profile/pass-a {url, scrapeToken}   [streaming]
       → product_profile + audience_profile (useObject)
5. on audience transition:
       POST /api/app-profile {sessionId, productProfile, audienceProfile,
                             status:"partial", triggerPassB:true}
6. final step:
       POST /api/app-profile {sessionId, productProfile, audienceProfile,
                             preferences, status:"complete"|"partial"}
7. onComplete(sessionId, profileId)
       if not authenticated → AuthModal(signup)
       else finalize:
         PATCH /api/app-profile {sessionId}   (401 → refreshUser → retry once)
         destination = flag("onboarding-finalize-destination") ?? "feed"
         /app-profile?id=…  |  /feed/{profileId}  |  /home
```

Progress UI: scraping 10/25/40 %, pass_a 55/70/85 %, done 100 %, advanced every
1800 ms with copy such as `Fetching your listing.`, `Building product profile.`,
`Mapping creative angles.`

## Validation rules (verbatim messages)

URL step:

```
empty            "Please enter a URL"
whitespace       "Use an App Store, Play Store, or website URL - not a search phrase."
tiktok/@         "We need your app or website URL, not a TikTok profile."
invalid          "Enter a valid URL (e.g. apps.apple.com/app/... or your website)."
non-http(s)      "Only HTTP/HTTPS URLs are allowed."
no dot host      "Please paste a full link (e.g. apps.apple.com/app/... or yourapp.com)."
```

Accepted: `apps.apple.com`, `play.google.com`, any hostname containing a dot;
scheme-less input is normalized with `https://`.

Describe step: trimmed length ≥ 40 (max 2000), errors
`Tell us a bit more (at least 40 characters).` and `{n} more characters to go`.

Product step: requires `productProfile.app_name`; editable fields need ≥ 10 chars
(`This field is required`, `At least 10 characters`).

Audience step: requires `audienceProfile.target_psychographics.length > 0`;
`pain_points[].abstracted` required.

Industry: ≥ 1 selection. Formats: ≥ 1 selection.

Signup modal: name/email/password required, email format check, password ≥ 8.

## Entry points and side behaviours

```
?url=<value>   validate + auto-submit once sessionId exists
?flow=noUrl    start in describe mode
?new=1         DELETE /api/onboarding/session, hide paywall (addApp)
?next=<path>   post-auth redirect, sanitized (see SECURITY.md)
```

`noapp:<uuid>` is the synthetic URL used for describe-only profiles, carrying the
free-text description instead of a scrape.

## Trial / paywall defaults (client constants)

```
signupGate: at "after_audience_step", allowGuestPreview: true
trial: freeTrialDays 0, tierOnTrialStart "pro"
emailVerify: required "soft", blockingActions []
paywall gates: aiCredits(hard), collectionsCount(hard), scrollResults(soft),
               filteringEnabled(hard), appProfilesCount(hard),
               upgrade(manual), searchLimit(manual), signup(manual)
```
