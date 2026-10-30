# TASKS.md — BookLeaf Author Support Portal

> Ledger: status + commit SHA. Design: `PLAN.md` (requirement IDs R1–R30 in §2). Diagrams:
> `docs/architecture.md`. Statuses below were updated on 2026-10-27 07:30 IST from real test runs; see `IMPLEMENTATION_STATUS.md`.
> Refreshed 2026-10-30: Phase QA (Q.0–Q.11), S.7 and S.10 are done on `main`; the locked fixes (F-12, F-13, F-18,
> F-19, S.8, S.9) are done on `feature/locked-fixes` (see "Phase 6" below).
> Status: ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⛔ BLOCKED
> Working deadline: 2026-10-27 23:59 IST (PLAN §0). Order = priority. Cut lines: PLAN §14.
> **Core (M0–M5) comes first and is complete on its own.** Phase 2 and Phase 3 tasks stay ⛔ BLOCKED
> until their GO check in PLAN §18.2 passes and you approve it.

---

## M0 — Pre-code (H0–H0.5)

| # | Task | Req | Status | SHA |
| --- | --- | --- | --- | --- |
| M0.1 | ~25 labelled eval cases (PLAN §7.7 groups) + prompt v1 outlines | R9–R11, R18 | ✅ | `f10602f` (26 cases, built after the code, not before) |
| M0.2 | Private GitHub repo; `.gitignore` excludes the brief PDF, `intruction.txt`, `old context` | R25, R30 | ⛔ (you) | —: no remote yet; you create the private repo |
| M0.3 | Anthropic key + Railway account ready | R19, R26 | ⬜ (you) | — |

## M1 — Walking skeleton, author → admin → author, no AI (H0.5–H5) · Gate G1

| # | Task | Req | Status | SHA |
| --- | --- | --- | --- | --- |
| M1.1 | Monorepo scaffold: pnpm, TS strict, ESLint (boundary + no-`Date` rules), Prettier, Vitest, husky, CI | — | 🔄 | `d8e6b8e`, `1e74880`: pnpm/TS/ESLint boundaries/Prettier/Vitest done; husky and CI not added |
| M1.2 | Env config (Zod, fail fast; key presence only) + `platform/` (db, clock, event-bus, errors, logger with redaction, security) | R19 | ✅ | `d8e6b8e`, `b4eb6c3` |
| M1.3 | `packages/shared` enums + schemas; Prisma schema + migration; seed (exact JSON, nulls kept, paise, invariants, 2 admins, default `ai_settings`, idempotent) | R23 | ✅ | `d8e6b8e`, `b4eb6c3` |
| M1.4 | Auth (login/logout/me, argon2id, cookie, rate limit), default-deny hook, role guard, Origin check, JSON-only | R1, R2, R14, R15 | ✅ | `b4eb6c3` |
| M1.5 | RFC 7807 errors + Swagger; consistent `/api/v1` naming | R13, R16, R17 | ✅ | `b4eb6c3`, `1fe4e2c` |
| M1.6 | Books endpoints (role-scoped, author/admin views) | R2, R3 | ✅ | `b4eb6c3` |
| M1.7 | Tickets + messages: create (one transaction incl. `ai_jobs` row, Idempotency-Key), list, get (author/admin views), status machine, SLA | R4, R5, R12 | ✅ | `b4eb6c3` |
| M1.8 | Admin: PATCH status/category/priority/assignee (self) with `version`, internal notes, audit events | R9, R10, R12 | ✅ | `b4eb6c3` |
| M1.9 | Minimal UI: login (+ demo buttons), author new ticket + my tickets, admin queue + ticket + reply/note/status/assign, 15 s polling | R1, R4, R5, R7, R12 | ✅ | `59ef6cf` (full UI, SSE instead of polling) |
| M1.10 | Integration tests for G1 (see AC-R1, R2, R12, R14–R16, R23) | — | ✅ | `1fe4e2c` (48 integration tests) |

## MD — Early deploy (H5–H5.75) · Gate G5a

| # | Task | Req | Status | SHA |
| --- | --- | --- | --- | --- |
| MD.1 | Railway service + Postgres; migrate + seed; skeleton flow works on the live URL | R26 | ⛔ (you) | —: needs a Railway (or other) account; Docker image verified locally `5bfde21` |

## M2 — AI workflow (H5.75–H10) · Gate G2

| # | Task | Req | Status | SHA |
| --- | --- | --- | --- | --- |
| M2.1 | Clock (`now`, `dataAsOf`) wiring + tests | R24 | ✅ | `d8e6b8e` |
| M2.2 | Facts engine with evidence (book vs author royalty, cycle deadline, possibly overdue, production, distribution record, unknowns) + unit tests | R11, R24 | ✅ | `d8e6b8e` |
| M2.3 | Provider seam (types, registry, errors) + Anthropic adapter + fake; `ai_runs` logging | R19, R21 | ✅ | `d8e6b8e`, `b4eb6c3` |
| M2.4 | Job worker: claim with SKIP LOCKED + lease, retries/backoff, stale-lease reclaim, generation guard, no overwrite of ADMIN fields + tests | R20 | ✅ | `b4eb6c3`, tests `1fe4e2c` |
| M2.5 | Triage handler: prompt v1, Zod output, rules floor, keyword fallback, outage switch | R9, R10, R20 | ✅ | `5f41c38`, `a049338` |
| M2.6 | Draft handler: per-category KB slices, examples, claims output, templates fallback | R11, R18, R21 | ✅ | `5f41c38` |
| M2.7 | Checker (claims ↔ evidence, independent scan, normalisation, exclusions, placeholders) + unit tests; send-time gate with override reason | R11 | ✅ | `5f41c38`, gate `b4eb6c3` |
| M2.8 | `ai_settings` API (model allowlist, outage switch), `/admin/ai/status`, `/admin/ai/test` | R19, R20 | ✅ | `b4eb6c3` |
| M2.9 | Run `pnpm eval`; tune once; write `docs/eval-results.md` with measured numbers | R9, R10, R18 | ✅ | `f10602f` |

