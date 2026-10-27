# Requirements-to-evidence matrix

Date: 2026-10-28. Branch: `feature/support-saas`.

**Source of truth:** the original assignment, `BookLeaf_Technical_Assignment_1.pdf` (BookLeaf Publishing, "Author Support & Communication Portal", Assignment 1 of 2). Every row below is a requirement, deliverable or scoring rule the PDF states, written in short form.

**How to read the Status column**

- **Met** means the code exists and a test that exists in the tree covers it. File paths are given so you can check.
- **Partly** means part of it is built or tested, and the gap is named in Notes.
- **Not met** means it does not exist.
- **Not verified** means it may work, but nobody has run it.

Test counts on this branch: API 422 tests in 49 files (real Postgres through testcontainers), web 74, host-demo 28, host-web 4.

All paths are relative to the repo root. `apps/api/test/` holds the API integration tests (`*.int.test.ts`).

## 1. How this product maps to the assignment

The assignment describes one app with an author portal and an admin portal. This repo builds the same thing as a support module that plugs into a host product:

- **Author side:** authors sign in to the BookLeaf dashboard (`apps/host-web`, served by `apps/host-demo`). Their support screens (ask, tickets, history) open inside it as a widget (`apps/web/src/pages/author/*`, `apps/web/public/embed.js`).
- **Admin side:** support staff use the support app at `/admin` (`apps/web/src/pages/admin/*`).
- **Books and royalty figures** are read from the host, not stored by the support module (`apps/host-demo/src/data/sample-data.json`, `apps/api/src/host/*`).

## 2. Assignment table

### A. Author portal

