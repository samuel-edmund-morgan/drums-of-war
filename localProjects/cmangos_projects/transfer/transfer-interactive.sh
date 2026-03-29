#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_ROOT="/opt/cmangos-transfer/backups"
BACKUP_DIR="${BACKUP_ROOT}/${TIMESTAMP}"
TEMP_DB="transfer_temp_${RANDOM}_$$"

# Aliases for lib.sh maps (backward compatibility)
declare -n EXP_DB_CONTAINER=LIB_DB_CONTAINER
declare -n EXP_SERVER_CONTAINER=LIB_SERVER_CONTAINER
declare -n EXP_CHAR_DB=LIB_CHAR_DB
declare -n EXP_REALMD_DB=LIB_REALMD_DB
declare -n EXP_COMPOSE_DIR=LIB_COMPOSE_DIR
declare -n EXP_WORLD_DB=LIB_WORLD_DB

SKIP_TABLES="${LIB_SKIP_TABLES}"

SRC=""
TGT=""
SRC_DB_CTR=""
TGT_DB_CTR=""
SRC_SRV_CTR=""
TGT_SRV_CTR=""
SRC_CHAR_DB=""
TGT_CHAR_DB=""
SRC_REALMD_DB=""
TGT_REALMD_DB=""
AUTO_RESTART=true
INTERACTIVE=true
CLI_CHARS=""     # comma-separated names/guids from --chars
CLI_YES=false    # --yes skips confirmation
CLI_NO_RESTART=false
CLI_LIST=false   # --list just prints characters

DUMP_FILE=""

usage() {
  cat <<'EOF'
CMaNGOS Character Transfer — Interactive & CLI

INTERACTIVE (default):
  transfer-interactive.sh

CLI (non-interactive, one-liner / cron-friendly):
  transfer-interactive.sh <source> <target> --chars <names|guids> [options]

Arguments:
  source/target    classic | tbc | wotlk

Options:
  --chars <list>   Comma-separated character names or guids to transfer (required for CLI)
  --all            Transfer ALL characters (instead of --chars)
  --yes            Skip confirmation prompt
  --no-restart     Don't stop/start game servers
  --list           Just list source characters and exit (no transfer)
  -h, --help       Show this help

Examples:
  # Interactive mode
  transfer-interactive.sh

  # Transfer Samuel from classic to tbc, auto-confirm
  transfer-interactive.sh classic tbc --chars Samuel --yes

  # Transfer multiple characters by name
  transfer-interactive.sh tbc wotlk --chars "Samuel,Neichao" --yes

  # Transfer by guid
  transfer-interactive.sh classic wotlk --chars 1801 --yes

  # Transfer all characters, no server restart
  transfer-interactive.sh classic tbc --all --yes --no-restart

  # Just list characters on a server
  transfer-interactive.sh classic --list
EOF
  exit 0
}

# ---- Parse CLI args ----
POSITIONALS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage ;;
    --chars) CLI_CHARS="$2"; INTERACTIVE=false; shift ;;
    --all) CLI_CHARS="__ALL__"; INTERACTIVE=false ;;
    --yes) CLI_YES=true ;;
    --no-restart) CLI_NO_RESTART=true ;;
    --list) CLI_LIST=true; INTERACTIVE=false ;;
    classic|tbc|wotlk) POSITIONALS+=("$1") ;;
    *) log_error "Unknown option: $1"; usage ;;
  esac
  shift
done

