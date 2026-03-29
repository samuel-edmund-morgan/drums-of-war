# Статус Проєкту

Останній перегляд: `2026-03-23`

## Коротке Резюме

- Стадія: `Unified website migration (Phase 1 DONE)`
- Поточний фокус: `TASK-066 Phase 1 DONE — Auth microservice deployed, cross-patch login working; наступні: Phase 2 unified homepage (Next.js), TASK-077 modern PHP`
- Головний блокер: `немає`
- Наступний запланований backlog item: `TASK-066 Phase 2 — Unified Next.js homepage`

## Стратегічний план заміни емуляторів

End-state мета: **3 сервери замість поточних 4+1**

1. **Фаза A (завершена)**: замінити cmangos-wotlk на azerothcore-wotlk
   - ~~TASK-067: fix WotLK website (realm_settings + DB grants)~~ — **DONE**
   - ~~TASK-074: fix realm IP 127.0.0.1, realm status Offline, скопіювати news~~ — **DONE**
   - ~~TASK-069: verify 3-step transfer Classic → TBC → AzerothCore~~ — **DONE**
   - ~~TASK-068: decommission cmangos-wotlk після верифікації~~ — **DONE** (`2026-03-20`)
   - Результат: Classic (cmangos) + TBC (cmangos) + WotLK (AzerothCore) — **3 сервери ✅**

2. **Фаза B (завершена)**: замінити cmangos-classic на vmangos-classic
   - ~~TASK-070: розгорнути vmangos-classic, імпортувати `samuel_FULL_backup.sql`~~ — **DONE** (`2026-03-19`)
   - ~~TASK-071: замінити cmangos-classic на vmangos-classic~~ — **DONE** (`2026-03-19`)
   - ~~TASK-072: verify фінальний ланцюжок vmangos → cmangos-tbc → azerothcore~~ — **DONE** (`2026-03-22`)
   - Результат: Classic (VMaNGOS) + TBC (cmangos) + WotLK (AzerothCore) — фінальний end-state ✅

## Website features roadmap

### Unified website migration (active)

Архітектурне рішення `2026-03-23`: замість 3 окремих сайтів — **один unified website** з cartoon WoW стилем (wow-hc.com reference). Поетапний підхід:

- ~~**Phase 1**~~: Auth microservice (`mw-auth-service`) — **DONE** (`2026-03-23`)
  - JWT-based auth at `/auth/`, connects to all 3 auth DBs
  - SRP6 password verification and cross-patch sync
  - Legacy `class.auth.php` patched for JWT fallback (curl-based)
  - Identity mapping via `website_identity` tables
  - Container: `mw-auth-service` on workspace (port 8080, traefik at `/auth/`)
  - Image: `semorgana/mw-auth-service:task066-dev`
  - Website image: `semorgana/mangos-website:task066-jwt-fallback`
- **Phase 2**: Unified homepage (Next.js + React) — server status cards for all 3 expansions
- **Phase 3**: Migrate armory (already multi-realm capable)
- **Phase 4**: Migrate account/transfer
- **Phase 5**: Decommission legacy website containers

### Other features

- **TASK-075**: Адмін-панель для GM — restart, config, monitoring з сайту.
- **TASK-076**: Карта гравців онлайн — інтерактивна карта з маркерами.
- **TASK-077**: Міграція на сучасний PHP (5.6 → 8.x). Критична, незалежна від решти.

Поточний стан: cmangos-classic **замінено на VMaNGOS** (`TASK-071`, `2026-03-19`). cmangos-wotlk **деактивовано** (`TASK-068`, `2026-03-20`). AzerothCore є єдиним WotLK runtime на workspace. Daily-sync lib.sh оновлено для vmangos source. Website `/classic/` працює через vmangos-db/realmd. Classic armory **виправлено** (`TASK-078`, `2026-03-22`): `db_name_map` support + `classicarmory` DB створено. `cmangos-update.timer` деактивовано. **Фінальний transfer ланцюжок верифіковано** (`TASK-072`, `2026-03-22`): daily-sync vmangos → cmangos-tbc (`SKIP`) → azerothcore (`SYNCED`, login verify `SUCCESS`). `lib.sh` оновлено: `mangos:mangos` user для vmangos-db/cmangos-tbc-db; azerothcore start_server() використовує `docker start`. Website image: `semorgana/mangos-website:task088-item-tooltip-fix-20260322`. **Фінальна топологія підтверджена**: Classic (VMaNGOS) + TBC (cmangos) + WotLK (AzerothCore) — 3 сервери, 3 різні емулятори.

## Чого ще бракує (найближчі критичні задачі)

- ~~`TASK-067`~~: **DONE** — WotLK website surface працює через AzerothCore
- ~~`TASK-069`~~: **DONE** — 3-кроковий transfer верифіковано
- ~~`TASK-068`~~: **DONE** — cmangos-wotlk деактивовано
- ~~`TASK-070`~~: **DONE** — vmangos-classic deployed, Samuel character migrated
- ~~`TASK-071`~~: **DONE** — cmangos-classic replaced by vmangos-classic
- ~~`TASK-078`~~: **DONE** — Classic armory 500 fixed (db_name_map + classicarmory DB)
- ~~`TASK-072`~~: **DONE** — фінальний ланцюжок vmangos → cmangos-tbc → azerothcore верифіковано (`2026-03-22`)
- ~~`TASK-066 Phase 1`~~: **DONE** — Auth microservice (`mw-auth-service`) deployed, JWT cross-patch login verified (`2026-03-23`)

## Валідність контексту

| Перевірка | Статус | Примітки |
|---|---|---|
| `localProjects/` містить файли проєкту | `YES` | Наявний повний legacy workspace `localProjects/cmangos_projects` |
| `remote_access.md` містить дані доступу | `YES` | Зафіксований SSH alias `workspace` |
| `additionalContextFiles/` містить допоміжні матеріали | `NO` | Папка порожня, маніфест не заповнений |
| `gh` встановлений | `YES` | Перевірено локально |
| `gh` автентифікований | `YES` | Активний акаунт `samuel-edmund-morgan` |
| Активна роль відома | `YES` | `Project Architect` у `workflow_config.md` |

Контекст достатній для реальної роботи. `workspace` live-перевірено в цій сесії через ControlMaster `/tmp/ssh-ws`.

## Знімок середовищ

