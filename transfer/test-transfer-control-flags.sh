#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGETED_RUNNER="${SCRIPT_DIR}/targeted-transfer-runner.sh"
CHAIN_RUNNER="${SCRIPT_DIR}/chained-wotlk-transfer-runner.sh"
CONTROL_ROOT="$(mktemp -d)"
LOCK_ROOT="$(mktemp -d)"
TARGETED_DISABLED_JSON="$(mktemp)"
TARGETED_PAUSED_JSON="$(mktemp)"
CHAIN_EMERGENCY_JSON="$(mktemp)"

cleanup() {
  rm -rf "${CONTROL_ROOT}" "${LOCK_ROOT}"
  rm -f "${TARGETED_DISABLED_JSON}" "${TARGETED_PAUSED_JSON}" "${CHAIN_EMERGENCY_JSON}"
}

trap cleanup EXIT INT TERM

write_flag() {
  local flag_name="$1"
  local reason="$2"

  mkdir -p "${CONTROL_ROOT}"
  cat > "${CONTROL_ROOT}/${flag_name}" <<EOF
actor=test-harness
reason=${reason}
created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF
}

rm -rf "${CONTROL_ROOT}"/*
write_flag "self-service-transfer.disabled.flag" "maintenance"
TRANSFER_CONTROL_DIR="${CONTROL_ROOT}" TRANSFER_REQUEST_LOCK_DIR="${LOCK_ROOT}" \
  "${TARGETED_RUNNER}" --account SAMUEL --character Samuel --dry-run > "${TARGETED_DISABLED_JSON}" || true

rm -rf "${CONTROL_ROOT}"/*
write_flag "transfer-queue.paused.flag" "queue_pause"
TRANSFER_CONTROL_DIR="${CONTROL_ROOT}" TRANSFER_REQUEST_LOCK_DIR="${LOCK_ROOT}" \
  "${TARGETED_RUNNER}" --account SAMUEL --character Samuel --dry-run > "${TARGETED_PAUSED_JSON}" || true

rm -rf "${CONTROL_ROOT}"/*
write_flag "emergency-stop.flag" "incident_response"
TRANSFER_CONTROL_DIR="${CONTROL_ROOT}" TRANSFER_REQUEST_LOCK_DIR="${LOCK_ROOT}" \
  "${CHAIN_RUNNER}" --source classic --account SAMUEL --character Samuel --dry-run > "${CHAIN_EMERGENCY_JSON}" || true

python3 - "${TARGETED_DISABLED_JSON}" "${TARGETED_PAUSED_JSON}" "${CHAIN_EMERGENCY_JSON}" <<'PY'
import json
import sys

with open(sys.argv[1], 'r', encoding='utf-8') as handle:
    targeted_disabled = json.load(handle)
with open(sys.argv[2], 'r', encoding='utf-8') as handle:
    targeted_paused = json.load(handle)
with open(sys.argv[3], 'r', encoding='utf-8') as handle:
    chained_emergency = json.load(handle)

summary = {
    'operator_disabled': {
        'status': targeted_disabled.get('status'),
        'blocker_code': targeted_disabled.get('blocker_code'),
        'message': targeted_disabled.get('message'),
    },
    'queue_paused': {
        'status': targeted_paused.get('status'),
        'blocker_code': targeted_paused.get('blocker_code'),
        'message': targeted_paused.get('message'),
    },
    'emergency_stop': {
        'status': chained_emergency.get('status'),
        'blocker_code': chained_emergency.get('blocker_code'),
        'message': chained_emergency.get('message'),
    },
}

print(json.dumps(summary, ensure_ascii=True, indent=2))
PY