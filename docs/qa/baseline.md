# QA baseline

Date: 2026-10-28. Branch under test: `feature/support-saas` in `/Users/aksykmr_mac/Loop Methods/experiments/bookleaf-support-saas`.
No source file was edited and nothing was committed or pushed to produce this document. During the run, the same QA session extended the triage eval (`eval/*`, `docs/eval-results.md`) for the AI benchmark; those changes are committed separately and the state table in section 1 was taken before them. The checks only read the code and ran the project's own commands.

## 1. State of the four worktrees

| Worktree | Branch | HEAD | Clean? (files changed) |
| --- | --- | --- | --- |
| `bookleaf` | `main` | `969813a` docs(status): record core build results and update task ledger | Yes (0) |
| `bookleaf-pluggable` | `feature/pluggable-support` | `65e934e` feat(web): captured loading skeletons for the ticket list | Yes (0) |
| `bookleaf-saas` | `feature/saas-platform` | `73d0069` docs(saas): integration guide section, README, TASKS ledger and session status | Yes (0) |
| `bookleaf-support-saas` (QA target) | `feature/support-saas` | `fa1b0d4` fix(ai): the checker does not guess slash dates that read two ways | Yes (0) |

- The target branch has **96 commits** since the merge base with `main`. The merge base is `969813a`, which is the current HEAD of `main`.
- All commits are local. Nothing is pushed.

## 2. Checks on the target branch

All commands were run from the target root.

| Check | Command | Result | Details |
| --- | --- | --- | --- |
| Typecheck | `pnpm -r typecheck` | PASS | 5 packages checked (shared, web, api, host-demo, host-web all "Done"), exit 0 |
| Lint | `pnpm lint` | PASS | `eslint .` printed no problems, exit 0 |
| Format | `pnpm format:check` | PASS | "All matched files use Prettier code style", exit 0 |
| Build | `pnpm -r build` | PASS | web, host-web and api all built, exit 0 |
| API tests | `cd apps/api && npx vitest run` | PASS | 47 files, 418 tests, 0 failed, 99.6 s (real Postgres through testcontainers, Docker was running) |
| Web tests | `cd apps/web && npx vitest run` | PASS | 18 files, 74 tests |
| host-demo tests | `cd apps/host-demo && npx vitest run` | PASS | 3 files, 28 tests |
| host-web tests | `cd apps/host-web && npx vitest run` | PASS | 1 file, 4 tests |
| shared tests | `cd packages/shared && npx vitest run --passWithNoTests` | PASS (empty) | No test files exist. Exit 0 only because of `--passWithNoTests` |

Totals: 73 test files and 524 tests, all passed. (418 + 74 + 28 + 4 = 524.)

Notes on the build:
- `apps/web` bundle: the biggest chunk is `react-*.js` at 260.54 kB (82.70 kB gzip). Next are `index-*.js` 145.97 kB, `zod-*.js` 90.27 kB, `query-*.js` 36.44 kB. Page chunks are 0.15 kB to 16.28 kB. CSS is 40.01 kB. **No chunk is over 500 kB and there is no Vite size warning.**
- `apps/host-web` bundle: one JS file, `index-*.js`, 404.87 kB (123.81 kB gzip), under 500 kB. No size warning.
- `apps/api` (tsup): `chunk-*.js` 338.12 kB plus a 2.34 kB `server.js`.
- Both Vite builds print two Rollup warnings about comments inside `zod@4.6.7` (`core/util.js` and `core/regexes.js`: "annotation that Rollup cannot interpret ... The comment will be removed"). They are harmless noise from a dependency, but they appear in every build.
- The `eval/` triage eval is not part of this check set (it calls a live model); its results are in `docs/eval-results.md` and `docs/qa/ai-benchmark.md`.

## 3. Route inventory

Source: the live OpenAPI JSON at `http://localhost:3500/api/docs/json` (69 operations) plus the hidden voice WebSocket route found in `apps/api/src/modules/voice/routes.ts` (1 more). **Total: 70 routes**, plus the web app and widget files served by `registerSpa` (`apps/api/src/platform/http/spa.ts`).

How the API decides who may call a route (`apps/api/src/platform/http/auth-guard.ts`):
- The guard is default deny. Every route under `/api/v1` needs the signed `bl_session` cookie, unless the route says `config: { public: true }`.
- A route with `config: { roles: [...] }` also checks the role (`AUTHOR` or `ADMIN`).
- "Session (any role)" means the route only needs a valid cookie. The service then checks the role itself.
- Rate limits are only the ones written in each route's `config`. The rate limiter is registered with `global: false`, so a route with no limit has no limit. The limits are kept in the server's memory (no Redis).
- Every unsafe method (POST, PUT, PATCH, DELETE) is also checked by the CSRF Origin guard (`platform/http/csrf.ts`).

