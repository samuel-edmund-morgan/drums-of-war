import { createConnection, type Connection, type RowDataPacket } from "mysql2/promise";
import { getDbConfig, type Patch } from "./db";

/* ──────────────────────── helpers ──────────────────────── */

async function connect(patch: Patch): Promise<Connection> {
  const cfg = getDbConfig(patch);
  return createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.charDb,
    connectTimeout: 10_000,
  });
}

/* ──────────────────────── types ──────────────────────── */

export interface TransferResult {
  success: boolean;
  message: string;
  newGuid?: number;
}

/* ──────────────────────── public API ──────────────────────── */

export async function executeTransfer(
  sourceRealm: "classic" | "tbc",
  targetRealm: "tbc" | "wotlk",
  characterGuid: number,
  accountId: number,
  targetAccountId: number,
): Promise<TransferResult> {
  if (sourceRealm === "classic" && targetRealm === "tbc") {
    return classicToTbc(characterGuid, accountId, targetAccountId);
  }
  if (sourceRealm === "tbc" && targetRealm === "wotlk") {
    return tbcToWotlk(characterGuid, accountId, targetAccountId);
  }
  return { success: false, message: `Unsupported transfer direction: ${sourceRealm} → ${targetRealm}` };
}

/* ═══════════════════════════════════════════════════════════
   Classic (VMaNGOS) → TBC (CMaNGOS)
   ═══════════════════════════════════════════════════════════ */

// Alliance race IDs
const ALLIANCE_RACES = new Set([1, 3, 4, 7, 11]);

