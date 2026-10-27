# GOD MODE: AUTONOMOUS PRODUCTION-GRADE CODE AUDIT, REPAIR & BENCHMARK MISSION

## 0. YOUR ROLE

You are operating as an autonomous principal engineer, staff software architect, application-security engineer, senior QA engineer, AI evaluation researcher, performance engineer, accessibility reviewer, and release-quality auditor.

This is a high-stakes technical assignment. The evaluator will inspect the actual implementation, run the application, test the API, examine the architecture, challenge security boundaries, evaluate AI responses, and judge whether the product satisfies the assignment's explicit requirements.

Your objective is to make the existing codebase as correct, secure, reliable, maintainable, performant, and demonstrably compliant as possible.

**Do not merely produce a code review. Inspect the implementation, prove defects, fix them, add regression tests, benchmark again, and repeat until the remaining work is genuinely blocked or the quality gates pass.**

I am going to sleep and will not respond to questions, approve routine decisions, or provide additional instructions. Operate autonomously using the existing repository, documentation, assignment, available tools, and safe engineering judgment.

Do not wait for me.

Do not claim that anything passed unless you have actually executed the relevant verification.

Do not promise a perfect score. Maximize demonstrated compliance with every scoring criterion and leave an honest, evidence-backed report of anything that remains uncertain or incomplete.

---

# 1. ABSOLUTE SCOPE

This mission concerns the **application code and software quality**, not external infrastructure or deployment.

IN SCOPE:

- Requirements compliance with the original assignment.
- Architecture and module boundaries.
- Repository and folder structure.
- TypeScript and JavaScript correctness.
- API contracts, validation, authentication and authorization.
- Multi-tenant isolation and data access.
- Database schemas, migrations, transactions and consistency.
- AI integration, grounding, response quality, evaluation, latency and cost.
- Chat, voice, widget, embedded integration and plugin integration.
- Frontend functionality, user experience, responsive layouts and accessibility.
- Error handling, retries, cancellation, concurrency and recovery.
- Automated tests, regression tests, security tests and benchmarks.
- Dependency health and software supply-chain risks.
- Build configuration, linting, formatting, type checking and CI definitions.
- Documentation that accurately describes the implementation.
- Git hygiene and safe local commits.

OUT OF SCOPE:

- Purchasing hosting or external services.
- Creating or modifying production infrastructure.
- Deploying to production.
- Changing DNS, domains, cloud resources or billing.
- Making external accounts or credentials available.
- Editing `.env` files or changing live credentials.
- Performing destructive operations against live databases.
- Changing production configuration merely to make a test pass.

You may inspect infrastructure-related source code and deployment configuration for code-level correctness, but do not execute deployments or mutate infrastructure.

Do not spend time polishing infrastructure documentation while significant application defects remain.

---

# 2. AUTHORITATIVE SOURCES AND REPOSITORIES

First inspect all available project instructions and relevant files, including:

- The original BookLeaf technical assignment PDF.
- The exact assignment requirements and evaluation criteria.
- The latest `PLAN.md`, `TASKS.md`, `architecture.md` and relevant project instructions.
- The pasted latest project status and work plan.
- Existing QA instructions, including `TASKS Q.0–Q.11` if present.
- Existing AI prompts, knowledge-base documents, evaluation datasets and QA reports.
- The root README, package manifests, lockfiles, test configuration and CI definitions.
- Git history, branches, worktrees and current uncommitted changes.

Inspect these three known worktrees, if they still exist:

1. `bookleaf` — `main`, core assignment.
2. `bookleaf-pluggable` — `feature/pluggable-support`, widget and support integration.
3. `bookleaf-saas` — `feature/saas-platform`, SaaS foundation.

The live support application has previously been available at `http://127.0.0.1:3300`, with the BookLeaf host application at `http://localhost:3400`. Treat these as historical references, not guaranteed current state. Verify before interacting.

The SaaS worktree previously used ports 3500, 3600 and 3700. Do not assume those servers are running or start competing instances without checking existing processes and ports first.

### Repository safety rules

