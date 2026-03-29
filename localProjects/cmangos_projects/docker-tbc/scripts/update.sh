#!/bin/bash
# ============================================================================
# CMaNGOS TBC — Auto-Update Script
# ============================================================================
# Checks for new commits in mangos-tbc and tbc-db on GitHub.
# If either has updates: backup DB → rebuild image → push to Docker Hub →
# graceful restart (the entrypoint handles applying DB migrations on boot).
#
# Usage:
#   ./update.sh                Run update check once
#   ./update.sh --install      Install systemd timer (daily at 3:00 AM)
#   ./update.sh --uninstall    Remove systemd timer
#   ./update.sh --status       Show timer status and last run
#   ./update.sh --help         Show help
#
# Designed to be run by systemd timer, cron, or manually.
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.yml"
DOCKERFILE="${PROJECT_DIR}/Dockerfile.server"
BACKUP_DIR="${PROJECT_DIR}/backups"
LOG_FILE="${PROJECT_DIR}/logs/update.log"
LOCK_FILE="/tmp/cmangos-tbc-update.lock"

DOCKER_IMAGE="semorgana/cmangos-tbc:latest"
UPSTREAM_REPO="https://github.com/cmangos/mangos-tbc.git"
TBCDB_REPO="https://github.com/cmangos/tbc-db.git"

SERVICE_NAME="cmangos-tbc-update"

# Container names
DB_CONTAINER="cmangos-tbc-db"
SERVER_CONTAINER="cmangos-tbc-server"

# Database names
MANGOS_DB="tbcmangos"
CHARACTERS_DB="tbccharacters"
REALMD_DB="tbcrealmd"
LOGS_DB="tbclogs"

# ============================================================================
# Logging
# ============================================================================

log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
    echo "$msg"
    mkdir -p "$(dirname "$LOG_FILE")"
    echo "$msg" >> "$LOG_FILE"
}

# ============================================================================
# Locking (prevent concurrent runs)
# ============================================================================

acquire_lock() {
    if [ -f "$LOCK_FILE" ]; then
        local pid
        pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            log "Another update process is running (PID: $pid). Exiting."
            exit 0
        fi
        rm -f "$LOCK_FILE"
    fi
    echo $$ > "$LOCK_FILE"
    trap 'rm -f "$LOCK_FILE"' EXIT
}

# ============================================================================
# Version detection
# ============================================================================

get_current_hash() {
    docker exec "$SERVER_CONTAINER" cat /opt/cmangos/COMMIT_HASH 2>/dev/null || echo "none"
}

get_current_db_hash() {
    docker exec "$SERVER_CONTAINER" cat /opt/cmangos/tbc-db/COMMIT_HASH 2>/dev/null || echo "none"
}

get_upstream_hash() {
    local repo="$1"
    git ls-remote "$repo" HEAD 2>/dev/null | cut -f1 || echo "error"
}

# ============================================================================
# Backup
# ============================================================================

create_backup() {
    mkdir -p "$BACKUP_DIR"
    local timestamp
    timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="${BACKUP_DIR}/pre_update_${timestamp}.sql"

    log "Creating pre-update backup: ${backup_file}"
    docker exec "$DB_CONTAINER" mariadb-dump -uroot -p"${MYSQL_ROOT_PASSWORD:-mangos_root_password}" \
        --databases ${MANGOS_DB} ${CHARACTERS_DB} ${REALMD_DB} ${LOGS_DB} \
        --single-transaction --quick > "$backup_file" 2>/dev/null

    log "Backup size: $(du -sh "$backup_file" | cut -f1)"

    # Keep only last 10 update backups
    local count
    count=$(ls -1 "${BACKUP_DIR}"/pre_update_*.sql 2>/dev/null | wc -l)
    if [ "$count" -gt 10 ]; then
        ls -1t "${BACKUP_DIR}"/pre_update_*.sql | tail -n +11 | xargs rm -f
        log "Rotated old backups (kept last 10)"
    fi
}

# ============================================================================
# Build & push
# ============================================================================

