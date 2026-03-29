#!/bin/bash
# ============================================================================
# CMaNGOS TBC — Helper CLI
# ============================================================================
# Usage: ./cmangos.sh <command> [args...]
#
# Commands:
#   start           Start all services
#   stop            Stop all services (graceful)
#   restart         Restart all services
#   status          Show service status
#   logs [service]  Follow logs (optional: cmangos-tbc-server or cmangos-tbc-db)
#   db              Open MariaDB shell
#   dbquery <sql>   Execute SQL query
#   backup          Create database backup
#   restore <file>  Restore database from backup
#   account create <name> <pass>     Create game account
#   account gm <name> <level>        Set GM level (0-3)
#   account addon <name> <level>     Set expansion (0-2)
#   update          Check for updates and rebuild
#   shell           Open shell in server container
#   version         Show version info
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.yml"
BACKUP_DIR="${PROJECT_DIR}/backups"

# Load .env if exists
if [ -f "${PROJECT_DIR}/.env" ]; then
    export $(grep -v '^#' "${PROJECT_DIR}/.env" | xargs)
fi

DB_ROOT_PASS="${MYSQL_ROOT_PASSWORD:-mangos_root_password}"

# Container names
DB_CONTAINER="cmangos-tbc-db"
SERVER_CONTAINER="cmangos-tbc-server"

# Database names
MANGOS_DB="tbcmangos"
CHARACTERS_DB="tbccharacters"
REALMD_DB="tbcrealmd"
LOGS_DB="tbclogs"

# ============================================================================
# Commands
# ============================================================================

cmd_start() {
    echo "Starting CMaNGOS TBC..."
    docker compose -f "$COMPOSE_FILE" up -d
    echo "Done. Use './cmangos.sh logs' to follow server output."
}

cmd_stop() {
    echo "Stopping CMaNGOS TBC (graceful shutdown)..."
    docker compose -f "$COMPOSE_FILE" down
    echo "Done."
}

cmd_restart() {
    echo "Restarting CMaNGOS TBC..."
    docker compose -f "$COMPOSE_FILE" down
    docker compose -f "$COMPOSE_FILE" up -d
    echo "Done. Use './cmangos.sh logs' to follow server output."
}

cmd_status() {
    echo "=== Service Status ==="
    docker compose -f "$COMPOSE_FILE" ps
    echo ""
    echo "=== Recent Server Logs ==="
    docker compose -f "$COMPOSE_FILE" logs --tail=20 cmangos-tbc-server 2>/dev/null || true
}

cmd_logs() {
    local service="${1:-}"
    if [ -n "$service" ]; then
        docker compose -f "$COMPOSE_FILE" logs -f "$service"
    else
        docker compose -f "$COMPOSE_FILE" logs -f
    fi
}

cmd_db() {
    echo "Connecting to MariaDB (user: mangos)..."
    docker exec -it "$DB_CONTAINER" mariadb -umangos -pmangos
}

cmd_dbquery() {
    local query="$*"
    if [ -z "$query" ]; then
        echo "Usage: ./cmangos.sh dbquery \"SELECT * FROM ${REALMD_DB}.realmlist;\""
        exit 1
    fi
    docker exec "$DB_CONTAINER" mariadb -umangos -pmangos -e "$query"
}

cmd_backup() {
    mkdir -p "$BACKUP_DIR"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="${BACKUP_DIR}/cmangos_tbc_backup_${timestamp}.sql"

    echo "Creating backup..."
    docker exec "$DB_CONTAINER" mariadb-dump -uroot -p"${DB_ROOT_PASS}" \
        --databases ${MANGOS_DB} ${CHARACTERS_DB} ${REALMD_DB} ${LOGS_DB} \
        --single-transaction --quick > "$backup_file"

    echo "Backup saved: ${backup_file}"
    echo "Size: $(du -sh "$backup_file" | cut -f1)"

    # Keep only last 7 backups
    local count=$(ls -1 "${BACKUP_DIR}"/cmangos_tbc_backup_*.sql 2>/dev/null | wc -l)
    if [ "$count" -gt 7 ]; then
        echo "Rotating old backups (keeping last 7)..."
        ls -1t "${BACKUP_DIR}"/cmangos_tbc_backup_*.sql | tail -n +8 | xargs rm -f
    fi
}

cmd_restore() {
    local backup_file="$1"
    if [ -z "$backup_file" ] || [ ! -f "$backup_file" ]; then
        echo "Usage: ./cmangos.sh restore <backup_file.sql>"
        echo "Available backups:"
        ls -lh "${BACKUP_DIR}"/cmangos_tbc_backup_*.sql 2>/dev/null || echo "  (none)"
        exit 1
    fi

    echo "WARNING: This will overwrite all current database data!"
    echo "Backup file: $backup_file"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Cancelled."
        exit 0
    fi

    echo "Restoring from backup..."
    docker exec -i "$DB_CONTAINER" mariadb -uroot -p"${DB_ROOT_PASS}" < "$backup_file"
    echo "Restore complete. Restart the server: ./cmangos.sh restart"
}

