#!/usr/bin/env bash
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/daily-sync.sh"
source "${SCRIPT_DIR}/request-locks.sh"

REQUEST_ID=""
SRC="classic"
TGT="tbc"
ACCOUNT_USERNAME=""
ACCOUNT_PASSWORD=""
ACCOUNT_PASSWORD_SOURCE=""
CHAR_NAME=""
CHAR_GUID=""
DRY_RUN=false
AUTO_RESTART=true
JSON_OUT=""
LOG_PATH=""
EVENTS_FILE=""
FINAL_STATUS="failed"
FINAL_MESSAGE=""
TRANSFER_DECISION="unknown"
TARGET_STATE="unknown"
BLOCKER_CODE=""
SAFE_RETRY_FROM="rerun_request"
ACCOUNT_CREATED=false
TARGET_GUID=""
SOURCE_ONLINE=""
SOURCE_AT_LOGIN=""
SOURCE_LEVEL=""
SOURCE_ACCOUNT_ID=""
ORIGINAL_SRC_RUNNING=false
ORIGINAL_TGT_RUNNING=false
TGT_STARTED_FOR_VERIFY=false
SOURCE_STOPPED_BY_RUNNER=false
TARGET_STOPPED_BY_RUNNER=false
VERIFY_STATUS="not_run"
HASH_STATUS="not_run"
RESTORE_STATUS="not_needed"
TRANSFER_STEP_STATUS="not_run"
ACTIVE_LOCK_KEY=""
IDEMPOTENCY_KEY=""

usage() {
  cat <<'EOF'
Targeted transfer step runner

Usage:
  targeted-transfer-runner.sh --account USERNAME (--character NAME | --guid GUID) [options]

Options:
  --source PATCH       Source patch: classic | tbc
  --target PATCH       Target patch: tbc | wotlk
  --account USERNAME    Source account username
  --password PASSWORD   Account password for login-bot verification
  --character NAME      Source character name
  --guid GUID           Source character guid
  --request-id ID       Caller-supplied logical request id
  --dry-run             Evaluate and return JSON without mutating runtime state
  --no-restart          Do not stop/start source and target servers automatically
  --json-out PATH       Also write the JSON payload to a file
  --help                Show this help

Notes:
  - Supported step pairs: classic -> tbc, tbc -> wotlk.
  - If --password is omitted, the runner looks up the account in sync-accounts.conf.
  - JSON payload is printed to stdout; operational logs go to a separate log file.
EOF
}

record_event() {
  local step="$1" status="$2" code="$3" message="$4"
  printf '%s\t%s\t%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$step" "$status" "$code" "$message" >> "$EVENTS_FILE"
}

container_is_running() {
  local ctr="$1"
  docker inspect --format='{{.State.Running}}' "$ctr" 2>/dev/null | grep -q true
}

lookup_account_password() {
  local username="$1"
  local conf_file="${SYNC_CONF:-${SCRIPT_DIR}/sync-accounts.conf}"

  [[ -f "$conf_file" ]] || return 1

  while IFS= read -r line; do
    line="${line%%#*}"
    line="${line// /}"
    [[ -z "$line" ]] && continue

    local user pass
    user="${line%%:*}"
    pass="${line#*:}"
    user="$(echo "$user" | tr '[:lower:]' '[:upper:]')"
    pass="$(echo "$pass" | tr '[:lower:]' '[:upper:]')"

    if [[ "$user" == "$username" ]]; then
      printf '%s\n' "$pass"
      return 0
    fi
  done < "$conf_file"

  return 1
}

resolve_source_character() {
  local where_clause=""
  local src_ctr="${CTR[${SRC}-db]}"
  local src_db="${CHARDB[$SRC]}"
  local src_realm="${REALMDB[$SRC]}"

  if [[ -n "$CHAR_GUID" ]]; then
    where_clause="c.guid=${CHAR_GUID}"
  else
    where_clause="c.name='${CHAR_NAME}'"
  fi

  db_exec "$src_ctr" -N -e "
    SELECT c.guid, c.name, c.level, c.online, c.at_login, c.account, a.username
    FROM ${src_db}.characters c
    JOIN ${src_realm}.account a ON a.id = c.account
    WHERE ${where_clause}
    LIMIT 1"
}

