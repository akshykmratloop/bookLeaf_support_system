# Architecture — BookLeaf Author Support Portal

> Planned design (not yet implemented). Mermaid diagrams render on GitHub and in VS Code's Markdown
> preview. Reasons and trade-offs: [`project/PLAN.md`](project/PLAN.md).

---

## 1. System context

```mermaid
flowchart LR
    author["Author<br/>(browser)"]
    admin["Ops admin<br/>(browser)"]
    portal["BookLeaf Support Portal<br/>(one Railway service)"]
    db[("PostgreSQL<br/>data + ai_jobs")]
    llm["Anthropic API<br/>(OpenAI: P2)"]
    env[/"Env vars<br/>ANTHROPIC_API_KEY, DATABASE_URL,<br/>JWT_SECRET, APP_ORIGIN, DATA_AS_OF"/]

    author -- "HTTPS: REST + SSE (same origin)" --> portal
    admin -- "HTTPS: REST + SSE (same origin)" --> portal
    portal -- Prisma --> db
    portal -- "server-side only" --> llm
    env -. "read + validated at startup" .-> portal
```

The browser never talks to an AI provider and never receives any part of an API key.

---

## 2. Runtime parts (one Node process)

```mermaid
flowchart TB
    subgraph service["Railway service"]
        spa["Static SPA<br/>React + Vite build"]
        api["Fastify API<br/>/api/v1/* · /api/docs"]
        sse["SSE hub<br/>/api/v1/events"]
        worker["AI worker<br/>polls ai_jobs (SKIP LOCKED + lease)"]
        bus["EventBus (in-memory)"]
    end
    db[("PostgreSQL")]
    llm["LLM provider"]

    api -- "ticket + ai_job in ONE transaction" --> db
    worker -- "claim / complete jobs" --> db
    worker --> llm
    api -- publish --> bus
    worker -- publish --> bus
    bus --> sse
    api -- serves --> spa
```

The worker only depends on the DB and the `EventBus` interface, so it can move to its own process
later. More than one instance would switch `EventBus` to Postgres `LISTEN/NOTIFY` (deferred).

---

## 3. Layers inside the API

```mermaid
flowchart TB
    routes["routes.ts<br/>validate (Zod) · call service · response schema"]
    services["service.ts<br/>business rules · status machine · SLA"]
    repos["repository.ts<br/>only Prisma access · role scoping"]
    prisma[("Prisma → Postgres")]
    clock["platform/clock.ts<br/>now() · dataAsOf()"]

    subgraph ai["ai/"]
        facts["facts/<br/>pure functions + evidence"]
        triage["triage/<br/>AI → rules floor → fallback"]
        drafting["drafting/<br/>AI draft · templates"]
        checker["checker/<br/>claims + independent scan"]
        port["providers/types.ts<br/>LlmProvider interface"]
        registry["providers/registry.ts"]
        jobs["jobs/<br/>worker · handlers"]
    end

    subgraph vendors["vendor adapters (only place SDKs are imported)"]
        anth["anthropic/"]
        fake["fake/ (tests)"]
        oai["openai/ (P2)"]
    end

    routes --> services --> repos --> prisma
    services --> checker
    jobs --> triage
    jobs --> drafting
    triage --> facts
    drafting --> facts
    drafting --> checker
    facts --> clock
    services --> clock
    triage --> port
    drafting --> port
    registry --> port
    anth -. implements .-> port
    fake -. implements .-> port
    oai -. implements .-> port
```

ESLint rules: routes never import Prisma; services never import Fastify; vendor SDKs only in their
adapter folder; no `Date` construction outside `clock.ts`. Wiring happens once in `container.ts`.

---

