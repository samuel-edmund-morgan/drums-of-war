#!/usr/bin/env node
/**
 * Pre-warm icon cache: downloads all race/class icons + item icons
 * for all equipped items across all characters.
 */

import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { join, dirname } from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, "node_modules", "dummy.js"));
const { createConnection } = require("mysql2/promise");

const ICON_CDN = "https://wow.zamimg.com/images/wow/icons";
const WOWHEAD_API = "https://nether.wowhead.com/tooltip/item";
const CACHE_DIR = process.env.ICON_CACHE_DIR || "/app/icon-cache";
const DB_USER = process.env.DB_USER || "root";
const DB_PASS = process.env.DB_PASSWORD || "";

const RACE_ICONS = [
  "race_human_male", "race_human_female", "race_orc_male", "race_orc_female",
  "race_dwarf_male", "race_dwarf_female", "race_nightelf_male", "race_nightelf_female",
  "race_scourge_male", "race_scourge_female", "race_tauren_male", "race_tauren_female",
  "race_gnome_male", "race_gnome_female", "race_troll_male", "race_troll_female",
  "race_bloodelf_male", "race_bloodelf_female", "race_draenei_male", "race_draenei_female",
];

const CLASS_ICONS = [
  "classicon_warrior", "classicon_paladin", "classicon_hunter", "classicon_rogue",
  "classicon_priest", "classicon_deathknight", "classicon_shaman", "classicon_mage",
  "classicon_warlock", "classicon_druid",
];

const MISC_ICONS = ["inv_misc_questionmark", "pvpcurrency-honor-alliance", "pvpcurrency-honor-horde"];
const SIZES = ["small", "medium", "large"];

async function downloadIcon(size, name) {
  const cachePath = join(CACHE_DIR, size, `${name}.jpg`);
  if (existsSync(cachePath)) return false;
  try {
    const res = await fetch(`${ICON_CDN}/${size}/${name}.jpg`, {
      headers: { "User-Agent": "WoW-Icon-Prewarm/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const buffer = Buffer.from(await res.arrayBuffer());
    await mkdir(dirname(cachePath), { recursive: true });
    await writeFile(cachePath, buffer);
    return true;
  } catch { return false; }
}

async function getIconName(entry, dataEnv) {
  try {
    const res = await fetch(`${WOWHEAD_API}/${entry}?dataEnv=${dataEnv}&locale=0`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.icon || null;
  } catch { return null; }
}

async function main() {
  console.log("[prewarm] Starting icon cache pre-warm...");
  await mkdir(CACHE_DIR, { recursive: true });

  let downloaded = 0, skipped = 0;

  // 1. Fixed icons
  console.log("[prewarm] Phase 1: Race/class/misc icons...");
  for (const name of [...RACE_ICONS, ...CLASS_ICONS, ...MISC_ICONS]) {
    for (const size of SIZES) {
      if (await downloadIcon(size, name)) downloaded++;
      else skipped++;
    }
  }
  console.log(`[prewarm] Phase 1 done: ${downloaded} downloaded, ${skipped} cached`);

  // 2. Item icons from all realms
  const realms = [];
  if (process.env.CLASSIC_DB_HOST) realms.push({ name: "classic", host: process.env.CLASSIC_DB_HOST, charDb: process.env.CLASSIC_CHARDB || "characters", dataEnv: 4 });
  if (process.env.TBC_DB_HOST) realms.push({ name: "tbc", host: process.env.TBC_DB_HOST, charDb: process.env.TBC_CHARDB || "tbccharacters", dataEnv: 5 });
  if (process.env.WOTLK_DB_HOST) realms.push({ name: "wotlk", host: process.env.WOTLK_DB_HOST, charDb: process.env.WOTLK_CHARDB || "acore_characters", dataEnv: 8 });

  for (const realm of realms) {
    console.log(`[prewarm] Phase 2: ${realm.name} item icons...`);
    let entries = [];
    try {
      const conn = await createConnection({ host: realm.host, user: DB_USER, password: DB_PASS, database: realm.charDb, connectTimeout: 5000 });
      // VMaNGOS uses 'itemEntry', CMaNGOS/AzerothCore use 'itemEntry' but VMaNGOS item_instance has different schema
      let sql = "SELECT DISTINCT ii.itemEntry FROM character_inventory ci JOIN item_instance ii ON ci.item = ii.guid WHERE ci.slot < 19";
      if (realm.name === "classic") {
        // VMaNGOS: item_instance has 'data' blob, need to get itemEntry from item_template join
        sql = "SELECT DISTINCT ci.item_template AS itemEntry FROM character_inventory ci WHERE ci.slot < 19 AND ci.item_template > 0";
      }
      const [rows] = await conn.execute(sql);
      entries = rows.map(r => r.itemEntry);
      await conn.end();
    } catch (err) {
      console.error(`[prewarm] ${realm.name}: DB error: ${err.message}`);
      continue;
    }

    console.log(`[prewarm] ${realm.name}: ${entries.length} unique items to process`);
    let rd = 0, rs = 0, re = 0;

    for (let i = 0; i < entries.length; i += 10) {
      const batch = entries.slice(i, i + 10);
      await Promise.all(batch.map(async (entry) => {
        const iconName = await getIconName(entry, realm.dataEnv);
        if (!iconName) { re++; return; }
        if (await downloadIcon("medium", iconName)) rd++;
        else rs++;
      }));
      if ((i + 10) % 100 === 0 || i + 10 >= entries.length) {
        console.log(`[prewarm] ${realm.name}: ${Math.min(i + 10, entries.length)}/${entries.length}`);
      }
    }
    downloaded += rd;
    console.log(`[prewarm] ${realm.name}: ${rd} downloaded, ${rs} cached, ${re} errors`);
  }

  console.log(`[prewarm] Complete! Total ${downloaded} icons downloaded`);
}

main().catch(err => { console.error("[prewarm] Fatal:", err); });
