import { NextRequest, NextResponse } from "next/server";
import { RowDataPacket } from "mysql2/promise";
import { queryOne, queryAll, RACES, CLASSES, FACTIONS, PATCH_LABELS, type Patch } from "@/lib/db";

interface CharRow extends RowDataPacket {
  guid: number; name: string; race: number; class: number; gender: number;
  level: number; health: number; power1: number; totalKills: number;
  totalHonor: number; rank: number | null; title: number | null;
  zone: number; money: number;
}

interface GuildRow extends RowDataPacket { guild_name: string; guild_rank: string; }
interface ItemRow extends RowDataPacket { slot: number; item_entry: number; enchantments: string | null; }
interface SkillRow extends RowDataPacket { skill: number; value: number; max: number; }

const CHAR_SQL: Record<Patch, string> = {
  classic: `SELECT guid, name, race, class, gender, level, health, power1,
    stored_honorable_kills AS totalKills, stored_honor_rating AS totalHonor,
    honor_highest_rank AS rank, NULL AS title, zone, money
    FROM characters WHERE guid = ? LIMIT 1`,
  tbc: `SELECT guid, name, race, class, gender, level, health, power1,
    totalKills, totalHonorPoints AS totalHonor,
    NULL AS \`rank\`, chosenTitle AS title, zone, money
    FROM characters WHERE guid = ? LIMIT 1`,
  wotlk: `SELECT guid, name, race, class, gender, level, health, power1,
    totalKills, totalHonorPoints AS totalHonor,
    NULL AS \`rank\`, chosenTitle AS title, zone, money
    FROM characters WHERE guid = ? LIMIT 1`,
};

const GUILD_SQL: Record<Patch, string> = {
  classic: `SELECT g.name AS guild_name, gr.rname AS guild_rank
    FROM guild_member gm
    JOIN guild g ON g.guild_id = gm.guild_id
    LEFT JOIN guild_rank gr ON gr.guild_id = gm.guild_id AND gr.rid = gm.rank
    WHERE gm.guid = ? LIMIT 1`,
  tbc: `SELECT g.name AS guild_name, gr.rname AS guild_rank
    FROM guild_member gm
    JOIN guild g ON g.guildid = gm.guildid
    LEFT JOIN guild_rank gr ON gr.guildid = gm.guildid AND gr.rid = gm.\`rank\`
    WHERE gm.guid = ? LIMIT 1`,
  wotlk: `SELECT g.name AS guild_name, gr.rname AS guild_rank
    FROM guild_member gm
    JOIN guild g ON g.guildid = gm.guildid
    LEFT JOIN guild_rank gr ON gr.guildid = gm.guildid AND gr.rid = gm.\`rank\`
    WHERE gm.guid = ? LIMIT 1`,
};

// VMaNGOS uses item_id + random_property_id, CMaNGOS/AzerothCore use itemEntry + randomPropertyId
const ITEMS_SQL: Record<Patch, string> = {
  classic: `SELECT ci.slot, ii.item_id AS item_entry, ii.enchantments,
    COALESCE(ii.random_property_id, 0) AS random_property
    FROM character_inventory ci
    JOIN item_instance ii ON ii.guid = ci.item
    WHERE ci.guid = ? AND ci.bag = 0 AND ci.slot BETWEEN 0 AND 18
    ORDER BY ci.slot`,
  tbc: `SELECT ci.slot, ii.itemEntry AS item_entry, ii.enchantments,
    COALESCE(ii.randomPropertyId, 0) AS random_property
    FROM character_inventory ci
    JOIN item_instance ii ON ii.guid = ci.item
    WHERE ci.guid = ? AND ci.bag = 0 AND ci.slot BETWEEN 0 AND 18
    ORDER BY ci.slot`,
  wotlk: `SELECT ci.slot, ii.itemEntry AS item_entry, ii.enchantments,
    COALESCE(ii.randomPropertyId, 0) AS random_property
    FROM character_inventory ci
    JOIN item_instance ii ON ii.guid = ci.item
    WHERE ci.guid = ? AND ci.bag = 0 AND ci.slot BETWEEN 0 AND 18
    ORDER BY ci.slot`,
};

const SKILLS_SQL = `SELECT skill, value, max FROM character_skills WHERE guid = ? AND value > 0 ORDER BY skill`;

// Get displayId for equipped items (for 3D model viewer)
const ITEM_DISPLAY_SQL: Record<Patch, string> = {
  classic: `SELECT ci.slot, MAX(it.displayid) AS displayid
    FROM character_inventory ci
    JOIN item_instance ii ON ii.guid = ci.item
    JOIN mangos.item_template it ON it.entry = ii.item_id
    WHERE ci.guid = ? AND ci.bag = 0 AND ci.slot IN (0,2,3,4,5,6,7,8,9,14,15,16,17,18)
    GROUP BY ci.slot
    ORDER BY ci.slot`,
  tbc: `SELECT ci.slot, it.displayid
    FROM character_inventory ci
    JOIN item_instance ii ON ii.guid = ci.item
    JOIN tbcmangos.item_template it ON it.entry = ii.itemEntry
    WHERE ci.guid = ? AND ci.bag = 0 AND ci.slot IN (0,2,3,4,5,6,7,8,9,14,15,16,17,18)
    ORDER BY ci.slot`,
  wotlk: `SELECT ci.slot, it.displayid
    FROM character_inventory ci
    JOIN item_instance ii ON ii.guid = ci.item
    JOIN acore_world.item_template it ON it.entry = ii.itemEntry
    WHERE ci.guid = ? AND ci.bag = 0 AND ci.slot IN (0,2,3,4,5,6,7,8,9,14,15,16,17,18)
    ORDER BY ci.slot`,
};