## 4. Ticket lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor A as Author
    participant API as Fastify API
    participant DB as Postgres
    participant W as AI worker
    participant LLM as LLM provider
    participant BUS as EventBus / SSE
    actor AD as Admin

    A->>API: POST /tickets + Idempotency-Key
    API->>DB: BEGIN · ticket (OPEN) · SYSTEM ack · ai_job(TRIAGE, gen 1) · COMMIT
    API-->>A: 201 Created (does not wait for AI)
    API->>BUS: ticket.created (admins)

    W->>DB: claim job (RUNNING, lease 90 s, attempt+1)
    W->>W: facts pack with evidence (clock.dataAsOf)
    W->>LLM: triage (structured)
    LLM-->>W: category · priority · reasons
    W->>W: Zod validate · rules floor · SLA from clock.now
    W->>DB: BEGIN · save triage (skip ADMIN-set fields) · job SUCCEEDED · ai_job(DRAFT) · COMMIT
    W->>DB: claim DRAFT job
    W->>LLM: draft (tone + category KB slice + examples + facts)
    LLM-->>W: body · claims · placeholders
    W->>W: checker
    W->>DB: save draft (generation) · job SUCCEEDED · ai_runs
    W->>BUS: ticket.updated (admins)

    AD->>API: GET /tickets/:id, GET /tickets/:id/draft
    AD->>API: POST /tickets/:id/messages (edited reply + Idempotency-Key)
    API->>API: checker on final text · placeholders → 422 · figure BLOCK → 422 unless override reason
    API->>DB: REPLY · OPEN → IN_PROGRESS · first_response_at
    API->>BUS: ticket.replied (this author + admins)
    BUS-->>A: hint → client refetches ticket via REST
```

---

## 5. AI job states, retries and recovery

```mermaid
stateDiagram-v2
    [*] --> QUEUED: inserted in the ticket's transaction
    QUEUED --> RUNNING: worker claims (lease 90 s)
    RUNNING --> SUCCEEDED: valid result saved
    RUNNING --> QUEUED: transient error, attempts left (backoff 5 s / 30 s / 120 s)
    RUNNING --> RUNNING: lease expired → reclaimed (crash or restart)
    RUNNING --> FALLBACK: attempts = 3, or auth / config error, or outage switch
    SUCCEEDED --> [*]
    FALLBACK --> [*]: rule triage or template draft applied
```

Every exit leaves the ticket with a category, a priority, an SLA and a usable draft. "Retry AI" or
"Regenerate" creates a new job with `generation + 1`; stale generations never overwrite newer results.

---

## 6. AI pipeline per job

```mermaid
flowchart TD
    start(["claimed job"]) --> facts["Facts engine<br/>book + author royalty · production · distribution<br/>each fact has a source"]
    facts --> avail{"Provider configured<br/>and outage switch off?"}
    avail -- no --> fb
    avail -- yes --> kind{"job kind"}
    kind -- TRIAGE --> t["Triage call<br/>(no PII, no amounts)"]
    kind -- DRAFT --> d["Draft call<br/>category KB slice + facts + untrusted author text"]
    t --> tv{"valid schema?"}
    tv -- yes --> floor["Rules floor<br/>ISBN · possibly overdue · legal"]
    tv -- "no / error" --> retry{"retryable and<br/>attempts left?"}
    d --> dv{"valid schema?"}
    dv -- yes --> chk["Checker<br/>claims ↔ evidence · independent scan · placeholders"]
    dv -- "no / error" --> retry
    retry -- yes --> requeue(["QUEUED with backoff"])
    retry -- no --> fb["Fallback<br/>keyword triage or category template"]
    fb --> floor
    fb --> chk
    floor --> save(["save · publish ticket.updated"])
    chk --> save
```

---

## 7. AI configuration

```mermaid
flowchart LR
    env[/"ANTHROPIC_API_KEY (env)"/] --> registry["Provider registry<br/>builds client at startup"]
    settings[("ai_settings row<br/>provider + model per task<br/>outage switch · version")] --> cache["settings cache<br/>invalidated on save"]
    ui["Admin → AI Settings<br/>shows: configured yes/no, last test<br/>edits: model (allowlist), outage switch"] -- "PUT /admin/ai/settings" --> settings
    ui -- "POST /admin/ai/test" --> registry
    cache --> jobs["AI worker"]
    registry --> jobs
