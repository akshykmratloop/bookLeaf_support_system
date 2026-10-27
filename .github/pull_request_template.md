## What changed

<!-- One or two sentences: what this PR does and why. -->

## Checks

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` and `pnpm test` pass locally
- [ ] New behaviour has tests (API: success, each validation limit, 401, 403/cross-author, 404, 409)
- [ ] Every new input has a Zod schema (min, max, pattern, sanitising)
- [ ] Schema change? A migration is included, its SQL was read, and it is additive (expand → backfill → contract)
- [ ] No secrets in code, logs or responses
- [ ] UI change? Checked in light and dark, at phone and desktop widths, with the keyboard
- [ ] React change? `npx react-doctor@latest . --fail-on error --offline` reports no errors
- [ ] Docs updated (README, `docs/`, `TASKS.md`)

## How to test

<!-- Steps a reviewer can follow, with demo accounts or URLs. -->
