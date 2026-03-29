#!/bin/bash
# ============================================================
# CMaNGOS Character Transfer Script
# Transfer characters between expansion servers
# ============================================================
# Usage: ./transfer.sh <source> <target> [--account <name>]
#
# Examples:
#   ./transfer.sh classic tbc          # Transfer all characters
#   ./transfer.sh classic wotlk        # Direct Classic → WotLK
#   ./transfer.sh tbc wotlk            # TBC → WotLK
#   ./transfer.sh classic tbc --account SAMUEL
#
# Strategy (temp-DB approach):
# 1. Gracefully stop both game servers (keeps DBs running)
# 2. Dump source character data WITH structure
# 3. Create temp database on TARGET container, import source dump
# 4. Run schema migration SQL on temp DB (source→target schema)
# 5. Merge migrated data from temp DB into target characters DB
# 6. Cleanup temp DB and restart servers
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DB_PASSWORD="${DB_PASSWORD:?ERROR: DB_PASSWORD not set}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/cmangos-transfer/backups/${TIMESTAMP}"
TEMP_DB="transfer_temp_$$"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_step()  { echo -e "${CYAN}[STEP]${NC} $*"; }

declare -A EXP_DB_CONTAINER=(
    [classic]="vmangos-db"
    [tbc]="cmangos-tbc-db"
    [wotlk]="azerothcore-db"
)
declare -A EXP_SERVER_CONTAINER=(
    [classic]="vmangos-mangosd"
    [tbc]="cmangos-tbc-server"
    [wotlk]="azerothcore-worldserver"
)
declare -A EXP_CHAR_DB=(
    [classic]="characters"
    [tbc]="tbccharacters"
    [wotlk]="acore_characters"
)
declare -A EXP_REALMD_DB=(
    [classic]="realmd"
    [tbc]="tbcrealmd"
    [wotlk]="acore_auth"
)
declare -A EXP_COMPOSE_DIR=(
    [classic]="/opt/vmangos-classic"
    [tbc]="/opt/cmangos-tbc"
    [wotlk]="/opt/docker-azerothcore"
)
declare -A EXP_LEVEL=(
    [classic]=0
    [tbc]=1
    [wotlk]=2
)

SKIP_TABLES="character_db_version playerbot_saved_data ahbot_items saved_variables"
CLASSIC_ONLY_TABLES="character_forgotten_skills character_honor_cp"
TBC_ONLY_TABLES="item_text"

cleanup() {
    if [[ -n "${TGT_DB_CTR:-}" ]]; then
        db_exec "$TGT_DB_CTR" -e "DROP DATABASE IF EXISTS ${TEMP_DB}" 2>/dev/null || true
    fi
}
trap cleanup EXIT

usage() {
    echo "Usage: $0 <source> <target> [--account <name>] [--dry-run] [--no-restart]"
    echo ""
    echo "  source/target: classic | tbc | wotlk"
    echo ""
    echo "Options:"
    echo "  --account <name>   Transfer only this account's characters"
    echo "  --dry-run          Show what would happen without doing it"
    echo "  --no-restart       Don't restart servers after transfer"
    echo "  --skip-backup      Skip pre-transfer backup of target DB"
    exit 1
}

SOURCE=""
TARGET=""
ACCOUNT=""
DRY_RUN=false
NO_RESTART=false
SKIP_BACKUP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        classic|tbc|wotlk)
            if [[ -z "$SOURCE" ]]; then SOURCE="$1"
            elif [[ -z "$TARGET" ]]; then TARGET="$1"
            else log_error "Too many positional arguments"; usage; fi ;;
        --account) ACCOUNT="${2^^}"; shift ;;
        --dry-run) DRY_RUN=true ;;
        --no-restart) NO_RESTART=true ;;
        --skip-backup) SKIP_BACKUP=true ;;
        -h|--help) usage ;;
        *) log_error "Unknown: $1"; usage ;;
    esac
    shift
done