- Read the repository's own instructions before editing.
- Respect `SHARED_PLAN.md` and any worktree-specific instructions.
- Never overwrite or discard existing user changes.
- Never use `git reset --hard`, destructive clean commands, forced checkout, or blanket revert operations.
- Never rewrite shared history or force-push.
- Do not merge into `main`.
- Do not push anything unless the repository's explicit instructions authorize it.
- Do not modify `.env` files.
- Never commit secrets, real customer data, access tokens or credentials.
- Read every migration before applying it.
- Never run destructive migrations against a live database.
- Use disposable local databases for destructive or migration experiments.
- Preserve existing running applications unless a controlled restart is necessary and safe.
- Do not install an untrusted package or run an unknown remote script merely to complete a check.

Before touching files, record the current branch, HEAD SHA, worktree status and existing changes in each repository.

Make changes only in the appropriate worktree. If integration is needed, create a new integration branch without overwriting either source branch.

---

# 3. MANDATORY PHASE ZERO: INDEPENDENT FABLE AUDIT

Before implementing fixes, use the available Fable agent/model for an independent, read-only audit of the actual code.

This is a separate audit phase, not permission to let an agent make uncontrolled changes.

Ask the Fable reviewer to examine:

1. The original assignment and its scoring criteria.
2. The actual implementation across the relevant worktrees.
3. The architecture and dependency boundaries.
4. Security and multi-tenant isolation.
5. AI grounding, correctness and failure handling.
6. Widget, plugin, host application, chat and voice integration.
7. Existing tests and important missing test cases.
8. Performance, latency, reliability and maintainability.
9. The discrepancy between documentation and the implementation.

Require specific file paths, functions, reproduction steps, severity, affected requirement IDs and recommended fixes.

Do not accept generic observations such as "improve security" or "add more tests." Demand concrete, verifiable findings.

If Fable can only inspect a subset of the repository, record that limitation.

If Fable is unavailable, do not pretend it ran. Use any available independent code-review agent or model. If none is available, conduct the audit yourself using separate security, architecture, AI and testing passes.

Preserve the initial review as an artifact, for example:

`docs/qa/fable-review.md`

Only record findings that were actually returned or verified.

Then perform your own independent review. Fable's findings are input, not unquestionable truth.

---

# 4. BUILD A REQUIREMENTS-TO-EVIDENCE MATRIX

Read the original assignment, not just the current implementation or your own plans.

Extract every mandatory criterion, including all requirements concerning:

- Author authentication and data isolation.
- Book and royalty information.
- Ticket creation, status, messages and admin workflow.
- Admin classification and priority.
- AI-generated response drafts and human review.
- Knowledge-base usage and response tone.
- API design, validation and documentation.
- AI credentials and secret management.
- AI outage and rate-limit behavior.
- Cost awareness.
- Seed data and edge cases.
- Required deliverables, repository privacy and documentation.

Include any applicable widget, plugin, SaaS, chat and voice requirements that are explicitly part of the current submission scope.

Do not silently substitute the latest roadmap for the original assignment. The original mandatory criteria remain the scoring baseline unless the assignment explicitly permits an alternative.

Create:

`docs/qa/requirements-matrix.md`

For every criterion record:

| Field | Required content |
|---|---|
| Requirement ID | Original ID or a stable identifier |
| Exact criterion | Faithful summary of the assignment |
| Implementation | File paths and relevant functions |
| Test evidence | Test name, command and result |
| Runtime evidence | Actual observed behavior where required |
| Status | PASS, FAIL, PARTIAL, BLOCKED or NOT VERIFIED |
| Gap | Exact remaining defect |
| Remediation | Specific action |

Never mark a requirement PASS solely because code appears to exist. Test the behavior whenever feasible.

Keep mandatory assignment requirements separate from extra SaaS/product enhancements. Additional features must not undermine the assignment's core compliance.

---

# 5. ESTABLISH A BASELINE BEFORE FIXING

Before changing application code:

1. Inventory all packages, applications, services, integrations and shared modules.
2. Map which worktree contains each feature.
3. Identify overlapping files and migrations.
4. Establish current test, typecheck, lint, format and build results.
5. Identify existing failing tests separately from new failures.
6. Inventory all API routes and authentication requirements.
7. Map data flows from browser to backend to database and AI providers.
8. Identify every AI call, tool invocation, retry, timeout and fallback.
9. Identify every point where user input, model output or tenant-specific data crosses a trust boundary.
10. Identify duplicated business logic and competing sources of truth.
11. Inspect dependency versions and relevant known vulnerabilities.
12. Verify whether tests genuinely exercise application behavior or merely mock it away.

