# Гайд Продовження Роботи

Цей файл є гайдом відновлення роботи на новому пристрої або для нового агента.

## Стартова послідовність

1. Відкрий [`../AGENTS.md`](../AGENTS.md).
2. Перевір `gh`: `gh --version`, `gh auth status`.
3. Прочитай [`../workflow_config.md`](../workflow_config.md) і [`../remote_access.md`](../remote_access.md).
4. Переконайся, що `localProjects/cmangos_projects` все ще існує і містить legacy project workspace.
5. Прочитай обов'язкові docs у порядку з `AGENTS.md`.
6. Для transfer/runtime задач одразу відкрий [`TRANSFER_SYSTEM.md`](TRANSFER_SYSTEM.md).
7. Якщо потрібна детальна історія, відкрий:
   - [`LEGACY_AGENTS_ARCHIVE.md`](LEGACY_AGENTS_ARCHIVE.md)
   - [`LEGACY_BACKLOG_ARCHIVE.md`](LEGACY_BACKLOG_ARCHIVE.md)
   - [`LEGACY_SESSION_LOG_ARCHIVE.md`](LEGACY_SESSION_LOG_ARCHIVE.md)
   - [`COVERAGE.md`](COVERAGE.md)
   - [`USAGE_GUIDE_CLASSIC.md`](USAGE_GUIDE_CLASSIC.md)
8. Перевір у [`BACKLOG.md`](BACKLOG.md), що `TASK-001`…`TASK-012`, `TASK-017`, `TASK-021`, `TASK-022`, `TASK-023`, `TASK-024`, `TASK-025` і `TASK-026` завершені, після чого переходь до наступної відкритої задачі.
9. Якщо наступна задача торкається `workspace`, перед будь-якими remote-мутаціями live-перевір SSH ControlMaster і runtime.

## Як читати migrated docs

- Канонічний стан живе в поточних `PROJECT_STATUS`, `ARCHITECTURE`, `BACKLOG`, `DECISIONS`, `COMMANDS_REFERENCE`.
- `TRANSFER_SYSTEM.md` є project-specific operational doc і його слід вважати обов'язковим для всіх transfer / login bot / SQL задач.
- Legacy archive docs потрібні для глибокої історії або коли треба відновити rationale старих фаз без перегляду chat history.

## Поточний Verified Baseline

- Docs migration, live runtime validation і вся `Phase 15` уже завершені.
- Поточний verified pipeline: `Classic → TBC verify → WotLK verify`.
- Кодова інтеграція `WotLK → AzerothCore` уже вбудована в `daily-sync.sh`, але вона вмикається лише коли існують локальні `azerothcore-db`, `azerothcore-authserver`, `azerothcore-worldserver`.
- Verified coverage вже є для:
  - single-account happy path
  - multi-account `SYNC / SKIP / AUTO-CREATE`
  - class coverage на Warlock / Warrior / Hunter
  - 3-run stability (`Run 1 sync`, `Run 2 unchanged skip`, `Run 3 changed-char sync`)
- `daily-sync.sh` тепер використовує dual-baseline change detection:
  - `sync_hash` = verified target state
  - `source_hash` = source state, з якого цей target останній раз успішно синхронізовано
- Canonical runtime config лишається `/opt/cmangos-transfer/sync-accounts.conf` з `samuel:samuel`; scenario-specific fixtures живуть в окремих `sync-accounts.task004/005/006.conf`.
- `TASK-017` уже закрив локальний legacy-website baseline:
  - upstream `celguar/mangos-website` закріплено на commit `9c9582c`;
  - hardened deploy layer живе в `localProjects/cmangos_projects/docker-website/`;
  - first live contract = `WotLK-first public mode`, бо `workspace` не має одного shared `realmd`, а має три ізольовані expansion-specific DB.
- `TASK-021` уже закрив live website rollout:
  - `world-of-warcraft.morgan-dev.com` віддається через shared `traefik` на `workspace`;
  - runtime живе в `workspace:/opt/mangos-website/`;
  - base DB contract лишається `WotLK-first` через `wotlkrealmd` і Docker network `cmangos-wotlk-net`;
  - public-mode hardening реально перевірено зовні: `/` = `200`, `install/admin/donate` = `403`.
- `TASK-023` уже закрив browser-level QA harness для website:
  - Playwright/Chromium runner живе в `localProjects/cmangos_projects/docker-website/browser-audit/`;
  - baseline report `reports/20260315_092632/` уже зафіксував `pages_visited=30`, `actions_recorded=477`, `issues_unexpected=205`;
  - головний повторюваний finding зараз = same-origin `404` на `/js/compressed/prototype.js`, а blocked `403` surfaces теж видно в consolidated report.
- `TASK-024` уже закрив local contract для multi-patch website entrypoints:
  - deploy layer тепер path-prefix-aware через `configure-apache.php` + `MW_BASE_URL`;
  - у `shared_topnav` локально було доведено patch switcher logic для `/classic/`, `/tbc/`, `/wotlk/` і optional `/wotlk-azcore/` variant;
  - multiroute runtime skeleton живе в `localProjects/cmangos_projects/docker-website/docker-compose.remote.multiroute.yml`;
  - це був local contract, який далі став базою для live rollout.
- `TASK-025` уже закрив live single-domain multiroute rollout:
  - `world-of-warcraft.morgan-dev.com/classic/`, `/tbc/`, `/wotlk/` реально live на `workspace`;
  - root `/` після цього ще лишався окремим surface і був виправлений уже в `TASK-026`;
  - `/wotlk-azcore/` після цього ще рекламувався в `shared_topnav`, але був захований уже в `TASK-026`;
  - final live image = `semorgana/mangos-website:task025a-cachebust-20260315`.