const REP_SQL = `SELECT faction, standing, flags FROM character_reputation WHERE guid = ? AND standing != 0 ORDER BY standing DESC`;

const SLOT_NAMES: Record<number, string> = {
  0: "Head", 1: "Neck", 2: "Shoulder", 3: "Shirt", 4: "Chest",
  5: "Waist", 6: "Legs", 7: "Feet", 8: "Wrist", 9: "Hands",
  10: "Ring 1", 11: "Ring 2", 12: "Trinket 1", 13: "Trinket 2",
  14: "Back", 15: "Main Hand", 16: "Off Hand", 17: "Ranged", 18: "Tabard",
};

// Profession skill IDs
const PROFESSIONS: Record<number, string> = {
  164: "Blacksmithing", 165: "Leatherworking", 171: "Alchemy",
  182: "Herbalism", 186: "Mining", 197: "Tailoring",
  202: "Engineering", 333: "Enchanting", 393: "Skinning",
  129: "First Aid", 185: "Cooking", 356: "Fishing", 762: "Riding",
};

// Weapon skill IDs
const WEAPON_SKILLS: Record<number, string> = {
  26: "Axes", 43: "Swords", 44: "Maces", 45: "Bows", 46: "Guns",
  54: "Staves", 55: "Two-Handed Swords", 95: "Defense", 136: "Staves",
  160: "Two-Handed Maces", 162: "Unarmed", 172: "Two-Handed Axes",
  173: "Daggers", 176: "Crossbows", 226: "Crossbows", 228: "Wands",
  229: "Polearms", 473: "Fist Weapons",
};

// Language skill IDs
const LANGUAGES: Record<number, string> = {
  98: "Common", 109: "Orcish", 111: "Dwarven", 113: "Darnassian",
  115: "Taurahe", 137: "Thalassian", 138: "Draconic", 139: "Demonic",
  140: "Titan", 141: "Old Tongue", 313: "Gnomish", 315: "Troll",
  673: "Gutterspeak", 759: "Draenei",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ patch: string; guid: string }> }
) {
  const { patch: patchParam, guid: guidParam } = await params;
  const patch = patchParam as Patch;
  const guid = Number(guidParam);

  if (!["classic", "tbc", "wotlk"].includes(patch) || isNaN(guid)) {
    return NextResponse.json({ error: "Invalid patch or guid" }, { status: 400 });
  }

  try {
    const char = await queryOne<CharRow>(patch, "char", CHAR_SQL[patch], [guid]);
    if (!char) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    interface RepRow extends RowDataPacket { faction: number; standing: number; flags: number; }
    interface DisplayRow extends RowDataPacket { slot: number; displayid: number; }

    // Parallel queries
    const [guildRow, items, skills, reputations, displayRows] = await Promise.all([
      queryOne<GuildRow>(patch, "char", GUILD_SQL[patch], [guid]).catch(() => null),
      queryAll<ItemRow>(patch, "char", ITEMS_SQL[patch], [guid]).catch(() => []),
      queryAll<SkillRow>(patch, "char", SKILLS_SQL, [guid]).catch(() => []),
      queryAll<RepRow>(patch, "char", REP_SQL, [guid]).catch(() => []),
      queryAll<DisplayRow>(patch, "char", ITEM_DISPLAY_SQL[patch], [guid]).catch(() => []),
    ]);

    const professions = skills
      .filter((s) => PROFESSIONS[s.skill])
      .map((s) => ({ name: PROFESSIONS[s.skill], skillId: s.skill, value: s.value, max: s.max }));

    const weaponSkills = skills
      .filter((s) => WEAPON_SKILLS[s.skill])
      .map((s) => ({ name: WEAPON_SKILLS[s.skill], skillId: s.skill, value: s.value, max: s.max }));

    const languages = skills
      .filter((s) => LANGUAGES[s.skill])
      .map((s) => ({ name: LANGUAGES[s.skill], skillId: s.skill, value: s.value, max: s.max }));

    const reputation = reputations
      .filter((r) => (r.flags & 1) !== 0 || r.standing !== 0) // visible or non-zero
      .map((r) => ({ factionId: r.faction, standing: r.standing }));

    const equipment = items.map((i) => {
      // Parse enchantment field: 21 space-separated ints, position 9 = permanent enchant
      let enchantId = 0;
      if (i.enchantments) {
        const parts = i.enchantments.trim().split(/\s+/);
        if (parts.length > 9) enchantId = parseInt(parts[9], 10) || 0;
      }
      return {
        slot: i.slot,
        slotName: SLOT_NAMES[i.slot] || `Slot ${i.slot}`,
        itemEntry: i.item_entry,
        enchantId,
        randomPropertyId: i.random_property || 0,
      };
    });

    return NextResponse.json({
      guid: char.guid,
      name: char.name,
      race: RACES[char.race] || `Race ${char.race}`,
      className: CLASSES[char.class] || `Class ${char.class}`,
      raceId: char.race,
      classId: char.class,
      gender: char.gender,
      level: char.level,
      health: char.health,
      mana: char.power1,
      faction: FACTIONS[char.race] || "Unknown",
      totalKills: char.totalKills || 0,
      totalHonor: char.totalHonor || 0,
      pvpRank: char.rank || null,
      chosenTitle: char.title || null,
      zone: char.zone,
      guild: guildRow ? { name: guildRow.guild_name, rank: guildRow.guild_rank } : null,
      equipment,
      professions,
      weaponSkills,
      languages,
      reputation,
      modelItems: displayRows.map((d) => [d.slot, d.displayid] as [number, number]),
      patch,
      patchLabel: PATCH_LABELS[patch],
    }, {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
    });
  } catch (err) {
    return NextResponse.json({ error: "Database error", message: String(err) }, { status: 500 });
  }
}
