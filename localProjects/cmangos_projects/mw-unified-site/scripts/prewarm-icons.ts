#!/usr/bin/env tsx
/**
 * Pre-warm icon cache: downloads all race/class icons + item icons
 * for all equipped items across all characters in all realms.
 * Run at container startup or on demand.
 */

import { createConnection } from "mysql2/promise";
import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { join, dirname } from "path";

const ICON_CDN = "https://wow.zamimg.com/images/wow/icons";
const WOWHEAD_API = "https://nether.wowhead.com/tooltip/item";
const CACHE_DIR = process.env.ICON_CACHE_DIR || "/app/icon-cache";
const DB_USER = process.env.DB_USER || "root";
const DB_PASS = process.env.DB_PASSWORD || "";

// --- Fixed icon sets ---

const RACE_ICONS = [
  "race_human_male", "race_human_female",
  "race_orc_male", "race_orc_female",
  "race_dwarf_male", "race_dwarf_female",
  "race_nightelf_male", "race_nightelf_female",
  "race_scourge_male", "race_scourge_female",
  "race_tauren_male", "race_tauren_female",
  "race_gnome_male", "race_gnome_female",
  "race_troll_male", "race_troll_female",
  "race_bloodelf_male", "race_bloodelf_female",
  "race_draenei_male", "race_draenei_female",
];

const CLASS_ICONS = [
  "classicon_warrior", "classicon_paladin", "classicon_hunter",
  "classicon_rogue", "classicon_priest", "classicon_deathknight",
  "classicon_shaman", "classicon_mage", "classicon_warlock", "classicon_druid",
];

const MISC_ICONS = [
  "inv_misc_questionmark",
  "pvpcurrency-honor-alliance",
  "pvpcurrency-honor-horde",
];

const ALL_SIZES = ["small", "medium", "large"] as const;

// --- DB configs ---

interface RealmConfig {
  name: string;
  host: string;
  charDb: string;
  worldDb: string;
  dataEnv: number;
}

function getRealms(): RealmConfig[] {
  const realms: RealmConfig[] = [];

  if (process.env.CLASSIC_DB_HOST) {
    realms.push({
      name: "classic",
      host: process.env.CLASSIC_DB_HOST,
      charDb: process.env.CLASSIC_CHARDB || "characters",
      worldDb: process.env.CLASSIC_WORLDDB || "mangos",
      dataEnv: 4,
    });
  }
  if (process.env.TBC_DB_HOST) {
    realms.push({
      name: "tbc",
      host: process.env.TBC_DB_HOST,
      charDb: process.env.TBC_CHARDB || "tbccharacters",
      worldDb: process.env.TBC_WORLDDB || "tbcmangos",
      dataEnv: 5,
    });
  }
  if (process.env.WOTLK_DB_HOST) {
    realms.push({
      name: "wotlk",
      host: process.env.WOTLK_DB_HOST,
      charDb: process.env.WOTLK_CHARDB || "acore_characters",
      worldDb: process.env.WOTLK_WORLDDB || "acore_world",
      dataEnv: 8,
    });
  }

  return realms;
}

// --- Download helpers ---

async function downloadIcon(size: string, name: string): Promise<boolean> {
  const cachePath = join(CACHE_DIR, size, `${name}.jpg`);
  if (existsSync(cachePath)) return false; // Already cached

  const url = `${ICON_CDN}/${size}/${name}.jpg`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "WoW-Icon-Prewarm/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;

    const buffer = Buffer.from(await res.arrayBuffer());
    const dir = dirname(cachePath);
    await mkdir(dir, { recursive: true });
    await writeFile(cachePath, buffer);
    return true;
  } catch {
    return false;
  }
}

async function getIconName(entry: number, dataEnv: number): Promise<string | null> {
  try {
    const res = await fetch(
      `${WOWHEAD_API}/${entry}?dataEnv=${dataEnv}&locale=0`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.icon || null;
  } catch {
    return null;
  }
}

// --- Main ---

async function main() {
  console.log("[prewarm] Starting icon cache pre-warm...");
  console.log(`[prewarm] Cache dir: ${CACHE_DIR}`);
  await mkdir(CACHE_DIR, { recursive: true });

  let totalDownloaded = 0;
  let totalSkipped = 0;

  // 1. Fixed icons (race, class, misc)
  console.log("[prewarm] Downloading race/class/misc icons...");
  const fixedIcons = [...RACE_ICONS, ...CLASS_ICONS, ...MISC_ICONS];
  for (const name of fixedIcons) {
    for (const size of ALL_SIZES) {
      const downloaded = await downloadIcon(size, name);
      if (downloaded) totalDownloaded++;
      else totalSkipped++;
    }
  }
  console.log(`[prewarm] Fixed icons: ${totalDownloaded} downloaded, ${totalSkipped} already cached`);

  // 2. Item icons from all characters
  const realms = getRealms();
  if (realms.length === 0) {
    console.log("[prewarm] No realm DB configs found, skipping item icons");
    console.log(`[prewarm] Done! Total: ${totalDownloaded} downloaded`);
    return;
  }

  for (const realm of realms) {
    console.log(`[prewarm] Processing ${realm.name} realm...`);
    let itemEntries: number[] = [];

    try {
      const conn = await createConnection({
        host: realm.host,
        user: DB_USER,
        password: DB_PASS,
        database: realm.charDb,
        connectTimeout: 5000,
      });

      // Get all unique equipped item entries
      const sql = realm.name === "wotlk"
        ? `SELECT DISTINCT ii.itemEntry FROM character_inventory ci JOIN item_instance ii ON ci.item = ii.guid WHERE ci.slot < 19`
        : `SELECT DISTINCT ii.itemEntry FROM character_inventory ci JOIN item_instance ii ON ci.item = ii.guid WHERE ci.slot < 19`;

      const [rows] = await conn.execute<any[]>(sql);
      itemEntries = rows.map((r: any) => r.itemEntry);
      await conn.end();
      console.log(`[prewarm] ${realm.name}: found ${itemEntries.length} unique equipped items`);
    } catch (err) {
      console.error(`[prewarm] ${realm.name}: DB error:`, err);
      continue;
    }

    // Fetch icon names and download
    let realmDownloaded = 0;
    let realmSkipped = 0;
    let realmErrors = 0;

    // Process in batches to avoid overwhelming WoWHead API
    const BATCH_SIZE = 10;
    for (let i = 0; i < itemEntries.length; i += BATCH_SIZE) {
      const batch = itemEntries.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (entry) => {
          const iconName = await getIconName(entry, realm.dataEnv);
          if (!iconName) { realmErrors++; return; }

          const downloaded = await downloadIcon("medium", iconName);
          if (downloaded) realmDownloaded++;
          else realmSkipped++;
        })
      );

      // Progress log every 50 items
      if ((i + BATCH_SIZE) % 50 === 0 || i + BATCH_SIZE >= itemEntries.length) {
        console.log(`[prewarm] ${realm.name}: ${Math.min(i + BATCH_SIZE, itemEntries.length)}/${itemEntries.length} items processed`);
      }
    }

    totalDownloaded += realmDownloaded;
    totalSkipped += realmSkipped;
    console.log(`[prewarm] ${realm.name}: ${realmDownloaded} downloaded, ${realmSkipped} cached, ${realmErrors} errors`);
  }

  console.log(`[prewarm] Done! Total: ${totalDownloaded} icons downloaded`);
}

main().catch((err) => {
  console.error("[prewarm] Fatal error:", err);
  process.exit(1);
});
