# Рішення

Використовуй цей файл для довговічних виборів, які мають пережити reset чату та зміну команди.

## Журнал рішень

### `DEC-001` — `2026-03-14` — `Root template docs are the canonical workflow`

- Status: `accepted`
- Контекст:
  - Legacy CMaNGOS project already мав власний workflow і docs, але новий переносимий template має стати єдиною стартовою точкою для наступних агентів.
- Рішення:
  - Канонічний workflow-control-plane тепер живе в корені цього workspace: `workflow_config.md`, `remote_access.md`, `docs/`.
  - Legacy markdown із `localProjects/cmangos_projects` вважається джерелом міграції, а не новим каноном.
- Наслідки:
  - Усі майбутні continuation cycles починаються з root template.
  - Після успішної міграції project-owned legacy markdown можна прибирати.
- Пов'язані backlog items:
  - `TASK-001`

### `DEC-002` — `2026-03-14` — `Preserve unique legacy docs inside root docs instead of dropping them`

- Status: `accepted`
- Контекст:
  - У legacy workspace були специфічні документи, яких template не мав: `TRANSFER_SYSTEM.md`, `usage-guide.md`, `coverage.md`, деталізований `backlog.md`, старий session log.
- Рішення:
  - Унікальні артефакти зберігаються в `docs/` як окремі migrated documents або архіви.
  - Канонічні файли (`PROJECT_STATUS`, `ARCHITECTURE`, `BACKLOG`, `CONTINUATION_GUIDE`, `COMMANDS_REFERENCE`) вбирають їхній зміст на operational level.
- Наслідки:
  - Нічого цінного з legacy docs не губиться.
  - Новий агент має один каталог docs, але за потреби може піти глибше в архіви.
- Пов'язані backlog items:
  - `TASK-001`

### `DEC-003` — `2026-03-14` — `Cleanup excludes upstream and vendor markdown`

- Status: `accepted`
- Контекст:
  - Користувацький запит дозволяє видалити markdown у `localProjects/` після міграції docs, але всередині `localProjects/cmangos_projects` лежать також upstream mirrors і wiki-матеріали.
- Рішення:
  - Під cleanup потрапляють лише project-owned migrated markdown у корені `localProjects/cmangos_projects` і його legacy `docs/`.
  - Markdown у `issues.wiki/`, `mangos-classic/`, `spp-classics-cmangos/` та інших upstream/vendor піддеревах не видаляються автоматично.
- Наслідки:
  - Workflow-doc cleanup не руйнує reference materials і cloned repos.
  - Якщо знадобиться повний recursive markdown purge, це має бути окрема явна задача.
- Пов'язані backlog items:
  - `TASK-001`

### `DEC-004` — `2026-03-14` — `workspace via SSH alias and ControlMaster is the primary runtime access path`

- Status: `accepted`
- Контекст:
  - Уся documented runtime work прив'язана до віддаленого хоста `workspace` з YubiKey-auth і multiplexed SSH session.
- Рішення:
  - Стандартний шлях доступу до runtime: `ssh -o ControlMaster=yes -o ControlPath=/tmp/ssh-ws -o ControlPersist=600 -N workspace`, далі всі команди через `-o ControlPath=/tmp/ssh-ws`.
- Наслідки:
  - Документація команд, continuation steps і remote_access використовують один і той самий access pattern.
  - Перший connect залежить від YubiKey touch.
- Пов'язані backlog items:
  - `TASK-002`

### `DEC-005` — `2026-03-14` — `Sequential login-verified pipeline is the supported transfer model`

- Status: `accepted`
- Контекст:
  - Простий SQL copy між експансіями не гарантує безпечне завантаження персонажа; саме тому legacy work перейшла до verify між кроками.
- Рішення:
  - Підтримуваний pipeline: `Classic → TBC (login verify / normalize) → WotLK (login verify / normalize)`.
  - Дані для наступного кроку беруться після verify та server-side normalization на попередньому кроці.
- Наслідки:
  - Login bot стає обов'язковим operational gate, а не опціональною утилітою.
  - Phase 15 E2E/stabilization перевіряє саме цю модель.
- Пов'язані backlog items:
  - `TASK-003`
  - `TASK-004`
  - `TASK-006`

### `DEC-006` — `2026-03-14` — `WotLK crash is mitigated by data-level achievement progress pre-insert`

- Status: `accepted`
- Контекст:
  - Legacy investigation виявила WotLK bug: `SetMoney()` під час `Player::LoadFromDB()` викликається до `SetMap()`, що через achievement criteria може падати з `MANGOS_ASSERT(m_currMap)`.
- Рішення:
  - Для transfer на WotLK використовується workaround: pre-insert у `character_achievement_progress` для criteria `4224` з counter не меншим за `money`.
- Наслідки:
  - Fix живе на data / migration layer, а не в forked C++ core.
  - Нові WotLK transfer/regression tasks повинні перевіряти, що цей workaround збережено.
- Пов'язані backlog items:
  - `TASK-HIST-003`
  - `TASK-003`

### `DEC-007` — `2026-03-14` — `Scenario-specific daily-sync tests use temporary SYNC_CONF, not the canonical config`

- Status: `accepted`
- Контекст:
  - `TASK-003` нормалізував canonical remote config до single-account `samuel:samuel`, але `TASK-004` потребував окремого multi-account non-admin набору без псування цього базового runtime state.
- Рішення:
  - Усі scenario-specific daily-sync regression runs виконуються через `SYNC_CONF=/opt/cmangos-transfer/<scenario>.conf`.
  - Canonical `/opt/cmangos-transfer/sync-accounts.conf` не переписується під test fixtures, якщо цього прямо не вимагає окрема задача.
- Наслідки:
  - Happy-path single-account config лишається стабільною operational baseline.
  - Multi-account та stability сценарії можна повторювати окремими temp config-файлами без config drift у production-shaped runtime.
- Пов'язані backlog items:
  - `TASK-004`
  - `TASK-006`

### `DEC-008` — `2026-03-14` — `Verify loops absorb transient startup noise and WotLK CHAR_ENUM parsing must include customize flags`

- Status: `accepted`
- Контекст:
  - `TASK-005` виявив два false-negative джерела, які не були реальними data failures:
    - перший login verify одразу після TBC restart міг падати, хоча повторна спроба проходила;
    - `wow_login_test_universal.py` на WotLK не враховував 4-byte `customize flags` у `SMSG_CHAR_ENUM`, через що другий персонаж на multi-character account хибно отримував `NOT_FOUND`.
- Рішення:
  - `daily-sync.sh` перед rollback робить один retry verify.
  - `wow_login_test_universal.py` для WotLK пропускає `customize flags` після `charFlags`.
  - Manual smoke logins для одного realm/account виконуються послідовно, не паралельно.
- Наслідки:
  - Verify path менше схильний до хибних rollback-ів після restart.
  - Multi-character WotLK accounts більше не дають parser-induced `NOT_FOUND`.
  - Future stability runs повинні враховувати ці правила як частину expected baseline.
- Пов'язані backlog items:
  - `TASK-005`
  - `TASK-006`

### `DEC-009` — `2026-03-15` — `Daily sync change detection uses a dual baseline: target sync_hash plus source_hash`

- Status: `accepted`
- Контекст:
  - Legacy Phase 15.4 вимагала `Run 2 = SKIP if unchanged` і `Run 3 = SYNC if source changed`, але фактичний код до `TASK-006` зберігав only target-side hash і тому вмів лише `SKIP if played on target`.
- Рішення:
  - `character_sync_hash` тепер зберігає два fingerprints:
    - `sync_hash` = post-verify target state
    - `source_hash` = source state, з якого цей target був останній раз успішно синхронізований
  - Skip/sync rules:
    - `current target != sync_hash` → `SKIP` як `played on target`
    - `current target == sync_hash` і `current source == source_hash` → `SKIP` як `unchanged since last verified sync`
    - інакше → `SYNC`
  - Schema migration робиться lazy через `ensure_sync_table()`: старі rows без `source_hash` не ламаються, але перший run після deploy refresh-ить baseline замість immediate skip.
- Наслідки:
  - `TASK-006` three-run stability тепер реально відповідає legacy acceptance, а не емулюється штучними fixture drift-ами.
  - `Skipped` у summary більше означає два легітимні стани: `unchanged` або `played`.
  - Для historical rows без `source_hash` перший rerun може бути sync-only baseline refresh; це expected bootstrap behavior.
- Пов'язані backlog items:
  - `TASK-006`

### `DEC-010` — `2026-03-15` — `ARM64 AzerothCore baseline uses the official build-capable source tree, not assumed prebuilt images`

- Status: `accepted`
- Контекст:
  - `TASK-008` вимагав підготувати базовий AzerothCore runtime для майбутнього 4-step pipeline на ARM64-середовищі.
  - Official deployment split існує у двох формах:
    - `azerothcore/acore-docker` як найшвидший prebuilt-image compose path
    - `azerothcore/azerothcore-wotlk` як official source tree з build-capable `docker-compose.yml` і Dockerfile targets
  - Огляд official Docker workflow не показав явного `platforms:` matrix для published images, тому prebuilt `acore/*` images не слід трактувати як already-verified ARM64 baseline без окремого підтвердження manifests.
