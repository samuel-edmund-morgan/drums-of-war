import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, getCookieName } from "@/lib/jwt";
import crypto from "crypto";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get(getCookieName());

    if (!tokenCookie) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const payload = verifyToken(tokenCookie.value);
    if (!payload) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // Generate deterministic identity UUID
    const identityUuid = crypto
      .createHash("md5")
      .update(payload.username.toUpperCase())
      .digest("hex")
      .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");

    return NextResponse.json({
      authenticated: true,
      username: payload.username,
      identity_uuid: identityUuid,
      accounts: payload.accounts,
      gmlevel: payload.gmlevel ?? 0,
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
