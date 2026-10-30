# Security report

Branch `feature/support-saas`, 2026-10-28. Scope: the support API, the support web app and widget, the embed script,
and how they connect to the host product, AI and voice providers, webhooks and the server API. Method: an independent
read-only audit (`docs/qa/fable-review.md`), then fixes with tests that failed first, then automated tests, a real-browser
run (`docs/qa/browser-journeys.md`) and a run of the production Docker image. Nothing was deployed.

## Result

- **3 P0 and 2 P1 holes were found and fixed**, all tenancy or SSRF. Each has a regression test.
- **No open P0 or P1.** Three P2 or P3 design items are deferred and written down (see the end).
- The built browser bundles contain no secret-like strings: no provider keys, no `blsk_` keys, no secret env var names,
  no database URLs. There are also no `VITE_` variables in either app.

## What was checked

| Area | What was checked | Evidence |
| --- | --- | --- |
| Tenant isolation | Admin reads of chat transcripts, voice calls, tickets, drafts and settings stay in the admin's workspace (404 elsewhere). Platform AI settings are for the platform operator only (403). The live stream only carries the subscriber's workspace. | `test/tenant-isolation.int.test.ts`, `test/workspaces.int.test.ts`; fixes F-01 to F-04 (`b16453c`) |
| Live stream (SSE) | Over a real socket: an author receives only author-visible events for their own tickets, never internal notes, and never another author's. No sign-in gives 401. Each heartbeat re-checks the session. | `test/live-events.int.test.ts` (a mutation check made it fail) |
| Roles | Authors cannot use admin routes. Default deny on every route unless marked public. | `test/rbac.int.test.ts` (9 tests) |
| Author A vs author B | One author cannot read another's tickets, books or conversations (404). | `test/rbac.int.test.ts`, `test/author-tickets.int.test.ts` |
| CSRF / Origin | State-changing requests from a foreign Origin get 403. Non-JSON bodies get 415. | `test/tickets.int.test.ts`, `test/security.int.test.ts` |
| Headers | CSP, HSTS, `nosniff` and frame options are present. `frame-ancestors` comes from the workspaces' allowed origins, with unsafe values rejected. | `test/security.int.test.ts`, `test/embed.int.test.ts`; seen on the Docker image |
| Widget origins | `javascript:` and CSP-injection strings are rejected as allowed origins (422). | `test/embed.int.test.ts`; browser journey 3 |
| SSRF | Tenant connector URLs are checked on save and again before every request (DNS rebinding). Private, link-local, documentation, IPv4-mapped IPv6 and NAT64 ranges are blocked. Production refuses `CONNECTOR_ALLOW_PRIVATE_HOSTS=true` at start-up. | `src/platform/net/ssrf.test.ts`, `test/connectors.int.test.ts`; F-05 (`bf9feb1`); seen on the Docker image |
| Secrets at rest | Connector secrets and workspace AI and voice keys use AES-256-GCM envelope encryption, bound to workspace and purpose (AAD). Keys are never returned to the browser, and an unreadable key never falls back to the platform key. | `src/platform/crypto/envelope.test.ts`, `test/provider-keys.int.test.ts` |
| Host hand-over sign-in | Signed 5-minute token, single use (`jti`), and the host signature is checked. | `test/host-sign-in.int.test.ts` (11 tests) |
| Webhooks out | HMAC-SHA256 signature over `timestamp.body`, a 5 s timeout, no redirects, and an SSRF re-check at send time. | `src/modules/webhooks/signing.test.ts`, `test/webhooks.int.test.ts` |
| Server API in | Bearer `blsk_` workspace key with a `tickets:read` scope; other workspaces' tickets are invisible; internal notes are never included; 120/min. | `test/server-api.int.test.ts` |
| Rate limits | Login 5/min, host sign-in 20/min, sign-up per hour, chat per workspace setting plus a 120/min flood guard, voice per user. **New:** ticket creation is 30 per author per hour (each ticket starts paid AI work). | `test/ticket-rate-limit.int.test.ts` (`c01353d`), `test/chat.int.test.ts` |
| Prompt injection | Author text is fenced and marked untrusted. Fence tags inside author text are disarmed (F-16). Live triage eval: injection attempts never changed the category or raised the priority. Replies are checked server-side for unsupported figures and promises; a flagged reply needs a written, audited override. | `src/ai/prompts/untrusted.test.ts`, `test/replies.int.test.ts`, `docs/qa/ai-benchmark.md` |
| Audit integrity | An override audit row is written in the same transaction as the reply it explains (F-15). | `test/replies.int.test.ts` (`6ecfc5a`) |
| Error responses | RFC 7807 problems. Vendor error messages never reach the client (a 401 from the AI provider is checked). | `src/ai/providers/anthropic/failures.test.ts` |
| Config at start-up | Production fails fast on missing required settings and on unsafe flags. | Seen on the Docker image (2 refusals before a clean start) |

## Dependencies (`pnpm audit`, 2026-10-28)

- **Production:** 1 high, `deepmerge-ts` (pulled in by Prisma). **Fixed (2026-10-30):** a pnpm override in
  `pnpm-workspace.yaml` pins `deepmerge-ts` to `>=8.0.0` (resolves to 8.0.2); `pnpm audit --prod` now reports no known
  vulnerabilities.
- **Development only:** 2 critical (`tinypool` via vitest) and 4 moderate. These do not ship in the image.

## Deferred (documented, not fixed)

| ID | Risk | Why it waits |
| --- | --- | --- |
| F-12 | Email login searches all workspaces, and sessions cannot be revoked before they expire | **Part 1 fixed (2026-10-30):** a staff email has one account on the platform (`users.login_email`, unique); login is email + password and reads exactly one account; sign-up refuses a taken email (409 `EMAIL_TAKEN`). Test: `apps/api/test/staff-login.int.test.ts`. **Part 2 fixed (2026-10-30):** every session token carries `users.session_version`, checked on every request; logout, a password change and removal from a workspace bump it, so older cookies get 401 (logout signs out every device). Test: `apps/api/test/session-revocation.int.test.ts`. |
| F-13 | Ticket numbers are one global sequence, so a tenant can estimate other tenants' volume | **Fixed (2026-10-30):** every workspace numbers its own tickets from 1001 under a fixed, platform-unique prefix (BL-1001, AC-1001, BL2-1001); 20 concurrent creates get 20 different numbers with no gap; another workspace's ticket is 404 by id and never matches a number search. BookLeaf's existing labels did not change. Tests: `apps/api/test/ticket-numbers.int.test.ts`, `apps/api/test/ticket-numbers-migration.int.test.ts`. |
| F-18 | `/embed` frame-ancestors is the union of all tenants' origins | Needs per-workspace embed paths. Low practical risk: the page needs a valid host token for that workspace. |
| F-19 | Replay cache, rate limits and the event bus live in memory | Safe on one instance. Documented in `docs/architecture.md` §21; move to Postgres or Redis before scaling out. |
| — | CSRF accepts a request with no Origin header in embed mode; the theme check uses `ancestorOrigins` | Low. Cookies are `SameSite`/`Partitioned`, and state changes need a valid session. |

## Not verified

- Behaviour on a hosted environment (TLS termination, real domains, real cookies across sites). Deployment is blocked
  until the user provides an account.
- A live voice call. Voice security tests use the fake voice provider.
