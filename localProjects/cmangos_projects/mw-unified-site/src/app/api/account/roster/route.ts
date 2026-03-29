import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, getCookieName } from "@/lib/jwt";
import { queryAll, RACES, CLASSES, type Patch } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";

interface CharRow extends RowDataPacket {
  guid: number;
  name: string;
  level: number;
  race: number;
  class: number;
  gender: number;
  online: number;
  totaltime: number;
}

interface RosterChar {
  guid: number;
  name: string;
  level: number;
  race: string;
  raceId: number;
  className: string;
  classId: number;
  gender: number;
  online: boolean;
  playedTime: number;
}

const CHAR_SQL: Record<Patch, string> = {
  classic: `SELECT guid, name, level, race, class, gender, online, 0 AS totaltime
    FROM characters WHERE account = ? ORDER BY level DESC`,
  tbc: `SELECT guid, name, level, race, class, gender, online, totaltime
    FROM characters WHERE account = ? ORDER BY level DESC`,
  wotlk: `SELECT guid, name, level, race, class, gender, online, totaltime
    FROM characters WHERE account = ? ORDER BY level DESC`,
};

async function fetchRoster(
  patch: Patch,
  accountId: number
): Promise<RosterChar[]> {
  try {
    const rows = await queryAll<CharRow>(
      patch,
      "char",
      CHAR_SQL[patch],
      [accountId]
    );
    return rows.map((r) => ({
      guid: r.guid,
      name: r.name,
      level: r.level,
      race: RACES[r.race] || `Race ${r.race}`,
      raceId: r.race,
      className: CLASSES[r.class] || `Class ${r.class}`,
      classId: r.class,
      gender: r.gender,
      online: r.online === 1,
      playedTime: r.totaltime ?? 0,
    }));
  } catch (err) {
    console.error(`[roster] Error fetching ${patch}:`, err);
    return [];
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get(getCookieName());

    if (!tokenCookie) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const payload = verifyToken(tokenCookie.value);
    if (!payload) {
      return NextResponse.json(
        { error: "Invalid session" },
        { status: 401 }
      );
    }

    const patches: Patch[] = ["classic", "tbc", "wotlk"];
    const results = await Promise.all(
      patches.map(async (patch) => {
        const accountId = payload.accounts[patch];
        if (!accountId) return { patch, chars: [] as RosterChar[] };
        const chars = await fetchRoster(patch, accountId);
        return { patch, chars };
      })
    );

    const roster: Record<string, RosterChar[]> = {};
    for (const { patch, chars } of results) {
      roster[patch] = chars;
    }

    return NextResponse.json(roster);
  } catch (err) {
    console.error("[roster] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