Create:

`docs/qa/baseline.md`

Record the actual commands, outcomes, failures, durations and relevant environment limitations.

Use existing scripts where available. If a script is missing, identify that as a defect and add an appropriate one when safe.

Do not conceal failures by weakening tests, disabling lint rules, reducing type safety, increasing timeouts without justification, or excluding problematic files.

---

# 6. CREATE A PRIORITIZED REPAIR PLAN

After the independent audit and baseline, create:

`docs/qa/repair-plan.md`

Rank defects by:

- P0: Critical security exposure, cross-tenant data leakage, credential exposure, destructive data behavior or a core workflow that is unusable.
- P1: Mandatory assignment criterion failing, authorization bypass, incorrect financial facts, AI hallucination reaching an author, broken integration or data corruption.
- P2: Significant reliability, latency, maintainability, usability, performance or test-coverage defects.
- P3: Low-risk polish, minor duplication and nonessential enhancements.

For every finding, include:

- Evidence.
- Severity and impact.
- Affected requirements.
- Reproduction.
- Root cause.
- Proposed change.
- Regression test.
- Verification command.

Fix P0 and P1 first.

Then fix P2 issues, followed by worthwhile P3 issues.

Do not waste the night repeatedly rewriting the plan. Once the plan is sufficiently clear, start implementing fixes immediately.

If a design decision is routine and reversible, make it yourself. Ask no questions that can reasonably be answered from the repository, assignment or safe engineering defaults.

---

# 7. ARCHITECTURE AND CODE QUALITY AUDIT

Inspect and improve the actual architecture, not merely the folder names.

Check:

- Clear separation between HTTP routes, business services, repositories, providers and UI.
- No direct database access from route handlers or UI components where it violates existing boundaries.
- No circular imports or unexpected cross-layer dependencies.
- No business rules duplicated across the API, widget, chat, voice and admin dashboard.
- No duplicated authorization logic that can drift.
- No unnecessary abstractions, service locators, giant modules or god components.
- No speculative framework or microservice rewrite.
- Explicit contracts for external providers and adapters.
- Strong TypeScript types and runtime validation at trust boundaries.
- Consistent error semantics.
- Predictable dependency injection and test seams.
- No unsafe casts or widespread `any` used to suppress errors.
- Correct transaction boundaries and idempotency.
- Appropriate pagination and query limits.
- Bounded memory, response size, history and background work.
- Correct lifecycle management for listeners, streams, timers, media and database clients.
- No leaked connections, duplicate subscriptions or unbounded event listeners.
- No logging of sensitive prompts, secrets or unnecessary personal data.

Do not impose arbitrary line-count limits at the expense of good design. Split files when it improves cohesion and testability.

Preserve the established stack unless an actual defect justifies a minimal, well-supported change.

Avoid rewriting working modules solely to match a preferred architecture.

---

# 8. SECURITY MISSION

Perform a systematic security review of the application and its integrations.

## Authentication and authorization

Test:

- Unauthenticated access to every protected endpoint.
- Expired, malformed, invalid and revoked sessions or tokens.
- Role escalation and admin-only actions.
- Author A accessing Author B's books, tickets, messages, chat sessions, voice sessions, history and files.
- Cross-tenant access through guessed IDs, altered request bodies, URL parameters, query filters, exports and background jobs.
- Authorization rechecked on every relevant operation.
- Workspace identity derived from verified credentials rather than trusted browser-supplied IDs.
- Object-level permissions in both REST and realtime paths.
- Unauthorized access to internal notes, AI drafts, provider settings and audit information.

## Multi-tenant SaaS isolation

Where the SaaS functionality exists, inspect:

- Workspace ownership and membership.
- API keys and revocation.
- Product connection credentials.
- Encrypted provider keys.
- Tenant-specific AI settings, knowledge bases, prompts, categories, limits and branding.
- Origin allowlists.
- Widget configuration and embedding permissions.
- Workspace-aware queries and background jobs.
- Cross-tenant caches and cache keys.
- Shared event streams.
- Storage paths and exported records.
- Database row-level security if implemented.

