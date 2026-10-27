# Independent QA review (Q1) — BookLeaf support module

- Audit commit: `4f9ddff` on `feature/support-saas` (worktree `bookleaf-support-saas`)
- Reviewer: independent read-only auditor (Fable). Nothing in the repo was changed, no servers were started, no paid AI calls were made.
- Scope: assignment fit, security and tenancy, AI grounding, correctness, chat and voice, frontend, tests, docs.
- Method: full read of `apps/api/src`, `packages/shared`, `apps/host-demo`, the widget (`apps/web/public/embed.js`, `apps/web/src/lib/*`, shells), the Prisma schema and migrations, all 20 integration test files and the test harness. Line numbers refer to the audit commit.

## 1. Summary

**Verdict: the single-tenant BookLeaf assignment is met well and the code quality is high, but the multi-tenant SaaS layer is NOT safe to ship.** Three cross-workspace holes let any self-serve workspace admin read other tenants' chat and call transcripts and change the platform-wide AI switches. Those must be fixed before any second tenant signs up. Everything else is P2/P3 polish or hardening.

The five most important problems:

1. **F-01 (P0)** `GET /api/v1/admin/chat/sessions/:id` returns any workspace's chat transcript — the lookup is by id only, no `workspaceId` filter.
2. **F-02 (P0)** `GET /api/v1/admin/voice/calls/:id` returns any workspace's call transcript, draft and spoken-figure check — same bug.
3. **F-03 (P0)** `PUT /api/v1/admin/ai/settings`, `GET /admin/ai/status|settings`, `POST /admin/ai/test` operate on the platform-wide singleton `ai_settings` (id = 1). Any workspace owner created through public `POST /signup` can flip `simulateOutage`, change the provider and models for every tenant, and ping the platform's AI key.
4. **F-04 (P1)** SSE `/api/v1/events` sends every workspace's ticket events to every admin (ticket ids leak across tenants, and every admin dashboard refetches on every other tenant's activity).
5. **F-05 (P1)** The connector SSRF check runs only when the URL is saved; the real fetch happens later and re-resolves DNS, so a tenant can point the connector at an internal address after the check (DNS rebinding / TOCTOU). The private-range list is also incomplete.

What is good (verified, not just read): tickets, drafts, messages, books, conversations, ticket-drafts, workspace settings, connectors, fields, provider keys and API keys are all workspace- and author-scoped; host tokens are single-use with a 5-minute life and the replay guard is tested; CSRF uses an Origin check plus JSON-only parsing; the voice socket checks Origin and ownership; turn reservation and call claiming are atomic; tickets, settings and connectors use optimistic locking; AI jobs use `SKIP LOCKED` leases with a generation guard; the server-side checker blocks placeholders without any override; provider keys never reach a response (tested with a sentinel); integration tests run against a real Postgres via testcontainers with the real demo host as an HTTP server.

## 2. Findings

Severity: P0 = must fix before any multi-tenant use; P1 = fix before production; P2 = fix soon; P3 = nice to have.

### F-01 — P0 — Tenancy — Admin can read any workspace's chat transcript

- Where: `apps/api/src/modules/chat/routes.ts:132-142` → `apps/api/src/modules/chat/sessions.ts:42-43` (`chatTranscript`) → `apps/api/src/modules/chat/repository.ts:17-21` (`findSessionById`).
- What is wrong: the route passes only `req.params.id`; `findSessionById` does `db.chatSession.findUnique({ where: { id } })` with no `workspaceId`. Any signed-in ADMIN of any workspace gets the full transcript (author messages, proposals, facts used).
- Reproduction: sign up workspace B (`POST /signup`), log in as its owner, call `GET /api/v1/admin/chat/sessions/<id of a BookLeaf chat session>` → 200 with the transcript. Ids are UUIDs, but they are also exposed to any BookLeaf admin via `AdminTicketSchema.chatSessionId` and leak through F-04.
- Fix: `chatTranscript(deps, session, id)` and `findSessionById(db, workspaceId, id)` with `where: { id, workspaceId }`; return 404 on a mismatch like `tickets/repository.ts ownership()` does.
- Test: in `workspaces.int.test.ts` "tenant isolation", create a chat session as Kavita, then `GET /admin/chat/sessions/:id` as the acme owner → expect 404.
- Confidence: high.

