#!/usr/bin/env bash
# Deploy one prebuilt frontend (apps/<app>/dist) to its Vercel project as production.
# Usage: vercel-deploy.sh <web|host-web> <vercel-project-name>
# Env: VERCEL_TOKEN, VERCEL_SCOPE, API_HOST, HOST_API_HOST, PORTAL_URL; optional SUPPORT_ORIGIN.
# Static upload only: Vercel does no build, so the monorepo needs no Vercel settings. The project
# is created on the first run (vercel link --yes).
set -euo pipefail

APP=${1:?usage: vercel-deploy.sh <app> <project>}
PROJECT=${2:?usage: vercel-deploy.sh <app> <project>}
HERE=$(cd "$(dirname "$0")" && pwd)
DIST="$HERE/../../apps/$APP/dist"
VERCEL="npx --yes vercel@65"

[ -d "$DIST" ] || { echo "::error::$DIST not found; build first" >&2; exit 1; }
: "${VERCEL_TOKEN:?add the VERCEL_TOKEN repository secret}"
: "${VERCEL_SCOPE:?add the VERCEL_SCOPE repository variable}"

# The author dashboard loads embed.js from, and frames, the support app: its CSP names that origin.
# SUPPORT_ORIGIN (or WEB_URL) when given; otherwise the supportUrl the live host-demo hands the
# dashboard (/api/config), so the policy allows exactly what the page will load.
if [ "$APP" = "host-web" ]; then
  if [ -z "${SUPPORT_ORIGIN:-}" ]; then
    SUPPORT_ORIGIN=${WEB_URL:-$(curl -fsS --retry 5 --retry-delay 5 --retry-all-errors \
      "https://${HOST_API_HOST:?}/api/config" | node -e \
      'process.stdin.on("data",(d)=>process.stdout.write(JSON.parse(d).supportUrl))')}
  fi
  SUPPORT_ORIGIN=$(node -e 'process.stdout.write(new URL(process.argv[1]).origin)' "$SUPPORT_ORIGIN")
  export SUPPORT_ORIGIN
fi

# Only these placeholders are filled in; "$schema" and anything else stay as written.
envsubst '${API_HOST} ${HOST_API_HOST} ${PORTAL_URL} ${SUPPORT_ORIGIN}' \
  <"$HERE/../vercel/$APP.json.tpl" >"$DIST/vercel.json"
if grep -q '\${' "$DIST/vercel.json"; then
  echo "::error::unfilled placeholder in vercel.json (set API_HOST/HOST_API_HOST/PORTAL_URL)" >&2
  exit 1
fi

cd "$DIST"
$VERCEL link --yes --project "$PROJECT" --scope "$VERCEL_SCOPE" --token "$VERCEL_TOKEN" >/dev/null
$VERCEL deploy --prod --yes --scope "$VERCEL_SCOPE" --token "$VERCEL_TOKEN"
