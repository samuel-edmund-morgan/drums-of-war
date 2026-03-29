#!/usr/bin/env bash
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/daily-sync.sh"
source "${SCRIPT_DIR}/request-locks.sh"
STEP_RUNNER="${SCRIPT_DIR}/targeted-transfer-runner.sh"

REQUEST_ID=""
SOURCE_PATCH=""
ACCOUNT_USERNAME=""
ACCOUNT_PASSWORD=""
CHAR_NAME=""
CHAR_GUID=""
DRY_RUN=false
AUTO_RESTART=true
JSON_OUT=""
LOG_PATH=""
EVENTS_FILE=""
FINAL_STATUS="failed"
FINAL_MESSAGE=""
SAFE_RETRY_FROM="rerun_request"
BLOCKER_CODE=""
ACTIVE_LOCK_KEY=""
IDEMPOTENCY_KEY=""
SOURCE_ACCOUNT_ID=""
SOURCE_ONLINE=""
SOURCE_AT_LOGIN=""

STEP1_JSON=""
STEP2_JSON=""

usage() {
  cat <<'EOF'
Chained WotLK transfer runner

Usage:
  chained-wotlk-transfer-runner.sh --source classic|tbc --account USERNAME (--character NAME | --guid GUID) [options]

Options:
  --source PATCH       Current source patch: classic | tbc
  --account USERNAME   Source account username
  --password PASSWORD  Account password override for login verification
  --character NAME     Source character name
  --guid GUID          Source character guid
  --request-id ID      Caller-supplied logical request id
  --dry-run            Evaluate the chain without mutating runtime state
  --no-restart         Pass through to step runners; caller manages server state
  --json-out PATH      Also write the combined JSON payload to a file
  --help               Show this help

Notes:
  - classic origin always uses the chain classic -> tbc verify -> wotlk verify.
  - direct classic -> wotlk copy is intentionally not supported.
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

resolve_source_character() {
  local where_clause=""
  local src_ctr="${CTR[${SOURCE_PATCH}-db]}"
  local src_db="${CHARDB[$SOURCE_PATCH]}"
  local src_realm="${REALMDB[$SOURCE_PATCH]}"

  if [[ -n "$CHAR_GUID" ]]; then
    where_clause="c.guid=${CHAR_GUID}"
  else
    where_clause="c.name='${CHAR_NAME}'"
  fi

  db_exec "$src_ctr" -N -e "
    SELECT c.guid, c.name, c.online, c.at_login, c.account, a.username
    FROM ${src_db}.characters c
    JOIN ${src_realm}.account a ON a.id = c.account
    WHERE ${where_clause}
    LIMIT 1"
}

build_request_guard_keys() {
  ACTIVE_LOCK_KEY="transfer|scope=character|identity=runtime_account:${ACCOUNT_USERNAME}|source_patch=${SOURCE_PATCH}|source_character_guid=${CHAR_GUID}"
  IDEMPOTENCY_KEY="${ACTIVE_LOCK_KEY}|requested_target=wotlk"
}

json_get() {
  local json_file="$1" json_path="$2"
  JSON_FILE="$json_file" JSON_PATH="$json_path" python3 - <<'PY'
import json
import os

path = os.environ["JSON_PATH"].split(".")
with open(os.environ["JSON_FILE"], "r", encoding="utf-8") as handle:
    data = json.load(handle)

current = data
for part in path:
    current = current.get(part)

if current is None:
    print("")
elif isinstance(current, bool):
    print("true" if current else "false")
else:
    print(current)
PY
}

run_step() {
  local source="$1" target="$2" json_file="$3" label="$4"
  local step_request_id="${REQUEST_ID}"
  local current_char_name="$CHAR_NAME"
  local current_char_guid="$CHAR_GUID"
  local -a cmd=("${STEP_RUNNER}" "--source" "$source" "--target" "$target" "--account" "$ACCOUNT_USERNAME")

  if [[ -n "$step_request_id" ]]; then
    step_request_id="${step_request_id}:${label}"
    cmd+=("--request-id" "$step_request_id")
  fi

  if [[ -n "$ACCOUNT_PASSWORD" ]]; then
    cmd+=("--password" "$ACCOUNT_PASSWORD")
  fi

  if [[ -n "$current_char_name" ]]; then
    cmd+=("--character" "$current_char_name")
  else
    cmd+=("--guid" "$current_char_guid")
  fi

  if $DRY_RUN; then
    cmd+=("--dry-run")
  fi

  if ! $AUTO_RESTART; then
    cmd+=("--no-restart")
  fi

  cmd+=("--json-out" "$json_file")

  record_event "$label" "ok" "started" "Launching ${source} -> ${target} step"
  if "${cmd[@]}" >/dev/null; then
    record_event "$label" "ok" "completed" "${source} -> ${target} step returned JSON"
    return 0
  fi

  record_event "$label" "warn" "nonzero_exit" "${source} -> ${target} step returned a non-zero exit code"
  return 1
}

emit_json() {
  local tmp_json

  tmp_json=$(REQUEST_ID="$REQUEST_ID" \
    SOURCE_PATCH="$SOURCE_PATCH" \
    ACCOUNT_USERNAME="$ACCOUNT_USERNAME" \
    ACCOUNT_PASSWORD_SUPPLIED="$([[ -n "$ACCOUNT_PASSWORD" ]] && echo true || echo false)" \
    FINAL_STATUS="$FINAL_STATUS" \
    FINAL_MESSAGE="$FINAL_MESSAGE" \
    SAFE_RETRY_FROM="$SAFE_RETRY_FROM" \
    BLOCKER_CODE="$BLOCKER_CODE" \
    DRY_RUN="$DRY_RUN" \
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
    EVENTS_FILE="$EVENTS_FILE" \
    STEP1_JSON="$STEP1_JSON" \
    STEP2_JSON="$STEP2_JSON" \
    python3 - <<'PY'
import json
import os

def load(path):
  if path and os.path.exists(path) and os.path.getsize(path) > 0:
    with open(path, "r", encoding="utf-8") as handle:
      return json.load(handle)
    return None

def chain_step_result(step_payload, verify_name):
    if not step_payload:
        return None

    transfer_status = step_payload.get("steps", {}).get("transfer", "not_run")
    verify_status = step_payload.get("steps", {}).get("verify", "not_run")
    return transfer_status, verify_status

step1 = load(os.environ["STEP1_JSON"])
step2 = load(os.environ["STEP2_JSON"])

wrapper_events = []
events_file = os.environ["EVENTS_FILE"]
if os.path.exists(events_file):
    with open(events_file, "r", encoding="utf-8") as handle:
        for raw_line in handle:
            raw_line = raw_line.rstrip("\n")
            if not raw_line:
                continue
            ts, step, status, code, message = raw_line.split("\t", 4)
            wrapper_events.append({
                "timestamp": ts,
                "step": step,
                "status": status,
                "code": code,
                "message": message,
                "scope": "chain",
            })

events = list(wrapper_events)
for payload in (step1, step2):
    if payload:
        step_key = payload.get("step_key")
        for event in payload.get("events", []):
            event = dict(event)
            event["scope"] = step_key
            events.append(event)

events.sort(key=lambda item: item.get("timestamp", ""))

chain_mode = "tbc_direct" if os.environ["SOURCE_PATCH"] == "tbc" else "classic_via_tbc"
chain = ["tbc_to_wotlk", "wotlk_verify"] if chain_mode == "tbc_direct" else ["classic_to_tbc", "tbc_verify", "tbc_to_wotlk", "wotlk_verify"]

chain_steps = {}
if step1:
    transfer_status, verify_status = chain_step_result(step1, "tbc_verify")
    if step1.get("source") == "classic":
        if step1.get("transfer_decision") == "skip_unchanged":
            transfer_status = "already_synced"
        chain_steps["classic_to_tbc"] = {
            "status": transfer_status,
            "message": step1.get("message"),
            "retry_from": step1.get("safe_retry_from"),
            "target_state": step1.get("target_state"),
            "log_path": step1.get("log_path"),
        }
        chain_steps["tbc_verify"] = {
            "status": "already_verified" if step1.get("transfer_decision") == "skip_unchanged" and verify_status == "not_run" else verify_status,
            "message": step1.get("message") if verify_status == "not_run" else "TBC verification step result recorded",
            "retry_from": step1.get("safe_retry_from"),
            "log_path": step1.get("log_path"),
        }

if step2:
    transfer_status, verify_status = chain_step_result(step2, "wotlk_verify")
    chain_steps["tbc_to_wotlk"] = {
        "status": transfer_status,
        "message": step2.get("message"),
        "retry_from": step2.get("safe_retry_from"),
        "target_state": step2.get("target_state"),
        "log_path": step2.get("log_path"),
    }
    chain_steps["wotlk_verify"] = {
        "status": verify_status,
        "message": step2.get("message") if verify_status != "success" else "WotLK verification succeeded",
        "retry_from": step2.get("safe_retry_from"),
        "log_path": step2.get("log_path"),
    }

account = None
character = None
for payload in (step2, step1):
    if payload:
        account = payload.get("account")
        character = payload.get("character")
        if account and character:
            break

payload = {
    "request_id": os.environ["REQUEST_ID"] or None,
  "runner": "chained-wotlk-transfer-runner-v2",
    "request_type": "to_wotlk",
    "source_patch": os.environ["SOURCE_PATCH"],
    "requested_target": "wotlk",
    "chain_mode": chain_mode,
    "chain": chain,
    "dry_run": os.environ["DRY_RUN"] == "true",
    "status": os.environ["FINAL_STATUS"],
    "message": os.environ["FINAL_MESSAGE"],
    "safe_retry_from": os.environ["SAFE_RETRY_FROM"],
    "blocker_code": os.environ["BLOCKER_CODE"] or None,
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
    "account": account,
    "character": character,
    "chain_steps": chain_steps,
    "step_payloads": {
        "classic_to_tbc": step1 if step1 and step1.get("source") == "classic" else None,
        "tbc_to_wotlk": step2 if step2 else (step1 if step1 and step1.get("source") == "tbc" else None),
    },
    "events": events,
}

print(json.dumps(payload, ensure_ascii=True, indent=2))
PY
)

  if [[ -n "$JSON_OUT" ]]; then
    printf '%s\n' "$tmp_json" > "$JSON_OUT"
  fi

  printf '%s\n' "$tmp_json"
}

finish() {
  local exit_code="$1"
  emit_json
  request_lock_release
  rm -f "$EVENTS_FILE" "$STEP1_JSON" "$STEP2_JSON"
  exit "$exit_code"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)
      SOURCE_PATCH="$2"
      shift 2
      ;;
    --account)
      ACCOUNT_USERNAME="$2"
      shift 2
      ;;
    --password)
      ACCOUNT_PASSWORD="$2"
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

