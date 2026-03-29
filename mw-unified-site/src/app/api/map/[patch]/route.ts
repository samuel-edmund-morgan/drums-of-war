import { NextRequest, NextResponse } from "next/server";
import { queryAll, ALL_PATCHES, type Patch } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";

interface PlayerRow extends RowDataPacket {
  guid: number;
  name: string;
  race: number;
  class: number;
  level: number;
  map: number;
  zone: number;
  position_x: number;
  position_y: number;
}

// WoW zone IDs to readable names (most common zones)
const ZONE_NAMES: Record<number, string> = {
  // Eastern Kingdoms
  1: "Dun Morogh", 3: "Badlands", 4: "Blasted Lands", 8: "Swamp of Sorrows",
  10: "Duskwood", 11: "Wetlands", 12: "Elwynn Forest", 14: "Durotar",
  15: "Dustwallow Marsh", 17: "The Barrens", 25: "Blackrock Mountain",
  28: "Western Plaguelands", 33: "Stranglethorn Vale", 36: "Alterac Mountains",
  38: "Loch Modan", 40: "Westfall", 41: "Deadwind Pass", 44: "Redridge Mountains",
  45: "Arathi Highlands", 46: "Burning Steppes", 47: "The Hinterlands",
  51: "Searing Gorge", 85: "Tirisfal Glades", 130: "Silverpine Forest",
  139: "Eastern Plaguelands", 267: "Hillsbrad Foothills", 1497: "Undercity",
  1519: "Stormwind City", 1537: "Ironforge", 1657: "Darnassus",
  // Kalimdor
  16: "Azshara",
  141: "Teldrassil", 148: "Darkshore", 215: "Mulgore", 220: "Red Cloud Mesa",
  331: "Ashenvale", 357: "Feralas", 361: "Felwood", 400: "Thousand Needles",
  405: "Desolace", 406: "Stonetalon Mountains", 440: "Tanaris",
  490: "Un'Goro Crater", 493: "Moonglade", 618: "Winterspring",
  1377: "Silithus", 1637: "Orgrimmar", 1638: "Thunder Bluff",
  // TBC
  3430: "Eversong Woods", 3433: "Ghostlands", 3483: "Hellfire Peninsula",
  3518: "Nagrand", 3519: "Terokkar Forest", 3520: "Shadowmoon Valley",
  3521: "Zangarmarsh", 3522: "Blade's Edge Mountains", 3523: "Netherstorm",
  3524: "Azuremyst Isle", 3525: "Bloodmyst Isle", 3557: "The Exodar",
  3703: "Shattrath City", 3487: "Silvermoon City",
  // WotLK
  65: "Dragonblight", 66: "Zul'Drak", 67: "The Storm Peaks",
  210: "Icecrown", 394: "Grizzly Hills", 495: "Howling Fjord",
  3537: "Borean Tundra", 3711: "Sholazar Basin", 4197: "Wintergrasp",
  4395: "Dalaran",
};

const MAP_NAMES: Record<number, string> = {
  0: "Eastern Kingdoms",
  1: "Kalimdor",
  530: "Outland",
  571: "Northrend",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ patch: string }> },
) {
  const { patch: patchParam } = await params;

  const patches = patchParam === "all"
    ? ALL_PATCHES
    : ALL_PATCHES.includes(patchParam as Patch) ? [patchParam as Patch] : [];

  if (patches.length === 0) {
    return NextResponse.json({ error: "Invalid patch" }, { status: 400 });
  }

  const players: Array<{
    guid: number;
    name: string;
    race: number;
    classId: number;
    level: number;
    map: number;
    mapName: string;
    zone: number;
    zoneName: string;
    x: number;
    y: number;
    patch: string;
  }> = [];

  await Promise.all(
    patches.map(async (patch) => {
      try {
        const rows = await queryAll<PlayerRow>(
          patch, "char",
          `SELECT guid, name, race, class, level, map, zone, position_x, position_y
           FROM characters WHERE online = 1`,
          [],
        );
        for (const r of rows) {
          players.push({
            guid: r.guid,
            name: r.name,
            race: r.race,
            classId: r.class,
            level: r.level,
            map: r.map,
            mapName: MAP_NAMES[r.map] || `Map ${r.map}`,
            zone: r.zone,
            zoneName: ZONE_NAMES[r.zone] || `Zone ${r.zone}`,
            x: r.position_x,
            y: r.position_y,
            patch,
          });
        }
      } catch {
        // ignore server errors
      }
    }),
  );

  return NextResponse.json(
    { players, count: players.length },
    { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" } },
  );
}
