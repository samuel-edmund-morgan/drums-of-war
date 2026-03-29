#!/usr/bin/env node
/**
 * Pre-warm ALL item icons from all item_template tables.
 * Run manually: docker exec mw-unified-site node scripts/prewarm-all-items.mjs
 * Takes 1-3 hours depending on WoWHead API rate limits.
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

// Track already-fetched icon names to avoid duplicate downloads
const fetchedIcons = new Set();

async function downloadIcon(name) {
  if (fetchedIcons.has(name)) return false;
  fetchedIcons.add(name);

  const cachePath = join(CACHE_DIR, "medium", `${name}.jpg`);
  if (existsSync(cachePath)) return false;

  try {
    const res = await fetch(`${ICON_CDN}/medium/${name}.jpg`, {
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
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.icon || null;
  } catch { return null; }
}

async function processRealm(name, host, worldDb, dataEnv) {
  console.log(`[all-items] Processing ${name}...`);
  let entries = [];

  try {
    const conn = await createConnection({ host, user: DB_USER, password: DB_PASS, database: worldDb, connectTimeout: 5000 });
    const [rows] = await conn.execute("SELECT entry FROM item_template ORDER BY entry");
    entries = rows.map(r => r.entry);
    await conn.end();
  } catch (err) {
    console.error(`[all-items] ${name}: DB error: ${err.message}`);
    return;
  }

  console.log(`[all-items] ${name}: ${entries.length} items to process`);
  let downloaded = 0, cached = 0, errors = 0;
  const startTime = Date.now();

  // Process in batches of 5 (be gentle to WoWHead API)
  const BATCH = 5;
  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    await Promise.all(batch.map(async (entry) => {
      const iconName = await getIconName(entry, dataEnv);
      if (!iconName) { errors++; return; }
      if (await downloadIcon(iconName)) downloaded++;
      else cached++;
    }));

    // Progress every 200 items
    if ((i + BATCH) % 200 < BATCH || i + BATCH >= entries.length) {
      const pct = Math.round((i + BATCH) / entries.length * 100);
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const rate = Math.round((i + BATCH) / elapsed * 60) || 0;
      console.log(`[all-items] ${name}: ${Math.min(i + BATCH, entries.length)}/${entries.length} (${pct}%) — ${downloaded} new, ${cached} cached, ${errors} err — ${rate}/min`);
    }

    // Small delay to avoid rate limiting
    if (i % 50 === 0 && i > 0) await new Promise(r => setTimeout(r, 200));
  }

  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log(`[all-items] ${name}: Done in ${totalTime}s — ${downloaded} downloaded, ${cached} cached, ${errors} errors`);
}

async function main() {
  console.log("[all-items] Starting FULL item icon pre-warm...");
  console.log(`[all-items] Cache dir: ${CACHE_DIR}`);
  await mkdir(CACHE_DIR, { recursive: true });

  const realms = [];
  if (process.env.CLASSIC_DB_HOST) realms.push({ name: "classic", host: process.env.CLASSIC_DB_HOST, worldDb: process.env.CLASSIC_WORLDDB || "mangos", dataEnv: 4 });
  if (process.env.TBC_DB_HOST) realms.push({ name: "tbc", host: process.env.TBC_DB_HOST, worldDb: process.env.TBC_WORLDDB || "tbcmangos", dataEnv: 5 });
  if (process.env.WOTLK_DB_HOST) realms.push({ name: "wotlk", host: process.env.WOTLK_DB_HOST, worldDb: process.env.WOTLK_WORLDDB || "acore_world", dataEnv: 8 });

  for (const r of realms) {
    await processRealm(r.name, r.host, r.worldDb, r.dataEnv);
  }

  // Count final cache
  let totalFiles = 0;
  try {
    const { execSync } = await import("child_process");
    const count = execSync(`find ${CACHE_DIR} -name "*.jpg" | wc -l`).toString().trim();
    const size = execSync(`du -sh ${CACHE_DIR}`).toString().trim();
    totalFiles = parseInt(count);
    console.log(`[all-items] Cache: ${totalFiles} icons, ${size}`);
  } catch {}

  console.log("[all-items] FULL pre-warm complete!");
}

main().catch(err => { console.error("[all-items] Fatal:", err); process.exit(1); });