if [[ -z "$SOURCE_PATCH" || -z "$ACCOUNT_USERNAME" || ( -z "$CHAR_NAME" && -z "$CHAR_GUID" ) ]]; then
  usage >&2
  exit 1
fi

if [[ "$SOURCE_PATCH" != "classic" && "$SOURCE_PATCH" != "tbc" ]]; then
  echo "--source must be classic or tbc" >&2
  exit 1
fi

ACCOUNT_USERNAME="$(echo "$ACCOUNT_USERNAME" | tr '[:lower:]' '[:upper:]')"
if [[ -n "$ACCOUNT_PASSWORD" ]]; then
  ACCOUNT_PASSWORD="$(echo "$ACCOUNT_PASSWORD" | tr '[:lower:]' '[:upper:]')"
fi

mkdir -p "${SCRIPT_DIR}/logs"
LOG_PATH="${SCRIPT_DIR}/logs/chained-wotlk-transfer-$(date +%Y%m%d_%H%M%S)-${ACCOUNT_USERNAME}.log"
EVENTS_FILE="$(mktemp)"
STEP1_JSON="$(mktemp)"
STEP2_JSON="$(mktemp)"

record_event "request" "ok" "started" "Started chained to_wotlk runner"

if ! container_is_running "${CTR[${SOURCE_PATCH}-db]}"; then
  FINAL_STATUS="failed"
  FINAL_MESSAGE="Required DB container ${CTR[${SOURCE_PATCH}-db]} is not running"
  SAFE_RETRY_FROM="after_runtime_restored"
  BLOCKER_CODE="runner_failed"
  record_event "preflight" "failed" "db_container_unavailable" "$FINAL_MESSAGE"
  finish 1
