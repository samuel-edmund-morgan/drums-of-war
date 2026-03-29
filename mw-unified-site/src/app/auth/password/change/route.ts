import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, getCookieName } from "@/lib/jwt";
import { queryOne, withConnection, type Patch } from "@/lib/db";
import { verifyPassword, computeVerifier, computeVerifierBinary, generateSalt } from "@/lib/srp6";
import type { RowDataPacket } from "mysql2/promise";

interface AccountRow extends RowDataPacket {
  id: number;
  username: string;
  v: string | null;
  s: string | null;
  salt: Buffer | null;
  verifier: Buffer | null;
}

/**
 * Verify current password against a specific server.
 */
async function verifyOnServer(
  patch: Patch,
  username: string,
  password: string
): Promise<boolean> {
  try {
    const upperUser = username.toUpperCase();

    if (patch === "wotlk") {
      const row = await queryOne<AccountRow>(
        patch,
        "realm",
        "SELECT id, username, salt, verifier FROM account WHERE UPPER(username) = ?",
        [upperUser]
      );
      if (!row || !row.salt || !row.verifier) return false;

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
      return verifyPassword(username, password, saltHex, verifierHex);
    }

    // Classic / TBC
    const row = await queryOne<AccountRow>(
      patch,
      "realm",
      "SELECT id, username, v, s FROM account WHERE UPPER(username) = ?",
      [upperUser]
    );
    if (!row || !row.s || !row.v) return false;
    return verifyPassword(username, password, row.s, row.v);
  } catch (err) {
    console.error(`[password/change] verify error on ${patch}:`, err);
    return false;
  }
}

/**
 * Update password on a specific server.
 */
async function updateOnServer(
  patch: Patch,
  username: string,
  newPassword: string
): Promise<boolean> {
  try {
    const upperUser = username.toUpperCase();

    if (patch === "wotlk") {
      const { saltBuffer, verifierBuffer } = computeVerifierBinary(
        username,
        newPassword
      );
      await withConnection(patch, "realm", async (conn) => {
        await conn.execute(
          "UPDATE account SET salt = ?, verifier = ? WHERE UPPER(username) = ?",
          [saltBuffer, verifierBuffer, upperUser]
        );
      });
      return true;
    }

    // Classic / TBC: hex v/s columns
    const { saltInt } = generateSalt();
    const { saltHex, verifierHex } = computeVerifier(
      username,
      newPassword,
      saltInt
    );
    await withConnection(patch, "realm", async (conn) => {
      await conn.execute(
        "UPDATE account SET v = ?, s = ? WHERE UPPER(username) = ?",
        [verifierHex, saltHex, upperUser]
      );
    });
    return true;
  } catch (err) {
    console.error(`[password/change] update error on ${patch}:`, err);
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get(getCookieName());

    if (!tokenCookie) {
      return NextResponse.json(
        { status: "error", error: "Not authenticated" },
        { status: 401 }
      );
    }

    const payload = verifyToken(tokenCookie.value);
    if (!payload) {
      return NextResponse.json(
        { status: "error", error: "Invalid session" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { status: "error", error: "Current password and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 4) {
      return NextResponse.json(
        { status: "error", error: "New password must be at least 4 characters" },
        { status: 400 }
      );
    }

    // Determine which servers the user has accounts on
    const patches: Patch[] = ["classic", "tbc", "wotlk"];
    const linkedPatches = patches.filter((p) => payload.accounts[p] != null);

    if (linkedPatches.length === 0) {
      return NextResponse.json(
        { status: "error", error: "No linked accounts found" },
        { status: 400 }
      );
    }

    // Verify current password on at least one server
    const verifyResults = await Promise.all(
      linkedPatches.map(async (patch) => ({
        patch,
        valid: await verifyOnServer(patch, payload.username, currentPassword),
      }))
    );

    const anyValid = verifyResults.some((r) => r.valid);
    if (!anyValid) {
      return NextResponse.json(
        { status: "error", error: "Current password is incorrect" },
        { status: 403 }
      );
    }

    // Update password on ALL linked servers
    const updateResults = await Promise.all(
      linkedPatches.map(async (patch) => ({
        patch,
        success: await updateOnServer(patch, payload.username, newPassword),
      }))
    );

    const failures = updateResults.filter((r) => !r.success);
    if (failures.length > 0) {
      const failedServers = failures.map((f) => f.patch).join(", ");
      return NextResponse.json(
        {
          status: "error",
          error: `Password updated on some servers but failed on: ${failedServers}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("[password/change] Error:", err);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500 }
    );
  }
}
