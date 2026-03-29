# Backlog — CMaNGOS Docker Deployment (Classic + TBC + WotLK)

> Docker Hub: **semorgana**  
> Target: ssh workspace-docker (aarch64)  
> Principle: **ZERO artifacts on host** — everything runs in containers.
>
> | Expansion | Source Repo | DB Repo | Deploy Path | Ports |
> |---|---|---|---|---|
> | Classic | mangos-classic | classic-db | `/opt/cmangos-classic/` | 8085 / 3724 / 3306 |
> | TBC | mangos-tbc | tbc-db | `/opt/cmangos-tbc/` | 8086 / 3725 / 3307 |
> | WotLK | mangos-wotlk | wotlk-db | `/opt/cmangos-wotlk/` | 8087 / 3726 / 3308 |

---

## Phase 0: Підготовка та Планування ✅

### 0.1 — [x] Підготувати робочу структуру на локальному macOS
- **Що:** Створити директорію `docker/` в `/Users/samuel/Development/Projects/cmangos_projects/` для всіх Docker-файлів.
- **Файли:** `docker/Dockerfile.build`, `docker/Dockerfile.server`, `docker/docker-compose.yml`, `docker/scripts/`, `docker/.env`
- **Чому:** Весь Docker-контент зберігається локально, потім деплоїться на ssh workspace-docker.
- **Контекст:** Згідно AGENTS.md п.5 — жодних артефактів на хості, окрім контейнерів.

### 0.2 — [x] Дослідити ARM-обмеження для екстракторів
> **Результат:** `^arm` regex НЕ збігається з `aarch64`. Екстрактори компілюються нативно на ARM64!
- **Що:** `CMakeLists.txt` (рядок з `CMAKE_SYSTEM_PROCESSOR MATCHES "^arm"`) явно вимикає `BUILD_EXTRACTORS` на ARM. Екстрактори (`ad`, `vmap_extractor`, `vmap_assembler`, `MoveMapGen`) **не компілюються нативно на aarch64**.
- **Рішення:** Використати **multi-stage Docker build**: 
  - Stage 1: `--platform=linux/amd64` контейнер з QEMU емуляцією для компіляції екстракторів та витягування map-даних з клієнта WoW.
  - Stage 2: `--platform=linux/arm64` нативний контейнер для компіляції серверних бінарників (`mangosd`, `realmd`).
- **Альтернатива:** Скомпілювати екстрактори на macOS x86 (Rosetta) або в окремому x86_64 Docker контейнері, витягнути карти, і використати готові дані.
- **Джерело:** `mangos-classic/CMakeLists.txt:438 рядків`, секція BUILD_EXTRACTORS.

### 0.3 — [x] Перевірити WoW клієнт на повноту даних
- **Що:** Перевірити що `Wow_client/Data/` містить всі необхідні MPQ файли для екстракції.
- **Файли для перевірки:**  
  - `base.MPQ`, `dbc.MPQ`, `terrain.MPQ`, `model.MPQ`, `texture.MPQ`, `wmo.MPQ`, `patch.MPQ`, `patch-2.MPQ`  
  - Директорія `Data` має починатися з великої `D` (case-sensitive для Linux).
- **Джерело:** `Installation-Instructions.asciidoc:917 рядків`, секція "Extract files from the client".

---

## Phase 1: Екстракція Карт (Map Extraction) ✅

### 1.1 — [x] Створити Dockerfile.extract для екстракції карт
- **Що:** Multi-stage Dockerfile для AMD64 платформи:
  ```
  FROM --platform=linux/amd64 ubuntu:22.04 AS extractor-build
  ```
- **Залежності для компіляції (з Installation-Instructions.asciidoc та ubuntu.yml CI):**
  ```
  build-essential gcc g++ automake git-core autoconf make patch 
  libmysql++-dev libtool libssl-dev grep binutils zlib1g-dev 
  libbz2-dev cmake libboost-all-dev
  ```
- **CMake команда:**
  ```bash
  cmake /src/mangos-classic \
    -DCMAKE_INSTALL_PREFIX=/opt/cmangos \
    -DBUILD_EXTRACTORS=ON \
    -DBUILD_GAME_SERVER=OFF \
    -DBUILD_LOGIN_SERVER=OFF \
    -DPCH=1 \
    -DDEBUG=0
  make -j$(nproc)
  make install
  ```
- **Результат:** Бінарники екстракторів в `/opt/cmangos/bin/tools/`: `ad`, `vmap_extractor`, `vmap_assembler`, `MoveMapGen`  
- **Скрипти:** `ExtractResources.sh` (301 рядок), `MoveMapGen.sh` (135 рядків), `config.json` (48 рядків), `offmesh.txt` (8 рядків) — з `mangos-classic/contrib/extractor_scripts/`.
- **Джерело:** `CMakeLists.txt`, `ubuntu.yml` CI, `ExtractResources.sh`.

### 1.2 — [x] Запустити екстракцію map-даних всередині контейнера
> **Результат:** dbc: 160, maps: 2431, vmaps: 6079, mmaps: 2022, Buildings: 3915, Cameras: 12 файлів.
- **Що:** Змонтувати `Wow_client/` в контейнер і запустити екстракцію.
- **Команди всередині контейнера:**
  ```bash
  cp /opt/cmangos/bin/tools/* /wow/
  cp /src/mangos-classic/contrib/extractor_scripts/* /wow/
  cd /wow
  chmod +x ExtractResources.sh MoveMapGen.sh
  bash ./ExtractResources.sh
  ```
- **Вхід (volume mount):** `./Wow_client:/wow`
- **Вихід:** Директорії `dbc/`, `maps/`, `Buildings/`, `vmaps/`, `mmaps/`, `Cameras/` в `/wow/`
- **Час:** `mmaps` генерація може зайняти кілька годин (MoveMapGen.exe.md: 104 рядки). Використовувати `--silent` прапорець та `--threads N` для паралелізації.
- **Примітка:** `Buildings/` — тимчасова директорія для `vmap_assembler`, після генерації `vmaps` її можна видалити. Але згідно AGENTS.md п.2 — залишаємо.
- **Джерело:** `ExtractResources.sh:301`, `MoveMapGen.sh:135`, `MoveMapGen.exe.md:104`.

### 1.3 — [x] Скопіювати витягнуті карти на хост
> **Результат:** 2.4GB даних скопійовано в /opt/cmangos-classic/data/ на remote.
- **Що:** Після екстракції скопіювати `dbc/`, `maps/`, `vmaps/`, `mmaps/`, `Cameras/`, `Buildings/` з контейнера.
- **Куди:** `/opt/cmangos-classic/data/` на ssh workspace-docker (або спочатку локально, потім SCP).
- **Верифікація:** Перевірити що всі 6 директорій не пусті.
- **Після цього:** Видалити контейнер-екстрактор (згідно AGENTS.md п.5 — прибрати артефакти).

---

## Phase 2: Компіляція Серверу (Server Build) ✅

### 2.1 — [x] Створити Dockerfile.build для серверних бінарників (aarch64)
- **Що:** Dockerfile для ARM64 платформи для компіляції `mangosd` і `realmd`.
  ```
  FROM ubuntu:22.04 AS server-build
  ```
- **Залежності:** ті ж що в 1.1 плюс `libmysqlclient-dev` (або `libmariadb-dev`).
- **CMake команда:**
  ```bash
  cmake /src/mangos-classic \
    -DCMAKE_INSTALL_PREFIX=/opt/cmangos \
    -DBUILD_EXTRACTORS=OFF \
    -DBUILD_GAME_SERVER=ON \
    -DBUILD_LOGIN_SERVER=ON \
    -DBUILD_PLAYERBOTS=ON \
    -DBUILD_AHBOT=ON \
    -DPCH=1 \
    -DDEBUG=0
  make -j$(nproc)
  make install
  ```
- **Результат:**
  - `/opt/cmangos/bin/mangosd` — ігровий сервер
  - `/opt/cmangos/bin/realmd` — логін сервер
  - `/opt/cmangos/etc/mangosd.conf.dist` — шаблон конфігу mangosd
  - `/opt/cmangos/etc/realmd.conf.dist` — шаблон конфігу realmd
  - `/opt/cmangos/etc/anticheat.conf.dist` — шаблон античіту
  - `/opt/cmangos/etc/ahbot.conf.dist` — шаблон AH бота
  - `/opt/cmangos/etc/playerbot.conf.dist` — шаблон плеєрботів
  - `/opt/cmangos/etc/mods.conf.dist` — шаблон модів
- **C++ стандарт:** C++20 (CMakeLists.txt). **CMake ≥ 3.16**. **Boost ≥ 1.70**. **OpenSSL ≥ 3.0**.
- **Джерело:** `CMakeLists.txt:438`, `ubuntu.yml:114`, `mangosd.conf.dist.in:1793`, `realmd.conf.dist.in:149`.

### 2.2 — [x] Створити Dockerfile.server (фінальний runtime image)
> **Результат:** Multi-stage: builder→db-prep→runtime. 741MB. `-j2` для запобігання OOM.
- **Що:** Легкий runtime образ без компілятора та інструментів збірки.
  ```
  FROM ubuntu:22.04 AS runtime
  RUN apt-get update && apt-get install -y --no-install-recommends \
    libmysqlclient21 libssl3 libboost-system1.74.0 \
    libboost-program-options1.74.0 libboost-thread1.74.0 \
    libboost-regex1.74.0 libboost-serialization1.74.0 \
    libboost-filesystem1.74.0 && rm -rf /var/lib/apt/lists/*
  COPY --from=server-build /opt/cmangos/bin/ /opt/cmangos/bin/
  COPY --from=server-build /opt/cmangos/etc/ /opt/cmangos/etc/
  ```
- **Копіювати з build stage:** тільки бінарники + конфіги.
- **EXPOSE:** `8085` (world server), `3724` (realm/login server).
- **ENTRYPOINT:** Скрипт `entrypoint.sh` який:
  1. Копіює `.conf.dist` → `.conf` якщо `.conf` не існує
  2. Чекає на готовність MySQL (healthcheck loop)
  3. Запускає `realmd` в background
  4. Запускає `mangosd` в foreground