- Рішення:
  - Phase 16 baseline фіксується так:
    - локальний draft stack живе в `localProjects/cmangos_projects/docker-azerothcore/`;
    - preferred path на ARM64 = клонувати `azerothcore-wotlk` поруч із draft stack і запускати `docker compose up -d --build`;
    - `acore-docker` лишається корисним reference/prebuilt path для known-compatible середовищ або після окремої перевірки image manifests.
- Наслідки:
  - Container/runtime planning для Phase 16.2+ більше не залежить від припущення, що public images already multi-arch.
  - `TASK-008` можна вважати закритим без live deploy на `workspace`, бо container baseline вже задокументований і локально перевірений через `docker compose config`.
  - Майбутній live AzerothCore deploy, якщо знадобиться, має окремо врахувати shared-host ризики `workspace`.
- Пов'язані backlog items:
  - `TASK-008`
  - `TASK-009`

### `DEC-011` — `2026-03-15` — `AzerothCore migration will be hybrid: safe_insert for compatible tables, explicit transforms for auth and non-1:1 character tables`

- Status: `accepted`
- Контекст:
  - `TASK-009` порівняв live `wotlkcharacters/wotlkrealmd` schema з official AzerothCore base SQL.
  - Результат показав, що current `transfer.sh` table-set не потребує тотального rewrite:
    - `45` релевантних pipeline tables
    - `43` already exist in AzerothCore with the same table name
    - `1` rename (`character_tutorial -> account_tutorial`)
    - `1` missing target table (`character_battleground_data`)
  - Водночас кілька таблиць мають semantic drift, який `safe_insert` не покриє:
    - `account` / `account_access`
    - `characters`
    - `character_homebind`
    - `character_spell`
    - `character_talent`
    - `character_glyphs`
    - `character_queststatus`
    - `character_aura`
    - `pet_aura`
    - `guild_member`
- Рішення:
  - `TASK-010` не будується як blind full-schema copy.
  - Базовий підхід для AzerothCore step:
    - reuse current `safe_insert()` for same-name tables with additive/defaultable drift;
    - add explicit pre/post transforms for auth, main character row, talent/glyph state, quest rewarded state, aura state, tutorial rename and guild withdraw split;
    - treat `character_battleground_data` as explicit policy choice, not implicit carry-over.
- Наслідки:
  - Existing CMaNGOS transfer pipeline architecture зберігається як foundation, а не викидається.
  - Найбільший blocker тепер не “всі таблиці різні”, а невеликий список high-impact transforms.
  - Current helpers for CMaNGOS auth (`srp6_set_password.py`, `ensure_account()`) не можна reuse для AzerothCore без schema-aware adaptation.
- Пов'язані backlog items:
  - `TASK-009`
  - `TASK-010`
  - `TASK-011`

### `DEC-012` — `2026-03-15` — `AzerothCore migration SQL is temp-db + safe_insert only; full DB replace stays unsupported`

- Status: `accepted`
- Контекст:
  - `TASK-010` створив `transfer/migrate_cmangos_wotlk_to_azerothcore.sql` як перший executable skeleton для `cmangos-wotlk -> AzerothCore`.
  - На відміну від legacy CMaNGOS-to-CMaNGOS steps, AzerothCore має значний набір target-only tables і split tables (`account_tutorial`, `character_queststatus_rewarded`, `guild_member_withdraw`), які не можна безпечно втрачати при повному перезаписі target schema.
  - Локальна валідація показала, що migration SQL успішно працює на temp DB, коли source schema береться як `wotlkcharacters --no-data`, але це все ще preparation step, а не готовий runtime deploy.
- Рішення:
  - `migrate_cmangos_wotlk_to_azerothcore.sql` вважається temp-DB transform script, який має працювати тільки перед `safe_insert()` у pre-existing AzerothCore characters DB.
  - Legacy full-replace branch з `transfer.sh` не переноситься на AzerothCore.
  - У самому SQL file дозволені explicit MVP policies замість вигаданої 1:1 сумісності:
    - `character_talent` лишається reset-on-login blocker;
    - auth/account path оформлено як staged contract, а не executable частину characters migration;
    - `character_battleground_data` свідомо не переноситься в MVP.
- Наслідки:
  - `TASK-012` мусить додати AzerothCore-specific merge path, а не просто підставити новий `migrate_*.sql` у старий full-copy flow.
  - `TASK-011` і подальший E2E мають перевіряти не лише SQL execution, а й те, що login verify нормально переживає ці MVP assumptions.
  - Всі майбутні агенти повинні читати `migrate_cmangos_wotlk_to_azerothcore.sql` як controlled skeleton, а не як доказ, що schema parity already solved.
- Пов'язані backlog items:
  - `TASK-010`
  - `TASK-011`
  - `TASK-012`

### `DEC-013` — `2026-03-15` — `AzerothCore login support reuses WotLK protocol with realmlist realm_id, and CMaNGOS s/v must be byte-reversed for auth staging`

- Status: `accepted`
- Контекст:
  - `TASK-011` підняв локальний AzerothCore stack і перевірив, чи current `wow_login_test_universal.py` already compatible з auth/world path.
  - Initial failures показали два окремі assumption drifts:
    - direct CMaNGOS-style `s/v` insert у `salt/verifier` ламав SRP6 auth proof (`0x04`);
    - після виправлення verifier bot усе ще падав на world auth, якщо відправляв hardcoded `realm_id=0` (`0x27`).
- Рішення:
  - Для AzerothCore login bot reused WotLK wire protocol:
    - same build/auth/world crypt assumptions as `wotlk`
    - but `AUTH_SESSION.realmId` must be the actual `realm_id` returned by auth realmlist
  - У `wow_login_test_universal.py` додається explicit `azerothcore` alias з local defaults `3727/8088` і auto-selected `realm_id`.
  - Для auth staging CMaNGOS source values мапляться так:
    - `salt = REVERSE(UNHEX(LPAD(s, 64, '0')))`
    - `verifier = REVERSE(UNHEX(LPAD(v, 64, '0')))`
- Наслідки:
  - `TASK-012` може будувати AzerothCore auth integration без вимоги plaintext password, якщо source `s/v` присутні.
  - Empty AzerothCore realm smoke з `AUTH_OK + CHAR_ENUM + RESULT: NOT_FOUND` тепер є прийнятним Phase 16 gate, а не failure.
  - SQL/doc comments, які припускали direct raw `UNHEX(s/v)`, вважаються застарілими і мають бути замінені.
- Пов'язані backlog items:
  - `TASK-011`
  - `TASK-012`

### `DEC-014` — `2026-03-15` — `AzerothCore daily-sync phases stay runtime-gated, and auth staging must use schema-aware account parsing instead of raw tab-splitting`

- Status: `accepted`
- Контекст:
  - `TASK-012` інтегрував AzerothCore у `daily-sync.sh`, але не кожне середовище має локальні `azerothcore-*` контейнери поряд із CMaNGOS runtime.
  - Під час live validation synthetic `wotlk -> azerothcore` account staging з'ясувалося, що старий shell-парсинг source row через tab-delimited `read` ламається на порожньому `sessionkey` і зсуває `joindate`, `lockedIp`, `os`, `flags`.
  - Для проекту важливо не зламати verified 3-step pipeline на хостах, де AzerothCore ще не розгорнутий.
- Рішення:
  - `daily-sync.sh` вмикає Phase E/F лише якщо одночасно існують `azerothcore-db`, `azerothcore-authserver`, `azerothcore-worldserver`.
  - Якщо AzerothCore runtime відсутній, script лишається на поточному 3-step path без fallback guesswork.
  - `ensure_account()` для AzerothCore не покладається на raw tab-splitting source SQL row; замість цього source fields серіалізуються через explicit non-whitespace delimiter, який зберігає порожній `sessionkey` без column drift.
  - Schema-aware auth staging у `acore_auth.account` + `account_access` є канонічним шляхом; legacy `transfer.sh` full-replace branch для цього не використовується.
- Наслідки:
  - Локальні й remote середовища можуть мати різну глибину Phase 16 readiness, не ламаючи один одному pipeline.
  - Після `TASK-012` verified scope включає code wiring + account staging + empty-realm auth smoke, але не повний post-migration player login.
  - `TASK-013` залишається обов'язковим, бо саме він має довести реальний 4-step E2E на non-empty AzerothCore realm.
- Пов'язані backlog items:
  - `TASK-012`
  - `TASK-013`

### `DEC-015` — `2026-03-15` — `Legacy website MVP stays an isolated public-mode container behind Traefik, with WotLK-first DB contract`

- Status: `accepted`
- Контекст:
  - Користувач змістив продуктову ідею з умовного dashboard до реального WoW website на домені `world-of-warcraft.morgan-dev.com`.
  - Upstream `celguar/mangos-website` є legacy PHP application з ризиковими surfaces (`donate`, `admin`, `account`, `forum`, `install`, raw `mysql_*`, `unserialize`, shell exec path), тому її не можна ставити як trusted peer до основного runtime.
  - Live topology на `workspace` already має shared `traefik`, але не має одного shared `realmd/auth` DB: Classic, TBC і WotLK живуть у трьох ізольованих expansion-specific DB.