### F-02 — P0 — Tenancy — Admin can read any workspace's voice call

- Where: `apps/api/src/modules/voice/routes.ts:130-140` → `apps/api/src/modules/voice/read-calls.ts:21` (`adminGetCall`) → `apps/api/src/modules/voice/repository.ts:18-22` (`findCall`).
- What is wrong: `findCall` is `db.voiceSession.findUnique({ where: { id } })`, no workspace filter. Returns transcript, ticket draft, proposal and `spokenCheck` for any tenant's call.
- Reproduction: same as F-01 with a voice session id (exposed via `AdminTicketSchema.voiceSessionId`).
- Fix: thread `session.workspaceId` into `adminGetCall` and `findCall`; filter `{ id, workspaceId }`.
- Test: `voice.int.test.ts` — after "runs a full call", `GET /admin/voice/calls/:id` with another workspace's admin cookie → 404.
- Confidence: high.

### F-03 — P0 — Tenancy / privilege — AI settings are platform-global but editable by every workspace admin

- Where: `apps/api/src/modules/ai-admin/update-ai-settings.ts:36-49` (`findUniqueOrThrow({ where: { id: 1 } })`, `updateMany({ where: { id: 1, version } })`); `apps/api/src/modules/ai-admin/routes.ts` (all routes `roles: ['ADMIN']`, no workspace scope); `apps/api/src/modules/ai-admin/ai-status.ts` (`/admin/ai/test` pings the platform key); `prisma/schema.prisma` `AiSettings` singleton.
- What is wrong: `ai_settings` row 1 holds the provider, models and `simulateOutage` for the whole platform. Signup is public, so anyone can create a workspace, become its ADMIN and (a) set `simulateOutage: true` to turn AI off for every tenant, (b) change the platform provider/models, (c) learn which platform providers are configured and (d) make the platform pay for test calls. The per-workspace `WorkspaceSettings.triageModel/draftModel/chatModel` exist, but the global row still wins for provider and outage.
- Reproduction: `POST /signup` → login → `GET /admin/ai/settings` (version) → `PUT /admin/ai/settings {version, simulateOutage: true}` → BookLeaf's drafts now fall back to rules.
- Fix: either (1) restrict `/admin/ai/*` to a platform-operator role (e.g. members of the default workspace with `isDefault`, or a new `PLATFORM_ADMIN` role) or (2) move provider/outage into `WorkspaceSettings` and read it per workspace in `ai/jobs/runtime.ts`. Option 1 is a two-line guard and is the safe stop-gap.
- Test: acme owner `PUT /admin/ai/settings` → expect 403; BookLeaf admin still 200. Also: acme `POST /admin/ai/test` → 403.
- Confidence: high.

### F-04 — P1 — Tenancy — SSE sends every workspace's ticket events to every admin

- Where: `apps/api/src/modules/events/routes.ts:10-11` (`canSee`: `session.role === 'ADMIN' || ...`), `apps/api/src/platform/event-bus.ts` (`TicketEvent` has no `workspaceId`).
- What is wrong: an admin of workspace B receives `{type, ticketId}` hints for every ticket in every workspace. Ticket ids leak (the follow-up REST fetch correctly 404s, but see F-01/F-02 where ids are enough), and every admin dashboard refetches its queue whenever any tenant does anything (load multiplier = number of tenants).
- Fix: add `workspaceId` to `TicketEvent` where it is published (ticket create/update/message/AI job handlers) and check `e.workspaceId === session.workspaceId` in `canSee`.
- Test: open `/events` as acme owner, create a BookLeaf ticket, assert no `ticket` event arrives within ~500 ms; then as BookLeaf admin assert it does.
- Confidence: high.