- **Критично:** `Console.Enable = 0` в `mangosd.conf` для Docker (без інтерактивної консолі). Джерело: `Creating-a-systemd-service.md:129`.
- **Environment variables override:** mangosd.conf підтримує override через env vars:
  - `Mangosd_LoginDatabaseInfo`, `Mangosd_WorldDatabaseInfo`, `Mangosd_CharacterDatabaseInfo`, `Mangosd_LogsDatabaseInfo`
  - `Mangosd_DataDir`, `Mangosd_Console_Enable`
  - `Realmd_LoginDatabaseInfo`
  - `Anticheat_Enable`
- **Docker Hub image name:** `semorgana/cmangos-classic:latest`
- **Джерело:** `mangosd.conf.dist.in:1793`, `realmd.conf.dist.in:149`, `anticheat.conf.dist.in:380`.

### 2.3 — [x] Зібрати та запушити Docker image
> **Результат:** semorgana/cmangos-classic:latest pushed to Docker Hub.
- **Що:** Зібрати image на ssh workspace-docker (aarch64 нативно) та запушити в Docker Hub.
- **Команди:**
  ```bash
  docker build -t semorgana/cmangos-classic:latest -f Dockerfile.server .
  docker push semorgana/cmangos-classic:latest
  ```
- **Альтернатива:** Використати `docker buildx build --platform linux/arm64` якщо збираємо з macOS.

---

## Phase 3: База Даних (Database Setup) ✅

### 3.1 — [x] Вибрати MariaDB vs MySQL для контейнера
> **Результат:** MariaDB LTS обрано.
- **Що:** MariaDB краще для ARM64 — є офіційні ARM images (`mariadb:lts`). MySQL на ARM обмежений.
- **Рішення:** MariaDB (рекомендовано для aarch64).
- **Джерело:** AGENTS.md п.2 — "mysql чи mariadb не памʼятаю що для проєкта краще". Debian інструкція в Installation-Instructions використовує MariaDB.

### 3.2 — [x] Створити скрипт ініціалізації БД
> **Результат:** db-init.sh з 6 кроками. КРИТИЧНИЙ ФІКС: InstallFullDB.sh потребує MYSQL_HOST, MYSQL_USERNAME, MYSQL_PATH (не MANGOS_DBHOST і т.д.).
- **Що:** SQL скрипт для створення 4-х баз + користувача з мережевим доступом.
- **Оригінальний скрипт** `db_create_mysql.sql` (16 рядків) створює:
  - `classicmangos` — world database
  - `classiccharacters` — characters database
  - `classicrealmd` — realm/login database
  - `classiclogs` — logs database
  - User: `mangos`@`localhost` / password: `mangos`
- **Зміни для Docker:**
  - `'mangos'@'localhost'` → `'mangos'@'%'` (контейнерна мережа)
  - Або використовувати `MYSQL_USER`, `MYSQL_PASSWORD` env vars MariaDB image
- **Джерело:** `sql/create/db_create_mysql.sql:16`.

### 3.3 — [x] Створити скрипт заповнення бази
> **Результат:** 193 таблиці, 10384 creature templates, 151791 loot entries, 4245 quests, 11104 broadcast_text.
- **Що:** Автоматизувати наповнення world database даними з classic-db.
- **Кроки:**
  1. Виконати `sql/base/mangos.sql` (14,347 рядків) — сructure world DB
  2. Виконати `sql/base/characters.sql` (1,492 рядки) — structure characters DB
  3. Виконати `sql/base/realmd.sql` (503 рядки) — structure realm DB
  4. Виконати `sql/base/logs.sql` (48 рядків) — structure logs DB
  5. Клонувати `classic-db` та запустити `InstallFullDB.sh` для заповнення world data
  6. Виконати SQL updates з `mangos-classic/sql/updates/`
- **Контейнер:** Окремий init-контейнер або Docker entrypoint з one-time init.
- **Конфігурація InstallFullDB.sh:**
  ```
  MANGOS_DBHOST="cmangos-db"  (ім'я контейнера MariaDB)
  MANGOS_DBNAME="classicmangos"
  MANGOS_DBUSER="mangos"
  MANGOS_DBPASS="mangos"
  CORE_PATH="/opt/cmangos/mangos-classic"
  ```
- **Джерело:** `Installation-Instructions.asciidoc:455-630`, `sql/base/*.sql`.

### 3.4 — [x] Налаштувати persistent storage для MariaDB
> **Результат:** Docker volume `cmangos-db-data`.
- **Що:** Docker volume для даних MariaDB щоб дані зберігались між перезапусками.
- **Volume:** `cmangos-db-data:/var/lib/mysql`
- **Backup стратегія:** Окремий скрипт для `mysqldump` всіх 4-х баз.
- **Джерело:** AGENTS.md п.2 — "директорія з файлами бази даних mysql".

### 3.5 — [x] Вставити realmlist запис
> **Результат:** 'CMaNGOS Classic' realm, address=127.0.0.1, port=8085.
- **Що:** Після ініціалізації БД вставити запис в `classicrealmd.realmlist`:
  ```sql
  DELETE FROM realmlist WHERE id=1;
  INSERT INTO realmlist (id, name, address, port, icon, realmflags, timezone, allowedSecurityLevel)
  VALUES ('1', 'CMaNGOS Classic', '0.0.0.0', '8085', '1', '0', '1', '0');
  ```
- **Примітка:** `address` має бути публічною IP-адресою сервера або `0.0.0.0` для Docker.
- **Джерело:** `Installation-Instructions.asciidoc:751-770`, `FAQ-Frequently-Asked-Questions.md:138`.

---

## Phase 4: Docker Compose та Deployment ✅

### 4.1 — [x] Створити docker-compose.yml
> **Результат:** 2 сервіси: cmangos-db (mariadb:lts), cmangos-server (semorgana/cmangos-classic:latest).
- **Що:** Файл `/opt/cmangos-classic/docker-compose.yml` з 2 сервісами:
  ```yaml
  version: '3.8'
  services:
    cmangos-db:
      image: mariadb:lts
      container_name: cmangos-db
      restart: unless-stopped
      environment:
        MYSQL_ROOT_PASSWORD: "${MYSQL_ROOT_PASSWORD}"
        MYSQL_USER: mangos
        MYSQL_PASSWORD: mangos
      volumes:
        - cmangos-db-data:/var/lib/mysql
        - ./sql/init:/docker-entrypoint-initdb.d
      ports:
        - "3306:3306"  # опціонально, для зовнішнього доступу
      healthcheck:
        test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
        interval: 10s
        timeout: 5s
        retries: 10

    cmangos-server:
      image: semorgana/cmangos-classic:latest
      container_name: cmangos-server
      restart: unless-stopped
      depends_on:
        cmangos-db:
          condition: service_healthy
      environment:
        - Mangosd_LoginDatabaseInfo=cmangos-db;3306;mangos;mangos;classicrealmd
        - Mangosd_WorldDatabaseInfo=cmangos-db;3306;mangos;mangos;classicmangos
        - Mangosd_CharacterDatabaseInfo=cmangos-db;3306;mangos;mangos;classiccharacters
        - Mangosd_LogsDatabaseInfo=cmangos-db;3306;mangos;mangos;classiclogs
        - Mangosd_DataDir=/opt/cmangos/data
        - Mangosd_Console_Enable=0
        - Realmd_LoginDatabaseInfo=cmangos-db;3306;mangos;mangos;classicrealmd
      volumes:
        - ./data:/opt/cmangos/data:ro
        - ./etc:/opt/cmangos/etc
        - ./logs:/opt/cmangos/logs
      ports:
        - "8085:8085"   # World Server
        - "3724:3724"   # Login/Realm Server
      stop_grace_period: 30s  # graceful shutdown

  volumes:
    cmangos-db-data:
  ```
- **Конфіг файли:** `./etc/mangosd.conf`, `./etc/realmd.conf`, `./etc/anticheat.conf` — volume mount.
- **Map дані:** `./data/` mount read-only з `dbc/`, `maps/`, `vmaps/`, `mmaps/`, `Cameras/`, `Buildings/`.
- **Ports:** `8085` (mangosd WorldServerPort), `3724` (realmd RealmServerPort).
- **stop_grace_period: 30s** — graceful shutdown для збереження БД (AGENTS.md п.4).
- **Джерело:** AGENTS.md п.1-2, `mangosd.conf.dist.in:1793`, `realmd.conf.dist.in:149`.

### 4.2 — [x] Створити .env файл
- **Що:** Змінні середовища для Docker Compose:
  ```
  MYSQL_ROOT_PASSWORD=<secure_password>
  SERVER_PUBLIC_IP=<public_ip_of_ssh_workspace>
  ```
- **Безпека:** `.env` не пушити в git. Додати в `.gitignore`.

### 4.3 — [x] Створити entrypoint.sh для серверного контейнера
- **Що:** Скрипт який:
  1. Перевіряє існування конфіг файлів, копіює з `.dist` якщо відсутні
  2. Чекає готовності MySQL через loop з `mysql -h cmangos-db -u mangos -pmangos -e "SELECT 1"`
  3. Запускає `/opt/cmangos/bin/realmd -c /opt/cmangos/etc/realmd.conf &` (background)
  4. Запускає `/opt/cmangos/bin/mangosd -c /opt/cmangos/etc/mangosd.conf` (foreground)
  5. Обробляє SIGTERM для graceful shutdown обох процесів
- **Graceful shutdown:** Перехоплювати `SIGTERM` → надіслати `.server shutdown 0` або `kill -TERM` → дочекатись завершення.
- **Джерело:** `Creating-a-systemd-service.md:129`, AGENTS.md п.4.

