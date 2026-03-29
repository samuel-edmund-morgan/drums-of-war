// WoW race/class icon mappings — served through local caching proxy at /icons/
// Upstream: https://wow.zamimg.com/images/wow/icons/{size}/{name}.jpg
// Local:    /icons/{size}/{name}.jpg (cached to disk on first fetch)

const RACE_ICONS: Record<number, [string, string]> = {
  // [male, female]
  1: ["race_human_male", "race_human_female"],
  2: ["race_orc_male", "race_orc_female"],
  3: ["race_dwarf_male", "race_dwarf_female"],
  4: ["race_nightelf_male", "race_nightelf_female"],
  5: ["race_scourge_male", "race_scourge_female"],
  6: ["race_tauren_male", "race_tauren_female"],
  7: ["race_gnome_male", "race_gnome_female"],
  8: ["race_troll_male", "race_troll_female"],
  10: ["race_bloodelf_male", "race_bloodelf_female"],
  11: ["race_draenei_male", "race_draenei_female"],
};

const CLASS_ICONS: Record<number, string> = {
  1: "classicon_warrior",
  2: "classicon_paladin",
  3: "classicon_hunter",
  4: "classicon_rogue",
  5: "classicon_priest",
  6: "classicon_deathknight",
  7: "classicon_shaman",
  8: "classicon_mage",
  9: "classicon_warlock",
  11: "classicon_druid",
};

const FACTION_ICONS: Record<string, string> = {
  Alliance: "pvpcurrency-honor-alliance",
  Horde: "pvpcurrency-honor-horde",
};

const ICON_BASE = "/icons";

export function getRaceIconUrl(raceId: number, gender: number, size: "small" | "medium" | "large" = "large"): string {
  const icons = RACE_ICONS[raceId];
  if (!icons) return `${ICON_BASE}/${size}/inv_misc_questionmark.jpg`;
  return `${ICON_BASE}/${size}/${icons[gender === 1 ? 1 : 0]}.jpg`;
}

export function getClassIconUrl(classId: number, size: "small" | "medium" | "large" = "large"): string {
  const icon = CLASS_ICONS[classId];
  if (!icon) return `${ICON_BASE}/${size}/inv_misc_questionmark.jpg`;
  return `${ICON_BASE}/${size}/${icon}.jpg`;
}

export function getFactionIconUrl(faction: string, size: "small" | "medium" | "large" = "large"): string {
  const icon = FACTION_ICONS[faction];
  if (!icon) return `${ICON_BASE}/${size}/inv_misc_questionmark.jpg`;
  return `${ICON_BASE}/${size}/${icon}.jpg`;
}
