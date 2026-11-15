# Evidence ledger

All REA records referenced below are complete-record retained Evidence from the
session that produced this repository. Times are UTC on 2026-11-15.

## Primary evidence records

| # | Operation | Evidence ID | What it proves |
| --- | --- | --- | --- |
| 1 | `list_browser_targets` | `ev_135442225a5197a36b14f7b5d72e36e6859c1d7b8addae3407f09aa551df084d` | target identity, browser build 157.0.8103.52 |
| 2 | `inspect_web_page` (homepage, 6 s) | `ev_eb2040f9cb8cfe7026aefa973a04ad9f855b318b51472e4ac7b140d6cf020d6b` | full DOM/scripts/storage/accessibility of `/` |
| 3 | `analyze_web_bundle` (homepage) | `ev_e3cefa0854645ae0f1db7d8becad1a125da2c779fed06dbaa47282d62293a0d6` | 18 sources, 13 routes, 27 route occurrences |
| 4 | routes view of #3 | `ev_c600e45e1e8055fab9e0cd87ed8fb475589c6d6ed91da589c79110dcae42bcc6` | route list |
| 5 | `capture_browser_scenario` (`/top-posts`, 5 s wait) | `ev_b39b09f7e6628c9793e7162832c77d2ba6d71e6c3c44ebeb35eac507857b362a` | 120 transactions, `/api/auth/me` 401, RSC tree payload, CSP, chunk inventory |
| 6 | `analyze_web_bundle` (`/login`) | `ev_4fdee971e6ea5da67c6298a43d221d7bc17dd02f5418ebd4cee418f0a16f7cad` | login-page bundle graph |
| 7 | routes view of #6 | `ev_49f59973bae8edfd0751c8f2d9f3509b7b7f5cb268ec40f26cc217befff2462a` | route list (login page) |
| 8 | `inspect_web_page` (`/onboarding`, 4 s) | `ev_5b54b3425f1a7fd1217d0fdce0803c27e6478e580a0e00bbb3214ed2855412cf` | 5-step wizard, flows, validation copy, onboarding API bodies |
| 9 | `capture_browser_scenario` (failed signup click) | `ev_1cc99b4085eef00cf37496c0be6c1ce0d3af05cfe2cabac59583b24e2455625a` | step timeout behaviour (locator without `timeout_ms` blocks) |
| 10 | `capture_browser_scenario` (signup via `request` action) | response `400` then `200` in `/tool-output` capture; account created `6af9265776db035dc160e682` | full `user` object, Mongo-style id, limits map |
| 11 | `capture_browser_scenario` (login → `/home`, 12 s) | `ev_84fc446d8da1e4a64f8ec2be47a9ab1733c2445d93db5eb74032eaec83861be7` | authenticated feed: `/api/frontend/home`, `/api/frontend/posts`, `/api/user/alerts`, `/api/adaptation/credits`, `/api/app-profile`, `POST /home` |

Supporting views: `ev_e894dd3c676c784342ba04f1cbbd2506330bd3cc5a2485603624790b25a2c311`
(routes summary), `ev_0b8d163044d904148d4e7a53390a82ce35c6ae10cc0c8ff1198bcdaef5fa4661`
(route occurrences), `ev_e1987fae3ce1c5554a361aca42280f0ee1b305e1271ee7acac3a6d1085ab78f6`
(target list re-check).

## Deterministic identities

```
Deployment              dpl_E5F7n34E42UV5FaByH92KNgcUykd
Document ETag           W/"953ede9a1d75f51a4b2b00174789608c"
RSC ETag                W/"490ebdbbca9e2b49e5683ff771770d9d"
Browser                 Chrome/157.0.8103.52 (HeadlessChrome/157.0.0.0)
React                   19.3.0-canary-278794d7-20261002
PostHog JS              1.347.2
Test account id         6af9265776db035dc160e682
signupIpHash            87de39f99afb945006943b60716d13e4
Session bundle exports  205,563,304 B (13 records) and 214,247,651 B (16 records)
```

## Chunk digests recorded by REA

| Chunk | SHA-256 |
| --- | --- |
| `1psa607d3bjjy.js` | `9e679a1dadf9ac81b53b7478d757522fc9bf4e5789004d375c145ea120619e65` |
| `3lsnzlxlve1iw.js` | `50be5988a66b2df0a0885957da82755336f82967f8e7103d81b6afa2a63e4826` |
| `0_b6xl0d-oes8.js` | `4e12493330534a133cc262221d9ea6d06e82f4c0b8a363aa6b5a4933ac89fe12` |
| `3j2c7d-axicaj.js` | `ef62502a50c7f4ca815da872b660120785ec82831ed14cf61b811da150fddafd` |
| `08wf-qlgsq2lx.js` | `92b683fd56990a783dfb12a1d481647c9e8665ec53b3543b750936ceef5dc344` |

Other chunks were parsed from the capture but not individually digested in the
returned views; their URLs + byte sizes are listed in `ARCHITECTURE.md`.

## Bodies retained verbatim (post size limits)

- `/api/auth/signup` request and 200 response (account + limits).
- `/api/auth/login` request and 200 response.
- `/api/auth/me` (401 anonymous; 200 authenticated, 1062 B).
- `/api/app-profile?all=1&with=connectOffer` (106 B).
- `/api/user/alerts` (13 B).
- `/api/frontend/home` (1,485 B, full).
- `/api/frontend/posts` (13,868 B, full: 20 posts + `nextCursor` + `totalCount`).
- `/api/adaptation/credits` (73 B).
- `POST /home` flight response `0:{"a":"$@1","q":"","i":false}`.
- `/home` HTML document (31,569 B) including the RSC module manifest.

## Redactions and known gaps

- `set-cookie` values are **redacted** by the capture policy; the session cookie
  name/value is unknown. All authenticated work was therefore performed inside a
  single recorded scenario rather than replayed from a stored cookie.
- Request `cookie` headers appear as redacted entries.
- Storage values are hashed only; no plaintext values were retained.
- `/top-posts` document body exceeded its 65,536-byte per-body budget (91,936 B
  observed) and was re-read for content at identical byte length and deployment
  id; that re-read is marked as a supplement, not captured Evidence.
- Screenshots were not captured: the persistent CDP session timed out on
  `Page.enable` (provider_timeout), twice, including a 60 s retry.
- The hosted MCP endpoint was not protocol-interrogated; `docs/MCP.md` states
  what is and is not known.
- Admin surface, Stripe price IDs, and the LLM provider/model remain unknown
  (not present in shipped client code).

## Provenance notes

- Chrome scenario captures report `authority: "controlled-replay"`; passive page
  inspection reports `authority: "external-service"`. Both are marked observed.
- No target file was modified. The only server-side writes were creation of the
  throwaway account and reads of its own data.
