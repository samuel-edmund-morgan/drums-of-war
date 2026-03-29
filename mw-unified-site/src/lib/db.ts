import { createConnection, Connection, RowDataPacket } from "mysql2/promise";

export type Patch = "classic" | "tbc" | "wotlk";

interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  charDb: string;
  realmDb: string;
}

const DB_CONFIGS: Record<Patch, DbConfig> = {
  classic: {
    host: process.env.CLASSIC_DB_HOST || "vmangos-db",
    port: Number(process.env.CLASSIC_DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    charDb: process.env.CLASSIC_CHARDB || "characters",
    realmDb: process.env.CLASSIC_REALMD || "realmd",
  },
  tbc: {
    host: process.env.TBC_DB_HOST || "cmangos-tbc-db",
    port: Number(process.env.TBC_DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    charDb: process.env.TBC_CHARDB || "tbccharacters",
    realmDb: process.env.TBC_REALMD || "tbcrealmd",
  },
  wotlk: {
    host: process.env.WOTLK_DB_HOST || "azerothcore-db",
    port: Number(process.env.WOTLK_DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    charDb: process.env.WOTLK_CHARDB || "acore_characters",
    realmDb: process.env.WOTLK_REALMD || "acore_auth",
  },
};

export function getDbConfig(patch: Patch): DbConfig {
  return DB_CONFIGS[patch];
}

export async function withConnection<T>(
  patch: Patch,
  dbName: "char" | "realm",
  fn: (conn: Connection) => Promise<T>
): Promise<T> {
  const config = DB_CONFIGS[patch];
  const conn = await createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: dbName === "char" ? config.charDb : config.realmDb,
    connectTimeout: 5000,
  });

  try {
    return await fn(conn);
  } finally {
    await conn.end();
  }
}

export async function queryAll<T extends RowDataPacket>(
  patch: Patch,
  dbName: "char" | "realm",
  sql: string,
  params: (string | number)[] = []
): Promise<T[]> {
  return withConnection(patch, dbName, async (conn) => {
    const [rows] = await conn.execute<T[]>(sql, params);
    return rows;
  });
}

export async function queryOne<T extends RowDataPacket>(
  patch: Patch,
  dbName: "char" | "realm",
  sql: string,
  params: (string | number)[] = []
): Promise<T | null> {
  const rows = await queryAll<T>(patch, dbName, sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// WoW constants
export const RACES: Record<number, string> = {
  1: "Human", 2: "Orc", 3: "Dwarf", 4: "Night Elf", 5: "Undead",
  6: "Tauren", 7: "Gnome", 8: "Troll", 10: "Blood Elf", 11: "Draenei",
};

export const CLASSES: Record<number, string> = {
  1: "Warrior", 2: "Paladin", 3: "Hunter", 4: "Rogue", 5: "Priest",
  6: "Death Knight", 7: "Shaman", 8: "Mage", 9: "Warlock", 11: "Druid",
};

export const FACTIONS: Record<number, "Alliance" | "Horde"> = {
  1: "Alliance", 3: "Alliance", 4: "Alliance", 7: "Alliance", 11: "Alliance",
  2: "Horde", 5: "Horde", 6: "Horde", 8: "Horde", 10: "Horde",
};

export const PATCH_LABELS: Record<Patch, string> = {
  classic: "Classic 1.12.1",
  tbc: "TBC 2.4.3",
  wotlk: "WotLK 3.3.5a",
};

export const ALL_PATCHES: Patch[] = ["classic", "tbc", "wotlk"];