### 4.4 — [x] Створити конфігураційні файли
- **Що:** Створити готові `.conf` файли на основі `.conf.dist.in` шаблонів:
  - `etc/mangosd.conf` — з правильними DB connection strings для Docker мережі:
    - `LoginDatabaseInfo = "cmangos-db;3306;mangos;mangos;classicrealmd"`
    - `WorldDatabaseInfo = "cmangos-db;3306;mangos;mangos;classicmangos"`
    - `CharacterDatabaseInfo = "cmangos-db;3306;mangos;mangos;classiccharacters"`
    - `LogsDatabaseInfo = "cmangos-db;3306;mangos;mangos;classiclogs"`
    - `DataDir = "/opt/cmangos/data"`
    - `LogsDir = "/opt/cmangos/logs"`
    - `Console.Enable = 0`
    - `BindIP = "0.0.0.0"`
    - `WorldServerPort = 8085`
    - `RealmID = 1`
  - `etc/realmd.conf`:
    - `LoginDatabaseInfo = "cmangos-db;3306;mangos;mangos;classicrealmd"`
    - `RealmServerPort = 3724`
    - `BindIP = "0.0.0.0"`
  - `etc/anticheat.conf` — з дефолтними значеннями з `anticheat.conf.dist.in` (380 рядків)
  - `etc/ahbot.conf` — дефолт (198 рядків)
  - `etc/playerbot.conf` — дефолт (91 рядок)
  - `etc/mods.conf` — дефолт (18 рядків)
- **Джерело:** `mangosd.conf.dist.in:1793`, `realmd.conf.dist.in:149`, `anticheat.conf.dist.in:380`, `ahbot.conf.dist.in:198`, `playerbot.conf.dist.in:91`, `mods.conf.dist.in:18`.

### 4.5 — [x] Деплой на ssh workspace-docker
> **Результат:** /opt/cmangos-classic/ з усіма даними та конфігами.
- **Що:** Скопіювати всі файли на сервер:
  ```
  /opt/cmangos-classic/
  ├── docker-compose.yml
  ├── .env
  ├── data/
  │   ├── dbc/
  │   ├── maps/
  │   ├── vmaps/
  │   ├── mmaps/
  │   ├── Cameras/
  │   └── Buildings/
  ├── etc/
  │   ├── mangosd.conf
  │   ├── realmd.conf
  │   ├── anticheat.conf
  │   ├── ahbot.conf
  │   ├── playerbot.conf
  │   └── mods.conf
  ├── logs/
  └── sql/
      └── init/
          ├── 01-create-databases.sql
          ├── 02-mangos-schema.sql
          ├── 03-characters-schema.sql
          ├── 04-realmd-schema.sql
          ├── 05-logs-schema.sql
          └── 06-realmlist.sql
  ```
- **Команда запуску:**
  ```bash
  cd /opt/cmangos-classic && docker compose up -d
  ```

### 4.6 — [x] Перевірити що сервер запускається та працює
> **Результат:** "CMANGOS: World initialized" за 2 секунди. Both containers healthy.
> **Акаунт:** ADMIN (GM level 3, pass: admin) створено через SRP6.
- **Тести:**
  1. `docker compose ps` — обидва контейнери running
  2. `docker compose logs cmangos-server` — немає помилок, "World initialized"
  3. `docker compose logs cmangos-db` — MariaDB ready for connections
  4. Перевірити порти: `curl -v telnet://localhost:3724` та `curl -v telnet://localhost:8085`
  5. Створити акаунт: `docker exec -it cmangos-server /opt/cmangos/bin/mangosd` (або через remote console)
- **Джерело:** `Installation-Instructions.asciidoc:850-918`, `FAQ-Frequently-Asked-Questions.md:138`.

---

## Phase 5: Зручні Команди (User Commands) ✅

### 5.1 — [x] Команди для доступу до бази даних
- **Що:** Створити shell-aliases або скрипти для зручного доступу до БД через контейнер.
- **Команди:**
  ```bash
  # Підключення до MariaDB через контейнер
  docker exec -it cmangos-db mysql -u mangos -pmangos

  # Виконати SQL запит
  docker exec -it cmangos-db mysql -u mangos -pmangos -e "USE classicmangos; SELECT * FROM db_version;"

  # Backup всіх баз
  docker exec cmangos-db mysqldump -u root -p${MYSQL_ROOT_PASSWORD} --all-databases > backup_$(date +%Y%m%d).sql

  # Restore
  docker exec -i cmangos-db mysql -u root -p${MYSQL_ROOT_PASSWORD} < backup_file.sql

  # Створити акаунт через mangosd console
  docker exec cmangos-server /opt/cmangos/bin/mangosd <<< "account create MyAccount MyPassword"

  # Встановити GM рівень
  docker exec cmangos-server /opt/cmangos/bin/mangosd <<< "account set gmlevel MyAccount 3"
  ```
- **Джерело:** AGENTS.md п.3, `Installation-Instructions.asciidoc:860-890`.

### 5.2 — [x] Створити helper-скрипт cmangos.sh
> **Результат:** /opt/cmangos-classic/scripts/cmangos.sh з усіма підкомандами.
- **Що:** Один скрипт `/opt/cmangos-classic/cmangos.sh` з підкомандами:
  ```bash
  ./cmangos.sh start          # docker compose up -d
  ./cmangos.sh stop           # docker compose down
  ./cmangos.sh restart        # docker compose restart
  ./cmangos.sh logs           # docker compose logs -f
  ./cmangos.sh db             # docker exec -it cmangos-db mysql -u mangos -pmangos
  ./cmangos.sh backup         # mysqldump через контейнер
  ./cmangos.sh account create <name> <pass>  # створити акаунт
  ./cmangos.sh account gm <name> <level>     # встановити GM
  ./cmangos.sh status         # docker compose ps + останні логи
  ./cmangos.sh update         # перевірити оновлення та перезбирати
  ```

---

## Phase 6: Автоматичне Оновлення (Auto-Update) ✅

### 6.1 — [x] Створити скрипт оновлення update.sh
> **Результат:** /opt/cmangos-classic/scripts/update.sh з --watch, --cron, --systemd режимами.
- **Що:** Скрипт який:
  1. Перевіряє наявність нових комітів в `https://github.com/cmangos/mangos-classic.git` (master branch)
  2. Якщо є нові коміти:
     a. `git pull` в локальній копії mangos-classic
     b. Rebuilds Docker image `semorgana/cmangos-classic:latest`
     c. Pushes to Docker Hub: `docker push semorgana/cmangos-classic:latest`
     d. На ssh workspace-docker:
        - Graceful shutdown: `docker compose exec cmangos-server /opt/cmangos/bin/mangosd <<< ".server shutdown 30"` (30 секунд затримка)
        - Дочекатись завершення
        - `docker compose pull`
        - `docker compose up -d`
  3. Якщо є нові коміти в `classic-db`:
     a. `git pull` classic-db
     b. Запустити `InstallFullDB.sh` в контейнері для оновлення world DB
- **Graceful shutdown обовʼязковий** — AGENTS.md п.4: "контейнер має gracefull shutdown щоб не пошкодити базу даних і в грі не ставались відкати."
- **Джерело:** AGENTS.md п.4, `FAQ-Frequently-Asked-Questions.md:138` (update process).

### 6.2 — [x] Налаштувати автоматичний моніторинг оновлень
> **Результат:** update.sh --watch режим (перевірка кожні 6 годин).
- **Що:** Сервіс (cron job або окремий контейнер) який періодично перевіряє нові коміти.
- **Варіанти:**
  a. **Cron на ssh workspace-docker:** (порушує принцип "жодних артефактів") — НЕ РЕКОМЕНДОВАНО
  b. **Watchtower контейнер:** Моніторить Docker Hub image, автоматично оновлює. Але не збирає image.
  c. **Окремий контейнер-чекер:** Docker контейнер з cron який:
     - Кожні N хвилин/годин: `git ls-remote https://github.com/cmangos/mangos-classic.git HEAD`
     - Порівнює з збереженим хешем
     - Якщо різний — тригерить webhook або запускає rebuild
  d. **GitHub Actions:** Налаштувати workflow в fork/окремому repo який збирає image на push в upstream
- **Рекомендація:** Варіант (c) — контейнер-чекер. Зберігає принцип "жодних артефактів на хості".
- **Джерело:** AGENTS.md п.4-5.

### 6.3 — [ ] Створити Dockerfile.updater для контейнера-чекера
> **Статус:** Опціонально. update.sh покриває основний функціонал.
- **Що:** Легкий контейнер з git + docker CLI:
  ```dockerfile
  FROM alpine:latest
  RUN apk add --no-cache git docker-cli curl bash
  COPY check-updates.sh /usr/local/bin/
  COPY crontab /etc/crontabs/root
  CMD ["crond", "-f"]
  ```
- **check-updates.sh:**
  1. `git ls-remote https://github.com/cmangos/mangos-classic.git HEAD` → отримати SHA
  2. Порівняти з `/data/last-commit-sha`
  3. Якщо різні → виконати rebuild через Docker socket або webhook
- **Volume:** Docker socket mount для управління контейнерами: `/var/run/docker.sock:/var/run/docker.sock`
- **Додати в docker-compose.yml** як третій сервіс `cmangos-updater`.

---

## Phase 7: Очистка та Фіналізація ✅

### 7.1 — [x] Видалити всі тимчасові контейнери та images
> **Результат:** 185MB reclaimed. Тільки semorgana/cmangos-classic:latest та mariadb:lts залишились.
- **Що:** Після успішного деплою прибрати всі build-артефакти:
  ```bash
  docker system prune -a --volumes  # видалити невикористані images, containers, volumes
  docker image rm <build-images>     # видалити build images
  ```
- **Залишити тільки:**
  - `semorgana/cmangos-classic:latest` — серверний image
  - `mariadb:lts` — image БД
  - Volumes з даними БД
- **Джерело:** AGENTS.md п.5 — "підчистити старі контейнери які використовувались для інсталяції."

### 7.2 — [x] Верифікувати відсутність артефактів на хості
> **Результат:** Жодних встановлених пакетів, тільки Docker + /opt/cmangos-classic/.
- **Що:** Перевірити що на ssh workspace-docker немає:
  - Встановлених пакетів (gcc, cmake, boost, mysql-client тощо)
  - Скомпільованих бінарників поза контейнерами
  - Тимчасових файлів збірки
