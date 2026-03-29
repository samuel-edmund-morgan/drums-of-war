#!/usr/bin/env bash
# ============================================================
# lib.sh — Shared library for CMaNGOS transfer scripts
# ============================================================
# Source this in transfer-interactive.sh and daily-sync.sh:
#   source "$(dirname "$0")/lib.sh"
#
# Provides:
#   - Container/DB name maps
#   - Logging functions
#   - db_exec(), db_dump(), safe_insert(), table_exists()
#   - fix_char_after_transfer() — comprehensive post-transfer sanitization
#   - verify_character_login() — login bot wrapper
#   - verify_all_characters() — batch verify all chars on an account
#   - wait_for_server_ready() — wait for "World initialized"
#   - restart_after_crash() — docker restart + wait
# ============================================================

# Guard against double-sourcing
[[ -n "${_LIB_SH_LOADED:-}" ]] && return 0
_LIB_SH_LOADED=1

_LIB_SH_RESTORE_NOUNSET=false
case $- in
  *u*)
    _LIB_SH_RESTORE_NOUNSET=true
    set +u
    ;;
esac

LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -z "$DB_PASSWORD" ]; then echo "ERROR: DB_PASSWORD not set. Source .env or export it."; exit 1; fi
VMANGOS_DB_USER="${VMANGOS_DB_USER:-mangos}"
VMANGOS_DB_PASSWORD="${VMANGOS_DB_PASSWORD:-mangos}"
AZEROTHCORE_DB_PASSWORD="${AZEROTHCORE_DB_PASSWORD:-${DOCKER_DB_ROOT_PASSWORD}}"
AZEROTHCORE_COMPOSE_DIR="${AZEROTHCORE_COMPOSE_DIR:-${LIB_DIR}/../docker-azerothcore}"

if [[ "$AZEROTHCORE_DB_PASSWORD" == "change_me" ]]; then
  for azcore_env_file in "${AZEROTHCORE_COMPOSE_DIR}/.env" "${AZEROTHCORE_COMPOSE_DIR}/.env.example"; do
    [[ -f "$azcore_env_file" ]] || continue
    azcore_db_password=$(grep -E '^DOCKER_DB_ROOT_PASSWORD=' "$azcore_env_file" | tail -n 1 | cut -d= -f2-)
    if [[ -n "$azcore_db_password" ]]; then
      AZEROTHCORE_DB_PASSWORD="$azcore_db_password"
      break
    fi
  done
fi

# ============================================================
# Container & DB Maps
# ============================================================

declare -A LIB_DB_CONTAINER=(
  ["classic"]="vmangos-db"
  ["tbc"]="cmangos-tbc-db"
  ["wotlk"]="cmangos-wotlk-db"
  ["azerothcore"]="azerothcore-db"
)
declare -A LIB_SERVER_CONTAINER=(
  ["classic"]="vmangos-mangosd"
  ["tbc"]="cmangos-tbc-server"
  ["wotlk"]="cmangos-wotlk-server"
  ["azerothcore"]="azerothcore-worldserver"
)
declare -A LIB_AUTH_SERVER_CONTAINER=(
  ["azerothcore"]="azerothcore-authserver"
  ["classic"]="vmangos-realmd"
)
declare -A LIB_CHAR_DB=(
  ["classic"]="characters"
  ["tbc"]="tbccharacters"
  ["wotlk"]="wotlkcharacters"
  ["azerothcore"]="acore_characters"
)
declare -A LIB_REALMD_DB=(
  ["classic"]="realmd"
  ["tbc"]="tbcrealmd"
  ["wotlk"]="wotlkrealmd"
  ["azerothcore"]="acore_auth"
)
declare -A LIB_COMPOSE_DIR=(
  ["classic"]="/opt/vmangos-classic"
  ["tbc"]="/opt/cmangos-tbc"
  ["wotlk"]="/opt/cmangos-wotlk"
  ["azerothcore"]="${AZEROTHCORE_COMPOSE_DIR}"
)
declare -A LIB_WORLD_DB=(
  ["classic"]="mangos"
  ["tbc"]="tbcmangos"
  ["wotlk"]="wotlkmangos"
  ["azerothcore"]="acore_world"
)
declare -A LIB_AUTH_PORT=(
  ["classic"]=3724
  ["tbc"]=3725
  ["wotlk"]=3726
  ["azerothcore"]=3727
)
declare -A LIB_WORLD_PORT=(
  ["classic"]=8085
  ["tbc"]=8086
  ["wotlk"]=8087
  ["azerothcore"]=8088
)

LIB_SKIP_TABLES="character_db_version playerbot_saved_data ahbot_items saved_variables"

# ============================================================
# Logging
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# If caller defines LOG_FILE, log there too
_log_tee() {
  if [[ -n "${LOG_FILE:-}" ]]; then
    echo "$1" | tee -a "$LOG_FILE"
  else
    echo "$1"
  fi
}

log_info()  { _log_tee "$(echo -e "${GREEN}[INFO]${NC} $*")"; }
log_warn()  { _log_tee "$(echo -e "${YELLOW}[WARN]${NC} $*")"; }
log_error() { _log_tee "$(echo -e "${RED}[ERROR]${NC} $*")" >&2; }
log_step()  { _log_tee "$(echo -e "${CYAN}[STEP]${NC} $*")"; }

# ============================================================
# DB Helpers
# ============================================================

db_exec() {
  local ctr="$1"; shift
  local client="mariadb"
  local user="root"
  local password="${DB_PASSWORD}"

  if [[ "$ctr" == "${LIB_DB_CONTAINER["azerothcore"]}" ]]; then
    client="mysql"
  fi

  docker exec "$ctr" "$client" -u "${user}" -p"${password}" "$@" 2>/dev/null
}

