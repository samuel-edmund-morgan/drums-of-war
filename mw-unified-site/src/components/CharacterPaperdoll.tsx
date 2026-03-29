"use client";

import { useState, useEffect } from "react";
import { getRaceIconUrl, getClassIconUrl } from "@/lib/wow-icons";
import { ENCHANT_NAMES, SET_NAMES } from "@/lib/wow-enchants";

interface PaperdollProps {
  patch: string;
  raceId: number;
  gender: number;
  classId: number;
  characterName: string;
  level: number;
  equipment: Array<{
    slot: number;
    slotName: string;
    itemEntry: number;
    enchantId?: number;
    randomPropertyId?: number;
  }>;
}

interface SlotItem {
  name: string;
  quality: number;
  qualityColor: string;
  qualityName: string;
  slot: string;
  armor: number | null;
  dmgMin: number | null;
  dmgMax: number | null;
  speed: number | null;
  dps: number | null;
  stats: Array<{ name: string; value: number }>;
  spellEffects: string[];
  description: string | null;
  itemLevel: number;
  requiredLevel: number;
  itemSet: number | null;
  iconUrl: string;
}

const LEFT_SLOTS = [
  { id: 0, name: "Head" },
  { id: 1, name: "Neck" },
  { id: 2, name: "Shoulder" },
  { id: 14, name: "Back" },
  { id: 4, name: "Chest" },
  { id: 3, name: "Shirt" },
  { id: 18, name: "Tabard" },
  { id: 8, name: "Wrist" },
];

const RIGHT_SLOTS = [
  { id: 9, name: "Hands" },
  { id: 5, name: "Waist" },
  { id: 6, name: "Legs" },
  { id: 7, name: "Feet" },
  { id: 10, name: "Ring 1" },
  { id: 11, name: "Ring 2" },
  { id: 12, name: "Trinket 1" },
  { id: 13, name: "Trinket 2" },
];

const BOTTOM_SLOTS = [
  { id: 15, name: "Main Hand" },
  { id: 16, name: "Off Hand" },
  { id: 17, name: "Ranged" },
];

const itemCache = new Map<string, SlotItem>();