### F-05 — P1 — Security (SSRF) — Connector URL is checked only at save time; fetch re-resolves later

- Where: `apps/api/src/modules/connectors/save.ts:12-28` (`assertSafeUrl` on save), `apps/api/src/platform/net/ssrf.ts:25-40, 64-82` (resolves once), `apps/api/src/host/http/records.ts:17-19` (plain `fetch(url, { redirect: 'error' })`, no pinned address).
- What is wrong: (1) DNS rebinding: a tenant saves `https://host.attacker.example` that resolves to a public IP at save time and to `169.254.169.254` / `10.x` a minute later; every later customer fetch goes to the internal address with the tenant's own Bearer key, and the response is parsed by `HostCustomerSchema` (so the data is mostly discarded, but timing, status and schema errors still leak and internal endpoints are hit). (2) `PRIVATE_V4` does not include `192.0.0.0/24`, `198.18.0.0/15`, `100.64.0.0/10` (CGNAT) and IPv6 `::ffff:` mapped forms are only partly covered. (3) The default workspace's `HOST_API_URL` from env (`connectors/from-env.ts:30`) is never checked — acceptable because it is operator-controlled, but worth a comment.
- Fix: resolve at fetch time and connect to the resolved address (e.g. `undici.Agent` with a custom `connect`/`lookup` that re-runs `isPrivateV4/V6`), or re-run `assertSafeUrl` inside `records.ts` before each fetch (cheap, cached 60 s). Extend the ranges.
- Test: unit test for `isPrivateV4('192.0.0.9')`, `('198.18.0.1')`, `('100.64.0.1')` → true; integration test with a hostname that the harness resolves to 127.0.0.1 after save (inject a `lookup` into the records client) → expect `HostUnavailableError`, not a request.
- Confidence: high for the design gap; medium for exploit impact (schema parsing limits what leaks).

### F-06 — P2 — Assignment fit / docs — Workspace API keys cannot authenticate anything

- Where: `apps/api/src/modules/workspaces/api-keys.ts:103` (`verifyApiKey`), only used by `container.ts:181` and `workspaces/service.ts:46` (`verify`), which no route calls; `docs/integration.md:310` advertises "server-to-server keys".
- What is wrong: admins can create, list and revoke `blsk_…` keys with scopes `customers:read`, `tickets:read`, `tickets:write`, but no request path accepts an `Authorization: Bearer blsk_…` header. The feature is a UI with no effect; `lastUsedAt` can never update.
- Fix: either wire a bearer-key authenticator into `auth-guard.ts` for a small `/api/v1/integrations/*` surface with scope checks, or remove the page and the doc line until it exists.
- Test: create key → `GET /api/v1/tickets` with `Authorization: Bearer <plainKey>` → today 401; decide the contract and test it.
- Confidence: high.

### F-07 — P2 — AI grounding (voice) — Spoken-figure check cannot see numbers spoken as words

- Where: `apps/api/src/voice/call/instructions.ts:58-59` tells the model to say amounts in words ("three thousand five hundred and seventy rupees"); `apps/api/src/modules/voice/finish.ts:55` runs `checkSpokenFigures` over the transcript; `apps/api/src/ai/checker/extract.ts` only extracts digit forms (₹, %, D/M/Y dates, "N days").
- What is wrong: when the assistant follows its own instructions, the after-call check finds no figures and reports `passed: true`. The only test (`voice.int.test.ts` "flags spoken figures") uses the digit form `₹99,999`, so the gap is invisible. Unsupported amounts spoken in words are never flagged for admins.
- Fix: add a number-words parser (en + the Hindi/Hinglish words the persona uses: "hazaar", "lakh") in `extract.ts`, or instruct the model to speak digits in its transcript and words only in audio (not controllable). The parser is the realistic fix.
- Test: unit test in `ai/checker`: `"you have three thousand five hundred and seventy rupees pending"` with facts containing ₹3,570 → pass; with ₹3,500 → `UNSUPPORTED_AMOUNT`.
- Confidence: high.

