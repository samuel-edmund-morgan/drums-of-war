#!/bin/bash
# ============================================================================
# CMaNGOS TBC — Server Entrypoint
# ============================================================================
# This script:
#   1. Initializes config files from .dist templates if not present
#   2. Waits for MariaDB to be ready
#   3. Runs DB initialization if databases are empty (first boot)
#   4. Starts realmd in background
#   5. Starts mangosd in foreground
#   6. Handles graceful shutdown (SIGTERM/SIGINT)
# ============================================================================

set -e

CMANGOS_DIR="/opt/cmangos"
BIN_DIR="${CMANGOS_DIR}/bin"
ETC_DIR="${CMANGOS_DIR}/etc"
DATA_DIR="${CMANGOS_DIR}/data"
LOGS_DIR="${CMANGOS_DIR}/logs"

# DB connection from environment (or defaults)
DB_HOST="${DB_HOST:-cmangos-tbc-db}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-mangos}"
DB_PASS="${DB_PASS:-mangos}"
DB_ROOT_PASS="${MYSQL_ROOT_PASSWORD:-mangos}"

# PIDs for cleanup
REALMD_PID=""
MANGOSD_PID=""

# ============================================================================
# Signal handling for graceful shutdown
# ============================================================================
cleanup() {
    echo ""
    echo "[entrypoint] Received shutdown signal. Initiating graceful shutdown..."

    if [ -n "$MANGOSD_PID" ] && kill -0 "$MANGOSD_PID" 2>/dev/null; then
        echo "[entrypoint] Stopping mangosd (PID: $MANGOSD_PID)..."
        kill -TERM "$MANGOSD_PID" 2>/dev/null
        local count=0
        while kill -0 "$MANGOSD_PID" 2>/dev/null && [ $count -lt 30 ]; do
            sleep 1
            count=$((count + 1))
        done
        if kill -0 "$MANGOSD_PID" 2>/dev/null; then
            echo "[entrypoint] mangosd did not stop in time, forcing..."
            kill -9 "$MANGOSD_PID" 2>/dev/null || true
        fi
        echo "[entrypoint] mangosd stopped."
    fi

    if [ -n "$REALMD_PID" ] && kill -0 "$REALMD_PID" 2>/dev/null; then
        echo "[entrypoint] Stopping realmd (PID: $REALMD_PID)..."
        kill -TERM "$REALMD_PID" 2>/dev/null
        wait "$REALMD_PID" 2>/dev/null || true
        echo "[entrypoint] realmd stopped."
    fi

    echo "[entrypoint] Graceful shutdown complete."
    exit 0
}

trap cleanup SIGTERM SIGINT SIGHUP