- **Що має бути:**
  - `/opt/cmangos-classic/` з `docker-compose.yml`, конфігами, map-даними
  - Docker images: `semorgana/cmangos-classic:latest`, `mariadb:lts`
  - Docker volumes: `cmangos-db-data`
- **Джерело:** AGENTS.md п.5.

### 7.3 — [x] Документувати фінальну структуру
- **Що:** Оновити цей backlog з фінальною структурою, командами, та інструкціями.

---

## Phase 8: Операційні Процедури ✅

### 8.1 — [x] Процедура першого запуску
1. SSH на workspace-docker
2. `cd /opt/cmangos-classic`
3. `docker compose up -d`
4. Дочекатись ініціалізації БД (перший запуск ~5-10 хвилин)
5. Створити акаунт: `docker exec -it cmangos-server ...`
6. Налаштувати клієнт: `realmlist.wtf` → `set realmlist <server_ip>`
7. Запустити WoW.exe (не Launcher!)

### 8.2 — [x] Процедура бекапу
1. `docker exec cmangos-db mysqldump -u root -p<password> --all-databases > /opt/cmangos-classic/backups/backup_$(date +%Y%m%d_%H%M%S).sql`
2. Ротація: зберігати останні 7 бекапів
3. Можна автоматизувати через cron в контейнері

### 8.3 — [x] Процедура відновлення з бекапу
1. `docker compose down`
2. Видалити volume: `docker volume rm cmangos-classic_cmangos-db-data`
3. `docker compose up -d cmangos-db`
4. Дочекатись запуску MariaDB
5. `docker exec -i cmangos-db mysql -u root -p<password> < backup_file.sql`
6. `docker compose up -d`

### 8.4 — [x] Процедура graceful restart
1. `docker compose exec cmangos-server /opt/cmangos/bin/mangosd <<< ".server shutdown 30"`
2. Дочекатись 30 секунд (гравці отримають повідомлення)
3. `docker compose restart cmangos-server`

---

## Ключові Знахідки з Аналізу Проєкту

| Параметр | Значення | Джерело |
|---|---|---|
| C++ стандарт | C++20 | CMakeLists.txt |
| CMake мінімум | 3.16 | CMakeLists.txt |
| Boost мінімум | 1.70 | CMakeLists.txt |
| OpenSSL | ≥ 3.0 | CMakeLists.txt |
| ARM екстрактори | **НЕ ПІДТРИМУЮТЬСЯ** | CMakeLists.txt |
| World Server порт | 8085 | mangosd.conf.dist.in |
| Realm Server порт | 3724 | realmd.conf.dist.in |
| БД Classic | classicmangos / classiccharacters / classicrealmd / classiclogs | db_create_mysql.sql |
| БД TBC | tbcmangos / tbccharacters / tbcrealmd / tbclogs | docker-tbc |
| БД WotLK | wotlkmangos / wotlkcharacters / wotlkrealmd / wotlklogs | docker-wotlk |
| DB User | mangos / mangos | db_create_mysql.sql |
| Console для Docker | Console.Enable = 0 | Creating-a-systemd-service.md |
| MoveMapGen silent | --silent | MoveMapGen.exe.md |
| Env var overrides | Mangosd_*, Realmd_*, Anticheat_* | *.conf.dist.in |
| Config files | 6 файлів (.conf) | conf.dist.in templates |
| Map data dirs | 6 директорій | Installation-Instructions.asciidoc |
| Docker Hub | semorgana | AGENTS.md |
| Архітектура | aarch64 | AGENTS.md |

---

## Phase 9: TBC Server Deployment ✅

> Replicated from Classic setup. Maps pre-extracted manually at `/opt/cmangos-tbc/data/`.

### 9.1 — [x] Створити Docker файли для TBC
- **Що:** `docker-tbc/` — повна копія `docker/` з адаптацією для TBC:
  - `Dockerfile.server` → `mangos-tbc` repo, `tbc-db` repo
  - `docker-compose.yml` → контейнери `cmangos-tbc-db`, `cmangos-tbc-server`, мережа `cmangos-tbc-net`, volume `cmangos-tbc-db-data`
  - Порти: 8086 (world), 3725 (realm), 3307 (DB)
  - БД: `tbcmangos`, `tbccharacters`, `tbcrealmd`, `tbclogs`
  - Scripts: `entrypoint.sh`, `db-init.sh`, `cmangos.sh`, `update.sh` — всі адаптовані для TBC

### 9.2 — [x] Побудувати та запушити TBC Docker image
- **Image:** `semorgana/cmangos-tbc:latest` (1.36 GB, arm64)
- **Build:** `docker build -t semorgana/cmangos-tbc:latest -f Dockerfile.server .`
- **Push:** `docker push semorgana/cmangos-tbc:latest`

### 9.3 — [x] Задеплоїти TBC на remote
- **Що:** Скопіювати `docker-compose.yml`, scripts, `.env` на `/opt/cmangos-tbc/`
- **Дані:** Maps вже на remote в `/opt/cmangos-tbc/data/` (Cameras, dbc, maps, mmaps, vmaps)
- **Проблема:** Дозволи `drwx------` на data directories — mangos user не міг читати. Виправлено: `chmod -R o+rX`

### 9.4 — [x] Запустити та верифікувати TBC
- **DB init:** InstallFullDB.sh — "TBCDB_1.10.0_ReturnOfTheVengeance.sql" + updates
- **Статус:** "CMANGOS: World initialized" за 5 секунд
- **Акаунти:** ADMIN (gm3, pass: `$DB_PASSWORD`), SAMUEL (gm0, pass: `samuel`)
- **Default акаунти видалено:** ADMINISTRATOR, GAMEMASTER, MODERATOR, PLAYER

### 9.5 — [x] Встановити systemd timer для TBC
- **Timer:** `cmangos-tbc-update.timer` — daily at 03:10 AM (±5min jitter)
- **Service:** `cmangos-tbc-update.service`

---

## Phase 10: WotLK Server Deployment ✅

> Replicated from Classic/TBC setup. Maps pre-extracted manually at `/opt/cmangos-wotlk/data/`.

### 10.1 — [x] Створити Docker файли для WotLK
- **Що:** `docker-wotlk/` — повна копія з адаптацією для WotLK:
  - `Dockerfile.server` → `mangos-wotlk` repo, `wotlk-db` repo
  - `docker-compose.yml` → контейнери `cmangos-wotlk-db`, `cmangos-wotlk-server`, мережа `cmangos-wotlk-net`, volume `cmangos-wotlk-db-data`
  - Порти: 8087 (world), 3726 (realm), 3308 (DB)
  - БД: `wotlkmangos`, `wotlkcharacters`, `wotlkrealmd`, `wotlklogs`

### 10.2 — [x] Побудувати та запушити WotLK Docker image
- **Image:** `semorgana/cmangos-wotlk:latest` (1.4 GB, arm64)
- **Build & Push:** done

### 10.3 — [x] Задеплоїти WotLK на remote  
- **Проблема:** Така ж як TBC — `drwx------` на data. Виправлено тим самим `chmod -R o+rX`.
- **DB init:** InstallFullDB.sh — "Icecrown" main release + updates

### 10.4 — [x] Запустити та верифікувати WotLK
- **Commit:** `b07db02dbd9d9e9a5b6117b24acf75f9338afa80`
- **Статус:** "CMANGOS: World initialized"
- **Акаунти:** ADMIN (gm3), SAMUEL (gm0, expansion=2)
- **Default акаунти видалено**

### 10.5 — [x] Встановити systemd timer для WotLK
- **Timer:** `cmangos-wotlk-update.timer` — daily at 03:20 AM (±5min jitter)

---

## Phase 11: Character Transfer System ✅

> Система трансферу персонажів між серверами різних експансій. Використовує temp-DB підхід: дамп → імпорт у тимчасову БД → міграція схеми SQL → мерж у цільову БД через `safe_insert()` з explicit column names.

### 11.1 — [x] Порівняти DB-схеми всіх 3 експансій
- **Метод:** Прямий аналіз LIVE баз на remote через INFORMATION_SCHEMA
- **Результат:** Повний каталог різниць між Classic/TBC/WotLK characters DB:
  - `characters` таблиця: Classic→TBC (DROP 5 honor cols, ADD 10 TBC cols), TBC→WotLK (ADD 5: knownCurrencies, power6/7, specCount, activeSpec)
  - `guild`/`guild_member`/`guild_rank`: +bank support (TBC)
  - `character_action`: +spec (WotLK dual spec)
  - `character_pet`: -loyalty system (WotLK)
  - `item_instance`: itemTextId→text + playedTime (WotLK)
  - `mail`: itemTextId→body (WotLK)
  - Classic-only: `character_forgotten_skills`, `character_honor_cp`
  - TBC-only (vs Classic): 12 tables (arena_team*, guild_bank_*, character_declinedname, etc.)
  - WotLK-only (vs TBC): 8 tables (calendar_*, character_achievement*, equipmentsets, glyphs, talent)
  - `realmd`: Ідентична схема у всіх 3

### 11.2 — [x] Створити migration SQL файли
- **Файли:** `transfer/migrate_classic_to_tbc.sql`, `transfer/migrate_tbc_to_wotlk.sql`, `transfer/migrate_classic_to_wotlk.sql`
- **Підхід:** `ALTER TABLE ... ADD/DROP COLUMN IF [NOT] EXISTS`, PREPARE/EXECUTE для conditional DDL, CREATE TABLE IF NOT EXISTS для expansion-specific tables
- **Remote:** Скопійовані в `/opt/cmangos-transfer/` на workspace-docker

