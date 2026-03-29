# AzerothCore Schema Mapping

```text
LAST_VERIFIED: 2026-03-15 00:35 EET
SOURCE_DB: workspace:wotlkcharacters + workspace:wotlkrealmd
TARGET_SCHEMA: official azerothcore/azerothcore-wotlk data/sql/base/db_characters + db_auth
```

Цей документ є результатом `TASK-009` і слугує безпосереднім input для `TASK-010` (`migrate_cmangos_wotlk_to_azerothcore.sql`) та `TASK-011` (AzerothCore login/auth support).

## Джерела правди

- Source of truth для CMaNGOS:
  - live `INFORMATION_SCHEMA.COLUMNS` з `workspace:wotlkcharacters`
  - live `INFORMATION_SCHEMA.COLUMNS` з `workspace:wotlkrealmd`
- Source of truth для AzerothCore:
  - official sparse checkout `localProjects/cmangos_projects/azerothcore-wotlk/data/sql/base/db_characters`
  - official sparse checkout `localProjects/cmangos_projects/azerothcore-wotlk/data/sql/base/db_auth`
- Transfer scope:
  - поточний table-set із `localProjects/cmangos_projects/transfer/transfer.sh`

## Підсумок

- `db_characters`:
  - CMaNGOS WotLK live schema = `78` tables
  - AzerothCore base schema = `106` tables
  - same-name overlap = `59`
  - CMaNGOS-only = `19`
  - AzerothCore-only = `47`
- `db_auth`:
  - CMaNGOS WotLK live schema = `13` tables
  - AzerothCore base schema = `18` tables
  - same-name overlap = `6`
  - CMaNGOS-only = `7`
  - AzerothCore-only = `12`
- Поточний `transfer.sh` table-set:
  - усього релевантних transfer tables = `45`
  - same-name coverage в AzerothCore = `43`
  - явний rename = `1`
  - повністю відсутня цільова таблиця = `1`

Rename всередині current pipeline:

| CMaNGOS | AzerothCore | Коментар |
|---|---|---|
| `character_tutorial` | `account_tutorial` | Зміна імені таблиці і account-key (`account` → `accountId`) |

Missing на AzerothCore всередині current pipeline:

| CMaNGOS | AzerothCore status | Коментар |
|---|---|---|
| `character_battleground_data` | `no direct target table` | Для MVP треба або свідомо дропати, або шукати інший persistence path |

## Current Pipeline Coverage

### 1. Direct `safe_insert` candidates

Ці таблиці мають той самий table name в AzerothCore, а drift зводиться до display-width/type cleanup або до AC-only target columns, які можна залишити на default values:

- `character_account_data`
- `character_action`
- `character_battleground_random`
- `character_declinedname`
- `character_equipmentsets`
- `character_gifts`
- `character_instance`
- `character_inventory`
- `character_pet`
- `character_queststatus_daily`
- `character_queststatus_monthly`
- `character_queststatus_weekly`
- `character_reputation`
- `character_skills`
- `character_social`
- `character_spell_cooldown`
- `character_stats`
- `character_achievement`
- `character_achievement_progress`
- `guild`
- `guild_eventlog`
- `guild_rank`
- `guild_bank_eventlog`
- `guild_bank_item`
- `guild_bank_right`
- `guild_bank_tab`
- `item_instance`
- `mail`
- `mail_items`
- `petition`
- `petition_sign`
- `pet_spell`
- `pet_spell_cooldown`

Нюанс:

- `character_inventory` і `mail_items` втрачають `item_template`, бо AzerothCore його не зберігає в цих таблицях.
- `character_pet` втрачає `resettalents_cost` і `resettalents_time`, бо AzerothCore base table їх не має.
- `character_instance` не має прямого аналога `ExtendState`; AzerothCore використовує `extended`.

### 2. Same-name tables that still need explicit transform

| Table | Чому `safe_insert` недостатній |
|---|---|
| `characters` | AzerothCore розкладає appearance/spec/rest/instance fields і має AC-only columns без 1:1 source names |
| `character_homebind` | Повний rename колонок: `map/zone/position_*` → `mapId/zoneId/posX/posY/posZ` |
| `character_spell` | CMaNGOS: `active/disabled`; AzerothCore: `specMask` |
| `character_talent` | CMaNGOS: `talent_id/current_rank/spec`; AzerothCore: `spell/specMask` |
| `character_glyphs` | CMaNGOS: 1 row per slot; AzerothCore: 1 row per `talentGroup` with `glyph1..glyph6` |
| `character_queststatus` | CMaNGOS `rewarded` не існує в target table; AzerothCore виніс це в `character_queststatus_rewarded` і додав `playercount` |
| `character_aura` | Rename + shape drift: `caster_guid/item_guid/effIndexMask/basepoints*` vs `casterGuid/itemGuid/effectMask/amount*/base_amount*` |
| `pet_aura` | Та сама проблема, що й `character_aura` |
| `corpse` | Rename/shape drift: `map/player/position_*` vs `mapId/instanceId/pos*/corpseType/...` |
| `guild_member` | CMaNGOS bank counters living in-row, AzerothCore виніс щоденні withdraw counters у `guild_member_withdraw` |
| `account` | Auth schema принципово інша; потрібен explicit transform і заповнення `account_access` |

