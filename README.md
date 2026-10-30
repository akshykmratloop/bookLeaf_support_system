# BookLeaf Support

A support module for authors, which BookLeaf (or any product) can attach to its own platform.

- **Authors** use a help widget inside the BookLeaf dashboard. They raise tickets, chat with an
  assistant, talk to it by voice in the same conversation, and read their past conversations.
- **Support staff** get every ticket already classified and prioritised, with a reply drafted from
  the author's real records. A person always reviews and sends the reply.

The module does not own customer data. It reads it from the host product over one HTTP endpoint,
so it can be attached to a product and detached again. In this repo, `apps/host-demo` plays
BookLeaf's product.

- **Attach it to a product:** [docs/integration.md](docs/integration.md)
- **How it is built:** [docs/architecture.md](docs/architecture.md)
- **Approach and trade-offs:** [docs/write-up.md](docs/write-up.md)
- **AI evaluation:** [docs/eval-results.md](docs/eval-results.md)
- **All documents:** [docs/README.md](docs/README.md)
- **API docs:** `/api/docs` (Swagger, generated from the same Zod schemas that validate requests)

## Live demo

| What | Link | Sign in with |
| --- | --- | --- |
| BookLeaf author dashboard (with the Help widget) | https://bookleaf-authors.vercel.app | `priya.sharma@email.com` / `Author@BookLeaf1` |
| Support app (staff) | https://bookleaf-support-ak.vercel.app/login | `admin@bookleaf.demo` / `Admin@BookLeaf1` |
| API docs (Swagger) | https://bookleaf-support-ak.vercel.app/api/docs | none |

Frontends run on Vercel and the two backends on one small AWS server. How it is deployed, and how
to redeploy with `-deploy` in a commit message: [docs/deploy.md](docs/deploy.md).

## Quick start

Requirements: **Node 22+**, **pnpm** (`npm install -g pnpm`) and **Docker Desktop** (running).

```bash
npm run local
```

That one command does everything, and is safe to run again:

1. Checks Node, pnpm and Docker.
2. Creates `.env` from `.env.example` with fresh random secrets. If `.env` already exists, it only
   adds missing settings and never changes your values.
3. Installs packages, starts Postgres and Redis in Docker, applies migrations and seeds the demo data.
4. Starts all four apps and prints the links and demo logins.

| Open | URL | Sign in with |
| --- | --- | --- |
| BookLeaf author dashboard (start here) | http://localhost:5174 | `priya.sharma@email.com` / `Author@BookLeaf1` |
| Support app (staff) | http://localhost:5173/login | `admin@bookleaf.demo` / `Admin@BookLeaf1` |
| API docs (Swagger) | http://localhost:3000/api/docs | — |

AI keys are optional. Add `ANTHROPIC_API_KEY` (AI triage, drafts, chat) and `OPENAI_API_KEY`
(voice) to `.env` to turn them on; without them the app uses its rule-based fallback.

Stop the apps with `Ctrl+C`, and the database and Redis with `npm run local:stop`.

## Branches

| Branch | What it contains |
| --- | --- |
| **`main`** | The full product: everything below, combined and tested (this branch) |
| `core` | The assignment only: author portal, admin portal, AI triage and drafts, REST API |
| `feature/chat` | `core` + an AI chat assistant grounded in the author's records |
| `feature/voice` | `feature/chat` + an in-house voice call that fills in a ticket live |
| `feature/pluggable-support` | `feature/voice` split into BookLeaf's product + a support module it attaches |
| `feature/saas-platform` | Multi-company SaaS foundation: sign-up, workspaces, connectors, API keys |

Every branch starts with the same command: `npm run local`.

## Repository

```text
apps/api/         the support module: tickets, AI, chat, voice, history (Fastify + Prisma)
apps/web/         the support web app (React): staff admin, the author screens under /embed/<slug>, and public/embed.js
apps/host-demo/   a stand-in BookLeaf product server: authors, books, royalty facts, login, dashboard API
apps/host-web/    the BookLeaf author dashboard (React). host-demo serves its built files
packages/shared/  Zod contracts used by all of them, including the host contract
deploy/          production images, Compose stack, Caddy, Vercel settings and CI deploy scripts
infra/           Terraform for the AWS demo server, plus apply / destroy scripts
```