## M3 — Complete portals (H10–H14) · Gates G3, G4

| # | Task | Req | Status | SHA |
| --- | --- | --- | --- | --- |
| M3.1 | My Books: all 10 fields, "Not set" / "Not published yet" for nulls, empty state | R3, R24 | ✅ | `59ef6cf` |
| M3.2 | Ticket form polish: book dropdown + General, field errors, attachment UI ("not uploaded in this demo"); My Tickets thread | R4, R5 | ✅ | `59ef6cf` |
| M3.3 | Queue: filters (status, category, priority, date range), urgency sort, SLA due/overdue + "auto-fallback" + "review suggested" badges, empty state | R7, R8 | ✅ | `59ef6cf` |
| M3.4 | Ticket workspace: AI status, category/priority override, draft editor with evidence + checks, send gate, notes, assign to me, status | R9–R12 | ✅ | `59ef6cf`, `1e74880` |
| M3.5 | SSE (hints, audience filter, heartbeat, refetch on reconnect, polling fallback, session-expired) | R6 | ✅ | `b4eb6c3`, `59ef6cf` (SSE leak checked by hand only) |
| M3.6 | AI Settings page (configured yes/no, test, model selects, outage switch) | R19, R20 | ✅ | `59ef6cf` |

## M4 — Hardening (H14–H15.5)

| # | Task | Req | Status | SHA |
| --- | --- | --- | --- | --- |
| M4.1 | Leak tests: cross-author 404 on every route, no notes/AI fields in author views or SSE, sentinel key never in responses/SSE/bundle; CSRF Origin + 415 tests | R2, R15, R19 | ✅ | `1fe4e2c` (SSE audience filter verified manually, not by an automated test) |
| M4.2 | Fix findings; full suite: typecheck, lint, format check, build, tests | — | ✅ | `1e74880`, `5bfde21` |

## M5 — Ship (H15.5–H18.5) · Gates G5, G6 → tag `core-v1`

| # | Task | Req | Status | SHA |
| --- | --- | --- | --- | --- |
| M5.1 | Final deploy; re-seed; run every PLAN §11 scenario on the live URL (buffer for deploy fixes) | R26 | ⛔ | — blocked on MD.1 (no live URL yet) |
| M5.2 | Record results of the live checks (pass/fail per scenario) | — | ⛔ | — blocked on MD.1 |
| M5.3 | README (setup, test logins, architecture, AI: prompts / errors / cost / model choice, API docs link, assumptions, limitations) + 1-page write-up | R17, R22, R27–R29 | ✅ | `8a75906` (live URL to be added after deploy) |
| M5.4 | Add collaborator or prepare ZIP; submit | R25 | ⛔ (you) | — |

---

## Phase QA — Production QA, adversarial testing & quality gate · morning 27 Oct · runs after `core-v1`

> Requested by the user on 2026-10-27 00:50 IST. Full brief: [docs/qa-mission.md](docs/qa-mission.md).
> **Starts only when the core (M0–M5) is done.** Fully autonomous: no questions to the user except the blocking
> cases the brief lists (missing credential, destructive action, external decision). Core assignment only —
> chat (Phase 2) and voice (Phase 3) are out of scope for this pass.
> Rules: never weaken tests to get green; never fabricate results; reviewer models ≤ 30% of the session budget;
> no secrets sent to reviewers; no changes outside this repo.

| ID | Task | Status |
| --- | --- | --- |
| Q.0 | Baseline: read docs + code, run every suite, record current failures, flaky tests and timings before changing anything | ✅ `1fb093e` |
| Q.1 | Requirements-to-evidence matrix (every brief requirement → code → test → status) in `docs/qa-report.md` | ✅ `26c48fc` `d577f30` |
| Q.2 | Functional sweep: auth/session/CSRF/RBAC/IDOR on every route; author data vs sample JSON; full ticket lifecycle incl. duplicates and concurrent updates | ✅ `e78f78d` `c250422` `9c13173` |
| Q.3 | Real-browser E2E: find and use the existing `tester-army/e2e` setup (check it exists and how it runs; otherwise ego-browser per global rules); journeys 1–8 from the brief, repeated; screenshots + console + network evidence | ✅ `838c3a7` |
| Q.4 | Adversarial tests: malformed/oversized/Unicode/RTL input, invalid JSON and content types, XSS/SQLi/HTML/prompt injection, brute force and AI-endpoint abuse, provider failures, DB outage and recovery; seeded randomized tests; a regression test for every defect found | ✅ `2d4f284` `9b21695` `8f57d60` `eade68f` |
| Q.5 | AI evaluation: versioned dataset (held-out split), category + priority accuracy / per-class P/R/F1 / confusion matrix, critical misclassification rate, unsupported-claim rate, injection robustness, schema-failure rate, repeat-run stability → `docs/eval-results.md` | ✅ `5b0cbf3` `26c48fc` |
| Q.6 | AI latency and cost: p50/p95/p99 end to end and per stage, tokens and cost per call from `ai_runs`, concurrency behaviour; optimise only with before/after numbers | ✅ `26c48fc` |
| Q.7 | API/DB/security/reliability: status codes and schemas, constraints and indexes, migration on a disposable DB, headers/cookies/rate limits, dependency audit, graceful shutdown | ✅ `6571e52` `f8a70e0` |
| Q.8 | Independent UI/UX review (author + ops team perspectives, accessibility, responsive, states); implement evidence-backed fixes; re-run affected journeys | ✅ `838c3a7` `0bfdaaf` |
| Q.9 | Independent top-model quality gate (architecture, code quality, security, AI) within the 30% budget; verify each finding against the repo; fix substantiated ones | ✅ `b7e2c88` `51cf329` `6bf254e` |
| Q.10 | The pasted brief was cut off in §11 ("…failure"). Check whether the user sent the rest; if not, finish §11 from its evident intent and record that assumption in the report | ✅ `117b7bb` |
| Q.11 | Final QA report: what was tested, what passed, what failed and was fixed, what was not tested, what remains uncertain (no claims of 100% correctness) | ✅ `77031c6` |

