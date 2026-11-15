# Reproduction

Exact sequence used. Requires Chrome 157 and REA. All calls are read-only except
the throwaway account creation.

## 0. Browser

```powershell
chrome.exe --headless=new --remote-debugging-port=9222 --remote-allow-origins=* `
  --user-data-dir=$env:TEMP\rea-spytok-profile --no-first-run `
  --no-default-browser-check --disable-gpu --window-size=1440,900 https://spytok.com
```

```text
rea list_browser_targets(cdp_endpoint="http://127.0.0.1:9222")
→ target_id 5B7CC814F03493878B0288C225E3852D
```

## 1. Passive homepage inspection

```text
rea inspect_web_page(
  cdp_endpoint="http://127.0.0.1:9222",
  target_id="5B7CC814F03493878B0288C225E3852D",
  allowed_origins=["https://spytok.com"],
  include_script_sources=true, include_console_text=true,
  include_storage_keys=true, include_storage_fingerprints=true,
  include_websocket_shapes=true, include_accessibility_text=true,
  observation_ms=6000)
```

## 2. Bundle graph + routes

```text
rea analyze_web_bundle(
  cdp_endpoint="http://127.0.0.1:9222",
  target_id="5B7CC814F03493878B0288C225E3852D",
  allowed_origins=["https://spytok.com"],
  include_script_sources=true, detail="summary",
  view={kind:"javascript-routes", collection:"routes", limit:300})
```

```
inspect_analysis_view(parent, {kind:"javascript-routes", collection:"summary"})
inspect_analysis_view(parent, {kind:"javascript-routes", collection:"occurrences", limit:400})
```

## 3. Public route capture (network bodies)

```text
rea capture_browser_scenario(
  browser={mode:"launch", executable_path:"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"},
  start_url={url:"https://spytok.com/top-posts"},
  actions=[{action:"wait_for_timeout", step_id:"s1", duration_ms:5000}],
  capture={network:{request_body:true, response_body:true, header_values:true}})
```

## 4. Login and onboarding

```
PUT http://127.0.0.1:9222/json/new?https://spytok.com/login    → target A
PUT http://127.0.0.1:9222/json/new?https://spytok.com/onboarding → target B
rea inspect_web_page(target A) ; rea analyze_web_bundle(target A)
rea inspect_web_page(target B)
```

## 5. Account

Signup through the page's own fetch (no UI fragility):

```text
rea capture_browser_scenario(
  browser={mode:"launch", …}, start_url={url:"https://spytok.com/login"},
  actions=[{action:"request", step_id:"r1", method:"POST", path:"/api/auth/signup",
            headers=[{name:"content-type", value:{source:"literal", value:"application/json"}}],
            json:{name:"REA Bot", email:"spytok.re.20261115@gmail.com",
                  password:"SpyTok-RE-2026!a9"}}],
  capture={network:{request_body:true, response_body:true, header_values:true}})
→ 200, user id 6af9265776db035dc160e682
```

Credential: `spytok.re.20261115@gmail.com` / `SpyTok-RE-2026!a9` (disposable,
unverified).

## 6. Authenticated feed

```text
rea capture_browser_scenario(
  browser={mode:"launch", …}, start_url={url:"https://spytok.com/login"},
  actions=[
    {action:"request", step_id:"login", method:"POST", path:"/api/auth/login",
     expected_status:[200], timeout_ms:20000,
     headers=[{name:"content-type", value:{source:"literal", value:"application/json"}}],
     json:{email:"…", password:"…"}},
    {action:"goto", step_id:"g1", destination:{url:"https://spytok.com/home"},
     wait_until:"load", timeout_ms:40000},
    {action:"wait_for_timeout", step_id:"w1", duration_ms:12000}],
  capture={network:{request_body:true, response_body:true, header_values:true},
           limits:{max_network_body_bytes:262144,
                   max_network_body_allocation_bytes:16777216,
                   max_total_event_allocation_bytes:67108864,
                   max_network_transactions:2048}})
```

## 7. Second pass (HTTP + auth boundary)

Raw HTTP probes, no browser:

```bash
curl -s https://spytok.com/.well-known/oauth-authorization-server
curl -s https://spytok.com/.well-known/oauth-protected-resource
curl -si -X POST https://spytok.com/api/mcp -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{...}}'
curl -s https://spytok.com/api/subscription
curl -s -X POST https://spytok.com/api/subscription/guest-checkout \
  -H 'content-type: application/json' \
  --data '{"subscriptionTier":"basic","subscriptionPeriod":"monthly","successUrl":"…","cancelUrl":"…"}'
curl -s https://spytok.com/robots.txt
curl -s https://spytok.com/sitemap.xml | grep -c '<loc>'
curl -s https://spytok.com/sitemap-videos.xml | grep -c '<loc>'
```

Session cookie and JWT inspection:

```bash
curl -si -c jar -X POST https://spytok.com/api/auth/login \
  -H 'content-type: application/json' --data '{"email":"…","password":"…"}'
# read "Set-Cookie: token=eyJ…" flags, decode the middle base64url segment
curl -s -b jar https://spytok.com/api/frontend/posts?pageSize=2   # 200
curl -s -b jar -X POST https://spytok.com/api/user/api-keys \
  -H 'content-type: application/json' --data '{"name":"rea"}'      # 403 gate
curl -s -X POST https://spytok.com/api/mcp \
  -H "authorization: Bearer <jwt>" …                               # 401 Invalid API key
curl -s -b jar -X POST https://spytok.com/api/auth/logout          # 200 success
```

Browser sweep of the authenticated shell (same scenario contract as §5):
`goto` `/connect`, `/connect/setup`, `/admin`, `/app-profile`, `/niches`,
`/subscription/manage`, with `wait_for_timeout` between and 30 s `timeout_ms`.

## Contract lessons (hard-won)

- Every action needs `step_id`; timed steps need `duration_ms`.
- `timeout_ms` is mandatory for locator steps, otherwise a non-matching locator
  hangs until client cancellation (`ev_1cc99b40…`).
- Locators are `{kind:"role",role:"button",name:"…"}` or `{kind:"css",selector:"#id"}`
  or `{kind:"test_id",…}`.
- `fill.value` is `{source:"literal"|"secret", value:"…"}`.
- `goto.destination` is `{url:"…"}` plus `wait_until`.
- `expected_status` is an **array**.
- `request` takes `method`, `path`, `headers`, `json`; no `body` key.
- Captures over 10 MiB return `resource_constraint` with an `evidence_id`;
  export the bundle (`rea export_evidence_bundle`) and page it, or raise
  `REA_MCP_MAX_RESPONSE_BYTES` and restart.
- `inspect_analysis_view` does **not** accept `kind:"capture"` for
  `capture_browser_scenario`; export and parse the JSON instead.
