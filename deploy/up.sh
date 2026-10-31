#!/usr/bin/env bash
# Brings the demo box up to the code in this folder. Called by bookleaf-deploy after the env file
# is rendered; safe to run again. Order: database up → backup → build → migrate (owner) → app role
# (idempotent, S.8) → start → seed (idempotent) → check both public HTTPS endpoints.
# Usage: deploy/up.sh /opt/bookleaf/.env.prod
set -euo pipefail

ENV_FILE=${1:?usage: up.sh <env-file>}
HERE=$(cd "$(dirname "$0")" && pwd)
BACKUP_DIR=${BOOKLEAF_BACKUP_DIR:-/opt/bookleaf/backups}
KEEP_BACKUPS=5
STATE_DIR=${BOOKLEAF_STATE_DIR:-/opt/bookleaf/state}
# A new id in deploy/demo-reset-id wipes the demo data once (database + Redis) and reseeds it.
RESET_ID=$(tr -d '[:space:]' <"$HERE/demo-reset-id" 2>/dev/null || true)
export BOOKLEAF_ENV_FILE=$ENV_FILE

compose() { docker compose -f "$HERE/docker-compose.prod.yml" --env-file "$ENV_FILE" "$@"; }
log() { printf '\n[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

# API_HOST / HOST_API_HOST for the checks below.
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

# The restricted app role's password (S.8). The secret may carry POSTGRES_APP_PASSWORD; without it
# a stable one is derived from POSTGRES_PASSWORD (one-way), so no secret change is needed. Exported
# so compose puts it into DATABASE_URL.
if [ -z "${POSTGRES_APP_PASSWORD:-}" ]; then
  POSTGRES_APP_PASSWORD=$(printf 'bookleaf_app:%s' "$POSTGRES_PASSWORD" | sha256sum | cut -d' ' -f1)
fi
export POSTGRES_APP_PASSWORD

backup_database() {
  mkdir -p "$BACKUP_DIR"
  local tables
  tables=$(compose exec -T postgres psql -U bookleaf -d bookleaf -tAc \
    "select count(*) from information_schema.tables where table_schema='public'")
  if [ "${tables:-0}" -eq 0 ]; then
    log "Empty database: nothing to back up."
    return
  fi
  local file
  file="$BACKUP_DIR/bookleaf-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
  compose exec -T postgres pg_dump -U bookleaf -d bookleaf | gzip >"$file"
  log "Backup written: $file"
  ls -1t "$BACKUP_DIR"/bookleaf-*.sql.gz | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f
}

# Wipes the demo database and shared state when deploy/demo-reset-id holds an id this box has not
# applied yet. The apps are stopped first; migrations and the seed below rebuild everything. The
# id is recorded only after the whole deploy succeeds, so a failed run resets again next time.
reset_demo_if_requested() {
  local applied=""
  [ -f "$STATE_DIR/demo-reset-applied" ] && applied=$(tr -d '[:space:]' <"$STATE_DIR/demo-reset-applied")
  if [ -z "$RESET_ID" ] || [ "$RESET_ID" = "$applied" ]; then
    log "Demo reset: nothing to do (id '${RESET_ID:-none}' already applied)."
    return
  fi
  log "Demo reset '$RESET_ID': wiping the database and Redis"
  compose stop api host-demo || true
  compose exec -T postgres psql -v ON_ERROR_STOP=1 -U bookleaf -d bookleaf -c \
    'DROP SCHEMA public CASCADE; CREATE SCHEMA public AUTHORIZATION bookleaf;'
  compose exec -T redis redis-cli FLUSHALL
}

record_demo_reset() {
  [ -n "$RESET_ID" ] || return 0
  mkdir -p "$STATE_DIR"
  printf '%s\n' "$RESET_ID" >"$STATE_DIR/demo-reset-applied"
}

wait_https() {
  local url=$1
  for _ in $(seq 1 60); do
    if curl -fsS --max-time 5 "$url" >/dev/null 2>&1; then
      log "OK $url"
      return 0
    fi
    sleep 5
  done
  echo "::error:: $url did not answer within 5 minutes" >&2
  return 1
}

log "Starting Postgres and Redis"
compose up -d --wait postgres redis

log "Backing up the database before migrations"
backup_database

reset_demo_if_requested

log "Building the apps"
compose build api host-demo

# Migrations run as the owner (DATABASE_ADMIN_URL). Then the restricted app role the API serves
# requests with is created or updated, with row access on every table (idempotent, every deploy).
log "Migrating the database and setting up the app role (row-level security)"
compose run --rm --no-deps -T api sh -c 'npx prisma migrate deploy && node dist/db-roles.js'

log "Starting the apps"
compose up -d --wait --wait-timeout 300 api host-demo
compose up -d caddy

# The seed also creates or updates the super admin (/platform) from PLATFORM_ADMIN_EMAIL and
# PLATFORM_ADMIN_PASSWORD in the env file; with neither set it skips that and says so.
log "Seeding (idempotent upserts)"
compose exec -T api node dist/seed.js

log "Checking the public endpoints"
wait_https "https://$API_HOST/health"
wait_https "https://$HOST_API_HOST/health"

record_demo_reset
log "Up: https://$API_HOST and https://$HOST_API_HOST"