### F-08 — P2 — AI grounding (multi-tenant) — Rule-based templates hardcode BookLeaf policy figures

- Where: `apps/api/src/ai/drafting/templates.ts:43-78` ("48 hours", "5–7 business days", "₹1,000"); checker allow-list is built from host facts (`ai/checker/allowed.ts`), and the KB figures come from the host (`apps/host-demo/src/facts/kb-constants.ts`).
- What is wrong: templates are the fallback when AI is down or blocked. For any workspace whose host does not send the same `kb.*` facts (every non-BookLeaf tenant), the template draft contains figures the checker cannot verify, so it is blocked, and the admin gets a blocked rule draft instead of a usable one. For BookLeaf it works only because the demo host happens to send matching facts.
- Fix: build template timelines from facts (`kb.escalation_window.display`, `kb.print_turnaround.display`) and omit the sentence when the fact is missing; or mark templates as workspace content in settings.
- Test: run the draft handler with a facts pack that has no `kb.*` facts → expect the template draft to pass the checker (no figures) rather than block.
- Confidence: high (behaviour follows directly from the code); impact medium.

### F-09 — P2 — Correctness (host records) — A customer deleted at the host crashes chat/voice instead of degrading

- Where: `apps/api/src/host/facts.ts:27-35` (`customerOrNull` catches only `HostUnavailableError`); `apps/api/src/host/http/records.ts` throws `CustomerNotFoundError` on 404.
- What is wrong: if the host returns 404 for an author who already has a session (deleted or renamed id), every chat message, voice call start and `GET /books` for that author fails with a 404 "Customer not found" problem (or 500 depending on the route) instead of the designed "records unavailable" fallback. The author sees an error on every screen with no way out.
- Fix: treat `CustomerNotFoundError` in `customerOrNull` the same as unavailable (return null and log), and show "We can't see your account right now" in the UI.
- Test: `host-sign-in.int.test.ts` "when the host is down" sibling: sign Priya in, then swap the host's author list so AUTH001 404s, send a chat message → expect 200 with `host.records_unavailable` in the prompt.
- Confidence: medium (route-level status depends on the error handler mapping; the propagation is certain).

### F-10 — P2 — Correctness (limits) — Chat rate limits use env values, not the workspace's settings

- Where: `apps/api/src/modules/chat/routes.ts:62, 92` (`perUser(limits.chat.messagesPerMinute …)`), `apps/api/src/routes.ts:37` (`limits: c.limits` from `assistant/limits.ts:17 limitsFromEnv`); the per-workspace `messagesPerMinute/messagesPerDay/maxTurnsPerSession` live in `WorkspaceSettings` and are enforced in `chat/limit.ts` by DB counting.
- What is wrong: two different limits apply to the same request: the route-level `@fastify/rate-limit` uses the platform env value; the service uses the workspace value. A workspace that raises `messagesPerMinute` above the env value is silently capped by the route limiter (429 from the plugin with a different error shape); one that lowers it still pays the DB count. Confusing but not unsafe.
- Fix: drop the route-level limiter for chat messages (the DB check is authoritative) or make `perUser` read the workspace value from `req.session`.
- Test: set workspace `messagesPerMinute: 60` while env says 20; send 25 messages in a minute → expect 200s until 60.
- Confidence: high.

### F-11 — P2 — Chat and voice — Turn limit can be exceeded by typing during a call

- Where: `apps/api/src/modules/voice/chat-link.ts:17-20, 43-45, 73` (`LEAST(turn_count + spoken, maxTurns)`), `apps/api/src/modules/chat/send-message.ts` (reserves one turn atomically).
- What is wrong: the call reserves the remaining turns up front, but the author can still type messages in the same chat session while the call is active; typed turns and spoken turns both count against the same session. `LEAST` caps the counter, not the messages: the transcript can hold more than `maxTurns` exchanges and the counter no longer reflects reality. Minor cost control gap, not a security issue.
- Fix: refuse `POST /chat/sessions/:id/messages` with 409 `VOICE_CALL_ACTIVE` while a call for that session is ACTIVE; or deduct typed turns from the call's budget live.
- Test: start a call linked to a chat, type a message → expect 409.
- Confidence: medium (depends on whether the UI blocks typing; the API does not).

