#!/bin/bash
# ============================================================
# CMaNGOS Daily Character Sync — Multi-Account Edition
# Classic → TBC → WotLK → AzerothCore (4-step, default)
# Classic → TBC → AzerothCore           (3-step, SKIP_WOTLK=true)
# with hash-based conflict detection
# ============================================================
# Runs via systemd timer at 04:00 daily.
#
# Config: /opt/cmangos-transfer/sync-accounts.conf
#   Format: USERNAME:PASSWORD (one per line)
#   Lines starting with # are comments.
#
# Environment:
#   SKIP_WOTLK=true  — skip cmangos-wotlk, transfer TBC→AzerothCore directly
#
# For each account in the config:
#   1. Ensure account exists on TBC/target (auto-create from Classic if missing)
#   2. For each character on that account (on Classic):
#      a. Hash current TBC character state
#      b. Skip if target was played or source is unchanged; sync only changed characters
#   3. Same for TBC → WotLK (unless SKIP_WOTLK=true)
#   4. If AzerothCore runtime is available:
#      - 4-step: WotLK → AzerothCore
#      - 3-step: TBC → AzerothCore
#   5. Login bot verification after each transfer phase
# ============================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"
DAILY_SYNC_SOURCED=false
if [[ "${BASH_SOURCE[0]}" != "$0" ]]; then
  DAILY_SYNC_SOURCED=true
fi

CONF_FILE="${SYNC_CONF:-${SCRIPT_DIR}/sync-accounts.conf}"
LOG_DIR="${SCRIPT_DIR}/logs"
LOG_FILE="${LOG_DIR}/daily-sync-$(date +%Y%m%d).log"
SERVERS_STOPPED=false

# Counters for summary
TOTAL_SYNCED=0
TOTAL_SKIPPED=0
TOTAL_CREATED=0
TOTAL_ERRORS=0

if ! $DAILY_SYNC_SOURCED; then
  mkdir -p "$LOG_DIR"
fi

# ---- Compatibility aliases for lib.sh maps ----
# daily-sync uses CTR[exp-db], CTR[exp-srv] style keys
declare -A CTR=(
  ["classic-db"]="${LIB_DB_CONTAINER["classic"]}"
  ["tbc-db"]="${LIB_DB_CONTAINER["tbc"]}"
  ["wotlk-db"]="${LIB_DB_CONTAINER["wotlk"]}"
  ["azerothcore-db"]="${LIB_DB_CONTAINER["azerothcore"]}"
  ["classic-srv"]="${LIB_SERVER_CONTAINER["classic"]}"
  ["tbc-srv"]="${LIB_SERVER_CONTAINER["tbc"]}"
  ["wotlk-srv"]="${LIB_SERVER_CONTAINER["wotlk"]}"
  ["azerothcore-srv"]="${LIB_SERVER_CONTAINER["azerothcore"]}"
  ["azerothcore-auth"]="${LIB_AUTH_SERVER_CONTAINER["azerothcore"]}"
)
declare -n CHARDB=LIB_CHAR_DB
declare -n REALMDB=LIB_REALMD_DB
declare -n COMPOSE=LIB_COMPOSE_DIR

SKIP_TABLES="${LIB_SKIP_TABLES}"
AZEROTHCORE_ENABLED=false
SKIP_WOTLK="${SKIP_WOTLK:-false}"

# ---- Trap: ensure servers restart even on crash ----
cleanup() {
  local exit_code=$?
  if $SERVERS_STOPPED; then
    log_info "TRAP: Ensuring all game servers are started..."
    for exp in classic tbc wotlk; do
      if [[ "$SKIP_WOTLK" == "true" && "$exp" == "wotlk" ]]; then continue; fi
      cd "${COMPOSE[$exp]}" 2>/dev/null && docker compose up -d >/dev/null 2>&1 || true
    done
    if $AZEROTHCORE_ENABLED; then
      cd "${COMPOSE["azerothcore"]}" 2>/dev/null && \
        docker compose up -d azerothcore-authserver azerothcore-worldserver >/dev/null 2>&1 || true
    fi
    log_info "TRAP: All game servers restarted"
  fi
  if [[ $exit_code -ne 0 ]]; then
    log_error "Script exited with code ${exit_code}"
  fi
}
if ! $DAILY_SYNC_SOURCED; then
  trap cleanup EXIT
fi

# ---- Legacy logging aliases for daily-sync ----
log()     { log_info "$@"; }
log_err() { log_error "$@"; }

LAST_SYNC_RESULT=""
LAST_SYNC_REASON=""
LAST_TARGET_STATE=""

record_synced_char() {
  local tgt="$1" username="$2" char_name="$3" from_exp="$4"
  local tgt_ctr="${CTR[${tgt}-db]}"
  local tgt_db="${CHARDB[$tgt]}"
  local guid

  guid=$(db_exec "$tgt_ctr" -N -e "SELECT guid FROM ${tgt_db}.characters WHERE name='${char_name}' LIMIT 1")
  if [[ -z "$guid" ]]; then
    log_warn "    WARN: Synced '${char_name}' to ${tgt}, but target guid could not be resolved"
    return 1
  fi

  case "$tgt" in
    tbc)   TBC_SYNCED_CHARS+=("${username}:${guid}:${char_name}:${from_exp}") ;;
    wotlk) WOTLK_SYNCED_CHARS+=("${username}:${guid}:${char_name}:${from_exp}") ;;
    azerothcore) AZEROTHCORE_SYNCED_CHARS+=("${username}:${guid}:${char_name}:${from_exp}") ;;
  esac
}

store_verified_hash_after_login() {
  local tgt="$1" char_name="$2" from_exp="$3"
  local tgt_ctr="${CTR[${tgt}-db]}"
  local tgt_db="${CHARDB[$tgt]}"
  local src_ctr="${CTR[${from_exp}-db]}"
  local src_db="${CHARDB[$from_exp]}"
  local new_hash source_hash

  ensure_sync_table "$tgt_ctr" "$tgt_db"
  new_hash=$(compute_char_hash "$tgt_ctr" "$tgt_db" "$char_name")
  if [[ -z "$new_hash" ]]; then
    log_err "  Failed to compute post-verify hash for ${char_name} on ${tgt}"
    return 1
  fi

  source_hash=$(compute_char_hash "$src_ctr" "$src_db" "$char_name")
  if [[ -z "$source_hash" ]]; then
    log_err "  Failed to compute source hash for ${char_name} from ${from_exp}"
    return 1
  fi

  if ! store_hash "$tgt_ctr" "$tgt_db" "$char_name" "$new_hash" "$source_hash" "$from_exp"; then
    log_err "  Failed to store post-verify hash for ${char_name} on ${tgt}"
    return 1
  fi

  log "  Stored post-verify hash for ${char_name} on ${tgt} (source=${from_exp})"
}

