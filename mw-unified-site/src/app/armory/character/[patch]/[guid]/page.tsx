"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import CharTabs from "@/components/CharTabs";
import { getRaceIconUrl, getClassIconUrl } from "@/lib/wow-icons";
import CharacterPaperdoll from "@/components/CharacterPaperdoll";

interface CharProfile {
  guid: number; name: string; race: string; className: string;
  raceId: number; classId: number; gender: number; level: number;
  health: number; mana: number; faction: string;
  totalKills: number; totalHonor: number;
  pvpRank: number | null; chosenTitle: number | null;
  guild: { name: string; rank: string } | null;
  equipment: Array<{ slot: number; slotName: string; itemEntry: number; enchantId?: number }>;
  professions: Array<{ name: string; skillId: number; value: number; max: number }>;
  weaponSkills: Array<{ name: string; skillId: number; value: number; max: number }>;
  languages: Array<{ name: string; skillId: number; value: number; max: number }>;
  reputation: Array<{ factionId: number; standing: number }>;
  modelItems: Array<[number, number]>;
  patch: string; patchLabel: string;
}

const CLASS_COLORS: Record<number, string> = {
  1: "#C79C6E", 2: "#F58CBA", 3: "#ABD473", 4: "#FFF569",
  5: "#FFFFFF", 6: "#C41F3B", 7: "#0070DE", 8: "#69CCF0",
  9: "#9482C9", 11: "#FF7D0A",
};

const PVP_RANKS: Record<number, string> = {
  1: "Private", 2: "Corporal", 3: "Sergeant", 4: "Master Sergeant",
  5: "Sergeant Major", 6: "Knight", 7: "Knight-Lieutenant", 8: "Knight-Captain",
  9: "Knight-Champion", 10: "Lieutenant Commander", 11: "Commander",
  12: "Marshal", 13: "Field Marshal", 14: "Grand Marshal",
  15: "Scout", 16: "Grunt", 17: "Sergeant", 18: "Grand Marshal",
};

export default function CharacterPage({ params }: { params: Promise<{ patch: string; guid: string }> }) {
  const { patch, guid } = use(params);
  const [char, setChar] = useState<CharProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/armory/character/${patch}/${guid}`)
      .then((r) => { if (!r.ok) throw new Error("Character not found"); return r.json(); })
      .then(setChar)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [patch, guid]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-[#e8e6e3]">
        <Navbar />
        <main className="pt-24 pb-16 px-4">
          <div className="max-w-4xl mx-auto text-center text-[#666] py-16">Loading character...</div>
        </main>
      </div>
    );
  }

  if (error || !char) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-[#e8e6e3]">
        <Navbar />
        <main className="pt-24 pb-16 px-4">
          <div className="max-w-4xl mx-auto text-center py-16">
            <p className="text-red-400 text-lg mb-4">{error || "Character not found"}</p>
            <Link href="/armory" className="text-orange-400 hover:text-orange-300">Back to Armory</Link>
          </div>
        </main>
      </div>
    );
  }

  const rankName = char.pvpRank ? PVP_RANKS[char.pvpRank] || null : null;
  const displayName = rankName ? `${rankName} ${char.name}` : char.name;

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-[#e8e6e3]">
      <Navbar />
      <main className="pt-24 pb-16 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <div className="mb-6 text-sm text-[#666]">
            <Link href="/armory" className="hover:text-orange-400">Armory</Link>
            <span className="mx-2">/</span>
            <span className="text-[#9a9a9a]">{char.name}</span>
          </div>

          {/* Character header */}
          <div className="bg-[#141418] border border-[#2a2a32] rounded-xl p-6 mb-6">
            <div className="flex items-start gap-5 mb-4">
              {/* Portrait */}
              <div className="shrink-0 relative">
                <img
                  src={getRaceIconUrl(char.raceId, char.gender)}
                  alt={`${char.race} ${char.gender === 0 ? "Male" : "Female"}`}
                  className="w-20 h-20 rounded-xl border-2 border-[#3a3a42]"
                  style={{ borderColor: CLASS_COLORS[char.classId] || "#3a3a42" }}
                />
                <img
                  src={getClassIconUrl(char.classId, "small")}
                  alt={char.className}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full border-2 border-[#141418]"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h1 className="text-3xl font-extrabold mb-1" style={{ color: CLASS_COLORS[char.classId] || "#e8e6e3" }}>
                      {displayName}
                    </h1>
                    <p className="text-[#9a9a9a]">
                      Level {char.level} {char.race} {char.className}
                      {char.guild && (
                        <span className="ml-2 text-[#666]">
                          &lt;{char.guild.name}&gt;{char.guild.rank ? ` — ${char.guild.rank}` : ""}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className={`shrink-0 px-3 py-1 text-sm font-semibold rounded ${
                    char.patch === "classic" ? "bg-yellow-700/80 text-yellow-200" :
                    char.patch === "tbc" ? "bg-green-800/80 text-green-200" :
                    "bg-blue-800/80 text-blue-200"
                  }`}>
                    {char.patchLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Health" value={char.health.toLocaleString()} />
              <Stat label="Mana" value={char.mana.toLocaleString()} />
              <Stat label="Honorable Kills" value={char.totalKills.toLocaleString()} />
              <Stat label="Faction" value={char.faction} />
            </div>
          </div>

          {/* Character Paperdoll */}
          {char.equipment && char.equipment.length > 0 && (
            <div className="bg-[#141418] border border-[#2a2a32] rounded-xl p-4 mb-6">
              <h2 className="text-sm font-bold text-orange-400 mb-3">Equipment</h2>
              <CharacterPaperdoll
                patch={patch}
                raceId={char.raceId}
                gender={char.gender}
                classId={char.classId}
                characterName={char.name}
                level={char.level}
                equipment={char.equipment}
              />
            </div>
          )}

          {/* Tabbed content */}
          <CharTabs char={char} />
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0a0a0c] rounded-lg px-3 py-2">
      <div className="text-xs text-[#666] mb-0.5">{label}</div>
      <div className="text-sm font-semibold text-[#ccc]">{value}</div>
    </div>
  );
}
