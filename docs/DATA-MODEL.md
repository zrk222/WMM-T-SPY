# Data model

Recovered from live JSON responses of a self-registered free account and from
public feed payloads. Field names are verbatim; types inferred from observed
values. Identifiers are MongoDB-style 24-hex ObjectIds.

## User

```jsonc
{
  "id": "6af9265776db035dc160e682",          // alias of _id
  "name": "REA Bot",
  "email": "spytok.re.20261115@gmail.com",
  "profileImage": "https://ui-avatars.com/api/?name=REA%20Bot&background=random",
  "role": "user",                             // "admin" grants every gate bypass
  "isEmailVerified": false,                   // soft gate; onboarding still works
  "accountLocked": false,
  "tokenVersion": 0,                          // session/JWT revocation counter
  "subscriptionStatus": "none",               // active | trialing | past_due | unpaid | none
  "subscriptionTier": "none",                 // basic | pro | ultra | enterprise | none
  "subscriptionPeriod": "none",
  "subscriptionCurrentPeriodEnd": null,
  "subscriptionCancelAtPeriodEnd": false,
  "canceledAt": null,
  "cancellationFeedback": null,
  "hasUsedFreeTrial": false,
  "trialEndsAt": null,
  "lastStripeEventCreated": 0,
  "lastStripeEventId": null,
  "stripeCustomerId": "…",                    // present after checkout (string field confirmed in client)
  "limits": {
    "scrollResults": 20,
    "collectionsCount": 3,
    "postsPerCollection": 10,
    "filteringEnabled": true,
    "searchQuota": 0,
    "recurringSearches": 0,
    "appProfilesCount": 1,
    "aiCredits": 1
  },
  "emailPreferences": {
    "digest": true, "lifecycle": true, "onboarding": true,
    "retention": true, "unsubscribedAt": null
  },
  "onboardingComplete": false,
  "lastActiveAt": null,
  "signupIp": null,
  "signupIpHash": "87de39f99afb945006943b60716d13e4",  // 32 hex chars (MD5-shaped)
  "createdAt": "2026-11-15T03:26:15.836Z",
  "lastLogin": "2026-11-15T03:28:13.316Z",
  "updatedAt": "2026-11-15T03:28:13.317Z"
}
```

Client analytics additionally read `created_at` (snake_case) and map
`plan_tier`/`billing_cycle` into Stripe events.

## App profile

```jsonc
{
  "profiles": [],            // list; empty for a fresh account
  "defaultId": null,
  "limit": 1,                // mirrors limits.appProfilesCount
  "connectOffer": { "show": false, "target": "add", "inProgress": false }
}
```

Draft lifecycle (from client + status enum):

```
status: "analyzing" → "partial" → "complete"
profile: {
  id | _id,
  productProfile:  { …pass-a product_profile },
  audienceProfile: { …pass-a audience_profile },
  preferences: { preferredFormats: string[], preferredIndustries: string[] },
  scrapeData
}
```

### product_profile (streamed schema)

```
app_name, category, subcategory, core_mechanic, value_proposition,
monetization_model, requires_account, time_to_value, output_type,
output_shareability, wow_factor[], visual_demonstrability
```

### audience_profile (streamed schema)

```
target_psychographics[] (1-3 personas)
pain_points[] (surface | mid | deep; each has `abstracted` required)
desires[] (>=2)
awareness_stage
emotional_trigger { primary, explanation }
objections_likely[] (2-4)
competitive_context { direct_competitors[], indirect_alternatives[], switching_barrier }
niche_markers[] (3-5)
```

## Post (TikTok content item)

```
_id                  ObjectId
platform             "tiktok"
id                   TikTok video id (string)
account              ObjectId → accounts collection
sound                ObjectId → sounds collection
comments, likes, saves, shares, views   integers
date                 ISO timestamp
hook                 { text, visual, audio }
link                 canonical TikTok URL
type                 "video" | (slideshow types via numberOfSlides)
numberOfSlides
slideshowImageLinks  string[]
outlierMultiplier    float ("outlier score")
videoLength          milliseconds
videoLink            S3 mp4
coverLink            S3 jpg
classificationDetails null | object
```

