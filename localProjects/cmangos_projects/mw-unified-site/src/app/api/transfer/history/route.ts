import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, getCookieName } from "@/lib/jwt";
import { getTransferHistory } from "@/lib/transfer-queue";

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

    const history = await getTransferHistory(payload.username);

    return NextResponse.json(
      history.map((r) => ({
        requestId: r.requestId,
        characterName: r.characterName,
        characterLevel: r.characterLevel,
        characterClass: r.characterClass,
        characterRace: r.characterRace,
        sourceRealm: r.sourceRealm,
        targetRealm: r.targetRealm,
        status: r.status,
        createdAt: r.createdAt,
      }))
    );
  } catch (err) {
    console.error("[transfer/history] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
