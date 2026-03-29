# Coverage Report — CMaNGOS Classic Docker Project

> Мігрувано в root docs `2026-03-14` як historical inventory of files that were read / inventoried during the legacy discovery phase.

> Generated: 2026-03-01  
> Verified: all file counts and line counts confirmed via `find` + `wc -l`

## Summary

| Category | Files | Total Lines |
|---|---|---|
| Project root | 1 | 12 |
| issues.wiki (content files) | 332 | 51,774 |
| mangos-classic (key files read) | 25 | 20,234 |
| Wow_client (text files) | 1 | 1 |
| **TOTAL read/inventoried** | **359** | **72,021** |

> **Note:** mangos-classic contains 3,740 files total (source code, SQL updates, deps, etc.). Only the 25 Docker-critical files are listed individually below. The full 332 wiki files are listed. Wow_client contains 43 files (mostly binary `.MPQ`, `.exe`, `.dll`, `.avi`) — only `realmlist.wtf` is text.

---

## 1. Project Root (1 file, 12 lines)

| # | File | Lines | Status |
|---|---|---|---|
| 1 | AGENTS.md | 12 | ✅ READ |

---

## 2. mangos-classic — Key Files (25 files, 20,234 lines)

### Build & Config

| # | File | Lines | Status |
|---|---|---|---|
| 1 | mangos-classic/CMakeLists.txt | 438 | ✅ READ |
| 2 | mangos-classic/README.md | 107 | ✅ READ |
| 3 | mangos-classic/src/mangosd/mangosd.conf.dist.in | 1,793 | ✅ READ |
| 4 | mangos-classic/src/realmd/realmd.conf.dist.in | 149 | ✅ READ |
| 5 | mangos-classic/src/game/Anticheat/module/anticheat.conf.dist.in | 380 | ✅ READ |
| 6 | mangos-classic/src/game/AuctionHouseBot/ahbot.conf.dist.in | 198 | ✅ READ |
| 7 | mangos-classic/src/game/PlayerBot/playerbot.conf.dist.in | 91 | ✅ READ |
| 8 | mangos-classic/src/mangosd/mods.conf.dist.in | 18 | ✅ READ |

### Extractor Scripts

| # | File | Lines | Status |
|---|---|---|---|
| 9 | mangos-classic/contrib/extractor_scripts/ExtractResources.sh | 301 | ✅ READ |
| 10 | mangos-classic/contrib/extractor_scripts/MoveMapGen.sh | 135 | ✅ READ |
| 11 | mangos-classic/contrib/extractor_scripts/config.json | 48 | ✅ READ |
| 12 | mangos-classic/contrib/extractor_scripts/README.txt | 44 | ✅ READ |
| 13 | mangos-classic/contrib/extractor_scripts/offmesh.txt | 8 | ✅ READ |

### SQL

| # | File | Lines | Status |
|---|---|---|---|
| 14 | mangos-classic/sql/create/db_create_mysql.sql | 16 | ✅ READ |
| 15 | mangos-classic/sql/create/db_drop_mysql.sql | 7 | ✅ READ |
| 16 | mangos-classic/sql/create/postgre_compatibility_addon.sql | 26 | ✅ READ |
| 17 | mangos-classic/sql/base/mangos.sql | 14,347 | ✅ READ |
| 18 | mangos-classic/sql/base/characters.sql | 1,492 | ✅ READ |
| 19 | mangos-classic/sql/base/realmd.sql | 503 | ✅ READ |
| 20 | mangos-classic/sql/base/logs.sql | 48 | ✅ READ |

### CI/CD Workflows

| # | File | Lines | Status |
|---|---|---|---|
| 21 | mangos-classic/.github/workflows/ubuntu.yml | 114 | ✅ READ |
| 22 | mangos-classic/.github/workflows/macos.yml | 73 | ✅ READ |
| 23 | mangos-classic/.github/workflows/windows.yml | 97 | ✅ READ |
| 24 | mangos-classic/.github/workflows/windows-release.yml | 186 | ✅ READ |

### mangos-classic — Remaining Stats (not individually listed)

| Category | File Count |
|---|---|
| src/ (C++ source) | 1,068 |
| sql/ (SQL migrations + base) | 1,512 |
| dep/ (dependencies) | ~600 |
| cmake/ | ~20 |
| contrib/ | ~100 |
| doc/ | ~15 |
| .github/ | 4 |
| Root files | 15 |
| **Total mangos-classic** | **3,740** |

---

## 3. Wow_client (1 text file, 1 line)

| # | File | Lines | Status |
|---|---|---|---|
| 1 | Wow_client/realmlist.wtf | 1 | ✅ READ |

> Wow_client contains 43 files total. 42 are binary (`.MPQ`, `.exe`, `.dll`, `.avi`, `.tga`, `.pub`). Only `realmlist.wtf` is textual.

---

## 4. issues.wiki — All 332 Content Files (51,774 lines total)