fi

if transfer_control_active_flag; then
  FINAL_STATUS="blocked"
  FINAL_MESSAGE="$(transfer_control_user_message "$TRANSFER_CONTROL_ACTIVE_FLAG")"
  SAFE_RETRY_FROM="after_operator_recovery"
  BLOCKER_CODE="$(transfer_control_blocker_code "$TRANSFER_CONTROL_ACTIVE_FLAG")"
  record_event "control_guard" "blocked" "$BLOCKER_CODE" "$FINAL_MESSAGE"
  finish 1
fi

source_row="$(resolve_source_character)"
if [[ -z "$source_row" ]]; then
  FINAL_STATUS="blocked"
  FINAL_MESSAGE="Source character was not found on ${SOURCE_PATCH}"
  SAFE_RETRY_FROM="after_source_exists"
  BLOCKER_CODE="source_character_not_found"
  record_event "source_lookup" "blocked" "$BLOCKER_CODE" "$FINAL_MESSAGE"
  finish 1
fi

IFS=$'\t' read -r resolved_guid resolved_name SOURCE_ONLINE SOURCE_AT_LOGIN SOURCE_ACCOUNT_ID resolved_username <<< "$source_row"
CHAR_GUID="$resolved_guid"
CHAR_NAME="$resolved_name"