log_verify_failure_details() {
  local output="$1"
  local line

  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    case "$line" in
      *"RESULT:"*|*"Exception:"*|*"Auth response:"*|*"LOGIN SUCCESS!"*|*"GUID="*"not found"*|*"Connection closed by remote"*|*"timed out"*)
        log_warn "    bot> ${line}"
        ;;
    esac
  done <<< "$output"
}

log_failed_character_db_state() {
  local exp="$1" username="$2" guid="$3"
  local ctr="${CTR[${exp}-db]}"
  local char_db="${CHARDB[$exp]}"
  local realm_db="${REALMDB[$exp]}"
  local account_id

  account_id=$(db_exec "$ctr" -N -e "SELECT id FROM ${realm_db}.account WHERE username='${username}' LIMIT 1" 2>/dev/null || true)
  [[ -n "$account_id" ]] && log_warn "    db> target account '${username}' id=${account_id} on ${exp}"

  local row
  row=$(db_exec "$ctr" -N -e "SELECT guid,account,name,race,class,gender,level FROM ${char_db}.characters WHERE guid=${guid} LIMIT 1" 2>/dev/null || true)
  if [[ -n "$row" ]]; then
    log_warn "    db> character row: ${row}"
  else
    log_warn "    db> no character row found for guid=${guid} on ${exp}"
  fi
}

verify_character_login_with_retry() {
  local exp="$1" username="$2" password="$3" guid="$4" char_name="$5"
  local attempt output rc

  for attempt in 1 2; do
    output="$(verify_character_login "$exp" "$username" "$password" "$guid")"
    rc=$?

    if [[ $rc -eq 0 ]]; then
      if [[ $attempt -gt 1 ]]; then
        log_warn "  Verify recovered on retry ${attempt} for ${char_name} (guid=${guid}) on ${exp}"
      fi
      return 0
    fi

    if [[ $attempt -lt 2 ]]; then
      log_warn "  Verify attempt ${attempt} failed for ${char_name} (guid=${guid}) on ${exp}; retrying in 5s"
      if [[ "$exp" == "azerothcore" ]]; then
        if ! docker inspect --format='{{.State.Running}}' "${CTR[${exp}-srv]}" 2>/dev/null | grep -q true || \
           ! docker inspect --format='{{.State.Running}}' "${CTR[${exp}-auth]}" 2>/dev/null | grep -q true; then
          restart_after_crash "$exp" || log_err "${exp} runtime failed to restart before retry"
        fi
      elif ! docker inspect --format='{{.State.Running}}' "${CTR[${exp}-srv]}" 2>/dev/null | grep -q true; then
        restart_after_crash "$exp" || log_err "${exp} server failed to restart before retry"
      fi
      sleep 5
      continue
    fi

    log_warn "  Final verify failure details for ${char_name} (guid=${guid}) on ${exp}:"
    log_failed_character_db_state "$exp" "$username" "$guid"
    log_verify_failure_details "$output"
    return 1
  done
}

migration_sql_for_pair() {
  local src="$1" tgt="$2"
  case "${src}:${tgt}" in
    classic:tbc)       echo "${SCRIPT_DIR}/migrate_classic_to_tbc.sql" ;;
    classic:wotlk)     echo "${SCRIPT_DIR}/migrate_classic_to_wotlk.sql" ;;
    tbc:wotlk)         echo "${SCRIPT_DIR}/migrate_tbc_to_wotlk.sql" ;;
    wotlk:azerothcore) echo "${SCRIPT_DIR}/migrate_cmangos_wotlk_to_azerothcore.sql" ;;
    tbc:azerothcore)   echo "${SCRIPT_DIR}/migrate_cmangos_tbc_to_azerothcore.sql" ;;
    *) return 1 ;;
  esac
}