### F-12 — P2 — Security (auth) — Email login searches all workspaces; sessions cannot be revoked

- Where: `apps/api/src/modules/auth/service.ts:19-23` (`findMany` across workspaces, `take: 5`, password decides); `apps/api/src/modules/auth/session.ts` (stateless HS256, `SESSION_TTL_HOURS` up to 72, no jti/denylist); `POST /auth/logout` only clears the cookie.
- What is wrong: (1) the same email in several workspaces picks the first account whose password matches — a user with the same password in two workspaces lands in the oldest one with no way to choose; (2) a stolen cookie stays valid for up to 72 h after logout or password change; admin removal (`workspaceMember` delete) does not end the session.
- Fix: add a `sessionVersion`/`tokenInvalidBefore` column on `User` checked in the auth guard (one indexed read per request, or a 60 s cache); add workspace slug to the login form when the email is ambiguous.
- Test: login → change password → old cookie → expect 401.
- Confidence: high.

### F-13 — P2 — Tenancy (information leak) — Ticket numbers are a global sequence

- Where: `apps/api/prisma/schema.prisma:390` (`number Int @unique @default(autoincrement())`).
- What is wrong: ticket numbers are shared across all workspaces, so every tenant can see the platform's total ticket volume and infer other tenants' activity from gaps. Authors also see `number`.
- Fix: per-workspace counter (`Workspace.nextTicketNumber` updated in the ticket-create transaction with `UPDATE … RETURNING`) and a `@@unique([workspaceId, number])`.
- Test: create tickets in two workspaces → each starts at 1.
- Confidence: high.

### F-14 — P2 — Docs vs code — Status machine allows CLOSED → OPEN; architecture doc says CLOSED is terminal

- Where: `apps/api/src/modules/tickets/status-machine.ts:9` (`CLOSED: ['OPEN']`) and `:21` (an author message on RESOLVED/CLOSED reopens); `docs/architecture.md:379-381` (`CLOSED --> [*]`).
- What is wrong: either the doc or the code is wrong. Today an author can reopen a ticket closed as spam/duplicate just by replying, which is probably not intended for the "spam" case.
- Fix: decide; if CLOSED is terminal, make author replies on CLOSED return 409 and keep RESOLVED → OPEN on reply.
- Test: `tickets.int.test.ts`: admin CLOSED → author POST message → assert the chosen behaviour.
- Confidence: high (mismatch is certain; intent is not).

### F-15 — P3 — Correctness — Override audit row is written outside the message transaction

- Where: `apps/api/src/modules/messages/service.ts:34-53` (`gateReply` writes `auditEvent.create` before the message transaction runs).
- What is wrong: if the message insert fails (version conflict, DB error), an audit row says a checker override happened for a reply that was never sent.
- Fix: write the audit row inside the same `$transaction` as the message.
- Test: force the message insert to fail (stale version) → audit count unchanged.
- Confidence: high.

### F-16 — P3 — AI (prompt injection) — Author text is wrapped in `<author_message>` without escaping the closing tag

- Where: `apps/api/src/ai/prompts/draft.v1.ts:107-113`; same pattern in chat prompt.
- What is wrong: an author can write `</author_message> SYSTEM: …` to escape the delimiter. The system prompt already says the author's words are untrusted and the server-side checker limits the damage (figures, placeholders), but the delimiter gives false comfort.
- Fix: strip or replace `</author_message>` (and `<author_message>`) in `sanitizeText` for prompt use, or use a random per-call delimiter.
- Test: unit test that the rendered prompt never contains a second closing tag inside the author block.
- Confidence: high (low impact).