resolve_target_character_state() {
  local tgt_ctr="${CTR[${TGT}-db]}"
  local tgt_db="${CHARDB[$TGT]}"
  local row current_hash stored_hash

  row=$(db_exec "$tgt_ctr" -N -e "SELECT guid, online, at_login FROM ${tgt_db}.characters WHERE name='${CHAR_NAME}' LIMIT 1")
  if [[ -z "$row" ]]; then
    TARGET_STATE="absent"
    return 0
  fi

  IFS=$'\t' read -r TARGET_GUID target_online target_at_login <<< "$row"
  if [[ "${target_online:-0}" != "0" || "${target_at_login:-0}" != "0" ]]; then
    TARGET_STATE="online_conflict"
    BLOCKER_CODE="stale_conflicting_target_state"
    SAFE_RETRY_FROM="after_target_logout"
    return 1
  fi

  current_hash=$(compute_char_hash "$tgt_ctr" "$tgt_db" "$CHAR_NAME")
  stored_hash=$(get_stored_hash "$tgt_ctr" "$tgt_db" "$CHAR_NAME")

  if [[ -z "$stored_hash" ]]; then
    TARGET_STATE="untracked_conflict"
    BLOCKER_CODE="stale_conflicting_target_state"
    SAFE_RETRY_FROM="after_target_conflict_resolved"
    return 1
  fi

  if [[ -n "$current_hash" && "$current_hash" != "$stored_hash" ]]; then
    TARGET_STATE="played_conflict"
    BLOCKER_CODE="stale_conflicting_target_state"
    SAFE_RETRY_FROM="after_target_conflict_resolved"
    return 1
  fi

  TARGET_STATE="safe_overwrite"
  TARGET_GUID="$(db_exec "$tgt_ctr" -N -e "SELECT guid FROM ${tgt_db}.characters WHERE name='${CHAR_NAME}' LIMIT 1")"
  return 0
}

build_request_guard_keys() {
  ACTIVE_LOCK_KEY="transfer|scope=character|identity=runtime_account:${ACCOUNT_USERNAME}|source_patch=${SRC}|source_character_guid=${CHAR_GUID}"
  IDEMPOTENCY_KEY="${ACTIVE_LOCK_KEY}|requested_target=${TGT}"
}

