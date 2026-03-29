"use client";

import { useState, useEffect, useRef } from "react";
import { ENCHANT_NAMES, SET_NAMES } from "@/lib/wow-enchants";

interface ItemData {
  entry: number;
  name: string;
  quality: number;
  qualityName: string;
  qualityColor: string;
  slot: string;
  armor: number | null;
  dmgMin: number | null;
  dmgMax: number | null;
  speed: number | null;
  dps: number | null;
  stats: Array<{ name: string; value: number }>;
  requiredLevel: number;
  itemLevel: number;
  itemSet: number | null;
}

// Cache fetched items across renders
const itemCache = new Map<string, ItemData>();

export default function ItemSlot({
  patch,
  itemEntry,
  slotName,
  enchantId = 0,
  randomPropertyId = 0,
}: {
  patch: string;
  itemEntry: number;
  slotName: string;
  enchantId?: number;
  randomPropertyId?: number;
}) {
  const cacheKey = `${patch}-${itemEntry}-${randomPropertyId}`;
  const [item, setItem] = useState<ItemData | null>(itemCache.get(cacheKey) || null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [loading, setLoading] = useState(!item);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (itemCache.has(cacheKey)) {
      setItem(itemCache.get(cacheKey)!);
      setLoading(false);
      return;
    }

    const randQuery = randomPropertyId ? `?rand=${randomPropertyId}` : "";
    fetch(`/api/armory/item/${patch}/${itemEntry}${randQuery}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          itemCache.set(cacheKey, data);
          setItem(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patch, itemEntry, randomPropertyId, cacheKey]);

  if (loading) {
    return (
      <div className="flex justify-between text-sm py-1.5 px-2 rounded">
        <span className="text-[#666]">{slotName}</span>
        <span className="text-[#444] animate-pulse">Loading...</span>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex justify-between text-sm py-1.5 px-2 rounded">
        <span className="text-[#666]">{slotName}</span>
        <span className="text-[#666]">Item #{itemEntry}</span>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="relative flex justify-between items-center text-sm py-1.5 px-2 rounded hover:bg-[#1a1a20] cursor-pointer transition-colors"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="text-[#666] text-xs w-20 shrink-0">{slotName}</span>
      <span
        className="font-semibold text-right truncate"
        style={{ color: item.qualityColor }}
      >
        {item.name}
      </span>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-[#1a1a2e] border border-[#4a4a6a] rounded-lg p-4 shadow-2xl pointer-events-none">
          {/* Item name */}
          <div className="font-bold text-base mb-1" style={{ color: item.qualityColor }}>
            {item.name}
          </div>

          {/* Item level */}
          <div className="text-xs text-[#ffd100] mb-1">Item Level {item.itemLevel}</div>

          {/* Slot + type */}
          {item.slot && (
            <div className="text-sm text-[#ccc]">{item.slot}</div>
          )}

          {/* Armor */}
          {item.armor && (
            <div className="text-sm text-[#ccc]">{item.armor} Armor</div>
          )}

          {/* Weapon damage */}
          {item.dmgMin && item.dmgMax && (
            <div className="flex justify-between text-sm text-[#ccc]">
              <span>{item.dmgMin} - {item.dmgMax} Damage</span>
              {item.speed && <span>Speed {item.speed.toFixed(2)}</span>}
            </div>
          )}

          {/* DPS */}
          {item.dps && (
            <div className="text-sm text-[#ccc]">({item.dps} damage per second)</div>
          )}

          {/* Stats */}
          {item.stats.length > 0 && (
            <div className="mt-1 border-t border-[#333] pt-1">
              {item.stats.map((s, i) => (
                <div key={i} className="text-sm text-[#ccc]">
                  +{s.value} {s.name}
                </div>
              ))}
            </div>
          )}

          {/* Enchant */}
          {enchantId > 0 && (
            <div className="mt-1 text-sm text-[#1eff00]">
              Enchanted: {ENCHANT_NAMES[enchantId] || `Enchant #${enchantId}`}
            </div>
          )}

          {/* Set name */}
          {item.itemSet && SET_NAMES[item.itemSet] && (
            <div className="mt-1 text-xs text-[#ffd100]">
              {SET_NAMES[item.itemSet].name}
            </div>
          )}

          {/* Required level */}
          {item.requiredLevel > 1 && (
            <div className="mt-1 text-xs text-[#666]">
              Requires Level {item.requiredLevel}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