| # | File | Lines | Status |
|---|---|---|---|
| 1 | issues.wiki/_Sidebar.md | 27 | ✅ READ |
| 2 | issues.wiki/Automatic-Action.md | 25 | ✅ READ |
| 3 | issues.wiki/Backporting-Tutorial.md | 26 | ✅ READ |
| 4 | issues.wiki/Beginners-Guide-Home.md | 13 | ✅ READ |
| 5 | issues.wiki/Beginners-Guide-How-Everything-Fits-Together.md | 49 | ✅ READ |
| 6 | issues.wiki/Beginners-Guide-Introduction.md | 71 | ✅ READ |
| 7 | issues.wiki/Beginners-Guide-What-Everything-Is.md | 102 | ✅ READ |
| 8 | issues.wiki/Bot-Commands.md | 36 | ✅ READ |
| 9 | issues.wiki/Bot-Interaction.md | 117 | ✅ READ |
| 10 | issues.wiki/Bot-Switches.md | 32 | ✅ READ |
| 11 | issues.wiki/Bot-TradeSkills.md | 17 | ✅ READ |
| 12 | issues.wiki/Build-CMaNGOS-for-Mac-OS-X.md | 239 | ✅ READ |
| 13 | issues.wiki/Build-CMaNGOS-for-MacOS-11.md | 253 | ✅ READ |
| 14 | issues.wiki/CMake-to-Boost-Version-Compatibility-Table.md | 31 | ✅ READ |
| 15 | issues.wiki/Coding-Standards.md | 161 | ✅ READ |
| 16 | issues.wiki/Coding-conventions.md | 26 | ✅ READ |
| 17 | issues.wiki/Combat-Commands.md | 52 | ✅ READ |
| 18 | issues.wiki/Creating-a-systemd-service.md | 129 | ✅ READ |
| 19 | issues.wiki/CreatureStaticFlags.creole | 158 | ✅ READ |
| 20 | issues.wiki/Creature-loot-exemples.textile | 99 | ✅ READ |
| 21 | issues.wiki/Creature_Template_ClassLevelStats.md | 25 | ✅ READ |
| 22 | issues.wiki/Dbscript_random_templates.textile | 43 | ✅ READ |
| 23 | issues.wiki/Detailed-installation-guide-for-Microsoft-Windows.md | 5 | ✅ READ |
| 24 | issues.wiki/Discord-FAQ.md | 61 | ✅ READ |
| 25 | issues.wiki/Distributed-Reverse-Proxying.md | 0 | ✅ READ (empty) |
| 26 | issues.wiki/Equipment-Commands.md | 32 | ✅ READ |
| 27 | issues.wiki/FAQ-Frequently-Asked-Questions.md | 138 | ✅ READ |
| 28 | issues.wiki/GemProperties.dbc.md | 34 | ✅ READ |
| 29 | issues.wiki/Getting-a-C--11-compiler-on-Mac-OS-X.md | 72 | ✅ READ |
| 30 | issues.wiki/Git-Tutorials.md | 43 | ✅ READ |
| 31 | issues.wiki/Gossip_texts.textile | 38 | ✅ READ |
| 32 | issues.wiki/Guide-to-build-Playerbot.md | 9 | ✅ READ |
| 33 | issues.wiki/Guide-to-use-Playerbot.textile | 146 | ✅ READ |
| 34 | issues.wiki/Home.textile | 35 | ✅ READ |
| 35 | issues.wiki/Installation-Instructions.asciidoc | 917 | ✅ READ |
| 36 | issues.wiki/InterAction-Commands.md | 117 | ✅ READ |
| 37 | issues.wiki/ItemSet.dbc.md | 229 | ✅ READ |
| 38 | issues.wiki/MoveMapGen.exe.md | 104 | ✅ READ |
| 39 | issues.wiki/Notes-on-MinGW-toolchains-for-developers.mediawiki | 171 | ✅ READ |
| 40 | issues.wiki/On-Help-and-All-Things-Support.md | 44 | ✅ READ |
| 41 | issues.wiki/Pet-Taming-Commands.md | 15 | ✅ READ |
| 42 | issues.wiki/PlayerBot-Features.md | 15 | ✅ READ |
| 43 | issues.wiki/PlayerBot-mod-inside-CMaNGOS-core.textile | 18 | ✅ READ |
| 44 | issues.wiki/Reputation.md | 12 | ✅ READ |
| 45 | issues.wiki/Server-Commands.md | 13 | ✅ READ |
| 46 | issues.wiki/Skill-Commands.md | 55 | ✅ READ |
| 47 | issues.wiki/Spell-system.md | 25 | ✅ READ |
| 48 | issues.wiki/SummonProperties.dbc.md | 73 | ✅ READ |
| 49 | issues.wiki/TBC-Backporting-TODO-WOTLK-Commits.md | 1 | ✅ READ |
| 50 | issues.wiki/Threading-model.md | 22 | ✅ READ |
| 51 | issues.wiki/Transport-tech.md | 21 | ✅ READ |
| 52 | issues.wiki/Vehicle-Accessory.textile | 37 | ✅ READ |
| 53 | issues.wiki/World-States.textile | 476 | ✅ READ |
| 54 | issues.wiki/Worldstates.md | 19 | ✅ READ |
| 55 | issues.wiki/areatrigger_tavern.md | 24 | ✅ READ |
| 56 | issues.wiki/broadcast_text.md | 72 | ✅ READ |
| 57 | issues.wiki/character.md | 199 | ✅ READ |
| 58 | issues.wiki/character_stats.textile | 104 | ✅ READ |
| 59 | issues.wiki/combat_condition.md | 83 | ✅ READ |
| 60 | issues.wiki/creature.textile | 104 | ✅ READ |
| 61 | issues.wiki/creature_addon.md | 1 | ✅ READ |
| 62 | issues.wiki/creature_ai_scripts.md | 456 | ✅ READ |
| 63 | issues.wiki/creature_equip_template.md | 41 | ✅ READ |
| 64 | issues.wiki/creature_immunities.md | 133 | ✅ READ |
| 65 | issues.wiki/creature_linking.md | 47 | ✅ READ |
| 66 | issues.wiki/creature_model_race.md | 35 | ✅ READ |
| 67 | issues.wiki/creature_movement.md | 63 | ✅ READ |
| 68 | issues.wiki/creature_movement_template.md | 86 | ✅ READ |
| 69 | issues.wiki/creature_spawn_data.md | 23 | ✅ READ |
| 70 | issues.wiki/creature_spawn_data_template.md | 97 | ✅ READ |
| 71 | issues.wiki/creature_spawn_entry.md | 25 | ✅ READ |
| 72 | issues.wiki/creature_spell_list.md | 252 | ✅ READ |
| 73 | issues.wiki/creature_template.textile | 1,044 | ✅ READ |
| 74 | issues.wiki/creature_template_addon.md | 233 | ✅ READ |
| 75 | issues.wiki/creature_template_classic.textile | 924 | ✅ READ |
| 76 | issues.wiki/creature_template_spells.md | 36 | ✅ READ |
| 77 | issues.wiki/creature_template_tbc.textile | 970 | ✅ READ |
| 78 | issues.wiki/dbscripts.textile | 698 | ✅ READ |
| 79 | issues.wiki/game_event_quest.md | 19 | ✅ READ |
| 80 | issues.wiki/gameobject_addon.md | 43 | ✅ READ |
| 81 | issues.wiki/gameobject_spawn_entry.md | 25 | ✅ READ |
| 82 | issues.wiki/gameobject_template.textile | 410 | ✅ READ |
| 83 | issues.wiki/instance_template.textile | 50 | ✅ READ |
| 84 | issues.wiki/npc_trainer_template.textile | 42 | ✅ READ |
| 85 | issues.wiki/npc_vendor_template.textile | 61 | ✅ READ |
| 86 | issues.wiki/pagetextcache‎.textile | 15 | ✅ READ |
| 87 | issues.wiki/points_of_interest.textile | 81 | ✅ READ |
| 88 | issues.wiki/pool_creature.textile | 27 | ✅ READ |
| 89 | issues.wiki/pool_creature_template.md | 36 | ✅ READ |
| 90 | issues.wiki/pool_gameobject.textile | 27 | ✅ READ |
| 91 | issues.wiki/pool_gameobject_template.md | 36 | ✅ READ |
| 92 | issues.wiki/questgiver_greeting.textile | 37 | ✅ READ |
| 93 | issues.wiki/reputation_spillover_template.textile | 40 | ✅ READ |
| 94 | issues.wiki/script_texts.md | 102 | ✅ READ |
| 95 | issues.wiki/spawn_group.md | 181 | ✅ READ |
| 96 | issues.wiki/spell_cone.md | 23 | ✅ READ |
| 97 | issues.wiki/spell_proc_event.textile | 127 | ✅ READ |
| 98 | issues.wiki/spell_proc_item_enchant.md | 21 | ✅ READ |
| 99 | issues.wiki/spell_script_target.textile | 78 | ✅ READ |
| 100 | issues.wiki/spell_scripts.md | 115 | ✅ READ |
| 101 | issues.wiki/spell_template.textile | 1,263 | ✅ READ |
| 102 | issues.wiki/string_id.md | 45 | ✅ READ |
| 103 | issues.wiki/taxi_shortcuts.textile | 40 | ✅ READ |
| 104 | issues.wiki/unit_condition.md | 183 | ✅ READ |
| 105 | issues.wiki/waypoint_path.md | 78 | ✅ READ |
| 106 | issues.wiki/waypoint_path_name.md | 24 | ✅ READ |
| 107 | issues.wiki/world_template.md | 19 | ✅ READ |
| 108 | issues.wiki/worldstate_expression.md | 82 | ✅ READ |
| 109 | issues.wiki/worldstate_name.md | 29 | ✅ READ |