### 11.3 — [x] Створити transfer.sh скрипт
- **Файл:** `transfer/transfer.sh` (410 рядків)
- **Ключова функція:** `safe_insert()` — використовує INFORMATION_SCHEMA.COLUMNS для знаходження спільних колонок між source і target таблицями, будує explicit INSERT з правильним порядком колонок
- **Функціонал:**
  - 3 шляхи: classic→tbc, tbc→wotlk, classic→wotlk (пряма двофазна міграція)
  - `--account <NAME>` — трансфер конкретного акаунту (копія, не переміщення)
  - `--dry-run`, `--no-restart`, `--skip-backup`
  - Автоматичний backup цільової БД перед трансфером
  - Graceful shutdown серверів (зберігає DB-контейнери працюючими)
  - Автоматичне очищення temp DB через trap EXIT
- **Remote:** `/opt/cmangos-transfer/transfer.sh`

### 11.4 — [x] Протестувати всі шляхи трансферу
- **Classic→TBC:** ✅ Samuel (lvl 60, warlock) — 313 items, 392 spells, 18 skills, 54 reps, 904 quests
- **TBC→WotLK:** ✅ Samuel — 313 items, 389 spells, 18 skills, 79 reps, 904 quests
- **Classic→WotLK (direct):** ✅ Samuel — 313 items, 392 spells, 18 skills, 54 reps, 904 quests
- **Примітки:**
  - Трансфер = копія (оригінал залишається на source)
  - Після трансферу потрібно: visit trainer, `.reset talents`, reconfigure action bars
  - Деякі Classic-only предмети можуть не працювати в TBC/WotLK

### 11.5 — [x] Додати універсальний інтерактивний скрипт (any-direction, character-level)
- **Файл:** `transfer/transfer-interactive.sh`
- **Remote:** `/opt/cmangos-transfer/transfer-interactive.sh`
- **Функціонал:**
  - Інтерактивний вибір source/target з підтримкою будь-якого напрямку (включно з reverse)
  - Вибір конкретних персонажів по номеру або імені
  - Перенос через temp DB + `safe_insert()` по перетину колонок (без ручного SQL-fix під кожну пару)
  - Автобекап target character DB + rollback команда в кінці
  - Опційний auto stop/start серверів
  - Перевірка існування target-акаунта перед копіюванням персонажа
  - **CLI режим:** `--chars <список>`, `--all`, `--yes` (no confirm), `--no-restart`, `--list <expansion>`, `-h/--help`
  - Підтримує і інтерактивний (без аргументів), і CLI one-liner режим
  - Smoke-tested: інтерактивний меню, --list, --help, повний CLI трансфер Classic→TBC

### 11.6 — [x] Автоматичний щоденний синк з hash-based конфлікт-детекцією (multi-account)
- **Файл:** `transfer/daily-sync.sh` (530 рядків)
- **Конфіг:** `transfer/sync-accounts.conf` — один username на рядок
- **Remote:** `/opt/cmangos-transfer/daily-sync.sh`, `/opt/cmangos-transfer/sync-accounts.conf`
- **Systemd:** `cmangos-daily-sync.timer` — щодня о 04:00 (±2 хв jitter)
- **Алгоритм (per account):**
  1. Зупиняє всі game-сервери (DB залишаються працювати)
  2. Для кожного акаунту з конфігу:
     a. **Auto-create** акаунт на TBC/WotLK якщо відсутній (копіює `s`/`v` SRP6 пару → пароль ідентичний)
     b. Знаходить всіх персонажів акаунту на source
     c. Для кожного персонажа: hash check → SYNC або SKIP
  3. Classic→TBC, потім TBC→WotLK (незалежно)
  4. Перезапускає всі сервери
- **Account auto-create:**
  - CMaNGOS SRP6: `s` (salt) + `v` (verifier) = пара від пароля
  - Копіюючи `s`/`v` з source → target, пароль залишається тим самим
  - Також копіюється: gmlevel, expansion, email, locale
- **Safety:**
  - `trap cleanup EXIT` — сервери завжди перезапускаються
  - Cleanup stale temp DBs від попередніх failed runs
  - Graceful stop з timeout 30s
- **Summary output:** Synced / Skipped / Created (new accounts) / Errors
- **Тестування:**
  - ✅ SYNCED/SYNCED — обидва шляхи при незміненому хеші (1 account, 1 char)
  - ✅ SKIPPED/SYNCED — Classic→TBC пропущено коли TBC персонаж змінений
  - ✅ AUTO-CREATED — TESTPLAYER створений на TBC (id=7) та WotLK (id=7) з правильним паролем
  - ✅ Multi-account (3 акаунти): SAMUEL (synced), ADMIN (no chars), TESTPLAYER (auto-created)
  - ✅ Сервери завжди перезапускаються після синку
---

## Phase 12: Санітизація Даних та Верифікація Крос-Експансій Трансферу ✅

> **ЗАВЕРШЕНО.** Причину крешу `MANGOS_ASSERT(m_currMap)` знайдено через аналіз вихідного коду
> WotLK (commit `b07db02dbd`). Баг в `Player::LoadFromDB()`: `SetMoney()` (рядок 16387) викликається
> ДО `SetMap()` (рядок 16571). WotLK-версія `SetMoney()` має додатковий виклик
> `UpdateAchievementCriteria(type=86, criteria=4224)`, який через `AchievementMgr::SetCriteriaProgress()`
> → `GetMap()->GetCurrentClockTime()` крешить, бо `m_currMap==NULL`. Фікс: pre-insert запис у
> `character_achievement_progress` (criteria=4224, counter=money) — `SetCriteriaProgress()` йде в
> `else` гілку без виклику `GetMap()`. Повний pipeline Classic→TBC→WotLK = SUCCESS.
>
> **Інтеграція:** `transfer-interactive.sh` Section 8, `migrate_tbc_to_wotlk.sql`, `migrate_classic_to_wotlk.sql`.
>
> **Поточний стан персонажів:**
> - Classic: Samuel guid=1801, Lv60 (оригінал)
> - TBC: Samuel guid=1801, Lv60 (перенесено з Classic)
> - WotLK: Samuel guid=1801, Lv60 (перенесено через TBC)

### Група A: Код санітизації — blob-поля

#### 12.1 — [ ] Очистити `data` blob (UpdateFields) при трансфері
- **Що:** Поле `data` — TEXT blob з ~1400 (TBC) або ~1800 (WotLK) uint32, що зберігають
  ВСІ UpdateFields (HP, mana, stats, equip slots, quest log). Offset'и ПОВНІСТЮ різні між
  експансіями → копіювання сирого blob = сервер читає з неправильними зміщеннями.
- **Рішення (Варіант A — простий):** Очистити blob → сервер перегенерує при першому логіні:
  ```sql
  UPDATE characters SET data='' WHERE guid=<GUID>;
  ```
- **Якщо Варіант A не спрацює:** Варіант B — скопіювати дефолтний WotLK `data` blob від
  чистого персонажа того ж класу/раси.
- **Додати в:** `fix_char_after_transfer()`.

#### 12.2 — [ ] Очистити `equipmentCache` при трансфері
- **Що:** Serialized display info для equipped items. Формат може відрізнятись між TBC/WotLK.
- **Рішення:**
  ```sql
  UPDATE characters SET equipmentCache='' WHERE guid=<GUID>;
  ```
- **Сервер перегенерує** cache при логіні.

#### 12.3 — [ ] Очистити `character_aura` та `character_spell_cooldown`
- **Що:** Аури (баффи) та кулдауни — тимчасові дані з потенційно невалідними spell IDs.
- **Рішення:**
  ```sql
  DELETE FROM character_aura WHERE guid=<GUID>;
  DELETE FROM character_spell_cooldown WHERE guid=<GUID>;
  ```
- **Обґрунтування:** Аури/кулдауни тимчасові; персонаж отримає нові при грі.

### Група B: Код санітизації — таланти, заклинання, action bars

#### 12.4 — [ ] Скидання талантів через `at_login` + очищення talent/glyphs таблиць
- **Що:** Дерева талантів ПОВНІСТЮ відрізняються між Classic/TBC/WotLK.
  CMaNGOS має вбудований механізм: біт `AT_LOGIN_RESET_TALENTS = 4` (0x04) + `AT_LOGIN_RESET_SPELLS = 2` (0x02).
- **Рішення (комплексне, per-character):**
  ```sql
  -- Встановити at_login біти RESET_SPELLS + RESET_TALENTS
  UPDATE characters SET at_login = at_login | 6 WHERE guid=<GUID>;
  -- Скинути лічильник вартості скидання (несправедливо після трансферу)
  UPDATE characters SET resettalents_cost=0, resettalents_time=0 WHERE guid=<GUID>;
  -- WotLK-only: очистити character_talent (в TBC/Classic — в data blob)
  DELETE FROM character_talent WHERE guid=<GUID>;
  -- WotLK-only: очистити character_glyphs (нова система в WotLK)
  DELETE FROM character_glyphs WHERE guid=<GUID>;
  ```
- **Результат:** При першому логіні сервер скине таланти/заклинання,
  гравець обере нові таланти з дерева цільової експансії.

#### 12.5 — [ ] Очистити `character_action` (action bars)
- **Що:** Action bars містять spell/item IDs з попередньої експансії.
  В WotLK — додатковий `spec` стовпець (dual spec). Скопійовані action bars = невалідні spell IDs.
- **Рішення:**
  ```sql
  DELETE FROM character_action WHERE guid=<GUID>;
  ```
- **Обґрунтування:** Гравець налаштує action bars заново після обрання талантів.

### Група C: Код санітизації — нормалізація blob-полів

#### 12.6 — [ ] Верифікувати існуючі фікси в `fix_char_after_transfer()`
- **Що:** Вже реалізовано:
  - `taximask`: padding від 8 (TBC) до 14 (WotLK) значень
  - `exploredZones`: padding від 31 (TBC) до 128 (WotLK)
  - `knownTitles`: якщо NULL → '0 0 0 0 0 0'
  - `online=0`
- **Задача:** Верифікувати кожен існуючий фікс:
  1. Встановити TBC-значення (без padding)
  2. Запустити `fix_char_after_transfer()` → перевірити результат
  3. Переконатись що значення коректні для WotLK
- **Примітка:** WotLK `exploredZones` може використовувати 96 значень (не 128).
  Перевірити з реальними WotLK default.

