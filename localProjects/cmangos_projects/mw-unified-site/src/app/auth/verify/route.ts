import { NextRequest, NextResponse } from "next/server";
import { withConnection, type Patch } from "@/lib/db";
import { computeVerifier, computeVerifierBinary } from "@/lib/srp6";
import type { RowDataPacket } from "mysql2/promise";

interface PendingRow extends RowDataPacket {
  token: string;
  username: string;
  password_hash: string;
  email: string;
}

interface RegistrationResult {
  patch: Patch;
  success: boolean;
  error?: string;
}

async function createClassic(username: string, password: string, email: string): Promise<RegistrationResult> {
  try {
    const { saltHex, verifierHex } = computeVerifier(username, password);
    await withConnection("classic", "realm", async (conn) => {
      await conn.execute(
        "INSERT INTO account (username, v, s, email, expansion, joindate) VALUES (?, ?, ?, ?, 0, NOW())",
        [username.toUpperCase(), verifierHex, saltHex, email],
      );
    });
    return { patch: "classic", success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Duplicate")) return { patch: "classic", success: false, error: "Already exists" };
    return { patch: "classic", success: false, error: msg };
  }
}

async function createTbc(username: string, password: string, email: string): Promise<RegistrationResult> {
  try {
    const { saltHex, verifierHex } = computeVerifier(username, password);
    await withConnection("tbc", "realm", async (conn) => {
      await conn.execute(
        "INSERT INTO account (username, v, s, email, expansion, joindate) VALUES (?, ?, ?, ?, 1, NOW())",
        [username.toUpperCase(), verifierHex, saltHex, email],
      );
    });
    return { patch: "tbc", success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Duplicate")) return { patch: "tbc", success: false, error: "Already exists" };
    return { patch: "tbc", success: false, error: msg };
  }
}

async function createWotlk(username: string, password: string, email: string): Promise<RegistrationResult> {
  try {
    const { saltBuffer, verifierBuffer } = computeVerifierBinary(username, password);
    await withConnection("wotlk", "realm", async (conn) => {
      await conn.execute(
        "INSERT INTO account (username, salt, verifier, email, reg_mail, expansion, joindate) VALUES (?, ?, ?, ?, ?, 2, NOW())",
        [username.toUpperCase(), saltBuffer, verifierBuffer, email, email],
      );
    });
    return { patch: "wotlk", success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Duplicate")) return { patch: "wotlk", success: false, error: "Already exists" };
    return { patch: "wotlk", success: false, error: msg };
  }
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://world-of-warcraft.morgan-dev.com";

  if (!token || !/^[0-9a-f-]{36}$/.test(token)) {
    return NextResponse.redirect(`${siteUrl}/?verify=invalid`);
  }

  try {
    // Fetch pending registration
    let pending: PendingRow | null = null;
    await withConnection("classic", "realm", async (conn) => {
      // Clean expired
      await conn.execute("DELETE FROM pending_registration WHERE created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)");
      const [rows] = await conn.execute<PendingRow[]>(
        "SELECT * FROM pending_registration WHERE token = ?",
        [token],
      );
      if (rows.length > 0) pending = rows[0];
    });

    if (!pending) {
      return NextResponse.redirect(`${siteUrl}/?verify=expired`);
    }

    const { username, password_hash, email } = pending;
    const password = Buffer.from(password_hash, "base64").toString("utf-8");

    // Create accounts on all 3 servers
    const results = await Promise.all([
      createClassic(username, password, email),
      createTbc(username, password, email),
      createWotlk(username, password, email),
    ]);

    const anySuccess = results.some((r) => r.success);

    if (!anySuccess) {
      console.error("[verify] All server account creation failed:", results);
      return NextResponse.redirect(`${siteUrl}/?verify=error`);
    }

    // Remove pending registration
    await withConnection("classic", "realm", async (conn) => {
      await conn.execute("DELETE FROM pending_registration WHERE token = ?", [token]);
    }).catch(() => {});

    return NextResponse.redirect(`${siteUrl}/?verify=success`);
  } catch (err) {
    console.error("[auth/verify] Error:", err);
    return NextResponse.redirect(`${siteUrl}/?verify=error`);
  }
}
