"use client";

import { useState, useEffect } from "react";
import ItemSlot from "./ItemSlot";
import { FACTIONS, getStanding } from "@/lib/wow-factions";

interface CharProfile {
  guid: number; name: string; race: string; className: string;
  raceId: number; classId: number; gender: number; level: number;
  health: number; mana: number; faction: string;
  totalKills: number; totalHonor: number;
  pvpRank: number | null; chosenTitle: number | null;
  guild: { name: string; rank: string } | null;
  equipment: Array<{ slot: number; slotName: string; itemEntry: number; enchantId?: number; randomPropertyId?: number }>;
  professions: Array<{ name: string; skillId: number; value: number; max: number }>;
  weaponSkills: Array<{ name: string; skillId: number; value: number; max: number }>;
  languages: Array<{ name: string; skillId: number; value: number; max: number }>;
  reputation: Array<{ factionId: number; standing: number }>;
  patch: string; patchLabel: string;
}

const TABS = ["Equipment", "Talents", "Skills", "Reputation", "PvP"] as const;
type Tab = (typeof TABS)[number];

export default function CharTabs({ char }: { char: CharProfile }) {
  const [activeTab, setActiveTab] = useState<Tab>("Equipment");

  return (
    <div>
      {/* Tab buttons */}
      <div className="flex gap-1 mb-4 border-b border-[#2a2a32]">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-[1px] ${
              activeTab === tab
                ? "border-orange-500 text-orange-400"
                : "border-transparent text-[#666] hover:text-[#999]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "Equipment" && <EquipmentTab char={char} />}
      {activeTab === "Talents" && <TalentsTab patch={char.patch} guid={char.guid} />}
      {activeTab === "Skills" && <SkillsTab char={char} />}
      {activeTab === "Reputation" && <ReputationTab char={char} />}
      {activeTab === "PvP" && <PvPTab char={char} />}
    </div>
  );
}

function EquipmentTab({ char }: { char: CharProfile }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-[#141418] border border-[#2a2a32] rounded-xl p-5">
        <h3 className="text-base font-bold text-orange-400 mb-3">Equipped Items</h3>
        {char.equipment.length === 0 ? (
          <p className="text-[#666]">No equipment</p>
        ) : (
          <div className="space-y-0.5">
            {char.equipment.map((item) => (
              <ItemSlot key={item.slot} patch={char.patch} itemEntry={item.itemEntry} slotName={item.slotName} enchantId={item.enchantId} randomPropertyId={item.randomPropertyId} />
            ))}
          </div>
        )}
      </div>
      <div className="bg-[#141418] border border-[#2a2a32] rounded-xl p-5">
        <h3 className="text-base font-bold text-orange-400 mb-3">Professions</h3>
        {char.professions.length === 0 ? (
          <p className="text-[#666]">No professions</p>
        ) : (
          <div className="space-y-3">
            {char.professions.map((p) => (
              <SkillBar key={p.skillId} name={p.name} value={p.value} max={p.max} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SkillsTab({ char }: { char: CharProfile }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-[#141418] border border-[#2a2a32] rounded-xl p-5">
        <h3 className="text-base font-bold text-orange-400 mb-3">Weapon Skills</h3>
        {char.weaponSkills.length === 0 ? (
          <p className="text-[#666]">No weapon skills</p>
        ) : (
          <div className="space-y-2">
            {char.weaponSkills.map((s) => (
              <SkillBar key={s.skillId} name={s.name} value={s.value} max={s.max} color="#4a90d9" />
            ))}
          </div>
        )}
      </div>
      <div className="bg-[#141418] border border-[#2a2a32] rounded-xl p-5">
        <h3 className="text-base font-bold text-orange-400 mb-3">Languages</h3>
        {char.languages.length === 0 ? (
          <p className="text-[#666]">No languages</p>
        ) : (
          <div className="space-y-2">
            {char.languages.map((l) => (
              <SkillBar key={l.skillId} name={l.name} value={l.value} max={l.max} color="#66bb6a" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReputationTab({ char }: { char: CharProfile }) {
  // Group by category
  const grouped: Record<string, Array<{ name: string; standing: number }>> = {};

  for (const rep of char.reputation) {
    const faction = FACTIONS[rep.factionId];
    if (!faction) continue;
    const cat = faction.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({ name: faction.name, standing: rep.standing });
  }

  // Sort categories
  const categoryOrder = ["Alliance", "Horde", "Classic", "Steamwheedle Cartel", "TBC", "WotLK"];
  const sortedCategories = Object.keys(grouped).sort(
    (a, b) => (categoryOrder.indexOf(a) === -1 ? 99 : categoryOrder.indexOf(a)) -
              (categoryOrder.indexOf(b) === -1 ? 99 : categoryOrder.indexOf(b))
  );

  if (char.reputation.length === 0) {
    return <p className="text-[#666] py-4">No reputation data</p>;
  }

  return (
    <div className="space-y-6">
      {sortedCategories.map((category) => (
        <div key={category} className="bg-[#141418] border border-[#2a2a32] rounded-xl p-5">
          <h3 className="text-base font-bold text-orange-400 mb-3">{category}</h3>
          <div className="space-y-2">
            {grouped[category]
              .sort((a, b) => b.standing - a.standing)
              .map((rep) => {
                const s = getStanding(rep.standing);
                return (
                  <div key={rep.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-[#e8e6e3]">{rep.name}</span>
                      <span style={{ color: s.color }}>{s.name} ({Math.min(rep.standing, 42999).toLocaleString()})</span>
                    </div>
                    <div className="h-1.5 bg-[#2a2a32] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${s.percent}%`, backgroundColor: s.color }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}

function PvPTab({ char }: { char: CharProfile }) {
  const PVP_RANKS: Record<number, string> = {
    1: "Private", 2: "Corporal", 3: "Sergeant", 4: "Master Sergeant",
    5: "Sergeant Major", 6: "Knight", 7: "Knight-Lieutenant", 8: "Knight-Captain",
    9: "Knight-Champion", 10: "Lieutenant Commander", 11: "Commander",
    12: "Marshal", 13: "Field Marshal", 14: "Grand Marshal",
    15: "Scout", 16: "Grunt", 17: "Sergeant", 18: "Grand Marshal",
  };

  return (
    <div className="bg-[#141418] border border-[#2a2a32] rounded-xl p-5">
      <h3 className="text-base font-bold text-orange-400 mb-4">PvP Statistics</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatBox label="Honorable Kills" value={char.totalKills.toLocaleString()} />
        <StatBox label="Honor Points" value={Math.floor(char.totalHonor).toLocaleString()} />
        {char.pvpRank && (
          <StatBox label="Highest Rank" value={PVP_RANKS[char.pvpRank] || `Rank ${char.pvpRank}`} />
        )}
        <StatBox label="Faction" value={char.faction} />
      </div>
    </div>
  );
}

function SkillBar({ name, value, max, color = "#f97316" }: { name: string; value: number; max: number; color?: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-[#e8e6e3]">{name}</span>
        <span className="text-[#9a9a9a]">{value}/{max}</span>
      </div>
      <div className="h-1.5 bg-[#2a2a32] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (value / max) * 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

/* ─── Talents Tab ─────────────────────────────────────────────────────── */

interface TalentEntry {
  id: number; row: number; col: number;
  maxRank: number; currentRank: number;
  name: string; description: string; icon: string;
}
interface TalentTreeData {
  id: number; name: string; tabNumber: number;
  bgImage: string; totalPoints: number;
  talents: TalentEntry[];
}

function TalentsTab({ patch, guid }: { patch: string; guid: number }) {
  const [trees, setTrees] = useState<TalentTreeData[] | null>(null);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tooltip, setTooltip] = useState<{ x: number; y: number; name: string; desc: string } | null>(null);

  useEffect(() => {
    fetch(`/api/armory/talents/${patch}/${guid}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error);
        else { setAvailable(data.available !== false); setTrees(data.tabs ?? []); }
      })
      .catch(() => setError("Failed to load talents"))
      .finally(() => setLoading(false));
  }, [patch, guid]);

  if (loading) return <div className="text-[#666] py-8 text-center">Loading talents...</div>;
  if (error) return <div className="text-red-400 py-4">{error}</div>;
  if (!available) return (
    <div className="bg-[#141418] border border-[#2a2a32] rounded-xl p-6 text-center">
      <p className="text-[#666]">Talent tree data for TBC and WotLK is not yet available.</p>
      <p className="text-[#444] text-sm mt-1">Each expansion requires its own DBC import — coming in a future update.</p>
    </div>
  );
  if (!trees || trees.length === 0) return <div className="text-[#666] py-4">No talent data available.</div>;

  const COLS = 4;

  return (
    <div
      className="relative"
      onMouseLeave={() => setTooltip(null)}
    >
      <div className="flex gap-3 flex-wrap justify-center">
        {trees.map(tree => {
          // Build a map row:col → talent
          const byPos: Record<string, TalentEntry> = {};
          let maxRow = 0;
          for (const t of tree.talents) {
            byPos[`${t.row}:${t.col}`] = t;
            if (t.row > maxRow) maxRow = t.row;
          }

          return (
            <div
              key={tree.id}
              className="flex-1 min-w-[220px] max-w-[280px] rounded-xl overflow-hidden"
              style={{
                backgroundImage: `url(${tree.bgImage})`,
                backgroundSize: "100% 100%",
                backgroundColor: "rgb(195,140,50)",
                boxShadow: "inset 0 0 0 2px rgba(227,197,116,.6), 0 4px 12px rgba(0,0,0,.4)",
                border: "1px solid rgba(0,0,0,.2)",
              }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-3 py-2"
                style={{ background: "linear-gradient(135deg,#000 0%,rgb(195,140,50) 100%)", borderBottom: "1px solid rgba(0,0,0,.3)" }}
              >
                <span className="text-sm font-bold" style={{ color: "#dfc36e" }}>{tree.name}</span>
                <span className="text-xs font-bold" style={{ color: "#3a2a0c", textShadow: "0 1px 1px rgba(227,197,116,.6)" }}>
                  {tree.totalPoints}
                </span>
              </div>

              {/* Grid */}
              <div
                className="p-2"
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${COLS}, 44px)`,
                  gap: "8px",
                  background: "rgba(0,0,0,.22)",
                  margin: "8px",
                  borderRadius: "8px",
                }}
              >
                {Array.from({ length: maxRow + 1 }, (_, row) =>
                  Array.from({ length: COLS }, (_, col) => {
                    const talent = byPos[`${row}:${col}`];
                    if (!talent) {
                      return <div key={`${row}:${col}`} style={{ width: 44, height: 44 }} />;
                    }

                    const isMaxed = talent.currentRank >= talent.maxRank && talent.maxRank > 0;
                    const isLearned = talent.currentRank > 0 && !isMaxed;

                    let borderColor = "#555";
                    let shadowColor = "none";
                    let filter = "grayscale(100%) brightness(.7)";
                    if (isMaxed) { borderColor = "#ffd700"; shadowColor = "0 0 6px 2px rgba(255,215,0,.6)"; filter = "none"; }
                    else if (isLearned) { borderColor = "#00ff00"; shadowColor = "0 0 6px 2px rgba(0,255,0,.5)"; filter = "none"; }

                    return (
                      <div
                        key={talent.id}
                        style={{
                          width: 44, height: 44,
                          borderRadius: 6,
                          backgroundImage: `url(/icons/large/${talent.icon}.jpg)`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          backgroundColor: "#2a2a2a",
                          boxShadow: `inset 0 0 0 2px ${borderColor}, ${shadowColor}`,
                          filter,
                          position: "relative",
                          cursor: "default",
                          transition: "transform .1s",
                        }}
                        onMouseEnter={e => {
                          const el = e.currentTarget;
                          const rect = el.getBoundingClientRect();
                          setTooltip({
                            x: rect.right + 8,
                            y: rect.top,
                            name: talent.name,
                            desc: talent.description,
                          });
                          el.style.transform = "scale(1.2)";
                          el.style.zIndex = "10";
                        }}
                        onMouseLeave={e => {
                          const el = e.currentTarget;
                          el.style.transform = "";
                          el.style.zIndex = "";
                        }}
                      >
                        {/* Rank badge */}
                        <span style={{
                          position: "absolute", right: 2, bottom: 2,
                          padding: "0 4px",
                          borderRadius: 6,
                          background: "#000",
                          fontSize: 10,
                          fontWeight: 700,
                          lineHeight: 1.4,
                          color: isMaxed ? "#ffd700" : isLearned ? "#00ff00" : "#999",
                        }}>
                          {talent.currentRank}/{talent.maxRank}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: "fixed",
            left: Math.min(tooltip.x, window.innerWidth - 290),
            top: Math.max(6, tooltip.y - 60),
            zIndex: 9999,
            minWidth: 180,
            maxWidth: 280,
            padding: "12px",
            background: "rgba(16,24,48,.9)",
            border: "1px solid rgba(200,220,255,.2)",
            borderRadius: 10,
            boxShadow: "0 10px 30px rgba(0,0,0,.5)",
            color: "#e9eefb",
            fontSize: 13,
            lineHeight: 1.5,
            pointerEvents: "none",
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6, color: "#f1f6ff" }}>{tooltip.name}</div>
          {tooltip.desc && <div style={{ color: "#f3e0b3" }}>{tooltip.desc}</div>}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0a0a0c] rounded-lg px-3 py-3">
      <div className="text-xs text-[#666] mb-1">{label}</div>
      <div className="text-lg font-bold text-[#e8e6e3]">{value}</div>
    </div>
  );
}
