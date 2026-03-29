# Архітектура

Цей файл зберігає довговічну технічну форму проєкту. Він консолідує legacy `ARCHITECTURE.md` і поточний template.

## Огляд системи

- Назва продукту / системи: `CMaNGOS Multi-Expansion Transfer Platform`
- Основний користувач або оператор: `Samuel Morgan`
- Базова runtime-модель: `hybrid`

## Високорівнева Схема

```text
[Samuel / agent on local workstation]
                |
                v
[root workflow docs + localProjects/cmangos_projects]
                |
                v
[ssh alias workspace + /tmp/ssh-ws ControlMaster]
                |
                v
[remote ARM64 host: Classic stack | TBC stack | AzerothCore WotLK stack | traefik | website]
                |
                v
[/opt/cmangos-transfer + /opt/mangos-website + MariaDB data + systemd timers]
```

## Основні компоненти

| Компонент | Призначення | Власник-модуль | Runtime / path | Примітки |
|---|---|---|---|---|
| Root workflow docs | Канонічний continuation layer | `DOCS` | `docs/`, `workflow_config.md`, `remote_access.md` | Новий стартовий канон |
| Legacy project workspace | Локальний код, скрипти, reference materials | `INFRA`, `TRANSFER`, `SOURCE` | `localProjects/cmangos_projects/` | Містить і runtime descriptors, і upstream mirrors |
| Classic stack | Docker runtime для WoW Classic (VMaNGOS) | `INFRA`, `OPS` | `workspace:/opt/vmangos-classic/` + `localProjects/cmangos_projects/vmangos-classic/` | **VMaNGOS** since `TASK-071` (`2026-03-19`); replaced cmangos-classic; containers `vmangos-db`/`vmangos-realmd`/`vmangos-mangosd` on `cmangos-net`; порти `8085/3724/3306`; DB: `mangos`/`characters`/`realmd` |
| TBC stack | Docker runtime для WoW TBC | `INFRA`, `OPS` | `workspace:/opt/cmangos-tbc/` | Live-verified `2026-03-14`; server + DB healthy, порти `8086/3725/3307` |
| ~~WotLK stack (cmangos)~~ | ~~Docker runtime для WoW WotLK (cmangos)~~ | ~~`INFRA`, `OPS`~~ | ~~`workspace:/opt/cmangos-wotlk/`~~ | **DECOMMISSIONED** `2026-03-20` (`TASK-068`): контейнери зупинені, timer вимкнений. AzerothCore є єдиним WotLK runtime. |
| Transfer runtime | Перенос персонажів, login verify, sync automation | `TRANSFER`, `OPS` | `workspace:/opt/cmangos-transfer/` | Live-verified; містить `daily-sync.sh`, `lib.sh`, обидва login bots, SQL migrations |
| AzerothCore stack | **Sole WotLK 3.3.5a runtime** (замінив cmangos-wotlk) | `INFRA`, `TRANSFER`, `OPS` | `workspace:/opt/docker-azerothcore/`, `localProjects/cmangos_projects/docker-azerothcore/` | Live on `workspace` since `TASK-067`; `authserver/worldserver/db` on `3727/8088/3309/7879`; sole WotLK runtime after `TASK-068` decommission (`2026-03-20`) |
| Legacy website live surfaces | Public WoW website surface for `world-of-warcraft.morgan-dev.com` | `INFRA`, `OPS` | `workspace:/opt/mangos-website/` + `localProjects/cmangos_projects/docker-website/` | `TASK-021`/`TASK-022`/`TASK-025`/`TASK-026`/`TASK-027` live-verified; public root redirects to `/classic/`, Classic/TBC/WotLK path services run as separate containers behind `traefik`, and canonical `/wotlk/` now reads from AzerothCore auth data while `/wotlk-azcore/` is only a redirect alias |
| Planned modern website application layer | Future PHP 8.x route-owned slices for account/security/transfer features | `INFRA`, `DOCS` | `planned companion service beside current website stack` | Chosen in `TASK-050` as a strangler layer, not as an in-place monolith rewrite |
| Website browser audit harness | Реальний browser-level smoke/audit для legacy website | `OPS`, `QA` | `localProjects/cmangos_projects/docker-website/browser-audit/` | `TASK-023` live-audits current public site via Playwright/Chromium, writes per-run reports with action trail and consolidated issues |
| Path-prefix website multiroute deploy layer | Single-domain patch-specific routing contract | `INFRA`, `OPS` | `localProjects/cmangos_projects/docker-website/docker-compose.remote.multiroute.yml` + `configure-apache.php` + `mangos-website/templates/*/js/buildtopnav.js` | `TASK-024` proved the contract locally, `TASK-025` live-deployed `/classic/`, `/tbc/`, `/wotlk/`, and `TASK-027` bound canonical `/wotlk/` to the live AzerothCore backend; `/wotlk-azcore/` remains only a legacy alias route |
| Shared host services | Сторонні сервіси на тому ж хості | `OPS` | `workspace: docker ps` | Live-verified `powerbot-*` і `traefik`; враховувати як shared-host constraint |
| Source mirrors | Code-level analysis and protocol reference | `SOURCE` | `localProjects/cmangos_projects/mangos-classic/`, `localProjects/cmangos_projects/azerothcore-wotlk/`, `issues.wiki/`, `spp-classics-cmangos/` | `azerothcore-wotlk/` expanded to full working tree in `TASK-011`; read-only reference by default, build-capable locally |