cmd_account() {
    local subcmd="$1"
    shift || true

    case "$subcmd" in
        create)
            local name="$1"
            local pass="$2"
            if [ -z "$name" ] || [ -z "$pass" ]; then
                echo "Usage: ./cmangos.sh account create <username> <password>"
                exit 1
            fi
            local uname
            uname=$(echo "$name" | tr '[:lower:]' '[:upper:]')
            local upass
            upass=$(echo "$pass" | tr '[:lower:]' '[:upper:]')
            echo "Creating account '${uname}'..."
            # Compute SRP6 verifier (v) and salt (s)
            local srp_output
            srp_output=$(python3 -c "
import hashlib, secrets, sys
N = int('894B645E89E1535BBDAD5B8B290650530801B18EBFBF5E8FAB3C82872A3E9BB7', 16)
g = 7
username = sys.argv[1]
password = sys.argv[2]
auth_hash = hashlib.sha1(f'{username}:{password}'.encode()).digest()
s_int = secrets.randbits(256)
s_bytes = max(1, (s_int.bit_length() + 7) // 8)
s_le = s_int.to_bytes(s_bytes, 'little')
x_hash = hashlib.sha1(s_le + auth_hash).digest()
x = int.from_bytes(x_hash, 'little')
v = pow(g, x, N)
print(format(v, '064X'))
print(format(s_int, '064X'))
" "$uname" "$upass") || { echo "ERROR: Failed to compute SRP6 verifier. Is python3 available?"; exit 1; }
            local v_hex s_hex
            v_hex=$(echo "$srp_output" | sed -n '1p')
            s_hex=$(echo "$srp_output" | sed -n '2p')
            docker exec "$DB_CONTAINER" mariadb -umangos -pmangos ${REALMD_DB} -e "
                INSERT INTO account (username, v, s, gmlevel, expansion)
                VALUES ('${uname}', '${v_hex}', '${s_hex}', 0, 1);
            "
            echo "Account '${uname}' created. GM level: 0 (player), Expansion: 1 (TBC)"
            ;;
        gm)
            local name="$1"
            local level="$2"
            if [ -z "$name" ] || [ -z "$level" ]; then
                echo "Usage: ./cmangos.sh account gm <username> <level>"
                echo "Levels: 0=Player, 1=Moderator, 2=GameMaster, 3=Administrator"
                exit 1
            fi
            docker exec "$DB_CONTAINER" mariadb -umangos -pmangos ${REALMD_DB} -e "
                UPDATE account SET gmlevel=${level} WHERE username=UPPER('${name}');
            "
            echo "Account '${name}' GM level set to ${level}."
            ;;
        addon)
            local name="$1"
            local level="$2"
            if [ -z "$name" ] || [ -z "$level" ]; then
                echo "Usage: ./cmangos.sh account addon <username> <level>"
                echo "Levels: 0=Classic, 1=TBC, 2=WotLK"
                exit 1
            fi
            docker exec "$DB_CONTAINER" mariadb -umangos -pmangos ${REALMD_DB} -e "
                UPDATE account SET expansion=${level} WHERE username=UPPER('${name}');
            "
            echo "Account '${name}' expansion set to ${level}."
            ;;
        password)
            local name="$1"
            local pass="$2"
            if [ -z "$name" ] || [ -z "$pass" ]; then
                echo "Usage: ./cmangos.sh account password <username> <new_password>"
                exit 1
            fi
            local uname
            uname=$(echo "$name" | tr '[:lower:]' '[:upper:]')
            local upass
            upass=$(echo "$pass" | tr '[:lower:]' '[:upper:]')
            echo "Resetting password for '${uname}'..."
            local srp_output
            srp_output=$(python3 -c "
import hashlib, secrets, sys
N = int('894B645E89E1535BBDAD5B8B290650530801B18EBFBF5E8FAB3C82872A3E9BB7', 16)
g = 7
username = sys.argv[1]
password = sys.argv[2]
auth_hash = hashlib.sha1(f'{username}:{password}'.encode()).digest()
s_int = secrets.randbits(256)
s_bytes = max(1, (s_int.bit_length() + 7) // 8)
s_le = s_int.to_bytes(s_bytes, 'little')
x_hash = hashlib.sha1(s_le + auth_hash).digest()
x = int.from_bytes(x_hash, 'little')
v = pow(g, x, N)
print(format(v, '064X'))
print(format(s_int, '064X'))
" "$uname" "$upass") || { echo "ERROR: Failed to compute SRP6 verifier."; exit 1; }
            local v_hex s_hex
            v_hex=$(echo "$srp_output" | sed -n '1p')
            s_hex=$(echo "$srp_output" | sed -n '2p')
            docker exec "$DB_CONTAINER" mariadb -umangos -pmangos ${REALMD_DB} -e "
                UPDATE account SET v='${v_hex}', s='${s_hex}' WHERE username='${uname}';
            "
            echo "Password for '${uname}' has been reset."
            ;;
        list)
            docker exec "$DB_CONTAINER" mariadb -umangos -pmangos ${REALMD_DB} -e "
                SELECT id, username, gmlevel, expansion, joindate FROM account ORDER BY id;
            "
            ;;
        delete)
            local name="$1"
            if [ -z "$name" ]; then
                echo "Usage: ./cmangos.sh account delete <username>"
                exit 1
            fi
            local uname
            uname=$(echo "$name" | tr '[:lower:]' '[:upper:]')
            echo "Deleting account '${uname}'..."
            docker exec "$DB_CONTAINER" mariadb -umangos -pmangos ${REALMD_DB} -e "
                DELETE FROM account WHERE username='${uname}';
            "
            echo "Account '${uname}' deleted."
            ;;
        *)
            echo "Usage: ./cmangos.sh account <create|password|gm|addon|list|delete> [args...]"
            exit 1
            ;;
    esac
}

