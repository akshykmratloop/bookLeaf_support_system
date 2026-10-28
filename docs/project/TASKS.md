# TASKS.md — BookLeaf Author Support Portal

> Ledger: status + commit SHA. Design: `PLAN.md` (requirement IDs R1–R30 in §2). Diagrams:
> `docs/architecture.md`. Statuses below were updated on 2026-10-27 07:30 IST from real test runs; see `IMPLEMENTATION_STATUS.md`.
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
| Q.0 | Baseline: read docs + code, run every suite, record current failures, flaky tests and timings before changing anything | ⬜ |
| Q.1 | Requirements-to-evidence matrix (every brief requirement → code → test → status) in `docs/qa-report.md` | ⬜ |
| Q.2 | Functional sweep: auth/session/CSRF/RBAC/IDOR on every route; author data vs sample JSON; full ticket lifecycle incl. duplicates and concurrent updates | ⬜ |
| Q.3 | Real-browser E2E: find and use the existing `tester-army/e2e` setup (check it exists and how it runs; otherwise ego-browser per global rules); journeys 1–8 from the brief, repeated; screenshots + console + network evidence | ⬜ |
| Q.4 | Adversarial tests: malformed/oversized/Unicode/RTL input, invalid JSON and content types, XSS/SQLi/HTML/prompt injection, brute force and AI-endpoint abuse, provider failures, DB outage and recovery; seeded randomized tests; a regression test for every defect found | ⬜ |
| Q.5 | AI evaluation: versioned dataset (held-out split), category + priority accuracy / per-class P/R/F1 / confusion matrix, critical misclassification rate, unsupported-claim rate, injection robustness, schema-failure rate, repeat-run stability → `docs/eval-results.md` | ⬜ |
| Q.6 | AI latency and cost: p50/p95/p99 end to end and per stage, tokens and cost per call from `ai_runs`, concurrency behaviour; optimise only with before/after numbers | ⬜ |
| Q.7 | API/DB/security/reliability: status codes and schemas, constraints and indexes, migration on a disposable DB, headers/cookies/rate limits, dependency audit, graceful shutdown | ⬜ |
| Q.8 | Independent UI/UX review (author + ops team perspectives, accessibility, responsive, states); implement evidence-backed fixes; re-run affected journeys | ⬜ |
| Q.9 | Independent top-model quality gate (architecture, code quality, security, AI) within the 30% budget; verify each finding against the repo; fix substantiated ones | ⬜ |
| Q.10 | The pasted brief was cut off in §11 ("…failure"). Check whether the user sent the rest; if not, finish §11 from its evident intent and record that assumption in the report | ⬜ |
| Q.11 | Final QA report: what was tested, what passed, what failed and was fixed, what was not tested, what remains uncertain (no claims of 100% correctness) | ⬜ |

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
| C.8 | Merge + deploy | ⛔ not doing: stays on its branch unless you decide otherwise | |

## Phase 3 — Voice via Vocal (speech-to-speech) · Gate G8 · ⛔ BLOCKED until PLAN §18.2 "Phase 3 GO"

Branch `feat/voice`; `FEATURE_VOICE=false` until G8 passes. Depends on: G7 passed **or** Phase 2
abandoned, and V1–V7 verified. No code changes in the Vocal repo (Phase 3b is deferred).

| # | Task | Depends on | Status | SHA |
| --- | --- | --- | --- | --- |
| V.1 | Vocal prerequisites V1–V3, V5–V6 (PLAN §18.4): `origin/main`, hosts, funded S2S key + provider enabled, `vak_` key, BookLeaf origin in `WEB_CALL_ALLOWED_ORIGINS` | — | ⛔ (you) | — |
| V.2 | Create the Vocal S2S agent (`providers.realtime`, prompt with fact placeholders, 300 s max) via Vocal API | V.1 | ⛔ | — |
| V.3 | Facts snapshot builder (shared services, author-only, ≤ 8 KB, hash) + unit tests | M2.2 | ⛔ | |
| V.4 | Voice gateway route (session + Origin check, ignores client variables/metadata/webhookUrl/agentId, secret key, pass-through response), `voice_sessions` table, status endpoint, limits | V.3, C.3 (its migration alone if Phase 2 was abandoned) | ⛔ | |
| V.5 | Smoke test V7: one S2S call from the BookLeaf origin through the gateway | V.2, V.4 | ⛔ | |
| V.6 | Author UI: "Talk to BookLeaf Support" panel (lazy SDK `@verbisi/web` pinned, mic pre-check, states, mute, end, 5-min cap, on-screen facts, error mapping, error boundary) | V.5 | ⛔ | |
| V.7 | "Create ticket from this call" (author-confirmed, `source = VOICE`) | V.6 | ⛔ | |
| V.8 | Tests for AC-V1…AC-V5; full core suite still green | V.7 | ⛔ | |
| V.9 | Merge + deploy with flag on; recorded demo call; README section incl. QA hours and measured latency | V.8 | ⛔ | |

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
