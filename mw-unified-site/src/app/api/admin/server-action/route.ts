import { NextRequest, NextResponse } from "next/server";
import { requireGM } from "@/lib/adminAuth";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

const NEWS_FILE = process.env.NEWS_FILE || "/app/data/news.json";

// Map server names to their Docker container names
const SERVER_CONTAINERS: Record<string, { game: string; db: string; name: string; patch: string }> = {
  classic: { game: "vmangos-mangosd", db: "vmangos-db", name: "Classic", patch: "classic" },
  tbc: { game: "cmangos-tbc-server", db: "cmangos-tbc-db", name: "TBC", patch: "tbc" },
  wotlk: { game: "azerothcore-worldserver", db: "azerothcore-db", name: "WotLK", patch: "wotlk" },
};

const VALID_ACTIONS = ["start", "stop", "restart", "update", "status"] as const;
type Action = (typeof VALID_ACTIONS)[number];

function getDeployLogPath(server: string) {
  return `/tmp/admin-deploy-${server}.json`;
}

interface DeployStatus {
  server: string;
  action: string;
  status: "running" | "done" | "error";
  log: string[];
  startedAt: string;
  finishedAt?: string;
}

async function readDeployStatus(server: string): Promise<DeployStatus | null> {
  try {
    const data = await fs.readFile(getDeployLogPath(server), "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function writeDeployStatus(status: DeployStatus) {
  await fs.writeFile(getDeployLogPath(status.server), JSON.stringify(status, null, 2));
}

async function getImageDigest(container: string): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `docker inspect --format '{{.Image}}' ${container}`,
      { timeout: 5_000 },
    );
    return stdout.trim();
  } catch {
    return "";
  }
}

async function getImageCreated(container: string): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `docker inspect --format '{{.Created}}' ${container}`,
      { timeout: 5_000 },
    );
    return stdout.trim();
  } catch {
    return "";
  }
}

async function createUpdateNews(serverName: string, patchName: string, oldDigest: string, newDigest: string) {
  if (!oldDigest || !newDigest || oldDigest === newDigest) return;

  try {
    let news: Array<{ id: number; title: string; author: string; date: string; preview: string; patch: string; tag: string }> = [];
    try {
      const data = await fs.readFile(NEWS_FILE, "utf-8");
      news = JSON.parse(data);
    } catch {
      // File doesn't exist yet
    }

    const maxId = news.reduce((max, n) => Math.max(max, n.id), 0);

    const entry = {
      id: maxId + 1,
      title: `${serverName} server updated`,
      author: "Drums of War Team",
      date: new Date().toISOString(),
      preview: `${serverName} game server has been updated to the latest version. The server was restarted with the new build.`,
      patch: patchName,
      tag: "infrastructure",
    };

    news.unshift(entry);
    await fs.mkdir(path.dirname(NEWS_FILE), { recursive: true });
    await fs.writeFile(NEWS_FILE, JSON.stringify(news, null, 2));
    return entry;
  } catch (err) {
    console.error("[server-action] Failed to create update news:", err);
  }
}

