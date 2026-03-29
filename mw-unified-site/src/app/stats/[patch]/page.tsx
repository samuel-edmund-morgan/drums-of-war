"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  RACE_NAMES, CLASS_NAMES, CLASS_COLORS,
  ALLIANCE_RACES, HORDE_RACES,
  PATCH_INFO, VALID_PATCHES, type PatchId,
} from "@/lib/wow-constants";

const QUALITY_COLORS = ["#9d9d9d", "#ffffff", "#1eff00", "#0070dd", "#a335ee", "#ff8000"];

interface StatsData {
  raceCounts:    { race: number; count: number }[];
  classCounts:   { class: number; count: number }[];
  levelBuckets:  { bucket: string; count: number }[];
  totalAccounts: number;
  totalChars:    number;
  patch:         string;
  maxLevel:      number;
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex-1 h-2 bg-[#1a1a20] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

export default function StatsPage() {
  const { patch } = useParams<{ patch: string }>();
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!VALID_PATCHES.includes(patch as PatchId)) {
      setError("Invalid patch");
      setLoading(false);
      return;
    }
    fetch(`/api/stats/${patch}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setData(d); })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [patch]);

  const info = PATCH_INFO[patch as PatchId];
  const patchColor = info?.color ?? "#ffa500";

  const allianceCount = data?.raceCounts
    .filter((r) => ALLIANCE_RACES.has(r.race))
    .reduce((s, r) => s + r.count, 0) ?? 0;
  const hordeCount = data?.raceCounts
    .filter((r) => HORDE_RACES.has(r.race))
    .reduce((s, r) => s + r.count, 0) ?? 0;
  const factionTotal = allianceCount + hordeCount || 1;

  const maxRace  = Math.max(1, ...(data?.raceCounts.map((r) => r.count) ?? [1]));
  const maxClass = Math.max(1, ...(data?.classCounts.map((r) => r.count) ?? [1]));
  const maxLevel = Math.max(1, ...(data?.levelBuckets.map((r) => r.count) ?? [1]));

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-[#e8e6e3]">
      <Navbar />
      <main className="pt-24 pb-16 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Link href="/stats" className="text-sm text-[#666] hover:text-[#999] transition-colors">
              ← All Realms
            </Link>
            <h1 className="text-3xl font-extrabold tracking-wider uppercase mt-2" style={{ color: patchColor }}>
              {info?.label ?? patch} — Statistics
            </h1>
            <p className="text-[#666] text-sm mt-1">{info?.desc}</p>
          </div>

          {loading && <div className="text-center text-[#666] py-16">Loading...</div>}
          {error   && <div className="text-center text-red-400 py-16">{error}</div>}

          {data && (
            <div className="space-y-8">
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Total Accounts",    value: data.totalAccounts.toLocaleString() },
                  { label: "Total Characters",  value: data.totalChars.toLocaleString() },
                  { label: "Alliance",          value: `${Math.round((allianceCount / factionTotal) * 100)}%`, sub: allianceCount.toLocaleString(), color: "#0070dd" },
                  { label: "Horde",             value: `${Math.round((hordeCount / factionTotal) * 100)}%`,    sub: hordeCount.toLocaleString(),    color: "#cc2200" },
                ].map((card) => (
                  <div key={card.label} className="bg-[#141418] border border-[#2a2a32] rounded-xl p-4 text-center">
                    <div className="text-[#666] text-xs uppercase tracking-wider mb-1">{card.label}</div>
                    <div className="text-2xl font-bold" style={{ color: card.color ?? patchColor }}>
                      {card.value}
                    </div>
                    {card.sub && <div className="text-xs text-[#666] mt-0.5">{card.sub} chars</div>}
                  </div>
                ))}
              </div>

              {/* Race distribution */}
              <div className="bg-[#141418] border border-[#2a2a32] rounded-xl p-6">
                <h2 className="text-lg font-bold mb-4" style={{ color: patchColor }}>Race Distribution</h2>
                <div className="space-y-3">
                  {data.raceCounts
                    .slice()
                    .sort((a, b) => b.count - a.count)
                    .map((r) => {
                      const name = RACE_NAMES[r.race] ?? `Race ${r.race}`;
                      const faction = ALLIANCE_RACES.has(r.race) ? "Alliance" : HORDE_RACES.has(r.race) ? "Horde" : "";
                      const barColor = ALLIANCE_RACES.has(r.race) ? "#0070dd" : HORDE_RACES.has(r.race) ? "#cc2200" : "#888";
                      return (
                        <div key={r.race} className="flex items-center gap-3">
                          <div className="w-32 text-sm text-[#ccc] truncate">{name}</div>
                          <Bar value={r.count} max={maxRace} color={barColor} />
                          <div className="w-16 text-right text-sm text-[#9a9a9a]">{r.count.toLocaleString()}</div>
                          {faction && (
                            <div className="w-16 text-xs" style={{ color: barColor }}>{faction}</div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Class distribution */}
              <div className="bg-[#141418] border border-[#2a2a32] rounded-xl p-6">
                <h2 className="text-lg font-bold mb-4" style={{ color: patchColor }}>Class Distribution</h2>
                <div className="space-y-3">
                  {data.classCounts
                    .slice()
                    .sort((a, b) => b.count - a.count)
                    .map((r) => {
                      const name = CLASS_NAMES[r.class] ?? `Class ${r.class}`;
                      const color = CLASS_COLORS[r.class] ?? "#888";
                      return (
                        <div key={r.class} className="flex items-center gap-3">
                          <div className="w-32 text-sm truncate" style={{ color }}>{name}</div>
                          <Bar value={r.count} max={maxClass} color={color} />
                          <div className="w-16 text-right text-sm text-[#9a9a9a]">{r.count.toLocaleString()}</div>
                          <div className="w-12 text-right text-xs text-[#666]">
                            {data.totalChars > 0 ? `${Math.round((r.count / data.totalChars) * 100)}%` : "0%"}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Level distribution */}
              <div className="bg-[#141418] border border-[#2a2a32] rounded-xl p-6">
                <h2 className="text-lg font-bold mb-4" style={{ color: patchColor }}>Level Distribution</h2>
                <div className="space-y-3">
                  {data.levelBuckets.map((r) => (
                    <div key={r.bucket} className="flex items-center gap-3">
                      <div className="w-16 text-sm text-[#9a9a9a] font-mono">{r.bucket}</div>
                      <Bar value={r.count} max={maxLevel} color={patchColor} />
                      <div className="w-16 text-right text-sm text-[#9a9a9a]">{r.count.toLocaleString()}</div>
                      <div className="w-12 text-right text-xs text-[#666]">
                        {data.totalChars > 0 ? `${Math.round((r.count / data.totalChars) * 100)}%` : "0%"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
