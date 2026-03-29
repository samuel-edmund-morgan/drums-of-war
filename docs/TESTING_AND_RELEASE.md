# Тестування Та Реліз

Цей файл визначає обов'язкові гейти для безпечної поставки змін.

## Базові правила

1. Жодних live remote-мутацій без чітко зафіксованої задачі в `BACKLOG.md`.
2. Жодних деструктивних DB або infra змін на `workspace` без явного апруву користувача.
3. Кожна змістовна зміна повинна мати докази верифікації в `BACKLOG.md` або `SESSION_LOG.md`.
4. Якщо docs змінюють verified reality, docs оновлюються в тому самому циклі.
5. Для transfer/runtime робіт evidence має бути отриманий з команди, логу або login bot, а не з припущення.

## Обов'язковий preflight

Перед будь-якою deploy, transfer або release-дією:

1. `gh --version`
2. `gh auth status`
3. підтвердь активну роль у `workflow_config.md`
4. підтвердь acceptance-критерії задачі у `BACKLOG.md`
5. підтвердь середовище, яке буде змінене
6. якщо робота торкається `workspace`, перевір SSH ControlMaster або підготуй новий

## Матриця гейтів по середовищах

| Середовище | Типові дозволені дії | Обов'язкові перевірки |
|---|---|---|
| `local` | docs, аналіз, локальні скриптові зміни | review diff, shell syntax check за потреби |
| `test` | integration, transfer verify, remote smoke | backups, targeted verify, logs, health checks |
| `prod` | окремий prod відсутній | будь-яка live remote-мутація трактувати як high-risk operation з explicit approval |

## Матриця тестів за типом змін

| Тип зміни | Мінімальна верифікація | Доказ |
|---|---|---|
| Docs-only | перевірка плейсхолдерів, консистентність шляхів, session log/backlog updates | summary `rg`/review |
| Bash / SQL transfer scripts | syntax check, code review; для SQL migration files за можливості ще й import у throwaway MariaDB на structure-only schema | `bash -n`, `mariadb` import summary, logs |
| Login bot / protocol changes | targeted login verify на відповідній експансії | stdout + exit code bot-а |
| Daily sync / pipeline changes | ручний запуск сценарію, summary, verify на кожному кроці, `current_hash == sync_hash` після verify; для stability-логіки за потреби ще й `current_source_hash == source_hash` | summary `daily-sync.sh`, login bot outputs, SQL hash query |
| Docker / infra changes | compose status, logs, readiness checks | `docker compose ps`, `docker logs`, `World initialized` |
| Legacy website container | compose graph, build proof, helper lint, local public-mode route smoke | `docker compose config/build`, `php -l`, route matrix `403/200`, image inspect |
| Browser-level website audit | Chromium run, action trail, consolidated issues summary | `run_live_audit.sh`, `summary.json`, `issues.json`, screenshots |
| Logged-in website render gate | Real login via cookies + browser render proof on each realm | `run_live_auth_audit.sh`, `auth_render_summary.json`, screenshots |
| Live DB mutation | backup до змін, targeted query після змін | `mariadb-dump` summary + SQL query result |

## Проєктно-специфічні smoke checks

```bash
# 1. Контейнери в expected state
ssh -o ControlPath=/tmp/ssh-ws workspace 'docker ps --format "table {{.Names}}\t{{.Status}}"'

# 2. Readiness логів
ssh -o ControlPath=/tmp/ssh-ws workspace 'docker logs cmangos-wotlk-server --tail 20'

# 3. Login verify
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'python3 /opt/cmangos-transfer/wow_login_test_universal.py --expansion wotlk --username SAMUEL --password samuel --guid 1801'
```

Після verified single-account sync цей smoke має повертати `RESULT: SUCCESS`. Додатковий SQL gate для acceptance:

```bash
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker exec cmangos-wotlk-db mariadb -u root -p"$DB_PASSWORD" wotlkcharacters -N -e "SELECT guid,name,at_login,online FROM characters WHERE name=\"Samuel\";"'
```

Очікуване значення зараз: `1801 Samuel 0 0`.

Для multi-account regression fixture після `TASK-004` використовуй окремий temp config, а не canonical `sync-accounts.conf`:

```bash
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'SYNC_CONF=/opt/cmangos-transfer/sync-accounts.task004.conf /opt/cmangos-transfer/daily-sync.sh'
```

Очікуваний summary для clean fixture станом на `2026-03-14`:

- `Accounts: 3`
- `Synced: 4`
- `Skipped: 2`
- `Created: 2`
- `Errors: 0`

Після такого run-а acceptance-gates:

- `AUTOACC/AUTOACC`, `guid=1802` дає `RESULT: SUCCESS` на TBC і WotLK.
- `SKIPACC/SKIPACC`, `guid=1803` дає `RESULT: SUCCESS` на TBC і WotLK.
- `Autolock` має `current_hash == stored_hash` на TBC і WotLK.
- `Skiplock` має deliberate stale-hash state: `current_hash != stored_hash`.

Для class-coverage regression fixture після `TASK-005` використовуй окремий temp config:

```bash
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'SYNC_CONF=/opt/cmangos-transfer/sync-accounts.task005.classacc-only.conf /opt/cmangos-transfer/daily-sync.sh'
```

Очікуваний summary для healthy state станом на `2026-03-14`:

- `Accounts: 1`
- `Synced: 4`
- `Skipped: 0`
- `Created: 0`
- `Errors: 0`

Acceptance-gates:

- TBC `CLASSACC/CLASSACC`, `guid=1804` → `RESULT: SUCCESS`
- WotLK `CLASSACC/CLASSACC`, `guid=1804` → `RESULT: SUCCESS`
- TBC `CLASSACC/CLASSACC`, `guid=1805` → `RESULT: SUCCESS`
- WotLK `CLASSACC/CLASSACC`, `guid=1805` → `RESULT: SUCCESS`
- TBC/WotLK `Samuel`, `Testwar`, `Testhunt` мають `at_login=0`, `online=0`

Operational note:

- Ручні `wow_login_test_universal.py` smoke checks для одного й того ж realm/account запускати послідовно; паралельні логіни можуть давати шумні `TIMEOUT`/`Auth proof` false negatives.

Для targeted Classic -> TBC runner після `TASK-039` acceptance окремий:

```bash
bash -n localProjects/cmangos_projects/transfer/lib.sh
bash -n localProjects/cmangos_projects/transfer/daily-sync.sh
bash -n localProjects/cmangos_projects/transfer/targeted-transfer-runner.sh
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'cd /opt/cmangos-transfer && ./targeted-transfer-runner.sh --account SAMUEL --character Samuel --dry-run'
```

Acceptance-gates:

- Runner exists at `localProjects/cmangos_projects/transfer/targeted-transfer-runner.sh` and on runtime at `/opt/cmangos-transfer/targeted-transfer-runner.sh`.
- Dry-run returns one JSON payload on stdout rather than ad hoc shell text.
- Payload includes `status`, `transfer_decision`, `target_state`, `safe_retry_from`, `account`, `character`, `steps`, and ordered `events`.
- For the current canonical runtime baseline, `SAMUEL/Samuel` dry-run is expected to return `status=skipped`, `transfer_decision=skip_unchanged`, `target_state=unchanged`, `password_source=sync_conf`, `guid=1801`, `source_online=false`, `source_at_login=0`.
- Dry-run must not mutate character data or require edits to `sync-accounts.conf` to select the request.

Для chained `to_wotlk` runner після `TASK-040` acceptance окремий:

```bash
bash -n localProjects/cmangos_projects/transfer/chained-wotlk-transfer-runner.sh
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'cd /opt/cmangos-transfer && ./chained-wotlk-transfer-runner.sh --source classic --account SAMUEL --character Samuel --dry-run'
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'cd /opt/cmangos-transfer && ./chained-wotlk-transfer-runner.sh --source tbc --account SAMUEL --character Samuel --dry-run'
```

Acceptance-gates:

- Runner exists at `localProjects/cmangos_projects/transfer/chained-wotlk-transfer-runner.sh` and on runtime at `/opt/cmangos-transfer/chained-wotlk-transfer-runner.sh`.
- Classic-origin dry-run returns a combined JSON payload with:
  - `request_type=to_wotlk`
  - `chain_mode=classic_via_tbc`
  - ordered `chain = [classic_to_tbc, tbc_verify, tbc_to_wotlk, wotlk_verify]`
  - separate `chain_steps` and merged `events`
- TBC-origin dry-run returns a combined JSON payload with:
  - `request_type=to_wotlk`
  - `chain_mode=tbc_direct`
  - ordered `chain = [tbc_to_wotlk, wotlk_verify]`
- For the current canonical runtime baseline, both dry-runs are expected to return `status=skipped`, `password_source=sync_conf`, `guid=1801`, `source_online=false`, `source_at_login=0`.
- Current step expectations:
  - Classic-origin: `classic_to_tbc=already_synced`, `tbc_verify=already_verified`, `tbc_to_wotlk=skipped`, `wotlk_verify=not_run`
  - TBC-origin: `tbc_to_wotlk=skipped`, `wotlk_verify=not_run`
- The chain runner must never expose direct `classic -> wotlk` as a single step.
- Partial-chain retry semantics are documented as `safe_retry_from=tbc_to_wotlk` after a real run where the TBC stage is already available but the WotLK stage did not complete.

Для locking / idempotency guards після `TASK-041` acceptance окремий:

```bash
bash -n localProjects/cmangos_projects/transfer/request-locks.sh
bash -n localProjects/cmangos_projects/transfer/test-request-lock-guards.sh
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'cd /opt/cmangos-transfer && ./test-request-lock-guards.sh'
```

Acceptance-gates:

- Step runner and chained runner both include `request_guard` metadata in their JSON payloads.
- `request_guard.active_lock_key` is character-scoped and shared across `to_tbc` / `to_wotlk` attempts for the same source character.
- `request_guard.idempotency_key` is target-specific and deterministic.
- Remote harness returns:
  - `targeted_duplicate.status=blocked`, `targeted_duplicate.blocker_code=duplicate_request`, `targeted_duplicate.lock_state=duplicate_blocked`
  - `chained_duplicate.status=blocked`, `chained_duplicate.blocker_code=duplicate_request`, `chained_duplicate.lock_state=duplicate_blocked`
  - `stale_recovery.lock_state=recovered_stale`, `stale_recovery.stale_lock_recovered=true`
- Sourcing `daily-sync.sh` from request-scoped runners or the lock harness must not emit stray legacy batch-trap log errors.

Для local legacy-website smoke після `TASK-017` acceptance окремий:

```bash
find localProjects/cmangos_projects/docker-website -maxdepth 3 -type f | sort
docker compose \
  --env-file localProjects/cmangos_projects/docker-website/.env.example \
  -f localProjects/cmangos_projects/docker-website/docker-compose.yml \
  config
docker compose \
  --env-file localProjects/cmangos_projects/docker-website/.env.example \
  -f localProjects/cmangos_projects/docker-website/docker-compose.yml \
  build mangos-website
docker image inspect semorgana/mangos-website:local --format '{{.Id}} {{.RepoTags}}'
docker run --rm -v "$PWD":/work -w /work php:8.2-cli \
  php -l localProjects/cmangos_projects/docker-website/scripts/configure-app.php
```

Acceptance-gates:

- `docker compose ... config` проходить без помилок і показує external networks `traefik` та `cmangos-wotlk-net`.
- Local image існує під `semorgana/mangos-website:local`.
- `configure-app.php` проходить syntax gate.
- Container smoke генерує runtime `config.xml` із `default_template=wotlk`, `site_register=0`, `site_title=World of Warcraft`, `base_href=https://world-of-warcraft.morgan-dev.com/`.
- Усередині container присутні `gd`, `mysql`, `mysqli`, `mysqlnd`, `pdo_mysql`.
- Route matrix:
  - `/` → `200`
  - `/donate.php` → `403`
  - `/index.php?n=admin` → `403`
  - `/index.php?n=account.manage` → `403`
  - `/install/` → `403`
  - `/config/config.xml` → `403`

Scope note:

- Це не є live deploy. Для shared-host rollout усе одно потрібен окремий explicit user approval.

Для local modern roster/account-overview smoke після `TASK-058` acceptance окремий:

```bash
bash -n localProjects/cmangos_projects/docker-website/scripts/run-modern-account-overview-smoke.sh
docker run --rm -v "$PWD/localProjects/cmangos_projects/docker-website/modern-prototype/public":/app -w /app php:8.3-cli php -l index.php
sh localProjects/cmangos_projects/docker-website/scripts/run-modern-account-overview-smoke.sh
```

Acceptance-gates:

- Guest request to `/wotlk/modern/account/manage` redirects to `/wotlk/index.php?n=account&sub=login`.
- Logged-in request renders `data-slice="account-overview-roster"` and `data-identity-mode="legacy_account_id"`.
- The first authenticated render shows `data-auth-source="legacy-cookie-bridge"` and mints `mw-modern-session`; the second render with only that cookie shows `data-auth-source="modern-bridge-cookie"`.
- Fixture-backed bucket states stay truthful and visible:
  - `classic` contains seeded characters `Samuel` and `Morgan`
  - `tbc` shows the explicit empty-bucket copy
  - `wotlk` shows the explicit unavailable-bucket warning
- The page keeps the transfer boundary explicit instead of exposing fake controls before `TASK-059`.

Для modern transfer control-plane після `TASK-059` acceptance окремий:

```bash
bash -n localProjects/cmangos_projects/docker-website/scripts/run-modern-transfer-control-plane-smoke.sh
bash -n localProjects/cmangos_projects/transfer/test-transfer-control-flags.sh
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'cd /opt/cmangos-transfer && ./test-transfer-control-flags.sh'
```

Acceptance-gates:

- Logged-in modern manage render exposes `data-transfer-slice="transfer-control-plane"` and seeded request history entries `REQ-DEMO-COMP-001` plus `REQ-DEMO-PART-002`.
- A modern submit for `Morgan (guid=1802)` to `to_tbc` creates exactly one queued request and reuses that active request on duplicate submit.
- The blocked-submit control state renders both the flash marker `data-transfer-flash="control_blocked"` and the operator notice marker `data-control-flag="self-service-transfer.disabled.flag"`.
- A bridge-only cookie render still returns `data-auth-source="modern-bridge-cookie"` on the same modern manage route.
- Runtime control harness on `workspace` returns normalized operator blocker payloads:
  - `operator_disabled` => `status=blocked`, `blocker_code=operator_disabled`
  - `queue_paused` => `status=blocked`, `blocker_code=queue_paused`
  - `emergency_stop` => `status=blocked`, `blocker_code=emergency_stop`

Operational note:

- For local prototype runs, prefer a free explicit `MW_MODERN_PROTOTYPE_PORT` if another modernization smoke is already holding `8089`.

Для low-risk public `howtoplay` slice після `TASK-060` acceptance окремий:

```bash
bash -n localProjects/cmangos_projects/docker-website/scripts/run-modern-public-howtoplay-smoke.sh
docker run --rm -v "$PWD/localProjects/cmangos_projects/docker-website/modern-prototype/public":/app -w /app php:8.3-cli php -l index.php
sh localProjects/cmangos_projects/docker-website/scripts/run-modern-public-howtoplay-smoke.sh
```

Acceptance-gates:

- The modern prototype owns the canonical query URL `/wotlk/index.php?n=server&sub=howtoplay` rather than a prototype-only alias.
- Legacy baseline and modern render both contain the same core guide markers:
  - `Install World Of Warcraft`
  - `Create Account On This Website`
  - `Read the Server Rules`
  - `Have Fun!`
- Modern render exposes `data-slice="public-server-guide"`, `data-guide="howtoplay"`, and `data-source="legacy-resource-files"`.
- The prototype keeps language behavior truthful: an unsupported `Language` cookie preserves the requested marker but resolves content to the legacy default language.

Operational note:

- This proof is only a safe template for static `lang_resource(...)` public pages. Do not treat it as acceptance evidence for forum/news/frontpage slices that still depend on subsystem-heavy legacy runtime state.

Для live legacy-website rollout після `TASK-021` acceptance окремий:

```bash
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Networks}}" | grep -E "^(NAMES|mangos-website)"'
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker logs traefik --tail 80 | grep -E "world-of-warcraft|Certificates obtained"'
curl -ksS -o /tmp/task021.index.html -D /tmp/task021.headers \
  https://world-of-warcraft.morgan-dev.com
curl -I https://world-of-warcraft.morgan-dev.com/install/
curl -I 'https://world-of-warcraft.morgan-dev.com/index.php?n=admin'
curl -I https://world-of-warcraft.morgan-dev.com/donate.php
```

Acceptance-gates:

- `mangos-website` на `workspace` у статусі `Up ... (healthy)`.
- Traefik logs містять `Certificates obtained for domains [world-of-warcraft.morgan-dev.com]`.
- Публічний root route = `HTTP 200`, `<title>World of Warcraft`.
- WotLK theme asset matrix не ламається на Linux case-sensitive runtime:
  - `/templates/wotlk/css/newhp.css` → `200`
  - `/templates/wotlk/js/detection.js` → `200`
  - `/templates/wotlk/images/pixel000.gif` → `200`
- Заблоковані surfaces лишаються закритими:
  - `/install/` → `403`
  - `/index.php?n=admin` → `403`
  - `/index.php?n=account.manage` → `403`
  - `/donate.php` → `403`
  - `/config/config.xml` → `403`
- `openssl s_client ... | openssl x509 -noout -subject -issuer -dates` більше не показує default/self-signed cert у steady-state.

Operational note:

- Під час першого ACME issuance за Cloudflare proxy допустимий короткий `526`, доки Traefik ще віддає default self-signed cert. Acceptance-pass оцінюй тільки по steady-state після issuance.
- Якщо `/js/compressed/prototype.js` все ще `404`, це окремий upstream JS debt; для `TASK-022` він не блокує acceptance, якщо homepage theme/render уже відновлено і `templates/wotlk/*` asset matrix зелена.

Для browser-level website audit після `TASK-023` acceptance окремий:

```bash
bash -n localProjects/cmangos_projects/docker-website/browser-audit/run_live_audit.sh
python3 -m py_compile \
  localProjects/cmangos_projects/docker-website/browser-audit/browser_audit.py
localProjects/cmangos_projects/docker-website/browser-audit/run_live_audit.sh
cat localProjects/cmangos_projects/docker-website/browser-audit/reports/20260315_092632/summary.json
```

Acceptance-gates:

- У `browser-audit/` існують reproducible runner, config, requirements і reports directory structure.
- Run створює `summary.json`, `summary.md`, `pages.json`, `actions.json`, `issues.json`, `screenshots/`.
- Verified baseline `20260315_092632` має:
  - `pages_visited=30`
  - `actions_recorded=477`
  - `issues_total=210`
  - `issues_unexpected=205`
  - `same_origin_unexpected=205`
- Report централізовано показує top recurring issue (`/js/compressed/prototype.js` → `404`) і blocked `403` surfaces.