### Група D: Код санітизації — валідація items/spells

#### 12.7 — [ ] Валідація Item IDs: видалити предмети без `item_template` в цільовій БД
- **Що:** Предмети з Classic/TBC можуть мати ID що не існують у цільовій expansion world DB.
- **Рішення для WotLK target:**
  ```sql
  -- Видалити невалідні items
  DELETE ii FROM character_db.item_instance ii
    LEFT JOIN world_db.item_template it ON ii.itemEntry = it.entry
    WHERE ii.owner_guid=<GUID> AND it.entry IS NULL;
  -- Очистити inventory slots без items
  DELETE ci FROM character_db.character_inventory ci
    LEFT JOIN character_db.item_instance ii ON ci.item = ii.guid
    WHERE ci.guid=<GUID> AND ii.guid IS NULL;
  ```
- **Примітка:** Більшість Classic/TBC предметів backward-compatible, але деякі Quest items
  або removed items можуть бути відсутні. Аналогічно для Classic→TBC.

#### 12.8 — [ ] Валідація Spell IDs: видалити заклинання без `spell_template`/`spell_dbc`
- **Що:** Заклинання можуть бути видалені або отримати новий ID в наступній експансії.
- **Рішення:**
  ```sql
  DELETE cs FROM character_db.character_spell cs
    LEFT JOIN world_db.spell_template st ON cs.spell = st.Id
    WHERE cs.guid=<GUID> AND st.Id IS NULL;
  ```
- **Примітка:** `spell_template` може бути в DBC, не в SQL. Якщо таблиці немає —
  сервер зазвичай ігнорує невідомі spells (не критично, але бажано).

#### 12.9 — [ ] Валідація Skill IDs: видалити невалідні навички
- **Що:** Деякі навички expansion-specific.
- **Пріоритет:** Низький (навички backward-compatible).
- **Рішення:** Аналогічно spell validation через `character_skills`.

### Група E: Збирання та тестування

#### 12.10 — [ ] Оновити `fix_char_after_transfer()` з УСІМА фіксами з 12.1–12.9
- **Що:** Зібрати всі фікси в єдину функцію.
- **Файл:** `transfer/transfer-interactive.sh`, функція `fix_char_after_transfer()`.
- **Структура:**
  ```bash
  fix_char_after_transfer() {
    local exp="$1" guid="$2" ctr="$3" char_db="$4" world_db="$5"
    # 1. Очистити data blob
    db_exec "$ctr" -e "UPDATE ${char_db}.characters SET data='' WHERE guid=${guid}"
    # 2. Очистити equipmentCache
    db_exec "$ctr" -e "UPDATE ${char_db}.characters SET equipmentCache='' WHERE guid=${guid}"
    # 3. Очистити auras + cooldowns
    db_exec "$ctr" -e "DELETE FROM ${char_db}.character_aura WHERE guid=${guid}"
    db_exec "$ctr" -e "DELETE FROM ${char_db}.character_spell_cooldown WHERE guid=${guid}"
    # 4. Talent reset: at_login, cost, character_talent, character_glyphs, character_action
    db_exec "$ctr" -e "UPDATE ${char_db}.characters SET at_login=at_login|6,
      resettalents_cost=0, resettalents_time=0, online=0 WHERE guid=${guid}"
    db_exec "$ctr" -e "DELETE FROM ${char_db}.character_action WHERE guid=${guid}"
    if [[ "$exp" == "wotlk" ]]; then
      db_exec "$ctr" -e "DELETE FROM ${char_db}.character_talent WHERE guid=${guid}"
      db_exec "$ctr" -e "DELETE FROM ${char_db}.character_glyphs WHERE guid=${guid}"
    fi
    # 5. Item validation
    db_exec "$ctr" -e "DELETE ii FROM ${char_db}.item_instance ii
      LEFT JOIN ${world_db}.item_template it ON ii.itemEntry=it.entry
      WHERE ii.owner_guid=${guid} AND it.entry IS NULL"
    db_exec "$ctr" -e "DELETE ci FROM ${char_db}.character_inventory ci
      LEFT JOIN ${char_db}.item_instance ii ON ci.item=ii.guid
      WHERE ci.guid=${guid} AND ii.guid IS NULL"
    # 6. Spell validation (якщо spell_template існує)
    # 7. Існуючі фікси: taximask padding, exploredZones padding, knownTitles
    # ... (вже реалізовано)
  }
  ```
- **Аналогічно для TBC target** — адаптувати world DB name та expansion-specific таблиці.

#### 12.11 — [ ] Оновити SQL міграційні файли з усіма фіксами
- **Файли:**
  - `transfer/migrate_classic_to_tbc.sql`
  - `transfer/migrate_tbc_to_wotlk.sql`
  - `transfer/migrate_classic_to_wotlk.sql`
- **Додати:**
  ```sql
  -- Reset incompatible blobs
  UPDATE characters SET data='', equipmentCache='';
  -- Clear temp data
  DELETE FROM character_aura;
  DELETE FROM character_spell_cooldown;
  -- Talent/spell reset
  UPDATE characters SET at_login=at_login|6, resettalents_cost=0, resettalents_time=0;
  -- Clear action bars
  DELETE FROM character_action;
  ```

#### 12.12 — [ ] Тест: Classic→TBC трансфер + санітизація + login bot на TBC
- **Що:** Повний цикл трансферу зі всіма фіксами:
  1. Перенести Samuel (guid=1801) з Classic на TBC через `transfer-interactive.sh`
  2. `fix_char_after_transfer()` автоматично застосовується
  3. Запустити TBC сервер
  4. Login bot на TBC (expansion=tbc, auth=3725, world=8086):
     ```bash
     python3 wow_login_test_universal.py --expansion tbc --username SAMUEL \
       --password TEST123 --guid <TBC_GUID>
     ```
  5. **RESULT: SUCCESS** — обов'язково
- **Якщо FAIL:** Перейти до 12.14 (бісект-тестування).
- **Якщо SUCCESS:** Персонаж нормалізований сервером на TBC, готовий для кроку TBC→WotLK.

#### 12.13 — [ ] Тест: TBC→WotLK трансфер + санітизація + login bot на WotLK
- **Що:** Критичний тест — саме тут раніше був креш `MANGOS_ASSERT(m_currMap)`.
  Тепер з ПОВНОЮ санітизацією (data blob cleared, at_login reset, etc.).
  **ВАЖЛИВО:** Source = TBC-нормалізовані дані (після 12.12), НЕ raw Classic.
  1. Перенести персонажа з TBC (вже verified) на WotLK
  2. `fix_char_after_transfer()` + WotLK-specific фікси (character_talent, character_glyphs)
  3. Запустити WotLK сервер
  4. Login bot на WotLK (expansion=wotlk, auth=3726, world=8087):
     ```bash
     python3 wow_login_test_universal.py --expansion wotlk --username SAMUEL \
       --password TEST123 --guid <WOTLK_GUID>
     ```
  5. **RESULT: SUCCESS** — обов'язково
- **Якщо FAIL:** Перейти до 12.14.

#### 12.14 — [ ] Бісект-тестування (ТІЛЬКИ якщо 12.12 або 12.13 = FAIL)
- **Що:** Якщо комплексна санітизація НЕ виправила креш — ізолювати конкретне поле.
- **Метод:** Binary search по групах полів:
  1. Baseline: чистий персонаж з WotLK defaults = SUCCESS (верифікувати)
  2. Група 1: `data` blob → LOGIN (очікувано CRASH)
  3. Група 2: `equipmentCache` → LOGIN
  4. Група 3: `taximask` + `exploredZones` + `knownTitles` → LOGIN
  5. Група 4: числові поля (level, xp, money, health, power*, playerBytes*) → LOGIN
  6. Група 5: позиція (map, zone, position*) → LOGIN
  7. Група 6: решта (at_login, extra_flags, taxi_path, dungeon_difficulty, etc.) → LOGIN
- **Результат:** Таблиця крешуючих полів з причиною та рішенням.
- **Примітка:** Ця задача виконується ТІЛЬКИ якщо 12.12/12.13 = FAIL.
  Якщо санітизація спрацювала — SKIP цю задачу.

---

## Phase 13: Інфраструктура Pipeline ✅

> **Мета:** Підготувати всю інфраструктуру для автоматичного послідовного pipeline:
> спільна бібліотека функцій, verify/wait функції, оновлений конфіг з паролями,
> постійне розміщення скриптів.
>
> **Залежність:** Phase 12 (санітизація працює, login bot = SUCCESS на всіх експансіях).
> **Інструмент:** `transfer/wow_login_test_universal.py` — universal login bot (✅ Classic/TBC/WotLK).
> **Виконано:** 2026-03-14

### 13.1 — [x] Створити `transfer/lib.sh` — спільна бібліотека функцій
- **Що:** Виділити спільні функції з `transfer-interactive.sh` та `daily-sync.sh` в одну бібліотеку (DRY).
- **Функції для lib.sh:**
  ```bash
  #!/usr/bin/env bash
  # lib.sh — спільна бібліотека для transfer скриптів

  db_exec()                  { ... }  # Виконати SQL через docker exec
  safe_insert()              { ... }  # Безпечний INSERT через INFORMATION_SCHEMA перетин колонок
  fix_char_after_transfer()  { ... }  # Комплексна санітизація (Phase 12)
  verify_character_login()   { ... }  # Login bot wrapper (нова)
  verify_all_characters()    { ... }  # Batch verify (нова)
  wait_for_server_ready()    { ... }  # Очікування "World initialized" (нова)
  restart_after_crash()      { ... }  # Docker restart + wait (нова)
  ```
- **Підключення:** `source /opt/cmangos-transfer/lib.sh` в обох скриптах.
- **Файл:** `transfer/lib.sh`

