#!/usr/bin/env bash

[[ -n "${_REQUEST_LOCKS_SH_LOADED:-}" ]] && return 0
_REQUEST_LOCKS_SH_LOADED=1

REQUEST_LOCK_DIR="${TRANSFER_REQUEST_LOCK_DIR:-${SCRIPT_DIR}/runtime/request-locks}"
TRANSFER_CONTROL_DIR="${TRANSFER_CONTROL_DIR:-${SCRIPT_DIR}/runtime/control}"
REQUEST_LOCK_TTL_SECONDS="${TRANSFER_REQUEST_LOCK_TTL_SECONDS:-21600}"
REQUEST_LOCK_TEST_SLEEP_SECONDS="${TRANSFER_REQUEST_LOCK_TEST_SLEEP_SECONDS:-0}"

REQUEST_LOCK_STATE="not_acquired"
REQUEST_LOCK_ACQUIRED=false
REQUEST_LOCK_INHERITED=false
REQUEST_LOCK_STALE_RECOVERED=false
REQUEST_LOCK_ACTIVE_KEY=""
REQUEST_LOCK_IDEMPOTENCY_KEY=""
REQUEST_LOCK_SOURCE_PATCH=""
REQUEST_LOCK_REQUESTED_TARGET=""
REQUEST_LOCK_RUNNER=""
REQUEST_LOCK_PATH=""
REQUEST_LOCK_METADATA_FILE=""
REQUEST_LOCK_EXISTING_REQUEST_ID=""
REQUEST_LOCK_EXISTING_IDEMPOTENCY_KEY=""
REQUEST_LOCK_EXISTING_HOST=""
REQUEST_LOCK_EXISTING_PID=""
REQUEST_LOCK_EXISTING_CREATED_AT_EPOCH=""
TRANSFER_CONTROL_ACTIVE_FLAG=""
TRANSFER_CONTROL_ACTIVE_ACTOR=""
TRANSFER_CONTROL_ACTIVE_REASON=""
TRANSFER_CONTROL_ACTIVE_CREATED_AT=""

request_lock_hash() {
  HASH_INPUT="$1" python3 - <<'PY'
import hashlib
import os

print(hashlib.sha256(os.environ["HASH_INPUT"].encode("utf-8")).hexdigest())
PY
}

request_lock_host() {
  hostname -s 2>/dev/null || hostname 2>/dev/null || echo unknown
}

request_lock_reset_existing() {
  REQUEST_LOCK_EXISTING_REQUEST_ID=""
  REQUEST_LOCK_EXISTING_IDEMPOTENCY_KEY=""
  REQUEST_LOCK_EXISTING_HOST=""
  REQUEST_LOCK_EXISTING_PID=""
  REQUEST_LOCK_EXISTING_CREATED_AT_EPOCH=""
}

request_lock_export_context() {
  export TRANSFER_ACTIVE_LOCK_HELD=true
  export TRANSFER_ACTIVE_LOCK_KEY="$REQUEST_LOCK_ACTIVE_KEY"
  export TRANSFER_ACTIVE_LOCK_PATH="$REQUEST_LOCK_PATH"
}

request_lock_test_pause() {
  if [[ "$REQUEST_LOCK_TEST_SLEEP_SECONDS" =~ ^[0-9]+$ ]] && (( REQUEST_LOCK_TEST_SLEEP_SECONDS > 0 )); then
    sleep "$REQUEST_LOCK_TEST_SLEEP_SECONDS"
  fi
}

request_lock_write_metadata() {
  local created_at_epoch
  created_at_epoch="$(date +%s)"

  cat > "$REQUEST_LOCK_METADATA_FILE" <<EOF
version=task041-v1
active_lock_key=${REQUEST_LOCK_ACTIVE_KEY}
idempotency_key=${REQUEST_LOCK_IDEMPOTENCY_KEY}
request_id=${REQUEST_ID:-}
host=$(request_lock_host)
pid=$$
created_at_epoch=${created_at_epoch}
runner=${REQUEST_LOCK_RUNNER}
source_patch=${REQUEST_LOCK_SOURCE_PATCH}
requested_target=${REQUEST_LOCK_REQUESTED_TARGET}
account_username=${ACCOUNT_USERNAME:-}
character_guid=${CHAR_GUID:-}
character_name=${CHAR_NAME:-}
EOF
}