All paths below start with `/api/v1` unless shown otherwise.

### health (outside `/api/v1`)
| Method | Path | Auth | Rate limit |
| --- | --- | --- | --- |
| GET | `/health` | public | none |

### auth (`modules/auth/routes.ts`)
| Method | Path | Auth | Rate limit |
| --- | --- | --- | --- |
| POST | `/auth/login` | public | 5 per minute per IP + email |
| POST | `/auth/logout` | public | none |
| GET | `/auth/me` | session (any role) | none |
| POST | `/auth/host` | public (needs a signed host token in the body) | 20 per minute |
| GET | `/auth/options` | public | none |

### workspaces (`modules/workspaces/routes.ts`, `api-key-routes.ts`)
| Method | Path | Auth | Rate limit |
| --- | --- | --- | --- |
| POST | `/signup` | public | `SIGNUPS_PER_HOUR` per hour (env setting) |
| GET | `/workspace` | admin | none |
| GET | `/workspace/audit` | admin | none |
| GET | `/workspace/api-keys` | admin | none |
| POST | `/workspace/api-keys` | admin | none |
| DELETE | `/workspace/api-keys/{id}` | admin | none |

### settings (`modules/settings/routes.ts`)
| Method | Path | Auth | Rate limit |
| --- | --- | --- | --- |
| GET | `/workspace/settings` | admin | none |
| PUT | `/workspace/settings` | admin | none |
| GET | `/workspace/fields` | admin | none |
| POST | `/workspace/fields` | admin | none |
| PUT | `/workspace/fields/{id}` | admin | none |
| DELETE | `/workspace/fields/{id}` | admin | none |

### connectors (`modules/connectors/routes.ts`)
| Method | Path | Auth | Rate limit |
| --- | --- | --- | --- |
| GET | `/workspace/connector` | admin | none |
| PUT | `/workspace/connector` | admin | none |
| POST | `/workspace/connector/test` | admin | 10 per minute |

### provider-keys (`modules/provider-keys/routes.ts`)
| Method | Path | Auth | Rate limit |
| --- | --- | --- | --- |
| GET | `/workspace/provider-keys` | admin | none |
| PUT | `/workspace/provider-keys/{capability}` | admin | none |
| DELETE | `/workspace/provider-keys/{capability}` | admin | none |

### webhooks (`modules/webhooks/routes.ts`)
| Method | Path | Auth | Rate limit |
| --- | --- | --- | --- |
| GET | `/workspace/webhooks` | admin | none |
| POST | `/workspace/webhooks` | admin | none |
| DELETE | `/workspace/webhooks/{id}` | admin | none |
| POST | `/workspace/webhooks/{id}/test` | admin | none |
| GET | `/workspace/webhooks/{id}/deliveries` | admin | none |

### server API (`modules/server-api/routes.ts`)
Not cookie routes. They are marked `public` so the cookie guard skips them, and then check a workspace API key (`Authorization: Bearer blsk_...`, scope `tickets:read`) in `api-key-auth.ts`.

| Method | Path | Auth | Rate limit |
| --- | --- | --- | --- |
| GET | `/server/tickets` | API key (`blsk_`) | 120 per minute |
| GET | `/server/tickets/{id}` | API key (`blsk_`) | 120 per minute |

### ai-admin (`modules/ai-admin/routes.ts`)
All four are admin routes and also have a `platformOperatorOnly` hook: only an admin of the default workspace may use them. Other workspaces get 403.

| Method | Path | Auth | Rate limit |
| --- | --- | --- | --- |
| GET | `/admin/ai/status` | admin + platform operator | none |
| GET | `/admin/ai/settings` | admin + platform operator | none |
| PUT | `/admin/ai/settings` | admin + platform operator | none |
| POST | `/admin/ai/test` | admin + platform operator | 5 per minute |

### assistant (`modules/assistant/routes.ts`)
| Method | Path | Auth | Rate limit |
| --- | --- | --- | --- |
| GET | `/assistant/availability` | session (any role) | none |
| GET | `/admin/assistant` | admin | none |
| PUT | `/admin/assistant/settings` | admin | none |

### books (`modules/books/routes.ts`)
| Method | Path | Auth | Rate limit |
| --- | --- | --- | --- |
| GET | `/books` | session (any role) | none |
| GET | `/books/{id}` | session (any role) | none |

