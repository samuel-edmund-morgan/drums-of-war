# Хронологія Сесій (Session Log)

> Повна хронологія роботи над проєктом для точного продовження.

---

## Сесія 1: Docker Infrastructure (Classic)

### Виконано:
1. Досліджено CMaNGOS project: вихідний код, wiki, CI/CD configs
2. Виявлено ARM-обмеження для екстракторів (`CMAKE_SYSTEM_PROCESSOR MATCHES "^arm"`)
3. Створено multi-stage Dockerfile для AMD64 екстракції + ARM64 серверу
4. Витягнуто map data з WoW Classic клієнта (dbc, maps, vmaps, mmaps, Cameras, Buildings)
5. Скомпільовано серверні бінарники (mangosd, realmd) для aarch64
6. Створено Docker image `semorgana/cmangos-classic:latest` → Docker Hub
7. Створено docker-compose.yml з MariaDB + CMaNGOS server
8. Розгорнуто `/opt/cmangos-classic/` на remote: конфіги, scripts, data
9. Ініціалізовано БД (InstallFullDB.sh → classic-db)
10. Створено helper script `cmangos.sh` (start/stop/restart/db/backup...)
11. Створено `update.sh` з systemd timer (03:00 daily)
12. Очищено тимчасові build контейнери та images

### Результат:
- Classic сервер працює: `cmangos-server` + `cmangos-db`
- Docker Hub: `semorgana/cmangos-classic:latest`
- Акаунт ADMIN (gm3) створено

---

## Сесія 2: TBC + WotLK Deployment

### Виконано:
1. Створено `docker-tbc/` — повна реплікація Classic setup для TBC
2. Зібрано `semorgana/cmangos-tbc:latest` (1.36 GB arm64) → Docker Hub
3. Витягнуто TBC map data, задеплоєно `/opt/cmangos-tbc/`
4. Виправлено проблему дозволів (`drwx------` → `chmod -R o+rX`)
5. Ініціалізовано TBC БД (TBCDB_1.10.0_ReturnOfTheVengeance)
6. Створено `docker-wotlk/` — адаптація для WotLK
7. Зібрано `semorgana/cmangos-wotlk:latest` (1.4 GB arm64) → Docker Hub
8. Задеплоєно `/opt/cmangos-wotlk/`, ініціалізовано WotLK БД
9. Видалено default акаунти (ADMINISTRATOR, GAMEMASTER, MODERATOR, PLAYER)
10. Створено systemd timers для TBC (03:10) та WotLK (03:20)

### Результат:
- Три сервери працюють паралельно на портах 8085/8086/8087
- Всі мають auto-update timers

---

## Сесія 3: Character Transfer System

### Виконано:
1. Порівняно DB-схеми всіх 3 експансій через INFORMATION_SCHEMA
2. Задокументовано різниці (characters table, expansion-specific tables)
3. Створено SQL міграції: `migrate_classic_to_tbc.sql`, `migrate_tbc_to_wotlk.sql`, `migrate_classic_to_wotlk.sql`
4. Створено `transfer.sh` (410 рядків) з `safe_insert()` функцією
5. Протестовано всі 3 шляхи трансферу:
   - Classic→TBC: ✅ (313 items, 392 spells, 18 skills, 54 reps, 904 quests)
   - TBC→WotLK: ✅ (313 items, 389 spells)
   - Classic→WotLK: ✅ (пряма двофазна міграція)
6. Створено `transfer-interactive.sh` — інтерактивний/CLI інтерфейс
7. Створено `daily-sync.sh` (530 рядків) — hash-based щоденний синк
8. Створено `sync-accounts.conf` — конфіг акаунтів для синку
9. Встановлено `cmangos-daily-sync.timer` (04:00)
10. Протестовано auto-create акаунтів з копією SRP6 (s, v пари)

---

## Сесія 4: TBC→WotLK Crash Investigation

### Виявлена Проблема:
Персонаж Samuel, перенесений з TBC на WotLK, крешить сервер при логіні.

### Хронологія Дослідження:
1. Перший логін → `GetMap(): m_currMap` MANGOS_ASSERT → Crash
2. Повний reset → відновлення серверу з бекапу
3. Повторний трансфер з "Testlock rename" підходом → те саме
4. Stripped ALL secondary tables (items, spells, pets...) → все ще crash
5. Reset ALL fields to Testlock defaults → ПРАЦЮЄ
6. Set TBC numeric fields → CRASH
7. **Висновок:** Креш в числових полях character row

