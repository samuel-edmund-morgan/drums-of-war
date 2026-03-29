import { cookies } from "next/headers";
import { verifyToken, getCookieName, type JwtPayload } from "./jwt";
import { NextResponse } from "next/server";

export async function requireGM(minLevel = 3): Promise<{
  error: NextResponse | null;
  payload: JwtPayload | null;
}> {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get(getCookieName());

  if (!tokenCookie) {
    return {
      error: NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      ),
      payload: null,
    };
  }

  const payload = verifyToken(tokenCookie.value);
  if (!payload) {
    return {
      error: NextResponse.json({ error: "Invalid session" }, { status: 401 }),
      payload: null,
    };
  }

  if ((payload.gmlevel ?? 0) < minLevel) {
    return {
      error: NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      ),
      payload: null,
    };
  }

  return { error: null, payload };
}