| # | Requirement (from the PDF) | Status | Evidence | Notes |
| --- | --- | --- | --- | --- |
| A1 | Email and password login. Each author sees only their own data. | Met | Author sign-in: `apps/host-demo/src/session.ts`, `apps/host-demo/src/tokens.ts`, `apps/api/src/modules/auth/host-login.ts`. Staff sign-in: `apps/api/src/modules/auth/service.ts`, `password.ts` (argon2id). Tests: `apps/host-demo/test/app.test.ts` ("refuses a wrong password or an unknown email"), `apps/api/test/rbac.int.test.ts` ("author isolation": 404 on another author's ticket and book), `apps/api/test/host-sign-in.int.test.ts`. | Authors log in on the BookLeaf dashboard, which then hands them to support with a signed 5-minute single-use token. There is no separate author login page in the support app. |
| A2 | "My Books" page with title, ISBN, genre, publication date, status, MRP, copies sold, royalty earned, royalty paid, royalty pending. | Met | Page: `apps/host-web/src/pages/DashboardPage.tsx`, `apps/host-web/src/components/BookCard.tsx`. Data: `apps/host-demo/src/dashboard/build.ts`, `apps/api/src/modules/books/routes.ts`. Tests: `apps/host-demo/test/dashboard.test.ts` ("keeps all ten book fields"), `apps/host-demo/test/app.test.ts` ("sends the ten book fields BookLeaf shows authors"), `apps/api/test/host-sign-in.int.test.ts` ("GET /books"), `apps/api/test/rbac.int.test.ts` (own books only). | The tests check the data and the API. The page itself has no component test; it was seen only in the real-browser run (`docs/qa/browser-journeys.md`, journey 1). |
| A3 | "Submit a Support Query" form: book dropdown (or "General / Account Level"), subject, description, optional attachment (UI only). | Met | Form: `apps/web/src/components/organisms/TicketForm.tsx` (option "General / Account level"), `apps/web/src/components/molecules/AttachmentPicker.tsx`, `apps/web/src/pages/author/NewTicketPage.tsx`. API: `apps/api/src/modules/tickets/create.ts`. Tests: `apps/api/test/tickets.int.test.ts` ("accepts a General / Account level ticket with no book", "validates fields with field paths (422)", "strips HTML and counts length after cleaning"), `apps/api/test/rbac.int.test.ts` ("refuses a ticket about another author's book (404)"). | Attachments are UI only, as the assignment allows (README, "Assumptions"). The form component has no UI test. |
| A4 | "My Tickets" page: status (Open, In Progress, Resolved, Closed), the original query, and admin responses. | Met | `apps/web/src/pages/author/TicketsPage.tsx`, `TicketDetailPage.tsx`, `apps/api/src/modules/tickets/requester-view.ts`. Tests: `apps/api/test/author-tickets.int.test.ts` ("the requester view of a ticket"), `apps/api/test/replies.int.test.ts` ("sends a grounded reply: author sees it, first response is recorded, status moves to In Progress"), `apps/api/test/rbac.int.test.ts` ("never shows internal notes or AI fields to the author"), `apps/web/src/lib/ticketFilters.test.ts`. | Seen working in a real browser: the author's widget showed the staff reply and "Needs your reply" (`docs/qa/browser-journeys.md`, journey 2). |
| A5 | Tickets update in real time or near-real time: when an admin replies, the author sees it without refreshing. | Partly | Server: `apps/api/src/modules/events/routes.ts` (Server-Sent Events). Browser: `apps/web/src/lib/liveConnection.ts` (SSE, falls back to polling every 15 s after 3 failures). Test: `apps/api/test/tenant-isolation.int.test.ts` ("never receives BookLeaf's ticket events on its live stream") checks who may receive an event. | No automated test opens `/events` and receives a real event, and `liveConnection.ts` has no test. The journeys doc shows the reply appearing in the widget, but does not say whether the page was refreshed first. So live delivery itself is not proven by a test. |

### B. Admin portal

| # | Requirement (from the PDF) | Status | Evidence | Notes |
| --- | --- | --- | --- | --- |
| B1 | Ticket queue across all authors, filterable by status, category, priority and date. The most urgent and oldest unresolved tickets are easy to spot. | Met | Filters: `packages/shared/src/schemas/tickets.ts` (`TicketListQuerySchema`: status, category, priority, assignee, from, to, search), `apps/api/src/modules/tickets/repository.ts` (`listFilter`, `URGENCY_ORDER`: unresolved first, then priority, then SLA deadline, then oldest). Page: `apps/web/src/pages/admin/QueuePage.tsx`. Tests: `apps/api/test/tickets.int.test.ts` ("rejects limits above 200 and filters by status", "paginates with a cursor"). Tests: `apps/api/test/queue.int.test.ts`. | Category, priority, assignee and date filters, urgency ordering and reopening a closed ticket are covered by `apps/api/test/queue.int.test.ts` (commit `ea2a62d`; a mutation check flipping the priority order made it fail). The filter row was also checked in a real browser; one clipped date field was fixed (`1346b47`). |
| B2 | AI auto-classification into six categories: Royalty & Payments, ISBN & Metadata Issues, Printing & Quality, Distribution & Availability, Book Status & Production Updates, General Inquiry. Admin can override. | Met | `apps/api/src/ai/triage/service.ts`, `apps/api/src/ai/jobs/handlers/triage.ts`, `packages/shared/src/enums.ts` (six `TICKET_CATEGORIES`). Tests: `apps/api/test/worker.int.test.ts` ("triage sets category and priority from AI, queues a draft...", "never overwrites admin-set category or priority on a later AI triage"), `apps/api/src/ai/triage/triage.test.ts`. Eval: `docs/eval-results.md`. | Live triage eval (46 cases, `claude-haiku-5-5`): category 98% (45/46); keyword fallback without AI 87% (40/46). The set was written by the developer, not independent (the eval doc says so). |
| B3 | AI priority score (Critical / High / Medium / Low) from the content. Admin can override. | Met | `apps/api/src/ai/triage/rules.ts` (rules set a minimum priority, for example ISBN errors are at least High), `service.ts`. Tests: `apps/api/src/ai/triage/triage.test.ts` ("raises ISBN errors, overdue royalties, long-unpaid and legal threats to at least HIGH", "applies the rules floor on top of the model..."), `apps/api/test/worker.int.test.ts` (admin override kept), `apps/api/test/tickets.int.test.ts` ("records an audit event for each admin change"). | Eval: priority within the accepted levels 46/46 for AI, 40/46 for the keyword fallback. Same caveat: developer-written set. |
| B4 | AI-drafted reply from the query and the BookLeaf Knowledge Base, shown when the admin opens a ticket. Admin edits it before sending. The sent reply shows on the author's ticket. | Met | `apps/api/src/ai/drafting/service.ts`, `apps/api/src/ai/prompts/draft.v1.ts`, `apps/api/src/modules/messages/service.ts`, `apps/web/src/pages/admin/TicketWorkspacePage.tsx`. Tests: `apps/api/test/worker.int.test.ts` ("...the draft is stored with checks", "opening a ticket or its draft never calls the AI"), `apps/api/src/ai/drafting/drafting.test.ts`, `apps/api/test/replies.int.test.ts` (send, block, override, author sees reply), `apps/web/src/lib/draftEditor.test.ts`. | Draft quality, measured live (`docs/qa/draft-eval.md`, `claude-sonnet-5-5`, 24 cases): 10 of 24 pass the safety checker first time; 11 of 24 still contain a "[CONFIRM: ...]" placeholder; 5 of 24 contain an unsupported figure or claim. A blocked draft needs a human edit before sending. That is the safety net working, but it means many drafts need editing. Before the prompt fix the same cases scored 4 of 24 (commit `b82ac20`). |
| B5 | Ticket management: update status, add internal notes (hidden from the author), assign to self. | Met | `apps/api/src/modules/tickets/update.ts` (status, assign to self or unassign only), `status-machine.ts`, `apps/api/src/modules/messages/service.ts` (internal notes). Tests: `apps/api/test/tickets.int.test.ts` ("assigns to self, then rejects a stale version (409)", "refuses assigning a ticket to another admin (422)", "refuses an invalid status transition"), `apps/api/test/replies.int.test.ts` ("internal notes skip the checker and stay hidden from the author"), `apps/api/test/rbac.int.test.ts` (notes never shown to the author). | The status rules are in `docs/architecture.md` section 10. CLOSED can be reopened to OPEN (audit finding F-14, doc now matches the code). |

### C. API layer

| # | Requirement (from the PDF) | Status | Evidence | Notes |
| --- | --- | --- | --- | --- |
| C1 | Properly structured REST endpoints with consistent naming. | Met | 70 routes under `/api/v1`, listed in `docs/qa/baseline.md` section 3. Route files: `apps/api/src/modules/*/routes.ts`. Test: `apps/api/test/security.int.test.ts` ("errors are RFC 7807 problem+json without stack traces"). | No test asserts the naming itself. It was checked by reading the route inventory. |
| C2 | Authentication middleware protecting all routes. | Met | `apps/api/src/platform/http/auth-guard.ts` (default deny: every `/api/v1` route needs the session cookie unless marked public). Tests: `apps/api/test/rbac.int.test.ts` ("rejects requests without a session (401) and with a forged cookie (401)"), `apps/api/test/security.int.test.ts` ("is httpOnly and SameSite=Lax; logout clears it"). | Server API routes use a workspace API key instead of a cookie (see "Beyond the assignment"). |
| C3 | Role-based access: authors only their own data, admins everything. | Met | `auth-guard.ts` (`config.roles`), `apps/api/src/modules/tickets/repository.ts` (`ownership()`). Tests: `apps/api/test/rbac.int.test.ts` ("returns 404 when another author reads or writes a ticket", "forbids authors from admin routes (403)", "forbids admins from raising tickets as an author (403)", "lets admins see every author's ticket with AI fields"). | |
| C4 | Input validation and meaningful error responses, not generic 500s. | Met | Zod schemas in `packages/shared/src/schemas/*`, error classes in `apps/api/src/platform/errors.ts`. Tests: `apps/api/test/tickets.int.test.ts` ("validates fields with field paths (422)", "rejects non-JSON bodies (415)", "rejects an empty update (422) and an unknown ticket (404)"), `apps/api/test/ticket-drafts.int.test.ts` (min and max lengths), `apps/api/test/security.int.test.ts`. | Errors use RFC 7807 with a stable `code`. |
| C5 | API documentation: Swagger/OpenAPI, Postman, or a README section for every endpoint. | Met | OpenAPI generated from the route schemas and served at `/api/docs` (`apps/api/src/app.ts`). Test: `apps/api/test/security.int.test.ts` fetches `/api/docs/json`. README section "API". | The README API table is out of date: it does not list the `/signup`, `/workspace/*`, webhook and `/server/*` routes. The live Swagger page is complete. |

### D. AI integration

| # | Requirement (from the PDF) | Status | Evidence | Notes |
| --- | --- | --- | --- | --- |
| D1 | Prompt engineering: well structured, uses the Knowledge Base, sounds like a real BookLeaf support person. | Met | `apps/api/src/ai/prompts/draft.v1.ts` (tone rules, versioned `draft.v1.1`), `kb.ts` (Knowledge Base by category), `examples.ts` (the PDF's sample queries as guidance), `untrusted.ts` (author text is fenced). Tests: `apps/api/src/ai/prompts/draft-rules.test.ts`, `untrusted.test.ts`, `apps/api/src/ai/drafting/drafting.test.ts`. | Tone quality has not been scored by a person. The only measurement is the checker-based draft eval above. |
| D2 | API keys in environment variables, never hardcoded or sent to the frontend. | Met | `apps/api/src/config/*`, `apps/api/src/ai/providers/registry.ts` (client built at startup from env). Tests: `apps/api/test/security.int.test.ts` ("no response body or header contains the configured key"), `apps/api/src/config/config.test.ts`. | Workspace-supplied keys are stored encrypted and shown only by their last 4 characters (`apps/api/test/provider-keys.int.test.ts`). |
| D3 | Graceful degradation when the AI API is down or rate-limited: tickets still created, admins can write replies manually. | Met | `apps/api/src/ai/jobs/worker.ts` (retries with backoff, then rules fallback), `apps/api/src/ai/triage/fallback-classifier.ts`, `apps/api/src/ai/drafting/templates.ts`. Tests: `apps/api/test/worker.int.test.ts` ("retries a transient error with backoff, then falls back to rules and a template draft", "falls back immediately on an authentication error", "outage switch: tickets are still created, AI is not called, fallback applies"), `apps/api/test/chat.int.test.ts` ("degrades to an 'unavailable' answer with a ticket offer when the AI is down"). | Seen in the real browser with no AI key set: the template draft showed "AI was unavailable" and a reply could still be sent (`docs/qa/browser-journeys.md`, journey 2). |
| D4 | Cost awareness: not sending the whole ticket history and Knowledge Base on every call. | Met | Only the ticket's category section of the Knowledge Base is sent; earlier messages are cut short (`apps/api/src/ai/prompts/draft.v1.ts`); the fixed prompt part is cached (`apps/api/src/ai/providers/anthropic/provider.ts`, `cache_control`); every call's tokens are stored (`apps/api/src/ai/jobs/runs.ts`); opening a ticket makes no AI call; common chat questions are answered from records with no AI call. Tests: `apps/api/src/ai/drafting/drafting.test.ts` ("sends only this category's KB section"), `apps/api/test/worker.int.test.ts` ("opening a ticket or its draft never calls the AI"), `apps/api/test/chat.int.test.ts` ("answers common questions instantly from records, without calling the AI"). | Measured: triage costs about $0.08 per 1,000 tickets (`docs/eval-results.md`); drafts cost about $10.38 per 1,000 (`docs/qa/draft-eval.md`). Ticket creation is capped at 30 per author per hour (commit `c01353d`, `apps/api/test/ticket-rate-limit.int.test.ts`). |
| D5 | Model choice: OpenAI, Anthropic or other; justify briefly in the documentation. | Partly | `docs/write-up.md` ("Two models": a fast model for triage, a stronger one for the reply; both switchable). `README.md` section "How the AI works" names `claude-haiku-5-5` and `claude-sonnet-5-5`. | The two-model split is explained. No document says why Anthropic was chosen over OpenAI. |

### Knowledge Base and sample data

| # | Requirement (from the PDF) | Status | Evidence | Notes |
| --- | --- | --- | --- | --- |
| K1 | AI replies reflect BookLeaf's real policies (80/20 split, quarterly royalties paid within 45 days, ₹1,000 threshold, ISBN, printing, distribution, production stages). | Met | `apps/api/src/ai/prompts/kb.ts`, `apps/host-demo/src/facts/*` (royalty, payout date, threshold and production facts calculated by code), `apps/api/src/ai/checker/*` (blocks any figure not backed by a fact). Tests: `apps/host-demo/src/facts/facts.test.ts` ("computes quarter ends and the 45-day payout deadline", "Kavita (BK016 ₹850) is below the threshold and rolls over"), `apps/api/src/ai/drafting/drafting.test.ts` ("Kavita: explains the ₹850 roll-over below the ₹1,000 threshold"), `apps/api/src/ai/checker/check.test.ts`. | |
| K2 | Tone guidelines: empathetic, acknowledge first, specific numbers, own BookLeaf's mistakes, clear timelines, always end with a next step. Sample queries calibrate the output. | Met | Tone rules in `apps/api/src/ai/prompts/draft.v1.ts`; PDF samples in `apps/api/src/ai/prompts/examples.ts`; checker rejects guarantees and refund promises. Tests: `apps/api/src/ai/prompts/draft-rules.test.ts`, `apps/api/src/ai/checker/check.test.ts` ("blocks internal leaks without override and guarantees with override"). | Same note as D1: no human tone score. The 7 PDF sample queries are the first 7 cases of the evals (`brief-01` to `brief-07`). In the draft eval 3 of the 7 pass the checker first time (`docs/qa/draft-eval.md`). |
| S0 | Seed the app with the provided dataset (10 authors, 18 books). It must work out of the box with these exact records. | Met | `apps/host-demo/src/data/sample-data.json` is identical to `bookleaf_sample_data.json` (checked: same JSON, 10 authors). Seeding: `apps/api/src/seed/*`. Demo accounts in `README.md`. Tests: `apps/host-demo/src/facts/facts.test.ts` (runs on the seed data). | Demo logins (README): author `priya.sharma@email.com`, staff `admin@bookleaf.demo`; both use documented local demo passwords. |
| S1 | Handle the dataset's edge cases: books in production, zero payouts, pending payouts, empty states. | Met | `apps/host-demo/src/facts/*`, `apps/host-web/src/components/StageTrack.tsx`, `apps/host-web/src/components/States.tsx`. Tests: `apps/host-demo/src/facts/facts.test.ts` ("in-production books report unknown MRP and publication date, never zero", "no published, regularly paid book is flagged overdue"), `apps/host-demo/test/dashboard.test.ts` ("places a book in production on its stage", "flags a book with no payout after its deadline as possibly overdue"). | A new workspace shows "No tickets yet" (`docs/qa/browser-journeys.md`, journey 4). |

### Technology, delivery and documents

| # | Requirement (from the PDF) | Status | Evidence | Notes |
| --- | --- | --- | --- | --- |
| T1 | Deploy the application to a live URL, pre-seeded, with test logins in the README. | Not met | `Dockerfile` exists. `README.md` says "Not deployed yet." | There is no live URL. Blocked on the owner's hosting account. Test logins are in the README for local use only. |
| T2 | The Dockerfile builds and the container starts and migrates the database. | Met | `Dockerfile`, `README.md` section "Deployment". | Built locally on 2026-10-28 (`docker build`, exit 0) and run against an empty throwaway database: all 10 migrations applied, `/health` reported the database OK, the app, `/admin`, `embed.js` and the API docs answered 200, and the CSP/HSTS headers were present. The production config refused to start without `HOST_API_URL` and with private connector hosts allowed, as intended. Not run on a hosted environment (see T1). |
| T3 | Source code in a private GitHub/GitLab repository with the reviewer added. | Not met | `git remote -v` prints nothing on this branch. | No remote is configured, so nothing is pushed (the baseline also records that all commits are local). |
| T4 | Clean commit history showing progression. | Met | `git log --oneline`: 116 commits on this branch, 102 since `main`, in `type(scope): message` form. Commit bodies explain each fix. | Judged from the history. A repository check or test does not apply. |
| T5 | README: local setup, architecture decisions, how the AI works (prompts, errors, cost), API docs, known limitations. | Met | `README.md` (Run locally, How the AI works, API, Known limitations), `docs/architecture.md` (21 sections), `docs/integration.md`. | The two out-of-date statements (webhooks "not built"; "26 cases, 26/26") were corrected in commit `4960a04`. |
| T6 | Write-up of at most 1 page: priorities, trade-offs, path to production. | Partly | `docs/write-up.md` has the three parts the PDF asks for. | It is 733 words, which is more than one page at normal size. Page length was not measured exactly. |

### Assignment table totals

30 rows. **Met 25. Partly 3 (A5, D5, T6). Not met 2 (T1, T3). Not verified 0.** (Updated after the Docker run and the queue tests; first pass was Met 23, Partly 4, Not met 2, Not verified 1.)

## 3. How the PDF scores the work

The PDF lists six scoring areas with weights. This is where the evidence stands for each. It is an honest self-check, not the reviewers' score.

| Area (weight) | Status | Evidence | Notes |
| --- | --- | --- | --- |
| AI Integration Quality (25%): prompt design, Knowledge Base use, response quality, classification accuracy, graceful degradation, cost | Partly | Rows B2, B3, B4, D1 to D5, K1, K2 above. Evals: `docs/eval-results.md`, `docs/qa/draft-eval.md`. | Design, fallback and cost are strong and tested. Classification scored 98% on a developer-written set. Draft quality is the weak point: 10 of 24 drafts pass the checker first time. Real chat answers were never seen in a browser (no AI key; chat is off by default, `docs/qa/browser-journeys.md` D1). |
| Architecture & Code Quality (25%) | Met | Layers and boundaries: `docs/architecture.md` sections 2 and 3. ESLint enforces file size, function size and complexity limits. Baseline (`docs/qa/baseline.md` section 2): typecheck, lint, format and build all pass; 524 tests pass. | Known weaknesses are listed in section 5 below. |
| API Design (15%) | Met | Rows C1 to C5. | README API table is behind the real routes. |
| Functionality & Completeness (15%): both portals, ticket lifecycle, real-time, edge cases | Partly | Rows A1 to A5, B1 to B5, S0, S1. Real-browser run: `docs/qa/browser-journeys.md`. | Real-time delivery is not proven by a test (A5). Queue filters are mostly untested (B1). Not deployed (T1). Chat and voice are off by default in the demo workspace. |
| Product Thinking (10%) | Not verified | Browser run `docs/qa/browser-journeys.md` (6 journeys, no P0 or P1 defects, 8 minor defects D1 to D8). | This is a judgement for the reviewers. The only evidence here is the browser run. |
| Documentation & Communication (10%) | Partly | Row T4 to T6. | The out-of-date statements are fixed (T5); the write-up is still longer than one page (T6). |

Scoring-area totals: Met 2, Partly 3, Not verified 1 (6 rows).

## 4. Beyond the assignment

None of the items below were asked for in the PDF. They are not counted in the table above.

| Extra | What it is | Evidence (code and test) | Status |
| --- | --- | --- | --- |
| Multi-tenant SaaS workspaces | Many businesses can use one service, each with its own tickets, settings and staff. | `apps/api/src/modules/workspaces/*`, `apps/api/src/modules/settings/*`. Tests: `apps/api/test/workspaces.int.test.ts` ("another workspace's admin cannot read a BookLeaf ticket (404) nor list it"), `apps/api/test/tenant-isolation.int.test.ts` (chat transcript, voice call, platform AI settings, event stream), `apps/api/test/connectors.int.test.ts` ("an acme customer's ticket is invisible to BookLeaf's staff"). | Met for tickets, chats, calls, settings and settings screens. There is no database-level row security yet (`docs/saas/PLAN.md`). The event-stream check calls the `canSee` function; it does not open a real stream. |
| Self-serve sign-up | A new business creates a workspace and its owner login. | `apps/api/src/modules/workspaces/signup.ts`, `apps/web/src/pages/workspace/SignupPage.tsx`. Tests: `apps/api/test/workspaces.int.test.ts` ("creates a workspace with its owner...", "refuses a taken slug (409)...", "refuses a weak password (422)..."). Browser: journey 4. | Met |
| Product connection per workspace | Each workspace points to its own product's customer-data endpoint; secrets are stored encrypted; internal addresses are refused. | `apps/api/src/modules/connectors/*`, `apps/api/src/platform/crypto/envelope.ts`, `apps/api/src/platform/net/ssrf.ts`. Tests: `apps/api/test/connectors.int.test.ts`, `apps/api/src/platform/crypto/envelope.test.ts`, `apps/api/src/platform/net/ssrf.test.ts`, `apps/api/src/host/http/records.test.ts`. | Met |
| Bring your own AI and voice keys | A workspace saves its own keys (encrypted, last 4 characters shown). With its own key it never falls back to the platform's key. | `apps/api/src/modules/provider-keys/*`. Tests: `apps/api/test/provider-keys.int.test.ts` (6 tests, including "never falls back to the platform's key when the workspace's key cannot be read"). | Met |
| Server API with workspace API keys | A workspace's own server reads its tickets with a `blsk_` key (read-only, scope `tickets:read`). | `apps/api/src/modules/server-api/*`, `apps/api/src/modules/workspaces/api-keys.ts`. Tests: `apps/api/test/server-api.int.test.ts` (list, one ticket, cross-workspace isolation, 401/403, validation), `apps/api/test/settings.int.test.ts` ("creates a key shown once... and revokes it"). | Met. Only `tickets:read` is available over HTTP. The `customers:read` and `tickets:write` scopes can be created but no route uses them. |
| Signed webhooks | Ticket created, replied and status-changed events are sent to the workspace's URL, signed, with retries. | `apps/api/src/modules/webhooks/*`. Tests: `apps/api/src/modules/webhooks/signing.test.ts`, `apps/api/test/webhooks.int.test.ts` (signature, payload, retry with backoff, give up, no internal notes). | Met |
| Embeddable widget | One script puts the whole author support app inside the host page; the host hands the author over with a signed token. | `apps/web/public/embed.js`, `apps/api/src/modules/auth/host-token.ts`, `apps/api/src/platform/http/embed.ts`. Tests: `apps/api/test/embed.int.test.ts` (8 tests on framing, cookie and origin), `apps/api/test/host-sign-in.int.test.ts`. Browser: journey 1. | Met. `embed.js` (433 lines of plain JavaScript) has no unit tests. |
| Assistant chat | Authors ask questions and get answers from their real records; the assistant can fill a ticket draft and send it after asking. | `apps/api/src/modules/chat/*`, `apps/api/src/ai/chat/*`, `apps/api/src/modules/ticket-drafts/*`. Tests: `apps/api/test/chat.int.test.ts` (20+ tests), `apps/api/test/ticket-drafts.int.test.ts`. | Met with a fake AI. Real chat answers were never seen in a browser. |
| Voice calls inside the chat | A call started from a chat joins the same conversation and shares its ticket draft; turn limits apply. | `apps/api/src/modules/voice/*`, `apps/api/src/voice/call/*`. Tests: `apps/api/test/voice.int.test.ts`, `apps/api/test/call-in-chat.int.test.ts`, `apps/api/src/voice/call/*.test.ts`. | **Not verified with a real call.** Every test uses a fake voice provider. Nobody has made a live call with a real microphone and the real voice service. |
| Hinglish voice persona | A warm Hindi-English voice that mirrors the author's language and still says figures in exact English words. | `apps/api/src/voice/call/persona.ts`, `persona-text.ts`; `docs/architecture.md` section 19. Tests: `apps/api/src/voice/call/persona.test.ts` (5 tests). | The wording of the instructions is tested. How it sounds in a real call is not verified. |
| Spoken-figure check with number words | Amounts said in words ("three thousand five hundred seventy rupees", "do hazaar") are checked against the facts. | `apps/api/src/ai/checker/number-words.ts`. Test: `apps/api/src/ai/checker/number-words.test.ts`. | Met |
| Dark mode and workspace brand | Light and dark themes; the widget follows the host's theme; each workspace can set its own brand colour and name (BookLeaf keeps coral). | `apps/web/src/styles/tokens.css`, `apps/web/src/lib/hostTheme.ts`, `apps/web/src/lib/brand.ts`. Tests: `apps/web/src/lib/hostTheme.test.ts`, `apps/web/src/lib/brand.test.ts`, `apps/api/test/settings.int.test.ts` ("shows customers the workspace's own brand; BookLeaf keeps its name and coral"). Browser: journey 5. | Met. The widget's reply box in dark mode and the keyboard focus ring were not seen in the browser run. |
| Per-ticket extras | Checker on every reply with a reasoned override and audit trail, idempotency keys, optimistic locking (version conflicts), SLA targets, history of chats and calls. | `apps/api/src/modules/messages/service.ts`, `apps/api/src/modules/tickets/sla.ts`, `apps/api/src/modules/conversations/*`. Tests: `apps/api/test/replies.int.test.ts`, `apps/api/test/conversations.int.test.ts`, `apps/api/test/tickets.int.test.ts`. | Met |

## 5. Audit findings (from `docs/qa/fable-review.md`)

Fixed on this branch, each with a regression test:

| Finding | Fix commit | Test |
| --- | --- | --- |
| F-01, F-02 admin could read another workspace's chat and call | `b16453c` | `apps/api/test/tenant-isolation.int.test.ts` |
| F-03, F-17 any workspace admin could change platform AI settings | `b16453c` | `apps/api/test/tenant-isolation.int.test.ts` |
| F-04 events went to every workspace's admins | `b16453c` | `apps/api/test/tenant-isolation.int.test.ts` (checks `canSee`, not a live stream) |
| F-05 connector address checked only at save time | `bf9feb1` | `apps/api/src/host/http/records.test.ts`, `apps/api/src/platform/net/ssrf.test.ts` |
| F-06 API keys authenticated nothing | `f5b887d` | `apps/api/test/server-api.int.test.ts` |
| F-07 spoken figures in words were not checked | `cf53031` | `apps/api/src/ai/checker/number-words.test.ts` |
| F-08 fallback drafts hardcoded BookLeaf figures | `cf53031` | `apps/api/src/ai/drafting/drafting.test.ts` |
| F-09 customer deleted at the host crashed chat | `bf9feb1` | `apps/api/src/host/facts.test.ts` |
| F-10 chat limits used the env value | `bf9feb1` | `apps/api/test/chat.int.test.ts` ("follows the workspace's own per-minute limit...") |
| F-11 typing during a call passed the turn limit | `bf9feb1` | `apps/api/test/call-in-chat.int.test.ts` ("refuses typed messages in the chat while its call is live (409)...") |
| F-15 override audit written outside the reply transaction | `6ecfc5a` | `apps/api/test/replies.int.test.ts` |
| F-16 author text could close its prompt fence | `c8c2403` | `apps/api/src/ai/prompts/untrusted.test.ts` |
| F-20 slash dates read day-first | `fa1b0d4` | `apps/api/src/ai/checker/check.test.ts` |
| Ticket creation had no rate limit (QA baseline) | `c01353d` | `apps/api/test/ticket-rate-limit.int.test.ts` |
| Drafts over-used "[CONFIRM: ...]" placeholders | `b82ac20` | `apps/api/src/ai/prompts/draft-rules.test.ts`; live draft eval 4 to 10 of 24 passing |
| F-14 doc said CLOSED is final; code allows CLOSED to OPEN | this change (doc only) | Documented in `docs/architecture.md` section 10; no code change |

Deferred, not fixed:

- **F-12** Email login searches all workspaces, and sessions cannot be revoked (a stolen cookie works until it expires, up to 72 hours).
- **F-13** Ticket numbers are one global counter, so a workspace can infer other workspaces' ticket volume.
- **F-18** The `/embed` page may be framed by the union of every workspace's allowed origins.
- **F-19** Some state lives in one process's memory. Now documented in `docs/architecture.md` section 21.

## 6. Not verified by anyone

- A live voice call with a real microphone and the real voice service (only a fake provider is tested).
- Deployment to a hosted environment (the Docker image itself was built and run locally; see T2).
- Real chat answers and chat-made ticket drafts in a browser (no AI key was set; chat is off by default).
- Real AI draft quality as a person would grade it, and the widget reply box in dark mode.
- Any live Server-Sent Events delivery end to end (see A5).