| Середовище | Існує | Статус | Остання перевірка | Примітки |
|---|---|---|---|---|
| `local` | `YES` | `ready / verified` | `2026-03-15 09:42 EET` | Кореневий template, legacy workspace, full `azerothcore-wotlk` checkout, live local AzerothCore stack на `3727/8088/3309/7879`, validated migration SQL, login bot і daily-sync AzerothCore integration доступні; legacy website layer у `docker-website/` verified локально, browser audit harness runnable, а path-prefix contract для `/classic`/`/tbc`/`/wotlk`/`/wotlk-azcore` локально доведений через prefixed smoke + `shared_topnav` DOM proof |
| `test` | `YES` | `active / verified` | `2026-03-20` | `workspace` доступний; CMaNGOS Classic/TBC stacks healthy, AzerothCore deployed as sole WotLK runtime (`azerothcore-db`, `azerothcore-authserver`, `azerothcore-worldserver` on `3309/3727/8088/7879`). cmangos-wotlk decommissioned (`TASK-068`). 3-step pipeline (Classic → TBC → AzerothCore) verified (`TASK-069`). Daily-sync uses `SKIP_WOTLK=true`. Canonical website route `/wotlk/` reads from AzerothCore auth DB. |
| `stage` | `NO` | `absent` | `2026-03-14` | Окремого staging нема |
| `prod` | `NO` | `absent / shared-remote-risk` | `2026-03-14` | Нема окремого prod; remote runtime слід трактувати як high-risk shared environment |

## Що вже працює