### Технічні Деталі Крешу:
- `MANGOS_ASSERT(m_currMap)` в `Object.h:1084`
- Відбувається під час world update tick, після `Sessions online: 1`
- НЕ під час `LoadFromDB`
- Release build = без stack trace

### Стан: ЗАБЛОКОВАНО
Потрібно побітове тестування кожного числового поля або debug build.

---

## Сесія 5: RA Console + Login Bot

### RA Console:
1. Увімкнено RA на WotLK (порт 3443)
2. SRP6 автентифікація спочатку не працювала
3. Проаналізовано C++ джерельний код: SRP6.cpp, BigNumber.cpp, AccountMgr.cpp
4. Створено `srp6_set_password.py` — точна Python-реалізація SRP6
5. RA auth успішно: `+Logged in.`
6. GM команди працюють: `character level`, `send money`, `send items`, `pdump write/load`

### SSH Config:
- Змінено з `workspace-docker` на `workspace` з Yubikey (ED25519-SK)
- ControlMaster: `/tmp/ssh-ws`, ControlPersist=600

### Login Bot (wow_login_test.py):
1. Досліджено WoW 3.3.5a протокол з CMaNGOS джерельного коду:
   - WorldSocket.cpp, AuthCrypt.cpp, SARC4.cpp, HMACSHA1.cpp
2. Виявлено WotLK-специфічні відмінності:
   - SMSG_AUTH_CHALLENGE: 40 bytes (uint32(1) + seed + 16B + 16B)
   - CMSG_AUTH_SESSION: extra skip fields (regionId, battleGroupId, realmId, dosResponse)
   - AuthCrypt: HMAC-SHA1 + ARC4 (не простий XOR як Classic)
3. Реалізовано повний бот (~400 рядків):
   - ARC4 pure-Python cipher
   - WorldCrypt (HMAC-SHA1 key derivation + ARC4 + 1024-byte drop)
   - RealmAuth (SRP6 auth, realm list)
   - WorldLogin (auth, char enum, player login, crash detection)
4. Перший тест: Auth OK, World auth OK, BUT: `"bad addon info. Kicking."`
5. Досліджено `ReadAddonInfo` в `src/game/Anticheat/module/AddonHandler.cpp`
6. **Виправлено addon data:**
   - Додано `uint32 decompressed_size` перед zlib block
   - Додано 4 fingerprint аддони з CRC 0x4C1C776D
7. **Фінальний тест: SUCCESS!**
   ```
   [WORLD] LOGIN SUCCESS! Map=0 Pos=(-8854.0, 655.9, 96.6)
   RESULT: SUCCESS
   ```

### Стан Бота:
- **ПОВНІСТЮ ПРАЦЮЄ** — автономний логін без WoW клієнта
- Exit code 0 = успіх, 1 = помилка
- Розпізнає: SUCCESS, CRASH, FAILED, TIMEOUT, NOT_FOUND, ERROR

---

## Сесія 6: Universal Login Bot (Classic/TBC/WotLK)

### Передумова:
- Оригінальний `wow_login_test.py` підтримував лише WotLK
- Потрібен бот для всіх 3 експансій для верифікації workflow Classic→TBC→WotLK

### Дослідження протоколів:
1. Проаналізовано Classic джерельний код (`mangos-classic/src/`)
2. Проаналізовано TBC джерельний код (GitHub `cmangos/mangos-tbc`)
3. Виявлено ключові відмінності:

| Параметр | Classic | TBC | WotLK |
|---|---|---|---|
| WorldCrypt | VanillaCrypt: XOR, raw session key (40B) | **TbcCrypt**: XOR, HMAC-SHA1 derived key (20B) | WotlkCrypt: HMAC+ARC4 |
| Auth proof | 26B | 32B | 32B |
| Realm list count | uint8 | uint16 | uint16 |
| CMSG_AUTH_SESSION | build+unk+account+seed+digest+addon | same | +extra fields |

### Основне відкриття — TBC Crypto:
- TBC НЕ використовує raw 40-byte session key (як Classic)
- TBC НЕ використовує HMAC+ARC4 (як WotLK)
- TBC = **гібрид**: HMAC-SHA1 key derivation + Classic XOR algorithm
- Seed: `0x38A78315F8922530719867B18C04E2AA` (16 bytes)
- Key = HMAC-SHA1(seed, K) → 20 bytes, потім XOR як Classic
- Це найбільший блокер — без правильного crypto TBC timeout (сервер не відповідає)