## Phase 2 — AI chat · built on branch `feature/chat` (27 Oct) · not merged to `main` (your instruction)

Admin-controlled: an admin switches chat on/off in *Author Assistant* (default OFF); the server checks the switch on
every chat request. Design change from the original plan: one grounded AI call over the author's own facts instead of
a tool-calling loop (authors have few books, so all their facts fit; fewer calls, same checker). See PLAN §18.3.

| # | Task | Status | SHA |
| --- | --- | --- | --- |
| C.1 | Admin switches (`assistant_settings`: chat/voice on-off, chat model), audited, versioned; availability endpoint | ✅ | `ab243da`, `8a2302f` |
| C.2 | Author facts across all books; chat prompt v1.1; fact check → one regeneration → safe answer; one retry on temporary AI errors | ✅ | `ab243da`, `8a2302f` |
| C.3 | Additive migration: `assistant_settings`, `chat_sessions`, `chat_messages`, `tickets.source` + `chat_session_id` | ✅ | `ab243da` |
| C.4 | Chat API (current/new conversation, messages, ticket from chat with Idempotency-Key, admin transcript) | ✅ | `ab243da` |
| C.5 | Limits: 1–1,000 chars, 20 msgs/min, 100/day, 30 per conversation, 10 new conversations/hour (env) | ✅ | `ab243da` |
| C.6 | Author "Ask BookLeaf" page, ticket card, unavailable/off states; admin switches page; transcript on chat tickets | ✅ | `d009761` |
| C.7 | Tests: 10 unit + 13 integration (real Postgres); full suite 120/120; real-browser run (Chromium 156) | ✅ | `d009761` |
| C.9 | Fix: payout questions showed "assistant unavailable" (answer cut off at 700 output tokens; now 4,000) | ✅ | `fd8da4c` (`115f3a2` on `feature/chat`) |
| C.10 | Instant answers from records for common questions (19–33 ms vs ~7 s), send queue (send several messages in a row, answered in order), typing bubble, box clears at once | ✅ | `bbe469d` (on `feature/voice` only) |
| C.8 | Merge + deploy | ⛔ not doing: stays on its branch unless you decide otherwise | |

## Phase 3 — In-house voice call (no SDK) · branch `feature/voice`

Built in house instead of through Vocal: the browser streams microphone audio over a WebSocket to the
BookLeaf server, which holds its own raw WebSocket to a speech-to-speech model (OpenAI Realtime).
No vendor SDK in the browser or the server; protocol details were learned from the Vocal code, which
was read but not changed or depended on. Admin switch defaults to OFF.

| # | Task | Status | SHA |
| --- | --- | --- | --- |
| V.1 | `voice_sessions` table, `tickets.voice_session_id`, call status / end-reason enums (additive migration) | ✅ | `9c694fa` |
| V.2 | `VoiceProvider` interface + OpenAI Realtime adapter (raw WebSocket, GA events, barge-in, truncation); ESLint blocks vendor imports outside the adapter | ✅ | `9c694fa` |
| V.3 | Call controller: 300 s hard cap, spoken 30 s warning, 45 s idle hang-up, admin re-check every 15 s, `end_call` / `suggest_ticket` tools | ✅ | `9c694fa` |
| V.4 | Gateway: sign-in + Origin check before upgrade, claim within 30 s, one live call per author (row lock), 5 calls/hour and 10/day, 32 KB frame cap, interrupted calls closed at startup | ✅ | `9c694fa` |
| V.5 | After the call: spoken-figures check, token use logged, author-confirmed ticket (`source = VOICE`), admin call view | ✅ | `9c694fa` |
| V.6 | Author UI: mic capture worklet (24 kHz PCM16), gap-free player, countdown, warning, live transcript, mute, end, after-call transcript + ticket card; unavailable / off states; admin call panel on voice tickets | ✅ | `1079d82` |
| V.6b | Review fixes: switch re-check can't crash the server, idle follows the conversation, goodbye plays out, saved before "ended", audio rate cap, failed setup releases the call | ✅ | `280a652` |
| V.7 | Tests: 23 unit + 8 integration on the server, 14 unit in the browser code; full suite 165/165; browser check of the on / off / not-configured states (Chromium 156) | ✅ | `1079d82` |
| V.8 | Live call with a real key: ready ~2–3 s, first audio ~3–4 s, greeting by name, call saved (smoke script, no microphone) | ✅ | `e2645e5` |
| V.9 | Merge + deploy | ⛔ not doing: stays on its branch unless you decide otherwise | |

### Phase 3b — Live ticket draft in chat and calls, and continuing a dropped call (27 Oct)

One ticket per conversation or call, shown on the right of Ask BookLeaf. Both the author and the
assistant edit it live; the assistant asks "Shall I send it?" and sends only after a yes (or the author
presses Send).

