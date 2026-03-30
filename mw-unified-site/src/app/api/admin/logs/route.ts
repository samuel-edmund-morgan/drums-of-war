import { NextRequest, NextResponse } from "next/server";
import { requireGM } from "@/lib/adminAuth";
import fs from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

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
};

const DOCKER_CONTAINERS: Record<string, string> = {
  website: "mw-unified-site",
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

async function readDockerLogs(container: string, lines: number): Promise<string[]> {
  try {
    const { stdout } = await execAsync(
      `docker logs --tail ${lines} ${container} 2>&1`,
      { timeout: 5000 },
    );
    return stdout.split("\n").filter((l) => l.trim().length > 0);
  } catch {
    return ["(Docker logs not accessible)"];
  }
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
  const dockerContainer = DOCKER_CONTAINERS[server];

  if (!paths && !dockerContainer) {
    return NextResponse.json(
      { error: "Unknown server" },
      { status: 400 }
    );
  }

  const logLines = dockerContainer
    ? await readDockerLogs(dockerContainer, lineCount)
    : await readLogTail(paths!, lineCount);

  return NextResponse.json({
    server,
    lines: logLines,
    count: logLines.length,
  });
}
