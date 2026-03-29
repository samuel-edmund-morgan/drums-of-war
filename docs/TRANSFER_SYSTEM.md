# Система Трансферу Персонажів та Login Bot

> Мігрувано з legacy workflow `2026-03-14`.
> Усі локальні шляхи виду `transfer/...` нижче слід читати як шляхи відносно `localProjects/cmangos_projects/`.
> Remote runtime paths на `workspace` залишаються канонічними.

---

## 1. Огляд

Система дозволяє копіювати персонажів між серверами різних експансій (Classic ↔ TBC ↔ WotLK/AzerothCore). Оригінальний персонаж залишається на source. Підтримує як ручний, так і автоматичний (daily sync) режими.

### Pipeline Modes

`daily-sync.sh` підтримує два режими pipeline:

| Mode | Env var | Pipeline | Verified |
|---|---|---|---|
| ~~**4-step**~~ | ~~`SKIP_WOTLK=false`~~ | ~~Classic → TBC → WotLK (cmangos) → AzerothCore~~ | ~~2026-03-18~~ (cmangos-wotlk decommissioned) |
| **3-step** (default) | `SKIP_WOTLK=true` | Classic → TBC → AzerothCore | 2026-03-20 |

3-step mode використовує `migrate_cmangos_tbc_to_azerothcore.sql` для прямої міграції TBC→AzerothCore, минаючи cmangos-wotlk. Після `TASK-068` (decommission `2026-03-20`) 3-step є єдиним активним режимом.

Станом на `2026-03-20`:

- 3-step pipeline verified: Samuel (guid=1801) — SUCCESS на AzerothCore через login-bot.
- 4-step pipeline більше не доступний — cmangos-wotlk деактивовано (`TASK-068`). `SKIP_WOTLK=true` зафіксовано в systemd service.
- docs migration завершена;
- live runtime validation виконана;
- single-account, multi-account, class coverage і 3-run stability уже підтверджені;
- `TASK-009` already зафіксував schema mapping для `cmangos-wotlk -> AzerothCore`; canonical artifact = `docs/AZEROTHCORE_SCHEMA_MAPPING.md`.

### 1.1. Website Account Area Product Contract

Website feature-first track не створює окремий паралельний "новий кабінет" поза legacy IA. Канонічна точка входу для logged-in користувача лишається `account/manage`, а нові account features додаються як розширення цього area.

Canonical account-area structure:

- `account/manage` = базова account home / profile surface.
- `My Characters` = roster section або tab у logged-in account area.
- `Change Password` = authenticated account-management action у тому ж area.
- `Transfers` = character-centric actions поверх roster layer.
- Existing legacy surfaces `account/chartools` і `account/charcreate` лишаються окремими tools, але не підміняють собою roster/password/transfer contract.

Canonical user-facing transfer rules:

- Дозволені тільки forward moves.
- `Classic -> TBC` дозволено як одиночний transfer.
- `TBC -> WotLK` дозволено як одиночний transfer.
- `Classic -> WotLK` user-facing action дозволена тільки як послідовний chain через TBC.
- Rollback/down-migration або direct skip не входять у self-service scope.
- Reverse transfer deliberately stays out of product scope; current transfer contract is forward-only.

Canonical visibility rules:

- Користувач спочатку бачить roster своїх персонажів, а вже потім доступні transfer actions.
- `Change Password` має бути окремим явним entry point у logged-in account area.
- Status transfer request не можна ховати: queued/running/failed/completed/partial states мають бути видимими користувачу.

Canonical ownership rules:

- Website account може бачити й змінювати тільки ті characters/actions, які належать його cross-patch identity mapping.
- Shared session/cross-patch identity contract визначається окремо в backlog `TASK-036` і є blocker-ом для roster/transfer/password implementations, які мають діяти across patches.

### 1.2. Account Character Roster Data Contract

`TASK-046` закріплює перший canonical backend layer для `My Characters` без удавання, що cross-patch linked identity already exists in runtime.

Current implementation contract:

- Entry point: `mw_build_account_character_roster($account_id)` у `mangos-website/core/common.php`.
- Consumer-ready payload already готується в `components/account/account.manage.php` як `$account_character_roster` для наступного UI task `TASK-047`.
- Query strategy: один lookup по `realmlist + website_realm_settings`, далі окремий `characters` query у character DB кожного configured realm.
- Current identity mode = `legacy_account_id`: кожен realm bucket шукає `characters.account = current logged-in account.id`.
- Це не є повним linked-account contract. Якщо numeric `account.id` не означає ту саму людину на іншому patch, bucket повертається як `empty`, а не маскується фальшивим data merge.

Minimal roster fields per character:

- `patch`
- `patch_label`
- `realm_id`
- `realm_name`
- `guid`
- `name`
- `race`, `race_name`
- `class`, `class_name`
- `level`
- `online`, `online_state`
- `eligibility_status`

Canonical policy for edge cases:

- Empty patch: bucket status = `empty`, characters = `[]`.
- Duplicate names across patches: allowed; names are flagged in `summary.duplicate_names`.
- Stale or mismatched account mapping: current layer returns an empty bucket because principal is still `legacy_account_id`.
- Hidden or transfer-ineligible characters: current roster layer does not filter for transfer eligibility yet; it only returns owned rows from `characters`.
- Deleted characters: roster includes only rows that still exist in the source `characters` table.
- Partial realm outage: bucket status = `unavailable`, error = `character_db_unavailable`, and summary flag `partial_unavailable = true`.

Payload shape:

```php
array(
  'account_id' => 10,
  'identity_mode' => 'legacy_account_id',
  'fields' => array('patch', 'name', 'race', 'class', 'level', 'online'),
  'policy' => array(...),
  'summary' => array(
    'total_characters' => 3,
    'duplicate_names' => array('samuel'),
    'partial_unavailable' => false,
  ),
  'by_patch' => array(
    'classic' => array(
      'patch' => 'classic',
      'label' => 'Classic',
      'status' => 'ok',
      'realm_id' => 1,
      'realm_name' => 'Classic',
      'characters' => array(...),
      'error' => null,
    ),
    'tbc' => array(...),
    'wotlk' => array(...),
    'other' => array(),
  ),
  'flat' => array(...),
)
```

### 1.3. Character Eligibility Discovery Contract

`TASK-038` adds the first canonical eligibility/rules-engine layer on top of the roster payload. This layer does not yet submit transfer requests or mutate runtime state. Its job is narrower: given the currently logged-in website user, return which visible characters are actionable, which transfer actions are valid, and which blocking reasons are safe to show in UI.

Current implementation contract:

- Entry point: `mw_build_account_transfer_eligibility($account_id, $roster)` in `mangos-website/core/common.php`.
- Consumer-ready payload is prepared in `components/account/account.manage.php` as `$account_transfer_eligibility`.
- Identity mode remains `legacy_account_id`, inherited from the roster layer. This means transfer eligibility is still bounded by current patch-local account alignment and username-based target-account lookup.
- Allowed self-service flows remain:
  - `Classic -> TBC`
  - `TBC -> WotLK`
  - `Classic -> WotLK` only as sequential chain via `TBC`
- Non-applicable flows are not silently reinterpreted:
  - `WotLK -> anything` is not a self-service transfer action.
  - direct skip `Classic -> WotLK` is represented only as `to_wotlk` with an explicit chain through `TBC`, not as a direct target write.

Canonical source queries used by the current implementation:

- Character discovery on source patch:
  - `SELECT guid, account, name, race, class, level, online, at_login FROM characters WHERE account = :account_id ORDER BY level DESC, name ASC`
- Source account owner lookup:
  - `SELECT username FROM account WHERE id = :source_account_id LIMIT 1`
- Target account mapping lookup:
  - `SELECT id FROM account WHERE username = :source_username LIMIT 1`
- Target name-conflict lookup:
  - `SELECT guid, online, at_login FROM characters WHERE name = :character_name LIMIT 1`
- Target overwrite-safety lookup:
  - `SELECT sync_hash FROM character_sync_hash WHERE char_name = :character_name LIMIT 1`
  - plus the same `compute_char_hash()` formula already used by `daily-sync.sh`

Canonical normalized blocking rules:

- `source_online`: source character is online and must log out first.
- `source_pending_login_flags`: source character has non-zero `at_login` flags, so rename/customize/reset work is still pending.
- `missing_account_mapping`: source owner username could not be resolved or the same owner username does not exist on the target patch.
- `stale_conflicting_target_state`: target patch already has a same-name character, but it is online, untracked, or no longer matches the last stored safe sync hash.
- `target_patch_unavailable`: target patch or its auth/character DB wiring is unavailable to the website surface.

Canonical target state interpretation:

- `absent`: no same-name character exists on target patch; action may proceed if no other blockers exist.
- `safe_overwrite`: same-name target exists and its current hash still matches the stored `character_sync_hash` baseline.
- `played_conflict`: same-name target exists but its current hash diverges from the stored baseline.
- `untracked_conflict`: same-name target exists but no `character_sync_hash` baseline exists.
- `online_conflict`: same-name target exists and is currently online.
- `account_missing`: target auth DB has no mapped account row for the same owner username.

Mismatch cases that must stay truthful in UI:

- Empty roster buckets can still mean `legacy_account_id` mismatch, not true absence across patches.
- A visible source character can still be blocked by `missing_account_mapping` if the same owner username does not exist on the target patch.
- A same-name target character without `character_sync_hash` evidence must be shown as blocked, not guessed safe.

Payload shape:

```php
array(
  'account_id' => 10,
  'identity_mode' => 'legacy_account_id',
  'response_contract_version' => 'task038-v1',
  'allowed_flows' => array(
    'classic_to_tbc',
    'classic_to_wotlk_via_tbc',
    'tbc_to_wotlk',
  ),
  'source_queries' => array(...),
  'blocking_rules' => array(
    'source_online',
    'source_pending_login_flags',
    'missing_account_mapping',
    'stale_conflicting_target_state',
    'target_patch_unavailable',
  ),
  'summary' => array(
    'total_characters' => 3,
    'actionable_characters' => 2,
    'eligible_actions' => 3,
    'blocked_actions' => 1,
  ),
  'characters' => array(
    array(
      'patch' => 'classic',
      'guid' => 1801,
      'name' => 'Samuel',
      'source_account_username' => 'SAMUEL',
      'eligibility_status' => 'eligible',
      'allowed_actions' => array('to_tbc', 'to_wotlk'),
      'blocked_actions' => array(),
      'transfer_actions' => array(
        'to_tbc' => array(
          'status' => 'allowed',
          'chain' => array('classic_to_tbc', 'tbc_verify'),
          'targets' => array(
            'tbc' => array(
              'target_account_status' => 'mapped',
              'target_character_state' => 'absent',
              'blockers' => array(),
            ),
          ),
        ),
        'to_wotlk' => array(
          'status' => 'blocked',
          'chain' => array('classic_to_tbc', 'tbc_verify', 'tbc_to_wotlk', 'wotlk_verify'),
          'blockers' => array(
            array(
              'code' => 'stale_conflicting_target_state',
              'scope' => 'wotlk',
              'message' => 'Target patch already has a changed character with this name and cannot be overwritten safely.',
            ),
          ),
        ),
      ),
    ),
  ),
)
```

