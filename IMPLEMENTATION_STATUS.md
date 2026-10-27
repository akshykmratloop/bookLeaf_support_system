# Implementation status — 28 Oct 2026 (end of the overnight QA mission)

Branch **`feature/support-saas`** (worktree `bookleaf-support-saas`), HEAD at the commit that adds this file. It merges
the pluggable support module and the multi-tenant SaaS platform, and it has been audited, fixed and verified.
**Not merged into `main`, not pushed, not deployed.** `main` is unchanged at `969813a`.

Full QA evidence: `docs/qa/final-report.md` (start here), then `requirements-matrix.md`, `repair-plan.md`,
`security-report.md`, `ai-benchmark.md`, `baseline.md` and `browser-journeys.md`, all in `docs/qa/`.

## 1. Assignment requirements

From `docs/qa/requirements-matrix.md` (30 requirements read from the assignment PDF):

| Status | Count | Items |
| --- | --- | --- |
| ✅ Met | 27 | Logins and roles, My Books, ticket form, My Tickets with live updates, admin queue with filters and urgency order, AI category and priority with override, AI draft with knowledge base, statuses, notes, assignment, REST API and docs, keys in env, graceful degradation, cost awareness, model choice explained, seed data, Dockerfile, README |
| 🟡 Partly | 1 | One-page write-up: `docs/write-up.md` is 761 words, more than a page. Left for you to trim, since it is your voice. |
| ❌ Not met | 2 | Live URL and private repo. Both need your accounts (section 5). |

## 2. Tests and build (one run on this machine, 28 Oct)

| Check | Result |
| --- | --- |
| Typecheck (all packages) | ✅ pass |
| ESLint (incl. file/function size and architecture rules) | ✅ pass |
| Prettier format check | ✅ pass |
| Production build (all apps) | ✅ pass |
| API tests (real Postgres via testcontainers) | ✅ 436 / 436 (52 files) |
| Web / host-demo / host-web tests | ✅ 74 / 74 · 28 / 28 · 4 / 4 |
| react-doctor (`--fail-on error`) | ✅ exit 0 — web 79/100, host-web 82/100 (warnings only) |
| Docker image | ✅ built; on an empty throwaway database it applied all 10 migrations, `/health` OK, app/admin/embed.js/API docs 200, security headers present |
| Migrations on a throwaway database | ✅ `migrate deploy` + `migrate diff --exit-code` = 0 (no drift) |
| Live AI triage eval (46 cases incl. Hinglish, Hindi, adversarial; Haiku) | ✅ category 45/46 (macro-F1 0.972), priority 46/46, ≈ $0.08 per 1,000 tickets |
| Live AI draft eval (24 cases; Sonnet) | 🟡 10/24 pass the fact checker first time (was 4/24 before a prompt fix); the rest wait for a person to confirm a detail — by design nothing unverified reaches an author |
| Real-browser journeys (Chromium, 420 and 1440 px, light and dark) | ✅ 6 journeys, no P0/P1 defects; 1 layout bug fixed |
| Live voice call with a microphone | ⏳ not tested — needs you (section 5) |

AI calls used tonight: 143 text-model calls (limit agreed: about 150). No live voice calls.

## 3. Git

110 local commits on `feature/support-saas` ahead of `main`, conventional format with the Co-Authored-By trailer. Tonight's
QA commits run from `4f9ddff` (brief saved) to the commit that adds this file. **Nothing has been pushed** and nothing is
merged into `main`. `.env` files are untouched.

## 4. Optional chat and voice

Built on this branch: the author assistant chat (with ticket drafts), voice calls inside the chat, the Hinglish voice
persona, and per-workspace switches, limits, models and keys. Chat and voice are switched **off** by default for the
BookLeaf workspace: turn them on in `/admin/assistant`. Voice is covered by tests with a fake voice provider only.

## 5. Blockers and actions for you

1. **Test a live call with your microphone.** On http://localhost:3400 (the BookLeaf dashboard running the
   `feature/pluggable-support` build, which has the voice key) sign in as an author, open help, Ask, press the voice
   button, allow the microphone, and speak Hinglish. The QA servers (3500–3700) have no AI or voice key. Check the warmth of the voice, the figures it says and the
   ticket it drafts.
2. **Create the private GitHub repo** and push (`git push -u origin feature/support-saas`). I did not create a repo or push.
3. **Deploy:** a Railway (or Render/Fly) project with Postgres, the env vars in `.env.example`, the Dockerfile. The image
   is verified locally. Then put the URL in the README.
4. **Decide on the deferred design items** (details in `docs/qa/repair-plan.md`): login across workspaces and session
   revocation (F-12), per-workspace ticket numbers (F-13), per-workspace embed paths (F-18), shared state before
   running two instances (F-19).
5. **Trim `docs/write-up.md`** to one page if the reviewers count pages strictly.
6. **Review and merge** `feature/support-saas` into `main` when you are happy. I did not merge it.
