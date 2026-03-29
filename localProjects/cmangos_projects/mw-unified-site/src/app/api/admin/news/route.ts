import { NextRequest, NextResponse } from "next/server";
import { requireGM } from "@/lib/adminAuth";
import fs from "fs/promises";
import path from "path";
import defaultNews from "@/data/news.json";

const NEWS_FILE = process.env.NEWS_FILE || "/app/data/news.json";

interface NewsItem {
  id: number;
  title: string;
  author: string;
  date: string;
  preview: string;
  patch: string;
  tag: string;
}

async function loadNews(): Promise<NewsItem[]> {
  try {
    const data = await fs.readFile(NEWS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    await fs.mkdir(path.dirname(NEWS_FILE), { recursive: true });
    await fs.writeFile(NEWS_FILE, JSON.stringify(defaultNews, null, 2));
    return defaultNews as NewsItem[];
  }
}

async function saveNews(news: NewsItem[]) {
  await fs.mkdir(path.dirname(NEWS_FILE), { recursive: true });
  await fs.writeFile(NEWS_FILE, JSON.stringify(news, null, 2));
}

// GET — list all news (admin view)
export async function GET() {
  const { error } = await requireGM(3);
  if (error) return error;

  const news = await loadNews();
  return NextResponse.json({ news, count: news.length });
}

// POST — create new news entry
export async function POST(request: NextRequest) {
  const { error, payload } = await requireGM(3);
  if (error) return error;

  try {
    const body = await request.json();
    const { title, preview, patch, tag } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!preview?.trim()) {
      return NextResponse.json({ error: "Preview text is required" }, { status: 400 });
    }

    const validPatches = ["classic", "tbc", "wotlk", "general"];
    if (!validPatches.includes(patch)) {
      return NextResponse.json({ error: "Invalid patch" }, { status: 400 });
    }

    const validTags = ["feature", "improvement", "announcement", "infrastructure", "bugfix"];
    if (!validTags.includes(tag)) {
      return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
    }

    const news = await loadNews();
    const maxId = news.reduce((max, n) => Math.max(max, n.id), 0);

    const entry: NewsItem = {
      id: maxId + 1,
      title: title.trim(),
      author: payload?.username || "Drums of War Team",
      date: new Date().toISOString(),
      preview: preview.trim(),
      patch,
      tag,
    };

    // Prepend (newest first)
    news.unshift(entry);
    await saveNews(news);

    return NextResponse.json({ status: "ok", entry });
  } catch (err) {
    console.error("[admin/news] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE — remove a news entry by id
export async function DELETE(request: NextRequest) {
  const { error } = await requireGM(3);
  if (error) return error;

  const id = Number(request.nextUrl.searchParams.get("id"));
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const news = await loadNews();
  const filtered = news.filter((n) => n.id !== id);

  if (filtered.length === news.length) {
    return NextResponse.json({ error: "News entry not found" }, { status: 404 });
  }

  await saveNews(filtered);
  return NextResponse.json({ status: "ok", deleted: id });
}
