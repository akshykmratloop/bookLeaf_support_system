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
| F-12 | Email login searches all workspaces, and sessions cannot be revoked before they expire | **Part 1 fixed (2026-10-30):** a staff email has one account on the platform (`users.login_email`, unique); login is email + password and reads exactly one account; sign-up refuses a taken email (409 `EMAIL_TAKEN`). Test: `apps/api/test/staff-login.int.test.ts`. **Part 2 fixed (2026-10-30):** every session token carries `users.session_version`, checked on every request; logout, a password change and removal from a workspace bump it, so older cookies get 401 (logout signs out every device). Test: `apps/api/test/session-revocation.int.test.ts`. **Review fix (2026-10-30):** a removed staff member could sign straight back in, because login did not check membership. Login now refuses a staff account with no `workspace_members` row for its workspace, and the per-request session check does the same, so no path can issue or accept a session for removed staff. Test: same file ("cannot sign back in…"). |
| F-13 | Ticket numbers are one global sequence, so a tenant can estimate other tenants' volume | **Fixed (2026-10-30):** every workspace numbers its own tickets from 1001 under a fixed, platform-unique prefix (BL-1001, AC-1001, BL2-1001); 20 concurrent creates get 20 different numbers with no gap; another workspace's ticket is 404 by id and never matches a number search. BookLeaf's existing labels did not change. Tests: `apps/api/test/ticket-numbers.int.test.ts`, `apps/api/test/ticket-numbers-migration.int.test.ts`. |
| F-18 | `/embed` frame-ancestors is the union of all tenants' origins | **Fixed (2026-10-30):** every workspace's widget is at `/embed/<slug>`, and its `frame-ancestors` lists only that workspace's origins (BookLeaf's origin may frame `/embed/bookleaf` but not `/embed/acme`); unknown slugs are 404. A host token whose workspace differs from the slug in the address is refused (403) and not used up. The old `/embed` redirects to `/embed/bookleaf`. Test: `apps/api/test/embed.int.test.ts`. |
| F-19 | Replay cache, rate limits and the event bus live in memory | **Fixed (2026-10-30):** all of it is in Redis now, shared by every copy of the API. A host sign-in token used on one copy is refused on another; 5 sign-in tries a minute stay 5 across copies; a staff reply on one copy reaches an author listening on another. Production refuses to start without `REDIS_URL`. Test: `apps/api/test/multi-instance.int.test.ts`. |
| — | CSRF accepts a request with no Origin header in embed mode; the theme check uses `ancestorOrigins` | Low. Cookies are `SameSite`/`Partitioned`, and state changes need a valid session. |

## Not verified

- Behaviour on a hosted environment (TLS termination, real domains, real cookies across sites). Deployment is blocked
  until the user provides an account.
- A live voice call. Voice security tests use the fake voice provider.

## 2026-10-31 re-audit

Scope: `main` at `27c4843` (the deployed code), local stack and the live demo. Method: full history scan for secrets,
dependency audit, a black-box security script against the local stack, a live header check, and an AI eval re-run.

### Results

| Check | Result |
| --- | --- |
| Quality gates (typecheck, lint, format, build) | Pass |
| Tests on `27c4843` | API 731, web 176, shared 46, host-demo 31, host-web 4 (988 in total), all passing. After the fixes below the API has 762 tests, all passing. |
| `pnpm audit --prod` | No known vulnerabilities |
| Secrets in git history | Only fake test keys. No real key was ever committed. |
| Secrets in the live and local JS bundles | None found |
| `.env.example` | Every key in it is used by the code |
| Black-box security script (local stack) | 66 checks passed: sign-in and permissions on every route, author A against author B, cross-workspace access, CSRF and Origin checks, SSRF, XSS payloads, rate limits, security headers, API key scopes, webhook SSRF |
| Spoofed `X-Forwarded-For` on the live API | No effect (Caddy overwrites the header) |
| AI eval on current code | Triage category 45/46 (98%), priority 46/46, macro-F1 0.972 (`docs/eval-results.md`) |

