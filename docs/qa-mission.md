# BookLeaf — Production QA, adversarial testing & quality gate (Phase QA brief)

> Saved verbatim from the user's message of 2026-10-27 (00:50 IST).
> **When:** after the core assignment (Phase 1, `core-v1`) is complete — the morning of 2026-10-27.
> **Mode:** fully autonomous; the user asked not to be asked anything (except the blocking cases the brief itself lists).
> **Scope:** the core assignment only. Chat (Phase 2) and voice (Phase 3) are not part of this pass.
> **Note:** the pasted text ended mid-sentence in §11 ("…data boundaries, failure"). The rest of §11 and any
> later sections were not received. Tracked in `TASKS.md` (Q.10).
> Task breakdown: `TASKS.md` → "Phase QA".

---

## 1. Mission

You are now the **Principal QA Architect, Staff/Principal Software Engineer, AI Evaluation Engineer, Security Reviewer, Performance Engineer, and UX Quality Lead** for the BookLeaf technical assignment.

The core implementation is complete. Your mission is to determine whether it is genuinely reliable, accurate, secure, maintainable, fast, cost-efficient, intuitive, and production-ready under demanding evaluation.

This is not a superficial test pass. Treat this as a benchmark-grade engineering review where reviewers will actively search for weaknesses, incorrect answers, broken edge cases, security vulnerabilities, poor UX, architectural mistakes, and unreliable AI behaviour.

**Your objective is to find problems, reproduce them, fix them, and verify the fixes.**

Do not stop after the first successful run. Do not trust the implementation merely because you wrote it. Do not weaken tests, remove assertions, mock away real failures, or lower quality standards to achieve green results.

Work autonomously within the available environment and permissions. Do not wait for me to approve ordinary engineering decisions. Ask only when an essential external decision, unavailable credential, destructive action, or genuinely blocking ambiguity requires my input.

## 2. Non-negotiable operating rules

1. **Test the actual implementation.** Inspect the repository, running application, database, API routes, environment configuration, test suites, Git history, and existing E2E infrastructure before deciding what to test.
2. **Use the existing end-to-end testing tool.** Discover and use the project's existing E2E testing framework, browser automation tools, and available testing agents. In particular, inspect the existing `tester-army/e2e` infrastructure and determine how it is intended to be run. Use the actual supported commands and tools; do not invent capabilities.
3. **Use real browsers.** Test the running application in a real browser using the available browser automation infrastructure. Exercise actual navigation, forms, authentication, interactions, loading states, errors, responsive layouts, and complete user journeys. API tests alone are insufficient.
4. **Repeat testing.** Run deterministic regression suites repeatedly, run randomized or adversarial tests with reproducible seeds where appropriate, and run concurrency and failure-recovery tests where feasible. A single successful execution is not sufficient evidence.
5. **Use an independent top-tier reviewer.** Use the strongest available model for architecture, code-quality, security, AI evaluation, and quality-gate review. Keep this reviewer within a strict maximum allocation of **30% of the total available session/model budget**. Reserve the remaining capacity for implementation, execution, debugging, fixes, and regression tests. If budget consumption cannot be measured precisely, use conservative limits and record the uncertainty. Do not spend the reviewer budget on repetitive summaries.
6. **Reviewers must be independent.** Do not ask the reviewer merely to approve your implementation. Provide the relevant requirements, architecture, code, test evidence, and known failures. Ask it to actively identify defects and missing tests. Challenge its findings, verify them against the repository, and fix substantiated issues.
7. **Do not claim certainty you cannot prove.** Never claim 100% correctness, complete security, or production readiness simply because the available tests pass. Report exactly what was tested, what was not tested, what passed, and what remains uncertain.
8. **Preserve working functionality.** Make focused changes, protect existing behaviour, use safe database practices, and rerun regression tests after every meaningful fix.
9. **Never expose secrets.** Do not print, commit, or send API keys, tokens, credentials, or sensitive production data to a reviewer. Use synthetic test accounts and data.
10. **Do not modify unrelated projects.** Keep all changes within the BookLeaf assignment repository unless an explicitly authorized dependency requires otherwise. Do not modify Rebookit or unrelated infrastructure.
11. **Never fabricate evidence.** Do not invent browser runs, coverage figures, AI accuracy scores, latency results, reviewer feedback, or successful deployments. Distinguish real execution results from static analysis and assumptions.
12. **Do not stop at documentation.** Execute tests, investigate failures, make appropriate code changes, and rerun the affected tests.