- Рішення:
  - Website живе лише в окремому контейнері за `traefik`; public web surface ізольовано від основних game/runtime контейнерів окремим deploy unit.
  - Verified MVP = public-mode only:
    - deny `donate`, `admin`, `account`, `forum`, `install`, `config` на web layer;
    - не вважати forum/account/admin functionality частиною trusted baseline.
  - First live deploy contract фіксується як `WotLK-first`: сайт читає один base DB (`wotlkrealmd`) через external Docker network `cmangos-wotlk-net`, а не імітує multi-expansion aggregation.
  - Канонічний live rollout спирається на image-only manifest `docker-compose.remote.yml` за `traefik`; local publication target, якщо знадобиться push, може використовувати Docker Hub namespace `semorgana`.
  - DB bootstrap policy для MVP: спочатку upstream `install/sql/full_install.sql`, потім `docker-website/sql/public-site-compat.sql`.
- Наслідки:
  - `TASK-017` можна вважати закритим локально без remote мутацій, бо container boundary, compose contract і local smoke вже verified.
  - Будь-який shared-host website rollout або наступна live-mutation цього stack-а вимагає explicit user approval.
  - Якщо в майбутньому потрібні real account/forum/admin flows, це вже окрема security/re-architecture задача, а не extension current MVP.
- Пов'язані backlog items:
  - `TASK-017`
  - `TASK-021`

### `DEC-016` — `2026-03-15` — `Legacy website live runtime prefers daemon-compatible writable in-container state over read-only+volume hardening`

- Status: `accepted`
- Контекст:
  - Під час першого live deploy `TASK-021` на `workspace` container boundary вже була коректною, але runtime схема `read_only rootfs + named volume /var/www/runtime` виявилась несумісною з поточним remote Docker daemon.
  - Фактичний failure mode: `install` і навіть подальший `chmod` на mounted runtime path падали з `Operation not permitted`, через що container безкінечно рестартував попри валідний image і compose wiring.
  - При цьому базова security-мета задачі була не immutable filesystem за будь-яку ціну, а ізоляція risky legacy PHP app в окремому container/service boundary за `traefik`.
- Рішення:
  - Канонічний live runtime для `mangos-website` переходить на writable in-container `/var/www/runtime` без named volume і без `read_only: true`.
  - Public-mode restrictions, окремий container, окремий deploy dir `/opt/mangos-website`, окремий image tag і HTTP deny rules лишаються обов'язковими.
  - Future hardening changes можна повертати лише після доказу сумісності саме з current remote daemon, а не лише з local Docker Desktop.
- Наслідки:
  - `TASK-021` отримав working live deploy без зміни WotLK-first DB contract або відкриття risky website surfaces.
  - `localProjects/cmangos_projects/docker-website/` і docs більше не повинні описувати volume-based runtime як current verified state.
  - Наступні агенти не повинні реінтродукувати `read_only + /var/www/runtime volume` без окремого compatibility proof.
- Пов'язані backlog items:
  - `TASK-021`

### `DEC-017` — `2026-03-15` — `Legacy website deploy layer must self-heal the WotLK theme path case mismatch`

- Status: `accepted`
- Контекст:
  - `TASK-022` показав, що legacy website HTML масово посилається на `templates/wotlk/*`, але upstream asset tree фізично лежить у `templates/WotLK`.
  - На Linux case-sensitive filesystem це не cosmetic drift, а реальний live failure mode: CSS, JS і theme images йдуть у `404`, і homepage деградує в unstyled HTML.
  - Просто змінити `default_template` недостатньо, бо частина legacy template files hardcode-ить lowercase `templates/wotlk/...` paths.
- Рішення:
  - Поточний verified deploy contract для website image зобов'язаний забезпечувати alias `templates/wotlk -> WotLK`.
  - Alias тримається і в build step (`Dockerfile`), і як idempotent self-heal у `docker-entrypoint`, щоб recreate container-а не повертав broken state.
  - Це вважається частиною deploy layer, а не ad-hoc ручним hotfix всередині running container.
- Наслідки:
  - Current live image `semorgana/mangos-website:task022-themefix-20260315` є першим verified tag після усунення цього case-sensitive drift.
  - Наступні агенти не повинні “лікувати” homepage через ручний `docker exec ln -s ...` як постійне рішення; правильний шлях = image/deploy layer.
  - Residual `prototype.js` absence не слід змішувати з цією проблемою: це окремий upstream JS debt, а не причина broken theme render.
- Пов'язані backlog items:
  - `TASK-022`

### `DEC-018` — `2026-03-15` — `Legacy website regressions are tracked with a real Chromium audit harness, not only curl-level smoke`

- Status: `accepted`
- Контекст:
  - Після `TASK-021`/`TASK-022` сайт уже віддавав `HTTP 200` і правильні theme assets, але цього недостатньо для виявлення runtime/client-side regressions на legacy PHP surface.
  - Користувач окремо попросив систему на кшталт Playwright, яка реально відкриває live сайт у Chromium, проходить доступні UI actions і збирає помилки в одному місці.
- Рішення:
  - Канонічний website QA path для UI/runtime regressions = isolated Playwright/Chromium harness у `localProjects/cmangos_projects/docker-website/browser-audit/`.
  - Кожен run пише machine-readable і human-readable artifacts у `reports/<timestamp>/`, включно з `summary.json`, `issues.json`, action trail і screenshots.
  - Базовий policy safe-by-default:
    - same-origin navigation проходиться автоматично;
    - visible button-like / hover-driven actions відкриваються в fresh page;
    - POST submits не робляться автоматично, а лише логуються як skipped unless explicitly enabled.
- Наслідки:
  - Website quality більше не оцінюється лише по `curl -I` і випадковому manual browse.
  - Consolidated report стає канонічним місцем для черги website bugfixes.
  - Очікувані security `403` routes можуть з'являтися в audit artifacts, але їх треба інтерпретувати окремо від реальних unexpected regressions.
- Пов'язані backlog items:
  - `TASK-023`

### `DEC-019` — `2026-03-15` — `Patch-specific website surfaces use one domain with path prefixes, and patch switching lives inside shared_topnav`

- Status: `accepted`
- Контекст:
  - Website intake має окремі дизайни під кілька WoW patches, але користувач не хоче підтримувати чотири субдомени.
  - Користувач явно уточнив desired UX contract: patch transitions мають жити в `div#shared_topnav`.
  - Local proof показав, що legacy website code вже достатньо path-aware, якщо deploy layer правильно задає `MW_BASE_URL` і web server serving rules.
- Рішення:
  - Канонічний routing contract для patch-specific website surfaces = один домен `world-of-warcraft.morgan-dev.com` з path prefixes:
    - `/classic/`
    - `/tbc/`
    - `/wotlk/`
    - `/wotlk-azcore/`
  - Patch switcher рендериться всередині `#shared_topnav` у patch templates і Armory topnav code.
  - Runtime topology для цього contract = окремі website containers/services за path-prefix routing у Traefik, а не strip-prefix hacks усередині одного container-а.
  - Prefix-aware serving генерується з `MW_BASE_URL` через `configure-apache.php`.
- Наслідки:
  - Base-path compatibility більше не є blocker; verified blocker лишається тільки live rollout/operations on shared host.
  - Current live root website на `workspace` може співіснувати з майбутніми prefixed routers, не вимагаючи одразу чотирьох субдоменів.
  - Shared-host rollout цього multiroute contract лишається окремою approval-gated infra задачею.
- Пов'язані backlog items:
  - `TASK-024`
  - `TASK-025`

### `DEC-020` — `2026-03-15` — `Live multiroute website keeps slash-normalized Classic/TBC/WotLK surfaces, while the AzerothCore website path must never be advertised dishonestly`

- Status: `accepted`, partially superseded by live `TASK-027` repair on `2026-03-18`
- Контекст:
  - Після `DEC-019` користувач надав explicit approval для shared-host rollout, і path-prefix topology була реально викочена на `workspace`.
  - У процесі rollout стало видно дві operational nuances:
    - live `/wotlk-azcore/` не має права випадково потрапляти в `/wotlk/` router, якщо четвертий runtime ще не існує;
    - Cloudflare purge не можна вважати обов'язковим або гарантованим cache-fix механізмом для topnav JS.
- Рішення:
  - Live contract на `workspace` на той момент канонічно включав:
    - root `/` як WotLK-first surface
    - `/classic/`
    - `/tbc/`
    - `/wotlk/`
  - Slashless `/classic`, `/tbc`, `/wotlk` редіректять на trailing-slash canonical URLs; точний status code не є семантичним контрактом, але має лишатися non-permanent redirect.
  - `/wotlk-azcore/` лишається чесним `404`, доки на `workspace` не існує реальний AzerothCore website service.
  - Frontend cache invalidation для patch switcher робиться через versioned JS includes у PHP templates, а не через обов'язковий Cloudflare purge.