AI provider keys can be set in env (defaults) or stored encrypted per workspace from the platform console.

### Fixed on 2026-10-31

| Commit | Problem | Fix |
| --- | --- | --- |
| `8e2f845` | A caller who was not signed in and sent bad input got 422, which reveals the request schema. | Sign-in is checked before the body is validated, so they get 401 (customer, platform and server-API routes). |
| `46712c8` | Sign-in guessing was limited per address only. Behind Vercel many users share one address. | Per-account lock: 10 attempts per account per 15 minutes across all addresses and all API copies (shared Redis counters), for staff and super-admin sign-in. The per-address limit is now a loose backstop (20 per minute). Unknown emails count the same, so the answer never shows whether an account exists. |
| `64e6da1` | A tenant-supplied URL (connector data source, webhook) could point at a name that later resolves to an internal address (DNS rebinding). | Every connection's DNS answer is checked at connect time and refused if any address is private or internal (127.x, 10.x, 169.254.169.254, ::1, IPv4-mapped IPv6 and so on). This is on top of the URL check and no redirects. |
| `ac33a65` | Self-signup has no email check, and AI and voice run on the platform's paid keys. | New companies start with AI, chat and voice off until the super admin approves them in the plan. Tickets, queue, connectors and settings work from day one. |
| `c768c84` | `.env.example` carried no placeholder for `SECRETS_MASTER_KEY`. | It now has a `replace-with-...` placeholder (`npm run local` swaps it for a random key). Production refuses to start if `JWT_SECRET`, `HOST_API_KEY`, `HOST_SIGNING_SECRET` or `SECRETS_MASTER_KEY` is still a placeholder. |

### Open, accepted low-risk items

- Demo passwords are published. The brief requires reviewers to have logins.
- Swagger docs are public in production. It is a read-only schema with no data.
- The Vercel HTML has no `script-src` CSP.
- The host hand-over token `jti` is not scoped to a workspace. Tokens are signed per host and can be used once.
- The `customers:read` API scope also returns ticket summaries.
- The voice ticket in the URL can appear in access logs. **Fixed 2026-11-01:** the ticket now travels in the WebSocket subprotocol (see below).

## 2026-11-01 hardening round

Scope: the code on `fix/hardening-2026-11-01`, merged after the 31 Oct re-audit. The round covered sign-in limits,
sessions, the AI checker and job queue, runtime safety, database speed, the widget and the deploy files.
`pnpm audit --prod` reports 0 known problems (the `glob` and `minimatch` overrides are in `pnpm-workspace.yaml`).

### Fixed on 2026-11-01