### Створено `wow_login_test_universal.py`:
1. Єдиний бот для всіх 3 експансій через `--expansion classic|tbc|wotlk`
2. Три класи crypto: VanillaCrypt, TbcCrypt, WotlkCrypt
3. EXPANSION_CONFIG dict з per-expansion параметрами
4. Адаптивний parsing: realm list, auth proof, char enum

### Виправлені баги:
1. **Classic auth proof 0x04:** version bytes `3,3,5` → `1,12,1`
2. **Classic auth proof 0x04 (повторно):** SRP6 v/s не відповідали TEST123 — перегенеровано на всіх 3 серверах
3. **Classic realm list crash:** uint16 count → uint8 для Classic; uint32 realm type для Classic
4. **Classic SMSG_ADDON_INFO:** Classic відправляє addon info (0x02EF) ДО auth response — додано loop з skip
5. **TBC timeout:** VanillaCrypt (40B raw key) → TbcCrypt (20B HMAC-derived key)

### Тестування (всі 3 успішно):
```
Classic: Samuel GUID=1801 Lv60 → LOGIN SUCCESS! Map=0 Pos=(-8854.0, 655.9, 96.6)
TBC:     Samuel GUID=1801 Lv60 → LOGIN SUCCESS! Map=0 Pos=(-8854.0, 655.9, 96.6)
WotLK:   Samuel GUID=1802 Lv70 → LOGIN SUCCESS! Map=0 Pos=(-8854.0, 655.9, 96.6)
```

### Очищення для workflow:
- Видалено персонажів з TBC (guid=1801) та WotLK (guid=1802)
- Залишено тільки Classic: Samuel GUID=1801 Lv60
- Готово для чистого workflow: Classic → TBC → WotLK з верифікацією на кожному етапі

---

## Поточний Стан (оновлено)

### Що Працює:
- ✅ 3 CMaNGOS сервери (Classic, TBC, WotLK) в Docker
- ✅ Auto-update timers для кожного expansion
- ✅ Daily sync hash-based трансфер (Classic→TBC→WotLK)
- ✅ RA Console на WotLK (ADMIN/TEST123, порт 3443)
- ✅ SRP6 password tool (srp6_set_password.py)
- ✅ **Universal Login Bot** (wow_login_test_universal.py) — Classic/TBC/WotLK
- ✅ Interactive transfer script (transfer-interactive.sh)

### Поточний стан персонажів:
- Classic: Samuel guid=1801, Lv60 (оригінал)
- TBC: 0 персонажів (очищено для чистого workflow)
- WotLK: 0 персонажів (очищено для чистого workflow)

### Що Потрібно Далі:
1. **Phase 12:** Санітизація даних (data blob, equipmentCache, talents, items, spells)
2. **Phase 13:** Pipeline інфраструктура (lib.sh, verify/wait функції)
3. **Phase 14:** Послідовний Daily Sync Pipeline: Classic→TBC(verify)→WotLK(verify)
4. **Phase 15:** E2E тестування та стабілізація
5. **Phase 16:** AzerothCore Integration (Future MVP)

**Детальна декомпозиція:** `backlog.md` — Phases 12–17 (~50 задач)

---

### Сесія: Декомпозиція фінального workflow (планування)

**Контекст:** Користувач описав фінальний workflow міграційного сервісу:
- Config → доба → Classic→TBC(SQL copy) → login bot verify → TBC→WotLK(SQL copy) → login bot verify
- Login bot verify — ОБОВ'ЯЗКОВИЙ крок, бо сервер може нормалізувати дані при першому вході
- Future MVP: AzerothCore контейнер як 4-й крок pipeline

**Виконано:**
1. Прочитано весь існуючий backlog (Phases 0-18, 1533 рядків)
2. Спроектовано новий послідовний pipeline architecture
3. Повністю переструктуровано backlog: Phases 12-18 (7 фаз, ~55 задач) → Phases 12-17 (6 фаз, ~50 задач)