# ---- Transfer one character ----
do_transfer_char() {
  local src="$1" tgt="$2" char_name="$3"
  local src_ctr="${CTR[${src}-db]}" tgt_ctr="${CTR[${tgt}-db]}"
  local src_db="${CHARDB[$src]}" tgt_db="${CHARDB[$tgt]}"
  local src_realm="${REALMDB[$src]}" tgt_realm="${REALMDB[$tgt]}"

  # Get source character info
  local char_info
  char_info=$(db_exec "$src_ctr" -N -e "
    SELECT c.guid, c.account, a.username
    FROM ${src_db}.characters c
    JOIN ${src_realm}.account a ON a.id = c.account
    WHERE c.name = '${char_name}' LIMIT 1")
  [[ -z "$char_info" ]] && { log_err "Character '${char_name}' not found on ${src}"; return 1; }

  local src_guid src_account_id src_username
  IFS=$'\t' read -r src_guid src_account_id src_username <<< "$char_info"

  # Verify target account exists
  local tgt_account_id
  tgt_account_id=$(db_exec "$tgt_ctr" -N -e "SELECT id FROM ${tgt_realm}.account WHERE username='${src_username}'")
  [[ -z "$tgt_account_id" ]] && { log_err "Account '${src_username}' not found on ${tgt}"; return 1; }

  # Dump source DB
  local temp_db="sync_temp_$$"
  local exclude_args=""
  for tbl in $SKIP_TABLES; do exclude_args+=" --ignore-table=${src_db}.${tbl}"; done

  local dump_file="/tmp/sync_dump_$$.sql"
  # shellcheck disable=SC2086
  db_dump "$src_ctr" "$src_db" --skip-lock-tables --add-drop-table $exclude_args > "$dump_file"

  if [[ "$tgt" == "azerothcore" ]]; then
    perl -0pi -e "s/utf8mb3_uca1400_ai_ci/utf8mb3_general_ci/g; s/utf8mb4_uca1400_ai_ci/utf8mb4_unicode_ci/g" "$dump_file"
  fi

  # Import into temp DB on target
  db_exec "$tgt_ctr" -e "DROP DATABASE IF EXISTS ${temp_db}"
  db_exec "$tgt_ctr" -e "CREATE DATABASE ${temp_db} CHARACTER SET utf8mb3"
  docker cp "$dump_file" "${tgt_ctr}:/tmp/sync_dump.sql"
  db_exec "$tgt_ctr" "$temp_db" -e "SOURCE /tmp/sync_dump.sql"
  docker exec "$tgt_ctr" rm -f /tmp/sync_dump.sql >/dev/null 2>&1 || true
  rm -f "$dump_file"

  local migration_sql=""
  migration_sql=$(migration_sql_for_pair "$src" "$tgt" 2>/dev/null || true)
  if [[ -n "$migration_sql" ]]; then
    if [[ ! -f "$migration_sql" ]]; then
      log_err "Migration SQL not found for ${src}→${tgt}: ${migration_sql}"
      db_exec "$tgt_ctr" -e "DROP DATABASE IF EXISTS ${temp_db}"
      return 1
    fi
    docker cp "$migration_sql" "${tgt_ctr}:/tmp/sync_migrate.sql"
    if ! db_exec "$tgt_ctr" "$temp_db" -e "SOURCE /tmp/sync_migrate.sql"; then
      log_err "Failed to run migration SQL for ${src}→${tgt}"
      docker exec "$tgt_ctr" rm -f /tmp/sync_migrate.sql >/dev/null 2>&1 || true
      db_exec "$tgt_ctr" -e "DROP DATABASE IF EXISTS ${temp_db}"
      return 1
    fi
    docker exec "$tgt_ctr" rm -f /tmp/sync_migrate.sql >/dev/null 2>&1 || true
  fi

  # Delete existing target character data
  local existing_guid
  existing_guid=$(db_exec "$tgt_ctr" -N -e "SELECT guid FROM ${tgt_db}.characters WHERE name='${char_name}' LIMIT 1")
  if [[ -n "$existing_guid" ]]; then
    for tbl in characters character_account_data character_action character_aura \
      character_battleground_data character_gifts character_homebind character_instance \
      character_inventory character_queststatus character_queststatus_daily \
      character_queststatus_monthly character_queststatus_rewarded character_queststatus_weekly \
      character_reputation character_skills character_social character_spell \
      character_spell_cooldown character_stats character_declinedname \
      character_achievement character_achievement_progress character_battleground_random \
      character_equipmentsets character_glyphs character_talent; do
      table_exists "$tgt_ctr" "$tgt_db" "$tbl" || continue
      db_exec "$tgt_ctr" -e "DELETE FROM ${tgt_db}.\`${tbl}\` WHERE guid=${existing_guid}" || true
    done
    # Pets
    local pet_ids
    pet_ids=$(db_exec "$tgt_ctr" -N -e "SELECT id FROM ${tgt_db}.character_pet WHERE owner=${existing_guid}" 2>/dev/null | tr '\n' ',' | sed 's/,$//')
    if [[ -n "$pet_ids" ]]; then
      for tbl in pet_aura pet_spell pet_spell_cooldown; do
        table_exists "$tgt_ctr" "$tgt_db" "$tbl" || continue
        db_exec "$tgt_ctr" -e "DELETE FROM ${tgt_db}.\`${tbl}\` WHERE guid IN (${pet_ids})" || true
      done
    fi
    db_exec "$tgt_ctr" -e "DELETE FROM ${tgt_db}.character_pet WHERE owner=${existing_guid}" 2>/dev/null || true
    db_exec "$tgt_ctr" -e "DELETE FROM ${tgt_db}.item_instance WHERE owner_guid=${existing_guid}" 2>/dev/null || true
    local mail_ids
    mail_ids=$(db_exec "$tgt_ctr" -N -e "SELECT id FROM ${tgt_db}.mail WHERE receiver=${existing_guid}" 2>/dev/null | tr '\n' ',' | sed 's/,$//')
    [[ -n "$mail_ids" ]] && db_exec "$tgt_ctr" -e "DELETE FROM ${tgt_db}.mail_items WHERE mail_id IN (${mail_ids})" 2>/dev/null || true
    db_exec "$tgt_ctr" -e "DELETE FROM ${tgt_db}.mail WHERE receiver=${existing_guid}" 2>/dev/null || true
    db_exec "$tgt_ctr" -e "DELETE FROM ${tgt_db}.corpse WHERE player=${existing_guid}" 2>/dev/null || true
    db_exec "$tgt_ctr" -e "DELETE FROM ${tgt_db}.petition WHERE ownerguid=${existing_guid}" 2>/dev/null || true
  fi

  # Copy character from temp to target
  safe_insert "$tgt_ctr" "$temp_db" "$tgt_db" "characters" "guid=${src_guid}" || {
    db_exec "$tgt_ctr" -e "DROP DATABASE IF EXISTS ${temp_db}"; return 1; }
  db_exec "$tgt_ctr" -e "UPDATE ${tgt_db}.characters SET account=${tgt_account_id}, online=0 WHERE guid=${src_guid}"

  local _si_failed=""
  for tbl in character_account_data character_action character_aura character_battleground_data \
    character_declinedname character_gifts character_homebind character_instance \
    character_inventory character_queststatus character_queststatus_daily \
    character_queststatus_monthly character_queststatus_rewarded character_queststatus_weekly \
    character_reputation character_skills character_social character_spell \
    character_spell_cooldown character_stats character_talent \
    character_achievement character_achievement_progress character_battleground_random \
    character_equipmentsets character_glyphs; do
    table_exists "$tgt_ctr" "$temp_db" "$tbl" || continue
    table_exists "$tgt_ctr" "$tgt_db" "$tbl" || continue
    if ! safe_insert "$tgt_ctr" "$temp_db" "$tgt_db" "$tbl" "guid=${src_guid}" 2>/dev/null; then
      log "    WARN: safe_insert failed for ${tbl} (guid=${src_guid})"
      _si_failed+="${tbl} "
    fi
  done
  [[ -n "$_si_failed" ]] && log "    WARN: Failed secondary tables: ${_si_failed}"

  # Tutorial rows are account-scoped
  if [[ "$tgt" == "azerothcore" ]] && table_exists "$tgt_ctr" "$temp_db" "account_tutorial" && table_exists "$tgt_ctr" "$tgt_db" "account_tutorial"; then
    db_exec "$tgt_ctr" -e "DELETE FROM ${tgt_db}.account_tutorial WHERE accountId=${tgt_account_id}" 2>/dev/null || true
    db_exec "$tgt_ctr" -e "UPDATE ${temp_db}.account_tutorial SET accountId=${tgt_account_id} WHERE accountId=${src_account_id}" 2>/dev/null || true
    safe_insert "$tgt_ctr" "$temp_db" "$tgt_db" "account_tutorial" "accountId=${tgt_account_id}" 2>/dev/null || true
  elif table_exists "$tgt_ctr" "$temp_db" "character_tutorial" && table_exists "$tgt_ctr" "$tgt_db" "character_tutorial"; then
    safe_insert "$tgt_ctr" "$temp_db" "$tgt_db" "character_tutorial" "account=${src_account_id}" 2>/dev/null || true
    db_exec "$tgt_ctr" -e "UPDATE ${tgt_db}.character_tutorial SET account=${tgt_account_id} WHERE account=${src_account_id}" || true
  fi

  # Pets
  if table_exists "$tgt_ctr" "$temp_db" "character_pet" && table_exists "$tgt_ctr" "$tgt_db" "character_pet"; then
    safe_insert "$tgt_ctr" "$temp_db" "$tgt_db" "character_pet" "owner=${src_guid}" 2>/dev/null || true
    local new_pet_ids
    new_pet_ids=$(db_exec "$tgt_ctr" -N -e "SELECT id FROM ${temp_db}.character_pet WHERE owner=${src_guid}" | tr '\n' ',' | sed 's/,$//')
    if [[ -n "$new_pet_ids" ]]; then
      for tbl in pet_aura pet_spell pet_spell_cooldown; do
        table_exists "$tgt_ctr" "$temp_db" "$tbl" || continue
        table_exists "$tgt_ctr" "$tgt_db" "$tbl" || continue
        safe_insert "$tgt_ctr" "$temp_db" "$tgt_db" "$tbl" "guid IN (${new_pet_ids})" 2>/dev/null || true
      done
    fi
  fi

  # Items
  table_exists "$tgt_ctr" "$temp_db" "item_instance" && table_exists "$tgt_ctr" "$tgt_db" "item_instance" && \
    safe_insert "$tgt_ctr" "$temp_db" "$tgt_db" "item_instance" "owner_guid=${src_guid}" 2>/dev/null || true

  # Mail
  if table_exists "$tgt_ctr" "$temp_db" "mail" && table_exists "$tgt_ctr" "$tgt_db" "mail"; then
    safe_insert "$tgt_ctr" "$temp_db" "$tgt_db" "mail" "receiver=${src_guid}" 2>/dev/null || true
    local new_mail_ids
    new_mail_ids=$(db_exec "$tgt_ctr" -N -e "SELECT id FROM ${temp_db}.mail WHERE receiver=${src_guid}" | tr '\n' ',' | sed 's/,$//')
    if [[ -n "$new_mail_ids" ]] && table_exists "$tgt_ctr" "$temp_db" "mail_items" && table_exists "$tgt_ctr" "$tgt_db" "mail_items"; then
      safe_insert "$tgt_ctr" "$temp_db" "$tgt_db" "mail_items" "mail_id IN (${new_mail_ids})" 2>/dev/null || true
    fi
  fi

  # Corpse
  table_exists "$tgt_ctr" "$temp_db" "corpse" && table_exists "$tgt_ctr" "$tgt_db" "corpse" && \
    safe_insert "$tgt_ctr" "$temp_db" "$tgt_db" "corpse" "player=${src_guid}" 2>/dev/null || true

  # ---- Post-transfer normalization ----
  # Fix text-blob field sizes that differ between expansions
  TEMP_DB="$temp_db" fix_char_after_transfer "$tgt" "$src_guid"

  # Cleanup temp DB
  db_exec "$tgt_ctr" -e "DROP DATABASE IF EXISTS ${temp_db}"
  return 0
}

# ---- Inspect one character sync decision without mutating target ----
inspect_sync_decision() {
  local src="$1" tgt="$2" char_name="$3"
  local src_ctr="${CTR[${src}-db]}"
  local src_db="${CHARDB[$src]}"
  local tgt_ctr="${CTR[${tgt}-db]}"
  local tgt_db="${CHARDB[$tgt]}"
  LAST_SYNC_RESULT="none"
  LAST_SYNC_REASON=""
  LAST_TARGET_STATE="unknown"

  ensure_sync_table "$tgt_ctr" "$tgt_db"

  local tgt_exists
  tgt_exists=$(db_exec "$tgt_ctr" -N -e "SELECT COUNT(*) FROM ${tgt_db}.characters WHERE name='${char_name}'")

  if [[ "$tgt_exists" != "0" ]]; then
    local current_hash stored_hash current_source_hash stored_source_hash
    current_hash=$(compute_char_hash "$tgt_ctr" "$tgt_db" "$char_name")
    stored_hash=$(get_stored_hash "$tgt_ctr" "$tgt_db" "$char_name")

    if [[ -n "$stored_hash" && -n "$current_hash" && "$current_hash" != "$stored_hash" ]]; then
      LAST_SYNC_RESULT="skipped"
      LAST_SYNC_REASON="target_played"
      LAST_TARGET_STATE="played_conflict"
      return 1
    fi

    current_source_hash=$(compute_char_hash "$src_ctr" "$src_db" "$char_name")
    stored_source_hash=$(get_stored_source_hash "$tgt_ctr" "$tgt_db" "$char_name")

    if [[ -n "$stored_hash" && -n "$current_hash" && -n "$stored_source_hash" && -n "$current_source_hash" && "$current_hash" == "$stored_hash" && "$current_source_hash" == "$stored_source_hash" ]]; then
      LAST_SYNC_RESULT="skipped"
      LAST_SYNC_REASON="source_unchanged"
      LAST_TARGET_STATE="unchanged"
      return 1
    fi

    if [[ -n "$stored_hash" && -n "$stored_source_hash" ]]; then
      LAST_SYNC_REASON="source_changed"
      LAST_TARGET_STATE="safe_overwrite"
    elif [[ -n "$stored_hash" ]]; then
      LAST_SYNC_REASON="baseline_refresh"
      LAST_TARGET_STATE="safe_overwrite"
    else
      LAST_SYNC_REASON="first_sync_existing_target"
      LAST_TARGET_STATE="existing_untracked"
    fi
  else
    LAST_SYNC_REASON="first_sync_absent_target"
    LAST_TARGET_STATE="absent"
  fi

  LAST_SYNC_RESULT="pending"
  return 0
}

# ---- Sync one character with hash check ----
sync_char() {
  local src="$1" tgt="$2" char_name="$3"

  if ! inspect_sync_decision "$src" "$tgt" "$char_name"; then
    case "$LAST_SYNC_REASON" in
      target_played)
        log "    SKIP: '${char_name}' was PLAYED on ${tgt}"
        ;;
      source_unchanged)
        log "    SKIP: '${char_name}' unchanged since last verified sync"
        ;;
    esac
    ((TOTAL_SKIPPED++))
    return 1
  fi

  case "$LAST_SYNC_REASON" in
    source_changed)
      log "    Source changed since last verified sync — safe to overwrite"
      ;;
    baseline_refresh)
      log "    No stored source hash — refreshing baseline"
      ;;
    first_sync_existing_target)
      log "    No stored hash — first sync"
      ;;
    first_sync_absent_target)
      log "    Character not yet on ${tgt} — first sync"
      ;;
  esac

  # Do the transfer
  if do_transfer_char "$src" "$tgt" "$char_name"; then
    LAST_SYNC_RESULT="synced"
    log "    SYNCED: ${char_name} ${src}→${tgt}"
    ((TOTAL_SYNCED++))
    return 0
  else
    LAST_SYNC_RESULT="error"
    log_err "    FAILED: ${char_name} ${src}→${tgt}"
    ((TOTAL_ERRORS++))
    return 1
  fi
}

