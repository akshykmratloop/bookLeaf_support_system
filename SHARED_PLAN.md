# SHARED_PLAN.md — Multi-Session Coordination Brain

> Single source of truth for concurrent AI sessions and git branches in this repo.
> Protocol: read first → conflict-check → register before editing → update as you go → release on done.
> Companions: `TASKS.md` (ledger) · `PLAN.md` (architecture).

---

# Active Sessions

### 1. Core assignment build (overnight) — `main`

| Field           | Value                                  |
| --------------- | -------------------------------------- |
| **Session No.** | S213                                   |
| **Session ID**  | `d6c4131c-0851-4186-b4ce-5a0f25b3552c` |
| **Branch**      | `main`                                 |
| **Worktree**    | `/Users/aksykmr_mac/Loop Methods/experiments/bookleaf` |
| **Base commit** | (initial commit)                       |
| **Started**     | 2026-10-27                             |
| **Status**      | ✅ Core built and verified locally (07:30 IST); 🔄 Phase QA next (same session) |

**Goal:** implement the core BookLeaf Author Support Portal (PLAN.md M0–M5), then run Phase QA (TASKS.md).
Claims stay held for Phase QA; release them when QA finishes.

**CLAIMED PATHS:**

```
apps/**
packages/**
eval/**
docker-compose.yml
package.json
```

### 2. AI chat + in-house voice (admin-controlled) — `feature/chat` → `feature/voice`

| Field           | Value                                  |
| --------------- | -------------------------------------- |
| **Session No.** | S213                                   |
| **Session ID**  | `d6c4131c-0851-4186-b4ce-5a0f25b3552c` |
| **Branch**      | `feature/chat` (voice continues on `feature/voice`, branched from it) |
| **Worktree**    | `/Users/aksykmr_mac/Loop Methods/experiments/bookleaf-assistant` |
| **Base commit** | `969813a`                              |
| **Started**     | 2026-10-27                             |
| **Status**      | 🔄 In Progress                          |

**Goal:** author chat grounded in their own records, then an in-house browser voice call (raw WebSocket
to a speech-to-speech model, no vendor SDK, 5-minute cap, per-author limits). Admins switch each
feature on or off for authors. Never merged into `main` from this session.

**CLAIMED PATHS (on these branches only):**

```
apps/api/src/modules/assistant/**
apps/api/src/modules/chat/**
apps/api/src/modules/voice/**
apps/api/src/ai/chat/**
apps/api/src/voice/**
apps/api/prisma/**
apps/web/src/**
packages/shared/src/**
```

**Things another session should know:** additive migration (`assistant_settings`, `chat_*`,
`voice_sessions`, `tickets.source`); both features default to OFF.

**Progress (2026-10-27):** chat done on `feature/chat` (`d009761`); voice server + UI done on
`feature/voice` (`9c694fa`, `280a652`, `1079d82`). Full suite 165/165. Not merged, not pushed.
A live voice call still needs `OPENAI_API_KEY` in the worktree `.env`.

---

### 3. Pluggable support module + conversation history — `feature/pluggable-support`

| Field           | Value                                  |
| --------------- | -------------------------------------- |
| **Session No.** | S213                                   |
| **Session ID**  | `d6c4131c-0851-4186-b4ce-5a0f25b3552c` |
| **Branch**      | `feature/pluggable-support` (from `feature/voice`) |
| **Worktree**    | `/Users/aksykmr_mac/Loop Methods/experiments/bookleaf-pluggable` |
| **Base commit** | `9489277`                              |
| **Started**     | 2026-10-27                             |
| **Status**      | 🔄 Still active on its branch (author experience, call-in-chat, theme, Hinglish voice, 2026-10-28); not merged |

**Goal:** read-only conversation history for authors; turn the support system into a module any
product can attach (embed widget + Fastify plugin), with customer data read only over HTTP from the
host; move BookLeaf author/book data into `apps/host-demo`. Never merged into `main` or `feature/voice`.

**CLAIMED PATHS (on this branch only):**

```
apps/**
apps/host-web/**
apps/web/public/**
packages/**
docs/**
eslint.config.js
.env.example
```

**Things another session should know:** `platform/env.ts` becomes `config/*.ts`; author sign-in moves
to a host token (`POST /api/v1/auth/host`); BookLeaf facts engine moves to `apps/host-demo`.

---

# Path Ownership Map

| Path | Owner | Free to claim? |
| ---- | ----- | -------------- |
| `apps/`, `packages/`, `eval/` | session S213 | ❌ No |

---

# Completed & Released

(none yet)

---

# Cross-Session Hard Rules

- API keys only in env; never committed, never sent to the browser.
- Prisma schema changes always ship with a committed migration (`prisma migrate dev`), never `db push`.
- Core suite (typecheck, lint, tests, build) must be green before every commit.