- Live-перевірено, що Classic, TBC і WotLK сервери розгорнуті в Docker на `workspace` і всі 6 CMaNGOS контейнерів у статусі `healthy`.
- Новий backlog track `TASK-035..TASK-047` уже декомпозує website-driven self-service transfers і account roster на дрібні кроки: product contract, cross-patch session/identity, request schema, eligibility, targeted runner, chained WotLK runner, locking, standalone `My Characters` roster layer, transfer UI, history, admin controls і QA gates.
- Додатково `TASK-048..TASK-052` відкривають окремий modernization decision track для legacy website: feasibility assessment, PHP 5.6 compatibility debt inventory, target architecture, route-level slices і low-risk prototype замість необґрунтованого total rewrite.
- `TASK-048` already completed: verified verdict = modern PHP migration реальна тільки як incremental modernization; big-bang rewrite не є рекомендованим стартовим шляхом.
- `TASK-049` already completed: concrete PHP 8 blocker inventory is now fixed for `mangos-website` (`144` `mysql_*` refs across `22` PHP files, `6` magic-quotes refs, `7` curly string-offset refs, `3` `preg_replace /e` refs, and bundled `DbSimple` / `JsHttpRequest` / `AJAXChat` libraries identified as isolate-or-replace modernization boundaries rather than first-wave uplift targets).
- `TASK-050` already completed: target architecture is now fixed as a route-level strangler with a companion PHP 8.x application layer for account/security/roster/transfer slices, while the current PHP 5.6 website remains the legacy shell/fallback for Armory, forum/chat, admin/chartools, donate, and other subsystem-heavy zones.
- `TASK-051` already completed: the modernization plan is now decomposed into explicit route-level slice cards, with prototype-first sequencing (`TASK-052`), first-wave modern owner slices (`TASK-056..TASK-059`), and separately postponed/isolated hold zones for public server pages later plus Armory/forum/admin/donate (`TASK-060..TASK-064`).
- `TASK-052` already completed locally: a standalone PHP 8 companion runtime now serves the low-risk `realmstatus` slice at `/wotlk/modern/realmstatus`, the render-contract smoke passed against the live legacy page, and the prototype truthfully reports `data-source=fallback` when no local bridge to the legacy DB host exists.
- `TASK-058` is now complete locally: `/classic|/tbc|/wotlk/modern/account/manage` is owned by the PHP 8 companion runtime, reuses the verified session bridge, renders account overview plus `My Characters`, and preserves truthful fixture-backed bucket states for populated `classic`, empty `tbc`, and unavailable `wotlk` while keeping transfer actions explicitly out of scope until `TASK-059`.
- `TASK-059` is now complete across local prototype plus runtime safety layer: the same modern `/classic|/tbc|/wotlk/modern/account/manage` surface now owns transfer submit/history/operator-aware control UI, while `/opt/cmangos-transfer/request-locks.sh` plus the canonical runners on `workspace` enforce explicit operator-disabled, queue-paused, and emergency-stop blocking with normalized blocker codes instead of the previous generic fallback.
- Shared-account gap remains open: the modern companion layer still explicitly renders `identity_mode=legacy_account_id` and says roster discovery remains transitional until a verified website-identity mapping table exists. There is still no live website-wide shared account/session across `/classic/`, `/tbc/`, and `/wotlk/`.
- `TASK-060` is now complete locally: the PHP 8 companion runtime owns the canonical public `server.howtoplay` query route on `/classic|/tbc|/wotlk/index.php?n=server&sub=howtoplay`, renders the same legacy `lang/howtoplay/*.html` content from bundled resource files, and passed a parity smoke against the live legacy page while truthfully limiting repeatability to other static `lang_resource(...)` public guides rather than forum/news-backed pages.
- `TASK-061` is now complete in docs: Armory is explicitly contained as a legacy-owned subsystem rather than the next modernization slice. The project now treats the current live Armory as a compatibility-preserved hold zone with a minimum public contract on prefixed entrypoints, XML-era redirect bridges, and non-leaking failure behavior; any future PHP 8 change must start as a dedicated replacement track instead of piggybacking on the low-risk public-page path.
- `TASK-062` is now complete in docs: forum/chat are explicitly contained as legacy-owned subsystems rather than the next modernization slice. The project now treats the current live forum routes and iframe-backed community chat as a compatibility-preserved hold zone with a minimum public contract on prefixed forum URLs, forum-backed frontpage/news links, truthful chat disabled-state handling, and non-leaking failure behavior; any future PHP 8 change must start as a dedicated replacement track instead of piggybacking on account/session or low-risk public-page work.
- `TASK-063` is now complete in docs: admin/chartools are explicitly contained as legacy-owned operator/mutation subsystems rather than the next modernization slice. The project now treats the hardened `n=admin` zone and the legacy chartools family as a compatibility-preserved hold zone with a minimum contract on fail-closed admin entrypoints, truthful legacy mutation behavior, and non-leaking operator failures; any future PHP 8 change must start as a dedicated replacement track instead of piggybacking on public or account-centered modernization.
- `TASK-064` is now complete in docs: donate/payment is explicitly contained as a legacy-owned payment subsystem rather than the next modernization slice. The project now treats standalone `donate.php` plus its attached payment/IPN/fulfillment flows as a compatibility-preserved hold zone with a minimum contract on fail-closed public entrypoints, truthful legacy payment-versus-fulfillment behavior, and non-leaking payment/operator failures; any future PHP 8 change must start as a dedicated replacement or retirement track instead of piggybacking on public or account-centered modernization.
- `TASK-036` already completed: cross-patch website identity/session contract зафіксовано, тому next website implementation wave може починатися з roster/password tasks без архітектурної двозначності щодо principal/session model.
- `TASK-046` already completed in code: `mangos-website` now has a canonical roster backend helper that groups characters by patch, exposes minimal character fields, and explicitly documents its current `legacy_account_id` fallback behavior for cross-patch mismatches.
- `TASK-047` already completed in code: logged-in `account/manage` now renders a visible `My Characters` section with patch buckets, populated/empty/partial-unavailable states, and base roster fields without falling back to scattered per-template character queries.
- `TASK-053` already completed in docs: canonical password-change behavior is now defined separately from the unsafe legacy `changepass` action, including current-password verification, forced re-login, linked-account-wide target scope, and truthful release evidence requirements for the upcoming implementation task.
- `TASK-054` is now complete live: the deployed public `account.manage` surfaces render `My Characters` plus the new `Change Password` section, and safe negative submit checks confirm the new validation handler is active without mutating the real password.
- `TASK-037` is now complete in docs: the canonical self-service transfer storage model is fixed as `transfer_requests` plus immutable `transfer_request_events`, with explicit chain fields, idempotency semantics, and retention policy for future website transfer/history tasks.
- `TASK-038` is now complete in code/docs: the website account area has a canonical eligibility discovery payload that evaluates visible Classic/TBC characters into `to_tbc`, `to_wotlk`, or blocked actions using normalized blocker codes, username-based target account mapping, and the existing `character_sync_hash` safety model.
- `TASK-039` is now complete in code/runtime: `/opt/cmangos-transfer/targeted-transfer-runner.sh` provides a non-interactive Classic -> TBC request runner with explicit account/character context, optional password override, dry-run mode, and structured JSON output for website-side orchestration without editing `sync-accounts.conf`.
- `TASK-040` is now complete in code/runtime: `/opt/cmangos-transfer/chained-wotlk-transfer-runner.sh` orchestrates canonical `to_wotlk` requests as either `classic_via_tbc` or `tbc_direct`, exposes per-step chain state in structured JSON, and keeps partial-chain retry semantics explicit (`tbc_to_wotlk` retry after an already-satisfied TBC stage).
- `TASK-041` is now complete in code/runtime/docs: website eligibility now exposes deterministic request guard keys, request-scoped runners enforce character-level active locks plus request-level idempotency metadata, stale locks are reclaimed safely, and the remote acceptance harness on `/opt/cmangos-transfer/test-request-lock-guards.sh` verified `duplicate_request` blocking for both targeted and chained runners plus `recovered_stale` behavior.
- `TASK-042` is now complete in code: logged-in `account/manage` extends `My Characters` with transfer-state badges, explicit `Transfer to TBC` / `Transfer to WotLK` actions, blocker reasons, deterministic guard-key visibility, and a GET-driven confirmation preview that stays truthful about later queue/history/admin work.
- `TASK-043` is now complete in docs: the canonical transfer history/progress surface is fixed as one active-request summary plus a reverse-chronological request history backed by `transfer_requests` and `transfer_request_events`, with normalized step labels, UI-safe error categories, and a manual-refresh-safe contract.
- `TASK-044` is now complete in docs: operator-only transfer controls are fixed as audited overrides with canonical disable/pause/emergency-stop flags under `/opt/cmangos-transfer/runtime/control`, shell-level inspection/toggle runbooks, and explicit boundaries between user actions and operator recovery work.
- `TASK-016` is now complete in docs: guild transfer is fixed as an operator-only legacy `transfer.sh` side path with explicit Classic-vs-guild-bank incompatibility rules, while the canonical daily-sync and self-service transfer contract remains character-scoped and does not claim guild migration support.
- `TASK-055` is now complete live: the dead legacy Armory XML-era URLs `/classic/armory/battlegroups.xml`, `/classic/armory/select-team-type.xml`, and `/classic/armory/arena-ladder.xml` no longer return `404`; the deploy layer now redirects them into the working Armory HTML flow, and the final public rollout is running on `semorgana/mangos-website:task055c-armoryxmlredirectfix-20260316` with all four website containers healthy.
- Задокументований transfer stack: `transfer-interactive.sh`, `daily-sync.sh`, `wow_login_test_universal.py`, `srp6_set_password.py`.
- Задокументовано вирішення WotLK crash при TBC→WotLK transfer через pre-insert у `character_achievement_progress`.
- Sequential daily sync pipeline (Classic→TBC verify→WotLK verify) не лише описаний, а й підтверджений останнім успішним запуском `2026-03-14 04:02:52 EET`.
- Новий template ініціалізовано, а вся project-owned legacy workflow-документація мігрована в кореневі `docs/`.
- Remote paths `/opt/cmangos-classic`, `/opt/cmangos-tbc`, `/opt/cmangos-wotlk`, `/opt/cmangos-transfer` існують і належать `samuel:samuel`.
- На remote окремо активні всі три expansion update timer-и: `cmangos-update.timer`, `cmangos-tbc-update.timer`, `cmangos-wotlk-update.timer`, плюс `cmangos-daily-sync.timer`.
- `TASK-003` завершив verified single-account E2E: `daily-sync.sh` пройшов з `Accounts=1`, `Synced=2`, `Errors=0`, а login verify дав `SUCCESS` на TBC і WotLK.
- Після sync `Samuel (guid=1801)` існує і на TBC, і на WotLK; на обох target DB `at_login=0`, `online=0`.
- `TASK-020` закрив hash lifecycle drift: `character_sync_hash` тепер зберігається тільки після успішного verify на TBC і WotLK.
- Verified repeat-run після deploy нового `daily-sync.sh` знову дав `Synced=2`, `Errors=0`, а post-run DB показав `current_hash == stored_hash` на обох target DB.
- `TASK-004` закрив multi-account coverage через окремий temp config `/opt/cmangos-transfer/sync-accounts.task004.conf`: clean rerun дав `Accounts=3`, `Synced=4`, `Skipped=2`, `Created=2`, `Errors=0`.
- На clean multi-account rerun `AUTOACC` був auto-created на TBC і WotLK, `Autolock (guid=1802)` пройшов verify на обох targets, зберіг `168 inventory / 313 item_instance`, а `current_hash == stored_hash`.
- `SKIPACC` на обох targets лишився на навмисному stale-hash шляху: `Skiplock (guid=1803)` не перезаписувався, але manual login verify після run-а дав `SUCCESS` на TBC і WotLK.
- `TASK-005` закрив class coverage через temp configs `/opt/cmangos-transfer/sync-accounts.task005.conf` і `/opt/cmangos-transfer/sync-accounts.task005.classacc-only.conf`: фінальний isolated rerun для `CLASSACC` дав `Accounts=1`, `Synced=4`, `Errors=0`, а `Testwar (guid=1804)` і `Testhunt (guid=1805)` пройшли verify на TBC і WotLK.
- У межах `TASK-005` прибрано два false-negative джерела:
  - `daily-sync.sh` тепер робить один retry verify перед rollback, що прибрало хибний перший FAIL після restart на TBC.
  - `wow_login_test_universal.py` для WotLK тепер враховує 4-byte `customize flags` у `CHAR_ENUM`, тому multi-character accounts більше не дають хибний `NOT_FOUND` для другого персонажа.