# If positional args given, we're in CLI mode
if [[ ${#POSITIONALS[@]} -gt 0 ]]; then
  SRC="${POSITIONALS[0]}"
  if [[ ${#POSITIONALS[@]} -ge 2 ]]; then
    TGT="${POSITIONALS[1]}"
  fi
  # If we have source+target but no --chars/--all/--list, still need interactive pick
  if [[ -n "$TGT" && -z "$CLI_CHARS" && "$CLI_LIST" == false ]]; then
    INTERACTIVE=true  # fall through to interactive character selection
  fi
fi

if $CLI_NO_RESTART; then
  AUTO_RESTART=false
fi

cleanup() {
  if [[ -n "${TGT_DB_CTR}" ]]; then
    docker exec "$TGT_DB_CTR" mariadb -u root -p"${DB_PASSWORD}" -e "DROP DATABASE IF EXISTS ${TEMP_DB}" >/dev/null 2>&1 || true
  fi
  [[ -n "${DUMP_FILE}" && -f "${DUMP_FILE}" ]] && rm -f "${DUMP_FILE}" || true
}
trap cleanup EXIT

# Functions db_exec, db_dump, safe_insert, table_exists,
# fix_char_after_transfer, stop_server_if_running, start_server
# are provided by lib.sh

choose_expansion() {
  local prompt="$1"
  local choice
  while true; do
    echo "$prompt" >&2
    echo "  1) classic" >&2
    echo "  2) tbc" >&2
    echo "  3) wotlk" >&2
    read -r -p "> " choice
    case "$choice" in
      1|classic) echo "classic"; return ;;
      2|tbc) echo "tbc"; return ;;
      3|wotlk) echo "wotlk"; return ;;
      *) log_warn "Невірний вибір. Спробуй ще." ;;
    esac
  done
}

delete_target_character_data() {
  local guid="$1"

  for tbl in characters character_account_data character_action character_aura \
    character_battleground_data character_gifts character_homebind character_instance \
    character_inventory character_queststatus character_queststatus_daily \
    character_queststatus_monthly character_queststatus_rewarded \
    character_queststatus_weekly character_reputation character_skills \
    character_social character_spell character_spell_cooldown character_stats \
    character_declinedname character_achievement character_achievement_progress \
    character_battleground_random character_equipmentsets character_glyphs \
    character_talent; do
    table_exists "$TGT_DB_CTR" "$TGT_CHAR_DB" "$tbl" || continue
    db_exec "$TGT_DB_CTR" -e "DELETE FROM ${TGT_CHAR_DB}.\`${tbl}\` WHERE guid=${guid}" || true
  done

  if table_exists "$TGT_DB_CTR" "$TGT_CHAR_DB" "character_pet"; then
    local pet_ids
    pet_ids=$(db_exec "$TGT_DB_CTR" -N -e "SELECT id FROM ${TGT_CHAR_DB}.character_pet WHERE owner=${guid}" | tr '\n' ',' | sed 's/,$//')
    if [[ -n "$pet_ids" ]]; then
      for tbl in pet_aura pet_spell pet_spell_cooldown; do
        table_exists "$TGT_DB_CTR" "$TGT_CHAR_DB" "$tbl" || continue
        db_exec "$TGT_DB_CTR" -e "DELETE FROM ${TGT_CHAR_DB}.\`${tbl}\` WHERE guid IN (${pet_ids})" || true
      done
    fi
    db_exec "$TGT_DB_CTR" -e "DELETE FROM ${TGT_CHAR_DB}.character_pet WHERE owner=${guid}" || true
  fi

  table_exists "$TGT_DB_CTR" "$TGT_CHAR_DB" "item_instance" && \
    db_exec "$TGT_DB_CTR" -e "DELETE FROM ${TGT_CHAR_DB}.item_instance WHERE owner_guid=${guid}" || true

  if table_exists "$TGT_DB_CTR" "$TGT_CHAR_DB" "mail"; then
    local mail_ids
    mail_ids=$(db_exec "$TGT_DB_CTR" -N -e "SELECT id FROM ${TGT_CHAR_DB}.mail WHERE receiver=${guid}" | tr '\n' ',' | sed 's/,$//')
    if [[ -n "$mail_ids" ]]; then
      table_exists "$TGT_DB_CTR" "$TGT_CHAR_DB" "mail_items" && \
        db_exec "$TGT_DB_CTR" -e "DELETE FROM ${TGT_CHAR_DB}.mail_items WHERE mail_id IN (${mail_ids})" || true
    fi
    db_exec "$TGT_DB_CTR" -e "DELETE FROM ${TGT_CHAR_DB}.mail WHERE receiver=${guid}" || true
  fi

  table_exists "$TGT_DB_CTR" "$TGT_CHAR_DB" "corpse" && \
    db_exec "$TGT_DB_CTR" -e "DELETE FROM ${TGT_CHAR_DB}.corpse WHERE player=${guid}" || true

  table_exists "$TGT_DB_CTR" "$TGT_CHAR_DB" "petition" && \
    db_exec "$TGT_DB_CTR" -e "DELETE FROM ${TGT_CHAR_DB}.petition WHERE ownerguid=${guid}" || true
}

copy_character_guid() {
  local guid="$1" src_account_id="$2" src_username="$3" char_name="$4"

  local tgt_account_id
  tgt_account_id=$(db_exec "$TGT_DB_CTR" -N -e "SELECT id FROM ${TGT_REALMD_DB}.account WHERE username='${src_username}'")
  if [[ -z "$tgt_account_id" ]]; then
    log_warn "Skip ${char_name}: account '${src_username}' не існує у ${TGT}. Створи акаунт і повтори."
    return 0
  fi

  local existing_by_name existing_by_guid
  existing_by_name=$(db_exec "$TGT_DB_CTR" -N -e "SELECT guid FROM ${TGT_CHAR_DB}.characters WHERE name='${char_name}' LIMIT 1")
  existing_by_guid=$(db_exec "$TGT_DB_CTR" -N -e "SELECT guid FROM ${TGT_CHAR_DB}.characters WHERE guid=${guid} LIMIT 1")

  if [[ -n "$existing_by_name" ]]; then
    log_info "Target already has name '${char_name}' (guid ${existing_by_name}), deleting old data..."
    delete_target_character_data "$existing_by_name"
  fi
  if [[ -n "$existing_by_guid" && "$existing_by_guid" != "$existing_by_name" ]]; then
    log_info "Target already has guid ${guid}, deleting old data..."
    delete_target_character_data "$existing_by_guid"
  fi

  safe_insert "$TGT_DB_CTR" "$TEMP_DB" "$TGT_CHAR_DB" "characters" "guid=${guid}" || {
    log_error "Failed to copy characters row for guid ${guid}"; return 1; }
  db_exec "$TGT_DB_CTR" -e "UPDATE ${TGT_CHAR_DB}.characters SET account=${tgt_account_id}, online=0 WHERE guid=${guid}"

  local _si_failed=""
  for tbl in character_account_data character_action character_aura character_battleground_data \
    character_declinedname character_gifts character_homebind character_instance \
    character_inventory character_queststatus character_queststatus_daily \
    character_queststatus_monthly character_queststatus_rewarded character_queststatus_weekly \
    character_reputation character_skills character_social character_spell \
    character_spell_cooldown character_stats character_talent character_tutorial \
    character_achievement character_achievement_progress character_battleground_random \
    character_equipmentsets character_glyphs; do
    table_exists "$TGT_DB_CTR" "$TEMP_DB" "$tbl" || continue
    table_exists "$TGT_DB_CTR" "$TGT_CHAR_DB" "$tbl" || continue
    if ! safe_insert "$TGT_DB_CTR" "$TEMP_DB" "$TGT_CHAR_DB" "$tbl" "guid=${guid}" 2>/dev/null; then
      log_info "    WARN: safe_insert failed for ${tbl} (guid=${guid})"
      _si_failed+="${tbl} "
    fi
  done
  [[ -n "$_si_failed" ]] && log_info "    WARN: Failed secondary tables: ${_si_failed}"

  if table_exists "$TGT_DB_CTR" "$TEMP_DB" "character_pet" && table_exists "$TGT_DB_CTR" "$TGT_CHAR_DB" "character_pet"; then
    safe_insert "$TGT_DB_CTR" "$TEMP_DB" "$TGT_CHAR_DB" "character_pet" "owner=${guid}" 2>/dev/null || true
    local pet_ids
    pet_ids=$(db_exec "$TGT_DB_CTR" -N -e "SELECT id FROM ${TEMP_DB}.character_pet WHERE owner=${guid}" | tr '\n' ',' | sed 's/,$//')
    if [[ -n "$pet_ids" ]]; then
      for tbl in pet_aura pet_spell pet_spell_cooldown; do
        table_exists "$TGT_DB_CTR" "$TEMP_DB" "$tbl" || continue
        table_exists "$TGT_DB_CTR" "$TGT_CHAR_DB" "$tbl" || continue
        safe_insert "$TGT_DB_CTR" "$TEMP_DB" "$TGT_CHAR_DB" "$tbl" "guid IN (${pet_ids})" 2>/dev/null || true
      done
    fi
  fi

  table_exists "$TGT_DB_CTR" "$TEMP_DB" "item_instance" && table_exists "$TGT_DB_CTR" "$TGT_CHAR_DB" "item_instance" && \
    safe_insert "$TGT_DB_CTR" "$TEMP_DB" "$TGT_CHAR_DB" "item_instance" "owner_guid=${guid}" 2>/dev/null || true

  if table_exists "$TGT_DB_CTR" "$TEMP_DB" "mail" && table_exists "$TGT_DB_CTR" "$TGT_CHAR_DB" "mail"; then
    safe_insert "$TGT_DB_CTR" "$TEMP_DB" "$TGT_CHAR_DB" "mail" "receiver=${guid}" 2>/dev/null || true
    local mail_ids
    mail_ids=$(db_exec "$TGT_DB_CTR" -N -e "SELECT id FROM ${TEMP_DB}.mail WHERE receiver=${guid}" | tr '\n' ',' | sed 's/,$//')
    if [[ -n "$mail_ids" ]] && table_exists "$TGT_DB_CTR" "$TEMP_DB" "mail_items" && table_exists "$TGT_DB_CTR" "$TGT_CHAR_DB" "mail_items"; then
      safe_insert "$TGT_DB_CTR" "$TEMP_DB" "$TGT_CHAR_DB" "mail_items" "mail_id IN (${mail_ids})" 2>/dev/null || true
    fi
  fi

  table_exists "$TGT_DB_CTR" "$TEMP_DB" "corpse" && table_exists "$TGT_DB_CTR" "$TGT_CHAR_DB" "corpse" && \
    safe_insert "$TGT_DB_CTR" "$TEMP_DB" "$TGT_CHAR_DB" "corpse" "player=${guid}" 2>/dev/null || true

  if table_exists "$TGT_DB_CTR" "$TEMP_DB" "character_tutorial" && table_exists "$TGT_DB_CTR" "$TGT_CHAR_DB" "character_tutorial"; then
    safe_insert "$TGT_DB_CTR" "$TEMP_DB" "$TGT_CHAR_DB" "character_tutorial" "account=${src_account_id}" 2>/dev/null || true
    db_exec "$TGT_DB_CTR" -e "UPDATE ${TGT_CHAR_DB}.character_tutorial SET account=${tgt_account_id} WHERE account=${src_account_id}" || true
  fi

  # ---- Post-transfer normalization ----
  fix_char_after_transfer "$TGT" "$guid"

  log_info "Character copied: ${char_name} (guid ${guid}) ${SRC} → ${TGT}"
}

# -------- mode dispatch --------
echo "============================================================"
echo "  CMaNGOS Character Transfer"
echo "============================================================"

# ---- Resolve source ----
if [[ -z "$SRC" ]]; then
  SRC=$(choose_expansion "Обери SOURCE expansion:")
fi

# ---- --list mode: just show characters and exit ----
if $CLI_LIST; then
  SRC_DB_CTR="${EXP_DB_CONTAINER[$SRC]}"
  SRC_CHAR_DB="${EXP_CHAR_DB[$SRC]}"
  SRC_REALMD_DB="${EXP_REALMD_DB[$SRC]}"
  docker inspect --format='{{.State.Running}}' "$SRC_DB_CTR" 2>/dev/null | grep -q true || {
    log_error "Container $SRC_DB_CTR не запущений"; exit 1; }
  echo ""
  echo "Персонажі на ${SRC}:"
  db_exec "$SRC_DB_CTR" -e "
    SELECT c.guid, c.name, c.level, c.race, c.class, a.username AS account
    FROM ${SRC_CHAR_DB}.characters c
    JOIN ${SRC_REALMD_DB}.account a ON a.id = c.account
    ORDER BY a.username, c.name;"
  exit 0
fi

# ---- Resolve target ----
if [[ -z "$TGT" ]]; then
  while true; do
    TGT=$(choose_expansion "Обери TARGET expansion:")
    [[ "$SRC" != "$TGT" ]] && break
    log_warn "SOURCE і TARGET мають відрізнятися."
  done
fi
[[ "$SRC" == "$TGT" ]] && { log_error "Source і target мають відрізнятися."; exit 1; }

# ---- Auto-restart prompt (interactive only) ----
if $INTERACTIVE && ! $CLI_NO_RESTART; then
  read -r -p "Автоматично зупиняти/стартувати сервери? [Y/n]: " auto_ans
  if [[ "${auto_ans:-Y}" =~ ^[Nn]$ ]]; then
    AUTO_RESTART=false
  fi
fi

SRC_DB_CTR="${EXP_DB_CONTAINER[$SRC]}"
TGT_DB_CTR="${EXP_DB_CONTAINER[$TGT]}"
SRC_SRV_CTR="${EXP_SERVER_CONTAINER[$SRC]}"
TGT_SRV_CTR="${EXP_SERVER_CONTAINER[$TGT]}"
SRC_CHAR_DB="${EXP_CHAR_DB[$SRC]}"
TGT_CHAR_DB="${EXP_CHAR_DB[$TGT]}"
SRC_REALMD_DB="${EXP_REALMD_DB[$SRC]}"
TGT_REALMD_DB="${EXP_REALMD_DB[$TGT]}"

for ctr in "$SRC_DB_CTR" "$TGT_DB_CTR"; do
  docker inspect --format='{{.State.Running}}' "$ctr" 2>/dev/null | grep -q true || {
    log_error "Container $ctr не запущений"; exit 1; }
done

log_step "Читаю список персонажів з ${SRC}..."
mapfile -t CHAR_ROWS < <(db_exec "$SRC_DB_CTR" -N -e "
  SELECT c.guid, c.name, c.level, c.account, a.username
  FROM ${SRC_CHAR_DB}.characters c
  JOIN ${SRC_REALMD_DB}.account a ON a.id = c.account
  ORDER BY a.username, c.name;")

if [[ ${#CHAR_ROWS[@]} -eq 0 ]]; then
  log_error "У source немає персонажів."
  exit 1
fi

echo ""
echo "Доступні персонажі (${SRC}):"
for i in "${!CHAR_ROWS[@]}"; do
  IFS=$'\t' read -r guid name lvl account username <<< "${CHAR_ROWS[$i]}"
  printf "  %2d) %-12s lvl %-2s guid %-6s account %-12s\n" "$((i+1))" "$name" "$lvl" "$guid" "$username"
done
echo ""

# ---- Character selection ----
declare -A SELECTED_BY_GUID=()

if [[ "$CLI_CHARS" == "__ALL__" ]]; then
  # --all: select everything
  for row in "${CHAR_ROWS[@]}"; do
    IFS=$'\t' read -r guid _ <<< "$row"
    SELECTED_BY_GUID["$guid"]=1
  done
elif [[ -n "$CLI_CHARS" ]]; then
  # --chars: parse from CLI
  mapfile -t TOKENS < <(echo "$CLI_CHARS" | tr ',' '\n' | sed 's/^ *//;s/ *$//' | sed '/^$/d')
  for token in "${TOKENS[@]}"; do
    if [[ "$token" =~ ^[0-9]+$ ]]; then
      # Could be index (1-based) or guid — check if it's a valid index first
      idx=$((token-1))
      if (( idx >= 0 && idx < ${#CHAR_ROWS[@]} )); then
        IFS=$'\t' read -r guid _ <<< "${CHAR_ROWS[$idx]}"
        SELECTED_BY_GUID["$guid"]=1
      else
        # Try as guid
        for row in "${CHAR_ROWS[@]}"; do
          IFS=$'\t' read -r guid _ <<< "$row"
          if [[ "$guid" == "$token" ]]; then
            SELECTED_BY_GUID["$guid"]=1
          fi
        done
      fi
    else
      found=false
      for row in "${CHAR_ROWS[@]}"; do
        IFS=$'\t' read -r guid name _ <<< "$row"
        if [[ "${name^^}" == "${token^^}" ]]; then
          SELECTED_BY_GUID["$guid"]=1
          found=true
        fi
      done
      if [[ "$found" == false ]]; then
        log_warn "Ім'я '${token}' не знайдено, пропускаю"
      fi
    fi
  done
else
  # Interactive selection
  read -r -p "Введи номери або імена через кому (напр. 1,3 або Samuel), або 'all': " PICK_INPUT
  [[ -z "${PICK_INPUT// }" ]] && { log_error "Нічого не обрано"; exit 1; }

  if [[ "${PICK_INPUT,,}" == "all" ]]; then
    for row in "${CHAR_ROWS[@]}"; do
      IFS=$'\t' read -r guid _ <<< "$row"
      SELECTED_BY_GUID["$guid"]=1
    done
  else
    mapfile -t TOKENS < <(echo "$PICK_INPUT" | tr ',' '\n' | sed 's/^ *//;s/ *$//' | sed '/^$/d')
    for token in "${TOKENS[@]}"; do
      if [[ "$token" =~ ^[0-9]+$ ]]; then
        idx=$((token-1))
        if (( idx < 0 || idx >= ${#CHAR_ROWS[@]} )); then
          log_warn "Індекс ${token} поза межами, пропускаю"
          continue
        fi
        IFS=$'\t' read -r guid _ <<< "${CHAR_ROWS[$idx]}"
        SELECTED_BY_GUID["$guid"]=1
      else
        found=false
        for row in "${CHAR_ROWS[@]}"; do
          IFS=$'\t' read -r guid name _ <<< "$row"
          if [[ "${name^^}" == "${token^^}" ]]; then
            SELECTED_BY_GUID["$guid"]=1
            found=true
          fi
        done
        if [[ "$found" == false ]]; then
          log_warn "Ім'я '${token}' не знайдено, пропускаю"
        fi
      fi
    done
  fi
fi

if [[ ${#SELECTED_BY_GUID[@]} -eq 0 ]]; then
  log_error "Немає валідних персонажів для трансферу"
  exit 1
fi

echo ""
log_info "Обрано персонажів: ${#SELECTED_BY_GUID[@]}"
for row in "${CHAR_ROWS[@]}"; do
  IFS=$'\t' read -r guid name lvl _ username <<< "$row"
  [[ -n "${SELECTED_BY_GUID[$guid]:-}" ]] && echo "  - ${name} (guid ${guid}, lvl ${lvl}, account ${username})"
done
echo ""

if $CLI_YES; then
  log_info "Auto-confirmed (--yes)"
else
  read -r -p "Підтвердити трансфер ${SRC} → ${TGT}? [y/N]: " CONFIRM
  [[ "$CONFIRM" =~ ^[Yy]$ ]] || { log_warn "Скасовано"; exit 0; }
fi

# -------- execution --------
if $AUTO_RESTART; then
  log_step "Stopping servers..."
  stop_server_if_running "$TGT_SRV_CTR" "$TGT"
  stop_server_if_running "$SRC_SRV_CTR" "$SRC"
else
  log_warn "Працюю без автоматичного stop/start."
fi

mkdir -p "$BACKUP_DIR"
log_step "Backup target DB..."
db_dump "$TGT_DB_CTR" "$TGT_CHAR_DB" > "${BACKUP_DIR}/${TGT_CHAR_DB}_backup.sql"
log_info "Backup: ${BACKUP_DIR}/${TGT_CHAR_DB}_backup.sql"

log_step "Dump source DB..."
EXCLUDE_ARGS=""
for tbl in $SKIP_TABLES; do EXCLUDE_ARGS+=" --ignore-table=${SRC_CHAR_DB}.${tbl}"; done
DUMP_FILE="${BACKUP_DIR}/source_${SRC_CHAR_DB}.sql"
# shellcheck disable=SC2086
db_dump "$SRC_DB_CTR" "$SRC_CHAR_DB" --skip-lock-tables --add-drop-table $EXCLUDE_ARGS > "$DUMP_FILE"

log_step "Import source into temp DB on target..."
db_exec "$TGT_DB_CTR" -e "DROP DATABASE IF EXISTS ${TEMP_DB}"
db_exec "$TGT_DB_CTR" -e "CREATE DATABASE ${TEMP_DB} CHARACTER SET utf8mb3"
docker cp "$DUMP_FILE" "${TGT_DB_CTR}:/tmp/transfer_dump.sql"
db_exec "$TGT_DB_CTR" "$TEMP_DB" -e "SOURCE /tmp/transfer_dump.sql"
docker exec "$TGT_DB_CTR" rm -f /tmp/transfer_dump.sql >/dev/null 2>&1 || true

log_step "Transferring selected characters..."
SUCCESS=0
FAILED=0

for row in "${CHAR_ROWS[@]}"; do
  IFS=$'\t' read -r guid name _ src_account_id src_username <<< "$row"
  [[ -z "${SELECTED_BY_GUID[$guid]:-}" ]] && continue
  if copy_character_guid "$guid" "$src_account_id" "$src_username" "$name"; then
    SUCCESS=$((SUCCESS+1))
  else
    FAILED=$((FAILED+1))
  fi
done

if $AUTO_RESTART; then
  log_step "Starting servers..."
  start_server "$SRC"
  start_server "$TGT"
fi

echo ""
echo "============================================================"
echo " Transfer finished"
echo "============================================================"
echo " Path:      ${SRC} → ${TGT}"
echo " Success:   ${SUCCESS}"
echo " Failed:    ${FAILED}"
echo " Backup:    ${BACKUP_DIR}/${TGT_CHAR_DB}_backup.sql"
echo " Rollback:  docker exec -i ${TGT_DB_CTR} mariadb -u root -p'${DB_PASSWORD}' ${TGT_CHAR_DB} < ${BACKUP_DIR}/${TGT_CHAR_DB}_backup.sql"
echo "============================================================"
