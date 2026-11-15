# SpyTok as an MCP server

SpyTok ships a first-party **Model Context Protocol** server so external agents
(Claude, Cursor, VS Code, anything MCP-capable) can query its viral-post data.
This is a product surface, not an internal tool â€” the app markets it in-product.

## Endpoint and discovery

```
MCP transport : https://spytok.com/api/mcp   (HTTP; Allow: DELETE, GET, HEAD, OPTIONS, POST)
Connector UI  : /connect  and  /connect/setup   (setup requires an app profile)
OAuth AS      : /.well-known/oauth-authorization-server
OAuth resource: /.well-known/oauth-protected-resource  (+ /api/mcp suffix form)
Authorize     : /oauth/authorize â†’ onboarding when signed out
Token         : POST /api/oauth/token          (authorization_code, refresh_token)
Registration  : POST /api/oauth/register       (dynamic client registration — closed in practice)
Scopes        : spytok:read (single)
PKCE          : S256 only; token auth method "none" (public clients)
```

Unauthenticated `POST /api/mcp` responds:

```
401 {"error":"Missing Bearer token"}
Www-Authenticate: Bearer resource_metadata="https://spytok.com/.well-known/oauth-protected-resource/api/mcp", scope="spytok:read"
```

## Authentication: API key only

MCP does **not** accept the web session. Sending the session JWT as `Bearer`
returns `401 {"error":"Invalid API key"}`; sending the cookie alone returns
`401 {"error":"Missing Bearer token"}`. A dedicated key is required:

```
Authorization: Bearer YOUR_KEY
```

Key rules: created in the profile "AI tools" panel, **max 5 per account**
(`5 keys max. disconnect one first.`), displayed once
(`shows once, copy it now`), described as `for tools without sign in`, and
revocable. Creation is `POST /api/user/api-keys {name}` and is the route that
trips the bot gate (see SECURITY.md #12). The gate survived a headed browser, a
150 s pause and a completed profile, and `GET /api/user/api-keys` stayed
`{keys:[]}` — so no key could be minted and `tools/list` stays unknown.

Client-side constant (verbatim from the connect chunk):

```js
let t = "https://spytok.com/api/mcp";
const n = "/connect",
      r = (e = n) => `/pricing?next=${encodeURIComponent(e)}`,
      o = "/connect/setup",
      i = (e) => (e ? `${o}#${e}` : o),
      s = "https://claude.ai/customize/connectors",
      u = `${s}?modal=add-custom-connector&connectorName=SpyTok&connectorUrl=${encodeURIComponent(t)}`;
const keyHeader = "Authorization: Bearer YOUR_KEY";
```

Shipped install commands and deep links:

```
claude mcp add --transport http --scope user spytok https://spytok.com/api/mcp
https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=SpyTok&connectorUrl=â€¦
https://cursor.com/en-US/install-mcp
https://vscode.dev/redirect/mcp/install
```

Marketing page `/mcp` is titled "SpyTok for Claude and ChatGPT | Viral content
strategist in your AI chat", so ChatGPT is a first-class target as well.

## Connection model

1. User opens `/connect`; the app builds a per-profile connector URL
   (`https://spytok.com/api/mcp?id=<profileId>`).
2. The user authorizes via the app's own OAuth flow (`/oauth/authorize`) or
   provisions an API key (`/api/user/api-keys`).
3. Connections are listed and revocable: `/api/user/mcp-connections`,
   `/api/user/mcp-connections/{id}`.
4. Free tier can preview MCP (`/api/user/mcp-connect/ask-link` â†’ `{askLink}`)
   but gated features surface the paywall (`/pricing?next=/connect`).

## In-product MCP funnel

Dedicated analytics events reveal the intended loop:

```
mcp_connect_assigned   mcp_connect_viewed    mcp_connect_clicked
mcp_connect_copied     mcp_connect_stage     mcp_connect_first_question
mcp_connect_ask_clicked mcp_connect_interest mcp_connect_dismissed
mcp_connection_revoked
ask_claude_clicked
```

Copy/strings: `ask link read failed`, `ask link verdict unknown`,
`askClaudeClicked`, and a `connectOffer { show, target:"add", inProgress }`
object on `/api/app-profile` used to nudge users toward MCP when they add
another app.

## Connection state model

`GET /api/user/mcp-connections` (200) returns the nudge state machine:

```json
{"access":"free","arm":null,"connected":false,"clickedAt":null,"tool":null,
 "allowViewedAt":null,"deniedAt":null,"claudeAllowViewedAt":null,
 "dismissedAt":null,"connections":[],"keys":[],"lastAnswer":null,
 "firstAnswerAt":null,"inProgress":false,"serverNow":"â€¦"}
```

`access` gates the feature, `arm`/`tool` describe the connector, and the
timestamp columns drive the in-product prompts. Entitlement copy is explicit:
"SpyTok in Claude comes with Starter and Growth."

## Why it matters

The MCP server is the same data plane as the web app (posts, outliers, formats,
industries), exposed to agents. Because it is served from the same Next.js app
and OAuth issuer, the "agent API" inherits the web session model, tier limits
and revocation semantics (`tokenVersion`, per-connection revoke).

> Scope note: `tools/list` and tool schemas are **unknown** â€” key creation was
> blocked by the bot gate on every attempt. The claims above come from the
> published OAuth documents, live 401 contracts, shipped client code, route names
> and in-product copy. Transport was exercised only to `initialize` (which never
> ran because auth failed first).
