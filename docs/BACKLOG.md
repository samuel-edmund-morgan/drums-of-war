# Беклог

```text
BACKLOG_STATUS: ACTIVE
LAST_BACKLOG_UPDATE: 2026-03-24
```

Це канонічна черга робіт. Детальна історична декомпозиція legacy-фаз збережена в `docs/LEGACY_BACKLOG_ARCHIVE.md`.

## Легенда статусів

- `[ ]` не розпочато
- `[~]` у процесі
- `[+]` завершено
- `[!]` заблоковано
- `[-]` скасовано / замінено

## Активна черга

### `TASK-001` — `Мігрувати legacy-документацію в кореневий template`

- Status: `[>]`
- Priority: `P0`
- Module: `DOCS`
- Allowed roles: `Documentation / Analyst`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `workflow_config.md`, `remote_access.md`, `docs/`, migrated project-owned markdown у `localProjects/cmangos_projects`
- Touched paths: `workflow_config.md`, `remote_access.md`, `docs/`, `localProjects/cmangos_projects/AGENTS.md`, `localProjects/cmangos_projects/backlog.md`, `localProjects/cmangos_projects/coverage.md`, `localProjects/cmangos_projects/usage-guide.md`, `localProjects/cmangos_projects/docs/*.md`
- Пов'язані context files: `docs/TRANSFER_SYSTEM.md`, `docs/COVERAGE.md`, `docs/USAGE_GUIDE_CLASSIC.md`, `docs/LEGACY_AGENTS_ARCHIVE.md`, `docs/LEGACY_BACKLOG_ARCHIVE.md`, `docs/LEGACY_SESSION_LOG_ARCHIVE.md`
- Parallel-safe with: `SOURCE`
- Depends on: `none`

Мета:

- Перенести legacy workflow-контекст у канонічний root template без втрати backlog, доступів, рішень та специфічних документів.

Acceptance:

- Усі обов'язкові docs у корені ініціалізовані реальним контекстом CMaNGOS-проєкту.
- Legacy-specific документи або інтегровані в канонічні файли, або перенесені в `docs/` окремими артефактами.
- Project-owned migrated markdown у `localProjects/cmangos_projects` прибрані, але upstream/vendor markdown не зачеплені.

Subtasks:

- [x] Прочитати template docs і legacy workflow у визначеному порядку.
- [x] Перенести канонічний стан, модулі, рішення і backlog у root docs.
- [x] Створити / перевірити migrated archive docs у `docs/`.
- [x] Прибрати migrated project-owned markdown з legacy workspace.

Докази / верифікація:

- Прочитані `workflow_config.md`, `remote_access.md`, усі обов'язкові `docs/*.md`, legacy `AGENTS.md`, `backlog.md`, `coverage.md`, `usage-guide.md`, `docs/*.md`.
- Після правок перевірено migrated docs layer у `docs/` і видалено project-owned markdown з `localProjects/cmangos_projects`.

### `TASK-002` — `Live-перевірка runtime snapshot на workspace`

- Status: `[+]`
- Priority: `P1`
- Module: `OPS`
- Allowed roles: `DevOps / Infrastructure`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `workspace:/opt/cmangos-*`, `workspace:/opt/cmangos-transfer`, `docs/PROJECT_STATUS.md`, `docs/ARCHITECTURE.md`, `docs/COMMANDS_REFERENCE.md`
- Touched paths: `remote runtime`, `docs/PROJECT_STATUS.md`, `docs/ARCHITECTURE.md`, `docs/COMMANDS_REFERENCE.md`, `docs/SESSION_LOG.md`
- Пов'язані context files: `remote_access.md`, `docs/TRANSFER_SYSTEM.md`
- Parallel-safe with: `none`
- Depends on: `TASK-001`

Мета:

- Звірити migrated docs з реальною системою на `workspace` перед будь-якими наступними server-mutating роботами.

Acceptance:

- Підтверджено існування і стан Classic/TBC/WotLK контейнерів, remote paths і systemd timers.
- Зафіксовано відхилення між docs і реальністю, якщо вони є.
- Оновлені `PROJECT_STATUS`, `ARCHITECTURE`, `COMMANDS_REFERENCE`, `SESSION_LOG`.

Subtasks:

- [x] Підняти / перевірити SSH ControlMaster для `workspace`.
- [x] Перевірити docker stacks, remote paths і timers.
- [x] Зафіксувати результати та виправити docs.

Докази / верифікація:

- `ssh -o ControlPath=/tmp/ssh-ws -O check workspace` → `Master running (pid=58023)`
- `ssh -o ControlPath=/tmp/ssh-ws workspace 'pwd'` → `/home/samuel`
- `docker ps` на remote: усі 3 CMaNGOS DB і server контейнери healthy; додатково на хості працюють `powerbot-*` і `traefik`
- `systemctl list-timers "cmangos-*"`: active timers `cmangos-update.timer`, `cmangos-tbc-update.timer`, `cmangos-wotlk-update.timer`, `cmangos-daily-sync.timer`
- `/opt/cmangos-transfer` містить `daily-sync.sh`, `lib.sh`, `transfer-interactive.sh`, `wow_login_test.py`, `wow_login_test_universal.py`, `srp6_set_password.py`, `sync-accounts.conf`
- `systemctl status cmangos-daily-sync.service` → останній запуск `2026-03-14 04:02:52 EET`, `status=0/SUCCESS`
- `tail /opt/cmangos-transfer/logs/daily-sync-20260314.log` → WotLK verify для `Samuel (guid=1801)` = `SUCCESS`, totals: `Accounts 2`, `Synced 2`, `Errors 0`

### `TASK-003` — `Phase 15.1: single-account E2E pipeline`

- Status: `[+]`
- Priority: `P1`
- Module: `TRANSFER`
- Allowed roles: `QA / Test Automation`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `workspace:/opt/cmangos-transfer`, `workspace:/opt/cmangos-tbc`, `workspace:/opt/cmangos-wotlk`, target character/account data для `SAMUEL`
- Touched paths: `workspace:/opt/cmangos-transfer/sync-accounts.conf`, `workspace:/opt/cmangos-tbc`, `workspace:/opt/cmangos-wotlk`, `localProjects/cmangos_projects/transfer/`, `workflow_config.md`, `docs/ARCHITECTURE.md`, `docs/TRANSFER_SYSTEM.md`, `docs/COMMANDS_REFERENCE.md`, `docs/TESTING_AND_RELEASE.md`, `docs/SESSION_LOG.md`, `docs/PROJECT_STATUS.md`
- Пов'язані context files: `docs/TRANSFER_SYSTEM.md`, `docs/LEGACY_BACKLOG_ARCHIVE.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-002`

Мета:

- Підтвердити happy-path для `Classic → TBC verify → WotLK verify` на одному акаунті.

Acceptance:

- `daily-sync.sh` проходить для `SAMUEL` без крешів.
- Login verify на TBC і WotLK дає `SUCCESS`.
- Перевірено що `at_login=0` після normalize/login step.

Subtasks:

- [x] Нормалізувати runtime preconditions для single-account сценарію: `sync-accounts.conf`, пароль `SAMUEL`, очистка цільових персонажів.
- [x] Запустити single-account sync.
- [x] Зібрати login-bot і DB докази.
- [x] Задокументувати результат.

Докази / верифікація:

- Runtime prep `2026-03-14 20:46 EET`: `/opt/cmangos-transfer/sync-accounts.conf` → `samuel:samuel`; рядок `ADMIN` прибрано.
- Backup до мутацій: `/opt/cmangos-transfer/backups/sync-accounts.conf.pre_task003_20260314_204025`, `/opt/cmangos-tbc/backups/tbccharacters.pre_task003_20260314_204025.sql`, `/opt/cmangos-tbc/backups/tbcrealmd.account.pre_task003_20260314_204025.sql`, `/opt/cmangos-wotlk/backups/wotlkcharacters.pre_task003_20260314_204025.sql`, `/opt/cmangos-wotlk/backups/wotlkrealmd.account.pre_task003_20260314_204025.sql`.
- TBC/WotLK `SAMUEL` SRP6 змінено на verifier для `samuel`; обидва target realm-и після цього проходять auth до `CHAR_ENUM` (`RESULT: NOT_FOUND`, `0 character(s)`).
- `SELECT COUNT(*) FROM characters` і `SELECT COUNT(*) FROM character_sync_hash WHERE char_name="Samuel"` на TBC/WotLK дають `0`.
- `daily-sync.sh` (`2026-03-14 20:57 EET`) → `Accounts: 1`, `Synced: 2`, `Skipped: 0`, `Created: 0`, `Errors: 0`, `Duration: 2m 55s`.
- Під час run-а Phase B дала `Samuel (guid=1801) — SUCCESS` на TBC, а Phase D — `Samuel (guid=1801) — SUCCESS` на WotLK.
- Post-run manual login bot:
  - TBC: `RESULT: SUCCESS` для `SAMUEL/samuel`, `guid=1801`
  - WotLK: `RESULT: SUCCESS` для `SAMUEL/samuel`, `guid=1801`
- Post-run SQL:
  - TBC `SELECT guid,account,name,level,at_login,online ...` → `1801 / 10 / Samuel / 60 / 0 / 0`
  - WotLK `SELECT guid,account,name,level,at_login,online ...` → `1801 / 12 / Samuel / 60 / 0 / 0`
  - `character_sync_hash` rows exist on both targets: TBC from `classic`, WotLK from `tbc`

### `TASK-020` — `Перенести оновлення character_sync_hash на post-verify фазу`

- Status: `[+]`
- Priority: `P1`
- Module: `TRANSFER`
- Allowed roles: `Backend Developer`, `QA / Test Automation`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/transfer/daily-sync.sh`, `localProjects/cmangos_projects/transfer/lib.sh`, `workspace:/opt/cmangos-transfer/daily-sync.sh`, `docs/TRANSFER_SYSTEM.md`
- Touched paths: `localProjects/cmangos_projects/transfer/daily-sync.sh`, `workspace:/opt/cmangos-transfer/daily-sync.sh`, `docs/PROJECT_STATUS.md`, `docs/TRANSFER_SYSTEM.md`, `docs/COMMANDS_REFERENCE.md`, `docs/TESTING_AND_RELEASE.md`, `docs/SESSION_LOG.md`, `docs/BACKLOG.md`
- Пов'язані context files: `docs/TRANSFER_SYSTEM.md`
- Parallel-safe with: `DOCS`, `SOURCE`
- Depends on: `TASK-003`

Мета:

- Прибрати ризик хибного `SKIP` на наступному daily sync через те, що програмний login verify змінює поля персонажа вже після того, як `character_sync_hash` був збережений.

Acceptance:

- `daily-sync.sh` більше не викликає `store_hash()` одразу після `do_transfer_char()`.
- Хеш перераховується й зберігається тільки після успішного verify на відповідній фазі (`TBC` або `WotLK`).
- `TRANSFER_SYSTEM.md` описує новий порядок lifecycle хеша.

Subtasks:

- [x] Перенести `store_hash()` з `sync_char()` у post-verify гілки Phases B і D.
- [x] Переконатися, що rollback / failed verify не залишає “помилково свіжий” hash.
- [x] Оновити docs і зафіксувати rationale в session log.

Докази / верифікація:

- Local `daily-sync.sh`: `sync_char()` більше не викликає `store_hash()`; synced chars трекаються точно як `username:guid:name:from_exp`, а hash пишеться тільки через `store_verified_hash_after_login()` у Phases B і D.
- Remote backup: `/opt/cmangos-transfer/backups/daily-sync.sh.pre_task020_20260314_214250`; новий script задеплоєно на `workspace` і пройшов `bash -n`.
- Pre-fix stale rows були підтверджені live:
  - TBC `current_hash=c1f010444c5f03e65525fde700617e2b`, `stored_hash=202f9c17a8f9d18929564ec046900e26`
  - WotLK `current_hash=ccb7896f7283eeb6b948a4ce7a3372f0`, `stored_hash=c1f010444c5f03e65525fde700617e2b`
- Для чесного repeat-run verification виконано one-time realignment існуючих stale-hash rows до поточного state `Samuel` на TBC/WotLK; це підготовчий крок, а не частина нового lifecycle.
- Verification run (`2026-03-14 21:47 EET` local start window) пройшов з `Accounts: 1`, `Synced: 2`, `Skipped: 0`, `Errors: 0`, `Duration: 3m 9s`.
- У логові нового run-а є обидва рядки:
  - `Stored post-verify hash for Samuel on tbc`
  - `Stored post-verify hash for Samuel on wotlk`
- Post-run DB proof:
  - TBC `current_hash == stored_hash == c1f010444c5f03e65525fde700617e2b`, `synced_from=classic`
  - WotLK `current_hash == stored_hash == ccb7896f7283eeb6b948a4ce7a3372f0`, `synced_from=tbc`
- Повторний sync більше не потребує pre-transfer hash write і не залишає “помилково свіжий” hash після verify на цьому verified сценарії.

### `TASK-004` — `Phase 15.2: multi-account сценарії`

- Status: `[+]`
- Priority: `P1`
- Module: `TRANSFER`
- Allowed roles: `QA / Test Automation`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `workspace:/opt/cmangos-transfer`, account set для multi-account verify
- Touched paths: `localProjects/cmangos_projects/transfer/lib.sh`, `workspace:/opt/cmangos-transfer/lib.sh`, `workspace:/opt/cmangos-transfer/sync-accounts.task004.conf`, `workspace:/opt/cmangos-tbc`, `workspace:/opt/cmangos-wotlk`, `docs/PROJECT_STATUS.md`, `docs/TRANSFER_SYSTEM.md`, `docs/COMMANDS_REFERENCE.md`, `docs/TESTING_AND_RELEASE.md`, `docs/SESSION_LOG.md`, `docs/DECISIONS.md`
- Пов'язані context files: `docs/LEGACY_BACKLOG_ARCHIVE.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-003`

Мета:

- Перевірити `SYNC / SKIP / AUTO-CREATE` сценарії на 2-3 акаунтах.

Acceptance:

- Summary пайплайну правильно відображає synced, skipped і created сценарії.
- Не виникає крешів або зависань на verify step.

Subtasks:

- [x] Підготувати multi-account набір.
- [x] Запустити сценарій і зберегти summary.
- [x] Зафіксувати результати в docs.

Докази / верифікація:

- Local `lib.sh` patched so `ensure_account()` increments `TOTAL_CREATED`; fix deployed to `/opt/cmangos-transfer/lib.sh` and passed `bash -n`.
- Temporary non-admin config created at `/opt/cmangos-transfer/sync-accounts.task004.conf` with `samuel:samuel`, `autoacc:autoacc`, `skipacc:skipacc`; canonical `/opt/cmangos-transfer/sync-accounts.conf` was left untouched.
- Initial run exposed fixture-only contamination: synthetic `Autolock` and target `Skiplock` reused the same item GUID set, which produced `safe_insert` warnings and zero items for `Autolock`; root cause was diagnosed live by comparing source/target item GUID overlap (`313/313`) and cleanup/retry fixture was prepared.
- Cleanup/retry backups: `/opt/cmangos-tbc/backups/tbccharacters.pre_task004_retry_20260314_222101.sql`, `/opt/cmangos-tbc/backups/tbcrealmd.account.pre_task004_retry_20260314_222101.sql`, `/opt/cmangos-wotlk/backups/wotlkcharacters.pre_task004_retry_20260314_222101.sql`, `/opt/cmangos-wotlk/backups/wotlkrealmd.account.pre_task004_retry_20260314_222101.sql`.
- Clean verified rerun (`2026-03-14 22:26 EET`) with `SYNC_CONF=/opt/cmangos-transfer/sync-accounts.task004.conf /opt/cmangos-transfer/daily-sync.sh` → `Accounts 3`, `Synced 4`, `Skipped 2`, `Created 2`, `Errors 0`, `Duration 3m 15s`.
- Final log section contains `AUTO-CREATED account 'AUTOACC' on tbc`, `AUTO-CREATED account 'AUTOACC' on wotlk`, `SKIP: 'Skiplock' was PLAYED on tbc`, `SKIP: 'Skiplock' was PLAYED on wotlk`, and no `WARN:` lines.
- Post-run SQL:
  - TBC accounts: `SAMUEL=10`, `SKIPACC=12`, `AUTOACC=14`; chars `Samuel=1801`, `Autolock=1802`, `Skiplock=1803`.
  - WotLK accounts: `SAMUEL=12`, `SKIPACC=14`, `AUTOACC=16`; chars `Samuel=1801`, `Autolock=1802`, `Skiplock=1803`.
  - `Autolock` inventory/item counts now match healthy target state on both targets: `168 inventory`, `313 item_instance`; `current_hash == stored_hash` on TBC and WotLK.
  - `Skiplock` stays on deliberate stale-hash path with `current_hash != deadbeef...` on both targets.
- Manual login bot after clean rerun:
  - TBC `AUTOACC/AUTOACC`, `guid=1802` → `RESULT: SUCCESS`
  - WotLK `AUTOACC/AUTOACC`, `guid=1802` → `RESULT: SUCCESS`
  - TBC `SKIPACC/SKIPACC`, `guid=1803` → `RESULT: SUCCESS`
  - WotLK `SKIPACC/SKIPACC`, `guid=1803` → `RESULT: SUCCESS`

### `TASK-005` — `Phase 15.3: class coverage verify`

- Status: `[+]`
- Priority: `P2`
- Module: `TRANSFER`
- Allowed roles: `QA / Test Automation`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `workspace` target characters for warrior / hunter / warlock tests, `localProjects/cmangos_projects/transfer/daily-sync.sh`, `localProjects/cmangos_projects/transfer/wow_login_test_universal.py`, `workspace:/opt/cmangos-transfer/daily-sync.sh`, `workspace:/opt/cmangos-transfer/wow_login_test_universal.py`
- Touched paths: `localProjects/cmangos_projects/transfer/daily-sync.sh`, `localProjects/cmangos_projects/transfer/wow_login_test_universal.py`, `localProjects/cmangos_projects/transfer/sync-accounts.task005*.conf`, `workspace:/opt/cmangos-classic`, `workspace:/opt/cmangos-tbc`, `workspace:/opt/cmangos-wotlk`, `workspace:/opt/cmangos-transfer`, `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, `docs/TRANSFER_SYSTEM.md`, `docs/SESSION_LOG.md`, `docs/COMMANDS_REFERENCE.md`, `docs/TESTING_AND_RELEASE.md`
- Пов'язані context files: `docs/LEGACY_BACKLOG_ARCHIVE.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-003`

Мета:

- Переконатися, що різні класи з різними power / pet mechanics проходять verify.

Acceptance:

- Мінімум Warlock, Warrior і Hunter проходять verify на TBC і WotLK.
- Висновки задокументовані.

Subtasks:

- [x] Створити / підготувати тестових персонажів.
- [x] Прогнати verify на TBC і WotLK.
- [x] Задокументувати класові відмінності, якщо знайдені.

Докази / верифікація:

- Prep/backups:
  - Initial fixture backups: `/opt/cmangos-classic/backups/classiccharacters.pre_task005_20260314_224643.sql`, `/opt/cmangos-classic/backups/classicrealmd.account.pre_task005_20260314_224643.sql`, `/opt/cmangos-tbc/backups/tbccharacters.pre_task005_20260314_224643.sql`, `/opt/cmangos-tbc/backups/tbcrealmd.account.pre_task005_20260314_224643.sql`, `/opt/cmangos-wotlk/backups/wotlkcharacters.pre_task005_20260314_224643.sql`, `/opt/cmangos-wotlk/backups/wotlkrealmd.account.pre_task005_20260314_224643.sql`.
  - Scenario configs created locally/remotely: `sync-accounts.task005.conf`, `sync-accounts.task005.classacc-only.conf`.
- Fixture shaping:
  - `CLASSACC` source account created on Classic with `Testwar (guid=1804)` and `Testhunt (guid=1805)`.
  - Початковий `Human Hunter` був доведено невалідним already on Classic (`GUID=1805 not found in character list`); source fixture вирівняно до `Dwarf Hunter (race=3,class=3)` і no-pet state `stable_slots=0`.
  - Після цього Classic manual bot дав `RESULT: SUCCESS` для `Testwar` і `Testhunt`.
- Runtime fixes discovered and deployed during `TASK-005`:
  - `daily-sync.sh` now retries a failed verify once before rollback; remote backups: `/opt/cmangos-transfer/backups/daily-sync.sh.pre_task005_retryfix_20260314_230854`, `/opt/cmangos-transfer/backups/daily-sync.sh.pre_task005_debug_20260314_231637`.
  - `wow_login_test_universal.py` WotLK parser now skips the 4-byte `customize flags` field in `SMSG_CHAR_ENUM`; remote backup: `/opt/cmangos-transfer/backups/wow_login_test_universal.py.pre_task005_charenum_20260314_232159`.
  - Root cause of the last WotLK hunter false negative was verified live: the character row existed as `1805 / 17 / Testhunt / race=3 / class=3`, but the pre-fix bot misparsed multi-character `CHAR_ENUM` and returned `NOT_FOUND`.
- Final isolated class-coverage rerun:
  - `SYNC_CONF=/opt/cmangos-transfer/sync-accounts.task005.classacc-only.conf /opt/cmangos-transfer/daily-sync.sh`
  - Summary: `Accounts 1`, `Synced 4`, `Skipped 0`, `Created 0`, `Errors 0`, `Duration 3m 53s`
  - Phase B: `Testwar` and `Testhunt` both `SUCCESS` on TBC with `Stored post-verify hash ...`
  - Phase D: `Testwar` and `Testhunt` both `SUCCESS` on WotLK with `Stored post-verify hash ...`
- Canonical baseline restore:
  - `/opt/cmangos-transfer/daily-sync.sh` after the fixes restored `Samuel` on TBC and re-verified him on both targets.
  - Summary: `Accounts 1`, `Synced 2`, `Skipped 0`, `Created 0`, `Errors 0`, `Duration 3m 29s`
- Final sequential manual login smokes:
  - TBC `SAMUEL/SAMUEL`, `guid=1801` → `RESULT: SUCCESS`
  - WotLK `SAMUEL/SAMUEL`, `guid=1801` → `RESULT: SUCCESS`
  - TBC `CLASSACC/CLASSACC`, `guid=1804` → `RESULT: SUCCESS`
  - WotLK `CLASSACC/CLASSACC`, `guid=1804` → `RESULT: SUCCESS`
  - TBC `CLASSACC/CLASSACC`, `guid=1805` → `RESULT: SUCCESS`
  - WotLK `CLASSACC/CLASSACC`, `guid=1805` → `RESULT: SUCCESS`
- Post-run SQL:
  - TBC characters: `1801/Samuel`, `1804/Testwar`, `1805/Testhunt`, all with `at_login=0`, `online=0`
  - WotLK characters: `1801/Samuel`, `1804/Testwar`, `1805/Testhunt`, all with `at_login=0`, `online=0`
  - `character_sync_hash` rows present and healthy:
    - TBC: `Samuel=c1f010444c5f03e65525fde700617e2b`, `Testwar=de24036ebbf88879d126441f62539b4d`, `Testhunt=de24036ebbf88879d126441f62539b4d`
    - WotLK: `Samuel=ccb7896f7283eeb6b948a4ce7a3372f0`, `Testwar=de24036ebbf88879d126441f62539b4d`, `Testhunt=de24036ebbf88879d126441f62539b4d`

### `TASK-006` — `Phase 15.4: 3-run stability test`

- Status: `[+]`
- Priority: `P2`
- Module: `TRANSFER`
- Allowed roles: `QA / Test Automation`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/transfer/daily-sync.sh`, `localProjects/cmangos_projects/transfer/lib.sh`, `workspace:/opt/cmangos-transfer`, synchronized accounts set
- Touched paths: `localProjects/cmangos_projects/transfer/daily-sync.sh`, `localProjects/cmangos_projects/transfer/lib.sh`, `localProjects/cmangos_projects/transfer/sync-accounts.task006.conf`, `workspace:/opt/cmangos-transfer/daily-sync.sh`, `workspace:/opt/cmangos-transfer/lib.sh`, `workspace:/opt/cmangos-transfer/sync-accounts.task006.conf`, `workspace:/opt/cmangos-classic`, `workspace:/opt/cmangos-tbc`, `workspace:/opt/cmangos-wotlk`, `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, `docs/TRANSFER_SYSTEM.md`, `docs/COMMANDS_REFERENCE.md`, `docs/TESTING_AND_RELEASE.md`, `docs/SESSION_LOG.md`, `docs/DECISIONS.md`
- Пов'язані context files: `docs/LEGACY_BACKLOG_ARCHIVE.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-004`, `TASK-005`

Мета:

- Підтвердити відсутність регресій на трьох послідовних запусків daily-sync.

Acceptance:

- Run 1 дає повний sync, Run 2 дає skip, Run 3 коректно синхронізує змінений персонаж.
- Жоден із трьох запусків не призводить до крешу або manual recovery.

Subtasks:

- [x] Запустити три послідовні сценарії.
- [x] Змінити персонажа між Run 2 і Run 3.
- [x] Підсумувати стабільність у docs.

Докази / верифікація:

- Local `daily-sync.sh` і `lib.sh` розширено dual-baseline логікою: `character_sync_hash` тепер містить і `sync_hash`, і `source_hash`, що дозволяє відрізняти `played on target` від `unchanged since last verified sync`; remote backups: `/opt/cmangos-transfer/backups/daily-sync.sh.pre_task006_sourcehash_20260314_235026`, `/opt/cmangos-transfer/backups/lib.sh.pre_task006_sourcehash_20260314_235026`.
- Temp config для ізольованого stability run: `localProjects/cmangos_projects/transfer/sync-accounts.task006.conf` і `/opt/cmangos-transfer/sync-accounts.task006.conf` з `classacc:classacc`.
- Pre-run proof: перед `Run 1` на TBC/WotLK `character_sync_hash` ще не мав `source_hash`; `Run 1` therefore логував `No stored source hash — refreshing baseline`.
- `Run 1` → `Accounts 1`, `Synced 4`, `Skipped 0`, `Created 0`, `Errors 0`, `Duration 4m 1s`; `Testwar` і `Testhunt` verified `SUCCESS` on TBC/WotLK, а post-run SQL підтвердив нову колонку `source_hash` і healthy rows:
  - TBC: `Testwar/Testhunt sync_hash == source_hash == de24036ebbf88879d126441f62539b4d`, `synced_from=classic`
  - WotLK: `Testwar/Testhunt sync_hash == source_hash == de24036ebbf88879d126441f62539b4d`, `synced_from=tbc`
- `Run 2` без source changes → `Accounts 1`, `Synced 0`, `Skipped 4`, `Created 0`, `Errors 0`, `Duration 2m 14s`; log містить `SKIP: 'Testwar' unchanged since last verified sync` і `SKIP: 'Testhunt' unchanged since last verified sync` на обох transfer phases.
- Post-`Run 2` manual login bot, executed sequentially:
  - TBC/WotLK `CLASSACC/CLASSACC`, `guid=1804` → `RESULT: SUCCESS`
  - TBC/WotLK `CLASSACC/CLASSACC`, `guid=1805` → `RESULT: SUCCESS`
- Перед `Run 3` зроблено row-level backup Classic fixture: `/opt/cmangos-classic/backups/classiccharacters.testwar.pre_task006_run3_20260314_235852.sql`.
- Source mutation між `Run 2` і `Run 3`: Classic `Testwar.money` змінено з `0` на `12345`; Classic hash змінився з `de24036ebbf88879d126441f62539b4d` на `297325587b3f1494baf0797de760d134`.
- `Run 3` → `Accounts 1`, `Synced 2`, `Skipped 2`, `Created 0`, `Errors 0`, `Duration 3m 6s`; Phase A і Phase C обидві дали `Testwar` = `SYNCED`, `Testhunt` = `SKIP`, а pipeline verify дав `SUCCESS` для `Testwar` на TBC і WotLK без rollback/manual recovery.
- Final post-run SQL:
  - Classic `Testwar.money=12345`, hash `297325587b3f1494baf0797de760d134`
  - TBC `Testwar.money=12345`, `at_login=0`, `online=0`, `sync_hash == source_hash == 297325587b3f1494baf0797de760d134`, `synced_from=classic`
  - WotLK `Testwar.money=12345`, `at_login=0`, `online=0`, `sync_hash == source_hash == 297325587b3f1494baf0797de760d134`, `synced_from=tbc`
  - TBC/WotLK `Testhunt` лишився незмінним з `money=0`, `at_login=0`, `online=0`, `sync_hash == source_hash == de24036ebbf88879d126441f62539b4d`
- Final skipped-char smoke after `Run 3`: TBC/WotLK `CLASSACC/CLASSACC`, `guid=1805` → `RESULT: SUCCESS`.
- `docker ps | grep cmangos` після фінального run-а → всі 6 `cmangos-*` контейнерів `healthy`.

### `TASK-007` — `Оновити docs після Phase 15`

- Status: `[+]`
- Priority: `P1`
- Module: `DOCS`
- Allowed roles: `Documentation / Analyst`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `docs/PROJECT_STATUS.md`, `docs/PROJECT_BRIEF.md`, `docs/TRANSFER_SYSTEM.md`, `docs/SESSION_LOG.md`, `docs/CONTINUATION_GUIDE.md`, `docs/BACKLOG.md`
- Touched paths: `docs/PROJECT_STATUS.md`, `docs/PROJECT_BRIEF.md`, `docs/TRANSFER_SYSTEM.md`, `docs/SESSION_LOG.md`, `docs/CONTINUATION_GUIDE.md`, `docs/BACKLOG.md`
- Пов'язані context files: `docs/LEGACY_BACKLOG_ARCHIVE.md`
- Parallel-safe with: `SOURCE`
- Depends on: `TASK-003`, `TASK-004`, `TASK-005`, `TASK-006`

Мета:

- Після завершення стабілізаційної хвилі привести docs у повну відповідність до verified reality.

Acceptance:

- `PROJECT_STATUS`, `TRANSFER_SYSTEM`, `CONTINUATION_GUIDE`, `SESSION_LOG` і `BACKLOG` оновлені.
- Stage `stabilization` скоригована за фактичним результатом.

Subtasks:

- [x] Оновити статус і continuation notes.
- [x] Перенести докази тестів у session log і backlog.
- [x] Закрити відповідні Phase 15 задачі.

Докази / верифікація:

- High-level docs вирівняно до post-Phase-15 reality:
  - `docs/PROJECT_STATUS.md` більше не тримає stage `stabilization`; новий stage = `post-Phase-15 planning`, current focus = `Phase 16 AzerothCore preparation`, next backlog item = `TASK-008`
  - `docs/PROJECT_BRIEF.md` тепер описує verified root docs + stable 3-step pipeline як уже досягнутий baseline, а не як майбутній намір
  - `docs/CONTINUATION_GUIDE.md` отримав секцію `Поточний Verified Baseline` і більше не веде нового агента в pre-Phase-15 стан
- `docs/TRANSFER_SYSTEM.md` оновлено short status note на початку документа: Phase 15 для transfer pipeline вже verified-complete, наступний major stream = Phase 16.
- `docs/SESSION_LOG.md` доповнено окремим записом `2026-03-15 00:03` для `TASK-006`; `TASK-007` закриває docs-side consolidation цього verified baseline.
- Review checks:
  - `rg` по `PROJECT_BRIEF`, `PROJECT_STATUS`, `CONTINUATION_GUIDE`, `BACKLOG` більше не знаходить continuation hints типу "після міграції docs перейти до Phase 15" як актуального next step
  - `docs/BACKLOG.md` після закриття `TASK-007` коректно вказує на `TASK-008` як наступну відкриту задачу

### `TASK-008` — `Phase 16.1: AzerothCore контейнер`

