import { NextRequest, NextResponse } from "next/server";
import { requireGM } from "@/lib/adminAuth";
import fs from "fs/promises";

// Log paths mapped into the container via docker-compose volume mounts
const LOG_PATHS: Record<string, string[]> = {
  classic: [
    "/host-logs/classic/Server.log",
    "/host-logs/classic/mangos.log",
  ],
  tbc: [
    "/host-logs/tbc/Server.log",
    "/host-logs/tbc/mangos.log",
  ],
  wotlk: [
    "/host-logs/wotlk/Server.log",
    "/host-logs/wotlk/worldserver.log",
  ],
  website: ["/proc/1/fd/1"],
};

async function readLogTail(
  paths: string[],
  lines: number
): Promise<string[]> {
  for (const logPath of paths) {
    try {
      const content = await fs.readFile(logPath, "utf-8");
      const allLines = content.split("\n").filter((l) => l.trim().length > 0);
      return allLines.slice(-lines);
    } catch {
      continue;
    }
  }
  return ["(Log file not accessible)"];
}

export async function GET(request: NextRequest) {
  const { error } = await requireGM(3);
  if (error) return error;

  const url = new URL(request.url);
  const server = url.searchParams.get("server") || "website";
  const lineCount = Math.min(
    100,
    Math.max(10, parseInt(url.searchParams.get("lines") || "50", 10))
  );

  const paths = LOG_PATHS[server];
  if (!paths) {
    return NextResponse.json(
      { error: "Unknown server" },
      { status: 400 }
    );
  }

  const logLines = await readLogTail(paths, lineCount);

  return NextResponse.json({
    server,
    lines: logLines,
    count: logLines.length,
  });
}
