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

// Map image configs with WorldMapArea DBC coordinate bounds
interface MapConfig {
  name: string;
  image: string;
  // WorldMapArea DBC bounds for coordinate conversion:
  // pixel_x% = (locLeft - game_y) / (locLeft - locRight) * 100
  // pixel_y% = (locTop - game_x) / (locTop - locBottom) * 100
  locLeft: number;
  locRight: number;
  locTop: number;
  locBottom: number;
  maps: number[]; // which WoW map IDs belong here
}

const MAP_CONFIGS: MapConfig[] = [
  {
    name: "Eastern Kingdoms",
    image: "/map-images/eastern_kingdoms.jpg",
    locLeft: 18172.0, locRight: -22569.2, locTop: 11176.3, locBottom: -15973.3,
    maps: [0],
  },
  {
    name: "Kalimdor",
    image: "/map-images/kalimdor.jpg",
    locLeft: 17066.6, locRight: -19733.2, locTop: 12799.9, locBottom: -11733.3,
    maps: [1],
  },
  {
    name: "Outland",
    image: "/map-images/outland.jpg",
    locLeft: 12996.0, locRight: -4468.0, locTop: 5821.4, locBottom: -5821.4,
    maps: [530],
  },
  {
    name: "Northrend",
    image: "/map-images/northrend.jpg",
    locLeft: 9217.2, locRight: -8534.2, locTop: 10593.4, locBottom: -1240.9,
    maps: [571],
  },
];

interface Player {
  guid: number;
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

function gameToPixel(gameX: number, gameY: number, _mapId: number, config: MapConfig): { px: number; py: number } | null {
  // WorldMapArea DBC coordinate conversion
  const px = ((config.locLeft - gameY) / (config.locLeft - config.locRight)) * 100;
  const py = ((config.locTop - gameX) / (config.locTop - config.locBottom)) * 100;
  return { px, py };
}

export default function MapPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatch, setSelectedPatch] = useState<string>("all");
  const [selectedMapIdx, setSelectedMapIdx] = useState(0);
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

  const mapConfig = MAP_CONFIGS[selectedMapIdx];
  const filteredPlayers = players.filter((p) => mapConfig.maps.includes(p.map));

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
                <button key={p} onClick={() => setSelectedPatch(p)}
                  className={`px-3 py-1.5 text-xs rounded-md font-semibold transition-all ${
                    selectedPatch === p ? "bg-[#ff6b00]/20 border border-[#ff6b00] text-[#ffa500]" : "text-[#666] hover:text-[#9a9a9a]"
                  }`}
                >
                  {PATCH_CONFIG[p].label}
                </button>
              ))}
            </div>

            <div className="flex gap-1 bg-[#141418] border border-[#2a2a32] rounded-lg p-1">
              {MAP_CONFIGS.map((cfg, idx) => (
                <button key={cfg.name} onClick={() => setSelectedMapIdx(idx)}
                  className={`px-3 py-1.5 text-xs rounded-md font-semibold transition-all ${
                    selectedMapIdx === idx ? "bg-[#333] text-white" : "text-[#666] hover:text-[#9a9a9a]"
                  }`}
                >
                  {cfg.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            {/* Map */}
            <div className="lg:col-span-3">
              <div
                className="relative rounded-xl overflow-hidden bg-[#0a0a0c]"
                style={{
                  backgroundImage: `url(${mapConfig.image})`,
                  backgroundSize: "100% 100%",
                  backgroundPosition: "center",
                  aspectRatio: "1002/668",
                }}
              >

                {/* Player count overlay */}
                <div className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-black/70 text-[#ffa500] text-sm font-bold backdrop-blur-sm">
                  {filteredPlayers.length} player{filteredPlayers.length !== 1 ? "s" : ""}
                </div>

                {/* Player dots */}
                {filteredPlayers.map((p, i) => {
                  const pos = gameToPixel(p.x, p.y, p.map, mapConfig);
                  if (!pos || pos.px < 0 || pos.px > 100 || pos.py < 0 || pos.py > 100) return null;
                  const faction = FACTION_BY_RACE[p.race];
                  const isHovered = hoveredPlayer === p;
                  return (
                    <div
                      key={`${p.patch}-${p.name}-${i}`}
                      className="absolute transition-all duration-200"
                      style={{
                        left: `${pos.px}%`,
                        top: `${pos.py}%`,
                        transform: "translate(-50%, -50%)",
                        zIndex: isHovered ? 50 : 10,
                      }}
                      onMouseEnter={() => setHoveredPlayer(p)}
                      onMouseLeave={() => setHoveredPlayer(null)}
                    >
                      <a
                        href={`/armory/character/${p.patch}/${p.guid}`}
                        className={`block rounded-full border-2 cursor-pointer transition-all ${isHovered ? "w-5 h-5" : "w-3 h-3"}`}
                        style={{
                          backgroundColor: CLASS_COLORS[p.classId] || "#ccc",
                          borderColor: faction === "alliance" ? "#3b82f6" : "#ef4444",
                          boxShadow: `0 0 ${isHovered ? "12" : "6"}px ${CLASS_COLORS[p.classId] || "#ccc"}80`,
                        }}
                        title={`${p.name} — Level ${p.level} ${CLASS_NAMES[p.classId]} — ${p.zoneName}`}
                      />
                      {isHovered && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[#141418] border border-[#2a2a32] rounded-lg px-3 py-2 whitespace-nowrap shadow-xl z-50 pointer-events-none">
                          <div className="font-bold text-sm" style={{ color: CLASS_COLORS[p.classId] }}>{p.name}</div>
                          <div className="text-xs text-[#9a9a9a]">Level {p.level} {CLASS_NAMES[p.classId]}</div>
                          <div className="text-xs text-[#666]">{p.zoneName}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${PATCH_CONFIG[p.patch]?.badge || ""}`}>
                              {PATCH_CONFIG[p.patch]?.label}
                            </span>
                            <span className="text-[10px] text-[#ffa500]">Click to view armory</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Empty state overlay */}
                {!loading && filteredPlayers.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="text-center px-4 py-3 rounded-lg bg-black/60 backdrop-blur-sm">
                      <p className="text-[#9a9a9a] text-sm">No players online on {mapConfig.name}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <div className="bg-[#141418] border border-[#2a2a32] rounded-xl p-4">
                <h3 className="text-sm font-bold text-[#e8e6e3] mb-3 uppercase tracking-wider">Players by Zone</h3>
                {Object.keys(zoneGroups).length === 0 ? (
                  <p className="text-[#666] text-sm">No players online</p>
                ) : (
                  <div className="space-y-3 max-h-60 overflow-y-auto">
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
                              <span key={i}
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

              <div className="bg-[#141418] border border-[#2a2a32] rounded-xl p-4">
                <h3 className="text-sm font-bold text-[#e8e6e3] mb-3 uppercase tracking-wider">Total Online</h3>
                <div className="space-y-2 text-sm">
                  {(["classic", "tbc", "wotlk"] as const).map((p) => (
                    <div key={p} className="flex justify-between">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${PATCH_CONFIG[p].badge}`}>{PATCH_CONFIG[p].label}</span>
                      <span className="text-[#e8e6e3] font-bold">{players.filter((pl) => pl.patch === p).length}</span>
                    </div>
                  ))}
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
