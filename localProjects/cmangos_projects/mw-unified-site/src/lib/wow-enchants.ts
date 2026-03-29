// Common permanent enchant IDs → display names
// Source: SpellItemEnchantment.dbc (selected popular enchants)
export const ENCHANT_NAMES: Record<number, string> = {
  // Cloak
  2131: "+3 Agility",
  849: "+70 Armor",
  1888: "+15 Fire Resistance",
  2621: "+12 Agility",
  2622: "+20 Agility",
  2938: "+12 Dodge Rating",
  3831: "+23 Haste Rating",
  // Chest
  1891: "+4 All Stats",
  2659: "+6 All Stats",
  2661: "+15 Spirit",
  3832: "+10 All Stats",
  3245: "+275 Health",
  // Boots
  911: "+7 Stamina",
  2656: "+12 Stamina",
  2940: "+12 Agility",
  3232: "+32 Attack Power",
  // Bracers
  2650: "+24 Attack Power",
  1147: "+7 Intellect",
  2326: "+30 Spell Power",
  3845: "+30 Spell Power",
  // Gloves
  2613: "+15 Agility",
  2614: "+20 Spell Power",
  2322: "+26 Attack Power",
  3604: "+340 Haste (10s)",
  // Head / Legs (armor kits, librams)
  2543: "+100 Health",
  2544: "+100 Mana",
  2583: "+8 Stamina +Armor",
  2586: "+10 Stamina +Armor",
  3002: "Glyph of Ferocity (+34 AP +16 Hit)",
  3003: "Glyph of Shadow Warding (+20 Shadow Res)",
  3004: "Glyph of the Outcast (+17 Str +16 Int)",
  3819: "+29 Spell Power +20 Resilience",
  // Shoulders
  2715: "+26 Attack Power +14 Crit",
  2716: "+18 Spell Power +10 Crit",
  2717: "+15 Dodge +10 Defense",
  3808: "+24 Attack Power +15 Crit",
  3809: "+24 Spell Power +15 Crit",
  // Weapon
  1900: "+22 Intellect",
  2504: "+30 Intellect",
  2505: "+22 Intellect",
  2646: "+35 Agility",
  2667: "+40 Spell Power",
  2669: "+26 Agility",
  2673: "+20 Strength",
  3222: "+50 Attack Power",
  3225: "+63 Spell Power",
  3789: "+50 Attack Power",
  3790: "+63 Spell Power",
  3834: "+65 Attack Power",
  3844: "+63 Spell Power",
  // Shield
  1952: "+7 Stamina",
  2654: "+18 Stamina",
  // Ring (enchanter only)
  2928: "+12 Spell Power",
  2929: "+12 Stamina",
  2930: "+12 Attack Power",
  2931: "+12 Healing Power",
  // Misc
  2523: "+15 Nature Resistance",
  2488: "+8 Frost Resistance",
  1843: "+8 Shadow Resistance",
};

// Well-known item set IDs → names
export const SET_NAMES: Record<number, { name: string; pieces: number }> = {
  // Warlock T1
  203: { name: "Felheart Raiment", pieces: 8 },
  // Warlock T2
  212: { name: "Nemesis Raiment", pieces: 8 },
  // Warlock T3
  529: { name: "Plagueheart Raiment", pieces: 9 },
  // Warrior T1
  201: { name: "Battlegear of Might", pieces: 8 },
  // Warrior T2
  210: { name: "Battlegear of Wrath", pieces: 8 },
  // Mage T1
  202: { name: "Arcanist Regalia", pieces: 8 },
  // Mage T2
  211: { name: "Netherwind Regalia", pieces: 8 },
  // Priest T1
  205: { name: "Vestments of Prophecy", pieces: 8 },
  // Priest T2
  214: { name: "Vestments of Transcendence", pieces: 8 },
  // Rogue T1
  204: { name: "Nightslayer Armor", pieces: 8 },
  // Rogue T2
  213: { name: "Bloodfang Armor", pieces: 8 },
  // Hunter T1
  206: { name: "Giantstalker Armor", pieces: 8 },
  // Hunter T2
  215: { name: "Dragonstalker Armor", pieces: 8 },
  // Druid T1
  207: { name: "Cenarion Raiment", pieces: 8 },
  // Druid T2
  216: { name: "Stormrage Raiment", pieces: 8 },
  // Paladin T1
  208: { name: "Lawbringer Armor", pieces: 8 },
  // Paladin T2
  217: { name: "Judgment Armor", pieces: 8 },
  // Shaman T1
  209: { name: "The Earthfury", pieces: 8 },
  // Shaman T2
  218: { name: "The Ten Storms", pieces: 8 },
};