- Після class-coverage rerun canonical baseline відновлено: окремий `daily-sync.sh` по `/opt/cmangos-transfer/sync-accounts.conf` знову синхронізував `Samuel (guid=1801)` на TBC і WotLK без rollback.
- Послідовні manual login smokes після фінальних rerun-ів дали `RESULT: SUCCESS` для Warlock `Samuel (1801)`, Warrior `Testwar (1804)` і Hunter `Testhunt (1805)` на TBC і WotLK.
- `TASK-006` закрив 3-run stability на isolated config `/opt/cmangos-transfer/sync-accounts.task006.conf`:
  - `Run 1` → `Accounts=1`, `Synced=4`, `Skipped=0`, `Errors=0`
  - `Run 2` → `Accounts=1`, `Synced=0`, `Skipped=4`, `Errors=0`
  - `Run 3` після зміни Classic `Testwar.money=12345` → `Accounts=1`, `Synced=2`, `Skipped=2`, `Errors=0`
- Для цього `daily-sync.sh` і `lib.sh` тепер підтримують dual-baseline change detection: `character_sync_hash` зберігає не лише target `sync_hash`, а й `source_hash`, тому script відрізняє `played on target` від `unchanged since last verified sync`.
- Після фінального `TASK-006` run-а:
  - Classic/TBC/WotLK `Testwar (guid=1804)` мають `money=12345`
  - TBC/WotLK `Testwar` мають `at_login=0`, `online=0`, `sync_hash == source_hash == 297325587b3f1494baf0797de760d134`
  - TBC/WotLK `Testhunt (guid=1805)` лишився healthy skipped-char з `money=0`, `at_login=0`, `online=0`
- `TASK-007` завершив docs consolidation після Phase 15:
  - `PROJECT_BRIEF`, `PROJECT_STATUS`, `CONTINUATION_GUIDE`, `BACKLOG`, `TRANSFER_SYSTEM` і `SESSION_LOG` тепер описують verified post-Phase-15 baseline, а не pre-stabilization intent.
  - Наступний відкритий трек у канонічних docs зміщено на `TASK-008` / Phase 16 AzerothCore work.
- `TASK-008` закрив container discovery для Phase 16.1:
  - офіційно підтверджено два deployment paths: `azerothcore/acore-docker` як prebuilt-image compose і `azerothcore/azerothcore-wotlk` як build-capable compose/source layout;
  - локальний draft stack створено в `localProjects/cmangos_projects/docker-azerothcore/` з резервованими портами `8088/3727/3309/7879`;
  - `docker compose config` для draft stack проходить локально без deploy на `workspace`.
- Для ARM64 baseline Phase 16 наразі спирається на локальний build path з `azerothcore-wotlk`; prebuilt `acore/*` images не трактуються як гарантований multi-arch baseline, доки це явно не підтверджено.
- `TASK-009` закрив schema mapping для `cmangos-wotlk -> AzerothCore`:
  - live `wotlkcharacters`/`wotlkrealmd` `INFORMATION_SCHEMA` порівняно з official AzerothCore base SQL;
  - current transfer table-set покривається так: `45` релевантних таблиць, із них `43` already same-name, `1` rename (`character_tutorial -> account_tutorial`) і `1` missing target table (`character_battleground_data`);
  - окремий mapping artifact зафіксовано в `docs/AZEROTHCORE_SCHEMA_MAPPING.md`.
- Phase 16 тепер має verified blocker list:
  - auth/account transform (`account` + `account_access`);
  - explicit mapping для `characters`, `character_homebind`, `character_spell`, `character_talent`, `character_glyphs`, `character_queststatus`, `character_aura`, `pet_aura`, `guild_member`.
- `TASK-010` закрив перший executable migration skeleton для `cmangos-wotlk -> AzerothCore`:
  - створено `localProjects/cmangos_projects/transfer/migrate_cmangos_wotlk_to_azerothcore.sql`;
  - script орієнтований на temp DB + `safe_insert()` у pre-existing AzerothCore schema, а не на full DB replace;
  - explicit transforms уже покривають `characters`, `character_homebind`, `character_spell`, `character_glyphs`, `character_queststatus` + `character_queststatus_rewarded`, `character_aura`, `pet_aura`, `guild_member` + `guild_member_withdraw`, `corpse` і `character_tutorial -> account_tutorial`;
  - `character_talent` свідомо лишено reset-on-login blocker, а auth/account path оформлено як staged contract у footer migration file.
- `TASK-010` validated locally без live-мутування `workspace`:
  - read-only `mariadb-dump --no-data wotlkcharacters` з `workspace` імпортовано в throwaway local `mariadb:11`;
  - новий migration SQL пройшов без помилок, а post-run schema містила expected tables `account_tutorial`, `character_queststatus_rewarded`, `guild_member_withdraw`, `character_talent`, `character_aura`, `pet_aura`, `corpse`.
- `TASK-011` закрив local AzerothCore login/runtime validation:
  - official prebuilt `acore/*` images не мають придатного ARM64 manifest для цього host-а, тому verified baseline остаточно лишається local build path;
  - full local build + `docker compose up -d` пройшли успішно; `azerothcore-authserver`, `azerothcore-worldserver`, `azerothcore-db` ready, а `azerothcore-db-import` і `azerothcore-client-data-init` завершились `0`;
  - `wow_login_test_universal.py` тепер підтримує `--expansion azerothcore`; AzerothCore reuses WotLK wire protocol, але `AUTH_SESSION` мусить нести реальний `realm_id` із realmlist, а не hardcoded `0`;
  - обидва verified smoke paths (`--expansion wotlk --auth-port 3727 --world-port 8088` і `--expansion azerothcore`) доходять до `AUTH_OK`, `CHAR_ENUM`, `RESULT: NOT_FOUND` на порожньому realm;
  - live-доведено, що для auth staging CMaNGOS `s/v` треба писати в AzerothCore `salt/verifier` як `REVERSE(UNHEX(LPAD(...)))`.