[[ -z "$SOURCE" || -z "$TARGET" ]] && usage
[[ "$SOURCE" == "$TARGET" ]] && { log_error "Source and target must differ"; exit 1; }
[[ ${EXP_LEVEL[$SOURCE]} -ge ${EXP_LEVEL[$TARGET]} ]] && {
    log_error "Only forward transfer supported: classic→tbc, classic→wotlk, tbc→wotlk"; exit 1; }

MIGRATE_SQL_LIST=()
if [[ "$SOURCE" == "classic" && "$TARGET" == "tbc" ]]; then
    MIGRATE_SQL_LIST+=("${SCRIPT_DIR}/migrate_classic_to_tbc.sql")
elif [[ "$SOURCE" == "tbc" && "$TARGET" == "wotlk" ]]; then
    MIGRATE_SQL_LIST+=("${SCRIPT_DIR}/migrate_tbc_to_wotlk.sql")
elif [[ "$SOURCE" == "classic" && "$TARGET" == "wotlk" ]]; then
    MIGRATE_SQL_LIST+=("${SCRIPT_DIR}/migrate_classic_to_wotlk.sql")
fi
# AzerothCore needs additional schema transformation
if ! docker exec "${EXP_DB_CONTAINER[$TARGET]}" mariadb --version &>/dev/null; then
    MIGRATE_SQL_LIST+=("${SCRIPT_DIR}/migrate_cmangos_wotlk_to_azerothcore.sql")
fi
MIGRATE_SQL="${MIGRATE_SQL_LIST[0]}"
[[ ! -f "$MIGRATE_SQL" ]] && { log_error "Migration SQL not found: $MIGRATE_SQL"; exit 1; }

# Auto-detect mysql client binary: mariadb (MariaDB) or mysql (MySQL/AzerothCore)
_db_client() {
    local c="$1"
    if docker exec "$c" mariadb --version &>/dev/null; then echo "mariadb"
    else echo "mysql"; fi
}
_db_dump_client() {
    local c="$1"
    if docker exec "$c" mariadb-dump --version &>/dev/null; then echo "mariadb-dump"
    else echo "mysqldump"; fi
}
db_exec() { local c="$1"; shift; docker exec "$c" $(_db_client "$c") -u root -p"${DB_PASSWORD}" "$@" 2>/dev/null; }
db_dump() { local c="$1"; shift; docker exec "$c" $(_db_dump_client "$c") -u root -p"${DB_PASSWORD}" "$@" 2>/dev/null; }

