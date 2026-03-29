import { NextRequest, NextResponse } from "next/server";
import { RowDataPacket } from "mysql2/promise";
import { queryAll, RACES, CLASSES, FACTIONS, ALL_PATCHES, PATCH_LABELS, type Patch } from "@/lib/db";

interface CharRow extends RowDataPacket {
  guid: number;
  name: string;
  race: number;
  class: number;
  gender: number;
  level: number;
  totalKills: number;
  guild_name: string | null;
}

// Patch-specific SQL for character search with guild join
const SEARCH_SQL: Record<Patch, string> = {
  classic: `
    SELECT c.guid, c.name, c.race, c.class, c.gender, c.level,
           c.stored_honorable_kills AS totalKills,
           g.name AS guild_name
    FROM characters c
    LEFT JOIN guild_member gm ON gm.guid = c.guid
    LEFT JOIN guild g ON g.guild_id = gm.guild_id
    WHERE c.name LIKE ? AND c.level > 0
    ORDER BY c.level DESC
    LIMIT ?`,
  tbc: `
    SELECT c.guid, c.name, c.race, c.class, c.gender, c.level,
           c.totalKills,
           g.name AS guild_name
    FROM characters c
    LEFT JOIN guild_member gm ON gm.guid = c.guid
    LEFT JOIN guild g ON g.guildid = gm.guildid
    WHERE c.name LIKE ? AND c.level > 0
    ORDER BY c.level DESC
    LIMIT ?`,
  wotlk: `
    SELECT c.guid, c.name, c.race, c.class, c.gender, c.level,
           c.totalKills,
           g.name AS guild_name
    FROM characters c
    LEFT JOIN guild_member gm ON gm.guid = c.guid
    LEFT JOIN guild g ON g.guildid = gm.guildid
    WHERE LOWER(c.name) LIKE LOWER(?) AND c.level > 0
    ORDER BY c.level DESC
    LIMIT ?`,
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() || "";
  const patchFilter = searchParams.get("patch") as Patch | "all" | null;
  const limit = Math.min(Number(searchParams.get("limit") || 25), 50);

  if (query.length < 2) {
    return NextResponse.json({ error: "Search query must be at least 2 characters" }, { status: 400 });
  }

  const patches = patchFilter && patchFilter !== "all"
    ? [patchFilter as Patch]
    : ALL_PATCHES;

  const results: Array<{
    guid: number;
    name: string;
    race: string;
    className: string;
    raceId: number;
    classId: number;
    gender: number;
    level: number;
    faction: string;
    totalKills: number;
    guild: string | null;
    patch: string;
    patchLabel: string;
  }> = [];

  const searchPattern = `%${query}%`;

  await Promise.all(
    patches.map(async (patch) => {
      try {
        // Replace LIMIT placeholder with literal value (MySQL 8 compat)
        const sql = SEARCH_SQL[patch].replace("LIMIT ?", `LIMIT ${limit}`);
        const rows = await queryAll<CharRow>(patch, "char", sql, [searchPattern]);
        for (const row of rows) {
          results.push({
            guid: row.guid,
            name: row.name,
            race: RACES[row.race] || `Race ${row.race}`,
            className: CLASSES[row.class] || `Class ${row.class}`,
            raceId: row.race,
            classId: row.class,
            gender: row.gender,
            level: row.level,
            faction: FACTIONS[row.race] || "Unknown",
            totalKills: row.totalKills || 0,
            guild: row.guild_name || null,
            patch,
            patchLabel: PATCH_LABELS[patch],
          });
        }
      } catch (err) {
        console.error(`[armory-search] ${patch} error:`, String(err));
      }
    })
  );

  // Sort by level desc, then name
  results.sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));

  return NextResponse.json({
    query,
    count: results.length,
    results: results.slice(0, limit),
  }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
  });
}