| Finding (plain words) | Severity | Fix | Where | Test |
| --- | --- | --- | --- | --- |
| Anyone could lock a real user out by typing wrong passwords for their email. | HIGH | Failures are counted per browser. A signed 90-day cookie (`bl_device`, console `bl_platform_device`) gives a browser that signed in before its own count. Unknown browsers share one count per email. Limit: 10 failures in 15 minutes. A success clears that browser's count. | `apps/api/src/modules/auth/login-throttle.ts`, `device-token.ts` | `login-throttle.test.ts` |
| Behind Vercel everyone shares one address, so address limits blocked real users or let one attacker use all of them. | MEDIUM | Address limits now include a second key: address + email (login), address + workspace slug (host hand-over), address + email plus an hourly cap for the whole platform (signup). | `apps/api/src/modules/auth/address-limits.ts` | API tests for login, hand-over and signup |
| A host outage used up the one-time hand-over token, and the token was not tied to one workspace. | MEDIUM | The token is keyed per workspace. It is used up only after the customer lookup works. | `apps/api/src/modules/auth/host-login.ts`, `used-tokens.ts` | `test/host-sign-in.int.test.ts` |
| Author sessions from a hand-over lasted 8 hours. | LOW | They last `HOST_SESSION_TTL_HOURS` (default 2). | `apps/api/src/config/auth.ts`, `apps/api/src/container.ts` | `test/host-sign-in.int.test.ts` |
| A session token meant for something else could be accepted as a session. | MEDIUM | Session tokens carry the audience `bookleaf-session` and it is required. | `apps/api/src/modules/auth/session.ts` | `test/session-revocation.int.test.ts` |
| The login password minimum was lower than the signup minimum. | LOW | Login now needs 12 characters, same as signup. | `packages/shared/src/schemas/auth.ts` | shared schema tests |
| Any workspace staff member could manage API keys, webhooks and data sources. | HIGH | These routes are owner-only (`workspaceRoles`). | `apps/api/src/modules/auth/workspace-role.ts`, `workspaces/api-key-routes.ts`, `connectors/routes.ts` and the webhook routes | role tests in the API suite |
| The voice ticket was in the URL, so it could land in logs. | MEDIUM | The ticket travels as a WebSocket subprotocol (`bookleaf.v1`, `ticket.<jwt>`). Redeeming it re-checks the session version. Request logs drop query strings. | `apps/api/src/modules/voice/stream-route.ts`, `apps/web/src/lib/voice/session.ts` | `test/voice-ticket.int.test.ts`, `session.test.ts` |
| The AI fact checker missed money and dates written in other ways. | HIGH | It reads number words on every channel. It blocks bare amounts of 1,000 or more, amounts next to money words, day+month dates without a year, weeks, months, quarters, `$`, `USD`, `EUR`, lakh, crore, `k`, and bad grouping like ₹1,0000. Book-title exemptions ignore case, match whole words, and never apply to titles that are only a figure. | `apps/api/src/ai/checker/loose.ts`, `patterns.ts`, `titles.ts` | checker unit tests |
| Author text in a ticket could push instructions into the triage prompt. | MEDIUM | Subject, description and book title are fenced as untrusted. Description is cut at 6,000 characters. If the AI raises priority above the category default with no rule, the ticket is marked needs-review. | `apps/api/src/ai/prompts/` | triage prompt tests |
| A failing fallback could loop forever, and two workers could finish the same job. | HIGH | New final state `FAILED` (migration `20261101090000_ai_job_failed`). A fallback that throws ends in `FAILED`. A job is reclaimed only while attempts <= max + 1. Finish and requeue work only while the worker still holds the lease. Old generations skip the model. Start-up checks that the lease is longer than the AI and host timeouts. | `apps/api/src/ai/jobs/` | `test/worker.int.test.ts` |
| One ticket could cost a lot of AI calls. | MEDIUM | Drafts send the last 6 earlier author messages. Triage sends the description and the last 3. After `AI_TICKET_RUNS_PER_WORKSPACE_PER_DAY` runs (default 2,000) a workspace gets the rules fallback with code `AI_BUDGET`. | `apps/api/src/ai/jobs/budget.ts`, `apps/api/src/config/ai.ts` | worker tests |
| Two staff clicks on Regenerate could race; a reply retry could hide a real error. | LOW | `regenerateDraft` locks the ticket row. `writeOnce` treats only an Idempotency-Key clash as a replay. | `apps/api/src/modules/messages/` and `apps/api/src/ai/jobs/` | `test/replies.int.test.ts` |
| The webhook sender used up attempts when the master key was missing. | LOW | It waits and does not count an attempt. | `apps/api/src/modules/webhooks/` | webhook tests |
| An unhandled error could crash the API silently. | MEDIUM | `unhandledRejection` is logged and the process keeps serving. `uncaughtException` starts a bounded shutdown and exits with code 1. Lint now refuses floating and misused promises in `apps/api/src`. | `apps/api/src/shutdown.ts`, `eslint.config.js` | `src/shutdown.test.ts` |
| Slow or stuck connections could hold the server. | LOW | `requestTimeout` 30 s, `keepAliveTimeout` 125 s. | `apps/api/src/app.ts` | startup tests |
| `/health` said OK when Redis was down; Redis errors showed as 500. | MEDIUM | `/health` checks Postgres and Redis (503 if either is down). Redis errors map to 503. | `apps/api/src/platform/http/health.ts` | `health.test.ts` |
| Open live streams could stop the server from shutting down; a database blip signed everyone out. | MEDIUM | Streams end in a `preClose` hook. The heartbeat sends session-expired only for sign-in or suspension errors. | `apps/api/src/modules/events/routes.ts` | `test/live-events.int.test.ts` |
| Chat limits were counted in one process only. | MEDIUM | Per-minute and rolling 24-hour limits use shared Redis counters per author. | `apps/api/src/modules/chat/limit.ts` | `test/multi-instance.int.test.ts`, `test/chat.int.test.ts` |
| A restarting API copy marked other copies' live calls as failed. | MEDIUM | On start-up only calls older than `VOICE_MAX_CALL_SECONDS` + 60 s are failed. | `apps/api/src/background.ts` | voice tests |
| Old ticket and message rows grew without limit; the ticket view read everything. | LOW | Daily purge (batched): AI jobs older than 30 days (never the newest generation per ticket and kind), settled webhook deliveries older than 30 days, AI runs older than 90 days. Audit events, tickets, messages and chats are kept. Ticket view returns the newest 500 messages and the last 20 AI jobs. Knowledge in the prompt is at most 100 articles of 8,000 characters. | `apps/api/src/modules/retention/purge.ts`, `scheduler.ts` | retention tests |
| The widget sent content to any page that framed it. | HIGH | The frame sends content only to the host origin it learned from a handshake. New `window.BookLeafSupport.signOut()` ends the widget session with the host's. | `apps/web/public/embed.js`, `apps/web/src/lib/frame.ts` | web `frame` tests, `test/embed.int.test.ts` |
| Vercel apps had no full Content-Security-Policy. | MEDIUM | The support app and author dashboard send a full CSP. The widget CSP allows https images (workspace logo). `HOST_SIGN_IN_URL` and `SUPPORT_URL` accept only http or https. | `deploy/vercel/*.tpl`, `apps/api/src/config/` | config tests |
| host-demo had open sign-in and a default password. | MEDIUM | Sign-in: 10 a minute per address + email. Support token: 30 a minute. `HOST_DEMO_PASSWORD` is required (no default). | `apps/host-demo/src/` | `apps/host-demo/test/app.test.ts` |
| Two packages (`glob`, `minimatch`) had known problems. | LOW | Overrides in `pnpm-workspace.yaml`. | `pnpm-workspace.yaml` | `pnpm audit --prod` = 0 |
| Containers used loose image versions and no limits. | LOW | Pinned images (node 22.23.4-alpine, postgres 16.15-alpine, redis 7.4.11-alpine, caddy 2.11.4-alpine). CPU caps, 30 s stop grace, Redis `volatile-ttl`, Caddy 30 s response-header timeout except live-stream, voice and chat paths. | `docker-compose.yml`, `deploy/` | deploy review (not a unit test) |

### Kept on purpose

- **Sign-up still answers "email taken".** There is no email provider. A silent answer would confuse real users.
- **Swagger stays public.** Reviewers need the API docs, and it is a read-only schema with no data.
- **`connectionTimeout` is not set.** It is a socket idle timeout and would cut live streams and slow AI answers.
- **Demo logins are published** (`deploy/demo-logins.env`): one password for all, authors at `<first name>@bookleaf.com`, staff at `admin@bookleaf.com` and `ops2@bookleaf.com`, super admin at `superadmin@support.com`. The brief requires reviewers to have logins. One-time reset: `deploy/demo-reset-id`.

### Not done by decision

- **Database backups to S3 or EBS, and snapshots before each deploy.** The owner decided this is not needed for a demo.