- `TASK-012` закрив code-level інтеграцію AzerothCore в `daily-sync`:
  - `daily-sync.sh` тепер має optional Phase E/F (`WotLK -> AzerothCore` + verify), які автоматично вмикаються лише коли локально існують `azerothcore-db`, `azerothcore-authserver`, `azerothcore-worldserver`;
  - `lib.sh` тепер вміє працювати з `acore_auth` / `acore_characters` / `acore_world`, запускає і відновлює обидва AzerothCore сервіси та schema-aware створює `acore_auth.account` + `account_access`;
  - `do_transfer_char()` тепер виконує `migrate_cmangos_wotlk_to_azerothcore.sql` на temp DB і окремо remap-ить `account_tutorial.accountId` на target account id;
  - local focused validation на synthetic source account `TASK012ACC` довела, що `HEX(REVERSE(salt/verifier))` на target збігаються з source `s/v`, `account_access` отримує `gmlevel=3 / RealmID=-1`, а login bot доходить до `AUTH_OK`, `CHAR_ENUM`, `RESULT: NOT_FOUND`;
  - під час цієї валідації виправлено реальний bug у `ensure_account()`: порожній CMaNGOS `sessionkey` більше не зсуває наступні поля (`joindate`, `lockedIp`, `os`, `flags`) під час AzerothCore auth staging.
- `TASK-013` тепер завершено live на `workspace`:
  - AzerothCore source-build stack розгорнуто в `/opt/docker-azerothcore` + `/opt/azerothcore-wotlk`, а transfer runtime на `workspace:/opt/cmangos-transfer` оновлено актуальними `lib.sh`, `daily-sync.sh`, `migrate_cmangos_wotlk_to_azerothcore.sql`, `wow_login_test_universal.py`.
  - Під час live bring-up знайдено і виправлено чотири реальні blockers: відсутнє підвантаження `DOCKER_DB_ROOT_PASSWORD` у transfer shell, AzerothCore `worldserver` readiness false-negative, MariaDB `*_uca1400_*` collation drift при temp import у MySQL-backed `azerothcore-db`, і застарілий remote login bot без `--expansion azerothcore`.
  - Canonical one-host proof = `workspace:/opt/cmangos-transfer/logs/daily-sync-task013-forceclean-20260317_231158.log`: `Samuel (guid=1801)` synced and verified successfully on TBC, WotLK, and AzerothCore in one no-skip run, with post-verify hashes stored on all three target stages and no rollbacks.
- `TASK-027` теж завершено live, але фінальний public contract зміщено з окремого azcore surface на canonical WotLK replacement path:
  - `workspace:/opt/mangos-website/.env.multiroute` now points canonical `/wotlk/` at `acore_auth` through `MW_WOTLK_DB_HOST=azerothcore-db`, `MW_WOTLK_DB_NETWORK=azerothcore-net`, and a dedicated legacy-compatible DB user instead of the original MySQL 8 root login.
  - live compatibility repair on `2026-03-18` fixed three real blockers for the legacy PHP 5.6 website layer: wrong Docker network target (`docker-azerothcore_default` vs real `azerothcore-net`), MySQL 8 handshake incompatibility (`utf8mb3_general_ci` + `mysql_native_password` auth policy), and missing website bootstrap tables/views inside `acore_auth`.
  - current public truth: `https://world-of-warcraft.morgan-dev.com/wotlk/` renders the canonical WotLK website shell on top of AzerothCore auth data, while `https://world-of-warcraft.morgan-dev.com/wotlk-azcore/` now redirects to `/wotlk/` instead of existing as a fourth permanent surface.
- `TASK-017` закрив local legacy-website baseline:
  - upstream `celguar/mangos-website` intake зафіксовано на commit `9c9582c`;
  - у `localProjects/cmangos_projects/docker-website/` створено build-time compose, image-only remote compose, hardened Apache vhost, runtime config generator і `public-site-compat.sql`;
  - read-only local smoke підтвердив `403` для `/donate.php`, `/index.php?n=admin`, `/index.php?n=account.manage`, `/install/`, `/config/config.xml`, тоді як `/` лишається `200`;
  - first live contract свідомо лишається `WotLK-first public mode`, бо на `workspace` існують три ізольовані `realmd` DB, а не один shared auth/realm DB.
- `TASK-021` закрив live website rollout:
  - у `workspace:/opt/mangos-website/` живе runtime bundle з `docker-compose.yml`, `.env`, `full_install.sql`, `public-site-compat.sql`;
  - `wotlkrealmd` bootstrap-нуто через upstream `full_install.sql`, потім `public-site-compat.sql`; `realm_settings` направляє сайт на `cmangos-wotlk-db / wotlkmangos / wotlkcharacters`;
  - image `semorgana/mangos-website:task021-wotlk-public-20260315` з digest `sha256:04960d24580fe08d9349d006f0be647cdf29f07129b15c016348afb3d11cbbce` live-розгорнуто на `workspace`;
  - `mangos-website` працює в окремому контейнері зі status `healthy`, а Traefik успішно випустив Let’s Encrypt certificate для `world-of-warcraft.morgan-dev.com`;
  - зовнішня перевірка зійшлась: `/` = `HTTP 200`, `<title>World of Warcraft`, а `/install/`, `/index.php?n=admin`, `/index.php?n=account.manage`, `/donate.php`, `/config/config.xml` = `403`;
  - steady-state TLS verify теж зійшовся: current cert більше не self-signed, issuer = `Google Trust Services / WE1`, `notAfter=2026-05-13`.
- `TASK-022` закрив live website theme/assets repair:
  - root cause = case-sensitive drift між runtime references `templates/wotlk/*` і фактичним tree `templates/WotLK` усередині legacy website image;
  - deploy layer тепер self-heal-ить alias `templates/wotlk -> WotLK` і в build step, і в container entrypoint;
  - current live image = `semorgana/mangos-website:task022-themefix-20260315` з digest `sha256:b0e7b6b415d2441138ebebf93968804091f1527e22d587ccf665594d97abc084`;
  - зовнішній asset matrix після rollout зійшовся: `/templates/wotlk/css/newhp.css`, `/templates/wotlk/js/detection.js`, `/templates/wotlk/images/pixel000.gif` = `200`, тоді як hardened routes лишилися `403`.
