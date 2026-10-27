# BookLeaf Author Support & Communication Portal

An author portal and an operations portal for BookLeaf support tickets. AI classifies every ticket,
sets its priority and drafts a reply grounded in the author's real records and the BookLeaf Knowledge
Base. A person always reviews and sends the reply.

- **Live demo:** _not deployed yet — see [Deployment](#deployment)_
- **API docs:** `/api/docs` (Swagger UI, generated from the same schemas that validate requests)
- **Write-up:** [docs/write-up.md](docs/write-up.md) · **Architecture:** [docs/architecture.md](docs/architecture.md) · **AI evaluation:** [docs/eval-results.md](docs/eval-results.md)

## Demo logins

All seeded authors share one password, and both admins share another.

| Who | Email | Password | Why this account is interesting |
| --- | --- | --- | --- |
| Priya Sharma (author) | `priya.sharma@email.com` | `Author@BookLeaf1` | BK002 has nothing pending, but BK001 has ₹3,570 pending |
| Arjun Malhotra (author) | `arjun.malhotra@email.com` | `Author@BookLeaf1` | ₹2,464 pending and no payout ever recorded ("possibly overdue") |
| Kavita Deshmukh (author) | `kavita.deshmukh@email.com` | `Author@BookLeaf1` | ₹850 total, below the ₹1,000 threshold; one book still in typesetting |
| Sneha Kulkarni (author) | `sneha.kulkarni@email.com` | `Author@BookLeaf1` | A book waiting in cover design |
| Neha Verma (ops) | `admin@bookleaf.demo` | `Admin@BookLeaf1` | Admin |
| Karan Mehta (ops) | `ops2@bookleaf.demo` | `Admin@BookLeaf1` | Second admin (for assignment) |

Every author in `bookleaf_sample_data.json` can sign in with their email and the author password.
These are demo-only credentials set by `SEED_*_PASSWORD`; change them for any real deployment.

## What to try

1. **Author:** sign in as Kavita → *My Books* (in-production book shows "Set at publication", not ₹0) → *New Ticket*
   about *The Nagpur Notebooks*: "When will I get my royalty?".
2. **Admin** (another browser or a private window): the ticket appears in the queue within seconds, classified
   *Royalty & Payments / Medium*. Open it: the draft explains that ₹850 is below the ₹1,000 threshold and rolls over,
   and the evidence panel shows where each figure came from.
3. Edit the draft and send. Kavita's ticket page updates without refreshing.
4. Try sending a reply with an invented amount (e.g. "₹9,999"): it is blocked, with the reason shown.
5. *AI Settings* → turn on **Simulate an AI outage** → raise another ticket. It is still created, classified by rules
   ("Auto-fallback"), and gets a template draft. Turn it off afterwards.

## Run locally

Requirements: Node 22+, pnpm 12 (`corepack enable`), Docker (for Postgres).

```bash
cp .env.example .env            # then set JWT_SECRET; ANTHROPIC_API_KEY is optional
pnpm install
pnpm db:up                       # Postgres 16 on localhost:5433
pnpm db:migrate                  # prisma migrate deploy
pnpm db:seed                     # sample data + demo admins (safe to re-run)
pnpm dev                         # API on :3000, web on :5173 (proxies /api)
```

Open http://localhost:5173. Without `ANTHROPIC_API_KEY` everything still works on the rule-based fallback.

| Command | What it does |
| --- | --- |
| `pnpm typecheck` · `pnpm lint` · `pnpm format:check` | Static checks (ESLint also enforces the architecture boundaries) |
| `pnpm --filter @bookleaf/api exec vitest run --project unit` | 45 unit tests (facts, checker, triage, drafting) |
| `pnpm --filter @bookleaf/api exec vitest run --project integration` | 48 integration tests on a real Postgres in Docker (testcontainers) |
| `pnpm eval` | Live triage evaluation → `docs/eval-results.md` (needs the API key; costs cents) |
| `pnpm build && pnpm start` | Production build: one Node process serves the API and the built web app |

## Architecture

```text
apps/web (React SPA) ──JSON over /api/v1, session cookie──▶ apps/api (Fastify)
                     ◀── Server-Sent Events (hints) ───────     │
                                                                ├─ modules/  auth · books · tickets · messages · drafts · ai-admin · events
                                                                ├─ ai/       facts · triage · drafting · checker · prompts · providers · jobs
                                                                └─ Postgres (Prisma): tickets, messages, ai_jobs, ai_drafts, ai_runs, audit_events
packages/shared  ← Zod schemas, enums and labels used by both sides
```

Key decisions (details and diagrams in [docs/architecture.md](docs/architecture.md)):

- **One deployable.** The API serves the built SPA on the same origin: no CORS, first-party `httpOnly` cookies,
  and the background worker and SSE live in the same long-running process.
- **Thin routes, typed contracts.** Routes validate with Zod and call services; only services/repositories touch
  Prisma. Response schemas strip undeclared fields, and authors and admins get different response shapes, so
  internal notes and AI data cannot leak to authors by accident.
- **Background AI via a jobs table.** Creating a ticket writes the ticket, an acknowledgement and an `ai_jobs` row
  in one transaction, so a ticket can never exist without its AI work queued. A worker claims jobs with
  `FOR UPDATE SKIP LOCKED` and a lease (crashed jobs are picked up again), retries transient errors with backoff,
  and falls back to rules after 3 attempts. Results from an outdated job are discarded.
- **Admin decisions win.** AI never overwrites a category or priority an admin set. Every admin change is audited.
- **Swappable AI vendor.** The core talks to an `LlmProvider` interface. The Anthropic SDK is imported only in
  `ai/providers/anthropic/` (ESLint enforces this). Tests use a fake provider.

## How the AI works

**Principle: code computes the facts, the model writes the words, code checks the words, a person sends them.**

1. **Facts first (no AI).** For each ticket, code builds a facts pack from *that author's* records only: per-book
   royalties, the author's total pending, payout eligibility against the ₹1,000 threshold, the next payout deadline
   (quarter end + 45 days), production stage and what comes next, and the distribution record. Each fact carries its
   source (record field, KB rule or calculation). Unknown values (bank account linked, stage dates) are explicitly
   marked unknown, never treated as zero.
2. **Triage** (fast model, `claude-haiku-5-5`): one call returns category, priority, short reasons, what to check
   before replying, and a confidence level. Business rules then set a floor (an ISBN error or a possibly overdue
   payout is at least High, as the KB requires). Low confidence or a rules override shows "Review suggested".
3. **Draft** (`claude-sonnet-5-5`): the prompt contains the role and tone guide, **only this category's KB
   section** and its example, the facts pack, and the latest author message (earlier messages truncated). The model
   returns the reply plus a list of claims, each citing fact ids. Anything not in the facts must become a
   `[CONFIRM: …]` placeholder.
4. **Checker (no AI).** Every amount, date, timeline, percentage and copy count in the text is extracted,
   normalised (₹3,570 = Rs. 3570 = 3,570 rupees; 14 Feb 2026 = 2026-02-14) and matched against the facts. It also
   blocks placeholders, internal references, guarantees and refund/legal promises. It runs on the AI draft and again
   on the admin's final text when they press Send. Placeholders can never be overridden; other blocks need a written
   reason, which is audited.

**Prompt injection:** author text is wrapped and labelled as untrusted, the prompts say never to follow it, and the
checker blocks refund promises regardless of what the model writes. Both injection cases in the eval are classified
by content, not by the injected instruction.

**When AI fails** (down, rate-limited, bad key, or the outage switch): tickets are still created; triage uses keyword
rules + the same priority floor and is flagged "Auto-fallback"; the draft is a per-category template filled by code
from the same facts; admins can always write and send manually and can press "Re-run AI". The queue shows each
ticket's AI state (queued, retrying, done, fallback).

**Cost:** one cheap triage call per ticket and one draft call; drafts are stored and opening a ticket never calls AI;
only one KB section per prompt; no full history replay; the stable instructions are marked cacheable. Every attempt
is logged in `ai_runs` with tokens, estimated cost, latency and outcome.

**Model choice:** Claude, because its structured-output mode lets the SDK validate responses against the same Zod
schemas the app uses, and it follows grounding and tone instructions well. Haiku for classification (cheap and
fast; 26/26 on our small eval set), Sonnet for the author-facing reply where wording quality matters. Admins can
switch models per task in *AI Settings*; the allowlist lives on the server.

**API keys** are read from environment variables at startup and never stored in the database, logged or sent to the
browser. *AI Settings* shows only whether a provider is configured and the last test result. An integration test
checks that a sentinel key never appears in any response.

## API

Base path `/api/v1`, JSON only. Errors are RFC 7807 `application/problem+json` with a stable `code` and, for 422,
per-field `errors`. Full schemas are in Swagger at `/api/docs`.

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/login` · `/auth/logout` | public | Session cookie (login rate-limited: 5/min per IP+email) |
| GET | `/auth/me` | signed in | Current user |
| GET | `/books` · `/books/:id` | author: own · admin: all | Books; unknown values are `null`, money in paise |
| GET | `/tickets` | author: own · admin: all | Filters `status, category, priority, assignee=me\|unassigned, from, to, q`; cursor pagination (50, max 200); admins get urgency order |
| POST | `/tickets` | author | Create (`Idempotency-Key` header supported) |
| GET | `/tickets/:id` | owner · admin | Author view or admin view |
| PATCH | `/tickets/:id` | admin | Status, category, priority, assignee (self or none); requires `version` |
| POST | `/tickets/:id/messages` | owner · admin | Author follow-up; admin reply (fact-checked) or internal note |
| GET | `/tickets/:id/draft` | admin | Latest draft with evidence and check results |
| POST | `/tickets/:id/draft/regenerate` | admin | Queue a new draft |
| POST | `/tickets/:id/check` | admin | Check edited text against the facts (no AI call) |
| POST | `/tickets/:id/ai/retry` | admin | Re-run triage |
| GET | `/events` | signed in | Server-Sent Events: `{ type, ticketId }` hints; authors only see their own public events |
| GET · PUT | `/admin/ai/settings` | admin | Provider and models (allowlist), outage switch |
| GET | `/admin/ai/status` · POST `/admin/ai/test` | admin | Which providers have keys; live test call |
| GET | `/health` | public | Liveness + database check |

Status codes: 401 not signed in · 403 wrong role or foreign `Origin` · 404 missing *or not yours* (another author's
ticket is indistinguishable from a missing one) · 409 version conflict or invalid status change · 415 non-JSON body ·
422 validation or fact-check failure · 429 rate limit.

**Security summary:** argon2id passwords; signed session in an `httpOnly; SameSite=Lax` cookie (`Secure` in
production); default-deny auth on every API route; CSRF defence by Origin check plus JSON-only bodies; Helmet with a
CSP; input sanitised (HTML and control characters stripped, NFC) at the boundary; logs redact cookies and secrets.

## Assumptions

- **Business date.** The sample data ends in December 2025, so payout maths runs "as of" `DATA_AS_OF=2025-12-31`
  (next cycle closes 14 Feb 2026). Timestamps and SLAs use the real clock.
- **Payout threshold applies to the author's total** pending across books, not per book.
- **"Possibly overdue"** = money pending and either never paid although the first payout deadline after publication
  has passed, or no payout for more than one cycle + 45 days. Earnings dates are not in the data, so drafts say
  "our records show no payout yet" and escalate, rather than asserting a failed payment.
- **`available_on` is BookLeaf's distribution record**, not live marketplace status, so drafts never claim a book is
  or isn't listed; they ask the admin to confirm.
- **First-response targets:** Critical 4 h · High 24 h · Medium 48 h · Low 72 h.
- Admins can assign tickets to themselves (or unassign), as the brief describes.
- Attachments are UI-only, as the brief allows.

## Known limitations and next steps

- **Not deployed yet.** The Dockerfile builds one image; it runs `prisma migrate deploy` before starting.
- Single instance: the event bus is in memory. Multiple instances would use Postgres `LISTEN/NOTIFY` (the bus is
  behind an interface).
- Only the Anthropic adapter exists; the provider interface is ready for a second vendor.
- API keys come only from env. A production version would keep per-tenant keys in a secret manager.
- The evaluation set is small and written by the developer; a larger, independently labelled set is next.
- No email notifications, attachment upload or full-text search.
- Planned later phases (separate, feature-flagged): an AI chat for authors and voice support — see `PLAN.md` §18.

## Deployment

The app is one container plus Postgres. Required env: `DATABASE_URL`, `JWT_SECRET`, `APP_ORIGIN` (the public URL),
`ANTHROPIC_API_KEY` (optional), `NODE_ENV=production`. After the first deploy, seed once with
`SEED_AUTHOR_PASSWORD=… SEED_ADMIN_PASSWORD=… pnpm db:seed`.