emit_json() {
  local tmp_json

  tmp_json=$(REQUEST_ID="$REQUEST_ID" \
    SRC="$SRC" \
    TGT="$TGT" \
    STEP_KEY="${SRC}_to_${TGT}" \
    ACCOUNT_USERNAME="$ACCOUNT_USERNAME" \
    ACCOUNT_PASSWORD_SOURCE="$ACCOUNT_PASSWORD_SOURCE" \
    CHAR_NAME="$CHAR_NAME" \
    CHAR_GUID="$CHAR_GUID" \
    SOURCE_LEVEL="$SOURCE_LEVEL" \
    SOURCE_ACCOUNT_ID="$SOURCE_ACCOUNT_ID" \
    SOURCE_ONLINE="$SOURCE_ONLINE" \
    SOURCE_AT_LOGIN="$SOURCE_AT_LOGIN" \
    FINAL_STATUS="$FINAL_STATUS" \
    FINAL_MESSAGE="$FINAL_MESSAGE" \
    TRANSFER_DECISION="$TRANSFER_DECISION" \
    TARGET_STATE="$TARGET_STATE" \
    BLOCKER_CODE="$BLOCKER_CODE" \
    SAFE_RETRY_FROM="$SAFE_RETRY_FROM" \
    LOG_PATH="$LOG_PATH" \
    ACTIVE_LOCK_KEY="$ACTIVE_LOCK_KEY" \
    IDEMPOTENCY_KEY="$IDEMPOTENCY_KEY" \
    REQUEST_LOCK_DIR="$REQUEST_LOCK_DIR" \
    REQUEST_LOCK_STATE="$REQUEST_LOCK_STATE" \
    REQUEST_LOCK_STALE_RECOVERED="$REQUEST_LOCK_STALE_RECOVERED" \
    REQUEST_LOCK_EXISTING_REQUEST_ID="$REQUEST_LOCK_EXISTING_REQUEST_ID" \
    REQUEST_LOCK_EXISTING_IDEMPOTENCY_KEY="$REQUEST_LOCK_EXISTING_IDEMPOTENCY_KEY" \
    REQUEST_LOCK_EXISTING_HOST="$REQUEST_LOCK_EXISTING_HOST" \
    REQUEST_LOCK_EXISTING_PID="$REQUEST_LOCK_EXISTING_PID" \
    REQUEST_LOCK_TTL_SECONDS="$REQUEST_LOCK_TTL_SECONDS" \
    ACCOUNT_CREATED="$ACCOUNT_CREATED" \
    TRANSFER_STEP_STATUS="$TRANSFER_STEP_STATUS" \
    VERIFY_STATUS="$VERIFY_STATUS" \
    HASH_STATUS="$HASH_STATUS" \
    RESTORE_STATUS="$RESTORE_STATUS" \
    DRY_RUN="$DRY_RUN" \
    TARGET_GUID="$TARGET_GUID" \
    EVENTS_FILE="$EVENTS_FILE" \
    python3 - <<'PY'
import json
import os

events = []
events_file = os.environ["EVENTS_FILE"]
if os.path.exists(events_file):
    with open(events_file, "r", encoding="utf-8") as handle:
        for raw_line in handle:
            raw_line = raw_line.rstrip("\n")
            if not raw_line:
                continue
            ts, step, status, code, message = raw_line.split("\t", 4)
            events.append({
                "timestamp": ts,
                "step": step,
                "status": status,
                "code": code,
                "message": message,
            })

payload = {
    "request_id": os.environ["REQUEST_ID"] or None,
    "runner": "targeted-transfer-step-runner-v3",
    "step_key": os.environ["STEP_KEY"],
    "source": os.environ["SRC"],
    "target": os.environ["TGT"],
    "dry_run": os.environ["DRY_RUN"] == "true",
    "status": os.environ["FINAL_STATUS"],
    "message": os.environ["FINAL_MESSAGE"],
    "transfer_decision": os.environ["TRANSFER_DECISION"],
    "target_state": os.environ["TARGET_STATE"],
    "blocker_code": os.environ["BLOCKER_CODE"] or None,
    "safe_retry_from": os.environ["SAFE_RETRY_FROM"],
    "log_path": os.environ["LOG_PATH"],
    "request_guard": {
      "scope": "character",
      "active_lock_key": os.environ["ACTIVE_LOCK_KEY"] or None,
      "idempotency_key": os.environ["IDEMPOTENCY_KEY"] or None,
      "lock_dir": os.environ["REQUEST_LOCK_DIR"],
      "lock_state": os.environ["REQUEST_LOCK_STATE"],
      "stale_lock_recovered": os.environ["REQUEST_LOCK_STALE_RECOVERED"] == "true",
      "existing_request_id": os.environ["REQUEST_LOCK_EXISTING_REQUEST_ID"] or None,
      "existing_idempotency_key": os.environ["REQUEST_LOCK_EXISTING_IDEMPOTENCY_KEY"] or None,
      "existing_host": os.environ["REQUEST_LOCK_EXISTING_HOST"] or None,
      "existing_pid": int(os.environ["REQUEST_LOCK_EXISTING_PID"]) if os.environ["REQUEST_LOCK_EXISTING_PID"] else None,
      "stale_after_seconds": int(os.environ["REQUEST_LOCK_TTL_SECONDS"]),
      "duplicate_policy": "reuse_active_request",
    },
    "account": {
        "username": os.environ["ACCOUNT_USERNAME"],
        "password_source": os.environ["ACCOUNT_PASSWORD_SOURCE"] or None,
        "created_on_target": os.environ["ACCOUNT_CREATED"] == "true",
        "source_account_id": int(os.environ["SOURCE_ACCOUNT_ID"]) if os.environ["SOURCE_ACCOUNT_ID"] else None,
    },
    "character": {
        "guid": int(os.environ["CHAR_GUID"]) if os.environ["CHAR_GUID"] else None,
        "name": os.environ["CHAR_NAME"] or None,
        "level": int(os.environ["SOURCE_LEVEL"]) if os.environ["SOURCE_LEVEL"] else None,
        "source_online": os.environ["SOURCE_ONLINE"] == "1",
        "source_at_login": int(os.environ["SOURCE_AT_LOGIN"]) if os.environ["SOURCE_AT_LOGIN"] else None,
        "target_guid": int(os.environ["TARGET_GUID"]) if os.environ["TARGET_GUID"] else None,
    },
    "steps": {
      "transfer": os.environ["TRANSFER_STEP_STATUS"],
        "verify": os.environ["VERIFY_STATUS"],
        "store_hash": os.environ["HASH_STATUS"],
        "restore_runtime": os.environ["RESTORE_STATUS"],
    },
    "events": events,
}

print(json.dumps(payload, ensure_ascii=True, indent=2))
PY
)

  if [[ -n "$JSON_OUT" ]]; then
    printf '%s\n' "$tmp_json" > "$JSON_OUT"
  fi

  printf '%s\n' "$tmp_json" >&3
}