- `TASK-023` закрив browser-level website audit:
  - у `localProjects/cmangos_projects/docker-website/browser-audit/` існує isolated Playwright/Chromium harness з reproducible runner `run_live_audit.sh`;
  - перший live baseline report збережено в `browser-audit/reports/20260315_092632/` і містить `30` visited pages, `477` recorded actions, `210` total issues, `205` unexpected same-origin findings;
  - головний recurring finding у baseline = `404` на `/js/compressed/prototype.js`, який далі породжує console/request noise; blocked `403` routes теж централізовано видно в report.
- `TASK-023` тепер має refreshed post-`TASK-026` rerun у `browser-audit/reports/20260315_105344/`:
  - audit config вирівняно до нового public contract (`/`, `/classic/`, `/tbc/`, `/wotlk/`, `/wotlk-azcore/` плюс expected hardened routes), тож expected `403/404` більше не домінують у noise floor;
  - refreshed metrics = `pages_visited=30`, `actions_recorded=258`, `issues_total=120`, `issues_unexpected=116`;
  - current residual findings = missing same-origin `prototype.js` assets на prefixed surfaces, `500` на `/classic/armory/index.php` і root-scoped discovered legacy URLs, що повертають `418/404` поза canonical path-prefix contract.
- `TASK-028` завершив root-cause triage для residual website findings:
  - `prototype.js` `404` = real missing asset in legacy repo/runtime, not just deploy mismatch;
  - Armory `500` = live PHP 5.6 runtime incompatibility with PHP 7+ syntax currently present in `armory/configuration/functions.php`;
  - root-scoped `418/404` noise з report `20260315_105344` виявився переважно crawler-resolution artifact, бо audit queue-ив relative links against original seed URL `/` instead of final redirected URL `/classic/`.
- `TASK-023` browser audit harness тепер also verified-fixed for redirect correctness:
  - `browser_audit.py` queue-ить discovered links against `final_url` after redirect;
  - post-fix report `browser-audit/reports/20260315_110836/` більше не розмножує root-scoped `/index.php?...` artifacts, натомість показує real `/classic/...` discovered pages.
- `TASK-024` закрив local contract для path-based multi-patch website:
  - `configure-apache.php` генерує prefix-aware Apache config з `MW_BASE_URL` і дозволяє legacy website працювати під non-root base path;
  - `docker-compose.remote.multiroute.yml` описує окремі containers для `/classic`, `/tbc`, `/wotlk`, а legacy alias `/wotlk-azcore/` у поточному contract живе як redirect rule, а не як advertised fourth surface;
  - `shared_topnav` у всіх трьох patch templates і armory тепер містить patch switch links для фактично видимих `/classic/`, `/tbc/`, `/wotlk/`; локальний optional azcore-link prototype лишився лише implementation detail, а не current UX contract.
- `TASK-025` закрив live multiroute rollout на `workspace`:
  - root website і три prefixed services (`mangos-website-classic`, `mangos-website-tbc`, `mangos-website-wotlk`) зараз працюють одночасно, усі в `healthy`;
  - фінальний live image = `semorgana/mangos-website:task025a-cachebust-20260315` з digest `sha256:64710da58f68d726e2c5542ec065085456cb0a6c293760784c363d01f0a635a4`;
  - historical public matrix для цього rollout зійшовся: `/`, `/classic/`, `/tbc/`, `/wotlk/` = `200`; `/classic`, `/tbc`, `/wotlk` = `302` на trailing-slash URL; `/wotlk-azcore/` = `404`; hardened routes лишилися `403`;
  - Live Playwright DOM proof підтвердив, що `#shared_topnav` на `/`, `/classic/`, `/tbc/`, `/wotlk/` реально показує patch switch links, а на prefixed pages поточний link має `is-active`;
  - Classic і TBC website bootstrap доведено через `realm_settings` + `account_extend`; цей historical snapshot передував live AzerothCore rollout у `TASK-027`.
- `TASK-026` закрив website contract correction на `workspace`:
  - current live image = `semorgana/mangos-website:task026a-rootredirect-20260315` з digest `sha256:8a5b9033ae238c5e691b1123e08b6ef3f8d2880c996a4cb5d6215be9e9733413`;
  - root `mangos-website` більше не публікується Traefik-ом; public `/` і `/index.php` тепер дають `302` на `/classic/`;
  - live `.env.multiroute` і public UI contract не рекламують окремий `WotLK + ACore` пункт, тому `#shared_topnav` на `/`, `/classic/`, `/tbc/`, `/wotlk/` показує лише `/classic/`, `/tbc/`, `/wotlk/`;
  - browser proof після rollout підтвердив `#shared_topnav` height `45` на всіх public surfaces, а hardened routes лишилися `403`.
- `TASK-029` закрив residual website runtime defects на `workspace` і відновив public Armory + seeded website content:
  - live `prototype.js` restored on all prefixed surfaces, so `/classic|/tbc|/wotlk/js/compressed/prototype.js` now return `200`;
  - `armory/configuration/functions.php` і `armory/source/character-talents.php` повернуто до PHP 5.6-safe syntax без typed signatures, `??`, array destructuring та IIFE-style constructs, які валили live Armory;
  - deploy layer додатково виправлено image `semorgana/mangos-website:task029b-armoryrealmfix-20260315`, який на старті генерує `vanilla.spp` / `tbc.spp` / `wotlk.spp`, потрібні Armory bootstrap-у для `DefaultRealmName`;
  - verified bootstrap source з `localProjects/cmangos_projects/SPP_Classics_V2/SPP_Server/sql/{vanilla,tbc,wotlk}/armory.7z` імпортовано на remote runtime; `classicarmory`, `tbcarmory`, `wotlkarmory` тепер існують і містять populated `armory_titles`, `dbc_*`, `cache_*`, `armory_instance_*` tables;
  - public `/classic/armory/index.php`, `/tbc/armory/index.php`, `/wotlk/armory/index.php` тепер віддають `200` і реальний Armory HTML замість graceful `503` page;
  - expansion-specific `website.sql` + `website_news.sql` частково імпортовано в `classicrealmd`, `tbcrealmd`, `wotlkrealmd` safe-способом: forum/news seed tables (`f_*`) заповнені, а існуючі `website_*` compat views не зруйновано;
  - public frontpages `/classic/`, `/tbc/`, `/wotlk/` тепер показують seeded update/news entries (`Update 26.04.2023`, `Update 19.03.2023`, `Hotfix 28.09.2021`), тому surfaces більше не виглядають порожніми;
  - fresh browser audit `browser-audit/reports/20260315_202815/summary.json` зафіксував post-import baseline після повернення Armory/data layer: `pages_visited=30`, `actions_recorded=640`, `issues_total=73`, `issues_unexpected=69`.
