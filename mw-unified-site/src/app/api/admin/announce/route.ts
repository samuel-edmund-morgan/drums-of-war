import { NextRequest, NextResponse } from "next/server";
import { requireGM } from "@/lib/adminAuth";
import fs from "fs/promises";

const ANNOUNCEMENTS_FILE = "/tmp/admin-announcements.json";

interface Announcement {
  id: string;
  message: string;
  servers: string[];
  author: string;
  timestamp: string;
}

async function loadAnnouncements(): Promise<Announcement[]> {
  try {
    const data = await fs.readFile(ANNOUNCEMENTS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveAnnouncements(announcements: Announcement[]) {
  await fs.writeFile(ANNOUNCEMENTS_FILE, JSON.stringify(announcements, null, 2));
}

export async function GET() {
  const { error } = await requireGM(3);
  if (error) return error;

  const announcements = await loadAnnouncements();
  return NextResponse.json({ announcements: announcements.slice(-20).reverse() });
}

export async function POST(request: NextRequest) {
  const { error, payload } = await requireGM(3);
  if (error) return error;

  try {
    const body = await request.json();
    const { message, servers } = body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    if (!servers || !Array.isArray(servers) || servers.length === 0) {
      return NextResponse.json(
        { error: "At least one server must be selected" },
        { status: 400 }
      );
    }

    const announcement: Announcement = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      message: message.trim(),
      servers,
      author: payload!.username,
      timestamp: new Date().toISOString(),
    };

    const announcements = await loadAnnouncements();
    announcements.push(announcement);
    // Keep last 100 announcements
    const trimmed = announcements.slice(-100);
    await saveAnnouncements(trimmed);

    return NextResponse.json({ status: "ok", announcement });
  } catch (err) {
    console.error("[admin/announce] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
