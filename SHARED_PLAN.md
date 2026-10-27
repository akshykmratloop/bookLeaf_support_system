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