finish() {
  local exit_code="$1"
  trap - EXIT
  emit_json
  request_lock_release
  rm -f "$EVENTS_FILE"
  exit "$exit_code"
}

restore_runtime_state() {
  RESTORE_STATUS="ok"

  if $TGT_STARTED_FOR_VERIFY && ! $ORIGINAL_TGT_RUNNING; then
    stop_server_if_running "${CTR[${TGT}-srv]}" "$TGT"
    record_event "restore_runtime" "ok" "target_stopped" "Stopped target server to restore its pre-run state"
  fi

  if $SOURCE_STOPPED_BY_RUNNER; then
    start_server "$SRC"
    record_event "restore_runtime" "ok" "source_started" "Restarted source server after transfer"
  fi

  if $TARGET_STOPPED_BY_RUNNER && ! $TGT_STARTED_FOR_VERIFY; then
    start_server "$TGT"
    record_event "restore_runtime" "ok" "target_started" "Restarted target server after transfer"
  fi
}

runner_cleanup() {
  local exit_code=$?
  trap - EXIT

  if [[ $exit_code -ne 0 && "$RESTORE_STATUS" != "ok" && "$AUTO_RESTART" == true ]]; then
    restore_runtime_state >/dev/null 2>&1 || true
  fi

  if [[ -n "$EVENTS_FILE" && -f "$EVENTS_FILE" && $exit_code -ne 0 && "$FINAL_MESSAGE" == "" ]]; then
    FINAL_STATUS="failed"
    FINAL_MESSAGE="Runner terminated unexpectedly"
  fi

  if [[ $exit_code -ne 0 ]]; then
    finish "$exit_code"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)
      SRC="$2"
      shift 2
      ;;
    --target)
      TGT="$2"
      shift 2
      ;;
    --account)
      ACCOUNT_USERNAME="$2"
      shift 2
      ;;
    --password)
      ACCOUNT_PASSWORD="$2"
      ACCOUNT_PASSWORD_SOURCE="explicit"
      shift 2
      ;;
    --character)
      CHAR_NAME="$2"
      shift 2
      ;;
    --guid)
      CHAR_GUID="$2"
      shift 2
      ;;
    --request-id)
      REQUEST_ID="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --no-restart)
      AUTO_RESTART=false
      shift
      ;;
    --json-out)
      JSON_OUT="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$ACCOUNT_USERNAME" || ( -z "$CHAR_NAME" && -z "$CHAR_GUID" ) ]]; then
  usage >&2
  exit 1