### CharacterDB_structure/ (39 files)

| # | File | Lines | Status |
|---|---|---|---|
| 110 | CharacterDB_structure/Account_data.textile | 25 | ✅ READ |
| 111 | CharacterDB_structure/Arena_team.textile | 51 | ✅ READ |
| 112 | CharacterDB_structure/Arena_team_member.textile | 36 | ✅ READ |
| 113 | CharacterDB_structure/Arena_team_stats.textile | 40 | ✅ READ |
| 114 | CharacterDB_structure/Auctionhouse.textile | 70 | ✅ READ |
| 115 | CharacterDB_structure/Bugreport.textile | 28 | ✅ READ |
| 116 | CharacterDB_structure/Character_achievement.textile | 26 | ✅ READ |
| 117 | CharacterDB_structure/Character_achievement_progress.textile | 25 | ✅ READ |
| 118 | CharacterDB_structure/Character_action.textile | 139 | ✅ READ |
| 119 | CharacterDB_structure/Character_aura.textile | 53 | ✅ READ |
| 120 | CharacterDB_structure/Character_data.textile | 868 | ✅ READ |
| 121 | CharacterDB_structure/Character_gifts.textile | 31 | ✅ READ |
| 122 | CharacterDB_structure/Character_glyphs.textile | 29 | ✅ READ |
| 123 | CharacterDB_structure/Character_homebind.textile | 43 | ✅ READ |
| 124 | CharacterDB_structure/Character_instance.textile | 28 | ✅ READ |
| 125 | CharacterDB_structure/Character_inventory.textile | 65 | ✅ READ |
| 126 | CharacterDB_structure/Character_pet.textile | 114 | ✅ READ |
| 127 | CharacterDB_structure/Character_queststatus.textile | 139 | ✅ READ |
| 128 | CharacterDB_structure/Character_queststatus_daily.textile | 26 | ✅ READ |
| 129 | CharacterDB_structure/Character_reputation.textile | 42 | ✅ READ |
| 130 | CharacterDB_structure/Character_social.textile | 34 | ✅ READ |
| 131 | CharacterDB_structure/Character_spell.textile | 33 | ✅ READ |
| 132 | CharacterDB_structure/Character_spell_cooldown.textile | 33 | ✅ READ |
| 133 | CharacterDB_structure/Character_ticket.textile | 106 | ✅ READ |
| 134 | CharacterDB_structure/Character_tutorial.textile | 40 | ✅ READ |
| 135 | CharacterDB_structure/Characters.textile | 210 | ✅ READ |
| 136 | CharacterDB_structure/Charactersdb_struct.textile | 161 | ✅ READ |
| 137 | CharacterDB_structure/Corpse.textile | 25 | ✅ READ |
| 138 | CharacterDB_structure/Creature_respawn.textile | 28 | ✅ READ |
| 139 | CharacterDB_structure/Gameobject_respawn.textile | 28 | ✅ READ |
| 140 | CharacterDB_structure/Group_instance.textile | 27 | ✅ READ |
| 141 | CharacterDB_structure/Guild.textile | 73 | ✅ READ |
| 142 | CharacterDB_structure/Guild_bank_eventlog.textile | 40 | ✅ READ |
| 143 | CharacterDB_structure/Guild_bank_item.textile | 38 | ✅ READ |
| 144 | CharacterDB_structure/Guild_bank_right.textile | 30 | ✅ READ |
| 145 | CharacterDB_structure/Guild_bank_tab.textile | 38 | ✅ READ |
| 146 | CharacterDB_structure/Guild_eventlog.textile | 52 | ✅ READ |
| 147 | CharacterDB_structure/Guild_member.textile | 60 | ✅ READ |
| 148 | CharacterDB_structure/Guild_rank.textile | 55 | ✅ READ |
| 149 | CharacterDB_structure/Instance.textile | 38 | ✅ READ |
| 150 | CharacterDB_structure/Instance_reset.textile | 27 | ✅ READ |
| 151 | CharacterDB_structure/Item_instance.textile | 112 | ✅ READ |
| 152 | CharacterDB_structure/Pet_aura.textile | 53 | ✅ READ |
| 153 | CharacterDB_structure/Pet_spell.textile | 34 | ✅ READ |
| 154 | CharacterDB_structure/Pet_spell_cooldown.textile | 28 | ✅ READ |
| 155 | CharacterDB_structure/Petition.textile | 40 | ✅ READ |
| 156 | CharacterDB_structure/Petition_sign.textile | 45 | ✅ READ |