### 3. Source-only or custom CMaNGOS tables

Ці таблиці існують на source, але не є 1:1 target tables в AzerothCore:

- `character_battleground_data`
- `character_sync_hash`
- `account_instances_entered`
- `auction`
- `gm_surveys`
- `gm_tickets`
- `item_loot`
- `playerbot_quest_data`
- `playerbot_saved_data`
- `playerbot_talentspec`
- `ahbot_items`
- `saved_variables`
- `event_group_chosen`
- `game_event_status`

Практичний висновок:

- `character_sync_hash` є project-specific metadata і не повинен blindly копіюватися в AzerothCore characters DB.
- `playerbot_*`, `ahbot_items` і схожі server-specific tables треба вважати out-of-scope для першого AzerothCore MVP.

### 4. Target-only AzerothCore tables

Вони або не мають CMaNGOS аналога, або мають бути generated/default-filled на target:

- `character_queststatus_rewarded`
- `guild_member_withdraw`
- `account_access`
- `character_settings`
- `character_entry_point`
- `character_achievement_offline_updates`
- `character_banned`
- `quest_tracker`
- `recovery_item`
- `character_queststatus_seasonal`
- `worldstates`
- `addons`
- `banned_addons`
- `channels`, `channels_bans`, `channels_rights`
- `mail_server_*`
- `account_muted`
- `autobroadcast`, `autobroadcast_locale`
- `build_info`
- `secret_digest`

## Explicit Mapping Rules

### `characters`

Найбільший blocker. AzerothCore `characters` має схожий core row, але не 1:1 shape:

- CMaNGOS-only fields:
  - `playerBytes`
  - `playerBytes2`
  - `dungeon_difficulty`
  - `specCount`
  - `activeSpec`
  - `fishingSteps`
- AzerothCore-only fields:
  - `skin`, `face`, `hairStyle`, `hairColor`, `facialStyle`
  - `bankSlots`
  - `restState`
  - `instance_id`, `instance_mode_mask`
  - `latency`
  - `talentGroupsCount`, `activeTalentGroup`
  - `creation_date`
  - `innTriggerId`
  - `extraBonusTalentCount`

Потрібні правила:

- unpack `playerBytes`/`playerBytes2` у AC appearance fields;
- map `specCount -> talentGroupsCount`;
- map `activeSpec -> activeTalentGroup`;
- визначити, як переносити `dungeon_difficulty` у `instance_mode_mask` або чи краще reset-ити instance-specific state;
- задати default policy для `bankSlots`, `latency`, `creation_date`, `innTriggerId`, `extraBonusTalentCount`.

### `character_homebind`

Прямий rename:

- `map -> mapId`
- `zone -> zoneId`
- `position_x -> posX`
- `position_y -> posY`
- `position_z -> posZ`

### `character_spell`

CMaNGOS:

- `guid`
- `spell`
- `active`
- `disabled`

AzerothCore:

- `guid`
- `spell`
- `specMask`

Потрібне policy-рішення:

- як конвертувати `active/disabled` у `specMask`;
- чи переносити все як `specMask=1`, чи намагатися відновлювати multi-spec membership.

### `character_talent`

CMaNGOS:

- `guid`
- `talent_id`
- `current_rank`
- `spec`

AzerothCore:

- `guid`
- `spell`
- `specMask`

Це не просто rename. Потрібен lookup, який перетворить `talent_id + current_rank` у learned talent spell ID.

### `character_glyphs`

CMaNGOS зберігає glyph-и рядками:

- `guid`, `spec`, `slot`, `glyph`

AzerothCore зберігає їх pivot-ом:

- `guid`, `talentGroup`, `glyph1..glyph6`

Потрібен pivot transform per `guid + spec`.

### `character_queststatus`

CMaNGOS:

- має поле `rewarded`

AzerothCore:

- не має `rewarded` у `character_queststatus`
- натомість має `character_queststatus_rewarded(guid, quest, active)`
- додає `playercount`