### 1.4. Authenticated Password-Change Contract

`TASK-053` defines the canonical password-change behavior for the logged-in website account area. This contract is intentionally stricter than the current legacy `action=changepass` implementation.

Current legacy reality:

- `components/account/account.manage.php?action=changepass` already exists.
- It currently accepts only `new_pass`, updates only the current local `account` row, clears `sessionkey/s/v`, writes a new `sha_pass_hash`, and optionally mirrors plaintext into `account_pass` when `use_purepass_table=1`.
- It does not verify the current password.
- It does not require confirmation input.
- It does not explicitly force a re-login after success.

Canonical contract going forward:

- Entry point stays inside logged-in `account/manage` as the dedicated `Change Password` capability from `DEC-023`.
- Request must require:
  - current password;
  - new password;
  - confirmation of new password.
- Server must reject the change unless the current password is verified against the authenticated principal.
- Success must invalidate the current website session and require explicit re-login.
- User-facing success/failure messaging must be explicit and non-ambiguous.

Canonical identity/update scope:

- Final ownership model remains the `website-scoped identity` defined by `DEC-024`.
- Intended update scope = all linked patch accounts that belong to the same website identity, not just the currently viewed patch-local `account.id`.
- Until linked-account mapping exists in code, the legacy implementation may only update the current local account row, but this is a transitional limitation, not the target contract.
- UI and release notes must not claim cross-patch password propagation until linked account updates are actually implemented and verified.

Canonical security rules:

- Current-password check is mandatory.
- New password and confirmation must match.
- Minimum password length must be stricter than the current `strlen > 3` legacy gate; the contract baseline is `>= 8` characters unless runtime auth constraints force a different documented minimum.
- New password must not equal current password.
- Rate-limit expectation: repeated failures must be treated as sensitive auth events and should be throttleable at application or edge level before public rollout is considered hardened.
- Plaintext password storage remains disallowed in the canonical contract. If `account_pass` compatibility remains enabled anywhere, that state must be treated as legacy debt, not desired end-state behavior.

Canonical user-facing outcomes:

- Success message: password updated, current session invalidated, user must sign in again.
- Failure message categories:
  - current password incorrect;
  - new password too short or invalid;
  - confirmation mismatch;
  - linked-account propagation incomplete or partially unavailable.
- Error states must not silently fall back to partial success messaging.

Audit/release expectations:

- Any implementation of this contract must record which auth rows were updated and whether the operation was local-only or linked-account-wide.
- Release evidence for `TASK-054` must include a real logged-in browser flow, post-change logout/re-login proof, and explicit statement of whether password change propagated to one patch account or all linked patch accounts.

### 1.4. Transfer Request Schema and Audit Trail Contract

`TASK-037` fixes the canonical persistent model for future self-service transfer work. Current code/docs already define roster visibility and transfer rules, but they do not yet provide one canonical request queue/history schema that the website UI, targeted runners, and operator tooling can share.

Canonical storage model:

- One mutable head row per transfer request lives in `transfer_requests`.
- One immutable append-only event stream per request lives in `transfer_request_events`.
- `transfer_requests` answers the question `what is the current state of this request right now?`.
- `transfer_request_events` answers the questions `what happened, in what order, who triggered it, and what is safe to show to the user?`.

Canonical `transfer_requests` fields:

- `id` bigint primary key.
- `request_uuid` char(36) or equivalent stable external identifier shown to users/operators.
- `website_identity_key` varchar: canonical website-scoped identity from `DEC-024`.
- `identity_mode` varchar: `website_identity` target state; transitional implementations may explicitly write `legacy_account_id`.
- `submitted_by_account_id` bigint nullable: current patch-local account row that created the request.
- `requested_target` enum-like varchar: `tbc` or `wotlk`.
- `request_type` varchar: `to_tbc` or `to_wotlk`.
- `source_patch` varchar: patch where the selected character currently lives when the request is created.
- `source_realm_id` int nullable.
- `source_account_id` bigint nullable.
- `source_character_guid` bigint.
- `source_character_name` varchar.
- `source_character_snapshot_json` text/json: minimal immutable snapshot for UI/audit (`name`, `race`, `class`, `level`, `source_patch`).
- `current_step` varchar: examples `queued`, `classic_to_tbc`, `tbc_verify`, `tbc_to_wotlk`, `wotlk_verify`, `completed`, `failed_partial`, `failed_terminal`.
- `current_source` varchar nullable.
- `current_target` varchar nullable.
- `status` varchar: canonical request head state `queued`, `running`, `completed`, `failed`, `partial`, `cancelled`, `blocked`.
- `user_visible_status` varchar: normalized UI-facing label derived from state machine, not raw script text.
- `retry_count` int default `0`.
- `last_error_code` varchar nullable.
- `last_error_summary` varchar nullable.
- `active_lock_key` varchar nullable: reserved integration point for `TASK-041` duplicate/in-flight guards.
- `idempotency_key` varchar: deterministic dedupe key for one logical user request.
- `requested_at`, `started_at`, `updated_at`, `finished_at` datetime fields.
- `requested_by_actor_type` varchar: `user` or `operator`.
- `requested_by_actor_id` varchar nullable.

Canonical `transfer_request_events` fields:

- `id` bigint primary key.
- `request_id` bigint foreign key to `transfer_requests.id`.
- `event_seq` int: monotonic order per request.
- `event_type` varchar: `request_created`, `step_queued`, `step_started`, `step_succeeded`, `step_failed`, `request_completed`, `request_failed`, `operator_retry`, `operator_cancel`, `user_refresh`, etc.
- `step_key` varchar nullable: examples `classic_to_tbc`, `tbc_verify`, `tbc_to_wotlk`, `wotlk_verify`.
- `from_status` varchar nullable.
- `to_status` varchar nullable.
- `source_patch` varchar nullable.
- `target_patch` varchar nullable.
- `attempt_no` int default `0`.
- `actor_type` varchar: `user`, `system`, or `operator`.
- `actor_id` varchar nullable.
- `visible_to_user` tinyint/bool: whether this event should appear in the account history UI.
- `user_message` varchar/text nullable: normalized safe text for website history/progress.
- `internal_message` text nullable: operator-facing note.
- `error_code` varchar nullable.
- `error_category` varchar nullable.
- `runner_host` varchar nullable.
- `runner_ref` varchar nullable: CLI invocation, job id, or script name.
- `payload_json` text/json nullable for structured details.
- `created_at` datetime.

Canonical idempotency / anti-duplicate contract:

- `idempotency_key` is deterministic over the logical request identity, not a random submit token.
- Minimum logical components:
  - `website_identity_key`
  - `source_patch`
  - `source_realm_id`
  - `source_character_guid`
  - `requested_target`
- Repeated submits for the same logical request while a request is in `queued` or `running` state must resolve to the existing active request, not create a new row.
- Historical completed/failed requests may reuse the same logical tuple only after the previous request reaches a terminal state; the durable duplicate-guard mechanics are implemented later in `TASK-041`.

`TASK-041` implementation decision:

- Active lock scope is `character`, not `account`: one source character may have only one in-flight request across all targets, so `to_tbc` and `to_wotlk` cannot race each other for the same source row.
- `active_lock_key` intentionally omits `requested_target`; it is the character-scoped mutex.
- `idempotency_key` extends the same base identity with `requested_target`; it is the logical-request dedupe key.
- Current runner-side lock key format is `transfer|scope=character|identity=runtime_account:USERNAME|source_patch=PATCH|source_character_guid=GUID`, with `|requested_target=TARGET` appended for `idempotency_key`.
- Current website-side lock key format uses the canonical website identity key instead of the runtime account username: `transfer|scope=character|identity=website_identity_key|source_patch=PATCH|source_realm_id=REALM|source_character_guid=GUID`.
- Lock state is surfaced explicitly as `request_guard.lock_state` in runner JSON and website eligibility payloads.
- Current normalized lock states:
  - `acquired`
  - `inherited`
  - `duplicate_blocked`
  - `recovered_stale`

Stale-lock recovery contract:

- Runtime locks live under `/opt/cmangos-transfer/runtime/request-locks`.
- Metadata stores `request_id`, `idempotency_key`, `host`, `pid`, `created_at_epoch`, and source identity.
- A lock is reclaimed when either:
  - the owning PID is no longer alive on the same host, or
  - the lock age exceeds `21600` seconds.
- Reclaimed locks are surfaced as `request_guard.lock_state = recovered_stale` plus `request_guard.stale_lock_recovered = true`.
- Crash cleanup does not rely only on best-effort trap execution; stale-lock recovery is the durable safety net.

Acceptance fixture for duplicate/stale scenarios:

- Entry point (local): `transfer/test-request-lock-guards.sh`
- Entry point (remote): `/opt/cmangos-transfer/test-request-lock-guards.sh`
- The harness creates:
  - a live-PID character lock fixture for the targeted runner,
  - a live-PID character lock fixture for the chained `to_wotlk` runner,
  - a stale lock fixture with dead PID metadata.
- Verified runtime result (`2026-03-16`):
  - targeted duplicate => `blocked / duplicate_request / duplicate_blocked`
  - chained duplicate => `blocked / duplicate_request / duplicate_blocked`
  - stale fixture => `skipped / recovered_stale / stale_lock_recovered=true`

Canonical chain/progress mapping:

- `to_tbc` request normal path:
  - `queued`
  - `classic_to_tbc`
  - `tbc_verify`
  - `completed` or `failed`
- `to_wotlk` request normal path from Classic:
  - `queued`
  - `classic_to_tbc`
  - `tbc_verify`
  - `tbc_to_wotlk`
  - `wotlk_verify`
  - `completed`, `partial`, or `failed`
- `to_wotlk` request normal path from TBC:
  - `queued`
  - `tbc_to_wotlk`
  - `wotlk_verify`
  - `completed` or `failed`
- `partial` means at least one earlier chain step succeeded and a later step failed; this state must remain visible to the user and operators.

Canonical error categories for UI and audit:

- `eligibility_blocked`
- `duplicate_request`
- `lock_timeout`
- `source_character_missing`
- `target_conflict`
- `runner_failed`
- `verify_failed`
- `partial_chain_failure`
- `operator_cancelled`
- `unknown`

User-visible history contract:

- History UI reads from `transfer_requests` for the current head state and from `transfer_request_events` for the ordered timeline.
- Raw shell traces, stack traces, SQL snippets, or PHP warnings are not shown directly to the user.
- `user_message` must be concise and stable enough to survive reload/poll cycles.
- Chain requests must show step granularity, not one opaque `processing` blob.

Canonical account-area layout for `TASK-043`:

- The logged-in account area exposes one `Active Transfer` panel when at least one request is in a non-terminal state (`queued`, `running`, `partial`, `blocked` waiting for user resolution, or `cancelled` not yet acknowledged).
- The same page exposes a separate `Transfer History` list for terminal requests, ordered newest-first by `requested_at` or `updated_at`.
- If no active request exists, the `Active Transfer` panel renders an explicit empty state rather than collapsing silently.
- If no historical requests exist yet, `Transfer History` renders a truthful empty state such as `No transfer requests have been recorded for this account yet.`
- The history list is request-centric, not event-centric: one visible row/card per request head, with an expandable or inline step timeline sourced from visible events.

Minimum visible fields on each request row/card:

- `request_uuid` or equivalent short external request reference.
- Source character snapshot: `name`, `class`, `level`, `source_patch`.
- Requested action label: `Transfer to TBC` or `Transfer to WotLK`.
- Current normalized status label from `user_visible_status`.
- Current step label or final outcome label.
- `requested_at` and last meaningful update timestamp.
- Latest safe `user_message`.
- For partial failures, explicit `safe_retry_from` or equivalent retry guidance when available.

Canonical progress labels:

- Head-level labels:
  - `Queued`
  - `Running`
  - `Completed`
  - `Partial`
  - `Failed`
  - `Blocked`
  - `Cancelled`
- Step-level labels:
  - `Classic -> TBC`
  - `TBC Verification`
  - `TBC -> WotLK`
  - `WotLK Verification`
- Already-satisfied step copy:
  - `Classic -> TBC already satisfied`
  - `TBC verification already satisfied`
- The UI may localize or restyle these labels, but it must preserve their meaning and step boundaries.

Canonical normalized error categories for user-facing history:

- `eligibility_blocked` => `Eligibility Blocked`
- `duplicate_request` => `Duplicate Request`
- `lock_timeout` => `Transfer Lock Timeout`
- `source_character_missing` => `Source Character Missing`
- `target_conflict` => `Target Conflict`
- `runner_failed` => `Transfer Runner Failed`
- `verify_failed` => `Verification Failed`
- `partial_chain_failure` => `Partial Chain Failure`
- `operator_cancelled` => `Cancelled by Operator`
- `unknown` => `Unknown Transfer Error`

Canonical safe user-message guidance:

- `Eligibility Blocked`: `This transfer cannot start until the current blocker is resolved.`
- `Duplicate Request`: `This transfer is already active. Refresh the page to follow the existing request.`
- `Target Conflict`: `A same-name character on the target patch cannot be overwritten safely.`
- `Verification Failed`: `The transfer step completed, but login verification did not succeed yet.`
- `Partial Chain Failure`: `Your TBC stage is available, but the WotLK stage is not complete yet.`
- `Cancelled by Operator`: `This transfer was stopped by an administrator before completion.`

Refresh contract:

- The history/progress contract must be correct on a plain page reload; live polling is optional and additive, not required for correctness.
- Manual refresh is the baseline contract until persistent request writers and read endpoints are fully live.
- Reloading or refreshing the page must not create or mutate requests by itself.
- If future polling is added, canonical cadence is low-frequency (`30-60` seconds) and only while a non-terminal request is visible.
- A future `user_refresh` event may be recorded for operator audit, but it must never change request semantics.

Canonical rendered examples:

- Success example:
  - head status = `Completed`
  - current step = `completed`
  - visible timeline = `Queued` -> `Classic -> TBC` -> `TBC Verification` -> `Completed`
  - final message = `Character transfer completed successfully.`
- Failure example:
  - head status = `Failed`
  - current step = `wotlk_verify`
  - visible timeline = `Queued` -> `TBC -> WotLK` -> `WotLK Verification` -> `Failed`
  - final message = `The transfer reached WotLK verification but did not complete successfully.`
- Partial example:
  - head status = `Partial`
  - current step = `failed_partial`
  - visible timeline = `Queued` -> `Classic -> TBC already satisfied` -> `TBC Verification already satisfied` -> `TBC -> WotLK` -> `WotLK Verification` -> `Partial`
  - final message = `Your TBC stage is available, but the WotLK stage is not complete yet.`

Retention policy:

- `transfer_request_events` are immutable and append-only; correction means adding a new event, not rewriting old ones.
- Completed/failed requests remain queryable for user history and operator audit; canonical policy is retention by default, not eager deletion.
- Large runner artifacts or raw logs may be rotated separately later, but the normalized request head and event metadata stay durable.

Implementation note for upcoming tasks:

- `TASK-038` consumes this schema contract to compute eligibility and normalized blocking reasons.
- `TASK-039` and `TASK-040` must write structured request/event rows instead of relying on ad hoc edits to `sync-accounts.conf` as the website-facing orchestration model.
- `TASK-043` consumes `transfer_requests` + `transfer_request_events` directly for user-facing progress/history.

### 1.4.1. Operator Controls and Kill-Switch Contract

`TASK-044` fixes the operator-side boundary for self-service transfer before any live admin UI exists. The contract is intentionally admin-only and lives below the website user surface.

Canonical operator-only action set:

- `inspect`: read current request head, visible event timeline, runtime lock metadata, and runner log references without mutating request state.
- `retry`: create a new operator-attributed retry attempt only after a request is terminal or explicitly marked retryable (`failed`, `partial`, or `blocked` with a known operator-resolution path).
- `cancel`: stop a request before the next execution step starts; canonical target states become `cancelled` head state plus `operator_cancel` event, not silent deletion.
- `pause`: prevent new self-service transfer execution from starting while preserving all current request/event data.
- `resume`: remove the pause condition and allow the normal queue/execution path to continue.
- `disable`: globally disable user-initiated self-service transfer entry points at the feature level.
- `emergency_stop`: highest-severity operator action used to freeze new work immediately and capture state before manual runtime intervention.

Canonical boundary between user actions and operator overrides:

- Users may only create their own requests, refresh/read their own status, and follow normalized retry guidance exposed by the product surface.
- Users may not force retries, cancel other requests, override blockers, clear locks manually, or bypass global pause/disable flags.
- Operators may inspect any request and apply `retry`, `cancel`, `pause`, `resume`, `disable`, or `emergency_stop` only through the canonical audit path.
- Operator overrides never rewrite existing events; they append new operator-attributed events and update the mutable request head accordingly.

Canonical global control flags:

- Runtime control root: `/opt/cmangos-transfer/runtime/control/`
- Global feature-disable flag: `/opt/cmangos-transfer/runtime/control/self-service-transfer.disabled.flag`
  - Meaning: website submit surfaces must stop accepting new self-service transfer requests and show truthful maintenance copy.
  - Existing request history remains visible.
  - Any future runtime start attempt returns a normalized `feature_disabled` / `operator_disabled` style blocked result rather than starting work.
- Queue-pause flag: `/opt/cmangos-transfer/runtime/control/transfer-queue.paused.flag`
  - Meaning: no new queued request may begin execution until the flag is removed.
  - Current request/event rows are preserved; the queue is paused, not deleted.
- Emergency-stop flag: `/opt/cmangos-transfer/runtime/control/emergency-stop.flag`
  - Meaning: operators are declaring runtime instability or incident response mode; no new execution or retry should begin until recovery is complete.

Canonical operator semantics for requests:

- `inspect` is read-only and does not mutate `transfer_requests`.
- `retry` must append `operator_retry` and increment `retry_count`; for partial Classic-origin chains the retry target must honor `safe_retry_from=tbc_to_wotlk` instead of restarting from Classic blindly.
- `cancel` is safe for `queued` or `blocked` requests. Cancelling an already-running request requires `emergency_stop` context and must be treated as an incident operation, not a routine action.
- `pause` affects queue start behavior, not historical visibility.
- `resume` removes only the pause condition; it must not silently clear an emergency stop or feature-disable flag.
- `disable` is broader than `pause`: it closes the self-service entry point for users, while operators can still inspect and perform controlled recovery work.

Emergency stop and recovery runbook contract:

- Step 1: create `emergency-stop.flag` with actor, reason, and timestamp before any manual runtime intervention.
- Step 2: if the incident is website-facing, also create `self-service-transfer.disabled.flag` so new user submits are blocked immediately and truthfully.
- Step 3: inspect active locks under `/opt/cmangos-transfer/runtime/request-locks/` and identify any in-flight runner PIDs/hosts from metadata before killing processes or clearing locks.
- Step 4: preserve evidence first: request head/event state, lock metadata, runner logs, and host/container health clues.
- Step 5: only after the runtime is understood may the operator clear stale locks, stop/restart affected services, or issue explicit operator cancel/retry decisions.
- Step 6: recovery ends by removing `emergency-stop.flag`, optionally removing `self-service-transfer.disabled.flag` or `transfer-queue.paused.flag` as appropriate, and appending operator recovery events rather than silently resuming.

Audit requirements for operator overrides:

- Every mutating operator action must append an immutable operator event with:
  - `event_type` (`operator_retry`, `operator_cancel`, `operator_pause`, `operator_resume`, `operator_disable`, `operator_enable`, `operator_emergency_stop`, `operator_recovery`)
  - `actor_type=operator`
  - stable operator identity in `actor_id`
  - timestamp
  - human reason in `internal_message`
  - safe external summary in `user_message` when the action affects user-visible status
  - before/after request status where applicable
  - host/runner reference when the action is tied to a specific runtime intervention
- Pure `inspect` actions may be logged in shell/access logs, but they must not mutate request history rows just to record a read.
- Operator overrides must never delete request heads, delete event rows, or clear audit history as a shortcut.
- Pause/disable/emergency-stop flag files themselves must contain the same minimum metadata: `actor`, `reason`, `created_at`, and optional incident/reference id.

### 1.5. Targeted Transfer Step Runner Contract

`TASK-039` adds the first request-scoped execution surface for the website transfer wave. `TASK-040` then extends the same surface so it can also execute the second canonical step pair used by `to_wotlk` chains. The runner intentionally reuses the verified transfer primitives from `daily-sync.sh` instead of creating a second independent transfer engine.

Current implementation contract:

- Entry point (local): `transfer/targeted-transfer-runner.sh`
- Entry point (remote): `/opt/cmangos-transfer/targeted-transfer-runner.sh`
- Supported step pairs only:
  - `classic -> tbc`
  - `tbc -> wotlk`
- The runner is non-interactive and takes the logical request identity directly from flags, not from ad hoc edits to `/opt/cmangos-transfer/sync-accounts.conf`.
- `daily-sync.sh` now exposes its pipeline as `daily_sync_main()` when executed directly, so the runner can safely source and reuse `inspect_sync_decision()`, `sync_char()`, `do_transfer_char()`, `verify_character_login_with_retry()`, `store_verified_hash_after_login()`, and `rollback_character()`.