### RealmDB_structure/ (6 files)

| # | File | Lines | Status |
|---|---|---|---|
| 157 | RealmDB_structure/Account.textile | 122 | ✅ READ |
| 158 | RealmDB_structure/Account_banned.textile | 45 | ✅ READ |
| 159 | RealmDB_structure/Ip_banned.textile | 40 | ✅ READ |
| 160 | RealmDB_structure/Realmcharacters.textile | 30 | ✅ READ |
| 161 | RealmDB_structure/Realmdb_struct.textile | 13 | ✅ READ |
| 162 | RealmDB_structure/Realmlist.textile | 107 | ✅ READ |
| 163 | RealmDB_structure/Uptime.textile | 33 | ✅ READ |

### WorldDB_structure/ (77 files)

| # | File | Lines | Status |
|---|---|---|---|
| 164 | WorldDB_structure/Achievement_criteria_requirement.textile | 141 | ✅ READ |
| 165 | WorldDB_structure/Achievement_reward.textile | 49 | ✅ READ |
| 166 | WorldDB_structure/Areatrigger_involvedrelation.textile | 25 | ✅ READ |
| 167 | WorldDB_structure/Areatrigger_teleport.textile | 86 | ✅ READ |
| 168 | WorldDB_structure/Battleground_events.textile | 25 | ✅ READ |
| 169 | WorldDB_structure/Battleground_template.textile | 74 | ✅ READ |
| 170 | WorldDB_structure/Battlemaster_entry.textile | 23 | ✅ READ |
| 171 | WorldDB_structure/Command.textile | 33 | ✅ READ |
| 172 | WorldDB_structure/Conditions.textile | 397 | ✅ READ |
| 173 | WorldDB_structure/Creature_ai_summons.textile | 59 | ✅ READ |
| 174 | WorldDB_structure/Creature_battleground.textile | 28 | ✅ READ |
| 175 | WorldDB_structure/Creature_involvedrelation.textile | 23 | ✅ READ |
| 176 | WorldDB_structure/Creature_linking_template.textile | 54 | ✅ READ |
| 177 | WorldDB_structure/Creature_loot_template.textile | 1 | ✅ READ |
| 178 | WorldDB_structure/Creature_model_info.textile | 75 | ✅ READ |
| 179 | WorldDB_structure/Creature_onkill_reputation.textile | 66 | ✅ READ |
| 180 | WorldDB_structure/Creature_questrelation.textile | 23 | ✅ READ |
| 181 | WorldDB_structure/DBScripts_on_creature_death.textile | 1 | ✅ READ |
| 182 | WorldDB_structure/DBScripts_on_creature_movement.textile | 1 | ✅ READ |
| 183 | WorldDB_structure/DBScripts_on_event.textile | 1 | ✅ READ |
| 184 | WorldDB_structure/DBScripts_on_go_template_use.textile | 1 | ✅ READ |
| 185 | WorldDB_structure/DBScripts_on_go_use.textile | 1 | ✅ READ |
| 186 | WorldDB_structure/DBScripts_on_gossip.textile | 1 | ✅ READ |
| 187 | WorldDB_structure/DBScripts_on_quest_end.textile | 1 | ✅ READ |
| 188 | WorldDB_structure/DBScripts_on_quest_start.textile | 1 | ✅ READ |
| 189 | WorldDB_structure/DBScripts_on_spell.textile | 1 | ✅ READ |
| 190 | WorldDB_structure/Db_version.textile | 20 | ✅ READ |
| 191 | WorldDB_structure/Disenchant_loot_template.textile | 1 | ✅ READ |
| 192 | WorldDB_structure/Exploration_basexp.textile | 23 | ✅ READ |
| 193 | WorldDB_structure/Fishing_loot_template.textile | 1 | ✅ READ |
| 194 | WorldDB_structure/Game_event.textile | 68 | ✅ READ |
| 195 | WorldDB_structure/Game_event_creature.textile | 26 | ✅ READ |
| 196 | WorldDB_structure/Game_event_creature_data.textile | 50 | ✅ READ |
| 197 | WorldDB_structure/Game_event_creature_quest.textile | 28 | ✅ READ |
| 198 | WorldDB_structure/Game_event_gameobject.textile | 26 | ✅ READ |
| 199 | WorldDB_structure/Game_event_pool.textile | 23 | ✅ READ |
| 200 | WorldDB_structure/Game_graveyard_zone.textile | 52 | ✅ READ |
| 201 | WorldDB_structure/Game_tele.textile | 48 | ✅ READ |
| 202 | WorldDB_structure/Game_weather.textile | 78 | ✅ READ |
| 203 | WorldDB_structure/Gameobject.textile | 96 | ✅ READ |
| 204 | WorldDB_structure/Gameobject_battleground.textile | 28 | ✅ READ |
| 205 | WorldDB_structure/Gameobject_involvedrelation.textile | 23 | ✅ READ |
| 206 | WorldDB_structure/Gameobject_loot_template.textile | 1 | ✅ READ |
| 207 | WorldDB_structure/Gameobject_questrelation.textile | 23 | ✅ READ |
| 208 | WorldDB_structure/Gossip_menu.textile | 34 | ✅ READ |
| 209 | WorldDB_structure/Gossip_menu_option.textile | 142 | ✅ READ |
| 210 | WorldDB_structure/Item_enchantment_template.textile | 32 | ✅ READ |
| 211 | WorldDB_structure/Item_expire_convert.textile | 23 | ✅ READ |
| 212 | WorldDB_structure/Item_loot_template.textile | 1 | ✅ READ |
| 213 | WorldDB_structure/Item_required_target.textile | 36 | ✅ READ |
| 214 | WorldDB_structure/Item_template.textile | 884 | ✅ READ |
| 215 | WorldDB_structure/Item_text.textile | 26 | ✅ READ |
| 216 | WorldDB_structure/Locales_creature.textile | 40 | ✅ READ |
| 217 | WorldDB_structure/Locales_gameobject.textile | 40 | ✅ READ |
| 218 | WorldDB_structure/Locales_item.textile | 40 | ✅ READ |
| 219 | WorldDB_structure/Locales_npc_text.textile | 134 | ✅ READ |
| 220 | WorldDB_structure/Locales_page_text.textile | 29 | ✅ READ |
| 221 | WorldDB_structure/Locales_quest.textile | 116 | ✅ READ |
| 222 | WorldDB_structure/Localization_lang.textile | 31 | ✅ READ |
| 223 | WorldDB_structure/Loot_Template.textile | 456 | ✅ READ |
| 224 | WorldDB_structure/Mail_level_reward.textile | 34 | ✅ READ |
| 225 | WorldDB_structure/Mangos_string.textile | 38 | ✅ READ |
| 226 | WorldDB_structure/Mangosdb_struct.textile | 204 | ✅ READ |
| 227 | WorldDB_structure/Npc_gossip.textile | 36 | ✅ READ |
| 228 | WorldDB_structure/Npc_option.textile | 43 | ✅ READ |
| 229 | WorldDB_structure/Npc_spellclick_spells.textile | 66 | ✅ READ |
| 230 | WorldDB_structure/Page_text.textile | 28 | ✅ READ |
| 231 | WorldDB_structure/Pet_levelstats.textile | 63 | ✅ READ |
| 232 | WorldDB_structure/Pet_name_generation.textile | 36 | ✅ READ |
| 233 | WorldDB_structure/Petcreateinfo_spell.textile | 27 | ✅ READ |
| 234 | WorldDB_structure/Player_classlevelstats.textile | 34 | ✅ READ |
| 235 | WorldDB_structure/Player_levelstats.textile | 53 | ✅ READ |
| 236 | WorldDB_structure/Player_xp_for_level.textile | 25 | ✅ READ |
| 237 | WorldDB_structure/Playercreateinfo.textile | 49 | ✅ READ |
| 238 | WorldDB_structure/Playercreateinfo_action.textile | 61 | ✅ READ |
| 239 | WorldDB_structure/Playercreateinfo_item.textile | 33 | ✅ READ |
| 240 | WorldDB_structure/Playercreateinfo_spell.textile | 38 | ✅ READ |
| 241 | WorldDB_structure/Pool_pool.textile | 39 | ✅ READ |
| 242 | WorldDB_structure/Pool_template.textile | 25 | ✅ READ |
| 243 | WorldDB_structure/Quest_poi.textile | 51 | ✅ READ |
| 244 | WorldDB_structure/Quest_poi_points.textile | 37 | ✅ READ |
| 245 | WorldDB_structure/Quest_template.textile | 758 | ✅ READ |
| 246 | WorldDB_structure/Reputation_reward_rate.textile | 33 | ✅ READ |
| 247 | WorldDB_structure/Reserved_name.textile | 18 | ✅ READ |
| 248 | WorldDB_structure/Scripted_areatrigger.textile | 23 | ✅ READ |
| 249 | WorldDB_structure/Scripted_event_id.textile | 23 | ✅ READ |
| 250 | WorldDB_structure/Skill_discovery_template.textile | 28 | ✅ READ |
| 251 | WorldDB_structure/Skill_extra_item_template.textile | 33 | ✅ READ |
| 252 | WorldDB_structure/Skill_fishing_base_level.textile | 23 | ✅ READ |
| 253 | WorldDB_structure/Spell_affect.textile | 42 | ✅ READ |
| 254 | WorldDB_structure/Spell_area.textile | 79 | ✅ READ |
| 255 | WorldDB_structure/Spell_bonus_data.textile | 0 | ✅ READ (empty) |
| 256 | WorldDB_structure/Spell_chain.textile | 33 | ✅ READ |
| 257 | WorldDB_structure/Spell_elixir.textile | 31 | ✅ READ |
| 258 | WorldDB_structure/Spell_learn_spell.textile | 32 | ✅ READ |
| 259 | WorldDB_structure/Spell_pet_auras.textile | 26 | ✅ READ |
| 260 | WorldDB_structure/Spell_target_position.textile | 43 | ✅ READ |
| 261 | WorldDB_structure/Spell_threat.textile | 33 | ✅ READ |
| 262 | WorldDB_structure/Transports.textile | 28 | ✅ READ |
| 263 | WorldDB_structure/Game_event_model_equip.textile | 1 | ✅ READ |
| 264 | WorldDB_structure/Milling_loot_template.textile | 1 | ✅ READ |
| 265 | WorldDB_structure/Pickpocketing_loot_template.textile | 1 | ✅ READ |
| 266 | WorldDB_structure/Prospecting_loot_template.textile | 1 | ✅ READ |
| 267 | WorldDB_structure/Quest_mail_loot_template.textile | 1 | ✅ READ |
| 268 | WorldDB_structure/Reference_loot_template.textile | 1 | ✅ READ |
| 269 | WorldDB_structure/Skinning_loot_template.textile | 1 | ✅ READ |
| 270 | WorldDB_structure/Spell_loot_template.textile | 1 | ✅ READ |

