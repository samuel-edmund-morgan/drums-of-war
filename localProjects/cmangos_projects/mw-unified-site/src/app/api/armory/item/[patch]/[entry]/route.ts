import { NextRequest, NextResponse } from "next/server";
import { RowDataPacket } from "mysql2/promise";
import { withConnection, type Patch } from "@/lib/db";
import { createConnection } from "mysql2/promise";

interface ItemRow extends RowDataPacket {
  entry: number;
  name: string;
  Quality: number;
  InventoryType: number;
  class: number;
  subclass: number;
  armor: number;
  dmg_min1: number;
  dmg_max1: number;
  dmg_type1: number;
  speed: number;
  RequiredLevel: number;
  ItemLevel: number;
  displayid: number;
  stat_type1: number; stat_value1: number;
  stat_type2: number; stat_value2: number;
  stat_type3: number; stat_value3: number;
  stat_type4: number; stat_value4: number;
  stat_type5: number; stat_value5: number;
  stat_type6: number; stat_value6: number;
  stat_type7: number; stat_value7: number;
  stat_type8: number; stat_value8: number;
  stat_type9: number; stat_value9: number;
  stat_type10: number; stat_value10: number;
  itemset: number;
}

const WORLD_DBS: Record<Patch, { host: string; port: number; db: string }> = {
  classic: { host: process.env.CLASSIC_DB_HOST || "vmangos-db", port: Number(process.env.CLASSIC_DB_PORT || 3306), db: process.env.CLASSIC_WORLDDB || "mangos" },
  tbc: { host: process.env.TBC_DB_HOST || "cmangos-tbc-db", port: Number(process.env.TBC_DB_PORT || 3306), db: process.env.TBC_WORLDDB || "tbcmangos" },
  wotlk: { host: process.env.WOTLK_DB_HOST || "azerothcore-db", port: Number(process.env.WOTLK_DB_PORT || 3306), db: process.env.WOTLK_WORLDDB || "acore_world" },
};

const QUALITY_NAMES = ["Poor", "Common", "Uncommon", "Rare", "Epic", "Legendary", "Artifact"];
const QUALITY_COLORS = ["#9d9d9d", "#ffffff", "#1eff00", "#0070dd", "#a335ee", "#ff8000", "#e6cc80"];

const STAT_NAMES: Record<number, string> = {
  0: "Mana", 1: "Health", 3: "Agility", 4: "Strength", 5: "Intellect",
  6: "Spirit", 7: "Stamina", 12: "Defense Rating", 13: "Dodge Rating",
  14: "Parry Rating", 15: "Shield Block Rating", 16: "Melee Hit Rating",
  17: "Ranged Hit Rating", 18: "Spell Hit Rating", 19: "Melee Crit Rating",
  20: "Ranged Crit Rating", 21: "Spell Crit Rating", 31: "Hit Rating",
  32: "Crit Rating", 35: "Resilience", 36: "Haste Rating",
  37: "Spell Power", 38: "Attack Power", 45: "Spell Power",
};

const INVENTORY_TYPES: Record<number, string> = {
  0: "", 1: "Head", 2: "Neck", 3: "Shoulder", 4: "Shirt", 5: "Chest",
  6: "Waist", 7: "Legs", 8: "Feet", 9: "Wrist", 10: "Hands",
  11: "Finger", 12: "Trinket", 13: "One-Hand", 14: "Shield", 15: "Ranged",
  16: "Back", 17: "Two-Hand", 18: "Bag", 19: "Tabard", 20: "Robe",
  21: "Main Hand", 22: "Off Hand", 23: "Holdable", 24: "Ammo",
  25: "Thrown", 26: "Ranged", 28: "Relic",
};