CLI contract:

- Required:
  - `--source PATCH`
  - `--target PATCH`
  - `--account USERNAME`
  - one of `--character NAME` or `--guid GUID`
- Optional:
  - `--password PASSWORD` for explicit login-bot credentials
  - `--request-id ID` for caller-side logical request correlation
  - `--dry-run` to evaluate and emit JSON without runtime mutation
  - `--json-out PATH` to write the payload to a file in addition to stdout
  - `--no-restart` to require source/target servers already stopped

Credential contract:

- Password lookup is no longer part of request selection.
- If `--password` is supplied, the runner uses it directly for login-bot verification.
- If `--password` is omitted, the runner falls back to `/opt/cmangos-transfer/sync-accounts.conf` only as a credential source.
- Missing credentials are returned as a structured blocked result (`missing_account_password`), not as an implicit request to edit global config.

Execution contract:

- The runner resolves the requested source character from the explicit source patch and verifies it belongs to the requested account.
- It blocks early if the source character is online or has non-zero `at_login` flags.
- It inspects current target state before mutation:
  - `absent`
  - `safe_overwrite`
  - `online_conflict`
  - `played_conflict`
  - `untracked_conflict`
- It reuses the `character_sync_hash` logic from `daily-sync.sh` to distinguish:
  - `skip_unchanged`
  - `skip_played`
  - executable `sync`
- For real execution, it ensures the target account, performs the transfer, starts the target realm only as needed for verification, runs the login bot, stores the post-verify hash, and rolls back the target character if verify fails.

Machine-readable output contract:

- Stdout contains one JSON payload.
- Operational logs are written to a separate log file and returned as `log_path`.
- Current payload fields:
  - `request_id`
  - `runner`
  - `step_key`
  - `source`, `target`
  - `dry_run`
  - `status`
  - `message`
  - `transfer_decision`
  - `target_state`
  - `blocker_code`
  - `safe_retry_from`
  - `log_path`
  - `request_guard` object
  - `account` object
  - `character` object
  - `steps` object (`transfer`, `verify`, `store_hash`, `restore_runtime`)
  - ordered `events` array with timestamped step-level updates

`request_guard` fields:

- `scope = character`
- `active_lock_key`
- `idempotency_key`
- `lock_dir`
- `lock_state`
- `stale_lock_recovered`
- `existing_request_id`
- `existing_idempotency_key`
- `existing_host`
- `existing_pid`
- `stale_after_seconds`
- `duplicate_policy = reuse_active_request`

Current normalized top-level statuses:

- `dry_run`
- `success`
- `skipped`
- `blocked`
- `failed`

Current normalized transfer decisions:

- `sync`
- `skip_unchanged`
- `skip_played`
- `blocked`
- `failed`

Failure modes and safe retry points:

- `missing_account_password` -> `after_password_supplied`
- `source_character_not_found` -> `after_source_exists`
- `source_account_mismatch` -> `none`
- `source_online` -> `after_source_logout`
- `source_pending_login_flags` -> `after_source_login_cleanup`
- `stale_conflicting_target_state` with `online_conflict` -> `after_target_logout`
- `stale_conflicting_target_state` with `played_conflict` or `untracked_conflict` -> `after_target_conflict_resolved`
- runtime/container unavailable -> `after_runtime_restored`
- verify failure after transfer -> target row is rolled back, retry point = `rerun_request`
- post-verify hash write failure -> retry point = `rerun_request`

Dry-run example from live runtime (`2026-03-16`) for `classic -> tbc`:

```json
{
  "runner": "targeted-transfer-step-runner-v2",
  "step_key": "classic_to_tbc",
  "source": "classic",
  "target": "tbc",
  "dry_run": true,
  "status": "skipped",
  "message": "Source character is unchanged since the last verified sync",
  "transfer_decision": "skip_unchanged",
  "target_state": "unchanged",
  "safe_retry_from": "none",
  "account": {
    "username": "SAMUEL",
    "password_source": "sync_conf",
    "created_on_target": false,
    "source_account_id": 6
  },
  "character": {
    "guid": 1801,
    "name": "Samuel",
    "level": 60,
    "source_online": false,
    "source_at_login": 0,
    "target_guid": 1801
  }
}
```

### 1.6. Chained `to_wotlk` Runner Contract

`TASK-040` adds the first request-scoped orchestration surface for `Transfer to WotLK`. It does not introduce a direct Classic -> WotLK copy path. Instead, it composes the canonical step runner from Section 1.5.

Current implementation contract:

- Entry point (local): `transfer/chained-wotlk-transfer-runner.sh`
- Entry point (remote): `/opt/cmangos-transfer/chained-wotlk-transfer-runner.sh`
- Required CLI:
  - `--source classic|tbc`
  - `--account USERNAME`
  - one of `--character NAME` or `--guid GUID`
- Optional CLI:
  - `--password PASSWORD`
  - `--request-id ID`
  - `--dry-run`
  - `--json-out PATH`
  - `--no-restart`

Entry rules:

- If `--source classic`, the only legal execution path is:
  - `classic_to_tbc`
  - `tbc_verify`
  - `tbc_to_wotlk`
  - `wotlk_verify`
- If `--source tbc`, the only legal execution path is:
  - `tbc_to_wotlk`
  - `wotlk_verify`
- Direct `classic -> wotlk` is not exposed as a single step, even internally.

Top-level JSON contract:

- `request_type = to_wotlk`
- `source_patch`
- `requested_target = wotlk`
- `chain_mode = classic_via_tbc | tbc_direct`
- ordered `chain`
- top-level `status`, `message`, `safe_retry_from`, `blocker_code`, `log_path`
- top-level `request_guard`
- `account`, `character`
- `chain_steps` with separate step-level status objects
- `step_payloads` embedding the underlying step-runner payloads
- merged ordered `events` from the chain wrapper and each executed step

Current step-level status mapping:

- `classic_to_tbc`
  - `success`
  - `skipped`
  - `already_synced` when the Classic -> TBC baseline is already verified and unchanged
  - `blocked`
  - `failed`
- `tbc_verify`
  - `success`
  - `already_verified` when the previous TBC baseline was already sufficient and no new verify run was needed
  - `not_run`
  - `failed`
- `tbc_to_wotlk`
  - `success`
  - `skipped`
  - `blocked`
  - `failed`
- `wotlk_verify`
  - `success`
  - `not_run`
  - `failed`

Rollback and retry policy:

- If `classic_to_tbc` blocks or fails, the chain terminates with that status and there is no partial success.
- If `classic_to_tbc` succeeds or is already satisfied, but `tbc_to_wotlk` or `wotlk_verify` blocks/fails during a real run, top-level chain status becomes `partial`.
- For that partial case:
  - `safe_retry_from = tbc_to_wotlk`
  - user-visible meaning = `your TBC stage is available, but WotLK is not complete yet`
  - operator/runtime implication = next retry should treat the character as TBC-origin, not restart from Classic blindly.
- If the chain is only evaluated with `--dry-run`, no mutation occurs, so blocked/failure outcomes remain `blocked`/`failed`, not `partial`.

User-facing messaging contract:

- Chain progress must stay step-shaped, not one opaque `processing` status.
- For Classic-origin requests, UI/history can truthfully say:
  - `Classic -> TBC already satisfied`
  - `TBC verification already satisfied`
  - `TBC -> WotLK queued/running/skipped/failed`
  - `WotLK verification queued/running/failed/success`
- Partial success must remain visible rather than collapsed into generic failure text.

Live dry-run examples from runtime (`2026-03-16`):

- `--source classic --account SAMUEL --character Samuel --dry-run`
  - top-level `status = skipped`
  - `chain_mode = classic_via_tbc`
  - `classic_to_tbc = already_synced`
  - `tbc_verify = already_verified`
  - `tbc_to_wotlk = skipped`
  - `wotlk_verify = not_run`
- `--source tbc --account SAMUEL --character Samuel --dry-run`
  - top-level `status = skipped`
  - `chain_mode = tbc_direct`
  - `tbc_to_wotlk = skipped`
  - `wotlk_verify = not_run`

---

## 2. Компоненти

### 2.1. transfer-interactive.sh
- **Призначення:** Інтерактивний та CLI трансфер персонажів
- **Шлях (local):** `transfer/transfer-interactive.sh`
- **Шлях (remote):** `/opt/cmangos-transfer/transfer-interactive.sh`
- **Режими:**
  - Інтерактивний (без аргументів) — меню вибору source/target/персонажів
  - CLI: `--chars <список>`, `--all`, `--yes`, `--no-restart`, `--list <expansion>`

### 2.2. daily-sync.sh  
- **Призначення:** Автоматичний hash-based синк для всіх персонажів зі списку акаунтів
- **Шлях (remote):** `/opt/cmangos-transfer/daily-sync.sh`
- **Конфіг:** `/opt/cmangos-transfer/sync-accounts.conf` (формат `USERNAME:PASSWORD`)
- **Systemd timer:** `cmangos-daily-sync.timer` — 04:00 щодня
- **Live-verified state (`2026-03-14 20:46 EET`):** файл тепер містить єдиний запис `samuel:samuel`; рядок `ADMIN` прибрано. За кодом `daily-sync.sh` parser uppercases і username, і password, тому runtime фактично працює як `SAMUEL:SAMUEL`.

### 2.3. SQL Міграції
| Файл | Напрямок | Опис |
|---|---|---|
| `migrate_classic_to_tbc.sql` | Classic → TBC | DROP 5 honor cols, ADD 10 TBC cols, guild_bank tables |
| `migrate_tbc_to_wotlk.sql` | TBC → WotLK | ADD knownCurrencies, power6/7, specCount, activeSpec, dual spec |
| `migrate_classic_to_wotlk.sql` | Classic → WotLK (пряма) | Двофазна міграція через обидва SQL |

### 2.3A. Guild Transfer Boundary After `TASK-016`

Guild migration is not part of the canonical self-service or daily-sync product flow.

Current truthful contract:

- The current website/user-facing transfer contract remains character-scoped and forward-only.
- `daily-sync.sh`, `targeted-transfer-runner.sh`, and `chained-wotlk-transfer-runner.sh` do not orchestrate guild-level transfer semantics.
- Legacy operator script `transfer.sh` does contain a guild-copy branch: once selected characters map to one or more `guildid` values, it copies `guild`, `guild_member`, `guild_rank`, `guild_eventlog`, and then attempts `guild_bank_eventlog`, `guild_bank_item`, `guild_bank_right`, `guild_bank_tab` for the same guild set.

Documented limitations:

- This is a bulk guild side effect of the legacy transfer script, not an isolated guild migration workflow.
- Because the guild copy is keyed by `guildid`, one selected character can cause the whole guild membership/rank/event set to be copied from the temp DB snapshot.
- Classic has no `guild_bank_*` tables, so any Classic-involved guild move cannot truthfully promise bank preservation.
- TBC/WotLK bank tables are structurally compatible with the legacy script path, but they still belong to the operator-side bulk workflow rather than the verified self-service path.
- No current acceptance proof exists for safe guild transfer across the modern canonical runtime paths; therefore guild transfer must not be advertised as a verified user feature.

Canonical policy:

- Treat guild transfer as operator-only legacy functionality until a dedicated guild-level migration workflow, fixtures, and acceptance evidence exist.
- For Classic-origin moves, preserve only the core guild records (`guild`, `guild_member`, `guild_rank`, optionally `guild_eventlog`) and treat bank state as absent/reset by design.
- Do not extend current website transfer UI or request model to imply guild migration support.

### 2.3B. Shared Transfer Library Boundary After `TASK-019`

The old "full refactor to `lib.sh`" debt is now considered closed by current code state, not by a new large rewrite.

Current truthful contract:

- `daily-sync.sh` and `transfer-interactive.sh` both source `lib.sh`, which now owns the shared low-level transfer helper layer.
- The shared layer already covers the cross-script primitives that originally motivated the refactor: container/database maps, logging, DB execution and dump helpers, `safe_insert`, table existence checks, post-transfer character sanitization, login-bot verification, server wait/restart helpers, account creation helpers, and sync-hash storage helpers.
- `targeted-transfer-runner.sh` and `chained-wotlk-transfer-runner.sh` reuse that same shared layer indirectly by sourcing `daily-sync.sh` and `request-locks.sh` rather than re-implementing the DB/runtime primitives again.

Documented boundary:

- Script-local functions that remain in `daily-sync.sh`, `transfer-interactive.sh`, or the step runners are treated as orchestration-specific flow, request/JSON shaping, or interactive UX logic rather than unfinished low-level helper duplication.
- Future extraction into `lib.sh` should happen only when a new helper is duplicated across scripts in a way that materially increases maintenance risk.
- The project does not require a blanket "move almost everything into `lib.sh`" rewrite to treat the legacy debt as closed.

