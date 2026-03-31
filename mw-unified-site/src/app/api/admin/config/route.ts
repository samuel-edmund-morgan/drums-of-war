import { NextRequest, NextResponse } from "next/server";
import { requireGM } from "@/lib/adminAuth";
import fs from "fs/promises";
import { execSync } from "child_process";
import path from "path";

const CONFIG_DIRS: Record<string, string> = {
  classic: "/host-configs/classic",
  tbc: "/host-configs/tbc",
  wotlk: "/host-configs/wotlk",
};

// Allowed config files per server
const ALLOWED_FILES: Record<string, string[]> = {
  classic: ["mangosd.conf", "realmd.conf"],
  tbc: ["mangosd.conf", "realmd.conf", "ahbot.conf", "anticheat.conf"],
  wotlk: ["worldserver.conf", "authserver.conf"],
};

const CONTAINERS: Record<string, string> = {
  classic: "vmangos-mangosd",
  tbc: "cmangos-tbc-server",
  wotlk: "azerothcore-worldserver",
};

function validateConfSyntax(content: string): { valid: boolean; error?: string } {
  if (!content || content.trim().length === 0) {
    return { valid: false, error: "File is empty" };
  }
  // Check for binary content
  if (/[\x00-\x08\x0E-\x1F]/.test(content)) {
    return { valid: false, error: "File contains binary data" };
  }
  // Check for at least one Key = Value pair
  const lines = content.split("\n").filter(l => l.trim() && !l.trim().startsWith("#"));
  const kvLines = lines.filter(l => /^\s*\S+\s*=/.test(l));
  if (kvLines.length === 0) {
    return { valid: false, error: "No configuration entries (Key = Value) found" };
  }
  return { valid: true };
}

// GET — download config archive or list files
export async function GET(request: NextRequest) {
  const { error } = await requireGM(3);
  if (error) return error;

  const server = request.nextUrl.searchParams.get("server");
  const action = request.nextUrl.searchParams.get("action") || "list";

  if (!server || !CONFIG_DIRS[server]) {
    return NextResponse.json({ error: "Invalid server" }, { status: 400 });
  }

  const configDir = CONFIG_DIRS[server];

  if (action === "list") {
    try {
      const files = await fs.readdir(configDir);
      const confFiles = files.filter(f => f.endsWith(".conf") || f.endsWith(".conf.dist"));
      const result = await Promise.all(
        confFiles.map(async (f) => {
          const stat = await fs.stat(path.join(configDir, f));
          return { name: f, size: stat.size, modified: stat.mtime.toISOString() };
        })
      );
      return NextResponse.json({ server, files: result });
    } catch {
      return NextResponse.json({ error: "Cannot read config directory" }, { status: 500 });
    }
  }

  if (action === "download") {
    try {
      // Create tar.gz of config dir
      const tarData = execSync(
        `tar czf - -C ${configDir} $(ls ${configDir}/*.conf 2>/dev/null | xargs -I{} basename {})`,
        { maxBuffer: 10 * 1024 * 1024 },
      );
      return new Response(tarData, {
        headers: {
          "Content-Type": "application/gzip",
          "Content-Disposition": `attachment; filename="${server}-config.tar.gz"`,
        },
      });
    } catch (err) {
      return NextResponse.json({ error: `Download failed: ${err}` }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid action. Use: list, download" }, { status: 400 });
}

// POST — upload config file or restore defaults
export async function POST(request: NextRequest) {
  const { error, payload } = await requireGM(3);
  if (error) return error;

  const contentType = request.headers.get("content-type") || "";

  // JSON body = restore action
  if (contentType.includes("application/json")) {
    const body = await request.json();
    const { server, action, filename } = body;

    if (!server || !CONFIG_DIRS[server]) {
      return NextResponse.json({ error: "Invalid server" }, { status: 400 });
    }

    if (action === "restore") {
      const allowed = ALLOWED_FILES[server] || [];
      if (!filename || !allowed.includes(filename)) {
        return NextResponse.json({ error: `Invalid file: ${filename}` }, { status: 400 });
      }

      const configDir = CONFIG_DIRS[server];
      const distFile = path.join(configDir, `${filename}.dist`);
      const confFile = path.join(configDir, filename);

      try {
        await fs.access(distFile);
        await fs.copyFile(distFile, confFile);
        console.log(`[admin/config] ${payload?.username} restored ${server}/${filename} from .dist`);
        return NextResponse.json({ status: "ok", message: `${filename} restored to defaults` });
      } catch {
        return NextResponse.json({ error: `Default file ${filename}.dist not found` }, { status: 404 });
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // Multipart form = file upload
  try {
    const formData = await request.formData();
    const server = formData.get("server") as string;
    const file = formData.get("file") as File | null;

    if (!server || !CONFIG_DIRS[server]) {
      return NextResponse.json({ error: "Invalid server" }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const allowed = ALLOWED_FILES[server] || [];
    if (!allowed.includes(file.name)) {
      return NextResponse.json({
        error: `Invalid filename: ${file.name}. Allowed: ${allowed.join(", ")}`,
      }, { status: 400 });
    }

    if (file.size > 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 1MB)" }, { status: 400 });
    }

    const content = await file.text();

    // Validate .conf syntax
    const validation = validateConfSyntax(content);
    if (!validation.valid) {
      return NextResponse.json({ error: `Invalid config: ${validation.error}` }, { status: 400 });
    }

    const configDir = CONFIG_DIRS[server];
    const targetPath = path.join(configDir, file.name);

    // Backup current file
    try {
      const existing = await fs.readFile(targetPath, "utf-8");
      await fs.writeFile(`${targetPath}.bak`, existing);
    } catch { /* no existing file */ }

    await fs.writeFile(targetPath, content);

    console.log(`[admin/config] ${payload?.username} uploaded ${server}/${file.name} (${file.size} bytes)`);

    return NextResponse.json({
      status: "ok",
      message: `${file.name} uploaded successfully. Restart server to apply.`,
      file: file.name,
      size: file.size,
    });
  } catch (err) {
    return NextResponse.json({ error: `Upload failed: ${err}` }, { status: 500 });
  }
}