- `TASK-026` уже закрив website contract correction:
  - public `/` і `/index.php` canonical redirect-ять на `/classic/`;
  - public topnav на `/`, `/classic/`, `/tbc/`, `/wotlk/` тепер має box height `45` і показує лише `/classic/`, `/tbc/`, `/wotlk/`;
  - `MW_ENABLE_AZCORE_LINK=0` у live `.env.multiroute` ховає `WotLK + ACore`, доки на `workspace` нема real AzerothCore website runtime;
  - current live image = `semorgana/mangos-website:task026a-rootredirect-20260315`.
- `TASK-008` уже додав локальний draft stack у `localProjects/cmangos_projects/docker-azerothcore/` і зафіксував ARM64-safe baseline як local build з `azerothcore-wotlk`.
- `TASK-009` already compared live `wotlkcharacters/wotlkrealmd` against official AzerothCore base SQL and зафіксував mapping у [`AZEROTHCORE_SCHEMA_MAPPING.md`](AZEROTHCORE_SCHEMA_MAPPING.md).
- `TASK-010` already created [`../localProjects/cmangos_projects/transfer/migrate_cmangos_wotlk_to_azerothcore.sql`](../localProjects/cmangos_projects/transfer/migrate_cmangos_wotlk_to_azerothcore.sql) як first executable temp-DB migration skeleton і validated його локально на throwaway `mariadb:11` поверх read-only `wotlkcharacters --no-data` dump.
- `TASK-011` уже live-verified локальний AzerothCore stack: full local build пройшов, `authserver/worldserver/db` піднялись на `3727/8088/3309/7879`, а `wow_login_test_universal.py` тепер підтримує `--expansion azerothcore`.
- Для AzerothCore auth staging тепер є verified contract: CMaNGOS `s/v` треба писати як `REVERSE(UNHEX(LPAD(...)))` у `salt/verifier`; прямий `UNHEX(...)` не проходить SRP6 auth proof.
- `TASK-012` уже вбудував Phase E/F у `daily-sync.sh` і `lib.sh`, локально validated synthetic account staging у `acore_auth.account/account_access` і виправив parsing bug для порожнього source `sessionkey`.
- Live AzerothCore deploy на `workspace` ще не робився; поточний verified path лишається локальним.
- Основний відкритий technical track лишається `TASK-013` (Phase 16.6, повний 4-step E2E).

## Критичні технічні деталі

- Основний runtime host: `workspace` (`64.181.205.211`), доступ через YubiKey-backed SSH alias.
- Рекомендований path: ControlMaster на `/tmp/ssh-ws`.
- Основні remote paths:
  - `/opt/cmangos-classic/`
  - `/opt/cmangos-tbc/`
  - `/opt/cmangos-wotlk/`
  - `/opt/cmangos-transfer/`
- Legacy website deploy artifacts живуть у `localProjects/cmangos_projects/docker-website/`; live runtime лежить у `workspace:/opt/mangos-website/`, де root використовує `docker-compose.yml`, а prefixed routes використовують `docker-compose.multiroute.yml`.
- Browser audit harness і path-prefix deploy layer теж живуть у `localProjects/cmangos_projects/docker-website/`; live website на `workspace` canonical redirect-ить public root на `/classic/`, реально має `/classic/` + `/tbc/` + `/wotlk/`, а після `TASK-027` canonical `/wotlk/` уже працює на AzerothCore backend, тоді як `/wotlk-azcore/` використовується лише як redirect alias на `/wotlk/`.
- Для public HTTP smoke по `world-of-warcraft.morgan-dev.com` покладайся на локальну машину або браузер, а не на `curl` із самого `workspace`: Cloudflare edge може віддати `403` server-origin request-ам.
- Нема окремого staging/prod split; тому будь-яка remote зміна є high-risk.
- Website live path already uses Cloudflare-proxied HTTPS через `traefik`; короткий `526` під час первинного ACME issuance є допустимим transient, але steady-state gate має бути `HTTP 200`.
- Поточний backlog після legacy phases 0–15 має live website runtime плюс відкритий Phase 16 AzerothCore / optional Phase 17 stream.

## Правило нової машини

Після перенесення на новий комп'ютер:

- онови [`../workflow_config.md`](../workflow_config.md) новим `MACHINE_LABEL`, tool status і local facts;
- перевір, що `ssh -G workspace` все ще резолвиться коректно;
- онови [`../remote_access.md`](../remote_access.md), якщо змінилися alias, user або auth path;
- не покладайся на стару chat history;
- якщо нова машина не має YubiKey / SSH alias, зафіксуй це як blocker і не імпровізуй remote steps.

## Відновлення ролі

Перед claim задачі підтвердь:

- активний developer name;
- активну роль;
- machine label;
- чи дозволяє модульна карта цю роботу;
- чи потрібен explicit user approval для planned step.

## Відновлення паралельної роботи

1. Відкрий [`MODULES.md`](MODULES.md).
2. Відкрий [`BACKLOG.md`](BACKLOG.md).
3. Перевір active tasks і їхній `lock scope`.
4. Якщо задача торкається `workspace`, вважай її non-parallel-safe, доки не доведено протилежне.
5. Claim task до будь-якого редагування або remote-команди.

## Cleanup note

- Legacy project-owned markdown у `localProjects/cmangos_projects` міг бути очищений після міграції в root docs.
- Upstream/vendor markdown у `issues.wiki/`, `mangos-classic/`, `spp-classics-cmangos/` навмисно не видаляються автоматично.
