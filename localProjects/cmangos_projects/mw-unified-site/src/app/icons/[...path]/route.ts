import { NextRequest } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";

const UPSTREAM = "https://wow.zamimg.com/images/wow/icons";
const CACHE_DIR = process.env.ICON_CACHE_DIR || "/app/icon-cache";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const subPath = segments.join("/");

  // Security: block path traversal
  if (subPath.includes("..") || subPath.startsWith("/")) {
    return new Response("Bad request", { status: 400 });
  }

  // Only allow image files
  if (!subPath.endsWith(".jpg") && !subPath.endsWith(".png") && !subPath.endsWith(".gif")) {
    return new Response("Not found", { status: 404 });
  }

  const cachePath = join(CACHE_DIR, subPath);

  // Serve from disk cache
  if (existsSync(cachePath)) {
    try {
      const data = await readFile(cachePath);
      return new Response(data, {
        status: 200,
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Cache": "HIT",
        },
      });
    } catch {
      // Fall through to upstream
    }
  }

  // Fetch from upstream
  const url = `${UPSTREAM}/${subPath}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 WoW-Icon-Proxy/1.0" },
    });

    if (!res.ok) {
      return new Response(null, { status: res.status });
    }

    const buffer = Buffer.from(await res.arrayBuffer());

    // Cache to disk (best-effort)
    const cacheDir = dirname(cachePath);
    mkdir(cacheDir, { recursive: true })
      .then(() => writeFile(cachePath, buffer))
      .catch(() => {});

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Cache": "MISS",
      },
    });
  } catch {
    return new Response("Upstream error", { status: 502 });
  }
}