if [[ "$resolved_username" != "$ACCOUNT_USERNAME" ]]; then
  FINAL_STATUS="blocked"
  FINAL_MESSAGE="Source character does not belong to the requested account"
  SAFE_RETRY_FROM="none"
  BLOCKER_CODE="source_account_mismatch"
  record_event "source_lookup" "blocked" "$BLOCKER_CODE" "$FINAL_MESSAGE"
  finish 1
fi

if [[ "${SOURCE_ONLINE:-0}" != "0" ]]; then
  FINAL_STATUS="blocked"
  FINAL_MESSAGE="Source character is online and must log out first"
  SAFE_RETRY_FROM="after_source_logout"
  BLOCKER_CODE="source_online"
  record_event "source_guard" "blocked" "$BLOCKER_CODE" "$FINAL_MESSAGE"
  finish 1
fi

if [[ "${SOURCE_AT_LOGIN:-0}" != "0" ]]; then
  FINAL_STATUS="blocked"
  FINAL_MESSAGE="Source character has pending at_login flags and must clear them first"
  SAFE_RETRY_FROM="after_source_login_cleanup"
  BLOCKER_CODE="source_pending_login_flags"
  record_event "source_guard" "blocked" "$BLOCKER_CODE" "$FINAL_MESSAGE"
  finish 1
fi

record_event "source_lookup" "ok" "source_found" "Resolved source character ${CHAR_NAME} (guid=${CHAR_GUID})"
build_request_guard_keys
if ! request_lock_acquire "$ACTIVE_LOCK_KEY" "$IDEMPOTENCY_KEY" "$SOURCE_PATCH" "wotlk" "chained-wotlk-transfer-runner-v2"; then
  FINAL_STATUS="blocked"
  FINAL_MESSAGE="Another transfer request is already active for this character"
  SAFE_RETRY_FROM="wait_for_active_request"
  BLOCKER_CODE="duplicate_request"
  record_event "request_guard" "blocked" "$BLOCKER_CODE" "$FINAL_MESSAGE"
  finish 1