| # | Task | Status | SHA |
| --- | --- | --- | --- |
| D.1 | `ticket_drafts` table (one owner CHECK), `voice_sessions.thread_id`, `FieldSource AUTHOR` (additive migration; shadow apply + diff = 0); draft API: get, edit (versioned), send once (draft id = idempotency key); author's issue type kept through triage | ✅ | `3fbbc8d` |
| D.2 | Chat prompt `chat.v1.3`: the model sees the draft and returns update / confirm / submit; server enforces the rules and writes the reply text for sends | ✅ | `b34ae26` |
| D.3 | Voice: `update_ticket_draft` / `confirm_ticket` / `submit_ticket` tools, live `draft` messages, author screen edits reach the model (`addContext`); continue a dropped call within 60 min (same thread, earlier lines, "Welcome back") | ✅ | `43fb2f0` |
| D.4 | Review fixes: a voice send needs confirm + the author's answer in that call; confirm marks only the version read back; chat keeps author edits made mid-answer; correct reply text on raced sends | ✅ | `1acb196` |
| D.5 | Web: ticket panel on the right (autosave, live highlight, Send with version, confirm banner, sent state); Continue last call / New call; old ticket card removed | ✅ | `04b6630` |
| D.6 | Only offer to continue calls where the author spoke (found in the live smoke test) | ✅ | `c339a13` |
| D.7 | Verified: full suite 238/238 (213 API + 25 web); browser: chat filled the draft, author edited the subject, "send" → confirm → "yes" → BL-1002 sent with the author's subject, reload keeps it; live OpenAI call → hang up → continue (same draft and thread, "Welcome back") | ✅ | |
| D.8 | A real call with a microphone, asking the assistant to raise and send a ticket | ⛔ (you): needs a person speaking | |

---

## Phase 4 — History and a pluggable support module · branch `feature/pluggable-support` (27 Oct)

Authors can read past chats and calls. Support became a module that attaches to any product: customer
data only over HTTP from the host (`apps/host-demo` plays BookLeaf), sign-in by a short host token, and
three ways to attach (link, `embed.js` widget, Fastify `supportPlugin`). Not merged (your instruction).
Guide: `docs/integration.md`.

| # | Task | Status | SHA |
| --- | --- | --- | --- |
| H.0 | Register the session in `SHARED_PLAN.md` | ✅ | `6b0e570` |
| H.1 | Config split into one small Zod schema per area (`config/*.ts`); `.env.example` grouped the same way | ✅ | `297abbc` |
| H.2 | One file per use case; small route and provider functions | ✅ | `c4c1fa5` |
| H.3 | Web: long components and hooks split | ✅ | `d0d86c2` |
| H.4 | ESLint size limits: files 200, functions 40 (components 150), complexity 10, depth 3, params 4 | ✅ | `c4fe5c9` |
| H.5 | History API: chats + call threads, `(createdAt, id)` cursor, read-only detail, owner-only | ✅ | `aec38f4` |
| H.6 | History pages (list + read-only transcript + ticket/draft summary) | ✅ | `703f6ad` |
| H.7 | `apps/host-demo`: authors, books, facts engine moved here, login, customer API, token mint | ✅ | `feda348` |
| H.8 | Host connector (`src/host/`), host sign-in, reference rows, additive migration (shadow apply + diff = 0), host-down → `host.records_unavailable` | ✅ | `9352323` |
| H.9 | `supportPlugin` for Fastify hosts (encapsulated; tested mounted under `/support`) | ✅ | `0a747cc` |
| H.10 | Widget: `/embed`, `embed.js`, `HOST_ORIGINS` (framing only on `/embed`), partitioned cookie | ✅ | `7ffe709` |
| H.11 | Plugin starts and stops its own AI worker (found while writing the guide) | ✅ | `c501066` |
| H.12 | Docs: integration guide, architecture, README, write-up, PLAN §19 | ✅ | `069ca01` |
| H.13 | Review fixes. Security review found 1 CRITICAL: under a mount prefix the auth guard was skipped (admin routes open); fixed by scoping the guard to `/api/v1`, with a test. Also: one-time host tokens (`jti`), id rules, connector checks, cache limit, items never move between authors, cursor 422, one `authorIdOf`, widget error handling | ✅ | `aba969a` `9068588` `2af5811` `6306f9c` `064d796` |
| H.14 | react-doctor 59 → 78, 0 errors (2 warnings left, both false positives); `check.ts` split to stay under 200 raw lines | ✅ | `6306f9c` `b94dbc8` |
| H.15 | Live run (production build, support on 127.0.0.1:3300, host-demo on localhost:3400 = two sites, embed mode): sign in on host → Help widget → chat answered from host facts (₹850 < ₹1,000, next cycle 14 Feb 2026) → ticket drafted, sent as BL-1001 → admin queue (Royalty & Payments / Medium, grounded AI draft) → History lists the chat, opens read-only → My Books shows the ten fields → host stopped: assistant does not guess and offers a ticket, books show "Details are not available right now". Found and fixed: the widget's "Full support" link lost the session | ✅ | `d008a59` `6849c6b` |
| H.16 | A real voice call with a microphone through the widget | ⛔ (you): needs a person speaking | |
| H.17 | Signed webhooks to the host | ⛔ skipped: optional, kept the code small | |

---

## Phase 5 — Author experience, call in chat, theme and Hinglish voice · branch `feature/pluggable-support` (27–28 Oct)

The widget became the author's whole support app, BookLeaf got its own dashboard and sign-in page,
a call can be started from a chat and shares its conversation and limit, the widget follows the
host's light or dark theme, and the voice speaks warm Hinglish by default. Not merged (your
instruction). Guides: `docs/integration.md`, `docs/architecture.md` §17–§20.

