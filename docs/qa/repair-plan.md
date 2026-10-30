# Repair plan and outcome

Branch `feature/support-saas`, 2026-10-28. Sources: the independent audit (`docs/qa/fable-review.md`, findings F-01 to F-20),
the QA baseline (`docs/qa/baseline.md`), the live AI evals (`docs/eval-results.md`, `docs/qa/draft-eval.md`) and the
real-browser journeys (`docs/qa/browser-journeys.md`).

Rule followed for every fix: write a test that fails for the right reason first, then fix, then run the full suite
(typecheck, lint, format check, build, all tests). One exception is noted (Q-04, a layout fix checked in a real browser).

## Fixed

| ID | Priority | Problem (short) | Fix | Regression test | Commit |
| --- | --- | --- | --- | --- | --- |
| F-01 | P0 | Any workspace's admin could read another workspace's chat transcript | Lookup scoped to the admin's workspace (404 otherwise) | `test/tenant-isolation.int.test.ts` | `b16453c` |
| F-02 | P0 | Same for voice call transcripts, drafts and spoken checks | Scoped lookup (404) | `test/tenant-isolation.int.test.ts` | `b16453c` |
| F-03, F-17 | P0 | Any signed-up owner could change platform-wide AI settings, run the outage simulation, ping the platform key, read provider status | `/admin/ai/*` only for the platform operator (403); nav item hidden | `test/tenant-isolation.int.test.ts` | `b16453c` |
| F-04 | P1 | Live update stream sent every workspace's ticket events to every admin | Events carry the workspace id; filtered per subscriber | `test/tenant-isolation.int.test.ts` | `b16453c` |
| F-05 | P1 | Connector URL checked for internal addresses only when saved (DNS rebinding) | Re-checked before every request; more blocked ranges | `src/platform/net/ssrf.test.ts`, `test/connectors.int.test.ts` | `bf9feb1` |
| F-06 | P2 | Workspace API keys could not authenticate anything | Server API `/api/v1/server/tickets` on `blsk_` keys + signed webhooks | `test/server-api.int.test.ts`, `test/webhooks.int.test.ts` | `f5b887d` |
| F-07 | P2 | Spoken-figure check missed amounts said in words ("eight hundred fifty", "do hazaar") | Number words turned into digits before checking | `src/ai/checker/number-words.test.ts` | `cf53031` |
| F-08 | P2 | Fallback drafts hardcoded BookLeaf policy figures for every workspace | Figures come from the workspace's knowledge-base facts, else `[CONFIRM: …]` | `src/ai/drafting/drafting.test.ts` | `cf53031` |
| F-09 | P2 | A customer deleted at the host crashed chat, calls and books | Degrades to "records unavailable" | `src/host/facts.test.ts` | `bf9feb1` |
| F-10 | P2 | Chat rate limit used the env value, not the workspace setting | Route limit is only a flood guard (120/min); workspace limit applies | `test/chat.int.test.ts` | `bf9feb1` |
| F-11 | P2 | Typing during a live call let a conversation pass its message limit | 409 `VOICE_CALL_ACTIVE` until the call ends | `test/call-in-chat.int.test.ts` | `bf9feb1` |
| F-15 | P3 | Override audit row written outside the reply transaction (3 racing requests: 1 message, 2 audit rows) | Audit row written inside the reply transaction, with workspace id | `test/replies.int.test.ts` | `6ecfc5a` |
| F-16 | P3 | Author text could close its `<author_message>` prompt fence | `fenceSafe()` disarms fence tags in author text (draft, chat, draft fields) | `src/ai/prompts/untrusted.test.ts` | `c8c2403` |
| F-20 | P3 | Checker read every slash date day-first ("04/03/2026" passed against 4 March) | Two-way slash dates match no fact (flagged, overridable) | `src/ai/checker/check.test.ts` | `fa1b0d4` |
| Q-01 | P2 | `POST /tickets` had no rate limit; each ticket starts 2 paid AI calls | 30 tickets per author per hour, then 429 | `test/ticket-rate-limit.int.test.ts` | `c01353d` |
| Q-02 | P2 | Draft prompt's own example made the model add a bank-account placeholder to almost every royalty draft (20/24 drafts needed a manual edit) | Neutral example; ask the author to check their dashboard; don't repeat invented amounts | `src/ai/prompts/draft-rules.test.ts` + live eval 4 → 10 of 24 pass first time | `b82ac20` |
| Q-03 | — | Eval had no Hinglish/Hindi/adversarial cases, no macro-F1, no cost | 20 new cases, macro-F1, priority bands, token cost | live run in `docs/eval-results.md` | `b35ebf4` |
| Q-04 | P3 | Queue date filters ran off the right edge at 1440 px | Date range spans two grid columns | Checked in a real browser at 1440 and 420 px (no automated layout test) | `1346b47` |
| Q-05 | P3 | Malformed model output (not JSON, wrong shape, cut off) was logged as "unexpected provider failure" | SDK parse errors map to "invalid output" (still retried, then fallback) | `src/ai/providers/anthropic/failures.test.ts` (8 failure cases against a local HTTP stand-in) | `b521921` |
| F-14 | P2 (docs) | Architecture doc said CLOSED is terminal; code allows reopening | Doc aligned to the code | — (docs) | see final report |