# ---- Sync one account (all characters) in one direction ----
sync_account_step() {
  local src="$1" tgt="$2" username="$3"
  local src_ctr="${CTR[${src}-db]}"
  local src_db="${CHARDB[$src]}" src_realm="${REALMDB[$src]}"

  log "  [${src}→${tgt}] account: ${username}"

  # Ensure account exists on target (auto-create if missing)
  ensure_account "$src" "$tgt" "$username" || return 1

  # Get account ID on source
  local src_account_id
  src_account_id=$(db_exec "$src_ctr" -N -e "SELECT id FROM ${src_realm}.account WHERE username='${username}'")
  [[ -z "$src_account_id" ]] && { log "    No account on ${src} — skipping"; return 0; }

  # Get all characters for this account on source
  local characters
  characters=$(db_exec "$src_ctr" -N -e "SELECT name FROM ${src_db}.characters WHERE account=${src_account_id} ORDER BY guid")
  if [[ -z "$characters" ]]; then
    log "    No characters on ${src} — skipping"
    return 0
  fi

  local char_count=0
  while IFS= read -r char_name; do
    [[ -z "$char_name" ]] && continue
    sync_char "$src" "$tgt" "$char_name" || true
    if [[ "$LAST_SYNC_RESULT" == "synced" ]]; then
      record_synced_char "$tgt" "$username" "$char_name" "$src" || true
    fi
    ((char_count++))
  done <<< "$characters"

  log "  [${src}→${tgt}] Processed ${char_count} character(s) for ${username}"
}

