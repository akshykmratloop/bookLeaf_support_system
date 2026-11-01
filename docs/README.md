# Documentation

Start with the [project README](../README.md) for setup (`npm run local`) and the feature tour.

## Product and design

| Document | What it covers |
| --- | --- |
| [write-up.md](write-up.md) | Approach, priorities, trade-offs, and how this becomes a production system |
| [architecture.md](architecture.md) | How the system is built: apps, modules, data flow, diagrams |
| [integration.md](integration.md) | How to attach the support module to a product (host contract, widget, webhooks) |
| [deploy.md](deploy.md) | The live demo: AWS + Vercel setup, `-deploy` flags, checking the server, teardown |
| [saas/PLAN.md](saas/PLAN.md) | Multi-company SaaS design: workspaces, connectors, data model, roadmap |
| [eval-results.md](eval-results.md) | AI triage accuracy and cost on the evaluation set |
| [reference.md](reference.md) | Full reference: setup details, settings, demo data, screens, AI, API, security, assumptions, limitations, deployment |
| [videos/](videos/) | Scripts and subtitles of the three videos (the videos play in the [project README](../README.md)) |

## Quality and testing (`qa/`)

| Document | What it covers |
| --- | --- |
| [qa/final-report.md](qa/final-report.md) | Final QA result: checks, fixes and what is left |
| [qa/requirements-matrix.md](qa/requirements-matrix.md) | Every assignment requirement mapped to code and tests |
| [qa/security-report.md](qa/security-report.md) | Security review findings and fixes |
| [qa/browser-journeys.md](qa/browser-journeys.md) | Real-browser user journeys that were tested |
| [qa/ai-benchmark.md](qa/ai-benchmark.md) · [qa/draft-eval.md](qa/draft-eval.md) | AI classification and reply-draft quality |
| [qa/fable-review.md](qa/fable-review.md) · [qa/repair-plan.md](qa/repair-plan.md) | Independent audit and the fixes it led to |
| [qa/baseline.md](qa/baseline.md) · [qa/mission-brief.md](qa/mission-brief.md) | QA starting point and brief |

## Project history (`project/`)

How the work was planned and tracked, kept for transparency.

| Document | What it covers |
| --- | --- |
| [project/PLAN.md](project/PLAN.md) | Architecture decisions and their reasons |
| [project/TASKS.md](project/TASKS.md) | Task ledger with status and commit references |
| [project/IMPLEMENTATION_STATUS.md](project/IMPLEMENTATION_STATUS.md) | What was built, verified, and left open |
| [project/qa-mission.md](project/qa-mission.md) | The QA mission that was run before release |