db_dump() {
  local ctr="$1"; shift
  local client="mariadb-dump"
  local user="root"
  local password="${DB_PASSWORD}"

  if [[ "$ctr" == "${LIB_DB_CONTAINER["azerothcore"]}" ]]; then
    client="mysqldump"
  fi

  docker exec "$ctr" "$client" -u "${user}" -p"${password}" "$@" 2>/dev/null
}

safe_insert() {
  local ctr="$1" src_db="$2" dst_db="$3" tbl="$4" where="$5"
  local src_cols dst_cols
  src_cols=$(db_exec "$ctr" -N -e "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='${src_db}' AND TABLE_NAME='${tbl}' ORDER BY ORDINAL_POSITION" | tr '\n' ',')
  dst_cols=$(db_exec "$ctr" -N -e "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='${dst_db}' AND TABLE_NAME='${tbl}' ORDER BY ORDINAL_POSITION" | tr '\n' ',')
  [[ -z "$src_cols" || -z "$dst_cols" ]] && return 1

  local common_cols=""
  IFS=',' read -ra dst_arr <<< "$dst_cols"
  for col in "${dst_arr[@]}"; do
    [[ -z "$col" ]] && continue
    if echo ",$src_cols" | grep -q ",${col},"; then
      [[ -n "$common_cols" ]] && common_cols+=","
      common_cols+="\`${col}\`"
    fi
  done
  [[ -z "$common_cols" ]] && return 1

  local sql="INSERT INTO ${dst_db}.\`${tbl}\` (${common_cols}) SELECT ${common_cols} FROM ${src_db}.\`${tbl}\`"
  [[ -n "$where" ]] && sql+=" WHERE ${where}"
  db_exec "$ctr" -e "$sql"
}

table_exists() {
  local ctr="$1" db="$2" tbl="$3"
  local cnt
  cnt=$(db_exec "$ctr" -N -e "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='${db}' AND TABLE_NAME='${tbl}'")
  [[ "$cnt" != "0" ]]
}

# ============================================================
# Post-Transfer Character Sanitization
# ============================================================
# Comprehensive sanitization for cross-expansion transfer.
# Clears incompatible blobs, resets talents, validates items/spells,
# handles PVP honor migration, WotLK achievement bug workaround.
#
# Required variables from caller:
#   - TEMP_DB (name of the temp database with source data)
#
# Args: $1 = target expansion, $2 = character guid