fi

ACCOUNT_USERNAME="$(echo "$ACCOUNT_USERNAME" | tr '[:lower:]' '[:upper:]')"
if [[ -n "$ACCOUNT_PASSWORD" ]]; then
  ACCOUNT_PASSWORD="$(echo "$ACCOUNT_PASSWORD" | tr '[:lower:]' '[:upper:]')"
fi

mkdir -p "${SCRIPT_DIR}/logs"
LOG_PATH="${SCRIPT_DIR}/logs/targeted-transfer-$(date +%Y%m%d_%H%M%S)-${ACCOUNT_USERNAME}.log"
EVENTS_FILE="$(mktemp)"

exec 3>&1
exec >"$LOG_PATH" 2>&1

trap runner_cleanup EXIT

record_event "request" "ok" "started" "Started targeted transfer step runner"

if [[ "$SRC:$TGT" != "classic:tbc" && "$SRC:$TGT" != "tbc:wotlk" ]]; then
  FINAL_STATUS="blocked"
  FINAL_MESSAGE="This runner only supports classic -> tbc and tbc -> wotlk step pairs"
  TRANSFER_DECISION="blocked"
  BLOCKER_CODE="unsupported_direction"
  SAFE_RETRY_FROM="none"
  record_event "preflight" "blocked" "$BLOCKER_CODE" "$FINAL_MESSAGE"
  finish 1
fi

for ctr in "${CTR["classic-db"]}" "${CTR["tbc-db"]}"; do
  if [[ "$TGT" == "wotlk" && "$ctr" == "${CTR["classic-db"]}" ]]; then
    continue
  fi
  if ! container_is_running "$ctr"; then
    FINAL_STATUS="failed"
    FINAL_MESSAGE="Required DB container ${ctr} is not running"
    TRANSFER_DECISION="failed"
    SAFE_RETRY_FROM="after_runtime_restored"
    record_event "preflight" "failed" "db_container_unavailable" "$FINAL_MESSAGE"
    finish 1
  fi
done
if [[ "$SRC:$TGT" == "classic:tbc" ]]; then
  record_event "preflight" "ok" "db_ready" "Classic and TBC DB containers are available"
else
  if ! container_is_running "${CTR["wotlk-db"]}"; then
    FINAL_STATUS="failed"
    FINAL_MESSAGE="Required DB container ${CTR["wotlk-db"]} is not running"
    TRANSFER_DECISION="failed"
    SAFE_RETRY_FROM="after_runtime_restored"
    record_event "preflight" "failed" "db_container_unavailable" "$FINAL_MESSAGE"
    finish 1
  fi
  record_event "preflight" "ok" "db_ready" "TBC and WotLK DB containers are available"
fi

if transfer_control_active_flag; then
  FINAL_STATUS="blocked"
  FINAL_MESSAGE="$(transfer_control_user_message "$TRANSFER_CONTROL_ACTIVE_FLAG")"
  TRANSFER_DECISION="blocked"
  TRANSFER_STEP_STATUS="blocked"
  BLOCKER_CODE="$(transfer_control_blocker_code "$TRANSFER_CONTROL_ACTIVE_FLAG")"
  SAFE_RETRY_FROM="after_operator_recovery"
  record_event "control_guard" "blocked" "$BLOCKER_CODE" "$FINAL_MESSAGE"
  finish 1
fi

if [[ -z "$ACCOUNT_PASSWORD" ]]; then
  if ACCOUNT_PASSWORD="$(lookup_account_password "$ACCOUNT_USERNAME")"; then
    ACCOUNT_PASSWORD_SOURCE="sync_conf"
  else
    FINAL_STATUS="blocked"
    FINAL_MESSAGE="Account password is missing; provide --password or add the account to sync-accounts.conf"
    TRANSFER_DECISION="blocked"
    BLOCKER_CODE="missing_account_password"
    SAFE_RETRY_FROM="after_password_supplied"
    record_event "credential_lookup" "blocked" "$BLOCKER_CODE" "$FINAL_MESSAGE"
    finish 1
  fi
