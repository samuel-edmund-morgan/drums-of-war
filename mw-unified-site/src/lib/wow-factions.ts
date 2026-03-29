// Major WoW factions with their IDs
// Source: faction.dbc — only factions commonly shown in armory
export const FACTIONS: Record<number, { name: string; category: string }> = {
  // Alliance
  47: { name: "Ironforge", category: "Alliance" },
  54: { name: "Gnomeregan Exiles", category: "Alliance" },
  69: { name: "Darnassus", category: "Alliance" },
  72: { name: "Stormwind", category: "Alliance" },
  930: { name: "Exodar", category: "Alliance" },

  // Horde
  68: { name: "Undercity", category: "Horde" },
  76: { name: "Orgrimmar", category: "Horde" },
  81: { name: "Thunder Bluff", category: "Horde" },
  530: { name: "Darkspear Trolls", category: "Horde" },
  911: { name: "Silvermoon City", category: "Horde" },

  // Classic
  21: { name: "Booty Bay", category: "Steamwheedle Cartel" },
  59: { name: "Thorium Brotherhood", category: "Classic" },
  87: { name: "Bloodsail Buccaneers", category: "Classic" },
  270: { name: "Zandalar Tribe", category: "Classic" },
  349: { name: "Ravenholdt", category: "Classic" },
  369: { name: "Gadgetzan", category: "Steamwheedle Cartel" },
  470: { name: "Ratchet", category: "Steamwheedle Cartel" },
  471: { name: "Wildhammer Clan", category: "Classic" },
  509: { name: "League of Arathor", category: "Classic" },
  510: { name: "Stormpike Guard", category: "Classic" },
  529: { name: "Argent Dawn", category: "Classic" },
  576: { name: "Timbermaw Hold", category: "Classic" },
  577: { name: "Everlook", category: "Steamwheedle Cartel" },
  589: { name: "Wintersaber Trainers", category: "Classic" },
  609: { name: "Cenarion Circle", category: "Classic" },
  749: { name: "Hydraxian Waterlords", category: "Classic" },
  809: { name: "Shen'dralar", category: "Classic" },
  890: { name: "Silverwing Sentinels", category: "Classic" },
  889: { name: "Warsong Outriders", category: "Classic" },
  910: { name: "Brood of Nozdormu", category: "Classic" },

  // TBC
  922: { name: "Tranquillien", category: "TBC" },
  932: { name: "The Aldor", category: "TBC" },
  933: { name: "The Consortium", category: "TBC" },
  934: { name: "The Scryers", category: "TBC" },
  935: { name: "The Sha'tar", category: "TBC" },
  941: { name: "The Mag'har", category: "TBC" },
  942: { name: "Cenarion Expedition", category: "TBC" },
  946: { name: "Honor Hold", category: "TBC" },
  947: { name: "Thrallmar", category: "TBC" },
  967: { name: "The Violet Eye", category: "TBC" },
  970: { name: "Sporeggar", category: "TBC" },
  978: { name: "Kurenai", category: "TBC" },
  989: { name: "Keepers of Time", category: "TBC" },
  990: { name: "The Scale of the Sands", category: "TBC" },
  1011: { name: "Lower City", category: "TBC" },
  1012: { name: "Ashtongue Deathsworn", category: "TBC" },
  1015: { name: "Netherwing", category: "TBC" },
  1031: { name: "Sha'tari Skyguard", category: "TBC" },
  1038: { name: "Ogri'la", category: "TBC" },
  1077: { name: "Shattered Sun Offensive", category: "TBC" },

  // WotLK
  1037: { name: "Alliance Vanguard", category: "WotLK" },
  1052: { name: "Horde Expedition", category: "WotLK" },
  1073: { name: "The Kalu'ak", category: "WotLK" },
  1085: { name: "Warsong Offensive", category: "WotLK" },
  1090: { name: "Kirin Tor", category: "WotLK" },
  1091: { name: "The Wyrmrest Accord", category: "WotLK" },
  1094: { name: "The Silver Covenant", category: "WotLK" },
  1098: { name: "Knights of the Ebon Blade", category: "WotLK" },
  1104: { name: "Frenzyheart Tribe", category: "WotLK" },
  1105: { name: "The Oracles", category: "WotLK" },
  1106: { name: "Argent Crusade", category: "WotLK" },
  1119: { name: "The Sons of Hodir", category: "WotLK" },
  1156: { name: "The Ashen Verdict", category: "WotLK" },
};

// Reputation standing thresholds and names
export const REP_STANDINGS = [
  { name: "Hated", min: -42000, max: -6001, color: "#cc2222" },
  { name: "Hostile", min: -6000, max: -3001, color: "#cc2222" },
  { name: "Unfriendly", min: -3000, max: -1, color: "#ee6622" },
  { name: "Neutral", min: 0, max: 2999, color: "#ffff00" },
  { name: "Friendly", min: 3000, max: 8999, color: "#00cc00" },
  { name: "Honored", min: 9000, max: 20999, color: "#00cc00" },
  { name: "Revered", min: 21000, max: 41999, color: "#00cc00" },
  { name: "Exalted", min: 42000, max: 42999, color: "#00ccff" },
];

export function getStanding(value: number) {
  // Values above Exalted cap (42999) are still Exalted at 100%
  if (value > 42999) {
    const s = REP_STANDINGS[REP_STANDINGS.length - 1]; // Exalted
    return { ...s, progress: 999, range: 1000, percent: 100 };
  }
  // Values below Hated floor are Hated at 0%
  if (value < -42000) {
    const s = REP_STANDINGS[0]; // Hated
    return { ...s, progress: 0, range: s.max - s.min + 1, percent: 0 };
  }
  for (const s of REP_STANDINGS) {
    if (value >= s.min && value <= s.max) {
      const range = s.max - s.min + 1;
      const progress = value - s.min;
      return { ...s, progress, range, percent: Math.min(100, (progress / range) * 100) };
    }
  }
  return { name: "Unknown", min: 0, max: 0, color: "#666", progress: 0, range: 1, percent: 0 };
}
