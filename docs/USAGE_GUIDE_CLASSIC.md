# CMaNGOS Classic — Гід з Використання

> Мігрувано з legacy `usage-guide.md` `2026-03-14`.
> Команди оновлено під актуальний SSH alias `workspace`.
> Це додатковий operator guide; канонічний workflow усе одно ведеться через `BACKLOG.md`, `PROJECT_STATUS.md` і `COMMANDS_REFERENCE.md`.

> Сервер: `ssh workspace`
> Шлях: `/opt/cmangos-classic/`
> Docker Hub: `semorgana/cmangos-classic:latest`
> IP: `64.181.205.211`

---

## Зміст

1. [Архітектура](#1-архітектура)
2. [Щоденні Команди](#2-щоденні-команди)
3. [Акаунти](#3-акаунти)
4. [База Даних](#4-база-даних)
5. [Бекапи](#5-бекапи)
6. [Оновлення Сервера](#6-оновлення-сервера)
7. [Конфігурація](#7-конфігурація)
8. [Підключення Клієнта](#8-підключення-клієнта)
9. [Траблшутинг](#9-траблшутинг)

---

## 1. Архітектура

```
/opt/cmangos-classic/
├── docker-compose.yml
├── .env                        ← паролі, IP, overrides
├── data/                       ← 2.4GB карт (ro, bind mount)
├── etc/                        ← конфіги (rw, bind mount)
│   ├── mangosd.conf
│   ├── realmd.conf
│   └── anticheat.conf
├── logs/                       ← логи сервера
├── backups/                    ← бекапи БД
└── scripts/
    ├── cmangos.sh              ← головний CLI
    ├── update.sh               ← автооновлення (systemd timer)
    ├── entrypoint.sh           ← точка входу контейнера
    └── db-init.sh              ← ініціалізація БД
```

| Контейнер | Image | Порти |
|---|---|---|
| `cmangos-db` | `mariadb:lts` | 3306 |
| `cmangos-server` | `semorgana/cmangos-classic:latest` | 8085, 3724 |

База даних зберігається в Docker volume `cmangos-db-data`. Карти, конфіги та логи — bind mounts з хоста. Все переживає `docker compose down` та оновлення image.

---

## 2. Щоденні Команди

```bash
ssh workspace
cd /opt/cmangos-classic

./scripts/cmangos.sh start          # Запустити
./scripts/cmangos.sh stop           # Зупинити
./scripts/cmangos.sh restart        # Перезапустити (down + up)
./scripts/cmangos.sh status         # Статус + останні логи
./scripts/cmangos.sh logs           # Логи в реальному часі (Ctrl+C)
./scripts/cmangos.sh shell          # Bash всередині контейнера
./scripts/cmangos.sh version        # Версія сервера та classic-db
```

---

## 3. Акаунти

Автентифікація використовує SRP6 (поля `v` і `s` в таблиці `account`). Всі операції з акаунтами через `cmangos.sh`:

```bash
./scripts/cmangos.sh account create <name> <password>     # Створити
./scripts/cmangos.sh account password <name> <password>    # Змінити пароль
./scripts/cmangos.sh account gm <name> <level>             # GM рівень (0-3)
./scripts/cmangos.sh account list                          # Список акаунтів
./scripts/cmangos.sh account delete <name>                 # Видалити
```

GM рівні: 0 = гравець, 1 = модератор, 2 = гейммайстер, 3 = адміністратор.

---

## 4. База Даних

### Інтерактивна сесія

```bash
./scripts/cmangos.sh db
```

### Одноразовий запит

```bash
./scripts/cmangos.sh dbquery "SELECT COUNT(*) FROM classicmangos.creature_template"
```

### 4 бази

| База | Зміст |
|---|---|
| `classicmangos` | Світ: creatures, items, quests, loot |
| `classiccharacters` | Персонажі, інвентар, прогрес |
| `classicrealmd` | Акаунти, realmlist |
| `classiclogs` | Логи подій |

---

## 5. Бекапи

```bash
./scripts/cmangos.sh backup                              # Створити (зберігає останні 7)
./scripts/cmangos.sh restore backups/<файл>.sql          # Відновити
```

Бекап включає всі 4 бази. Зберігається в `/opt/cmangos-classic/backups/`.

---

## 6. Оновлення Сервера

### Автоматичне (активне)

Встановлено systemd timer — щодня о 03:00 (±5 хв jitter) перевіряється GitHub на нові коміти. Якщо є — бекап, перезбірка image, push в Docker Hub, рестарт.

```bash
./scripts/update.sh --status        # Статус таймера, наступний запуск
./scripts/update.sh --uninstall     # Вимкнути автооновлення
./scripts/update.sh --install       # Ввімкнути назад
```

При перезбірці entrypoint автоматично застосовує SQL-міграції з `sql/updates/`.

### Ручне

```bash
./scripts/update.sh                 # Перевірити та оновити зараз
```

Збірка займає ~20-30 хв (aarch64, `-j2`). Сервер працює до фінального кроку.

---

## 7. Конфігурація

### Файли конфігів

```
/opt/cmangos-classic/etc/mangosd.conf     ← сервер
/opt/cmangos-classic/etc/realmd.conf      ← логін
/opt/cmangos-classic/etc/anticheat.conf   ← античіт
```

Редагувати напряму, потім `./scripts/cmangos.sh restart`.

### .env overrides

В `/opt/cmangos-classic/.env` можна override налаштування без редагування `.conf`:

```bash
Mangosd_WorldServerPort=8085
Mangosd_Ra_Enable=1
```

### Змінити IP адресу

```bash
# 1. .env:
SERVER_PUBLIC_IP=<нова_IP>

# 2. Реалмліст в БД:
./scripts/cmangos.sh dbquery "UPDATE classicrealmd.realmlist SET address='<нова_IP>' WHERE id=1;"

# 3. Перезапуск:
./scripts/cmangos.sh restart
```

---

## 8. Підключення Клієнта

- WoW клієнт версії **1.12.1** (build 5875)
- Запускати `WoW.exe` напряму (без Launcher)
- У файлі `WTF/realmlist.wtf`:

```
set realmlist 64.181.205.211
```

---

## 9. Траблшутинг

### Сервер не стартує

```bash
./scripts/cmangos.sh logs           # Подивитись логи
./scripts/cmangos.sh restart        # Перезапустити
```

### "Waiting for MariaDB" в циклі

Перевірити що `MYSQL_ROOT_PASSWORD` в `.env` збігається з реальним паролем root в MariaDB. Якщо змінювали `.env` після першого запуску — потрібно змінити пароль і в БД:

```bash
docker exec cmangos-db mariadb -uroot -p<СТАРИЙ_ПАРОЛЬ> -e \
  "ALTER USER 'root'@'localhost' IDENTIFIED BY '<НОВИЙ_ПАРОЛЬ>';
   ALTER USER 'root'@'%' IDENTIFIED BY '<НОВИЙ_ПАРОЛЬ>';
   FLUSH PRIVILEGES;"
```

### Клієнт зависає на "Authenticating"

Неправильний пароль. Скинути:
```bash
./scripts/cmangos.sh account password <name> <password>
```

### Повний скид бази

```bash
# ⚠️ ВИДАЛИТЬ ВСЕ: персонажів, акаунти, прогрес!
./scripts/cmangos.sh stop
docker volume rm cmangos-db-data
./scripts/cmangos.sh start
# БД створюється автоматично при першому запуску
```

---

## 6. Трансфер персонажів між експансіями

Система дозволяє копіювати персонажів між Classic, TBC та WotLK серверами у будь-якому напрямку.

Скрипт: `/opt/cmangos-transfer/transfer-interactive.sh`

### Інтерактивний режим (за замовчуванням)

```bash
ssh workspace "bash /opt/cmangos-transfer/transfer-interactive.sh"
```

Далі скрипт запитає source, target, конкретних персонажів, підтвердження.

### CLI режим (one-liner, для скриптів та cron)

```bash
# Перенести Samuel з Classic на TBC
ssh workspace 'bash /opt/cmangos-transfer/transfer-interactive.sh classic tbc --chars Samuel --yes'

# Перенести кількох персонажів
ssh workspace 'bash /opt/cmangos-transfer/transfer-interactive.sh tbc wotlk --chars "Samuel,Neichao" --yes'

# Перенести всіх персонажів, без рестарту серверів
ssh workspace 'bash /opt/cmangos-transfer/transfer-interactive.sh classic tbc --all --yes --no-restart'

# Подивитись список персонажів на сервері
ssh workspace 'bash /opt/cmangos-transfer/transfer-interactive.sh classic --list'
```

### Опції

| Опція | Опис |
|---|---|
| `--chars <list>` | Імена або guid через кому |
| `--all` | Перенести всіх персонажів |
| `--yes` | Пропустити підтвердження |
| `--no-restart` | Не зупиняти/стартувати сервери |
| `--list` | Лише показати персонажів, без трансферу |
| `-h`, `--help` | Повна довідка |

### Що відбувається при трансфері

1. Graceful shutdown обох серверів (DB залишаються)
2. Backup цільової БД (`/opt/cmangos-transfer/backups/`)
3. Dump source character DB зі структурою
4. Імпорт у тимчасову БД на цільовому контейнері
5. Міграція схеми (ALTER TABLE, CREATE TABLE нових таблиць)
6. Мерж даних через `safe_insert()` з explicit column names
7. Очищення тимчасової БД, рестарт серверів

### Після трансферу

Персонажу потрібно:
1. Відвідати class trainer та перенавчити здібності
2. Скинути таланти: `.reset talents` (GM-команда)
3. Переналаштувати action bars
4. Деякі Classic-only предмети можуть не працювати

### Rollback

Кожен трансфер зберігає backup. Для відкату:
```bash
ssh workspace "docker exec -i cmangos-tbc-db mariadb -uroot -p'$DB_PASSWORD' tbccharacters < /opt/cmangos-transfer/backups/<TIMESTAMP>/tbccharacters_backup.sql"
```

## 7. Автоматичний щоденний синк

Systemd timer `cmangos-daily-sync.timer` автоматично синхронізує персонажів **Classic → TBC → WotLK** щодня о **04:00**.

### Конфігурація

Перелік акаунтів для синку задається в `/opt/cmangos-transfer/sync-accounts.conf`:

```
# Формат: USERNAME:PASSWORD
SAMUEL:TEST123
ADMIN:TEST123
```

Додати новий акаунт:
```bash
ssh workspace "echo 'NEWPLAYER:SECRET123' | sudo tee -a /opt/cmangos-transfer/sync-accounts.conf"
```

### Як працює

1. Зупиняє всі game-сервери (DB залишаються)
2. Для кожного акаунту з конфігу:
   - **Auto-create** акаунт на TBC/WotLK якщо відсутній (копіює SRP6 `s`/`v` → пароль ідентичний)
   - Знаходить усіх персонажів акаунту на source
   - Для кожного персонажа:
     - Обчислює MD5-хеш стану на target (level, xp, money, totaltime, items, spells, quests)
     - Порівнює з збереженим хешем
     - **Хеш змінився** → гравець грав → **SKIP**
     - **Хеш той самий** → безпечно перезаписати → **SYNC**
3. Classic→TBC, потім TBC→WotLK (незалежно один від одного)
4. Перезапускає всі сервери (навіть при помилці — через trap)

### Команди

```bash
# Перевірити статус таймера
ssh workspace "sudo systemctl status cmangos-daily-sync.timer"

# Переглянути лог останнього синку
ssh workspace "cat /opt/cmangos-transfer/logs/daily-sync-$(date +%Y%m%d).log"

# Запустити вручну (не чекаючи 04:00)
ssh workspace "sudo systemctl start cmangos-daily-sync.service"

# Переглянути хеші
ssh workspace "docker exec cmangos-tbc-db mariadb -uroot -p'$DB_PASSWORD' -e 'SELECT * FROM tbccharacters.character_sync_hash'"
ssh workspace "docker exec cmangos-wotlk-db mariadb -uroot -p'$DB_PASSWORD' -e 'SELECT * FROM wotlkcharacters.character_sync_hash'"

# Скинути хеш (щоб наступний синк примусово перезаписав)
ssh workspace "docker exec cmangos-tbc-db mariadb -uroot -p'$DB_PASSWORD' -e 'DELETE FROM tbccharacters.character_sync_hash'"

# Подивитись конфіг
ssh workspace "cat /opt/cmangos-transfer/sync-accounts.conf"
```

### Розклад таймерів

| Час | Сервіс |
|---|---|
| 03:00 | Classic DB update |
| 03:10 | TBC DB update |
| 03:20 | WotLK DB update |
| **04:00** | **Daily character sync** (Classic→TBC→WotLK) |