fi

if [[ "$REQUEST_LOCK_STATE" == "recovered_stale" ]]; then
  record_event "request_guard" "warn" "stale_lock_recovered" "Recovered a stale character-scoped transfer lock before continuing"
elif [[ "$REQUEST_LOCK_STATE" == "inherited" ]]; then
  record_event "request_guard" "ok" "lock_inherited" "Using the active request lock inherited from a parent runner"
else
  record_event "request_guard" "ok" "lock_acquired" "Acquired the character-scoped request lock"
fi

if [[ "$SOURCE_PATCH" == "tbc" ]]; then
  if run_step "tbc" "wotlk" "$STEP2_JSON" "tbc_to_wotlk"; then
    :
  fi

  FINAL_STATUS="$(json_get "$STEP2_JSON" status)"
  FINAL_MESSAGE="$(json_get "$STEP2_JSON" message)"
  SAFE_RETRY_FROM="$(json_get "$STEP2_JSON" safe_retry_from)"
  BLOCKER_CODE="$(json_get "$STEP2_JSON" blocker_code)"
  finish $([[ "$FINAL_STATUS" == "failed" || "$FINAL_STATUS" == "blocked" ]] && echo 1 || echo 0)
fi

if run_step "classic" "tbc" "$STEP1_JSON" "classic_to_tbc"; then
  :
fi

step1_status="$(json_get "$STEP1_JSON" status)"
step1_message="$(json_get "$STEP1_JSON" message)"
step1_retry="$(json_get "$STEP1_JSON" safe_retry_from)"
step1_blocker="$(json_get "$STEP1_JSON" blocker_code)"

if [[ "$step1_status" == "failed" || "$step1_status" == "blocked" ]]; then
  FINAL_STATUS="$step1_status"
  FINAL_MESSAGE="$step1_message"
  SAFE_RETRY_FROM="$step1_retry"
  BLOCKER_CODE="$step1_blocker"
  finish 1
fi

resolved_name="$(json_get "$STEP1_JSON" character.name)"
resolved_guid="$(json_get "$STEP1_JSON" character.guid)"
if [[ -n "$resolved_name" ]]; then
  CHAR_NAME="$resolved_name"
  CHAR_GUID=""
elif [[ -n "$resolved_guid" ]]; then
  CHAR_GUID="$resolved_guid"
fi

if run_step "tbc" "wotlk" "$STEP2_JSON" "tbc_to_wotlk"; then
  :
fi

step2_status="$(json_get "$STEP2_JSON" status)"
step2_message="$(json_get "$STEP2_JSON" message)"
step2_retry="$(json_get "$STEP2_JSON" safe_retry_from)"
step2_blocker="$(json_get "$STEP2_JSON" blocker_code)"

if $DRY_RUN; then
  FINAL_STATUS="$step2_status"
  FINAL_MESSAGE="$step2_message"
  SAFE_RETRY_FROM="$step2_retry"
  BLOCKER_CODE="$step2_blocker"
  finish $([[ "$FINAL_STATUS" == "failed" || "$FINAL_STATUS" == "blocked" ]] && echo 1 || echo 0)
fi

if [[ "$step2_status" == "failed" || "$step2_status" == "blocked" ]]; then
  FINAL_STATUS="partial"
  FINAL_MESSAGE="Classic -> TBC stage is available, but the WotLK stage did not complete"
  SAFE_RETRY_FROM="tbc_to_wotlk"
  BLOCKER_CODE="$step2_blocker"
  record_event "request" "warn" "partial_chain_failure" "$FINAL_MESSAGE"
  finish 1
fi

FINAL_STATUS="$step2_status"
FINAL_MESSAGE="$step2_message"
SAFE_RETRY_FROM="$step2_retry"
BLOCKER_CODE="$step2_blocker"
record_event "request" "ok" "completed" "Chained to_wotlk runner completed"
finish 0