async function classicToTbc(
  characterGuid: number,
  sourceAccountId: number,
  targetAccountId: number,
): Promise<TransferResult> {
  let srcConn: Connection | null = null;
  let tgtConn: Connection | null = null;

  try {
    srcConn = await connect("classic");
    tgtConn = await connect("tbc");

    /* ── 1. Read source character ── */
    const [charRows] = await srcConn.execute<RowDataPacket[]>(
      "SELECT * FROM characters WHERE guid = ? AND account = ?",
      [characterGuid, sourceAccountId],
    );
    if (charRows.length === 0) {
      return { success: false, message: "Character not found or does not belong to this account" };
    }
    const src = charRows[0];

    /* ── 2. Must be offline ── */
    if (src.online !== 0) {
      return { success: false, message: "Character must be offline (logged out) to transfer" };
    }

    /* ── 3. Name collision check on target ── */
    const [nameCheck] = await tgtConn.execute<RowDataPacket[]>(
      "SELECT guid FROM characters WHERE name = ?",
      [src.name],
    );
    if (nameCheck.length > 0) {
      return { success: false, message: `Character name "${src.name}" already exists on TBC realm` };
    }

    /* ── 4. Read related tables ── */
    const [srcItems] = await srcConn.execute<RowDataPacket[]>(
      "SELECT * FROM item_instance WHERE owner_guid = ?",
      [characterGuid],
    );
    const [srcInventory] = await srcConn.execute<RowDataPacket[]>(
      "SELECT * FROM character_inventory WHERE guid = ?",
      [characterGuid],
    );
    const [srcSpells] = await srcConn.execute<RowDataPacket[]>(
      "SELECT * FROM character_spell WHERE guid = ?",
      [characterGuid],
    );
    const [srcSkills] = await srcConn.execute<RowDataPacket[]>(
      "SELECT * FROM character_skills WHERE guid = ?",
      [characterGuid],
    );
    const [srcActions] = await srcConn.execute<RowDataPacket[]>(
      "SELECT * FROM character_action WHERE guid = ?",
      [characterGuid],
    );
    const [srcReputation] = await srcConn.execute<RowDataPacket[]>(
      "SELECT * FROM character_reputation WHERE guid = ?",
      [characterGuid],
    );
    const [srcQuests] = await srcConn.execute<RowDataPacket[]>(
      "SELECT * FROM character_queststatus WHERE guid = ?",
      [characterGuid],
    );
    const [srcHomebind] = await srcConn.execute<RowDataPacket[]>(
      "SELECT * FROM character_homebind WHERE guid = ?",
      [characterGuid],
    );

    /* ── 5. Allocate new guids in target ── */
    const [maxCharRow] = await tgtConn.execute<RowDataPacket[]>(
      "SELECT COALESCE(MAX(guid), 0) + 1 AS nextGuid FROM characters",
    );
    const newCharGuid: number = maxCharRow[0].nextGuid;

    const [maxItemRow] = await tgtConn.execute<RowDataPacket[]>(
      "SELECT COALESCE(MAX(guid), 0) AS maxGuid FROM item_instance",
    );
    let nextItemGuid: number = (maxItemRow[0].maxGuid as number) + 1;

    // Build old→new item guid mapping
    const itemGuidMap = new Map<number, number>();
    for (const item of srcItems) {
      itemGuidMap.set(item.guid as number, nextItemGuid);
      nextItemGuid++;
    }

    /* ── 6. Transform character row ── */
    const skin = Number(src.skin ?? 0);
    const face = Number(src.face ?? 0);
    const hairStyle = Number(src.hair_style ?? 0);
    const hairColor = Number(src.hair_color ?? 0);
    const facialHair = Number(src.facial_hair ?? 0);
    const bankBagSlots = Number(src.bank_bag_slots ?? 0);

    const playerBytes = (skin & 0xFF)
      | ((face & 0xFF) << 8)
      | ((hairStyle & 0xFF) << 16)
      | ((hairColor & 0xFF) << 24);

    const playerBytes2 = (facialHair & 0xFF)
      | ((bankBagSlots & 0xFF) << 16)
      | (0 << 24); // restState = 0

    // knownTitles: convert honor_highest_rank to bitvector
    const highestRank = Number(src.honor_highest_rank ?? 0);
    let knownTitles = "0 0";
    let chosenTitle = 0;
    if (highestRank > 0) {
      const isAlliance = ALLIANCE_RACES.has(Number(src.race));
      // Alliance: title IDs 1-14, Horde: 15-28
      const baseTitle = isAlliance ? 0 : 14;
      const titleId = baseTitle + highestRank;
      chosenTitle = titleId;
      // knownTitles is stored as two uint32 values: low 32 bits and high 32 bits
      if (titleId < 32) {
        knownTitles = `${1 << titleId} 0`;
      } else {
        knownTitles = `0 ${1 << (titleId - 32)}`;
      }
    }

    /* ── 7. Begin target transaction ── */
    await tgtConn.beginTransaction();

    try {
      // INSERT character
      await tgtConn.execute(
        `INSERT INTO characters (
          guid, account, name, race, class, gender, level, xp, money,
          playerBytes, playerBytes2, playerFlags,
          position_x, position_y, position_z, map, dungeon_difficulty, orientation,
          taximask, online, cinematic,
          totaltime, leveltime, logout_time,
          is_logout_resting, rest_bonus,
          resettalents_cost, resettalents_time,
          trans_x, trans_y, trans_z, trans_o, transguid,
          extra_flags, stable_slots, at_login, zone,
          death_expire_time, taxi_path,
          arenaPoints, totalHonorPoints, todayHonorPoints, yesterdayHonorPoints,
          totalKills, todayKills, yesterdayKills,
          chosenTitle, watchedFaction, drunk,
          health, power1, power2, power3, power4, power5,
          exploredZones, equipmentCache, ammoId, knownTitles, actionBars
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, 0, ?,
          ?, 0, 0,
          ?, ?, ?,
          0, ?,
          ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, 4, ?,
          0, '',
          0, ?, 0, 0,
          ?, 0, 0,
          ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, '', ?, ?, ?
        )`,
        [
          newCharGuid, targetAccountId, src.name, src.race, src.class, src.gender, src.level, src.xp, src.money,
          playerBytes, playerBytes2, src.character_flags ?? 0,
          src.position_x, src.position_y, src.position_z, src.map, src.orientation,
          src.known_taxi_mask ?? "", src.played_time_total ?? 0, src.played_time_level ?? 0, src.logout_time ?? 0,
          src.rest_bonus ?? 0,
          resetTalentsCost(src.reset_talents_multiplier), src.reset_talents_time ?? 0,
          src.transport_x ?? 0, src.transport_y ?? 0, src.transport_z ?? 0, src.transport_o ?? 0, src.transport_guid ?? 0,
          src.extra_flags ?? 0, src.stable_slots ?? 0, src.zone ?? 0,
          Number(src.honor_stored_hk ?? 0), Number(src.stored_honorable_kills ?? 0),
          chosenTitle, src.watched_faction ?? -1, src.drunk ?? 0,
          src.health ?? 0, src.power1 ?? 0, src.power2 ?? 0, src.power3 ?? 0, src.power4 ?? 0, src.power5 ?? 0,
          src.explored_zones ?? "", src.ammo_id ?? 0, knownTitles, src.action_bars ?? 0,
        ],
      );

      // INSERT item_instance rows
      for (const item of srcItems) {
        const newGuid = itemGuidMap.get(item.guid as number)!;
        await tgtConn.execute(
          `INSERT INTO item_instance (
            guid, owner_guid, itemEntry, creatorGuid, giftCreatorGuid,
            count, duration, charges, flags, enchantments,
            randomPropertyId, durability, itemTextId
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newGuid, newCharGuid, item.item_id,
            item.creator_guid ?? 0, item.gift_creator_guid ?? 0,
            item.count ?? 1, item.duration ?? 0, item.charges ?? "",
            item.flags ?? 0, item.enchantments ?? "",
            item.random_property_id ?? 0, item.durability ?? 0,
            item.text ?? 0,
          ],
        );
      }

      // INSERT character_inventory rows
      for (const inv of srcInventory) {
        const oldItemGuid = inv.item as number;
        const newItemGuid = itemGuidMap.get(oldItemGuid);
        if (!newItemGuid) continue; // skip if item was not found
        // bag can also be an item guid that needs remapping
        let bag = inv.bag as number;
        if (bag !== 0) {
          const remappedBag = itemGuidMap.get(bag);
          if (remappedBag) bag = remappedBag;
        }
        await tgtConn.execute(
          `INSERT INTO character_inventory (guid, bag, slot, item, item_template)
           VALUES (?, ?, ?, ?, ?)`,
          [newCharGuid, bag, inv.slot, newItemGuid, inv.item_id ?? 0],
        );
      }

      // INSERT character_spell rows
      for (const sp of srcSpells) {
        await tgtConn.execute(
          `INSERT INTO character_spell (guid, spell, active, disabled)
           VALUES (?, ?, ?, ?)`,
          [newCharGuid, sp.spell, sp.active ?? 1, sp.disabled ?? 0],
        );
      }

      // INSERT character_skills rows
      for (const sk of srcSkills) {
        await tgtConn.execute(
          `INSERT INTO character_skills (guid, skill, value, max)
           VALUES (?, ?, ?, ?)`,
          [newCharGuid, sk.skill, sk.value, sk.max],
        );
      }

      // INSERT character_action rows
      for (const act of srcActions) {
        await tgtConn.execute(
          `INSERT INTO character_action (guid, button, action, type)
           VALUES (?, ?, ?, ?)`,
          [newCharGuid, act.button, act.action, act.type],
        );
      }

      // INSERT character_reputation rows
      for (const rep of srcReputation) {
        await tgtConn.execute(
          `INSERT INTO character_reputation (guid, faction, standing, flags)
           VALUES (?, ?, ?, ?)`,
          [newCharGuid, rep.faction, rep.standing, rep.flags],
        );
      }

      // INSERT character_queststatus rows
      for (const qs of srcQuests) {
        await tgtConn.execute(
          `INSERT INTO character_queststatus (guid, quest, status, rewarded, explored, timer, mobcount1, mobcount2, mobcount3, mobcount4, itemcount1, itemcount2, itemcount3, itemcount4)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newCharGuid, qs.quest, qs.status, qs.rewarded ?? 0, qs.explored ?? 0, qs.timer ?? 0,
            qs.mobcount1 ?? 0, qs.mobcount2 ?? 0, qs.mobcount3 ?? 0, qs.mobcount4 ?? 0,
            qs.itemcount1 ?? 0, qs.itemcount2 ?? 0, qs.itemcount3 ?? 0, qs.itemcount4 ?? 0,
          ],
        );
      }

      // INSERT character_homebind rows
      for (const hb of srcHomebind) {
        await tgtConn.execute(
          `INSERT INTO character_homebind (guid, map, zone, position_x, position_y, position_z)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [newCharGuid, hb.map, hb.zone, hb.position_x, hb.position_y, hb.position_z],
        );
      }

      await tgtConn.commit();

      return {
        success: true,
        message: `Character "${src.name}" transferred successfully to TBC (new ID: ${newCharGuid})`,
        newGuid: newCharGuid,
      };
    } catch (txErr) {
      await tgtConn.rollback();
      throw txErr;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[transfer-engine] Classic→TBC failed:", msg);
    return { success: false, message: `Transfer failed: ${msg}` };
  } finally {
    if (srcConn) await srcConn.end().catch(() => {});
    if (tgtConn) await tgtConn.end().catch(() => {});
  }
}

/* ═══════════════════════════════════════════════════════════
   TBC (CMaNGOS) → WotLK (AzerothCore)
   ═══════════════════════════════════════════════════════════ */

async function tbcToWotlk(
  characterGuid: number,
  sourceAccountId: number,
  targetAccountId: number,
): Promise<TransferResult> {
  let srcConn: Connection | null = null;
  let tgtConn: Connection | null = null;

  try {
    srcConn = await connect("tbc");
    tgtConn = await connect("wotlk");

    /* ── 1. Read source character ── */
    const [charRows] = await srcConn.execute<RowDataPacket[]>(
      "SELECT * FROM characters WHERE guid = ? AND account = ?",
      [characterGuid, sourceAccountId],
    );
    if (charRows.length === 0) {
      return { success: false, message: "Character not found or does not belong to this account" };
    }
    const src = charRows[0];

    /* ── 2. Must be offline ── */
    if (src.online !== 0) {
      return { success: false, message: "Character must be offline (logged out) to transfer" };
    }

    /* ── 3. Name collision check ── */
    const [nameCheck] = await tgtConn.execute<RowDataPacket[]>(
      "SELECT guid FROM characters WHERE name = ?",
      [src.name],
    );
    if (nameCheck.length > 0) {
      return { success: false, message: `Character name "${src.name}" already exists on WotLK realm` };
    }

    /* ── 4. Read related tables ── */
    const [srcItems] = await srcConn.execute<RowDataPacket[]>(
      "SELECT * FROM item_instance WHERE owner_guid = ?", [characterGuid]);
    const [srcInventory] = await srcConn.execute<RowDataPacket[]>(
      "SELECT * FROM character_inventory WHERE guid = ?", [characterGuid]);
    const [srcSpells] = await srcConn.execute<RowDataPacket[]>(
      "SELECT * FROM character_spell WHERE guid = ?", [characterGuid]);
    const [srcSkills] = await srcConn.execute<RowDataPacket[]>(
      "SELECT * FROM character_skills WHERE guid = ?", [characterGuid]);
    const [srcActions] = await srcConn.execute<RowDataPacket[]>(
      "SELECT * FROM character_action WHERE guid = ?", [characterGuid]);
    const [srcReputation] = await srcConn.execute<RowDataPacket[]>(
      "SELECT * FROM character_reputation WHERE guid = ?", [characterGuid]);
    const [srcQuests] = await srcConn.execute<RowDataPacket[]>(
      "SELECT * FROM character_queststatus WHERE guid = ?", [characterGuid]);
    const [srcHomebind] = await srcConn.execute<RowDataPacket[]>(
      "SELECT * FROM character_homebind WHERE guid = ?", [characterGuid]);

    /* ── 5. Allocate new guids ── */
    const [maxCharRow] = await tgtConn.execute<RowDataPacket[]>(
      "SELECT COALESCE(MAX(guid), 0) + 1 AS nextGuid FROM characters");
    const newCharGuid: number = maxCharRow[0].nextGuid;

    const [maxItemRow] = await tgtConn.execute<RowDataPacket[]>(
      "SELECT COALESCE(MAX(guid), 0) AS maxGuid FROM item_instance");
    let nextItemGuid: number = (maxItemRow[0].maxGuid as number) + 1;

    const itemGuidMap = new Map<number, number>();
    for (const item of srcItems) {
      itemGuidMap.set(item.guid as number, nextItemGuid);
      nextItemGuid++;
    }

    /* ── 6. Unpack playerBytes → individual columns ── */
    const pb = Number(src.playerBytes ?? 0);
    const pb2 = Number(src.playerBytes2 ?? 0);
    const skin = pb & 0xFF;
    const face = (pb >> 8) & 0xFF;
    const hairStyle = (pb >> 16) & 0xFF;
    const hairColor = (pb >> 24) & 0xFF;
    const facialStyle = pb2 & 0xFF;
    const bankSlots = (pb2 >> 16) & 0xFF;
    const restState = (pb2 >> 24) & 0xFF;

    /* ── 7. Begin target transaction ── */
    await tgtConn.beginTransaction();

    try {
      // INSERT character — AzerothCore uses individual appearance columns
      await tgtConn.execute(
        `INSERT INTO characters (
          guid, account, name, race, class, gender, level, xp, money,
          skin, face, hairStyle, hairColor, facialStyle, bankSlots, restState,
          playerFlags,
          position_x, position_y, position_z, map, instance_id, instance_mode_mask, orientation,
          taximask, online, cinematic,
          totaltime, leveltime, logout_time,
          is_logout_resting, rest_bonus,
          resettalents_cost, resettalents_time,
          trans_x, trans_y, trans_z, trans_o, transguid,
          extra_flags, stable_slots, at_login, zone,
          death_expire_time, taxi_path,
          arenaPoints, totalHonorPoints, todayHonorPoints, yesterdayHonorPoints,
          totalKills, todayKills, yesterdayKills,
          chosenTitle, knownCurrencies, watchedFaction, drunk,
          health, power1, power2, power3, power4, power5, power6, power7,
          exploredZones, equipmentCache, ammoId,
          knownTitles, actionBars,
          talentGroupsCount, activeTalentGroup,
          innTriggerId
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?,
          ?, ?, ?, ?, 0, 0, ?,
          ?, 0, 0,
          ?, ?, ?,
          0, ?,
          ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, 6, ?,
          0, '',
          0, ?, 0, 0,
          ?, 0, 0,
          ?, 0, ?, ?,
          ?, ?, ?, ?, ?, ?, 0, 0,
          ?, '', ?,
          ?, ?,
          1, 0,
          0
        )`,
        [
          newCharGuid, targetAccountId, src.name, src.race, src.class, src.gender, src.level, src.xp, src.money,
          skin, face, hairStyle, hairColor, facialStyle, bankSlots, restState,
          src.playerFlags ?? 0,
          src.position_x, src.position_y, src.position_z, src.map, src.orientation,
          src.taximask ?? "",
          src.totaltime ?? 0, src.leveltime ?? 0, src.logout_time ?? 0,
          src.rest_bonus ?? 0,
          src.resettalents_cost ?? 0, src.resettalents_time ?? 0,
          src.trans_x ?? 0, src.trans_y ?? 0, src.trans_z ?? 0, src.trans_o ?? 0, src.transguid ?? 0,
          src.extra_flags ?? 0, src.stable_slots ?? 0, src.zone ?? 0,
          Number(src.totalHonorPoints ?? 0), Number(src.totalKills ?? 0),
          src.chosenTitle ?? 0, src.watchedFaction ?? -1, src.drunk ?? 0,
          src.health ?? 0, src.power1 ?? 0, src.power2 ?? 0, src.power3 ?? 0, src.power4 ?? 0, src.power5 ?? 0,
          src.exploredZones ?? "", src.ammoId ?? 0,
          src.knownTitles ?? "0 0", src.actionBars ?? 0,
        ],
      );

      // Pre-insert achievement progress for criteria 4224 (money) to avoid WotLK crash
      if (Number(src.money ?? 0) > 0) {
        await tgtConn.execute(
          `INSERT INTO character_achievement_progress (guid, criteria, counter, date)
           VALUES (?, 4224, ?, UNIX_TIMESTAMP())`,
          [newCharGuid, src.money],
        );
      }

      // INSERT item_instance — AzerothCore adds playedTime, text is longtext
      for (const item of srcItems) {
        const newGuid = itemGuidMap.get(item.guid as number)!;
        await tgtConn.execute(
          `INSERT INTO item_instance (
            guid, itemEntry, owner_guid, creatorGuid, giftCreatorGuid,
            count, duration, charges, flags, enchantments,
            randomPropertyId, durability, playedTime, text
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '')`,
          [
            newGuid, item.itemEntry, newCharGuid,
            item.creatorGuid ?? 0, item.giftCreatorGuid ?? 0,
            item.count ?? 1, item.duration ?? 0, item.charges ?? "",
            item.flags ?? 0, item.enchantments ?? "",
            item.randomPropertyId ?? 0, item.durability ?? 0,
          ],
        );
      }

      // INSERT character_inventory — AzerothCore has no item_template column
      for (const inv of srcInventory) {
        const oldItemGuid = inv.item as number;
        const newItemGuid = itemGuidMap.get(oldItemGuid);
        if (!newItemGuid) continue;
        let bag = inv.bag as number;
        if (bag !== 0) {
          const remappedBag = itemGuidMap.get(bag);
          if (remappedBag) bag = remappedBag;
        }
        await tgtConn.execute(
          `INSERT INTO character_inventory (guid, bag, slot, item)
           VALUES (?, ?, ?, ?)`,
          [newCharGuid, bag, inv.slot, newItemGuid],
        );
      }

      // INSERT character_spell — AzerothCore uses specMask instead of active/disabled
      for (const sp of srcSpells) {
        const specMask = (sp.active ?? 1) ? 255 : 0; // 255 = all specs, 0 = none
        await tgtConn.execute(
          `INSERT INTO character_spell (guid, spell, specMask)
           VALUES (?, ?, ?)`,
          [newCharGuid, sp.spell, specMask],
        );
      }

      // INSERT character_skills
      for (const sk of srcSkills) {
        await tgtConn.execute(
          `INSERT INTO character_skills (guid, skill, value, max)
           VALUES (?, ?, ?, ?)`,
          [newCharGuid, sk.skill, sk.value, sk.max],
        );
      }

      // INSERT character_action — AzerothCore has spec column
      for (const act of srcActions) {
        await tgtConn.execute(
          `INSERT INTO character_action (guid, spec, button, action, type)
           VALUES (?, 0, ?, ?, ?)`,
          [newCharGuid, act.button, act.action, act.type],
        );
      }

      // INSERT character_reputation
      for (const rep of srcReputation) {
        await tgtConn.execute(
          `INSERT INTO character_reputation (guid, faction, standing, flags)
           VALUES (?, ?, ?, ?)`,
          [newCharGuid, rep.faction, rep.standing, rep.flags],
        );
      }

      // INSERT character_queststatus — AzerothCore has extra columns
      for (const qs of srcQuests) {
        await tgtConn.execute(
          `INSERT INTO character_queststatus (guid, quest, status, explored, timer, mobcount1, mobcount2, mobcount3, mobcount4, itemcount1, itemcount2, itemcount3, itemcount4, itemcount5, itemcount6, playercount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)`,
          [
            newCharGuid, qs.quest, qs.status, qs.explored ?? 0, qs.timer ?? 0,
            qs.mobcount1 ?? 0, qs.mobcount2 ?? 0, qs.mobcount3 ?? 0, qs.mobcount4 ?? 0,
            qs.itemcount1 ?? 0, qs.itemcount2 ?? 0, qs.itemcount3 ?? 0, qs.itemcount4 ?? 0,
          ],
        );
      }

      // INSERT character_homebind — AzerothCore column names differ
      for (const hb of srcHomebind) {
        await tgtConn.execute(
          `INSERT INTO character_homebind (guid, mapId, zoneId, posX, posY, posZ)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [newCharGuid, hb.map, hb.zone, hb.position_x, hb.position_y, hb.position_z],
        );
      }

      await tgtConn.commit();

      return {
        success: true,
        message: `Character "${src.name}" transferred successfully to WotLK (new ID: ${newCharGuid})`,
        newGuid: newCharGuid,
      };
    } catch (txErr) {
      await tgtConn.rollback();
      throw txErr;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[transfer-engine] TBC→WotLK failed:", msg);
    return { success: false, message: `Transfer failed: ${msg}` };
  } finally {
    if (srcConn) await srcConn.end().catch(() => {});
    if (tgtConn) await tgtConn.end().catch(() => {});
  }
}

/* ──────────────────────── value helpers ──────────────────────── */

/**
 * Convert VMaNGOS reset_talents_multiplier to CMaNGOS resettalents_cost (copper).
 * VMaNGOS stores a multiplier; CMaNGOS stores the actual cost.
 * Cost = multiplier * 1 gold (10000 copper), capped at 50g.
 */
function resetTalentsCost(multiplier: number | null | undefined): number {
  const m = Number(multiplier ?? 0);
  if (m <= 0) return 0;
  const cost = m * 10000; // 1g per multiplier
  return Math.min(cost, 500000); // cap 50g
}