Для logged-in website render gate після `TASK-034` acceptance окремий:

```bash
python3 -m py_compile \
  localProjects/cmangos_projects/docker-website/browser-audit/auth_render_audit.py
bash -n localProjects/cmangos_projects/docker-website/browser-audit/run_live_auth_audit.sh
sh localProjects/cmangos_projects/docker-website/browser-audit/run_live_auth_audit.sh
cat localProjects/cmangos_projects/docker-website/browser-audit/reports/20260316_205454_auth/auth_render_summary.json
```

Operational note:

- Until the browser-audit wrapper is cleaned up, treat the generated `auth_render_summary.json` as the source of truth if `run_live_auth_audit.sh` prints a valid passing summary but still exits non-zero on a trailing local JSON parse step.

Для `TASK-047` logged-in `My Characters` roster UI acceptance окремий:

```bash
docker run --rm -v "$PWD/localProjects/cmangos_projects/mangos-website":/app -w /app php:5.6-apache \
  php -l templates/offlike/account/account.manage.php
docker run --rm -v "$PWD/localProjects/cmangos_projects/mangos-website":/app -w /app php:5.6-apache \
  php -l components/account/account.manage.php
docker run --rm -v "$PWD/localProjects/cmangos_projects/mangos-website":/app -w /app php:5.6-apache \
  php -l core/common.php
```

Acceptance-gates:

- Logged-in `account/manage` page shows a visible `My Characters` section before profile editing controls.
- Patch groups render in canonical order `Classic`, `TBC`, `WotLK`.
- Each populated row visibly shows `name`, `race`, `class`, `level`, and `Online/Offline` state.
- Empty patch buckets render an explicit empty-state message instead of collapsing silently.
- Partial realm failures render a warning instead of breaking the whole account page.
- PHP 5.6 syntax validation passes for `core/common.php`, `components/account/account.manage.php`, and `templates/offlike/account/account.manage.php`.

Для `TASK-052` modern PHP prototype acceptance окремий:

```bash
bash -n localProjects/cmangos_projects/docker-website/scripts/test-modern-realmstatus-contract.sh
bash -n localProjects/cmangos_projects/docker-website/scripts/run-modern-realmstatus-prototype.sh
docker run --rm -v "$PWD/localProjects/cmangos_projects/docker-website/modern-prototype/public":/app -w /app php:8.3-cli \
  php -l index.php
docker compose \
  --env-file localProjects/cmangos_projects/docker-website/.env.example \
  -f localProjects/cmangos_projects/docker-website/docker-compose.modern-prototype.yml \
  config
localProjects/cmangos_projects/docker-website/scripts/run-modern-realmstatus-prototype.sh
```

Acceptance-gates:

- Standalone compose file builds a PHP 8 companion service without reusing the legacy bootstrap.
- Prototype route `http://127.0.0.1:8089/wotlk/modern/realmstatus` returns HTML with the canonical legacy markers `Realm Status`, `Status`, `Uptime`, `Realm Name`, `Type`, `Population`.
- Contract smoke reports `contract_markers=ok` while comparing the prototype HTML against the live legacy route `https://world-of-warcraft.morgan-dev.com/wotlk/index.php?n=server&sub=realmstatus`.
- Rendered HTML exposes `data-slice="realmstatus"` and a truthful `data-source` marker.
- If the prototype falls back because the local isolated runtime cannot resolve the legacy DB host, that limitation must be captured in `BACKLOG` / `SESSION_LOG` rather than hidden.

Для `TASK-056` modern identity/session bridge acceptance окремий:

```bash
bash -n localProjects/cmangos_projects/docker-website/scripts/run-modern-session-bridge-smoke.sh
docker run --rm -v "$PWD/localProjects/cmangos_projects/docker-website/modern-prototype/public":/app -w /app php:8.3-cli \
  php -l index.php
docker compose \
  --env-file localProjects/cmangos_projects/docker-website/.env.example \
  -f localProjects/cmangos_projects/docker-website/docker-compose.modern-prototype.yml \
  config
MW_MODERN_PROTOTYPE_PORT=8091 \
MW_MODERN_PROTOTYPE_PATCH=wotlk \
MW_MODERN_PROTOTYPE_SITE_TITLE='Modern Prototype' \
MW_MODERN_PROTOTYPE_IMAGE_NAME=mangos-website-modern-prototype \
MW_SITE_COOKIE_NAME=mangosWeb \
MW_MODERN_SESSION_COOKIE_NAME=mw-modern-session \
MW_MODERN_SESSION_SECRET=dev-modern-secret \
localProjects/cmangos_projects/docker-website/scripts/run-modern-session-bridge-smoke.sh
```

Acceptance-gates:

- Guest access to `http://127.0.0.1:8091/wotlk/modern/account/identity` returns a legacy login fallback redirect instead of exposing a half-authenticated surface.
- A valid legacy website cookie is bridged exactly once into a root-scoped modern session cookie, and the HTML shows `data-slice="identity-session-bridge"` with `data-auth-source="legacy-cookie-bridge"`.
- Reusing the minted modern cookie resolves the same principal with `data-auth-source="modern-bridge-cookie"` and no dependency on the legacy cookie for the second request.
- Ownership mismatch on `account_id` returns `403`.
- `/wotlk/modern/account/manage` remains a truthful legacy fallback redirect until that route is explicitly modernized.
- The smoke harness must inject explicit fixture DB env values into the prototype service and reseed the auth fixture rows after startup so acceptance does not depend on MariaDB init ordering quirks.

Для `TASK-057` modern account-security acceptance окремий:

```bash
bash -n localProjects/cmangos_projects/docker-website/scripts/run-modern-account-security-smoke.sh
docker run --rm -v "$PWD/localProjects/cmangos_projects/docker-website/modern-prototype/public":/app -w /app php:8.3-cli \
  php -l index.php
docker run --rm -v "$PWD/localProjects/cmangos_projects/mangos-website":/app -w /app php:5.6-apache \
  php -l templates/offlike/account/account.manage.php
MW_MODERN_PROTOTYPE_PORT=8092 \
MW_MODERN_PROTOTYPE_PATCH=wotlk \
MW_MODERN_PROTOTYPE_SITE_TITLE='Modern Prototype' \
MW_MODERN_PROTOTYPE_IMAGE_NAME=mangos-website-modern-prototype \
MW_SITE_COOKIE_NAME=mangosWeb \
MW_MODERN_SESSION_COOKIE_NAME=mw-modern-session \
MW_MODERN_SESSION_SECRET=dev-modern-secret \
sh localProjects/cmangos_projects/docker-website/scripts/run-modern-account-security-smoke.sh
MW_MODERN_PROTOTYPE_PORT=8091 \
MW_MODERN_PROTOTYPE_PATCH=wotlk \
MW_MODERN_PROTOTYPE_SITE_TITLE='Modern Prototype' \
MW_MODERN_PROTOTYPE_IMAGE_NAME=mangos-website-modern-prototype \
MW_SITE_COOKIE_NAME=mangosWeb \
MW_MODERN_SESSION_COOKIE_NAME=mw-modern-session \
MW_MODERN_SESSION_SECRET=dev-modern-secret \
sh localProjects/cmangos_projects/docker-website/scripts/run-modern-session-bridge-smoke.sh
```