fi
record_event "credential_lookup" "ok" "$ACCOUNT_PASSWORD_SOURCE" "Resolved account password for verification"

source_row="$(resolve_source_character)"
if [[ -z "$source_row" ]]; then
  FINAL_STATUS="blocked"
  FINAL_MESSAGE="Source character was not found on ${SRC}"
  TRANSFER_DECISION="blocked"
  BLOCKER_CODE="source_character_not_found"
  SAFE_RETRY_FROM="after_source_exists"
  record_event "source_lookup" "blocked" "$BLOCKER_CODE" "$FINAL_MESSAGE"
  finish 1
fi

IFS=$'\t' read -r resolved_guid resolved_name SOURCE_LEVEL SOURCE_ONLINE SOURCE_AT_LOGIN SOURCE_ACCOUNT_ID resolved_username <<< "$source_row"
CHAR_GUID="$resolved_guid"
CHAR_NAME="$resolved_name"

if [[ "$resolved_username" != "$ACCOUNT_USERNAME" ]]; then
  FINAL_STATUS="blocked"
  FINAL_MESSAGE="Source character does not belong to the requested account"
  TRANSFER_DECISION="blocked"
  BLOCKER_CODE="source_account_mismatch"
  SAFE_RETRY_FROM="none"
  record_event "source_lookup" "blocked" "$BLOCKER_CODE" "$FINAL_MESSAGE"
  finish 1
fi

record_event "source_lookup" "ok" "source_found" "Resolved source character ${CHAR_NAME} (guid=${CHAR_GUID})"

build_request_guard_keys
if ! request_lock_acquire "$ACTIVE_LOCK_KEY" "$IDEMPOTENCY_KEY" "$SRC" "$TGT" "targeted-transfer-step-runner-v3"; then
  FINAL_STATUS="blocked"
  FINAL_MESSAGE="Another transfer request is already active for this character"
  TRANSFER_DECISION="blocked"
  TRANSFER_STEP_STATUS="blocked"
  BLOCKER_CODE="duplicate_request"
  SAFE_RETRY_FROM="wait_for_active_request"
  record_event "request_guard" "blocked" "$BLOCKER_CODE" "$FINAL_MESSAGE"
  finish 1
fi

if [[ "$REQUEST_LOCK_STATE" == "recovered_stale" ]]; then
  record_event "request_guard" "warn" "stale_lock_recovered" "Recovered a stale character-scoped transfer lock before continuing"
elif [[ "$REQUEST_LOCK_STATE" == "inherited" ]]; then
  record_event "request_guard" "ok" "lock_inherited" "Using the active request lock inherited from the parent chain runner"
else
  record_event "request_guard" "ok" "lock_acquired" "Acquired the character-scoped request lock"
fi

if [[ "${SOURCE_ONLINE:-0}" != "0" ]]; then
  FINAL_STATUS="blocked"
  FINAL_MESSAGE="Source character is online and must log out first"
  TRANSFER_DECISION="blocked"
  BLOCKER_CODE="source_online"
  SAFE_RETRY_FROM="after_source_logout"
  record_event "source_guard" "blocked" "$BLOCKER_CODE" "$FINAL_MESSAGE"
  finish 1
fi

if [[ "${SOURCE_AT_LOGIN:-0}" != "0" ]]; then
  FINAL_STATUS="blocked"
  FINAL_MESSAGE="Source character has pending at_login flags and must clear them first"
  TRANSFER_DECISION="blocked"
  BLOCKER_CODE="source_pending_login_flags"
  SAFE_RETRY_FROM="after_source_login_cleanup"
  record_event "source_guard" "blocked" "$BLOCKER_CODE" "$FINAL_MESSAGE"
  finish 1
