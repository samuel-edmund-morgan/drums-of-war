#!/usr/bin/env bash
# =============================================================================
# VMaNGOS Classic — Deployment & Migration Script
# =============================================================================
# Deploys vmangos-classic Docker stack and imports Samuel's character
# from cmangos-classic backup.
#
# Usage:
#   ./deploy.sh              # Full deploy: stack + migration
#   ./deploy.sh stack-only   # Just start the Docker stack
#   ./deploy.sh migrate-only # Just run migration (stack must be running)
#
# Prerequisites:
#   - Docker and docker compose installed
#   - Port 3306, 3724, 8085 available
#   - samuel_FULL_backup.sql in the same directory or parent
#   - Extracted client data available (maps/vmaps/mmaps/dbc)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="/opt/vmangos-classic"
BACKUP_FILE="${SCRIPT_DIR}/samuel_FULL_backup.sql"
MIGRATION_SQL="${SCRIPT_DIR}/migrate_samuel_to_vmangos.sql"
DB_CONTAINER="vmangos-db"
DB_ROOT_PASS="${MARIADB_ROOT_PASSWORD:-${MARIADB_ROOT_PASSWORD}}"
ACCOUNT_USER="${VMANGOS_ACCOUNT_USER:-SAMUEL}"
ACCOUNT_PASS="${VMANGOS_ACCOUNT_PASS:-samuel}"

log() { printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$1"; }
err() { log "ERROR: $1" >&2; exit 1; }

wait_for_db() {
    log "Waiting for database to be ready..."
    local max_wait=120
    local elapsed=0
    while ! docker exec "$DB_CONTAINER" mariadb -u root -p"$DB_ROOT_PASS" -e "SELECT 1" &>/dev/null; do
        sleep 2
        elapsed=$((elapsed + 2))
        if [ "$elapsed" -ge "$max_wait" ]; then
            err "Database not ready after ${max_wait}s"
        fi
    done
    log "Database is ready."
}

deploy_stack() {
    log "=== Deploying VMaNGOS Classic Stack ==="

    # Create deployment directory
    sudo mkdir -p "$DEPLOY_DIR"/{custom-sql,config}

    # Copy compose and config files
    if [ "$(realpath "$SCRIPT_DIR/docker-compose.yml")" != "$(realpath "$DEPLOY_DIR/docker-compose.yml")" ]; then
        sudo cp "$SCRIPT_DIR/docker-compose.yml" "$DEPLOY_DIR/"
    fi
    if [ -d "$SCRIPT_DIR/config" ]; then
        sudo cp "$SCRIPT_DIR/config/"*.conf "$DEPLOY_DIR/config/" 2>/dev/null || true
    fi

    # Verify extracted client data exists (docker-compose binds /opt/cmangos-classic/data/ directly)
    if [ ! -d "/opt/cmangos-classic/data/maps" ]; then
        err "Extracted client data not found at /opt/cmangos-classic/data/maps. Cannot start vmangos."
    fi
    log "Extracted client data found at /opt/cmangos-classic/data/"

    # Start the stack
    cd "$DEPLOY_DIR"
    docker compose up -d

    wait_for_db
    log "Stack deployed successfully."
}

run_migration() {
    log "=== Running Character Migration ==="

    # Verify backup file exists
    [ -f "$BACKUP_FILE" ] || err "Backup file not found: $BACKUP_FILE"
    [ -f "$MIGRATION_SQL" ] || err "Migration SQL not found: $MIGRATION_SQL"

    wait_for_db

    # Step 1: Create staging database and import cmangos backup
    log "Creating staging database..."
    docker exec -i "$DB_CONTAINER" mariadb -u root -p"$DB_ROOT_PASS" \
        -e "DROP DATABASE IF EXISTS cmangos_staging; CREATE DATABASE cmangos_staging;"

    log "Importing cmangos backup into staging database..."
    docker exec -i "$DB_CONTAINER" mariadb -u root -p"$DB_ROOT_PASS" \
        cmangos_staging < "$BACKUP_FILE"

    # Step 2: Create account via mangosd console (VMaNGOS uses SRP6, not sha_pass_hash)
    log "Waiting for mangosd to be ready..."
    local mangosd_ready=0
    for i in $(seq 1 30); do
        if docker logs vmangos-mangosd 2>&1 | grep -q "World initialized"; then
            mangosd_ready=1
            break
        fi
        sleep 2
    done
    [ "$mangosd_ready" -eq 1 ] || err "mangosd did not initialize within 60s"

    log "Creating account '$ACCOUNT_USER' via mangosd console..."
    { echo "account create $ACCOUNT_USER $ACCOUNT_PASS"; sleep 3; } \
        | script -q -c "docker attach --sig-proxy=false vmangos-mangosd" /dev/null &
    local attach_pid=$!
    sleep 5
    kill "$attach_pid" 2>/dev/null || true
    wait "$attach_pid" 2>/dev/null || true

    # Get the new account ID for character binding
    local acct_id
    acct_id=$(docker exec "$DB_CONTAINER" mariadb -u root -p"$DB_ROOT_PASS" -N -e \
        "SELECT id FROM realmd.account WHERE username=UPPER('$ACCOUNT_USER');")
    [ -n "$acct_id" ] || err "Account '$ACCOUNT_USER' was not created. Check mangosd logs."
    log "Account '$ACCOUNT_USER' created with id=$acct_id"

    # Step 3: Run migration SQL
    log "Running character migration (cmangos_staging → characters)..."
    docker exec -i "$DB_CONTAINER" mariadb -u root -p"$DB_ROOT_PASS" \
        characters < "$MIGRATION_SQL"

    # Step 4: Bind migrated characters to the new account
    log "Binding characters to account $acct_id..."
    docker exec -i "$DB_CONTAINER" mariadb -u root -p"$DB_ROOT_PASS" \
        -e "UPDATE characters.characters SET account=$acct_id WHERE account=1;"

    # Step 5: Clean up staging database
    log "Cleaning up staging database..."
    docker exec -i "$DB_CONTAINER" mariadb -u root -p"$DB_ROOT_PASS" \
        -e "DROP DATABASE IF EXISTS cmangos_staging;"

    # Step 6: Restart mangosd (it was stopped by docker attach pipe)
    log "Restarting mangosd..."
    cd "$DEPLOY_DIR"
    docker compose up -d vmangos-mangosd

    log "Migration complete!"
    log ""
    log "=== Connection Info ==="
    log "  Realmlist (in realmlist.wtf): set realmlist 64.181.205.211"
    log "  Auth port: 3724 (realmd external port)"
    log "  Game port: 8085 (mangosd external port)"
    log "  Account:   $ACCOUNT_USER / $ACCOUNT_PASS"
    log "  Character: Samuel (Human Warlock, Level 60)"
}

# Main
case "${1:-full}" in
    stack-only)
        deploy_stack
        ;;
    migrate-only)
        run_migration
        ;;
    full)
        deploy_stack
        run_migration
        ;;
    *)
        echo "Usage: $0 [full|stack-only|migrate-only]"
        exit 1
        ;;
esac

log "Done."
