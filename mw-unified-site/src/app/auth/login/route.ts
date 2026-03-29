import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryOne, type Patch } from "@/lib/db";
import { verifyPassword } from "@/lib/srp6";
import { signToken, getCookieName, getCookieOptions } from "@/lib/jwt";
import type { RowDataPacket } from "mysql2/promise";
import crypto from "crypto";

interface AccountRow extends RowDataPacket {
  id: number;
  username: string;
  v: string | null;
  s: string | null;
  salt: Buffer | null;
  verifier: Buffer | null;
}

const PATCHES: Patch[] = ["classic", "tbc", "wotlk"];

interface GmLevelRow extends RowDataPacket {
  gmlevel: number;
}

/**
 * Fetch the GM level for an account on a specific server.
 * Classic/TBC: stored in account.gmlevel column
 * WotLK: stored in account_access table
 */
async function getGmLevel(
  patch: Patch,
  accountId: number
): Promise<number> {
  try {
    if (patch === "wotlk") {
      const row = await queryOne<GmLevelRow>(
        patch,
        "realm",
        "SELECT gmlevel FROM account_access WHERE id = ? ORDER BY gmlevel DESC LIMIT 1",
        [accountId]
      );
      return row?.gmlevel ?? 0;
    }
    // Classic and TBC
    const row = await queryOne<GmLevelRow>(
      patch,
      "realm",
      "SELECT gmlevel FROM account WHERE id = ?",
      [accountId]
    );
    return row?.gmlevel ?? 0;
  } catch (err) {
    console.error(`[auth] Error fetching gmlevel for ${patch}:`, err);
    return 0;
  }
}

/**
 * Try to verify credentials against a specific server's account table.
 * Returns account ID on success, null on failure.
 */
async function tryAuth(
  patch: Patch,
  username: string,
  password: string
): Promise<number | null> {
  try {
    const upperUser = username.toUpperCase();

    if (patch === "wotlk") {
      // AzerothCore: uses binary(32) salt and verifier columns
      const row = await queryOne<AccountRow>(
        patch,
        "realm",
        "SELECT id, username, salt, verifier FROM account WHERE UPPER(username) = ?",
        [upperUser]
      );
      if (!row || !row.salt || !row.verifier) return null;

      // AzerothCore stores salt and verifier as binary(32) in LE byte order
      // Convert to BE hex for our verifyPassword function
      const saltHex = Buffer.from(row.salt)
        .reverse()
        .toString("hex")
        .toUpperCase()
        .replace(/^0+/, "") || "0";
      const verifierHex = Buffer.from(row.verifier)
        .reverse()
        .toString("hex")
        .toUpperCase()
        .replace(/^0+/, "") || "0";
      if (verifyPassword(username, password, saltHex, verifierHex)) {
        return row.id;
      }

      return null;
    }

    // Classic and TBC: standard s/v hex columns
    const row = await queryOne<AccountRow>(
      patch,
      "realm",
      "SELECT id, username, v, s FROM account WHERE UPPER(username) = ?",
      [upperUser]
    );
    if (!row || !row.s || !row.v) return null;

    if (verifyPassword(username, password, row.s, row.v)) {
      return row.id;
    }
    return null;
  } catch (err) {
    console.error(`[auth] Error checking ${patch}:`, err);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { status: "error", error: "Username and password are required" },
        { status: 400 }
      );
    }

    // Try to authenticate against all servers
    const accounts: Record<string, number> = {};
    let authenticated = false;

    // Try all servers in parallel
    const results = await Promise.all(
      PATCHES.map(async (patch) => ({
        patch,
        accountId: await tryAuth(patch, username, password),
      }))
    );

    for (const { patch, accountId } of results) {
      if (accountId !== null) {
        accounts[patch] = accountId;
        authenticated = true;
      }
    }

    if (!authenticated) {
      return NextResponse.json(
        { status: "error", error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Fetch GM levels for all authenticated accounts and take MAX
    const gmLevels = await Promise.all(
      Object.entries(accounts).map(([patch, accountId]) =>
        getGmLevel(patch as Patch, accountId)
      )
    );
    const maxGmLevel = Math.max(0, ...gmLevels);

    // Generate a deterministic identity UUID from username
    const identityUuid = crypto
      .createHash("md5")
      .update(username.toUpperCase())
      .digest("hex")
      .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");

    // Create JWT
    const token = signToken({
      username: username.toUpperCase(),
      accounts,
      gmlevel: maxGmLevel,
    });

    // Set cookie
    const cookieStore = await cookies();
    const cookieOpts = getCookieOptions();
    cookieStore.set(getCookieName(), token, cookieOpts);

    return NextResponse.json({
      status: "ok",
      username: username.toUpperCase(),
      identity_uuid: identityUuid,
      gmlevel: maxGmLevel,
    });
  } catch (err) {
    console.error("[auth/login] Error:", err);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500 }
    );
  }
}
