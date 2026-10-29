#!/usr/bin/env bash
# Brings the demo box up to the code in this folder. Called by bookleaf-deploy after the env file
# is rendered; safe to run again. Order: database up → backup → build → start (the API applies
# migrations on start) → seed (idempotent) → check both public HTTPS endpoints.
# Usage: deploy/up.sh /opt/bookleaf/.env.prod
set -euo pipefail

ENV_FILE=${1:?usage: up.sh <env-file>}
HERE=$(cd "$(dirname "$0")" && pwd)
BACKUP_DIR=${BOOKLEAF_BACKUP_DIR:-/opt/bookleaf/backups}
KEEP_BACKUPS=5
export BOOKLEAF_ENV_FILE=$ENV_FILE

compose() { docker compose -f "$HERE/docker-compose.prod.yml" --env-file "$ENV_FILE" "$@"; }
log() { printf '\n[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

# API_HOST / HOST_API_HOST for the checks below.
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

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

log "Building and starting the apps (the API applies migrations on start)"
compose build api host-demo
compose up -d --wait --wait-timeout 300 api host-demo
compose up -d caddy

log "Seeding (idempotent upserts)"
compose exec -T api node dist/seed.js

log "Checking the public endpoints"
wait_https "https://$API_HOST/health"
wait_https "https://$HOST_API_HOST/health"

log "Up: https://$API_HOST and https://$HOST_API_HOST"