fix_char_after_transfer() {
  local tgt="$1" guid="$2"
  local ctr="${LIB_DB_CONTAINER[$tgt]}"
  local db="${LIB_CHAR_DB[$tgt]}"
  local world_db="${LIB_WORLD_DB[$tgt]}"

  log_info "  Sanitizing guid=${guid} for ${tgt}..."

  # ============================================================
  # 1. CLEAR INCOMPATIBLE BLOBS (critical — prevents ASSERT crash)
  # ============================================================
  db_exec "$ctr" -e "UPDATE ${db}.characters SET equipmentCache='' WHERE guid=${guid}"

  # ============================================================
  # 2. CLEAR TEMPORARY/TRANSIENT DATA
  # ============================================================
  db_exec "$ctr" -e "DELETE FROM ${db}.character_aura WHERE guid=${guid}" || true
  db_exec "$ctr" -e "DELETE FROM ${db}.character_spell_cooldown WHERE guid=${guid}" || true
  db_exec "$ctr" -e "UPDATE ${db}.characters SET death_expire_time=0 WHERE guid=${guid}"

  # ============================================================
  # 3. TALENT RESET — talent trees differ across expansions
  # ============================================================
  # RESET_TALENTS (bit 4) only. NOT RESET_SPELLS (bit 2)!
  # RESET_SPELLS would delete profession spells and reset profession skill values.
  # Instead, we clean invalid spells manually in Section 6 (spell validation).
  db_exec "$ctr" -e "UPDATE ${db}.characters SET
    at_login = at_login | 4,
    resettalents_cost = 0,
    resettalents_time = 0,
    online = 0
    WHERE guid=${guid}"

  # 3c. WotLK-specific: clear character_talent and character_glyphs tables
  if [[ "$tgt" == "wotlk" ]]; then
    table_exists "$ctr" "$db" "character_talent" && \
      db_exec "$ctr" -e "DELETE FROM ${db}.character_talent WHERE guid=${guid}" || true
    table_exists "$ctr" "$db" "character_glyphs" && \
      db_exec "$ctr" -e "DELETE FROM ${db}.character_glyphs WHERE guid=${guid}" || true
  fi

  # ============================================================
  # 4. BLOB FIELD PADDING (expansion-specific sizes)
  # ============================================================
  if [[ "$tgt" == "wotlk" || "$tgt" == "azerothcore" ]]; then
    # taximask: pad to 14 values
    local cur_taxi
    cur_taxi=$(db_exec "$ctr" -N -e "SELECT taximask FROM ${db}.characters WHERE guid=${guid}")
    if [[ -n "$cur_taxi" ]]; then
      local taxi_count
      taxi_count=$(echo "$cur_taxi" | awk '{print NF}')
      if [[ "$taxi_count" -lt 14 ]]; then
        local pad=""
        for ((i=taxi_count; i<14; i++)); do pad+="0 "; done
        db_exec "$ctr" -e "UPDATE ${db}.characters SET taximask=CONCAT(taximask, '${pad}') WHERE guid=${guid}"
      fi
    fi

    # exploredZones: pad to 128 values
    local cur_zones
    cur_zones=$(db_exec "$ctr" -N -e "SELECT exploredZones FROM ${db}.characters WHERE guid=${guid}")
    if [[ -n "$cur_zones" ]]; then
      local zone_count
      zone_count=$(echo "$cur_zones" | awk '{print NF}')
      if [[ "$zone_count" -lt 128 ]]; then
        local pad=""
        for ((i=zone_count; i<128; i++)); do pad+="0 "; done
        db_exec "$ctr" -e "UPDATE ${db}.characters SET exploredZones=CONCAT(exploredZones, '${pad}') WHERE guid=${guid}"
      fi
    fi

    # knownTitles: WotLK/AC expects exactly 6 uint32 values — pad existing, don't overwrite
    local cur_kt
    cur_kt=$(db_exec "$ctr" -N -e "SELECT IFNULL(knownTitles, '') FROM ${db}.characters WHERE guid=${guid}" 2>/dev/null)
    local kt_arr=()
    [[ -n "$cur_kt" ]] && read -ra kt_arr <<< "$cur_kt"
    while [[ ${#kt_arr[@]} -lt 6 ]]; do kt_arr+=(0); done
    db_exec "$ctr" -e "UPDATE ${db}.characters SET knownTitles='${kt_arr[*]} ' WHERE guid=${guid}"
  fi

  if [[ "$tgt" == "wotlk" ]]; then
    # WotLK-specific column defaults
    db_exec "$ctr" -e "
      UPDATE ${db}.characters SET
        specCount = CASE WHEN specCount = 0 THEN 1 ELSE specCount END,
        power6 = IFNULL(power6, 0),
        power7 = IFNULL(power7, 0),
        knownCurrencies = IFNULL(knownCurrencies, 0),
        chosenTitle = IFNULL(chosenTitle, 0)
      WHERE guid=${guid}"

  elif [[ "$tgt" == "tbc" ]]; then
    # taximask: pad to 8 values
    local cur_taxi
    cur_taxi=$(db_exec "$ctr" -N -e "SELECT taximask FROM ${db}.characters WHERE guid=${guid}")
    if [[ -n "$cur_taxi" ]]; then
      local taxi_count
      taxi_count=$(echo "$cur_taxi" | awk '{print NF}')
      if [[ "$taxi_count" -lt 8 ]]; then
        local pad=""
        for ((i=taxi_count; i<8; i++)); do pad+="0 "; done
        db_exec "$ctr" -e "UPDATE ${db}.characters SET taximask=CONCAT(taximask, '${pad}') WHERE guid=${guid}"
      fi
    fi

    # knownTitles: TBC expects 2 uint32 values — pad existing, don't overwrite
    local cur_kt
    cur_kt=$(db_exec "$ctr" -N -e "SELECT IFNULL(knownTitles, '') FROM ${db}.characters WHERE guid=${guid}" 2>/dev/null)
    local kt_arr=()
    [[ -n "$cur_kt" ]] && read -ra kt_arr <<< "$cur_kt"
    while [[ ${#kt_arr[@]} -lt 2 ]]; do kt_arr+=(0); done
    db_exec "$ctr" -e "UPDATE ${db}.characters SET knownTitles='${kt_arr[*]} ' WHERE guid=${guid}"
  fi

  # ============================================================
  # 5. ITEM VALIDATION — remove items not in target world DB
  # ============================================================
  if table_exists "$ctr" "$db" "item_instance"; then
    local invalid_items
    invalid_items=$(db_exec "$ctr" -N -e "
      SELECT COUNT(*) FROM ${db}.item_instance ii
      LEFT JOIN ${world_db}.item_template it ON ii.itemEntry = it.entry
      WHERE ii.owner_guid=${guid} AND it.entry IS NULL" 2>/dev/null || echo "0")
    if [[ "${invalid_items:-0}" != "0" ]]; then
      log_info "    Removing ${invalid_items} items with invalid IDs for ${tgt}"
      db_exec "$ctr" -e "
        DELETE ci FROM ${db}.character_inventory ci
        INNER JOIN ${db}.item_instance ii ON ci.item = ii.guid
        LEFT JOIN ${world_db}.item_template it ON ii.itemEntry = it.entry
        WHERE ci.guid=${guid} AND it.entry IS NULL" || true
      db_exec "$ctr" -e "
        DELETE ii FROM ${db}.item_instance ii
        LEFT JOIN ${world_db}.item_template it ON ii.itemEntry = it.entry
        WHERE ii.owner_guid=${guid} AND it.entry IS NULL" || true
    fi
  fi

  # Clean up orphaned inventory slots
  if table_exists "$ctr" "$db" "character_inventory"; then
    db_exec "$ctr" -e "
      DELETE ci FROM ${db}.character_inventory ci
      LEFT JOIN ${db}.item_instance ii ON ci.item = ii.guid
      WHERE ci.guid=${guid} AND ii.guid IS NULL" || true
  fi

  # Clean up orphaned item_instances
  if table_exists "$ctr" "$db" "item_instance" && table_exists "$ctr" "$db" "character_inventory"; then
    db_exec "$ctr" -e "
      DELETE ii FROM ${db}.item_instance ii
      LEFT JOIN ${db}.character_inventory ci ON ii.guid = ci.item
      WHERE ii.owner_guid=${guid} AND ci.item IS NULL" || true
  fi

  # ============================================================
  # 6. SPELL VALIDATION — remove invalid spells
  # ============================================================
  # For CMaNGOS/VMaNGOS: validate against spell_template (complete table).
  # For AzerothCore: SKIP validation! spell_dbc contains only overrides,
  #   not the full spell list (full data is in client DBC files).
  #   AzerothCore's worldserver gracefully ignores unknown spells at login.
  if table_exists "$ctr" "$db" "character_spell"; then
    local invalid_spells=0
    if [[ "$tgt" == "azerothcore" ]]; then
      # AzerothCore: do NOT validate against spell_dbc (incomplete table)
      local total_spells
      total_spells=$(db_exec "$ctr" -N -e "
        SELECT COUNT(*) FROM ${db}.character_spell WHERE guid=${guid}" 2>/dev/null || echo "0")
      log_info "    Spells: kept all ${total_spells} (AzerothCore — server handles invalid spells)"
    elif table_exists "$ctr" "$world_db" "spell_template"; then
      invalid_spells=$(db_exec "$ctr" -N -e "
        SELECT COUNT(*) FROM ${db}.character_spell cs
        LEFT JOIN ${world_db}.spell_template st ON cs.spell = st.Id
        WHERE cs.guid=${guid} AND st.Id IS NULL" 2>/dev/null || echo "0")
      if [[ "${invalid_spells:-0}" != "0" ]]; then
        log_info "    Removing ${invalid_spells} invalid spells (not in ${tgt} spell_template)"
        db_exec "$ctr" -e "
          DELETE cs FROM ${db}.character_spell cs
          LEFT JOIN ${world_db}.spell_template st ON cs.spell = st.Id
          WHERE cs.guid=${guid} AND st.Id IS NULL" || true
      fi
      local remaining_spells
      remaining_spells=$(db_exec "$ctr" -N -e "
        SELECT COUNT(*) FROM ${db}.character_spell WHERE guid=${guid}" 2>/dev/null || echo "0")
      log_info "    Spells: removed ${invalid_spells}, kept ${remaining_spells}"
    else
      log_info "    WARN: No spell reference table found for ${tgt} — skipping spell validation"
    fi
  fi

  # ============================================================
  # 6b. PROFESSION SPELL GUARANTEE — ensure rank spells exist
  # ============================================================
  # After spell validation, profession rank spells may have been removed
  # (different spell IDs between emulators). Without these, the server
  # resets profession skills to 1/225. Re-insert based on character_skills.
  #
  # Profession rank spells (consistent across Classic/TBC/WotLK):
  #   skill_id → [apprentice(1-75), journeyman(76-150), expert(151-225), artisan(226-300)]
  if table_exists "$ctr" "$db" "character_spell" && table_exists "$ctr" "$db" "character_skills"; then
    local prof_inserts=""
    # Map: skill_id|apprentice|journeyman|expert|artisan
    local prof_map=(
      "197|3908|3909|3910|12180"    # Tailoring
      "333|7411|7412|7413|13920"    # Enchanting
      "164|2018|3100|3538|9785"     # Blacksmithing
      "165|2108|3104|3811|10662"    # Leatherworking
      "171|2259|3101|3464|11611"    # Alchemy
      "182|2366|2368|3570|11993"    # Herbalism
      "186|2575|2576|3564|10248"    # Mining
      "202|4036|4037|4038|12656"    # Engineering
      "393|8613|8617|8618|10768"    # Skinning
      "129|3273|3274|7924|10846"    # First Aid
      "185|2550|3102|3413|18260"    # Cooking
      "356|7620|7731|7732|18248"    # Fishing
    )

    for entry in "${prof_map[@]}"; do
      IFS='|' read -r skill_id sp1 sp2 sp3 sp4 <<< "$entry"
      local skill_max
      skill_max=$(db_exec "$ctr" -N -e "
        SELECT max FROM ${db}.character_skills WHERE guid=${guid} AND skill=${skill_id}" 2>/dev/null)
      if [[ -n "$skill_max" && "$skill_max" -gt 0 ]]; then
        # Determine which rank spells to insert based on skill max
        local spells_to_add="$sp1"
        [[ "$skill_max" -gt 75 ]]  && spells_to_add="$spells_to_add,$sp2"
        [[ "$skill_max" -gt 150 ]] && spells_to_add="$spells_to_add,$sp3"
        [[ "$skill_max" -gt 225 ]] && spells_to_add="$spells_to_add,$sp4"

        for sp in ${spells_to_add//,/ }; do
          if [[ "$tgt" == "azerothcore" ]]; then
            prof_inserts+="INSERT IGNORE INTO ${db}.character_spell (guid, spell, specMask) VALUES (${guid}, ${sp}, 255);"
          else
            prof_inserts+="INSERT IGNORE INTO ${db}.character_spell (guid, spell, active, disabled) VALUES (${guid}, ${sp}, 1, 0);"
          fi
        done
      fi
    done

    if [[ -n "$prof_inserts" ]]; then
      db_exec "$ctr" -e "$prof_inserts" || true
      # For AzerothCore: fix specMask on ALL profession spells (both inserted and existing)
      # specMask=1 (from CMaNGOS active=1 mapping) breaks professions; must be 255
      if [[ "$tgt" == "azerothcore" ]]; then
        db_exec "$ctr" -e "
          UPDATE ${db}.character_spell SET specMask=255
          WHERE guid=${guid} AND spell IN (
            3908,3909,3910,12180,7411,7412,7413,13920,2018,3100,3538,9785,
            2108,3104,3811,10662,2259,3101,3464,11611,2366,2368,3570,11993,
            2575,2576,3564,10248,4036,4037,4038,12656,8613,8617,8618,10768,
            3273,3274,7924,10846,2550,3102,3413,18260,7620,7731,7732,18248
          )" || true
      fi
      log_info "    Ensured profession rank spells exist for all trained professions"
    fi
  fi

  # ============================================================
  # 7. SAFETY NET — ensure critical data exists
  # ============================================================
  local rep_count skill_count
  rep_count=$(db_exec "$ctr" -N -e "SELECT COUNT(*) FROM ${db}.character_reputation WHERE guid=${guid}" 2>/dev/null || echo "0")
  skill_count=$(db_exec "$ctr" -N -e "SELECT COUNT(*) FROM ${db}.character_skills WHERE guid=${guid}" 2>/dev/null || echo "0")

  if [[ "${rep_count:-0}" == "0" ]]; then
    log_info "    WARN: No reputation data for guid=${guid} on ${tgt} — inserting defaults"
    local char_race
    char_race=$(db_exec "$ctr" -N -e "SELECT race FROM ${db}.characters WHERE guid=${guid}")
    local default_factions=""
    if [[ "$char_race" == "1" || "$char_race" == "3" || "$char_race" == "4" || "$char_race" == "7" || "$char_race" == "11" ]]; then
      default_factions="(${guid},72,0,17),(${guid},47,0,4),(${guid},54,0,4),(${guid},69,0,4),(${guid},930,0,4)"
    else
      default_factions="(${guid},76,0,17),(${guid},530,0,4),(${guid},81,0,4),(${guid},68,0,4),(${guid},911,0,4)"
    fi
    db_exec "$ctr" -e "INSERT IGNORE INTO ${db}.character_reputation (guid, faction, standing, flags) VALUES ${default_factions}" || true
  fi

  if [[ "${skill_count:-0}" == "0" ]]; then
    log_info "    WARN: No skills data for guid=${guid} on ${tgt} — inserting Language skill"
    local char_race
    char_race=$(db_exec "$ctr" -N -e "SELECT race FROM ${db}.characters WHERE guid=${guid}" 2>/dev/null)
    local lang_skill=98
    if [[ "$char_race" == "2" || "$char_race" == "5" || "$char_race" == "6" || "$char_race" == "8" || "$char_race" == "10" ]]; then
      lang_skill=109
    fi
    db_exec "$ctr" -e "INSERT IGNORE INTO ${db}.character_skills (guid, skill, value, max) VALUES (${guid}, ${lang_skill}, 300, 300)" || true
  fi

  # ============================================================
  # 8. WotLK ACHIEVEMENT BUG WORKAROUND (prevents ASSERT crash)
  # ============================================================
  if [[ "$tgt" == "wotlk" ]]; then
    local char_money
    char_money=$(db_exec "$ctr" -N -e "SELECT money FROM ${db}.characters WHERE guid=${guid}" 2>/dev/null || echo "0")
    if [[ "${char_money:-0}" != "0" ]]; then
      log_info "    Applying WotLK achievement workaround (criteria 4224, money=${char_money})"
      db_exec "$ctr" -e "
        INSERT INTO ${db}.character_achievement_progress (guid, criteria, counter, date, failed)
        VALUES (${guid}, 4224, ${char_money}, UNIX_TIMESTAMP(), 0)
        ON DUPLICATE KEY UPDATE counter = GREATEST(counter, VALUES(counter))" || true
    fi
  fi

  # ============================================================
  # 9. PVP HONOR MIGRATION (Classic → TBC/WotLK)
  # ============================================================
  if [[ "$tgt" == "tbc" || "$tgt" == "wotlk" ]]; then
    local has_honor_col=0
    has_honor_col=$(db_exec "$ctr" -N -e "
      SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA='${TEMP_DB}' AND TABLE_NAME='characters'
      AND COLUMN_NAME='honor_highest_rank'" 2>/dev/null || echo "0")

    if [[ "${has_honor_col:-0}" != "0" ]]; then
      local honor_rank=0
      honor_rank=$(db_exec "$ctr" -N -e "
        SELECT IFNULL(honor_highest_rank, 0) FROM ${TEMP_DB}.characters
        WHERE guid=${guid}" 2>/dev/null || echo "0")

      if [[ "${honor_rank:-0}" -gt 4 ]]; then
        local visual_rank=$((honor_rank - 4))
        local char_race
        char_race=$(db_exec "$ctr" -N -e "SELECT race FROM ${db}.characters WHERE guid=${guid}")
        local title_bits=0
        if [[ "$char_race" == "1" || "$char_race" == "3" || "$char_race" == "4" || "$char_race" == "7" || "$char_race" == "11" ]]; then
          for ((i=1; i<=visual_rank; i++)); do title_bits=$((title_bits | (1 << i))); done
        else
          for ((i=15; i<=14+visual_rank; i++)); do title_bits=$((title_bits | (1 << i))); done
        fi

        local cur_kt
        cur_kt=$(db_exec "$ctr" -N -e "SELECT knownTitles FROM ${db}.characters WHERE guid=${guid}" 2>/dev/null)
        local kt_arr=()
        [[ -n "$cur_kt" ]] && read -ra kt_arr <<< "$cur_kt"
        [[ ${#kt_arr[@]} -eq 0 ]] && kt_arr=(0)
        kt_arr[0]=$((${kt_arr[0]:-0} | title_bits))
        db_exec "$ctr" -e "UPDATE ${db}.characters SET knownTitles='${kt_arr[*]} ' WHERE guid=${guid}"
        log_info "    PVP rank ${honor_rank} → visual ${visual_rank} → knownTitles[0]=${kt_arr[0]}"
      fi

      local hk=0
      hk=$(db_exec "$ctr" -N -e "
        SELECT IFNULL(stored_honorable_kills, 0) FROM ${TEMP_DB}.characters
        WHERE guid=${guid}" 2>/dev/null || echo "0")
      if [[ "${hk:-0}" != "0" ]]; then
        db_exec "$ctr" -e "UPDATE ${db}.characters SET totalKills=${hk} WHERE guid=${guid}"
        log_info "    Migrated totalKills=${hk} from Classic honor data"
      fi
    fi
  fi

  log_info "  Sanitization complete for guid=${guid}"
}

# ============================================================
# Server Management
# ============================================================

# Wait for a game server container to fully initialize.
# Checks docker logs for "World initialized" message.
# Args: $1 = container name, $2 = max wait seconds (default 120)
# Returns: 0 on success, 1 on timeout
wait_for_server_ready() {
  local container="$1" max_wait="${2:-120}"
  local elapsed=0
  log_info "Waiting for ${container} to initialize (max ${max_wait}s)..."
  while [[ $elapsed -lt $max_wait ]]; do
    if docker logs "$container" --tail 40 2>&1 | grep -Eqi 'world initialized|ready\.\.\.'; then
      sleep 3  # buffer for full stabilization
      log_info "${container} ready (${elapsed}s)"
      return 0
    fi
    sleep 3
    elapsed=$((elapsed + 3))
  done
  log_error "Server ${container} not ready after ${max_wait}s"
  return 1
}

# Stop a game server container if running.
# Args: $1 = container name, $2 = display name
stop_server_if_running() {
  local ctr="$1" name="$2"
  if docker inspect --format='{{.State.Running}}' "$ctr" 2>/dev/null | grep -q true; then
    log_info "Stopping ${name}..."
    docker stop -t 30 "$ctr" >/dev/null 2>&1 || true
  else
    log_info "${name} already stopped"
  fi
}

# Start a game server via docker compose (or docker start for stacks
# where compose-up would re-init DB passwords).
# Args: $1 = expansion (classic|tbc|wotlk|azerothcore)
start_server() {
  local exp="$1"
  cd "${LIB_COMPOSE_DIR[$exp]}"
  if [[ "$exp" == "azerothcore" ]]; then
    # Use docker start to avoid DB container re-creation that resets root password
    docker start azerothcore-db >/dev/null 2>&1 || true
    # Wait for DB healthy before starting servers
    local _i=0
    while [[ $_i -lt 30 ]]; do
      if docker inspect --format='{{.State.Health.Status}}' azerothcore-db 2>/dev/null | grep -q healthy; then break; fi
      sleep 2; ((_i++))
    done
    docker start azerothcore-authserver azerothcore-worldserver >/dev/null 2>&1
  else
    docker compose up -d >/dev/null
  fi
  log_info "${exp} started"
}

# Restart a crashed server and wait for it to be ready.
# Args: $1 = expansion (classic|tbc|wotlk|azerothcore)
# Returns: 0 if server came back up, 1 if timeout
restart_after_crash() {
  local exp="$1"
  local container="${LIB_SERVER_CONTAINER[$exp]}"
  log_warn "Server ${container} crashed! Restarting..."
  cd "${LIB_COMPOSE_DIR[$exp]}"
  if [[ "$exp" == "azerothcore" ]]; then
    docker stop -t 10 azerothcore-worldserver azerothcore-authserver >/dev/null 2>&1 || true
    sleep 2
    docker start azerothcore-authserver azerothcore-worldserver >/dev/null 2>&1
  else
    docker compose stop cmangos-"${exp}"-server >/dev/null 2>&1 || true
    sleep 2
    docker compose up -d >/dev/null 2>&1
  fi
  wait_for_server_ready "$container" 120
}

# ============================================================
# Login Bot Verification
# ============================================================

# Verify a single character can log in using the login bot.
# Uses wow_login_test_universal.py on the remote host.
# Args: $1=expansion, $2=username, $3=password, $4=guid
# Returns: 0=SUCCESS, 1=FAIL/CRASH
# Outputs: login bot stdout/stderr
verify_character_login() {
  local expansion="$1" username="$2" password="$3" guid="$4"
  local bot_path="${LIB_DIR}/wow_login_test_universal.py"
  local result rc

  result=$(python3 "$bot_path" \
    --expansion "$expansion" \
    --username "$username" \
    --password "$password" \
    --guid "$guid" 2>&1) || true
  rc=${PIPESTATUS[0]:-$?}

  echo "$result"

  # Parse result from output
  if echo "$result" | grep -q "RESULT: SUCCESS"; then
    return 0
  else
    return 1
  fi
}

# Verify ALL characters for an account on a target expansion.
# Args: $1=expansion, $2=username, $3=password
# Returns: number of failed logins (0 = all OK)
verify_all_characters() {
  local expansion="$1" username="$2" password="$3"
  local ctr="${LIB_DB_CONTAINER[$expansion]}"
  local char_db="${LIB_CHAR_DB[$expansion]}"
  local realm_db="${LIB_REALMD_DB[$expansion]}"
  local failed=0

  local account_id
  account_id=$(db_exec "$ctr" -N -e "SELECT id FROM ${realm_db}.account WHERE username='${username}'")
  [[ -z "$account_id" ]] && { log_error "Account '${username}' not found on ${expansion}"; return 1; }

  local guids
  guids=$(db_exec "$ctr" -N -e "SELECT guid FROM ${char_db}.characters WHERE account=${account_id}")
  [[ -z "$guids" ]] && { log_info "No characters for ${username} on ${expansion}"; return 0; }

  while IFS= read -r guid; do
    [[ -z "$guid" ]] && continue
    local char_name
    char_name=$(db_exec "$ctr" -N -e "SELECT name FROM ${char_db}.characters WHERE guid=${guid}")
    log_info "  Verifying ${char_name} (guid=${guid}) on ${expansion}..."

    if verify_character_login "$expansion" "$username" "$password" "$guid"; then
      log_info "  VERIFY OK: ${char_name} (guid=${guid})"
    else
      log_error "  VERIFY FAIL: ${char_name} (guid=${guid}) on ${expansion}"
      failed=$((failed + 1))
    fi
  done <<< "$guids"

  return $failed
}

# ============================================================
# Account Management
# ============================================================

map_azerothcore_locale() {
  local locale
  locale="$(echo "${1:-}" | tr '[:upper:]' '[:lower:]')"
  case "$locale" in
    kokr) echo 1 ;;
    frfr) echo 2 ;;
    dede) echo 3 ;;
    zhcn) echo 4 ;;
    zhtw) echo 5 ;;
    eses) echo 6 ;;
    esmx) echo 7 ;;
    ruru) echo 8 ;;
    *) echo 0 ;;
  esac
}

# Ensure account exists on target; auto-create from source if missing.
# Copies: username, s, v (password), gmlevel, expansion, email, locale
# Args: $1=source expansion, $2=target expansion, $3=username
ensure_account() {
  local src="$1" tgt="$2" username="$3"
  local src_ctr="${LIB_DB_CONTAINER[$src]}" tgt_ctr="${LIB_DB_CONTAINER[$tgt]}"
  local src_realm="${LIB_REALMD_DB[$src]}" tgt_realm="${LIB_REALMD_DB[$tgt]}"

  local tgt_id
  tgt_id=$(db_exec "$tgt_ctr" -N -e "SELECT id FROM ${tgt_realm}.account WHERE username='${username}'")
  if [[ -n "$tgt_id" ]]; then
    if [[ "$tgt" == "azerothcore" ]]; then
      local src_gm_existing
      src_gm_existing=$(db_exec "$src_ctr" -N -e "
        SELECT gmlevel FROM ${src_realm}.account WHERE username='${username}'" 2>/dev/null || echo "0")
      db_exec "$tgt_ctr" -e "
        UPDATE ${tgt_realm}.account
        SET expansion = GREATEST(expansion, 2)
        WHERE id=${tgt_id}" 2>/dev/null || true
      if [[ "${src_gm_existing:-0}" -gt 0 ]]; then
        db_exec "$tgt_ctr" -e "
          INSERT INTO ${tgt_realm}.account_access (id, gmlevel, RealmID, comment)
          VALUES (${tgt_id}, ${src_gm_existing}, -1, 'Auto-created from ${src} by daily-sync')
          ON DUPLICATE KEY UPDATE gmlevel = GREATEST(gmlevel, VALUES(gmlevel)),
                                  RealmID = VALUES(RealmID),
                                  comment = VALUES(comment)" 2>/dev/null || true
      fi
      return 0
    fi

    local correct_exp=0
    case "$tgt" in
      tbc)   correct_exp=1 ;;
      wotlk) correct_exp=2 ;;
    esac
    db_exec "$tgt_ctr" -e "UPDATE ${tgt_realm}.account SET expansion=${correct_exp} WHERE id=${tgt_id} AND expansion<${correct_exp}" 2>/dev/null || true
    return 0
  fi

  local src_data
  src_data=$(db_exec "$src_ctr" -N -e "
    SELECT CONCAT(
             s, '|',
             v, '|',
             gmlevel, '|',
             expansion, '|',
             REPLACE(IFNULL(email, ''), '|', ''), '|',
             REPLACE(IFNULL(locale, ''), '|', ''), '|',
             REPLACE(IFNULL(sessionkey, ''), '|', ''), '|',
             DATE_FORMAT(joindate, '%Y-%m-%d %H:%i:%s'), '|',
             REPLACE(IFNULL(lockedIp, '0.0.0.0'), '|', ''), '|',
             failed_logins, '|',
             locked, '|',
             mutetime, '|',
             REPLACE(IFNULL(os, '0'), '|', ''), '|',
             flags)
    FROM ${src_realm}.account WHERE username='${username}'")
  [[ -z "$src_data" ]] && { log_error "Account '${username}' not found on ${src}!"; return 1; }

  local src_s src_v src_gm src_exp src_email src_locale src_sessionkey src_joindate
  local src_locked_ip src_failed_logins src_locked src_mutetime src_os src_flags
  IFS='|' read -r src_s src_v src_gm src_exp src_email src_locale src_sessionkey \
    src_joindate src_locked_ip src_failed_logins src_locked src_mutetime src_os src_flags <<< "$src_data"

  if [[ "$tgt" == "azerothcore" ]]; then
    local acore_locale acore_os acore_email last_ip session_expr
    acore_locale="$(map_azerothcore_locale "$src_locale")"
    acore_os=""
    if [[ -n "${src_os:-}" && "$src_os" != "0" ]]; then
      acore_os="${src_os:0:3}"
    fi
    acore_email="${src_email//\'/\'\'}"
    last_ip="$src_locked_ip"
    if [[ -z "$last_ip" || "$last_ip" == "0.0.0.0" ]]; then
      last_ip="127.0.0.1"
    fi

    if [[ -z "${src_s:-}" || -z "${src_v:-}" ]]; then
      log_error "Account '${username}' on ${src} has empty s/v; cannot create AzerothCore account"
      return 1
    fi

    session_expr="NULL"
    if [[ -n "${src_sessionkey:-}" ]]; then
      session_expr="UNHEX(LPAD(LEFT('${src_sessionkey}', 80), 80, '0'))"
    fi

    db_exec "$tgt_ctr" -e "
      INSERT INTO ${tgt_realm}.account
      (username, salt, verifier, session_key, email, reg_mail, joindate,
       last_ip, last_attempt_ip, failed_logins, locked, expansion, Flags,
       mutetime, locale, os, lock_country, mutereason, muteby, recruiter, totaltime)
      VALUES
      ('${username}',
       REVERSE(UNHEX(LPAD('${src_s}', 64, '0'))),
       REVERSE(UNHEX(LPAD('${src_v}', 64, '0'))),
       ${session_expr},
       '${acore_email}',
       '${acore_email}',
       '${src_joindate}',
       '${last_ip}',
       '${last_ip}',
       ${src_failed_logins:-0},
       ${src_locked:-0},
       2,
       ${src_flags:-0},
       ${src_mutetime:-0},
       ${acore_locale},
       '${acore_os}',
       '00',
       '',
       '',
       0,
       0)"

    local new_acore_id
    new_acore_id=$(db_exec "$tgt_ctr" -N -e "SELECT id FROM ${tgt_realm}.account WHERE username='${username}'")
    if [[ -z "$new_acore_id" ]]; then
      log_error "Failed to create account '${username}' on ${tgt}"
      return 1
    fi

    if [[ "${src_gm:-0}" -gt 0 ]]; then
      db_exec "$tgt_ctr" -e "
        INSERT INTO ${tgt_realm}.account_access (id, gmlevel, RealmID, comment)
        VALUES (${new_acore_id}, ${src_gm}, -1, 'Auto-created from ${src} by daily-sync')
        ON DUPLICATE KEY UPDATE gmlevel = GREATEST(gmlevel, VALUES(gmlevel)),
                                RealmID = VALUES(RealmID),
                                comment = VALUES(comment)" 2>/dev/null || true
    fi

    TOTAL_CREATED=$((TOTAL_CREATED + 1))
    log_info "  AUTO-CREATED account '${username}' on ${tgt} (id=${new_acore_id}, gm=${src_gm})"
    return 0
  fi

  local tgt_exp=0
  case "$tgt" in
    tbc)   tgt_exp=1 ;;
    wotlk) tgt_exp=2 ;;
  esac

  db_exec "$tgt_ctr" -e "
    INSERT INTO ${tgt_realm}.account (username, s, v, gmlevel, expansion, email, locale)
    VALUES ('${username}', '${src_s}', '${src_v}', ${src_gm}, ${tgt_exp}, '${src_email}', '${src_locale}')"

  local new_id
  new_id=$(db_exec "$tgt_ctr" -N -e "SELECT id FROM ${tgt_realm}.account WHERE username='${username}'")
  if [[ -n "$new_id" ]]; then
    TOTAL_CREATED=$((TOTAL_CREATED + 1))
    log_info "  AUTO-CREATED account '${username}' on ${tgt} (id=${new_id}, gm=${src_gm})"
    return 0
  else
    log_error "Failed to create account '${username}' on ${tgt}"
    return 1
  fi
}

# ============================================================
# Hash Functions (for daily sync)
# ============================================================

ensure_sync_table() {
  local ctr="$1" db="$2"
  db_exec "$ctr" -e "
    CREATE TABLE IF NOT EXISTS ${db}.character_sync_hash (
      char_name VARCHAR(12) NOT NULL,
      sync_hash VARCHAR(32) NOT NULL DEFAULT '',
      source_hash VARCHAR(32) NOT NULL DEFAULT '',
      synced_from VARCHAR(10) NOT NULL DEFAULT '',
      synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (char_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3"

  local has_source_hash
  has_source_hash=$(db_exec "$ctr" -N -e "
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA='${db}'
      AND TABLE_NAME='character_sync_hash'
      AND COLUMN_NAME='source_hash'" 2>/dev/null || echo "0")
  if [[ "$has_source_hash" == "0" ]]; then
    db_exec "$ctr" -e "
      ALTER TABLE ${db}.character_sync_hash
      ADD COLUMN source_hash VARCHAR(32) NOT NULL DEFAULT '' AFTER sync_hash"
  fi
}

compute_char_hash() {
  local ctr="$1" db="$2" name="$3"
  db_exec "$ctr" -N -e "
    SELECT MD5(CONCAT_WS('|',
      c.level, c.xp, c.money, c.totaltime,
      (SELECT COUNT(*) FROM ${db}.item_instance WHERE owner_guid = c.guid),
      (SELECT COUNT(*) FROM ${db}.character_spell WHERE guid = c.guid),
      (SELECT COUNT(*) FROM ${db}.character_queststatus WHERE guid = c.guid)
    )) FROM ${db}.characters c WHERE c.name = '${name}' LIMIT 1"
}

get_stored_hash() {
  local ctr="$1" db="$2" name="$3"
  db_exec "$ctr" -N -e \
    "SELECT sync_hash FROM ${db}.character_sync_hash WHERE char_name='${name}' LIMIT 1" || echo ""
}

get_stored_source_hash() {
  local ctr="$1" db="$2" name="$3"
  db_exec "$ctr" -N -e \
    "SELECT source_hash FROM ${db}.character_sync_hash WHERE char_name='${name}' LIMIT 1" || echo ""
}

store_hash() {
  local ctr="$1" db="$2" name="$3" hash="$4" source_hash="$5" from_exp="$6"
  db_exec "$ctr" -e "
    REPLACE INTO ${db}.character_sync_hash (char_name, sync_hash, source_hash, synced_from, synced_at)
    VALUES ('${name}', '${hash}', '${source_hash}', '${from_exp}', NOW())"
}

if [[ "$_LIB_SH_RESTORE_NOUNSET" == true ]]; then
  set -u
fi
unset _LIB_SH_RESTORE_NOUNSET