**Архітектурні рішення:**
- **Phase 12 (нова):** Об'єднано старі Phases 12 (бісект), 13 (санітизація), 14 (таланти) в одну комплексну фазу. Підхід: відразу повна санітизація → тест login bot'ом → бісект тільки якщо не допомогло.
- **Phase 13 (нова):** Інфраструктура pipeline — lib.sh (DRY), verify/wait/restart функції, sync-accounts.conf з паролями, постійне розміщення скриптів.
- **Phase 14 (нова):** Послідовний daily-sync: Classic→TBC(copy,fix) → start TBC → verify (login bot нормалізує дані) → stop TBC → TBC→WotLK(copy,fix) → start WotLK → verify. **КЛЮЧОВЕ:** TBC→WotLK copy використовує POST-login нормалізовані TBC дані.
- **Phase 15:** E2E тестування (single, multi-account, multi-class, stability).
- **Phase 16 (NEW):** AzerothCore Integration — 4-й крок pipeline.
- **Phase 17:** Опціональні покращення (debug build, reverse transfer, guilds, web dashboard).

**Видалено з backlog:** Дублікати між старими фазами, застарілі задачі 17.1a/17.1b (login bot адаптація — вже виконано в universal bot).

---

## Сесія: Phase 12 — Знайдено і виправлено TBC→WotLK креш (2026-03-14)

### Кореневу причину ЗНАЙДЕНО:

**CMaNGOS WotLK баг в Player::LoadFromDB():**
1. `SetMoney(money)` викликається на рядку **16387** — **ДО** `SetMap()` на рядку **16571**
2. WotLK `SetMoney()` має додатковий виклик `UpdateAchievementCriteria(ACHIEVEMENT_CRITERIA_TYPE_HIGHEST_GOLD_VALUE_OWNED)` якого НЕМАЄ в Classic/TBC
3. В `AchievementMgr::SetCriteriaProgress()`, якщо запис для criteria НЕ існує і changeValue > 0:
   - Створюється новий запис → `GetPlayer()->GetMap()->GetCurrentClockTime()` → **m_currMap == NULL → CRASH**
4. Якщо money = 0: `SetCriteriaProgress()` робить `if (changeValue == 0) return;` → NO CRASH
5. Якщо запис для criteria ВЖЕ ІСНУЄ: бере `else` гілку без `GetMap()` → NO CRASH

### Хронологія дослідження:

1. **Ригорозна процедура тестування:** STOP server → DELETE всі 27+ таблиць для guid → INSERT тест → START server → wait 55s → login bot
2. **Відкрито контамінацію стану:** `docker compose restart` після крешу може залишати stale state → обов'язково `stop` + `up -d`
3. **Побітовий бісект:** Тестовано playerFlags(OK), cinematic(OK), watchedFaction(OK), money(**CRASH**)
4. **Шокуюче відкриття:** money=0 → SUCCESS, money=1 → CRASH (відтворюється стабільно)
5. **Аналіз вихідного коду:** Склоновано mangos-wotlk (commit b07db02dbd9d), проаналізовано Player.cpp + AchievementMgr.cpp
6. **Ланцюжок крешу:** SetMoney() → MoneyChanged() → UpdateAchievementCriteria(type=86) → SetCriteriaProgress() → GetMap() → ASSERT(m_currMap)
7. **DBC аналіз:** Achievement_Criteria.dbc → criteria ID 4224 для type 86 (HIGHEST_GOLD_VALUE_OWNED)

### Виправлення (data-level workaround):

Pre-insert запис в `character_achievement_progress` (guid, criteria=4224, counter=money) ПІСЛЯ трансферу.
Це змушує `SetCriteriaProgress` використовувати гілку "existing progress" яка НЕ викликає `GetMap()`.

### Інтегровано в:
- `transfer-interactive.sh` → `fix_char_after_transfer()` секція 8
- `migrate_tbc_to_wotlk.sql` — SQL workaround для bulk transfers
- `migrate_classic_to_wotlk.sql` — SQL workaround для bulk transfers

### Тестування:
- ✅ Ізольований тест: money=37903267 + criteria pre-insert → LOGIN SUCCESS
- ✅ Повний трансфер TBC→WotLK через transfer-interactive.sh → LOGIN SUCCESS
- ✅ Повний пайплайн Classic→TBC→WotLK → LOGIN SUCCESS на всіх серверах
- ✅ Classic→TBC login bot → SUCCESS
- ✅ TBC→WotLK login bot → SUCCESS

### Поточний стан персонажів:
- Classic: Samuel guid=1801, Lv60 (оригінал)
- TBC: Samuel guid=1801, Lv60 (перенесено з Classic)
- WotLK: Samuel guid=1801, Lv60 (перенесено через TBC)

---

## Сесія: Transfer Fidelity — збереження спелів, скілів, PVP титулів (2026-03-14)