- Наслідки:
  - Root website більше не є єдиною public surface: Classic/TBC/WotLK тепер мають окремі live containers і окремі DB bindings.
  - Верифікацію public routes треба робити з локальної машини або через реальний браузер; server-origin curl з `workspace` може дати edge-level `403`.
  - Після `TASK-027` verified truth змінилася: live AzerothCore backend тепер стоїть за canonical `/wotlk/`, а `/wotlk-azcore/` використовується лише як alias redirect на `/wotlk/`, а не як окремий четвертий public surface.
- Пов'язані backlog items:
  - `TASK-025`
  - `TASK-013`

### `DEC-021` — `2026-03-15` — `Public website entrypoint is canonicalized to /classic/, and unavailable patch surfaces are hidden instead of advertised`

- Status: `accepted`
- Контекст:
  - Після `TASK-025` live website формально мав working routes, але product contract лишався зламаним: bare domain `/` відкривав окремий WotLK-first surface з topnav layout drift, а `WotLK + ACore` рекламувався попри реальний `404` на `/wotlk-azcore/`.
  - Користувач явно вимагав, щоб public website не існував без patch endpoint, а unavailable runtime не світився як live option.
- Рішення:
  - Канонічний public entrypoint для `world-of-warcraft.morgan-dev.com` = `/classic/`; root `/` і `/index.php` більше не є окремою public surface, а redirect-ять на `/classic/` через Traefik router.
  - Root website container `mangos-website` можна лишати в runtime для compatibility, але його більше не публікує Traefik.
  - Patch switcher тепер керується env flag `MW_ENABLE_AZCORE_LINK`; коли live AzerothCore website service відсутній, flag лишається `0`, і `WotLK + ACore` не показується в UI.
  - Browser cache invalidation для topnav і далі робиться versioned JS include-ами у PHP templates.
- Наслідки:
  - Public UX contract більше не має patchless root surface.
  - Root topnav layout більше не відрізняється від prefixed routes, бо користувач фактично бачить canonical `/classic/` surface.
  - Після `TASK-027` live AzerothCore runtime більше не вимагає окремого UI surface: canonical `/wotlk/` лишається єдиним visible WotLK route, а `/wotlk-azcore/` не треба повертати в patch switcher як четвертий пункт.
- Пов'язані backlog items:
  - `TASK-026`
  - `TASK-027`

### `DEC-022` — `2026-03-16` — `Legacy website modernization should be incremental; big-bang rewrite is not the recommended starting path`

- Status: `accepted`
- Контекст:
  - Користувач прямо поставив питання, чи реально перевести current `celguar/mangos-website` на сучасний PHP, і чи не треба починати всі наступні website improvements саме з цього.
  - Verified scale показує, що website layer already має substantial legacy mass: `321` PHP files і `53,355` lines PHP.
  - Quick compatibility scan already доводить non-trivial PHP 5.6 debt: `144` входження `mysql_*`, `325` входжень legacy constructs на кшталт `ereg/split/each/create_function`, відсутній Composer-based dependency/application structure.
  - Live public website contract already працює на `php:5.6-apache`, а користувачеві потрібні конкретні account features (`My Characters`, password change, self-service transfer), які не обов'язково блокуються до повного rewrite.
- Рішення:
  - Big-bang rewrite всього `mangos-website` не є рекомендованим стартовим шляхом для цього проєкту.
  - Канонічний modernization path = incremental modernization / strangler approach:
    - спочатку зафіксувати compatibility debt і target architecture;
    - нові account-centric features дозволено проектувати й імплементувати по slice-ах на current surface або поруч із ним;
    - deeper PHP 8.x migration рухати окремим decision track, а не як prerequisite до будь-якої website-фічі.
  - Для website execution order це означає:
    - current feature track: `TASK-035 -> TASK-036 -> TASK-046 -> TASK-047`, далі account-management і transfer/control-plane tasks;
    - modernization strategy track: `TASK-049 -> TASK-050 -> TASK-051 -> TASK-052`.
- Наслідки:
  - Команда не витрачає найближчий цикл на неконтрольований rewrite без user-visible value.
  - Нові account features не блокуються штучно вимогою спочатку повністю перейти на PHP 8.x.
  - Повний rewrite може повернутись у discussion only after compatibility inventory, target architecture decision і successful low-risk prototype.
- Пов'язані backlog items:
  - `TASK-048`
  - `TASK-049`
  - `TASK-050`
  - `TASK-051`
  - `TASK-052`
  - `TASK-035`
  - `TASK-046`

### `DEC-023` — `2026-03-16` — `Website account area is the canonical control plane for roster, password change, and self-service transfers`

- Status: `accepted`
- Контекст:
  - Після `DEC-022` стало можна рухати website features без очікування total rewrite, але самі account features ще не мали узгодженого продуктового контракту.
  - Legacy website already має реальні account surfaces (`account/manage`, `account/chartools`, `account/charcreate`, `account/restore`, `account/activate`), тому нові фічі не варто проектувати як окремий паралельний "новий кабінет" без зв'язку з наявною IA.
  - Користувач уже явно описав три базові потреби account area: `My Characters`, `Change Password`, self-service transfer actions.
- Рішення:
  - Канонічний feature-first path для website account area спирається на current account information architecture:
    - `account/manage` = базова точка входу в logged-in account area;
    - `My Characters` = окремий roster section/tab всередині account area;
    - `Change Password` = окремий authenticated account-management action у тому ж area;
    - `Transfers` = character-centric actions поверх roster layer, а не ізольований окремий модуль.
  - User-facing transfer contract фіксується так:
    - дозволені тільки forward moves;
    - `Classic -> TBC` дозволено як одиночний transfer;
    - `TBC -> WotLK` дозволено як одиночний transfer;
    - `Classic -> WotLK` user-facing action дозволена тільки як послідовний chain через TBC;
    - rollback/down-migration або direct skip не входять у self-service scope.
  - Visibility contract фіксується так:
    - user завжди бачить власний roster до будь-яких transfer actions;
    - user завжди має окремий password-change entry point;
    - transfer request, progress, partial success, fail і history не можуть бути прихованими або замаскованими як success.
  - Ownership contract фіксується так:
    - website account може бачити й діяти тільки на персонажах, прив'язаних до його cross-patch identity mapping;
    - сам mapping і shared session semantics визначаються окремим `TASK-036`.
- Наслідки:
  - `My Characters` і `Change Password` стають базовими account-area capabilities, а не side effects transfer feature.
  - Transfer UI не можна будувати раніше за roster layer і cross-patch identity contract.
  - Наступний execution-ready website path після цього рішення: `TASK-036 -> TASK-046 -> TASK-047 -> TASK-053 -> TASK-054 -> transfer queue tasks`.
- Пов'язані backlog items:
  - `TASK-035`
  - `TASK-036`
  - `TASK-046`
  - `TASK-047`
  - `TASK-053`
  - `TASK-054`
  - `TASK-042`

### `DEC-024` — `2026-03-16` — `Cross-patch website features must use a website-scoped identity and a domain-wide session contract, not patch-local account ids`

- Status: `accepted`
- Контекст:
  - `TASK-036` потребував перевести попередню user-вимогу про cross-patch login/session у конкретний technical contract.
  - Current code показує, що legacy auth сьогодні patch-local:
    - `AUTH::login()` пише cookie через `setcookie($cookie_name, ..., $cookie_href)`;
    - `cookie_href` прив'язаний до current `site_href` / base path;
    - отже cookie для `/classic/`, `/tbc/`, `/wotlk/` зараз path-scoped і не є truly shared website session.
  - Current auth principal також patch-local: lookup і authorization спираються на local `account.id` + `website_accounts.account_id`, а не на окремий website-wide identity layer.
- Рішення:
  - Для всіх future cross-patch website features canonical principal = website-scoped identity, а не patch-local `account.id`.
  - Patch-local rows у `classicrealmd` / `tbcrealmd` / `wotlkrealmd` трактуються як linked child accounts of one website identity.
  - Canonical session contract для path-based multiroute surfaces:
    - один website-session principal на рівні домену;
    - cookie scope = весь domain path space, а не лише `/classic/` або `/tbc/`;
    - кожен patch surface при request resolution мапить website identity на локальний linked account row для свого realm/auth DB.
  - Dangerous-action contract:
    - authenticated session достатня для browse/roster/history;
    - transfer submit і password change вимагають explicit confirmation step поверх базової сесії;
    - ownership checks always run against website identity mapping before any patch-local action.
- Наслідки:
  - `My Characters`, password change і transfer buttons можуть працювати як один account area across `/classic`, `/tbc`, `/wotlk`, а не як три ізольовані логіни.
  - `TASK-046`, `TASK-053` і вся transfer queue wave більше не повинні проектуватись навколо patch-local `account.id` як головного user key.
  - Реальна implementation wave може починатись без архітектурної двозначності щодо principal/session model.
- Пов'язані backlog items:
  - `TASK-036`
  - `TASK-046`
  - `TASK-053`

### `DEC-025` — `2026-03-16` — `Password change is an authenticated account-security flow, not a blind profile edit, and its target scope is linked-account-wide by contract`

