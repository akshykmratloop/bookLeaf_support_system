# QA mission — final report

Branch `feature/support-saas`, 28 Oct 2026. The mission brief is in `docs/qa/mission-brief.md`; the overall status is in
`IMPLEMENTATION_STATUS.md`.

## Outcome

The merged branch passes every quality gate that can run on this machine. Every check is green: typecheck, lint,
format check, build, react-doctor, and **542 tests** (API 436, web 74, host-demo 28, host-web 4). The Docker image builds
and starts cleanly on an empty database.

An independent audit found 20 issues: 3 P0, 2 P1, 9 P2 and 6 P3.
- **All 5 P0/P1 issues are fixed**, each with a test that failed first.
- 11 of the other 15 are fixed (F-14 by correcting the architecture doc).
- 4 are design changes, deferred with written reasons.

QA itself found 5 more problems, and all 5 are fixed. Nothing was deployed, pushed or merged into `main`.

## Status by area

| Area | Status | Evidence |
| --- | --- | --- |
| Assignment requirements (30) | PASS 27 · PARTIAL 1 · FAIL 2 (blocked on accounts) | `requirements-matrix.md` |
| Tenant isolation and security | PASS (no open P0/P1) | `security-report.md` |
| Tests, lint, types, format, build | PASS | Section "Commands" below |
| Docker image | PASS (local) | `requirements-matrix.md` row T2 |
| Database migrations | PASS: throwaway DB, no drift; applied to `bookleaf_saas` after a backup | Below |
| AI triage (live, 46 cases) | PASS: 45/46 category, 46/46 priority | `ai-benchmark.md`, `docs/eval-results.md` |
| AI reply drafts (live, 24 cases) | PARTIAL: 10/24 pass the checker first time; the rest need a person to confirm a detail; no unverified figure can be sent | `ai-benchmark.md`, `draft-eval.md` |
| Provider failures (429, bad key, 5xx, timeout, malformed) | PASS (simulated over local HTTP) | `apps/api/src/ai/providers/anthropic/failures.test.ts` |
| Real-browser journeys | PASS: 6 journeys, both themes, 420 and 1440 px | `browser-journeys.md` |
| Live voice call | NOT VERIFIED: needs a person with a microphone | — |
| Deployment | BLOCKED: needs a hosting account | — |

## What changed tonight (commits from `4f9ddff`)

Fixes, each with a regression test:
- `b16453c`: admin reads and the live stream stay inside the workspace (F-01 to F-04, F-17).
- `bf9feb1`: tenant URLs re-checked per request (SSRF); a customer missing at the host degrades gracefully; workspace
  chat limits apply; no typing past the limit during a call (F-05, F-09, F-10, F-11).
- `f5b887d`: server API on workspace API keys, and signed webhooks (F-06).
- `cf53031`: amounts spoken in words are checked; fallback drafts use the workspace's own figures (F-07, F-08).
- `6ecfc5a`: the override audit row is written with its reply (F-15).
- `c8c2403`: author text cannot close its prompt fence (F-16).
- `fa1b0d4`: slash dates that read two ways are flagged (F-20).
- `b82ac20`: drafts stop adding placeholders the author can resolve themselves. Pass rate went from 4/24 to 10/24.
- `c01353d`: ticket creation is capped at 30 per author per hour, because each ticket starts paid AI work.
- `b521921`: malformed model output gets the right error name.
- `1346b47`: the queue date filters fit on wide screens.

Tests added to close coverage gaps:
- `b35ebf4`: eval with Hinglish, Hindi and adversarial cases, macro-F1 and cost.
- `ea2a62d` and `e31a07b`: queue order, filters, and reopening a closed ticket.
- `3248e44`: live updates over a real HTTP stream.

Docs:
- `ffe7925`, `575122f`, `c7a5bfc`, `d2482c8`, `6683bde`: the QA reports.
- `4960a04`, `88a9086`: README and write-up drift, and the model-choice note.
- The F-14 and F-19 architecture updates went in with `c7a5bfc`.

## Commands (all run on 28 Oct; results observed)

```bash
pnpm -r typecheck        # exit 0
pnpm lint                # exit 0
pnpm format:check        # exit 0
pnpm -r build            # exit 0
pnpm -r test             # exit 0 — API 436, web 74, host-demo 28, host-web 4
(cd apps/web && npx react-doctor@latest . --fail-on error --offline)       # exit 0, score 79
(cd apps/host-web && npx react-doctor@latest . --fail-on error --offline)  # exit 0, score 82
docker build -t bookleaf-support-saas:qa .                                 # exit 0
# throwaway DB: prisma migrate deploy, then migrate diff --exit-code       # exit 0 (no drift)
# live evals (needs the Anthropic key):
(cd apps/api && npx tsx --env-file=<.env> ../../eval/run.ts)        # triage, 46 calls
(cd apps/api && npx tsx --env-file=<.env> ../../eval/draft-run.ts)  # drafts, 24 calls
```

## Running servers (left on the newest working build)

| Port | What | Build |
| --- | --- | --- |
| 3300 / 3400 | Support app / BookLeaf dashboard (has the AI and voice keys) | `feature/pluggable-support` |
| 3500 / 3600 / 3700 | Support API / web / BookLeaf demo (no AI or voice key: rule-based fallback) | `feature/support-saas` (this branch) |

The `bookleaf_saas` database was backed up (a `pg_dump` in the session scratchpad) before 3 additive migrations were
applied. Main's `bookleaf` database was not touched.

## Data left behind by QA on the 3500–3700 servers

- Ticket BL-1001 with one staff reply.
- A test workspace named "QA Test Co".
- Chat and voice were switched on and then off again in the BookLeaf workspace settings.

## Morning checklist (needs you)

1. Live Hinglish call with a real microphone on http://localhost:3400. Check the voice, the figures and the drafted ticket.
2. Create the private repo and push the branch.
3. Deploy (Railway, Render or Fly), using the verified Dockerfile and `.env.example`.
4. Decide on F-12, F-13, F-18 and F-19 (`repair-plan.md`).
5. Optionally trim `docs/write-up.md` to one page.
6. Review and merge `feature/support-saas` into `main`.