fi
record_event "source_guard" "ok" "source_ready" "Source character is offline and has no pending login flags"

if ! resolve_target_character_state; then
  FINAL_STATUS="blocked"
  FINAL_MESSAGE="Target state is not safe for overwrite"
  TRANSFER_DECISION="blocked"
  record_event "target_guard" "blocked" "$TARGET_STATE" "$FINAL_MESSAGE"
  finish 1
fi
record_event "target_guard" "ok" "$TARGET_STATE" "Target state evaluated for safe transfer"

if ! inspect_sync_decision "$SRC" "$TGT" "$CHAR_NAME"; then
  FINAL_STATUS="skipped"
  TRANSFER_STEP_STATUS="skipped"
  case "$LAST_SYNC_REASON" in
    source_unchanged)
      FINAL_MESSAGE="Source character is unchanged since the last verified sync"
      TRANSFER_DECISION="skip_unchanged"
      SAFE_RETRY_FROM="none"
      ;;
    target_played)
      FINAL_MESSAGE="Target character was played after the last verified sync"
      TRANSFER_DECISION="skip_played"
      BLOCKER_CODE="stale_conflicting_target_state"
      SAFE_RETRY_FROM="after_target_conflict_resolved"
      ;;
    *)
      FINAL_MESSAGE="Transfer is not required"
      TRANSFER_DECISION="skipped"
      ;;
  esac
  TARGET_STATE="$LAST_TARGET_STATE"
  record_event "decision" "skipped" "$LAST_SYNC_REASON" "$FINAL_MESSAGE"
  finish 0
fi

TARGET_STATE="$LAST_TARGET_STATE"
TRANSFER_DECISION="sync"
record_event "decision" "ok" "$LAST_SYNC_REASON" "Targeted request should perform a sync"

if $DRY_RUN; then
  FINAL_STATUS="dry_run"
  TRANSFER_STEP_STATUS="dry_run"
  FINAL_MESSAGE="Dry-run completed; request is ready for execution"
  SAFE_RETRY_FROM="rerun_request"
  record_event "dry_run" "ok" "ready" "$FINAL_MESSAGE"
  finish 0
fi

ORIGINAL_SRC_RUNNING=false
ORIGINAL_TGT_RUNNING=false
container_is_running "${CTR[${SRC}-srv]}" && ORIGINAL_SRC_RUNNING=true
container_is_running "${CTR[${TGT}-srv]}" && ORIGINAL_TGT_RUNNING=true

if ! $AUTO_RESTART && { $ORIGINAL_SRC_RUNNING || $ORIGINAL_TGT_RUNNING; }; then
  FINAL_STATUS="blocked"
  FINAL_MESSAGE="Source and target servers must already be stopped when --no-restart is used"
  TRANSFER_DECISION="blocked"
  BLOCKER_CODE="running_servers"
  SAFE_RETRY_FROM="after_runtime_stopped"
  record_event "runtime_guard" "blocked" "$BLOCKER_CODE" "$FINAL_MESSAGE"
  finish 1
fi

created_before="$TOTAL_CREATED"
if ! ensure_account "$SRC" "$TGT" "$ACCOUNT_USERNAME"; then
  FINAL_STATUS="failed"
  FINAL_MESSAGE="Failed to ensure target account"
  TRANSFER_DECISION="failed"
  SAFE_RETRY_FROM="rerun_request"
  record_event "ensure_account" "failed" "account_ensure_failed" "$FINAL_MESSAGE"
  finish 1
fi
if (( TOTAL_CREATED > created_before )); then
  ACCOUNT_CREATED=true
fi
record_event "ensure_account" "ok" "account_ready" "Target account is ready for transfer"

if $AUTO_RESTART; then
  if $ORIGINAL_TGT_RUNNING; then
    stop_server_if_running "${CTR[${TGT}-srv]}" "$TGT"
    TARGET_STOPPED_BY_RUNNER=true
  fi
  if $ORIGINAL_SRC_RUNNING; then
    stop_server_if_running "${CTR[${SRC}-srv]}" "$SRC"
    SOURCE_STOPPED_BY_RUNNER=true
  fi
  record_event "runtime_prepare" "ok" "servers_stopped" "Stopped source/target servers required for safe transfer"