## Running it another way

`npm run local` is all you need. These are the steps it runs, if you prefer to do them by hand:

```bash
cp .env.example .env    # then replace each replace-with-... value (openssl rand -base64 48)
pnpm install
pnpm db:up              # Postgres 16 on localhost:5433 + Redis 7 on 6380 (docker compose)
pnpm db:migrate         # prisma migrate deploy as the owner (export the .env values first)
pnpm db:roles           # creates/updates the restricted app role from DATABASE_URL (safe to re-run)
pnpm db:seed            # support staff accounts + AI settings (safe to re-run)
pnpm dev                # runs the four apps in watch mode
```

### Production-style run (ports 3300 and 3400)

| What | Port | Notes |
| --- | --- | --- |
| Postgres | 5433 | `docker-compose.yml`; the container listens on 5432 |
| Redis | 6380 | `docker-compose.yml`; shared state for every copy of the API (`REDIS_URL`) |
| Support app + API | **3300** | `pnpm build && pnpm start`: one Node process. The API serves the built web app (`apps/web/dist`) |
| BookLeaf host demo | **3400** | `pnpm host:build && pnpm host:start`. It serves the built author dashboard (`apps/host-web/dist`) and BookLeaf's own API |

3300 and 3400 are the ports used in the verified runs. They are set in `.env`; the code defaults
are different (`PORT` 3000, `HOST_DEMO_PORT` 3200). To run on 3300 and 3400, set:

```text
PORT=3300                          APP_ORIGIN=http://localhost:3300
WEB_DIST_DIR=../web/dist           SUPPORT_URL=http://localhost:3300
HOST_DEMO_PORT=3400                HOST_API_URL=http://localhost:3400
HOST_SIGN_IN_URL=http://localhost:3400
HOST_ORIGINS=http://localhost:3400
```

`HOST_ORIGINS` must list the BookLeaf page origin, or the browser will not show the widget in a frame.

`pnpm dev` is the watch-mode alternative. It starts the API (code default port 3000), the support
web dev server (5173, proxies `/api` to the API), the host demo (3200) and the dashboard dev server
(5174, proxies to the host demo). In that mode set `APP_ORIGIN=http://localhost:5173` and
`SUPPORT_URL=http://localhost:5173`, as `.env.example` does, set `HOST_ORIGINS=http://localhost:5174`,
and open BookLeaf at http://localhost:5174.

### Root scripts

| Script | What it does |
| --- | --- |
| `npm run local` | One command: setup, database, migrations, seed, and all four apps |
| `npm run local:stop` | Stops the Postgres and Redis containers (database data is kept) |
| `pnpm dev` | API, support web, host demo and dashboard in watch mode |
| `pnpm build` | Builds the support web app, then the API |
| `pnpm start` | Starts the built API (and the web app it serves) |
| `pnpm host:build` | Builds the author dashboard (`apps/host-web`) |
| `pnpm host:start` | Starts the BookLeaf host demo |
| `pnpm db:up` · `db:migrate` · `db:roles` · `db:seed` | Postgres and Redis in Docker · apply migrations (owner) · create/update the restricted app role · seed staff accounts and AI settings |
| `pnpm typecheck` · `lint` · `format:check` · `test` · `eval` | Checks (see below) |

### Important settings

All settings are in `.env.example`, grouped by file in `apps/api/src/config/`. No real secret is
stored in the repo. The ones you will most likely change:

| Variable | Default | What it does |
| --- | --- | --- |
| `JWT_SECRET` | none | Signs the session cookie. At least 32 random characters |
| `REDIS_URL` | `redis://localhost:6380` in `.env.example` | Shared state for every copy of the API (live updates, rate limits, one-use tokens). Required in production |
| `HOST_API_KEY` · `HOST_SIGNING_SECRET` | none | Shared with the host product. Generate each with `openssl rand -base64 48` |
| `ANTHROPIC_API_KEY` | empty | Triage, reply drafts and chat. Empty means the rule-based fallback |
| `OPENAI_API_KEY` | empty | Voice. Empty means voice is unavailable |
| `CHAT_MAX_TURNS_PER_SESSION` | `30` | Messages the author can send in one conversation. Typed and spoken messages both count |
| `VOICE_STYLE` | `hinglish` | How the voice assistant speaks: `hinglish` or `english` |
| `VOICE_NAME` | `marin` | Voice used on calls |
| `VOICE_MODEL` | `gpt-realtime-2.1` | Speech model |
| `VOICE_MAX_CALL_SECONDS` | `300` | Longest call. Allowed range 30 to 300 |
| `VOICE_CALLS_PER_HOUR` · `VOICE_CALLS_PER_DAY` | `5` · `10` | Calls per author |
| `HOST_ORIGINS` | empty | Page origins allowed to frame the default workspace's (BookLeaf's) widget, `/embed/bookleaf`. Empty turns embed mode off |
| `EMBED_ENABLED` | `false` | Embed mode for the origins each workspace saves in its settings screen, without `HOST_ORIGINS` |
| `SEED_ADMIN_PASSWORD` · `HOST_DEMO_PASSWORD` | demo values below | Demo passwords for staff and for the host demo's authors |
| `PLATFORM_ADMIN_EMAIL` · `PLATFORM_ADMIN_PASSWORD` | `owner@support.local` · `Platform@Owner1` (local) | The super admin account for the `/platform` console, created or updated by the seed. Set both or neither. Password: 12+ characters with a letter and a digit |

`ANTHROPIC_API_KEY` and `OPENAI_API_KEY` are optional, and a key saved in the `/platform` console
replaces the env key:

- Without the Anthropic key, tickets use the rule-based fallback, and chat offers a ticket instead
  of answering.
- Without the OpenAI key, voice is unavailable.

Everything else works without keys.

## Demo accounts

These are documented demo values for local use only. Change them for any real deployment.

| Who | Where to sign in | Email | Password |
| --- | --- | --- | --- |
| Priya Sharma (author) | BookLeaf dashboard, http://localhost:5174 (`npm run local`) or :3400 | `priya.sharma@email.com` | `HOST_DEMO_PASSWORD` (`Author@BookLeaf1`) |
| Arjun Malhotra (author) | BookLeaf dashboard | `arjun.malhotra@email.com` | same |
| Kavita Deshmukh (author) | BookLeaf dashboard | `kavita.deshmukh@email.com` | same |
| Neha Verma (support staff, admin) | support app, http://localhost:5173/login (`npm run local`) or :3300/login | `admin@bookleaf.demo` | `SEED_ADMIN_PASSWORD` (`Admin@BookLeaf1`) |
| Karan Mehta (support staff) | support app | `ops2@bookleaf.demo` | same |
| Super admin (support provider) | support app, http://localhost:5173/platform/login | `PLATFORM_ADMIN_EMAIL` (`owner@support.local`) | `PLATFORM_ADMIN_PASSWORD` (`Platform@Owner1`) |

Authors sign in to the **BookLeaf dashboard**, not to the support app. Every author in
`apps/host-demo/src/data/sample-data.json` can sign in.

- Priya: BK001 has ₹3,570 pending; BK002 has nothing pending.
- Arjun: ₹2,464 pending and no payout ever recorded ("possibly overdue").
- Kavita: ₹850 in total, below the ₹1,000 threshold; one book is still in typesetting.

## Where things are

**Authors** use the help widget inside the BookLeaf dashboard. The **Help** button (bottom right)
opens a panel. It has four tabs:

| Tab | What it is |
| --- | --- |
| Home | Greeting and shortcuts |
| Ask | Chat with the assistant. The chat box has a voice button: the author can talk or type in the same conversation |
| Tickets | Their tickets and replies, and a new-ticket form |
| History | Past chats and calls, read-only |

The panel can be expanded to full screen inside the page. It follows the dashboard's light or dark
theme. There is no separate "My Books" page in the support app any more: books and royalty figures
are on the BookLeaf dashboard itself. (The old addresses `/books`, `/assistant`, `/tickets` and
`/history` redirect to the matching screen under `/embed/bookleaf`.) Every workspace has its own
widget address, `/embed/<slug>`, which only that workspace's allowed origins may frame; the old
shared `/embed` redirects to `/embed/bookleaf` (F-18).

