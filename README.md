# BookLeaf Support

A support module for authors, which BookLeaf (or any product) can attach to its own platform.

- **Authors** raise tickets, chat with an assistant, call it by voice, and read their past
  conversations.
- **Support staff** get every ticket already classified and prioritised, with a reply drafted from
  the author's real records. A person always reviews and sends the reply.

The module does not own customer data. It reads it from the host product over one HTTP endpoint,
so it can be attached to a product and detached again. In this repo, `apps/host-demo` plays
BookLeaf's product.

- **Attach it to a product:** [docs/integration.md](docs/integration.md)
- **How it is built:** [docs/architecture.md](docs/architecture.md)
- **Approach and trade-offs:** [docs/write-up.md](docs/write-up.md)
- **AI evaluation:** [docs/eval-results.md](docs/eval-results.md)
- **API docs:** `/api/docs` (Swagger, generated from the same Zod schemas that validate requests)

## Repository

```text
apps/api/         the support module: tickets, AI, chat, voice, history (Fastify + Prisma)
apps/web/         the support web app (React), including /embed and public/embed.js
apps/host-demo/   a stand-in BookLeaf product: authors, books, royalty facts, login
packages/shared/  Zod contracts used by all three, including the host contract
```

## Run locally

Requirements: Node 22+, pnpm 12 (`corepack enable`), Docker (for Postgres).

```bash
cp .env.example .env    # set JWT_SECRET, HOST_API_KEY, HOST_SIGNING_SECRET (openssl rand -base64 48)
pnpm install
pnpm db:up              # Postgres 16 on localhost:5433
pnpm db:migrate         # prisma migrate deploy
pnpm db:seed            # support staff accounts + AI settings (safe to re-run)
pnpm dev                # support API :3000 · support web :5173 · host-demo :3200
```

`ANTHROPIC_API_KEY` (triage, drafts, chat) and `OPENAI_API_KEY` (voice) are optional:

- Without the Anthropic key, tickets use the rule-based fallback, and chat offers a ticket instead
  of answering.
- Without the OpenAI key, voice is unavailable.

Everything else works without keys.

## Demo accounts

| Who | Where to sign in | Email | Password |
| --- | --- | --- | --- |
| Priya Sharma (author) | host-demo, http://localhost:3200 | `priya.sharma@email.com` | `HOST_DEMO_PASSWORD` (`Author@BookLeaf1`) |
| Arjun Malhotra (author) | host-demo | `arjun.malhotra@email.com` | same |
| Kavita Deshmukh (author) | host-demo | `kavita.deshmukh@email.com` | same |
| Neha Verma (support) | support, http://localhost:5173/login | `admin@bookleaf.demo` | `SEED_ADMIN_PASSWORD` (`Admin@BookLeaf1`) |
| Karan Mehta (support) | support | `ops2@bookleaf.demo` | same |

Authors sign in to the **product**, not to support. Every author in
`apps/host-demo/src/data/sample-data.json` can sign in. These are demo-only passwords; change them
for any real deployment.

- Priya: BK001 has ₹3,570 pending; BK002 has nothing pending.
- Arjun: ₹2,464 pending and no payout ever recorded ("possibly overdue").
- Kavita: ₹850 in total, below the ₹1,000 threshold; one book is still in typesetting.

## What to try

1. **Sign in as Kavita on host-demo** (:3200). Click **Help** (the widget), or **Open support in a
   new tab**. You are signed in to support without a second password.
2. **Ask the assistant** "When will I get my royalty?". It answers from Kavita's facts (₹850 is
   below the ₹1,000 threshold and rolls over) and shows which facts it used. Ask it to raise a
   ticket; it fills a draft that Kavita confirms.
3. **Support side** (another browser or a private window): sign in as Neha. The ticket is in the
   queue within seconds, classified *Royalty & Payments*. Open it: the reply draft and the evidence
   for every figure are there. Edit and send; Kavita's page updates without a refresh.
4. Try sending a reply with an invented amount (for example "₹9,999"). It is blocked, and the
   reason is shown.
5. **History** (author menu): every past chat and call, newest first, read-only.
6. **Detach:** stop host-demo. Support keeps working. The assistant says it could not confirm the
   answer and offers a ticket instead of guessing, and *My Books* shows "Details are not available
   right now".

## Many businesses, one service (workspaces)

Support is a multi-tenant product. A business creates its own workspace at `/signup` and configures
the product connection (URL, API key, signing secret, encrypted at rest), its customer-data fields,
assistant/chat/voice/widget settings and API keys in the admin area, with nothing in env. BookLeaf
is the default workspace, seeded from the `HOST_*` env values. A product's sign-in token names its
workspace with `iss`. Guide: `docs/integration.md` ("Many products on one support service");
design and roadmap: `docs/saas/PLAN.md`. New env: `SECRETS_MASTER_KEY` (required in production).

## Checks

| Command | What it does |
| --- | --- |
| `pnpm typecheck` · `pnpm lint` · `pnpm format:check` | Static checks. ESLint also enforces the boundaries and size limits (files ≤ 200 lines, functions ≤ 40, complexity ≤ 10) |
| `pnpm test` | API: 261 tests (unit, plus integration on a real Postgres via testcontainers, with host-demo running as a real HTTP host) · web: 29 · host-demo: 21 |
| `pnpm build && pnpm start` | Production build: one Node process serves the API and the built web app |
| `pnpm eval` | Live triage evaluation → `docs/eval-results.md` (needs the Anthropic key; costs cents) |