request_lock_load_metadata() {
  local metadata_file="$1"

  request_lock_reset_existing
  [[ -f "$metadata_file" ]] || return 1

  while IFS='=' read -r key value; do
    case "$key" in
      request_id)
        REQUEST_LOCK_EXISTING_REQUEST_ID="$value"
        ;;
      idempotency_key)
        REQUEST_LOCK_EXISTING_IDEMPOTENCY_KEY="$value"
        ;;
      host)
        REQUEST_LOCK_EXISTING_HOST="$value"
        ;;
      pid)
        REQUEST_LOCK_EXISTING_PID="$value"
        ;;
      created_at_epoch)
        REQUEST_LOCK_EXISTING_CREATED_AT_EPOCH="$value"
        ;;
    esac
  done < "$metadata_file"

  return 0
}

request_lock_is_stale() {
  local current_host now age
  current_host="$(request_lock_host)"
  now="$(date +%s)"

  if [[ -n "$REQUEST_LOCK_EXISTING_HOST" && "$REQUEST_LOCK_EXISTING_HOST" == "$current_host" ]]; then
    if [[ -n "$REQUEST_LOCK_EXISTING_PID" ]] && kill -0 "$REQUEST_LOCK_EXISTING_PID" 2>/dev/null; then
      return 1
    fi
    return 0
  fi

  if [[ -z "$REQUEST_LOCK_EXISTING_CREATED_AT_EPOCH" ]]; then
    return 1
  fi

  age=$(( now - REQUEST_LOCK_EXISTING_CREATED_AT_EPOCH ))
  if (( age >= REQUEST_LOCK_TTL_SECONDS )); then
    return 0
  fi

  return 1
}

request_lock_acquire() {
  local active_lock_key="$1" idempotency_key="$2" source_patch="$3" requested_target="$4" runner_name="$5"
  local lock_hash

  REQUEST_LOCK_ACTIVE_KEY="$active_lock_key"
  REQUEST_LOCK_IDEMPOTENCY_KEY="$idempotency_key"
  REQUEST_LOCK_SOURCE_PATCH="$source_patch"
  REQUEST_LOCK_REQUESTED_TARGET="$requested_target"
  REQUEST_LOCK_RUNNER="$runner_name"
  REQUEST_LOCK_STATE="not_acquired"
  REQUEST_LOCK_ACQUIRED=false
  REQUEST_LOCK_INHERITED=false
  REQUEST_LOCK_STALE_RECOVERED=false

  if [[ "${TRANSFER_ACTIVE_LOCK_HELD:-false}" == "true" && "${TRANSFER_ACTIVE_LOCK_KEY:-}" == "$REQUEST_LOCK_ACTIVE_KEY" ]]; then
    REQUEST_LOCK_STATE="inherited"
    REQUEST_LOCK_INHERITED=true
    REQUEST_LOCK_PATH="${TRANSFER_ACTIVE_LOCK_PATH:-}"
    REQUEST_LOCK_METADATA_FILE="${REQUEST_LOCK_PATH}/metadata"
    return 0
  fi

  mkdir -p "$REQUEST_LOCK_DIR"
  lock_hash="$(request_lock_hash "$REQUEST_LOCK_ACTIVE_KEY")"
  REQUEST_LOCK_PATH="${REQUEST_LOCK_DIR}/${lock_hash}.lock"
  REQUEST_LOCK_METADATA_FILE="${REQUEST_LOCK_PATH}/metadata"
  request_lock_reset_existing

  if mkdir "$REQUEST_LOCK_PATH" 2>/dev/null; then
    request_lock_write_metadata
    REQUEST_LOCK_STATE="acquired"
    REQUEST_LOCK_ACQUIRED=true
    request_lock_export_context
    request_lock_test_pause
    return 0
  fi

  request_lock_load_metadata "$REQUEST_LOCK_METADATA_FILE" || true
  if request_lock_is_stale; then
    rm -rf "$REQUEST_LOCK_PATH"
    if mkdir "$REQUEST_LOCK_PATH" 2>/dev/null; then
      request_lock_write_metadata
      REQUEST_LOCK_STATE="recovered_stale"
      REQUEST_LOCK_ACQUIRED=true
      REQUEST_LOCK_STALE_RECOVERED=true
      request_lock_export_context
      request_lock_test_pause
      return 0
    fi
    request_lock_load_metadata "$REQUEST_LOCK_METADATA_FILE" || true
  fi

  REQUEST_LOCK_STATE="duplicate_blocked"
  return 1
}