# Transfer data between temp and target DBs using explicit column names
# This handles column order differences after schema migration
# Usage: safe_insert <container> <src_db> <dst_db> <table> <where_clause>
safe_insert() {
    local ctr="$1" src_db="$2" dst_db="$3" tbl="$4" where="$5"
    # Get columns that exist in BOTH source and target tables
    local src_cols=$(db_exec "$ctr" -N -e \
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='${src_db}' AND TABLE_NAME='${tbl}' ORDER BY ORDINAL_POSITION" | tr '\n' ',')
    local dst_cols=$(db_exec "$ctr" -N -e \
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='${dst_db}' AND TABLE_NAME='${tbl}' ORDER BY ORDINAL_POSITION" | tr '\n' ',')
    [[ -z "$src_cols" || -z "$dst_cols" ]] && return 1

    # Find common columns (preserve target order)
    local common_cols=""
    IFS=',' read -ra DST_ARR <<< "$dst_cols"
    for col in "${DST_ARR[@]}"; do
        [[ -z "$col" ]] && continue
        if echo ",$src_cols" | grep -q ",${col},"; then
            [[ -n "$common_cols" ]] && common_cols="${common_cols},"
            common_cols="${common_cols}\`${col}\`"
        fi
    done
    [[ -z "$common_cols" ]] && return 1

    local sql="INSERT INTO ${dst_db}.\`${tbl}\` (${common_cols}) SELECT ${common_cols} FROM ${src_db}.\`${tbl}\`"
    [[ -n "$where" ]] && sql="${sql} WHERE ${where}"
    db_exec "$ctr" -e "$sql"
}

SRC_DB_CTR="${EXP_DB_CONTAINER[$SOURCE]}"
TGT_DB_CTR="${EXP_DB_CONTAINER[$TARGET]}"
SRC_SRV_CTR="${EXP_SERVER_CONTAINER[$SOURCE]}"
TGT_SRV_CTR="${EXP_SERVER_CONTAINER[$TARGET]}"
SRC_CHAR_DB="${EXP_CHAR_DB[$SOURCE]}"
TGT_CHAR_DB="${EXP_CHAR_DB[$TARGET]}"
SRC_REALMD_DB="${EXP_REALMD_DB[$SOURCE]}"
TGT_REALMD_DB="${EXP_REALMD_DB[$TARGET]}"

echo ""
echo "============================================================"
echo "  CMaNGOS Character Transfer"
echo "============================================================"
echo "  Source:    ${SOURCE} (${SRC_CHAR_DB})"
echo "  Target:    ${TARGET} (${TGT_CHAR_DB})"
[[ -n "$ACCOUNT" ]] && echo "  Account:   ${ACCOUNT}"
echo "  Migration: $(basename "$MIGRATE_SQL")"
echo "============================================================"
echo ""

$DRY_RUN && log_warn "DRY RUN mode"

# ---- STEP 1: Verify ----
log_step "1/8 Verifying containers..."
for ctr in "$SRC_DB_CTR" "$TGT_DB_CTR"; do
    docker inspect --format='{{.State.Running}}' "$ctr" 2>/dev/null | grep -q true || {
        log_error "Container $ctr not running!"; exit 1; }
done
log_info "Database containers OK"

ACCOUNT_ID=""
if [[ -n "$ACCOUNT" ]]; then
    ACCOUNT_ID=$(db_exec "$SRC_DB_CTR" -N -e "SELECT id FROM ${SRC_REALMD_DB}.account WHERE username='${ACCOUNT}'")
    [[ -z "$ACCOUNT_ID" ]] && { log_error "Account '${ACCOUNT}' not found in ${SOURCE}"; exit 1; }
    TGT_ACCOUNT_ID=$(db_exec "$TGT_DB_CTR" -N -e "SELECT id FROM ${TGT_REALMD_DB}.account WHERE username='${ACCOUNT}'")
    [[ -z "$TGT_ACCOUNT_ID" ]] && { log_error "Account '${ACCOUNT}' not found in ${TARGET}. Create it first!"; exit 1; }
    if [[ "$ACCOUNT_ID" != "$TGT_ACCOUNT_ID" ]]; then
        log_warn "Account ID differs: src=${ACCOUNT_ID} tgt=${TGT_ACCOUNT_ID} — will remap after transfer"
        REMAP_ACCOUNT=true
    fi
    CHAR_COUNT=$(db_exec "$SRC_DB_CTR" -N -e "SELECT COUNT(*) FROM ${SRC_CHAR_DB}.characters WHERE account=${ACCOUNT_ID}")
    log_info "Account '${ACCOUNT}' (ID:${ACCOUNT_ID}): ${CHAR_COUNT} character(s)"
    db_exec "$SRC_DB_CTR" -e "SELECT guid,name,level,race,class FROM ${SRC_CHAR_DB}.characters WHERE account=${ACCOUNT_ID}"
    [[ "$CHAR_COUNT" == "0" ]] && { log_warn "No characters to transfer"; exit 0; }
fi

$DRY_RUN && { log_info "DRY RUN complete"; exit 0; }

# ---- STEP 2: Stop servers ----
log_step "2/8 Stopping game servers..."
for pair in "${TGT_SRV_CTR}:${TARGET}" "${SRC_SRV_CTR}:${SOURCE}"; do
    ctr="${pair%%:*}"; name="${pair#*:}"
    if docker inspect --format='{{.State.Running}}' "$ctr" 2>/dev/null | grep -q true; then
        log_info "Stopping ${name}..."; docker stop -t 30 "$ctr" 2>/dev/null || true; sleep 2
    else log_info "${name} already stopped"; fi
done

# ---- STEP 3: Backup ----
mkdir -p "$BACKUP_DIR"
if ! $SKIP_BACKUP; then
    log_step "3/8 Backing up target..."
    db_dump "$TGT_DB_CTR" "$TGT_CHAR_DB" > "${BACKUP_DIR}/${TGT_CHAR_DB}_backup.sql"
    log_info "Backup: $(du -h "${BACKUP_DIR}/${TGT_CHAR_DB}_backup.sql" | cut -f1)"
else
    log_step "3/8 Skipping backup"
fi

# ---- STEP 4: Dump source ----
log_step "4/8 Dumping source..."
EXCLUDE_ARGS=""
for tbl in $SKIP_TABLES; do EXCLUDE_ARGS="$EXCLUDE_ARGS --ignore-table=${SRC_CHAR_DB}.${tbl}"; done
[[ "$SOURCE" == "classic" ]] && for tbl in $CLASSIC_ONLY_TABLES; do EXCLUDE_ARGS="$EXCLUDE_ARGS --ignore-table=${SRC_CHAR_DB}.${tbl}"; done
[[ "$SOURCE" == "tbc" && "$TARGET" == "wotlk" ]] && for tbl in $TBC_ONLY_TABLES; do EXCLUDE_ARGS="$EXCLUDE_ARGS --ignore-table=${SRC_CHAR_DB}.${tbl}"; done

DUMP_FILE="${BACKUP_DIR}/transfer_${SOURCE}_to_${TARGET}.sql"
db_dump "$SRC_DB_CTR" "$SRC_CHAR_DB" --skip-lock-tables --add-drop-table $EXCLUDE_ARGS > "$DUMP_FILE"
log_info "Source dump: $(du -h "$DUMP_FILE" | cut -f1)"

# ---- STEP 5: Import into temp DB on target container ----
log_step "5/8 Creating temp DB and importing source data..."
db_exec "$TGT_DB_CTR" -e "DROP DATABASE IF EXISTS ${TEMP_DB}"
db_exec "$TGT_DB_CTR" -e "CREATE DATABASE ${TEMP_DB} CHARACTER SET utf8mb3"
# Fix MariaDB-specific syntax for MySQL compatibility
sed -i \
    -e 's/utf8mb3_uca1400_ai_ci/utf8mb3_general_ci/g' \
    -e 's/utf8mb4_uca1400_ai_ci/utf8mb4_general_ci/g' \
    -e 's/ GENERATED ALWAYS AS ([^)]*) VIRTUAL//g' \
    "$DUMP_FILE"
docker cp "$DUMP_FILE" "${TGT_DB_CTR}:/tmp/transfer_dump.sql"
db_exec "$TGT_DB_CTR" "$TEMP_DB" -e "SOURCE /tmp/transfer_dump.sql"
docker exec "$TGT_DB_CTR" rm -f /tmp/transfer_dump.sql
TEMP_COUNT=$(db_exec "$TGT_DB_CTR" -N -e "SELECT COUNT(*) FROM ${TEMP_DB}.characters")
log_info "Imported ${TEMP_COUNT} characters into temp DB"

# ---- STEP 6: Run migration on temp DB ----
log_step "6/8 Migrating schema (${SOURCE}→${TARGET})..."
# For MySQL targets, convert MariaDB-specific IF EXISTS syntax
IS_MYSQL=false
docker exec "$TGT_DB_CTR" mariadb --version &>/dev/null || IS_MYSQL=true

for msql_file in "${MIGRATE_SQL_LIST[@]}"; do
    [[ ! -f "$msql_file" ]] && { log_warn "Migration SQL not found: $msql_file, skipping"; continue; }
    log_info "Running $(basename "$msql_file")..."
    MIGRATE_TMP="${BACKUP_DIR}/$(basename "$msql_file")"
    cp "$msql_file" "$MIGRATE_TMP"
    if $IS_MYSQL; then
        sed -i \
            -e 's/DROP COLUMN IF EXISTS/DROP COLUMN/g' \
            -e 's/ADD COLUMN IF NOT EXISTS/ADD COLUMN/g' \
            -e 's/CHANGE COLUMN IF EXISTS/CHANGE COLUMN/g' \
            "$MIGRATE_TMP"
        # Run each statement separately, ignoring ALTER errors for missing/existing columns
        while IFS= read -r stmt; do
            [[ -z "$stmt" ]] && continue
            db_exec "$TGT_DB_CTR" "$TEMP_DB" -e "$stmt" 2>/dev/null || true
        done < <(grep -v '^--' "$MIGRATE_TMP" | sed 's/;/;\n/g' | grep -v '^$')
    else
        docker cp "$MIGRATE_TMP" "${TGT_DB_CTR}:/tmp/migrate.sql"
        db_exec "$TGT_DB_CTR" "$TEMP_DB" -e "SOURCE /tmp/migrate.sql"
        docker exec "$TGT_DB_CTR" rm -f /tmp/migrate.sql
    fi
done
MIGRATED_COUNT=$(db_exec "$TGT_DB_CTR" -N -e "SELECT COUNT(*) FROM ${TEMP_DB}.characters")
log_info "Characters after migration: ${MIGRATED_COUNT}"

# ---- STEP 7: Merge into target ----
log_step "7/8 Merging into ${TARGET}..."

if [[ -n "$ACCOUNT" ]]; then
    # ---- Per-account transfer ----
    CHAR_GUIDS=$(db_exec "$TGT_DB_CTR" -N -e \
        "SELECT guid FROM ${TEMP_DB}.characters WHERE account=${ACCOUNT_ID}")
    GUID_LIST=$(echo "$CHAR_GUIDS" | tr '\n' ',' | sed 's/,$//')
    log_info "Transferring GUIDs: ${GUID_LIST}"

    # Remove existing target data for this account
    TGT_GUIDS=$(db_exec "$TGT_DB_CTR" -N -e \
        "SELECT guid FROM ${TGT_CHAR_DB}.characters WHERE account=${TGT_ACCOUNT_ID:-$ACCOUNT_ID}" | tr '\n' ',' | sed 's/,$//')
    if [[ -n "$TGT_GUIDS" ]]; then
        log_info "Cleaning target data for account (GUIDs: ${TGT_GUIDS})..."
        for tbl in character_account_data character_action character_aura \
            character_battleground_data character_gifts character_homebind \
            character_instance character_inventory character_queststatus \
            character_queststatus_weekly character_reputation character_skills \
            character_social character_spell character_spell_cooldown \
            character_stats character_tutorial character_queststatus_daily \
            character_queststatus_monthly character_declinedname; do
            db_exec "$TGT_DB_CTR" -e "DELETE FROM ${TGT_CHAR_DB}.\`${tbl}\` WHERE guid IN (${TGT_GUIDS})" 2>/dev/null || true
        done
        # Pets
        TGT_PETS=$(db_exec "$TGT_DB_CTR" -N -e "SELECT id FROM ${TGT_CHAR_DB}.character_pet WHERE owner IN (${TGT_GUIDS})" | tr '\n' ',' | sed 's/,$//')
        [[ -n "$TGT_PETS" ]] && for tbl in pet_aura pet_spell pet_spell_cooldown; do
            db_exec "$TGT_DB_CTR" -e "DELETE FROM ${TGT_CHAR_DB}.\`${tbl}\` WHERE guid IN (${TGT_PETS})" 2>/dev/null || true
        done
        db_exec "$TGT_DB_CTR" -e "DELETE FROM ${TGT_CHAR_DB}.character_pet WHERE owner IN (${TGT_GUIDS})" 2>/dev/null || true
        # Items, mail, corpse
        db_exec "$TGT_DB_CTR" -e "DELETE FROM ${TGT_CHAR_DB}.item_instance WHERE owner_guid IN (${TGT_GUIDS})" 2>/dev/null || true
        TGT_MAILS=$(db_exec "$TGT_DB_CTR" -N -e "SELECT id FROM ${TGT_CHAR_DB}.mail WHERE receiver IN (${TGT_GUIDS})" | tr '\n' ',' | sed 's/,$//')
        [[ -n "$TGT_MAILS" ]] && db_exec "$TGT_DB_CTR" -e "DELETE FROM ${TGT_CHAR_DB}.mail_items WHERE mail_id IN (${TGT_MAILS})" 2>/dev/null || true
        db_exec "$TGT_DB_CTR" -e "DELETE FROM ${TGT_CHAR_DB}.mail WHERE receiver IN (${TGT_GUIDS})" 2>/dev/null || true
        db_exec "$TGT_DB_CTR" -e "DELETE FROM ${TGT_CHAR_DB}.corpse WHERE player IN (${TGT_GUIDS})" 2>/dev/null || true
        db_exec "$TGT_DB_CTR" -e "DELETE FROM ${TGT_CHAR_DB}.characters WHERE account=${TGT_ACCOUNT_ID:-$ACCOUNT_ID}"
    fi

    # Insert migrated data from temp DB using explicit column names
    log_info "Inserting migrated data..."
    safe_insert "$TGT_DB_CTR" "$TEMP_DB" "$TGT_CHAR_DB" "characters" "account=${ACCOUNT_ID}" || {
        log_error "Failed to insert characters!"; exit 1; }
    # Remap account ID if source/target differ
    if [[ "${REMAP_ACCOUNT:-false}" == "true" ]]; then
        log_info "Remapping account ID: ${ACCOUNT_ID} → ${TGT_ACCOUNT_ID}"
        db_exec "$TGT_DB_CTR" -e "UPDATE ${TGT_CHAR_DB}.characters SET account=${TGT_ACCOUNT_ID} WHERE account=${ACCOUNT_ID}"
    fi

    for tbl in character_account_data character_action character_aura \
        character_battleground_data character_gifts character_homebind \
        character_instance character_inventory character_pet \
        character_queststatus character_queststatus_weekly character_reputation \
        character_skills character_social character_spell \
        character_spell_cooldown character_stats character_tutorial; do
        safe_insert "$TGT_DB_CTR" "$TEMP_DB" "$TGT_CHAR_DB" "$tbl" "guid IN (${GUID_LIST})" 2>/dev/null || true
    done

    # TBC/WotLK tables
    for tbl in character_queststatus_daily character_queststatus_monthly character_declinedname; do
        safe_insert "$TGT_DB_CTR" "$TEMP_DB" "$TGT_CHAR_DB" "$tbl" "guid IN (${GUID_LIST})" 2>/dev/null || true
    done

    # Pets
    PET_IDS=$(db_exec "$TGT_DB_CTR" -N -e "SELECT id FROM ${TEMP_DB}.character_pet WHERE owner IN (${GUID_LIST})" 2>/dev/null || true)
    PET_IDS=$(echo "$PET_IDS" | tr '\n' ',' | sed 's/,$//')
    [[ -n "$PET_IDS" ]] && for tbl in pet_aura pet_spell pet_spell_cooldown; do
        safe_insert "$TGT_DB_CTR" "$TEMP_DB" "$TGT_CHAR_DB" "$tbl" "guid IN (${PET_IDS})" 2>/dev/null || true
    done

    # Items
    safe_insert "$TGT_DB_CTR" "$TEMP_DB" "$TGT_CHAR_DB" "item_instance" "owner_guid IN (${GUID_LIST})" 2>/dev/null || log_warn "item_instance transfer issue"

    # Mail
    MAIL_IDS=$(db_exec "$TGT_DB_CTR" -N -e "SELECT id FROM ${TEMP_DB}.mail WHERE receiver IN (${GUID_LIST})" 2>/dev/null || true)
    MAIL_IDS=$(echo "$MAIL_IDS" | tr '\n' ',' | sed 's/,$//')
    [[ -n "$MAIL_IDS" ]] && {
        safe_insert "$TGT_DB_CTR" "$TEMP_DB" "$TGT_CHAR_DB" "mail" "receiver IN (${GUID_LIST})" 2>/dev/null || true
        safe_insert "$TGT_DB_CTR" "$TEMP_DB" "$TGT_CHAR_DB" "mail_items" "mail_id IN (${MAIL_IDS})" 2>/dev/null || true
    }

    # Corpse
    safe_insert "$TGT_DB_CTR" "$TEMP_DB" "$TGT_CHAR_DB" "corpse" "player IN (${GUID_LIST})" 2>/dev/null || true

    # Guild
    GUILD_IDS=$(db_exec "$TGT_DB_CTR" -N -e "SELECT DISTINCT guildid FROM ${TEMP_DB}.guild_member WHERE guid IN (${GUID_LIST})" 2>/dev/null || true)
    GUILD_IDS=$(echo "$GUILD_IDS" | tr '\n' ',' | sed 's/,$//')
    [[ -n "$GUILD_IDS" ]] && {
        log_info "Transferring guild(s): ${GUILD_IDS}"
        for tbl in guild_eventlog guild_member guild_rank guild; do
            db_exec "$TGT_DB_CTR" -e "DELETE FROM ${TGT_CHAR_DB}.\`${tbl}\` WHERE guildid IN (${GUILD_IDS})" 2>/dev/null || true
        done
        for tbl in guild guild_member guild_rank guild_eventlog; do
            safe_insert "$TGT_DB_CTR" "$TEMP_DB" "$TGT_CHAR_DB" "$tbl" "guildid IN (${GUILD_IDS})" 2>/dev/null || true
        done
        for tbl in guild_bank_eventlog guild_bank_item guild_bank_right guild_bank_tab; do
            safe_insert "$TGT_DB_CTR" "$TEMP_DB" "$TGT_CHAR_DB" "$tbl" "guildid IN (${GUILD_IDS})" 2>/dev/null || true
        done
    }

    # Petition
    safe_insert "$TGT_DB_CTR" "$TEMP_DB" "$TGT_CHAR_DB" "petition" "ownerguid IN (${GUID_LIST})" 2>/dev/null || true

    # WotLK-specific tables
    for tbl in character_achievement character_achievement_progress \
        character_battleground_random character_equipmentsets \
        character_glyphs character_talent; do
        safe_insert "$TGT_DB_CTR" "$TEMP_DB" "$TGT_CHAR_DB" "$tbl" "guid IN (${GUID_LIST})" 2>/dev/null || true
    done

    db_exec "$TGT_DB_CTR" -e "UPDATE ${TGT_CHAR_DB}.characters SET online=0 WHERE account=${ACCOUNT_ID}"

    # Force reset talents on next login
    # AT_LOGIN_RESET_TALENTS=0x04
    log_info "Setting at_login flags: reset talents"
    db_exec "$TGT_DB_CTR" -e "UPDATE ${TGT_CHAR_DB}.characters SET at_login = at_login | 4 WHERE guid IN (${GUID_LIST})"

    # Ensure class skills exist in character_skills (fixes spellbook tab placement).
    # Without these, client puts class spells into General tab.
    # Class skill IDs: Warrior(26,256,257), Paladin(594,267,184), Hunter(50,163,51),
    # Rogue(253,38,39), Priest(613,56,78), DK(770,771,772), Shaman(373,374,375),
    # Mage(237,8,6), Warlock(40,41,42), Druid(574,134,573)
    log_info "Ensuring class skills in character_skills..."
    for GUID in $(echo "$GUID_LIST" | tr ',' ' '); do
        CLASS_ID=$(db_exec "$TGT_DB_CTR" -N -e "SELECT class FROM ${TGT_CHAR_DB}.characters WHERE guid=${GUID}")
        SKILLS=""
        case "$CLASS_ID" in
            1) SKILLS="26,256,257" ;;   # Warrior
            2) SKILLS="594,267,184" ;;  # Paladin
            3) SKILLS="50,163,51" ;;    # Hunter
            4) SKILLS="253,38,39" ;;    # Rogue
            5) SKILLS="613,56,78" ;;    # Priest
            6) SKILLS="770,771,772" ;;  # Death Knight
            7) SKILLS="373,374,375" ;;  # Shaman
            8) SKILLS="237,8,6" ;;      # Mage
            9) SKILLS="40,41,42" ;;     # Warlock
            11) SKILLS="574,134,573" ;; # Druid
        esac
        if [[ -n "$SKILLS" ]]; then
            for SKILL in $(echo "$SKILLS" | tr ',' ' '); do
                db_exec "$TGT_DB_CTR" -e "INSERT IGNORE INTO ${TGT_CHAR_DB}.character_skills (guid, skill, value, max) VALUES (${GUID}, ${SKILL}, 1, 1)" 2>/dev/null || true
            done
        fi
    done

    # Remove talent spells from character_spell — talents reset on transfer,
    # but CMaNGOS doesn't clean spell entries. Match against armory DBC data.
    ARMORY_DB=""
    case "$TARGET" in
        tbc)   ARMORY_DB="tbcarmory" ;;
        wotlk) ARMORY_DB="wotlkarmory" ;;
    esac
    if [[ -n "$ARMORY_DB" ]]; then
        log_info "Cleaning talent spells from character_spell (talents reset on transfer)..."
        db_exec "$TGT_DB_CTR" -e "
            DELETE cs FROM ${TGT_CHAR_DB}.character_spell cs
            JOIN ${ARMORY_DB}.dbc_talent t
              ON cs.spell IN (t.rank1, t.rank2, t.rank3, t.rank4, t.rank5)
            WHERE cs.guid IN (${GUID_LIST})" 2>/dev/null || log_warn "Talent spell cleanup skipped (armory DB may not exist)"
    fi