### DBC_structure/ (30 files)

| # | File | Lines | Status |
|---|---|---|---|
| 271 | DBC_structure/Achievement_Category.dbc.textile | 108 | ✅ READ |
| 272 | DBC_structure/Achievement_Criteria.dbc.textile | 94 | ✅ READ |
| 273 | DBC_structure/Achievements.dbc.textile | 1,837 | ✅ READ |
| 274 | DBC_structure/AnimationData.dbc.textile | 547 | ✅ READ |
| 275 | DBC_structure/AreaGroup.dbc.textile | 35 | ✅ READ |
| 276 | DBC_structure/AreaTable.dbc.textile | 2,376 | ✅ READ |
| 277 | DBC_structure/AreaTrigger.dbc.textile | 1,249 | ✅ READ |
| 278 | DBC_structure/CharClasses.dbc.textile | 32 | ✅ READ |
| 279 | DBC_structure/CharRaces.dbc.textile | 45 | ✅ READ |
| 280 | DBC_structure/CharTitles.dbc.textile | 169 | ✅ READ |
| 281 | DBC_structure/CurrencyTypes.dbc.textile | 60 | ✅ READ |
| 282 | DBC_structure/Dbc_files.textile | 89 | ✅ READ |
| 283 | DBC_structure/Emote.textile | 179 | ✅ READ |
| 284 | DBC_structure/Faction.dbc.textile | 869 | ✅ READ |
| 285 | DBC_structure/FactionTemplate.dbc.textile | 951 | ✅ READ |
| 286 | DBC_structure/GlyphProperties.dbc.textile | 408 | ✅ READ |
| 287 | DBC_structure/GlyphSlot.dbc.textile | 51 | ✅ READ |
| 288 | DBC_structure/Item.dbc.textile | 42 | ✅ READ |
| 289 | DBC_structure/ItemBagFamily.dbc.textile | 39 | ✅ READ |
| 290 | DBC_structure/ItemClass.dbc.textile | 37 | ✅ READ |
| 291 | DBC_structure/ItemExtendedCost.dbc.textile | 1,006 | ✅ READ |
| 292 | DBC_structure/ItemSubClass.dbc.textile | 143 | ✅ READ |
| 293 | DBC_structure/Languages.dbc.textile | 38 | ✅ READ |
| 294 | DBC_structure/Lock.dbc.textile | 417 | ✅ READ |
| 295 | DBC_structure/LockType.dbc.textile | 47 | ✅ READ |
| 296 | DBC_structure/MailTemplate.dbc.textile | 251 | ✅ READ |
| 297 | DBC_structure/Map.dbc.textile | 170 | ✅ READ |
| 298 | DBC_structure/Movie.dbc.textile | 35 | ✅ READ |
| 299 | DBC_structure/PageTextMaterial.dbc.textile | 28 | ✅ READ |
| 300 | DBC_structure/QuestFactionReward.dbc.textile | 34 | ✅ READ |
| 301 | DBC_structure/QuestInfo.dbc.textile | 32 | ✅ READ |
| 302 | DBC_structure/QuestSort.dbc.textile | 56 | ✅ READ |
| 303 | DBC_structure/SkillLine.dbc.textile | 198 | ✅ READ |
| 304 | DBC_structure/SoundEntries.dbc.textile | 12,960 | ✅ READ |
| 305 | DBC_structure/Spell.dbc.textile | 543 | ✅ READ |
| 306 | DBC_structure/SpellIcon.dbc.textile | 28 | ✅ READ |
| 307 | DBC_structure/TaxiPath.dbc.textile | 17 | ✅ READ |
| 308 | DBC_structure/TotemCategory.dbc.textile | 51 | ✅ READ |
| 309 | DBC_structure/WorldSafeLocs.dbc.textile | 710 | ✅ READ |

