import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCookieName } from "@/lib/jwt";

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(getCookieName());
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "ok" });
  }
}
