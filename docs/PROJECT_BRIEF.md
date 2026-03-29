# Опис Проєкту

```text
INIT_STATUS: COMPLETED
LAST_INIT_UPDATE: 2026-03-14
```

Цей файл зберігає довговічний результат `INIT:` для вже існуючого CMaNGOS-проєкту, який було перенесено в новий workflow template.

## Робоча назва

- `CMaNGOS Multi-Expansion Transfer Platform`

## Формулювання проблеми

- Потрібно підтримувати робочий набір з трьох CMaNGOS серверів у Docker на віддаленому ARM64-хості та безпечно переносити персонажів між Classic, TBC і WotLK.
- Паралельно потрібно було перенести попередній workflow-контекст у новий шаблон документації так, щоб наступний агент міг продовжити роботу без старих інструкцій і без втрати беклогу, доступів та технічних рішень.

## Чому існує цей проєкт

- Це персональний операційний проєкт Samuel Morgan для розгортання й підтримки multi-expansion WoW stack на `workspace`.
- Проєкт існує також як майданчик для повторюваного, перевірюваного transfer pipeline між експансіями з автоматичною валідацією логіну персонажа.

## Поточний цільовий результат

- Мати один канонічний комплект документації в кореневому `docs/`, який уже відображає verified reality після міграції docs, live runtime validation і повної Phase 15 stabilization.
- Тримати робочий 3-step pipeline `Classic → TBC verify → WotLK verify` у стабільному, документованому стані й рухатися далі до Phase 16 AzerothCore work з уже verified local container/login baseline без втрати continuation context.
- Мати окремий legacy-website container для `world-of-warcraft.morgan-dev.com`, який живе за `traefik` як public-mode surface, не ділить trust boundary з основними game/runtime контейнерами і вже задеплоєний на `workspace`.
- Мати reproducible browser-level audit для live website і working single-domain path-based website: public root `/` та `/index.php` canonical redirect-ять на `/classic/`, live surfaces працюють на `/classic/`, `/tbc/`, `/wotlk/`, а patch switcher усередині `#shared_topnav` показує лише реально доступні routes; AzerothCore тепер обслуговує canonical `/wotlk/`, а `/wotlk-azcore/` лишається лише legacy redirect alias на `/wotlk/`.
- Підготувати website account area до майбутнього self-service transfer flow, де користувач сам обирає персонажа і запускає `Transfer to TBC` або `Transfer to WotLK`, а запит до WotLK завжди виконується послідовним chain через TBC з прозорим status/history.
- Додати в logged-in website account базовий roster `My Characters`, щоб користувач бачив своїх персонажів по Classic/TBC/WotLK навіть без запуску transfer actions.
- Додати в logged-in website account окремий `Change Password` flow як частину базового account-management layer, а не як побічну деталь legacy pages.
- Дати формальну engineering-оцінку, чи варто переводити legacy website з `php:5.6-apache` на modern PHP track, і якщо так, то через incremental modernization, а не через неконтрольований big-bang rewrite.
- Для website modernization закріпити target architecture як route-level strangler: legacy PHP 5.6 runtime лишається shell/fallback, а новий PHP 8.x app layer поступово перебирає account/security/roster/transfer slices без full-site swap на старті.
- Розбити website modernization на explicit vertical slices: prototype gate, first-wave account/roster/transfer ownership, а Armory/forum/admin/donate тримати як окремі hold-zone tracks доти, доки для них не з'явиться окремий justified migration wave.

## Очікувані Результати

| Deliverable | Пріоритет | Definition of done |
|---|---|---|
| Канонічний workflow-control-plane | `P0` | Кореневі `docs/`, `workflow_config.md` і `remote_access.md` відображають актуальний verified context і придатні для continuation без chat history |
| Робочий 3-step transfer pipeline | `P0` | Classic→TBC→WotLK проходить через login verification між кроками; single-account, multi-account, class coverage і 3-run stability verified і задокументовані |
| Відновлений backlog | `P0` | `docs/BACKLOG.md` містить завершені docs/runtime/Phase 15 задачі й коректно вказує на наступний відкритий етап |
| Готовність до наступної хвилі розвитку | `P1` | Після завершення Phase 15 і `TASK-008`…`TASK-011` є documented ARM64-safe AzerothCore local baseline, migration SQL skeleton і verified login/auth support; далі можна без здогадок перейти до pipeline integration, E2E 4-step validation і optional Phase 17 backlog |
| Legacy website public-mode baseline | `P1` | `TASK-017` і `TASK-021` разом закривають verified intake repo, isolated container/deploy layer, WotLK-first DB contract і live HTTPS rollout через `traefik` |
| Website QA + multi-patch routing contract | `P1` | `TASK-023` дає Chromium/Playwright audit harness з consolidated reports, `TASK-024` фіксує path-prefix deploy contract, `TASK-025` викочує live patch surfaces, `TASK-026` canonicalize-ить public entrypoint через redirect `/ -> /classic/`, а `TASK-027` переводить canonical `/wotlk/` на AzerothCore backend; `/wotlk-azcore/` лишається лише redirect alias і не рекламується як окремий surface |
| Website self-service transfer control plane | `P1` | Користувач у logged-in website account має окремий roster `My Characters`, явний `Change Password` flow, може бачити eligible персонажів, запускати `Transfer to TBC` або `Transfer to WotLK`, отримувати прозорий progress/history, а backend виконує тільки safe sequential flow з audit trail, duplicate guards і admin kill-switch |
| Website modernization decision track | `P1` | Є verified feasibility assessment, compatibility debt inventory, chosen target architecture, explicit slice backlog (`TASK-052`, `TASK-056..TASK-064`), і окремо позначені hold zones; modernization не стартує як big-bang rewrite або full runtime swap без цього gate |

