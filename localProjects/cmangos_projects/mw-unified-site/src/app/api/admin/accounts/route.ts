import { NextRequest, NextResponse } from "next/server";
import { requireGM } from "@/lib/adminAuth";
import { queryAll, type Patch, ALL_PATCHES } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";

interface AccountRow extends RowDataPacket {
  id: number;
  username: string;
  gmlevel: number;
  last_login: string;
  last_ip: string;
  online: number;
}

interface WotlkAccountRow extends RowDataPacket {
  id: number;
  username: string;
  last_login: string;
  last_ip: string;
  online: number;
  gmlevel: number | null;
}

interface AccountEntry {
  id: number;
  username: string;
  server: string;
  gmlevel: number;
  last_login: string;
  last_ip: string;
  online: boolean;
}

const PATCH_NAMES: Record<Patch, string> = {
  classic: "Classic",
  tbc: "TBC",
  wotlk: "WotLK",
};

const PAGE_SIZE = 25;

async function getAccounts(
  patch: Patch,
  limit: number,
  offset: number
): Promise<AccountEntry[]> {
  try {
    if (patch === "wotlk") {
      const rows = await queryAll<WotlkAccountRow>(
        patch,
        "realm",
        `SELECT a.id, a.username, a.last_login, a.last_ip, a.online,
                COALESCE(aa.gmlevel, 0) AS gmlevel
         FROM account a
         LEFT JOIN account_access aa ON a.id = aa.id
         ORDER BY a.last_login DESC
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      return rows.map((r) => ({
        id: r.id,
        username: r.username,
        server: PATCH_NAMES[patch],
        gmlevel: r.gmlevel ?? 0,
        last_login: r.last_login,
        last_ip: r.last_ip,
        online: r.online === 1,
      }));
    }

    const rows = await queryAll<AccountRow>(
      patch,
      "realm",
      `SELECT id, username, gmlevel, last_login, last_ip, online
       FROM account
       ORDER BY last_login DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    return rows.map((r) => ({
      id: r.id,
      username: r.username,
      server: PATCH_NAMES[patch],
      gmlevel: r.gmlevel ?? 0,
      last_login: r.last_login,
      last_ip: r.last_ip,
      online: r.online === 1,
    }));
  } catch (err) {
    console.error(`[admin/accounts] Error fetching ${patch}:`, err);
    return [];
  }
}

export async function GET(request: NextRequest) {
  const { error } = await requireGM(3);
  if (error) return error;

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const server = url.searchParams.get("server") as Patch | null;
  const offset = (page - 1) * PAGE_SIZE;

  const patches = server && ALL_PATCHES.includes(server) ? [server] : ALL_PATCHES;

  const results = await Promise.all(
    patches.map((p) => getAccounts(p, PAGE_SIZE, offset))
  );

  const accounts = results.flat();

  return NextResponse.json({ accounts, page, pageSize: PAGE_SIZE });
}
