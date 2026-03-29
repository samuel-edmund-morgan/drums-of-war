"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { getRaceIconUrl, getClassIconUrl } from "@/lib/wow-icons";

interface CharResult {
  guid: number;
  name: string;
  race: string;
  className: string;
  raceId: number;
  classId: number;
  gender: number;
  level: number;
  faction: string;
  totalKills: number;
  guild: string | null;
  patch: string;
  patchLabel: string;
}

const CLASS_COLORS: Record<number, string> = {
  1: "#C79C6E", 2: "#F58CBA", 3: "#ABD473", 4: "#FFF569",
  5: "#FFFFFF", 6: "#C41F3B", 7: "#0070DE", 8: "#69CCF0",
  9: "#9482C9", 11: "#FF7D0A",
};

const PATCH_BADGE: Record<string, string> = {
  classic: "bg-yellow-700/80 text-yellow-200",
  tbc: "bg-green-800/80 text-green-200",
  wotlk: "bg-blue-800/80 text-blue-200",
};

export default function ArmoryPage() {
  const [query, setQuery] = useState("");
  const [patch, setPatch] = useState<string>("all");
  const [results, setResults] = useState<CharResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async () => {
    if (query.trim().length < 2) return;
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({ q: query.trim() });
      if (patch !== "all") params.set("patch", patch);
      const res = await fetch(`/api/armory/search?${params}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, patch]);

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-[#e8e6e3]">
      <Navbar />
      <main className="pt-24 pb-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-extrabold text-center tracking-wider uppercase bg-gradient-to-b from-yellow-300 to-orange-500 bg-clip-text text-transparent mb-2">
            Armory
          </h1>
          <p className="text-center text-[#9a9a9a] mb-8">
            Search characters across all expansions
          </p>

          {/* Search bar */}
          <div className="flex gap-2 mb-8">
            <select
              value={patch}
              onChange={(e) => setPatch(e.target.value)}
              className="bg-[#1a1a20] border border-[#2a2a32] rounded-lg px-3 py-3 text-sm focus:outline-none focus:border-orange-500"
            >
              <option value="all">All Realms</option>
              <option value="classic">Classic</option>
              <option value="tbc">TBC</option>
              <option value="wotlk">WotLK</option>
            </select>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Search character name..."
              className="flex-1 bg-[#1a1a20] border border-[#2a2a32] rounded-lg px-4 py-3 text-sm placeholder-[#666] focus:outline-none focus:border-orange-500"
              autoFocus
            />
            <button
              onClick={search}
              disabled={loading || query.trim().length < 2}
              className="bg-orange-600 hover:bg-orange-500 disabled:bg-[#333] disabled:text-[#666] px-6 py-3 rounded-lg font-semibold text-sm transition-colors"
            >
              {loading ? "..." : "Search"}
            </button>
          </div>

          {/* Results */}
          {loading && (
            <div className="text-center text-[#666] py-8">Searching...</div>
          )}

          {!loading && searched && results.length === 0 && (
            <div className="text-center text-[#666] py-8">No characters found</div>
          )}

          {!loading && results.length > 0 && (
            <div className="border border-[#2a2a32] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#141418] text-[#9a9a9a] text-left text-xs uppercase">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Level</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Race / Class</th>
                    <th className="px-4 py-3 hidden md:table-cell">Guild</th>
                    <th className="px-4 py-3 hidden md:table-cell">HKs</th>
                    <th className="px-4 py-3">Realm</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((char) => (
                    <tr
                      key={`${char.patch}-${char.guid}`}
                      className="border-t border-[#1a1a20] hover:bg-[#141418] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/armory/character/${char.patch}/${char.guid}`}
                          className="flex items-center gap-2 group"
                        >
                          <img
                            src={getRaceIconUrl(char.raceId, char.gender, "small")}
                            alt={char.race}
                            className="w-6 h-6 rounded border border-[#2a2a32]"
                          />
                          <img
                            src={getClassIconUrl(char.classId, "small")}
                            alt={char.className}
                            className="w-5 h-5 rounded"
                          />
                          <span
                            className="font-bold group-hover:text-orange-400 transition-colors"
                            style={{ color: CLASS_COLORS[char.classId] || "#e8e6e3" }}
                          >
                            {char.name}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[#ccc]">{char.level}</td>
                      <td className="px-4 py-3 text-[#9a9a9a] hidden sm:table-cell">
                        {char.race} {char.className}
                      </td>
                      <td className="px-4 py-3 text-[#9a9a9a] hidden md:table-cell">
                        {char.guild || "—"}
                      </td>
                      <td className="px-4 py-3 text-[#9a9a9a] hidden md:table-cell">
                        {char.totalKills}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded ${PATCH_BADGE[char.patch] || ""}`}>
                          {char.patch === "classic" ? "Classic" : char.patch === "tbc" ? "TBC" : "WotLK"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