### tickets (`modules/tickets/routes.ts`)
| Method | Path | Auth | Rate limit |
| --- | --- | --- | --- |
| GET | `/tickets` | session (any role; the service shows an author only their own, an admin all) | none |
| POST | `/tickets` | author | none |
| GET | `/tickets/{id}` | session (any role; same rule as the list) | none |
| PATCH | `/tickets/{id}` | admin | none |
| POST | `/tickets/{id}/solve` | author | 20 per minute |
| POST | `/tickets/{id}/messages` | session (any role; the service decides author reply vs team reply) | none |
| POST | `/tickets/{id}/ai/retry` | admin | 10 per minute |

### drafts (`modules/drafts/routes.ts`)
| Method | Path | Auth | Rate limit |
| --- | --- | --- | --- |
| GET | `/tickets/{id}/draft` | admin | none |
| POST | `/tickets/{id}/draft/regenerate` | admin | 20 per minute |
| POST | `/tickets/{id}/check` | admin | none |

### chat (`modules/chat/routes.ts`)
| Method | Path | Auth | Rate limit |
| --- | --- | --- | --- |
| GET | `/chat/sessions/current` | author | none |
| POST | `/chat/sessions` | author | `CHAT_SESSIONS_PER_HOUR` per hour per user (default 10) |
| GET | `/chat/sessions/{id}` | author | none |
| POST | `/chat/sessions/{id}/messages` | author | 120 per minute per user flood guard (the workspace's own lower limit is applied in `send-message.ts`) |
| POST | `/chat/sessions/{id}/ticket` | author | none |
| GET | `/admin/chat/sessions/{id}` | admin | none |

### ticket-drafts (`modules/ticket-drafts/routes.ts`)
All four are author routes with a per-user limit set by the workspace (`limits.drafts.editsPerMinute`).

| Method | Path | Auth | Rate limit |
| --- | --- | --- | --- |
| GET | `/ticket-drafts/chat/{sessionId}` | author | per user per minute (workspace setting) |
| PATCH | `/ticket-drafts/{id}` | author | same |
| POST | `/ticket-drafts/{id}/submit` | author | same |
| POST | `/ticket-drafts/{id}/discard` | author | same |

### conversations (`modules/conversations/routes.ts`)
| Method | Path | Auth | Rate limit |
| --- | --- | --- | --- |
| GET | `/conversations` | author | none |
| GET | `/conversations/chats/{id}` | author | none |
| GET | `/conversations/calls/{id}` | author | none |

### voice (`modules/voice/routes.ts`)
| Method | Path | Auth | Rate limit |
| --- | --- | --- | --- |
| POST | `/voice/calls` | author | 10 per minute per user |
| GET | `/voice/calls/resumable` | author | none |
| GET | `/voice/calls/{id}` | author | none |
| POST | `/voice/calls/{id}/ticket` | author | none |
| GET | `/admin/voice/calls/{id}` | admin | none |

### Realtime endpoints
| Kind | Path | Auth | Notes |
| --- | --- | --- | --- |
| Server-Sent Events | `GET /api/v1/events` | session (any role) | `modules/events/routes.ts`. Sends only hints (`{ type, ticketId }`); the client refetches through the REST API. Sends `session-expired` and closes when the cookie expires. No rate limit. |
| WebSocket (voice) | `GET /api/v1/voice/calls/{id}/stream` | author | `modules/voice/routes.ts`. Hidden from OpenAPI (`hide: true`, so it is the 70th route). The `Origin` header must equal `APP_ORIGIN` (browsers send cookies on cross-site WebSocket upgrades). Max frame size `MAX_FRAME_BYTES` set in `plugin.ts`. Closes with code 4503 when no voice provider is available. |

## 4. AI call map

Model providers sit behind `LlmProvider` (`apps/api/src/ai/providers/types.ts`; the only real one is Anthropic, plus a fake for tests). Voice sits behind `VoiceProvider` (`apps/api/src/voice/providers/`; the only real one is OpenAI Realtime). The allowed models and their prices come from `ai/providers/catalog.ts`: Claude Haiku 5.5 (fast), Sonnet 5.5 (balanced), Opus 5.5 (strong).

| Operation | Code | Model setting used | Model calls | If the provider fails or there is no key |
| --- | --- | --- | --- | --- |
| Triage (category, priority, review flag) | `ai/triage/service.ts` via `ai/jobs/handlers/triage.ts` | triage model: the workspace's `triageModel` if it is in the catalog, else the platform `triageModel` | 1 per triage job. Max tokens 400. | Retryable errors retry with backoff of 5 s, 30 s, 120 s, up to 3 attempts (`maxAttempts` default 3, `ai/jobs/worker.ts`). Other errors fall back at once to a keyword classifier plus a priority-floor rules check. Ticket is marked `FALLBACK` and `needsReview`. |
| Reply draft for the team | `ai/drafting/service.ts` via `ai/jobs/handlers/draft.ts` | draft model: the workspace's `draftModel` if allowed, else the platform `draftModel` | 1 per draft job. Max tokens 1200. The fact checker runs after it, and the checker uses rules, not a model. | Same retry rules. Fallback is a fixed template draft (`ai/drafting/templates.ts`), ticket marked `FALLBACK`. |
| Chat answer | `ai/chat/service.ts` via `modules/chat/answer.ts` | chat model: workspace `chatModel`, else platform `chatModel`; if not in the active provider's list, that provider's fast model (`modules/assistant/availability.ts`) | 0 for common questions answered from records (greeting, thanks, next payout, pending royalty, book stage; short messages with no problem words, `ai/chat/quick/`). Otherwise 1. +1 regeneration if the fact check blocks the first answer. Each of the 1 or 2 generations retries once after 400 ms on a temporary error, so the worst case is 4 calls. Max tokens 4000. | No key, outage switch on, or provider error: the author sees a fixed "assistant is unavailable, you can raise a ticket" text (source `UNAVAILABLE`). If the second answer also fails the check: a fixed safe text (source `SAFE_FALLBACK`). A chat turn never throws for AI problems. |
| Ticket draft filled during chat | same chat call (`draft` field in the chat output) | chat model | 0 extra | Same as chat |
| Voice call | `voice/providers/openai/provider.ts`, `voice/call/*`, `modules/voice/gateway.ts` | Not one of the three settings. Env `VOICE_MODEL` (default `gpt-realtime-2.1`) and `VOICE_NAME` | 1 realtime session per call, with several spoken replies inside it. Tools (`update_ticket_draft`, `confirm_ticket`, `submit_ticket`, `end_call`) run on the server. | No key: voice is reported "not configured" and the rest of the portal works. Call closes with 4503. |
| Admin "Test AI connection" | `modules/ai-admin/ai-status.ts` | platform triage model | 1 small ping | Returns `{ ok: false, detail: "Failed: <code>" }` with no vendor text |

Calls per user action:
- Author creates a ticket: 1 triage job, which on success queues 1 draft job, so **2 model calls** (up to 6 if every attempt retries). Source: `modules/tickets/create.ts`, `triage.ts` `applyDecision`.
- Author replies on a ticket: 1 draft job (**1 call**), `modules/messages/service.ts`.
- Admin presses "regenerate draft": 1 draft job (**1 call**), `modules/drafts/service.ts`.
- Admin presses "retry AI": a new triage job then a draft job (**2 calls**), `modules/tickets/update.ts`.
- Chat message: **0, 1 or 2 calls** (see above).
- A newer job for the same ticket makes older in-flight results get discarded (`isLatestGeneration`), but the older call is still paid for.

Which key is used: if the workspace saved its own key for a capability, only that key is used, and the platform key is never used as a backup. Otherwise the platform key from `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is used (`modules/provider-keys/keyed.ts`, `config/ai.ts`, `config/voice.ts`). Every logged call stores usage, latency and error code (`ai/jobs/runs.ts`).

## 5. Trust boundaries

1. **Browser to API.**
   - Session: signed JWT in an HttpOnly `bl_session` cookie (`modules/auth/session.ts`). The workspace id and role come only from the signed cookie, never from the client. Default cookie: SameSite=Lax. In embed mode: SameSite=None, Secure, Partitioned (`modules/auth/routes.ts`).
   - CSRF: unsafe methods that carry an `Origin` must match `APP_ORIGIN`, and the `text/plain` body parser is removed (`platform/http/csrf.ts`). The voice WebSocket checks `Origin` itself.
   - CSP and headers: `@fastify/helmet` with `platform/http/csp.ts` (script and connect only from self, `frame-ancestors 'none'`, `object-src 'none'`). Styles allow `'unsafe-inline'` and Google Fonts. In embed mode only `/embed.js` and `/embed/*` may be framed by the allowed host origins (`platform/http/embed.ts`).
   - Default deny on all `/api/v1` routes (`platform/http/auth-guard.ts`).
2. **Host product to API.**
   - Sign-in: the host's signed hand-over token, HS256, audience-checked, short-lived, with the role claim ignored (`modules/auth/host-token.ts`, `host-login.ts`; one-time use through `used-tokens.ts`). Secret: `HOST_SIGNING_SECRET` (at least 32 characters, must differ from `JWT_SECRET`, `config/index.ts`).
   - API to host: a per-workspace connector with credentials encrypted at rest using AES-256-GCM envelope encryption (`platform/crypto/envelope.ts`, `modules/connectors/`).
   - SSRF guard: connector URLs are checked (https only in production, no loopback, private, link-local or metadata addresses) in `platform/net/ssrf.ts`; redirects are refused.
3. **API to AI and voice providers.** Keys come from the workspace's own saved key (encrypted the same way) or the platform's env key. A workspace with its own key never falls back to the platform key (`modules/provider-keys/keyed.ts`). Vendor error text is mapped to typed errors and not returned to clients (`ai/providers/anthropic/map-error.ts`, `ai-admin/ai-status.ts`). Prompt input from authors is wrapped as untrusted (`ai/prompts/untrusted.ts`).
4. **Webhooks out.** Each webhook has its own `whsec_` secret, shown once. Requests carry `X-BookLeaf-Signature: t=<unix>,v1=<HMAC-SHA256 of "<t>.<body>">`, so a receiver can check the time to refuse replays (`modules/webhooks/signing.ts`, `dispatcher.ts`, `outbox.ts`). Target URLs use the same SSRF guard.
5. **Server API in.** Workspace keys that start with `blsk_`, sent as `Authorization: Bearer`; the key decides the workspace and scopes (`modules/server-api/api-key-auth.ts`, `modules/workspaces/api-key-routes.ts`). Limited to 120 requests per minute.
6. **Tenant boundary.** Every row is scoped by `workspaceId` taken from the session or the key. `apps/api/test/tenant-isolation.int.test.ts` covers it (4 tests, passing).

## 6. Dependency audit

Both commands ran with network access and finished.

| Command | Result |
| --- | --- |
| `pnpm audit --prod` | **1 vulnerability: 1 high**, exit 1 |
| `pnpm audit` (all) | **7 vulnerabilities: 2 critical, 1 high, 4 moderate**, exit 1 |

High and critical advisories:

| Severity | Package (vulnerable range, fixed in) | Advisory | Path |
| --- | --- | --- | --- |
| High (production) | `deepmerge-ts` (<8.0.0, fixed in 8.0.0) | Stack exhaustion when merging recursive object graphs, GHSA-ggr8-5vv4-36mx | `apps/api > prisma > @prisma/config > deepmerge-ts` and `apps/api > @prisma/client > prisma > @prisma/config > deepmerge-ts` |
| Critical (dev only) | `tinypool` (<=2.1.0, fixed in 2.1.1) | Prototype pollution gadget in worker options leads to remote code execution | `apps/web`, `packages/shared`, `apps/api` > `vitest` > `tinypool` |
| Critical (dev only) | `tinypool` (<2.1.2, fixed in 2.1.2) | Prototype pollution gadget to RCE in `run()` options | same three paths |

The 4 moderate ones are all dev-only: `uuid` <11.1.1 (through `testcontainers > dockerode`), `vitest` >=2.1.0 <4.1.11 (path traversal through the mocker), and `@vitest/mocker` (two advisories, fixed in 4.1.11 and 4.1.12).

Reading: the only production advisory is the `deepmerge-ts` one, reached through the Prisma CLI config package. The other six are in test tooling (vitest, testcontainers) that should not be needed at runtime (not checked against the Dockerfile).

## 7. Gaps noticed (no fixes made)

- There is no `/ready` route. `/health` checks the database but is the only probe, so liveness and readiness are not separated.
- The event bus and live draft updates live in one process (`platform/event-bus.ts`, `modules/ticket-drafts/live.ts`), so the API only works correctly as a single instance. (Fixed by F-19 on 2026-10-30: both go through Redis pub/sub.)
- Rate limits are in server memory (no shared store), so they reset on restart and are per instance. (Fixed by F-19 on 2026-10-30: counted in Redis.)
- Many routes have no rate limit (all admin settings routes, `/events`, `GET /tickets`, ticket creation, ticket messages, `/auth/logout`).
- `POST /tickets` and `POST /tickets/{id}/messages` each start paid AI jobs with no route-level limit.
- The voice WebSocket `/voice/calls/{id}/stream` is not in the OpenAPI document, so API-doc based tests will miss it.
- `packages/shared` (the Zod contracts) has no tests of its own; its script passes only because of `--passWithNoTests`.
- No end-to-end browser test suite is in the package test scripts; the web tests are 74 component and unit tests.
- CSP allows `style-src 'unsafe-inline'`.
- Builds print two Rollup comment warnings from `zod@4.6.7`.
- `pnpm audit --prod` fails (exit 1) on a high advisory, so a CI audit gate would currently be red.
- The `eval/` triage eval needs a live model key, so it cannot run as part of the normal check set.