fi

if ! sync_char "$SRC" "$TGT" "$CHAR_NAME"; then
  FINAL_STATUS="failed"
  TRANSFER_STEP_STATUS="failed"
  FINAL_MESSAGE="Transfer step did not complete successfully"
  TRANSFER_DECISION="failed"
  SAFE_RETRY_FROM="rerun_request"
  TARGET_STATE="$LAST_TARGET_STATE"
  record_event "transfer" "failed" "transfer_failed" "$FINAL_MESSAGE"
  finish 1
fi
TRANSFER_STEP_STATUS="success"
record_event "transfer" "ok" "synced" "Copied character data from ${SRC} to ${TGT}"

TARGET_GUID="$(db_exec "${CTR[${TGT}-db]}" -N -e "SELECT guid FROM ${CHARDB[$TGT]}.characters WHERE name='${CHAR_NAME}' LIMIT 1")"
if [[ -z "$TARGET_GUID" ]]; then
  FINAL_STATUS="failed"
  FINAL_MESSAGE="Target guid could not be resolved after transfer"
  TRANSFER_DECISION="failed"
  SAFE_RETRY_FROM="rerun_request"
  record_event "target_lookup" "failed" "target_guid_missing" "$FINAL_MESSAGE"
  finish 1
fi

if $AUTO_RESTART; then
  if ! $ORIGINAL_TGT_RUNNING; then
    start_server "$TGT"
    TGT_STARTED_FOR_VERIFY=true
  else
    start_server "$TGT"
  fi
  wait_for_server_ready "${CTR[${TGT}-srv]}" 180 || {
    FINAL_STATUS="failed"
    FINAL_MESSAGE="Target server did not start for verification"
    TRANSFER_DECISION="failed"
    SAFE_RETRY_FROM="after_runtime_restored"
    record_event "verify_prepare" "failed" "target_start_failed" "$FINAL_MESSAGE"
    finish 1
  }
  record_event "verify_prepare" "ok" "target_ready" "Started ${TGT} server for login verification"
fi

if verify_character_login_with_retry "$TGT" "$ACCOUNT_USERNAME" "$ACCOUNT_PASSWORD" "$TARGET_GUID" "$CHAR_NAME"; then
  VERIFY_STATUS="success"
  record_event "verify" "ok" "login_success" "Login bot verified the transferred ${TGT} character"
else
  VERIFY_STATUS="failed"
  rollback_character "$TGT" "$TARGET_GUID"
  FINAL_STATUS="failed"
  FINAL_MESSAGE="Login verification failed and the target character was rolled back"
  TRANSFER_DECISION="failed"
  SAFE_RETRY_FROM="rerun_request"
  record_event "verify" "failed" "login_failed" "$FINAL_MESSAGE"
  finish 1
fi

if store_verified_hash_after_login "$TGT" "$CHAR_NAME" "$SRC"; then
  HASH_STATUS="success"
  record_event "store_hash" "ok" "hash_stored" "Stored post-verify sync hash on ${TGT}"
else
  HASH_STATUS="failed"
  FINAL_STATUS="failed"
  FINAL_MESSAGE="Character verified successfully, but post-verify hash storage failed"
  TRANSFER_DECISION="failed"
  SAFE_RETRY_FROM="rerun_request"
  record_event "store_hash" "failed" "hash_store_failed" "$FINAL_MESSAGE"
  finish 1
fi

if $AUTO_RESTART; then
  restore_runtime_state
fi

FINAL_STATUS="success"
FINAL_MESSAGE="${SRC} -> ${TGT} targeted transfer completed successfully"
SAFE_RETRY_FROM="none"
record_event "request" "ok" "completed" "$FINAL_MESSAGE"
finish 0