- `TASK-030` змінив live website contract для user-facing forum/account surfaces:
  - `configure-apache.php`, `configure-app.php`, `mangos-website.conf` і `docker-compose.remote.multiroute.yml` переведено на env-driven public-route policy; `MW_ALLOW_FORUM_ROUTES=1`, `MW_ALLOW_ACCOUNT_ROUTES=1`, `MW_ENABLE_REGISTRATION=1` тепер увімкнені на live classic/tbc/wotlk services;
  - live image на `workspace` оновлено до `semorgana/mangos-website:task030b-registerassets-20260315`, який включає і route opening, і follow-up repair для registration template assets;
  - public routes `/classic|/tbc|/wotlk/index.php?n=forum` та `/classic|/tbc|/wotlk/index.php?n=account&sub=register` тепер віддають `200`, а `/classic/index.php?n=account&sub=manage` коректно веде в login flow замість web-layer `403`;
  - `browser-audit/reports/20260315_205236/pages.json` підтверджує, що forum/register seeds реально відвідалися зі status `200` і correct final URL/title на всіх трьох expansion surfaces;
  - після repair у `templates/offlike/account/account.register.php` нові register-page `404` на відсутні `frame-*.gif`/`pixel.gif` прибрано через real theme assets `ironframe-bg.jpg` і `pixel.gif`;
  - current post-open audit baseline = `browser-audit/reports/20260315_205236/summary.json`: `pages_visited=30`, `actions_recorded=1239`, `issues_total=295`, `issues_unexpected=295`; головний residual noise тепер зосереджений на legacy Armory JS errors (`armory_link is not defined`, `theBGcookie is not defined`), `#dummyLang` click timeout і legacy `server commands` CSS/MIME defect, а не на forum/account route blocking.
- Historical note: `TASK-031` did briefly exist as a local-only pre-rollout fix set, but it is no longer an active current-state item here because its live rollout and verification were closed by `TASK-032`, with later logged-in rendering coverage corrected by `TASK-033` and the auth-aware release gate added by `TASK-034`.

## Чого ще бракує

- Legacy optional-debt track is exhausted, but the canonical backlog is not globally complete: a new website identity/shared-account execution track is now queued as `TASK-066`.

## Активні блокери

Немає активних блокерів на AzerothCore co-located runtime path; `TASK-013` і `TASK-027` закриті live proof-ом від `2026-03-17`.

## Відомі ризики

- `workspace` фактично є єдиним відомим runtime-середовищем, тому будь-які зміни несуть підвищений ризик.
- `workspace` є shared host: окрім CMaNGOS там працюють сторонні контейнери `powerbot-*` і `traefik`.
- `daily-sync.sh` при `ensure_account()` копіює source `s/v` з Classic у target, якщо акаунт відсутній; отже для `samuel:samuel` критично, щоб target акаунт `SAMUEL` не був видалений до окремого вирівнювання source credentials.
- Деплой hash-fix не виправляє автоматично вже існуючі stale rows; для старих target-ів може знадобитися одноразовий hash realignment або clean resync.
- Legacy file `workspace:/opt/cmangos-transfer/logs/daily-sync-20260317.log` currently emits `tee: Permission denied` warnings for shell-driven runs; canonical per-run evidence logs still wrote successfully, but day-log ownership should be normalized in a later maintenance pass.
- Після `TASK-006` старі rows без `source_hash` автоматично не backfill-яться поза touched characters; перший run по старому персонажу піде як baseline-refresh sync, а не як immediate skip.
- Деструктивний cleanup `*.md` у `localProjects/` не повинен зачіпати markdown-и всередині upstream mirrors і `issues.wiki/`.
- AzerothCore Phase 16 поки що має лише локально описаний draft stack; live deploy path на `workspace` ще не перевірений.
- Official AzerothCore Docker workflow не дає явної multi-arch гарантії для published images, тому ARM64 rollout поки що слід планувати через local build path.
- `character_battleground_data` не має прямої цільової таблиці в AzerothCore; для MVP це або свідомий drop, або окремий mapping research.
- AzerothCore auth/account transform уже імплементований у `ensure_account()`, але весь Phase E/F шлях наразі validated лише локально і лише до рівня synthetic account staging + empty-realm auth smoke.
- `migrate_cmangos_wotlk_to_azerothcore.sql` і новий Phase E/F path ще не проганялися end-to-end на non-empty AzerothCore realm із реально перенесеним персонажем.
- Поточний AzerothCore SQL skeleton не сумісний з legacy full-replace branch у `transfer.sh`; подальша інтеграція має йти через AzerothCore-specific `safe_insert()` path.
- Поточний AzerothCore smoke доводить auth + world handshake + `CHAR_ENUM`, але ще не доводить повний player login після реальної character migration, бо realm поки порожній.
- `worldserver` після bot smoke інколи логуватиме `Addon packet read error`; станом на `TASK-011` це non-blocking noise, але не слід плутати його з acceptance-fail.
- `celguar/mangos-website` є legacy PHP surface з небезпечними зонами (`donate`, `admin`, `install`, `config`); після `TASK-030` user-facing `account` і `forum` surfaces уже відкриті публічно, але це все ще legacy app без сучасного hardening level trusted product.
- Website code очікує один base `realmd/auth` DB, але на `workspace` є три окремі `realmd` DB; тому public contract тепер canonicalize-ить користувача в patch-specific prefixed services замість окремого root surface.
- `docker-website/sql/public-site-compat.sql` покриває лише naming drift для public-mode MVP; навіть після відкриття forum/account routes legacy app потребує окремого security review, якщо ці surfaces колись плануватимуться як повноцінно trusted product.
- Upstream website intake не містив `js/compressed/prototype.js`; `TASK-029` повернув asset, і live runtime вже працює на fixed image.
- Live website на `workspace` тепер має canonical public redirect `/ -> /classic/` плюс patch-specific `/classic/`, `/tbc/`, `/wotlk/`; canonical `/wotlk/` already uses the live AzerothCore backend, а `/wotlk-azcore/` існує лише як `302` alias redirect на `/wotlk/`.
- Public HTTP smoke для цього домену слід запускати з локальної машини або браузера: `curl` з самого `workspace` може отримувати edge-level `403` від Cloudflare і давати хибний негатив.
- Після `TASK-027` public contract вирівняно остаточно: root canonical redirect-ить на `/classic/`, patch switcher не рекламує окремий `WotLK + ACore`, а canonical `/wotlk/` уже backed by live AzerothCore runtime.
- Live website runtime досі сидить на `php:5.6-apache`; будь-які modern PHP syntax changes у legacy app можуть зламати public Armory, якщо їх явно не перевіряти на цьому runtime.
- Armory XML compat redirects currently solve the public `404` regression, but they are only a compatibility bridge into the existing HTML Armory flow; the underlying legacy JS still references dead XML-era endpoints.
- Після `TASK-030` browser-audit noise вже не визначається forum/account web-layer blocking; `TASK-031` тепер локально закриває ще й Classic Armory achievements/schema mismatch, Auction House empty-state lie, register asset drift і blank class icon requests, але live residual baseline ще не перепідтверджено після rollout.
- Public forum/account/register pages тепер навмисно входять у verified contract для `/classic/`, `/tbc/`, `/wotlk/`, тоді як blocked/hardened surfaces зводяться до `admin`, `install`, `config` та інших явно non-public route-ів.
- Під час першого certificate issuance Cloudflare може коротко віддавати `526`, доки Traefik ще показує default self-signed cert; steady-state після issuance має бути `200/403`, а не `526`.
- `TASK-032` закрив live rollout `TASK-031` fix set + повну production readiness верифікацію:
  - live image оновлено до `semorgana/mangos-website:task032b-gmpfix-20260316`; додатково включено GMP extension (`libgmp-dev` + `gmp.h` symlink) для SRP6 auth;
  - Login SQL fix у `core/class.auth.php`: gmlevel merged у main SELECT, null-safety, activation_code guard; SRP6 login перевірено на всіх 3 expansions;
  - `armory/configuration/tooltipmgr.php`: empty-value SQL guards з `isset()`+`intval()`;
  - `armory/configuration/functions.php`: `databaseErrorHandler` тільки `error_log()` (без `exit`/`echo`);
  - expanded `TASK-031` fix set: Armory JS globals, Classic achievements guard, AH empty state, register assets, blank class icons;
  - static asset матриця Classic 17/17 = 200, TBC 15/15 = 200, WotLK 15/15 = 200; Armory resources 33 CSS/JS + 8 icons = all 200;
  - Playwright browser audit matrix: 18 pages, 0 issues, 0 unexpected;
  - form submission testing: login (all 3 expansions + error cases), registration flow, armory search/AJAX, account management = all correct responses;
  - PHP error logs: 0 errors across all 3 containers;
  - all 16 component sub-pages return proper responses; protected pages (`view`, `pms`) correctly require elevated permissions;
  - final external audit через Cloudflare: Classic 9/9 = 200, TBC spot checks = 200, WotLK spot checks = 200;
  - security gates: `/install/`, `/config/config.xml`, `/index.php?n=admin`, `/donate.php`, `/.git/` = all 403.