### F-17 — P3 — Security — `/admin/ai/status` reveals platform provider configuration to every tenant

- Where: `apps/api/src/modules/ai-admin/ai-status.ts` (`providers[].configured`), reachable by any workspace admin.
- What is wrong: not a secret, but it is platform operator information; falls away once F-03 is fixed.
- Fix: same as F-03.
- Confidence: high.

### F-18 — P3 — Embed — `frame-ancestors` on `/embed` is the union of all tenants' origins

- Where: `apps/api/src/platform/http/embed.ts:8-12, 32`, `apps/api/src/modules/settings/embed-origins.ts`.
- What is wrong: any origin saved by any tenant may frame the shared `/embed` page. The page only becomes useful with a valid host token for that workspace, and `embed.js` checks `e.origin` and `e.source`, so the practical risk is a tenant's site framing a blank widget (UI redress of the login-less page). Documented as a design choice; listed so the trade-off is explicit. The union header also grows with tenant count (10 origins × N tenants).
- Fix (later): resolve the workspace from the `#t=` token server-side is impossible before the page loads; alternative is a per-workspace path (`/embed/<slug>`) so the CSP can be per tenant.
- Confidence: medium.

### F-19 — P3 — Reliability — In-memory single-instance state

- Where: `apps/api/src/modules/auth/used-tokens.ts` (replay cache), `apps/api/src/platform/keyed-queue.ts` (comment says single instance), `apps/api/src/modules/settings/configs.ts` (5 s cache), `@fastify/rate-limit` default in-memory store.
- What is wrong: all correct for one process; a second replica silently loses replay protection (a host token could be used once per replica), per-key ordering and rate limits. Documented in code comments but not in the deployment docs.
- Fix: state it in `docs/architecture.md` deployment section; when scaling, move replay ids and rate limits to Postgres/Redis (`used_host_tokens` table with `jti` PK + `exp` is enough).
- Confidence: high.

### F-20 — P3 — Checker — `DATE_SLASH` assumes D/M/Y

- Where: `apps/api/src/ai/checker/extract.ts` (slash dates parsed day-first).
- What is wrong: a US-style `03/04/2025` from the model is read as 3 April; a fact of 4 March will then wrongly pass or block. Facts are rendered with month names so the model rarely emits slashes; low impact.
- Fix: treat ambiguous slash dates as unverifiable (block) unless both orders match a fact.
- Confidence: medium.

## 3. Requirements table (assignment → status → evidence)