## 3. Phase zero — establish the actual state

Before testing, inspect:

- `PLAN.md`, `TASKS.md`, `architecture.md`, the original assignment PDF, and the supplied sample data.
- The actual implementation, repository structure, package scripts, environment variables, database schema, migrations, seed data, API contracts, and Git status.
- Existing unit, integration, API, security, E2E, browser, and performance test infrastructure.
- Available browser automation, test runners, agents, connected tools, and independent-model review mechanisms.
- Existing AI provider integrations, prompts, deterministic business rules, validation, fallback behaviour, retry policies, and telemetry.
- The README, deployment configuration, and documented acceptance criteria.

Create a requirements-to-evidence matrix linking every assignment requirement to its implementation, tests, and current status.

Identify any difference between the intended architecture and actual implementation. Review whether the architecture still suits the delivered system. Change it only when a concrete defect, security risk, reliability issue, performance bottleneck, or significant maintainability problem justifies the change.

Do not rewrite working architecture merely to make it look sophisticated.

Establish a baseline before modifying anything. Record existing failures, flaky tests, known limitations, and current performance. Never conceal pre-existing defects by changing the baseline.

## 4. Phase one — comprehensive functional testing

Test all assignment requirements, not just the happy path.

### Authentication and authorization

Test:

- Login, logout, session expiration, invalid credentials, missing credentials, and malformed requests.
- Unauthorized access to protected routes and APIs.
- Attempts to access another author's records by changing IDs, query parameters, request bodies, or URLs.
- Role-based access control for every sensitive operation.
- Direct API requests that bypass the UI.
- Session handling, cookie attributes where applicable, CSRF protections where applicable, and security-sensitive redirects.
- Repeated requests, expired sessions, and concurrent requests from different users.

### Author portal and business data

Test:

- Correct author-specific books, royalty information, profile details, support history, and other required assignment data.
- Empty states, missing optional values, unusually long values, Unicode, punctuation, boundary values, and malformed data.
- Sorting, filtering, pagination, search, refresh, and navigation where implemented.
- Data consistency between the UI, API, database, and supplied sample dataset.
- Incorrect IDs, nonexistent records, duplicate submissions, stale data, and invalid transitions.

### Support tickets and workflow

Test the complete ticket lifecycle, including:

- Ticket creation, viewing, updates, replies, status changes, and all supported transitions.
- Validation errors, empty messages, very long messages, duplicate submissions, and concurrent updates.
- Author ownership and staff/admin permission boundaries.
- Ticket classification, priority assignment, draft responses, editing, and confirmation.
- AI failure, timeout, malformed output, and unavailable provider scenarios.
- Persistence, refresh, repeated actions, and recovery after errors.
- Any assignment-required workflow that is absent or only partially implemented.

Derive the exact expected behaviour from the assignment and actual implementation. Do not invent requirements and then report their absence as a defect.

## 5. Phase two — real-browser E2E testing

Use the existing E2E infrastructure and its supported agents. Run the application and test the real UI through an actual browser.

Cover complete journeys such as:

1. A new or seeded author logs in and sees only their own information.
2. The author navigates to the relevant book and royalty information.
3. The author creates a support ticket and receives understandable feedback.
4. AI classifies the issue and produces an appropriate draft where supported.
5. The author reviews, edits, and submits the draft through the intended workflow.
6. The author revisits the ticket and verifies persisted updates.
7. Staff or administrative users perform only the operations permitted by their roles.
8. Invalid input, failed API requests, AI outages, expired sessions, and network interruptions produce recoverable and understandable UI states.

For every critical journey:

- Verify visible behaviour and actual persisted outcomes.
- Capture screenshots, browser logs, console errors, failed network requests, and relevant test traces where supported.
- Check for race conditions, stale UI state, duplicate requests, unhandled errors, and misleading success notifications.
- Verify the browser is exercising the intended running build, not an old instance or mocked substitute.
- Confirm that test data is isolated and repeatable.
- Repeat critical journeys multiple times and investigate flaky results.

Use Chromium and additional browsers only where the existing environment supports them and the time/cost is justified. Do not claim cross-browser coverage without running it.

