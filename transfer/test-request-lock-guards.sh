#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGETED_RUNNER="${SCRIPT_DIR}/targeted-transfer-runner.sh"
CHAIN_RUNNER="${SCRIPT_DIR}/chained-wotlk-transfer-runner.sh"
LOCK_ROOT="${SCRIPT_DIR}/runtime/request-locks"
ACTIVE_LOCK_KEY="transfer|scope=character|identity=runtime_account:SAMUEL|source_patch=classic|source_character_guid=1801"
IDEMPOTENCY_KEY="${ACTIVE_LOCK_KEY}|requested_target=tbc"
HOST_NAME="$(hostname -s 2>/dev/null || hostname 2>/dev/null || echo unknown)"

hash_key() {
  HASH_INPUT="$1" python3 - <<'PY'
import hashlib
import os

print(hashlib.sha256(os.environ["HASH_INPUT"].encode("utf-8")).hexdigest())
PY
}

write_lock_metadata() {
  local lock_dir="$1" request_id="$2" pid="$3" created_at_epoch="$4"

  mkdir -p "$lock_dir"
  cat > "${lock_dir}/metadata" <<EOF
version=task041-v1
active_lock_key=${ACTIVE_LOCK_KEY}
idempotency_key=${IDEMPOTENCY_KEY}
request_id=${request_id}
host=${HOST_NAME}
pid=${pid}
created_at_epoch=${created_at_epoch}
runner=fixture
source_patch=classic
requested_target=tbc
account_username=SAMUEL
character_guid=1801
character_name=Samuel
EOF
}

main() {
  local lock_hash lock_dir live_pid
  local targeted_json chain_json stale_json
  local targeted_file chain_file stale_file

  rm -rf "$LOCK_ROOT"
  mkdir -p "$LOCK_ROOT"

  lock_hash="$(hash_key "$ACTIVE_LOCK_KEY")"
  lock_dir="${LOCK_ROOT}/${lock_hash}.lock"
  targeted_file="$(mktemp)"
  chain_file="$(mktemp)"
  stale_file="$(mktemp)"

  sleep 30 >/dev/null 2>&1 &
  live_pid="$!"
  write_lock_metadata "$lock_dir" "live-targeted" "$live_pid" "$(date +%s)"
  "$TARGETED_RUNNER" --account SAMUEL --character Samuel --dry-run > "$targeted_file" || true
  kill "$live_pid" >/dev/null 2>&1 || true

  rm -rf "$lock_dir"
  sleep 30 >/dev/null 2>&1 &
  live_pid="$!"
  write_lock_metadata "$lock_dir" "live-chain" "$live_pid" "$(date +%s)"
  "$CHAIN_RUNNER" --source classic --account SAMUEL --character Samuel --dry-run > "$chain_file" || true
  kill "$live_pid" >/dev/null 2>&1 || true

  rm -rf "$lock_dir"
  write_lock_metadata "$lock_dir" "stale-fixture" "999999" "1"
  "$TARGETED_RUNNER" --account SAMUEL --character Samuel --dry-run > "$stale_file" || true

  python3 - "$targeted_file" "$chain_file" "$stale_file" <<'PY'
import json
import sys

with open(sys.argv[1], 'r', encoding='utf-8') as handle:
    targeted = json.load(handle)
with open(sys.argv[2], 'r', encoding='utf-8') as handle:
    chained = json.load(handle)
with open(sys.argv[3], 'r', encoding='utf-8') as handle:
    stale = json.load(handle)

summary = {
    'targeted_duplicate': {
        'status': targeted.get('status'),
        'blocker_code': targeted.get('blocker_code'),
        'lock_state': targeted.get('request_guard', {}).get('lock_state'),
        'existing_request_id': targeted.get('request_guard', {}).get('existing_request_id'),
    },
    'chained_duplicate': {
        'status': chained.get('status'),
        'blocker_code': chained.get('blocker_code'),
        'lock_state': chained.get('request_guard', {}).get('lock_state'),
        'existing_request_id': chained.get('request_guard', {}).get('existing_request_id'),
    },
    'stale_recovery': {
        'status': stale.get('status'),
        'lock_state': stale.get('request_guard', {}).get('lock_state'),
        'stale_lock_recovered': stale.get('request_guard', {}).get('stale_lock_recovered'),
    },
}

print(json.dumps(summary, ensure_ascii=True, indent=2))
PY

  rm -f "$targeted_file" "$chain_file" "$stale_file"
}

main "$@"