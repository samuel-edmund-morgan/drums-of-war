"use client";

import { useState, useEffect } from "react";

interface NewsItem {
  id: number;
  title: string;
  author: string;
  date: string;
  preview: string;
  patch: "classic" | "tbc" | "wotlk" | "general";
  tag?: "feature" | "improvement" | "announcement" | "infrastructure" | "bugfix";
}

const patchBadge: Record<string, string> = {
  classic: "bg-yellow-700/80 text-yellow-200",
  tbc: "bg-green-800/80 text-green-200",
  wotlk: "bg-blue-800/80 text-blue-200",
  general: "bg-orange-900/80 text-orange-200",
};

const tagBadge: Record<string, string> = {
  feature: "bg-emerald-900/60 text-emerald-300",
  improvement: "bg-sky-900/60 text-sky-300",
  announcement: "bg-purple-900/60 text-purple-300",
  infrastructure: "bg-slate-700/60 text-slate-300",
  bugfix: "bg-red-900/60 text-red-300",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function NewsFeed() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/news")
      .then((r) => r.json())
      .then(setNews)
      .catch(() => setNews([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="py-16 px-4 border-t border-[#1a1a20]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-extrabold text-center tracking-wider uppercase bg-gradient-to-b from-yellow-300 to-orange-500 bg-clip-text text-transparent mb-10">
            Latest News
          </h2>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#141418] border border-[#2a2a32] rounded-xl p-6 animate-pulse">
                <div className="h-4 bg-[#2a2a32] rounded w-3/4 mb-3" />
                <div className="h-3 bg-[#2a2a32] rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (news.length === 0) {
    return null;
  }

  return (
    <section className="py-16 px-4 border-t border-[#1a1a20]">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-extrabold text-center tracking-wider uppercase bg-gradient-to-b from-yellow-300 to-orange-500 bg-clip-text text-transparent mb-10">
          Latest News
        </h2>

        <div className="space-y-4">
          {news.map((item) => (
            <article
              key={`${item.patch}-${item.id}`}
              className="bg-[#141418] border border-[#2a2a32] rounded-xl p-6 hover:border-[#3a3a42] transition-colors"
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <h3 className="text-lg font-bold text-[#e8e6e3]">{item.title}</h3>
                <div className="flex gap-2 shrink-0">
                  {item.tag && (
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded ${tagBadge[item.tag] || ""}`}>
                      {item.tag}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded ${patchBadge[item.patch]}`}>
                    {item.patch === "classic" ? "Classic" : item.patch === "tbc" ? "TBC" : item.patch === "wotlk" ? "WotLK" : "All Servers"}
                  </span>
                </div>
              </div>
              {item.preview && (
                <p className="text-sm text-[#9a9a9a] mb-3 leading-relaxed">{item.preview}...</p>
              )}
              <div className="flex items-center gap-4 text-xs text-[#666]">
                <span>{formatDate(item.date)}</span>
                <span>{item.author}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