## 6. Phase three — adversarial edge-case testing

Think like a hostile evaluator attempting to break the application.

Test, where applicable:

- Empty, null, missing, unexpected, oversized, malformed, and incorrectly typed values.
- Minimum/maximum lengths, zero values, negative numbers, decimals, rounding, unusual currency formats, and large numbers.
- Unicode, emoji, non-Latin text, whitespace, newline characters, and right-to-left text.
- Invalid JSON, unexpected content types, malformed IDs, invalid enums, and unsupported methods.
- SQL injection, cross-site scripting, prompt injection, HTML injection, and unsafe rendering.
- Broken access control, IDOR, privilege escalation, and cross-author data leakage.
- Rate limiting, brute-force resistance, abuse of expensive AI endpoints, and resource exhaustion.
- Repeated clicks, duplicate submissions, race conditions, stale updates, and concurrent requests.
- Provider timeouts, connection resets, rate limits, invalid credentials, quota exhaustion, malformed responses, and partial failures.
- Database unavailability, transaction rollback, failed writes, and recovery after dependency restoration.
- Retries that could create duplicate tickets, messages, charges, or other side effects.
- Extremely long conversations and requests that exceed context or token limits.
- Unexpected LLM responses, refusal responses, unsupported claims, contradictory facts, and attempts to override system instructions.

Use safe, synthetic data. Never attack external systems or production resources. Do not run destructive tests against shared or production databases.

For randomized testing, record seeds and reproduce every discovered failure. Add a permanent regression test for each valid defect.

## 7. Phase four — AI pipeline quality and evaluation

The AI integration is a critical benchmark area. Evaluate it as a system, not merely as a successful API call.

First, identify each AI responsibility actually implemented: intent classification, priority classification, fact retrieval, answer generation, ticket drafting, or other assignment-required capabilities. Test each capability separately and then test the end-to-end pipeline.

### Build an evaluation dataset

Create a versioned, reproducible dataset using assignment-supported facts, sample data, and carefully constructed synthetic cases.

Include:

- Common author questions.
- Ambiguous and incomplete questions.
- Questions with multiple intents.
- Paraphrases of the same question.
- Questions containing spelling mistakes and informal language.
- Questions with unusual formatting, multilingual text, and irrelevant context.
- Questions whose answers depend on author-specific facts.
- Questions requiring calculations or comparisons.
- Questions for which the correct answer is unknown or unavailable.
- Conflicting, stale, or missing facts.
- Prompt injection and malicious instructions.
- Questions requiring a support ticket rather than an unsupported answer.
- Long inputs, context overflow, and repeated conversations.
- Provider failures, invalid model output, and malformed structured responses.

Define expected outcomes before evaluating the model. Use deterministic expected results wherever possible. Have the independent reviewer examine the dataset for blind spots, but do not let it silently replace the ground truth.

### Measure actual quality

Where applicable, report:

- Intent classification accuracy, precision, recall, and F1.
- Per-class confusion matrices, especially for rare or high-impact classes.
- Priority classification accuracy and critical misclassification rates.
- Factual correctness and unsupported-claim rate.
- Correct use of author-specific facts and absence of cross-author leakage.
- Appropriate abstention or ticket escalation when facts are insufficient.
- Structured-output validity and schema-validation failure rates.
- Correctness of calculations and business-rule decisions.
- Draft relevance, clarity, professionalism, and actionable content.
- Robustness against prompt injection and contradictory instructions.
- Repeatability across multiple runs for cases with model variability.

Do not use a single aggregate accuracy number to hide a serious failure in a critical category.

Use a separate, independently reviewed set of evaluation cases where practical. Do not tune prompts against every test case and then report the same cases as independent validation.

### Improve the pipeline

Investigate whether the existing design properly separates deterministic business logic from probabilistic model decisions.

Verify that:

- Deterministic calculations and authorization checks are not delegated to the LLM.
- The model receives only the minimum required, authorized context.
- Retrieval and fact selection are scoped to the authenticated author.
- The model cannot invent book, royalty, policy, or account facts.
- Unknown facts produce a safe abstention or the required ticket workflow.
- Outputs are validated before being displayed or persisted.
- Prompts and outputs are protected against injection and unsafe rendering.
- Retry, timeout, fallback, and provider-unavailable behaviour is bounded and understandable.
- Expensive or redundant calls are avoided.
- Any caching is safe for author-specific data and does not return stale or cross-user results.
- Logs do not expose sensitive user information or credentials.