## Явні Винятки зі Scope

- Переписування CMaNGOS core або повна зміна продуктового напрямку.
- Видалення upstream/vendor markdown-документації всередині дзеркал репозиторіїв і `issues.wiki/`.
- Будь-які live-мутації на `workspace` без явної потреби й окремого погодження.

## Обмеження

- Час / дедлайн: `не зафіксовано; робота йде інкрементально`
- Бюджет / infra limit: `один віддалений ARM64 host + локальний workspace`
- Compliance / security limit: `доступ до runtime через SSH alias workspace з YubiKey; секрети не розпорошувати по docs`
- Обмеження стеку: `CMaNGOS, Docker Compose, MariaDB, Bash, Python, ARM64`
- Обмеження на апруви: `будь-які деструктивні DB/infra операції тільки після explicit user approval`

## Зовнішні системи / залежності

| Система | Чому важлива | Джерело доступу / контексту |
|---|---|---|
| `workspace` | Єдиний задокументований runtime для Classic/TBC/WotLK стеків | `remote_access.md` |
| Docker Hub `semorgana` | Джерело runtime images | `workflow_config.md`, legacy docs |
| `traefik` + Cloudflare-proxied DNS | Live HTTPS ingress для `world-of-warcraft.morgan-dev.com` | live `workspace` topology, `docs/ARCHITECTURE.md` |
| GitHub upstream repos (`cmangos/*`) | Code-level reference та source of truth для core behavior | `localProjects/cmangos_projects/`, `workflow_config.md` |
| MariaDB всередині remote Docker stack | Зберігання world / characters / realm / logs даних | `workflow_config.md`, `docs/ARCHITECTURE.md`, `docs/TRANSFER_SYSTEM.md` |

## Критерії успіху

- Новий агент може відкрити тільки цей шаблон і швидко зрозуміти доступи, архітектуру, беклог і критичні рішення без старої chat history.
- Унікальні legacy-документи не втрачені: або інтегровані в канонічні файли, або перенесені до `docs/` як окремі артефакти.
- `docs/BACKLOG.md` відображає реальний verified хвіст після завершених Phases 0–15, закритих `TASK-008`/`TASK-009`/`TASK-010`/`TASK-011`/`TASK-012`, website `TASK-017`/`TASK-021`/`TASK-022`/`TASK-023`/`TASK-024`/`TASK-025`, після чого основним відкритим technical track лишається AzerothCore E2E (`TASK-013`).
- High-level docs (`PROJECT_STATUS`, `PROJECT_BRIEF`, `CONTINUATION_GUIDE`) не містять pre-Phase-15 continuation hints і ведуть нового агента до поточного verified baseline.
- Migrated project-owned markdown у `localProjects/cmangos_projects` більше не потрібні для continuation; канонічний стан живе в root docs.

## Початкова гіпотеза модулів

- `DOCS` — канонічний workflow-control-plane
- `INFRA` — локальні Docker descriptors і remote runtime stacks
- `TRANSFER` — міграції персонажів, login bot, SQL, pipeline
- `SOURCE` — upstream mirrors, wiki, reference materials
- `OPS` — live remote operations, backups, timers

## Канонічний фрагмент наміру користувача

- Samuel Morgan як `Project Architect` ініціалізував новий шаблон і попросив інтегрувати всю документацію з `localProjects/cmangos_projects` у поточні кореневі docs.
- Legacy workflow-документація має вищий пріоритет при переносі; специфічні файли не можна втратити.
- Після відновлення спільного набору docs і актуального backlog-контексту дозволено прибрати migrated markdown із legacy-папки та працювати далі тільки через новий шаблон.