### 13.2 — [x] Реалізувати `verify_character_login()` — bash wrapper для login bot
- **Що:** Обгортка навколо `wow_login_test_universal.py`:
  ```bash
  verify_character_login() {
    local expansion="$1" username="$2" password="$3" guid="$4"
    local result rc
    result=$(python3 /opt/cmangos-transfer/wow_login_test_universal.py \
      --expansion "$expansion" --username "$username" --password "$password" \
      --guid "$guid" 2>&1)
    rc=$?
    echo "$result"
    return $rc  # 0=SUCCESS, 1=FAIL/CRASH
  }
  ```
- **Файл:** `transfer/lib.sh`

### 13.3 — [x] Реалізувати `verify_all_characters()` — batch verify
- **Що:** Перевірити ВСІ персонажі акаунту на цільовій експансії:
  ```bash
  verify_all_characters() {
    local expansion="$1" username="$2" password="$3" account_id="$4"
    local ctr char_db guids failed=0
    # Визначити контейнер та БД за expansion
    guids=$(db_exec "$ctr" -N -e "SELECT guid FROM ${char_db}.characters WHERE account=${account_id}")
    for guid in $guids; do
      if ! verify_character_login "$expansion" "$username" "$password" "$guid"; then
        log_error "VERIFY FAIL: $username guid=$guid on $expansion"
        failed=$((failed + 1))
      else
        log_info "VERIFY OK: $username guid=$guid on $expansion"
      fi
    done
    return $failed
  }
  ```

### 13.4 — [x] Реалізувати `wait_for_server_ready()` — очікування ініціалізації
- **Що:** Після docker restart — дочекатись повної ініціалізації сервера:
  ```bash
  wait_for_server_ready() {
    local container="$1" max_wait="${2:-120}"
    local elapsed=0
    while [[ $elapsed -lt $max_wait ]]; do
      if docker logs "$container" --tail 10 2>&1 | grep -q "World initialized"; then
        sleep 3  # буфер для повної стабілізації
        return 0
      fi
      sleep 3
      elapsed=$((elapsed + 3))
    done
    log_error "Server $container not ready after ${max_wait}s"
    return 1
  }
  ```

### 13.5 — [x] Реалізувати `restart_after_crash()` — автовідновлення сервера після крешу
- **Що:** Якщо login bot повертає CRASH → автоматичний restart + wait:
  ```bash
  restart_after_crash() {
    local container="$1"
    log_warn "Server $container crashed! Restarting..."
    docker restart "$container"
    wait_for_server_ready "$container"
  }
  ```

### 13.6 — [x] Оновити `sync-accounts.conf` формат: додати паролі
- **Що:** Для login bot верифікації потрібен пароль кожного акаунту.
- **Поточний формат:** `USERNAME` (один на рядок)
- **Новий формат:** `USERNAME:PASSWORD` (один на рядок)
  ```
  # sync-accounts.conf — акаунти для щоденної синхронізації
  # Формат: USERNAME:PASSWORD
  SAMUEL:TEST123
  ADMIN:TEST123
  ```
- **Безпека:** `chmod 600 sync-accounts.conf` на remote.
- **Парсинг:** `IFS=':' read -r username password <<< "$line"`

### 13.7 — [x] Перемістити ВСІ скрипти з /tmp/ у /opt/cmangos-transfer/
- **Що:** `/tmp/` — тимчасова директорія, може бути очищена при reboot.
- **Файли для переміщення:**
  ```bash
  # Скопіювати на remote:
  scp transfer/wow_login_test_universal.py workspace:/opt/cmangos-transfer/
  scp transfer/srp6_set_password.py workspace:/opt/cmangos-transfer/
  scp transfer/lib.sh workspace:/opt/cmangos-transfer/
  # Оновити daily-sync.sh, transfer-interactive.sh:
  scp transfer/daily-sync.sh workspace:/opt/cmangos-transfer/
  scp transfer/transfer-interactive.sh workspace:/opt/cmangos-transfer/
  # SQL міграції:
  scp transfer/migrate_*.sql workspace:/opt/cmangos-transfer/
  ssh workspace 'chmod +x /opt/cmangos-transfer/*.sh'
  ```
- **Оновити:** Всі посилання в скриптах з `/tmp/` на `/opt/cmangos-transfer/`.

### 13.8 — [ ] Рефакторинг `transfer-interactive.sh` та `daily-sync.sh` → використовувати `lib.sh`
- **Що:** Замінити дублікати в обох скриптах на `source lib.sh`.
- **Кроки:**
  1. Видалити дубльовані функції з обох скриптів
  2. Додати `source "$(dirname "$0")/lib.sh"` на початку кожного
  3. Тестувати що обидва скрипти працюють після рефакторингу

---

## Phase 14: Послідовний Daily Sync Pipeline ✅

> **Мета:** Повністю переструктурувати `daily-sync.sh` для ПОСЛІДОВНОГО pipeline:
>
> ```
> ┌─────────────────────────────────────────────────────────────────────┐
> │  1. Stop ALL game servers (DB containers keep running)             │
> │  2. For each account in sync-accounts.conf:                       │
> │     a. Classic → TBC:                                              │
> │        • Hash check → SKIP if unchanged                           │
> │        • safe_insert() + fix_char_after_transfer()                │
> │  3. Start TBC server, wait "World initialized"                    │
> │  4. For each transferred TBC character:                           │
> │     • verify_character_login(tbc, ...)                             │
> │     • If FAIL → rollback this char, restart server if crashed     │
> │  5. Stop TBC server                                                │
> │  6. For each account in sync-accounts.conf:                       │
> │     b. TBC → WotLK:                                                │
> │        • Hash check → SKIP if unchanged (use POST-login data!)    │
> │        • safe_insert() + fix_char_after_transfer()                │
> │  7. Start WotLK server, wait "World initialized"                  │
> │  8. For each transferred WotLK character:                         │
> │     • verify_character_login(wotlk, ...)                           │
> │     • If FAIL → rollback this char, restart server if crashed     │
> │  9. Start ALL servers                                              │
> │ 10. Summary report + log file                                     │
> └─────────────────────────────────────────────────────────────────────┘
> ```
>
> **КЛЮЧОВЕ ПРАВИЛО:** TBC→WotLK копіювання відбувається ПІСЛЯ login-верифікації на TBC.
> Це дозволяє серверу TBC нормалізувати дані персонажа при першому вході.
> Нормалізовані TBC-дані → більш безпечне копіювання на WotLK.
>
> **Збережено:** Hash-based change detection (copy only changed characters),
> auto-create accounts (SRP6 s/v pair copy), per-character granularity.
>
> **Файли:** `transfer/daily-sync.sh`, `transfer/lib.sh`, `transfer/sync-accounts.conf`

### 14.1 — [x] Рефакторинг daily-sync.sh: розділити на фази (SQL copy → verify → next)
- **Що:** Поточна структура daily-sync.sh (530 рядків):
  ```
  1. Stop servers
  2. For each account: Classic→TBC (hash check + safe_insert)
  3. For each account: TBC→WotLK (hash check + safe_insert)
  4. Start servers
  ```
  Нова структура:
  ```
  1. Stop servers
  2. Phase A: Classic→TBC transfers (all accounts, with hash check)
  3. Fix all transferred TBC chars (fix_char_after_transfer)
  4. Start TBC server
  5. Wait for ready
  6. Phase B: Verify all TBC characters (login bot)
  7. Handle failures (rollback + restart if crash)
  8. Stop TBC server
  9. Phase C: TBC→WotLK transfers (all accounts, with hash check)
     SOURCE = verified TBC data (post-login normalized!)
  10. Fix all transferred WotLK chars
  11. Start WotLK server
  12. Wait for ready
  13. Phase D: Verify all WotLK characters (login bot)
  14. Handle failures
  15. Start ALL servers
  16. Summary
  ```
- **Ключова зміна:** Крок 9 використовує НОРМАЛІЗОВАНІ TBC-дані (після login verify),
  а не raw Classic forwarded дані.

