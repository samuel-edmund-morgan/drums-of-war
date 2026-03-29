"use client";

import { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const CLASS_COLORS: Record<number, string> = {
  1: "#C79C6E", 2: "#F58CBA", 3: "#ABD473", 4: "#FFF569",
  5: "#FFFFFF", 6: "#C41F3B", 7: "#0070DE", 8: "#40C7EB",
  9: "#8787ED", 11: "#FF7D0A",
};

const CLASS_NAMES: Record<number, string> = {
  1: "Warrior", 2: "Paladin", 3: "Hunter", 4: "Rogue",
  5: "Priest", 6: "Death Knight", 7: "Shaman", 8: "Mage",
  9: "Warlock", 11: "Druid",
};

const FACTION_BY_RACE: Record<number, "alliance" | "horde"> = {
  1: "alliance", 2: "horde", 3: "alliance", 4: "alliance",
  5: "horde", 6: "horde", 7: "alliance", 8: "horde",
  10: "horde", 11: "alliance",
};

const PATCH_CONFIG: Record<string, { label: string; badge: string }> = {
  classic: { label: "Classic", badge: "bg-yellow-700/80 text-yellow-200" },
  tbc: { label: "TBC", badge: "bg-green-800/80 text-green-200" },
  wotlk: { label: "WotLK", badge: "bg-blue-800/80 text-blue-200" },
};

// Map configs for coordinate → pixel conversion
// From WorldMapArea DBC (AreaID=0, continent-wide bounds)
const MAP_BOUNDS: Record<number, { name: string; locLeft: number; locRight: number; locTop: number; locBottom: number }> = {
  0: { name: "Eastern Kingdoms", locLeft: 16000, locRight: -19199.9, locTop: 7466.6, locBottom: -16000 },
  1: { name: "Kalimdor", locLeft: 17066.6, locRight: -19733.21, locTop: 12799.9, locBottom: -11733.3 },
  530: { name: "Outland", locLeft: 11000, locRight: -6000, locTop: 9000, locBottom: -5000 },
  571: { name: "Northrend", locLeft: 12000, locRight: -6000, locTop: 10000, locBottom: -4000 },
};

interface Player {
  name: string;
  race: number;
  classId: number;
  level: number;
  map: number;
  mapName: string;
  zone: number;
  zoneName: string;
  x: number;
  y: number;
  patch: string;
}

function gameToPercent(gameX: number, gameY: number, mapId: number): { px: number; py: number } | null {
  const bounds = MAP_BOUNDS[mapId];
  if (!bounds) return null;
  const px = ((bounds.locLeft - gameY) / (bounds.locLeft - bounds.locRight)) * 100;
  const py = ((bounds.locTop - gameX) / (bounds.locTop - bounds.locBottom)) * 100;
  return { px: Math.max(0, Math.min(100, px)), py: Math.max(0, Math.min(100, py)) };
}

export default function MapPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatch, setSelectedPatch] = useState<string>("all");
  const [selectedMap, setSelectedMap] = useState<number>(0);
  const [hoveredPlayer, setHoveredPlayer] = useState<Player | null>(null);

  const fetchPlayers = useCallback(async () => {
    try {
      const endpoint = selectedPatch === "all" ? "/api/map/all" : `/api/map/${selectedPatch}`;
      const res = await fetch(endpoint);
      if (!res.ok) return;
      const data = await res.json();
      setPlayers(data.players || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [selectedPatch]);

  useEffect(() => {
    fetchPlayers();
    const interval = setInterval(fetchPlayers, 15000);
    return () => clearInterval(interval);
  }, [fetchPlayers]);

  const filteredPlayers = players.filter((p) => p.map === selectedMap);
  const mapConfig = MAP_BOUNDS[selectedMap];
  const availableMaps = [...new Set(players.map((p) => p.map))].filter((m) => MAP_BOUNDS[m]);

  // Zone breakdown
  const zoneGroups: Record<string, Player[]> = {};
  for (const p of filteredPlayers) {
    const key = p.zoneName;
    if (!zoneGroups[key]) zoneGroups[key] = [];
    zoneGroups[key].push(p);
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0a0a0c] pt-24 pb-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-wider uppercase bg-gradient-to-b from-yellow-300 to-orange-500 bg-clip-text text-transparent mb-2">
            Player Map
          </h1>
          <p className="text-[#9a9a9a] text-sm mb-6">
            Live player positions across all servers
            <span className="ml-2 inline-flex items-center gap-1.5 text-xs text-[#666]">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Auto-refreshing every 15s
            </span>
          </p>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            {/* Server filter */}
            <div className="flex gap-1 bg-[#141418] border border-[#2a2a32] rounded-lg p-1">
              <button
                onClick={() => setSelectedPatch("all")}
                className={`px-3 py-1.5 text-xs rounded-md font-semibold transition-all ${
                  selectedPatch === "all" ? "bg-[#ff6b00]/20 border border-[#ff6b00] text-[#ffa500]" : "text-[#666] hover:text-[#9a9a9a]"
                }`}
              >
                All Servers
              </button>
              {(["classic", "tbc", "wotlk"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedPatch(p)}
                  className={`px-3 py-1.5 text-xs rounded-md font-semibold transition-all ${
                    selectedPatch === p ? "bg-[#ff6b00]/20 border border-[#ff6b00] text-[#ffa500]" : "text-[#666] hover:text-[#9a9a9a]"
                  }`}
                >
                  {PATCH_CONFIG[p].label}
                </button>
              ))}
            </div>

            {/* Map filter */}
            <div className="flex gap-1 bg-[#141418] border border-[#2a2a32] rounded-lg p-1">
              {Object.entries(MAP_BOUNDS).map(([id, cfg]) => (
                <button
                  key={id}
                  onClick={() => setSelectedMap(Number(id))}
                  className={`px-3 py-1.5 text-xs rounded-md font-semibold transition-all ${
                    selectedMap === Number(id) ? "bg-[#333] text-white" : "text-[#666] hover:text-[#9a9a9a]"
                  }`}
                >
                  {cfg.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Map canvas */}
            <div className="lg:col-span-2">
              <div
                className="relative bg-[#0e0e12] border border-[#2a2a32] rounded-xl overflow-hidden"
                style={{ aspectRatio: "4/3" }}
              >
                {/* Grid overlay */}
                <div className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage: "linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)",
                    backgroundSize: "10% 10%",
                  }}
                />

                {/* Map name */}
                <div className="absolute top-4 left-4 text-[#666] text-xs font-semibold uppercase tracking-wider">
                  {mapConfig?.name || "Unknown"}
                </div>

                {/* Player count */}
                <div className="absolute top-4 right-4 text-[#ffa500] text-sm font-bold">
                  {filteredPlayers.length} player{filteredPlayers.length !== 1 ? "s" : ""}
                </div>

                {/* Player dots */}
                {filteredPlayers.map((p, i) => {
                  const pos = gameToPercent(p.x, p.y, p.map);
                  if (!pos) return null;
                  const faction = FACTION_BY_RACE[p.race];
                  const isHovered = hoveredPlayer === p;
                  return (
                    <div
                      key={`${p.patch}-${p.name}-${i}`}
                      className="absolute transition-all duration-300"
                      style={{
                        left: `${pos.px}%`,
                        top: `${pos.py}%`,
                        transform: "translate(-50%, -50%)",
                        zIndex: isHovered ? 50 : 10,
                      }}
                      onMouseEnter={() => setHoveredPlayer(p)}
                      onMouseLeave={() => setHoveredPlayer(null)}
                    >
                      {/* Dot */}
                      <div
                        className={`rounded-full border-2 cursor-pointer transition-all ${
                          isHovered ? "w-5 h-5" : "w-3 h-3"
                        }`}
                        style={{
                          backgroundColor: CLASS_COLORS[p.classId] || "#ccc",
                          borderColor: faction === "alliance" ? "#3b82f6" : "#ef4444",
                          boxShadow: `0 0 ${isHovered ? "12" : "6"}px ${CLASS_COLORS[p.classId] || "#ccc"}80`,
                        }}
                      />

                      {/* Tooltip */}
                      {isHovered && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[#141418] border border-[#2a2a32] rounded-lg px-3 py-2 whitespace-nowrap shadow-xl z-50">
                          <div className="font-bold text-sm" style={{ color: CLASS_COLORS[p.classId] }}>
                            {p.name}
                          </div>
                          <div className="text-xs text-[#9a9a9a]">
                            Level {p.level} {CLASS_NAMES[p.classId]}
                          </div>
                          <div className="text-xs text-[#666]">{p.zoneName}</div>
                          <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${PATCH_CONFIG[p.patch]?.badge || ""}`}>
                            {PATCH_CONFIG[p.patch]?.label}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Empty state */}
                {!loading && filteredPlayers.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-[#666] text-lg mb-1">No players online</p>
                      <p className="text-[#444] text-sm">on {mapConfig?.name}</p>
                    </div>
                  </div>
                )}

                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-[#666]">Loading...</div>
                  </div>
                )}
              </div>
            </div>

            {/* Zone breakdown sidebar */}
            <div className="space-y-4">
              <div className="bg-[#141418] border border-[#2a2a32] rounded-xl p-4">
                <h3 className="text-sm font-bold text-[#e8e6e3] mb-3 uppercase tracking-wider">
                  Players by Zone
                </h3>
                {Object.keys(zoneGroups).length === 0 ? (
                  <p className="text-[#666] text-sm">No players online</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(zoneGroups)
                      .sort((a, b) => b[1].length - a[1].length)
                      .map(([zone, zonePlayers]) => (
                        <div key={zone}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm text-[#e8e6e3]">{zone}</span>
                            <span className="text-xs text-[#666]">{zonePlayers.length}</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {zonePlayers.map((p, i) => (
                              <span
                                key={i}
                                className="text-xs px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                                style={{
                                  backgroundColor: `${CLASS_COLORS[p.classId]}20`,
                                  color: CLASS_COLORS[p.classId],
                                  border: `1px solid ${CLASS_COLORS[p.classId]}40`,
                                }}
                                onMouseEnter={() => setHoveredPlayer(p)}
                                onMouseLeave={() => setHoveredPlayer(null)}
                              >
                                {p.name} {p.level}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Total counts */}
              <div className="bg-[#141418] border border-[#2a2a32] rounded-xl p-4">
                <h3 className="text-sm font-bold text-[#e8e6e3] mb-3 uppercase tracking-wider">
                  Total Online
                </h3>
                <div className="space-y-2 text-sm">
                  {(["classic", "tbc", "wotlk"] as const).map((p) => {
                    const count = players.filter((pl) => pl.patch === p).length;
                    return (
                      <div key={p} className="flex justify-between">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${PATCH_CONFIG[p].badge}`}>
                          {PATCH_CONFIG[p].label}
                        </span>
                        <span className="text-[#e8e6e3] font-bold">{count}</span>
                      </div>
                    );
                  })}
                  <div className="flex justify-between pt-2 border-t border-[#2a2a32]">
                    <span className="text-[#9a9a9a] font-semibold">Total</span>
                    <span className="text-[#ffa500] font-bold">{players.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