- Status: `[+]`
- Priority: `P3`
- Module: `INFRA`
- Allowed roles: `DevOps / Infrastructure`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/docker-azerothcore/`, `docs/ARCHITECTURE.md`, `docs/PROJECT_STATUS.md`, `docs/PROJECT_BRIEF.md`, `docs/CONTINUATION_GUIDE.md`, `docs/COMMANDS_REFERENCE.md`, `docs/DECISIONS.md`, `docs/SESSION_LOG.md`, `docs/BACKLOG.md`
- Touched paths: `localProjects/cmangos_projects/docker-azerothcore/docker-compose.yml`, `localProjects/cmangos_projects/docker-azerothcore/.env.example`, `localProjects/cmangos_projects/docker-azerothcore/env/etc/.gitkeep`, `localProjects/cmangos_projects/docker-azerothcore/env/logs/.gitkeep`, `docs/ARCHITECTURE.md`, `docs/PROJECT_STATUS.md`, `docs/PROJECT_BRIEF.md`, `docs/CONTINUATION_GUIDE.md`, `docs/COMMANDS_REFERENCE.md`, `docs/DECISIONS.md`, `docs/SESSION_LOG.md`, `docs/BACKLOG.md`
- Пов'язані context files: `docs/LEGACY_BACKLOG_ARCHIVE.md`
- Parallel-safe with: `DOCS`, `SOURCE`
- Depends on: `TASK-007`

Мета:

- Підготувати базовий ARM64-compatible AzerothCore runtime для future 4-step pipeline.

Acceptance:

- Задокументовано спосіб розгортання і базовий docker stack.

Subtasks:

- [x] Дослідити офіційні images.
- [x] За потреби спроєктувати build з вихідників.
- [x] Описати stack і порти.

Докази / верифікація:

- Official source review через `gh api` підтвердив два підтримувані upstream deployment paths:
  - `azerothcore/acore-docker` — prebuilt-image compose з сервісами `ac-database`, `ac-authserver`, `ac-worldserver`, `ac-db-import`, `ac-client-data`
  - `azerothcore/azerothcore-wotlk` — official source tree з build-capable `docker-compose.yml` і Dockerfile targets (`db-import`, `client-data`, `authserver`, `worldserver`)
- Локально додано draft stack у `localProjects/cmangos_projects/docker-azerothcore/`:
  - `docker-compose.yml`
  - `.env.example`
  - `env/etc/.gitkeep`
  - `env/logs/.gitkeep`
- Draft stack резервує окремі порти поруч із наявними CMaNGOS stack-ами: DB `3309`, auth `3727`, world `8088`, SOAP `7879`.
- Draft compose підтримує обидва режими:
  - prebuilt `acore/*` image path
  - preferred ARM64 path через local build з `${AZEROTHCORE_SRC:-../azerothcore-wotlk}`
- `docker compose --env-file localProjects/cmangos_projects/docker-azerothcore/.env.example -f localProjects/cmangos_projects/docker-azerothcore/docker-compose.yml config` пройшов успішно; build contexts резолвляться до локального `azerothcore-wotlk`, а service graph містить `azerothcore-db`, `azerothcore-db-import`, `azerothcore-client-data-init`, `azerothcore-worldserver`, `azerothcore-authserver`.
- Огляд official Docker CI у `azerothcore-wotlk` не показав явного `platforms:` matrix для pushed images; тому prebuilt `acore/*` images не зафіксовані як guaranteed ARM64 baseline і рішенням `TASK-008` обрано local-build path як safer default.
- `TASK-008` не робив live deploy і не мутував `workspace`; це docs/local-only baseline task.

### `TASK-009` — `Phase 16.2: AzerothCore schema mapping`

- Status: `[+]`
- Priority: `P3`
- Module: `TRANSFER`
- Allowed roles: `Backend Developer`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `docs/AZEROTHCORE_SCHEMA_MAPPING.md`, `docs/TRANSFER_SYSTEM.md`, `docs/ARCHITECTURE.md`, `docs/PROJECT_BRIEF.md`, `docs/PROJECT_STATUS.md`, `docs/CONTINUATION_GUIDE.md`, `docs/COMMANDS_REFERENCE.md`, `docs/DECISIONS.md`, `docs/SESSION_LOG.md`, `docs/BACKLOG.md`, schema research against `localProjects/cmangos_projects/*` and official AzerothCore sources
- Touched paths: `docs/AZEROTHCORE_SCHEMA_MAPPING.md`, `docs/TRANSFER_SYSTEM.md`, `docs/ARCHITECTURE.md`, `docs/PROJECT_BRIEF.md`, `docs/PROJECT_STATUS.md`, `docs/CONTINUATION_GUIDE.md`, `docs/COMMANDS_REFERENCE.md`, `docs/DECISIONS.md`, `docs/SESSION_LOG.md`, `docs/BACKLOG.md`, `localProjects/cmangos_projects/azerothcore-wotlk/`
- Пов'язані context files: `docs/LEGACY_BACKLOG_ARCHIVE.md`
- Parallel-safe with: `DOCS`, `SOURCE`
- Depends on: `TASK-008`

Мета:

- Порівняти CMaNGOS-WotLK і AzerothCore schema для майбутнього transfer step.

Acceptance:

- Є documented table/column mapping і список несумісностей.

Subtasks:

- [x] Порівняти INFORMATION_SCHEMA.
- [x] Виписати mapping і blockers.

Докази / верифікація:

- Read-only live source snapshot:
  - `workspace:wotlkcharacters` `INFORMATION_SCHEMA.COLUMNS` exported to local TSV (`697` rows)
  - `workspace:wotlkrealmd` `INFORMATION_SCHEMA.COLUMNS` exported to local TSV (`77` rows)
- Official target snapshot:
  - local sparse checkout `localProjects/cmangos_projects/azerothcore-wotlk/` limited to `data/sql/base/db_characters` and `data/sql/base/db_auth`
- High-level counts:
  - `db_characters`: `78` CMaNGOS tables vs `106` AzerothCore tables, `59` same-name shared
  - `db_auth`: `13` CMaNGOS tables vs `18` AzerothCore tables, `6` same-name shared
- Current `transfer.sh` table-set coverage:
  - `45` relevant pipeline tables
  - `43` already same-name on AzerothCore
  - `1` explicit rename: `character_tutorial -> account_tutorial`
  - `1` missing target table: `character_battleground_data`
- Canonical mapping artifact created: `docs/AZEROTHCORE_SCHEMA_MAPPING.md`
- Verified blocker list documented:
  - auth/account transform (`account` + `account_access`)
  - explicit mapping for `characters`, `character_homebind`, `character_spell`, `character_talent`, `character_glyphs`, `character_queststatus`, `character_aura`, `pet_aura`, `guild_member`
  - policy decision still needed for `character_battleground_data`

### `TASK-010` — `Phase 16.3: SQL migration до AzerothCore`

- Status: `[+]`
- Priority: `P3`
- Module: `TRANSFER`
- Allowed roles: `Backend Developer`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/transfer/migrate_cmangos_wotlk_to_azerothcore.sql`, `docs/TRANSFER_SYSTEM.md`, `docs/PROJECT_STATUS.md`, `docs/PROJECT_BRIEF.md`, `docs/CONTINUATION_GUIDE.md`, `docs/COMMANDS_REFERENCE.md`, `docs/DECISIONS.md`, `docs/TESTING_AND_RELEASE.md`, `docs/BACKLOG.md`, `docs/SESSION_LOG.md`
- Touched paths: `localProjects/cmangos_projects/transfer/migrate_cmangos_wotlk_to_azerothcore.sql`, `docs/TRANSFER_SYSTEM.md`, `docs/PROJECT_STATUS.md`, `docs/PROJECT_BRIEF.md`, `docs/CONTINUATION_GUIDE.md`, `docs/COMMANDS_REFERENCE.md`, `docs/DECISIONS.md`, `docs/TESTING_AND_RELEASE.md`, `docs/BACKLOG.md`, `docs/SESSION_LOG.md`
- Пов'язані context files: `docs/LEGACY_BACKLOG_ARCHIVE.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-009`

Мета:

- Створити migration SQL для `cmangos-wotlk → azerothcore`.

Acceptance:

- Існує migration SQL з documented assumptions.

Subtasks:

- [x] Створити SQL skeleton.
- [x] Описати per-table rules.

Докази / верифікація:

- Створено executable temp-DB migration file: `localProjects/cmangos_projects/transfer/migrate_cmangos_wotlk_to_azerothcore.sql`
- Зафіксовані явні transforms для:
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
- Явно зафіксовані MVP assumptions:
  - temp DB + `safe_insert()` path only
  - full AzerothCore DB replace не підтримується
  - `character_talent` лишається reset-on-login blocker
  - auth/account path задокументовано як staged contract, не як executable characters-DB section
- Verified local validation:
  - read-only live dump `workspace:wotlkcharacters --no-data` exported to `/tmp/task010_wotlk_no_data.sql` (`1701` lines)
  - локальна throwaway `mariadb:11` успішно імпортувала source schema і новий migration SQL без помилок
  - post-run proof: присутні `account_tutorial`, `character_queststatus_rewarded`, `guild_member_withdraw`, `character_talent`, `character_aura`, `pet_aura`, `corpse`

### `TASK-011` — `Phase 16.4: login bot support для AzerothCore`

- Status: `[+]`
- Priority: `P3`
- Module: `TRANSFER`
- Allowed roles: `Backend Developer`, `QA / Test Automation`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/transfer/wow_login_test_universal.py`, `localProjects/cmangos_projects/transfer/migrate_cmangos_wotlk_to_azerothcore.sql`, `localProjects/cmangos_projects/docker-azerothcore/`, `docs/PROJECT_BRIEF.md`, `docs/PROJECT_STATUS.md`, `docs/CONTINUATION_GUIDE.md`, `docs/ARCHITECTURE.md`, `docs/TRANSFER_SYSTEM.md`, `docs/COMMANDS_REFERENCE.md`, `docs/DECISIONS.md`, `docs/TESTING_AND_RELEASE.md`, `docs/BACKLOG.md`, `docs/SESSION_LOG.md`
- Touched paths: `localProjects/cmangos_projects/transfer/wow_login_test_universal.py`, `localProjects/cmangos_projects/transfer/migrate_cmangos_wotlk_to_azerothcore.sql`, `localProjects/cmangos_projects/docker-azerothcore/`, `docs/PROJECT_BRIEF.md`, `docs/PROJECT_STATUS.md`, `docs/CONTINUATION_GUIDE.md`, `docs/ARCHITECTURE.md`, `docs/TRANSFER_SYSTEM.md`, `docs/COMMANDS_REFERENCE.md`, `docs/DECISIONS.md`, `docs/TESTING_AND_RELEASE.md`, `docs/BACKLOG.md`, `docs/SESSION_LOG.md`
- Пов'язані context files: `docs/LEGACY_BACKLOG_ARCHIVE.md`
- Parallel-safe with: `DOCS`, `SOURCE`
- Depends on: `TASK-008`

Мета:

- Перевірити або адаптувати login bot для AzerothCore runtime.

Acceptance:

- Бот або працює як `wotlk` alias, або має окрему documented adaptation.

Subtasks:

- [x] Протестувати існуючий bot проти AzerothCore.
- [x] За потреби додати alias / адаптацію.

Докази / верифікація:

- `docker compose ... pull` для official `acore/*` images на ARM64 завершився `no matching manifest for linux/arm64/v8`; confirmed baseline = local build path.
- Full local build і boot пройшли успішно: `azerothcore-authserver`, `azerothcore-worldserver`, `azerothcore-db` ready на `3727/8088/3309/7879`; `azerothcore-db-import` і `azerothcore-client-data-init` завершились `0`.
- Після фіксу `wow_login_test_universal.py` обидва smoke paths працюють проти live local AzerothCore:
  - `--expansion wotlk --auth-port 3727 --world-port 8088`
  - `--expansion azerothcore`
  Обидва доходять до `AUTH_OK`, `CHAR_ENUM`, `RESULT: NOT_FOUND` на порожньому realm.
- Live-верифіковано auth staging contract: CMaNGOS `s/v` треба вставляти в AzerothCore `salt/verifier` як `REVERSE(UNHEX(LPAD(...)))`; прямий `UNHEX(...)` ламає SRP6 auth proof.

### `TASK-012` — `Phase 16.5: інтегрувати AzerothCore у daily-sync pipeline`

- Status: `[+]`
- Priority: `P3`
- Module: `TRANSFER`
- Allowed roles: `Backend Developer`, `DevOps / Infrastructure`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/transfer/daily-sync.sh`, `localProjects/cmangos_projects/transfer/lib.sh`, `docs/PROJECT_BRIEF.md`, `docs/PROJECT_STATUS.md`, `docs/CONTINUATION_GUIDE.md`, `docs/TRANSFER_SYSTEM.md`, `docs/COMMANDS_REFERENCE.md`, `docs/TESTING_AND_RELEASE.md`, `docs/DECISIONS.md`, `docs/BACKLOG.md`, `docs/SESSION_LOG.md`
- Touched paths: `localProjects/cmangos_projects/transfer/daily-sync.sh`, `localProjects/cmangos_projects/transfer/lib.sh`, `docs/PROJECT_BRIEF.md`, `docs/PROJECT_STATUS.md`, `docs/CONTINUATION_GUIDE.md`, `docs/TRANSFER_SYSTEM.md`, `docs/COMMANDS_REFERENCE.md`, `docs/TESTING_AND_RELEASE.md`, `docs/DECISIONS.md`, `docs/BACKLOG.md`, `docs/SESSION_LOG.md`
- Пов'язані context files: `docs/LEGACY_BACKLOG_ARCHIVE.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-010`, `TASK-011`

Мета:

- Розширити pipeline до 4 кроків із verify на AzerothCore.

Acceptance:

- Pipeline design і код відображають `Classic → TBC → WotLK → AzerothCore`.

Subtasks:

- [x] Додати migration step.
- [x] Додати verify step.
- [x] Оновити docs.

Докази / верифікація:

- `daily-sync.sh` тепер детектить локальний AzerothCore runtime (`azerothcore-db`, `azerothcore-authserver`, `azerothcore-worldserver`) і вмикає optional Phase E/F; без нього script лишається на verified 3-step path.
- `migration_sql_for_pair()` тепер виконує `migrate_cmangos_wotlk_to_azerothcore.sql` для `wotlk -> azerothcore`, а `do_transfer_char()` окремо remap-ить `account_tutorial.accountId`.
- `lib.sh` тепер має AzerothCore-aware `db_exec/db_dump`, container/db maps, `start_server()/restart_after_crash()` і schema-aware `ensure_account()` для `acore_auth.account` + `account_access`.
- Під час live validation знайдено і виправлено реальний parsing bug: порожній source `sessionkey` більше не зсуває `joindate/lockedIp/os/flags` при staging account у AzerothCore.
- Focused local proof на `2026-03-15`:
  - synthetic source container `task012-wotlk-db` з account `TASK012ACC/task012acc`
  - `ensure_account wotlk azerothcore TASK012ACC` → target row created in `acore_auth.account`
  - `HEX(REVERSE(salt))` і `HEX(REVERSE(verifier))` на target збіглися з source `s/v`
  - `account_access` створено як `gmlevel=3`, `RealmID=-1`
  - `wow_login_test_universal.py --expansion azerothcore --username TASK012ACC --password task012acc --guid 1` → `AUTH_OK`, `CHAR_ENUM`, `RESULT: NOT_FOUND`
- Scope limit свідомо лишився: full 4-step character migration на non-empty AzerothCore realm ще не доведена і переходить у `TASK-013`.

### `TASK-013` — `Phase 16.6: E2E 4-step pipeline`

- Status: `[+]`
- Priority: `P3`
- Module: `TRANSFER`
- Allowed roles: `QA / Test Automation`, `Project Architect`
- Assignee: `GitHub Copilot (GPT-5.4)`
- Machine: `morgan.local`
- Lock scope: `all runtime stacks`
- Touched paths: `workspace runtime`, `workspace:/opt/docker-azerothcore`, `workspace:/opt/cmangos-transfer`, `workspace:/opt/mangos-website/.env.multiroute`, `localProjects/cmangos_projects/docker-azerothcore/`, `localProjects/cmangos_projects/transfer/`, `docs/TRANSFER_SYSTEM.md`, `docs/PROJECT_STATUS.md`, `docs/SESSION_LOG.md`, `docs/BACKLOG.md`
- Пов'язані context files: `docs/LEGACY_BACKLOG_ARCHIVE.md`
- Parallel-safe with: `none`
- Depends on: `TASK-012`

Мета:

- Підтвердити повний 4-step pipeline з verify на кожному етапі.

Acceptance:

- Усі чотири кроки дають `SUCCESS`.

Subtasks:

- [x] Запустити end-to-end сценарій.
- [x] Зафіксувати summary.

Докази / верифікація:

- Explicit shared-host approval token was provided and a real AzerothCore runtime was deployed onto `workspace` under `/opt/docker-azerothcore` with source checkout `/opt/azerothcore-wotlk`.
- Live blockers fixed during the run:
  - `lib.sh` now auto-discovers `DOCKER_DB_ROOT_PASSWORD` from AzerothCore compose env when the shell lacks `AZEROTHCORE_DB_PASSWORD`, so `ensure_account()` no longer falls back to `change_me` on `workspace`.
  - `wait_for_server_ready()` now matches AzerothCore `WORLD: World Initialized` / `ready...` log lines, so Phase F no longer false-negatives on a healthy `azerothcore-worldserver`.
  - `daily-sync.sh` now normalizes MariaDB `*_uca1400_*` collations in the WotLK temp dump before importing into MySQL-backed `azerothcore-db`, and `migrate_cmangos_wotlk_to_azerothcore.sql` now uses MySQL-safe dynamic conditional ALTERs instead of MariaDB-only `IF [NOT] EXISTS` column syntax.
  - `workspace:/opt/cmangos-transfer/wow_login_test_universal.py` was updated so remote Phase F actually supports `--expansion azerothcore` instead of failing in argument parsing.
- Canonical no-skip live proof: `workspace:/opt/cmangos-transfer/logs/daily-sync-task013-forceclean-20260317_231158.log`
  - `Samuel` synced `classic -> tbc`, verified `SUCCESS`, and stored post-verify hash on `tbc`.
  - `Samuel` synced `tbc -> wotlk`, verified `SUCCESS`, and stored post-verify hash on `wotlk`.
  - `Samuel` synced `wotlk -> azerothcore`, verified `SUCCESS`, and stored post-verify hash on `azerothcore`.
  - Final summary for the forced-clean run: `Synced=3`, `Errors=0`, and `Rolled back=0` on every verify phase.
- Supporting direct proof before the canonical rerun: the updated remote login bot reached `RESULT: SUCCESS` for `SAMUEL/SAMUEL`, `guid=1801` against live AzerothCore on `workspace`.

### `TASK-014` — `Debug build WotLK за потреби`

- Status: `[+]`
- Priority: `P3`
- Module: `INFRA`
- Allowed roles: `DevOps / Infrastructure`, `Project Architect`
- Assignee: `GitHub Copilot (GPT-5.4)`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/docker-wotlk/`, `docs/BACKLOG.md`, `docs/ARCHITECTURE.md`, `docs/COMMANDS_REFERENCE.md`, `docs/SESSION_LOG.md`, `docs/PROJECT_STATUS.md`
- Touched paths: `localProjects/cmangos_projects/docker-wotlk/`, `docs/BACKLOG.md`, `docs/ARCHITECTURE.md`, `docs/COMMANDS_REFERENCE.md`, `docs/SESSION_LOG.md`, `docs/PROJECT_STATUS.md`
- Пов'язані context files: `docs/LEGACY_BACKLOG_ARCHIVE.md`
- Parallel-safe with: `DOCS`, `SOURCE`
- Depends on: `none`

Мета:

- Мати documented fallback для debug build, якщо з'явиться новий crash, який не покривається наявним data-level workaround.

Acceptance:

- Є чіткий план debug build і умови, коли його активувати.

Subtasks:

- [x] Зафіксувати build flags і runtime expectations.
- [x] Описати trigger condition.

Докази / верифікація:

- `localProjects/cmangos_projects/docker-wotlk/Dockerfile.server` confirmed the current release baseline uses `-DDEBUG=0`; no standing debug-build path existed before this task.
- `docs/COMMANDS_REFERENCE.md` now contains the canonical fallback sequence for temporary WotLK crash triage: switch local flags to `-DCMAKE_BUILD_TYPE=Debug -DDEBUG=1`, build a separate `semorgana/cmangos-wotlk:debug` tag, run it with the same runtime ports/volumes, and capture the first failure markers before restart noise hides them.
- `docs/ARCHITECTURE.md` now fixes the activation rule: use the debug build only after a WotLK crash reproduces on the normal release image and the known data-level workaround is no longer sufficient; shared-host rollout stays approval-gated and is not the first diagnostic step.

### `TASK-016` — `Guild transfer`

- Status: `[+]`
- Priority: `P3`
- Module: `TRANSFER`
- Allowed roles: `Backend Developer`, `Project Architect`
- Assignee: `GitHub Copilot (GPT-5.4)`
- Machine: `morgan.local`
- Lock scope: `guild-related data migration`, `TASK-016 docs claim`
- Touched paths: `localProjects/cmangos_projects/transfer/`, `docs/TRANSFER_SYSTEM.md`, `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, `docs/SESSION_LOG.md`
- Пов'язані context files: `docs/LEGACY_BACKLOG_ARCHIVE.md`
- Parallel-safe with: `DOCS`, `SOURCE`
- Depends on: `TASK-007`

Мета:

- Дослідити або реалізувати перенос гільдій між експансіями.

Acceptance:

- Є documented rule set для guild/guild_bank incompatibilities.

Subtasks:

- [x] Дослідити guild schema gap, особливо Classic vs guild bank.
- [x] Вирішити scope implementation.

Докази / верифікація:

- `localProjects/cmangos_projects/transfer/transfer.sh` already contains a legacy guild-copy path: when selected characters belong to a guild, it copies `guild`, `guild_member`, `guild_rank`, `guild_eventlog`, and then attempts `guild_bank_*` tables for the same `guildid` set.
- `docs/TRANSFER_SYSTEM.md` now fixes the truthful boundary: guild transfer exists only as a legacy operator-side bulk path in `transfer.sh`, not as part of the canonical daily-sync, targeted runner, chained runner, or website self-service contract.
- The incompatibility rule is now documented explicitly: Classic has no `guild_bank_*` layer, so Classic-origin guild moves can at most preserve core guild rows while bank state is absent/reset; TBC/WotLK guild-bank state is only structurally preservable on TBC/WotLK targets.

### `TASK-017` — `Legacy website containerization`

- Status: `[+]`
- Priority: `P2`
- Module: `INFRA`
- Allowed roles: `DevOps / Infrastructure`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/mangos-website`, `localProjects/cmangos_projects/docker-website`, `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, `docs/ARCHITECTURE.md`, `docs/SESSION_LOG.md`
- Touched paths: `localProjects/cmangos_projects/mangos-website`, `localProjects/cmangos_projects/docker-website/`, `localProjects/cmangos_projects/docker-website/docker-compose.remote.yml`, `docs/BACKLOG.md`, `docs/PROJECT_BRIEF.md`, `docs/PROJECT_STATUS.md`, `docs/CONTINUATION_GUIDE.md`, `docs/ARCHITECTURE.md`, `docs/COMMANDS_REFERENCE.md`, `docs/TESTING_AND_RELEASE.md`, `docs/DECISIONS.md`, `docs/SESSION_LOG.md`
- Пов'язані context files: `docs/LEGACY_BACKLOG_ARCHIVE.md`
- Parallel-safe with: `SOURCE`, `DOCS`
- Depends on: `TASK-007`

Мета:

- Оцінити `celguar/mangos-website`, підготувати isolated container boundary і deployment contract під `world-of-warcraft.morgan-dev.com`.

Acceptance:

- Є verified intake repo, container/security plan і зрозумілий deploy contract для Traefik/Cloudflare.

Subtasks:

- [x] Забрати й оглянути upstream repo.
- [x] Визначити runtime/deps/container boundary.
- [x] Зафіксувати deployment contract через Traefik і окремий container.

Докази / верифікація:

- Upstream repo закріплено локально в `localProjects/cmangos_projects/mangos-website` на commit `9c9582c`.
- Read-only topology check на `workspace` підтвердив, що сайт не може безпечно припускати один shared `realmd`: зараз є три ізольовані DB (`classicrealmd`, `tbcrealmd`, `wotlkrealmd`), тому first deploy contract свідомо зафіксовано як `WotLK-first`.
- Створено локальний deploy layer у `localProjects/cmangos_projects/docker-website/`: `Dockerfile`, `docker-compose.yml`, `docker-compose.remote.yml`, `.env.example`, hardened Apache vhost, `docker-entrypoint.sh`, `configure-app.php`, `sql/public-site-compat.sql`.
- `docker compose --env-file localProjects/cmangos_projects/docker-website/.env.example -f localProjects/cmangos_projects/docker-website/docker-compose.yml config` проходить без помилок.
- Local image присутній як `semorgana/mangos-website:local`; publication target, якщо знадобиться push, погоджено як Docker Hub namespace `semorgana`.
- Image `semorgana/mangos-website:local` збирається на `php:5.6-apache` з `gd`, `mysql`, `mysqli`, `pdo_mysql`.
- Read-only smoke пройшов: container генерує `config.xml` і `config-protected.php`, `apache2ctl -t` → `Syntax OK`.
- HTTP hardening smoke пройшов: `/install/`, `/config/config.xml`, `/index.php?n=admin`, `/index.php?n=account.manage`, `/donate.php` повертають `403`; `/` лишається доступним.
- Зафіксовано deploy contract для public-mode first deploy: isolated website container behind `traefik`, прямий доступ до WotLK DB через external Docker network `cmangos-wotlk-net`, без відкриття account/admin/forum surfaces.

### `TASK-021` — `Legacy website live deploy via Traefik`

- Status: `[+]`
- Priority: `P2`
- Module: `OPS`
- Allowed roles: `DevOps / Infrastructure`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `workspace:/opt/mangos-website`, `workspace:wotlkrealmd`, `workspace traefik`, `website container`, `world-of-warcraft.morgan-dev.com`
- Touched paths: `localProjects/cmangos_projects/docker-website/`, `workspace:/opt/mangos-website`, `workspace:wotlkrealmd`, `workspace:docker networks traefik/cmangos-wotlk-net`, `docs/PROJECT_BRIEF.md`, `docs/CONTINUATION_GUIDE.md`, `docs/PROJECT_STATUS.md`, `docs/ARCHITECTURE.md`, `docs/COMMANDS_REFERENCE.md`, `docs/TESTING_AND_RELEASE.md`, `docs/DECISIONS.md`, `docs/BACKLOG.md`, `docs/SESSION_LOG.md`
- Пов'язані context files: `docs/LEGACY_BACKLOG_ARCHIVE.md`
- Parallel-safe with: `none`
- Depends on: `TASK-017`

Мета:

- Розгорнути isolated website container на `workspace` і віддати його через `traefik` на `world-of-warcraft.morgan-dev.com`.

Acceptance:

- Website доступний через HTTPS domain за Traefik route, працює в окремому контейнері, а rollback/verify зафіксовані в docs.

Subtasks:

- [x] Підготувати remote runtime wiring.
- [x] Налаштувати Traefik router/service для домену.
- [x] Перевірити reachability і задокументувати rollback/ops notes.

Докази / верифікація:

- User explicit approval на shared-host rollout отримано в чаті `2026-03-15`; сайтовий track після цього перейшов із planning у live execution.
- Перед DB bootstrap збережено backup: `/opt/cmangos-wotlk/backups/wotlkrealmd.pre_task021_20260315_084326.sql`.
- У `workspace:/opt/mangos-website/` розгорнуто runtime bundle: `docker-compose.yml`, `.env`, `full_install.sql`, `public-site-compat.sql`.
- У `wotlkrealmd` імпортовано upstream `install/sql/full_install.sql`, потім `public-site-compat.sql`; додатково зафіксовано `realm_settings` row для `id_realm=1`, `dbhost=cmangos-wotlk-db`, `dbname=wotlkmangos`, `chardbname=wotlkcharacters`.
- Під час першої live спроби виявлено daemon-specific compat drift: volume-based runtime + `read_only` rootfs давали `install/chmod ... Operation not permitted`; deploy layer переведено на in-container writable runtime без named volume, не змінюючи public-mode isolation boundary.
- Фінальний image опубліковано в Docker Hub як `semorgana/mangos-website:task021-wotlk-public-20260315` з digest `sha256:04960d24580fe08d9349d006f0be647cdf29f07129b15c016348afb3d11cbbce`.
- Live remote deploy використовує actual external DB network `cmangos-wotlk-net`; `docker ps` на `workspace` підтвердив `mangos-website` у статусі `Up (healthy)` на мережах `cmangos-wotlk-net`, `mangos-website_default`, `traefik`.
- `docker logs traefik` зафіксував успішний DNS-01 flow через вже наявний Cloudflare provider config і рядок `Certificates obtained for domains [world-of-warcraft.morgan-dev.com]`.
- Public HTTPS verify:
  - `curl https://world-of-warcraft.morgan-dev.com` → `HTTP 200`
  - `<title>World of Warcraft`
  - `curl https://world-of-warcraft.morgan-dev.com/install/` → `403`
  - `curl 'https://world-of-warcraft.morgan-dev.com/index.php?n=admin'` → `403`
  - `curl 'https://world-of-warcraft.morgan-dev.com/index.php?n=account.manage'` → `403`
  - `curl https://world-of-warcraft.morgan-dev.com/donate.php` → `403`
  - `curl https://world-of-warcraft.morgan-dev.com/config/config.xml` → `403`
- TLS steady-state verify:
  - `openssl s_client -connect world-of-warcraft.morgan-dev.com:443 -servername world-of-warcraft.morgan-dev.com | openssl x509 -noout -subject -issuer -dates`
  - current cert chain no longer self-signed; issuer = `Google Trust Services / WE1`, validity through `2026-05-13`
- Operational note: під час першого certificate issuance Cloudflare коротко повертав `526`, доки Traefik ще віддавав default self-signed cert; після завершення ACME issuance steady-state matrix стала `200/403` і вважається acceptance-pass.

### `TASK-018` — `Legacy debt: Dockerfile.updater`

- Status: `[+]`
- Priority: `P3`
- Module: `INFRA`
- Allowed roles: `DevOps / Infrastructure`, `Project Architect`
- Assignee: `GitHub Copilot (GPT-5.4)`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/docker*/`, `docs/BACKLOG.md`, `docs/DECISIONS.md`, `docs/PROJECT_STATUS.md`, `docs/SESSION_LOG.md`
- Touched paths: `localProjects/cmangos_projects/docker*/`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/PROJECT_STATUS.md`, `docs/SESSION_LOG.md`
- Пов'язані context files: `docs/LEGACY_BACKLOG_ARCHIVE.md`
- Parallel-safe with: `DOCS`, `SOURCE`
- Depends on: `TASK-007`

Мета:

- Зберегти не завершену legacy-ідею окремого updater container як опціональний напрямок.

Acceptance:

- Є рішення: або реалізувати updater container, або офіційно відхилити і закрити задачу.

Subtasks:

- [x] Порівняти з наявними systemd timers.
- [x] Зафіксувати рішення в `DECISIONS.md`.

Докази / верифікація:

- Legacy idea in `docs/LEGACY_BACKLOG_ARCHIVE.md` recommended a separate checker container only before the current runtime had verified per-expansion update automation.
- Current runtime already has per-expansion `scripts/update.sh` entrypoints with `--install/--status` systemd integration, and the canonical docs live-verify active timers `cmangos-update.timer`, `cmangos-tbc-update.timer`, `cmangos-wotlk-update.timer`, plus `cmangos-daily-sync.timer`.
- `docker/scripts/update.sh`, `docker-tbc/scripts/update.sh`, and `docker-wotlk/scripts/update.sh` already cover upstream hash detection, locking, backup, rebuild, push, restart, and timer installation, so a separate Docker-socket-mounted checker container would duplicate the existing control plane while increasing privileged surface area.
- Decision: reject standalone `Dockerfile.updater` as superseded legacy debt; keep host-level `update.sh` + systemd timers as the canonical update mechanism.

### `TASK-019` — `Legacy debt: повний refactor на lib.sh`

- Status: `[+]`
- Priority: `P3`
- Module: `TRANSFER`
- Allowed roles: `Backend Developer`, `Project Architect`
- Assignee: `GitHub Copilot (GPT-5.4)`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/transfer/`, `docs/BACKLOG.md`, `docs/TRANSFER_SYSTEM.md`, `docs/PROJECT_STATUS.md`, `docs/SESSION_LOG.md`
- Touched paths: `localProjects/cmangos_projects/transfer/`, `docs/TRANSFER_SYSTEM.md`, `docs/PROJECT_STATUS.md`, `docs/SESSION_LOG.md`
- Пов'язані context files: `docs/LEGACY_BACKLOG_ARCHIVE.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-007`

Мета:

- Закрити висячий legacy TODO: повністю перевести transfer scripts на спільний `lib.sh`.

Acceptance:

- Дублікати функцій усунені або офіційно визнано, що додатковий refactor не потрібен.

Subtasks:

- [x] Порівняти фактичний стан скриптів із legacy intention.
- [x] Реалізувати або закрити як superseded.

Докази / верифікація:

- Legacy archive `13.8` defined the debt narrowly: replace duplicated helpers in `transfer-interactive.sh` and `daily-sync.sh` with `source lib.sh`.
- That state is already true in the current code: both `transfer-interactive.sh` and `daily-sync.sh` source `lib.sh`, and shared DB/container maps, logging helpers, account helpers, hash storage, restart/wait helpers, login verification, and post-transfer sanitization now live in `lib.sh`.
- Remaining functions inside `daily-sync.sh`, `transfer-interactive.sh`, `targeted-transfer-runner.sh`, and `chained-wotlk-transfer-runner.sh` are primarily script-specific orchestration layers, request/JSON wrappers, or UX flow, not the duplicated low-level helper layer this legacy item was meant to remove.
- Decision: close `TASK-019` as already satisfied by the current codebase state; no further blanket `lib.sh` extraction is required unless a future task identifies a concrete new duplicated helper.

### `TASK-022` — `Legacy website theme/assets repair`

- Status: `[+]`
- Priority: `P1`
- Module: `OPS`
- Allowed roles: `DevOps / Infrastructure`, `Backend Developer`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/docker-website/`, `localProjects/cmangos_projects/mangos-website/`, `workspace:/opt/mangos-website`, `workspace:mangos-website`, `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, `docs/COMMANDS_REFERENCE.md`, `docs/TESTING_AND_RELEASE.md`, `docs/SESSION_LOG.md`
- Touched paths: `localProjects/cmangos_projects/docker-website/`, `workspace:/opt/mangos-website`, `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, `docs/COMMANDS_REFERENCE.md`, `docs/TESTING_AND_RELEASE.md`, `docs/DECISIONS.md`, `docs/SESSION_LOG.md`
- Пов'язані context files: `docs/LEGACY_BACKLOG_ARCHIVE.md`
- Parallel-safe with: `none`
- Depends on: `TASK-021`

Мета:

- Виправити live visual regression, де legacy website віддає `200`, але theme CSS/JS/images частково ламаються через missing static asset paths.

Acceptance:

- Home page зовні рендерить theme assets без масових `404` по `templates/wotlk/*`.
- Main WotLK theme CSS доступний і screenshot-level layout більше не розвалюється в unstyled HTML.
- Канонічні docs фіксують root cause і фінальний runtime contract.

Subtasks:

- [x] Підтвердити root cause по live asset graph.
- [x] Внести image/runtime fix і задеплоїти його на `workspace`.
- [x] Перевірити live asset matrix і оновити docs.

Докази / верифікація:

- Root cause підтверджено live:
  - HTML віддавав `templates/wotlk/*`, але filesystem у container мав лише `templates/WotLK`.
  - До фікса `curl -I https://world-of-warcraft.morgan-dev.com/templates/wotlk/css/newhp.css` і sibling assets падали в `404`, а після тимчасового symlink proof-of-concept перейшли в `200`.
- Durable fix внесено в deploy layer:
  - `localProjects/cmangos_projects/docker-website/Dockerfile`
  - `localProjects/cmangos_projects/docker-website/scripts/docker-entrypoint.sh`
  - Обидва тепер гарантують alias `templates/wotlk -> WotLK` на Linux case-sensitive filesystem.
- Локальна валідація:
  - `sh -n localProjects/cmangos_projects/docker-website/scripts/docker-entrypoint.sh`
  - `docker compose --env-file localProjects/cmangos_projects/docker-website/.env.example -f localProjects/cmangos_projects/docker-website/docker-compose.yml config`
  - `docker run --rm -v "$PWD":/work -w /work php:8.2-cli php -l localProjects/cmangos_projects/docker-website/scripts/configure-app.php`
  - `docker run --rm --entrypoint sh semorgana/mangos-website:task022-themefix-20260315 -lc 'ls -la /var/www/html/templates'` → image already contains `wotlk -> WotLK`
- Новий image опубліковано як `semorgana/mangos-website:task022-themefix-20260315` з digest `sha256:b0e7b6b415d2441138ebebf93968804091f1527e22d587ccf665594d97abc084`.
- Remote rollout:
  - backup runtime env: `workspace:/opt/mangos-website/.env.pre_task022_20260315_091320`
  - `.env` переведено на `MW_IMAGE_NAME=semorgana/mangos-website:task022-themefix-20260315`
  - `docker compose --env-file .env -f docker-compose.yml up -d --force-recreate` перевикотив `mangos-website`
- Post-deploy acceptance:
  - `docker ps` on `workspace` → `mangos-website  Up ... (healthy)` on image `semorgana/mangos-website:task022-themefix-20260315`
  - `curl -I /` → `200`
  - `curl -I /templates/wotlk/css/newhp.css` → `200`
  - `curl -I /templates/wotlk/js/detection.js` → `200`
  - `curl -I /templates/wotlk/images/pixel000.gif` → `200`
  - blocked surfaces preserved: `/install/`, `/index.php?n=admin`, `/index.php?n=account.manage`, `/donate.php`, `/config/config.xml` → `403`
  - Residual upstream debt remains separate: `/js/compressed/prototype.js` still `404`, але homepage theme/render більше цим не ламається.

### `TASK-023` — `Legacy website browser audit harness`

- Status: `[+]`
- Priority: `P1`
- Module: `OPS`
- Allowed roles: `QA / Test Automation`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/docker-website/`, `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, `docs/COMMANDS_REFERENCE.md`, `docs/TESTING_AND_RELEASE.md`, `docs/SESSION_LOG.md`
- Touched paths: `localProjects/cmangos_projects/docker-website/`, `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, `docs/COMMANDS_REFERENCE.md`, `docs/TESTING_AND_RELEASE.md`, `docs/SESSION_LOG.md`
- Пов'язані context files: `docs/LEGACY_BACKLOG_ARCHIVE.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-022`

Мета:

- Підняти browser-level audit system для live website, яка реально відкриває сайт у Chromium, проходить reachable UI actions і збирає client/network/runtime errors в один consolidated report для подальшого виправлення.

Acceptance:

- Існує reproducible runner для Chromium-based audit live сайту.
- Runner проходить reachable links/button-like actions, логуючи action trail, console errors, page errors, request failures і HTTP `>=400`.
- Перший baseline report збережено в одному місці з machine-readable і human-readable summary.
- Канонічні docs описують, як повторно запускати audit.

Subtasks:

- [x] Створити isolated Playwright-based runner і артефактну структуру звітів.
- [x] Прогнати перший audit проти `world-of-warcraft.morgan-dev.com`.
- [x] Задокументувати команди, формат результатів і початкові findings.

Докази / верифікація:

- Новий harness живе в `localProjects/cmangos_projects/docker-website/browser-audit/`:
  - `browser_audit.py`
  - `run_live_audit.sh`
  - `live_site_config.json`
  - `requirements.txt`
  - `README.md`
  - `.gitignore`
- Syntax gates:
  - `bash -n localProjects/cmangos_projects/docker-website/browser-audit/run_live_audit.sh`
  - `python3 -m py_compile localProjects/cmangos_projects/docker-website/browser-audit/browser_audit.py`
- First verified run:
  - `localProjects/cmangos_projects/docker-website/browser-audit/run_live_audit.sh`
  - report dir = `localProjects/cmangos_projects/docker-website/browser-audit/reports/20260315_092632`
- Baseline metrics from `summary.json`:
  - `pages_visited=30`
  - `actions_recorded=477`
  - `issues_total=210`
  - `issues_unexpected=205`
  - `same_origin_unexpected=205`
  - `unexpected_issue_counts`: `http_error=51`, `console_error=105`, `request_failed=49`
- Top recurring unexpected issue = same-origin `404` на `/js/compressed/prototype.js`; blocked routes `/install/`, `/index.php?n=admin`, `/index.php?n=account.manage`, `/donate.php`, `/config/config.xml` теж потрапляють у consolidated issue set як visible hardened surfaces.
- Refreshed post-`TASK-026` rerun `2026-03-15`:
  - `live_site_config.json` вирівняно під поточний public contract: seed-и тепер стартують із `/`, `/classic/`, `/tbc/`, `/wotlk/`, `/wotlk-azcore/`, `/classic/install/`, `/tbc/donate.php`, `/wotlk/index.php?n=admin`, а expected statuses покривають canonical `404/403` для цих hardened або ще-не-live surfaces.
  - corrected report dir = `localProjects/cmangos_projects/docker-website/browser-audit/reports/20260315_105344`
  - refreshed metrics: `pages_visited=30`, `actions_recorded=258`, `issues_total=120`, `issues_unexpected=116`, `same_origin_unexpected=116`
  - refreshed `unexpected_issue_counts`: `http_error=38`, `console_error=60`, `request_failed=18`
  - hardened public contract тепер підтверджено browser-level report-ом як expected: `/wotlk-azcore/` = `404`, `/classic/install/` = `403`, `/tbc/donate.php` = `403`, `/wotlk/index.php?n=admin` = `403`
  - residual real findings після contract cleanup звузились до трьох buckets:
    - missing same-origin assets `/classic/js/compressed/prototype.js`, `/tbc/js/compressed/prototype.js`, `/wotlk/js/compressed/prototype.js` → `404`
    - `500` на `/classic/armory/index.php`
    - legacy root-scoped discovered URLs типу `/index.php?n=account&sub=register`, `/index.php?n=forum`, `/armory/` still return `418/404`, бо більше не входять у canonical public path-prefix contract

### `TASK-024` — `Path-based multi-patch website entrypoints`

- Status: `[+]`
- Priority: `P1`
- Module: `OPS`
- Allowed roles: `DevOps / Infrastructure`, `Backend Developer`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/docker-website/`, `localProjects/cmangos_projects/mangos-website/`, `workspace:/opt/mangos-website`, `workspace:traefik+mangos-website`, `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, `docs/ARCHITECTURE.md`, `docs/COMMANDS_REFERENCE.md`, `docs/TESTING_AND_RELEASE.md`, `docs/SESSION_LOG.md`
- Touched paths: `localProjects/cmangos_projects/docker-website/`, `localProjects/cmangos_projects/mangos-website/`, `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, `docs/ARCHITECTURE.md`, `docs/COMMANDS_REFERENCE.md`, `docs/TESTING_AND_RELEASE.md`, `docs/SESSION_LOG.md`
- Пов'язані context files: `docs/LEGACY_BACKLOG_ARCHIVE.md`
- Parallel-safe with: `none`
- Depends on: `TASK-022`

Мета:

- Дати одному домену `world-of-warcraft.morgan-dev.com` окремі website entrypoints `/classic`, `/tbc`, `/wotlk`, `/wotlk-azcore`, де кожен path веде у свій patch-specific website surface без розмноження на чотири субдомени.

Acceptance:

- Визначено і задокументовано технічний контракт для path-based routing.
- Підтверджено, чи legacy website коректно працює з non-root base path.
- Якщо шлях технічно валідний, створено deploy/runtime path для patch-specific entrypoints; якщо ні, задокументовано verified blocker і безпечну альтернативу.

Subtasks:

- [x] Перевірити base-path сумісність legacy website та current deploy layer.
- [x] Визначити runtime topology для `/classic`, `/tbc`, `/wotlk`, `/wotlk-azcore`.
- [x] Реалізувати або зафіксувати blocker з альтернативою.

Докази / верифікація:

- Prefix-aware deploy layer:
  - `localProjects/cmangos_projects/docker-website/scripts/configure-apache.php`
  - `localProjects/cmangos_projects/docker-website/scripts/docker-entrypoint.sh`
  - `localProjects/cmangos_projects/docker-website/Dockerfile`
