// Shared WoW constants reused across multiple pages

export const RACE_NAMES: Record<number, string> = {
  1: "Human", 2: "Orc", 3: "Dwarf", 4: "Night Elf",
  5: "Undead", 6: "Tauren", 7: "Gnome", 8: "Troll",
  10: "Blood Elf", 11: "Draenei",
};

export const CLASS_NAMES: Record<number, string> = {
  1: "Warrior", 2: "Paladin", 3: "Hunter", 4: "Rogue",
  5: "Priest", 6: "Death Knight", 7: "Shaman", 8: "Mage",
  9: "Warlock", 11: "Druid",
};

export const CLASS_COLORS: Record<number, string> = {
  1: "#C79C6E", 2: "#F58CBA", 3: "#ABD473", 4: "#FFF569",
  5: "#FFFFFF", 6: "#C41F3B", 7: "#0070DE", 8: "#69CCF0",
  9: "#9482C9", 11: "#FF7D0A",
};

export const ALLIANCE_RACES = new Set([1, 3, 4, 7, 11]);
export const HORDE_RACES    = new Set([2, 5, 6, 8, 10]);

export const PATCH_INFO = {
  classic: { label: "Classic",                color: "#d4a017", desc: "Vanilla WoW — 1.12.1" },
  tbc:     { label: "The Burning Crusade",     color: "#1eff00", desc: "Outland awaits — 2.4.3" },
  wotlk:   { label: "Wrath of the Lich King",  color: "#0070dd", desc: "Northrend calls — 3.3.5a" },
} as const;

export type PatchId = keyof typeof PATCH_INFO;
export const VALID_PATCHES: PatchId[] = ["classic", "tbc", "wotlk"];

// PvP rank names (Classic only — ranks 1-14 for both factions)
export const PVP_RANKS_ALLIANCE: Record<number, string> = {
  1: "Private", 2: "Corporal", 3: "Sergeant", 4: "Master Sergeant",
  5: "Sergeant Major", 6: "Knight", 7: "Knight-Lieutenant", 8: "Knight-Captain",
  9: "Knight-Champion", 10: "Lieutenant Commander", 11: "Commander",
  12: "Marshal", 13: "Field Marshal", 14: "Grand Marshal",
};
export const PVP_RANKS_HORDE: Record<number, string> = {
  1: "Scout", 2: "Grunt", 3: "Sergeant", 4: "Senior Sergeant",
  5: "First Sergeant", 6: "Stone Guard", 7: "Blood Guard", 8: "Legionnaire",
  9: "Centurion", 10: "Champion", 11: "Lieutenant General",
  12: "General", 13: "Warlord", 14: "High Warlord",
};

export const ZONE_NAMES: Record<number, string> = {
  // Capital Cities
  1519: "Stormwind City", 1537: "Ironforge", 1657: "Darnassus",
  1497: "Undercity", 1637: "Orgrimmar", 1638: "Thunder Bluff",
  3487: "Silvermoon City", 3703: "Shattrath City", 3711: "The Exodar",
  4395: "Dalaran", 4554: "Dalaran (Northrend)",
  // Eastern Kingdoms
  1: "Dun Morogh", 12: "Elwynn Forest", 28: "Westfall", 26: "Loch Modan",
  44: "Redridge Mountains", 10: "Duskwood", 22: "Stranglethorn Vale",
  8: "Swamp of Sorrows", 4: "Blasted Lands", 17: "Alterac Mountains",
  45: "Arathi Highlands", 267: "Hillsbrad Foothills", 51: "Searing Gorge",
  46: "Burning Steppes", 3: "Badlands", 47: "The Hinterlands",
  25: "Blackrock Mountain", 38: "Wetlands", 139: "Eastern Plaguelands",
  140: "Western Plaguelands", 85: "Tirisfal Glades", 130: "Silverpine Forest",
  41: "Deadwind Pass", 11: "Blasted Lands",
  // Kalimdor
  14: "Durotar", 215: "Mulgore", 141: "Teldrassil", 148: "Darkshore",
  331: "Ashenvale", 16: "Azshara", 357: "Feralas", 361: "Felwood",
  618: "Winterspring", 1377: "Silithus", 400: "Thousand Needles",
  405: "Desolace", 440: "Tanaris", 490: "Un'Goro Crater",
  33: "Stonetalon Mountains", 15: "Dustwallow Marsh",
  // Outland
  3483: "Hellfire Peninsula", 3521: "Zangarmarsh", 3519: "Terokkar Forest",
  3518: "Nagrand", 3522: "Blade's Edge Mountains", 3520: "Shadowmoon Valley",
  3523: "Netherstorm", 3430: "Eversong Woods", 3433: "Ghostlands",
  3524: "Azuremyst Isle", 3525: "Bloodmyst Isle", 4080: "Isle of Quel'Danas",
  // Northrend
  4197: "Borean Tundra", 4391: "Howling Fjord", 65: "Dragonblight",
  394: "Grizzly Hills", 4196: "Zul'Drak", 4710: "Sholazar Basin",
  4725: "Storm Peaks", 210: "Icecrown", 4742: "Crystalsong Forest",
  4298: "Wintergrasp",
  // Battlegrounds
  2597: "Alterac Valley", 3277: "Warsong Gulch", 3358: "Arathi Basin",
  3820: "Eye of the Storm", 4384: "Strand of the Ancients",
  // Instances (common ones)
  1584: "Blackrock Depths", 1583: "Stratholme", 1977: "Zul'Gurub",
  2017: "Ruins of Ahn'Qiraj", 2018: "Ahn'Qiraj Temple",
  2557: "Karazhan", 3456: "Sunwell Plateau", 4120: "Naxxramas",
  4273: "Ulduar", 4812: "Icecrown Citadel",
};