A tenant ID in a request body is not proof of authorization.

Test the isolation using at least two independently seeded workspaces.

## Input and browser security

Check:

- SQL injection and unsafe raw queries.
- Cross-site scripting and unsafe HTML rendering.
- CSRF and Origin enforcement.
- CORS configuration.
- SSRF in connectors, webhooks and URL-fetching integrations.
- Path traversal and unsafe file handling.
- Prototype pollution and unsafe object merging.
- Request size and resource-exhaustion attacks.
- Rate limits on login, chat, calls, ticket creation, tools and expensive AI endpoints.
- WebSocket/WebRTC or realtime authorization where applicable.
- CSP, security headers, microphone permissions and iframe/embed restrictions.
- Open redirects and unsafe `postMessage` origin handling.
- Clickjacking and unsafe link handling.

## Secrets and cryptography

Check:

- No secrets in frontend bundles, source maps, responses, logs, screenshots or test snapshots.
- No secrets committed to Git or embedded in generated documentation.
- Environment secrets are validated without printing their values.
- Encryption uses sound authenticated encryption and safe key management.
- Authentication tokens and API keys are not logged.
- Credential rotation, replacement and revocation do not leave stale credentials active.
- Provider error messages cannot reveal secrets.
- Browser-supplied agent IDs, metadata, tool arguments or webhook URLs cannot bypass server authorization.
- Webhook signatures and replay protections where applicable.

## AI-specific security

Test:

- Prompt injection in author messages, book titles, knowledge-base text and conversation history.
- Attempts to reveal system prompts, provider credentials or another author's data.
- Tool calls with forged book IDs, ticket IDs and workspace IDs.
- Unauthorized ticket creation or changes through tools.
- Requests to change bank details, promise refunds, guarantee payouts or invent dates.
- Untrusted model output rendered as HTML or executed as code.
- Excessive tool loops, repeated calls, oversized context and expensive requests.
- Sensitive data in provider requests and logs.
- Unsafe fallback behavior.

Run automated security scanners only when their scope and effects are understood. Use safe test data and local environments. Do not probe third-party infrastructure without authorization.

Fix confirmed critical and high-severity findings and add regression tests for each.

---

# 9. AI QUALITY: CORRECTNESS BEFORE FLUENCY

The AI integration is a major evaluation criterion. Treat it as a measurable system, not a prompt-writing exercise.

Inspect every AI workflow, including ticket triage, priority selection, response drafting, assistant chat, knowledge-base retrieval and voice behavior.

## Ground truth and business rules

The application must not let a language model invent facts that deterministic code can calculate or verify.

Check that:

- Royalty arithmetic is computed by code.
- Book-level and author-level balances are not confused.
- Missing values remain unknown rather than becoming zero.
- Dates and payout deadlines use the configured data snapshot and correct clock.
- Production stage and remaining stages come from the records.
- Distribution claims distinguish a known record from a real-time marketplace fact.
- Priority rules enforce mandatory floors for urgent issues.
- The AI cannot overwrite an admin's explicit classification or priority.
- The system does not promise payments, refunds, production dates or guaranteed outcomes without evidence.
- The system handles incomplete, contradictory, stale and ambiguous records honestly.

Use the original sample dataset and knowledge base as the primary ground truth.

## Structured outputs and validation

Check that:

- AI output is validated at runtime.
- Invalid JSON, missing fields, unexpected enums, malformed claims and excessive output are handled safely.
- Prompt injection cannot override the system instructions or tools.
- Model confidence is not presented as calibrated probability unless demonstrated.
- Draft claims can be traced to evidence where the design requires it.
- Every final reply is checked server-side, not only in the frontend.
- Unsupported amounts and material claims are blocked or handled according to the defined policy.
- Required confirmation placeholders cannot accidentally reach the author.
- Human approval remains mandatory wherever required by the assignment.

## Triage evaluation

Build or improve a labelled evaluation dataset covering:

- All mandatory categories.
- Clear and ambiguous classification cases.
- Mixed-category requests.
- Urgent and non-urgent requests.
- Incorrect royalty complaints.
- Missing or delayed payments.
- ISBN problems.
- Printing defects and requests for reprints.
- Production-status questions.
- Distribution and listing issues.
- General/account-level questions.
- Legal threats and upset authors.
- Short, vague and poorly written messages.
- Hinglish, Hindi and English inputs where supported.
- Attempts to manipulate the priority.
- Prompt injection and unsupported refund requests.

Report category accuracy, per-category precision and recall where sample sizes permit, macro-F1, priority confusion and the number of unsupported critical claims.

Never report invented or unmeasured accuracy numbers.

## Response-quality evaluation

Evaluate replies against a rubric:

1. Factual correctness.
2. Evidence coverage.
3. Correct category and urgency.
4. Appropriate acknowledgement of the author's concern.
5. Specificity to the actual book and account.
6. BookLeaf's expected tone.
7. Clear explanation of what is known and unknown.
8. Appropriate next steps.
9. No unsupported promises or fabricated figures.
10. Concision and readability.
11. No repetitive filler or generic AI language.
12. No accidental disclosure of internal information.
13. Correct handling of ambiguity and escalation.
14. Consistency between the generated draft, checker and final sent reply.

Use deterministic tests for arithmetic, dates, schemas and forbidden claims. Use model-based judging only as supplementary evidence, not as a replacement for ground truth.

When model-based judging is used, record the judge model, rubric, sample set and limitations.

Create a report showing examples of passing and failing responses, the specific reason for each failure, and whether the fix corrected it.

## Fallback and provider failures

Simulate:

- Missing API credentials.
- Invalid credentials.
- Rate limiting.
- Timeouts.
- Provider 5xx errors.
- Malformed output.
- Partial provider failures.
- Network interruption.
- Repeated retries.
- Circuit-breaker activation if implemented.
- Provider unavailable during ticket creation.
- Provider failure after the ticket has already been saved.

Tickets must not be lost because the AI is unavailable. The fallback must still produce a safe, usable workflow without fabricated facts.

Test retry bounds, backoff, idempotency, job recovery and duplicate processing.

---

# 10. AI LATENCY AND COST BENCHMARKING

Measure actual performance before optimizing.

Identify all serial model calls, redundant prompt construction, repeated database queries, unnecessary full-history replay, duplicated tool execution and repeated draft generation.

Measure:

- Time to first useful response.
- Total response latency.
- Provider latency separately from application latency.
- Median and p95 where the sample size supports meaningful percentiles.
- Number of model calls per user operation.
- Token consumption and cost where the provider exposes those measurements.
- Cache hit rate if caching exists.
- Database query count and duration for important paths.
- Cold-start versus warm-request behavior when applicable.
- Fallback latency.
- Tool-loop count and repeated tool calls.
- Voice connection time, time to first audio and turn latency where safely measurable.

Use repeatable local benchmarks, representative synthetic data and recorded outputs when live provider credentials are unavailable.

Do not make expensive live AI calls repeatedly without a clear evaluation need. Set bounded sample counts and record the provider and model used.

Optimize in this order:

1. Remove unnecessary sequential calls.
2. Avoid duplicate calls and repeated work.
3. Reduce excessive context and redundant history.
4. Improve prompt construction and knowledge-base selection.
5. Use parallel execution only for independent operations.
6. Add caching only where correctness, freshness and tenant isolation are preserved.
7. Improve database access and payload sizes.
8. Adjust timeouts and retries based on evidence.

Do not sacrifice factual accuracy, tenant isolation or response quality to reduce latency.

Do not claim a latency improvement unless baseline and post-fix measurements demonstrate it.

Create `docs/qa/ai-benchmark.md`.

---

# 11. WIDGET, PLUGIN, HOST AND SAAS INTEGRATION

Audit the actual implemented integration models. Do not assume that "widget" and "plugin" mean the same thing.

Verify the real embed script, browser widget, host application integration, backend API and any reusable integration package.

## Widget

Test:

- Correct loading from the documented script URL.
- Correct initialization and configuration.
- Allowed-origin enforcement.
- Multiple instances or repeated initialization.
- Expand, collapse, close and reopen.
- Docked and expanded layouts.
- Small and large viewports.
- Light and dark themes.
- Correct brand colors and text fields.
- Loading, empty, offline, error and retry states.
- No accidental duplicate listeners or network requests.
- No unexpected navigation away from the host application.
- Correct session and conversation history.
- No secrets embedded in the script or browser configuration.
- Appropriate CSP and iframe permissions.
- Keyboard operation, focus management and screen-reader labels.