| Assignment requirement | Status | Evidence |
| --- | --- | --- |
| Authors raise support tickets about their books; tickets tied to the author and book | Met | `modules/tickets/create.ts`, `repository.ts ownership()`; `rbac.int.test.ts` author isolation (404 on other author's ticket/book) |
| Ticket lifecycle (open → in progress → resolved → closed) with admin controls | Met (doc mismatch) | `status-machine.ts`; `tickets.int.test.ts`; F-14 for CLOSED → OPEN |
| Admin queue with filters, priority, SLA, assignee | Met | `AdminTicketListItemSchema`, `TicketListQuerySchema` (cursor pagination, max 200); queue page |
| AI triage: category, priority with reasons, needs-info | Met | `ai/triage/*`, `ai/jobs/handlers/triage.ts`; rules floor for HIGH; `worker.int.test.ts` |
| AI draft replies grounded only in verified data; no invented amounts/dates | Met, with gaps | `ai/checker/*` blocks unsupported money/dates/durations/percents/counts and placeholders; `replies.int.test.ts`; gaps F-07 (voice words), F-08 (templates), F-20 |
| Facts come from the host system (BookLeaf records + KB), with sources | Met | `host/http/records.ts` + `HostCustomerSchema` with `FactSchema.source`; demo host `facts/*` |
| Admin reviews/edits AI draft before sending; override with reason, audited | Met | `messages/service.ts gateReply`; `replies.int.test.ts`; F-15 (audit ordering) |
| Author assistant chat with quick answers and ticket proposal | Met | `modules/chat/*`, `ai/chat/*`; `chat.int.test.ts` |
| Voice support with live transcript, ticket draft, limits | Met | `modules/voice/*`, `voice/call/*`; `voice.int.test.ts` (12 cases) |
| Embeddable widget in the host product; host hand-over sign-in | Met | `embed.js`, `host-sign-in.ts`, `host-token.ts` (5-min, jti single use); `embed.int.test.ts`, `host-sign-in.int.test.ts` |
| Role-based access: authors vs support staff | Met | `auth-guard.ts` default deny + `config.roles`; `rbac.int.test.ts` |
| Multi-tenant workspaces (SaaS extension) with isolation | **Partly** | Tickets/books/drafts/settings/connectors scoped and tested (`workspaces.int.test.ts`); **not** scoped: F-01, F-02, F-03, F-04; no RLS yet (`docs/saas/PLAN.md §5.2` says "next step") |
| Per-workspace connector with encrypted secrets | Met | `platform/crypto/envelope.ts` (AES-256-GCM, AAD-bound); `connectors.int.test.ts`; F-05 hardening |
| BYOK provider keys per workspace | Met | `provider-keys/*`; `provider-keys.int.test.ts` with `ownKeyUses` |
| Workspace API keys for server-to-server use | **Not met** | F-06: keys can be minted but nothing authenticates with them |
| Rate limits and abuse controls | Met, inconsistent | login 5/min, host 20/min, per-user chat/voice limits, workspace quotas; F-10 |
| Security headers, CSRF, cookie hygiene | Met | helmet CSP, Origin check, httpOnly/SameSite cookies, Partitioned in embed mode; `security.int.test.ts`, `embed.int.test.ts` |
| Real-database integration tests | Met | `test/setup/global-db.ts` testcontainers Postgres 16 + `prisma migrate deploy`; 20 int files, 80 unit files, 18 web tests |
| Documentation of architecture and integration | Met, drift in places | `docs/architecture.md`, `docs/integration.md`; F-06, F-14, F-19 |

## 4. Top 10 test gaps

1. **Cross-workspace admin reads of chat transcripts and voice calls** (`/admin/chat/sessions/:id`, `/admin/voice/calls/:id`) — the exact P0s. `workspaces.int.test.ts` covers tickets, drafts, books only.
2. **Platform AI settings from a non-default workspace admin** — `rbac.int.test.ts` checks authors get 403; nothing checks a second workspace's admin.
3. **SSE isolation** — no test subscribes to `/events` at all; neither author-visibility nor workspace filtering is covered.
4. **SSRF at fetch time** — `connectors.int.test.ts` only covers rejection on save; no test that a URL that later resolves privately is refused, and no unit cases for the missing ranges.
5. **Spoken-figure check with number words** — only the digit form `₹99,999` is tested; the instructed word form is untested (and would pass wrongly).
6. **Template drafts for a workspace without BookLeaf KB facts** — all draft tests use the demo host's facts.
7. **Host returns 404 for a known author** — only "host down" (connection refused) is tested, not "customer gone".
8. **Session revocation / logout invalidation** — `security.int.test.ts` checks the cookie is cleared, not that the old value stops working (it does not).
9. **Chat message while a linked call is active** and **typed + spoken turns against `maxTurnsPerSession`** — `call-in-chat.int.test.ts` covers linkage and the cap arithmetic, not the overflow path.
10. **Frontend flows end-to-end** — 18 web unit tests cover helpers and components; there is no browser test of the widget (open → token → frame → reauth loop), the fixed app shell (no window scroll), dark-mode switch inside the frame, or the admin ticket workspace send/override flow. `embed.js` itself (433 lines of plain JS) has no tests.

Also worth noting: `settings.int.test.ts` exercises `apiKeys.verify` directly rather than through HTTP, which hides F-06; and the voice tests use a fake provider, so the OpenAI Realtime client (`voice/providers/openai/*`) has no automated coverage — reasonable given cost, but the reconnect/timeout paths there are untested.
