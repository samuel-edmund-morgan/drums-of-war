#!/bin/bash
# ============================================================================
# CMaNGOS TBC — Database Initialization Script
# ============================================================================
# This script runs on first boot to:
#   1. Create the 4 required databases (if not exist)
#   2. Import base schemas
#   3. Import world database content from tbc-db
#   4. Apply SQL updates from mangos-tbc
#   5. Configure realmlist
#
# Environment variables:
#   DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_ROOT_PASS
# ============================================================================

set -e

CMANGOS_DIR="/opt/cmangos"
SQL_DIR="${CMANGOS_DIR}/sql"
TBCDB_DIR="${CMANGOS_DIR}/tbc-db"

DB_HOST="${DB_HOST:-cmangos-tbc-db}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-mangos}"
DB_PASS="${DB_PASS:-mangos}"
DB_ROOT_PASS="${MYSQL_ROOT_PASSWORD:-mangos}"
SERVER_PUBLIC_IP="${SERVER_PUBLIC_IP:-127.0.0.1}"

MYSQL_ROOT="mysql -h${DB_HOST} -P${DB_PORT} -uroot -p${DB_ROOT_PASS}"
MYSQL_USER="mysql -h${DB_HOST} -P${DB_PORT} -u${DB_USER} -p${DB_PASS}"

echo "============================================="
echo "  CMaNGOS TBC — Database Initialization"
echo "============================================="

# Step 1: Create databases and user
echo "[db-init] Step 1/6: Creating databases and user..."
$MYSQL_ROOT -e "
CREATE DATABASE IF NOT EXISTS tbcmangos DEFAULT CHARACTER SET utf8 COLLATE utf8_general_ci;
CREATE DATABASE IF NOT EXISTS tbclogs DEFAULT CHARACTER SET utf8 COLLATE utf8_general_ci;
CREATE DATABASE IF NOT EXISTS tbccharacters DEFAULT CHARACTER SET utf8 COLLATE utf8_general_ci;
CREATE DATABASE IF NOT EXISTS tbcrealmd DEFAULT CHARACTER SET utf8 COLLATE utf8_general_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'%' IDENTIFIED BY '${DB_PASS}';
GRANT INDEX, SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, LOCK TABLES, CREATE TEMPORARY TABLES ON tbcmangos.* TO '${DB_USER}'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, LOCK TABLES, CREATE TEMPORARY TABLES ON tbclogs.* TO '${DB_USER}'@'%';
GRANT INDEX, SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, LOCK TABLES, CREATE TEMPORARY TABLES ON tbccharacters.* TO '${DB_USER}'@'%';
GRANT INDEX, SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, LOCK TABLES, CREATE TEMPORARY TABLES ON tbcrealmd.* TO '${DB_USER}'@'%';
FLUSH PRIVILEGES;
"
echo "[db-init] Databases and user created."

# Step 2: Import base schemas
echo "[db-init] Step 2/6: Importing base schemas..."
echo "[db-init]   - mangos.sql (world database schema)..."
$MYSQL_USER tbcmangos < "${SQL_DIR}/base/mangos.sql"
echo "[db-init]   - characters.sql..."
$MYSQL_USER tbccharacters < "${SQL_DIR}/base/characters.sql"
echo "[db-init]   - realmd.sql..."
$MYSQL_USER tbcrealmd < "${SQL_DIR}/base/realmd.sql"
echo "[db-init]   - logs.sql..."
$MYSQL_USER tbclogs < "${SQL_DIR}/base/logs.sql"
echo "[db-init] Base schemas imported."

# Step 3: Import world database content from tbc-db
echo "[db-init] Step 3/6: Populating world database from tbc-db..."
echo "[db-init] This may take several minutes..."
if [ -d "${TBCDB_DIR}" ] && [ -f "${TBCDB_DIR}/InstallFullDB.sh" ]; then
    cd "${TBCDB_DIR}"
    cat > InstallFullDB.config << DBCONFIG
####################################################################################################
# This is the config file for the './InstallFullDB.sh' script
####################################################################################################
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
    mkdir -p "${CMANGOS_DIR}/src/shared"
    if [ ! -f "${CMANGOS_DIR}/src/shared/revision_sql.h" ]; then
        echo '#define REVISION_DB_MANGOS "required_z2815_s2429_01_mangos_spell_template"' \
            > "${CMANGOS_DIR}/src/shared/revision_sql.h"
    fi
    chmod +x InstallFullDB.sh
    printf '2\ny\n' | bash InstallFullDB.sh
    echo "[db-init] World database populated."
    cd "${CMANGOS_DIR}"
else
    echo "[db-init] WARNING: tbc-db not found at ${TBCDB_DIR}"
    echo "[db-init] World database will have schema only (no content)."
    echo "[db-init] You can manually populate it later."
fi

# Step 4: Apply DBC SQL data
echo "[db-init] Step 4/6: Applying DBC SQL data..."
if [ -d "${SQL_DIR}/base/dbc/original_data" ]; then
    for sql_file in "${SQL_DIR}/base/dbc/original_data"/*.sql; do
        if [ -f "$sql_file" ]; then
            echo "[db-init]   - $(basename "$sql_file")..."
            $MYSQL_USER tbcmangos < "$sql_file"
        fi
    done
fi
if [ -d "${SQL_DIR}/base/dbc/cmangos_fixes" ]; then
    for sql_file in "${SQL_DIR}/base/dbc/cmangos_fixes"/*.sql; do
        if [ -f "$sql_file" ]; then
            echo "[db-init]   - $(basename "$sql_file") (cmangos fix)..."
            $MYSQL_USER tbcmangos < "$sql_file"
        fi
    done
fi
echo "[db-init] DBC SQL data applied."

# Step 5: Apply AHBot SQL
echo "[db-init] Step 5/6: Applying optional SQL..."
if [ -f "${SQL_DIR}/base/ahbot/mangos_command_ahbot.sql" ]; then
    echo "[db-init]   - AHBot commands..."
    $MYSQL_USER tbcmangos < "${SQL_DIR}/base/ahbot/mangos_command_ahbot.sql"
fi
echo "[db-init] Optional SQL applied."

# Step 6: Configure realmlist
echo "[db-init] Step 6/6: Configuring realmlist..."
$MYSQL_USER tbcrealmd -e "
DELETE FROM realmlist WHERE id = 1;
INSERT INTO realmlist (id, name, address, port, icon, realmflags, timezone, allowedSecurityLevel)
VALUES (1, 'CMaNGOS TBC', '${SERVER_PUBLIC_IP}', 8086, 1, 0, 1, 0);
"
echo "[db-init] Realmlist configured (address: ${SERVER_PUBLIC_IP}:8086)."

echo ""
echo "============================================="
echo "  Database initialization COMPLETE!"
echo "  Databases: tbcmangos, tbccharacters, tbcrealmd, tbclogs"
echo "  User: ${DB_USER}"
echo "  Realmlist: ${SERVER_PUBLIC_IP}:8086"
echo "============================================="