| # | Task | Status | SHA |
| --- | --- | --- | --- |
| P.1 | Widget: no "Full support" link inside the widget (the widget is the whole app) | ✅ | `d008a59` |
| P.2 | Integration guide: host-down behaviour described as observed in the live run; phase 4 status recorded in this file | ✅ | `6849c6b` `c5a21cd` |
| P.3 | Author history fixes: History lists real voice calls; "New conversation" always starts fresh; a ticket draft can be discarded | ✅ | `6b0b14e` `98f71f2` `d8b381e` |
| P.4 | Requester view of a ticket for authors | ✅ | `8f2129a` |
| P.5 | Support web: bright design tokens and atoms | ✅ | `89da12f` |
| P.6 | The widget is the author's whole app (Home, Ask, Tickets, History); "My Books" page removed from the support app | ✅ | `278237e` |
| P.7 | Redesign: Ask BookLeaf, then Tickets and History | ✅ | `95d26c8` `c248482` |
| P.8 | BookLeaf host: dashboard API in `apps/host-demo` and the author dashboard `apps/host-web` | ✅ | `e568812` `cb9f3b8` |
| P.9 | BookLeaf Publishing brand theme: support app, and the dashboard with its logo | ✅ | `0acc576` `e691480` |
| P.10 | Interactive BookLeaf sign-in page with a page-turning book | ✅ | `a200bf1` |
| P.11 | Widget script (`embed.js`) is revalidated on every page load | ✅ | `100a3fa` |
| P.12 | Ticket box shown only when there is a ticket (no blank "Not sent" box) | ✅ | `a5c635f` |
| P.13 | Call in chat, API: `POST /voice/calls { chatSessionId }`; shared conversation and ticket draft; lines saved as `channel VOICE`; additive migration `20261028090000_call_in_chat` (SQL read) | ✅ | `c14d0a7` |
| P.14 | Call turn limit: spoken messages count against `CHAT_MAX_TURNS_PER_SESSION`; call ends with `TURN_LIMIT` after the last answer | ✅ | `02949fc` |
| P.15 | Ask screen: talk or type in one conversation; limit card with "New conversation" | ✅ | `398a8fc` |
| P.16 | Dark mode: widget frame, sign-in book, and the support app inside the widget follow the host theme | ✅ | `a4726eb` `0f0ca73` |
| P.17 | Hinglish voice persona (default), `VOICE_STYLE`, automatic transcription language for Hinglish | ✅ | `1611217` |
| P.18 | Docs brought up to date with this branch (README, integration guide, architecture, PLAN, TASKS) | ✅ | see `git log` (docs commit "author experience, call-in-chat, widget theme and voice persona") |
| P.19 | A real Hinglish call with a microphone, in a chat, to the limit | ⛔ (you): needs a person speaking | |
## Phase 5 — Multi-tenant SaaS foundation · branch `feature/saas-platform` (27 Oct, from `6b0b14e`)

Any business signs up, gets a workspace and configures the product from the UI: product connection
(encrypted secrets), customer-data fields, assistant/chat/voice/widget settings, API keys. BookLeaf is
workspace #1, seeded from env and unchanged in behaviour. Not merged. Plan: `docs/saas/PLAN.md`.

| # | Task | Status | SHA |
| --- | --- | --- | --- |
| S.0 | Register the session; research (Prisma RLS via Context7, envelope encryption, Zendesk/Intercom shapes, widget identity) and `docs/saas/PLAN.md` | ✅ | `2a389e3` `68381f8` |
| S.1 | Tenancy core: `workspaces`, `workspace_members`, `workspace_id` on every tenant table (expand → backfill → require), per-workspace unique keys, `workspaceId` in the session, scoped ticket/book queries, `POST /signup`, cross-tenant tests (404), envelope crypto + SSRF guard with unit tests | ✅ | `6bbadc5` |
| S.2 | Connectors: encrypted per-workspace connection, hints only, test-connection, SSRF policy, per-workspace `HostRecords`, host tokens with `iss`, env fallback for `bookleaf` | ✅ | `90a9d8e` |
| S.3 | Customer-data fields CRUD (BookLeaf fields seeded) and workspace settings API (models, tone, chat/voice limits, widget, nouns) with version + audit | ✅ | `091c7fd` |
| S.4 | Web: signup page, Product Connection, Customer Data, Workspace Settings pages; verified in a browser | ✅ | `4c9c75f` |
| S.5 | API keys (hashed, shown once, revoke, audit) + page | ✅ | `2a52d9a` |
| S.6 | Docs: integration guide section, README, TASKS, SHARED_PLAN | ✅ | (this commit) |
| S.7 | Wire chat/voice limits, switches, prompts and the fact checker to the workspace rows (readers still use the singleton settings + env for every workspace) | ✅ | `3c9632f` `b703316` `de3c2fd` `278dd13` `58698d2` |
| S.8 | Postgres row-level security (RLS + FORCE) on every tenant table, incl. the S.9 tables and the child tables; requests run on a restricted app role (`DATABASE_URL`) with `set_config('app.workspace_id', …, true)` per transaction; migrations, seed, signup, sign-in lookups, the AI worker and the webhook sender on the owner (`DATABASE_ADMIN_URL`); `pnpm db:roles` / `node dist/db-roles.js` creates the app role on every `npm run local` and deploy | ✅ | (this commit) |
| S.9 | Ticket categories and knowledge-base articles per workspace: `ticket_categories`, `knowledge_articles` (+ links), tickets/drafts move to `category_key` (expand → backfill; old enum column dropped in a later release), admin pages Categories + Knowledge Base, triage/drafts/chat/voice use the workspace's own rows (drafts: only articles linked to the ticket's category), BookLeaf seeded so its prompts are byte-identical | ✅ | `20b0fc9` |
| S.10 | Server-to-server endpoints that accept workspace API keys; signed webhooks | ✅ | `b7e2c88` |
| S.11 | Member management and invitations; email verification at signup | ⬜ | skipped for now (decided 2026-10-29); build later — see README "Known limitations" |

