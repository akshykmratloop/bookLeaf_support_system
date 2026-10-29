#!/usr/bin/env bash
# Decide what this run deploys. Writes be=true|false and fe=true|false to $GITHUB_OUTPUT.
# Reads EVERY commit message in the push (not just the tip), like voice_agent's deploy-qa.
# Flags are whole words: "-deploy", "-deploy-be", "-deploy-fe" ("pre-deploy" does not count).
# Env: EVENT, TARGET (workflow_dispatch input), BEFORE, SHA.
set -euo pipefail

be=false
fe=false

if [ "$EVENT" = workflow_dispatch ]; then
  case "${TARGET:-both}" in
    both) be=true fe=true ;;
    backend) be=true ;;
    frontend) fe=true ;;
    *) echo "::error::unknown target $TARGET" && exit 1 ;;
  esac
else
  # `before` is all zeros on a branch's first push and missing after a force push.
  if git cat-file -e "${BEFORE}^{commit}" 2>/dev/null; then
    RANGE=("${BEFORE}..${SHA}")
  else
    RANGE=(-1 "${SHA}")
  fi
  # Messages are piped, never put on a command line, so nothing in them can run.
  MESSAGES="$(git log --format=%B "${RANGE[@]}")"
  flag() { grep -qE -- "(^|[[:space:]])-$1([[:space:].,;:!)]|$)" <<<"$MESSAGES"; }
  if flag deploy; then be=true fe=true; fi
  if flag deploy-be; then be=true; fi
  if flag deploy-fe; then fe=true; fi
  echo "commits checked: ${RANGE[*]}"
fi

echo "backend: $be, frontend: $fe"
{
  echo "be=$be"
  echo "fe=$fe"
} >>"$GITHUB_OUTPUT"