## Середовища

| Середовище | Що там працює | Як туди потрапити | Ризики / примітки |
|---|---|---|---|
| `local` | Template docs, local scripts, reference repos | Прямий доступ до filesystem | Безпечне місце для docs/refactor work |
| `test` | Remote Classic (VMaNGOS) + TBC (cmangos) + WotLK (AzerothCore) + transfer scripts + legacy website | `ssh workspace` через `remote_access.md` | Live-verified `2026-03-19`; cmangos-classic replaced by vmangos (`TASK-071`), cmangos-wotlk decommissioned (`TASK-068`); shared host з `traefik` |
| `local` (AzerothCore dev) | Local AzerothCore docker stack mirror | `localProjects/cmangos_projects/docker-azerothcore/` | `TASK-011` live-verified locally; deployed on `workspace` since `TASK-067`, sole WotLK runtime since `TASK-068` |
| `prod` | Окремий прод не виділений | `n/a` | Будь-які live remote-операції трактувати як high-risk |

## Сховища даних

| Сховище | Призначення | Власник-модуль | Примітка про backup / recovery |
|---|---|---|---|
| Classic MariaDB — VMaNGOS (`mangos`, `characters`, `realmd`, `logs`) | Світ, персонажі, realmd і логи для Classic (VMaNGOS) | `OPS` | Container `vmangos-db` on `cmangos-net`; replaced cmangos DBs (`classicmangos`/`classiccharacters`/`classicrealmd`/`classiclogs`) since `TASK-071` |
| TBC MariaDB (`tbcmangos`, `tbccharacters`, `tbcrealmd`, `tbclogs`) | Аналогічні дані для TBC | `OPS` | Legacy docs описують `mariadb-dump`-based backup flow |
| WotLK MariaDB — AzerothCore (`acore_world`, `acore_characters`, `acore_auth`) | Світ, персонажі, auth для WotLK (AzerothCore) + transfer target + website base auth | `OPS` | Canonical WotLK runtime DB since `TASK-068`; cmangos-wotlk DB (`wotlkmangos`/`wotlkcharacters`/`wotlkrealmd`/`wotlklogs`) більше не є runtime source of truth |
| Local SQL artifacts | Дампи, міграції, експериментальні SQL | `TRANSFER` | `localProjects/cmangos_projects/*.sql`, `localProjects/cmangos_projects/transfer/` | Не є runtime source of truth |

## Зовнішні інтеграції