### 14.2 — [x] Реалізувати per-character rollback при FAIL верифікації
- **Що:** Якщо login bot повертає FAIL для конкретного персонажа:
  1. Видалити цього персонажа з target DB (character + всі пов'язані таблиці)
  2. Якщо сервер крешнув — `restart_after_crash()` перед наступним тестом
  3. Логувати причину FAIL
  4. Продовжити з наступним персонажем (не зупиняти весь pipeline)
- **Rollback SQL:**
  ```sql
  -- Видалити персонажа та всі пов'язані дані
  DELETE FROM character_action WHERE guid=<GUID>;
  DELETE FROM character_aura WHERE guid=<GUID>;
  DELETE FROM character_spell WHERE guid=<GUID>;
  DELETE FROM character_spell_cooldown WHERE guid=<GUID>;
  DELETE FROM character_skills WHERE guid=<GUID>;
  DELETE FROM character_reputation WHERE guid=<GUID>;
  DELETE FROM character_queststatus WHERE guid=<GUID>;
  DELETE FROM character_inventory WHERE guid=<GUID>;
  DELETE FROM item_instance WHERE owner_guid=<GUID>;
  DELETE FROM character_social WHERE guid=<GUID> OR friend=<GUID>;
  DELETE FROM character_homebind WHERE guid=<GUID>;
  DELETE FROM characters WHERE guid=<GUID>;
  ```

### 14.3 — [x] Реалізувати детальний summary та logging
- **Що:** Після завершення sync — повний звіт + файл логу:
  ```
  ===== DAILY SYNC SUMMARY (2026-03-14 04:00) =====
  Phase A: Classic → TBC
    Accounts processed: 2
    Characters synced:  3 | skipped: 1
  Phase B: TBC Verification
    ✅ Samuel (guid=1801) — SUCCESS (Map=0, Pos=-8854,655,96)
    ✅ TestChar (guid=1802) — SUCCESS (Map=1, Pos=1630,-4402,8)
    ⏭️  SkippedChar (guid=1803) — SKIPPED (not changed)
  Phase C: TBC → WotLK
    Characters synced:  3 | skipped: 1
  Phase D: WotLK Verification
    ✅ Samuel (guid=1802) — SUCCESS (Map=0, Pos=-8854,655,96)
    ✅ TestChar (guid=1803) — SUCCESS
    ❌ ProblematicChar (guid=1804) — CRASH → ROLLED BACK
  Stats: Items removed: 5 | Spells removed: 12 | Talent resets: 3
  Duration: 4m 32s
  ======================================
  ```
- **Файл логу:** `/opt/cmangos-transfer/logs/sync_YYYYMMDD_HHMMSS.log`
- **Ротація:** Зберігати останні 30 логів.

### 14.4 — [x] Deploy оновлених файлів на remote
- **Що:** Після всіх локальних змін — розгорнути на `/opt/cmangos-transfer/`:
  ```bash
  for f in daily-sync.sh transfer-interactive.sh lib.sh \
           wow_login_test_universal.py srp6_set_password.py \
           migrate_classic_to_tbc.sql migrate_tbc_to_wotlk.sql migrate_classic_to_wotlk.sql \
           sync-accounts.conf; do
    cat "transfer/$f" | ssh workspace "cat > /opt/cmangos-transfer/$f"
  done
  ssh workspace 'chmod +x /opt/cmangos-transfer/*.sh && chmod 600 /opt/cmangos-transfer/sync-accounts.conf'
  ```

### 14.5 — [x] Тест повного pipeline: ручний запуск daily-sync.sh
- **Що:** Запустити оновлений daily-sync.sh вручну, перевірити весь послідовний flow:
  1. `ssh workspace '/opt/cmangos-transfer/daily-sync.sh'`
  2. Перевірити що всі фази виконались в правильному порядку
  3. Перевірити summary: всі персонажі ✅ SUCCESS
  4. Перевірити лог файл
- **Очікуваний результат:** Повний pipeline Classic→TBC(verify)→WotLK(verify) без помилок.

---

## Phase 15: End-to-End Тестування та Стабілізація ⬜

> **Мета:** Підтвердити стабільність та надійність повного pipeline через серію тестів.
> Після цієї фази — система production-ready для щоденного автоматичного синку.
>
> **Залежність:** Phase 14 (pipeline працює в базовому сценарії).

### 15.1 — [ ] E2E тест: повний цикл з single account
- **Що:** Найпростіший happy-path:
  1. Classic: Samuel Lv60 з gear/spells/quests
  2. Запустити `daily-sync.sh`
  3. Перевірити: TBC персонаж verified ✅, WotLK персонаж verified ✅
  4. Перевірити в БД: `at_login=0` (сервер обробив reset при login verify)
  5. Перевірити лог файл

### 15.2 — [ ] E2E тест: multi-account з різними сценаріями
- **Що:** 2-3 акаунти з різними ситуаціями:
  - Account A: 2 персонажі, обидва змінені → SYNC + VERIFY
  - Account B: 1 персонаж, не змінений → SKIP
  - Account C: новий акаунт (не існує на TBC/WotLK) → AUTO-CREATE + SYNC + VERIFY
- **Перевірити:** Summary відображає правильну кількість synced/skipped/created.

### 15.3 — [ ] Тест різних класів персонажів
- **Що:** Різні класи мають різні power types, pet systems, special fields.
- **Мінімальний набір:**
  - **Warlock** (Samuel, вже є) — pet, mana
  - **Warrior** — rage замість mana, без pets
  - **Hunter** — pet system (character_pet таблиця), mana
- **Як створити:** Через RA console або GM:
  ```
  character create Test_warrior WARRIOR HUMAN
  character level Test_warrior 60
  ```
- **Перевірити:** Всі класи проходять login verify на TBC та WotLK.

### 15.4 — [ ] Тест стабільності: 3 послідовних запуски daily-sync
- **Кроки:**
  1. **Run 1:** Повний sync → all SUCCESS
  2. **Run 2:** Все SKIPPED (не змінилось) → verify все ще SUCCESS
  3. Змінити персонажа на Classic (додати gold або предмет)
  4. **Run 3:** Змінений персонаж SYNCED → SUCCESS, решта SKIPPED
- **Очікуваний результат:** 0 крешів, 0 помилок через 3 послідовних запуски.

### 15.5 — [ ] Оновити документацію
- **Що:** Після успішного завершення всіх тестів:

| Файл | Що оновити |
|---|---|
| `docs/PROJECT_STATUS.md` | Статус крешу → ВИПРАВЛЕНО, нові фічі (login verify, sequential pipeline) |
| `docs/TRANSFER_SYSTEM.md` | Новий розділ: Sequential Pipeline, Login Bot Verification, Data Sanitization |
| `docs/SESSION_LOG.md` | Запис сесії: виконані фази, рішення, результати |
| `docs/CONTINUATION_GUIDE.md` | "Головна Невирішена Задача" → ВИРІШЕНО |
| `docs/COMMANDS_REFERENCE.md` | Нові команди якщо з'явились |
| `backlog.md` | Позначити Phase 12–15 як ✅ |

---

## Phase 16: AzerothCore Integration (Future MVP) ⬜

> **Мета:** Додати 4-й крок pipeline: міграція з cmangos-wotlk → AzerothCore.
> AzerothCore використовує ту ж базу (Trinity/MaNGOS fork), але зі своєю DB-схемою.
> Після цієї фази повний pipeline:
> Classic → TBC (verify) → WotLK (verify) → AzerothCore (verify)
>
> **Контекст:** AzerothCore — форк TrinityCore, підтримує WotLK 3.3.5a.
> DB-схема відрізняється від CMaNGOS-WotLK (інші назви таблиць/колонок, інші FormatStrings).
> Потрібна нова SQL-міграція + адаптація login bot.

### 16.1 — [ ] Розгорнути AzerothCore Docker контейнер
- **Що:** ARM64-сумісний AzerothCore сервер (окремий docker-compose).
- **Кроки:**
  1. Дослідити офіційні AzerothCore Docker images (azerothcore/azerothcore)
  2. Якщо немає ARM64 → собрати з вихідників (аналогічно до CMaNGOS)
  3. Розгорнути: cmangos-ac-server + cmangos-ac-db
  4. Порти: 8088 (world) / 3727 (auth) / 3309 (DB)
- **Пріоритет:** Future MVP — після стабілізації CMaNGOS pipeline.

### 16.2 — [ ] Дослідити DB-схему AzerothCore vs CMaNGOS-WotLK
- **Що:** Порівняти INFORMATION_SCHEMA обох серверів:
  - Які таблиці спільні, які відрізняються
  - Маппінг колонок (наприклад, AzerothCore може мати інші назви)
  - Типи даних та їх сумісність
- **Результат:** Документ з повним маппінгом для SQL-міграції.

### 16.3 — [ ] Створити `migrate_cmangos_wotlk_to_azerothcore.sql`
- **Що:** SQL-міграція аналогічно до існуючих migrate_*.sql файлів.
- **Файл:** `transfer/migrate_cmangos_wotlk_to_azerothcore.sql`
- **Підхід:** `safe_insert()` з INFORMATION_SCHEMA перетином колонок (вже працює).

### 16.4 — [ ] Адаптувати login bot для AzerothCore
- **Що:** AzerothCore теж WotLK 3.3.5a (build 12340), тому протокол має бути ідентичний
  CMaNGOS-WotLK. Але auth-server може мати нюанси (SRP6 implementation, session key handling).
- **Кроки:**
  1. Спробувати існуючий `wow_login_test_universal.py --expansion wotlk` на AC порту
  2. Якщо працює — додати `--expansion azerothcore` alias
  3. Якщо ні — debuggувати різницю в протоколі

### 16.5 — [ ] Інтегрувати AzerothCore крок у daily-sync pipeline
- **Що:** Додати Phase E та Phase F в daily-sync.sh:
  ```
  ... (після Phase D — WotLK verification) ...
  Phase E: WotLK → AzerothCore transfer (safe_insert + fix)
  Phase F: AzerothCore Verification (login bot)
  ```
- **Файл:** `transfer/daily-sync.sh`

### 16.6 — [ ] E2E тест повного 4-step pipeline
- **Що:** Classic → TBC (verify) → WotLK (verify) → AzerothCore (verify)
- **Очікувати:** Всі 4 етапи SUCCESS.

---

## Phase 17: Опціональні Покращення ⬜

> Не блокуючі задачі для подальшого покращення системи.

### 17.1 — [ ] Debug Build WotLK для діагностики
- **Що:** Якщо бісект-тестування (12.14) не дало результату — пересобрати
  WotLK image з `-DCMAKE_BUILD_TYPE=Debug -DDEBUG=1` для повного stack trace.
- **Пріоритет:** Тільки якщо санітизація не працює.

### 17.2 — [ ] Reverse трансфер (WotLK→TBC, TBC→Classic)
- **Що:** Зворотній напрямок. При reverse — знизити level до cap (60/70),
  видалити expansion-specific items/spells.
- **Пріоритет:** Низький.

### 17.3 — [ ] Guild трансфер
- **Що:** Переносити гільдії (guild, guild_member, guild_rank, guild_bank).
- **Проблема:** Guild bank не існує в Classic.
- **Пріоритет:** Низький.

### 17.4 — [ ] Web dashboard для моніторингу
- **Що:** Проста веб-сторінка зі статусом серверів, останнім sync, персонажами.
- **Пріоритет:** Дуже низький.

---

## Всі Сервери — Статус

| Expansion | Container Server | Container DB | Image | Порти | Timer | Статус |
|---|---|---|---|---|---|---|
| Classic | cmangos-server | cmangos-db | semorgana/cmangos-classic:latest (742 MB) | 8085/3724/3306 | 03:00 | ✅ Healthy |
| TBC | cmangos-tbc-server | cmangos-tbc-db | semorgana/cmangos-tbc:latest (1.36 GB) | 8086/3725/3307 | 03:10 | ✅ Healthy |
| WotLK | cmangos-wotlk-server | cmangos-wotlk-db | semorgana/cmangos-wotlk:latest (1.4 GB) | 8087/3726/3308 | 03:20 | ✅ Healthy |
| **Sync** | — | — | — | — | **04:00** | ✅ Sequential daily sync: Classic→TBC(verify)→WotLK(verify) |
