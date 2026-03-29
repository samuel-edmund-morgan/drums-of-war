import { NextResponse } from "next/server";
import { requireGM } from "@/lib/adminAuth";
import { queryOne, queryAll, type Patch, ALL_PATCHES } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";

interface UptimeRow extends RowDataPacket {
  starttime: number;
  uptime: number;
  maxplayers: number;
}

interface CountRow extends RowDataPacket {
  cnt: number;
}

interface RecentLoginRow extends RowDataPacket {
  id: number;
  username: string;
  last_login: string;
  last_ip: string;
}

interface ServerInfo {
  name: string;
  patch: Patch;
  status: "online" | "offline" | "unknown";
  playersOnline: number;
  totalAccounts: number;
  totalCharacters: number;
  uptime: number;
}

interface RecentLogin {
  username: string;
  server: string;
  last_login: string;
  last_ip: string;
}

const PATCH_NAMES: Record<Patch, string> = {
  classic: "Classic",
  tbc: "TBC",
  wotlk: "WotLK",
};

async function getServerInfo(patch: Patch): Promise<ServerInfo> {
  const info: ServerInfo = {
    name: PATCH_NAMES[patch],
    patch,
    status: "unknown",
    playersOnline: 0,
    totalAccounts: 0,
    totalCharacters: 0,
    uptime: 0,
  };

  try {
    // Check uptime
    const uptimeRow = await queryOne<UptimeRow>(
      patch,
      "realm",
      "SELECT starttime, uptime, maxplayers FROM uptime ORDER BY starttime DESC LIMIT 1"
    );
    if (uptimeRow) {
      info.status = "online";
      info.uptime = uptimeRow.uptime;
    }
  } catch {
    info.status = "offline";
  }

  try {
    // Players online
    const onlineRow = await queryOne<CountRow>(
      patch,
      "char",
      "SELECT COUNT(*) AS cnt FROM characters WHERE online = 1"
    );
    info.playersOnline = onlineRow?.cnt ?? 0;
  } catch {
    // server may be offline
  }

  try {
    // Total accounts
    const accountRow = await queryOne<CountRow>(
      patch,
      "realm",
      "SELECT COUNT(*) AS cnt FROM account"
    );
    info.totalAccounts = accountRow?.cnt ?? 0;
  } catch {
    // ignore
  }

  try {
    // Total characters
    const charRow = await queryOne<CountRow>(
      patch,
      "char",
      "SELECT COUNT(*) AS cnt FROM characters"
    );
    info.totalCharacters = charRow?.cnt ?? 0;
  } catch {
    // ignore
  }

  return info;
}

async function getRecentLogins(patch: Patch): Promise<RecentLogin[]> {
  try {
    const rows = await queryAll<RecentLoginRow>(
      patch,
      "realm",
      "SELECT id, username, last_login, last_ip FROM account ORDER BY last_login DESC LIMIT 10"
    );
    return rows.map((r) => ({
      username: r.username,
      server: PATCH_NAMES[patch],
      last_login: r.last_login,
      last_ip: r.last_ip,
    }));
  } catch {
    return [];
  }
}

export async function GET() {
  const { error } = await requireGM(3);
  if (error) return error;

  const [servers, ...loginArrays] = await Promise.all([
    Promise.all(ALL_PATCHES.map(getServerInfo)),
    ...ALL_PATCHES.map(getRecentLogins),
  ]);

  // Merge and sort recent logins by date descending
  const recentLogins = (loginArrays as RecentLogin[][])
    .flat()
    .sort((a, b) => {
      const da = new Date(a.last_login).getTime() || 0;
      const db = new Date(b.last_login).getTime() || 0;
      return db - da;
    })
    .slice(0, 20);

  return NextResponse.json({ servers, recentLogins });
}