### Проблеми виявлені користувачем:
1. **Спели/скіли/професії знищені** — Warlock мав 392 спела на Classic, на WotLK лише ~10
2. **PVP титули відсутні** — Grand Marshal (honor_highest_rank=18) не перенесено
3. **Action bars порожні** — видалялись при трансфері

### Кореневі причини:
1. `at_login | 6` включав `RESET_SPELLS` (біт 2) → сервер **знищував всі заучені спели** при першому логіні, залишаючи лише базові класові
2. `knownTitles` перезаписувався як `'0 0 0 0 0 0'` → втрата будь-яких титулів
3. Classic `honor_highest_rank` не мігрувався в TBC/WotLK `knownTitles` bitfield
4. Classic `stored_honorable_kills` не копіювався в `totalKills`
5. `DELETE FROM character_action` видаляв action bars

### Виправлення:
1. **at_login**: `| 6` → `| 4` (тільки RESET_TALENTS, НЕ RESET_SPELLS)
2. **knownTitles**: Padding замість overwrite (зберігає існуючі біти)
3. **Section 9 — PVP Honor Migration**:
   - Автоматично перевіряє чи TEMP_DB має `honor_highest_rank` (Classic)
   - Конвертує honor_highest_rank → knownTitles біти через CharTitles.dbc маппінг
   - Alliance (race 1,3,4,7,11): bit_index 1..visual_rank (title IDs 1-14)
   - Horde (race 2,5,6,8,10): bit_index 15..14+visual_rank (title IDs 15-28)
   - Формула: visual_rank = honor_highest_rank - 4 (ranks 5-18 → PVP 1-14)
   - honor_highest_rank=18 → всі біти 1-14 → knownTitles[0]=32766 (0x7FFE)
4. **totalKills**: `stored_honorable_kills` → `totalKills` (Classic→TBC/WotLK)
5. **Action bars**: Не видаляються — спели збережені, мертві talent-слоти показують порожнє місце

### Верифікація (Classic→TBC→WotLK pipeline):

| Метрика | Classic | TBC (після трансферу) | WotLK (після логіну) |
|---|---|---|---|
| Спели | 392 | 392 | **371** (RESET_TALENTS видалив ~21 talent-спелі) |
| Скіли | 18 | 18 | **18** |
| knownTitles[0] | N/A | **32766** | **32766** |
| totalKills | 362 | **362** | **362** |
| money | 37903267 | 37903267 | 37903267 |
| Login bot | - | - | **SUCCESS** |

---

## Сесія: Phase 13 — Pipeline Infrastructure (2026-03-14)

### Мета:
DRY рефакторинг: витягнути спільний код з `transfer-interactive.sh` та `daily-sync.sh` у спільну бібліотеку `lib.sh`. Додати login bot verification wrapper, оновити конфіг з паролями.

### Виконано:

1. **Створено `transfer/lib.sh` (~420 рядків)** — спільна бібліотека:
   - Мапи контейнерів/БД/портів: `LIB_DB_CONTAINER`, `LIB_SERVER_CONTAINER`, `LIB_CHAR_DB`, `LIB_REALMD_DB`, `LIB_COMPOSE_DIR`, `LIB_WORLD_DB`, `LIB_AUTH_PORT`, `LIB_WORLD_PORT`
   - Логування: `log_info`, `log_warn`, `log_error`, `log_step` (з `LOG_FILE` tee)
   - DB helpers: `db_exec()`, `db_dump()`, `safe_insert()`, `table_exists()`
   - `fix_char_after_transfer()` — повна 9-секційна санітизація (із Phase 12)
   - `wait_for_server_ready()`, `stop_server_if_running()`, `start_server()`, `restart_after_crash()`
   - `verify_character_login()`, `verify_all_characters()` — login bot wrappers
   - `ensure_account()` — авто-створення акаунтів з SRP6
   - Hash функції: `ensure_sync_table()`, `compute_char_hash()`, `get_stored_hash()`, `store_hash()`

2. **Рефакторинг `transfer-interactive.sh`** (907 → ~560 рядків, -38%):
   - `source lib.sh` + `declare -n` nameref aliases
   - Видалено ~350 рядків дубльованого коду

3. **Рефакторинг `daily-sync.sh`** (674 → 430 рядків, -36%):
   - `source lib.sh` + CTR compatibility map (composite keys `[exp-db]`)
   - Видалено стару `fix_char_after_transfer()` з `at_login | 6` багом
   - Оновлено `read_accounts()` для формату `USERNAME:PASSWORD`
   - Додано login bot верифікацію після перезапуску серверів
   - `TEMP_DB` передається як env var для PVP honor migration

