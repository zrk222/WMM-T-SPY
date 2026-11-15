# Third pass — profile lifecycle and remaining boundaries

Follow-up on the two open items from pass 2: can a profile be built end-to-end,
and does a profile unlock MCP key creation? Evidence: `ev_f4ed6c63…` (onboarding
run), `ev_7f1c11a7…` (finalize), `ev_71daaf34…` (post-profile key attempt), plus
raw probes.

## Profile lifecycle (now fully observed)

State machine, exactly as the server returns it:

```
status: "scraping" → "analyzing" → "partial" → "complete"
```

`POST /api/app-profile {sessionId,url}` creates the row immediately with
`isDefault:true`, `passBMeta:{attempts:0}`, `digestMeta:{angleClickCounts:{},
angleClicks:0,sentPostIds:[]}`, `urlHash` (16 hex) and a server `id`.
`GET /api/app-profile?all=1` returns **`profiles: []` until the profile reaches
`complete`** — observed twice while it was `scraping`/`partial`.

Scrape response (`/api/onboarding/build-profile/scrape`, `200`):

```json
{"success":true,"url":"…","type":"app_store",
 "meta":{title,description,ogImage,ogSiteName,ogType,favicon},
 "appData":{name,icon,developer,category,rating,price,description}}
```

The `scrapeToken` is `s1.<base64url JSON>` containing `u` (url) and `c` (the
scrape content) — a signed/opaque replay token; the URL flow requires it, the
`noapp:<uuid>` flow replaces it with free text.

Pass-A streamed a complete, plausible profile for the supplied App Store page:
12 `product_profile` fields, 3 personas, 3 graded pain points, 2 desires,
objections, competitive context, niche markers.

Finalize (`POST … {sessionId, productProfile, audienceProfile, preferences,
status:"complete"}`) → `200`, row flips to `complete` and appears in the list
with `userId` and `starterQueries: []`. `PATCH /api/app-profile {sessionId}` →
`200 {"success":true,"user":{…}}` (returns the refreshed user).

`connectOffer` remains `{"show":false,"target":"add"}` even with one completed
profile because `limit` is already 1 — it is an *add-another-app* nudge, not a
connection prompt.

## Feed bound to a profile

`GET /api/frontend/feed?profileId=<id>` → `200`, 20 posts. Compared with
`/api/frontend/posts`, the feed adds `description`, `predictions` and
`yourVersion` per post and returns top-level `fallback` instead of `totalCount`.
`/explore` remains a `307` to onboarding when hit without the app shell.

## MCP keys are still blocked

Six more dynamic-client-registration shapes were rejected, including a fully
populated RFC 7591 body (`client_uri`, `logo_uri`, `contacts`, `tos_uri`,
`policy_uri`, `software_id`, `software_version`, `token_endpoint_auth_method:"none"`,
`grant_types`, `response_types`, `scope`). All return
`400 {"error":"invalid_client_metadata"}`; `GET /api/oauth/register` is `405`.
Dynamic registration is effectively closed, so the OAuth path cannot mint a
client without an allowlisted shape.

Key creation stayed `403 Automated access detected.` after:

- a headed (non-headless) browser run,
- a 150-second pause,
- valid completed profile, valid session, `Origin`/`Referer`/`Sec-Fetch-*`.

`GET /api/user/api-keys` keeps returning `200 {"keys":[]}`. Conclusion: the gate
is IP/reputation-scoped (or challenge-cookie scoped) and does not lift on
retry within a session. `/mcp` ships only the literal `Bearer YOUR_KEY`
placeholder, so no sample key exists to borrow.

Consequence: **MCP `tools/list` and tool schemas remain unknown** — the one gap
that two further passes could not close without a non-blocked client IP.

## Corrections / refinements

| Earlier | Now |
| --- | --- |
| "profile list is just empty for a fresh account" | It is empty **until `status:complete`**; a partial profile is invisible to the list. |
| `409` described as duplicate-app handling | Also the natural path when `appProfilesCount` is exhausted (limit 1 on free). |
| DCR "exact accepted shape unknown" | Six RFC-standard shapes rejected; registration is closed rather than merely strict. |
| Bot gate "likely BotID-style" | Survives headed Chrome and idle time; behaves like IP reputation, not a per-session JS challenge. |