build_image() {
    log "Building new server image: ${DOCKER_IMAGE}"
    docker build \
        --no-cache \
        -t "$DOCKER_IMAGE" \
        -f "$DOCKERFILE" \
        "$PROJECT_DIR" 2>&1 | tee -a "$LOG_FILE"

    if [ "${PIPESTATUS[0]}" -ne 0 ]; then
        log "ERROR: Build failed!"
        return 1
    fi
    log "Build successful"
}

push_image() {
    log "Pushing image to Docker Hub: ${DOCKER_IMAGE}"
    docker push "$DOCKER_IMAGE" 2>&1 | tee -a "$LOG_FILE"
    if [ "${PIPESTATUS[0]}" -ne 0 ]; then
        log "WARNING: Push failed (continuing anyway)"
        return 1
    fi
    log "Push successful"
}

# ============================================================================
# Server restart (graceful)
# ============================================================================

restart_server() {
    log "Graceful restart: stopping server container..."
    docker compose -f "$COMPOSE_FILE" stop cmangos-tbc-server 2>/dev/null || true

    log "Pulling/recreating with new image..."
    docker compose -f "$COMPOSE_FILE" up -d --force-recreate cmangos-tbc-server

    # Wait for server health check (mangosd process running)
    log "Waiting for server to start..."
    local retries=60
    while [ $retries -gt 0 ]; do
        if docker exec "$SERVER_CONTAINER" pgrep -x mangosd >/dev/null 2>&1; then
            log "Server is running!"
            return 0
        fi
        sleep 5
        retries=$((retries - 1))
    done

    log "WARNING: Server may not have started properly. Check logs."
    return 1
}

# ============================================================================
# Main update check
# ============================================================================

check_and_update() {
    acquire_lock

    log "========================================="
    log "  TBC Update Check Started"
    log "========================================="

    # Check if services are running
    if ! docker compose -f "$COMPOSE_FILE" ps --status running cmangos-tbc-server >/dev/null 2>&1; then
        log "Server is not running. Skipping update check."
        return 0
    fi

    # Get current and upstream hashes
    local current_mangos_hash upstream_mangos_hash
    local current_db_hash upstream_db_hash
    current_mangos_hash=$(get_current_hash)
    current_db_hash=$(get_current_db_hash)
    upstream_mangos_hash=$(get_upstream_hash "$UPSTREAM_REPO")
    upstream_db_hash=$(get_upstream_hash "$TBCDB_REPO")

    log "mangos-tbc : current=${current_mangos_hash:0:12}  upstream=${upstream_mangos_hash:0:12}"
    log "tbc-db     : current=${current_db_hash:0:12}  upstream=${upstream_db_hash:0:12}"

    # Determine what changed
    local mangos_updated=false
    local db_updated=false
    if [ "$current_mangos_hash" != "$upstream_mangos_hash" ] && [ "$upstream_mangos_hash" != "error" ]; then
        log ">> mangos-tbc has new commits!"
        mangos_updated=true
    fi
    if [ "$current_db_hash" != "$upstream_db_hash" ] && [ "$upstream_db_hash" != "error" ]; then
        log ">> tbc-db has new commits!"
        db_updated=true
    fi

    if [ "$mangos_updated" = "false" ] && [ "$db_updated" = "false" ]; then
        log "Everything is up to date. No action needed."
        return 0
    fi

    # === Perform update ===
    log "Starting update process..."

    # Step 1: Backup database
    create_backup

    # Step 2: Rebuild image
    if ! build_image; then
        log "ERROR: Build failed. Aborting update. Database was NOT modified."
        return 1
    fi

    # Step 3: Push to Docker Hub
    push_image || true  # Non-fatal

    # Step 4: Graceful restart
    restart_server

    # Step 5: Verify
    local new_mangos_hash new_db_hash
    new_mangos_hash=$(get_current_hash)
    new_db_hash=$(get_current_db_hash)
    log "Update complete!"
    log "  mangos-tbc: ${current_mangos_hash:0:12} -> ${new_mangos_hash:0:12}"
    log "  tbc-db:     ${current_db_hash:0:12} -> ${new_db_hash:0:12}"

    # Clean up old images
    docker image prune -f 2>/dev/null || true

    log "========================================="
    log "  TBC Update Check Finished"
    log "========================================="
}