---

## Phase 6 — Locked fixes from the QA audit · branch `feature/locked-fixes` (30 Oct)

Decisions locked with the user on 28–29 Oct (`docs/qa/repair-plan.md`, `docs/qa/security-report.md`), implemented
together on one branch. S.8 and S.9 above are part of this pass.

| # | Task | Status | SHA |
| --- | --- | --- | --- |
| F-12.1 | Staff email unique across the platform (`users.login_email`); login by email + password only; signup refuses an email that already has an account (409) | ✅ | `6decb1d` |
| F-12.2 | End sessions early: `users.session_version` checked on every request; bumped on logout, password change and removal from a workspace | ✅ | `700a107` |
| F-13 | Ticket numbers per workspace (`next_ticket_number` from 1001, fixed platform-unique `ticket_prefix`, `@@unique([workspaceId, number])`) | ✅ | `414fb28` |
| F-18 | Per-workspace widget address `/embed/<slug>` with that workspace's own `frame-ancestors`; old `/embed` redirects; host token must match the slug; Vercel forwards `/embed` to the API | ✅ | `3fec9e4` |
| F-19 | Shared state on Redis (event bus, host-token replay cache, rate limits, config cache, per-ticket lock); `REDIS_URL` required in production | ✅ | `0570a5d` |
| SM.1 | Pin `deepmerge-ts` ≥ 8.0.0 with a pnpm override (Prisma transitive advisory) | ✅ | `497c2d2` |
| SM.2 | UI polish from the browser run: D2 (field error for a bad widget origin), D5, D6, D7, D8 | ✅ | `14355c8` |
| SM.3 | Refresh this ledger; README known limitations (S.11 later, signup emails not verified) | ✅ | `d5ab0d8` |
| U-2 | Solved locks the ticket. Root cause of the live bug (BL-1001): the author marked it solved, then sent "hey", and an author message reopened Resolved/Closed tickets to Open. Now Resolved/Closed refuse author messages (409 `TICKET_SOLVED`, re-checked inside the write); `canReply` on the author view; widget shows "This ticket is solved" + "Raise a new ticket" instead of the reply box; staff can still reply and reopen. Also fixed: a staff reply sent just after the author solved the ticket wrote back the status it had read earlier (Resolved → In progress); `recordReply` now decides status inside the write | ✅ | `1dcc20c` |
| U-3 | Staff composer: "Reply to author" and "Internal note" keep separate text (`lib/composerTexts.ts`); sending clears only the box sent | ✅ | `1dcc20c` |
| U-1 | Staff ticket page: Customer panel (`GET /tickets/:id/customer`, staff only) with profile, account and per-item lines from the customer record labelled by the workspace's customer data fields, and the customer's other tickets in this workspace; draft facts folded into a small "Facts the draft used" section | ✅ | `1dcc20c` |
| RV.1 | Review fixes: SLA follows the ticket's new category (admin PATCH and re-triage, also when only the category changes); removed staff cannot sign in again (login + per-request membership check); chat and voice prompts, the voice greeting and the chat fallback answer use generic wording for non-BookLeaf workspaces (BookLeaf byte-identical, goldens added) | ✅ | (this commit) |
| U-7 | Super admin console and settings split: `/platform` (own login, `bl_platform` cookie, own token audience, 403 across the two areas; account seeded from `PLATFORM_ADMIN_EMAIL`/`PLATFORM_ADMIN_PASSWORD`); platform-only AI providers + encrypted keys (env fallback, Test connection), models for triage/draft/chat/voice, global outage switch; per-customer plan (chat/voice allowed, AI on, max limits, suspend) and usage/AI cost counts; customer AI behaviour settings (tone, greeting, signature, language, length, formality, topics) used by triage, draft, chat and voice prompts; widget logo, launcher text, theme; AI Settings page, BYOK and the chat model picker removed (old links and endpoints → "Managed by your support provider", 403); platform tables have no grants for `bookleaf_app` (migration `20261030140000_platform_console`, old `ai_settings`/`assistant_settings`/`workspace_provider_keys` kept for a later contract step) | ✅ | `13e215b` |
| U-4 | Staff sign-in redesigned as its own "support desk" page (desk picture on wide screens, form alone on small ones, show/hide password, Caps Lock hint); the link to BookLeaf removed | ✅ | `851d796` |
| U-5 | Author widget never scrolls sideways: widget grids start from `grid-cols-1` (the cause: an `auto` grid column grew to the widest card), ticket cards and chips shrink/truncate, the ticket tabs wrap instead of scrolling, message bubbles and ticket details wrap long words, `overflow-x: hidden` on the widget scroll area; source-level layout test over every widget page | ✅ | `851d796` |
| U-6 | One accessible `Dropdown` (select-only combobox + listbox, solid surface, keyboard + screen reader, disabled options readable with a reason) for every admin select: AI settings provider/models, queue filters, ticket properties, category priority, customer field type, workspace models, chat model, voice, provider key; test bans native selects in admin; API in `docs/architecture.md` §22. The "workspace key counts" / Provider-keys note part is superseded by U-7 (platform key counts, BYOK removed), so the provider rule stays "platform key" here | ✅ | `851d796` |

---

## U-10 — Webhooks admin page · branch `feature/u10` (30 Oct)

| # | Task | Status | SHA |
| --- | --- | --- | --- |
| U-10 | Staff app page Webhooks (nav under API Keys): add/edit/delete (URL + event checkboxes), signing secret shown once with Copy, rotate secret, Send test, switch on/off, delivery log (status, HTTP code, time, attempts, next try) with Retry for a failed delivery. API: `PATCH /workspace/webhooks/:id`, `POST …/:id/rotate-secret`, `POST …/:id/deliveries/:deliveryId/retry`; switched-off webhooks queue nothing and their waiting deliveries pause; same SSRF checks; audit rows; no migration | ✅ | `dbcfb6e` |

