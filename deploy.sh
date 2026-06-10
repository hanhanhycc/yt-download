#!/usr/bin/env sh
# Auto-deploy script for the yt-download container.
#
# Run this on the NAS (or any docker host) from the project folder that
# contains docker-compose.yml. It pulls the latest image from GHCR,
# recreates the container if the image actually changed, and prunes the
# leftover dangling images so the NAS disk doesn't fill up.
#
# Designed to be safe to run repeatedly (idempotent) and from cron/CI/SSH.
#
# Usage:
#   ./deploy.sh                # use compose file in the current dir
#   PROJECT_DIR=/volume1/docker/yt-download ./deploy.sh
#   COMPOSE_FILE=docker-compose.yml ./deploy.sh
#   FORCE_RECREATE=1 ./deploy.sh   # recreate even if image digest unchanged
#
# Synology DSM note: Synology's PATH for non-interactive shells is minimal,
# so we extend it to find /usr/local/bin/docker.

set -eu

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "$0")" && pwd)}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
SERVICE="${SERVICE:-app}"
FORCE_RECREATE="${FORCE_RECREATE:-0}"
LOG_FILE="${LOG_FILE:-$PROJECT_DIR/deploy.log}"

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

log() {
    printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$LOG_FILE"
}

die() {
    log "ERROR: $*"
    exit 1
}

cd "$PROJECT_DIR" || die "PROJECT_DIR not found: $PROJECT_DIR"
[ -f "$COMPOSE_FILE" ] || die "compose file not found: $PROJECT_DIR/$COMPOSE_FILE"

# Detect `docker compose` (plugin) vs legacy `docker-compose`.
if docker compose version >/dev/null 2>&1; then
    DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    DC="docker-compose"
else
    die "neither 'docker compose' nor 'docker-compose' is installed"
fi

log "==> Starting deploy for $SERVICE (project: $PROJECT_DIR)"

# Record the image digest BEFORE pulling so we can detect a no-op deploy.
OLD_ID="$($DC -f "$COMPOSE_FILE" images -q "$SERVICE" 2>/dev/null || true)"
log "current image id: ${OLD_ID:-<none>}"

log "==> docker compose pull"
$DC -f "$COMPOSE_FILE" pull "$SERVICE" 2>&1 | tee -a "$LOG_FILE"

NEW_ID="$($DC -f "$COMPOSE_FILE" images -q "$SERVICE" 2>/dev/null || true)"
log "new image id:     ${NEW_ID:-<none>}"

if [ "$FORCE_RECREATE" != "1" ] && [ -n "$OLD_ID" ] && [ "$OLD_ID" = "$NEW_ID" ]; then
    log "image unchanged — skipping recreate (set FORCE_RECREATE=1 to override)"
else
    log "==> docker compose up -d --force-recreate (recreating $SERVICE)"
    $DC -f "$COMPOSE_FILE" up -d --force-recreate --remove-orphans "$SERVICE" 2>&1 | tee -a "$LOG_FILE"
fi

log "==> docker image prune -f (clean up dangling layers)"
docker image prune -f 2>&1 | tee -a "$LOG_FILE" || true

log "==> Deploy finished OK"