## Plugin and programmatic integration

Verify the actual supported integration contract:

- Installation and initialization.
- Configuration validation.
- Authentication and tenant resolution.
- API request and response schemas.
- Error propagation and recovery.
- Lifecycle and cleanup.
- Version compatibility.
- Documented examples that actually run.
- Backward compatibility for existing consumers.

Do not invent a plugin architecture or SDK that does not exist. Document what is truly implemented.

## Host dashboard and support workflow

Test the real end-to-end journeys:

- Sign in.
- View support conversations.
- Start a new conversation.
- Send and receive messages.
- Refresh and restore history.
- Discard a draft.
- Switch between chat and voice.
- View call transcripts in the same conversation where intended.
- Apply conversation limits consistently.
- Show a clear pause state when a limit is reached.
- Resume using a new conversation.
- Create and follow up on tickets.
- Handle unauthorized or expired sessions.
- Handle network interruption without losing saved messages.

## Multi-tenant SaaS

Where implemented, test:

- Sign-up and sign-in.
- Workspace creation and membership.
- Product connection.
- Customer data fields.
- Per-workspace AI and voice provider settings.
- Per-workspace encrypted credentials.
- Knowledge-base and ticket-category settings.
- Widget branding and allowed origins.
- API-key creation, authentication and revocation.
- Usage limits and configuration updates.
- Workspace isolation under concurrent requests.

Do not report a feature as working just because its settings form saves. Verify that the configuration actually changes runtime behavior.

---

# 12. VOICE-SPECIFIC VALIDATION

Voice must be tested as a full lifecycle, not merely by checking that the call button renders.

Verify:

- Session authorization and workspace ownership.
- Correct call-to-conversation association.
- Server-controlled variables and identity.
- Correct tool permissions.
- Provider errors and unavailable states.
- Microphone permission denial.
- Connection failures and reconnection.
- Clean call termination.
- No duplicated call records.
- Call transcripts correctly saved and attributed.
- Message limits enforced during calls as well as chat.
- Graceful handling when the limit is reached.
- Call-duration and usage limits.
- No orphaned sessions or listeners.
- No transcript or customer data leaked across workspaces.
- No unsupported facts spoken as certain.
- Safe handling of requests involving money, bank changes, refunds or other actions.
- Appropriate Hinglish/English language matching if configured.
- Respectful, empathetic language without manipulative behavior.
- Correct spoken treatment of figures, dates, ISBNs and ticket numbers.
- Honest disclosure that the assistant is AI when asked.

Test voice with mocks or recorded fixtures when real provider access is unavailable. Perform real microphone and audio checks only if the required provider is already configured and the environment is safe.

Do not modify the external Vocal platform or its infrastructure as part of this code-only mission.

Record real voice tests separately from mocked tests. Never describe a mocked call as a successful live call.

---

# 13. DATABASE, API AND RELIABILITY TESTING

Audit every endpoint and important service.

Test:

- Request schema validation.
- Response schema validation.
- Correct HTTP status codes.
- Consistent error bodies.
- Authentication and role checks.
- Resource ownership.
- Pagination, sorting and combined filters.
- Invalid state transitions.
- Optimistic locking and concurrency.
- Duplicate submissions.
- Idempotency keys.
- Transaction rollback.
- Background job retries and recovery.
- Database uniqueness and referential integrity.
- Nullable values and seed-data fidelity.
- Date/time-zone correctness.
- Money precision and rounding.
- Concurrent updates and lost-update prevention.
- SSE or equivalent realtime reconnection.
- Event audience filtering.
- Client behavior when events are missed.
- Graceful degradation when a realtime channel is unavailable.

Use real database integration tests when feasible. Do not treat mocked repository tests as sufficient proof of SQL behavior.

Run migrations against a disposable database and verify schema consistency. Never reset a live or shared database to make a test pass.

Verify that all required API endpoints are documented and that documentation matches actual runtime schemas.

---

# 14. FRONTEND, ACCESSIBILITY AND PERFORMANCE