- Website на `world-of-warcraft.morgan-dev.com` тепер **production-ready**: zero broken endpoints, zero PHP errors, zero browser audit issues, all forms functional, all static assets loading, all expansion surfaces accessible externally.
- **TASK-033 HOTFIX**: TASK-032 верифікація тестувала тільки анонімний / curl-based доступ. Залогінені користувачі бачили повністю зламаний сайт — відсутній CSS, зображення, raw HTML.
  - Root cause: `account_extend` таблиця була пустою → `website_accounts` VIEW повертав NULL theme → `$currtmp2[NULL]` = `"templates/"` → 404 на всіх ресурсах.
  - Fix: fallback у `index.php` (L134-152) + seeding `account_extend` для всіх акаунтів.
  - Deployed image: `semorgana/mangos-website:task033-logintheme-20260316`.
  - Verified via curl login (Classic/TBC/WotLK = vanilla CSS ✓) + Playwright screenshot (SAMUEL in HTML, vanilla CSS present).
- **TASK-034** додав окремий auth render release gate, який реально перевіряє logged-in browser state на Classic/TBC/WotLK:
  - `auth_render_audit.py` логіниться через real cookies, відкриває logged-in frontpage у Chromium і валить gate, якщо зникає user marker, expected CSS path або з'являються broken `templates/css/` fragments;
  - verified report `browser-audit/reports/20260316_205454_auth/`: 3/3 checks passed, 0 failed resources, screenshots saved;
  - відтепер `production-ready` для website не можна claim-ити без цього auth gate.
- `TASK-042` refreshed the same logged-in render proof after the transfer UI landed: report `browser-audit/reports/20260316_233118_auth/` passed `3/3` checks on `classic`, `tbc`, and `wotlk`; one immediately prior run failed only on a transient TBC screenshot timeout and did not indicate a real page-render regression.
- **TASK-078/080/081/082** — Full Playwright release gate achieved:
  - TASK-078: Classic armory 500 fixed via `db_name_map` + `classicarmory` DB.
  - TASK-080: Audit harness fixes — HTML entity decoding, cookie expires filter, `domcontentloaded` wait for selectors, screenshot timeout 5s→15s.
  - TASK-081: WotLK armory 500 fixed via `MW_ARMORY_DB_NAME_MAP` + `wotlkarmory` DB (35 tables, MariaDB→MySQL 8 collation fix).
  - TASK-082: WotLK auth via AzerothCore SRP6 — virtual columns `s=UPPER(HEX(REVERSE(salt)))`, `v=UPPER(HEX(REVERSE(verifier)))` on `acore_auth.account` + `gmlevel` column + write grants for `mw_azerothcore_site` on `account_keys`/`website_account_keys`/`website_accounts`.
  - Final audit: `browser-audit/reports/20260322_103337/` — **`release_gate_passed: true`**, 18 pages, 3 auth checks, 0 issues.
  - Image: `semorgana/mangos-website:task080-081-fixes-20260322` deployed on all 3 containers.

## Відомі non-issues (verified, не потребують fix)

- 3 images (`box-jobs.gif`, `box-support.gif`, `chains-long.gif`) у frontpage template — знаходяться всередині HTML comments `<!-- -->`, browsers не завантажують їх.
- Armory AJAX item search без `realm` parameter повертає 500 — user-facing flow через `showResult()` завжди включає realm; не є bug.
- `account&sub=view` і `account&sub=pms` повертають "Forbidden" для non-admin users — by design, вимагають `g_view_profile` і `g_use_pm` permissions відповідно.
- Timezone warnings у `frontpage.index.php` lines 49,52 — cosmetic, не user-facing.

## Найближчі наступні кроки

1. Підтримувати `TASK-013` / `TASK-027` current live contract: canonical `/wotlk/` already sits on the AzerothCore backend, тому наступний practical focus не в окремому `/wotlk-azcore/` surface, а в тому, щоб document/test the required `acore_auth` website bootstrap and compatibility layer for future DB reset or redeploy.
2. Якщо account/forum surfaces мають лишатися довгостроково public, окремо провести security review legacy auth/forum flows замість повертатися до Apache-level blocking.