---

## U-9 — Flexible product connection · branch `feature/u9` (30 Oct)

| # | Task | Status | SHA |
| --- | --- | --- | --- |
| U-9 | One to five data sources per workspace (GET URL templates with `{id}`/`{email}`, Bearer or own key header, own timeout + cache, SSRF check on save and before every call); only the sources a mapping needs are called, in parallel, and merged into one customer record behind the same `HostRecords` interface (a failing source marks only its fields Unavailable); field mapping (source + JSON path, item list + per-item paths) and Test with raw answers + mapped preview on the Customer data page; migration `20261031010000_product_data_sources` turns each saved connector into its first full-shape source (BookLeaf on env keeps its endpoint); docs/integration.md §2c | ✅ | `c71f8aa` |

---

## U-11 + U-8 — API key permissions and API keys page · branch `feature/u11` (30 Oct)

| # | Task | Status | SHA |
| --- | --- | --- | --- |
| U-11 + U-8 | API key permissions chosen by the admin (presets Read only / Read & write, or single scopes) and every scope real: `customers:read` → `GET /server/customers/:customerId/tickets`; `tickets:write` → `POST /server/tickets`, `POST /server/tickets/:id/messages`, `PATCH /server/tickets/:id` (resolve / close / reopen through the ticket status rules), Idempotency-Key, 60 writes/min, webhooks as usual; new ticket source `API` (migration `20261031020000_ticket_source_api`). API keys page redesigned: aligned name + button, permission picker, readable scope labels, status pill, dates, copyable prefix, revoked keys in a collapsed group | ✅ | `5fee8d5` |

---

## U-items merged · branch `feature/locked-fixes` (30 Oct)

U-1 to U-11 merged into `feature/locked-fixes` one branch at a time (U-10, U-9, U-11, ticket, ui) with
`--no-ff`, on top of U-7. Follow-ups found by the merge:

| # | Task | Status | SHA |
| --- | --- | --- | --- |
| M.1 | One copy button: the webhook secret (U-10) uses the U-8 `CopyButton`, which now treats a missing clipboard as a refused copy | ✅ | `b5d45b7` |
| M.2 | `/platform` AI provider and model pickers (U-7), AI behaviour choices, widget theme and the U-9 source pickers use the U-6 `Dropdown`; a provider with no key is disabled with the reason (`lib/platformAiOptions.ts`) | ✅ | `fa8660e` |
| M.3 | Server API follows the U-2 lock: a customer message on a Resolved or Closed ticket is 409 `TICKET_SOLVED`; ticket reads carry `canReply`; reopening (API or staff) lets the customer write again | ✅ | `0cf12ad` |
| M.4 | U-1 Customer panel reads the U-9 merged record; per-item field labels drop "(per book)" in the record too (`host/item-label.ts`) | ✅ | `fa1e612` |
| M.5 | Sidebar test: every staff and platform nav entry kept and routed, Webhooks under API Keys (`lib/navRoutes.test.ts`); this ledger shows every U-item with its SHA | ✅ | (this commit) |

---

## P2 — Polish (lowest priority: only after Phase 2/3 are done or NO-GO)

| # | Task | Status |
| --- | --- | --- |
| P2.1 | OpenAI adapter + provider choice in AI Settings | ⬜ |
| P2.2 | Book insight cards (facts engine, no AI) on My Books and the ticket form | ⬜ |
| P2.3 | Metrics card (cost per ticket, fallback rate, override rate) | ⬜ |

---

## Acceptance criteria (mandatory features)

Test type: **I** integration (real Postgres) · **U** unit · **E** eval · **M** manual on live URL ·
**R** review. All are planned; none has been run.