```

Keys come only from env. The UI can choose among providers whose key is present and models from a
server-side allowlist; it can never read or write a key.

---

## 8. Realtime and reconnection

```mermaid
sequenceDiagram
    participant C as Browser (EventSource)
    participant S as SSE hub
    participant R as REST API

    C->>S: GET /events (cookie)
    S-->>C: retry: 3000 · heartbeat every 25 s
    S-->>C: {type: ticket.replied, ticketId}
    C->>R: refetch ticket (permissions re-checked)
    Note over C,S: connection drops
    C->>S: auto-reconnect after 3 s
    C->>R: on open: refetch all active ticket queries (catch-up)
    Note over C: after 3 failed reconnects → poll every 15 s, retry SSE every 60 s
    S-->>C: session-expired → client redirects to login
```

Events carry only `{ type, ticketId }`, so a missed or duplicated event cannot lose or leak data.

---

## 9. Data model

```mermaid
erDiagram
    USERS ||--o| AUTHORS : "author profile"
    AUTHORS ||--o{ BOOKS : writes
    AUTHORS ||--o{ TICKETS : raises
    BOOKS |o--o{ TICKETS : "about (null = general)"
    USERS |o--o{ TICKETS : "assigned to"
    TICKETS ||--o{ TICKET_MESSAGES : has
    TICKETS ||--o{ AI_JOBS : queues
    TICKETS ||--o{ AI_DRAFTS : has
    TICKETS |o--o{ AI_RUNS : logs
    USERS |o--o{ AUDIT_EVENTS : acted

    USERS {
        uuid id PK
        text email UK
        text password_hash
        enum role
    }
    AUTHORS {
        uuid id PK
        text external_id UK
        uuid user_id FK
    }
    BOOKS {
        uuid id PK
        text external_id UK
        uuid author_id FK
        enum stage
        int mrp_paise "nullable"
        int royalty_pending_paise
        date last_payout_date "nullable"
        text_array available_on
    }
    TICKETS {
        uuid id PK
        text number UK
        uuid author_id FK
        uuid book_id FK "nullable"
        enum status
        enum category "nullable until triaged"
        enum category_source
        enum priority
        enum priority_source
        enum ai_state
        uuid assignee_id FK "nullable"
        timestamptz sla_due_at
        text client_request_id "unique per author"
        int version
    }
    TICKET_MESSAGES {
        uuid id PK
        uuid ticket_id FK
        enum kind
        text body
        text client_request_id "unique per ticket"
    }
    AI_JOBS {
        uuid id PK
        uuid ticket_id FK
        enum kind
        int generation
        enum status
        int attempts
        timestamptz run_after
        timestamptz lease_expires_at
        text last_error_code
    }
    AI_DRAFTS {
        uuid id PK
        uuid ticket_id FK
        int generation
        enum source
        text body
        jsonb facts_snapshot
        jsonb claims
        jsonb check_results
    }
    AI_RUNS {
        uuid id PK
        enum task
        text provider
        text model
        int input_tokens
        int output_tokens
        int latency_ms
        enum outcome
    }
    AI_SETTINGS {
        int id PK
        text triage_provider
        text triage_model
        text draft_provider
        text draft_model
        bool simulate_outage
        int version
    }
    AUDIT_EVENTS {
        uuid id PK
        text entity_type
        text action
        jsonb before
        jsonb after
        text reason
    }
```

Indexes: `tickets (status, priority, sla_due_at)` for the queue; `tickets (author_id, created_at)`;
`ticket_messages (ticket_id, created_at)`; `ai_jobs (status, run_after)`; `books (author_id)`.
Unique: `ai_jobs (ticket_id, kind, generation)`, `tickets (author_id, client_request_id)`,
`ticket_messages (ticket_id, client_request_id)`.

---

## 10. Ticket status machine

```mermaid
stateDiagram-v2
    [*] --> OPEN: author creates
    OPEN --> IN_PROGRESS: admin replies or sets
    IN_PROGRESS --> RESOLVED: admin resolves
    RESOLVED --> IN_PROGRESS: author writes again
    RESOLVED --> CLOSED: admin closes
    OPEN --> CLOSED: admin closes (duplicate / spam)
    CLOSED --> [*]
```

Any other transition → `409 INVALID_STATUS_TRANSITION`.

---

## 11. Access control

| Resource | Author | Admin |
| --- | --- | --- |
| Own books, tickets, public messages | read · create tickets and messages | read · write |
| Another author's books or tickets | **404** (existence not revealed) | read · write |
| Internal notes, drafts, evidence, AI status, category, priority, assignee | never in author responses or author SSE events | read · write |
| AI settings and status | 403 | read · write (no key access, ever) |

Role and author id come only from the verified session. Role scoping lives in repositories; response
shapes are separate Zod schemas per role, so undeclared fields are stripped.

CSRF: SameSite=Lax cookie + Origin must equal `APP_ORIGIN` on state-changing requests + JSON-only
bodies. No CORS headers.

---

## 12. Shared business services (all channels)

Phase 1 builds these services for admin drafting. Phases 2 and 3 add new **channels** on top; they
add no new data paths.

```mermaid
flowchart TB
    subgraph channels["Channels"]
        admin["Admin drafting<br/>(Phase 1)"]
        chat["Author chat<br/>(Phase 2, FEATURE_CHAT)"]
        voice["Voice gateway<br/>(Phase 3, FEATURE_VOICE)"]
    end

    subgraph shared["Shared business services (author-scoped)"]
        facts["AuthorFactsService<br/>facts + evidence"]
        policy["PolicyService<br/>KB sections"]
        tickets["TicketService<br/>create / update"]
        checker["Checker"]
    end

    repos["Repositories<br/>(role scoping)"]
    db[("Postgres")]

    admin --> facts
    admin --> policy
    admin --> checker
    chat --> facts
    chat --> policy
    chat --> tickets
    chat --> checker
    voice --> facts
    voice --> tickets
    facts --> repos
    tickets --> repos
    repos --> db
```

Author identity always comes from the BookLeaf session. No channel accepts an author id from a
model, a browser body or a third-party platform.

---

## 13. Phase 2 — AI chat

```mermaid
sequenceDiagram
    autonumber
    actor A as Author
    participant API as Chat API
    participant CS as Chat service
    participant LLM as LLM provider
    participant T as Assistant tools
    participant CK as Checker
    participant TS as TicketService

    A->>API: POST /chat/sessions/:id/messages
    API->>CS: authorId from session
    CS->>LLM: prompt + last turns + tool schemas
    LLM-->>CS: tool call get_book_royalties(BK001)
    CS->>T: run with authorId (bookId ownership checked)
    T-->>CS: facts + evidence
    CS->>LLM: tool result
    LLM-->>CS: answer text
    CS->>CK: scan answer vs facts from this turn + KB constants
    alt passes
        CS-->>A: answer
    else blocked (after one retry)
        CS-->>A: safe reply + "raise a ticket?"
    end
    A->>API: confirm ticket proposal (Idempotency-Key)
    API->>TS: create ticket (source CHAT, chat_session_id)
    TS-->>A: ticket number; normal triage + draft follow
```

---

## 14. Phase 3 — Voice: integration boundary with Vocal

**Vocal** is a separate product (repo `Loop Methods/voice_agent`, QA at `verbi.si`). BookLeaf uses
it as an external platform, configured but not modified.

```mermaid
flowchart LR
    subgraph browser["Author's browser (BookLeaf SPA)"]
        panel["Talk to BookLeaf Support panel<br/>lazy-loads @verbisi/web SDK"]
    end

    subgraph bookleaf["BookLeaf application (this repo)"]
        gw["Voice gateway<br/>POST /api/v1/voice/gateway/v1/calls/web"]
        snap["Facts snapshot builder<br/>(AuthorFactsService)"]
        vs[("voice_sessions")]
        ts["TicketService"]
    end

    subgraph vocal["Vocal platform (existing product, unchanged)"]
        orch["call-orchestrator<br/>POST /v1/calls/web"]
        worker["voice-worker<br/>WebRTC + speech-to-speech chain"]
        agentcfg["Agent config<br/>providers.realtime + prompt"]
    end

    s2s["S2S model<br/>OpenAI Realtime / Gemini Live"]

    panel -- "1 · hop 1 (same origin, session cookie)" --> gw
    gw --> snap
    gw --> vs
    gw -- "2 · secret key + server-built variables" --> orch
    orch -- "3 · callId + session token + worker URL" --> gw
    gw -- "4 · pass-through response" --> panel
    panel -- "5 · hop 2: WebRTC media (rtc. host)" --> worker
    worker --> agentcfg
    worker <--> s2s
    panel -- "6 · after call: create ticket" --> ts
```

| Side | Owns |
| --- | --- |
| BookLeaf | Author login and identity, facts snapshot, voice gateway, `voice_sessions` audit rows, rate limits, UI states, tickets |
| Vocal | Agent definition (S2S provider, model, voice, prompt), call control, WebRTC media, the S2S model connection, call records |
| Boundary contract | One server-to-server request (`POST /v1/calls/web` with a `vak_` key and `variables`), and the SDK's media hop. Nothing else crosses |

### Call start

```mermaid
sequenceDiagram
    autonumber
    actor A as Author
    participant UI as Voice panel
    participant GW as BookLeaf voice gateway
    participant F as AuthorFactsService
    participant V as Vocal call-orchestrator
    participant W as Vocal voice-worker
    participant M as S2S model

    A->>UI: Talk to BookLeaf Support
    UI->>GW: GET /voice/status (flag, configured, reachable, hours)
    UI->>UI: mic permission
    UI->>GW: SDK start() → POST {baseUrl}/v1/calls/web (cookie)
    GW->>GW: check session + Origin; drop client variables/metadata/webhookUrl/agentId
    GW->>F: facts snapshot for this author (≤ 8 KB)
    GW->>V: POST /v1/calls/web (vak_ key, agentId from env, variables = snapshot)
    V-->>GW: callId, sessionToken, worker URL
    GW->>GW: insert voice_sessions (author, callId, snapshot hash)
    GW-->>UI: same response
    UI->>W: WebRTC offer + sessionToken
    W->>M: open S2S session (prompt rendered with snapshot)
    A->>M: "How much royalty is pending?"
    M-->>A: spoken answer from the snapshot (also shown on screen)
```

Failure handling: status check fails → panel shows "Voice support unavailable" with ticket/chat
links; `microphone-denied` → explain how to allow it; reconnecting → shown; call ends after
5 minutes (fits Vocal's 300 s session token); any error stays inside the panel's error boundary.

### Phase 3b (deferred): live tools inside the S2S call

Not possible by configuration today: Vocal's speech-to-speech chain registers only `end_call`;
HTTP tools run only on cascade flow agents. The target, if Vocal is extended:

```mermaid
flowchart LR
    m["S2S model"] -- "function call" --> w["Vocal voice-worker<br/>(HTTP tools registered in realtime_chain)"]
    w -- "HTTPS + static secret header<br/>+ per-call BookLeaf token header" --> t["BookLeaf /api/v1/voice/tools/*<br/>same assistant tools as chat"]
    t --> s["Shared business services"]
```