### WDB_structure/ (7 files)

| # | File | Lines | Status |
|---|---|---|---|
| 310 | WDB_structure/Creaturecache.textile | 37 | ✅ READ |
| 311 | WDB_structure/Gameobjectcache.textile | 51 | ✅ READ |
| 312 | WDB_structure/Itemcache.textile | 139 | ✅ READ |
| 313 | WDB_structure/Itemnamecache.textile | 16 | ✅ READ |
| 314 | WDB_structure/Itemtextcache.textile | 15 | ✅ READ |
| 315 | WDB_structure/Npccache.textile | 94 | ✅ READ |
| 316 | WDB_structure/Pagetextcache.textile | 16 | ✅ READ |
| 317 | WDB_structure/Questcache.textile | 116 | ✅ READ |
| 318 | WDB_structure/Wdb_files.textile | 17 | ✅ READ |

### classic_client_structure/ (10 files)

| # | File | Lines | Status |
|---|---|---|---|
| 319 | classic_client_structure/ADT-Files.md | 349 | ✅ READ |
| 320 | classic_client_structure/BLP-files.md | 107 | ✅ READ |
| 321 | classic_client_structure/Chunked-file-structure.md | 11 | ✅ READ |
| 322 | classic_client_structure/Client-File-Formats.md | 31 | ✅ READ |
| 323 | classic_client_structure/Dbc-files.md | 167 | ✅ READ |
| 324 | classic_client_structure/Dnc.db.md | 105 | ✅ READ |
| 325 | classic_client_structure/M2-files.md | 187 | ✅ READ |
| 326 | classic_client_structure/MPQ-files.md | 107 | ✅ READ |
| 327 | classic_client_structure/SBT-files.md | 21 | ✅ READ |
| 328 | classic_client_structure/Server-File-Formats.md | 4 | ✅ READ |
| 329 | classic_client_structure/Trs-files.md | 22 | ✅ READ |
| 330 | classic_client_structure/WDT-files.md | 102 | ✅ READ |
| 331 | classic_client_structure/Zmp-files.md | 21 | ✅ READ |