| Інтеграція | Навіщо існує | Джерело доступу / контексту | Вплив відмови |
|---|---|---|---|
| SSH alias `workspace` | Єдиний documented runtime access path | `remote_access.md`, `workflow_config.md` | Без нього неможлива live-перевірка, деплой і transfer verify |
| Docker Hub `semorgana` | Публікація / отримання runtime images | `workflow_config.md`, legacy docs | Ускладнює rebuild/deploy path |
| `traefik` + Cloudflare-proxied DNS | HTTPS ingress for public website route | live `workspace` topology, domain `world-of-warcraft.morgan-dev.com` | Без нього website не має stable public entrypoint; під час первинного ACME issuance можливий короткий `526` transient |
| AzerothCore official repos | Candidate source for Phase 16 runtime and future 4-step pipeline | official `azerothcore/acore-docker`, `azerothcore/azerothcore-wotlk` | Визначає, чи можемо спиратися на prebuilt images чи маємо build locally on ARM64 |
| GitHub upstream repos | Аналіз core behavior, schema, protocol differences | `localProjects/cmangos_projects/`, `gh` auth | Без нього втрачається зручний reference path |
| YubiKey-based SSH auth | Безпечний доступ до `workspace` | user init + `remote_access.md` | Перший connect блокується без фізичного touch |

## Критичні шляхи

- `Classic → TBC SQL copy → TBC login verify → TBC-normalized data → AzerothCore SQL copy → AzerothCore login verify` (3-step canonical pipeline since `TASK-068`/`TASK-069`)
- ~~Legacy 4-step path: `Classic → TBC verify → WotLK (cmangos) verify → AzerothCore verify`~~ — cmangos-wotlk intermediate removed
- Live website root path: `browser → Cloudflare proxy → traefik root redirect router → /classic/ surface`
- Live website multiroute path: `browser → Cloudflare proxy → traefik path-prefix router → patch-specific website container (/classic | /tbc | /wotlk) → per-target realmd/auth DB`
- AzerothCore-backed canonical path: `browser → Cloudflare proxy → traefik path-prefix router → /wotlk/ container → AzerothCore auth DB + website compat views`
- Підйом remote runtime через Docker Compose і очікування `World initialized`
- Account auth flow через SRP6 для login bot і RA console
- WotLK transfer sanitation з pre-insert у `character_achievement_progress` для criteria `4224`
- Systemd timers на remote: `cmangos-update.timer`, `cmangos-tbc-update.timer`, `cmangos-daily-sync.timer` (note: `cmangos-wotlk-update.timer` **disabled** since `TASK-068` decommission `2026-03-20`)
- Standalone Docker updater container is not part of the architecture baseline; canonical update automation stays in per-expansion host-level `update.sh` flows installed via systemd timers.

## Відкриті архітектурні питання

- Нема окремого staging/prod split; це збільшує ризик будь-яких remote mutations.
- Потрібно вирішити, чи вирівнювати `sync-accounts.conf` так, щоб усі записи мали явний пароль.
- ~~Future AzerothCore integration тепер має live-verified local stack у `docker-azerothcore/`, але ще не має deploy path на `workspace`.~~ **Resolved** (`TASK-068`): AzerothCore deployed on `workspace`, cmangos-wotlk decommissioned.
- `mangos-website` expects one base auth/realm DB, але `workspace` реально має три ізольовані `realmd` DB; current public contract therefore avoids exposing a fake root aggregation and instead canonicalizes users into patch-prefixed surfaces.
- Base-path compatibility і shared-host rollout для `/classic/`, `/tbc/`, `/wotlk/` уже доведені; відкритим лишається не окремий `/wotlk-azcore/` surface, а підтримка legacy website compatibility layer над `acore_auth` під час майбутніх AzerothCore DB reset/redeploy cycle-ів.
- Official AzerothCore deployment split-brain:
  - `acore-docker` = quickest prebuilt-image path
  - `azerothcore-wotlk` = build-capable path
  For ARM64 we currently treat the build-capable path as safer baseline until a multi-arch image story is explicitly verified.
- `TASK-014` now fixes the WotLK crash-triage fallback: the normal `docker-wotlk/Dockerfile.server` stays on release-style flags (`-DDEBUG=0`), and debug binaries are not a standing runtime mode. If a future WotLK crash survives the known data-level workaround, the canonical fallback is a temporary local rebuild with `-DCMAKE_BUILD_TYPE=Debug -DDEBUG=1`, same runtime ports/volumes, first local reproduction, and shared-host rollout only after logs from the release image prove insufficient.

## Website Cross-Patch Identity Contract

Current website auth implementation є patch-local, не truly shared:

- `AUTH::login()` у `core/class.auth.php` створює session cookie через `setcookie(...)` з path, що походить від current `site_href`.
- У multiroute deploy це означає path-scoped cookie behavior per `/classic/`, `/tbc/`, `/wotlk` surface.
- Auth principal також patch-local: lookup і authorization йдуть через local `account.id` + `website_accounts.account_id` у конкретному auth DB цього surface.

Canonical future contract для website account features:

- Principal = website-scoped identity, а не patch-local `account.id`.
- Кожен patch-specific auth row є linked account record цієї website identity.
- Session scope = увесь domain path space для website surfaces, щоб logged-in user не втрачав account state при переході між `/classic/`, `/tbc/`, `/wotlk`.
- Patch-specific request handling після session resolution виконує mapping `website identity -> local linked account row` для потрібного auth/characters DB.

Canonical action policy:

- Browse-level features `My Characters`, account overview, history можуть покладатися на authenticated website session.
- Dangerous actions `Change Password` і `Transfer` вимагають окремого explicit confirmation step поверх базової сесії.
- Ownership checks завжди проходять на website-identity level, а не тільки на patch-local account row.

Interim implementation state after `TASK-046`:

- Website now has a canonical roster backend helper `mw_build_account_character_roster($account_id)` in the legacy codebase.
- This helper opens per-realm character DB connections from `website_realm_settings` and queries each realm independently.
- Current runtime still lacks a verified `website identity -> linked realm account row` table, so roster lookup runs in explicit `legacy_account_id` mode.
- Result: the system can now return a structured per-patch roster payload, but cross-patch completeness is only as good as the current numeric account-id alignment between realms.
- This is intentional. Empty cross-patch buckets are treated as truthful mismatch/absence, not silently merged by username guesses.

## Website Modernization Target Architecture

Options considered for the legacy website:

- `PHP 8 in-place monolith hardening`:
  - rejected as the first-wave architecture;
  - `TASK-049` showed that the existing bootstrap/core and bundled libraries carry too many direct upgrade blockers (`mysql_*`, `/e`, old constructors, `create_function`, `eregi`, curly string offsets) to make an in-place runtime swap low-risk on the shared single host.
- `Route-level strangler with a new PHP 8 application layer`:
  - accepted as the preferred target architecture;
  - allows new slices to move independently while the verified live legacy site keeps serving the remaining routes.
- `Full greenfield replacement`:
  - explicitly not the starting architecture;
  - may become a later destination only after route slices and a low-risk prototype validate the economics.

Preferred target architecture:

- Keep the current PHP 5.6 multiroute website containers as the legacy shell and fallback runtime.
- Introduce a companion PHP 8.x application layer with its own dependency boundary and explicit adapters for auth/realm/character/transfer data.
- Preserve the current public contract:
  - same domain;
  - same patch prefixes `/classic/`, `/tbc/`, `/wotlk`;
  - no forced user-visible URL redesign as a prerequisite.
- Shift ownership by route/module, not by full-site swap:
  - first-wave modern slices should target authenticated account-centric surfaces: identity/session bridge, account security, `My Characters`, transfer queue/history/control-plane, and future account-adjacent APIs;
  - legacy runtime remains the initial owner of frontpage/news, forum/chat, Armory, admin/chartools, donate, and other subsystem-heavy zones.
- The modern layer must not depend on legacy bootstrap as a runtime foundation:
  - no direct reuse of `core/common.php` as the primary app kernel;
  - no first-wave uplift that drags `DbSimple`, `JsHttpRequest`, `AJAXChat`, legacy mail helpers, or thumbnail/image helpers into the new slice unchanged.

Coexistence / transition shape:

- Default request ownership stays with the current legacy website containers.
- Selected slices are peeled off behind a thin routing handoff while keeping canonical public URLs.
- Because the current website IA is largely query-driven (`index.php?n=...&sub=...`), the handoff may live at either of two layers:
  - ingress/proxy rules when a clean path boundary exists;
  - a thin legacy-side dispatcher/proxy shim when ownership must switch on module/query semantics without changing the public URL.
- The modern layer can reuse stable static assets or visual tokens where useful, but it should not inherit the legacy runtime contract wholesale.
- Session and ownership semantics remain governed by the website-scoped identity contract already fixed in this file; the modernization path must converge toward one domain-wide principal rather than three isolated patch-local account sessions.

Initial module boundary:

- `Modern first-wave owner`:
  - account identity/session bridge
  - authenticated account/security pages
  - roster surfaces
  - transfer request orchestration/history/operator-aware control-plane pages
- `Legacy hold zone for later isolation or replacement`:
  - Armory
  - forum/chat
  - admin/chartools
  - donate/payment flow
  - legacy bootstrap/vendor-like helper libraries

Armory containment boundary:

- Armory remains a separate legacy subsystem even though it is publicly reachable on the same domain and patch prefixes.
- Reasons it is not part of the main PHP 8 route-slice wave:
  - it depends on a separate Armory data layer (`classicarmory`, `tbcarmory`, `wotlkarmory`) rather than only the main website/auth/character schemas;
  - it still needs XML-era compatibility redirects for historical endpoints such as `battlegroups.xml`, `select-team-type.xml`, and `arena-ladder.xml`;
  - it carries its own JS/bootstrap debt (`armory_link`, `theBGcookie`, legacy topnav globals, AJAX-era scripts) and expansion-specific rendering behavior;
  - some behavior is expansion-conditional rather than globally uniform, for example non-WotLK achievement paths need explicit fallback logic.
- Therefore the near-term policy is containment, not migration:
  - keep Armory on the legacy multiroute runtime;
  - keep it operational and truthful through compatibility fixes when needed;
  - do not treat Armory as a prerequisite for the account/session/roster/transfer modernization wave.
- Minimum compatibility contract while Armory stays legacy-owned:
  - `/classic|/tbc|/wotlk/armory/index.php` must stay reachable on canonical prefixed URLs;
  - legacy XML-era public entrypoints must redirect into the supported HTML flow rather than fail with `404`;
  - public failures must degrade without leaking raw SQL/internal details;
  - patch-aware navigation and links between website surfaces and Armory must remain intact.
- Any future PHP 8 effort here should be planned as a dedicated replacement program with its own backlog, data-contract work, and acceptance gates, not as the next incremental public-page slice.

Forum/chat containment boundary:

- Forum and chat remain legacy-owned subsystems even though the public forum routes are currently reachable on the same domain and patch prefixes.
- Reasons they are not part of the main PHP 8 route-slice wave:
  - forum is not an isolated read-only page family; frontpage/news archives and last-comment links resolve into forum topics and forums, so a forum move would reopen frontpage/news ownership at the same time;
  - forum management is still wired into legacy admin/news operations through direct `index.php?n=admin&sub=forum` and `index.php?n=forum&sub=...` flows;
  - account/community surfaces still assume forum-adjacent tables and counters (`forum_accounts`, `pms`, `f_*`, forum post counts) rather than one clean standalone API boundary;
  - community chat is an embedded legacy iframe around `components/chat/index.php`, backed by bundled `AJAXChat`, not a separate modern service;
  - the bundled chat subsystem still carries removed-runtime constructs (`create_function()`, `preg_replace /e`) plus Flash/socket-era baggage, so dragging it into the PHP 8 companion layer would turn a route slice into a subsystem replacement.
- Therefore the near-term policy is containment, not migration:
  - keep forum/chat on the legacy multiroute runtime;
  - keep the public forum/community contract operational and truthful through targeted compatibility fixes when needed;
  - do not treat forum/chat as a prerequisite for the account/session/roster/transfer modernization wave.
- Minimum compatibility contract while forum/chat stays legacy-owned:
  - `/classic|/tbc|/wotlk/index.php?n=forum` and nested forum routes must stay reachable on canonical prefixed URLs;
  - frontpage/news links that resolve into forum archives or individual topics must keep working while those surfaces remain legacy-backed;
  - community chat must either remain available on the legacy iframe-backed surface or fail with a truthful disabled state rather than a partial modern stub;
  - public failures must degrade without leaking raw PHP warnings, SQL traces, or internal file paths.
- Any future PHP 8 effort here should be planned as a dedicated replacement program with its own backlog, data-contract work, moderation/admin boundary, and acceptance gates, not as the next incremental public-page slice.

Admin/chartools containment boundary:

- Admin and chartools remain legacy-owned operator and mutation subsystems rather than first-wave PHP 8 slices.
- Reasons they are not part of the main PHP 8 route-slice wave:
  - the public contract already treats `/classic|/tbc|/wotlk/index.php?n=admin` as a hardened non-public operator zone, so there is no user-facing requirement to reopen or modernize it before account/session/roster/transfer work proceeds;
  - the admin panel is not one isolated tool but a fan-out hub for account bans/deletes, realm configuration, forum/news management, keys/langs, vote/donate operations, logs/backups, GM ticket tooling, and chartools/chartransfer actions;
  - `admin.chartools` and `admin.chartransfer` both reuse the same legacy include stack (`chartools/charconfig.php`, `add.php`, `functionstransfer.php`, `functionsrename.php`, `tabs.php`), including direct `mysql_*` usage and cross-database character mutation logic;
  - authenticated `account&sub=chartools` is still part of the same mutation family, with direct `characters` table updates for unstuck/customization flows, so it is not equivalent to the safer read-only account surfaces already moved into the companion app;
  - this cluster mixes operator-only powers and user-facing mutations, which means a future rewrite needs an explicit safety model, audit boundary, and scope split instead of an incremental route handoff.
- Therefore the near-term policy is containment, not migration:
  - keep admin/chartools on the legacy multiroute runtime;
  - keep the public hardening boundary for `n=admin` intact;
  - allow targeted legacy compatibility fixes when needed, but do not treat admin/chartools as a prerequisite for the account/session/roster/transfer modernization wave.
- Minimum compatibility contract while admin/chartools stays legacy-owned:
  - `/classic|/tbc|/wotlk/index.php?n=admin` must stay outside the public contract and fail closed rather than become a partially modernized public surface;
  - authenticated chartools actions may remain legacy-owned while their behavior stays truthful about direct character mutations and does not claim modern safety guarantees that do not yet exist;
  - operator/admin failures must degrade without leaking raw SQL traces, PHP warnings, or internal file paths.
- Any future PHP 8 effort here should be planned as a dedicated replacement program with its own backlog, operator-role model, audit rules, mutation safety requirements, and acceptance gates, not as the next incremental public-page or account-page slice.

Donate/payment containment boundary:

- Donate/payment remains a legacy-owned payment subsystem rather than a first-wave PHP 8 slice.
- Reasons it is not part of the main PHP 8 route-slice wave:
  - the public contract already treats standalone `/donate.php` and prefixed donate entrypoints as hardened non-public/high-risk surfaces, so there is no requirement to reopen or modernize them before account/session/roster/transfer work proceeds;
  - the payment contour is not one isolated page: it spans the standalone PayPal IPN endpoint `donate.php`, community donate templates, admin donation-template and resend tools, and in-game fulfillment helpers;
  - `donate.php` still relies on direct `fsockopen()` back-calls to PayPal, raw `$_POST` payload handling, `mysql_*` writes, and debug-email side effects;
  - payment state and fulfillment still depend on legacy tables such as `paypal_payment_info`, `paypal_cart_info`, `paypal_subscription_info`, and `donations_template`, plus item-mail delivery logic through the legacy game-mail helpers;
  - this cluster mixes external payment verification, internal bookkeeping, and virtual-item fulfillment, so a future rewrite needs an explicit payment/provider strategy and fraud/safety model instead of an incremental route handoff.
- Therefore the near-term policy is containment, not migration:
  - keep donate/payment on the legacy multiroute runtime;
  - keep the public hardening boundary for standalone `donate.php` intact;
  - do not treat donate/payment as a prerequisite for the account/session/roster/transfer modernization wave.
- Minimum compatibility contract while donate/payment stays legacy-owned:
  - standalone `/donate.php` must stay outside the public contract and fail closed rather than become a partially modernized public payment surface;
  - any still-needed legacy donation behavior remains legacy-owned and truthful about payment completion versus item fulfillment state;
  - payment/operator failures must degrade without leaking raw SQL traces, PHP warnings, or internal file paths.
- Any future PHP 8 effort here should be planned as a dedicated replacement or retirement program with its own backlog, provider/security review, fulfillment contract, and acceptance gates, not as the next incremental public-page or account-page slice.

Operational consequences:

- The next planning step (`TASK-051`) should decompose modernization around these route/module boundaries instead of proposing one "upgrade the whole site" backlog card.
- The first prototype (`TASK-052`) should run as a companion slice beside the current live website runtime, not as a live runtime replacement.