4. **Оновлено `sync-accounts.conf`** → формат `USERNAME:PASSWORD`

5. **Деплой на сервер** → `/opt/cmangos-transfer/` (всі 7 файлів, `chmod +x`)

### Тестування:
- `bash -n` синтаксис: всі 3 скрипти ✅ (локально та remote)
- Classic→TBC трансфер: ✅ (PVP rank 18→knownTitles[0]=32766, totalKills=362)
- TBC→WotLK трансфер: ✅ (achievement workaround criteria 4224, 9 invalid spells removed)
- Login bot TBC: ✅ SUCCESS (Samuel guid=1801)
- Login bot WotLK: ✅ SUCCESS (Samuel guid=1801)

### Критичні рішення:
- **`declare -n` (nameref)** для alias'ів map → transfer-interactive використовує `EXP_DB_CONTAINER[classic]`, lib.sh зберігає як `LIB_DB_CONTAINER[classic]`
- **CTR compatibility map** для daily-sync → composite keys `[classic-db]`, `[tbc-srv]` не можна nameref, потрібна явна ініціалізація
- **`TEMP_DB` як env var** перед `fix_char_after_transfer` → PVP honor migration потребує доступ до source data

---

## Сесія: Phase 14 — Sequential Daily Sync Pipeline (2026-03-14)

### Мета:
Переструктурувати `daily-sync.sh` для ПОСЛІДОВНОГО pipeline: TBC→WotLK трансфер відбувається ПІСЛЯ login verification на TBC (нормалізовані дані). Додати per-character rollback при FAIL та детальний summary.

### Виконано:

1. **Повний рефакторинг MAIN блоку daily-sync.sh** (430→624 рядків):
   - 10-кроковий послідовний pipeline:
     1. Stop ALL servers
     2. Phase A: Classic→TBC transfers (all accounts)
     3. Start TBC server, wait_for_server_ready
     4. Phase B: Verify TBC characters (login bot)
     5. Stop TBC server
     6. Phase C: TBC→WotLK transfers (POST-LOGIN normalized TBC data!)
     7. Start WotLK server, wait_for_server_ready
     8. Phase D: Verify WotLK characters
     9. Start ALL servers
     10. Summary + log rotation (keep 30)

2. **Нова функція `rollback_character(expansion, guid)`:**
   - Видаляє персонажа + 25+ пов'язаних таблиць
   - Включає pets (character_pet → pet_aura, pet_spell), items (character_inventory → item_instance), mail (mail → mail_items), corpse
   - `restart_after_crash()` якщо сервер крешнув після FAIL

3. **Tracking arrays:**
   - `TBC_SYNCED_CHARS`, `WOTLK_SYNCED_CHARS` — username:guid pairs для verify
   - `PHASE_SYNCED[tbc|wotlk]`, `PHASE_VERIFIED[tbc|wotlk]`, `PHASE_ROLLED_BACK[tbc|wotlk]`
   - Duration timing (`START_TIME` → `END_TIME`)

4. **Bug fixes під час тестування:**
   - `local` keyword в MAIN scope → bash error → замінено на `_` prefixed variables
   - Empty array expansion з `set -u` → `${arr[@]+${arr[@]}}` pattern
   - `already_done` unbound → pre-initialized `_already_done`

5. **Deploy + Test:** Повний pipeline Classic→TBC(verify)→WotLK(verify) — SUCCESS

### Тестування (повний pipeline):
- Phase A: Samuel Classic→TBC — SYNCED (PVP rank 18→knownTitles[0]=32766, totalKills=362, 3 invalid spells removed)
- Phase B: TBC verification — ✅ Samuel guid=1801 SUCCESS
- Phase C: Samuel TBC→WotLK — SYNCED (4 invalid spells removed, achievement workaround criteria 4224)
- Phase D: WotLK verification — ✅ Samuel guid=1801 SUCCESS
- Duration: 3m 11s, Synced: 2, Errors: 0, Rollbacks: 0

### Критичні рішення:
- **КЛЮЧОВЕ:** TBC→WotLK копіювання відбувається ПІСЛЯ login verify на TBC — сервер нормалізує дані персонажа (спели, таланти, equipment) при першому вході
- **`${arr[@]+${arr[@]}}`** — безпечна ітерація порожніх масивів з `set -u` (bash strict mode)
- **Log rotation:** `ls -1t | tail -n +31 | xargs -r rm -f` — зберігає останні 30 логів