cmd_update() {
    echo "=== CMaNGOS TBC Update ==="

    # Check current version
    local current_hash
    current_hash=$(docker exec "$SERVER_CONTAINER" cat /opt/cmangos/COMMIT_HASH 2>/dev/null || echo "unknown")
    echo "Current server commit: ${current_hash}"

    # Check latest upstream
    local latest_hash
    latest_hash=$(git ls-remote https://github.com/cmangos/mangos-tbc.git HEAD | cut -f1)
    echo "Latest upstream commit: ${latest_hash}"

    if [ "$current_hash" = "$latest_hash" ]; then
        echo "Server is up to date!"
        return 0
    fi

    echo ""
    echo "Update available!"
    read -p "Rebuild and update? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Cancelled."
        return 0
    fi

    # Create backup before update
    echo "Creating pre-update backup..."
    cmd_backup

    # Rebuild image
    echo "Building new server image..."
    docker build -t semorgana/cmangos-tbc:latest \
        -f "${PROJECT_DIR}/Dockerfile.server" \
        "${PROJECT_DIR}"

    # Push to Docker Hub
    echo "Pushing to Docker Hub..."
    docker push semorgana/cmangos-tbc:latest

    # Graceful restart
    echo "Restarting server with new image..."
    docker compose -f "$COMPOSE_FILE" up -d --force-recreate cmangos-tbc-server

    echo "Update complete!"
    echo "New commit: $(docker exec "$SERVER_CONTAINER" cat /opt/cmangos/COMMIT_HASH 2>/dev/null)"
}

cmd_shell() {
    docker exec -it "$SERVER_CONTAINER" bash
}

cmd_version() {
    echo "=== CMaNGOS TBC Server ==="
    echo "Server commit: $(docker exec "$SERVER_CONTAINER" cat /opt/cmangos/COMMIT_HASH 2>/dev/null || echo 'not running')"
    echo "TBC-DB commit: $(docker exec "$SERVER_CONTAINER" cat /opt/cmangos/tbc-db/COMMIT_HASH 2>/dev/null || echo 'not running')"
    echo ""
    echo "Docker images:"
    docker images semorgana/cmangos-tbc --format "  {{.Repository}}:{{.Tag}} ({{.Size}}, created {{.CreatedSince}})"
    docker images mariadb --format "  {{.Repository}}:{{.Tag}} ({{.Size}}, created {{.CreatedSince}})"
}

# ============================================================================
# Main dispatcher
# ============================================================================
cmd="$1"
shift || true

case "$cmd" in
    start)      cmd_start ;;
    stop)       cmd_stop ;;
    restart)    cmd_restart ;;
    status)     cmd_status ;;
    logs)       cmd_logs "$@" ;;
    db)         cmd_db ;;
    dbquery)    cmd_dbquery "$@" ;;
    backup)     cmd_backup ;;
    restore)    cmd_restore "$@" ;;
    account)    cmd_account "$@" ;;
    update)     cmd_update ;;
    shell)      cmd_shell ;;
    version)    cmd_version ;;
    *)
        echo "CMaNGOS TBC — Server Management"
        echo ""
        echo "Usage: ./cmangos.sh <command> [args...]"
        echo ""
        echo "Commands:"
        echo "  start                          Start all services"
        echo "  stop                           Stop all services"
        echo "  restart                        Restart all services"
        echo "  status                         Show service status & recent logs"
        echo "  logs [service]                 Follow logs"
        echo "  db                             Open MariaDB shell"
        echo "  dbquery \"<sql>\"                Execute SQL query"
        echo "  backup                         Create database backup"
        echo "  restore <file>                 Restore from backup"
        echo "  account create <name> <pass>   Create game account"
        echo "  account password <name> <pass> Reset account password"
        echo "  account gm <name> <level>      Set GM level (0-3)"
        echo "  account addon <name> <level>   Set expansion (0-2)"
        echo "  account list                   List all accounts"
        echo "  account delete <name>          Delete account"
        echo "  update                         Check & apply updates"
        echo "  shell                          Open shell in server container"
        echo "  version                        Show version info"
        echo ""
        exit 1
        ;;
esac