### 2.4. wow_login_test_universal.py (Universal Login Bot)
- **Призначення:** Автономне тестування логіну персонажа без WoW клієнта — **всі 3 експансії**
- **Шлях (local):** `transfer/wow_login_test_universal.py`
- **Шлях (remote):** `/opt/cmangos-transfer/wow_login_test_universal.py`
- **Підтримка:** Classic (1.12.1, build 5875), TBC (2.4.3, build 8606), WotLK (3.3.5a, build 12340)
- Детально описаний в [розділі 5](#5-login-test-bot)

### 2.4.1. wow_login_test.py (Legacy WotLK-only Login Bot)
- **Призначення:** Оригінальний WotLK-only login bot (deprecated, замінений universal)
- Детально описаний в [розділі 5](#5-login-test-bot)

### 2.5. srp6_set_password.py
- **Призначення:** Генерація SRP6 salt/verifier для паролів акаунтів
- **Використання:** `python3 srp6_set_password.py USERNAME PASSWORD`
- **Вихід:** SQL `UPDATE account SET v='...', s='...' WHERE username='USERNAME';`

---

## 3. Алгоритм Трансферу

### 3.1. Ключова функція: safe_insert()
```bash
safe_insert() {
    # 1. Запитує INFORMATION_SCHEMA.COLUMNS source та target таблиці
    # 2. Знаходить ПЕРЕТИН колонок (спільні для обох версій)
    # 3. Будує INSERT ... SELECT зі спільними колонками
    # 4. Null-safe: нові колонки в target отримують DEFAULT значення
}
```

### 3.2. Повний Flow (transfer-interactive.sh)

```
1. Зупинити source та target game-сервери (DB залишаються)
2. Для кожного вибраного персонажа:
   a. Створити temp DB (temp_transfer_TIMESTAMP)
   b. mariadb-dump characters з source → temp DB
   c. Виконати SQL міграцію схеми (ALTER TABLE, ADD/DROP columns)
   d. safe_insert() з temp DB у target characters DB
   e. DROP temp DB
3. Backup target characters DB
4. Перезапустити сервери
```

### 3.3. Daily Sync Flow (daily-sync.sh)

```
1. Зупинити ВСІ game-сервери
2. Для кожного акаунту в sync-accounts.conf:
   a. Auto-create на TBC/WotLK якщо відсутній (копія source SRP6 `s/v`, а не plain password з config)
   b. Для кожного персонажа:
      - Обчислити target `sync_hash` і source `source_hash` (MD5 ключових полів)
      - Якщо current target hash відрізняється від збереженого `sync_hash` → цільовий персонаж уже змінювався вручну, тому `SKIP`
      - Якщо current target hash збігається із `sync_hash`, а current source hash збігається із збереженим `source_hash` → персонаж не змінився з моменту останнього verified sync, тому `SKIP`
      - В інших випадках → source змінився, target safe-to-overwrite, тому `SYNC`
3. Classic→TBC transfer
4. TBC login verify / normalize
   - Перед rollback робиться один retry verify, щоб погасити observed startup false negatives одразу після restart
   - ЛИШЕ після `SUCCESS` перерахувати і зберегти на TBC обидва значення: target `sync_hash` і Classic `source_hash`
5. TBC→WotLK transfer
6. WotLK login verify / normalize
   - Перед rollback робиться один retry verify, якщо перша спроба неуспішна
   - ЛИШЕ після `SUCCESS` перерахувати і зберегти на WotLK обидва значення: target `sync_hash` і TBC `source_hash`
7. Перезапустити ВСІ сервери
```

### 3.4. Live-verified runtime snapshot (`2026-03-15`)

- `/opt/cmangos-transfer/` містить:
  - `daily-sync.sh`
  - `lib.sh`
  - `transfer-interactive.sh`
  - `transfer.sh`
  - `wow_login_test.py`
  - `wow_login_test_universal.py`
  - `srp6_set_password.py`
  - `migrate_classic_to_tbc.sql`
  - `migrate_tbc_to_wotlk.sql`
  - `migrate_classic_to_wotlk.sql`
  - `sync-accounts.conf`
- `cmangos-daily-sync.service` останній раз завершився `status=0/SUCCESS` о `2026-03-14 04:02:52 EET`
- `daily-sync-20260314.log` містить:
  - `Samuel (guid=1801)` verified on WotLK = `SUCCESS`
  - totals: `Accounts 2`, `Synced 2`, `Skipped 0`, `Errors 0`
- Active timers на remote:
  - `cmangos-update.timer`
  - `cmangos-tbc-update.timer`
  - `cmangos-wotlk-update.timer`
  - `cmangos-daily-sync.timer`
- `TASK-003` runtime prep (`2026-03-14 20:46 EET`):
  - `/opt/cmangos-transfer/sync-accounts.conf` = `samuel:samuel`
  - TBC/WotLK account `SAMUEL` отримав новий SRP6 verifier для пароля `samuel`
  - `tbccharacters.characters` = `0`, `wotlkcharacters.characters` = `0`
  - `character_sync_hash` для `Samuel` очищено на обох target DB
  - auth smoke на TBC/WotLK доходить до `CHAR_ENUM` і повертає `RESULT: NOT_FOUND` з `0 character(s)`
- `TASK-003` verified run (`2026-03-14 20:57 EET`):
  - `daily-sync.sh` summary: `Accounts 1`, `Synced 2`, `Skipped 0`, `Created 0`, `Errors 0`, `Duration 2m 55s`
  - TBC verify: `Samuel (guid=1801) — SUCCESS`
  - WotLK verify: `Samuel (guid=1801) — SUCCESS`
  - Post-run manual login bot:
    - TBC `SAMUEL/samuel`, `guid=1801` → `RESULT: SUCCESS`
    - WotLK `SAMUEL/samuel`, `guid=1801` → `RESULT: SUCCESS`
  - Post-run SQL:
    - TBC `guid=1801`, `account=10`, `at_login=0`, `online=0`
    - WotLK `guid=1801`, `account=12`, `at_login=0`, `online=0`
- `TASK-020` hash lifecycle fix (`2026-03-14 21:47 EET`):
  - `sync_char()` більше не зберігає hash одразу після transfer
  - Post-verify branches тепер логують:
    - `Stored post-verify hash for Samuel on tbc`
    - `Stored post-verify hash for Samuel on wotlk`
  - Verified repeat-run summary: `Accounts 1`, `Synced 2`, `Skipped 0`, `Created 0`, `Errors 0`, `Duration 3m 9s`
  - Post-run DB proof:
    - TBC `current_hash == stored_hash == c1f010444c5f03e65525fde700617e2b`
    - WotLK `current_hash == stored_hash == ccb7896f7283eeb6b948a4ce7a3372f0`
  - Важливо: fix не backfill-ить already-stale rows; у verified run для старих row було зроблено одноразовий manual realignment перед repeat-run.
- `TASK-004` clean multi-account coverage (`2026-03-14 22:26 EET`):
  - Використано тимчасовий config `/opt/cmangos-transfer/sync-accounts.task004.conf`:
    - `samuel:samuel`
    - `autoacc:autoacc`
    - `skipacc:skipacc`
  - `lib.sh` тепер інкрементує `TOTAL_CREATED` під час `ensure_account()`, тому summary чесно показує auto-created акаунти.
  - Clean rerun summary: `Accounts 3`, `Synced 4`, `Skipped 2`, `Created 2`, `Errors 0`, `Duration 3m 15s`
  - Auto-create path:
    - `AUTOACC` auto-created on TBC (`id=14`) і WotLK (`id=16`)
    - `Autolock (guid=1802)` verified `SUCCESS` on TBC and WotLK
    - Post-run DB: `Autolock` має `168 inventory`, `313 item_instance`; `current_hash == stored_hash` on both targets
  - Skip path:
    - `Skiplock (guid=1803)` логувався як `SKIP: ... was PLAYED` на TBC і WotLK
    - На clean fixture `Skiplock` тримається як lightweight stale-hash target (`0 inventory`, `0 item_instance`, `current_hash != deadbeef...`)
    - Manual login bot після run-а: `SKIPACC/SKIPACC`, `guid=1803` → `RESULT: SUCCESS` на TBC і WotLK
  - Важливий діагностичний висновок:
    - Первинний брудний run дав `WARN` only через synthetic fixture collision: target `Skiplock` і source `Autolock` мали однаковий набір item GUIDs.
    - Після cleanup `AUTOACC` target data та прибирання collision-prone item state у `Skiplock` clean rerun уже не містив `WARN:` у своєму лог-секшені.
- `TASK-005` class coverage (`2026-03-14 23:32 EET`):
  - Source fixture:
    - `CLASSACC` on Classic with `Testwar (guid=1804)` and `Testhunt (guid=1805)`
    - Початковий `Human Hunter` не проходив even Classic `CHAR_ENUM`; fixture вирівняно до `Dwarf Hunter (race=3,class=3)` і no-pet state `stable_slots=0`
  - Runtime fixes:
    - `daily-sync.sh` verify loop now retries once before rollback; this removed the reproducible first-login false negative on TBC after restart
    - `wow_login_test_universal.py` for WotLK now skips the 4-byte `customize flags` field in `SMSG_CHAR_ENUM`; pre-fix this caused false `NOT_FOUND` for the second character on multi-character WotLK accounts
  - Final isolated rerun with `/opt/cmangos-transfer/sync-accounts.task005.classacc-only.conf`:
    - Summary: `Accounts 1`, `Synced 4`, `Skipped 0`, `Created 0`, `Errors 0`, `Duration 3m 53s`
    - TBC verify: `Testwar` = `SUCCESS`, `Testhunt` = `SUCCESS`
    - WotLK verify: `Testwar` = `SUCCESS`, `Testhunt` = `SUCCESS`
  - Canonical restore run with `/opt/cmangos-transfer/sync-accounts.conf`:
    - Summary: `Accounts 1`, `Synced 2`, `Skipped 0`, `Created 0`, `Errors 0`, `Duration 3m 29s`
    - `Samuel (guid=1801)` restored on TBC and re-verified on both TBC and WotLK
  - Final sequential manual smokes:
    - `SAMUEL/SAMUEL`, `guid=1801` → `SUCCESS` on TBC and WotLK
    - `CLASSACC/CLASSACC`, `guid=1804` → `SUCCESS` on TBC and WotLK
    - `CLASSACC/CLASSACC`, `guid=1805` → `SUCCESS` on TBC and WotLK
- `TASK-006` 3-run stability (`2026-03-15 00:03 EET`):
  - До fix-a виявлено design gap: current code вмів only `SKIP if played`, але не вмів `SKIP if unchanged`, хоча це вимагав legacy Phase 15.4.
  - Runtime/schema fix:
    - `character_sync_hash` auto-migrates schema and now stores both `sync_hash` and `source_hash`
    - `sync_char()` now distinguishes:
      - `PLAYED on target` → `current_hash != sync_hash` → `SKIP`
      - `UNCHANGED since last verified sync` → `current_hash == sync_hash` and `current_source_hash == source_hash` → `SKIP`
      - `SOURCE CHANGED` → sync again
    - Remote backups before deploy:
      - `/opt/cmangos-transfer/backups/daily-sync.sh.pre_task006_sourcehash_20260314_235026`
      - `/opt/cmangos-transfer/backups/lib.sh.pre_task006_sourcehash_20260314_235026`
  - Isolated fixture config: `/opt/cmangos-transfer/sync-accounts.task006.conf` with `classacc:classacc`
  - `Run 1`:
    - Summary: `Accounts 1`, `Synced 4`, `Skipped 0`, `Created 0`, `Errors 0`, `Duration 4m 1s`
    - Because pre-existing rows lacked `source_hash`, log showed `No stored source hash — refreshing baseline`
    - Post-run TBC/WotLK schema includes `source_hash`; for `Testwar` and `Testhunt`, `sync_hash == source_hash == de24036ebbf88879d126441f62539b4d`
  - `Run 2` without any Classic changes:
    - Summary: `Accounts 1`, `Synced 0`, `Skipped 4`, `Created 0`, `Errors 0`, `Duration 2m 14s`
    - Both transfer phases logged:
      - `SKIP: 'Testwar' unchanged since last verified sync`
      - `SKIP: 'Testhunt' unchanged since last verified sync`
    - Since no pipeline verify runs on skipped chars, post-run manual smokes were executed sequentially:
      - TBC/WotLK `CLASSACC`, `guid=1804` → `RESULT: SUCCESS`
      - TBC/WotLK `CLASSACC`, `guid=1805` → `RESULT: SUCCESS`
  - `Run 3` after Classic mutation:
    - Backup before mutation: `/opt/cmangos-classic/backups/classiccharacters.testwar.pre_task006_run3_20260314_235852.sql`
    - Classic `Testwar.money` changed `0 → 12345`; Classic hash changed `de24036ebbf88879d126441f62539b4d → 297325587b3f1494baf0797de760d134`
    - Summary: `Accounts 1`, `Synced 2`, `Skipped 2`, `Created 0`, `Errors 0`, `Duration 3m 6s`
    - Phase A and C both behaved as expected: `Testwar` synced, `Testhunt` skipped
    - TBC/WotLK pipeline verify for `Testwar` returned `SUCCESS`; no rollback or manual recovery was needed
    - Final SQL:
      - Classic/TBC/WotLK `Testwar.money=12345`
      - TBC/WotLK `Testwar`: `at_login=0`, `online=0`, `sync_hash == source_hash == 297325587b3f1494baf0797de760d134`
      - TBC/WotLK `Testhunt`: `money=0`, `at_login=0`, `online=0`, `sync_hash == source_hash == de24036ebbf88879d126441f62539b4d`
    - Final skipped-char smoke after `Run 3`: TBC/WotLK `CLASSACC`, `guid=1805` → `RESULT: SUCCESS`

---

## 4. Різниці Схем Між Експансіями

### characters таблиця:

| Поле | Classic | TBC | WotLK | Примітки |
|---|---|---|---|---|
| stored_honorPoints | ✅ | ❌ DROP | ❌ | Honor system redesign |
| stored_dishonorPoints | ✅ | ❌ DROP | ❌ | |
| stored_honorableKills | ✅ | ❌ DROP | ❌ | |
| stored_rankChanges | ✅ | ❌ DROP | ❌ | |
| stored_highestRank | ✅ | ❌ DROP | ❌ | |
| arenaPoints | ❌ | ✅ ADD | ✅ | Arena system |
| totalHonorPoints | ❌ | ✅ ADD | ✅ | New honor |
| todayHonorPoints | ❌ | ✅ ADD | ✅ | |
| yesterdayHonorPoints | ❌ | ✅ ADD | ✅ | |
| totalKills | ❌ | ✅ ADD | ✅ | |
| todayKills | ❌ | ✅ ADD | ✅ | |
| yesterdayKills | ❌ | ✅ ADD | ✅ | |
| chosenTitle | ❌ | ✅ ADD | ✅ | |
| knownTitles | ❌ | ✅ ADD | ✅ | |
| knownCurrencies | ❌ | ❌ | ✅ ADD | WotLK currencies |
| power6 | ❌ | ❌ | ✅ ADD | Runic power |
| power7 | ❌ | ❌ | ✅ ADD | |
| specCount | ❌ | ❌ | ✅ ADD | Dual spec |
| activeSpec | ❌ | ❌ | ✅ ADD | Dual spec |

### Expansion-specific таблиці:

**Classic-only:** `character_forgotten_skills`, `character_honor_cp`

**TBC-only (vs Classic):** `arena_team`, `arena_team_member`, `arena_team_stats`, `character_declinedname`, `guild_bank_eventlog`, `guild_bank_item`, `guild_bank_right`, `guild_bank_tab`, `guild_eventlog`, `pet_aura`, `character_battleground_data`, `item_text`

**WotLK-only (vs TBC):** `calendar_events`, `calendar_invites`, `character_achievement`, `character_achievement_progress`, `character_equipmentsets`, `character_glyphs`, `character_talent`

### Інші різниці:
- `character_action`: WotLK додає `spec` колонку (dual spec)
- `character_pet`: WotLK видаляє `loyalty`, `loyaltypoints` (loyalty system removed)
- `item_instance`: WotLK змінює `itemTextId`→`text`, додає `playedTime`
- `mail`: WotLK змінює `itemTextId`→`body`

## 4A. Phase 16.2 — AzerothCore Schema Mapping

`TASK-009` закрив planning-level comparison між live CMaNGOS WotLK schema і official AzerothCore base SQL.

Verified summary:

- `wotlkcharacters` vs `acore_characters`:
  - `78` CMaNGOS tables
  - `106` AzerothCore tables
  - `59` same-name shared tables
- `wotlkrealmd` vs `acore_auth`:
  - `13` CMaNGOS tables
  - `18` AzerothCore tables
  - `6` same-name shared tables
- Current `transfer.sh` table-set:
  - `45` relevant pipeline tables
  - `43` already exist in AzerothCore with the same table name
  - `1` explicit rename: `character_tutorial -> account_tutorial`
  - `1` missing target table: `character_battleground_data`

Практичний висновок для майбутнього AzerothCore step:

- `safe_insert()` лишається корисним для більшості same-name tables.
- Але для `TASK-010` потрібен explicit transform layer поверх `safe_insert()` щонайменше для:
  - `account` + `account_access`
  - `characters`
  - `character_homebind`
  - `character_spell`
  - `character_talent`
  - `character_glyphs`
  - `character_queststatus` + `character_queststatus_rewarded`
  - `character_aura`
  - `pet_aura`
  - `guild_member` + `guild_member_withdraw`

Канонічний повний mapping, rename map і blocker list див. в [`AZEROTHCORE_SCHEMA_MAPPING.md`](AZEROTHCORE_SCHEMA_MAPPING.md).

## 4B. Phase 16.3 — AzerothCore Migration SQL

`TASK-010` створив перший executable skeleton: `transfer/migrate_cmangos_wotlk_to_azerothcore.sql`.

Ключові властивості цього file:

- Script розрахований на той самий temp-DB workflow, що й існуючі `migrate_*.sql`:
  - dump source characters DB у temp schema;
  - прогнати migration SQL всередині temp DB;
  - далі переносити в pre-existing AzerothCore characters DB через `safe_insert()`.
- Це свідомо **не** full database replace path:
  - AzerothCore target-only tables мають жити у канонічній target schema;
  - legacy `transfer.sh` full-replace branch не можна reuse для AzerothCore без окремої адаптації.
- Уже реалізовані explicit transforms для:
  - `characters`
  - `character_homebind`
  - `character_spell`
  - `character_glyphs`
  - `character_queststatus` + `character_queststatus_rewarded`
  - `character_aura`
  - `pet_aura`
  - `guild_member` + `guild_member_withdraw`
  - `corpse`
  - `character_tutorial -> account_tutorial`
- Current MVP policies:
  - `character_talent` поки не мапиться в learned spell ids і лишається reset-on-login blocker;
  - `character_battleground_data` свідомо дропається, бо direct target table немає;
  - auth/account path винесено в documented staged contract у footer SQL file, а не змішано з characters migration.
- Local validation для `TASK-010` була stronger than review-only:
  - read-only `mariadb-dump --no-data wotlkcharacters` з `workspace`
  - локальна throwaway `mariadb:11`
  - successful import source schema + successful execution migration SQL + post-run presence of expected transformed tables

## 4C. Phase 16.4 — AzerothCore Login Bot Support

`TASK-011` закрив local runtime і protocol smoke для AzerothCore.

Ключові verified facts:

- Official prebuilt `acore/*` images на цьому ARM64 host не дають придатного manifest; verified baseline = local build path з full `azerothcore-wotlk` checkout.
- Local stack піднято через `docker-azerothcore/docker-compose.yml`; verified ready state:
  - `azerothcore-authserver` на `3727`
  - `azerothcore-worldserver` на `8088`
  - `azerothcore-db` на `3309`
  - `azerothcore-db-import` і `azerothcore-client-data-init` завершуються `0`
- `wow_login_test_universal.py` тепер має окремий `--expansion azerothcore` alias з local defaults `3727/8088`.
- AzerothCore auth/world handshake виявився WotLK-сумісним, але з однією critical detail:
  - `AUTH_SESSION` мусить нести фактичний `realm_id`, який повернув auth realmlist;
  - hardcoded `realm_id=0` дає `Auth response error: 0x27`.
- Для current empty-realm smoke acceptance виглядає так:
  - `Auth proof: OK`
  - `Auth response: OK`
  - `Sent CHAR_ENUM`
  - `0 character(s)`
  - `RESULT: NOT_FOUND`
- У world log після smoke можливий `Addon packet read error`; станом на `TASK-011` це non-blocking noise, а не failed gate.
- Auth staging contract теж тепер verified live:
  - source `s` -> target `salt` через `REVERSE(UNHEX(LPAD(s, 64, '0')))`
  - source `v` -> target `verifier` через `REVERSE(UNHEX(LPAD(v, 64, '0')))`
  - direct raw `UNHEX(...)` для `s/v` не проходить AzerothCore SRP6 auth proof

## 4D. Phase 16.5 — AzerothCore Daily-Sync Integration

`TASK-012` закрив code-level інтеграцію AzerothCore у `daily-sync.sh` і `lib.sh`, але full character E2E лишив у `TASK-013`.

Ключові verified facts:

- `daily-sync.sh` тепер детектить локальний AzerothCore runtime через `azerothcore-db`, `azerothcore-authserver`, `azerothcore-worldserver`.
  - Якщо всі три контейнери існують, script вмикає optional Phase E/F.
  - Якщо ні, current verified 3-step pipeline (`Classic -> TBC -> WotLK`) лишається без зміни.
- `migration_sql_for_pair()` зараз має два explicit mappings:
  - `wotlk -> azerothcore` => `transfer/migrate_cmangos_wotlk_to_azerothcore.sql`
  - `tbc -> azerothcore` => `transfer/migrate_cmangos_tbc_to_azerothcore.sql` (додано TASK-069, 2026-03-20)
- `do_transfer_char()` для AzerothCore path тепер:
  - імпортує source dump у temp DB;
  - виконує migration SQL на temp DB до `safe_insert()`;
  - remap-ить `account_tutorial.accountId` з source account id на target account id.
- `lib.sh` тепер має AzerothCore-aware runtime/database contract:
  - `db_exec()` / `db_dump()` використовують `mysql` / `mysqldump` для `azerothcore-db`, а не `mariadb` / `mariadb-dump`;
  - container/db maps покривають `acore_auth`, `acore_characters`, `acore_world`;
  - `start_server()` і `restart_after_crash()` працюють з парою `azerothcore-authserver` + `azerothcore-worldserver`.
- `ensure_account()` тепер уміє schema-aware staging у `acore_auth.account` + `acore_auth.account_access`:
  - переносить `s/v` у `salt/verifier` через verified byte-reversed mapping;
  - піднімає `expansion` щонайменше до `2`;
  - переносить `failed_logins`, `mutetime`, `flags`, `locale`, `os`, `last_ip`;
  - створює `account_access` з `RealmID=-1`, якщо source `gmlevel > 0`.
- Під час live validation знайдено і виправлено важливий drift:
  - попередній tab-based parsing source account row ламався на порожньому `sessionkey`;
  - це зсувало `joindate`, `lockedIp`, `os`, `flags` у неправильні колонки;
  - тепер row серіалізується через явний non-whitespace delimiter, тому порожній `sessionkey` більше не руйнує мапінг.

Focused local proof від `2026-03-15`:

- Створено synthetic source auth container `task012-wotlk-db` з account `TASK012ACC / task012acc`.
- `ensure_account wotlk azerothcore TASK012ACC` успішно створив row в `acore_auth.account`.
- `HEX(REVERSE(salt))` і `HEX(REVERSE(verifier))` на target точно збіглися з source `s/v`.
- `account_access` створився як `gmlevel=3`, `RealmID=-1`.
- `wow_login_test_universal.py --expansion azerothcore --username TASK012ACC --password task012acc --guid 1`
  дійшов до:
  - `Auth proof: OK`
  - `Auth response: OK`
  - `Sent CHAR_ENUM`
  - `RESULT: NOT_FOUND`

Scope limit після `TASK-012`:

- Повний `WotLK -> AzerothCore` character migration на non-empty realm ще не verified.
- Поточний доказ покриває code path, schema-aware auth staging і empty-realm login smoke, але не справжній post-migration player login.

Live closure від `2026-03-17` (`TASK-013`):

- `workspace` тепер має truthful single-host topology: CMaNGOS Classic/TBC/WotLK plus live AzerothCore runtime in `/opt/docker-azerothcore`.
- Для live host були потрібні ще чотири runtime fixes поверх `TASK-012` local proof:
  - `lib.sh` now auto-loads `DOCKER_DB_ROOT_PASSWORD` from AzerothCore compose env files when the shell does not already export `AZEROTHCORE_DB_PASSWORD`.
  - `wait_for_server_ready()` now treats AzerothCore `WORLD: World Initialized` / `ready...` lines as ready-state, rather than only the exact legacy `World initialized` casing.
  - `daily-sync.sh` now rewrites MariaDB `utf8mb3_uca1400_ai_ci` / `utf8mb4_uca1400_ai_ci` dump collations before importing WotLK temp data into MySQL-backed `azerothcore-db`.
  - `migrate_cmangos_wotlk_to_azerothcore.sql` now uses MySQL-safe dynamic conditional ALTER helpers instead of MariaDB-only `ADD COLUMN IF NOT EXISTS` / `DROP COLUMN IF EXISTS` syntax in the `characters` transform section.
- Live remote verify also required deploying the current `wow_login_test_universal.py` to `workspace`, because the previous remote copy still lacked `--expansion azerothcore` support and caused false Phase F failures even after successful migration/auth staging.
- Canonical live E2E proof log: `workspace:/opt/cmangos-transfer/logs/daily-sync-task013-forceclean-20260317_231158.log`
  - `Samuel` synced `classic -> tbc`, verified `SUCCESS`, and stored post-verify hash on `tbc`.
  - `Samuel` synced `tbc -> wotlk`, verified `SUCCESS`, and stored post-verify hash on `wotlk`.
  - `Samuel` synced `wotlk -> azerothcore`, verified `SUCCESS`, and stored post-verify hash on `azerothcore`.
  - Final forced-clean summary = `Synced: 3`, `Errors: 0`, `Rolled back: 0` on all verify phases.

## 5. Login Test Bot (wow_login_test_universal.py)

### 5.1. Призначення
Підключається як WoW клієнт до серверу будь-якої експансії (Classic/TBC/WotLK) або до локального AzerothCore WotLK runtime, проходить автентифікацію, запитує список персонажів, логіниться конкретним персонажем і визначає результат — успішний вхід чи креш серверу.

### 5.2. Використання

```bash
# Classic source account state in current runtime (build 5875)
python3 wow_login_test_universal.py --expansion classic --username SAMUEL --password TEST123 --guid 1801

# TBC target verify after `TASK-003` (build 8606)
python3 wow_login_test_universal.py --expansion tbc --username SAMUEL --password samuel --guid 1801

# WotLK target verify after `TASK-003` (build 12340)
python3 wow_login_test_universal.py --expansion wotlk --username SAMUEL --password samuel --guid 1801

# AzerothCore local smoke after `TASK-011`
python3 wow_login_test_universal.py --expansion azerothcore --username ACBOT --password acbot --guid 1
```

**Запуск на remote:**
```bash
ssh -o ControlPath=/tmp/ssh-ws workspace \
    'python3 /opt/cmangos-transfer/wow_login_test_universal.py --expansion tbc --username SAMUEL --password samuel --guid 1801'
```

Поточний verified target GUID після `TASK-003` на TBC і WotLK: `1801`.

### 5.2A. Hash Verification After `TASK-020`

Після login verify hash тепер має збігатися з поточним станом target DB.

```bash
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker exec cmangos-tbc-db mariadb -u root -p"$DB_PASSWORD" tbccharacters -N -e "SELECT MD5(CONCAT_WS(\"|\", c.level, c.xp, c.money, c.totaltime, (SELECT COUNT(*) FROM item_instance WHERE owner_guid = c.guid), (SELECT COUNT(*) FROM character_spell WHERE guid = c.guid), (SELECT COUNT(*) FROM character_queststatus WHERE guid = c.guid))) AS current_hash, (SELECT sync_hash FROM character_sync_hash WHERE char_name=\"Samuel\" LIMIT 1) AS stored_hash FROM characters c WHERE c.name=\"Samuel\" LIMIT 1;"'
```

Очікування для healthy post-verify state: `current_hash == stored_hash`.

### 5.2B. AzerothCore Smoke After `TASK-011`

- `--expansion azerothcore` використовує local defaults `auth=3727`, `world=8088`, `build=12340`.
- Existing `--expansion wotlk` також valid проти AzerothCore, якщо явно передати `--auth-port 3727 --world-port 8088`.
- Current acceptance для порожнього AzerothCore realm:
  - auth proof success
  - world auth success
  - `CHAR_ENUM` success
  - фінальний `RESULT: NOT_FOUND`
- Це valid smoke саме для порожнього realm; повний player login буде окремим gate після реальної character migration.

### 5.3. Вихідні Коди
| Код | Результат | Опис |
|---|---|---|
| 0 | SUCCESS | Персонаж успішно увійшов до world |
| 1 | CRASH | Сервер крешнув (connection lost) |
| 1 | FAILED | Сервер відхилив логін (CHARACTER_LOGIN_FAILED) |
| 1 | TIMEOUT | Сервер не відповів протягом 20 секунд |
| 1 | NOT_FOUND | GUID не знайдено в списку персонажів |
| 1 | ERROR | Помилка протоколу або з'єднання |

### 5.4. Протокол Реалізації

**Різниці між експансіями:**

| Параметр | Classic (5875) | TBC (8606) | WotLK (12340) |
|---|---|---|---|
| Auth proof success | 26B | 32B | 32B |
| Realm list count | uint8 | uint16 | uint16 |
| Realm type field | uint32 | uint8+uint8+uint8 | uint8+uint8+uint8 |
| AUTH_CHALLENGE payload | 4B (seed only) | 4B (seed only) | 40B (unk+seed+seeds) |
| CMSG_AUTH_SESSION | build+unk2+account+clientSeed+digest+addon | same as Classic | +loginServerType,regionId,battleGroupId,realmId,dosResponse |
| WorldCrypt | VanillaCrypt: XOR з raw session key (40B) | TbcCrypt: XOR з HMAC-SHA1 derived key (20B) | WotlkCrypt: HMAC-SHA1+ARC4+drop1024 |
| Char enum extra flags | none | none | `customize flags` 4B after `charFlags` |
| Char enum equip | 20 × 5B | 20 × 9B | 23 × 9B |

**TBC HMAC seed:** `0x38A78315F8922530719867B18C04E2AA` (16 bytes)
- `key = HMAC-SHA1(seed, session_key)` → 20 bytes, потім XOR як Classic

**WotLK HMAC seeds:**
- ServerEncrypt: `0xCC98AE04E897EACA12DDC09342915357`
- ServerDecrypt: `0xC2B3723CC6AED9B5343C53EE2F4367CE`
```

Для AzerothCore `TASK-011` live-підтвердив, що wire-level settings тут збігаються з WotLK колонкою вище; додатковий requirement лише один: у `AUTH_SESSION` треба відправляти реальний `realm_id` з realmlist.

### 5.5. Критичні Деталі Реалізації

1. **ARC4 шифрування** — чистий Python (без openssl), 1024-byte drop після init
2. **Серверний пакет header** — може бути 4 або 5 байт (large packet flag 0x80 на першому байті)
3. **Addon data** — ОБОВ'ЯЗКОВО включати `uint32 decompressed_size` перед zlib блоком, 4 fingerprint аддони
4. **Шифрування починається** ВІДРАЗУ після відправки CMSG_AUTH_SESSION (до отримання відповіді)
5. **Digest calculation** — SHA1(username_ascii + uint32(0) + uint32(clientSeed) + uint32(serverSeed) + sessionKey_40bytes)
6. **WotLK CHAR_ENUM parser** — після `charFlags` є додаткові 4 байти `customize flags`; якщо їх не пропустити, multi-character accounts дають хибний `NOT_FOUND` для другого персонажа
7. **Operational smoke discipline** — ручні login bot перевірки для одного й того ж realm/account робити послідовно, не паралельно, інакше можна отримати self-inflicted timeout noise
8. **AzerothCore realm id** — для AzerothCore/WotLK-compatible runtime `realm_id` не можна хардкодити в `0`; бот має взяти його з `realmlist`, інакше world auth відповідає `0x27`
9. **Empty AzerothCore realm semantics** — для локального Phase 16 smoke `RESULT: NOT_FOUND` після `AUTH_OK` + `CHAR_ENUM` є expected success path, а не protocol failure

### 5.6. Залежності
- Чистий Python 3.6+ (socket, struct, hashlib, hmac, zlib)
- Без зовнішніх пакетів

---

## 6. Креш при TBC→WotLK Трансфері — ВИРІШЕНО

### 6.1. Проблема (ВИРІШЕНА)
При логіні персонажа з money > 0, перенесеного на WotLK, сервер крешив з `MANGOS_ASSERT(m_currMap)` в `Object.h:1084`.

### 6.2. Коренева Причина
**Баг в CMaNGOS WotLK `Player::LoadFromDB()`:**

Порядок виконання в `LoadFromDB()` (Player.cpp):
1. Рядок 16380: `m_achievementMgr.LoadFromDB()` — завантажує achievement progress
2. Рядок 16387: `SetMoney(money)` — **ДО SetMap()!**
3. Рядок 16571: `SetMap(...)` — тільки тут `m_currMap` стає != NULL

WotLK `SetMoney()` (Player.h:1645-1649) має виклик, якого НЕМАЄ в Classic/TBC:
```cpp
void SetMoney(uint32 value) {
    SetUInt32Value(PLAYER_FIELD_COINAGE, value);
    MoneyChanged(value);
    UpdateAchievementCriteria(ACHIEVEMENT_CRITERIA_TYPE_HIGHEST_GOLD_VALUE_OWNED); // <-- WotLK only!
}
```

Ланцюжок крешу:
```
SetMoney(money > 0)
  → UpdateAchievementCriteria(type=86)
    → AchievementMgr::SetCriteriaProgress()
      → criteria NOT in m_criteriaProgress AND changeValue > 0
        → GetPlayer()->GetMap()->GetCurrentClockTime()
          → MANGOS_ASSERT(m_currMap)  // m_currMap is NULL!
          → CRASH
```

Якщо money = 0: `SetCriteriaProgress` робить `if (changeValue == 0) return;` → **NO CRASH**
Якщо criteria progress ВЖЕ ІСНУЄ: `else` гілка без `GetMap()` → **NO CRASH**

### 6.3. Виправлення (Data-Level Workaround)
Pre-insert запис в `character_achievement_progress` після трансферу:
```sql
INSERT INTO character_achievement_progress (guid, criteria, counter, date, failed)
VALUES (<guid>, 4224, <money>, UNIX_TIMESTAMP(), 0)
ON DUPLICATE KEY UPDATE counter = GREATEST(counter, VALUES(counter));
```

- **Criteria 4224** = `ACHIEVEMENT_CRITERIA_TYPE_HIGHEST_GOLD_VALUE_OWNED` (type 86) з Achievement_Criteria.dbc
- Counter = money value, щоб `PROGRESS_HIGHEST` не тригерив `CompletedAchievement` (який теж викликає `GetMap()`)

### 6.4. Інтеграція
- `transfer-interactive.sh` → `fix_char_after_transfer()` секція 8 (автоматично при трансфері на WotLK)
- `migrate_tbc_to_wotlk.sql` — bulk INSERT для всіх characters з money > 0
- `migrate_classic_to_wotlk.sql` — аналогічно

### 6.5. Верифікація
- ✅ money=37903267 + criteria pre-insert → LOGIN SUCCESS
- ✅ Повний трансфер TBC→WotLK → LOGIN SUCCESS
- ✅ Повний пайплайн Classic→TBC→WotLK → SUCCESS на всіх серверах

---

## 6A. Transfer Fidelity — збереження спелів, скілів, PVP титулів

### 6A.1. Проблема: RESET_SPELLS знищував всі спели
`at_login | 6` включав біт `RESET_SPELLS` (2) — сервер при першому логіні знищував ВСІ заучені спели і залишав лише базові класові (~9-10 замість 392).

**Виправлення:** `at_login | 4` (тільки RESET_TALENTS). Невалідні спели видаляються через Section 6 (валідація по spell_template).

### 6A.2. PVP Honor Migration (Classic → TBC/WotLK) — Section 9
Classic зберігає PVP ранг в `honor_highest_rank` (0-18). TBC/WotLK використовують `knownTitles` bitfield.

CharTitles.dbc bit_index маппінг:
- **Alliance** (races 1,3,4,7,11): bit_index 1–14 (Private → Grand Marshal)
- **Horde** (races 2,5,6,8,10): bit_index 15–28 (Scout → High Warlord)
- Формула: `visual_rank = honor_highest_rank - 4` (ranks 5-18 = PVP 1-14)
- Приклад: honor_highest_rank=18 → visual_rank=14 → всі біти 1-14 → knownTitles[0]=32766

Також мігрує `stored_honorable_kills` → `totalKills`.

### 6A.3. Верифікація
| Classic | TBC | WotLK (після логіну) |
|---|---|---|
| 392 спелі | 392 спелі | 371 спелі (таланти скинуті) |
| 18 скілів | 18 скілів | 18 скілів |
| honor_rank=18 | knownTitles=32766 | knownTitles=32766 |
| 362 kills | totalKills=362 | totalKills=362 |

---

## 7. RA Console (Remote Admin)

### 7.1. Підключення
```bash
# Через docker exec до контейнера:
docker exec cmangos-wotlk-server bash -c '
exec 3<>/dev/tcp/127.0.0.1/3443
read -t 2 banner <&3
echo "ADMIN" >&3
read -t 2 r1 <&3
echo "TEST123" >&3
read -t 5 r2 <&3
echo "COMMAND_HERE" >&3
read -t 5 result <&3
echo "$result"
exec 3>&-'
```

### 7.2. Доступні GM Команди
```
character level <name> <level>     # Встановити рівень
send money <name> "subj" "text" <amount>  # Надіслати золото
send items <name> "subj" "text" <itemId:count> [itemId:count...]
pdump write <filename> <charname>   # Dump персонажа
pdump load <filename> <accountId> [charname]  # Load dump
.reset talents <name>               # Скинути таланти
lookup spell <name>                 # Знайти spell ID
```

### 7.3. Автентифікація
SRP6 з акаунтом ADMIN (gm level 3). Пароль встановлюється через `srp6_set_password.py`.

---

## 8. Утиліти (transfer/ директорія)

### Тестові/Дослідницькі Скрипти
| Файл | Опис |
|---|---|
| `test_all_numerics.sh` | Тест всіх числових полів character row |
| `test_baseline_verify.sh` | Верифікація baseline (clean Testlock) |
| `test_bulk.sh` | Масове тестування |
| `test_groupA.sh`, `test_groupA1.sh` | Групове тестування полів |
| `test_half1.sh`, `test_half1b.sh` | Бісект тестування (half-split) |
| `test_money.sh`, `test_money100.sh` | Тест монет/грошей |
| `test_strip.sh` | Тест без вторинних таблиць |
| `test_unequip.sh` | Тест без equipped items |
| `check_all_tables.sh` | Перевірка всіх таблиць |
| `check_fields.sh`, `check_items.sh` | Перевірка полів/предметів |
| `check_maps.sh`, `check_spells.sh` | Перевірка карт/заклинань |
| `full_reset.sh` | Повний скидання до defaults |
| `fresh_clone.sh` | Чистий клон Testlock |
| `compare_chars.sh` | Порівняння двох персонажів |
| `clone_testlock.sh`, `create_testlock.sh` | Утиліти для Testlock |

### Конфіги та Дані
| Файл | Опис |
|---|---|
| `schema_classic.txt` | Дамп Classic characters schema |
| `schema_tbc.txt` | Дамп TBC characters schema |
| `schema_wotlk.txt` | Дамп WotLK characters schema |
| `schema_comparison.txt` | Порівняння всіх трьох |
| `samuel_char_row.txt` | Samuel character row data |
| `samuel_tbc_full.txt` | Повний дамп Samuel з TBC |
| `samuel_wotlk_full.txt` | Повний дамп Samuel на WotLK |