else
    # ---- Full transfer: replace target DB ----
    log_info "Replacing ${TGT_CHAR_DB} with migrated data..."
    TEMP_TABLES=$(db_exec "$TGT_DB_CTR" -N -e "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='${TEMP_DB}'")
    for tbl in $TEMP_TABLES; do
        db_exec "$TGT_DB_CTR" -e "DROP TABLE IF EXISTS ${TGT_CHAR_DB}.\`${tbl}\`"
        db_exec "$TGT_DB_CTR" -e "CREATE TABLE ${TGT_CHAR_DB}.\`${tbl}\` LIKE ${TEMP_DB}.\`${tbl}\`"
        db_exec "$TGT_DB_CTR" -e "INSERT INTO ${TGT_CHAR_DB}.\`${tbl}\` SELECT * FROM ${TEMP_DB}.\`${tbl}\`"
    done
    db_exec "$TGT_DB_CTR" -e "UPDATE ${TGT_CHAR_DB}.characters SET online=0"
fi

# ---- STEP 8: Cleanup and restart ----
log_info "Cleaning up temp database..."
db_exec "$TGT_DB_CTR" -e "DROP DATABASE IF EXISTS ${TEMP_DB}"

FINAL_COUNT=$(db_exec "$TGT_DB_CTR" -N -e "SELECT COUNT(*) FROM ${TGT_CHAR_DB}.characters")
log_info "Final character count in ${TARGET}: ${FINAL_COUNT}"
[[ -n "$ACCOUNT" ]] && db_exec "$TGT_DB_CTR" -e \
    "SELECT guid,name,level,race,class FROM ${TGT_CHAR_DB}.characters WHERE account=${ACCOUNT_ID}"

