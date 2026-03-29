import { NextRequest, NextResponse } from "next/server";
import { queryAll } from "@/lib/db";
import { VALID_PATCHES, type PatchId } from "@/lib/wow-constants";
import type { RowDataPacket } from "mysql2/promise";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ patch: string }> }) {
  const { patch } = await params;
  if (!VALID_PATCHES.includes(patch as PatchId)) {
    return NextResponse.json({ error: "Invalid patch" }, { status: 400 });
  }
  const p = patch as PatchId;

  try {
    let rows: RowDataPacket[];

    if (p === "classic") {
      // VMaNGOS: virtual columns stored_honorable_kills / stored_honor_rating / honor_highest_rank
      rows = await queryAll<RowDataPacket>(
        p, "char",
        `SELECT guid, name, race, class, level, gender,
                stored_honorable_kills AS totalKills,
                stored_honor_rating    AS honorPoints,
                honor_highest_rank     AS pvpRank
         FROM characters
         WHERE stored_honorable_kills > 0
         ORDER BY stored_honor_rating DESC, stored_honorable_kills DESC
         LIMIT 100`
      );
    } else {
      // TBC / WotLK (CMaNGOS / AzerothCore)
      rows = await queryAll<RowDataPacket>(
        p, "char",
        `SELECT guid, name, race, class, level, gender,
                totalKills,
                totalHonorPoints AS honorPoints
         FROM characters
         WHERE totalKills > 0
         ORDER BY totalHonorPoints DESC, totalKills DESC
         LIMIT 100`
      );
    }

    return NextResponse.json({
      players: rows.map(r => ({
        guid:        r.guid,
        name:        r.name,
        race:        r.race,
        class:       r.class,
        level:       r.level,
        gender:      r.gender,
        totalKills:  Number(r.totalKills ?? 0),
        honorPoints: Number(r.honorPoints ?? 0),
        pvpRank:     r.pvpRank ? Number(r.pvpRank) : null,
      })),
      patch: p,
    });
  } catch (err) {
    console.error("[api/honor] Error:", err);
    return NextResponse.json({ error: "Failed to load honor data" }, { status: 500 });
  }
}