# ============================================================================
# Systemd timer management
# ============================================================================

install_timer() {
    local script_path
    script_path=$(realpath "$0")
    local work_dir
    work_dir=$(dirname "$script_path")

    echo "Installing systemd timer for daily 3:10 AM TBC update check..."

    sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null << EOF
[Unit]
Description=CMaNGOS TBC Auto-Update
After=docker.service
Wants=docker.service

[Service]
Type=oneshot
ExecStart=${script_path}
User=$(whoami)
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
WorkingDirectory=${work_dir}
# Generous timeout: build can take 30+ minutes on aarch64
TimeoutStartSec=3600
EOF

    sudo tee /etc/systemd/system/${SERVICE_NAME}.timer > /dev/null << EOF
[Unit]
Description=CMaNGOS TBC Daily Update Check (3:10 AM)

[Timer]
OnCalendar=*-*-* 03:10:00
RandomizedDelaySec=300
Persistent=true

[Install]
WantedBy=timers.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable --now ${SERVICE_NAME}.timer

    echo ""
    echo "Installed and enabled:"
    echo "  /etc/systemd/system/${SERVICE_NAME}.service"
    echo "  /etc/systemd/system/${SERVICE_NAME}.timer"
    echo ""
    echo "Timer fires daily at 03:10 (±5min jitter)."
    echo "Check status: ./update.sh --status"
    echo "Run now:      ./update.sh"
    echo "Uninstall:    ./update.sh --uninstall"
}

uninstall_timer() {
    echo "Removing systemd timer..."
    sudo systemctl disable --now ${SERVICE_NAME}.timer 2>/dev/null || true
    sudo rm -f /etc/systemd/system/${SERVICE_NAME}.service
    sudo rm -f /etc/systemd/system/${SERVICE_NAME}.timer
    sudo systemctl daemon-reload
    echo "Done. Timer removed."
}

show_status() {
    echo "=== Systemd Timer ==="
    if systemctl is-enabled ${SERVICE_NAME}.timer &>/dev/null; then
        systemctl status ${SERVICE_NAME}.timer --no-pager 2>/dev/null || true
        echo ""
        echo "=== Next trigger ==="
        systemctl list-timers ${SERVICE_NAME}.timer --no-pager 2>/dev/null || true
    else
        echo "Timer is NOT installed."
        echo "Run: ./update.sh --install"
    fi

    echo ""
    echo "=== Last update log ==="
    if [ -f "$LOG_FILE" ]; then
        tail -20 "$LOG_FILE"
    else
        echo "(no log file yet)"
    fi

    echo ""
    echo "=== Current versions ==="
    local cur_mangos cur_db
    cur_mangos=$(get_current_hash 2>/dev/null)
    cur_db=$(get_current_db_hash 2>/dev/null)
    echo "mangos-tbc: ${cur_mangos:0:12}"
    echo "tbc-db:     ${cur_db:0:12}"
}

# ============================================================================
# Main
# ============================================================================

case "${1:-}" in
    --install|-i)
        install_timer
        ;;
    --uninstall|-u)
        uninstall_timer
        ;;
    --status|-s)
        show_status
        ;;
    --help|-h)
        echo "CMaNGOS TBC — Auto-Update Script"
        echo ""
        echo "Usage:"
        echo "  ./update.sh              Run update check once (manual)"
        echo "  ./update.sh --install    Install systemd timer (daily 3:10 AM)"
        echo "  ./update.sh --uninstall  Remove systemd timer"
        echo "  ./update.sh --status     Show timer status and versions"
        echo "  ./update.sh --help       This help"
        echo ""
        echo "What happens during an update:"
        echo "  1. Check GitHub for new commits (mangos-tbc + tbc-db)"
        echo "  2. If changes found: backup DB -> rebuild Docker image"
        echo "  3. Push image to Docker Hub (semorgana/cmangos-tbc:latest)"
        echo "  4. Graceful restart (30s shutdown grace period)"
        echo "  5. On boot, entrypoint.sh applies pending SQL migrations"
        echo ""
        echo "Log file: ${LOG_FILE}"
        ;;
    *)
        check_and_update
        ;;
esac