- Multiroute runtime skeleton:
  - `localProjects/cmangos_projects/docker-website/docker-compose.remote.multiroute.yml`
  - `localProjects/cmangos_projects/docker-website/.env.multiroute.example`
- Syntax / config gates:
  - `docker compose --env-file localProjects/cmangos_projects/docker-website/.env.multiroute.example -f localProjects/cmangos_projects/docker-website/docker-compose.remote.multiroute.yml config`
  - `bash -n localProjects/cmangos_projects/docker-website/scripts/docker-entrypoint.sh`
  - `docker run --rm -v "$PWD":/work -w /work php:8.2-cli php -l localProjects/cmangos_projects/docker-website/scripts/configure-apache.php`
- Local prefixed runtime proof:
  - local image built as `semorgana/mangos-website:task024-pathprefix-local`
  - disposable WotLK proof container with `MW_BASE_URL=http://127.0.0.1:8091/wotlk/`
  - `curl -I http://127.0.0.1:8091/wotlk/` → `200`
  - `curl -I http://127.0.0.1:8091/wotlk/templates/wotlk/css/newhp.css` → `200`
  - `curl -I http://127.0.0.1:8091/` → `403`
- `shared_topnav` DOM proof via Playwright on the prefixed WotLK page:
  - visible links = `/classic/`, `/tbc/`, `/wotlk/`, `/wotlk-azcore/`
  - active class applied on `/wotlk/`
  - Armory link became path-aware (`.../wotlk/armory/index.php`) instead of root-hardcoded.
- Patch switcher injected in:
  - `localProjects/cmangos_projects/mangos-website/templates/vanilla/js/buildtopnav.js`
  - `localProjects/cmangos_projects/mangos-website/templates/tbc/js/buildtopnav.js`
  - `localProjects/cmangos_projects/mangos-website/templates/WotLK/js/buildtopnav.js`
  - `localProjects/cmangos_projects/mangos-website/armory/shared/global/menu/topnav/buildtopnav.js`
- Verified outcome:
  - Legacy website technically works under non-root base path.
  - Single-domain multi-patch routing is now a validated local contract.
  - Live rollout на `workspace` свідомо винесено окремо, бо це вже shared-host infra mutation.

### `TASK-025` — `Live rollout of path-based multi-patch website on workspace`

- Status: `[+]`
- Priority: `P1`
- Module: `OPS`
- Allowed roles: `DevOps / Infrastructure`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `workspace:/opt/mangos-website`, `workspace:traefik+mangos-website`, `workspace:/opt/cmangos-classic`, `workspace:/opt/cmangos-tbc`, `localProjects/cmangos_projects/docker-website`, `localProjects/cmangos_projects/mangos-website`, `docs/BACKLOG.md`, `docs/PROJECT_BRIEF.md`, `docs/CONTINUATION_GUIDE.md`, `docs/PROJECT_STATUS.md`, `docs/ARCHITECTURE.md`, `docs/COMMANDS_REFERENCE.md`, `docs/TESTING_AND_RELEASE.md`, `docs/DECISIONS.md`, `docs/SESSION_LOG.md`
- Touched paths: `localProjects/cmangos_projects/docker-website/docker-compose.remote.multiroute.yml`, `localProjects/cmangos_projects/mangos-website/templates/offlike/body_header.php`, `localProjects/cmangos_projects/mangos-website/armory/index.php`, `workspace:/opt/mangos-website`, `workspace:traefik routes`, `workspace:website containers`, `workspace:/opt/cmangos-classic/backups`, `workspace:/opt/cmangos-tbc/backups`, `docs/BACKLOG.md`, `docs/PROJECT_BRIEF.md`, `docs/CONTINUATION_GUIDE.md`, `docs/PROJECT_STATUS.md`, `docs/ARCHITECTURE.md`, `docs/COMMANDS_REFERENCE.md`, `docs/TESTING_AND_RELEASE.md`, `docs/DECISIONS.md`, `docs/SESSION_LOG.md`
- Пов'язані context files: `docs/LEGACY_BACKLOG_ARCHIVE.md`
- Parallel-safe with: `none`
- Depends on: `TASK-024`, explicit shared-host approval

Мета:

- Розгорнути verified path-prefix contract на `workspace`, щоб `world-of-warcraft.morgan-dev.com/classic`, `/tbc`, `/wotlk` і, якщо AzerothCore runtime доступний, `/wotlk-azcore` стали реальними live entrypoints за Traefik без переходу на окремі субдомени.

Acceptance:

- На `workspace` існують live routes `/classic/`, `/tbc/`, `/wotlk/`; slashless `/classic`, `/tbc`, `/wotlk` редіректять на canonical trailing-slash form.
- Якщо live AzerothCore website runtime відсутній, `/wotlk-azcore/` не маскується під `/wotlk/`, а чесно лишається `404`.
- `shared_topnav` на кожному patch-specific surface реально перемикає між цими entrypoints.
- Current root website і path-prefix routers не конфліктують, а hardened surfaces лишаються закритими.

Subtasks:

- [x] Підготувати remote compose/env bundle для multiroute rollout.
- [x] Викотити patch-specific website services на `workspace` через Traefik path-prefix rules.
- [x] Зібрати public smoke matrix і оновити docs.

Докази / верифікація:

- `2026-03-15`: explicit user approval token `EXPLICIT_USER_APPROVAL_REQUIRED` отримано; shared-host rollout виконано на `workspace`.
- Фінальний live image для root і prefixed surfaces = `semorgana/mangos-website:task025a-cachebust-20260315` з digest `sha256:64710da58f68d726e2c5542ec065085456cb0a6c293760784c363d01f0a635a4`.
- Remote rollout bundle і backups:
  - `/opt/mangos-website/docker-compose.multiroute.yml`
  - `/opt/mangos-website/docker-compose.multiroute.pre_task025_20260315_100019.yml`
  - `/opt/mangos-website/.env.pre_task025_20260315_100019`
  - `/opt/mangos-website/.env.multiroute.pre_task025_20260315_100019`
  - `/opt/mangos-website/.env.pre_task025a_20260315_101032`
  - `/opt/mangos-website/.env.multiroute.pre_task025a_20260315_101032`
- Перед website schema bootstrap створено DB backups:
  - `/opt/cmangos-classic/backups/classicrealmd.pre_task025_20260315_100019.sql`
  - `/opt/cmangos-tbc/backups/tbcrealmd.pre_task025_20260315_100019.sql`
- Website schema bootstrap для Classic і TBC підтверджено live:
  - `classicrealmd.realm_settings` і `account_extend` існують; `realm_settings` row = `1 / root / cmangos-db / 3306 / classicmangos / classiccharacters`
  - `tbcrealmd.realm_settings` і `account_extend` існують; `realm_settings` row = `1 / root / cmangos-tbc-db / 3306 / tbcmangos / tbccharacters`
- Remote container state (`2026-03-15 10:13 EET`):
  - `mangos-website`
  - `mangos-website-classic`
  - `mangos-website-tbc`
  - `mangos-website-wotlk`
  - усі `Up ... (healthy)`
- Public smoke matrix, перевірений з `morgan.local`:
  - `/`, `/classic/`, `/tbc/`, `/wotlk/` → `HTTP 200`
  - `/classic`, `/tbc`, `/wotlk` → `HTTP 302` з `Location` на trailing-slash URL
  - `/wotlk-azcore/` → `HTTP 404`
  - `/classic/install/`, `/tbc/donate.php`, `/wotlk/index.php?n=admin` → `HTTP 403`
- Live Playwright DOM proof на `/`, `/classic/`, `/tbc/`, `/wotlk/`:
  - `#shared_topnav` реально містить links `/classic/`, `/tbc/`, `/wotlk/`, `/wotlk-azcore/`
  - `/classic/`, `/tbc/`, `/wotlk/` відповідно мають `is-active` на своєму patch link
  - root `/` теж показує patch switcher після HTML-level cache bust
- `curl` з самого `workspace` може отримувати edge-level `403` від Cloudflare; canonical public verification для website слід робити з локальної машини або реального браузера, а не з server-origin curl.

### `TASK-026` — `Canonicalize public website entrypoint and hide unavailable patch surfaces`

- Status: `[+]`
- Priority: `P1`
- Module: `OPS`
- Allowed roles: `DevOps / Infrastructure`, `Frontend Developer`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/docker-website`, `localProjects/cmangos_projects/mangos-website`, `docs/BACKLOG.md`, `docs/PROJECT_BRIEF.md`, `docs/CONTINUATION_GUIDE.md`, `docs/PROJECT_STATUS.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/COMMANDS_REFERENCE.md`, `docs/TESTING_AND_RELEASE.md`, `docs/SESSION_LOG.md`
- Touched paths: `localProjects/cmangos_projects/docker-website/docker-compose.remote.yml`, `localProjects/cmangos_projects/docker-website/docker-compose.remote.multiroute.yml`, `localProjects/cmangos_projects/docker-website/.env.multiroute.example`, `localProjects/cmangos_projects/mangos-website/templates/offlike/body_header.php`, `localProjects/cmangos_projects/mangos-website/templates/vanilla/js/buildtopnav.js`, `localProjects/cmangos_projects/mangos-website/templates/tbc/js/buildtopnav.js`, `localProjects/cmangos_projects/mangos-website/templates/WotLK/js/buildtopnav.js`, `localProjects/cmangos_projects/mangos-website/armory/index.php`, `localProjects/cmangos_projects/mangos-website/armory/shared/global/menu/topnav/buildtopnav.js`, `workspace:/opt/mangos-website`, `workspace:website containers`, `workspace:traefik routes`, `docs/BACKLOG.md`, `docs/PROJECT_BRIEF.md`, `docs/CONTINUATION_GUIDE.md`, `docs/PROJECT_STATUS.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/COMMANDS_REFERENCE.md`, `docs/TESTING_AND_RELEASE.md`, `docs/SESSION_LOG.md`
- Пов'язані context files: `docs/LEGACY_BACKLOG_ARCHIVE.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-025`

Мета:

- Прибрати неконсистентний root surface і зробити patch switcher чесним: bare domain має canonical redirect-итися на `/classic/`, а UI не повинен рекламувати `WotLK + ACore`, доки live endpoint реально не існує.

Acceptance:

- Public root `/` більше не відкриває окремий WotLK-first homepage surface, а canonical redirect-иться на `/classic/`.
- Traefik/public routing більше не дає користувачеві “patchless” website surface.
- `shared_topnav` рендерить лише реально доступні patch links; `WotLK + ACore` ховається, якщо live AzerothCore website surface вимкнений.
- Local config/syntax/browser proofs проходять без regressions для `/classic/`, `/tbc/`, `/wotlk/`.

Subtasks:

- [x] Додати root redirect contract у deploy layer.
- [x] Додати env-driven feature flag для AzerothCore patch link.
- [x] Оновити docs і підготувати live deploy instructions.

Докази / верифікація:

- `2026-03-15`: user-reported UX drift after `TASK-025`:
  - root `/` все ще відкриває окремий WotLK-first surface, де topnav box має `h=27` замість `h=45` на prefixed routes;
  - `wotlk-azcore/` advertised in nav, але live endpoint не існує і повертає `404`.
- Live Playwright box snapshot:
  - `/` → `#shared_topnav` class `tn_wow`, box `{x:0,y:0,w:2048,h:27}`
  - `/classic/`, `/tbc/`, `/wotlk/` → `#shared_topnav` box height `45`
- Local fix prepared:
  - `docker-compose.remote.yml` більше не публікує root service через Traefik (`traefik.enable=false`)
  - `docker-compose.remote.multiroute.yml` додає root redirect router `Host(domain) && (Path(`/`) || Path(`/index.php`)) -> /classic/`
  - `MW_ENABLE_AZCORE_LINK` став env-driven flag; default у `.env.multiroute.example` = `0`
  - `buildtopnav.js` у `vanilla`, `tbc`, `WotLK` і armory тепер показує `WotLK + ACore` тільки коли `patch_switch_azcore_enabled=true`
- Local validation:
  - `docker compose --env-file localProjects/cmangos_projects/docker-website/.env.multiroute.example -f localProjects/cmangos_projects/docker-website/docker-compose.remote.multiroute.yml config`
  - `docker compose -f localProjects/cmangos_projects/docker-website/docker-compose.remote.yml config` with injected env values
  - `php -l localProjects/cmangos_projects/mangos-website/templates/offlike/body_header.php`
  - `php -l localProjects/cmangos_projects/mangos-website/armory/index.php`
  - headless Playwright proof for `buildtopnav.js`:
    - flag `false` → links `/classic/`, `/tbc/`, `/wotlk/`
    - flag `true` → links `/classic/`, `/tbc/`, `/wotlk/`, `/wotlk-azcore/`
- Live rollout executed `2026-03-15` after fresh explicit approval token `EXPLICIT_USER_APPROVAL_REQUIRED`.
- Published image: `semorgana/mangos-website:task026a-rootredirect-20260315` with digest `sha256:8a5b9033ae238c5e691b1123e08b6ef3f8d2880c996a4cb5d6215be9e9733413`.
- Remote env state after rollout:
  - `/opt/mangos-website/.env` pins `MW_IMAGE_NAME=semorgana/mangos-website:task026a-rootredirect-20260315`
  - `/opt/mangos-website/.env.multiroute` pins the same image and sets `MW_ENABLE_AZCORE_LINK=0`
  - pre-rollout env backups: `/opt/mangos-website/.env.pre_task026_20260315_104607`, `/opt/mangos-website/.env.multiroute.pre_task026_20260315_104607`
- Remote container state after recreate:
  - `mangos-website`, `mangos-website-classic`, `mangos-website-tbc`, `mangos-website-wotlk` = `Up ... (healthy)` on image `semorgana/mangos-website:task026a-rootredirect-20260315`
- Public HTTP matrix from `morgan.local` after rollout:
  - `/` → `302` to `https://world-of-warcraft.morgan-dev.com/classic/`
  - `/index.php` → `302` to `https://world-of-warcraft.morgan-dev.com/classic/`
  - `/classic/`, `/tbc/`, `/wotlk/` → `200`
  - `/wotlk-azcore/` → `404`
  - `/classic/install/`, `/tbc/donate.php`, `/wotlk/index.php?n=admin` → `403`
- Live Playwright DOM proof after rollout:
  - `/`, `/classic/`, `/tbc/`, `/wotlk/` → `#shared_topnav` box height `45`
  - visible patch links = `/classic/`, `/tbc/`, `/wotlk/`
  - `WotLK + ACore` link absent while `MW_ENABLE_AZCORE_LINK=0`
  - canonicalized `/` and `/classic/` mark `Classic` as `is-active`; `/tbc/` and `/wotlk/` keep their own active patch state

### `TASK-027` — `Bring live WotLK + AzerothCore website surface online`

- Status: `[+]`
- Priority: `P1`
- Module: `INFRA`
- Allowed roles: `DevOps / Infrastructure`, `QA / Test Automation`, `Project Architect`
- Assignee: `GitHub Copilot (GPT-5.4)`
- Machine: `morgan.local`
- Lock scope: `workspace:/opt/mangos-website`, `workspace:azerothcore runtime`, `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, `docs/SESSION_LOG.md`
- Touched paths: `workspace runtime`, `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, `docs/SESSION_LOG.md`
- Пов'язані context files: `docs/LEGACY_BACKLOG_ARCHIVE.md`
- Parallel-safe with: `none`
- Depends on: `TASK-013`, explicit shared-host approval

Мета:

- Перевести canonical WotLK website surface на live AzerothCore backend без окремого четвертого public patch surface.

Acceptance:

- На `workspace` існує live AzerothCore runtime, достатній для canonical WotLK website backend.
- `/wotlk/` рендериться без SQL/database errors поверх `acore_auth`.
- `/wotlk-azcore/` не існує як окремий четвертий public surface і замість цього redirect-ить на `/wotlk/`.

Subtasks:

- [x] Підняти або підтвердити live AzerothCore runtime на `workspace`.
- [x] Перевести canonical WotLK website route на AzerothCore backend.
- [x] Усунути live compatibility blockers у legacy PHP 5.6 website layer.
- [x] Зібрати public/browser smoke matrix.

Докази / верифікація:

- `workspace:/opt/docker-azerothcore` runs live `azerothcore-db`, `azerothcore-authserver`, and `azerothcore-worldserver`; after the compatibility repair `docker compose ps` showed DB `healthy` plus both servers `Up` on host ports `3309/3727/8088/7879`.
- Live website compatibility blockers fixed on `2026-03-18`:
  - canonical WotLK service was attached to the wrong external network name (`docker-azerothcore_default`), while the real AzerothCore stack exposed `azerothcore-net`;
  - MySQL 8 had to be restarted with `utf8mb3_general_ci`, `mysql_native_password=ON`, and `authentication_policy=mysql_native_password` so the legacy PHP 5.6 client could complete the initial handshake;
  - `acore_auth` needed the legacy website bootstrap schema (`full_install.sql`) plus MySQL-safe `website_*` compatibility views before the website could query `website_account_groups`, `website_realm_settings`, and `website_pms`.
- `workspace:/opt/mangos-website/.env.multiroute` now points canonical `/wotlk/` at `acore_auth` through `MW_WOTLK_DB_HOST=azerothcore-db`, `MW_WOTLK_DB_NETWORK=azerothcore-net`, and a dedicated legacy-compatible website user rather than the original root login.
- Public proof from `morgan.local` after the repair:
  - `curl -s -L https://world-of-warcraft.morgan-dev.com/wotlk/ | grep -E "SQL Error|mysqli_connect|acore_auth|azerothcore-db"` returned no matches.
  - `curl -s -L https://world-of-warcraft.morgan-dev.com/wotlk/` contains `<title>World of Warcraft WotLK</title>` and `SITE_PATH = '/wotlk/'`.
  - `curl -I https://world-of-warcraft.morgan-dev.com/wotlk-azcore/` returned `HTTP/2 302` with `Location: https://world-of-warcraft.morgan-dev.com/wotlk/`.

### `TASK-028` — `Triage residual live website issues after refreshed browser audit`