Acceptance-gates:

- Guest access to `http://127.0.0.1:8092/wotlk/modern/account/security` redirects to the legacy login path.
- Logged-in rendering exposes `data-slice="account-security-password"`, preserves the password form contract, and states the truthful transitional scope `local-only`.
- Invalid current password is rejected server-side without mutating the account row.
- Successful password change updates auth credentials, clears the active website-account key, expires both legacy and modern auth cookies, and renders a forced re-login success state.
- Replayed old modern and legacy cookies are both rejected after success.
- The legacy account-manage template must post password changes to the modern route instead of owning `action=changepass` directly.
- Modern session regression proof from `run-modern-session-bridge-smoke.sh` must still pass after the revocable `session_guard` change.

Для `TASK-042` transfer-controls UI acceptance окремий:

```bash
docker run --rm -v "$PWD/localProjects/cmangos_projects/mangos-website":/app -w /app php:5.6-apache \
  php -l templates/offlike/account/account.manage.php
docker run --rm -v "$PWD/localProjects/cmangos_projects/mangos-website":/app -w /app php:5.6-apache \
  php -l components/account/account.manage.php
docker run --rm -v "$PWD/localProjects/cmangos_projects/mangos-website":/app -w /app php:5.6-apache \
  php -l core/common.php
python3 -m py_compile \
  localProjects/cmangos_projects/docker-website/browser-audit/auth_render_audit.py
bash -n localProjects/cmangos_projects/docker-website/browser-audit/run_live_auth_audit.sh
sh localProjects/cmangos_projects/docker-website/browser-audit/run_live_auth_audit.sh
cat localProjects/cmangos_projects/docker-website/browser-audit/reports/20260316_233118_auth/auth_render_summary.json
```

Acceptance-gates:

- Logged-in `account/manage` shows transfer actions inside the existing `My Characters` roster instead of a separate hidden or admin-only surface.
- Allowed actions render as distinct `Transfer to TBC` and `Transfer to WotLK` controls only where the eligibility contract marks them `allowed`.
- Blocked actions stay visible with disabled styling and an explicit blocker reason instead of disappearing silently.
- The page exposes minimal transfer UI states (`Idle`, `Pending Confirm`, `Queued`, `Running`, `Failed`, `Completed`) via visible badges/legend.
- A non-mutating confirmation step exists before any future real submit wiring, and the UI copy stays truthful that persistent queue/history/admin behavior lands in later tasks.
- PHP 5.6 syntax validation passes for the touched website files, and the logged-in auth render report passes on `classic`, `tbc`, and `wotlk`.

Для `TASK-043` transfer history/progress contract acceptance окремий:

- `docs/TRANSFER_SYSTEM.md` explicitly defines one `Active Transfer` panel plus a separate reverse-chronological `Transfer History` list.
- The contract names the minimum fields visible on each request row/card: request reference, character snapshot, requested action, normalized status label, current/final step label, timestamps, and latest safe user message.
- The contract fixes canonical step labels for chain progress and keeps `Classic -> TBC` / `TBC Verification` / `TBC -> WotLK` / `WotLK Verification` visible instead of collapsing progress into a generic processing state.
- UI-facing error categories are normalized and mapped to safe user messages; raw runner traces, SQL snippets, and PHP warnings are explicitly forbidden from user history surfaces.
- Refresh behavior is documented as manual-refresh-safe by default, with future polling optional and additive rather than required for correctness.
- Documented examples exist for `completed`, `failed`, and `partial` request outcomes.

Для `TASK-044` operator controls / kill-switch contract acceptance окремий:

- `docs/TRANSFER_SYSTEM.md` explicitly defines the operator-only action set: `inspect`, `retry`, `cancel`, `pause`, `resume`, `disable`, and `emergency_stop`.
- The contract names a canonical runtime control root and three concrete flag files: `self-service-transfer.disabled.flag`, `transfer-queue.paused.flag`, and `emergency-stop.flag`.
- A safe pause/resume procedure is documented as preserving request/event history rather than deleting or bypassing audit state.
- The emergency-stop and recovery runbook is explicit about ordering: create the stop flag first, preserve evidence, inspect lock metadata, then recover and remove flags only after the incident is understood.
- The user/operator boundary is explicit: users cannot clear locks or force retries, and operators must use audited overrides instead of silent manual mutation.
- Audit requirements are explicit for mutating operator actions: actor identity, reason, timestamp, event type, before/after status when applicable, and safe user-facing summary for visible state changes.
- `docs/COMMANDS_REFERENCE.md` contains the shell-level control-flag and lock-inspection commands that match the documented runtime contract.

Для `TASK-045` self-service transfer QA matrix / release gate канонічний:

Цей gate не дозволяє зводити self-service transfer до одного окремого smoke. Claim `release-ready` дозволений лише коли в одному verification cycle зібрано browser-level, control-plane, runner, duplicate-guard, operator-override і evidence-pack proof без розриву між user path і runtime contract.

Canonical matrix:

| Track | Scenario | Minimum checks | Required evidence | Release consequence if missing |
|---|---|---|---|---|
| `Happy path` | `to_tbc` user path | logged-in auth render gate, visible allowed `Transfer to TBC` control, non-mutating confirm, one queued request create/reuse proof, targeted runner dry-run contract | auth render summary, modern/local UI smoke summary, queued request JSON/UI markers, targeted runner JSON | Без цього заборонено claim, що `Classic -> TBC` self-service path готовий для користувачів |
| `Happy path` | `to_wotlk` chained user path | logged-in auth render gate, visible allowed `Transfer to WotLK` control, one queued request create/reuse proof, chain contract with explicit `classic_via_tbc` or `tbc_direct`, partial-safe retry semantics | auth render summary, UI smoke summary, chained runner JSON, step/event summary | Без цього заборонено claim, що `to_wotlk` працює як truthful sequential chain |
| `Negative path` | blocked / ineligible character | blocked action remains visible with explicit blocker copy, no hidden submit path, normalized blocker code | HTML or screenshot proof, eligibility payload sample | Без цього UI вважається misleading і release gate fails |
| `Negative path` | duplicate submit / concurrent request | duplicate reuse on user surface plus remote lock harness for duplicate blocking | UI duplicate-submit proof, `/opt/cmangos-transfer/test-request-lock-guards.sh` summary | Без цього release gate fails незалежно від happy-path proof |
| `Negative path` | partial chain / retry | partial outcome remains visible with `safe_retry_from` and user-safe history text | chained runner payload sample, documented UI/history example | Без цього заборонено claim resilient retry semantics |
| `Negative path` | stale lock recovery | stale lock recovers automatically and reports `recovered_stale` | remote lock-harness summary | Без цього operators must treat stale-lock handling as unverified |
| `Operational path` | operator disable / pause / emergency stop | submit surface renders truthful blocked state and runtime flags map to normalized blocker codes | local control-plane smoke summary, `/opt/cmangos-transfer/test-transfer-control-flags.sh` summary | Без цього заборонено release claim for operator-safe rollout |

Required happy-path evidence set for `to_tbc`:

1. Logged-in browser render proof on `classic`, `tbc`, and `wotlk` via `run_live_auth_audit.sh` with `checks_failed=0`.
2. Logged-in account surface shows the transfer action inside the canonical `account/manage` or owned modern manage route rather than on an operator-only page.
3. One non-mutating confirmation proof exists before submit/queue state changes.
4. Submit/create proof shows exactly one active request for the same character/target pair and duplicate reuse rather than a second request.
5. Runtime targeted runner proof shows deterministic JSON with `status`, `transfer_decision`, `target_state`, `safe_retry_from`, ordered `events`, and character/account metadata.

Required happy-path evidence set for `to_wotlk`:

1. All `to_tbc` gate items above, adapted to the `Transfer to WotLK` action.
2. Chained runner proof shows `request_type=to_wotlk` and never collapses the flow into a fake direct `classic -> wotlk` step.
3. Classic-origin proof shows ordered chain `classic_to_tbc -> tbc_verify -> tbc_to_wotlk -> wotlk_verify`.
4. TBC-origin proof shows ordered chain `tbc_to_wotlk -> wotlk_verify`.
5. Partial-chain semantics remain explicit: if TBC is already available but WotLK is not, the request is `partial` and `safe_retry_from=tbc_to_wotlk`.

Required negative-path matrix:

| Case | Expected contract | Minimum proof |
|---|---|---|
| `eligibility_blocked` | user sees explicit blocker reason; submit action is not silently hidden | logged-in HTML/screenshot + eligibility payload sample |
| `duplicate_request` | top-level result is `blocked`; lock state is `duplicate_blocked`; existing request reference is preserved | remote lock harness summary |
| `partial_chain_failure` | top-level result is `partial`; history text stays user-safe; retry anchor is explicit | chained runner payload sample + documented history example |
| `stale_lock_recovery` | runner continues only after recovering the stale lock and reports `stale_lock_recovered=true` | remote lock harness summary |
| `operator_disabled` | submit surface stays visible but blocked with maintenance copy | local control-plane smoke + runtime flag summary |
| `queue_paused` | new execution does not start; user sees normalized paused state | runtime flag summary |
| `emergency_stop` | execution is frozen with explicit emergency wording and no silent bypass | runtime flag summary |

Required evidence pack before any `release-ready` claim:

- command transcript or summarized stdout for every gate command used;
- browser artifacts for logged-in render states on all supported surfaces;
- request payload proof for create/reuse/duplicate/partial states;
- runtime summaries from remote guard/control harnesses;
- DB or request-store proof that only one active request exists per character scope;
- safe user-visible screenshots or HTML markers for blocked/operator-disabled states.

Release rules for self-service transfer:

- Заборонено claim `release-ready`, якщо пройдено лише docs review, лише dry-run runners, або лише local prototype submit without remote guard proof.
- Заборонено claim `release-ready`, якщо немає одночасно logged-in browser proof, queue/create-or-reuse proof, duplicate guard proof, and operator override proof.
- Дозволено claim only `contract-defined` або `prototype-verified`, якщо виконано частину matrix, але не зібрано весь evidence pack в одному cycle.
- Будь-який live rollout або production-style enablement мусить повторити весь gate після останньої суттєвої зміни в UI, runner contract, lock semantics, або operator flags.

Для `TASK-053` password-change contract acceptance окремий:

- Docs explicitly distinguish current legacy `changepass` behavior from the canonical target contract.
- Contract names the required fields: `current password`, `new password`, `confirmation`.
- Contract states the intended update scope: all linked patch accounts for one website identity, with truthful fallback language while code is still local-only.
- Contract requires forced re-login after success.
- Contract defines release evidence expected from `TASK-054`: real logged-in browser flow, post-change logout/re-login proof, and explicit scope statement.

Для `TASK-038` character eligibility discovery acceptance окремий:

- `mw_build_account_transfer_eligibility()` returns a deterministic response contract for the logged-in account area.
- Each visible character resolves to normalized actions with statuses: `allowed`, `blocked`, or `not_applicable`.
- The only user-facing action keys are `to_tbc` and `to_wotlk`.
- Blocking reasons are normalized and UI-safe: `source_online`, `source_pending_login_flags`, `missing_account_mapping`, `stale_conflicting_target_state`, `target_patch_unavailable`.
- Documented examples exist for both `allowed` and `blocked` action outcomes.
- PHP diagnostics stay clean for `core/common.php` and `components/account/account.manage.php`.

Acceptance-gates:

- `checks_total=3`, `checks_failed=0`, `release_gate_passed=true`.
- Для `classic`, `tbc`, `wotlk`:
  - logged-in HTML містить expected user marker (`SAMUEL`);
  - logged-in HTML містить expected CSS path `templates/vanilla/css/newhp.css`;
  - logged-in HTML не містить broken path fragment `templates/css/`;
  - same-origin CSS/JS/image failures = `0`;
  - screenshot збережено в report directory.

Release rule:

- Заборонено claim `production-ready`, якщо не пройдено і guest/browser audit, і окремий logged-in auth render gate.

