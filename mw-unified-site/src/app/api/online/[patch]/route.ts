import { NextRequest, NextResponse } from "next/server";
import { queryAll, queryOne } from "@/lib/db";
import { VALID_PATCHES, type PatchId } from "@/lib/wow-constants";
import type { RowDataPacket } from "mysql2/promise";

const PAGE_SIZE = 50;

export async function GET(req: NextRequest, { params }: { params: Promise<{ patch: string }> }) {
  const { patch } = await params;
  if (!VALID_PATCHES.includes(patch as PatchId)) {
    return NextResponse.json({ error: "Invalid patch" }, { status: 400 });
  }
  const p = patch as PatchId;
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? 1));
  const offset = (page - 1) * PAGE_SIZE;

  try {
    const [rows, countRow] = await Promise.all([
      queryAll<RowDataPacket>(
        p, "char",
        `SELECT guid, name, race, class, level, gender, zone
         FROM characters
         WHERE online = 1
         ORDER BY level DESC, name ASC
         LIMIT ? OFFSET ?`,
        [PAGE_SIZE, offset]
      ),
      queryOne<RowDataPacket>(p, "char", "SELECT COUNT(*) AS total FROM characters WHERE online = 1"),
    ]);

    return NextResponse.json({
      players: rows.map(r => ({
        guid:   r.guid,
        name:   r.name,
        race:   r.race,
        class:  r.class,
        level:  r.level,
        gender: r.gender,
        zone:   r.zone,
      })),
      total: Number(countRow?.total ?? 0),
      page,
      pageSize: PAGE_SIZE,
    });
  } catch (err) {
    console.error("[api/online] Error:", err);
    return NextResponse.json({ error: "Failed to load players" }, { status: 500 });
  }
}