Потрібне правило:

- `rewarded=1` переносити в `character_queststatus_rewarded`;
- `playercount` ініціалізувати `0`, якщо не буде знайдено кращого джерела.

### `character_aura` і `pet_aura`

Тут drift уже не cosmetic:

- snake_case → camelCase rename для GUID/item/effect columns;
- `basepoints*` / `periodictime*` vs `amount*` / `base_amount*`;
- інша компоновка PK і masks.

Практичний висновок:

- blind `safe_insert` тут небезпечний;
- для MVP треба або писати explicit field mapping, або свідомо не переносити transient aura state і покладатися на post-login normalization.

### `guild_member`

CMaNGOS тримає bank withdrawal counters прямо в `guild_member`:

- `BankRemMoney`
- `BankRemSlotsTab0..5`
- `BankResetTimeMoney`
- `BankResetTimeTab0..5`

AzerothCore виніс денні залишки в окрему таблицю:

- `guild_member_withdraw(guid, tab0..tab5, money)`

Потрібне правило:

- rank / notes / membership можна переносити напряму;
- bank withdraw remainder треба окремо materialize-ити в `guild_member_withdraw`, або свідомо reset-ити.

### `account` / `account_access`

Це окремий blocker для Phase 16.3 і 16.4.

CMaNGOS `account`:

- має `gmlevel` прямо в account row
- тримає auth у `v`, `s`, `sessionkey` як `longtext`
- має `lockedIp`, `last_module`, `module_day`, `active_realm_id`, `platform`, `token`
- `locale` = `varchar(4)`

AzerothCore `account`:

- переносить GM access у `account_access(id, gmlevel, RealmID, comment)`
- тримає auth у `salt`, `verifier`, `session_key` binary columns
- додає `totp_secret`, `reg_mail`, `last_ip`, `last_attempt_ip`, `lock_country`, `last_login`, `online`, `mutereason`, `muteby`, `recruiter`, `totaltime`
- `locale` = numeric tinyint

Потрібні правила:

- `gmlevel -> account_access`;
- `s/v/sessionkey` потрібно explicit transform-ити у binary target columns;
- поточні helpers `srp6_set_password.py` і `ensure_account()` не можна reuse без адаптації під AzerothCore auth schema.

## Rename Map Outside The Current Pipeline

| CMaNGOS | AzerothCore | Коментар |
|---|---|---|
| `account_instances_entered` | `account_instance_times` | Lockout/instance history |
| `auction` | `auctionhouse` | Auction subsystem |
| `gm_tickets` | `gm_ticket` | GM support |
| `gm_surveys` | `gm_survey` | GM survey subsystem |
| `item_loot` | `item_loot_storage` | Item loot persistence |
| `character_tutorial` | `account_tutorial` | Потрапляє в current pipeline |

Partial/non-1:1 mappings:

| CMaNGOS | AzerothCore | Коментар |
|---|---|---|
| `saved_variables` | `worldstates` | Потрібен semantic remap, не 1:1 copy |
| `guild_member` bank counters | `guild_member_withdraw` | Не rename, а split |
| `character_queststatus.rewarded` | `character_queststatus_rewarded` | Не rename, а split |

## Blockers Before `TASK-010`

1. Потрібен explicit auth/account transform, а не reuse поточного CMaNGOS realmd path.
2. Потрібен helper для `characters` row:
   - appearance unpack
   - spec fields
   - rest/instance/default policy
3. Потрібен `talent_id/current_rank -> spell` lookup для `character_talent`.
4. Потрібен glyph pivot `rows -> glyph1..glyph6`.
5. Потрібно вирішити aura policy:
   - explicit transform
   - або свідомий drop-before-verify для MVP
6. Потрібно вирішити долю `character_battleground_data`, бо прямої цільової таблиці немає.
7. Якщо важливо зберегти guild bank daily counters, потрібен додатковий insert у `guild_member_withdraw`.

## Практичний Висновок Для `TASK-010`

`migrate_cmangos_wotlk_to_azerothcore.sql` має бути hybrid-підходом:

- використовувати current `safe_insert()` для same-name tables, де drift лише additive/defaultable;
- додати явні pre/post transforms для:
  - `account` + `account_access`
  - `characters`
  - `character_homebind`
  - `character_spell`
  - `character_talent`
  - `character_glyphs`
  - `character_queststatus` + `character_queststatus_rewarded`
  - `character_aura`
  - `pet_aura`
  - `guild_member` + `guild_member_withdraw`
- свідомо задокументувати, які CMaNGOS-only tables не входять у перший AzerothCore MVP.