const ITEM_SQL = `
  SELECT entry, name, Quality, InventoryType, class, subclass, armor,
    dmg_min1, dmg_max1, dmg_type1, delay AS speed,
    RequiredLevel, ItemLevel, displayid,
    stat_type1, stat_value1, stat_type2, stat_value2,
    stat_type3, stat_value3, stat_type4, stat_value4,
    stat_type5, stat_value5, stat_type6, stat_value6,
    stat_type7, stat_value7, stat_type8, stat_value8,
    stat_type9, stat_value9, stat_type10, stat_value10,
    spellid_1, spellid_2, spellid_3, spellid_4, spellid_5,
    spelltrigger_1, spelltrigger_2, spelltrigger_3, spelltrigger_4, spelltrigger_5,
    description,
    itemset
  FROM item_template WHERE entry = ? LIMIT 1`;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ patch: string; entry: string }> }
) {
  const { patch: patchParam, entry: entryParam } = await params;
  const patch = patchParam as Patch;
  const entry = Number(entryParam);
  const randProp = Number(request.nextUrl.searchParams.get("rand") || "0");

  if (!["classic", "tbc", "wotlk"].includes(patch) || isNaN(entry)) {
    return NextResponse.json({ error: "Invalid patch or entry" }, { status: 400 });
  }

  const wdb = WORLD_DBS[patch];

  try {
    const conn = await createConnection({
      host: wdb.host,
      port: wdb.port,
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: wdb.db,
      connectTimeout: 5000,
    });

    try {
      const [rows] = await conn.execute<ItemRow[]>(ITEM_SQL, [entry]);
      if (rows.length === 0) {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }

      const item = rows[0];

      // Build stats array
      const stats: Array<{ name: string; value: number }> = [];
      for (let i = 1; i <= 10; i++) {
        const type = item[`stat_type${i}` as keyof ItemRow] as number;
        const value = item[`stat_value${i}` as keyof ItemRow] as number;
        if (type > 0 && value !== 0) {
          stats.push({ name: STAT_NAMES[type] || `Unknown Stat ${type}`, value });
        }
      }

      // DPS calculation for weapons
      let dps: number | null = null;
      if (item.dmg_min1 > 0 && item.speed > 0) {
        dps = Math.round(((item.dmg_min1 + item.dmg_max1) / 2) / (item.speed / 1000) * 10) / 10;
      }

      // Fetch icon + spell effects + random suffix from WoWHead API
      let iconName = "inv_misc_questionmark";
      const spellEffects: string[] = [];
      let randomSuffix = "";
      try {
        const dataEnv = patch === "classic" ? 4 : patch === "tbc" ? 5 : 8;
        const randQuery = randProp ? `&rand=${randProp}` : "";
        const whRes = await fetch(
          `https://nether.wowhead.com/tooltip/item/${entry}?dataEnv=${dataEnv}&locale=0${randQuery}`,
          { signal: AbortSignal.timeout(3000) }
        );
        if (whRes.ok) {
          const whData = await whRes.json();
          if (whData.icon) iconName = whData.icon;
          // Extract random suffix from item name (e.g. "Archivist Cape of Shadow Wrath")
          if (randProp && whData.name && whData.name !== item.name) {
            // WoWHead returns full name with suffix
            randomSuffix = whData.name.replace(item.name, "").trim();
          }
          // Extract green spell effects from tooltip HTML
          if (whData.tooltip) {
            // Extract random enchant stats (shown as regular text like "+21 Shadow Spell Damage")
            if (randProp) {
              const randStatMatches = whData.tooltip.matchAll(/>(\d+)\s+((?:Shadow|Fire|Frost|Arcane|Nature|Holy|Spell|Healing|Attack|Defense|Block|Dodge|Parry|Hit|Critical|Haste)[^<]*)</g);
              for (const m of randStatMatches) {
                const val = parseInt(m[1]);
                const statName = m[2].trim();
                if (statName && val > 0) {
                  const existing = stats.find(s => s.name === statName);
                  if (!existing) stats.push({ name: statName, value: val });
                }
              }
            }
            const effectMatches = whData.tooltip.matchAll(/class="q2">\s*((?:Equip|Use|Chance on hit)[^<]*(?:<[^>]*>[^<]*)*)/gi);
            for (const m of effectMatches) {
              let text = m[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
              // Remove trailing sell price and other garbage
              text = text.replace(/Sell Price:.*$/i, '').replace(/\s+$/, '');
              if (text.length > 5) spellEffects.push(text);
            }
          }
        }
      } catch {
        // Fallback on timeout/error
      }

      return NextResponse.json({
        entry: item.entry,
        name: randomSuffix ? `${item.name} ${randomSuffix}` : item.name,
        quality: item.Quality,
        qualityName: QUALITY_NAMES[item.Quality] || "Unknown",
        qualityColor: QUALITY_COLORS[item.Quality] || "#ffffff",
        slot: INVENTORY_TYPES[item.InventoryType] || "",
        armor: item.armor > 0 ? item.armor : null,
        dmgMin: item.dmg_min1 > 0 ? item.dmg_min1 : null,
        dmgMax: item.dmg_max1 > 0 ? item.dmg_max1 : null,
        speed: item.speed > 0 ? item.speed / 1000 : null,
        dps,
        stats,
        requiredLevel: item.RequiredLevel,
        itemLevel: item.ItemLevel,
        displayId: item.displayid,
        itemSet: item.itemset > 0 ? item.itemset : null,
        spellEffects,
        description: item.description || null,
        iconUrl: `/icons/medium/${iconName}.jpg`,
      }, {
        headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
      });
    } finally {
      await conn.end();
    }
  } catch (err) {
    return NextResponse.json({ error: "Database error", message: String(err) }, { status: 500 });
  }
}