`outlierMultiplier` is the product's core score: views (or engagement) relative
to the account's baseline. The API filters on it directly (`outlier_min`,
`outlier_max`) and sorts/rescopes by `time_period`, `content_type`, `platform`.

## Taxonomy

Two independent taxonomies are exposed, and they deliberately share names:

Industries (SEO routes): `lifestyle, education, health-fitness, entertainment,
business, finance, gaming, ecommerce` — with `other_uncategorized` present in
`/api/frontend/home`.

Internal enum seen in feed previews: `games, finance, health_fitness, education,
entertainment, lifestyle, shopping_e_commerce, business, other_uncategorized`.

Formats: `tutorial, app-demo, problem-solution, educational, entertainment,
testimonials, storytime, before-after, meme, listicle` (SEO routes) and
`face_to_camera, screen_recording, animation_motion_graphics, text_centric,
slideshow, other, silent_ugc` (visual-tag enum in `/api/frontend/home` and
`?visualTags=overall_visual_style:…`).

## Plan (public catalogue, from `GET /api/subscription`)

```jsonc
{
  "_id": "67d69f98363d716b8898c28f",
  "name": "Starter", "tier": "basic",
  "description": "Detect and analyze viral posts for your niche.",
  "features": [{"key":"aiSearch","label":"AI-powered contextual search"}, …],
  "monthlyPrice": 49, "yearlyPrice": 299,
  "stripePriceIdMonthly": "price_1R3hb0LPvSXwfzMEONXuda05",
  "stripePriceIdYearly": "price_1R3haSLPvSXwfzMEIhLrtG2w",
  "limits": {"scrollResults":50,"collectionsCount":3,"postsPerCollection":30,
             "filteringEnabled":true,"searchQuota":50,"recurringSearches":0,
             "aiCredits":10,"appProfilesCount":1},
  "isActive": true, "displayOrder": 1,
  "createdAt": "…", "updatedAt": "…", "__v": 0
}
```

Rows exist for `basic` (Starter, 49/299), `pro` (Growth, 59/399) and
`enterprise` (Scale, 899/5990). `ultra` appears in the tier set but has no row.
Enterprise Stripe ids are placeholders (`price_enterprise_*_default`).

## MCP connection state

```
access            "free" | (paid levels)
arm, tool         connector arm/tool identity
connected         boolean
clickedAt, allowViewedAt, deniedAt, claudeAllowViewedAt, dismissedAt
lastAnswer, firstAnswerAt
inProgress
serverNow         server clock (client skew correction)
connections[]     [{ id, client_name, … }]
keys[]            [{ id, name, lastUsedAt }]
```

## Session claims (JWT payload)

```
id, email, name, role, verified, subscriptionTier, subscriptionStatus, tv, iat, exp
```

## Collections, briefs, searches, alerts

Only client-visible identifiers were recoverable:

- collection: `collection_id`, `collection.is_public`, pagination limits
  `collectionsCount`, `postsPerCollection`
- brief: `brief_id`, generated by adaptation; metered by `aiCredits` and
  `/api/adaptation/credits` (`creditsUsed/creditsLimit/creditsRemaining/month`)
- search: `searchEventId`, `search_ordinal`, `query_length`, `searchQuota`,
  `recurringSearches`
- alerts: `/api/user/alerts` → `{ "events": [] }`; fields `alert.frequency`,
  `alert.threshold` appear in client strings
- MCP: `mcp-connections` (client_name, revoke), `api-keys` (id, revoke),
  `askLink` boolean per profile id

## Enums (verbatim sets in client)

```
plan tiers    new Set(["basic","pro","ultra","enterprise"])
good status   new Set(["active","trialing"])
bad status    new Set(["past_due","unpaid"])
experiment    { on: "version_on", holdout: "version_holdout", feed: "feed" }
```

## Storage

- `localStorage["ph_phc_9VShzFGhFBmMt5AKgy0hJxOQGec3rVopUxM14uG4w1m_posthog"]`
- `sessionStorage["ph_<token>_posthog"]`, `["ph_<token>_primary_window_exists"]`
- `localStorage["auth-state-change"]` (cross-tab auth sync)
- Session cookie: HttpOnly (value not observable; name redacted by policy)
- No IndexedDB, no Cache Storage.
