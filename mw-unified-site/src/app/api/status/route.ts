import { NextResponse } from "next/server";
import { queryAll, ALL_PATCHES, type Patch } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";

interface CountRow extends RowDataPacket { count: number; }

export async function GET() {
  const status: Record<string, { online: boolean; players: number }> = {};

  await Promise.all(
    ALL_PATCHES.map(async (patch: Patch) => {
      try {
        const rows = await queryAll<CountRow>(
          patch, "char",
          "SELECT COUNT(*) as count FROM characters WHERE online = 1",
          [],
        );
        status[patch] = { online: true, players: rows[0]?.count ?? 0 };
      } catch {
        status[patch] = { online: false, players: 0 };
      }
    }),
  );

  return NextResponse.json(status, {
    headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" },
  });
}