- Status: `[+]`
- Priority: `P2`
- Module: `OPS`
- Allowed roles: `QA / Test Automation`, `Backend Developer`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/docker-website/browser-audit`, `localProjects/cmangos_projects/mangos-website`, `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, `docs/SESSION_LOG.md`
- Touched paths: `localProjects/cmangos_projects/docker-website/browser-audit/`, `localProjects/cmangos_projects/mangos-website/`, `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, `docs/SESSION_LOG.md`
- Пов'язані context files: `docs/LEGACY_BACKLOG_ARCHIVE.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-023`, `TASK-026`

Мета:

- Розкласти по кореневих причинах residual browser-level findings, які залишилися після canonical root redirect і очищення audit contract.

Acceptance:

- Підтверджено, які findings є реальними багами, а які є просто legacy URLs поза canonical contract.
- Є окремий root-cause verdict для missing `prototype.js`, `500` на Classic Armory і root-scoped `418/404` discovered URLs.
- Для кожного bucket-а зафіксовано або fix plan, або explicit non-goal/risk decision.

Subtasks:

- [x] Розібрати root cause для `/classic|tbc|wotlk/js/compressed/prototype.js` `404` і вирішити, чи це deploy debt, upstream gap, чи safe-to-ignore legacy include.
- [x] Діагностувати `500` на `/classic/armory/index.php`.
- [x] Окремо класифікувати root-scoped `418/404` discovered URLs як bug або expected consequence після `TASK-026`.

Докази / верифікація:

- Fresh corrected audit report: `localProjects/cmangos_projects/docker-website/browser-audit/reports/20260315_105344`
- Current top residual findings from that report:
  - `/classic/js/compressed/prototype.js` → `404`
  - `/tbc/js/compressed/prototype.js` → `404`
  - `/wotlk/js/compressed/prototype.js` → `404`
  - `/classic/armory/index.php` → `500`
  - root discovered URLs like `/index.php?n=account&sub=register`, `/index.php?n=forum`, `/armory/` → `418/404`
- Root-cause verdicts captured `2026-03-15`:
  - `prototype.js` debt = real missing asset, not just deploy drift:
    - `templates/offlike/body_header.php` still includes `js/compressed/prototype.js`
    - local repo search in `mangos-website/js/compressed/` finds `behaviour.js` and `controls.js`, but no `prototype.js`
    - live Apache logs on `workspace` confirm `/classic/js/compressed/prototype.js` → `404`
  - Classic Armory `500` = real PHP/runtime incompatibility:
    - live container `mangos-website-classic` runs `PHP 5.6.40`
    - live app log shows `PHP Parse error: syntax error, unexpected ':', expecting '{' in /var/www/html/armory/configuration/functions.php on line 906`
    - offending local code starts with `function build_tooltip_desc(array $sp): string {` and uses multiple PHP 7+ features (`??`, scalar/return types, typed closures) that are incompatible with current `php:5.6-apache` runtime in `docker-website/Dockerfile`
  - Root-scoped `418/404` bucket = mostly browser-audit resolution noise, not canonical public website regression:
    - original report `20260315_105344` queued relative links from source URL `/`, even though that page final-redirected to `/classic/`
    - `browser_audit.py` now resolves queued navigation targets against `final_url` after redirect, not the original seed URL
    - post-fix rerun `localProjects/cmangos_projects/docker-website/browser-audit/reports/20260315_110836` shows those paths under `/classic/...` instead of root-scoped `/index.php?...`
    - remaining `/classic/index.php?...` `200/403` pages are part of the real prefixed Classic surface, while absolute `/armory/...` debt remains a legacy template/linking issue inside that surface

### `TASK-029` — `Fix residual legacy website runtime defects after TASK-028`

- Status: `[+]`
- Priority: `P2`
- Module: `OPS`
- Allowed roles: `Backend Developer`, `DevOps / Infrastructure`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/mangos-website`, `localProjects/cmangos_projects/docker-website`, `workspace:/opt/mangos-website`, `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, `docs/SESSION_LOG.md`
- Touched paths: `localProjects/cmangos_projects/mangos-website/`, `localProjects/cmangos_projects/docker-website/`, `workspace:/opt/mangos-website`, `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, `docs/SESSION_LOG.md`
- Пов'язані context files: `docs/LEGACY_BACKLOG_ARCHIVE.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-028`, explicit shared-host approval for live rollout

Мета:

- Забрати реальні website regressions, що лишилися після triage: missing `prototype.js`, Armory runtime/config failures на prefixed surfaces, і absolute `/armory/...` linking debt. Якщо під час rollout з'ясується, що full public Armory блокується відсутньою data layer, задача має зафіксувати mitigation і blocker замість помилкового completion claim.

Acceptance:

- `/classic/armory/index.php` і sibling prefixed armory pages більше не віддають raw runtime/SQL failure користувачу; або feature реально працює, або route повертає контрольований degraded response без internal leak.
- Рішення для `prototype.js` `404` прийняте й реалізоване: або asset повернуто, або legacy include safely прибрано/замінено без UI regression.
- Browser audit після rollout більше не має `prototype.js` `404` і первинного Armory `500` як top recurring findings.

Subtasks:

- [x] Вирішити compatibility path для `armory/configuration/functions.php` vs `php:5.6-apache`.
- [x] Вирішити долю legacy `prototype.js` include.
- [x] Повторно прогнати browser audit після fix і задокументувати новий steady state.
- [x] Прибрати public raw SQL/internal error leak на Armory route.
- [x] Знайти verified bootstrap source для `classicarmory` / `tbcarmory` / `wotlkarmory`.
- [x] Імпортувати verified Armory bootstrap source на `workspace`.
- [x] Заповнити live website forum/news tables seed-контентом так, щоб public frontpages не були порожні.

Докази / верифікація:

- Локально повернуто `mangos-website/js/compressed/prototype.js`, бо website code реально залежить від Prototype APIs (`Ajax.Request`, `Event.observe`, `Element.*`).
- `armory/configuration/functions.php` і `armory/source/character-talents.php` переписано на PHP 5.6-safe syntax і prefix-safe armory asset/link generation.
- `armory/configuration/settings.php` тепер веде Armory forum link на `../index.php?n=forum`, а `templates/offlike/server/server.ah.php` більше не шиє absolute `/armory/...` item URLs.
- `docker run --rm -v "$PWD":/app -w /app php:5.6-cli php -l ...` успішно пройшов для:
  - `armory/configuration/functions.php`
  - `armory/source/character-talents.php`
  - `armory/configuration/settings.php`
  - `templates/offlike/server/server.ah.php`
- Live rollout виконано через image `semorgana/mangos-website:task029b-armoryrealmfix-20260315` з digest `sha256:51edb543bc9dc153ac4b4ccf921ddb955b280b46e55cc7b4ad83d03220ef0d7e`.
- Runtime bootstrap додатково виправлено в deploy layer: container тепер генерує `vanilla.spp` / `tbc.spp` / `wotlk.spp` за `MW_EXPANSION`, щоб Armory коректно виставляв `DefaultRealmName`.
- Після додаткового live triage `armory/configuration/mysql.php` переведено на runtime DB config замість legacy `127.0.0.1:3310/root/123456`; це прибрало хибний localhost root cause і показало реальний blocker: `Unknown database 'classicarmory'`.
- Remote DB inventory на `workspace` підтвердив, що існують лише `classiccharacters/classiclogs/classicmangos/classicrealmd`, `tbccharacters/tbclogs/tbcmangos/tbcrealmd`, `wotlkcharacters/wotlklogs/wotlkmangos/wotlkrealmd`; жодної `classicarmory`, `tbcarmory`, `wotlkarmory` schema немає.
- Verified bootstrap source для Armory data layer знайдено локально в `localProjects/cmangos_projects/SPP_Classics_V2/SPP_Server/sql/{vanilla,tbc,wotlk}/armory.7z`; архіви містять expansion-specific `armory.sql` з `DROP/CREATE DATABASE classicarmory|tbcarmory|wotlkarmory`, а також `armory_instance_*`, `armory_titles`, `cache_*`, `dbc_*` tables і seed data.
- Verified Armory bootstrap source імпортовано на `workspace` у `classicarmory`, `tbcarmory`, `wotlkarmory` через відповідні remote DB контейнери `cmangos-db`, `cmangos-tbc-db`, `cmangos-wotlk-db`.
- Після Armory import key tables підтверджено populated:
  - `armory_titles` = `142` rows у всіх трьох schemas
  - `dbc_spell` = `22357` / `28315` / `49379` rows для Classic / TBC / WotLK
  - `cache_item` стартує з `0` rows, що очікувано для cache-on-demand tables
- Website forum/news content додатково імпортовано з expansion-specific `website.sql` + `website_news.sql`, але лише content-safe частиною: `f_*` tables та news/forum seed, без знесення existing `website_*` compat views з `public-site-compat.sql`.
- Після content import `classicrealmd`, `tbcrealmd`, `wotlkrealmd` мають по `1` category, `1` forum, `16` topics і `16` posts.
- Public HTTP matrix у фінальному state:
  - `/classic/armory/index.php`, `/tbc/armory/index.php`, `/wotlk/armory/index.php` = `200`
  - `/classic/`, `/tbc/`, `/wotlk/` показують seeded news entries на кшталт `Update 26.04.2023`, `Update 19.03.2023`, `Hotfix 28.09.2021`
  - `/classic/js/compressed/prototype.js`, `/tbc/js/compressed/prototype.js`, `/wotlk/js/compressed/prototype.js` = `200`
- Post-fix browser audit `localProjects/cmangos_projects/docker-website/browser-audit/reports/20260315_113709/summary.json`:
  - `pages_visited=30`
  - `actions_recorded=642`
  - `issues_total=38`
  - `issues_unexpected=34`
- `prototype.js` 404 bucket і первинний Armory `500` bucket більше не присутні серед top recurring findings; пізніший DB/data-layer blocker уже закрито через direct import з `SPP_Classics_V2` dumps.

### `TASK-030` — `Open public forum and account routes on prefixed website surfaces`

- Status: `[+]`
- Priority: `P2`
- Module: `OPS`
- Allowed roles: `Backend Developer`, `DevOps / Infrastructure`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/docker-website`, `workspace:/opt/mangos-website`, `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, `docs/SESSION_LOG.md`
- Touched paths: `localProjects/cmangos_projects/docker-website/`, `workspace:/opt/mangos-website`, `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, `docs/SESSION_LOG.md`
- Пов'язані context files: `docs/PROJECT_STATUS.md`, `docs/COMMANDS_REFERENCE.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-029`, explicit shared-host approval for live rollout

Мета:

- Прибрати UX gap, за якої реальні navigable website routes на кшталт `index.php?n=forum` і `index.php?n=account&sub=register` віддають `403`, попри те що сам legacy сайт і вже імпортований data layer ці сторінки підтримують.

Acceptance:

- `/classic/`, `/tbc/`, `/wotlk/` можуть вести користувача на forum/account surfaces без `403/404` на web layer.
- Public prefixed routes `index.php?n=forum`, `index.php?n=forum&sub=viewforum...`, `index.php?n=account&sub=register` і пов'язані account/profile redirects більше не блочаться Apache policy.
- Browser audit перевіряє UX-visible forum/account routes замість hidden admin/install-only URLs.

Subtasks:

- [x] Прибрати Apache deny для public forum/account routes, залишивши blocked лише admin/install/config-sensitive surfaces.
- [x] Увімкнути app-level registration/config flags, потрібні для робочого account UX.
- [x] Перевірити live prefixed routes і повторно прогнати browser audit.
- [x] Синхронізувати docs з новим public website contract.

Докази / верифікація:

- `configure-apache.php` і `configure-app.php` переведено на env-driven contract через `MW_ALLOW_FORUM_ROUTES=1`, `MW_ALLOW_ACCOUNT_ROUTES=1`, `MW_ENABLE_REGISTRATION=1`; static Apache default теж вирівняно так, щоб blocked за замовчуванням лишався тільки `admin`.
- Live multiroute compose on `workspace:/opt/mangos-website` оновлено і двічі прокатано через image rollout:
  - `semorgana/mangos-website:task030a-publicroutes-20260315` → route opening
  - `semorgana/mangos-website:task030b-registerassets-20260315` → registration asset repair
- Після першого rollout external smoke підтвердив route-level behavior:
  - `/classic/index.php?n=forum`, `/tbc/index.php?n=forum`, `/wotlk/index.php?n=forum` = `200`
  - `/classic|/tbc|/wotlk/index.php?n=account&sub=register` = `200`
  - `/classic/index.php?n=account&sub=manage` = `200` через login redirect path
- Після відкриття registration pages було виявлено legacy asset debt у `templates/offlike/account/account.register.php`; template переведено на реальні theme assets `ironframe-bg.jpg` і `pixel.gif`, після чого second rollout прибрав новий `404` bucket на register surface.
- Final browser audit `localProjects/cmangos_projects/docker-website/browser-audit/reports/20260315_205236/summary.json` зафіксував новий public baseline:
  - `pages_visited=30`
  - `actions_recorded=1239`
  - `issues_total=295`
  - `issues_unexpected=295`
- Final audit `pages.json` підтверджує, що seeds `/classic|/tbc|/wotlk/index.php?n=forum` і `/classic|/tbc|/wotlk/index.php?n=account&sub=register` реально відвідалися зі status `200`; топ residual findings тепер зосереджені на legacy Armory JS (`armory_link`, `theBGcookie`) і `server commands` CSS/MIME debt, а не на forum/account `403/404`.

### `TASK-031` — `Reduce residual browser-audit defects on live website surfaces`

- Status: `[+]`
- Priority: `P3`
- Module: `OPS`
- Allowed roles: `Frontend Developer`, `Backend Developer`, `DevOps / Infrastructure`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/mangos-website`, `localProjects/cmangos_projects/docker-website/browser-audit`, `workspace:/opt/mangos-website`, `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, `docs/SESSION_LOG.md`
- Touched paths: `localProjects/cmangos_projects/mangos-website/`, `localProjects/cmangos_projects/docker-website/browser-audit/`, `workspace:/opt/mangos-website`, `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, `docs/SESSION_LOG.md`
- Пов'язані context files: `docs/PROJECT_STATUS.md`, `docs/COMMANDS_REFERENCE.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-030`, explicit shared-host approval for live rollout

Мета:

- Зменшити post-`TASK-030` browser-level noise на live website without regressing the newly opened public contract for forum/account routes.

Acceptance:

- Armory pages більше не кидають browser-level hard errors через missing globals на topnav/arena ladder bootstrap.
- Classic/TBC Armory більше не падає в graceful `503` через звернення до `character_achievement` на схемах без цієї таблиці.
- User-facing residuals із latest live triage мають локальний code fix: Armory shell/layout, Auction House empty state, registration asset paths, blank forum/server class icons.
- Browser audit після fix більше не показує `armory_link is not defined` і `theBGcookie is not defined` у top recurring findings.
- Docs зафіксовують новий residual baseline і чітко відрізняють Armory/UI debt від route-availability contract.

Subtasks:

- [x] Прибрати missing-global defects для Armory topnav і arena ladder bootstrap.
- [x] Прибрати Classic Armory hard-fail на `character_achievement` через expansion-aware achievements fallback.
- [x] Підготувати локальний fix set для latest live regressions: AH empty state, Armory centering/topnav width, register asset paths, blank class icon requests.
- [x] Перевірити локально JS/PHP surfaces, які зачеплені правками.
- [x] За наявності live approval розгорнути fix і повторно прогнати targeted verification / browser audit.
- [x] Синхронізувати docs з новим residual baseline.

Докази / верифікація:

- Root-cause triage показав два окремих bootstrap gaps:
  - `armory/shared/global/menu/topnav/buildtopnav.js` звертався до `armory_link`, хоча `armory/index.php` не оголошував цей global у власному shell;
  - `armory/js/arena-ladder-ajax.js` звертався до `theBGcookie`, але в current runtime цей global ніде не ініціалізується.
- Локальний fix зроблено в одному bootstrap layer замість page-by-page patching:
  - `armory/index.php` тепер явно оголошує `armory_link = 'index.php'`;
  - `armory/shared/global/menu/topnav/buildtopnav.js` використовує safe fallback-и для `site_name`, `site_link`, `forum_link`, `armory_link`, `global_nav_lang`;
  - `armory/js/arena-ladder-ajax.js` використовує centralized fallback cookie name `armory.cookieBG`, якщо `theBGcookie` відсутній.
- Після live triage додатково ізольовано actual Classic data-path root cause: `character_achievement` відсутня в `classiccharacters`, тому Armory search/profile не можна валити цим query path on non-WotLK runtimes.
- Розширений локальний patch set тепер також покриває:
  - expansion-aware achievements guard у `armory/configuration/functions.php`, `armory/source/character.php`, `armory/source/character-achievements.php`;
  - Armory shell centering/topnav width stabilisation у `armory/index.php`, `armory/css/master.css`, `armory/shared/global/menu/topnav/topnav.css`;
  - truthful Auction House empty state в `templates/offlike/server/server.ah.php`;
  - remaining registration asset-path repair у `templates/offlike/account/account.register.php`;
  - blank class-icon guards у forum/server surfaces.
- IDE diagnostics для `armory/index.php`, `armory/shared/global/menu/topnav/buildtopnav.js`, `armory/js/arena-ladder-ajax.js` = `No errors found`.
- IDE diagnostics для expanded fix set files = `No errors found`.

### `TASK-032` — `Live rollout TASK-031 fixes + full production readiness verification`

- Status: `[+]`
- Priority: `P1`
- Module: `OPS`
- Allowed roles: `Backend Developer`, `DevOps / Infrastructure`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`, `workspace`
- Lock scope: `workspace:/opt/mangos-website`, `localProjects/cmangos_projects/docker-website`, `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, `docs/SESSION_LOG.md`
- Touched paths: `workspace:/opt/mangos-website`, `localProjects/cmangos_projects/docker-website/`, `localProjects/cmangos_projects/mangos-website/core/`, `localProjects/cmangos_projects/mangos-website/armory/`, `docs/`
- Пов'язані context files: `docs/PROJECT_STATUS.md`, `docs/COMMANDS_REFERENCE.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-031`

Мета:

- Розгорнути всі накопичені website fixes (login SQL, GMP, armory databaseErrorHandler, tooltipmgr SQL guards, SRP6 credential sync, TASK-031 expanded fix set) на `workspace` і довести production readiness через комплексну програму верифікації.

Acceptance:

- Live image deployed і всі 3 expansion containers healthy.
- Zero PHP errors у error logs.
- Static assets: 100% = 200 на Classic/TBC/WotLK.
- Browser audit: 0 unexpected issues.
- Form testing: login/logout/registration flow/armory search/account management — all correct.
- External access через Cloudflare: all public surfaces = 200.
- Security gates: admin/install/config/donate/.git = 403.

Subtasks:

- [x] Deploy image `semorgana/mangos-website:task032b-gmpfix-20260316` на `workspace`.
- [x] Verify login на Classic, TBC, WotLK (correct password + error cases).
- [x] Static asset matrix: Classic 17/17, TBC 15/15, WotLK 15/15, Armory 41/41 = all 200.
- [x] Playwright browser audit matrix: 18 pages, 0 issues.
- [x] Form submission testing: login, registration flow, armory search, armory AJAX, account management.
- [x] PHP error log audit: 0 errors across all 3 containers.
- [x] All 16 component sub-pages verification.
- [x] Protected page audit (manage/chartools/charcreate work, view/pms require permissions).
- [x] Final external audit through Cloudflare: Classic 9/9, TBC, WotLK = 200.
- [x] Security gates verification: install/config/admin/donate/.git = 403.
- [x] Update project documentation.

Докази / верифікація:

- Deployed image: `semorgana/mangos-website:task032b-gmpfix-20260316`.
- Static assets: Classic 17/17 visible resources = 200; TBC 15/15 = 200; WotLK 15/15 = 200; Armory 33 CSS/JS + 8 icons = 200.
- Browser audit: `browser-audit/reports/20260316_041038/` — 18 pages visited, 0 issues, 0 unexpected.
- Login tests: Classic = `LOGIN_SUCCESS`; TBC = `TBC_LOGIN_OK`; WotLK = `WOTLK_LOGIN_OK`; wrong password = "Your password is incorrect"; empty fields = validation messages; nonexistent user = "Bad username".
- Registration: multi-step session flow (rules→captcha→userinfo→accountinfo→save) returns proper form pages at each step.
- Armory search: characters/items/guilds all return 200; AJAX character search with realm = 200/3288B; AJAX item tooltip = 200/65B.
- Account management: manage = 200/63845B, chartools = 200/52775B, charcreate = 200/48340B.
- PHP error logs: 0 errors in all 3 containers.
- External audit: Classic 9/9 pages = 200; TBC frontpage/login/register/forum/server/ah = 200; WotLK frontpage/forum/armory = 200.
- Security: `/install/`, `/config/config.xml`, `/index.php?n=admin`, `/donate.php`, `/.git/` = 403.
- **Note**: TASK-032 verification tested only anonymous/curl-based checks. Logged-in user rendering was broken (see TASK-033).

### `TASK-033` — `Fix broken CSS/styling for logged-in users`

- Status: `[+]`
- Priority: `P0-HOTFIX`
- Module: `SOURCE`
- Allowed roles: `Backend Developer`, `DevOps / Infrastructure`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`, `workspace`
- Lock scope: `localProjects/cmangos_projects/mangos-website/index.php`, `workspace:/opt/mangos-website`, `docs/`
- Touched paths: `localProjects/cmangos_projects/mangos-website/index.php`, `localProjects/cmangos_projects/docker-website/sql/public-site-compat.sql`, `workspace:/opt/mangos-website`, `docs/`
- Пов'язані context files: `docs/PROJECT_STATUS.md`, `docs/SESSION_LOG.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-032`

Мета:

- Виправити повністю зламане відображення сайту для залогінених користувачів: відсутній CSS, зламані зображення, raw HTML без стилів.

Root cause:

- `index.php` (L134-146): Для залогінених юзерів читає `theme` з `website_accounts` VIEW (на `account_extend` таблиці).
- Таблиця `account_extend` була пустою для всіх акаунтів — PHP повертав NULL.
- `$currtmp2[NULL]` в PHP 5.6 = undefined → `$currtmp = "templates/"` (без підпапки) → всі CSS/JS/image шляхи = 404.
- Попередня верифікація (TASK-032) тестувала тільки анонімний/curl-доступ, ніколи не переввіряла logged-in rendering.

Acceptance:

- Logged-in CSS paths коректні: `templates/vanilla/css/newhp.css` (не `templates/css/newhp.css`).
- Fallback для null/missing theme в `index.php` → `default_template`.
- `account_extend` seeded для всіх існуючих акаунтів на Classic/TBC/WotLK.
- Верифіковано через curl login + Playwright screenshot на всіх 3 realm'ах.

Subtasks:

- [x] Діагностувати root cause: `account_extend` пустий → NULL theme → broken CSS paths.
- [x] Виправити `index.php`: додати fallback `if ($currtmp === null || !isset($currtmp2[$currtmp]))` → `default_template`.
- [x] Зібрати та задеплоїти `semorgana/mangos-website:task033-logintheme-20260316`.
- [x] Заповнити `account_extend` для всіх акаунтів на 3 realm'ах (Classic 5, TBC 5, WotLK 5).
- [x] curl-верифікація: Classic=82648B/vanilla ✓, TBC=82535B/vanilla ✓, WotLK=82489B/vanilla ✓.
- [x] Playwright screenshot з cookies: HTML=84204B, SAMUEL=True, vanilla CSS=True.

Докази / верифікація:

- Deployed image: `semorgana/mangos-website:task033-logintheme-20260316`.
- curl login verification:
  - Classic: 82,648B, `templates/vanilla/css/newhp.css`, `SAMUEL` in HTML, 0 broken paths.
  - TBC: 82,535B, `templates/vanilla/css/newhp.css`, `SAMUEL` in HTML, 0 broken paths.
  - WotLK: 82,489B, `templates/vanilla/css/newhp.css`, `SAMUEL` in HTML, 0 broken paths.
- Playwright (Chromium headless with curl cookies): `screenshot_classic_logged.png`, HTML 84,204B, SAMUEL=True, vanilla CSS=True.
- Docker logs confirm no more 404s for `templates/css/` paths.

### `TASK-034` — `Make website browser audit auth-aware and release-gating`

- Status: `[+]`
- Priority: `P0`
- Module: `OPS`
- Allowed roles: `QA / Test Automation`, `Backend Developer`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/docker-website/browser-audit/`, `docs/BACKLOG.md`, `docs/TESTING_AND_RELEASE.md`, `docs/SESSION_LOG.md`, `docs/PROJECT_STATUS.md`
- Touched paths: `localProjects/cmangos_projects/docker-website/browser-audit/`, `docs/`
- Пов'язані context files: `docs/TESTING_AND_RELEASE.md`, `docs/COMMANDS_REFERENCE.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-033`

Мета:

- Прибрати хибне відчуття "production-ready" з guest-only browser audit і додати окремий обов'язковий auth-aware browser gate: реальний login/session, logged-in HTML/resource checks, screenshots, явний fail у summary.

Acceptance:

- У `browser-audit/` існує runnable `auth_render_audit.py` + `run_live_auth_audit.sh` для Classic/TBC/WotLK.
- Summary і markdown report окремо показують auth-check results та fail count.
- Auth runner падає, якщо logged-in page має broken CSS/resource paths, немає user marker або немає expected template CSS.
- `TESTING_AND_RELEASE.md` більше не дозволяє claim `production-ready` без auth-aware browser proof.

Subtasks:

- [x] Додати cookie-backed auth render gate для Classic/TBC/WotLK.
- [x] Додати runnable config + shell runner для live auth audit.
- [x] Прогнати live auth render audit і зберегти report `reports/20260316_205454_auth/`.
- [x] Оновити testing/docs contract.

Докази / верифікація:

- `localProjects/cmangos_projects/docker-website/browser-audit/auth_render_audit.py` — standalone Playwright + curl-cookie gate.
- `localProjects/cmangos_projects/docker-website/browser-audit/live_auth_render_config.json` — 3 auth scenarios.
- Live report: `browser-audit/reports/20260316_205454_auth/`.
- Results:
  - Classic: title=`World of Warcraft Classic`, html=83151B, user marker ✓, expected css ✓, forbidden html ✗, failed resources=0.
  - TBC: title=`World of Warcraft TBC`, html=83038B, user marker ✓, expected css ✓, forbidden html ✗, failed resources=0.
  - WotLK: title=`World of Warcraft WotLK`, html=82992B, user marker ✓, expected css ✓, forbidden html ✗, failed resources=0.
  - release_gate_passed = `true`.

### `TASK-055` — `Restore Armory XML compatibility routes`

- Status: `[+]`
- Priority: `P1-HOTFIX`
- Module: `INFRA`
- Allowed roles: `Backend Developer`, `DevOps / Infrastructure`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`, `workspace`
- Lock scope: `localProjects/cmangos_projects/mangos-website/armory/`, `localProjects/cmangos_projects/docker-website/`, `workspace:/opt/mangos-website`, `docs/`
- Touched paths: `localProjects/cmangos_projects/mangos-website/armory/`, `localProjects/cmangos_projects/docker-website/`, `workspace:/opt/mangos-website`, `docs/`
- Пов'язані context files: `docs/PROJECT_STATUS.md`, `docs/COMMANDS_REFERENCE.md`, `docs/SESSION_LOG.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-034`

Мета:

- Прибрати live `404` на legacy Armory XML-era routes `battlegroups.xml`, `select-team-type.xml`, `arena-ladder.xml`, які досі hardcoded у JS, але вже не існують як реальні файли або dispatcher endpoints.

Acceptance:

- `classic/armory/battlegroups.xml` більше не віддає Apache `404`.
- XML-era Armory compat routes redirect-ять у working current HTML Armory flow замість dead endpoints.
- Prefix-aware deploy layer і root Apache config поводяться однаково.
- Live verification на `world-of-warcraft.morgan-dev.com/classic/armory/battlegroups.xml` задокументована.

Subtasks:

- [x] Додати compat routing для Armory XML-era endpoints.
- [x] Перевірити local syntax gates.
- [x] Задеплоїти й live-verify endpoint behavior.

Докази / верифікація:

- `localProjects/cmangos_projects/docker-website/apache/mangos-website.conf` now adds root `RedirectMatch` for `armory/(battlegroups|select-team-type|arena-ladder).xml` to the working `armory/index.php?searchType=arena` HTML flow.
- `localProjects/cmangos_projects/docker-website/scripts/configure-apache.php` now emits the same compat redirect under prefixed services (`/classic`, `/tbc`, `/wotlk`) so the multiroute deploy layer behaves the same as the root vhost.
- Local syntax gates passed after the final fix: editor diagnostics clean; `php -l localProjects/cmangos_projects/docker-website/scripts/configure-apache.php` → no syntax errors.
- Broken rollout `task055b` was diagnosed from remote logs as a PHP parse error in `configure-apache.php`; the stray injected line inside `normalize_prefix()` was removed, the site was rolled back to the last healthy image, then redeployed cleanly.
- Final live image on `workspace` = `semorgana/mangos-website:task055c-armoryxmlredirectfix-20260316`.
- Remote verification after final deploy: all four website containers (`mangos-website`, `mangos-website-classic`, `mangos-website-tbc`, `mangos-website-wotlk`) are `healthy` on `task055c`.
- Public checks from `morgan.local`:
  - `/classic/armory/battlegroups.xml` → `HTTP 302` to `/classic/armory/index.php?searchType=arena`
  - `/classic/armory/select-team-type.xml` → `HTTP 302` to `/classic/armory/index.php?searchType=arena`
  - `/classic/armory/arena-ladder.xml?ts=3` → `HTTP 302` to `/classic/armory/index.php?searchType=arena`
  - `curl -L` on `/classic/armory/battlegroups.xml` returns the working Armory HTML with `World of Warcraft Armory` and `Vanilla Realm`, proving the old `404` path is closed.

### `TASK-035` — `Define self-service character transfer product contract`

- Status: `[+]`
- Priority: `P1`
- Module: `DOCS`
- Allowed roles: `Documentation / Analyst`, `Backend Developer`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `docs/BACKLOG.md`, `docs/PROJECT_BRIEF.md`, `docs/TRANSFER_SYSTEM.md`, `docs/DECISIONS.md`
- Touched paths: `docs/`
- Пов'язані context files: `docs/PROJECT_BRIEF.md`, `docs/TRANSFER_SYSTEM.md`, `docs/DECISIONS.md`
- Parallel-safe with: `SOURCE`
- Depends on: `TASK-034`

Мета:

- Формалізувати user-facing contract для self-service transfer у website account: які patch-to-patch дії дозволені, хто може їх викликати, які стани має заявка, і що саме означає кнопка `Transfer to TBC` або `Transfer to WotLK`.

Acceptance:

- Задокументовано canonical user flow для `Classic -> TBC` і `Classic/TBC -> WotLK`.
- Зафіксовано, що `Transfer to WotLK` виконується тільки як послідовний chain через TBC, а не direct skip.
- Зафіксовано policy для повторних запитів, partial success, retry, cancel і ownership checks.

Subtasks:

- [x] Описати UX flow для user-triggered transfer з account settings.
- [x] Зафіксувати дозволені source/target combinations.
- [x] Зафіксувати status model: `draft/requested/running/failed/completed/blocked`.
- [x] Зафіксувати policy для повторного запуску, rollback і visibility для користувача.

Докази / верифікація:

- Canonical product contract зафіксовано в `DEC-023` і в новому website-account section у `TRANSFER_SYSTEM`.
- Product contract explicitly спирається на current legacy account IA: `account/manage`, `account/chartools`, `account/charcreate`, а нові `My Characters`, `Change Password` і `Transfers` defined як account-area extensions, а не окремі довільні surfaces.
- Дозволені transfer flows зафіксовано так: `Classic -> TBC`, `TBC -> WotLK`, `Classic -> WotLK only as sequential chain via TBC`; rollback/down-migration не входить у user-facing scope.
- Status/visibility contract зафіксовано так: user always sees request state and history; partial success is visible and cannot be mislabeled as full success.

### `TASK-036` — `Define cross-patch identity and session contract`

- Status: `[+]`
- Priority: `P1`
- Module: `SOURCE`
- Allowed roles: `Backend Developer`, `Security / Compliance`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/mangos-website/`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/BACKLOG.md`
- Touched paths: `localProjects/cmangos_projects/mangos-website/`, `docs/`
- Пов'язані context files: `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-035`

Мета:

- Визначити, як website account і login session мають жити across Classic/TBC/WotLK surfaces, щоб transfer buttons і account settings працювали як єдиний control plane, а не як три ізольовані логіни.

Acceptance:

- Є documented contract для shared session/cookie scope або іншого механізму cross-patch auth continuity.
- Є mapping contract між website account identity і realm-specific account rows.
- Визначено security boundaries для transfer action confirmation.

Subtasks:

- [x] Задокументувати поточний auth/session flow по `/classic`, `/tbc`, `/wotlk`.
- [x] Визначити canonical identity key для website account across patches.
- [x] Вибрати session-sharing strategy для path-based surfaces.
- [x] Зафіксувати second-step confirmation policy для dangerous actions.

Докази / верифікація:

- Current auth flow documented from code: `AUTH::login()` sets cookie using `site_cookie` + serialized account key, while `setcookie(..., $cookie_href)` binds the session to the current patch base path rather than the whole domain.
- Canonical identity contract fixed in `DEC-024`: cross-patch features must not use patch-local `account.id` as the website identity key.
- Canonical session strategy fixed in `ARCHITECTURE`: use one website-scoped identity and one domain-wide account-session contract across `/classic`, `/tbc`, `/wotlk`; patch-local account rows become resolved children, not the session principal.
- Dangerous actions contract fixed: password change and transfer actions require explicit confirmation on top of the authenticated session and must not rely on ambient login state alone.

### `TASK-037` — `Design transfer request schema and audit trail`

- Status: `[+]`
- Priority: `P1`
- Module: `TRANSFER`
- Allowed roles: `Backend Developer`, `Data / ML Engineer`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/mangos-website/`, `localProjects/cmangos_projects/transfer/`, `docs/TRANSFER_SYSTEM.md`, `docs/BACKLOG.md`
- Touched paths: `localProjects/cmangos_projects/mangos-website/`, `localProjects/cmangos_projects/transfer/`, `docs/`
- Пов'язані context files: `docs/TRANSFER_SYSTEM.md`, `docs/DECISIONS.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-036`

Мета:

- Спроєктувати website-side persistent model для transfer requests, step history, actor identity, target patch, per-character state і audit trail.

Acceptance:

- Є schema proposal для request queue, execution log і user-visible status history.
- Є поля для chain execution: `requested_target`, `current_step`, `current_source`, `current_target`, `retry_count`, `last_error`.
- Є policy для immutable audit rows і operator/user attribution.

Subtasks:

- [x] Описати таблицю `transfer_requests`.
- [x] Описати таблицю `transfer_request_steps` або еквівалентний event log.
- [x] Зафіксувати idempotency key і anti-duplicate model.
- [x] Зафіксувати retention policy для logs/history.

Докази / верифікація:

- `docs/TRANSFER_SYSTEM.md` now defines the canonical website-side transfer persistence model: mutable `transfer_requests` head rows plus immutable append-only `transfer_request_events` for step history and user-visible audit.
- The contract explicitly names chain-execution fields required by backlog acceptance: `requested_target`, `current_step`, `current_source`, `current_target`, `retry_count`, `last_error`, plus source character identity and normalized `user_visible_status`.
- Deterministic `idempotency_key` semantics and anti-duplicate behavior are now fixed at schema-contract level for future `TASK-041` implementation work.
- Retention policy is now explicit: request events are append-only and durable for user history/operator audit; raw runner artifacts may rotate separately.
- Durable rationale recorded in `docs/DECISIONS.md` as `DEC-026`.

### `TASK-038` — `Implement character eligibility discovery layer`

- Status: `[+]`
- Priority: `P1`
- Module: `TRANSFER`
- Allowed roles: `Backend Developer`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/mangos-website/`, `localProjects/cmangos_projects/transfer/`, `docs/BACKLOG.md`
- Touched paths: `localProjects/cmangos_projects/mangos-website/`, `localProjects/cmangos_projects/transfer/`, `docs/`
- Пов'язані context files: `docs/TRANSFER_SYSTEM.md`, `docs/AZEROTHCORE_SCHEMA_MAPPING.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-037`

Мета:

- Побудувати шар, який для залогіненого website user показує доступних персонажів, валідні target patches і причини блокування transfer перед натисканням кнопки.

Acceptance:

- Система може визначити список transferable characters для конкретного акаунта.
- Для кожного character видно allowed actions: `to_tbc`, `to_wotlk`, `blocked`.
- Причини блокування нормалізовані й придатні для UI.

Subtasks:

- [x] Описати source queries для Classic/TBC character discovery.
- [x] Зафіксувати blocking rules: online state, rename/customize flags, missing account mapping, stale conflicting target state.
- [x] Додати server-side response contract для eligibility list.
- [x] Задокументувати mismatch cases між website account і realm accounts.

Докази / верифікація:

- `mangos-website/core/common.php` now builds canonical `$account_transfer_eligibility` with per-character actions `to_tbc` / `to_wotlk`, normalized blocker codes, target patch evaluations, and documented source query semantics.
- `components/account/account.manage.php` now exposes `$account_transfer_eligibility` for the logged-in account area instead of leaving eligibility implicit in future UI tasks.
- `docs/TRANSFER_SYSTEM.md` now contains the canonical eligibility contract, blocking rules, mismatch cases, and response examples for allowed and blocked actions.
- Editor diagnostics reported no errors for `core/common.php` and `components/account/account.manage.php` after the helper layer landed.

### `TASK-039` — `Build targeted Classic-to-TBC request runner`

- Status: `[+]`
- Priority: `P1`
- Module: `TRANSFER`
- Allowed roles: `Backend Developer`, `DevOps / Infrastructure`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`, `workspace`
- Lock scope: `localProjects/cmangos_projects/transfer/`, `workspace:/opt/cmangos-transfer`, `docs/BACKLOG.md`
- Touched paths: `localProjects/cmangos_projects/transfer/`, `workspace:/opt/cmangos-transfer`, `docs/`
- Пов'язані context files: `docs/TRANSFER_SYSTEM.md`, `docs/COMMANDS_REFERENCE.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-038`

Мета:

- Адаптувати current transfer pipeline для single-request execution по одному selected account/character у напрямку `Classic -> TBC`, не покладаючись на ручне редагування `sync-accounts.conf`.

Acceptance:

- Існує non-interactive runner для one-request execution з explicit source account/character context.
- Runner не змінює global config як основний спосіб orchestration.
- Result повертає structured success/failure payload для website layer.

Subtasks:

- [x] Винести targeted invocation contract з current `daily-sync.sh`/`lib.sh`.
- [x] Прибрати requirement ручного редагування `sync-accounts.conf` для одиночного transfer.
- [x] Повернути machine-readable execution summary.
- [x] Задокументувати failure modes і safe retry points.

Докази / верифікація:

- `localProjects/cmangos_projects/transfer/daily-sync.sh` refactored its pipeline into `daily_sync_main()` so the verified transfer primitives (`inspect_sync_decision`, `sync_char`, `do_transfer_char`, `verify_character_login_with_retry`, `store_verified_hash_after_login`, `rollback_character`) can be sourced and reused by a request-scoped runner without auto-starting the whole daily pipeline.
- New runner added at `localProjects/cmangos_projects/transfer/targeted-transfer-runner.sh` and deployed to `workspace:/opt/cmangos-transfer/targeted-transfer-runner.sh`.
- Runner contract is explicit and non-interactive: `--account USERNAME`, one of `--character NAME` / `--guid GUID`, optional `--password`, optional `--request-id`, optional `--dry-run`, optional `--json-out`, optional `--no-restart`.
- Runner no longer uses manual edits to `sync-accounts.conf` as orchestration. The selected request identity comes from CLI flags, while password lookup falls back to `sync-accounts.conf` only as a credential source when `--password` is omitted.
- Structured JSON payload is printed to stdout and includes request metadata, source/target, dry-run flag, final `status`, `transfer_decision`, `target_state`, `blocker_code`, `safe_retry_from`, `log_path`, account/character details, step statuses, and ordered `events`.
- Remote deploy on `workspace` backed up the previous scripts and installed updated `lib.sh`, `daily-sync.sh`, and `targeted-transfer-runner.sh` into `/opt/cmangos-transfer/`.
- Local validation: editor diagnostics clean; `bash -n` passes for `lib.sh`, `daily-sync.sh`, `targeted-transfer-runner.sh`.
- Remote runtime dry-run from `/opt/cmangos-transfer`:
  - `./targeted-transfer-runner.sh --account SAMUEL --character Samuel --dry-run`
  - Result: JSON `status=skipped`, `transfer_decision=skip_unchanged`, `target_state=unchanged`, `password_source=sync_conf`, `source_account_id=6`, `character.guid=1801`, `source_online=false`, `source_at_login=0`, with ordered events for `preflight`, `credential_lookup`, `source_lookup`, `source_guard`, `target_guard`, and final `decision`.

### `TASK-040` — `Build chained transfer runner for WotLK requests`

- Status: `[+]`
- Priority: `P1`
- Module: `TRANSFER`
- Allowed roles: `Backend Developer`, `DevOps / Infrastructure`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`, `workspace`
- Lock scope: `localProjects/cmangos_projects/transfer/`, `workspace:/opt/cmangos-transfer`, `docs/BACKLOG.md`, `docs/DECISIONS.md`
- Touched paths: `localProjects/cmangos_projects/transfer/`, `workspace:/opt/cmangos-transfer`, `docs/`
- Пов'язані context files: `docs/TRANSFER_SYSTEM.md`, `docs/DECISIONS.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-039`

Мета:

- Реалізувати orchestration для `Transfer to WotLK`, який завжди виконує chain `Classic -> TBC verify -> WotLK verify` або `TBC -> WotLK verify`, залежно від поточного source patch персонажа.

Acceptance:

- Direct skip `Classic -> WotLK` без проміжного TBC step не допускається.
- Request state відображає кожен step chain окремо.
- Partial success не маскується: якщо TBC пройшов, а WotLK ні, це видно в history і retry semantics.

Subtasks:

- [x] Описати chain state machine для `to_wotlk`.
- [x] Зафіксувати entry rules для Classic-origin і TBC-origin characters.
- [x] Зафіксувати rollback/retry policy після часткового success.
- [x] Описати user-facing messaging для chain progress.

Докази / верифікація:

- `localProjects/cmangos_projects/transfer/targeted-transfer-runner.sh` generalized from a single Classic -> TBC path into a reusable step runner for the only supported step pairs: `classic -> tbc` and `tbc -> wotlk`.
- New chain runner added at `localProjects/cmangos_projects/transfer/chained-wotlk-transfer-runner.sh` and deployed to `workspace:/opt/cmangos-transfer/chained-wotlk-transfer-runner.sh`.
- The chain runner enforces the canonical rules:
  - `--source classic` always evaluates/executes `classic_to_tbc -> tbc_verify -> tbc_to_wotlk -> wotlk_verify`
  - `--source tbc` always evaluates/executes `tbc_to_wotlk -> wotlk_verify`
  - direct `classic -> wotlk` copy is never exposed as a single step.
- Combined JSON payload now exposes top-level `chain_mode`, ordered `chain`, per-step `chain_steps`, embedded step payloads, and merged ordered `events` so progress is visible step by step instead of as one opaque runner result.
- Partial-chain semantics are explicit in code/docs: if the Classic -> TBC stage is available but the WotLK stage blocks or fails during a real run, the chain runner returns top-level `status=partial` and `safe_retry_from=tbc_to_wotlk` rather than hiding the intermediate success.
- Local validation: editor diagnostics clean; `bash -n` passes for the updated `targeted-transfer-runner.sh` and the new `chained-wotlk-transfer-runner.sh`.
- Remote temporary proof on `workspace` with explicit password override succeeded for both entry modes:
  - `chained-wotlk-transfer-runner.sh --source classic --account SAMUEL --password samuel --character Samuel --dry-run`
  - `chained-wotlk-transfer-runner.sh --source tbc --account SAMUEL --password samuel --character Samuel --dry-run`
- Final runtime proof from `/opt/cmangos-transfer` using canonical credential fallback also succeeded for both entry modes:
  - `./chained-wotlk-transfer-runner.sh --source classic --account SAMUEL --character Samuel --dry-run`
  - `./chained-wotlk-transfer-runner.sh --source tbc --account SAMUEL --character Samuel --dry-run`
- Current verified runtime baseline for both commands:
  - top-level `status=skipped`
  - `safe_retry_from=none`
  - `password_source=sync_conf`
  - `character.guid=1801`, `source_online=false`, `source_at_login=0`
  - `classic_via_tbc` payload shows `classic_to_tbc=already_synced`, `tbc_verify=already_verified`, `tbc_to_wotlk=skipped`, `wotlk_verify=not_run`
  - `tbc_direct` payload shows `tbc_to_wotlk=skipped`, `wotlk_verify=not_run`

### `TASK-041` — `Add locking, idempotency, and duplicate-request guards`

- Status: `[x]`
- Priority: `P0`
- Module: `TRANSFER`
- Allowed roles: `Backend Developer`, `Security / Compliance`, `Project Architect`
- Assignee: `GitHub Copilot (GPT-5.4)`
- Machine: `morgan.local`, `workspace`
- Lock scope: `localProjects/cmangos_projects/transfer/`, `localProjects/cmangos_projects/mangos-website/`, `workspace:/opt/cmangos-transfer`, `docs/BACKLOG.md`
- Touched paths: `localProjects/cmangos_projects/transfer/`, `localProjects/cmangos_projects/mangos-website/`, `workspace:/opt/cmangos-transfer`, `docs/`
- Пов'язані context files: `docs/DECISIONS.md`, `docs/TESTING_AND_RELEASE.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-040`

Мета:

- Захистити self-service transfer від double-submit, concurrent execution над одним персонажем і повторного запуску одного й того самого chain через race condition або refresh кнопки.

Acceptance:

- Один character не може мати більше одного active transfer request.
- Повторне натискання кнопки не створює дублікати під час in-flight request.
- Lock cleanup policy задокументована для crash/timeout cases.

Subtasks:

- [x] Визначити lock scope: account-level чи character-level.
- [x] Додати idempotency strategy для UI submit.
- [x] Описати stale lock recovery.
- [x] Зафіксувати concurrency tests як acceptance.

Докази / верифікація:

- `transfer/request-locks.sh` додано як shared guard layer для request-scoped runners; `targeted-transfer-runner.sh` і `chained-wotlk-transfer-runner.sh` тепер повертають `request_guard` metadata (`active_lock_key`, `idempotency_key`, `lock_state`, `existing_request_id`, `stale_lock_recovered`) у JSON payload.
- `mangos-website/core/common.php` now exposes the same canonical guard contract in the eligibility payload via deterministic `request_guard.active_lock_key` and `request_guard.idempotency_key` per action, with `response_contract_version=task041-v1`.
- Runtime acceptance harness `transfer/test-request-lock-guards.sh` added and executed on `workspace:/opt/cmangos-transfer` after deploy.
- Final remote acceptance output from `/opt/cmangos-transfer/test-request-lock-guards.sh`:
  - `targeted_duplicate` => `status=blocked`, `blocker_code=duplicate_request`, `lock_state=duplicate_blocked`, `existing_request_id=live-targeted`
  - `chained_duplicate` => `status=blocked`, `blocker_code=duplicate_request`, `lock_state=duplicate_blocked`, `existing_request_id=live-chain`
  - `stale_recovery` => `status=skipped`, `lock_state=recovered_stale`, `stale_lock_recovered=true`
- `daily-sync.sh` no longer installs its legacy `EXIT` trap when sourced, so request-scoped runners and the new guard harness do not inherit stray batch-log side effects.

### `TASK-042` — `Implement account settings transfer UI`

- Status: `[+]`
- Priority: `P1`
- Module: `SOURCE`
- Allowed roles: `Backend Developer`, `Frontend Developer`, `Project Architect`
- Assignee: `GitHub Copilot (GPT-5.4)`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/mangos-website/`, `docs/BACKLOG.md`
- Touched paths: `localProjects/cmangos_projects/mangos-website/`, `docs/`
- Пов'язані context files: `docs/PROJECT_BRIEF.md`, `docs/TESTING_AND_RELEASE.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-041`, `TASK-047`

Мета:

- Додати у website account/settings user-visible transfer controls поверх уже існуючого roster layer: allowed target actions, confirmations і status badges для кожного персонажа.

Acceptance:

- У logged-in account area видно eligibility list для персонажів.
- Є окремі actions `Transfer to TBC` і `Transfer to WotLK`, якщо вони дозволені rules engine.
- UI показує disabled state і причину блокування, а не просто ховає кнопку.

Subtasks:

- [x] Визначити placement у current website account area.
- [x] Описати minimal UI states: idle, pending confirm, queued, running, failed, completed.
- [x] Додати user confirmation step перед submit.
- [x] Зафіксувати logged-in browser acceptance checks для цього UI.

Докази / верифікація:

- `localProjects/cmangos_projects/mangos-website/components/account/account.manage.php` now prepares the transfer UI view model on top of the existing roster and eligibility payloads: guid-keyed eligibility lookup, minimal status catalog, action labels, and a GET-driven preview state restricted to allowed actions only.
- `localProjects/cmangos_projects/mangos-website/templates/offlike/account/account.manage.php` now extends `My Characters` with transfer-state badges, visible `Transfer to TBC` / `Transfer to WotLK` action cards, blocker reasons for disabled actions, and a confirmation / queued-preview panel under the roster.
- The UI stays truthful: it does not create persistent transfer requests yet, and the preview copy explicitly says queue/history/admin wiring lands in later tasks.
- PHP 5.6 syntax validation passed via `php:5.6-apache` for `templates/offlike/account/account.manage.php`, `components/account/account.manage.php`, and `core/common.php`.
- Logged-in browser acceptance rerun passed on all three public surfaces with report `localProjects/cmangos_projects/docker-website/browser-audit/reports/20260316_233118_auth/auth_render_summary.json`: `checks_total=3`, `checks_failed=0`, `release_gate_passed=true`, screenshots saved for `classic`, `tbc`, and `wotlk`.
- An earlier auth audit attempt failed only on a transient TBC screenshot timeout while HTML/CSS/resource checks were already green; the rerun cleared without code changes, so the task was accepted on the passing report rather than treated as a UI regression.

### `TASK-046` — `Build account character roster data layer`

- Status: `[+]`
- Priority: `P1`
- Module: `TRANSFER`
- Allowed roles: `Backend Developer`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/mangos-website/`, `localProjects/cmangos_projects/transfer/`, `docs/BACKLOG.md`, `docs/TRANSFER_SYSTEM.md`
- Touched paths: `localProjects/cmangos_projects/mangos-website/`, `localProjects/cmangos_projects/transfer/`, `docs/`
- Пов'язані context files: `docs/TRANSFER_SYSTEM.md`, `docs/ARCHITECTURE.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-036`

Мета:

- Дати logged-in website account окремий canonical data layer для перегляду власних персонажів по патчах навіть без запуску transfer flow.

Acceptance:

- Система може повернути roster персонажів, які належать поточному website account, розбитий щонайменше по `Classic`, `TBC`, `WotLK`.
- Для кожного персонажа видно мінімум: patch, name, race, class, level, online/offline state.
- Визначено policy для empty roster, account mismatches і hidden/ineligible characters.

Subtasks:

- [x] Описати mapping website account -> realm account rows для roster lookup.
- [x] Визначити minimal roster fields для UI.
- [x] Зафіксувати query strategy по character DB кожного patch.
- [x] Описати edge cases: empty patch, duplicate names, stale account mapping, deleted characters.

Докази / верифікація:

- `localProjects/cmangos_projects/mangos-website/core/common.php` now contains canonical helper `mw_build_account_character_roster($account_id)`.
- Helper groups roster into `classic`, `tbc`, `wotlk` buckets, returns minimal character fields (`patch`, `name`, `race`, `class`, `level`, `online`) plus realm metadata and policy/status flags.
- `localProjects/cmangos_projects/mangos-website/components/account/account.manage.php` now prepares `$account_character_roster` for logged-in account pages instead of forcing future UI code to re-query `characters` ad hoc.
- Contract and payload example documented in `docs/TRANSFER_SYSTEM.md`; interim architecture limitation (`legacy_account_id` fallback, not full linked cross-patch identity) documented in `docs/ARCHITECTURE.md`.

### `TASK-047` — `Implement logged-in account character roster UI`

- Status: `[+]`
- Priority: `P1`
- Module: `SOURCE`
- Allowed roles: `Backend Developer`, `Frontend Developer`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/mangos-website/`, `docs/BACKLOG.md`, `docs/TESTING_AND_RELEASE.md`
- Touched paths: `localProjects/cmangos_projects/mangos-website/`, `docs/`
- Пов'язані context files: `docs/PROJECT_BRIEF.md`, `docs/TESTING_AND_RELEASE.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-046`

Мета:

- Додати в account area окремий розділ `My Characters`, де залогінений користувач бачить власних персонажів по кожному patch незалежно від того, чи використовує він transfer.

Acceptance:

- У logged-in account area є видимий roster block/tab/section для персонажів.
- Розділ показує персонажів по патчах з базовими даними й коректний empty state.
- Рендер працює в logged-in browser verification і не ламає current account pages.

Subtasks:

- [x] Визначити placement roster section у current account area.
- [x] Описати UI states: loading, empty, populated, partial-unavailable.
- [x] Зафіксувати default sorting/grouping для roster.
- [x] Додати acceptance checks для logged-in render, CSS і navigation.

Докази / верифікація:

- `localProjects/cmangos_projects/mangos-website/templates/offlike/account/account.manage.php` now renders a visible `My Characters` section inside `account/manage` before profile editing controls.
- Default grouping/order is deterministic: `Classic -> TBC -> WotLK`, and characters inside each patch bucket use backend order `level DESC, name ASC` from `TASK-046`.
- Implemented states:
  - server-rendered initial state = immediate synchronous render, no separate spinner state;
  - populated patch = table with `name`, `race`, `class`, `level`, `online/offline`;
  - empty patch = explicit `No characters found on this patch` message;
  - partial-unavailable = warning banner plus per-patch unavailable notice.
- Acceptance gate added to `docs/TESTING_AND_RELEASE.md` for logged-in roster render proof and PHP 5.6 syntax validation.

### `TASK-053` — `Define authenticated password-change contract for website account area`

- Status: `[+]`
- Priority: `P1`
- Module: `DOCS`
- Allowed roles: `Backend Developer`, `Security / Compliance`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `docs/BACKLOG.md`, `docs/DECISIONS.md`, `docs/TESTING_AND_RELEASE.md`, `localProjects/cmangos_projects/mangos-website/`
- Touched paths: `docs/`, `localProjects/cmangos_projects/mangos-website/`
- Пов'язані context files: `docs/DECISIONS.md`, `docs/TESTING_AND_RELEASE.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-036`

Мета:

- Формалізувати безпечний password-change flow для залогіненого website account, включно з перевіркою current password, cross-patch account mapping і post-change user feedback.

Acceptance:

- Є canonical contract для authenticated password change з current-password check.
- Визначено, які realm/account rows оновлюються і як це узгоджується з cross-patch identity model.
- Є policy для success/fail messaging, forced re-login requirement і audit expectations.

Subtasks:

- [x] Зафіксувати authenticated password-change flow в account area.
- [x] Визначити scope update: один patch account чи всі пов'язані patch accounts.
- [x] Зафіксувати security rules: current password, confirmation, rate-limit expectations.
- [x] Зафіксувати release evidence для password-change flow.

Докази / верифікація:

- `docs/TRANSFER_SYSTEM.md` now contains a dedicated `Authenticated Password-Change Contract` section that explicitly separates legacy behavior from the canonical target flow.
- `docs/DECISIONS.md` now records `DEC-025`, fixing the durable rule that password change is a security-sensitive flow with current-password verification, forced re-login, and linked-account-wide target scope by contract.
- `docs/TESTING_AND_RELEASE.md` now defines release evidence expectations for the implementation task `TASK-054`.

### `TASK-054` — `Implement change-password UI in logged-in account area`

- Status: `[+]`
- Priority: `P1`
- Module: `SOURCE`
- Allowed roles: `Backend Developer`, `Frontend Developer`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/mangos-website/`, `docs/BACKLOG.md`, `docs/TESTING_AND_RELEASE.md`
- Touched paths: `localProjects/cmangos_projects/mangos-website/`, `docs/`
- Пов'язані context files: `docs/PROJECT_BRIEF.md`, `docs/TESTING_AND_RELEASE.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-053`

Мета:

- Додати в logged-in account area видиму кнопку або section для зміни паролю з коректним form flow і browser-level verification.

Acceptance:

- У account area є явний entry point для `Change Password`.
- Форма має current password, new password, confirm password і зрозумілий success/error state.
- Browser-level logged-in verification доводить, що рендер і submit flow працюють коректно.

Subtasks:

- [x] Визначити placement change-password entry point у current account area.
- [x] Описати UI states і validation messages.
- [x] Зафіксувати post-success behavior.
- [x] Додати acceptance checks для logged-in browser flow.

Докази / верифікація:

- `localProjects/cmangos_projects/mangos-website/components/account/account.manage.php` now requires `current_pass`, `new_pass`, and `confirm_new_pass`, verifies the current password against local auth data, regenerates `s/v`, updates `sha_pass_hash`, and forces logout on success.
- `localProjects/cmangos_projects/mangos-website/templates/offlike/account/account.manage.php` now renders a visible `Change Password` section with explicit local-only scope messaging and disabled-state fallback when the feature flag is off.
- `localProjects/cmangos_projects/docker-website/scripts/configure-app.php` plus `.env.example` and `.env.multiroute.example` now enable `generic.change_pass` from `MW_ENABLE_PASSWORD_CHANGE` with default-on behavior for account-enabled website surfaces.
- Local syntax validation passed via Docker PHP runtimes for the modified backend/template/configure-app files.
- Remote rollout completed on `workspace`: all website containers (`mangos-website`, `mangos-website-classic`, `mangos-website-tbc`, `mangos-website-wotlk`) now run image `semorgana/mangos-website:task054a-passflow-20260316` and reached `healthy` state after recreate.
- Live authenticated HTML proof now passes on the new deploy: `curl` login against `/classic/` and `/wotlk/` followed by `account.manage` returns `HTTP 200` with `SAMUEL`, `Logout`, `My Characters`, `Change Password`, `Current Password`, and `Confirm New Password` markers present in the rendered page.
- Safe negative submit verification passed on live surfaces without mutating the real password:
  - `/classic/index.php?n=account&sub=manage&action=changepass` with mismatched confirmation returns `New password and confirmation must match.`
  - `/wotlk/index.php?n=account&sub=manage&action=changepass` is wired to the new handler on the deployed surface and no longer serves the pre-`TASK-054` account/manage HTML.
- Existing logged-in auth render audit was rerun after rollout; the pre-existing authenticated render gate still works as the baseline proof that login + logged-in page rendering remain operational on public surfaces.

### `TASK-043` — `Expose transfer history and progress to users`

- Status: `[+]`
- Priority: `P1`
- Module: `SOURCE`
- Allowed roles: `Backend Developer`, `Frontend Developer`, `Project Architect`
- Assignee: `GitHub Copilot (GPT-5.4)`
- Machine: `morgan.local`
- Lock scope: `docs/TRANSFER_SYSTEM.md`, `docs/TESTING_AND_RELEASE.md`, `docs/BACKLOG.md`
- Touched paths: `docs/TRANSFER_SYSTEM.md`, `docs/TESTING_AND_RELEASE.md`, `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, `docs/SESSION_LOG.md`
- Пов'язані context files: `docs/PROJECT_BRIEF.md`, `docs/TRANSFER_SYSTEM.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-042`

Мета:

- Показувати користувачу прозорий history/progress для transfer requests, щоб це не було "натиснув кнопку і не знаю, що відбувається".

Acceptance:

- User бачить active request status і completed/failed history.
- Для chain request видно окремі кроки `Classic -> TBC` і `TBC -> WotLK`.
- Error messages нормалізовані для UI і не течуть сирими internal traces.

Subtasks:

- [x] Визначити format user-facing history list.
- [x] Визначити progress labels для chain requests.
- [x] Нормалізувати error categories для UI.
- [x] Зафіксувати polling/refresh strategy або manual refresh contract.

Докази / верифікація:

- `docs/TRANSFER_SYSTEM.md` now defines the canonical user-facing transfer history layout as one `Active Transfer` summary plus a reverse-chronological `Transfer History` list backed by `transfer_requests` and `transfer_request_events`.
- The same contract now fixes normalized progress labels for step-level chain visibility (`Queued`, `Running`, `Classic -> TBC`, `TBC Verification`, `TBC -> WotLK`, `WotLK Verification`, `Completed`, `Partial`, `Failed`, `Blocked`, `Cancelled`) and states which fields must stay visible on every history row.
- UI-safe error normalization is now explicit in `docs/TRANSFER_SYSTEM.md`: users only see curated categories/messages such as `Eligibility Blocked`, `Duplicate Request`, `Target Conflict`, `Verification Failed`, and `Partial Chain Failure`, never raw shell traces or SQL/PHP output.
- Refresh behavior is now fixed in docs: the contract is manual-refresh-safe by default, page reload must be idempotent, and any future polling must be additive rather than required for correctness.
- `docs/TESTING_AND_RELEASE.md` now contains `TASK-043` acceptance gates requiring the documented history format, normalized labels/categories, refresh contract, and explicit success/fail/partial examples.

### `TASK-044` — `Add admin controls and operational kill-switches`

- Status: `[+]`
- Priority: `P0`
- Module: `OPS`
- Allowed roles: `Backend Developer`, `DevOps / Infrastructure`, `Security / Compliance`, `Project Architect`
- Assignee: `GitHub Copilot (GPT-5.4)`
- Machine: `morgan.local`, `workspace`
- Lock scope: `docs/TRANSFER_SYSTEM.md`, `docs/COMMANDS_REFERENCE.md`, `docs/TESTING_AND_RELEASE.md`, `docs/BACKLOG.md`
- Touched paths: `docs/TRANSFER_SYSTEM.md`, `docs/COMMANDS_REFERENCE.md`, `docs/TESTING_AND_RELEASE.md`, `docs/DECISIONS.md`, `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, `docs/SESSION_LOG.md`
- Пов'язані context files: `docs/COMMANDS_REFERENCE.md`, `docs/TESTING_AND_RELEASE.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-043`

Мета:

- Додати operator-level controls для pause/resume/disable self-service transfer, forced retry, request inspection і emergency stop без ручного хаосу в runtime.

Acceptance:

- Є documented admin-only controls або CLI contract для kill-switch.
- Є safe procedure для pause queue без втрати audit trail.
- Є clear boundary між user actions і operator override.

Subtasks:

- [x] Визначити global feature flag для self-service transfer.
- [x] Визначити admin action set: inspect, retry, cancel, pause, resume.
- [x] Задокументувати emergency stop і recovery runbook.
- [x] Зафіксувати audit requirements для admin overrides.

Докази / верифікація:

- `docs/TRANSFER_SYSTEM.md` now defines the canonical operator control plane for self-service transfer: admin-only action set, global disable/pause/emergency-stop flags, user/operator boundary, request retry/cancel semantics, and audit requirements for overrides.
- `docs/COMMANDS_REFERENCE.md` now contains the shell-level runbook commands for inspecting control flags, toggling feature-disable / queue-pause / emergency-stop state, and reading request-lock metadata before manual recovery.
- `docs/TESTING_AND_RELEASE.md` now contains explicit `TASK-044` acceptance gates for kill-switch coverage, pause/resume safety, recovery ordering, operator-vs-user boundary, and audit metadata requirements.
- `docs/DECISIONS.md` records the durable policy that operator overrides must flow through audited control flags and append-only operator events rather than ad hoc runtime mutation.
- No live mutation was performed on `workspace` for this task; the acceptance target was the documented operational contract and runbook, not an undeclared shared-host rollout.

### `TASK-048` — `Assess feasibility of migrating legacy website to modern PHP`

- Status: `[+]`
- Priority: `P1`
- Module: `DOCS`
- Allowed roles: `Backend Developer`, `Documentation / Analyst`, `Project Architect`
- Assignee: `Samuel Morgan`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/mangos-website/`, `docs/BACKLOG.md`, `docs/PROJECT_BRIEF.md`, `docs/DECISIONS.md`, `docs/SESSION_LOG.md`
- Touched paths: `localProjects/cmangos_projects/mangos-website/`, `docs/`
- Пов'язані context files: `docs/PROJECT_BRIEF.md`, `docs/DECISIONS.md`, `docs/PROJECT_STATUS.md`
- Parallel-safe with: `SOURCE`
- Depends on: `TASK-034`

Мета:

- Дати чесну engineering-оцінку, чи варто переводити current `celguar/mangos-website` на сучасний PHP runtime, і якщо так, то в якому форматі: full rewrite, incremental strangler migration або compatibility-first uplift.

Acceptance:

- Є documented verdict з trade-offs для `full rewrite` vs `incremental modernization`.
- Оцінка спирається на реальний масштаб codebase і legacy-API debt, а не на абстрактні припущення.
- Є decision gate з критеріями, коли full rewrite виправданий, а коли ні.

Subtasks:

- [x] Зафіксувати current codebase scale для website PHP layer.
- [x] Виявити high-risk legacy constructs, несумісні з modern PHP.
- [x] Оцінити surface split: public pages, account area, armory, admin, donate, forum.
- [x] Зафіксувати recommendation і decision gate в docs.

Докази / верифікація:

- Current website scale verified: `321` PHP files, `53,355` PHP LOC.
- Surface split snapshot verified: `components=162`, `templates=81`, `armory=40`, `core=27`, `install=2`, `root=5` PHP files.
- Compatibility debt snapshot verified: `144` `mysql_*` usages, `325` legacy constructs matching `ereg/split/each/create_function`, `0` Composer manifests.
- Verdict fixed in `DEC-022`: modern PHP migration is realistic only as incremental modernization / strangler path; big-bang rewrite is explicitly not the recommended starting move.
- Website execution order after this decision: feature work can proceed on current legacy surface via `TASK-035 -> TASK-036 -> TASK-046 -> TASK-047`, while deeper modernization remains a separate strategic track via `TASK-049..TASK-052`.

### `TASK-049` — `Inventory PHP 5.6 compatibility debt in mangos-website`

- Status: `[+]`
- Priority: `P1`
- Module: `SOURCE`
- Allowed roles: `Backend Developer`, `Project Architect`
- Assignee: `GitHub Copilot (GPT-5.4)`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/mangos-website/`, `docs/BACKLOG.md`, `docs/SESSION_LOG.md`
- Touched paths: `localProjects/cmangos_projects/mangos-website/`, `docs/`
- Пов'язані context files: `docs/DECISIONS.md`, `docs/PROJECT_STATUS.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-048`

Мета:

- Провести інвентаризацію legacy constructs, extensions і code paths, які заблокують прямий перехід з `php:5.6-apache` на PHP 8.x.

Acceptance:

- Є categorized список incompatibilities: removed mysql extension, fatal/warning behavior changes, dynamic properties, deprecated patterns, legacy libs.
- Є heatmap по зонах ризику: account, forum, armory, admin, donate, bootstrap/core.
- Є пріоритезація critical blockers vs optional cleanup.

Subtasks:

- [x] Знайти `mysql_*` та інші removed/deprecated API usage.
- [x] Виділити vendor-like або legacy subsystems, які краще ізолювати, а не переносити line-by-line.
- [x] Зафіксувати runtime/library assumptions current image.
- [x] Підготувати compatibility debt summary для decision phase.

Докази / верифікація:

- Runtime baseline verified from `docker-website/Dockerfile`: current image is `php:5.6-apache` on archived Debian Stretch, installs `gd`, `gmp`, `mysql`, `mysqli`, and `pdo_mysql`, and the repo still has no `composer.json` or `composer.lock`.
- Critical direct PHP 7/8 blockers verified in source:
  - `144` `mysql_*` refs across `22` PHP files; heaviest hotspots include `components/admin/chartools/functionstransfer.php` (`27` refs), `donate.php` (`11`), `components/chat/lib/class/AJAXChatMySQLQuery.php` (`10`), and multiple Armory handlers.
  - `6` magic-quotes assumptions via `get_magic_quotes_gpc()` / `set_magic_quotes_runtime()`, including `core/common.php`, `components/chat/lib/class/AJAXChat.php`, and `components/community/community.vote.php`.
  - `7` removed curly-brace string-offset usages, including `core/class.image.php`, `components/server/server.gmonline.php`, and `armory/configuration/statisticshandler.php`.
  - `3` `preg_replace ... /e` usages, including live code in `core/common.php` and `components/chat/lib/class/AJAXChatEncoding.php`.
  - `1` `create_function()` usage in `components/chat/lib/class/AJAXChat.php`, `1` `eregi()` usage in `core/mail/func.php`, and `3` `=& new` references in `components/ajax/ajax.php` plus bundled DbSimple drivers.
  - `13` old-style constructor references in bundled libraries (`DbSimple`, `JsHttpRequest`, `AJAXChat` family), making those subsystems especially poor candidates for line-by-line uplift.
- Heatmap by product surface:
  - `account`: `3` `mysql_*` refs + `3` compatibility-blocker refs, centered in `core/common.php` and `core/class.auth.php`.
  - `forum`: `18` `mysql_*` refs + `5` compatibility-blocker refs, dominated by bundled `AJAXChat`.
  - `armory`: `28` `mysql_*` refs + `7` compatibility-blocker refs; densest user-facing modernization hotspot.
  - `admin`: `44` `mysql_*` refs; highest raw ext/mysql concentration.
  - `donate`: `12` `mysql_*` refs, mostly in `donate.php`; low-value but high-risk legacy surface.
  - `bootstrap/core`: `3` `mysql_*` refs + `12` compatibility-blocker refs, including `DbSimple`, mail helpers, `JsHttpRequest`, and image utilities.
- Vendor-like / isolate-first subsystems now explicitly identified for the next architecture step: `core/dbsimple`, `core/ajax_lib` + `components/ajax`, `components/chat/lib`, `core/mail`, `core/thumbnail.inc.php` / `core/class.image.php`, and the standalone `donate.php` PayPal IPN path.
- Severity split fixed for `TASK-050` input:
  - `critical blockers` = `mysql_*`, `/e`, `create_function`, `eregi`, curly-brace string offsets, `=& new`, old-style constructor-heavy bundled libs.
  - `secondary cleanup` = magic-quotes assumptions, dynamic-property-style mutable legacy objects, lack of Composer/package boundaries, and general bootstrap/core coupling.

### `TASK-050` — `Define modernization target architecture for website`

- Status: `[+]`
- Priority: `P1`
- Module: `DOCS`
- Allowed roles: `Backend Developer`, `Frontend Developer`, `Project Architect`
- Assignee: `GitHub Copilot (GPT-5.4)`
- Machine: `morgan.local`
- Lock scope: `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/BACKLOG.md`, `localProjects/cmangos_projects/mangos-website/`
- Touched paths: `docs/`, `localProjects/cmangos_projects/mangos-website/`
- Пов'язані context files: `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/PROJECT_BRIEF.md`
- Parallel-safe with: `SOURCE`
- Depends on: `TASK-049`

Мета:

- Визначити цільову архітектуру modernization path: чи це PHP 8.x monolith hardening, модульний strangler з новими services/controllers, чи повний greenfield app з поступовим переключенням route-ів.

Acceptance:

- Є вибраний target architecture pattern.
- Є route-by-route migration strategy замість "переписати весь сайт за раз".
- Є межа між legacy runtime і новим application layer.

Subtasks:

- [x] Описати варіанти target architecture.
- [x] Вибрати preferred path для цього проєкту.
- [x] Зафіксувати route/module migration boundary.
- [x] Описати coexistence strategy на перехідний період.

Докази / верифікація:

- `docs/ARCHITECTURE.md` now documents three considered options and fixes the preferred target shape as a route-level strangler with a companion PHP 8.x app layer, not an in-place monolith upgrade and not a first-wave greenfield rewrite.
- The chosen public contract is explicit:
  - keep the current domain and patch prefixes `/classic/`, `/tbc/`, `/wotlk`;
  - keep the legacy PHP 5.6 website as shell/fallback;
  - peel off route-owned slices behind a thin routing handoff instead of replacing the whole site at once.
- The route/module migration boundary is now fixed:
  - modern first-wave owner = account identity/session bridge, account security, roster, transfer queue/history/control-plane;
  - legacy hold zone = Armory, forum/chat, admin/chartools, donate, and bundled legacy helper libraries.
- Coexistence strategy is now documented: selected routes can hand off either at ingress/proxy level or via a thin legacy-side dispatcher for query-driven `index.php?n=...` ownership changes while preserving canonical public URLs.
- `docs/DECISIONS.md` records the durable rule that bundled legacy subsystems stay isolate-or-replace zones and that the first modern slice should run beside the current live website runtime rather than replace it.

### `TASK-051` — `Break website modernization into route-level slices`

- Status: `[+]`
- Priority: `P1`
- Module: `DOCS`
- Allowed roles: `Documentation / Analyst`, `Backend Developer`, `Project Architect`
- Assignee: `GitHub Copilot (GPT-5.4)`
- Machine: `morgan.local`
- Lock scope: `docs/BACKLOG.md`, `docs/PROJECT_BRIEF.md`, `localProjects/cmangos_projects/mangos-website/`
- Touched paths: `docs/`, `localProjects/cmangos_projects/mangos-website/`
- Пов'язані context files: `docs/PROJECT_BRIEF.md`, `docs/ARCHITECTURE.md`
- Parallel-safe with: `SOURCE`
- Depends on: `TASK-050`

Мета:

- Перетворити modernization plan на дрібні vertical slices по route/module ownership, щоб уникнути нереалістичної задачі "rewrite everything".

Acceptance:

- Є backlog decomposition по зрозумілих slices: auth/account, roster/transfer, forum, armory, server pages, admin, donate.
- Для кожного slice є migration objective, touched paths і acceptance.
- Є окремо позначені зони, які краще відкласти або ізолювати.

Subtasks:

- [x] Виділити website modules для independent migration.
- [x] Дати priority order для slices.
- [x] Позначити low-value/high-risk areas для postpone/isolate.
- [x] Підготувати execution-ready backlog sequence.

Докази / верифікація:

- `BACKLOG` now contains a route-level modernization sequence after the prototype gate instead of one monolithic rewrite card.
- Execution order is now explicit:
  - prototype gate = `TASK-052`;
  - first-wave modern slices = `TASK-056 -> TASK-057 -> TASK-058 -> TASK-059`;
  - lower-priority public/hold-zone slices = `TASK-060 -> TASK-061 -> TASK-062 -> TASK-063 -> TASK-064`.
- Slice ownership is now separated by value/risk:
  - first-wave owner = session/identity, account security, roster, transfer control-plane;
  - postpone/isolate zones = server/public content later, then Armory, forum/chat, admin chartools, donate/payment.
- Each new slice card now has its own migration objective, touched paths, dependencies, and acceptance criteria.

### `TASK-052` — `Prototype modern PHP runtime for one low-risk website slice`

- Status: `[+]`
- Priority: `P2`
- Module: `SOURCE`
- Allowed roles: `Backend Developer`, `Frontend Developer`, `Project Architect`
- Assignee: `GitHub Copilot (GPT-5.4)`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/mangos-website/`, `localProjects/cmangos_projects/docker-website/`, `docs/BACKLOG.md`, `docs/SESSION_LOG.md`, `docs/TESTING_AND_RELEASE.md`
- Touched paths: `localProjects/cmangos_projects/mangos-website/`, `localProjects/cmangos_projects/docker-website/`, `docs/`
- Пов'язані context files: `docs/TESTING_AND_RELEASE.md`, `docs/ARCHITECTURE.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-051`

Мета:

- Довести modernization path на малому безпечному зрізі, перш ніж вкладатися у більший rewrite track.

Acceptance:

- Є один low-risk route/module, піднятий на modern PHP runtime або в новому isolated app layer.
- Є порівняння engineering cost vs результат.
- Є go/no-go decision для ширшої modernization wave.

Subtasks:

- [x] Вибрати low-risk slice для prototype.
- [x] Підняти isolated modern runtime path локально.
- [x] Перевірити browser/render contract для цього slice.
- [x] Зафіксувати lessons learned і next decision.

Докази / верифікація:

- Prototype slice selected = legacy `server.realmstatus`, because it is public, read-only, and isolated in `components/server/server.realmstatus.php` plus `templates/offlike/server/server.realmstatus.php` without needing the account/session bootstrap.
- Added an isolated PHP 8 companion runtime under `localProjects/cmangos_projects/docker-website/modern-prototype/` with standalone compose entrypoint `docker-compose.modern-prototype.yml` and verification scripts `scripts/run-modern-realmstatus-prototype.sh` plus `scripts/test-modern-realmstatus-contract.sh`.
- Static gates passed locally:
  - `bash -n localProjects/cmangos_projects/docker-website/scripts/test-modern-realmstatus-contract.sh`
  - `bash -n localProjects/cmangos_projects/docker-website/scripts/run-modern-realmstatus-prototype.sh`
  - `docker run --rm -v "$PWD/localProjects/cmangos_projects/docker-website/modern-prototype/public":/app -w /app php:8.3-cli php -l index.php`
  - `docker compose --env-file localProjects/cmangos_projects/docker-website/.env.example -f localProjects/cmangos_projects/docker-website/docker-compose.modern-prototype.yml config`
- Runtime proof passed locally via `localProjects/cmangos_projects/docker-website/scripts/run-modern-realmstatus-prototype.sh`; result included `contract_markers=ok` when comparing the PHP 8 prototype HTML against the live legacy page `https://world-of-warcraft.morgan-dev.com/wotlk/index.php?n=server&sub=realmstatus`.
- Prototype limitation was captured explicitly: rendered page exposed `data-source="fallback"` with `db_unreachable: ... getaddrinfo for cmangos-wotlk-db failed`, proving the isolated runtime shape works but does not yet have a truthful local bridge into the legacy DB network.
- Engineering cost vs result:
  - cost = low, because one route-specific PHP 8 app, one compose file, and one shell smoke were enough to prove the isolation pattern;
  - result = good enough for a modernization go/no-go, but not enough for production routing because DB/session/ingress handoff is still absent.
- Go / no-go recommendation = `GO` for the strangler architecture itself; next production-grade work should move to `TASK-056` session/identity bridging rather than expanding the public server-pages prototype sideways.

### `TASK-056` — `Build modern website identity/session bridge slice`

- Status: `[x]`
- Priority: `P1`
- Module: `SOURCE`
- Allowed roles: `Backend Developer`, `Frontend Developer`, `Project Architect`
- Assignee: `GitHub Copilot (GPT-5.4)`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/mangos-website/`, `localProjects/cmangos_projects/docker-website/`, `docs/BACKLOG.md`, `docs/SESSION_LOG.md`, `docs/TESTING_AND_RELEASE.md`
- Touched paths: `localProjects/cmangos_projects/mangos-website/`, `localProjects/cmangos_projects/docker-website/`, `docs/`
- Пов'язані context files: `docs/ARCHITECTURE.md`, `docs/PROJECT_BRIEF.md`, `docs/TESTING_AND_RELEASE.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-052`

Мета:

- Винести website-scoped identity/session resolution в перший modern PHP slice без зміни публічного contract-а `/classic` / `/tbc` / `/wotlk`.

Acceptance:

- Є companion-layer entrypoint, який обслуговує один authenticated session/identity slice на PHP 8.x.
- Session scope і ownership checks відповідають canonical website-identity contract.
- Legacy runtime не втрачає fallback path для всіх не-модернізованих routes.

Subtasks:

- [x] Обрати minimal dispatcher/handoff entrypoint для session-owned routes.
- [x] Підняти website-identity/session adapter без залежності від legacy bootstrap як primary app kernel.
- [x] Зафіксувати fallback path назад у legacy runtime.
- [x] Оновити release/test evidence requirements для mixed legacy+modern session flow.

Докази / верифікація:

- Companion PHP 8 slice now serves `/wotlk/modern/account/identity`, consumes the legacy `mangosWeb` cookie once, validates `website_account_keys`, mints a root-scoped `mw-modern-session`, and reuses that cookie on subsequent authenticated requests.
- Ownership enforcement is verified: `account_id=42` succeeds for the bridged principal, while `account_id=99` returns `403` instead of leaking another account surface.
- Non-modernized account/manage stays on the legacy path via `302 Location: /wotlk/index.php?n=account&sub=manage`, and unauthenticated requests still fall back to the legacy login path.
- Runtime acceptance passed via `localProjects/cmangos_projects/docker-website/scripts/run-modern-session-bridge-smoke.sh` after two truthful fixes in the harness: the prototype service now receives explicit fixture DB env values, and the smoke reseeds the auth fixture rows deterministically after container startup instead of trusting partial MariaDB init state.

### `TASK-057` — `Migrate account security slice to modern PHP layer`

- Status: `[x]`
- Priority: `P1`
- Module: `SOURCE`
- Allowed roles: `Backend Developer`, `Frontend Developer`, `Project Architect`
- Assignee: `GitHub Copilot (GPT-5.4)`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/mangos-website/`, `localProjects/cmangos_projects/docker-website/`, `docs/BACKLOG.md`, `docs/SESSION_LOG.md`, `docs/TESTING_AND_RELEASE.md`
- Touched paths: `localProjects/cmangos_projects/mangos-website/`, `localProjects/cmangos_projects/docker-website/`, `docs/`
- Пов'язані context files: `docs/ARCHITECTURE.md`, `docs/TESTING_AND_RELEASE.md`, `docs/DECISIONS.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-056`

Мета:

- Перенести authenticated account-security actions, починаючи з password-change flow, у modern PHP slice поверх нового session bridge.

Acceptance:

- Canonical password-change flow працює в modern layer з current-password verify, confirmation, forced re-login, і truthful scope statement.
- Legacy `changepass` surface більше не є canonical owner for the migrated action.
- Browser/render contract для logged-in account-security flow зберігається.

Subtasks:

- [x] Мігрувати password-change handling у modern slice.
- [x] Забезпечити explicit re-auth / logout semantics after success.
- [x] Зафіксувати coexistence boundary between migrated and legacy account routes.
- [x] Додати release evidence requirements for mixed legacy/modern logged-in rendering.

Докази / верифікація:

- Modern companion runtime now owns `/wotlk/modern/account/security` and serves the canonical password-change form with `current_pass`, `new_pass`, and `confirm_new_pass`, plus a truthful `local-only` scope statement until linked-account-wide propagation exists.
- Password change success updates the auth row (`sha_pass_hash`, `s`, `v`, `sessionkey=NULL`), deletes the active `website_account_keys` row, expires both auth cookies, and forces re-login for both legacy-cookie and modern-cookie paths.
- Modern session cookies are now revocable instead of being purely self-validating: the companion layer stores a `session_guard` in the modern cookie and revalidates it against `website_account_keys` on subsequent requests.
- Legacy account-manage UI no longer posts to `action=changepass`; its password form now points to the modern owner route `.../modern/account/security`, which establishes the coexistence boundary without breaking legacy navigation around the rest of account/manage.
- Runtime acceptance passed via `localProjects/cmangos_projects/docker-website/scripts/run-modern-account-security-smoke.sh`, and the shared `run-modern-session-bridge-smoke.sh` regression still passes after the session-guard change.

### `TASK-058` — `Migrate roster and account overview slice`

- Status: `[+]`
- Priority: `P1`
- Module: `SOURCE`
- Allowed roles: `Backend Developer`, `Frontend Developer`, `Project Architect`
- Assignee: `GitHub Copilot (GPT-5.4)`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/mangos-website/`, `localProjects/cmangos_projects/docker-website/`, `docs/BACKLOG.md`, `docs/SESSION_LOG.md`, `docs/TESTING_AND_RELEASE.md`
- Touched paths: `localProjects/cmangos_projects/mangos-website/`, `localProjects/cmangos_projects/docker-website/`, `docs/`
- Пов'язані context files: `docs/ARCHITECTURE.md`, `docs/TESTING_AND_RELEASE.md`, `docs/DECISIONS.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-057`

Мета:

- Перенести `My Characters` і базовий account overview у modern slice поверх companion session layer, зберігши truthful per-patch roster semantics.

Acceptance:

- Modern layer serves roster/account overview with canonical patch buckets and truthful empty/partial states.
- Current numeric `legacy_account_id` fallback behavior is either preserved explicitly or replaced with a verified website-identity mapping layer.
- Logged-in navigation still lands on stable canonical public URLs.

Subtasks:

- [x] Move roster rendering/response ownership to the modern layer.
- [x] Keep or replace current cross-patch account-mapping fallback truthfully.
- [x] Preserve existing user-facing bucket semantics and patch labels.
- [x] Add mixed-layer render/browser verification for logged-in roster pages.

Докази / верифікація:

- `localProjects/cmangos_projects/docker-website/modern-prototype/public/index.php` now owns `/classic|/tbc|/wotlk/modern/account/manage` instead of redirecting straight to legacy, reusing the verified session bridge from `TASK-056` and preserving explicit `identity_mode=legacy_account_id` roster semantics.
- `localProjects/cmangos_projects/docker-website/modern-prototype/sql/identity-test-init.sql` now seeds canonical fixture buckets: populated `classic`, empty `tbc`, unavailable `wotlk`.
- `localProjects/cmangos_projects/docker-website/scripts/run-modern-account-overview-smoke.sh` passed and returned `overview_guest_fallback=ok`, `overview_render=ok`, `identity_mode=legacy_account_id`, `classic_bucket_populated=ok`, `tbc_bucket_empty=ok`, `wotlk_bucket_unavailable=ok`, `modern_cookie_reuse=ok`.

### `TASK-059` — `Migrate transfer request control-plane slice`

- Status: `[+]`
- Priority: `P1`
- Module: `SOURCE`
- Allowed roles: `Backend Developer`, `Frontend Developer`, `Project Architect`
- Assignee: `GitHub Copilot (GPT-5.4)`
- Machine: `morgan.local`, `workspace`
- Lock scope: `localProjects/cmangos_projects/mangos-website/`, `localProjects/cmangos_projects/transfer/`, `localProjects/cmangos_projects/docker-website/`, `workspace:/opt/cmangos-transfer`, `docs/BACKLOG.md`, `docs/SESSION_LOG.md`, `docs/TESTING_AND_RELEASE.md`
- Touched paths: `localProjects/cmangos_projects/mangos-website/`, `localProjects/cmangos_projects/transfer/`, `localProjects/cmangos_projects/docker-website/`, `docs/`, `workspace:/opt/cmangos-transfer`
- Пов'язані context files: `docs/TRANSFER_SYSTEM.md`, `docs/TESTING_AND_RELEASE.md`, `docs/DECISIONS.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-058`

Мета:

- Перенести website self-service transfer submit/history/operator-aware control-plane surfaces у modern app layer без руйнування verified transfer runtime contract на `workspace`.

Acceptance:

- Modern layer owns transfer submit/progress/history/control-plane UI for the migrated slice.
- Existing runtime contracts (`targeted-transfer-runner`, chained runner, duplicate guards, control flags) stay the authoritative backend safety layer.
- Browser-level logged-in proof and runtime execution proof both exist before readiness claims.

Subtasks:

- [x] Wire modern UI/actions to canonical runtime/request contracts.
- [x] Preserve duplicate guards, history semantics, and operator control boundaries.
- [x] Define fallback/rollback behavior between modern UI and legacy shell.
- [x] Add release-gate evidence requirements for end-to-end logged-in transfer flows.

Докази / верифікація:

- `localProjects/cmangos_projects/docker-website/modern-prototype/public/index.php` now owns transfer submit/history/operator-aware control-plane rendering on `/classic|/tbc|/wotlk/modern/account/manage`, including duplicate-request reuse, active/history panels, and control-flag-aware blocked submits.
- `localProjects/cmangos_projects/docker-website/modern-prototype/sql/identity-test-init.sql` now seeds demo request heads/events plus transfer control-flag state so the prototype can render completed, partial, queued, and operator-blocked transfer states truthfully.
- Local exact-sequence proof via an isolated prototype repro confirmed the blocked-submit render contract after `created -> duplicate -> completed -> operator-disabled`: final HTML contained `data-transfer-flash="control_blocked"` and `data-control-flag="self-service-transfer.disabled.flag"`.
- Runtime control-flag proof passed on `workspace:/opt/cmangos-transfer/test-transfer-control-flags.sh` after syncing the updated control helpers and returned:
  - `operator_disabled.status=blocked`, `operator_disabled.blocker_code=operator_disabled`
  - `queue_paused.status=blocked`, `queue_paused.blocker_code=queue_paused`
  - `emergency_stop.status=blocked`, `emergency_stop.blocker_code=emergency_stop`

### `TASK-060` — `Migrate low-risk public server pages slice`

- Status: `[+]`
- Priority: `P2`
- Module: `SOURCE`
- Allowed roles: `Backend Developer`, `Frontend Developer`, `Project Architect`
- Assignee: `GitHub Copilot (GPT-5.4)`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/mangos-website/components/server/server.howtoplay.php`, `localProjects/cmangos_projects/mangos-website/templates/offlike/server/server.howtoplay.php`, `localProjects/cmangos_projects/mangos-website/lang/howtoplay/`, `localProjects/cmangos_projects/docker-website/modern-prototype/public/index.php`, `localProjects/cmangos_projects/docker-website/scripts/`, `docs/BACKLOG.md`, `docs/SESSION_LOG.md`, `docs/TESTING_AND_RELEASE.md`
- Touched paths: `localProjects/cmangos_projects/mangos-website/components/server/server.howtoplay.php`, `localProjects/cmangos_projects/mangos-website/templates/offlike/server/server.howtoplay.php`, `localProjects/cmangos_projects/mangos-website/lang/howtoplay/`, `localProjects/cmangos_projects/docker-website/modern-prototype/public/index.php`, `localProjects/cmangos_projects/docker-website/scripts/`, `docs/`
- Пов'язані context files: `docs/ARCHITECTURE.md`, `docs/TESTING_AND_RELEASE.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-052`

Мета:

- Обрати й перенести один low-risk public content/server-status slice після prototype gate, не затягуючи Armory/forum/admin/donate у першу хвилю.

Acceptance:

- One public non-auth slice works in the modern layer with the same canonical public URL contract.
- The chosen slice avoids subsystem-heavy hold zones.
- Browser/render parity is documented against the legacy baseline.

Subtasks:

- [x] Pick a low-risk public slice such as status/news/frontpage helper content.
- [x] Move ownership to the modern layer with fallback path.
- [x] Compare legacy vs modern render/output behavior.
- [x] Record whether this path should be repeated for other public pages.

Докази / верифікація:

- `localProjects/cmangos_projects/docker-website/modern-prototype/public/index.php` now owns the canonical public route `/wotlk/index.php?n=server&sub=howtoplay` plus its prefixed `classic|tbc|wotlk` variants, loading bundled legacy `lang/howtoplay/*.html` resources directly instead of bootstrapping the legacy PHP 5.6 site.
- `localProjects/cmangos_projects/docker-website/modern-prototype/Dockerfile` now packages the exact legacy inputs this slice depends on (`mangos-website/config/config.xml` and `mangos-website/lang/howtoplay/`) so the prototype proof does not rely on host-only filesystem access.
- `localProjects/cmangos_projects/docker-website/scripts/run-modern-public-howtoplay-smoke.sh` passed on `morgan.local` against the live legacy baseline and the local prototype canonical URL with:
  - `public_howtoplay_contract=ok`
  - `language_fallback=ok`
- Repeatability decision recorded during implementation: this path is safe to repeat for other static `lang_resource(...)` public guide pages, but it should not be treated as proof that forum-backed/news-backed public surfaces can move with the same lightweight pattern.

### `TASK-061` — `Contain or replace Armory as a separate modernization track`

- Status: `[+]`
- Priority: `P3`
- Module: `DOCS`
- Allowed roles: `Documentation / Analyst`, `Backend Developer`, `Project Architect`
- Assignee: `GitHub Copilot (GPT-5.4)`
- Machine: `morgan.local`
- Lock scope: `docs/BACKLOG.md`, `docs/ARCHITECTURE.md`, `docs/SESSION_LOG.md`, `localProjects/cmangos_projects/mangos-website/armory/`
- Touched paths: `docs/`, `localProjects/cmangos_projects/mangos-website/armory/`
- Пов'язані context files: `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`
- Parallel-safe with: `SOURCE`
- Depends on: `TASK-052`

Мета:

- Винести Armory в окремий containment/replacement track замість затягування його у першу modernization хвилю.

Acceptance:

- Є explicit decision, чи Armory лишається на legacy runtime довше, чи потребує dedicated replacement path.
- Dependency debt and blocker concentration for Armory are documented as a separate track.
- Main modernization wave більше не залежить від Armory migration.

Subtasks:

- [x] Document Armory-specific blocker cluster and hold-line.
- [x] Decide legacy hold vs dedicated replacement path.
- [x] Define the minimum public compatibility contract that must survive.
- [x] Split any follow-up Armory work into its own backlog items if needed.

Докази / верифікація:

- Explicit decision recorded in `docs/DECISIONS.md`: Armory stays on the legacy multiroute PHP 5.6 runtime as a contained subsystem for now; any future PHP 8 modernization must be treated as a dedicated replacement/containment program rather than the next route-level slice.
- `docs/ARCHITECTURE.md` now documents the Armory blocker cluster separately from the main modernization wave: separate `classicarmory|tbcarmory|wotlkarmory` data layer, XML-era compatibility redirects, legacy JS/bootstrap globals, and expansion-specific behavior such as non-WotLK achievements fallbacks.
- Minimum public compatibility contract fixed for the legacy hold period:
  - `/classic|/tbc|/wotlk/armory/index.php` remain public, patch-aware, and read-only
  - legacy XML-era endpoints keep redirecting into the HTML Armory flow instead of returning `404`
  - public Armory failures must degrade without leaking raw SQL/internal diagnostics
  - patch switch/topnav and website-to-Armory links must keep working while Armory remains legacy-owned
- No new implementation backlog item was added in this cycle because the containment decision is to keep Armory off the current modernization critical path; any future replacement work must be intentionally re-prioritized as a separate track.

### `TASK-062` — `Contain forum and chat as a legacy hold-zone slice`

- Status: `[x]`
- Priority: `P3`
- Module: `DOCS`
- Allowed roles: `Documentation / Analyst`, `Backend Developer`, `Project Architect`
- Assignee: `GitHub Copilot (GPT-5.4)`
- Machine: `morgan.local`
- Lock scope: `docs/BACKLOG.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/PROJECT_STATUS.md`, `docs/SESSION_LOG.md`
- Touched paths: `docs/`
- Пов'язані context files: `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`
- Parallel-safe with: `SOURCE`
- Depends on: `TASK-052`

Мета:

- Зафіксувати forum/chat як окремий legacy hold zone, щоб first-wave modernization не залежав від `AJAXChat` і related bundled libraries.

Acceptance:

- Forum/chat explicitly marked as hold-or-replace zone, not a hidden prerequisite to account/transfer modernization.
- `AJAXChat` and related dependencies have a documented containment boundary.
- Any future modernization of forum/chat is split into its own follow-up track.

Subtasks:

- [x] Document forum/chat ownership boundary.
- [x] Record `AJAXChat` dependency cluster as a separate hold/replacement concern.
- [x] Define what public compatibility must remain while it stays legacy.
- [x] Create follow-up items only if/when the project wants to modernize this area explicitly.

Докази / верифікація:

- Explicit containment decision recorded in `docs/DECISIONS.md`: forum/chat stays on the legacy multiroute PHP 5.6 runtime for now, and any future PHP 8 work must start as a dedicated replacement/containment track instead of piggybacking on account/roster/transfer modernization.
- `docs/ARCHITECTURE.md` now documents the forum/chat blocker cluster separately from the main modernization wave:
  - public forum pages are live on canonical prefixed routes but remain tied to forum-backed news/frontpage links and archive flows;
  - admin/news management still links directly into forum actions;
  - community chat is an embedded legacy `components/chat/index.php` iframe surface rather than an isolated service;
  - bundled `AJAXChat` still carries removed-runtime constructs such as `create_function()` and `preg_replace /e`, plus legacy socket/Flash-era baggage.
- Minimum compatibility contract fixed for the hold period:
  - `/classic|/tbc|/wotlk/index.php?n=forum` and nested forum routes stay reachable on canonical prefixed URLs;
  - frontpage/news links that resolve into forum archives or topics keep working while forum remains legacy-owned;
  - community chat either remains on the legacy iframe-backed surface or degrades with a truthful disabled message instead of a broken partial migration;
  - public failures must degrade without exposing raw PHP warnings or SQL/internal diagnostics.
- No new implementation backlog item was added in this cycle because the containment decision is to keep forum/chat off the current modernization critical path; any future replacement work must be intentionally re-prioritized as a separate track.

### `TASK-063` — `Isolate admin chartools modernization from the public website wave`

- Status: `[x]`
- Priority: `P3`
- Module: `DOCS`
- Allowed roles: `Documentation / Analyst`, `Backend Developer`, `Project Architect`
- Assignee: `GitHub Copilot (GPT-5.4)`
- Machine: `morgan.local`
- Lock scope: `docs/BACKLOG.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/PROJECT_STATUS.md`, `docs/SESSION_LOG.md`
- Touched paths: `docs/`
- Пов'язані context files: `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`
- Parallel-safe with: `SOURCE`
- Depends on: `TASK-052`

Мета:

- Вивести admin/chartools з main public modernization path і зафіксувати його як окремий low-priority/operator-only track.

Acceptance:

- Admin/chartools no longer sits implicitly inside the first public modernization wave.
- Its high `mysql_*` concentration is documented as operator/debt work, not as a prerequisite to modern account/transfer slices.
- Any future admin rewrite/isolation can proceed independently.

Subtasks:

- [x] Document admin/chartools as a separate operator-only modernization concern.
- [x] Define whether it should remain legacy, be hidden harder, or be replaced later.
- [x] Remove it from the critical path for public modern slices.
- [x] Add follow-up items only if a real admin modernization wave is desired.

Докази / верифікація:

- Explicit containment decision recorded in `docs/DECISIONS.md`: admin/chartools stays on the legacy multiroute PHP 5.6 runtime for now, and any future PHP 8 work must start as a dedicated operator/mutation replacement track instead of piggybacking on account/roster/transfer modernization.
- `docs/ARCHITECTURE.md` now documents the admin/chartools blocker cluster separately from the main modernization wave:
  - the public contract still hardens `/classic|/tbc|/wotlk/index.php?n=admin` as a non-public operator zone;
  - the admin panel fans out into direct account bans/deletes, realm config, forum/news management, backup/log tooling, vote/donate operations, and character-mutation tools;
  - admin `chartools` and `chartransfer` both reuse the same legacy include stack (`chartools/charconfig.php`, `add.php`, `functionstransfer.php`, `functionsrename.php`, `tabs.php`);
  - authenticated `account&sub=chartools` remains tied to the same mutation family through direct character updates and cannot be treated as a low-risk read-only account slice.
- Minimum compatibility contract fixed for the hold period:
  - `/classic|/tbc|/wotlk/index.php?n=admin` remains outside the public contract and should continue to fail closed rather than be partially reopened by modernization work;
  - authenticated account-side chartools may remain legacy-owned while they are truthful about what they mutate and do not imply a modern safety model that does not yet exist;
  - operator/admin failures must degrade without exposing raw SQL/internal diagnostics.
- No new implementation backlog item was added in this cycle because the containment decision is to keep admin/chartools off the current modernization critical path; any future replacement work must be intentionally re-prioritized as a separate track.

### `TASK-064` — `Isolate donate/payment flow from the first modernization wave`

- Status: `[x]`
- Priority: `P3`
- Module: `DOCS`
- Allowed roles: `Documentation / Analyst`, `Backend Developer`, `Project Architect`
- Assignee: `GitHub Copilot (GPT-5.4)`
- Machine: `morgan.local`
- Lock scope: `docs/BACKLOG.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/PROJECT_STATUS.md`, `docs/SESSION_LOG.md`
- Touched paths: `docs/`
- Пов'язані context files: `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`
- Parallel-safe with: `SOURCE`
- Depends on: `TASK-052`

Мета:

- Зафіксувати standalone `donate.php` payment/IPN flow як окремий isolate-or-replace track замість втягування його у першу modernization хвилю.

Acceptance:

- Donate/payment flow explicitly removed from the critical path for public/account modernization.
- Security/risk posture is documented separately from the first-wave app slices.
- Any future replacement or retirement plan can proceed independently.

Subtasks:

- [x] Document the current donate/IPN hold boundary and risk profile.
- [x] Decide whether the path should be retired, isolated harder, or replaced later.
- [x] Keep it out of the first-wave modernization acceptance path.
- [x] Add follow-up items only if donate/payment becomes an explicit product requirement again.

Докази / верифікація:

- Explicit containment decision recorded in `docs/DECISIONS.md`: donate/payment stays on the legacy multiroute PHP 5.6 runtime for now, and any future PHP 8 work must start as a dedicated payment replacement/retirement track instead of piggybacking on account/roster/transfer modernization.
- `docs/ARCHITECTURE.md` now documents the donate/payment blocker cluster separately from the main modernization wave:
  - the public contract already hardens standalone `/donate.php` and prefixed donate entrypoints as non-public/high-risk surfaces;
  - the legacy payment contour is split across a standalone PayPal IPN endpoint (`donate.php`), community donate templates/forms, admin donation template/resend tools, and in-game fulfillment helpers;
  - `donate.php` still uses direct `fsockopen('ssl://www.paypal.com', ...)`, raw `$_POST` handling, `mysql_*` writes, and debug email side effects;
  - community/admin donate flows still depend on legacy tables such as `paypal_payment_info`, `paypal_cart_info`, `paypal_subscription_info`, and `donations_template` plus item-mail fulfillment.
- Minimum compatibility contract fixed for the hold period:
  - standalone `/donate.php` remains outside the public contract and should continue to fail closed rather than be partially reopened by modernization work;
  - any still-needed legacy donation/payment behavior remains legacy-owned and truthful about payment completion versus in-game fulfillment;
  - payment/operator failures must degrade without exposing raw SQL/internal diagnostics.
- No new implementation backlog item was added in this cycle because the containment decision is to keep donate/payment off the current modernization critical path; any future replacement or retirement work must be intentionally re-prioritized as a separate track.

### `TASK-065` — `Зафіксувати українську мову для проміжних апдейтів агента`

- Status: `[+]`
- Priority: `P3`
- Module: `DOCS`
- Allowed roles: `Documentation / Analyst`, `Project Architect`
- Assignee: `GitHub Copilot (GPT-5.4)`
- Machine: `morgan.local`
- Lock scope: `workflow_config.md`, `AGENTS.md`, `docs/BACKLOG.md`, `docs/SESSION_LOG.md`
- Touched paths: `workflow_config.md`, `AGENTS.md`, `docs/BACKLOG.md`, `docs/SESSION_LOG.md`
- Пов'язані context files: `workflow_config.md`
- Parallel-safe with: `SOURCE`
- Depends on: none

Мета:

- Явно зафіксувати в канонічній workflow-документації, що всі проміжні роздуми, коментарі прогресу й status updates агента під час обробки будь-якого користувацького запиту мають бути українською мовою.

Acceptance:

- `workflow_config.md` містить явне правило про українську мову для проміжних апдейтів агента.
- `AGENTS.md` дублює це правило в канонічній стартовій інструкції для нового агента.
- Наступні continuation cycles не трактують це як лише `preferred language`, а як конкретну вимогу до intermediary updates.

Subtasks:

- [x] Додати explicit language rule в `workflow_config.md`.
- [x] Додати дзеркальне правило в `AGENTS.md`.
- [x] Зафіксувати зміну в `SESSION_LOG.md`.

Докази / верифікація:

- `workflow_config.md` і `AGENTS.md` тепер прямо вимагають українську мову для всіх проміжних агентських апдейтів/роздумів під час обробки запитів.

### `TASK-045` — `Define QA matrix and release gate for self-service transfer`

- Status: `[+]`
- Priority: `P0`
- Module: `DOCS`
- Allowed roles: `QA / Test Automation`, `Documentation / Analyst`, `Project Architect`
- Assignee: `GitHub Copilot (GPT-5.4)`
- Machine: `morgan.local`, `workspace`
- Lock scope: `docs/TESTING_AND_RELEASE.md`, `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, `docs/SESSION_LOG.md`
- Touched paths: `docs/TESTING_AND_RELEASE.md`, `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, `docs/SESSION_LOG.md`
- Пов'язані context files: `docs/TESTING_AND_RELEASE.md`, `docs/SESSION_LOG.md`
- Parallel-safe with: `SOURCE`
- Depends on: `TASK-044`

Мета:

- Зафіксувати release gate для self-service transfer, щоб фіча не вважалась готовою без повного user-path verification: login, eligibility, submit, queued execution, sequential chain, result visibility і duplicate-submit guards.

Acceptance:

- Є canonical QA matrix для `to_tbc` і `to_wotlk` сценаріїв.
- Є окремі negative tests для blocked characters, duplicate submit, partial success, stale lock recovery.
- Docs прямо забороняють claims про readiness без browser-level logged-in verification і runtime execution proof.

Subtasks:

- [x] Описати happy-path matrix для `Classic -> TBC`.
- [x] Описати happy-path matrix для chained `Classic -> TBC -> WotLK`.
- [x] Описати negative-path matrix для blocked/duplicate/fail/retry.
- [x] Зафіксувати required evidence set: screenshots, request logs, DB proofs, runtime summaries.

Докази / верифікація:

- `docs/TESTING_AND_RELEASE.md` тепер містить окремий canonical `TASK-045` section, який зводить self-service transfer release gate в один QA matrix: `to_tbc` happy path, chained `to_wotlk` happy path, negative-path contract for `eligibility_blocked` / `duplicate_request` / `partial_chain_failure` / `stale_lock_recovery` / operator flags, і explicit evidence-pack requirements.
- Gate прив'язано до вже verified artifacts попередніх transfer tasks, а не до декларативних claims: `run_live_auth_audit.sh`, `run-modern-transfer-control-plane-smoke.sh`, `/opt/cmangos-transfer/test-request-lock-guards.sh`, `/opt/cmangos-transfer/test-transfer-control-flags.sh`, targeted runner dry-run, і chained runner dry-run.
- Release rules тепер явно забороняють claim `release-ready`, якщо є тільки docs review, тільки local prototype smoke, тільки runner dry-runs, або відсутній хоча б один із mandatory proof classes: logged-in browser proof, create/reuse queue proof, duplicate guard proof, operator override proof.

### `TASK-066` — `Implement live website-wide shared account identity and session`

- Status: `[+]`
- Priority: `P0`
- Module: `SOURCE`
- Allowed roles: `Backend Developer`, `Frontend Developer`, `DevOps / Infrastructure`, `Project Architect`
- Assignee: `unassigned`
- Machine: `morgan.local`, `workspace`
- Lock scope: `localProjects/cmangos_projects/docker-website/`, `localProjects/cmangos_projects/mangos-website/`, `workspace:/opt/mangos-website`, `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, `docs/ARCHITECTURE.md`, `docs/TESTING_AND_RELEASE.md`, `docs/SESSION_LOG.md`
- Touched paths: `localProjects/cmangos_projects/docker-website/modern-prototype/`, `localProjects/cmangos_projects/docker-website/scripts/`, `localProjects/cmangos_projects/mangos-website/`, `workspace:/opt/mangos-website`, `docs/`
- Пов'язані context files: `docs/ARCHITECTURE.md`, `docs/TESTING_AND_RELEASE.md`, `docs/PROJECT_STATUS.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-056`, `TASK-058`, `TASK-059`, explicit shared-host approval for any live rollout

Мета:

- Довести website-wide shared account до реального live state, а не лишати його на рівні contract/prototype: один principal, одна domain-wide session, і коректний cross-patch account mapping across `/classic/`, `/tbc/`, `/wotlk`.

Acceptance:

- Public website no longer depends on transitional `identity_mode=legacy_account_id` for the canonical logged-in account experience.
- Існує verified website-identity mapping layer, яка зв'язує один website principal з відповідними patch-local auth rows без покладання на випадковий numeric account-id alignment між realm'ами.
- Після одного логіну user can move between `/classic/`, `/tbc/`, and `/wotlk` without losing authenticated website state.
- Logged-in account overview / roster / transfer control plane on the canonical public site resolve ownership via website-wide identity rather than patch-local cookie scope.
- Live evidence includes browser-level proof on the real public site, not only local prototype smoke.

Subtasks:

- [ ] Спроєктувати і зафіксувати canonical storage/mapping layer для `website identity -> linked patch accounts`.
- [ ] Реалізувати backfill/sync strategy для існуючих website/account rows без silent account merges.
- [ ] Прибрати transitional `legacy_account_id` dependency з modern account slices.
- [ ] Забезпечити domain-wide/root-scoped session behavior across `/classic/`, `/tbc/`, and `/wotlk`.
- [ ] Підготувати й прогнати live verification matrix: one login, cross-prefix navigation, roster ownership, transfer UI ownership, logout/re-login, negative ownership checks.

Поточна truth boundary перед стартом:

- `TASK-056..TASK-059` already proved the companion-session pattern only locally.
- `localProjects/cmangos_projects/docker-website/modern-prototype/public/index.php` still renders the account overview with `identity_mode=legacy_account_id` and explicitly states that roster discovery remains transitional until a verified website-identity mapping table exists.
- Тому shared account на сайті ще не можна вважати виконаним або live-verified.

### `TASK-067` — `Fix WotLK (AzerothCore) website: realm_settings + world/characters DB access`

- Status: `[+]`
- Priority: `P0`
- Module: `OPS`
- Allowed roles: `DevOps / Infrastructure`, `Project Architect`
- Assignee: `AI agent`
- Machine: `workspace`
- Lock scope: `workspace:/opt/mangos-website`, `workspace: azerothcore-db`, `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, `docs/SESSION_LOG.md`
- Touched paths: `workspace: azerothcore-db SQL`, `docs/`
- Пов'язані context files: `docs/ARCHITECTURE.md`
- Parallel-safe with: `DOCS`, `SOURCE`
- Depends on: `TASK-013`

Мета:

- WotLK website surface (`/wotlk/`) зараз підключена до `acore_auth`, але `website_realm_settings` таблиця порожня → website не може завантажити дані realm/world/characters. Потрібно заповнити таблицю і дати MySQL юзеру `mw_azerothcore_site` доступ до `acore_world` і `acore_characters`.

Acceptance:

- `website_realm_settings` має запис для realm 1 з коректними host/port/dbname для world і characters.
- MySQL юзер `mw_azerothcore_site` має `SELECT` на `acore_world` і `acore_characters`.
- WotLK website homepage не показує SQL Error і коректно відображає realm status, online count, і інші realm-dependent дані.
- Верифіковано через curl або browser.

Subtasks:

- [x] `INSERT INTO website_realm_settings` з правильними даними для AzerothCore.
- [x] `GRANT SELECT ON acore_world.* TO 'mw_azerothcore_site'@'%'`.
- [x] `GRANT SELECT ON acore_characters.* TO 'mw_azerothcore_site'@'%'`.
- [x] Верифікувати WotLK homepage через browser або curl.

### `TASK-068` — `Decommission cmangos-wotlk: AzerothCore стає єдиним WotLK runtime`

- Status: `[+]`
- Priority: `P0`
- Module: `INFRA`
- Allowed roles: `DevOps / Infrastructure`, `Project Architect`
- Assignee: `copilot-agent`
- Machine: `workspace`
- Lock scope: `workspace:/opt/cmangos-wotlk`, `workspace:/opt/docker-azerothcore`, `workspace:/opt/cmangos-transfer`, `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, `docs/ARCHITECTURE.md`, `docs/SESSION_LOG.md`
- Touched paths: `workspace runtime`, `docs/`
- Пов'язані context files: `docs/ARCHITECTURE.md`, `docs/TRANSFER_SYSTEM.md`
- Parallel-safe with: `none`
- Depends on: `TASK-067`, `TASK-069`
- Completed: `2026-03-20`

Мета:

- cmangos-wotlk зараз працює поряд з AzerothCore. Мета — повністю вимкнути cmangos-wotlk, зупинити його контейнери, і залишити AzerothCore як єдиний WotLK сервер. Фінальна топологія: Classic (cmangos) + TBC (cmangos) + WotLK (AzerothCore).
- Ця задача виконується ПІСЛЯ верифікації що transfers працюють через AzerothCore (TASK-069).

Acceptance:

- `cmangos-wotlk-server` і `cmangos-wotlk-db` контейнери зупинені.
- `cmangos-wotlk-update.timer` вимкнений або видалений.
- Daily-sync більше не синхронізує в cmangos-wotlk, а тільки в AzerothCore.
- Website `/wotlk/` працює через AzerothCore (вже зроблено, але має бути перевірено post-decommission).
- Docs оновлені: `ARCHITECTURE.md`, `PROJECT_STATUS.md`.

Subtasks:

- [x] Зупинити `cmangos-wotlk-server` і `cmangos-wotlk-db` контейнери.
- [x] Деактивувати `cmangos-wotlk-update.timer`.
- [x] Оновити `daily-sync.sh` / `lib.sh` щоб WotLK-фаза йшла через AzerothCore, а не cmangos-wotlk.
- [x] Перевірити що website, transfers, і daily-sync працюють без cmangos-wotlk.
- [x] Оновити docs.

Results:

- Контейнери `cmangos-wotlk-server` і `cmangos-wotlk-db` зупинені та видалені (`docker compose down`).
- `cmangos-wotlk-update.timer` деактивований (`sudo systemctl disable --now`).
- `cmangos-daily-sync.service` оновлений з `Environment=SKIP_WOTLK=true` для 3-step pipeline.
- Website post-decommission: WotLK/Classic/TBC — all HTTP 200.
- Фінальна топологія: Classic (cmangos) + TBC (cmangos) + WotLK (AzerothCore) — 3 сервери.
- DEC-045 зафіксовано.

### `TASK-069` — `Verify E2E transfer: Classic → TBC → AzerothCore (без cmangos-wotlk)`

- Status: `[+]`
- Priority: `P0`
- Module: `TRANSFER`
- Allowed roles: `QA / Test Automation`, `Project Architect`
- Assignee: `copilot-agent`
- Machine: `workspace`
- Lock scope: `workspace:/opt/cmangos-transfer`, `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, `docs/SESSION_LOG.md`
- Touched paths: `workspace runtime`, `docs/`, `localProjects/cmangos_projects/transfer/`
- Пов'язані context files: `docs/TRANSFER_SYSTEM.md`
- Parallel-safe with: `none`
- Depends on: `TASK-067`
- Completed: `2026-03-20`

Мета:

- Перевірити що повний ланцюжок переносу Classic → TBC → AzerothCore працює БЕЗ cmangos-wotlk як проміжного кроку. Зараз daily-sync йде Classic → TBC → WotLK (cmangos) → AzerothCore (4 кроки). Потрібно довести 3-кроковий ланцюжок: Classic → TBC → AzerothCore.

Acceptance:

- `daily-sync.sh` може працювати з 3-кроковим pipeline (Classic → TBC → AzerothCore).
- Samuel переноситься з Classic → TBC → AzerothCore з `SUCCESS` на кожному verify кроці.
- Немає залежності від cmangos-wotlk DB.

Subtasks:

- [x] Оновити `daily-sync.sh` / `lib.sh` для підтримки 3-крокового pipeline (Classic → TBC → AzerothCore).
- [x] Запустити daily-sync для `samuel:samuel`.
- [x] Перевірити verify на кожному кроці.
- [x] Зафіксувати результати.

Results:

- Створено `migrate_cmangos_tbc_to_azerothcore.sql` — нову міграцію TBC→AzerothCore (пряма, без WotLK intermediate).
- `daily-sync.sh` — додано `SKIP_WOTLK=true` env var, який активує 3-step pipeline.
- `lib.sh` — розширено blob-padding у `fix_char_after_transfer()` для azerothcore target.
- Pipeline виконано: `SKIP_WOTLK=true bash daily-sync.sh` — Phase A skip (already synced), Phase C/D skipped, Phase E SYNCED 1, Phase F ✅ SUCCESS.
- Samuel (guid=1801) верифікований на AzerothCore через login-bot (автоматизація Phase F).

### `TASK-070` — `vmangos-classic: розгортання і імпорт samuel_FULL_backup.sql`

- Status: `[+]`
- Priority: `P1`
- Module: `INFRA`
- Allowed roles: `DevOps / Infrastructure`, `Project Architect`
- Assignee: `copilot-agent`
- Machine: `workspace`, `morgan.local`
- Lock scope: `workspace runtime`, `localProjects/cmangos_projects/`, `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, `docs/ARCHITECTURE.md`, `docs/SESSION_LOG.md`
- Touched paths: `workspace runtime`, `localProjects/`, `docs/`
- Пов'язані context files: `docs/ARCHITECTURE.md`, `docs/TRANSFER_SYSTEM.md`
- Parallel-safe with: `none`
- Depends on: `TASK-068`

Мета:

- Розгорнути vmangos-classic Docker stack (Classic емулятор vmangos замість cmangos-classic).
- Імпортувати `samuel_FULL_backup.sql` (це бекап cmangos-classic формату, тому можуть бути проблеми сумісності schema cmangos → vmangos).
- Верифікувати що Classic сервер працює з імпортованими даними.

Acceptance:

- vmangos-classic Docker stack піднятий і сервер запускається без критичних помилок.
- `samuel_FULL_backup.sql` імпортовано (або адаптовано для vmangos schema).
- Samuel може залогінитись на vmangos-classic і побачити свого персонажа.

Subtasks:

- [x] Знайти або створити vmangos Docker stack для ARM64.
  - Використано `mserajnik/vmangos-deploy`: prebuilt ARM64 images `ghcr.io/mserajnik/vmangos-server:5875` + `ghcr.io/mserajnik/vmangos-database`.
  - Docker Compose створено: `localProjects/cmangos_projects/vmangos-classic/docker-compose.yml`.
  - Порти: 8089 (game), 3728 (auth), 3310 (db) — паралельно з cmangos-classic.
- [x] Зафіксувати schema відхилення, якщо є.
  - CMaNGOS → VMaNGOS mapping повністю задокументований.
  - `playerBytes`/`playerBytes2` → unpacked `skin`/`face`/`hair_style`/`hair_color`/`facial_hair`.
  - Багато camelCase → snake_case перейменувань.
  - Створено migration SQL: `localProjects/cmangos_projects/vmangos-classic/migrate_samuel_to_vmangos.sql`.
  - Deploy script: `localProjects/cmangos_projects/vmangos-classic/deploy.sh`.
  - 11 таблиць мігруються, 5 пропущені (aura, social, account_data, tutorial, stats).
- [x] Імпортувати `samuel_FULL_backup.sql` через staging DB + migration SQL.
  - Config files створені з vmangos-deploy examples (mangosd.conf, realmd.conf).
  - Docker symlinks не працюють через bind mount обмеження — виправлено на per-directory mounts.
  - VMaNGOS DBC path quirk: expects `{DataDir}/5875/dbc/` — виправлено mount.
  - Schema fixes: `player_flags` → `character_flags`, видалено `is_logout_resting`, `at_login_flags`.
  - VMaNGOS account auth: SRP6 (v, s fields) — пароль встановлений через mangosd console.
  - Всі 11 таблиць мігровано успішно: characters(1), item_instance(313), character_inventory(208), character_skills(18), character_spell(392), character_queststatus(904), character_action(61), character_reputation(54), character_homebind(1), character_pet(4), pet_spell(16).
- [x] Запустити vmangos-classic і верифікувати login.
  - vmangos-db: healthy, всі databases створені.
  - vmangos-mangosd: "World initialized. SERVER STARTUP TIME: 0 minutes 3 seconds".
  - vmangos-realmd: 'Added realm "Classic Realm"'.
  - Realmlist: address=64.181.205.211, port=8089.
  - Account SAMUEL: id=3, gmlevel=3, SRP6 v/s populated (64 chars each).
  - Character Samuel: guid=1801, Human Warlock Level 60, correct appearance data.
  - deploy.sh: fixed (removed sha_pass_hash, uses mangosd console for SRP6 account creation).

### `TASK-071` — `Замінити cmangos-classic на vmangos-classic`

- Status: `[+]`
- Priority: `P1`
- Module: `INFRA`
- Allowed roles: `DevOps / Infrastructure`, `Project Architect`
- Assignee: `AI agent`
- Machine: `workspace`
- Lock scope: `workspace:/opt/cmangos-classic`, `workspace runtime`, `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, `docs/ARCHITECTURE.md`, `docs/SESSION_LOG.md`
- Touched paths: `workspace runtime`, `docs/`
- Пов'язані context files: `docs/ARCHITECTURE.md`
- Parallel-safe with: `none`
- Depends on: `TASK-070`
- Completed: `2026-03-19`

Мета:

- Після верифікації vmangos-classic, вимкнути cmangos-classic і замінити його на vmangos-classic.
- Оновити website, daily-sync, systemd timers для нової топології.

Acceptance:

- `cmangos-server` і `cmangos-db` контейнери зупинені.
- vmangos-classic працює на портах Classic.
- Website `/classic/` працює через vmangos.
- Daily-sync оновлений для vmangos source.
- `cmangos-update.timer` деактивовано.

Subtasks:

- [+] Зупинити cmangos-classic контейнери.
- [+] Включити vmangos-classic на портах Classic (3724/8085/3306 on cmangos-net).
- [+] Оновити website підключення для `/classic/` (vmangos-db/realmd).
- [+] Оновити daily-sync для vmangos як source (lib.sh: 7 mappings updated).
- [+] `cmangos-update.timer` деактивовано.
- [+] Перевірити все працює (website HTTP 200, all containers healthy).
- [+] Оновити docs.

### `TASK-072` — `Verify фінальний ланцюжок: vmangos → cmangos-tbc → azerothcore`

- Status: `[+]`
- Priority: `P1`
- Module: `TRANSFER`
- Allowed roles: `QA / Test Automation`, `Project Architect`
- Assignee: `unassigned`
- Machine: `workspace`
- Lock scope: `workspace:/opt/cmangos-transfer`, `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, `docs/SESSION_LOG.md`
- Touched paths: `workspace runtime`, `docs/`
- Пов'язані context files: `docs/TRANSFER_SYSTEM.md`
- Parallel-safe with: `none`
- Depends on: `TASK-071`
- Completed: `2026-03-22`

Мета:

- Верифікувати фінальний production ланцюжок переносу: vmangos-classic → cmangos-tbc → azerothcore-wotlk. Це цільовий end-state: 3 сервери, 3 різні емулятори.

Acceptance:

- Daily-sync проходить `vmangos → cmangos-tbc → azerothcore` з `SUCCESS` на кожному verify кроці.
- Samuel переноситься повним ланцюжком без помилок.
- Login verify пройдений на всіх трьох серверах.
- Це є фінальна підтверджена топологія.

Subtasks:

- [+] Запустити повний daily-sync по фінальному ланцюжку.
- [+] Verify на кожному кроці.
- [+] Зафіксувати results як canonical proof фінальної топології.

Результат верифікації (`2026-03-22`):

- daily-sync: vmangos Classic → cmangos TBC (`SKIP` — played on target) → AzerothCore (`SYNCED`, login verify `SUCCESS`).
- Samuel guid=1801, Warlock lvl60 — перенесено та верифіковано на AzerothCore.
- `lib.sh` оновлено: DB user `mangos:mangos` для `vmangos-db` та `cmangos-tbc-db` (root passwords ненадійні при container re-init).
- `lib.sh` start_server() для azerothcore тепер використовує `docker start` замість `docker compose up` — запобігає скиданню паролів БД.
- Відоме MVP обмеження: `character_queststatus_rewarded` safe_insert warning — некритично.
- **Фінальна топологія підтверджена**: Classic (VMaNGOS) + TBC (cmangos) + WotLK (AzerothCore) — 3 сервери, 3 різних емулятори.

### `TASK-073` — `Cross-patch single account: один акаунт для всіх трьох доповнень`

- Status: `[+]`
- Priority: `P0`
- Module: `SOURCE`
- Allowed roles: `Backend Developer`, `DevOps / Infrastructure`, `Project Architect`
- Assignee: `unassigned`
- Machine: `morgan.local`, `workspace`
- Lock scope: `localProjects/cmangos_projects/docker-website/`, `localProjects/cmangos_projects/mangos-website/`, `workspace:/opt/mangos-website`
- Touched paths: `localProjects/cmangos_projects/docker-website/`, `localProjects/cmangos_projects/mangos-website/`, `workspace:/opt/mangos-website`, `docs/`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-066`

Мета:

- При створенні одного аккаунту на сайті він автоматично реєструється на всіх трьох серверах (Classic, TBC, WotLK/AzerothCore).
- При переключенні між `/classic/`, `/tbc/`, `/wotlk/` на сайті користувач НЕ розлогінюється — сесія зберігається domain-wide.
- Cross-patch identity має працювати з реальним mapping layer, а не на довірі до numeric id alignment.

Acceptance:

- Реєстрація нового акаунту створює auth-записи на всіх трьох серверах.
- Логін на одному патчі дає доступ до всіх інших без повторного логіну.
- Переключення між патчами (через навігаційну панель) не скидає авторизацію.
- Verified на live public сайті через browser-level тест.

Subtasks:

- [ ] Спроєктувати registration flow: сайт → multi-server account creation.
- [ ] Реалізувати domain-wide session (root-path cookie або shared-session layer).
- [ ] Забезпечити cross-patch session persistence при навігації між `/classic/`, `/tbc/`, `/wotlk/`.
- [ ] Тестувати на live сайті: реєстрація → логін → переключення → верифікація.

### `TASK-074` — `Fix WotLK website: realm IP + realm status + news`

- Status: `[+]`
- Priority: `P1`
- Module: `OPS`
- Allowed roles: `DevOps / Infrastructure`, `Project Architect`
- Assignee: `AI agent`
- Machine: `workspace`
- Lock scope: `workspace:azerothcore-db`
- Touched paths: `acore_auth.realmlist`, `acore_auth.f_topics`, `acore_auth.f_posts`, `acore_auth.f_forums`, `acore_auth.f_categories`

Мета:

- Виправити realm IP з 127.0.0.1 на реальний (64.181.205.211).
- Виправити realm status Offline через column-name mismatch (AzerothCore `flag` vs CMaNGOS `realmflags`) — додано generated column `realmflags`.
- Скопіювати news tables (f_topics, f_posts, f_forums, f_categories, f_attachs, f_markread) з Classic до AzerothCore.

Acceptance:

- [x] Realm IP на сайті показує 64.181.205.211.
- [x] Realm status показує Online.
- [x] Новини відображаються на WotLK сторінці (10 posts, як на Classic/TBC).

Subtasks:

- [x] UPDATE realmlist SET address = '64.181.205.211'.
- [x] ALTER TABLE realmlist ADD COLUMN realmflags (generated from flag).
- [x] mysqldump f_* tables → import into acore_auth.
- [x] GRANT права для mw_azerothcore_site на нові таблиці.

### `TASK-075` — `Адмін-панель для GM-акаунтів: керування серверами з сайту`

- Status: `[+]`
- Priority: `P1`
- Module: `SOURCE`
- Allowed roles: `Backend Developer`, `Frontend Developer`, `DevOps / Infrastructure`, `Project Architect`
- Assignee: `unassigned`
- Machine: `morgan.local`, `workspace`
- Lock scope: `localProjects/cmangos_projects/mangos-website/`, `localProjects/cmangos_projects/docker-website/`, `workspace:/opt/mangos-website`
- Touched paths: `localProjects/cmangos_projects/mangos-website/`, `localProjects/cmangos_projects/docker-website/`, `docs/`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-073`

Мета:

- Якщо залогінений акаунт має GM-рівень найвищого рівня, на сайті з'являється адмін-панель.
- Адмін-панель надає базові функції: graceful restart контейнерів, перегляд/редагування певних конфігів, моніторинг серверів.

Acceptance:

- GM-акаунт бачить адмін-панель з функціями управління.
- Звичайні акаунти не бачать адмін-секцію.
- Restart контейнерів (через docker API або socket) з graceful shutdown.
- Перегляд основних конфігурацій серверів.
- Базовий моніторинг (uptime, players, RAM/CPU).
- Аудит-лог дій адміна.

Subtasks:

- [ ] Спроєктувати архітектуру: як сайт-контейнер звертається до Docker API / host для restart.
- [ ] Реалізувати GM-level detection для website identity.
- [ ] Побудувати UI адмін-панелі: dashboard, restart, config viewer, logs.
- [ ] Забезпечити безпеку: RBAC, audit logging, rate limiting, CSRF protection.
- [ ] Тестувати: GM бачить панель, non-GM не бачить, restart працює gracefully.

### `TASK-076` — `Карта гравців онлайн (Player Map)`

- Status: `[ ]`
- Priority: `P2`
- Module: `SOURCE`
- Allowed roles: `Backend Developer`, `Frontend Developer`, `Project Architect`
- Assignee: `unassigned`
- Machine: `morgan.local`, `workspace`
- Lock scope: `localProjects/cmangos_projects/mangos-website/`, `workspace:/opt/mangos-website`
- Touched paths: `localProjects/cmangos_projects/mangos-website/`, `docs/`
- Parallel-safe with: `DOCS`, `OPS`
- Depends on: `none`

Мета:

- На сайті доступна інтерактивна карта, що показує онлайн гравців на ігровій карті кожного сервера.
- Дані беруться з characters DB (position_x, position_y, map) для online=1.

Acceptance:

- Карта показує реальне розташування гравців онлайн на ігровій карті.
- Підтримка всіх трьох серверів (Classic, TBC, WotLK).
- Автоматичне оновлення (polling або WebSocket).
- Працює на live сайті.

Subtasks:

- [ ] Вибрати JS map library та ігрові тайли.
- [ ] Backend endpoint для отримання координат гравців.
- [ ] Frontend інтерактивна карта з маркерами гравців.
- [ ] Підтримка переключення між серверами/картами.
- [ ] Деплой та тестування на live.

### `TASK-078` — `Fix Classic armory HTTP 500 після vmangos switch`

- Status: `[+]`
- Priority: `P1`
- Module: `SOURCE`
- Allowed roles: `Backend Developer`, `Project Architect`
- Assignee: `AI agent`
- Machine: `morgan.local`, `workspace`
- Lock scope: `localProjects/cmangos_projects/mangos-website/armory/configuration/mysql.php`, `localProjects/cmangos_projects/docker-website/`, `workspace:/opt/mangos-website`
- Touched paths: `localProjects/cmangos_projects/mangos-website/armory/configuration/mysql.php`, `localProjects/cmangos_projects/docker-website/scripts/configure-app.php`, `localProjects/cmangos_projects/docker-website/docker-compose.remote.multiroute.yml`, `workspace:/opt/mangos-website/`, `docs/`
- Пов'язані context files: `docs/ARCHITECTURE.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-071`
- Completed: `2026-03-22`

Мета:

- Після TASK-071 Classic armory повертає HTTP 500 через два факти:
  1. `armory_runtime_db_entry()` не перезаписує ім'я БД із runtime config — використовує жорстко закодовані `classicmangos`, `classiccharacters`, `classicrealmd`, яких немає у vmangos-db (замість них — `mangos`, `characters`, `realmd`).
  2. Armory БД `classicarmory` не існує у vmangos-db (35 таблиць з DBC/instance/item cache даними).
- Потрібно: (a) додати підтримку `db_name_map` в `armory_runtime_db_entry()`, (b) створити armory БД у vmangos-db, (c) перебілдити і задеплоїти website image.

Acceptance:

- Classic armory `/classic/armory/index.php` повертає HTTP 200. ✅
- Classic armory profile search працює (пошук персонажа). ✅
- Playwright audit на Classic armory не показує HTTP 500. ✅
- Зміна не ламає TBC/WotLK armory. ✅

Subtasks:

- [x] Діагностика Classic armory 500 (root cause знайдений).
- [x] Додати `db_name_map` підтримку в `armory_runtime_db_entry()`.
- [x] Додати `db_name_map` в `config-protected.php` генерацію (entrypoint/template).
- [x] Створити armory DB у vmangos-db (dump з TBC armory — `classicarmory`, 35 таблиць).
- [x] Перебілдити та задеплоїти website image (`semorgana/mangos-website:task078-armory-fix-20260322`).
- [x] Playwright audit Classic armory — HTTP 200, 0 armory-related issues.

### `TASK-079` — `Deploy.sh: додати website table init step`

- Status: `[ ]`
- Priority: `P2`
- Module: `OPS`
- Allowed roles: `DevOps / Infrastructure`, `Project Architect`
- Assignee: `unassigned`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/docker/vmangos-classic/deploy.sh`
- Touched paths: `localProjects/cmangos_projects/docker/vmangos-classic/deploy.sh`, `docs/`
- Пов'язані context files: `docs/COMMANDS_REFERENCE.md`
- Parallel-safe with: `SOURCE`
- Depends on: `TASK-078`

Мета:

- Додати до vmangos deploy.sh крок ініціалізації website таблиць (full_install.sql + public-site-compat.sql + realm_settings INSERT).
- Щоб при повторному деплої vmangos з нуля website працював без ручного втручання.

Acceptance:

- `deploy.sh` містить step для ініціалізації website таблиць у vmangos-db.
- Повторний деплой з нуля дає робочий website без SQL помилок.

Subtasks:

- [ ] Додати website init step до deploy.sh.
- [ ] Тест: destr + redeploy → website працює.

### `TASK-077` — `Міграція сайту на сучасний PHP (PHP 5.6 → PHP 8.x)`

- Status: `[+]`
- Priority: `P0`
- Module: `SOURCE`
- Allowed roles: `Backend Developer`, `Project Architect`
- Assignee: `unassigned`
- Machine: `morgan.local`, `workspace`
- Lock scope: `localProjects/cmangos_projects/mangos-website/`, `localProjects/cmangos_projects/docker-website/`, `workspace:/opt/mangos-website`
- Touched paths: `localProjects/cmangos_projects/mangos-website/`, `localProjects/cmangos_projects/docker-website/`, `docs/`
- Пов'язані context files: `localProjects/cmangos_projects/docker-website/modern-prototype/`
- Parallel-safe with: `DOCS`
- Depends on: `none`

Мета:

- Мігрувати весь сайт з PHP 5.6 на PHP 8.x (мінімум 8.2+).
- Усунути deprecated функції, mysql_* → mysqli/PDO, ereg → preg, etc.
- Existing modern-prototype в `docker-website/modern-prototype/` є стартовою точкою.
- Docker image замінити з `php:5.6-apache` на `php:8.3-apache` (або новіший).

Acceptance:

- Сайт працює на PHP 8.3+ без deprecated warnings.
- Усі основні функції (логін, реєстрація, форум, armory, transfer, roster, realm status, news) працюють.
- Зберігається зворотна сумісність з існуючою DB-структурою.
- Live deployment verified.

Subtasks:

- [ ] Аудит усього codebase на PHP 5.6-only конструкції.
- [ ] Замінити mysql_* extensions → PDO або mysqli.
- [ ] Замінити ereg → preg, інші deprecated calls.
- [ ] Оновити Docker image до php:8.3-apache.
- [ ] Прогнати повний функціональний тест кожного модуля.
- [ ] Деплой на live та верифікація.

### `TASK-083` — `Classic: відновити новини на головній сторінці`

- Status: `[+]`
- Priority: `P1`
- Module: `WEBSITE`
- Allowed roles: `Project Architect`
- Assignee: `AI agent`
- Machine: `workspace`
- Lock scope: `vmangos-db realmd`
- Touched paths: `realmd.f_topics, realmd.f_posts`
- Parallel-safe with: `n/a`
- Depends on: `TASK-070`

Мета:

- Відновити блок новин на Classic homepage — код сайту читає `f_topics`/`f_posts`, але ці таблиці були відсутні в VMaNGOS realmd після розгортання Classic stack.

Acceptance:

- [x] Таблиці `f_topics` та `f_posts` існують у VMaNGOS realmd і містять дані.
- [x] `curl` Classic homepage показує `news-expand` елементи.

Subtasks:

- [x] Діагностика: `f_topics`/`f_posts` відсутні у VMaNGOS realmd (є лише `forum_topics`/`forum_posts`).
- [x] Дамп `f_topics` + `f_posts` з TBC (`tbcrealmd`) та імпорт у Classic (`realmd`).
- [x] Верифікація: 10 новин видно на `https://world-of-warcraft.morgan-dev.com/classic/`.

### `TASK-084` — `Classic armory: виправити conf_client та сумісність колонок VMaNGOS`

- Status: `[+]`
- Priority: `P1`
- Module: `WEBSITE`
- Allowed roles: `Project Architect`
- Assignee: `AI agent`
- Machine: `workspace`
- Lock scope: `classicarmory.conf_client`, `vmangos-db characters`
- Touched paths: `classicarmory.conf_client`, `characters ALTER TABLE`
- Parallel-safe with: `TASK-086`
- Depends on: `TASK-070`

Мета:

- Classic armory показує «Character Samuel does not exist on realm Vanilla Realm» через неправильний `conf_client=1` (має бути `0` для Vanilla). При CLIENT=1 використовується TBC-запит з колонками `totalKills`/`totalHonorPoints`/`chosenTitle`, яких немає у VMaNGOS. Навіть при CLIENT=0, запит використовує `stored_honorable_kills`/`stored_honor_rating`, яких також немає (VMaNGOS має `honor_stored_hk`/`honor_rank_points`).

Acceptance:

- [x] `conf_client=0` у `classicarmory`.
- [x] Віртуальні колонки `stored_honorable_kills` (з `honor_stored_hk`) та `stored_honor_rating` (з `honor_rank_points`) додані до VMaNGOS `characters`.
- [x] Віртуальні колонки `item_template` (з `item_id`) та `item` (з `item_guid`) додані до `character_inventory`.
- [x] Віртуальна колонка `randomPropertyId` (з `random_property_id`) додана до `item_instance`.
- [x] `curl` Classic armory character page повертає профіль Samuel з items, Grand Marshal rank і 362 HK.

### `TASK-085` — `WotLK armory: виправити conf_client на 2`

- Status: `[+]`
- Priority: `P2`
- Module: `WEBSITE`
- Allowed roles: `Project Architect`
- Assignee: `AI agent`
- Machine: `workspace`
- Lock scope: `wotlkarmory.conf_client`
- Touched paths: `wotlkarmory.conf_client`
- Parallel-safe with: `TASK-084`
- Depends on: `TASK-081`

Мета:

- WotLK armory має `conf_client=1` (TBC), повинно бути `2` (WotLK). Це впливає на індекси stat полів у `defines.php`, через що всі статистики читаються з неправильних позицій.

Acceptance:

- [x] `conf_client=2` у `wotlkarmory`.
- [x] `curl` WotLK armory character page коректно визначає expansion-specific features (Achievements tab видимий).

### `TASK-086` — `Armory: виправити колір шрифту в полі пошуку`

- Status: `[+]`
- Priority: `P2`
- Module: `SOURCE`
- Allowed roles: `Project Architect`
- Assignee: `AI agent`
- Machine: `morgan.local`
- Lock scope: `armory/css/master.css`
- Touched paths: `armory/css/master.css`
- Parallel-safe with: `TASK-084`, `TASK-085`
- Depends on: `none`

Мета:

- В `.ipl input` (пошукове поле armory) не задано `color`, тому на темному фоні (`search-offstate.gif`) текст майже невидимий. Тільки `safari.css` має `color:black !important`.

Acceptance:

- [x] `color: #FFF` додано до `.ipl input` в `master.css`.
- [x] Текст чітко видно на всіх armory сторінках.

### `TASK-087` — `Перезбір та деплой Docker-образу з фіксами TASK-086`

- Status: `[+]`
- Priority: `P2`
- Module: `INFRA`
- Allowed roles: `Project Architect`
- Assignee: `AI agent`
- Machine: `workspace`, `morgan.local`
- Lock scope: `docker-website`, Docker Hub
- Touched paths: `docker-compose.yml`, Docker image tag
- Parallel-safe with: `n/a`
- Depends on: `TASK-086`

Мета:

- Зібрати новий Docker-образ з CSS-фіксом та задеплоїти на live.

Acceptance:

- [x] Новий image pushed to Docker Hub.
- [x] Контейнери перезапущені з новим image.
- [x] Верифікація через browser/curl.

### `TASK-080` — `Fix Playwright audit: HTML entity decoding + cookie expires + auth selector timing`

- Status: `[+]`
- Priority: `P1`
- Module: `SOURCE`
- Allowed roles: `Backend Developer`, `Project Architect`
- Assignee: `AI agent`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/docker-website/browser-audit/`
- Touched paths: `localProjects/cmangos_projects/docker-website/browser-audit/browser_audit.py`, `docs/`
- Пов'язані context files: `none`
- Parallel-safe with: `INFRA`, `OPS`
- Depends on: `none`

Мета:

- Виправити два баги в Playwright audit harness:
  1. `_html_to_text()` не декодує HTML entities (`&amp;` → `&`), через це "Rules & Agreement" assertion fail на register pages classic/tbc/wotlk.
  2. `_auth_cookies()` передає `None` як `expires` для session cookies → Playwright очікує число → crash `BrowserContext.add_cookies: cookies[0].expires: expected number, got object` для classic/tbc.

Acceptance:

- Playwright audit register pages classic/tbc/wotlk не показує "missing expected text: Rules & Agreement".
- Auth check classic/tbc не crash-ує на cookie expires.
- Зміни не зламали решту аудиту.

Subtasks:

- [x] Додати `html.unescape()` в `_html_to_text()`.
- [x] Фільтрувати `None` expires з cookie dict перед `context.add_cookies()`.
- [x] Додати `page.wait_for_load_state("domcontentloaded")` перед selector assertions в `_run_auth_check` та `_visit_page`.
- [x] Збільшити screenshot timeout з 5s до 15s для повільних мереж.
- [x] Playwright `release_gate_passed: true` верифікація.

### `TASK-081` — `Fix WotLK armory HTTP 500`

- Status: `[+]`
- Priority: `P1`
- Module: `SOURCE`
- Allowed roles: `Backend Developer`, `Project Architect`
- Assignee: `AI agent`
- Machine: `morgan.local`, `workspace`
- Lock scope: `localProjects/cmangos_projects/docker-website/docker-compose.remote.multiroute.yml`, `workspace:/opt/mangos-website`
- Touched paths: `localProjects/cmangos_projects/docker-website/docker-compose.remote.multiroute.yml`, `workspace:azerothcore-db`, `docs/`
- Пов'язані context files: `docs/ARCHITECTURE.md`
- Parallel-safe with: `DOCS`
- Depends on: `TASK-078`

Мета:

- WotLK armory (`/wotlk/armory/index.php`) повертає HTTP 500 тому що:
  1. WotLK контейнер не має `MW_ARMORY_DB_NAME_MAP` → армурі шукає `wotlkrealmd`, `wotlkcharacters`, `wotlkmangos`, `wotlkarmory` які не існують (AzerothCore має `acore_auth`, `acore_characters`, `acore_world`).
  2. БД `wotlkarmory` не існує.
  3. AzerothCore schema відрізняється від cMaNGOS — character profile queries використають cmangos-specific columns.
- Мінімальна ціль: armory index page загружається (HTTP 200). Profile search може мати обмеження через різницю схем.

Acceptance:

- `/wotlk/armory/index.php` повертає HTTP 200.
- Playwright audit WotLK armory не показує HTTP 500 на index page.
- Classic і TBC armory не зламані.

Subtasks:

- [x] Додати `MW_ARMORY_DB_NAME_MAP` для WotLK контейнера.
- [x] Створити `wotlkarmory` БД в azerothcore-db (dump з TBC armory, collation fix utf8mb3_uca1400_ai_ci → utf8mb3_general_ci).
- [x] Перебілдити та задеплоїти website image (`task080-081-fixes-20260322`).
- [x] Playwright verification — WotLK armory HTTP 200, класик і TBC не зламано.

### `TASK-082` — `Fix WotLK website auth (AzerothCore SRP6 compatibility)`

- Status: `[+]`
- Priority: `P1`
- Module: `SOURCE`
- Allowed roles: `Backend Developer`, `Project Architect`
- Assignee: `AI agent`
- Machine: `morgan.local`, `workspace`
- Lock scope: `workspace:azerothcore-db`, `localProjects/cmangos_projects/docker-website/`
- Touched paths: `localProjects/cmangos_projects/mangos-website/core/`, `localProjects/cmangos_projects/docker-website/`, `docs/`
- Пов'язані context files: `docs/ARCHITECTURE.md`
- Parallel-safe with: `DOCS`, `INFRA`
- Depends on: `none`

Мета:

- WotLK website логін не працює через розбіжність AzerothCore schema з cMaNGOS:
  1. `class.auth.php` запитує `SELECT s, v, gmlevel FROM account` — AzerothCore має `salt` (binary), `verifier` (binary), `gmlevel` в окремій таблиці `account_access`.
  2. `verifySRP6()` в `common.php` очікує hex-encoded salt/verifier, AzerothCore зберігає binary.
- Потрібна compatibility layer або SQL views для WotLK auth.

Acceptance:

- Логін на WotLK website (`/wotlk/`) працює з AzerothCore акаунтами.
- Playwright auth check WotLK показує "missing required auth cookie: mangosWeb" → resolved.
- Classic і TBC auth не зламані.

Subtasks:

- [x] Проаналізувати AzerothCore auth schema vs cMaNGOS.
- [x] Додати virtual columns `s`, `v` до `acore_auth.account` (`UPPER(HEX(REVERSE(salt/verifier)))` — byte-order fix для PHP SRP6).
- [x] Додати regular column `gmlevel` до `acore_auth.account` (default 0, populated from account_access).
- [x] GRANT INSERT/UPDATE/DELETE на `account_keys`, `website_account_keys`, `website_accounts` для `mw_azerothcore_site`.
- [x] Верифікувати логін WotLK через Playwright — `release_gate_passed: true`.
- [ ] Playwright verification.

## Завершене / Архів

### `TASK-HIST-001` — `Phases 0-10: multi-expansion Docker infrastructure`

- Status: `[+]`
- Priority: `P0`
- Module: `INFRA`
- Allowed roles: `Project Architect`
- Assignee: `historical`
- Machine: `workspace / legacy`
- Lock scope: `n/a`
- Touched paths: `legacy docker stacks, remote /opt/cmangos-*`
- Пов'язані context files: `docs/LEGACY_BACKLOG_ARCHIVE.md`, `docs/LEGACY_SESSION_LOG_ARCHIVE.md`
- Parallel-safe with: `n/a`
- Depends on: `none`

Мета:

- Побудувати Classic/TBC/WotLK Docker infrastructure на ARM64 host з map data, DB, timers і helper-командами.

Acceptance:

- Три expansion stacks documented як working.

Subtasks:

- [x] Classic stack.
- [x] TBC stack.
- [x] WotLK stack.

Докази / верифікація:

- Legacy `PROJECT_STATUS`, `ARCHITECTURE`, `SESSION_LOG`.

### `TASK-HIST-002` — `Phase 11: character transfer system`

- Status: `[+]`
- Priority: `P0`
- Module: `TRANSFER`
- Allowed roles: `Project Architect`
- Assignee: `historical`
- Machine: `workspace / legacy`
- Lock scope: `n/a`
- Touched paths: `legacy transfer scripts and SQL`
- Пов'язані context files: `docs/TRANSFER_SYSTEM.md`, `docs/LEGACY_BACKLOG_ARCHIVE.md`, `docs/LEGACY_SESSION_LOG_ARCHIVE.md`
- Parallel-safe with: `n/a`
- Depends on: `TASK-HIST-001`

Мета:

- Створити any-direction transfer scripts, SQL migrations, account sync і daily sync foundation.

Acceptance:

- `transfer-interactive.sh` і `daily-sync.sh` documented як working.

Subtasks:

- [x] Schema comparison.
- [x] Migration SQL.
- [x] Interactive and automated sync tooling.

Докази / верифікація:

- Legacy `TRANSFER_SYSTEM`, `SESSION_LOG`, `PROJECT_STATUS`.

### `TASK-HIST-003` — `Phase 12: WotLK crash root cause and workaround`

- Status: `[+]`
- Priority: `P0`
- Module: `TRANSFER`
- Allowed roles: `Project Architect`
- Assignee: `historical`
- Machine: `workspace / legacy`
- Lock scope: `n/a`
- Touched paths: `legacy transfer sanitization and migration SQL`
- Пов'язані context files: `docs/TRANSFER_SYSTEM.md`, `docs/DECISIONS.md`, `docs/LEGACY_BACKLOG_ARCHIVE.md`
- Parallel-safe with: `n/a`
- Depends on: `TASK-HIST-002`

Мета:

- Знайти й виправити `MANGOS_ASSERT(m_currMap)` crash при TBC→WotLK transfer.

Acceptance:

- Root cause explained, workaround integrated, full pipeline documented як `SUCCESS`.

Subtasks:

- [x] Бісект / code analysis.
- [x] Achievement-progress workaround.
- [x] Verify full pipeline.

Докази / верифікація:

- Legacy `TRANSFER_SYSTEM`, `PROJECT_STATUS`, `SESSION_LOG`.

### `TASK-088` — `Classic armory: виправити item tooltips (AllowableClass/AllowableRace та column mismatch)`

- Status: `[+]`
- Priority: `P0`
- Module: `WEBSITE`
- Allowed roles: `Project Architect`
- Assignee: `AI-agent`
- Machine: `morgan.local → workspace`
- Lock scope: `mangos-website/armory/configuration/tooltipmgr.php`, `mangos-website/armory/configuration/functions.php`, VMaNGOS `mangos.item_template`
- Touched paths: `armory/configuration/tooltipmgr.php`, `armory/configuration/functions.php`, VMaNGOS DB virtual columns
- Parallel-safe with: `none`
- Depends on: `TASK-084`

Мета:

- Виправити помилки "Error: Unknown AllowableClass" та "Unknown AllowableRace" в item tooltips Classic armory.
- Причина: VMaNGOS item_template використовує snake_case (`allowable_class`, `allowable_race`, `display_id`, `inventory_type`, etc.) а armory очікує cMaNGOS PascalCase (`AllowableClass`, `AllowableRace`, `displayid`, `InventoryType`, etc.).
- Також case-only різниця: VMaNGOS `quality`/`flags` vs armory `Quality`/`Flags`.

Acceptance:

- [x] Virtual columns (17 шт.) додані на `mangos.item_template`: AllowableClass, AllowableRace, ContainerSlots, InventoryType, ItemLevel, MaxDurability, RandomProperty, RequiredLevel, RequiredSkill, RequiredSkillRank, itemset, maxcount, requiredspell, displayid, BuyPrice, SellPrice, DisenchantID.
- [x] SELECT * queries в tooltipmgr.php додають SQL aliases для case-only diffs (`quality AS Quality`, `flags AS Flags`).
- [x] `cache_item()` в functions.php: `displayid` mapping через virtual column.
- [x] Docker image `semorgana/mangos-website:task088-item-tooltip-fix-20260322` зібрано і задеплоєно.
- [x] Item tooltips показують коректно — 0 error spans, 0 AllowableClass/Race помилок.
- [x] TBC та WotLK armory не зламані (0 errors, character data renders).

### `TASK-HIST-004` — `Phases 13-14: pipeline library and sequential daily sync`

- Status: `[+]`
- Priority: `P0`
- Module: `TRANSFER`
- Allowed roles: `Project Architect`
- Assignee: `historical`
- Machine: `workspace / legacy`
- Lock scope: `n/a`
- Touched paths: `legacy lib.sh, daily-sync pipeline`
- Пов'язані context files: `docs/TRANSFER_SYSTEM.md`, `docs/LEGACY_BACKLOG_ARCHIVE.md`, `docs/LEGACY_SESSION_LOG_ARCHIVE.md`
- Parallel-safe with: `n/a`
- Depends on: `TASK-HIST-003`

Мета:

- Формалізувати `lib.sh`, verify/wait helpers і послідовний daily-sync pipeline з per-character rollback.

Acceptance:

- Daily sync documented як `Classic→TBC verify→WotLK verify`.

Subtasks:

- [x] Pipeline infra.
- [x] Sequential daily-sync flow.
- [x] Manual verification documented.

Докази / верифікація:

- Legacy `PROJECT_STATUS`, `TRANSFER_SYSTEM`, `SESSION_LOG`.

### `TASK-089` — `Очистити SPP-новини та створити власну стартову новину`

- Status: `[+]`
- Priority: `P1`
- Module: `OPS`
- Allowed roles: `Project Architect`
- Depends on: `none`

Мета: Видалити всі поточні SPP-новини з forum_topics / forum_posts у realmd-базі кожного патч-сайту. Видалити хардкодовані SPP-новини з `armory/configuration/settings.php`. Створити одну стартову новину від нашого проєкту на кожному з трьох сайтів (Classic / TBC / WotLK).

Acceptance:
- [ ] SPP forum news topics видалено з DB.
- [ ] Armory `$news` масив у `settings.php` очищений від SPP-тексту.
- [ ] Одна стартова новина опублікована на кожному патч-сайті.

### `TASK-090` — `Створити адмін-інтерфейс або скрипт для публікації новин`

- Status: `[+]`
- Priority: `P1`
- Module: `SOURCE`
- Allowed roles: `Project Architect`, `Backend Developer`
- Depends on: `TASK-089`

Мета: Зробити зручний спосіб створювати новини — або через існуючу адмін-панель сайту (якщо вона працює), або через CLI-скрипт, який вставляє тему у forum_topics + forum_posts. Має підтримувати вибір сайту (classic / tbc / wotlk / all).

Acceptance:
- [ ] Є робочий спосіб додати новину для конкретного патчу або для всіх одразу.
- [ ] Документовано як ним користуватись.

### `TASK-091` — `Реалізувати per-patch новини (окрема DB для кожного сайту)`

- Status: `[+]`
- Priority: `P1`
- Module: `INFRA`
- Allowed roles: `Project Architect`, `DevOps / Infrastructure`
- Depends on: `TASK-089`

Мета: Зараз новини йдуть з однієї DB (realmd поточного patch-сайту). Кожен patch-контейнер (Classic/TBC/WotLK) вже має власну DB — перевірити, що кожен сайт показує новини зі своєї DB, а не з спільної.

Acceptance:
- [ ] Classic показує новини зі свого realmd.
- [ ] TBC показує новини зі свого realmd.
- [ ] WotLK показує новини зі свого realmd (або acore_auth).
- [ ] Загальна новина — три INSERT, по одному в кожну DB.

### `TASK-092` — `Автоматичні новини при оновленні ядра (vmangos/cmangos/azerothcore)`

- Status: `[ ]`
- Priority: `P2`
- Module: `OPS`
- Allowed roles: `Project Architect`, `DevOps / Infrastructure`
- Depends on: `TASK-090`, `TASK-091`

Мета: При натисканні кнопки "Update" в адмін-панелі (або при виконанні systemd timer), після pull нового образу/коду:
1. Зібрати git log нових комітів (порівняти HEAD до і після pull).
2. Автоматично створити новину в `news.json` з переліком змін.
3. Новина прив'язана до конкретного патча (classic/tbc/wotlk), тег `infrastructure`.

**Flow для кнопки Update в адмін-панелі:**
- Зберегти поточний commit hash / image digest до pull
- Виконати pull (git pull або docker pull)
- Зібрати `git log --oneline OLD_HASH..HEAD` (або docker image diff)
- Якщо є нові коміти → сформувати новину:
  ```json
  {
    "title": "Classic server updated",
    "preview": "Updated to latest VMaNGOS: fix pathfinding..., improve scripting...",
    "patch": "classic",
    "tag": "infrastructure"
  }
  ```
- Записати в `news.json` через API або прямий запис
- Якщо змін нема → новина не створюється

Acceptance:
- [ ] При Update через адмін-панель, якщо були нові коміти, автоматично створюється новина.
- [ ] Новина містить перелік змін (git log одним рядком per commit).
- [ ] Якщо змін нема — новина не створюється.
- [ ] Працює для всіх трьох серверів (Classic, TBC, WotLK).
- [ ] Новина з'являється на головній сторінці сайту одразу після update.

### `TASK-093` — `Покращити update timers: error handling, notifications, logging`

- Status: `[ ]`
- Priority: `P2`
- Module: `OPS`
- Allowed roles: `Project Architect`, `DevOps / Infrastructure`
- Depends on: `TASK-092`

Мета: Поточні update скрипти мінімалістичні. Додати: логування кожного оновлення, error handling при build failure, опціонально notification (webhook або log file) про результат.

Acceptance:
- [ ] Кожне оновлення логується з timestamp і результатом.
- [ ] Build failure не ламає поточний працюючий сервер.
- [ ] Лог доступний для перегляду.

### `TASK-094` — `Transfer pipeline: скинути класові заклинання при переході між патчами`

- Status: `[+]`
- Priority: `P0`
- Module: `TRANSFER`
- Allowed roles: `Project Architect`, `Backend Developer`
- Assignee: `unassigned`
- Machine: `workspace`
- Lock scope: `transfer/lib.sh`, `transfer/daily-sync.sh`
- Touched paths: `transfer/lib.sh`, `docs/`
- Parallel-safe with: `none`
- Depends on: `none`

Мета:

- При transfer між патчами (Classic→TBC, TBC→AzerothCore) класові заклинання несумісні:
  деякі spell ID не існують в цільовому патчі, деякі мають іншу механіку (наприклад "Curse of Shadow"
  з'являється на TBC як General spell замість Warlock). Це породжує артефакти в книзі заклинань.
- Рішення: **скинути всі класові заклинання** при transfer. Зберігати тільки: профі-скіли,
  мови, маунти, travel form, weapon skills. Сервер автоматично відновить класові спели при першому логіні
  через `at_login |= 2` (RESET_SPELLS bit).
- Зберегти profession spells: Mining, Herbalism, Skinning, Alchemy, Blacksmithing, Enchanting,
  Engineering, Leatherworking, Tailoring, Cooking, First Aid, Fishing.

Acceptance:

- [ ] `fix_char_after_transfer()` в lib.sh скидає класові заклинання (all spells крім профі/мов/маунтів).
- [ ] `at_login |= 2` (RESET_SPELLS) встановлюється для цільового персонажа.
- [ ] Після transfer на TBC: книга заклинань чиста від артефактів, класові спели з'являються при логіні.
- [ ] Після transfer на AzerothCore: те саме.
- [ ] Профі-скіли (Tailoring 300, Enchanting 300, etc.) зберігаються.

Subtasks:

- [ ] Визначити список profession/mount/language spell categories для whitelist.
- [ ] Додати в `fix_char_after_transfer()` логіку: DELETE FROM character_spell WHERE NOT IN (whitelist) + at_login |= 2.
- [ ] Тест: clean transfer Classic→TBC→AzerothCore, перевірити книгу заклинань в грі.
- [ ] Оновити docs.

### `TASK-095` — `Transfer pipeline: конвертувати titles та зберегти professions value`

- Status: `[+]`
- Priority: `P0`
- Module: `TRANSFER`
- Allowed roles: `Project Architect`, `Backend Developer`
- Assignee: `unassigned`
- Machine: `workspace`
- Lock scope: `transfer/lib.sh`, `transfer/migrate_classic_to_tbc.sql`, `transfer/migrate_cmangos_tbc_to_azerothcore.sql`
- Touched paths: `transfer/lib.sh`, `transfer/migrate_*.sql`, `docs/`
- Parallel-safe with: `none`
- Depends on: `none`

Мета:

- **Titles**: Classic зберігає PvP rank у `honor_highest_rank` (числове значення 1-18).
  При transfer в TBC/WotLK це значення має бути конвертоване в `knownTitles` bitvector.
  Grand Marshal (Alliance rank 14, internal value 18) = bit для title ID відповідно до expansion.
  Зараз `knownTitles` = `0 0 0 0 0 0` — титули втрачаються.
- **Profession skills**: При transfer на AzerothCore деякі profession skills скидаються до
  `value=1, max=225` (наприклад Tailoring 300→1/225, Enchanting 300→1/225).
  Це відбувається через AzerothCore `at_login` talent/spell reset або schema migration.
  Потрібно зберегти оригінальні значення.
- **Mapping таблиця**: Classic `honor_highest_rank` → TBC/WotLK title bit:
  - Alliance: Private(1)→bit 1, Corporal(2)→bit 2, ..., Grand Marshal(14)→bit 14
  - Horde: Scout(1)→bit 15, Grunt(2)→bit 16, ..., High Warlord(14)→bit 28

Acceptance:

- [ ] `migrate_classic_to_tbc.sql` конвертує `honor_highest_rank` → `knownTitles` bitvector з правильними bits для всіх рангів до rank включно.
- [ ] `migrate_cmangos_tbc_to_azerothcore.sql` зберігає `knownTitles` при transfer.
- [ ] `chosenTitle` встановлюється на найвищий доступний title ID.
- [ ] `character_skills` зберігає profession values (300/300) при transfer на AzerothCore.
- [ ] В грі: Grand Marshal title доступний для вибору на TBC та WotLK.
- [ ] В грі: Tailoring, Enchanting та інші профи показують правильні значення.

Subtasks:

- [ ] Дослідити title ID mapping між Classic (honor_highest_rank) → TBC (knownTitles bits) → WotLK (knownTitles bits). Можливо title IDs збігаються між TBC/WotLK.
- [ ] Написати SQL conversion: READ honor_highest_rank BEFORE DROP → SET bit у knownTitles.
- [ ] Додати conversion в migrate_classic_to_tbc.sql (перед DROP COLUMN honor_highest_rank).
- [ ] Перевірити що knownTitles коректно проходить через migrate_cmangos_tbc_to_azerothcore.sql.
- [ ] Дебагнути чому profession skills скидаються до 1/225 на AzerothCore: перевірити at_login flags, schema migration, character_skills import order.
- [ ] Тест: clean transfer, перевірити titles та professions в грі на TBC та WotLK.
- [ ] Оновити docs.

### `TASK-096` — `Firewall cleanup: прибрати зайві auth порти (UFW + Oracle Cloud)`

- Status: `[+]`
- Priority: `P1`
- Module: `OPS`
- Allowed roles: `DevOps / Infrastructure`, `Project Architect`
- Assignee: `unassigned`
- Machine: `workspace`
- Lock scope: `workspace UFW rules`, `Oracle Cloud NSG/Security List`
- Touched paths: `UFW rules`, `OCI security rules`, `docs/`
- Parallel-safe with: `TRANSFER`
- Depends on: `none`

Мета:

- Auth proxy тепер слухає на одному порті 3724 і роутить до всіх 3 серверів.
  Зайві зовнішні порти 3725 (TBC auth) та 3727 (WotLK auth) більше не потрібні.
- **UFW на workspace**: прибрати правила для портів 3725 та 3727.
- **Oracle Cloud Infrastructure**: через MCP (`oracle-cloud-mcp`) прибрати відповідні правила
  з Network Security Group або Security List для портів 3725 та 3727.
- Залишити: 3724 (unified auth proxy), 8085 (Classic world), 8086 (TBC world), 8088 (WotLK world).

Acceptance:

- [ ] UFW на workspace: порти 3725 і 3727 прибрані з allowed rules.
- [ ] Oracle Cloud: порти 3725 і 3727 прибрані з NSG/Security List ingress rules.
- [ ] Порт 3724 залишається відкритий і працює.
- [ ] Перевірка: `nmap -p 3724,3725,3727 64.181.205.211` → тільки 3724 open.
- [ ] Docs оновлені.

---

## Unified Website Roadmap (Phases 2–5)

Фундамент (Phase 1) завершено: `mw-auth-service` (JWT auth на `/auth/`), `wow-auth-proxy` (один порт 3724).
Нижче — декомпозиція переходу від 3 legacy сайтів до одного unified сайту.

### `TASK-097` — `Phase 2a: Next.js unified site — scaffold + dark theme + server status`

- Status: `[+]`
- Priority: `P0`
- Module: `SOURCE`
- Allowed roles: `Frontend Developer`, `Project Architect`
- Assignee: `unassigned`
- Machine: `morgan.local`
- Lock scope: `localProjects/cmangos_projects/mw-unified-site/`
- Touched paths: `mw-unified-site/`, `docs/`
- Parallel-safe with: `TRANSFER`, `OPS`
- Depends on: `none`

Мета:

- Створити Next.js (App Router) проєкт `mw-unified-site/`.
- Імплементувати dark theme layout (wow-hc.com inspired: dark background, warm fire/lava accents).
- Homepage показує 3 server status cards (Classic, TBC, WotLK) з реальними даними:
  realm name, online count, status (online/offline).
- Server status API endpoint (`/api/status`) — запитує realmlist таблиці з 3 auth DBs.
- Dockerfile для production build (standalone Next.js output).
- Placeholder artwork (Blizzard screenshots або dark gradients, cartoon art пізніше).

Acceptance:

- [ ] `npm run dev` показує homepage з 3 expansion cards.
- [ ] Кожна карта показує realm name, status, online count (або fallback).
- [ ] Dark theme з warm accent кольорами.
- [ ] Dockerfile збирається і працює на `localhost:3000`.
- [ ] Responsive design (mobile + desktop).

Subtasks:

- [ ] `npx create-next-app` + base config (TypeScript, Tailwind CSS, App Router).
- [ ] Root layout: dark theme, fantasy font for headings, Tailwind config з wow-palette.
- [ ] `/api/status` route: PDO-like connection to 3 realmd DBs → JSON response.
- [ ] `ServerCard` component: expansion name, cartoon banner area, status badge, online count.
- [ ] Homepage composition: hero section + 3 ServerCards.
- [ ] Dockerfile (multi-stage: build → standalone).
- [ ] Local test.

### `TASK-098` — `Phase 2b: Login/Register UI через auth service`

- Status: `[+]`
- Priority: `P0`
- Module: `SOURCE`
- Allowed roles: `Frontend Developer`, `Project Architect`
- Assignee: `unassigned`
- Machine: `morgan.local`
- Lock scope: `mw-unified-site/src/app/auth/`, `mw-unified-site/src/components/`
- Touched paths: `mw-unified-site/`, `docs/`
- Parallel-safe with: `TRANSFER`
- Depends on: `TASK-097`

Мета:

- Login/Register/Logout UI в unified site.
- Використовує `mw-auth-service` API (`/auth/login`, `/auth/logout`, `/auth/session`).
- JWT cookie `mw_auth` — root-scoped, працює для всього сайту.
- Navbar показує username + logout коли залогінений, або login/register кнопки.

Acceptance:

- [ ] Login форма: username + password → POST `/auth/login` → redirect до homepage.
- [ ] Register форма: username + password + confirm → POST `/auth/register` → auto-login.
- [ ] Logout: POST `/auth/logout` → clear cookie → redirect.
- [ ] Navbar відображає auth state (SSR через cookie check).
- [ ] Error handling: invalid credentials, username taken, password mismatch.

Subtasks:

- [ ] `/auth/register` endpoint в `mw-auth-service` (створення акаунта на всіх 3 серверах).
- [ ] Login page (`/login`).
- [ ] Register page (`/register`).
- [ ] Auth context/hook для client-side state.
- [ ] Navbar auth integration.

### `TASK-099` — `Phase 2c: Deploy unified site на workspace + Traefik routing`

- Status: `[+]`
- Priority: `P0`
- Module: `OPS`
- Allowed roles: `DevOps / Infrastructure`, `Project Architect`
- Assignee: `unassigned`
- Machine: `workspace`
- Lock scope: `workspace:/opt/mw-unified-site/`, Traefik config
- Touched paths: `docker-compose.remote.yml`, Traefik labels, `docs/`
- Parallel-safe with: `none`
- Depends on: `TASK-097`, `TASK-098`

Мета:

- Deploy `mw-unified-site` на workspace.
- Traefik routing: `/` → unified site, `/classic/` `/tbc/` `/wotlk/` → legacy (поки що).
- Unified site підключений до всіх 3 DB networks для server status API.
- `mw-auth-service` вже працює на `/auth/`.

Acceptance:

- [ ] `world-of-warcraft.morgan-dev.com/` показує unified homepage з 3 server cards.
- [ ] Login/Register працює через `/auth/`.
- [ ] `/classic/`, `/tbc/`, `/wotlk/` досі ведуть на legacy сайти.
- [ ] HTTPS через existing Traefik + Let's Encrypt.
- [ ] Container healthy, auto-restart.

### `TASK-100` — `Phase 3: Unified Armory з patch/realm selector (MVP)`

- Status: `[+]`
- Priority: `P1`
- Module: `SOURCE`
- Allowed roles: `Frontend Developer`, `Backend Developer`, `Project Architect`
- Assignee: `unassigned`
- Machine: `morgan.local`, `workspace`
- Lock scope: `mw-unified-site/src/app/armory/`, `mw-auth-service/` (armory API)
- Touched paths: `mw-unified-site/`, `mw-auth-service/`, `docs/`
- Parallel-safe with: `none`
- Depends on: `TASK-099`

Мета:

- Armory сторінка в unified site з вбудованим expansion/realm selector.
- Existing armory PHP код вже підтримує multi-realm (mysql.php realm-to-DB mapping).
- Стратегія: PHP API endpoints для armory data → Next.js frontend споживає JSON.
- Character search, character profile, item tooltips.

Acceptance:

- [ ] `/armory` сторінка з realm dropdown (Classic Realm, CMaNGOS TBC, AzerothCore).
- [ ] Character search по імені → результати з вибраного realm.
- [ ] Character profile: stats, equipment, talents.
- [ ] Працює для всіх 3 expansions через один UI.

Subtasks:

- [ ] PHP Armory API: `/api/armory/search?realm=X&name=Y` → JSON.
- [ ] PHP Armory API: `/api/armory/character?realm=X&guid=Y` → JSON.
- [ ] Next.js: Armory page з realm selector + search form.
- [ ] Next.js: Character profile page.
- [ ] Deploy API + frontend.

### `TASK-101` — `Phase 4a: Account Management в unified site`

- Status: `[+]`
- Priority: `P1`
- Module: `SOURCE`
- Allowed roles: `Frontend Developer`, `Project Architect`
- Assignee: `unassigned`
- Machine: `morgan.local`
- Lock scope: `mw-unified-site/src/app/account/`
- Touched paths: `mw-unified-site/`, `mw-auth-service/`, `docs/`
- Parallel-safe with: `none`
- Depends on: `TASK-099`

Мета:

- Account overview сторінка: username, linked accounts across patches, password change.
- Character roster: показує всіх персонажів на всіх 3 серверах з одного місця.
- Використовує `/auth/session` для identity, queries character DBs для roster.

Acceptance:

- [ ] `/account` сторінка (authenticated only).
- [ ] Account info: username, identity UUID, linked patch accounts.
- [ ] Character roster: ім'я, рівень, клас, expansion — для всіх 3 серверів.
- [ ] Password change form → `/auth/password/change`.

### `TASK-102` — `Phase 4b: Transfer Request UI в unified site`

- Status: `[+]`
- Priority: `P1`
- Module: `SOURCE`
- Allowed roles: `Frontend Developer`, `Backend Developer`, `Project Architect`
- Assignee: `unassigned`
- Machine: `morgan.local`, `workspace`
- Lock scope: `mw-unified-site/src/app/transfer/`
- Touched paths: `mw-unified-site/`, `docs/`
- Parallel-safe with: `none`
- Depends on: `TASK-101`

Мета:

- Self-service character transfer UI: вибрати персонажа → вибрати напрямок
  (Classic→TBC, TBC→WotLK) → запустити transfer → показати progress/result.
- Інтеграція з existing transfer pipeline (`daily-sync.sh`).
- Transfer history з timestamps і статусами.

Acceptance:

- [ ] `/transfer` сторінка (authenticated only).
- [ ] Вибір персонажа з roster → вибір цільового expansion → кнопка "Transfer".
- [ ] Transfer progress indicator.
- [ ] Transfer history: дата, персонаж, напрямок, статус.
- [ ] Eligibility checks: персонаж не locked, не в процесі іншого transfer.

### `TASK-103` — `Phase 2d: News section на unified homepage`

- Status: `[+]`
- Priority: `P1`
- Module: `SOURCE`
- Allowed roles: `Frontend Developer`, `Project Architect`
- Assignee: `unassigned`
- Machine: `morgan.local`
- Lock scope: `mw-unified-site/src/app/`, `mw-unified-site/src/components/`
- Touched paths: `mw-unified-site/`, `docs/`
- Parallel-safe with: `TASK-100`
- Depends on: `TASK-097`

Мета:

- News feed на homepage — останні новини з усіх патчів.
- Читає з `f_topics`/`f_posts` таблиць (existing legacy format) або нової news таблиці.
- Кожна новина має patch badge (Classic/TBC/WotLK).

Acceptance:

- [ ] Homepage показує 5-10 останніх новин.
- [ ] Кожна новина: title, date, patch badge, short text.
- [ ] Click → full news page.

### `TASK-104` — `Phase 2e: How To Play / Connection Guide`

- Status: `[+]`
- Priority: `P1`
- Module: `SOURCE`
- Allowed roles: `Frontend Developer`, `Project Architect`
- Assignee: `unassigned`
- Machine: `morgan.local`
- Lock scope: `mw-unified-site/src/app/guide/`
- Touched paths: `mw-unified-site/`, `docs/`
- Parallel-safe with: `TASK-100`, `TASK-103`
- Depends on: `TASK-097`

Мета:

- Сторінка "How To Play": інструкції з підключення для кожного патча.
- Тепер один realmlist (`set realmlist 64.181.205.211`) для всіх патчів.
- Посилання на клієнти, налаштування realmlist, troubleshooting.

Acceptance:

- [ ] `/guide` сторінка з інструкціями для Classic, TBC, WotLK.
- [ ] Один realmlist для всіх.
- [ ] Client download links (або інструкції де взяти).

### `TASK-105` — `Phase 5: Decommission legacy website containers`

- Status: `[+]`
- Priority: `P2`
- Module: `OPS`
- Allowed roles: `DevOps / Infrastructure`, `Project Architect`
- Assignee: `unassigned`
- Machine: `workspace`
- Lock scope: `workspace:/opt/mangos-website/`, Traefik config
- Touched paths: `docker-compose files`, Traefik labels, `docs/`
- Parallel-safe with: `none`
- Depends on: `TASK-100`, `TASK-101`, `TASK-102`, `TASK-103`, `TASK-104`

Мета:

- Всі функції legacy сайтів перенесені в unified site.
- Видалити `mangos-website-classic`, `mangos-website-tbc`, `mangos-website-wotlk` контейнери.
- Прибрати `/classic/`, `/tbc/`, `/wotlk/` Traefik routes.
- Unified site обслуговує весь трафік.

Acceptance:

- [ ] Legacy containers зупинені та видалені.
- [ ] Traefik routes для `/classic/`, `/tbc/`, `/wotlk/` прибрані.
- [ ] Весь функціонал доступний через unified site.
- [ ] Redirect `/classic/`, `/tbc/`, `/wotlk/` → відповідні секції unified site.
- [ ] Docs оновлені.

### `TASK-106` — `Artwork: cartoon WoW illustrations для unified site`

- Status: `[ ]`
- Priority: `P2`
- Module: `SOURCE`
- Allowed roles: `Frontend Developer`, `Project Architect`
- Assignee: `unassigned`
- Machine: `morgan.local`
- Lock scope: `mw-unified-site/public/assets/`
- Touched paths: `mw-unified-site/public/assets/`, `docs/`
- Parallel-safe with: `TASK-100`, `TASK-101`
- Depends on: `TASK-097`

Мета:

- Створити або підібрати cartoon WoW artwork у стилі wow-hc.com:
  Hearthstone-подібні ілюстрації, темний фон, тепле вогняне підсвічування.
- Hero banners для кожного expansion (Classic: Ragnaros/MC, TBC: Dark Portal, WotLK: Arthas).
- Server card artwork для homepage.
- Reference art збережено в `additionalContextFiles/`.

Acceptance:

- [ ] Мінімум 3 hero images (по одному на expansion).
- [ ] Server card background images.
- [ ] Consistent visual style across all assets.
- [ ] Оптимізовані для web (WebP, responsive sizes).

### `TASK-100` — update status

(TASK-100 `[+]` — MVP Armory з cross-patch search і character profile deployed 2026-03-25)

---

## Rich Armory Roadmap (TASK-107..TASK-113)

Поступове розширення unified armory від MVP до повнофункціональної інтерактивної armory.

### `TASK-107` — `Armory: Item іконки та базові tooltips`

- Status: `[ ]`
- Priority: `P2`
- Module: `SOURCE`
- Allowed roles: `Frontend Developer`, `Backend Developer`, `Project Architect`
- Assignee: `unassigned`
- Machine: `morgan.local`, `workspace`
- Lock scope: `mw-unified-site/src/app/armory/`, `mw-unified-site/src/app/api/armory/`
- Touched paths: `mw-unified-site/`
- Parallel-safe with: `TASK-101`, `TASK-106`
- Depends on: `TASK-100`

Мета:

- Замінити "Item #16808" на іконку предмета + назву.
- API endpoint `/api/armory/item/[patch]/[entry]` → item_template query (name, quality, icon, stats).
- Item quality кольори (Poor/Common/Uncommon/Rare/Epic/Legendary).
- Tooltip при hover з базовою інформацією (name, slot, armor/dps, stats).
- Item іконки з CDN (classicdb.ch / wowhead CDN) або локальний fallback.

Acceptance:

- [ ] Equipment секція показує іконки + назви предметів з quality кольорами.
- [ ] Hover tooltip з базовими stats (armor, stamina, intellect, etc).
- [ ] Працює для всіх 3 expansions.

### `TASK-108` — `Armory: Tab навігація (Summary / Equipment / Talents / Reputation / Skills)`

- Status: `[ ]`
- Priority: `P2`
- Module: `SOURCE`
- Allowed roles: `Frontend Developer`, `Project Architect`
- Assignee: `unassigned`
- Machine: `morgan.local`, `workspace`
- Lock scope: `mw-unified-site/src/app/armory/character/`
- Touched paths: `mw-unified-site/`
- Parallel-safe with: `TASK-107`
- Depends on: `TASK-100`

Мета:

- Розділити character profile на вкладки: Summary, Equipment, Talents, Reputation, Skills, PvP.
- Summary: портрет (race/class/gender), базові stats, guild info.
- Equipment: повний список з іконками (після TASK-107).
- Reputation: query `character_reputation` → faction bars.
- Skills: weapon skills, professions, languages.
- PvP: kills, deaths, rank progress, honor.

Acceptance:

- [ ] Tab UI з плавним переключенням.
- [ ] Reputation вкладка з faction progress bars.
- [ ] Skills вкладка з weapon/prof/language groups.
- [ ] PvP stats вкладка.

### `TASK-109` — `Armory: Character portrait (race/class/gender іконки)`

- Status: `[ ]`
- Priority: `P3`
- Module: `SOURCE`
- Allowed roles: `Frontend Developer`, `Project Architect`
- Assignee: `unassigned`
- Machine: `morgan.local`, `workspace`
- Lock scope: `mw-unified-site/src/components/`, `mw-unified-site/public/`
- Touched paths: `mw-unified-site/`
- Parallel-safe with: `TASK-107`, `TASK-108`
- Depends on: `TASK-100`

Мета:

- Портрет персонажа на основі race + class + gender.
- Race/class іконки (Human male warrior, Undead female warlock, etc).
- Assets з WoW client або fan-made portraits.
- Faction emblem (Alliance/Horde) на профілі.

Acceptance:

- [ ] Character portrait на сторінці профілю.
- [ ] Race + class іконки в результатах пошуку.
- [ ] Faction emblem.

### `TASK-110` — `Armory: Talent tree візуалізація`

- Status: `[x]`
- Priority: `P3`
- Module: `SOURCE`
- Allowed roles: `Frontend Developer`, `Backend Developer`, `Project Architect`
- Assignee: `unassigned`
- Machine: `morgan.local`, `workspace`
- Lock scope: `mw-unified-site/src/app/armory/`
- Touched paths: `mw-unified-site/`
- Parallel-safe with: `TASK-107`, `TASK-109`
- Depends on: `TASK-108`
- Completed: `2026-03-28` — DBC tables found in classicarmory/tbcarmory/wotlkarmory DBs. Classic/TBC use character_spell fallback. Talent tree tab added to CharTabs with icon grid, rank badges, hover tooltips, background images.

Мета:

- Talent tree як на WoWHead — 3 spec дерева з іконками та tooltips.
- Парсинг talent data з `character_spell` / `character_talent` таблиць.
- Talent tree layout та spell icons з DBC data або CDN.
- Розрахунок витрачених points per tree.

Acceptance:

- [ ] 3 talent tree columns з правильними іконками.
- [ ] Витрачені points відображаються (e.g. "30/21/0").
- [ ] Tooltip на кожний talent з описом.
- [ ] Працює для Classic (31 point trees), TBC (41 point), WotLK (51 point + glyphs).

### `TASK-111` — `Armory: Розширені item tooltips (enchants, gems, random properties)`

- Status: `[ ]`
- Priority: `P3`
- Module: `SOURCE`
- Allowed roles: `Frontend Developer`, `Backend Developer`
- Assignee: `unassigned`
- Machine: `morgan.local`, `workspace`
- Lock scope: `mw-unified-site/src/app/api/armory/`
- Touched paths: `mw-unified-site/`
- Parallel-safe with: `TASK-110`
- Depends on: `TASK-107`

Мета:

- Повні WoWHead-style tooltips: enchants зеленим текстом, gem sockets з іконками, set bonuses.
- Парсинг `item_instance.enchantments` serialized field.
- Random property suffix ("of the Bear", "of Intellect").
- Item set tracking (X/Y pieces equipped).

Acceptance:

- [ ] Enchants відображаються зеленим текстом під stats.
- [ ] Gem sockets (TBC/WotLK) з кольоровими слотами та вставленими gems.
- [ ] Set bonuses з progress (e.g. "Nemesis Raiment (8/8)").

### `TASK-112` — `Armory: 3D Model Viewer (WoW Model Viewer integration)`

- Status: `[!]`
- Priority: `P4`
- **Blocker**: `wow-model-viewer` npm пакет (v1.5.3) не сумісний з Next.js 16 App Router standalone mode. Компонент не монтується, jQuery/ZamModelViewer скрипти не завантажуються. Варіанти розблокування: (1) iframe з vanilla HTML сторінкою для 3D viewer, (2) WoWHead embed без npm wrapper, (3) альтернативна WebGL бібліотека. API endpoint `modelItems` (displayId per slot) вже реалізований і працює.
- Module: `SOURCE`
- Allowed roles: `Frontend Developer`, `Project Architect`
- Assignee: `unassigned`
- Machine: `morgan.local`, `workspace`
- Lock scope: `mw-unified-site/src/components/`
- Touched paths: `mw-unified-site/`
- Parallel-safe with: `TASK-110`, `TASK-111`
- Depends on: `TASK-107`

Мета:

- Інтеграція WoW Model Viewer (JS бібліотека `wowmodelviewer` / `wow-model-viewer-vite` або аналог).
- 3D модель персонажа одягнутого в equipped items — як на wowhead.com.
- Обертання, zoom, анімації (idle, cast, attack).
- Підтримка Classic, TBC, WotLK моделей.
- WoW client data files (M2, BLP) → WebGL rendering.

Acceptance:

- [ ] 3D модель персонажа на сторінці профілю.
- [ ] Equipped items відображаються на моделі.
- [ ] Обертання мишкою, zoom scroll.
- [ ] Fallback на static portrait якщо 3D не підтримується.

### `TASK-113` — `Armory: Guild page з member roster`

- Status: `[ ]`
- Priority: `P3`
- Module: `SOURCE`
- Allowed roles: `Frontend Developer`, `Backend Developer`
- Assignee: `unassigned`
- Machine: `morgan.local`, `workspace`
- Lock scope: `mw-unified-site/src/app/armory/`
- Touched paths: `mw-unified-site/`
- Parallel-safe with: `TASK-107`, `TASK-108`
- Depends on: `TASK-100`

Мета:

- Guild profile page: `/armory/guild/[patch]/[guildId]`.
- Member roster з class кольорами, рівнями, рангами.
- Guild info: name, leader, creation date, MOTD, emblem.
- Лінки на character profiles для кожного member.

Acceptance:

- [ ] Guild search в armory.
- [ ] Guild page з member list та guild info.
- [ ] Members sortable по level/class/rank.
- [ ] Guild leader виділений.

### `TASK-114` — `Armory: Talent tree — відображення значень для поточного ранку`

- Status: `[+]`
- Priority: `P1`
- Module: `SOURCE`
- Allowed roles: `Backend Developer`, `Frontend Developer`
- Assignee: `unassigned`
- Machine: `morgan.local`, `workspace`
- Lock scope: `mw-unified-site/src/app/api/armory/talents/`
- Touched paths: `mw-unified-site/src/`
- Parallel-safe with: `TASK-109`, `TASK-111`
- Depends on: `TASK-110`

Мета:

- Зараз tooltip таланту показує опис rank1 спела незалежно від фактично вивченого ранку.
- Потрібно: якщо персонаж вивчив N рангів — показувати опис з rank N spell (не rank1).
- Приклад: Improved Corruption rank 1 = "-0.4 sec", rank 5 = "-2 sec" (миттєвий каст).
- Для невивчених талантів (currentRank=0) показувати rank1 як зараз.

Acceptance:

- [ ] API повертає description з фактичного ранку таланту (rank1 → rank5 залежно від currentRank).
- [ ] Формат-коди ($s1, $d, крос-посилання) резолвляться для правильного ранку.
- [ ] Невивчені таланти (0 поінтів) показують rank1 опис.
- [ ] Працює для Classic, TBC, WotLK.

### `TASK-115` — `Armory: TBC character talents показують неправильні points`

- Status: `[+]`
- Priority: `P1`
- Module: `SOURCE`
- Allowed roles: `Backend Developer`
- Assignee: `unassigned`
- Machine: `morgan.local`, `workspace`
- Lock scope: `mw-unified-site/src/app/api/armory/talents/`
- Touched paths: `mw-unified-site/src/`
- Parallel-safe with: `TASK-114`
- Depends on: `TASK-110`

Мета:

- TBC персонаж (який щойно перенісся з Classic) показує вивчені таланти, хоча після трансферу гілка скидається.
- Ймовірна причина: character_spell містить всі відомі спели (не тільки таланти), і матч через character_spell може давати false positives.
- Потрібно дослідити, як CMaNGOS TBC зберігає talent points, і виправити query.

Acceptance:

- [ ] Досліджено як CMaNGOS TBC зберігає таланти (character_spell vs інші таблиці).
- [ ] Перенесений персонаж зі скинутою гілкою показує 0 талантів.
- [ ] Персонаж з реально вивченими талантами показує правильні points.

### `TASK-116` — `Guide: Game Clients — додати прямі посилання на клієнти + правильний реалмліст`

- Status: `[+]`
- Priority: `P2`
- Module: `SOURCE`
- Allowed roles: `Frontend Developer`
- Assignee: `unassigned`
- Machine: `morgan.local`
- Lock scope: `mw-unified-site/src/`
- Touched paths: `mw-unified-site/src/`
- Parallel-safe with: `TASK-114`, `TASK-115`
- Depends on: `TASK-104`

Мета:

- На сторінці Guide → Game Clients замість загальних порад пошуку клієнтів — додати прямі посилання:
  - Classic 1.12.1: `https://www.dkpminus.com/blog/vanilla-wow-download-1-12-1-client/`
  - TBC 2.4.3: `https://www.dkpminus.com/blog/wow-2-4-3-download/`
  - WotLK 3.3.5a: `https://www.dkpminus.com/blog/wow-wotlk-3-3-5a-download-wrath-of-the-lich-king-client/`
- Реалмліст: замінити IP-адресу на доменне ім'я `wow.morgan-dev.com`.

Acceptance:

- [ ] Кожен клієнт має пряме посилання на скачування.
- [ ] Реалмліст показує домен `wow.morgan-dev.com` замість IP.
- [ ] Посилання відкриваються в новій вкладці.

### `TASK-117` — `Unified Registration: єдина реєстрація для сайту + всіх серверів`

- Status: `[+]`
- Priority: `P1`
- Module: `SOURCE`, `AUTH`
- Allowed roles: `Backend Developer`, `Frontend Developer`
- Assignee: `unassigned`
- Machine: `morgan.local`, `workspace`
- Lock scope: `mw-unified-site/src/`, `mw-auth-service/`, `workspace:/opt/`
- Touched paths: `mw-unified-site/`, `mw-auth-service/`
- Parallel-safe with: `TASK-114`
- Depends on: `TASK-098`

Мета:

- На сайті немає можливості зареєструватись. Потрібна єдина реєстрація, яка створює акаунт одночасно для:
  - Сайт (auth service)
  - Classic realm (VMaNGOS realmd)
  - TBC realm (CMaNGOS TBC realmd)
  - WotLK realm (AzerothCore auth)
- Один username + пароль → 4 акаунти.
- UI: форма реєстрації на сайті з username/password/email.

Acceptance:

- [ ] Форма реєстрації на сайті.
- [ ] При реєстрації створюється акаунт у auth service + всіх трьох realmd.
- [ ] Логін на сайті працює з тим самим username/password.
- [ ] Помилки (дублікат username, etc.) коректно відображаються.
- [ ] Зміна пароля на сайті змінює пароль у всіх realmd.

### `TASK-118` — `Armory: Case-insensitive пошук для WotLK`

- Status: `[+]`
- Priority: `P2`
- Module: `SOURCE`
- Allowed roles: `Backend Developer`
- Assignee: `unassigned`
- Machine: `morgan.local`, `workspace`
- Lock scope: `mw-unified-site/src/app/api/armory/`
- Touched paths: `mw-unified-site/src/`
- Parallel-safe with: `TASK-114`, `TASK-115`
- Depends on: `TASK-100`

Мета:

- Пошук "Samuel" знаходить персонажів у всіх трьох серверах, але "samuel" (з маленької) не знаходить WotLK персонажа.
- Причина: AzerothCore (MySQL 8) має case-sensitive collation для таблиці characters, на відміну від VMaNGOS/CMaNGOS (MariaDB, case-insensitive).
- Потрібно: пошук має бути case-insensitive для всіх серверів.

Acceptance:

- [ ] Пошук "samuel" знаходить персонажів у всіх серверах (Classic, TBC, WotLK).
- [ ] Пошук "Samuel", "SAMUEL", "sAmUeL" — однаковий результат.
- [ ] Виправлення не впливає на продуктивність (використовувати LOWER() або COLLATE).

### `TASK-119` — `Account: відображення email + зміна email з подвійним підтвердженням`

- Status: `[ ]`
- Priority: `P2`
- Module: `SOURCE`
- Allowed roles: `Backend Developer`, `Frontend Developer`
- Assignee: `unassigned`
- Machine: `morgan.local`, `workspace`
- Lock scope: `mw-unified-site/src/`
- Touched paths: `mw-unified-site/src/`
- Parallel-safe with: `TASK-120`
- Depends on: `TASK-117`

Мета:

- В особистому кабінеті (/account) показувати поточний email користувача.
- Зміна email вимагає підтвердження на ОБОХ адресах: старому і новому email.
- Flow: користувач вводить новий email → лист на старий email з підтвердженням → лист на новий email з підтвердженням → email змінюється на всіх серверах (Classic, TBC, WotLK).

Acceptance:

- [ ] /account показує поточний email (замаскований: s***@icloud.com).
- [ ] Форма зміни email з полем для нового email.
- [ ] Підтвердження надсилається на старий email.
- [ ] Після підтвердження на старому — надсилається на новий.
- [ ] Після обох підтверджень — email оновлюється на всіх 3 серверах.

### `TASK-120` — `Account: зміна пароля з підтвердженням по email`

- Status: `[ ]`
- Priority: `P2`
- Module: `SOURCE`
- Allowed roles: `Backend Developer`, `Frontend Developer`
- Assignee: `unassigned`
- Machine: `morgan.local`, `workspace`
- Lock scope: `mw-unified-site/src/`
- Touched paths: `mw-unified-site/src/`
- Parallel-safe with: `TASK-119`
- Depends on: `TASK-117`

Мета:

- Зміна пароля вимагає підтвердження по email перед застосуванням.
- Flow: користувач вводить старий + новий пароль → лист з підтвердженням на email → після кліку пароль змінюється на всіх серверах (Classic, TBC, WotLK).
- Існуючий /auth/password/change endpoint вже оновлює всі 3 сервери — додати email verification gate.

Acceptance:

- [ ] Форма зміни пароля: old password + new password + confirm.
- [ ] Після сабміту — лист підтвердження на email.
- [ ] Пароль змінюється тільки після кліку по посиланню в листі.
- [ ] Пароль оновлюється на Classic, TBC, WotLK одночасно.

### `TASK-121` — `OPS: Видалити тестові акаунти (cleanup)`

- Status: `[+]`
- Priority: `P1`
- Module: `OPS`
- Allowed roles: `DevOps / Infrastructure`, `Project Architect`
- Assignee: `unassigned`
- Machine: `workspace`
- Lock scope: `workspace:/opt/`
- Touched paths: `remote runtime`
- Parallel-safe with: `any`
- Depends on: `none`

Мета:

- Видалити всі тестові акаунти крім samuel та admin на всіх серверах.
- Акаунти для видалення: semorgana, testplayer, testgmail, testuser та будь-які інші тестові.
- Також очистити pending_registration таблицю.
- Після cleanup на кожному сервері (Classic, TBC, WotLK) мають залишитись рівно 2 акаунти: SAMUEL та ADMIN.

### `TASK-122` — `Admin Panel: управління AHBot + PlayerBots`

- Status: `[ ]`
- Priority: `P2`
- Module: `SOURCE`, `OPS`
- Allowed roles: `Backend Developer`, `Frontend Developer`
- Assignee: `unassigned`
- Machine: `morgan.local`, `workspace`
- Lock scope: `mw-unified-site/src/`, `workspace:/opt/`
- Touched paths: `mw-unified-site/src/`
- Parallel-safe with: `TASK-119`, `TASK-120`
- Depends on: `TASK-117`

Мета:

- Адмін-панель (доступна тільки для gmlevel > 0) з налаштуваннями AHBot та PlayerBots.
- Зміни зберігаються у .conf файли на workspace і при потребі перезапускають відповідні сервіси.

**AHBot налаштування (Classic/TBC — CMaNGOS ahbot.conf):**

- [ ] Enable/Disable: `AuctionHouseBot.Chance.Sell` (0=off, 1-100=% шанс лістингу)
- [ ] Enable/Disable buying: `AuctionHouseBot.Chance.Buy` (0=off, 1-100=% шанс покупки)
- [ ] Max item level: `AuctionHouseBot.Level.MaxRequired` (1-60/70)
- [ ] Price multipliers per quality: `AuctionHouseBot.Value.Uncommon` (Green), `.Rare` (Blue), `.Epic` (Purple)
- [ ] Price variance: `AuctionHouseBot.Value.Variance` (0-50%)
- [ ] Auction duration: `AuctionHouseBot.Time.Min` / `.Time.Max` (години)
- [ ] Bid range: `AuctionHouseBot.Bid.Min` / `.Bid.Max` (% від buyout)

**AHBot налаштування (WotLK — AzerothCore mod_ahbot.conf):**

- [ ] Enable seller: `AuctionHouseBot.EnableSeller` (0/1)
- [ ] Enable buyer: `AuctionHouseBot.EnableBuyer` (0/1)
- [ ] Items per cycle: `AuctionHouseBot.ItemsPerCycle`
- [ ] Auction duration: `AuctionHouseBot.ElapsingTimeClass` (0=48h, 1=24h, 2=12h)
- [ ] Item filters: `AuctionHouseBot.VendorItems`, `.LootItems`, `.ProfessionItems`
- [ ] Binding filters: `AuctionHouseBot.Bind_When_Picked_Up`, `.Bind_When_Equipped`
- [ ] Level filters: `AuctionHouseBot.DisableItemsBelowReqLevel`, `.DisableItemsAboveReqLevel`

**PlayerBots налаштування (Classic — CMaNGOS aiplayerbot.conf):**

- [ ] Enable/Disable: `AiPlayerbot.Enabled` (0/1)
- [ ] Random bot auto-login: `AiPlayerbot.RandomBotAutologin` (0/1)
- [ ] Кількість ботів: `AiPlayerbot.MinRandomBots` / `AiPlayerbot.MaxRandomBots`
- [ ] Рівень ботів: `AiPlayerbot.RandomBotMinLevel` / `AiPlayerbot.RandomBotMaxLevel`
- [ ] Max level chance: `AiPlayerbot.RandomBotMaxLevelChance` (0.0-1.0)
- [ ] Activity when alone: `AiPlayerbot.botActiveAlone` (0-100%)
- [ ] Auto quests: `AiPlayerbot.AutoDoQuests` (0/1)
- [ ] Join BG: `AiPlayerbot.RandomBotJoinBG` (0/1)
- [ ] Guild formation: `AiPlayerbot.RandomBotFormGuild` (0/1), `AiPlayerbot.RandomBotGuildCount`

Acceptance:

- [ ] Адмін-панель доступна тільки для gmlevel > 0.
- [ ] UI з секціями AHBot і PlayerBots, з toggle/slider/input для кожного параметра.
- [ ] Зміни зберігаються в .conf файл на сервері.
- [ ] Кнопка "Apply" перезавантажує конфіг (або перезапускає сервіс).
- [ ] Поточні значення завантажуються з .conf при відкритті панелі.

### `TASK-123` — `Admin Panel: Download/Upload конфігів серверів`

- Status: `[ ]`
- Priority: `P2`
- Module: `SOURCE`, `OPS`
- Allowed roles: `Backend Developer`, `Frontend Developer`
- Assignee: `unassigned`
- Machine: `morgan.local`, `workspace`
- Lock scope: `mw-unified-site/src/app/api/admin/`, `mw-unified-site/src/app/admin/`, `workspace:/opt/mw-unified-site/docker-compose.yml`
- Touched paths: `mw-unified-site/src/`, `workspace:/opt/mw-unified-site/`
- Parallel-safe with: `TASK-122`
- Depends on: `TASK-075`

Мета:

- В адмін-панелі під кожним блоком сервера (Classic, TBC, WotLK) — набір кнопок для download/upload конфігів.
- Адмін скачує архів, править .conf файли локально, завантажує назад і перезапускає сервер.
- Config-папки монтуються в контейнер через docker-compose volumes (read-write).

**Структура UI для кожного сервера (3 набори = 18 кнопок):**

Classic (VMaNGOS):
- [ ] `Download config archive` — tar.gz з `/opt/vmangos-classic/config/`
- [ ] `Upload mangosd.conf`
- [ ] `Upload realmd.conf`
- [ ] (playerbot/ahbot — відсутні на Classic VMaNGOS, поки не підключений модуль)
- [ ] `───────────────────────` (підкреслювальна лінія-розділювач)
- [ ] `Restart server with new config`

TBC (CMaNGOS):
- [ ] `Download config archive` — tar.gz з `/opt/cmangos-tbc/etc/`
- [ ] `Upload mangosd.conf`
- [ ] `Upload realmd.conf`
- [ ] `Upload ahbot.conf`
- [ ] `───────────────────────`
- [ ] `Restart server with new config`

WotLK (AzerothCore):
- [ ] `Download config archive` — tar.gz з `/opt/docker-azerothcore/env/etc/`
- [ ] `Upload worldserver.conf`
- [ ] `Upload authserver.conf`
- [ ] (mod_ahbot.conf — якщо модуль підключений)
- [ ] `───────────────────────`
- [ ] `Restart server with new config`

**Інфраструктурні зміни:**

- [ ] Змонтувати config-папки в docker-compose.yml:
  - `/opt/vmangos-classic/config:/host-configs/classic`
  - `/opt/cmangos-tbc/etc:/host-configs/tbc`
  - `/opt/docker-azerothcore/env/etc:/host-configs/wotlk`

**UI додатково для кожного сервера:**

- [ ] `Restore defaults` — повертає еталонний конфіг (зберігати `.conf.dist` як reference)

**Backend API:**

- [ ] `GET /api/admin/config/download?server=classic` — повертає tar.gz архів
- [ ] `POST /api/admin/config/upload` — приймає multipart form з полями `server` та `file`, валідує ім'я файлу, записує у змонтовану папку
- [ ] `POST /api/admin/config/restore` — відновлює еталонний `.conf.dist` → `.conf`
- [ ] Валідація: тільки дозволені імена файлів, розмір < 1MB, gmlevel >= 3
- [ ] **Верифікація синтаксису** при upload: перевіряти що файл є валідним .conf (пари `Key = Value`, коментарі `#`, секції — не бінарний сміття і не порожній)

**Еталонні конфіги (defaults):**

- [ ] Зберігати `.conf.dist` файли поруч з активними `.conf` (вони зазвичай вже є в дистрибутиві емулятора)
- [ ] Кнопка "Restore defaults" копіює `.conf.dist` → `.conf` і перезапускає сервер
- [ ] При першому деплої зробити backup поточних конфігів як `.conf.dist` якщо dist-файлів ще немає

Acceptance:

- [ ] Download config archive працює для всіх 3 серверів.
- [ ] Upload окремих .conf файлів записує у правильну папку.
- [ ] Upload з невалідним синтаксисом (бінарний файл, порожній, без жодного `Key = Value`) — відхиляється з помилкою.
- [ ] Restore defaults повертає еталонний конфіг і перезапускає сервер.
- [ ] Restart server після upload перезапускає Docker контейнер.
- [ ] Невалідні файли (неправильне ім'я, завеликий розмір) відхиляються.
- [ ] Non-GM користувачі не мають доступу.

### `TASK-124` — `Admin Panel: Remote console — виконання команд на worldserver`

- Status: `[ ]`
- Priority: `P2`
- Module: `SOURCE`, `OPS`
- Allowed roles: `Backend Developer`
- Assignee: `unassigned`
- Machine: `morgan.local`, `workspace`
- Lock scope: `mw-unified-site/src/app/api/admin/`, `mw-unified-site/src/app/admin/`
- Touched paths: `mw-unified-site/src/`
- Parallel-safe with: `TASK-122`, `TASK-123`
- Depends on: `TASK-075`

Мета:

- В адмін-панелі під кожним сервером — поле вводу для виконання довільної команди на worldserver.
- Не тільки `.server announce`, а будь-яка GM-команда: `.lookup`, `.additem`, `.tele`, `.ban`, `.kick` тощо.
- Вивід результату команди показується в UI.

**Реалізація:**

Варіанти виконання команд:
1. **SOAP API** (Classic VMaNGOS — SOAP вже увімкнений на порті 7878, акаунт SOAPADMIN існує)
2. **docker exec + attach** — відправити команду через stdin контейнера
3. **RA (Remote Access)** — telnet-подібний інтерфейс деяких емуляторів

**UI:**

- [ ] Для кожного сервера — input field з placeholder "Enter command (e.g. .server info)"
- [ ] Кнопка "Execute" або Enter для виконання
- [ ] Output area під полем — відповідь сервера (моноширинний шрифт, scroll)
- [ ] Історія останніх 10 команд (localStorage)
- [ ] Автодоповнення для найпоширеніших команд (опційно)

**Backend API:**

- [ ] `POST /api/admin/command` — `{ server, command }` → виконує через SOAP/docker exec → повертає відповідь
- [ ] Валідація: gmlevel >= 3, command не порожня
- [ ] Timeout: 10 секунд на виконання
- [ ] Аудит-лог: кожна команда логується з timestamp, username, server, command

Acceptance:

- [ ] Введена команда виконується на вибраному сервері.
- [ ] Відповідь сервера відображається в UI.
- [ ] Працює для Classic (через SOAP), TBC, WotLK.
- [ ] Небезпечні команди (`.shutdown`) вимагають підтвердження.
- [ ] Non-GM не мають доступу.

### `TASK-125` — `GitHub: публікація проекту + build-based update flow`

- Status: `[ ]`
- Priority: `P1`
- Module: `OPS`, `SOURCE`
- Allowed roles: `Project Architect`, `DevOps / Infrastructure`
- Assignee: `unassigned`
- Machine: `morgan.local`, `workspace`
- Lock scope: `wow_projects/`, `workspace:/opt/`
- Touched paths: `wow_projects/`, `mw-unified-site/`, `workspace:/opt/mw-unified-site/`
- Parallel-safe with: `none`
- Depends on: `none`

Мета:

- Проект наразі НЕ на GitHub — тільки локальні git repos без remote.
- Потрібно створити GitHub repo, запушити, і перевести весь workflow на git-based deployment.
- Будь-хто зможе склонувати repo і розгорнути свій сервер.

**Subtasks:**

1. Підготовка до публікації:
- [ ] Аудит всіх файлів на предмет секретів (паролі, API keys, JWT secrets)
- [ ] Створити `.env.example` шаблони для кожного компоненту (сайт, classic, tbc, wotlk)
- [ ] Додати `.gitignore` — виключити `.env`, `node_modules`, icon-cache, logs, тощо
- [ ] Прибрати хардкодовані credentials з коду (перевірити все використовує `process.env`)
- [ ] Визначити структуру repo: mono-repo (все в одному) чи окремі repos

2. Структура repo (без submodules):
- [ ] В repo тільки **свій** код: сайт, docker stacks, transfer, configs, docs
- [ ] Upstream repos (vmangos, cmangos, azerothcore) **НЕ включаються** — клонуються скриптом
- [ ] `.gitignore`: upstream папки, `.env`, `node_modules`, icon-cache, logs, `*.dbc`
- [ ] Створити repo на GitHub, push

3. `setup.sh` — bootstrap скрипт:
- [ ] Клонує upstream repos в правильні папки:
  ```bash
  git clone https://github.com/vmangos/core vmangos-classic
  git clone https://github.com/cmangos/mangos-tbc cmangos-tbc
  git clone https://github.com/azerothcore/azerothcore-wotlk azerothcore-wotlk
  ```
- [ ] Копіює `.env.example` → `.env` якщо `.env` не існує
- [ ] Генерує випадковий JWT_SECRET, DB passwords (якщо не задані)
- [ ] Перевіряє prerequisites: Docker, docker compose, git
- [ ] Підказує наступні кроки: "Edit .env → docker compose up -d"

4. `update.sh` — оновлення всього стеку:
- [ ] `git pull` в кореневому repo (свій код)
- [ ] `git pull` в кожній upstream папці (vmangos, cmangos, azerothcore)
- [ ] `docker compose build` для змінених сервісів
- [ ] `docker compose up -d` для перезапуску
- [ ] Збирає git log змін і виводить summary
- [ ] Кнопка Update в адмін-панелі викликає цей скрипт

5. Maps/vmaps/mmaps:
- [ ] Не включати в repo (авторське право Blizzard)
- [ ] В `setup.sh`: запитати шлях до maps або автоматично завантажити (див. TASK-126)
- [ ] Передбачити місце в структурі: `data/classic/`, `data/tbc/`, `data/wotlk/` з `.gitkeep`
- [ ] В README: пояснити де взяти maps (витягти з клієнта або зовнішнє джерело)

6. Документація:
- [ ] README: вимоги (Docker, ARM64/AMD64, домен, DNS)
- [ ] Quick start: `git clone → ./setup.sh → edit .env → docker compose up -d`
- [ ] Окремі секції для кожного компоненту (Classic, TBC, WotLK, Website)

Acceptance:

- [ ] Проект на GitHub з чистою історією.
- [ ] Жодних секретів в коді — все через `.env`.
- [ ] Нова людина може розгорнути весь стек за README інструкцією.
- [ ] Update через адмін-панель працює через `git pull + build` (без Docker Hub).
- [ ] `.env.example` для кожного компоненту з описом кожної змінної.
- [ ] Maps/vmaps/mmaps: або автозавантаження (TASK-126), або чіткі інструкції в README.

### `TASK-126` — `Дослідження: автозавантаження maps/vmaps/mmaps без порушення авторських прав`

- Status: `[ ]`
- Priority: `P2`
- Module: `OPS`
- Allowed roles: `Project Architect`, `DevOps / Infrastructure`
- Assignee: `unassigned`
- Machine: `morgan.local`
- Lock scope: `docs/`
- Touched paths: `docs/`
- Parallel-safe with: `TASK-125`
- Depends on: `none`

Мета:

- Maps, vmaps, mmaps, dbc — необхідні для роботи серверів, але є витягом з клієнта Blizzard (авторське право).
- Жоден великий проект не зберігає їх в своєму repo напряму.
- Проект `celguar/spp-classics-cmangos` (https://github.com/celguar/spp-classics-cmangos) якимось чином автоматично завантажує ці файли при setup, не зберігаючи в repo.

**Дослідити:**

- [ ] Як `spp-classics-cmangos` реалізує завантаження maps:
  - Знайти в коді/скриптах рядки що завантажують maps (curl, wget, download URL)
  - Звідки саме беруться файли (зовнішній хостинг? CDN? torrent? mega.nz?)
  - Чи є окремий "data" repo або release з assets
  - Як обходиться питання авторського права (disclaimer? окремий сервіс?)
- [ ] Як інші великі проекти вирішують це:
  - VMaNGOS — як пропонує отримати maps
  - AzerothCore — data repo або інструкції
  - TrinityCore — підхід до maps
- [ ] Варіанти для нашого проекту:
  - Варіант A: `setup.sh` витягує maps з клієнта WoW (потрібен клієнт у користувача)
  - Варіант B: зовнішнє посилання (як spp-classics) — ризик DMCA?
  - Варіант C: окремий приватний repo/storage для maps
  - Варіант D: надати інструкцію "скачай звідси" без автоматизації

Acceptance:

- [ ] Документ з результатами дослідження: як spp-classics завантажує maps.
- [ ] Список URL/механізмів які використовує spp-classics.
- [ ] Рекомендація найбезпечнішого підходу для нашого проекту.
- [ ] Якщо обрано автозавантаження — прототип скрипта в `setup.sh`.