function ItemTooltip({ item, enchantId, slotName }: { item: SlotItem; enchantId?: number; slotName: string }) {
  return (
    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-[#1a1a2e] border border-[#4a4a6a] rounded-lg p-4 shadow-2xl pointer-events-none">
      <div className="font-bold text-base mb-1" style={{ color: item.qualityColor }}>
        {item.name}
      </div>
      <div className="text-xs text-[#ffd100] mb-1">Item Level {item.itemLevel}</div>
      {item.slot && <div className="text-sm text-[#ccc]">{item.slot}</div>}
      {item.armor != null && item.armor > 0 && <div className="text-sm text-[#ccc]">{item.armor} Armor</div>}
      {item.dmgMin != null && item.dmgMax != null && (
        <div className="flex justify-between text-sm text-[#ccc]">
          <span>{item.dmgMin} - {item.dmgMax} Damage</span>
          {item.speed != null && <span>Speed {item.speed.toFixed(2)}</span>}
        </div>
      )}
      {item.dps != null && <div className="text-sm text-[#ccc]">({item.dps} damage per second)</div>}
      {item.stats.length > 0 && (
        <div className="mt-1 border-t border-[#333] pt-1">
          {item.stats.map((s, i) => (
            <div key={i} className="text-sm text-[#ccc]">+{s.value} {s.name}</div>
          ))}
        </div>
      )}
      {/* Spell effects (Equip/Use/Chance on hit) */}
      {item.spellEffects && item.spellEffects.length > 0 && (
        <div className="mt-1 border-t border-[#333] pt-1">
          {item.spellEffects.map((eff, i) => (
            <div key={i} className="text-sm text-[#1eff00]">{eff}</div>
          ))}
        </div>
      )}
      {/* Item description */}
      {item.description && (
        <div className="mt-1 text-sm text-[#ffd100] italic">&quot;{item.description}&quot;</div>
      )}
      {enchantId != null && enchantId > 0 && (
        <div className="mt-1 text-sm text-[#1eff00]">
          Enchanted: {ENCHANT_NAMES[enchantId] || `Enchant #${enchantId}`}
        </div>
      )}
      {item.itemSet != null && SET_NAMES[item.itemSet] && (
        <div className="mt-1 text-xs text-[#ffd100]">{SET_NAMES[item.itemSet].name}</div>
      )}
      {item.requiredLevel > 1 && (
        <div className="mt-1 text-xs text-[#666]">Requires Level {item.requiredLevel}</div>
      )}
    </div>
  );
}

function EquipSlot({
  patch,
  equipment,
  slotDef,
  align,
}: {
  patch: string;
  equipment: PaperdollProps["equipment"];
  slotDef: { id: number; name: string };
  align: "left" | "right" | "center";
}) {
  const equip = equipment.find((e) => e.slot === slotDef.id);
  const [item, setItem] = useState<SlotItem | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (!equip) return;
    const randParam = equip.randomPropertyId ? `?rand=${equip.randomPropertyId}` : "";
    const key = `${patch}-${equip.itemEntry}${randParam}`;
    if (itemCache.has(key)) {
      setItem(itemCache.get(key)!);
      return;
    }
    fetch(`/api/armory/item/${patch}/${equip.itemEntry}${randParam}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          itemCache.set(key, data as SlotItem);
          setItem(data as SlotItem);
        }
      })
      .catch(() => {});
  }, [patch, equip]);

  // Empty slot
  if (!equip) {
    return (
      <div className={`flex items-center gap-2 py-1 min-h-[36px] ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
        <div className="w-8 h-8 rounded border border-[#1a1a22] bg-[#0a0a0e] shrink-0" />
        <span className="text-[11px] text-[#333] truncate">{slotDef.name}</span>
      </div>
    );
  }

  return (
    <div
      className={`relative flex items-center gap-2 py-0.5 min-h-[36px] cursor-pointer rounded px-1 hover:bg-[#1a1a20] transition-colors ${align === "right" ? "flex-row-reverse text-right" : ""}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Icon */}
      <div
        className="w-8 h-8 rounded border-2 shrink-0 overflow-hidden"
        style={{
          borderColor: item ? item.qualityColor + "90" : "#222",
          boxShadow: item && item.quality >= 3 ? `0 0 6px ${item.qualityColor}40` : "none",
        }}
      >
        {item ? (
          <img
            src={item.iconUrl}
            alt={item.name}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => { (e.target as HTMLImageElement).src = "/icons/medium/inv_misc_questionmark.jpg"; }}
          />
        ) : (
          <div className="w-full h-full bg-[#1a1a22] animate-pulse" />
        )}
      </div>

      {/* Name */}
      {item ? (
        <div className="min-w-0">
          <div className="text-[11px] font-semibold truncate leading-tight" style={{ color: item.qualityColor }}>
            {item.name}
          </div>
          <div className="text-[9px] text-[#555] leading-tight">{slotDef.name}</div>
        </div>
      ) : (
        <span className="text-[11px] text-[#444] animate-pulse truncate">Loading...</span>
      )}

      {/* Tooltip */}
      {showTooltip && item && <ItemTooltip item={item} enchantId={equip.enchantId} slotName={slotDef.name} />}
    </div>
  );
}

export default function CharacterPaperdoll({
  patch,
  raceId,
  gender,
  classId,
  characterName,
  level,
  equipment,
}: PaperdollProps) {
  return (
    <div className="w-full">
      <div className="flex items-start justify-center gap-2 sm:gap-4">
        {/* Left column */}
        <div className="flex flex-col w-[170px] sm:w-[200px]">
          {LEFT_SLOTS.map((s) => (
            <EquipSlot key={s.id} patch={patch} equipment={equipment} slotDef={s} align="left" />
          ))}
        </div>

        {/* Center portrait */}
        <div className="flex flex-col items-center justify-center pt-4 shrink-0 min-w-[100px]">
          <div className="relative mb-2">
            <img
              src={getRaceIconUrl(raceId, gender)}
              alt="Race"
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-[#2a2a32]"
              referrerPolicy="no-referrer"
            />
            <img
              src={getClassIconUrl(classId, "small")}
              alt="Class"
              className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 border-[#141418]"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="text-orange-400 font-bold text-xs sm:text-sm">{characterName}</div>
          <div className="text-[#666] text-[10px] sm:text-xs">Level {level}</div>
        </div>

        {/* Right column */}
        <div className="flex flex-col w-[170px] sm:w-[200px]">
          {RIGHT_SLOTS.map((s) => (
            <EquipSlot key={s.id} patch={patch} equipment={equipment} slotDef={s} align="right" />
          ))}
        </div>
      </div>

      {/* Bottom — weapons */}
      <div className="flex justify-center gap-3 mt-2 pt-2 border-t border-[#1a1a22]">
        {BOTTOM_SLOTS.map((s) => (
          <div key={s.id} className="w-[150px] sm:w-[170px]">
            <EquipSlot patch={patch} equipment={equipment} slotDef={s} align="left" />
          </div>
        ))}
      </div>
    </div>
  );
}