# ============================================================================
# Initialize config files
# ============================================================================
init_configs() {
    echo "[entrypoint] Checking configuration files..."

    if [ ! -f "${ETC_DIR}/mangosd.conf.dist" ] && [ -d "${CMANGOS_DIR}/etc.dist" ]; then
        echo "[entrypoint] Restoring default config templates to mounted etc/ directory..."
        cp -n "${CMANGOS_DIR}/etc.dist"/* "${ETC_DIR}/" 2>/dev/null || true
    fi

    local configs="mangosd.conf realmd.conf anticheat.conf"
    local optional_configs="ahbot.conf playerbot.conf mods.conf"

    for conf in $configs; do
        if [ ! -f "${ETC_DIR}/${conf}" ]; then
            if [ -f "${ETC_DIR}/${conf}.dist" ]; then
                echo "[entrypoint] Creating ${conf} from template..."
                cp "${ETC_DIR}/${conf}.dist" "${ETC_DIR}/${conf}"
            else
                echo "[entrypoint] WARNING: ${conf}.dist not found!"
            fi
        fi
    done

    for conf in $optional_configs; do
        if [ ! -f "${ETC_DIR}/${conf}" ] && [ -f "${ETC_DIR}/${conf}.dist" ]; then
            echo "[entrypoint] Creating ${conf} from template..."
            cp "${ETC_DIR}/${conf}.dist" "${ETC_DIR}/${conf}"
        fi
    done

    echo "[entrypoint] Configuration files ready."
}

# ============================================================================
# Wait for MariaDB to be ready
# ============================================================================
wait_for_db() {
    echo "[entrypoint] Waiting for MariaDB at ${DB_HOST}:${DB_PORT}..."

    local retries=0
    local max_retries=60

    while [ $retries -lt $max_retries ]; do
        if mysql -h"${DB_HOST}" -P"${DB_PORT}" -uroot -p"${DB_ROOT_PASS}" -e "SELECT 1" &>/dev/null; then
            echo "[entrypoint] MariaDB is ready!"
            return 0
        fi
        retries=$((retries + 1))
        echo "[entrypoint] Waiting for MariaDB... (attempt ${retries}/${max_retries})"
        sleep 5
    done

    echo "[entrypoint] ERROR: MariaDB not available after ${max_retries} attempts!"
    exit 1
}

# ============================================================================
# Check if DB needs initialization
# ============================================================================
check_db_initialized() {
    local result
    result=$(mysql -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" -p"${DB_PASS}" \
        -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='tbcmangos' AND table_name='db_version'" 2>/dev/null)

    if [ "$result" = "1" ]; then
        local version
        version=$(mysql -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" -p"${DB_PASS}" \
            -N -e "SELECT COUNT(*) FROM tbcmangos.db_version" 2>/dev/null)
        if [ "$version" -gt "0" ] 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

# ============================================================================
# Verify map data exists
# ============================================================================
check_data() {
    echo "[entrypoint] Checking map data in ${DATA_DIR}..."

    local missing=0
    for dir in dbc maps vmaps; do
        if [ ! -d "${DATA_DIR}/${dir}" ] || [ -z "$(ls -A "${DATA_DIR}/${dir}" 2>/dev/null)" ]; then
            echo "[entrypoint] ERROR: Required data directory '${dir}' is missing or empty!"
            missing=1
        fi
    done

    if [ $missing -eq 1 ]; then
        echo "[entrypoint] ERROR: Map data is incomplete. Please run map extraction first."
        exit 1
    fi

    for dir in mmaps Cameras Buildings; do
        if [ ! -d "${DATA_DIR}/${dir}" ] || [ -z "$(ls -A "${DATA_DIR}/${dir}" 2>/dev/null)" ]; then
            echo "[entrypoint] WARNING: Optional data directory '${dir}' is missing or empty."
        fi
    done

    echo "[entrypoint] Map data OK."
}

# ============================================================================
# Apply pending DB updates (after image rebuild)
# ============================================================================
apply_db_updates() {
    echo "[entrypoint] Checking for pending database updates..."

    local TBCDB_DIR="${CMANGOS_DIR}/tbc-db"
    local SQL_DIR="${CMANGOS_DIR}/sql"
    local MYSQL_CMD="mysql -h${DB_HOST} -P${DB_PORT} -u${DB_USER} -p${DB_PASS}"
    local total_applied=0

    apply_updates_for_db() {
        local db_name="$1"
        local update_dir="$2"
        local version_table="$3"
        local file_pattern="$4"
        local applied=0

        if [ ! -d "$update_dir" ]; then
            return 0
        fi

        local current_col
        current_col=$(${MYSQL_CMD} -N -e \
            "SELECT COLUMN_NAME FROM information_schema.columns
             WHERE TABLE_SCHEMA='${db_name}' AND TABLE_NAME='${version_table}'
             AND COLUMN_NAME LIKE 'required_z%'
             ORDER BY COLUMN_NAME DESC LIMIT 1" 2>/dev/null)

        if [ -z "$current_col" ]; then
            echo "[entrypoint]   WARNING: Cannot detect version for ${db_name}.${version_table}"
            return 0
        fi

        local regex='z([0-9]+)_([0-9]+)'
        if [[ "$current_col" =~ $regex ]]; then
            local last_rev=$(( 10#${BASH_REMATCH[1]}${BASH_REMATCH[2]} ))
        else
            echo "[entrypoint]   WARNING: Cannot parse revision from ${current_col}"
            return 0
        fi

        for f in "${update_dir}"/${file_pattern}; do
            [ -f "$f" ] || continue
            local fname=$(basename "$f")
            local cur_rev
            cur_rev=$(echo "$fname" | sed "s/^z\([0-9]*\)_\([0-9]*\).*/\1\2/")
            if [ "$cur_rev" -gt "$last_rev" ] 2>/dev/null; then
                echo "[entrypoint]   Applying: ${fname} → ${db_name}"
                if ${MYSQL_CMD} "${db_name}" < "$f" 2>/dev/null; then
                    applied=$((applied + 1))
                else
                    echo "[entrypoint]   WARNING: Failed to apply ${fname} (may already be applied)"
                fi
            fi
        done

        if [ $applied -gt 0 ]; then
            echo "[entrypoint]   ${db_name}: ${applied} core updates applied."
            total_applied=$((total_applied + applied))
        fi
    }

    apply_updates_for_db "tbcmangos"      "${SQL_DIR}/updates/mangos"      "db_version"              "*_mangos_*.sql"
    apply_updates_for_db "tbccharacters"   "${SQL_DIR}/updates/characters"  "character_db_version"    "*_characters_*.sql"
    apply_updates_for_db "tbcrealmd"       "${SQL_DIR}/updates/realmd"      "realmd_db_version"       "*_realmd_*.sql"
    apply_updates_for_db "tbclogs"         "${SQL_DIR}/updates/logs"        "logs_db_version"         "*_logs_*.sql"

    if [ -d "${TBCDB_DIR}" ] && [ -f "${TBCDB_DIR}/InstallFullDB.sh" ]; then
        cd "${TBCDB_DIR}"

        if [ ! -f "InstallFullDB.config" ]; then
            cat > InstallFullDB.config << DBCONFIG