- Status: `accepted`
- Контекст:
  - У legacy account area вже існує `action=changepass`, але він приймає тільки `new_pass`, не перевіряє current password, не вимагає confirmation, не робить явний forced re-login і змінює лише поточний patch-local `account` row.
  - Після `DEC-023` password change став canonical capability account area, а після `DEC-024` стало некоректно проектувати його лише навколо локального `account.id` як кінцевої моделі.
- Рішення:
  - Canonical password-change flow вважається security-sensitive authenticated action, а не простим profile edit.
  - Мінімальні обов'язкові server-side checks: current-password verification, new-password confirmation, reject same-password reuse, success path with forced re-login.
  - Target update scope за контрактом = усі linked patch accounts тієї самої website identity.
  - Допоки linked-account mapping ще не реалізований у коді, local-only password change лишається transitional behavior і не може рекламуватися як full cross-patch feature.
  - Legacy compatibility surfaces на кшталт `account_pass` трактуються як debt; вони не визначають canonical security model.
- Наслідки:
  - `TASK-054` не повинен просто показати existing legacy form; він має або реалізувати ці checks, або явно блокувати/маркувати недоступні частини flow.
  - Release evidence для password change має містити proof of forced re-login і scope statement (`local-only` vs `linked-account-wide`).
  - Будь-які claims про cross-patch password sync до появи linked mapping layer вважаються недостовірними.
- Пов'язані backlog items:
  - `TASK-053`
  - `TASK-054`
  - `TASK-037`
  - `TASK-042`

### `DEC-026` — `2026-03-16` — `Website self-service transfer requests use one mutable request head plus an immutable append-only event log`

- Status: `accepted`
- Контекст:
  - Після `DEC-023` і `DEC-024` стало ясно, що self-service transfer не можна будувати як кнопку без durable request model: користувач повинен бачити progress/history, а operator tooling не може спиратися тільки на shell logs або ручне читання `daily-sync` output.
  - Existing runtime already має verified transfer scripts, але не має канонічного website-side queue/history schema, через що upcoming tasks (`TASK-038`..`TASK-044`) ризикували б проектуватись навколо випадкових або тимчасових storage choices.
- Рішення:
  - Канонічна persistence model для website self-service transfer складається з двох рівнів:
    - `transfer_requests` = mutable head row з current state одного logical request;
    - `transfer_request_events` = immutable append-only audit stream для status transitions, step progress, retries, operator overrides і user-visible history.
  - `idempotency_key` є частиною request contract already на schema level і будується з logical request identity (`website_identity_key`, source character identity, requested target), а не як одноразовий випадковий token.
  - Partial chain success не переписується як terminal success і не ховається; він фіксується окремими event rows та head-state `partial`/`failed` semantics.
  - User-facing history читає normalized `user_message`/status labels із event log, а не raw runner traces.
- Наслідки:
  - `TASK-038` має повертати eligibility data, сумісні з майбутнім `transfer_requests` contract.
  - `TASK-039` і `TASK-040` повинні повертати structured request/event updates, а не лише stdout shell scripts.
  - `TASK-041`, `TASK-042`, `TASK-043`, `TASK-044` уже мають stable storage contract для duplicate guards, transfer UI, history/progress і admin controls.
- Пов'язані backlog items:
  - `TASK-037`
  - `TASK-038`
  - `TASK-039`
  - `TASK-040`
  - `TASK-041`
  - `TASK-042`
  - `TASK-043`
  - `TASK-044`

### DEC-032 — Website transfer duplicate guards use character-scoped active locks plus target-scoped idempotency keys

- Дата: `2026-03-16`
- Статус: `accepted`
- Контекст:
  - Після `TASK-039`/`TASK-040` website transfer wave already had truthful request-scoped runners, but it still needed a durable answer to double-submit, concurrent same-character execution, and crash-leftover lock cleanup.
- Рішення:
  - `active_lock_key` is character-scoped and does not include `requested_target`; it is the mutex that prevents any concurrent `to_tbc` / `to_wotlk` request for the same source character.
  - `idempotency_key` extends the same logical identity with `requested_target`; it is the deterministic dedupe key for one logical request.
  - Runtime locks are stored under `/opt/cmangos-transfer/runtime/request-locks` and carry `request_id`, `idempotency_key`, `host`, `pid`, and `created_at_epoch` metadata.
  - Stale locks are reclaimed when the owning PID is gone on the same host or the age exceeds `21600` seconds.
  - Website eligibility payload now exposes the same deterministic guard keys so future submit/history/admin surfaces do not invent a second key contract later.
- Наслідки:
  - `TASK-042` can reuse the eligibility payload's `request_guard` metadata when the first website submit surface is added.
  - `TASK-043` and `TASK-044` now have a stable lock/idempotency vocabulary for user history and admin/operator controls.
  - Request-scoped runners remain the authoritative runtime safety net even before persistent website request rows are created.
- Пов'язані backlog items:
  - `TASK-041`
  - `TASK-042`
  - `TASK-043`
  - `TASK-044`

### `DEC-033` — `2026-03-16` — `Website self-service transfer operator overrides use explicit runtime control flags plus append-only audit events`

- Status: `accepted`
- Контекст:
  - Після `DEC-026`, `DEC-032`, `TASK-042`, і `TASK-043` product/runtime docs already covered request storage, duplicate guards, user-facing transfer controls, and history/progress, але operator tooling still lacked one canonical boundary for pause/resume/disable/emergency actions.
  - Without that boundary, future admin behavior risked collapsing back to ad hoc shell intervention on a shared host, which would break auditability and blur the line between user-visible request state and operator recovery work.
- Рішення:
  - Canonical runtime control flags live under `/opt/cmangos-transfer/runtime/control/`.
  - Three global flags are reserved and documented as the operator control plane baseline:
    - `self-service-transfer.disabled.flag`
    - `transfer-queue.paused.flag`
    - `emergency-stop.flag`
  - Users cannot bypass these flags or perform operator actions.
  - Operators may inspect, retry, cancel, pause, resume, disable, and emergency-stop only through the canonical audit path: append immutable operator events and update the mutable request head rather than silently mutating or deleting runtime state.
  - Emergency response starts by setting the stop flag and preserving evidence before manual recovery work.
- Наслідки:
  - `TASK-044` has one durable operator-control vocabulary that later website/admin implementation can reuse.
  - Future request retry/cancel/admin UI work must honor the same flag files, event types, and actor/reason metadata instead of inventing a second control plane.
  - Shared-host interventions on `workspace` now have a documented safe ordering and audit expectation before any future live rollout is attempted.
- Пов'язані backlog items:
  - `TASK-044`

### `DEC-034` — `2026-03-17` — `Bundled legacy website subsystems should be isolated or replaced, not treated as first-wave PHP 8 uplift targets`

- Status: `accepted`
- Контекст:
  - `TASK-048` already established that the website should not start with a big-bang rewrite, but `TASK-049` then showed that the remaining modernization risk is not evenly distributed across the codebase.
  - The inventory found direct PHP 7/8 blockers in both product code and bundled legacy libraries: `144` `mysql_*` refs across `22` PHP files, `3` `preg_replace /e` refs, `1` `create_function`, `1` `eregi`, `7` removed curly-brace string-offset usages, `3` `=& new` references, and `13` old-style constructor references in `DbSimple`, `JsHttpRequest`, and `AJAXChat` families.
  - The current runtime bundle still assumes `php:5.6-apache` on archived Debian Stretch with no Composer-managed dependency boundary, so the oldest subsystems are tightly coupled to bootstrap/runtime assumptions.
- Рішення:
  - First-wave modernization should prioritize application slices that can be migrated behind explicit boundaries, not wholesale line-by-line uplift of bundled legacy subsystems.
  - The following areas are now canonical `isolate-or-replace` zones for architecture planning:
    - `core/dbsimple`
    - `core/ajax_lib` and `components/ajax`
    - `components/chat/lib`
    - `core/mail`
    - `core/thumbnail.inc.php` and `core/class.image.php`
    - standalone `donate.php` payment/IPN flow
  - `TASK-050` and later route-slice planning must treat those zones as subsystem boundaries: either keep them on the legacy runtime temporarily, wrap them behind safer interfaces, or replace them outright instead of dragging them unchanged into the first modern PHP slice.
- Наслідки:
  - The modernization track should favor account/roster/transfer-adjacent slices before forum/chat, admin chartools, donate, or deep Armory internals.
  - Route-level planning can now distinguish `critical upgrade blockers` from `secondary cleanup`, reducing the risk that `TASK-050` collapses back into an implicit whole-site rewrite.
  - Future prototype work (`TASK-052`) should deliberately avoid subsystem-heavy surfaces unless the prototype is explicitly about replacement of one such subsystem.
- Пов'язані backlog items:
  - `TASK-049`
  - `TASK-050`
  - `TASK-051`
  - `TASK-052`

### `DEC-035` — `2026-03-17` — `Website modernization target architecture is a route-level strangler with a companion PHP 8.x app layer, not an in-place monolith upgrade`