Inspect every major screen and workflow.

Check:

- Broken routes and links.
- Incorrect loading, error and empty states.
- Double submission.
- Stale cached data.
- Missing invalidation after mutations.
- Form validation and error messages.
- Responsive behavior.
- Keyboard-only navigation.
- Focus visibility and focus restoration.
- Semantic controls and accessible names.
- Color contrast.
- Modal and drawer behavior.
- Screen-reader announcements for dynamic updates.
- Reduced-motion preferences.
- Unhandled promise rejections.
- Browser console errors.
- Excessive bundle size.
- Unnecessary rerenders.
- Memory leaks from listeners, timers or subscriptions.
- Lazy loading of heavy or infrequently used routes.
- Correct cancellation of stale requests.

Run the project's existing UI diagnostics and browser-based tests.

If `react-doctor` is part of the project's quality plan, run it in the relevant frontend workspaces using the documented safe mode and fix actionable findings.

Use a real browser for key user journeys where available. Capture screenshots or browser evidence for significant visual defects and their fixes.

Do not redesign already-working screens merely to express personal preference. Prioritize broken interactions, inconsistent behavior, accessibility and assignment requirements.

---

# 15. TESTING STRATEGY: NO FALSE GREEN BUILDS

Build a layered test suite.

### A. Static checks

- TypeScript typecheck.
- Lint.
- Formatting check.
- Import-boundary checks.
- Secret scanning.
- Dependency and vulnerability checks.
- Frontend diagnostics.
- Build-time configuration checks.

### B. Unit tests

Cover business rules, validators, state machines, prompt builders, facts generation, evidence checking, retry policies, limits and normalization.

### C. Integration tests

Use a disposable real database for authentication, ownership, ticket lifecycle, migrations, workspace isolation and transactions.

### D. Contract tests

Verify the actual contracts between the host app, widget, backend, providers, tools and external integrations.

### E. End-to-end tests

Exercise real browser flows using seeded test accounts and isolated test data.

### F. Adversarial tests

Test authorization bypass, prompt injection, unsupported facts, malformed output, duplicate actions, oversized inputs, tenant confusion and provider failures.

### G. Regression tests

Every confirmed defect must receive a test that fails before the fix and passes afterward, where reproducible.

Do not:

- Delete or skip failing tests to obtain a green result.
- Weaken assertions without evidence that the original test was wrong.
- Mock the very behavior that the test claims to verify.
- Count a test as passing when it did not execute.
- Hide test failures behind `|| true`.
- Change production behavior merely to satisfy a mock.
- Claim coverage that has not been measured.

Use bounded test timeouts and isolate tests that require external services.

---

# 16. BENCHMARK UNTIL THE QUALITY GATES PASS

After each meaningful repair batch:

1. Run the narrow regression tests.
2. Run the relevant integration or end-to-end tests.
3. Run typecheck, lint and format checks.
4. Run the production build.
5. Run the full test suite.
6. Re-run relevant security and AI evaluations.
7. Compare results against the baseline.
8. Inspect the Git diff.
9. Update the requirements matrix and repair plan.
10. Commit a coherent, verified change when the repository's rules permit.

Repeat until:

- All mandatory requirements are verified or their remaining blocker is clearly documented.
- All confirmed P0 and P1 defects are fixed.
- No new critical/high security finding remains unaddressed.
- All critical user journeys pass.
- AI factual-safety tests pass.
- Tenant-isolation tests pass.
- Core tests, typecheck, lint, formatting and build pass.
- Performance measurements are recorded and serious regressions resolved.
- Documentation matches the actual implementation.
- Remaining failures are either fixed or explicitly classified as environment-blocked, externally dependent, or lower priority.

A green build alone is not completion.

A large test count alone is not completion.

A successful happy path alone is not completion.

The objective is demonstrated behavior and credible evidence.

If a gate cannot pass because a credential, service or browser capability is unavailable, record the exact missing dependency and continue with every safe alternative. Do not fabricate a result or get stuck waiting.

---

# 17. GIT AND CHANGE MANAGEMENT

Keep the three source worktrees intact.

Do not merge everything just because the branches overlap.

First determine whether the current submission should remain on the pluggable branch or whether a separate integration branch is needed.