**Message limit.** One conversation allows `CHAT_MAX_TURNS_PER_SESSION` author messages (default
30). Typed and spoken messages both use up the limit. When it is reached, the chat box turns into a
card with a **New conversation** button. The old conversation stays in History.

**Voice.** The voice button starts a call inside the current conversation. The call hears the chat
so far, and what is said is saved into the chat. `VOICE_STYLE=hinglish` (default) is a warm,
polite mix of Hindi and English that follows the author's language. `VOICE_STYLE=english` is plain
English. Calls last at most `VOICE_MAX_CALL_SECONDS` (300).

**Support staff** sign in at `/login` on the support app, then use:

| URL | What it is |
| --- | --- |
| `/admin` | Ticket queue (open a ticket to review and send the reply) |
| `/admin/assistant` | Switch chat and voice on or off for authors (when the plan allows) |
| `/admin/workspace/settings` | How the AI writes (tone, greeting, signature, language, length, formality, topics to avoid), chat and voice limits, widget and branding |

AI providers, models and keys are no longer set here: `/admin/ai` now says "Managed by your
support provider" and the old endpoints answer 403.

**The super admin console** (the support provider, not a customer) is `/platform`, with its own
sign-in at `/platform/login`, its own account and cookie, and its own look:

| URL | What it is |
| --- | --- |
| `/platform` | Every customer: status, plan and usage counts (tickets, chats, calls, AI runs and estimated AI cost). Create a customer. No ticket content is ever shown |
| `/platform/customers/:id` | One customer's plan (chat / voice allowed, AI on, maximum limits) and suspend / resume |
| `/platform/ai` | AI provider and models for triage, drafts, chat and voice; the global outage switch; provider keys (encrypted, env keys as the fallback); Test connection |

A customer session gets 403 on the console's API, and a super admin session gets 403 on the
customer API.

## What to try

1. **Sign in as Kavita on the BookLeaf dashboard** (:3400). Click **Help**, or the "Get help"
   button on the dashboard. You are signed in to support without a second password.
2. **Ask the assistant** "When will I get my royalty?". It answers from Kavita's facts (₹850 is
   below the ₹1,000 threshold and rolls over) and shows which facts it used. Ask it to raise a
   ticket; it fills a draft that Kavita confirms.
3. **Support side** (another browser or a private window): sign in as Neha at :3300/login. The
   ticket is in the queue within seconds, classified *Royalty & Payments*. Open it: the reply draft
   and the evidence for every figure are there. Edit and send; Kavita's widget updates without a
   refresh.
4. Try sending a reply with an invented amount (for example "₹9,999"). It is blocked, and the
   reason is shown.
5. **Talk instead of typing.** In **Ask**, press the voice button (needs `OPENAI_API_KEY` and a
   microphone). Speak, hang up, then read the conversation: your spoken lines are in the same
   thread, marked as a call. **History** shows it as one conversation.
6. **Theme.** Switch the dashboard to dark mode. The widget panel and the support app inside it
   switch too.
7. **Detach:** stop the host demo. Support keeps working. The assistant says it could not confirm
   the answer and offers a ticket instead of guessing.

## Many businesses, one service (workspaces)

Support is a multi-tenant product. A business creates its own workspace at `/signup` and configures
the product connection (URL, API key, signing secret, encrypted at rest), its customer-data fields,
assistant/chat/voice/widget settings and API keys in the admin area, with nothing in env. BookLeaf
is the default workspace, seeded from the `HOST_*` env values. A product's sign-in token names its
workspace with `iss`. Guide: `docs/integration.md` ("Many products on one support service");
design and roadmap: `docs/saas/PLAN.md`. New env: `SECRETS_MASTER_KEY` (required in production).

Each workspace numbers its own tickets from 1001 under its own fixed prefix (BookLeaf: BL-1001,
BL-1002…; "Acme Corp": AC-1001…). The prefix is made from the company name at sign-up, is unique
across the platform (a second "BL" company gets BL2) and never changes. One workspace's numbers say
nothing about another's ticket volume.