request_lock_release() {
  if $REQUEST_LOCK_ACQUIRED && [[ -n "$REQUEST_LOCK_PATH" ]]; then
    rm -rf "$REQUEST_LOCK_PATH"
  fi

  REQUEST_LOCK_ACQUIRED=false
  REQUEST_LOCK_INHERITED=false

  if [[ "${TRANSFER_ACTIVE_LOCK_PATH:-}" == "$REQUEST_LOCK_PATH" ]]; then
    unset TRANSFER_ACTIVE_LOCK_HELD
    unset TRANSFER_ACTIVE_LOCK_KEY
    unset TRANSFER_ACTIVE_LOCK_PATH
  fi
}

transfer_control_reset() {
  TRANSFER_CONTROL_ACTIVE_FLAG=""
  TRANSFER_CONTROL_ACTIVE_ACTOR=""
  TRANSFER_CONTROL_ACTIVE_REASON=""
  TRANSFER_CONTROL_ACTIVE_CREATED_AT=""
}

transfer_control_flag_path() {
  local flag_name="$1"
  printf '%s/%s\n' "$TRANSFER_CONTROL_DIR" "$flag_name"
}

transfer_control_load_metadata() {
  local metadata_file="$1"

  TRANSFER_CONTROL_ACTIVE_ACTOR=""
  TRANSFER_CONTROL_ACTIVE_REASON=""
  TRANSFER_CONTROL_ACTIVE_CREATED_AT=""
  [[ -f "$metadata_file" ]] || return 1

  while IFS='=' read -r key value; do
    case "$key" in
      actor)
        TRANSFER_CONTROL_ACTIVE_ACTOR="$value"
        ;;
      reason)
        TRANSFER_CONTROL_ACTIVE_REASON="$value"
        ;;
      created_at)
        TRANSFER_CONTROL_ACTIVE_CREATED_AT="$value"
        ;;
    esac
  done < "$metadata_file"

  return 0
}

transfer_control_active_flag() {
  local flag_name flag_path

  transfer_control_reset
  mkdir -p "$TRANSFER_CONTROL_DIR"
  for flag_name in emergency-stop.flag self-service-transfer.disabled.flag transfer-queue.paused.flag; do
    flag_path="$(transfer_control_flag_path "$flag_name")"
    if [[ -f "$flag_path" ]]; then
      TRANSFER_CONTROL_ACTIVE_FLAG="$flag_name"
      transfer_control_load_metadata "$flag_path" || true
      return 0
    fi
  done

  return 1
}

transfer_control_blocker_code() {
  case "$1" in
    self-service-transfer.disabled.flag)
      printf '%s\n' 'operator_disabled'
      ;;
    transfer-queue.paused.flag)
      printf '%s\n' 'queue_paused'
      ;;
    emergency-stop.flag)
      printf '%s\n' 'emergency_stop'
      ;;
    *)
      printf '%s\n' 'unknown'
      ;;
  esac
}

transfer_control_user_message() {
  case "$1" in
    self-service-transfer.disabled.flag)
      printf '%s\n' 'Self-service transfer is temporarily disabled by an operator'
      ;;
    transfer-queue.paused.flag)
      printf '%s\n' 'Transfer queue is paused by an operator'
      ;;
    emergency-stop.flag)
      printf '%s\n' 'Transfer execution is frozen because emergency-stop mode is active'
      ;;
    *)
      printf '%s\n' 'Transfer execution is currently restricted'
      ;;
  esac
}