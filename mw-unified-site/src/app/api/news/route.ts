import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import defaultNews from "@/data/news.json";

const NEWS_FILE = process.env.NEWS_FILE || "/app/data/news.json";

async function loadNews() {
  try {
    const data = await fs.readFile(NEWS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    // First run or file missing — seed from bundled default
    try {
      await fs.mkdir(path.dirname(NEWS_FILE), { recursive: true });
      await fs.writeFile(NEWS_FILE, JSON.stringify(defaultNews, null, 2));
    } catch { /* ignore */ }
    return defaultNews;
  }
}

export async function GET() {
  const news = await loadNews();
  return NextResponse.json(news, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