**Postgres keeps workspaces apart too (S.8, row-level security).** Every tenant table (and the
tables that hang off tickets, chats and webhooks) has a policy: a row is visible, and writable,
only inside its own workspace. The API serves requests as a restricted database role
(`DATABASE_URL`, no right to bypass these policies) and sets the request's workspace for each
transaction, so even a query that forgot its workspace filter cannot read or change another
company's rows. Migrations, the seed, signup, sign-in lookups, the AI worker and the webhook
sender use the owner (`DATABASE_ADMIN_URL`). `npm run local` and every deploy create the app role
for you (`pnpm db:roles`); the API refuses to start in production if the roles are wrong. An
older local `.env` whose `DATABASE_URL` still uses the owner keeps working, with a warning at
startup: copy the two `DATABASE_*` lines from `.env.example` to turn the protection on.

Each workspace's saved settings drive its own chat and voice: on/off switches, message and call
limits and conversation length (each up to the maximum in its plan), and the call voice from the
approved list. Its AI behaviour settings (tone and brand voice, greeting, signature, language,
reply length, formality, topics to avoid) are used by triage, reply drafts, chat and voice. The
AI provider, models and keys are the support provider's, set once for everyone in `/platform`;
no workspace has its own AI key.

## Checks

| Command | What it does |
| --- | --- |
| `pnpm typecheck` · `pnpm lint` · `pnpm format:check` | Static checks. ESLint also enforces the boundaries and size limits (files ≤ 200 lines, functions ≤ 40, complexity ≤ 10) |
| `pnpm test` | Unit tests in every app, plus API integration tests on a real Postgres via testcontainers (host-demo runs as a real HTTP host). Needs Docker |
| `pnpm build && pnpm start` | Production build: one Node process serves the API and the built web app |
| `pnpm eval` | Live triage evaluation → `docs/eval-results.md` (needs the Anthropic key; costs cents) |

## How the AI works

**Code gets the facts, the model writes the words, code checks the words, and a person sends them.**

**Why Claude for text.** Structured output is parsed straight into the Zod schemas (`messages.parse`), so a malformed
answer is a typed error, not a crash. The fixed part of each prompt is cached: in the live triage eval, 75K of the 80K
input tokens were cache reads. Measured cost is about $0.08 per 1,000 triaged tickets (Haiku) and $10 per 1,000 drafts
(Sonnet), with triage at 98% category accuracy on 46 cases (`docs/qa/ai-benchmark.md`). The provider sits behind one
interface (`apps/api/src/ai/providers/types.ts`), so another vendor is a new adapter, not a rewrite. Voice calls use
OpenAI's realtime speech API, which is a separate provider behind its own interface.

1. **Facts from the host (no AI).** The host sends verified facts for this customer, each with its
   source: a record field, a policy rule, a calculation, or "unknown". host-demo calculates
   BookLeaf's royalty, payout-threshold, payout-date and production facts. Unknown values are
   marked unknown, never treated as zero.
2. **Triage** (`claude-haiku-5-5`): one call, with the company's own categories, returns category, priority, reasons and a confidence
   level. Business rules then set a minimum priority. For example, an ISBN error or a possibly
   overdue payout is at least High. If the model is unsure, or a rule overrides it, the ticket
   shows "Review suggested".
3. **Reply draft** (`claude-sonnet-5-5`): the prompt holds the tone guide, only the company's
   knowledge-base articles linked to this ticket's category, the facts and the latest author message. The model returns the reply and
   the fact ids behind each claim. Anything not in the facts becomes a `[CONFIRM: …]` placeholder.
4. **Checker (no AI).** It finds every amount, date, timeline, percentage and count in the text and
   matches it against the facts (₹3,570 = Rs. 3570; 14 Feb 2026 = 2026-02-14). It also blocks
   placeholders, internal references, guarantees and refund or legal promises. It runs on the AI
   draft and again on the final text when staff press Send.
5. **Chat and voice** use the same facts and the same checker. Chat answers common questions
   straight from the facts, without an AI call. A call gets the facts in its instructions. Both can
   fill a ticket draft, which the author confirms.

**When AI fails** (down, rate-limited, bad key, the outage switch in the `/platform` console, or AI switched off for the customer): tickets are
still created and classified by keyword rules ("Auto-fallback"), with a template draft filled in by
code from the same facts. Staff can always write manually or press "Re-run AI".

