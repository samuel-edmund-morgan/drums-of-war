# Модулі

Цей файл є картою координації для паралельної роботи.

## Правила

- Кожна задача беклогу повинна належати одному основному модулю.
- Кожен модуль має чітку межу шляхів або live-responsibility.
- Якщо робота торкається кількох модулів, вона розбивається на залежні задачі.
- `Project Architect` може працювати через усі модулі, але повинен фіксувати lock scope так само явно, як і будь-яка інша роль.
- Будь-які live remote-операції на `workspace` вважати non-parallel-safe, якщо вони торкаються тих самих контейнерів, БД або timer-ів.

## Мапа модулів конкретного проєкту

| Module ID | Назва в проєкті | Опис | Підконтрольні шляхи | Дозволені ролі | Примітки |
|---|---|---|---|---|---|
| `DOCS` | Workflow Control Plane | Канонічні docs, backlog, continuation, архіви legacy workflow | `docs/`, `workflow_config.md`, `remote_access.md`, `additionalContextFiles/` | `Documentation / Analyst`, `Project Architect` | Єдиний канон для continuation |
| `INFRA` | Multi-Expansion Runtime Descriptors | Локальні Docker descriptors та runtime wiring для Classic/TBC/WotLK | `localProjects/cmangos_projects/docker/`, `localProjects/cmangos_projects/docker-tbc/`, `localProjects/cmangos_projects/docker-wotlk/` | `DevOps / Infrastructure`, `Project Architect` | Будь-який remote deploy залежить від цього модуля |
| `TRANSFER` | Character Transfer Pipeline | SQL migration scripts, daily sync, login bot, SRP6 tooling, transfer docs | `localProjects/cmangos_projects/transfer/`, `docs/TRANSFER_SYSTEM.md` | `Backend Developer`, `DevOps / Infrastructure`, `QA / Test Automation`, `Project Architect` | Ключовий модуль для Phases 11–17 |
| `OPS` | Remote Runtime Operations | Живі операції на `workspace`, docker compose, timers, backups, DB queries | `workspace:/opt/cmangos-classic`, `workspace:/opt/cmangos-tbc`, `workspace:/opt/cmangos-wotlk`, `workspace:/opt/cmangos-transfer` | `DevOps / Infrastructure`, `Security / Compliance`, `Project Architect` | Non-parallel-safe за замовчуванням |
| `SOURCE` | Upstream Mirrors and Research | Reference codebases та wiki-матеріали для analysis | `localProjects/cmangos_projects/mangos-classic/`, `localProjects/cmangos_projects/issues.wiki/`, `localProjects/cmangos_projects/spp-classics-cmangos/` | `Documentation / Analyst`, `Backend Developer`, `Project Architect` | Read-only by default |

## Залежності між модулями

| Module ID | Залежить від | Parallel-safe з | Коментар |
|---|---|---|---|
| `DOCS` | усі модулі як джерела правди | `SOURCE`, частково `INFRA`, частково `TRANSFER` | Не parallel-safe, якщо кілька задач одночасно переписують один і той самий doc-файл |
| `INFRA` | `DOCS`, `SOURCE` | `DOCS` лише якщо не змінюються одні й ті самі описи | Реальні infra-правки часто потребують координації з `OPS` |
| `TRANSFER` | `INFRA`, `SOURCE` | `DOCS`, частково `SOURCE` | Runtime verify або daily-sync роблять задачу non-parallel-safe з `OPS` |
| `OPS` | `INFRA`, `TRANSFER` | майже ні з ким | Будь-яка жива зміна контейнерів, БД або timer-ів вимагає lock |
| `SOURCE` | — | майже з усіма | Read-only дослідження |

## Конвенція claim

Коли розробник починає роботу над задачею, у беклозі потрібно зафіксувати:

- ім'я виконавця;
- роль;
- machine label;
- touched paths;
- lock scope;
- чи є задача parallel-safe;
- чи потребує вона live-доступу до `workspace`.