- Status: `accepted`
- Контекст:
  - `DEC-022` already rejected a big-bang rewrite as the recommended starting move.
  - `TASK-049` then proved that the current codebase still has concentrated PHP 7/8 blockers in both product code and bundled subsystems, making a direct runtime swap on the shared host too risky.
  - At the same time, the project already has real user-facing account/roster/transfer work on the live legacy website, so a modernization plan must preserve those URLs and evolve incrementally.
- Рішення:
  - The preferred target architecture is a route-level strangler.
  - The current PHP 5.6 multiroute website remains the legacy shell and fallback runtime.
  - A companion PHP 8.x application layer is introduced beside it and progressively takes ownership of selected route/module slices.
  - Public contract stays stable:
    - same domain;
    - same patch prefixes `/classic/`, `/tbc/`, `/wotlk`;
    - no mandatory URL redesign before modernization begins.
  - First-wave ownership goes to authenticated account-centric slices:
    - identity/session bridge
    - account security
    - roster
    - transfer request/history/control-plane surfaces
  - Legacy hold zones remain on the old runtime until separately isolated or replaced:
    - Armory
    - forum/chat
    - admin/chartools
    - donate/payment flow
    - subsystem-heavy legacy helper libraries
  - Route handoff may happen either at ingress/proxy level or through a thin legacy-side dispatcher when ownership depends on query/module semantics rather than clean path boundaries.
- Наслідки:
  - `TASK-051` can now decompose modernization into vertical slices without reopening the fundamental architecture debate.
  - `TASK-052` should validate one companion-slice deployment beside the current website runtime, not attempt a full runtime replacement.
  - The modernization effort now has a clear boundary between `new app layer` and `legacy shell`, which reduces the risk of an accidental whole-site uplift.
- Пов'язані backlog items:
  - `TASK-050`
  - `TASK-051`
  - `TASK-052`

### `DEC-036` — `2026-03-17` — `Route-level modernization priority is prototype first, then account/roster/transfer slices; Armory/forum/admin/donate stay off the first wave`

- Status: `accepted`
- Контекст:
  - `DEC-035` fixed the target architecture, but the project still needed one durable answer to a practical sequencing problem: which slices belong to the first wave, and which ones must remain outside the critical path.
  - `TASK-049` showed that the heaviest blocker clusters sit in Armory, forum/chat, admin/chartools, donate, and bundled helper libraries, while the highest product value sits in account/session/security/roster/transfer surfaces.
- Рішення:
  - The modernization sequence is now fixed as:
    - prototype gate first (`TASK-052`);
    - first-wave modern owner slices next (`TASK-056 -> TASK-057 -> TASK-058 -> TASK-059`);
    - lower-priority or hold-zone work later (`TASK-060 -> TASK-061 -> TASK-062 -> TASK-063 -> TASK-064`).
  - The first wave is explicitly limited to slices that reinforce the already-chosen product direction:
    - website identity/session bridge
    - account security
    - roster/account overview
    - transfer request/history/control-plane surfaces
  - The following areas are explicitly outside the first modernization wave unless the user re-prioritizes them:
    - Armory
    - forum/chat
    - admin/chartools
    - donate/payment flow
  - Public low-risk content/server pages may be modernized later, but only after the prototype gate and without reopening hold-zone dependencies.
- Наслідки:
  - Future continuation can progress from one execution-ready slice card to the next without re-arguing what belongs in the first wave.
  - The project now has a stable rule for saying "not yet" to subsystem-heavy zones without losing them from the roadmap.
  - `TASK-052` can pick a low-risk prototype without accidentally pulling Armory/forum/admin/donate into scope.
- Пов'язані backlog items:
  - `TASK-051`
  - `TASK-052`
  - `TASK-056`
  - `TASK-057`
  - `TASK-058`
  - `TASK-059`
  - `TASK-060`
  - `TASK-061`
  - `TASK-062`
  - `TASK-063`
  - `TASK-064`

### `DEC-037` — `2026-03-17` — `Use a small public render slice to prove the PHP 8 strangler shape, then move directly to identity/session work`

- Status: `accepted`
- Контекст:
  - `TASK-052` needed a real go/no-go signal for the website modernization architecture, but a first prototype still had to avoid the legacy auth/session knot and the bundled PHP 5.6 subsystem debt.
  - The public `server.realmstatus` route is isolated, read-only, and render-focused, so it is the cheapest route where a companion PHP 8 runtime can prove the strangler shape without pretending that the hard parts are already solved.
- Рішення:
  - The prototype gate for website modernization is satisfied by a standalone PHP 8 companion app that reproduces the `realmstatus` render contract and is verified against the live legacy HTML markers.
  - Successful prototype proof is treated as a `GO` for the route-level strangler architecture itself.
  - Follow-up production work must go to `TASK-056` identity/session bridging, not to broadening the public prototype sideways.
- Наслідки:
  - Future modernization slices may use small isolated runtimes without bootstrapping the whole legacy application.
  - A slice is not production-ready merely because it renders; truthful DB connectivity, session ownership, and ingress handoff remain mandatory for production-grade adoption.
  - Public server pages remain low-risk proving ground, but they are no longer the critical path after the prototype gate is closed.
- Пов'язані backlog items:
  - `TASK-052`
  - `TASK-056`

### `DEC-038` — `2026-03-17` — `Armory remains a legacy-owned subsystem; any modernization must be a dedicated replacement track`

- Status: `accepted`
- Контекст:
  - `DEC-036` already kept Armory out of the first modernization wave, but after later website fixes the project had a more precise reality to document: Armory is no longer a generic unknown blocker, yet it still carries a separate debt cluster that does not fit the lightweight route-slice pattern used for `realmstatus`, account/security, roster, transfer, or the static `howtoplay` proof.
  - The current live/public baseline proves that Armory can be kept operational on the legacy runtime, but only with its own compatibility layer: separate `*armory` databases, XML-era redirect shims, JS bootstrap globals, and expansion-aware fallbacks.
- Рішення:
  - Armory remains on the legacy multiroute PHP 5.6 runtime for now.
  - The main modernization wave is explicitly not blocked by migrating or replacing Armory.
  - Any future PHP 8 work for Armory must be treated as a dedicated replacement/containment program with separate backlog, data-contract work, and acceptance gates, not as the next route-level slice.
  - The minimum compatibility contract that must survive during the hold period is:
    - prefixed public Armory entrypoints stay reachable on `/classic|/tbc|/wotlk/armory/index.php`;
    - legacy XML-era public endpoints redirect into the supported HTML flow instead of returning `404`;
    - public failure modes do not leak raw SQL/internal diagnostics;
    - patch-aware navigation and website-to-Armory linking continue to work.
- Наслідки:
  - Future continuation no longer has to treat Armory as an implicit modernization prerequisite after `TASK-060`.
  - Compatibility fixes inside the legacy Armory shell remain valid work, but they do not imply that the PHP 8 companion layer should absorb Armory incrementally.
  - If product priorities later require deeper Armory change, that work should start from a fresh explicit track rather than piggybacking on low-risk public-page modernization.
- Пов'язані backlog items:
  - `TASK-061`
  - `TASK-032`
  - `TASK-055`

### `DEC-039` — `2026-03-17` — `Forum and chat remain legacy-owned subsystems; any modernization must be a dedicated replacement track`

- Status: `accepted`
- Контекст:
  - `DEC-036` already kept forum/chat out of the first modernization wave, but the project still needed one explicit boundary after the authenticated slices and the low-risk public `howtoplay` proof closed: forum/chat are live and useful, yet they are not lightweight render slices.
  - The current verified website behavior shows why: forum routes are public on canonical prefixed URLs, frontpage/news archives still link into forum topics, admin/news operations still rely on forum actions, and community chat is still an embedded legacy `AJAXChat` surface.
  - `TASK-049` already identified `AJAXChat` as an isolate-or-replace blocker cluster, including removed-runtime constructs such as `create_function()` and `preg_replace /e`; this debt does not fit the companion-route pattern used for `realmstatus`, identity/session, account security, roster, transfer, or static `lang_resource(...)` guides.
- Рішення:
  - Forum and chat remain on the legacy multiroute PHP 5.6 runtime for now.
  - The main modernization wave is explicitly not blocked by migrating or replacing forum/chat.
  - Any future PHP 8 work for forum/chat must be treated as a dedicated replacement/containment program with separate backlog, data-contract work, moderation/admin boundary review, and acceptance gates, not as the next route-level slice.
  - The minimum compatibility contract that must survive during the hold period is:
    - prefixed public forum entrypoints stay reachable on `/classic|/tbc|/wotlk/index.php?n=forum` and nested forum routes continue to resolve;
    - frontpage/news links that point into forum archives or topics continue to work while those surfaces remain legacy-owned;
    - community chat either stays on the legacy iframe-backed `components/chat/index.php` surface or degrades with a truthful disabled-state message;
    - public failure modes do not leak raw PHP/internal diagnostics.
- Наслідки:
  - Future continuation no longer has to treat forum/chat as an implicit modernization prerequisite after `TASK-061`.
  - Compatibility fixes inside the legacy forum/chat shell remain valid work, but they do not imply that the PHP 8 companion layer should absorb forum/chat incrementally.
  - If product priorities later require deeper forum or chat changes, that work should start from a fresh explicit track rather than piggybacking on low-risk public-page or account-centered modernization.