Do not add unnecessary agents, model calls, frameworks, vector databases, or complex orchestration unless measured evidence demonstrates a real benefit.

## 8. Phase five — AI latency and cost optimization

Measure the complete request pipeline, not only the model's reported response time.

Measure and report, where available:

- End-to-end latency: p50, p95, and p99.
- Time to first useful response for streaming interactions, if implemented.
- Model latency, retrieval latency, validation time, and database time.
- Token usage and estimated cost per request.
- Cost per successfully resolved or correctly routed case where meaningful.
- Failure, timeout, retry, and fallback rates.
- Behaviour under realistic concurrency.
- Performance with short, long, and adversarial inputs.

Use actual provider usage and pricing information available in the environment. Clearly label estimates when exact billing data is unavailable. Never invent cost savings or claim a performance improvement without before-and-after measurements.

Look for redundant calls, unnecessarily large prompts, excessive context, slow sequential operations, inefficient database queries, N+1 queries, repeated retrieval, and avoidable retries.

Consider smaller/faster models for suitable low-risk tasks only if evaluation proves that quality remains acceptable. Use stronger models selectively where their additional capability materially improves outcomes.

Do not optimize speed by weakening factual grounding, authorization, validation, or safe fallback behaviour.

Establish realistic service targets from the assignment, observed baseline, provider constraints, and environment. Record the targets and rationale before judging results.

## 9. Phase six — API, database, security, and reliability

Validate:

- Every required API route, HTTP method, status code, schema, and error response.
- Request validation, response validation where implemented, pagination limits, and consistent error handling.
- Database relationships, constraints, migrations, transactions, indexes, and rollback/recovery behaviour.
- Author isolation at the service, query, and API layers.
- Secrets management, environment configuration, and absence of committed credentials.
- Appropriate CORS, cookie, security-header, and rate-limiting configuration.
- Logging, request correlation, error reporting, and safe diagnostic output.
- Dependency vulnerabilities and unsafe dependency versions using available tooling.
- Graceful shutdown, provider outages, database failures, and recovery.
- Build reproducibility and deployment configuration.

Do not perform destructive migrations or change shared infrastructure without explicit authorization. Review migration behaviour against a disposable test database where possible.

## 10. Phase seven — UI/UX independent review

Use a separate UI/UX review pass. If a suitable independent design-review agent or model is available, use it within the same overall 30% reviewer budget. Prefer static screenshots, sanitized UI evidence, and relevant component code instead of sending the entire repository.

Ask the reviewer to evaluate the product from two perspectives:

**Author experience**
- Can a non-technical author understand where to go and what to do?
- Are books, royalties, support tickets, and AI assistance clearly explained?
- Are actions, labels, statuses, errors, and next steps understandable?
- Is AI-generated content clearly presented for review rather than misleadingly treated as verified truth?
- Are forms simple, accessible, forgiving, and easy to complete?

**Internal team experience**
- Can staff understand ticket status, priority, classification, and response drafts?
- Are important actions and workflow transitions obvious?
- Are permissions and administrative controls clear?
- Can the team identify failures without seeing sensitive information?

Also review:

- Visual hierarchy, spacing, typography, consistency, and reusable components.
- Responsive behaviour at representative viewport sizes.
- Keyboard navigation, focus visibility, labels, contrast, and screen-reader semantics.
- Loading, empty, error, success, and disabled states.
- Accessibility issues and confusing or redundant interactions.
- Whether the existing Rebookit-inspired visual direction is consistent with the BookLeaf product.

Ask for specific, evidence-backed defects and proposed improvements, not vague aesthetic opinions. Implement improvements that materially improve usability without compromising the assignment scope. Retest all affected browser journeys.

## 11. Phase eight — independent top-model quality gate

Allocate no more than 30% of the total available model/session budget to independent review. Use the strongest available model for high-impact review tasks. Do not assume model availability, and do not pretend a review occurred if the tool cannot be accessed.

Conduct focused review passes:

1. **Architecture review:** requirement coverage, separation of concerns, data boundaries, failure

> _[Message ended here — the rest of §11 and any later sections were not received.]_
