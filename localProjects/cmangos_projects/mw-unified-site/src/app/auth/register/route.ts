import { NextResponse } from "next/server";
import { withConnection } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, email } = body;

    if (!username || !password || !email) {
      return NextResponse.json(
        { status: "error", error: "Username, password, and email are required" },
        { status: 400 },
      );
    }

    if (!/^[a-zA-Z0-9]{3,16}$/.test(username)) {
      return NextResponse.json(
        { status: "error", error: "Username must be 3-16 alphanumeric characters" },
        { status: 400 },
      );
    }

    if (password.length < 4 || password.length > 64) {
      return NextResponse.json(
        { status: "error", error: "Password must be 4-64 characters" },
        { status: 400 },
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { status: "error", error: "Invalid email address" },
        { status: 400 },
      );
    }

    const upperUser = username.toUpperCase();

    // Check if account already exists on any server
    const existsChecks = await Promise.all([
      withConnection("classic", "realm", async (c) => {
        const [rows] = await c.execute("SELECT id FROM account WHERE username = ?", [upperUser]);
        return (rows as unknown[]).length > 0;
      }).catch(() => false),
      withConnection("tbc", "realm", async (c) => {
        const [rows] = await c.execute("SELECT id FROM account WHERE username = ?", [upperUser]);
        return (rows as unknown[]).length > 0;
      }).catch(() => false),
      withConnection("wotlk", "realm", async (c) => {
        const [rows] = await c.execute("SELECT id FROM account WHERE username = ?", [upperUser]);
        return (rows as unknown[]).length > 0;
      }).catch(() => false),
    ]);

    if (existsChecks.some(Boolean)) {
      return NextResponse.json(
        { status: "error", error: "Account already exists" },
        { status: 409 },
      );
    }

    // Store pending registration (password stored as base64 for later SRP6 computation)
    const token = crypto.randomUUID();
    const passwordB64 = Buffer.from(password).toString("base64");

    try {
      await withConnection("classic", "realm", async (conn) => {
        // Remove any expired pendings (>24h) or same username/email
        await conn.execute(
          "DELETE FROM pending_registration WHERE created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)",
        );
        await conn.execute(
          "DELETE FROM pending_registration WHERE username = ? OR email = ?",
          [upperUser, email.toLowerCase()],
        );
        await conn.execute(
          `INSERT INTO pending_registration (token, username, password_hash, email, created_at)
           VALUES (?, ?, ?, ?, NOW())`,
          [token, upperUser, passwordB64, email.toLowerCase()],
        );
      });
    } catch (err) {
      console.error("[register] Pending insert error:", err);
      return NextResponse.json(
        { status: "error", error: "Registration failed. Try again." },
        { status: 500 },
      );
    }

    // Send verification email
    const emailSent = await sendVerificationEmail(email, upperUser, token);

    if (!emailSent) {
      return NextResponse.json(
        { status: "error", error: "Failed to send verification email. Try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      status: "ok",
      message: "Verification email sent. Check your inbox.",
    });
  } catch (err) {
    console.error("[auth/register] Error:", err);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500 },
    );
  }
}