# ---- Read config ----
# Parses sync-accounts.conf (USERNAME:PASSWORD format)
# Populates global arrays: ACCOUNT_NAMES=() and ACCOUNT_PASS[username]=password
declare -A ACCOUNT_PASS
read_accounts() {
  if [[ ! -f "$CONF_FILE" ]]; then
    log_err "Config file not found: ${CONF_FILE}"
    exit 1
  fi

  ACCOUNT_NAMES=()
  while IFS= read -r line; do
    # Skip comments and empty lines
    line="${line%%#*}"
    line="${line// /}"
    [[ -z "$line" ]] && continue
    # Parse USERNAME:PASSWORD
    local user pass
    user="${line%%:*}"
    pass="${line#*:}"
    # CMaNGOS stores usernames in UPPERCASE
    user="$(echo "$user" | tr '[:lower:]' '[:upper:]')"
    pass="$(echo "$pass" | tr '[:lower:]' '[:upper:]')"
    ACCOUNT_NAMES+=("$user")
    ACCOUNT_PASS["$user"]="$pass"
  done < "$CONF_FILE"

  if [[ ${#ACCOUNT_NAMES[@]} -eq 0 ]]; then
    log_err "No accounts in config: ${CONF_FILE}"
    exit 1
  fi
}

# ---- Rollback one character on failure ----
# Removes a character and all related data from target expansion.
# Args: $1=expansion, $2=guid
rollback_character() {
  local exp="$1" guid="$2"
  local ctr="${CTR[${exp}-db]}"
  local db="${CHARDB[$exp]}"

  local char_name
  char_name=$(db_exec "$ctr" -N -e "SELECT name FROM ${db}.characters WHERE guid=${guid}" 2>/dev/null)
  log_warn "  ROLLBACK: ${char_name:-guid=$guid} (guid=${guid}) on ${exp}"

  for tbl in character_account_data character_action character_aura \
    character_battleground_data character_gifts character_homebind character_instance \
    character_inventory character_queststatus character_queststatus_daily \
    character_queststatus_monthly character_queststatus_rewarded character_queststatus_weekly \
    character_reputation character_skills character_social character_spell \
    character_spell_cooldown character_stats character_declinedname \
    character_achievement character_achievement_progress character_battleground_random \
    character_equipmentsets character_glyphs character_talent; do
    table_exists "$ctr" "$db" "$tbl" && db_exec "$ctr" -e "DELETE FROM ${db}.\`${tbl}\` WHERE guid=${guid}" 2>/dev/null || true
  done

  # Pets
  local pet_ids
  pet_ids=$(db_exec "$ctr" -N -e "SELECT id FROM ${db}.character_pet WHERE owner=${guid}" 2>/dev/null | tr '\n' ',' | sed 's/,$//')
  if [[ -n "$pet_ids" ]]; then
    for tbl in pet_aura pet_spell pet_spell_cooldown; do
      table_exists "$ctr" "$db" "$tbl" && db_exec "$ctr" -e "DELETE FROM ${db}.\`${tbl}\` WHERE guid IN (${pet_ids})" 2>/dev/null || true
    done
  fi
  db_exec "$ctr" -e "DELETE FROM ${db}.character_pet WHERE owner=${guid}" 2>/dev/null || true
  db_exec "$ctr" -e "DELETE FROM ${db}.item_instance WHERE owner_guid=${guid}" 2>/dev/null || true
  db_exec "$ctr" -e "DELETE FROM ${db}.mail WHERE receiver=${guid}" 2>/dev/null || true
  db_exec "$ctr" -e "DELETE FROM ${db}.corpse WHERE player=${guid}" 2>/dev/null || true
  db_exec "$ctr" -e "DELETE FROM ${db}.characters WHERE guid=${guid}" 2>/dev/null || true
  log_warn "  ROLLBACK complete: guid=${guid}"
}

# ============================================================
# MAIN — Sequential Pipeline
# ============================================================
# Flow (4-step, default):
#   1. Stop ALL game servers
#   2. Phase A: Classic → TBC transfers (all accounts)
#   3. Start TBC server, wait "World initialized"
#   4. Phase B: Verify all TBC characters (login bot normalizes data)
#   5. Stop TBC server
#   6. Phase C: TBC → WotLK transfers (uses POST-LOGIN normalized TBC data!)
#   7. Start WotLK server, wait "World initialized"
#   8. Phase D: Verify all WotLK characters
#   9. If AzerothCore runtime exists: stop WotLK server
#  10. If AzerothCore runtime exists: Phase E = WotLK → AzerothCore
#  11. If AzerothCore runtime exists: start AzerothCore auth/world
#  12. If AzerothCore runtime exists: Phase F = AzerothCore verification
#  13. Start ALL servers
#  14. Summary
#
# Flow (3-step, SKIP_WOTLK=true):
#   1. Stop Classic+TBC+AzerothCore servers (skip WotLK)
#   2. Phase A: Classic → TBC
#   3-4. Phase B: TBC verification
#   5. Stop TBC
#   Phase C/D: SKIPPED
#   10. Phase E: TBC → AzerothCore (direct)
#   11-12. Phase F: AzerothCore verification
#   13. Start all servers (skip WotLK)
#   14. Summary
# ============================================================

daily_sync_main() {
  trap cleanup EXIT

  START_TIME=$(date +%s)

  log "=========================================="
  log "Daily sync started — Sequential Pipeline"
  log "Config: ${CONF_FILE}"
  if [[ "$SKIP_WOTLK" == "true" ]]; then
    log "Mode: 3-step (Classic → TBC → AzerothCore, SKIP_WOTLK=true)"
  else
    log "Mode: 4-step (Classic → TBC → WotLK → AzerothCore)"
  fi
  log "=========================================="

  # Read account list
  read_accounts
  log "Accounts to sync: ${ACCOUNT_NAMES[*]} (${#ACCOUNT_NAMES[@]} total)"

  if docker inspect "${CTR["azerothcore-db"]}" "${CTR["azerothcore-srv"]}" "${CTR["azerothcore-auth"]}" >/dev/null 2>&1; then
    AZEROTHCORE_ENABLED=true
    log "AzerothCore runtime detected — Phase E/F enabled"
  else
    log "AzerothCore runtime not detected — Phase E/F skipped"
  fi

  # Cleanup stale temp databases from previous failed runs
  for exp in classic tbc wotlk; do
    if [[ "$SKIP_WOTLK" == "true" && "$exp" == "wotlk" ]]; then continue; fi
    local_ctr="${CTR[${exp}-db]}"
    stale_dbs=$(db_exec "$local_ctr" -N -e "SHOW DATABASES LIKE 'sync_temp_%'" 2>/dev/null || true)
    for stale in $stale_dbs; do
      log "Cleaning stale temp DB: ${stale} on ${exp}"
      db_exec "$local_ctr" -e "DROP DATABASE IF EXISTS ${stale}" || true
    done
  done
  if $AZEROTHCORE_ENABLED; then
    local_ctr="${CTR["azerothcore-db"]}"
    stale_dbs=$(db_exec "$local_ctr" -N -e "SHOW DATABASES LIKE 'sync_temp_%'" 2>/dev/null || true)
    for stale in $stale_dbs; do
      log "Cleaning stale temp DB: ${stale} on azerothcore"
      db_exec "$local_ctr" -e "DROP DATABASE IF EXISTS ${stale}" || true
    done
  fi

  # Verify all DB containers are running
  for exp in classic tbc wotlk; do
    if [[ "$SKIP_WOTLK" == "true" && "$exp" == "wotlk" ]]; then continue; fi
    local_ctr="${CTR[${exp}-db]}"
    docker inspect --format='{{.State.Running}}' "$local_ctr" 2>/dev/null | grep -q true || {
      log_err "DB container ${local_ctr} not running!"; exit 1; }
  done
  if $AZEROTHCORE_ENABLED; then
    local_ctr="${CTR["azerothcore-db"]}"
    docker inspect --format='{{.State.Running}}' "$local_ctr" 2>/dev/null | grep -q true || {
      log_err "DB container ${local_ctr} not running!"; exit 1; }
  fi

  # ---- Step 1: Stop ALL game servers ----
  log ""
  log "Step 1: Stopping all game servers..."
  for exp in wotlk tbc classic; do
    if [[ "$SKIP_WOTLK" == "true" && "$exp" == "wotlk" ]]; then
      log_info "Skipping wotlk server stop (SKIP_WOTLK=true)"
      continue
    fi
    stop_server_if_running "${CTR[${exp}-srv]}" "$exp"
  done
  if $AZEROTHCORE_ENABLED; then
    stop_server_if_running "${CTR["azerothcore-auth"]}" "azerothcore-auth"
    stop_server_if_running "${CTR["azerothcore-srv"]}" "azerothcore"
  fi
  SERVERS_STOPPED=true
  sleep 2

  # Track verified/failed characters per phase
  declare -A PHASE_SYNCED PHASE_SKIPPED PHASE_VERIFIED PHASE_ROLLED_BACK

  # ---- Step 2 — Phase A: Classic → TBC transfers ----
  log ""
  log "========== Phase A: Classic → TBC =========="
  PHASE_SYNCED[tbc]=0; PHASE_SKIPPED[tbc]=0; PHASE_VERIFIED[tbc]=0; PHASE_ROLLED_BACK[tbc]=0
  TBC_SYNCED_CHARS=()  # track exact synced chars as username:guid:name:from_exp

  local_synced_before_tbc=$TOTAL_SYNCED
  local_skipped_before_tbc=$TOTAL_SKIPPED
  for username in "${ACCOUNT_NAMES[@]}"; do
    log ""
    log "=== Account: ${username} ==="
    sync_account_step classic tbc "$username" || true
  done
  PHASE_SYNCED[tbc]=$(( TOTAL_SYNCED - local_synced_before_tbc ))
  PHASE_SKIPPED[tbc]=$(( TOTAL_SKIPPED - local_skipped_before_tbc ))

  # ---- Step 3: Start TBC server, wait for ready ----
  log ""
  log "Step 3: Starting TBC server for verification..."
  start_server tbc
  wait_for_server_ready "${CTR["tbc-srv"]}" 180 || { log_err "TBC server did not start!"; }

  # ---- Step 4 — Phase B: Verify all TBC characters ----
  log ""
  log "========== Phase B: TBC Verification =========="

  for entry in "${TBC_SYNCED_CHARS[@]+${TBC_SYNCED_CHARS[@]}}"; do
    [[ -z "$entry" ]] && continue
    IFS=':' read -r local_user local_guid local_name local_from_exp <<< "$entry"
    local_pass="${ACCOUNT_PASS[$local_user]}"

    log "  Verifying ${local_name} (guid=${local_guid}) on TBC..."
    if verify_character_login_with_retry tbc "$local_user" "$local_pass" "$local_guid" "$local_name"; then
      log "  ✅ ${local_name} (guid=${local_guid}) — SUCCESS"
      PHASE_VERIFIED["tbc"]=$(( ${PHASE_VERIFIED["tbc"]} + 1 ))
      if ! store_verified_hash_after_login tbc "$local_name" "$local_from_exp"; then
        ((TOTAL_ERRORS++))
      fi
    else
      log_err "  ❌ ${local_name} (guid=${local_guid}) — FAIL"
      rollback_character tbc "$local_guid"
      PHASE_ROLLED_BACK["tbc"]=$(( ${PHASE_ROLLED_BACK["tbc"]} + 1 ))
      if ! docker inspect --format='{{.State.Running}}' "${CTR["tbc-srv"]}" 2>/dev/null | grep -q true; then
        restart_after_crash tbc || log_err "TBC server failed to restart after crash"
      fi
    fi
  done

  for username in "${ACCOUNT_NAMES[@]}"; do
    local_pass="${ACCOUNT_PASS[$username]}"
    _already_done=false
    for entry in "${TBC_SYNCED_CHARS[@]+${TBC_SYNCED_CHARS[@]}}"; do
      [[ -n "$entry" && "${entry%%:*}" == "$username" ]] && { _already_done=true; break; }
    done
    $_already_done && continue

    verify_all_characters tbc "$username" "$local_pass" >/dev/null 2>&1 || true
  done

  # ---- Step 5: Stop TBC server ----
  log ""
  log "Step 5: Stopping TBC server..."
  stop_server_if_running "${CTR["tbc-srv"]}" "tbc"
  sleep 2

  if [[ "$SKIP_WOTLK" != "true" ]]; then
    # ---- Step 6 — Phase C: TBC → WotLK transfers ----
    log ""
    log "========== Phase C: TBC → WotLK =========="
    PHASE_SYNCED[wotlk]=0; PHASE_SKIPPED[wotlk]=0; PHASE_VERIFIED[wotlk]=0; PHASE_ROLLED_BACK[wotlk]=0
    WOTLK_SYNCED_CHARS=()

    local_synced_before_wotlk=$TOTAL_SYNCED
    local_skipped_before_wotlk=$TOTAL_SKIPPED
    for username in "${ACCOUNT_NAMES[@]}"; do
      log ""
      log "=== Account: ${username} ==="
      sync_account_step tbc wotlk "$username" || true
    done
    PHASE_SYNCED[wotlk]=$(( TOTAL_SYNCED - local_synced_before_wotlk ))
    PHASE_SKIPPED[wotlk]=$(( TOTAL_SKIPPED - local_skipped_before_wotlk ))

    # ---- Step 7: Start WotLK server, wait for ready ----
    log ""
    log "Step 7: Starting WotLK server for verification..."
    start_server wotlk
    wait_for_server_ready "${CTR["wotlk-srv"]}" 180 || { log_err "WotLK server did not start!"; }

    # ---- Step 8 — Phase D: Verify all WotLK characters ----
    log ""
    log "========== Phase D: WotLK Verification =========="

    for entry in "${WOTLK_SYNCED_CHARS[@]+${WOTLK_SYNCED_CHARS[@]}}"; do
      [[ -z "$entry" ]] && continue
      IFS=':' read -r local_user local_guid local_name local_from_exp <<< "$entry"
      local_pass="${ACCOUNT_PASS[$local_user]}"

      log "  Verifying ${local_name} (guid=${local_guid}) on WotLK..."
      if verify_character_login_with_retry wotlk "$local_user" "$local_pass" "$local_guid" "$local_name"; then
        log "  ✅ ${local_name} (guid=${local_guid}) — SUCCESS"
        PHASE_VERIFIED["wotlk"]=$(( ${PHASE_VERIFIED["wotlk"]} + 1 ))
        if ! store_verified_hash_after_login wotlk "$local_name" "$local_from_exp"; then
          ((TOTAL_ERRORS++))
        fi
      else
        log_err "  ❌ ${local_name} (guid=${local_guid}) — FAIL"
        rollback_character wotlk "$local_guid"
        PHASE_ROLLED_BACK["wotlk"]=$(( ${PHASE_ROLLED_BACK["wotlk"]} + 1 ))
        if ! docker inspect --format='{{.State.Running}}' "${CTR["wotlk-srv"]}" 2>/dev/null | grep -q true; then
          restart_after_crash wotlk || log_err "WotLK server failed to restart after crash"
        fi
      fi
    done
  else
    log ""
    log "========== Phase C/D: SKIPPED (SKIP_WOTLK=true) =========="
  fi

  # Determine AzerothCore source expansion
  local azerothcore_src="wotlk"
  if [[ "$SKIP_WOTLK" == "true" ]]; then
    azerothcore_src="tbc"
  fi

  if $AZEROTHCORE_ENABLED; then
    if [[ "$SKIP_WOTLK" != "true" ]]; then
      log ""
      log "Step 9: Stopping WotLK server before AzerothCore transfer..."
      stop_server_if_running "${CTR["wotlk-srv"]}" "wotlk"
      sleep 2
    fi

    log ""
    log "========== Phase E: ${azerothcore_src^} → AzerothCore =========="
    PHASE_SYNCED[azerothcore]=0; PHASE_SKIPPED[azerothcore]=0; PHASE_VERIFIED[azerothcore]=0; PHASE_ROLLED_BACK[azerothcore]=0
    AZEROTHCORE_SYNCED_CHARS=()

    local_synced_before_azerothcore=$TOTAL_SYNCED
    local_skipped_before_azerothcore=$TOTAL_SKIPPED
    for username in "${ACCOUNT_NAMES[@]}"; do
      log ""
      log "=== Account: ${username} ==="
      sync_account_step "$azerothcore_src" azerothcore "$username" || true
    done
    PHASE_SYNCED[azerothcore]=$(( TOTAL_SYNCED - local_synced_before_azerothcore ))
    PHASE_SKIPPED[azerothcore]=$(( TOTAL_SKIPPED - local_skipped_before_azerothcore ))

    log ""
    log "Step 11: Starting AzerothCore runtime for verification..."
    start_server azerothcore
    wait_for_server_ready "${CTR["azerothcore-srv"]}" 180 || { log_err "AzerothCore worldserver did not start!"; }

    log ""
    log "========== Phase F: AzerothCore Verification =========="

    for entry in "${AZEROTHCORE_SYNCED_CHARS[@]+${AZEROTHCORE_SYNCED_CHARS[@]}}"; do
      [[ -z "$entry" ]] && continue
      IFS=':' read -r local_user local_guid local_name local_from_exp <<< "$entry"
      local_pass="${ACCOUNT_PASS[$local_user]}"

      log "  Verifying ${local_name} (guid=${local_guid}) on AzerothCore..."
      if verify_character_login_with_retry azerothcore "$local_user" "$local_pass" "$local_guid" "$local_name"; then
        log "  ✅ ${local_name} (guid=${local_guid}) — SUCCESS"
        PHASE_VERIFIED["azerothcore"]=$(( ${PHASE_VERIFIED["azerothcore"]} + 1 ))
        if ! store_verified_hash_after_login azerothcore "$local_name" "$local_from_exp"; then
          ((TOTAL_ERRORS++))
        fi
      else
        log_err "  ❌ ${local_name} (guid=${local_guid}) — FAIL"
        rollback_character azerothcore "$local_guid"
          PHASE_ROLLED_BACK["azerothcore"]=$(( ${PHASE_ROLLED_BACK["azerothcore"]} + 1 ))
          if ! docker inspect --format='{{.State.Running}}' "${CTR["azerothcore-srv"]}" 2>/dev/null | grep -q true || \
            ! docker inspect --format='{{.State.Running}}' "${CTR["azerothcore-auth"]}" 2>/dev/null | grep -q true; then
          restart_after_crash azerothcore || log_err "AzerothCore runtime failed to restart after crash"
        fi
      fi
    done
  fi

  log ""
  log "Step 13: Starting all game servers..."
  for exp in classic tbc wotlk; do
    if [[ "$SKIP_WOTLK" == "true" && "$exp" == "wotlk" ]]; then continue; fi
    start_server "$exp"
  done
  if $AZEROTHCORE_ENABLED; then
    start_server azerothcore
  fi
  SERVERS_STOPPED=false

  END_TIME=$(date +%s)
  DURATION=$(( END_TIME - START_TIME ))
  DURATION_MIN=$(( DURATION / 60 ))
  DURATION_SEC=$(( DURATION % 60 ))

  log ""
  log "=========================================="
  if [[ "$SKIP_WOTLK" == "true" ]]; then
    log "  DAILY SYNC SUMMARY — 3-Step Pipeline"
  else
    log "  DAILY SYNC SUMMARY — Sequential Pipeline"
  fi
  log "=========================================="
  log ""
  log "  Phase A: Classic → TBC"
  log "    Synced:    ${PHASE_SYNCED["tbc"]}"
  log "    Skipped:   ${PHASE_SKIPPED["tbc"]}"
  log ""
  log "  Phase B: TBC Verification"
  log "    Verified:  ${PHASE_VERIFIED["tbc"]}"
  log "    Rolled back: ${PHASE_ROLLED_BACK["tbc"]}"
  if [[ "$SKIP_WOTLK" != "true" ]]; then
    log ""
    log "  Phase C: TBC → WotLK"
    log "    Synced:    ${PHASE_SYNCED["wotlk"]}"
    log "    Skipped:   ${PHASE_SKIPPED["wotlk"]}"
    log ""
    log "  Phase D: WotLK Verification"
    log "    Verified:  ${PHASE_VERIFIED["wotlk"]}"
    log "    Rolled back: ${PHASE_ROLLED_BACK["wotlk"]}"
  fi
  if $AZEROTHCORE_ENABLED; then
    log ""
    if [[ "$SKIP_WOTLK" == "true" ]]; then
      log "  Phase E: TBC → AzerothCore"
    else
      log "  Phase E: WotLK → AzerothCore"
    fi
    log "    Synced:    ${PHASE_SYNCED["azerothcore"]}"
    log "    Skipped:   ${PHASE_SKIPPED["azerothcore"]}"
    log ""
    log "  Phase F: AzerothCore Verification"
    log "    Verified:  ${PHASE_VERIFIED["azerothcore"]}"
    log "    Rolled back: ${PHASE_ROLLED_BACK["azerothcore"]}"
  fi
  log ""
  log "  Totals:"
  log "    Accounts:  ${#ACCOUNT_NAMES[@]}"
  log "    Synced:    ${TOTAL_SYNCED}"
  log "    Skipped:   ${TOTAL_SKIPPED} (unchanged or played on target)"
  log "    Created:   ${TOTAL_CREATED} (new accounts)"
  log "    Errors:    ${TOTAL_ERRORS}"
  log "    Duration:  ${DURATION_MIN}m ${DURATION_SEC}s"
  log "=========================================="

  ls -1t "${LOG_DIR}"/daily-sync-*.log 2>/dev/null | tail -n +31 | xargs -r rm -f
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  daily_sync_main "$@"
fi