| ID | Criterion | Type |
| --- | --- | --- |
| AC-R1 | Valid email/password → 200 + httpOnly cookie; wrong password → 401 with the same message as unknown email; 6th failed login in 1 min → 429 | I |
| AC-R2 | Author A requesting B's book or ticket by id → 404; `GET /tickets` and `GET /books` return only A's rows | I |
| AC-R3 | Priya's BK001 shows title, ISBN, genre, 2023-06-20, Published & Live, ₹399, 342, ₹11,970, ₹8,400, ₹3,570; Sneha's BK013 shows "Not set" for MRP and "Not published yet" for date, with no "null"/"NaN" anywhere | I + M |
| AC-R4 | Dropdown lists exactly the author's books + "General / Account Level"; General → `book_id` null; subject of 4 chars → 422 with a field error shown; attachment picker shows the chosen file name | I + M |
| AC-R5 | My Tickets lists every own ticket with one of the 4 statuses, the original query and all admin replies; no internal note text appears | I + M |
| AC-R6 | Admin sends a reply → author's open page shows it within 5 s without reload; after killing the SSE connection, the reply still appears (reconnect or 15 s polling) | I + M |
| AC-R7 | Queue filters by status, category, priority and created-date range, alone and combined | I |
| AC-R8 | Default order: SLA overdue first, then priority (Critical → Low), then oldest; overdue tickets carry a visible badge | I + M |
| AC-R9 | Every new ticket ends with exactly one of the 6 categories (AI or fallback); admin override saves with source ADMIN + audit event; a later AI job does not overwrite it; eval category accuracy is reported | I + E |
| AC-R10 | Every ticket ends with one of 4 priorities; override as in AC-R9; eval: "no royalty for 6 months" ranks above "update my bio"; ISBN error ≥ High | I + E |
| AC-R11 | Opening a ticket shows a draft (or "Generating…" that fills in live); Kavita BK016 draft mentions ₹850 and the ₹1,000 threshold and does not escalate; admin edits and sends → author sees the edited text; text with `[CONFIRM:` → 422 | I + E + M |
| AC-R12 | Valid status transitions succeed, invalid → 409; internal note visible to admins only; "Assign to me" sets the assignee; stale `version` → 409 | I |
| AC-R13 | All routes under `/api/v1`, plural nouns, no verbs except action sub-resources (`/draft/regenerate`, `/ai/retry`, `/check`) | R |
| AC-R14 | Route inventory test: every route except the public allowlist returns 401 without a cookie | I |
| AC-R15 | Author calling any `/admin/*` route or admin-only ticket action → 403 | I |
| AC-R16 | Invalid body → 422 `application/problem+json` with per-field errors; forced internal error → 500 problem body without stack or internals | I |
| AC-R17 | `/api/docs` lists every route with request/response schemas | M |
| AC-R18 | Prompts are versioned files using KB sections; drafts for the 7 brief samples reviewed against the tone guide checklist (acknowledge, specific, own faults, timeline, next step) | E + R |
| AC-R19 | With a sentinel key in env: no API response, SSE event or built frontend file contains it; repo grep for key patterns finds none; `.env.example` documents the variable | I + R |
| AC-R20 | With the outage switch on (and separately with an invalid key): `POST /tickets` → 201; ticket gets fallback category, priority and template draft within 10 s; admin can send a manual reply | I + M |
| AC-R21 | Each ticket makes exactly 1 triage call and 1 draft call; reopening a ticket makes 0 calls; draft prompt contains only one KB section; tokens recorded in `ai_runs` | U + I |
| AC-R22 | README states the chosen models and why | R |
| AC-R23 | Seed creates 10 authors and 18 books whose fields equal the JSON (nulls kept); running seed twice changes nothing | I |
| AC-R24 | Facts tests: BK016 → below threshold; BK005/BK010/BK018 → possibly overdue; BK002 → nothing pending on book but author has ₹3,570 pending; BK013/BK015 → production stage, unknown MRP | U |
| AC-R25 | Repo is private; history has conventional commits per task | R |
| AC-R26 | Live URL serves both portals with seeded data; README lists working test logins | M |
| AC-R27 | README has every section listed in the brief | R |
| AC-R28 | Write-up fits one page | R |
| AC-R29 | README has setup steps and an assumptions section (PLAN §3.2) | R |
| AC-R30 | No public repo or public share of the brief | R |

Reliability and security criteria (support R2, R15, R19, R20):

| ID | Criterion | Type |
| --- | --- | --- |
| AC-J1 | Ticket row and its TRIAGE job are created in one transaction (forced failure after insert leaves neither) | I |
| AC-J2 | A RUNNING job with an expired lease is reclaimed and completes | I |
| AC-J3 | Transient errors retry at most 3 times, then FALLBACK; an auth error goes straight to FALLBACK | I |
| AC-J4 | Same Idempotency-Key twice → one ticket / one message | I |
| AC-S1 | State-changing request with a foreign `Origin` → 403; non-JSON body → 415 | I |
| AC-C1 | Checker unit tests pass for every number/date format, each false-positive source, a wrong amount, an unsupported "overdue" claim and an injected refund promise | U |

Phase 2 chat criteria (Gate G7):

| ID | Criterion | Type |
| --- | --- | --- |
| AC-C1 | Priya asks "How much royalty is pending on Whispers of the Ganges?" → answer says ₹3,570, backed by `get_book_royalties` evidence; checker passes | I (fake provider) + M |
| AC-C2 | Priya asks about BK003 (Rohit's book) → "I can't find that book on your account"; no BK003 data in the answer, stored tool results or logs | I |
| AC-C3 | Kavita asks "When will I get paid?" → explains ₹850 total is below ₹1,000 and rolls over; next cycle closes by 14 Feb 2026 | I (fake provider) + M |
| AC-C4 | Out-of-scope or action request ("change my bank account") → declines and offers a ticket; unknown fact ("is my bank linked?") → says it isn't available and offers a ticket | I + M |
| AC-C5 | Author confirms a proposal → one ticket with `source = CHAT`, the confirmed summary and normal triage; same Idempotency-Key twice → one ticket | I |
| AC-C6 | Provider failing → chat shows the unavailable state with a link to the ticket form; all core flows still pass | I + M |
| AC-C7 | Fake provider answers "₹9,999 pending" → checker blocks → safe reply shown, not the figure | U + I |

Phase 3 voice criteria (Gate G8):

| ID | Criterion | Type |
| --- | --- | --- |
| AC-V1 | A signed-in author presses "Talk to BookLeaf Support" and a call connects through the existing Vocal speech-to-speech agent (Vocal call record shows `speech_to_speech`) | M |
| AC-V2 | Arjun asks how much royalty is pending → the agent says ₹2,464, matching the facts snapshot stored for that session | M + I (snapshot content) |
| AC-V3 | Asking for a human or an action → the agent points to ticket creation; after the call, "Create ticket from this call" creates one ticket with `source = VOICE` and the author-confirmed text | I + M |
| AC-V4 | Gateway without a session → 401; client-sent `variables`/`metadata`/`webhookUrl`/`agentId` are ignored (test asserts the outgoing Vocal request); the snapshot contains only the caller's data; the Vocal secret key never appears in responses or the bundle | I |
| AC-V5 | Vocal unreachable or outside hours → "Voice support unavailable" with ticket/chat links; mic denied → clear message; connection loss → reconnecting, then ended with a message; in all three, tickets, books and chat keep working | I + M |