**Prompt injection:** author text is labelled as untrusted, the prompts say never to follow it, and
the checker blocks refund promises whatever the model writes.

**Keys** are read from environment variables at startup, or saved in the `/platform` console
(encrypted with `SECRETS_MASTER_KEY`; a saved key wins over the env key). They are never logged or
sent to the browser; the console shows only the last 4 characters. An integration test checks that a sentinel key never appears in any response.

## API

Base path `/api/v1`, JSON only. Errors are RFC 7807 `application/problem+json` with a stable `code`.
Full schemas are in Swagger at `/api/docs`.

| Area | Endpoints | Who |
| --- | --- | --- |
| Sign-in | `POST /auth/login` (staff) · `POST /auth/host` (host token) · `POST /auth/logout` · `GET /auth/me` · `GET /auth/options` | public / signed in |
| Books | `GET /books` · `GET /books/:id` (read live from the host) | author: own · staff: all |
| Tickets | `GET·POST /tickets` · `GET·PATCH /tickets/:id` · `POST /tickets/:id/messages` · `POST /tickets/:id/solve` (author) | author: own · staff |
| Reply drafts | `GET /tickets/:id/draft` · `POST …/draft/regenerate` · `POST …/check` · `POST …/ai/retry` | staff |
| Chat | `GET /chat/sessions/current` · `POST /chat/sessions` · `GET /chat/sessions/:id` · `POST …/messages` | author |
| Ticket drafts | `GET /ticket-drafts/chat/:sessionId` · `PATCH /ticket-drafts/:id` · `POST …/submit` · `POST …/discard` | author |
| Voice | `POST /voice/calls` (optionally inside a chat) · `GET /voice/calls/resumable` · `GET /voice/calls/:id` · WebSocket `…/stream` | author |
| History | `GET /conversations` · `GET /conversations/chats/:id` · `GET /conversations/calls/:id` | author |
| Live updates | `GET /events` (Server-Sent Events, hints only) | signed in |
| Settings | `/admin/assistant/*` · `/workspace/settings` · `GET /assistant/availability` | staff |
| Super admin console | `/platform/auth/*` · `/platform/ai/*` · `/platform/customers/*` | super admin only |
| Health | `GET /health` | public |

Status codes: 401 not signed in · 403 wrong role or foreign `Origin` · 404 missing *or not yours* ·
409 version conflict or invalid change · 422 validation or fact-check failure · 429 rate limit ·
503 host or AI unavailable.

**Security:**

- Staff passwords use argon2id.
- A staff email has one account on the whole platform (`users.login_email`), so sign-in is
  email + password only. Sign-up refuses an email that already has an account (409). Authors are
  not affected: the same author email can exist in several workspaces.
- The session is signed and kept in an `httpOnly` cookie. It lasts `SESSION_TTL_HOURS` (default 8,
  at most 72) and carries the account's session version, which is checked on every request.
  Signing out, a password change or removal from the workspace ends the account's sessions at
  once, on every device (signing out on one device signs out the others too). A staff account
  that is no longer a member of its workspace cannot sign in again and gets no new session.
- Every API route requires sign-in unless it is marked public.
- CSRF is blocked by an `Origin` check and JSON-only bodies.
- Helmet sets a CSP.
- Input is cleaned at the boundary: HTML and control characters are removed, then NFC-normalised.
- Logs redact cookies and secrets.

## Assumptions

- **Business date.** The sample data ends in December 2025, so payout maths runs "as of"
  `DATA_AS_OF=2025-12-31`. Timestamps and SLAs use the real clock.
- **The payout threshold applies to the author's total** pending across books, not per book.
- **"Possibly overdue"** means money is pending and either it was never paid although the first
  payout deadline has passed, or there has been no payout for more than one cycle plus 45 days.
  Replies say "our records show no payout yet" and escalate, rather than claim a failed payment.
- **First-response targets:** Critical 4 h · High 24 h · Medium 48 h · Low 72 h, or the ticket
  category's own SLA hours when those are sooner. Until the first reply, the deadline is worked
  out again whenever an admin or a fresh triage changes the category or the priority, always from
  the category the ticket ends up in.