async function runAction(server: string, action: Action) {
  const containers = SERVER_CONTAINERS[server];
  if (!containers) throw new Error("Unknown server");

  const status: DeployStatus = {
    server,
    action,
    status: "running",
    log: [`[${new Date().toISOString()}] Starting ${action} for ${containers.name}...`],
    startedAt: new Date().toISOString(),
  };
  await writeDeployStatus(status);

  const append = async (line: string) => {
    status.log.push(`[${new Date().toISOString()}] ${line}`);
    await writeDeployStatus(status);
  };

  try {
    if (action === "start") {
      await append(`Starting ${containers.game}...`);
      const { stdout, stderr } = await execAsync(
        `docker start ${containers.game}`,
        { timeout: 60_000 },
      );
      if (stdout.trim()) await append(stdout.trim());
      if (stderr.trim()) await append(stderr.trim());
      await append(`${containers.name} game server started.`);
    } else if (action === "stop") {
      await append(`Stopping ${containers.game}...`);
      const { stdout, stderr } = await execAsync(
        `docker stop ${containers.game}`,
        { timeout: 60_000 },
      );
      if (stdout.trim()) await append(stdout.trim());
      if (stderr.trim()) await append(stderr.trim());
      await append(`${containers.name} game server stopped.`);
    } else if (action === "restart") {
      await append(`Restarting ${containers.game}...`);
      const { stdout, stderr } = await execAsync(
        `docker restart ${containers.game}`,
        { timeout: 120_000 },
      );
      if (stdout.trim()) await append(stdout.trim());
      if (stderr.trim()) await append(stderr.trim());
      await append(`${containers.name} game server restarted.`);
    } else if (action === "update") {
      // Capture pre-update digest for change detection
      const oldDigest = await getImageDigest(containers.game);
      await append(`Current image digest: ${oldDigest.substring(0, 20)}...`);

      // Stop → Pull new image → Recreate container
      await append(`Stopping ${containers.game}...`);
      await execAsync(`docker stop ${containers.game}`, { timeout: 60_000 }).catch(() => {});
      await append(`Pulling latest image...`);
      let pullSucceeded = false;
      try {
        const { stdout: img } = await execAsync(
          `docker inspect --format '{{.Config.Image}}' ${containers.game}`,
          { timeout: 10_000 },
        );
        const image = img.trim();
        const { stdout: pullOut } = await execAsync(`docker pull ${image}`, { timeout: 300_000 });
        if (pullOut.trim()) await append(pullOut.trim().split("\n").pop() || "");
        pullSucceeded = true;
      } catch (pullErr) {
        await append(`Image pull skipped: ${pullErr instanceof Error ? pullErr.message : String(pullErr)}`);
      }
      await append(`Starting ${containers.game}...`);
      const { stdout, stderr } = await execAsync(
        `docker start ${containers.game}`,
        { timeout: 120_000 },
      );
      if (stdout.trim()) await append(stdout.trim());
      if (stderr.trim()) await append(stderr.trim());

      // Check if image changed → auto-create news
      if (pullSucceeded) {
        const newDigest = await getImageDigest(containers.game);
        if (oldDigest && newDigest && oldDigest !== newDigest) {
          await append(`Image updated! Old: ${oldDigest.substring(0, 20)}... → New: ${newDigest.substring(0, 20)}...`);
          const newsEntry = await createUpdateNews(containers.name, containers.patch, oldDigest, newDigest);
          if (newsEntry) {
            await append(`News published: "${newsEntry.title}"`);
          }
        } else {
          await append(`No image changes detected — already up to date.`);
        }
      }

      await append(`${containers.name} update complete.`);
    } else if (action === "status") {
      const { stdout } = await execAsync(
        `docker inspect --format '{{.State.Status}} uptime:{{.State.StartedAt}}' ${containers.game}`,
        { timeout: 10_000 },
      );
      await append(`Game server: ${stdout.trim()}`);
      const { stdout: dbOut } = await execAsync(
        `docker inspect --format '{{.State.Status}}' ${containers.db}`,
        { timeout: 10_000 },
      );
      await append(`Database: ${dbOut.trim()}`);
    }

    status.status = "done";
    status.finishedAt = new Date().toISOString();
    await writeDeployStatus(status);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await append(`ERROR: ${msg}`);
    status.status = "error";
    status.finishedAt = new Date().toISOString();
    await writeDeployStatus(status);
  }
}

// GET — poll deploy status
export async function GET(request: NextRequest) {
  const { error } = await requireGM(3);
  if (error) return error;

  const server = request.nextUrl.searchParams.get("server");
  if (!server || !SERVER_CONTAINERS[server]) {
    return NextResponse.json({ error: "Invalid server" }, { status: 400 });
  }

  const deployStatus = await readDeployStatus(server);
  if (!deployStatus) {
    return NextResponse.json({ status: "idle" });
  }
  return NextResponse.json(deployStatus);
}

// POST — trigger action
export async function POST(request: NextRequest) {
  const { error } = await requireGM(3);
  if (error) return error;

  let body: { server?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { server, action } = body;

  if (!server || !SERVER_CONTAINERS[server]) {
    return NextResponse.json({ error: "Invalid server" }, { status: 400 });
  }
  if (!action || !VALID_ACTIONS.includes(action as Action)) {
    return NextResponse.json({ error: `Invalid action. Valid: ${VALID_ACTIONS.join(", ")}` }, { status: 400 });
  }

  // Update runs async (can take minutes for image pull)
  if (action === "update") {
    runAction(server, action as Action).catch(console.error);
    return NextResponse.json({
      status: "started",
      message: `Update started for ${server}. Poll GET /api/admin/server-action?server=${server} for progress.`,
    });
  }

  await runAction(server, action as Action);
  const deployStatus = await readDeployStatus(server);
  return NextResponse.json({
    status: deployStatus?.status ?? "done",
    log: deployStatus?.log ?? [],
  });
}