- Пов'язані backlog items:
  - `TASK-062`
  - `TASK-030`
  - `TASK-049`

### `DEC-040` — `2026-03-17` — `Admin and chartools remain legacy-owned operator/mutation subsystems; any modernization must be a dedicated replacement track`

- Status: `accepted`
- Контекст:
  - `DEC-036` already kept admin/chartools out of the first modernization wave, but the project still needed one explicit boundary after `TASK-062`: this area is not just “old admin UI”, it is a mixed operator-and-mutation cluster with both hardened admin entrypoints and legacy account-side chartools.
  - The current verified website behavior shows why: `/index.php?n=admin` stays outside the public contract as a hardened route, while the legacy code behind admin/chartools still fans out into account bans/deletes, realm config, forum/news operations, backups/logs, and character-transfer/rename tooling.
  - The chartools family is shared across admin and character-mutation flows through one include stack (`chartools/charconfig.php`, `add.php`, `functionstransfer.php`, `functionsrename.php`, `tabs.php`), and that stack still relies on direct `mysql_*` calls plus cross-database writes. The authenticated `account&sub=chartools` surface also performs direct `characters` table updates, so it does not fit the low-risk account slice model used for identity/session, password change, roster, or transfer control-plane pages.
- Рішення:
  - Admin/chartools remain on the legacy multiroute PHP 5.6 runtime for now.
  - The main modernization wave is explicitly not blocked by migrating or replacing admin/chartools.
  - Any future PHP 8 work for admin/chartools must be treated as a dedicated replacement/containment program with separate backlog, operator-role review, mutation safety model, and acceptance gates, not as the next route-level slice.
  - The minimum compatibility contract that must survive during the hold period is:
    - prefixed `index.php?n=admin` entrypoints remain outside the public contract and fail closed rather than being partially reopened;
    - authenticated chartools behavior remains legacy-owned and truthful about direct character mutations;
    - operator/admin failures do not leak raw SQL/internal diagnostics.
- Наслідки:
  - Future continuation no longer has to treat admin/chartools as an implicit modernization prerequisite after `TASK-062`.
  - Compatibility fixes inside the legacy admin/chartools shell remain valid work, but they do not imply that the PHP 8 companion layer should absorb these mutation/operator surfaces incrementally.
  - If product priorities later require deeper admin or chartools changes, that work should start from a fresh explicit track rather than piggybacking on public-page or authenticated account modernization.
- Пов'язані backlog items:
  - `TASK-063`
  - `TASK-030`
  - `TASK-031`
  - `TASK-049`

### `DEC-041` — `2026-03-17` — `Donate and payment remain legacy-owned payment subsystems; any modernization must be a dedicated replacement or retirement track`

- Status: `accepted`
- Контекст:
  - `DEC-036` already kept donate/payment out of the first modernization wave, but the project still needed one explicit boundary after `TASK-063`: this area is not just one hidden page, it is a payment/IPN/fulfillment contour with its own external-provider and security assumptions.
  - The current verified website behavior shows why: standalone `/donate.php` is outside the public contract as a hardened route, while the legacy code still spans PayPal IPN verification, payment-record inserts, admin donation template management, resend flows, and in-game item fulfillment.
  - The code confirms that `donate.php` still uses direct `fsockopen()` calls to PayPal, raw `$_POST` payload handling, direct `mysql_*` queries, and debug email side effects; community and admin donate flows still depend on the same legacy payment tables and item-mail delivery helpers. This does not fit the low-risk companion-route pattern used for identity/session, password change, roster, transfer, or static public guide pages.
- Рішення:
  - Donate/payment remains on the legacy multiroute PHP 5.6 runtime for now.
  - The main modernization wave is explicitly not blocked by migrating or replacing donate/payment.
  - Any future PHP 8 work for donate/payment must be treated as a dedicated replacement or retirement program with separate backlog, provider/security review, fulfillment contract, and acceptance gates, not as the next route-level slice.
  - The minimum compatibility contract that must survive during the hold period is:
    - standalone `donate.php` entrypoints remain outside the public contract and fail closed rather than being partially reopened;
    - any still-needed legacy donation behavior remains truthful about payment completion versus item-fulfillment state;
    - payment/operator failures do not leak raw SQL/internal diagnostics.
- Наслідки:
  - Future continuation no longer has to treat donate/payment as an implicit modernization prerequisite after `TASK-063`.
  - Compatibility fixes inside the legacy donate/payment shell remain valid work, but they do not imply that the PHP 8 companion layer should absorb payment handling incrementally.
  - If product priorities later require deeper donate/payment change, that work should start from a fresh explicit track rather than piggybacking on public-page or authenticated account modernization.
- Пов'язані backlog items:
  - `TASK-064`
  - `TASK-017`
  - `TASK-021`
  - `TASK-049`

### `DEC-042` — `2026-03-18` — `Standalone Docker updater container is rejected; host-level update.sh plus systemd timers remain the canonical update path`

- Status: `accepted`
- Контекст:
  - Legacy archive kept an optional idea for `Dockerfile.updater`: a small checker container with `git ls-remote`, cron, and mounted Docker socket that would watch upstream commits and trigger rebuilds.
  - The current runtime no longer lacks update automation. Each expansion already has a dedicated `scripts/update.sh` with built-in upstream hash detection, locking, backup, rebuild, push/restart flow, and systemd install/status helpers.
  - Current canonical docs and live checks already treat host-level timers as the verified baseline: `cmangos-update.timer`, `cmangos-tbc-update.timer`, `cmangos-wotlk-update.timer`, plus `cmangos-daily-sync.timer`.
- Рішення:
  - Do not implement a separate `Dockerfile.updater` container.
  - The canonical update mechanism remains the existing per-expansion `update.sh` scripts installed and observed through host-level systemd timers.
  - Any future automation change should extend the existing host-level update control plane or move into an external CI/CD path, not introduce a second privileged in-host watcher container by default.
- Наслідки:
  - `TASK-018` is closed as a rejected legacy debt item rather than an implementation task.
  - The project avoids an extra Docker-socket-mounted container and keeps update authority in one already-documented operational surface.
  - Future continuation can treat `TASK-019` as the next optional debt item instead of revisiting `Dockerfile.updater` speculation.
- Пов'язані backlog items:
  - `TASK-018`
  - `TASK-007`

### `DEC-043` — `2026-03-20` — `Backlog-first rule is a hard blocker: ALL user requirements must be decomposed before ANY implementation begins`

- Status: `accepted`
- Контекст:
  - Протягом кількох сесій агент систематично порушував правило «запис до імплементації»: вихоплював одну вимогу з повідомлення користувача, виконував її, а решту ігнорував або «забував» записати в беклог.
  - Це призвело до втрати стратегічних задач між сесіями: cross-patch single account, admin panel, player map, PHP 8 migration, WotLK news/IP/status — всі ці вимоги були озвучені користувачем, але ніколи не зафіксовані в беклозі до моменту прямої конфронтації.
  - Колишнє формулювання правила було нечітким: «спочатку декомпозуй це в задачі беклогу, якщо запит не є суто інформаційним» — це давало агенту можливість трактувати рекомендацію як optional guideline, а не як hard gate.
- Рішення:
  - Правило беклогу в `AGENTS.md` переписане зі структурою жорсткого блокера:
    1. ЗУПИНИСЬ — не починай імплементацію.
    2. ДЕКОМПОЗУЙ ВСЕ з повідомлення, навіть «прості» вимоги.
    3. ЗАПИШИ В БЕКЛОГ зі статусом `[ ]`, модулем, залежностями, acceptance-критеріями.
    4. ПОКАЖИ КОРИСТУВАЧУ повну декомпозицію з ID задач.
    5. ТІЛЬКИ ПІСЛЯ ЦЬОГО починай імплементацію.
  - Додано явний список заборонених anti-patterns: вибіркове виконання, імплементація без запису, «зроблю пізніше», мовчазне ігнорування, ретроспективний запис.
  - Додано правило збереження між сесіями: незавершені задачі лишаються в беклозі; покладатися на пам'ять чату заборонено.
  - Єдиний виняток: суто інформаційні запити, читання файлів, адміністративні дії над workflow docs.
- Наслідки:
  - Порушення цього правила тепер класифікується як workflow failure, а не як minor process drift.
  - Усі наступні агенти зобов'язані виконувати повну декомпозицію ДО першого рядка імплементації.
  - Якщо сесія закінчується до завершення задач — незавершені задачі гарантовано видимі для наступної сесії через беклог.
