"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  RACE_NAMES, CLASS_NAMES, CLASS_COLORS,
  ALLIANCE_RACES, HORDE_RACES,
  ZONE_NAMES, PATCH_INFO, VALID_PATCHES, type PatchId,
} from "@/lib/wow-constants";
import { getRaceIconUrl, getClassIconUrl } from "@/lib/wow-icons";

interface Player {
  guid:   number;
  name:   string;
  race:   number;
  class:  number;
  level:  number;
  gender: number;
  zone:   number;
}

interface PageData {
  players:  Player[];
  total:    number;
  page:     number;
  pageSize: number;
}

export default function OnlinePage() {
  const { patch } = useParams<{ patch: string }>();
  const [data, setData]   = useState<PageData | null>(null);
  const [page, setPage]   = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback((p: number) => {
    if (!VALID_PATCHES.includes(patch as PatchId)) {
      setError("Invalid patch");
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/online/${patch}?page=${p}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setData(d); })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [patch]);

  useEffect(() => { load(page); }, [page, load]);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(() => load(page), 30_000);
    return () => clearInterval(id);
  }, [page, load]);

  const info = PATCH_INFO[patch as PatchId];
  const patchColor = info?.color ?? "#ffa500";
  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-[#e8e6e3]">
      <Navbar />
      <main className="pt-24 pb-16 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <Link href="/online" className="text-sm text-[#666] hover:text-[#999] transition-colors">
              ← All Realms
            </Link>
            <div className="flex items-center justify-between mt-2">
              <div>
                <h1 className="text-3xl font-extrabold tracking-wider uppercase" style={{ color: patchColor }}>
                  {info?.label ?? patch} — Online
                </h1>
                <p className="text-[#666] text-sm mt-1">{info?.desc}</p>
              </div>
              {data && (
                <div className="text-right">
                  <div className="text-2xl font-bold" style={{ color: patchColor }}>
                    {data.total.toLocaleString()}
                  </div>
                  <div className="text-xs text-[#666]">players online</div>
                </div>
              )}
            </div>
          </div>

          {loading && <div className="text-center text-[#666] py-16">Loading...</div>}
          {error   && <div className="text-center text-red-400 py-16">{error}</div>}

          {data && data.players.length === 0 && !loading && (
            <div className="text-center text-[#666] py-16">No players online right now.</div>
          )}

          {data && data.players.length > 0 && (
            <>
              <div className="border border-[#2a2a32] rounded-xl overflow-hidden mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#141418] text-[#9a9a9a] text-left text-xs uppercase">
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3 hidden sm:table-cell">Race / Class</th>
                      <th className="px-4 py-3">Level</th>
                      <th className="px-4 py-3 hidden md:table-cell">Zone</th>
                      <th className="px-4 py-3">Faction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.players.map((p) => {
                      const faction = ALLIANCE_RACES.has(p.race) ? "Alliance" : HORDE_RACES.has(p.race) ? "Horde" : "";
                      const classColor = CLASS_COLORS[p.class] ?? "#e8e6e3";
                      return (
                        <tr
                          key={p.guid}
                          className="border-t border-[#1a1a20] hover:bg-[#141418] transition-colors"
                        >
                          <td className="px-4 py-3">
                            <Link
                              href={`/armory/character/${patch}/${p.guid}`}
                              className="flex items-center gap-2 group"
                            >
                              <img
                                src={getRaceIconUrl(p.race, p.gender, "small")}
                                alt={RACE_NAMES[p.race] ?? ""}
                                className="w-6 h-6 rounded border border-[#2a2a32]"
                              />
                              <img
                                src={getClassIconUrl(p.class, "small")}
                                alt={CLASS_NAMES[p.class] ?? ""}
                                className="w-5 h-5 rounded"
                              />
                              <span
                                className="font-bold group-hover:brightness-125 transition-all"
                                style={{ color: classColor }}
                              >
                                {p.name}
                              </span>
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-[#9a9a9a] hidden sm:table-cell">
                            {RACE_NAMES[p.race] ?? p.race} {CLASS_NAMES[p.class] ?? p.class}
                          </td>
                          <td className="px-4 py-3 text-[#ccc]">{p.level}</td>
                          <td className="px-4 py-3 text-[#9a9a9a] hidden md:table-cell text-xs">
                            {ZONE_NAMES[p.zone] ?? `Zone ${p.zone}`}
                          </td>
                          <td className="px-4 py-3">
                            {faction && (
                              <span
                                className="px-2 py-0.5 text-xs font-semibold rounded"
                                style={{
                                  background: faction === "Alliance" ? "#0070dd22" : "#cc220022",
                                  color:      faction === "Alliance" ? "#0070dd"   : "#cc2200",
                                  border:     `1px solid ${faction === "Alliance" ? "#0070dd44" : "#cc220044"}`,
                                }}
                              >
                                {faction}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => { setPage((p) => Math.max(1, p - 1)); }}
                    disabled={page <= 1}
                    className="px-4 py-2 text-sm rounded-lg bg-[#141418] border border-[#2a2a32] disabled:opacity-40 hover:bg-[#1a1a20] transition-colors"
                  >
                    ← Prev
                  </button>
                  <span className="text-sm text-[#9a9a9a]">
                    Page {page} of {totalPages} ({data.total.toLocaleString()} total)
                  </span>
                  <button
                    onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); }}
                    disabled={page >= totalPages}
                    className="px-4 py-2 text-sm rounded-lg bg-[#141418] border border-[#2a2a32] disabled:opacity-40 hover:bg-[#1a1a20] transition-colors"
                  >
                    Next →
                  </button>
                </div>
              )}
              <div className="text-center text-xs text-[#444] mt-3">Auto-refreshes every 30s</div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