## Deferred (documented, not fixed)

| ID | Priority | Why deferred | What it needs |
| --- | --- | --- | --- |
| F-12 | P2 | Login by email searches all workspaces (an email in two workspaces is ambiguous); sessions are stateless JWTs and cannot be revoked before expiry | **Part 1 fixed (2026-10-30):** staff email unique across the platform (`users.login_email`); login by email + password reads one account (the 5-account loop is gone); sign-up refuses a taken email in any case (409). The migration stops with a clear message if duplicates already exist. Test: `apps/api/test/staff-login.int.test.ts`. **Part 2 fixed (2026-10-30):** `users.session_version` is signed into each session token and checked on every request (one primary-key read, no cache). Logout bumps it in the app; a password change and a `workspace_members` delete bump it through database triggers. Old cookies get 401; logout ends the user's sessions on every device. Test: `apps/api/test/session-revocation.int.test.ts`. |
| F-13 | P2 | Ticket numbers (BL-1001…) are one global sequence, so a tenant can infer how many tickets other tenants have | **Fixed (2026-10-30):** each workspace has its own counter (`workspaces.next_ticket_number`, from 1001), taken with `UPDATE … RETURNING` inside the ticket's transaction, and a fixed prefix unique across the platform (`workspaces.ticket_prefix`: BookLeaf BL; others from the company name, BL → BL2 → BL3). `tickets.number` is unique per workspace and stores the real number. The migration keeps BookLeaf's labels (BL-1001… unchanged), renumbers other workspaces from 1001 by `created_at` and sets each counter to max + 1. Tests: `apps/api/test/ticket-numbers.int.test.ts`, `apps/api/test/ticket-numbers-migration.int.test.ts`. |
| F-18 | P3 | `/embed` frame-ancestors is the union of every tenant's allowed origins | **Fixed (2026-10-30):** each workspace has its own widget address, `/embed/<slug>`. The API serves that page with `frame-ancestors` set to the workspace's own allowed origins only (plus `HOST_ORIGINS` for BookLeaf); an unknown slug is 404. `embed.js` takes `data-workspace` and opens `/embed/<slug>`; the widget page sends its slug with the host token and a token for another workspace is refused (403) before it is used up. The old `/embed` (and `/embed/tickets/…` etc.) redirects to `/embed/bookleaf`. In production Vercel forwards `/embed` and `/embed/*` to the API (see `docs/deploy.md`). Tests: `apps/api/test/embed.int.test.ts`, `apps/web/src/lib/paths.test.ts`. |
| F-19 | P3 | In-memory, single-process state (host-token replay cache, rate limits, event bus, config cache) | **Fixed (2026-10-30):** shared state moved to Redis behind small interfaces (`apps/api/src/platform/shared-state/`): ticket events and live draft changes go to every copy through pub/sub; host sign-in tokens and voice call tickets are one-use platform-wide (`SET NX EX`); every `@fastify/rate-limit` limit counts in Redis; settings caches are cleared on every copy when a setting is saved; the chat conversation queue is a first-come, first-served line per conversation in Redis. `REDIS_URL` is required in production (the API refuses to start without it, or when Redis does not answer). Live voice calls stay on the server that holds the connection. Tests: `apps/api/test/multi-instance.int.test.ts`, `apps/api/test/shared-state-redis.int.test.ts`. |
| D2 | P3 | Invalid widget origin shows only a generic toast | **Fixed (2026-10-30):** field-level error under the origins box. See `docs/qa/browser-journeys.md`. |
| D5–D8 | P3 | Small UI polish items from the browser run | **Fixed (2026-10-30):** one-line Sign out, field ids/names and a visible widget focus ring, no retry on a forbidden page, no stale draft banner after sending. See `docs/qa/browser-journeys.md`. |
| Audit | — | `pnpm audit --prod`: 1 high (`deepmerge-ts` via prisma); dev-only: 2 critical (`tinypool` via vitest) | **Production advisory fixed (2026-10-30):** pnpm override pins `deepmerge-ts` `>=8.0.0`; `pnpm audit --prod` is clean. Dev-only advisories do not ship. |
