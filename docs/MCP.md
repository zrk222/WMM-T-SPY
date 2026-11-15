# SpyTok as an MCP server

SpyTok ships a first-party **Model Context Protocol** server so external agents
(Claude, Cursor, VS Code, anything MCP-capable) can query its viral-post data.
This is a product surface, not an internal tool — the app markets it in-product.

## Endpoint

```
MCP transport : https://spytok.com/api/mcp   (HTTP transport, inferred; not handshaken)
Connector UI  : /connect  and  /connect/setup
OAuth         : /oauth/authorize   (authorization endpoint backing MCP auth)
```

Client-side constant (verbatim from `2fmn7mbdmkcxy.js`/feed chunks):

```js
let t = "https://spytok.com/api/mcp";
const n = "/connect",
      r = (e = n) => `/pricing?next=${encodeURIComponent(e)}`,
      o = "/connect/setup",
      i = (e) => (e ? `${o}#${e}` : o),
      s = "https://claude.ai/customize/connectors",
      u = `${s}?modal=add-custom-connector&connectorName=...`;
```

Third-party deep links observed:

```
https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=…
https://cursor.com/en-US/install-mcp
https://vscode.dev/redirect/mcp/install
```

## Connection model

1. User opens `/connect`; the app builds a per-profile connector URL
   (`https://spytok.com/api/mcp?id=<profileId>`).
2. The user authorizes via the app's own OAuth flow (`/oauth/authorize`) or
   provisions an API key (`/api/user/api-keys`).
3. Connections are listed and revocable: `/api/user/mcp-connections`,
   `/api/user/mcp-connections/{id}`.
4. Free tier can preview MCP (`/api/user/mcp-connect/ask-link` → `{askLink}`)
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

## Why it matters

The MCP server is the same data plane as the web app (posts, outliers, formats,
industries), exposed to agents. Because it is served from the same Next.js app
and OAuth issuer, the "agent API" inherits the web session model, tier limits
and revocation semantics (`tokenVersion`, per-connection revoke).

> Scope note: the MCP endpoint itself was **not** protocol-interrogated here. The
> claims above are from shipped client code, route names and in-product copy.
> Tool names/JSON schemas are therefore explicitly **unknown** in this analysis.