Для local path-prefix / multiroute website proof після `TASK-024` acceptance окремий:

```bash
docker compose \
  --env-file localProjects/cmangos_projects/docker-website/.env.multiroute.example \
  -f localProjects/cmangos_projects/docker-website/docker-compose.remote.multiroute.yml \
  config
bash -n localProjects/cmangos_projects/docker-website/scripts/docker-entrypoint.sh
docker run --rm -v "$PWD":/work -w /work php:8.2-cli \
  php -l localProjects/cmangos_projects/docker-website/scripts/configure-apache.php
curl -I http://127.0.0.1:8091/wotlk/
curl -I http://127.0.0.1:8091/wotlk/templates/wotlk/css/newhp.css
curl -I http://127.0.0.1:8091/
```

Acceptance-gates:

- `docker-compose.remote.multiroute.yml` збирається без помилок і описує окремі services для `/classic`, `/tbc`, `/wotlk`, `/wotlk-azcore`.
- Prefix-aware Apache generator проходить syntax gate і реально дає prefixed runtime path:
  - `/wotlk/` → `200`
  - `/wotlk/templates/wotlk/css/newhp.css` → `200`
  - `/` на disposable proof container → `403`
- `#shared_topnav` у prefixed WotLK DOM містить patch-switch links `/classic/`, `/tbc/`, `/wotlk/`, `/wotlk-azcore/`, а поточний path має `is-active`.

Scope note:

- `TASK-024` acceptance доводить локальний runtime contract, а не live rollout на `workspace`.
- Shared-host deploy цих routes має окремо пройти backlog claim і explicit approval.

Для live website multiroute після `TASK-025` acceptance окремий:

```bash
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker ps --format "table {{.Names}}\t{{.Status}}" | grep mangos-website'

for p in / /classic/ /tbc/ /wotlk/ /classic /tbc /wotlk /wotlk-azcore/ /classic/install/ /tbc/donate.php '/wotlk/index.php?n=admin'; do
  printf '=== %s\n' "$p"
  curl -ksS -D - "https://world-of-warcraft.morgan-dev.com$p" -o /dev/null | sed -n '1,6p'
done

localProjects/cmangos_projects/docker-website/browser-audit/.venv/bin/python - <<'PY'
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for path in ['/', '/classic/', '/tbc/', '/wotlk/']:
        page = browser.new_page()
        page.goto('https://world-of-warcraft.morgan-dev.com' + path, wait_until='networkidle')
        page.wait_for_timeout(1500)
        nav = page.eval_on_selector('#shared_topnav', """el => ({
          text: el.innerText.replace(/\\s+/g, ' ').trim(),
          links: Array.from(el.querySelectorAll('a')).map(a => ({ href: a.getAttribute('href'), cls: a.className }))
        })""")
        print(path, nav)
        page.close()
    browser.close()
PY
```

Acceptance-gates:

- `mangos-website`, `mangos-website-classic`, `mangos-website-tbc`, `mangos-website-wotlk` у `Up ... (healthy)`.
- Public routes `/`, `/classic/`, `/tbc/`, `/wotlk/` віддають `HTTP 200`.
- Slashless `/classic`, `/tbc`, `/wotlk` віддають canonical redirect на trailing-slash URL. Станом на `2026-03-15` це `HTTP 302`.
- Hardened routes лишаються закритими: `/classic/install/`, `/tbc/donate.php`, `/wotlk/index.php?n=admin` = `403`.
- `/wotlk-azcore/` не повинен маскуватися під `/wotlk/`; якщо live AzerothCore service відсутній, очікуваний результат = `404`.
- Browser-side `#shared_topnav` на `/`, `/classic/`, `/tbc/`, `/wotlk/` реально містить patch links `/classic/`, `/tbc/`, `/wotlk/`, `/wotlk-azcore/`.
- На `/classic/`, `/tbc/`, `/wotlk/` відповідний patch link має `is-active`.

Operational note:

- Public smoke для цього домену запускай із локальної машини або реального браузера. `curl` із самого `workspace` може повертати Cloudflare edge `403`, хоча live site при цьому здоровий.

Для canonical public entrypoint після `TASK-026` acceptance окремий:

```bash
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" | grep mangos-website'

for p in / /index.php /classic/ /tbc/ /wotlk/ /wotlk-azcore/ /classic/install/ /tbc/donate.php '/wotlk/index.php?n=admin'; do
  printf '=== %s\n' "$p"
  curl -ksS -D - "https://world-of-warcraft.morgan-dev.com$p" -o /dev/null | sed -n '1,6p'
done

localProjects/cmangos_projects/docker-website/browser-audit/.venv/bin/python - <<'PY'
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for path in ['/', '/classic/', '/tbc/', '/wotlk/']:
        page = browser.new_page(viewport={'width': 1600, 'height': 300})
        page.goto('https://world-of-warcraft.morgan-dev.com' + path, wait_until='networkidle')
        page.wait_for_timeout(1200)
        nav = page.eval_on_selector('#shared_topnav', """el => ({
          box: (() => { const r = el.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; })(),
          links: Array.from(el.querySelectorAll('.tn_patchswitch a')).map(a => ({ href: a.getAttribute('href'), text: a.textContent.trim(), cls: a.className }))
        })""")
        print(path, nav)
        page.close()
    browser.close()
PY
```

Acceptance-gates:

- `mangos-website`, `mangos-website-classic`, `mangos-website-tbc`, `mangos-website-wotlk` у `Up ... (healthy)` на image `semorgana/mangos-website:task026a-rootredirect-20260315`.
- `/` і `/index.php` віддають canonical redirect на `https://world-of-warcraft.morgan-dev.com/classic/`. Станом на `2026-03-15` це `HTTP 302`.
- `/classic/`, `/tbc/`, `/wotlk/` = `HTTP 200`.
- Hardened routes лишаються закритими: `/classic/install/`, `/tbc/donate.php`, `/wotlk/index.php?n=admin` = `403`.
- `/wotlk-azcore/` лишається `404`, доки live AzerothCore website service відсутній.
- Browser-side `#shared_topnav` на `/`, `/classic/`, `/tbc/`, `/wotlk/` має `height=45` і містить лише patch links `/classic/`, `/tbc/`, `/wotlk/`.
- На `/classic/`, `/tbc/`, `/wotlk/` і canonicalized `/` відповідний patch link має `is-active`; `WotLK + ACore` відсутній, коли `MW_ENABLE_AZCORE_LINK=0`.

