"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  RACE_NAMES, CLASS_NAMES, CLASS_COLORS,
  ALLIANCE_RACES, HORDE_RACES,
  PVP_RANKS_ALLIANCE, PVP_RANKS_HORDE,
  PATCH_INFO, VALID_PATCHES, type PatchId,
} from "@/lib/wow-constants";
import { getRaceIconUrl, getClassIconUrl } from "@/lib/wow-icons";

interface HonorPlayer {
  guid:        number;
  name:        string;
  race:        number;
  class:       number;
  level:       number;
  gender:      number;
  totalKills:  number;
  honorPoints: number;
  pvpRank:     number | null;
}

type Faction = "Alliance" | "Horde";

export default function HonorPage() {
  const { patch } = useParams<{ patch: string }>();
  const [players, setPlayers] = useState<HonorPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [faction, setFaction] = useState<Faction>("Alliance");

  useEffect(() => {
    if (!VALID_PATCHES.includes(patch as PatchId)) {
      setError("Invalid patch");
      setLoading(false);
      return;
    }
    fetch(`/api/honor/${patch}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setPlayers(d.players ?? []); })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [patch]);

  const info = PATCH_INFO[patch as PatchId];
  const patchColor = info?.color ?? "#ffa500";
  const isClassic = patch === "classic";

  const filtered = players.filter((p) => {
    if (faction === "Alliance") return ALLIANCE_RACES.has(p.race);
    return HORDE_RACES.has(p.race);
  });

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-[#e8e6e3]">
      <Navbar />
      <main className="pt-24 pb-16 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <Link href="/honor" className="text-sm text-[#666] hover:text-[#999] transition-colors">
              ← All Realms
            </Link>
            <h1 className="text-3xl font-extrabold tracking-wider uppercase mt-2" style={{ color: patchColor }}>
              {info?.label ?? patch} — Honor Leaderboard
            </h1>
            <p className="text-[#666] text-sm mt-1">{info?.desc}</p>
          </div>

          {/* Faction tabs */}
          <div className="flex gap-2 mb-6">
            {(["Alliance", "Horde"] as Faction[]).map((f) => (
              <button
                key={f}
                onClick={() => setFaction(f)}
                className="px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
                style={
                  faction === f
                    ? {
                        background: f === "Alliance" ? "#0070dd22" : "#cc220022",
                        color:      f === "Alliance" ? "#0070dd"   : "#cc2200",
                        border:     `1px solid ${f === "Alliance" ? "#0070dd" : "#cc2200"}`,
                      }
                    : { background: "#141418", color: "#666", border: "1px solid #2a2a32" }
                }
              >
                {f}
              </button>
            ))}
          </div>

          {loading && <div className="text-center text-[#666] py-16">Loading...</div>}
          {error   && <div className="text-center text-red-400 py-16">{error}</div>}

          {!loading && !error && filtered.length === 0 && (
            <div className="text-center text-[#666] py-16">
              No {faction} players with honor on this realm.
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="border border-[#2a2a32] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#141418] text-[#9a9a9a] text-left text-xs uppercase">
                    <th className="px-4 py-3 w-10">#</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Race / Class</th>
                    <th className="px-4 py-3">Lvl</th>
                    {isClassic && <th className="px-4 py-3 hidden md:table-cell">PvP Rank</th>}
                    <th className="px-4 py-3 text-right">Honor</th>
                    <th className="px-4 py-3 text-right hidden sm:table-cell">Kills</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => {
                    const classColor = CLASS_COLORS[p.class] ?? "#e8e6e3";
                    const rankNames  = HORDE_RACES.has(p.race) ? PVP_RANKS_HORDE : PVP_RANKS_ALLIANCE;
                    const rankName   = p.pvpRank ? (rankNames[p.pvpRank] ?? `Rank ${p.pvpRank}`) : null;
                    return (
                      <tr
                        key={p.guid}
                        className="border-t border-[#1a1a20] hover:bg-[#141418] transition-colors"
                      >
                        <td className="px-4 py-3 text-[#555] font-mono text-xs">{i + 1}</td>
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
                        <td className="px-4 py-3 text-[#9a9a9a] hidden sm:table-cell text-xs">
                          {RACE_NAMES[p.race] ?? p.race} {CLASS_NAMES[p.class] ?? p.class}
                        </td>
                        <td className="px-4 py-3 text-[#ccc]">{p.level}</td>
                        {isClassic && (
                          <td className="px-4 py-3 text-[#9a9a9a] text-xs hidden md:table-cell">
                            {rankName ?? "—"}
                          </td>
                        )}
                        <td className="px-4 py-3 text-right font-mono text-[#ffd100]">
                          {p.honorPoints.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-[#9a9a9a] hidden sm:table-cell">
                          {p.totalKills.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