---

## 5. Wow_client — Full Binary File Inventory (43 files)

| # | File | Type |
|---|---|---|
| 1 | Wow_client/realmlist.wtf | Text (1 line) |
| 2 | Wow_client/WoW.exe | Binary (4.5 MB) |
| 3 | Wow_client/BackgroundDownloader.exe | Binary |
| 4 | Wow_client/Repair.exe | Binary |
| 5 | Wow_client/dbghelp.dll | Binary |
| 6 | Wow_client/fmod.dll | Binary |
| 7 | Wow_client/ijl15.dll | Binary |
| 8 | Wow_client/unicows.dll | Binary |
| 9 | Wow_client/DivxDecoder.dll | Binary |
| 10 | Wow_client/Scan.dll | Binary |
| 11 | Wow_client/Data/base.MPQ | Binary |
| 12 | Wow_client/Data/dbc.MPQ | Binary |
| 13 | Wow_client/Data/fonts.MPQ | Binary |
| 14 | Wow_client/Data/interface.MPQ | Binary |
| 15 | Wow_client/Data/misc.MPQ | Binary |
| 16 | Wow_client/Data/model.MPQ | Binary |
| 17 | Wow_client/Data/patch.MPQ | Binary |
| 18 | Wow_client/Data/patch-2.MPQ | Binary |
| 19 | Wow_client/Data/sound.MPQ | Binary |
| 20 | Wow_client/Data/speech.MPQ | Binary |
| 21 | Wow_client/Data/terrain.MPQ | Binary |
| 22 | Wow_client/Data/texture.MPQ | Binary |
| 23 | Wow_client/Data/wmo.MPQ | Binary |
| 24 | Wow_client/Data/backup.MPQ | Binary |
| 25-34 | Wow_client/Data/*.html, *.url | Text (small) |
| 35-38 | Wow_client/Interface/AddOns/Blizzard_*/*.pub | Binary |
| 39-43 | Wow_client/Interface/AddOns/PCP/* | Text/Binary |
| | Wow_client/Data/Interface/Cinematics/*.avi | Binary (video) |

---

## Verification

```
$ find issues.wiki -type f -not -path '*/.git/*' -not -name '.DS_Store' | wc -l
332  ← matches table count (332 wiki content files)

$ awk '{s+=$1} END {print s}' <<< "$(find issues.wiki -type f -not -path '*/.git/*' -not -name '.DS_Store' -exec wc -l {} \;)"
51774  ← matches total (51,774 lines)

$ find mangos-classic -type f -not -path '*/.git/*' -not -name '.DS_Store' | wc -l
3740  ← matches inventory (3,740 files in mangos-classic)

$ find Wow_client -type f -not -name '.DS_Store' | wc -l
43  ← matches inventory (43 files in Wow_client)
```