Current live contract after `TASK-027`:

- `https://world-of-warcraft.morgan-dev.com/wotlk/` = `HTTP 200` і рендериться поверх AzerothCore auth DB без SQL traces.
- `https://world-of-warcraft.morgan-dev.com/wotlk-azcore/` = `HTTP 302` на canonical `/wotlk/`.
- Browser-side `#shared_topnav` на `/classic/`, `/tbc/`, `/wotlk/` і далі показує лише `/classic/`, `/tbc/`, `/wotlk/`; окремий `WotLK + ACore` link не є частиною поточного public UX contract.

Для local AzerothCore smoke після `TASK-011` acceptance інший, бо realm поки порожній:

```bash
docker compose \
  --env-file localProjects/cmangos_projects/docker-azerothcore/.env \
  -f localProjects/cmangos_projects/docker-azerothcore/docker-compose.yml \
  ps
docker logs azerothcore-authserver --tail 20
docker logs azerothcore-worldserver --tail 20
python3 localProjects/cmangos_projects/transfer/wow_login_test_universal.py \
  --expansion azerothcore --username ACBOT --password acbot --guid 1
```

Acceptance-gates для цього smoke:

- `azerothcore-authserver`, `azerothcore-worldserver`, `azerothcore-db` у `Up` / `healthy`
- bot доходить до `Auth proof: OK`, `Auth response: OK`, `Sent CHAR_ENUM`
- фінальний результат = `RESULT: NOT_FOUND`

Non-blocking note:

- `azerothcore-worldserver` може логувати `Addon packet read error` після smoke; станом на `TASK-011` це шум, а не failure.

Для focused local validation після `TASK-012` acceptance інший: це не full migration, а proof що AzerothCore account staging і verify path зійшлися.

Мінімальні gates:

- `bash -n localProjects/cmangos_projects/transfer/lib.sh`
- `bash -n localProjects/cmangos_projects/transfer/daily-sync.sh`
- ті самі два syntax checks проходять і під Linux `bash:5.2`
- synthetic source account, staged через `ensure_account wotlk azerothcore ...`, створює row в `acore_auth.account`
- `HEX(REVERSE(salt))` і `HEX(REVERSE(verifier))` на target збігаються з source `s/v`
- `account_access` зберігає `gmlevel` і пише `RealmID=-1`
- bot smoke для staged account доходить до `AUTH_OK`, `CHAR_ENUM`, `RESULT: NOT_FOUND`

Scope note:

- Це ще не замінює `TASK-013`. Після `TASK-012` ми маємо verified auth/account staging і empty-realm login smoke, але не verified post-migration player login на non-empty AzerothCore realm.

Для 3-run stability fixture після `TASK-006` використовуй окремий temp config:

```bash
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'SYNC_CONF=/opt/cmangos-transfer/sync-accounts.task006.conf /opt/cmangos-transfer/daily-sync.sh'
```

Expected gate sequence станом на `2026-03-15`:

- `Run 1` має дати `Accounts: 1`, `Synced: 4`, `Skipped: 0`, `Errors: 0` і вперше заповнити `source_hash` для `Testwar` і `Testhunt` на TBC/WotLK.
- `Run 2` без source changes має дати `Accounts: 1`, `Synced: 0`, `Skipped: 4`, `Errors: 0`; log має містити `unchanged since last verified sync` для обох персонажів на обох transfer phases.
- Оскільки `Run 2` не запускає pipeline verify для skipped chars, manual smoke після нього обов'язковий:
  - TBC/WotLK `CLASSACC/CLASSACC`, `guid=1804` → `RESULT: SUCCESS`
  - TBC/WotLK `CLASSACC/CLASSACC`, `guid=1805` → `RESULT: SUCCESS`
- Між `Run 2` і `Run 3` потрібно зробити point mutation у source, яка входить у hash:
  - backup `Testwar` row через `mariadb-dump --where="name=\"Testwar\""`
  - змінити Classic `Testwar.money` на `12345`
  - підтвердити, що Classic hash змінився на `297325587b3f1494baf0797de760d134`
- `Run 3` має дати `Accounts: 1`, `Synced: 2`, `Skipped: 2`, `Errors: 0`; pipeline verify має повернути `SUCCESS` для `Testwar` на TBC і WotLK, а `Testhunt` має лишитися skipped.
- Final SQL gate після `Run 3`:
  - TBC/WotLK `Testwar.money=12345`
  - TBC/WotLK `Testwar`: `at_login=0`, `online=0`, `sync_hash == source_hash == 297325587b3f1494baf0797de760d134`
  - TBC/WotLK `Testhunt`: `at_login=0`, `online=0`, `sync_hash == source_hash == de24036ebbf88879d126441f62539b4d`
- Final skipped-char smoke після `Run 3`:
  - TBC/WotLK `CLASSACC/CLASSACC`, `guid=1805` → `RESULT: SUCCESS`

## Чекліст релізу / live-зміни

### Перед remote change

- [ ] Acceptance-критерії задачі зафіксовані в backlog.
- [ ] Відомо, які саме remote paths / контейнер / БД буде змінено.
- [ ] Підготовлено backup, якщо буде DB mutation.
- [ ] Підготовлено health check або verify step після зміни.
- [ ] Користувацький апрув отримано, якщо зміна деструктивна або live-risky.

### Після remote change

- [ ] Перевірено readiness / health.
- [ ] Перевірено login verify або інший relevant smoke.
- [ ] Зафіксовано summary команд і результат.
- [ ] Оновлено `PROJECT_STATUS`, `BACKLOG`, `SESSION_LOG`, якщо зміна змінила реальність.

## Rollback

| Сценарій | Мінімальний rollback path | Примітки |
|---|---|---|
| Невдала DB mutation | Відновити останній `mariadb-dump`, перезапустити відповідний stack | Backup має бути зроблений до зміни |
| Креш game server після transfer | Restart відповідного stack, дочекатися `World initialized`, перевірити bot-ом | Legacy docs описують окремо WotLK crash recovery |
| Невдала інфраструктурна зміна | Повернути попередній compose/config state, перезапустити stack | Працювати тільки після явного опису rollback |

## Докази деплою / verify

Для кожної live-зміни зафіксуй:

- яке середовище було змінено;
- які саме команди були виконані;
- summary тестів / smoke;
- summary health checks;
- чи був потрібен rollback.

Зберігай ці докази у `BACKLOG.md` та `SESSION_LOG.md`.
