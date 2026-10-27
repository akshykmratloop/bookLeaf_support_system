# Write-up: approach, trade-offs and the path to production

## What I prioritised

**1. Replies that are correct, not just fluent.** In author support, a confident wrong number ("your ₹5,000 will
arrive on Friday") is worse than a slow reply. So the AI never does arithmetic or looks anything up. Code builds a
facts pack from the author's own records (book-level vs account-level royalties, the ₹1,000 threshold, the next
45-day payout deadline, production stage, distribution record), each fact tagged with its source. The product that
owns the records builds these facts (here `apps/host-demo`); the support module only reads them. The model only
writes the prose and must cite the facts it used. A deterministic checker then matches every amount, date and
timeline in the text against those facts, on the AI draft and again on the admin's final edit. What the data does not
know (for example whether a bank account is linked) becomes a `[CONFIRM: …]` placeholder that blocks sending until a
person fills it in.

**2. The ticket lifecycle must never depend on the AI.** A ticket and its AI job are written in one transaction.
A background worker does the AI work with leases, retries and a generation guard, and falls back to keyword rules and
code-filled templates. With the AI switched off, authors can still raise tickets and admins can still triage and
reply. This is demonstrable with the outage switch in AI Settings.

**3. Humans stay in control.** AI suggestions show their source; admin overrides are never overwritten by a later AI
run; every override and every "send anyway" is audited with a reason.

**4. A clean, enforced architecture.** Thin routes, services, a single data-access layer, one injected clock, and a
provider interface for the LLM. ESLint enforces the boundaries (for example, the vendor SDK can only be imported in its
adapter), so they survive future changes.

## Trade-offs I made

- **Jobs table instead of a queue service.** Postgres `SKIP LOCKED` gives atomic enqueue with the ticket and crash
  recovery with no extra infrastructure. It suits this volume; a dedicated queue would come with scale.
- **SSE "hints" instead of pushing data.** Events only say "ticket X changed"; the client refetches through the
  normal API. Slightly more requests, but permissions are checked on every read and a missed event loses nothing.
- **Two models.** A fast model for triage, a stronger one for the author-facing reply. Both are switchable per task.
- **Strict checker over convenience.** It occasionally blocks a legitimate figure; the admin can override with a
  reason. I preferred false alarms over silently sending a wrong number.
- **Support reads customer data from the product instead of copying it.** It keeps only ids, names and titles,
  and asks the product for facts each time (cached 60 s). One extra HTTP call per answer, but no second copy of
  money figures to go stale, and the module can be attached to another product or detached again.
- **Keys in env only.** The brief asks for env-stored keys, so the UI selects provider and model but never handles
  secrets.
- **Not done in this time box:** deployment, attachment upload, email notifications, a second LLM vendor, and a larger
  independent evaluation set. The current eval (26 cases, 26/26 for AI triage) was written by me and informed one
  prompt change, so it is a sanity check, not proof.

## How I'd evolve this into a production system

1. **Measure before scaling.** A larger labelled set from real tickets, tracked per release; sample sent replies for
   human review; dashboards on `ai_runs` (cost, latency, fallback rate) and on override rates by category.
2. **Close the data gaps the AI keeps flagging.** Bank-link status, stage-entry dates and per-quarter earnings would
   turn many placeholders into verified facts, so drafts need fewer edits.
3. **Auto-send only where it is provably safe.** For narrow, fully-grounded cases (for example "when is my next
   payout?") with a passing check, offer one-click approval first, then measured auto-send.
4. **Operational hardening.** Postgres `LISTEN/NOTIFY` for multi-instance events, a secret manager, per-tenant rate
   limits, email notifications, file uploads with virus scanning, and SLA breach alerts.
5. **Make the module fully product-neutral.** Chat, voice and history already reuse the same facts and checker. The
   next step is to load the knowledge base, ticket categories and triage rules from configuration, and to send
   signed webhooks to the product when a ticket changes.