MYSQL_HOST="${DB_HOST}"
MYSQL_PORT="${DB_PORT}"
MYSQL_USERNAME="${DB_USER}"
MYSQL_PASSWORD="${DB_PASS}"
MYSQL_PATH="/usr/bin/mysql"
MYSQL_DUMP_PATH="/usr/bin/mariadb-dump"
WORLD_DB_NAME="tbcmangos"
CHAR_DB_NAME="tbccharacters"
REALM_DB_NAME="tbcrealmd"
LOGS_DB_NAME="tbclogs"
CORE_PATH="${CMANGOS_DIR}"
LOCALES="YES"
DEV_UPDATES="NO"
AHBOT="NO"
PLAYERBOTS_DB="NO"
FORCE_WAIT="NO"
DBCONFIG
        fi

        mkdir -p "${CMANGOS_DIR}/src/shared"
        if [ ! -f "${CMANGOS_DIR}/src/shared/revision_sql.h" ]; then
            echo '#define REVISION_DB_MANGOS "required_z2815_s2429_01_mangos_spell_template"' \
                > "${CMANGOS_DIR}/src/shared/revision_sql.h"
        fi

        echo "[entrypoint]   Running InstallFullDB.sh (core updates)..."
        printf '3\n9\n' | bash InstallFullDB.sh 2>&1 | grep -E "Applying|PROCESSED|ERROR|error|FOUND" || true

        cd "${CMANGOS_DIR}"
    fi

    if [ $total_applied -gt 0 ]; then
        echo "[entrypoint] Database updates complete (${total_applied} files applied)."
    else
        echo "[entrypoint] Database is up to date."
    fi
}

# ============================================================================
# Main execution
# ============================================================================
main() {
    echo "============================================="
    echo "  CMaNGOS TBC Server"
    echo "  Commit: $(cat ${CMANGOS_DIR}/COMMIT_HASH 2>/dev/null || echo 'unknown')"
    echo "============================================="

    init_configs
    check_data
    wait_for_db

    if ! check_db_initialized; then
        echo "[entrypoint] Database not initialized. Running first-time setup..."
        bash "${CMANGOS_DIR}/scripts/db-init.sh"
        echo "[entrypoint] Database initialization complete."
    else
        echo "[entrypoint] Database already initialized."
        apply_db_updates
    fi

    chown -R mangos:mangos "${LOGS_DIR}" "${ETC_DIR}" 2>/dev/null || true

    echo "[entrypoint] Starting realmd..."
    gosu mangos "${BIN_DIR}/realmd" -c "${ETC_DIR}/realmd.conf" &
    REALMD_PID=$!
    echo "[entrypoint] realmd started (PID: ${REALMD_PID})"

    sleep 2

    echo "[entrypoint] Starting mangosd..."
    gosu mangos "${BIN_DIR}/mangosd" -c "${ETC_DIR}/mangosd.conf" &
    MANGOSD_PID=$!
    echo "[entrypoint] mangosd started (PID: ${MANGOSD_PID})"

    wait -n "$MANGOSD_PID" "$REALMD_PID" 2>/dev/null || true

    echo "[entrypoint] A process has exited. Shutting down..."
    cleanup
}

main "$@"
