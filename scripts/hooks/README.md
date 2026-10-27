# Git hooks (opt-in)

`pre-commit` formats and lint-fixes the staged files with `lint-staged` (`lint-staged.config.mjs`).
CI (`.github/workflows/ci.yml`) runs the full gate on every push and pull request, so the hook is
a fast local check, not the only one.

## Why opt-in

This machine sets a global hooks folder (`git config --global core.hooksPath`), for example a
react-doctor `pre-push` gate. Git runs only one hooks folder, so turning these hooks on in a way
that replaces the global folder would silently switch the global hooks off. Every hook here
therefore first runs the global hook of the same name (`run-global.sh`), and nothing is turned on
automatically.

## Turn on (this worktree only)

```bash
git config extensions.worktreeConfig true
git config --worktree core.hooksPath scripts/hooks
```

`--worktree` keeps other worktrees of the same repository on their current hooks.

## Turn off

```bash
git config --worktree --unset core.hooksPath
```