- Attachments are UI-only, as the brief allows.

## Known limitations

- **Not deployed yet.** The Dockerfile builds one image and runs `prisma migrate deploy` before
  starting.
- **Several copies of the API can run side by side (F-19).** Live updates, rate limits, one-use
  tokens, the chat queue and settings-cache clearing are shared through Redis. A live voice call
  stays on the copy that holds its connection, and the startup clean-up of open calls still
  assumes one copy (scope it before rolling restarts with several copies; see
  `docs/architecture.md` §21).
- Signed webhooks (`ticket.created`, `ticket.replied`, `ticket.status_changed`) and a server API on workspace API keys
  are built; see the integration guide. The full route list is in `docs/qa/baseline.md`.
- **Webhooks page (U-10)** in the staff app (Webhooks, under API Keys): add, edit, switch on or off and
  delete webhooks, copy the signing secret (shown once) or rotate it, send a test, and read the delivery
  log (status, HTTP answer, time, attempts) with a Retry button for a failed delivery.
- **API keys do only what the admin allows (U-11).** On "Create key" the admin picks Read only,
  Read & write, or single permissions. With `tickets:write` the product's server can raise tickets,
  add customer messages and resolve / close / reopen (`/api/v1/server/...`, Idempotency-Key,
  rate limited); details in `docs/integration.md`.
- **Categories and knowledge base are per company (S.9)**, edited under Categories and Knowledge
  Base in the staff app. Reply drafts get only the articles linked to the ticket's category (no
  search or embeddings yet; RAG with pgvector comes later). The author assistant (chat and voice)
  reads all of the company's active articles, because a conversation has no ticket category yet.
- **Still BookLeaf-only:** the royalty facts engine, the royalty-figure checker, BookLeaf's keyword
  fallback, reply examples and fallback templates run only for the default workspace (BookLeaf).
  Other companies get generic triage, draft, chat and voice wording with their own name and
  articles, and no BookLeaf policy. The shared parts of the assistant prompt still call the
  customer "the author" and their records "books".
- The old fixed `category` columns on tickets and ticket drafts are no longer used and are dropped
  in a later release (expand → backfill → contract).
- The evaluation set (46 triage cases incl. Hinglish, Hindi and adversarial; 24 draft cases) was written by the
  developer; results in `docs/qa/ai-benchmark.md`.
- **Team members come later (S.11).** Staff accounts come only from sign-up or the seed; there is
  no way yet to add members from the app. Adding members, roles (Owner/Admin/Agent), sign-in codes
  and "forgot password" are planned but not built.
- **One company per staff account.** A staff email belongs to one workspace. Using one account in
  several companies (memberships plus a company switcher) comes later.
- **Sign-up emails are not verified yet.** Self-serve sign-up is open and does not confirm that the
  email address belongs to the person signing up. Verification comes with S.11.

## Deployment

The live demo's setup (AWS + Vercel, Terraform, the `-deploy` flags, teardown) is in
[docs/deploy.md](docs/deploy.md). For any other host: two services plus Postgres, support
(`deploy/Dockerfile.api`) and the host product (`deploy/Dockerfile.host-demo`). Support needs
`DATABASE_URL` (the restricted app role) and `DATABASE_ADMIN_URL` (the owner: run migrations and
`node dist/db-roles.js` with both set before starting the server), `REDIS_URL` (Redis 7 in the Compose stacks; the API refuses to start in production
without it), `JWT_SECRET`, `APP_ORIGIN` (its public URL), the `HOST_*` settings, `SECRETS_MASTER_KEY`,
`NODE_ENV=production`, and optionally the AI keys. To run more than one copy of the API, point every
copy at the same Postgres and the same Redis; nothing else is needed (live voice calls stay on the
copy that opened them). Seed staff accounts once
with `SEED_ADMIN_PASSWORD=… pnpm db:seed`; add `PLATFORM_ADMIN_EMAIL` and `PLATFORM_ADMIN_PASSWORD`
to create the super admin for `/platform` (the demo box's `deploy/up.sh` runs the seed on every
deploy, so put both in its env secret).