if ! $NO_RESTART; then
    log_step "8/8 Restarting servers..."
    cd "${EXP_COMPOSE_DIR[$SOURCE]}" && docker compose up -d && log_info "${SOURCE} starting..."
    cd "${EXP_COMPOSE_DIR[$TARGET]}" && docker compose up -d && log_info "${TARGET} starting..."
    sleep 3
else
    log_step "8/8 Skipping restart"
fi

echo ""
echo "============================================================"
echo "  Transfer Complete!"
echo "============================================================"
echo "  ${SOURCE} → ${TARGET}"
[[ -n "$ACCOUNT" ]] && echo "  Account:    ${ACCOUNT}"
echo "  Characters: ${FINAL_COUNT}"
echo "  Backup:     ${BACKUP_DIR}"
echo ""
echo "  POST-TRANSFER:"
echo "  1. Visit a class trainer to re-learn abilities"
echo "  2. Reset talents: .reset talents"
echo "  3. Reconfigure action bars"
echo "============================================================"
! $SKIP_BACKUP && echo "" && echo "  ROLLBACK: docker exec -i ${TGT_DB_CTR} mariadb -u root -p'${DB_PASSWORD}' ${TGT_CHAR_DB} < ${BACKUP_DIR}/${TGT_CHAR_DB}_backup.sql"
echo ""