- Пов'язані backlog items:
  - Workflow process improvement (не прив'язано до конкретного TASK)

### `DEC-044` — `2026-03-20` — `3-step transfer pipeline (SKIP_WOTLK) verified: Classic → TBC → AzerothCore без cmangos-wotlk`

- Status: `accepted`
- Контекст:
  - Daily-sync раніше використовував 4-кроковий pipeline: Classic → TBC → WotLK (cmangos) → AzerothCore.
  - cmangos-wotlk є redundant intermediate: AzerothCore вже є canonical WotLK runtime.
  - Потрібно довести що 3-кроковий pipeline працює, щоб деактивувати cmangos-wotlk (TASK-068).
- Рішення:
  - Створено `migrate_cmangos_tbc_to_azerothcore.sql` — пряма міграція TBC→AzerothCore (~400 рядків).
  - `daily-sync.sh` отримав `SKIP_WOTLK=true` env var для активації 3-step mode.
  - `lib.sh` розширено для blob-padding при azerothcore target.
  - TBC `corpse` таблиця не має `phaseMask` (WotLK-only field) — використовується literal `1`.
  - Повний E2E тест: Samuel (guid=1801) — SUCCESS на AzerothCore login-bot verification.
- Наслідки:
  - cmangos-wotlk може бути деактивований (TASK-068 розблоковано).
  - 4-step pipeline лишається як fallback до завершення TASK-068.
  - Після TASK-068 3-step стане єдиним режимом, SKIP_WOTLK env var буде видалено.
- Пов'язані backlog items:
  - `TASK-069` (verified)
  - `TASK-068` (unblocked)

### `DEC-045` — `2026-03-20` — `cmangos-wotlk decommissioned: AzerothCore є єдиним WotLK runtime`

- Status: `accepted`
- Контекст:
  - cmangos-wotlk і AzerothCore працювали паралельно на workspace. Після верифікації 3-step pipeline (DEC-044, TASK-069), cmangos-wotlk став redundant.
  - Мета: зменшити runtime footprint з 4 game stacks до 3, усунути подвійне обслуговування WotLK, спростити daily-sync.
- Рішення:
  - `cmangos-wotlk-server` і `cmangos-wotlk-db` контейнери зупинені та видалені (`docker compose down` в `/opt/cmangos-wotlk/`).
  - `cmangos-wotlk-update.timer` деактивований (`sudo systemctl disable --now`).
  - `cmangos-daily-sync.service` оновлений з `Environment=SKIP_WOTLK=true` для 3-step pipeline mode.
  - Website `/wotlk/` вже працює через AzerothCore auth DB (TASK-067).
  - Фінальна топологія: Classic (cmangos) + TBC (cmangos) + WotLK (AzerothCore) — 3 сервери.
- Наслідки:
  - `/opt/cmangos-wotlk/` data volumes лишаються на диску як архів, але контейнери не запущені.
  - Daily-sync більше не має 4-step mode як default — `SKIP_WOTLK=true` зафіксований у systemd service.
  - `mangos-website-wotlk` контейнер лишається — він читає з AzerothCore DB, а не з cmangos-wotlk.
  - Наступна фаза (B): vmangos-classic заміна (TASK-070..072) тепер розблокована.
- Пов'язані backlog items:
  - `TASK-068` (completed)
  - `TASK-069` (dependency — verified)
  - `TASK-070` (unblocked — depends on TASK-068)

### `DEC-046` — `2026-03-22` — `AzerothCore SRP6 compatibility via SQL virtual columns with REVERSE()`

- Status: `accepted`
- Контекст:
  - Mangos-website PHP code (`class.auth.php`) запитує `SELECT s, v, gmlevel FROM account` для login. cMaNGOS зберігає `s`/`v` як hex VARCHAR. AzerothCore зберігає `salt`/`verifier` як `binary(32)` (little-endian) і `gmlevel` в окремій таблиці `account_access`.
  - PHP SRP6 verification (`verifySRP6()` в `common.php`) робить `strrev()` на salt перед хешуванням і `strrev()` на результат verifier — це компенсує byte-order різницю між форматами зберігання.
  - Проблема: якщо virtual columns просто роблять `HEX(salt)`, PHP `strrev()` подвійно reverse-ить (little-endian → big-endian → back to LE), що дає неправильний hash.
- Рішення:
  - Virtual columns з `REVERSE()`: `s VARCHAR(64) GENERATED ALWAYS AS (UPPER(HEX(REVERSE(salt)))) VIRTUAL`, `v VARCHAR(64) GENERATED ALWAYS AS (UPPER(HEX(REVERSE(verifier)))) VIRTUAL`.
  - REVERSE у SQL інвертує binary bytes. Коли PHP потім робить `hex2bin()` + `strrev()`, подвійний reverse повертає original byte order = correct SRP6 hash.
  - Regular `gmlevel TINYINT UNSIGNED NOT NULL DEFAULT 0` column — populated з `account_access` one-time update.
  - Zero PHP code changes. Zero game server impact (AzerothCore ніколи не читає `s`/`v`/`gmlevel` з `account` таблиці).
- Наслідки:
  - Login з WotLK website працює для AzerothCore акаунтів.
  - Registration з website пише `s`/`v` як hex — virtual columns read-only, тому INSERT потребує окремого рішення (future task).
  - `gmlevel` column не синхронізується автоматично з `account_access` — потребує manual update або trigger (future task).
- Пов'язані backlog items:
  - `TASK-082` (completed)

### `DEC-047` — `2026-03-22` — `VMaNGOS armory compatibility via SQL virtual columns (conf_client + column aliases)`

- Status: `accepted`
- Контекст:
  - Classic armory (SPP codebase) запитує cMaNGOS-style column names, але VMaNGOS використовує інші назви. Також `conf_client` у всіх 3 armory DB було `1` (TBC), що для Classic і WotLK є неправильним.
- Рішення:
  - `classicarmory.conf_client`: `1` → `0` (Vanilla). `wotlkarmory.conf_client`: `1` → `2` (WotLK). TBC залишається `1`.
  - Virtual columns на VMaNGOS `characters`: `stored_honorable_kills` (← `honor_stored_hk`), `stored_honor_rating` (← `honor_rank_points`).
  - Virtual columns на VMaNGOS `character_inventory`: `item_template` (← `item_id`), `item` (← `item_guid`).
  - Virtual column на VMaNGOS `item_instance`: `randomPropertyId` (← `random_property_id`).
  - Zero PHP code changes, zero game server impact — аналогічна техніка до DEC-046.
- Пов'язані backlog items:
  - `TASK-084` (completed), `TASK-085` (completed)

### `DEC-048` — `2026-03-22` — `VMaNGOS item_template: 17 virtual columns + tooltipmgr SQL aliases for full armory tooltip compatibility`

- Status: `accepted`
- Контекст:
  - Classic armory item tooltips показували "Error: Unknown AllowableClass" та "Unknown AllowableRace" — VMaNGOS `item_template` використовує snake_case назви колонок, а armory PHP очікує cMaNGOS PascalCase.
  - `SELECT *` queries повертають колонки з оригінальними іменами таблиці; PHP arrays є case-sensitive.
- Рішення:
  - 17 virtual columns на `mangos.item_template`: AllowableClass, AllowableRace, ContainerSlots, InventoryType, ItemLevel, MaxDurability, RandomProperty, RequiredLevel, RequiredSkill, RequiredSkillRank, itemset, maxcount, requiredspell, displayid, BuyPrice, SellPrice, DisenchantID.
  - `tooltipmgr.php`: додано `quality AS Quality, flags AS Flags` до `SELECT *` queries (case-only відмінності не можуть бути virtual columns в MariaDB — case-insensitive column names).
  - Підхід: virtual columns для naming convention diffs + SQL aliases для case-only diffs. Обидва non-invasive для VMaNGOS core.
- Пов'язані backlog items:
  - `TASK-088` (completed)

### `DEC-024` — `2026-03-23` — `Unified website architecture: one site, phased migration`

- Status: `accepted`
- Контекст:
  - 3 окремих website containers (`mangos-website-classic/tbc/wotlk`) з ізольованими auth DBs і path-scoped cookies. Логін на одному патчі не працює на іншому. TASK-066 планувалось як shared identity layer, але це болтання на legacy.
  - Samuel хоче один сайт з cartoon WoW стилем (wow-hc.com reference: Hearthstone-like dark theme).
- Рішення:
  - **Поетапна міграція**: auth microservice → unified Next.js homepage → armory migration → account/transfer → decommission legacy.
  - **Phase 1 (completed)**: JWT auth service (`mw-auth-service`) at `/auth/`, connects to all 3 auth DBs, issues root-scoped JWT cookie. Legacy `class.auth.php` patched для JWT fallback (curl to auth service → create legacy session).
  - **Frontend**: React/Next.js + PHP 8 API backend.
  - **Identity model**: `website_identity` table in each auth DB, mapping `identity_uuid` ↔ `account_id`.
  - **Schema adaptation**: CMaNGOS/VMaNGOS use `s`/`v` TEXT hex columns; AzerothCore uses `salt`/`verifier` BINARY(32). Database.php handles both via SCHEMA constant.
- Наслідки:
  - Cross-patch login працює: один JWT login → всі 3 legacy сайти показують залогіненого юзера.
  - Password change синхронізується на всіх 3 серверах одночасно.
  - Legacy containers залишаються під час переходу; нові features будуються в unified site.
- Пов'язані backlog items:
  - `TASK-066` Phase 1 (completed), Phase 2-5 (pending)