## How the AI works

**Code gets the facts, the model writes the words, code checks the words, and a person sends them.**

1. **Facts from the host (no AI).** The host sends verified facts for this customer, each with its
   source: a record field, a policy rule, a calculation, or "unknown". host-demo calculates
   BookLeaf's royalty, payout-threshold, payout-date and production facts. Unknown values are
   marked unknown, never treated as zero.
2. **Triage** (`claude-haiku-5-5`): one call returns category, priority, reasons and a confidence
   level. Business rules then set a minimum priority. For example, an ISBN error or a possibly
   overdue payout is at least High. If the model is unsure, or a rule overrides it, the ticket
   shows "Review suggested".
3. **Reply draft** (`claude-sonnet-5-5`): the prompt holds the tone guide, only this category's
   knowledge-base section, the facts and the latest author message. The model returns the reply and
   the fact ids behind each claim. Anything not in the facts becomes a `[CONFIRM: …]` placeholder.
4. **Checker (no AI).** It finds every amount, date, timeline, percentage and count in the text and
   matches it against the facts (₹3,570 = Rs. 3570; 14 Feb 2026 = 2026-02-14). It also blocks
   placeholders, internal references, guarantees and refund or legal promises. It runs on the AI
   draft and again on the final text when staff press Send.
5. **Chat and voice** use the same facts and the same checker. Chat answers common questions
   straight from the facts, without an AI call. A call gets the facts in its instructions. Both can
   fill a ticket draft, which the author confirms.

**When AI fails** (down, rate-limited, bad key, or the outage switch in *AI Settings*): tickets are
still created and classified by keyword rules ("Auto-fallback"), with a template draft filled in by
code from the same facts. Staff can always write manually or press "Re-run AI".

**Prompt injection:** author text is labelled as untrusted, the prompts say never to follow it, and
the checker blocks refund promises whatever the model writes.

**Keys** are read from environment variables at startup. They are never stored, logged or sent to
the browser. An integration test checks that a sentinel key never appears in any response.

## API

Base path `/api/v1`, JSON only. Errors are RFC 7807 `application/problem+json` with a stable `code`.
Full schemas are in Swagger at `/api/docs`.

| Area | Endpoints | Who |
| --- | --- | --- |
| Sign-in | `POST /auth/login` (staff) · `POST /auth/host` (host token) · `POST /auth/logout` · `GET /auth/me` · `GET /auth/options` | public / signed in |
| Books | `GET /books` · `GET /books/:id` (read live from the host) | author: own · staff: all |
| Tickets | `GET·POST /tickets` · `GET·PATCH /tickets/:id` · `POST /tickets/:id/messages` | author: own · staff |
| Reply drafts | `GET /tickets/:id/draft` · `POST …/draft/regenerate` · `POST …/check` · `POST …/ai/retry` | staff |
| Chat | `GET /chat/sessions/current` · `POST /chat/sessions` · `GET /chat/sessions/:id` · `POST …/messages` | author |
| Ticket drafts | `GET /ticket-drafts/chat/:sessionId` · `PATCH /ticket-drafts/:id` · `POST …/submit` | author |
| Voice | `POST /voice/calls` · `GET /voice/calls/resumable` · `GET /voice/calls/:id` · WebSocket `…/stream` | author |
| History | `GET /conversations` · `GET /conversations/chats/:id` · `GET /conversations/calls/:id` | author |
| Live updates | `GET /events` (Server-Sent Events, hints only) | signed in |
| Settings | `/admin/ai/*` · `/admin/assistant/*` · `GET /assistant/availability` | staff |
| Health | `GET /health` | public |

Status codes: 401 not signed in · 403 wrong role or foreign `Origin` · 404 missing *or not yours* ·
409 version conflict or invalid change · 422 validation or fact-check failure · 429 rate limit ·
503 host or AI unavailable.

**Security:**

- Staff passwords use argon2id.
- The session is signed and kept in an `httpOnly` cookie.
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
- **First-response targets:** Critical 4 h · High 24 h · Medium 48 h · Low 72 h.
- Attachments are UI-only, as the brief allows.

## Known limitations

- **Not deployed yet.** The Dockerfile builds one image and runs `prisma migrate deploy` before
  starting.
- One instance only: the event bus and live calls are in memory.
- Webhooks to the host (for example "ticket replied") are not built; see the integration guide.
- The parts that describe BookLeaf's business (knowledge base, categories, triage rules,
  templates) are in the module. A different product would replace them; the integration guide lists
  the files.
- The evaluation set is small and was written by the developer.

## Deployment

Two services plus Postgres: support (this image) and the host product. Support needs
`DATABASE_URL`, `JWT_SECRET`, `APP_ORIGIN` (its public URL), the `HOST_*` settings,
`NODE_ENV=production`, and optionally the AI keys. Seed staff accounts once with
`SEED_ADMIN_PASSWORD=… pnpm db:seed`.