If integration is required:

1. Create a new branch from an appropriate base.
2. Integrate one coherent set of changes at a time.
3. Read and reconcile overlapping schema and migration changes.
4. Resolve conflicts based on intended behavior, not simply by accepting one side.
5. Run the full suite after every integration milestone.
6. Preserve source branches.
7. Never force-push or merge into `main`.

Use clear conventional commits for coherent, verified changes.

Do not amend or rewrite existing user commits unnecessarily.

Do not commit if the applicable repository instructions prohibit it, or if the relevant checks reveal a serious unresolved regression. If a safe commit cannot be made, leave the changes intact and explain why.

Do not push commits unless explicitly authorized by existing repository instructions.

---

# 18. FINAL DELIVERABLES

Maintain these artifacts throughout the mission:

- `docs/qa/baseline.md`
- `docs/qa/fable-review.md` — only if Fable or another independent reviewer actually ran
- `docs/qa/requirements-matrix.md`
- `docs/qa/repair-plan.md`
- `docs/qa/security-report.md`
- `docs/qa/ai-benchmark.md`
- `docs/qa/final-report.md`
- `IMPLEMENTATION_STATUS.md`

Adapt locations if the repository has a better established documentation convention, but keep the deliverables easy to find.

The final report must contain:

1. The exact branch and final HEAD SHA.
2. The worktrees inspected.
3. The baseline failures.
4. The critical defects discovered.
5. The defects fixed and the files changed.
6. The regression tests added.
7. A requirements compliance table.
8. Actual test, typecheck, lint, formatting and build results.
9. Security findings and their status.
10. AI accuracy, response-quality, latency and cost measurements where measured.
11. Widget, plugin, host, chat, voice and SaaS integration test results.
12. Browser evidence where available.
13. Remaining blockers and unverified requirements.
14. Any known limitations that could affect evaluation.
15. Exact commands to reproduce the results.
16. The local commits created.
17. Whether the working tree is clean.
18. A prioritized morning checklist requiring my input only for actions that genuinely cannot be completed autonomously.

Clearly distinguish:

- PASS — verified.
- FAIL — tested and failed.
- PARTIAL — some behavior verified.
- BLOCKED — external dependency or permission prevents verification.
- NOT VERIFIED — not tested.

Do not label an entire feature PASS when only one part was checked.

---

# 19. AUTONOMOUS OPERATING MODE

I will not answer questions during this run.

For routine engineering decisions:

- Inspect existing patterns.
- Prefer the smallest safe fix.
- Preserve compatibility.
- Use feature flags for risky additive features where appropriate.
- Prefer reversible changes.
- Add tests.
- Document assumptions.
- Continue working.

For external blockers:

- Record what is missing.
- Do not fabricate credentials or results.
- Do not modify live infrastructure.
- Continue with independent work.

For destructive or high-risk actions:

- Do not execute them.
- Use disposable test environments or a non-destructive alternative.
- Record the blocker.

Do not spend the entire session planning, generating reports or repeatedly auditing without fixing code.

The required cycle is:

**Inspect → reproduce → prioritize → fix → test → benchmark → regression-test → review diff → commit safely → repeat.**

Work continuously while the available session and execution environment remain active. Do not stop after the first test pass if important audit areas remain. Do not claim that work continued after the process actually stopped.

If the session is approaching its time or context limit, prioritize a coherent, verified state over starting a risky large refactor. Save progress and produce an accurate handoff.

---

# 20. START NOW

Your first actions must be:

1. Read the repository instructions and the latest project status.
2. Inspect all three worktrees and Git state.
3. Locate and read the original assignment's exact criteria.
4. Run the independent Fable audit in read-only mode if available.
5. Establish the baseline.
6. Build the requirements-to-evidence matrix.
7. Produce the prioritized repair plan.
8. Start fixing the highest-risk confirmed defects immediately.
9. Add regression tests.
10. Repeat verification and benchmarking until the quality gates pass or the remaining blockers are fully evidenced.

**Do not respond with a proposed plan and wait for me. Execute the mission autonomously.**

Your success is measured by the quality of the verified implementation, the assignment criteria actually satisfied, the defects removed, and the reproducible evidence—not by the length of your report or the number of files changed.
