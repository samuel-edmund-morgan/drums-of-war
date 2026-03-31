import { NextRequest, NextResponse } from "next/server";
import { requireGM } from "@/lib/adminAuth";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

const NEWS_FILE = process.env.NEWS_FILE || "/app/data/news.json";

// Map server names to their Docker container names and upstream git repos
const SERVER_CONTAINERS: Record<string, {
  game: string; db: string; name: string; patch: string;
  upstreamDir: string; // git repo path on host
  composePath: string; // docker-compose.yml directory
}> = {
  classic: {
    game: "vmangos-mangosd", db: "vmangos-db", name: "Classic", patch: "classic",
    upstreamDir: "/host-upstream/classic",
    composePath: "/opt/vmangos-classic",
  },
  tbc: {
    game: "cmangos-tbc-server", db: "cmangos-tbc-db", name: "TBC", patch: "tbc",
    upstreamDir: "/host-upstream/tbc",
    composePath: "/opt/cmangos-tbc",
  },
  wotlk: {
    game: "azerothcore-worldserver", db: "azerothcore-db", name: "WotLK", patch: "wotlk",
    upstreamDir: "/host-upstream/wotlk",
    composePath: "/opt/docker-azerothcore",
  },
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

async function createUpdateNewsFromGit(serverName: string, patchName: string, changelog: string, commitCount: number) {
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
      title: `${serverName} server updated (${commitCount} change${commitCount !== 1 ? "s" : ""})`,
      author: "Drums of War Team",
      date: new Date().toISOString(),
      preview: changelog.substring(0, 300) || `${serverName} game server has been updated to the latest version.`,
      patch: patchName,
      tag: "infrastructure" as const,
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
      // ── Git-based update flow ──
      // 1. git pull in upstream repo
      // 2. If new commits: stop → docker pull/build → start → create news with changelog
      // 3. If no changes: report "already up to date"

      const upDir = containers.upstreamDir;

      // Git repos are mounted from host into /host-upstream/{classic,tbc,wotlk}

      // Step 1: Get current HEAD before pull
      let oldHash = "";
      try {
        const { stdout } = await execAsync(`git -C ${upDir} rev-parse HEAD`, { timeout: 10_000 });
        oldHash = stdout.trim();
        await append(`Current upstream: ${oldHash.substring(0, 8)}`);
      } catch {
        await append(`WARNING: Git repo not found at ${upDir}. Falling back to image pull.`);
      }

      // Step 2: Git pull
      let newHash = oldHash;
      let changelog = "";
      if (oldHash) {
        try {
          await append(`Pulling upstream changes...`);
          await execAsync(`git -C ${upDir} fetch origin`, { timeout: 60_000 });
          await execAsync(`git -C ${upDir} reset --hard origin/HEAD`, { timeout: 30_000 });
          const { stdout: nh } = await execAsync(`git -C ${upDir} rev-parse HEAD`, { timeout: 10_000 });
          newHash = nh.trim();

          if (oldHash !== newHash) {
            const { stdout: log } = await execAsync(
              `git -C ${upDir} log --oneline ${oldHash}..${newHash} | head -20`,
              { timeout: 10_000 },
            );
            changelog = log.trim();
            const commitCount = changelog.split("\n").filter(l => l.trim()).length;
            await append(`${commitCount} new commit(s): ${oldHash.substring(0, 8)} → ${newHash.substring(0, 8)}`);
            for (const line of changelog.split("\n").slice(0, 5)) {
              if (line.trim()) await append(`  ${line.trim()}`);
            }
            if (changelog.split("\n").length > 5) {
              await append(`  ... and ${changelog.split("\n").length - 5} more`);
            }
          } else {
            await append(`No new commits — already up to date.`);
            await append(`${containers.name} update complete.`);
            status.status = "done";
            status.finishedAt = new Date().toISOString();
            await writeDeployStatus(status);
            return;
          }
        } catch (gitErr) {
          await append(`Git pull failed: ${gitErr instanceof Error ? gitErr.message : String(gitErr)}`);
        }
      }

      // Step 3: Stop server
      await append(`Stopping ${containers.game}...`);
      await execAsync(`docker stop ${containers.game}`, { timeout: 60_000 }).catch(() => {});

      // Step 4: Pull/rebuild image
      await append(`Pulling latest image...`);
      try {
        const { stdout: img } = await execAsync(
          `docker inspect --format '{{.Config.Image}}' ${containers.game}`,
          { timeout: 10_000 },
        );
        const image = img.trim();
        const { stdout: pullOut } = await execAsync(`docker pull ${image}`, { timeout: 300_000 });
        if (pullOut.trim()) await append(pullOut.trim().split("\n").pop() || "");
      } catch (pullErr) {
        await append(`Image pull: ${pullErr instanceof Error ? pullErr.message : String(pullErr)}`);
      }

      // Step 5: Start server
      await append(`Starting ${containers.game}...`);
      const { stdout, stderr } = await execAsync(
        `docker start ${containers.game}`,
        { timeout: 120_000 },
      );
      if (stdout.trim()) await append(stdout.trim());
      if (stderr.trim()) await append(stderr.trim());

      // Step 6: Create news if there were new commits
      if (oldHash && newHash && oldHash !== newHash && changelog) {
        const commitLines = changelog.split("\n").filter(l => l.trim()).slice(0, 5);
        const preview = commitLines.map(l => l.replace(/^[a-f0-9]+ /, "• ")).join(". ");
        const newsEntry = await createUpdateNewsFromGit(
          containers.name, containers.patch, preview, commitLines.length,
        );
        if (newsEntry) {
          await append(`News published: "${newsEntry.title}"`);
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
