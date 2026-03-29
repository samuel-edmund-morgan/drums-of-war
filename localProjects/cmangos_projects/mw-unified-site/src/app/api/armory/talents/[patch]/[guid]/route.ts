import { NextRequest, NextResponse } from "next/server";
import { RowDataPacket } from "mysql2/promise";
import { queryOne, queryAll, type Patch } from "@/lib/db";

const ARMORY_DB: Record<Patch, string> = {
  classic: "classicarmory",
  tbc:     "tbcarmory",
  wotlk:   "wotlkarmory",
};

const TALENT_AVAILABLE: Record<Patch, boolean> = {
  classic: true,
  tbc:     true,
  wotlk:   true,
};

/* ── Spell data for description formatting ── */

interface SpellData {
  id: number;
  effect_basepoints_1: number; effect_basepoints_2: number; effect_basepoints_3: number;
  effect_die_sides_1: number; effect_die_sides_2: number; effect_die_sides_3: number;
  ref_spellduration: number; proc_chance: number;
}

interface DurationRow extends RowDataPacket { id: number; duration: number; }

function spellValue(sp: SpellData, idx: number): number {
  const bp = [sp.effect_basepoints_1, sp.effect_basepoints_2, sp.effect_basepoints_3][idx] ?? 0;
  const ds = [sp.effect_die_sides_1, sp.effect_die_sides_2, sp.effect_die_sides_3][idx] ?? 0;
  return bp + (ds > 0 ? 1 : 0);
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "";
  if (ms < 60000) return `${Math.round(ms / 1000)} sec`;
  if (ms < 3600000) return `${Math.round(ms / 60000)} min`;
  return `${Math.round(ms / 3600000)} hr`;
}

function resolveDesc(
  desc: string,
  selfSpell: SpellData | undefined,
  spellMap: Map<number, SpellData>,
  durMap: Map<number, number>,
): string {
  if (!desc) return "";

  function fmtDiv(val: number, div: number): string {
    const r = Math.abs(val / div);
    return r === Math.floor(r) ? String(r) : r.toFixed(1).replace(/\.0$/, "");
  }

  return desc
    // $/divisor;XYZsN — cross-ref with divisor
    .replace(/\$\/(\d+);(\d+)([smSM])(\d)/g, (_m, div, refId, _code, n) => {
      const sp = spellMap.get(Number(refId));
      if (!sp) return "X";
      return fmtDiv(spellValue(sp, Number(n) - 1), Number(div));
    })
    // $/divisor;sN — self with divisor
    .replace(/\$\/(\d+);([smSM])(\d)/g, (_m, div, _code, n) => {
      if (!selfSpell) return "X";
      return fmtDiv(spellValue(selfSpell, Number(n) - 1), Number(div));
    })
    // $XYZsN — cross-ref spell effect value
    .replace(/\$(\d+)[smSM](\d)/g, (_m, refId, n) => {
      const sp = spellMap.get(Number(refId));
      if (!sp) return "X";
      return String(Math.abs(spellValue(sp, Number(n) - 1)));
    })
    // $XYZd — cross-ref spell duration
    .replace(/\$(\d+)d/gi, (_m, refId) => {
      const sp = spellMap.get(Number(refId));
      if (!sp) return "X";
      const ms = durMap.get(sp.ref_spellduration);
      return ms != null ? formatDuration(ms) : "X";
    })
    // $sN, $mN — self effect value
    .replace(/\$[smSM](\d)/g, (_m, n) => {
      if (!selfSpell) return "X";
      return String(Math.abs(spellValue(selfSpell, Number(n) - 1)));
    })
    // $d — self duration
    .replace(/\$d/gi, () => {
      if (!selfSpell) return "X";
      const ms = durMap.get(selfSpell.ref_spellduration);
      return ms != null ? formatDuration(ms) : "X";
    })
    // $h — proc chance
    .replace(/\$h/gi, () => selfSpell ? String(selfSpell.proc_chance) : "X")
    // Remaining unknown tokens → strip
    .replace(/\$\{?\w+\}?/g, "")
    .trim();
}

interface CharRow extends RowDataPacket { class: number; level: number; at_login: number; }
interface TabRow extends RowDataPacket { id: number; name: string; tab_number: number; }
interface TalentRow extends RowDataPacket {
  id: number; ref_talenttab: number; row: number; col: number;
  rank1: number; rank2: number; rank3: number; rank4: number; rank5: number;
}
interface SpellInfoRow extends RowDataPacket {
  id: number; name: string; description: string; icon_name: string;
  effect_basepoints_1: number; effect_basepoints_2: number; effect_basepoints_3: number;
  effect_die_sides_1: number; effect_die_sides_2: number; effect_die_sides_3: number;
  ref_spellduration: number; proc_chance: number;
}
interface SpellRow extends RowDataPacket { spell: number; }

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ patch: string; guid: string }> }
) {
  const { patch: patchParam, guid: guidParam } = await params;
  const patch = patchParam as Patch;
  const guid = Number(guidParam);

  if (!["classic", "tbc", "wotlk"].includes(patch) || isNaN(guid)) {
    return NextResponse.json({ error: "Invalid patch or guid" }, { status: 400 });
  }

  const armory = ARMORY_DB[patch];

  // Early return for patches without proper DBC data
  if (!TALENT_AVAILABLE[patch]) {
    return NextResponse.json({ available: false, tabs: [] });
  }

  try {
    // 1. Get character class and at_login flags
    // VMaNGOS (classic) has no at_login column; CMaNGOS/AzerothCore do
    const charSql = patch === "classic"
      ? "SELECT class, level, 0 AS at_login FROM characters WHERE guid = ? LIMIT 1"
      : "SELECT class, level, at_login FROM characters WHERE guid = ? LIMIT 1";
    const char = await queryOne<CharRow>(patch, "char", charSql, [guid]);
    if (!char) return NextResponse.json({ error: "Character not found" }, { status: 404 });

    const classId = char.class;
    const classMask = 1 << (classId - 1);
    // AT_LOGIN_RESET_TALENTS = 0x04 — talents pending reset on next login
    const talentsPendingReset = (char.at_login & 0x04) !== 0;

    // 2. Get talent tabs for this class
    const tabs = await queryAll<TabRow>(
      patch, "char",
      `SELECT id, name, tab_number FROM \`${armory}\`.dbc_talenttab
       WHERE (refmask_chrclasses & ?) != 0
       ORDER BY tab_number ASC`,
      [classMask]
    );

    if (tabs.length === 0) {
      return NextResponse.json({ available: true, tabs: [] });
    }

    const tabIds = tabs.map(t => t.id);

    // 3. Get all talents (rank spell IDs only — no spell join yet)
    const placeholders = tabIds.map(() => "?").join(",");
    const talents = await queryAll<TalentRow>(
      patch, "char",
      `SELECT id, ref_talenttab, \`row\`, col, rank1, rank2, rank3, rank4, rank5
       FROM \`${armory}\`.dbc_talent
       WHERE ref_talenttab IN (${placeholders})
       ORDER BY ref_talenttab, \`row\`, col`,
      tabIds
    );

    // 4. Get character's known talent spells
    let knownSpells: Set<number>;
    if (talentsPendingReset) {
      // Talents will be wiped on next login — show empty tree
      knownSpells = new Set();
    } else if (patch === "wotlk") {
      const talentRows = await queryAll<SpellRow>(
        patch, "char",
        "SELECT spell FROM character_talent WHERE guid = ? AND (specMask & 1) != 0",
        [guid]
      ).catch(() => []);
      knownSpells = new Set(talentRows.map(r => r.spell));
    } else {
      const spellRows = await queryAll<SpellRow>(
        patch, "char",
        "SELECT spell FROM character_spell WHERE guid = ? AND disabled = 0",
        [guid]
      ).catch(() => []);
      knownSpells = new Set(spellRows.map(r => r.spell));
    }

    // 5. Determine currentRank per talent and collect display spell IDs
    const talentMeta: { t: TalentRow; maxRank: number; currentRank: number; displaySpellId: number }[] = [];
    const neededSpellIds = new Set<number>();
    for (const t of talents) {
      const ranks = [t.rank1, t.rank2, t.rank3, t.rank4, t.rank5];
      let maxRank = 0;
      for (let r = 4; r >= 0; r--) { if (ranks[r] > 0) { maxRank = r + 1; break; } }
      let currentRank = 0;
      for (let r = maxRank; r >= 1; r--) {
        if (ranks[r - 1] > 0 && knownSpells.has(ranks[r - 1])) { currentRank = r; break; }
      }
      // Show active rank's spell, or rank1 for unlearned talents
      const displaySpellId = currentRank > 0 ? ranks[currentRank - 1] : t.rank1;
      if (displaySpellId > 0) neededSpellIds.add(displaySpellId);
      // Also always need rank1 for icon (icon doesn't change between ranks)
      if (t.rank1 > 0) neededSpellIds.add(t.rank1);
      talentMeta.push({ t, maxRank, currentRank, displaySpellId });
    }

    // 6. Batch-fetch all needed spells with effect data + icon
    const spellInfoMap = new Map<number, SpellInfoRow>();
    const spellMap = new Map<number, SpellData>();
    if (neededSpellIds.size > 0) {
      const spPh = [...neededSpellIds].map(() => "?").join(",");
      const spells = await queryAll<SpellInfoRow>(
        patch, "char",
        `SELECT s.id,
                COALESCE(s.name, 'Unknown') AS name,
                COALESCE(s.description, '') AS description,
                COALESCE(i.name, 'inv_misc_questionmark') AS icon_name,
                s.effect_basepoints_1, s.effect_basepoints_2, s.effect_basepoints_3,
                s.effect_die_sides_1, s.effect_die_sides_2, s.effect_die_sides_3,
                s.ref_spellduration, s.proc_chance
         FROM \`${armory}\`.dbc_spell s
         LEFT JOIN \`${armory}\`.dbc_spellicon i ON i.id = s.ref_spellicon
         WHERE s.id IN (${spPh})`,
        [...neededSpellIds],
      );
      for (const s of spells) {
        spellInfoMap.set(s.id, s);
        spellMap.set(s.id, {
          id: s.id,
          effect_basepoints_1: s.effect_basepoints_1,
          effect_basepoints_2: s.effect_basepoints_2,
          effect_basepoints_3: s.effect_basepoints_3,
          effect_die_sides_1: s.effect_die_sides_1,
          effect_die_sides_2: s.effect_die_sides_2,
          effect_die_sides_3: s.effect_die_sides_3,
          ref_spellduration: s.ref_spellduration,
          proc_chance: s.proc_chance,
        });
      }
    }

    // 7. Collect cross-referenced spell IDs from descriptions & fetch missing
    const crossRefIds = new Set<number>();
    for (const { displaySpellId } of talentMeta) {
      const info = spellInfoMap.get(displaySpellId);
      if (!info) continue;
      for (const m of (info.description || "").matchAll(/\$(\d+)[smSMdD]/g)) crossRefIds.add(Number(m[1]));
      for (const m of (info.description || "").matchAll(/\$\/\d+;(\d+)[smSM]/g)) crossRefIds.add(Number(m[1]));
    }
    const missingIds = [...crossRefIds].filter(id => !spellMap.has(id));
    if (missingIds.length > 0) {
      const refPh = missingIds.map(() => "?").join(",");
      const refSpells = await queryAll<SpellData & RowDataPacket>(
        patch, "char",
        `SELECT id, effect_basepoints_1, effect_basepoints_2, effect_basepoints_3,
                effect_die_sides_1, effect_die_sides_2, effect_die_sides_3,
                ref_spellduration, proc_chance
         FROM \`${armory}\`.dbc_spell WHERE id IN (${refPh})`,
        missingIds,
      ).catch(() => []);
      for (const s of refSpells) spellMap.set(s.id, s);
    }

    // 8. Fetch duration data
    const durIds = new Set<number>();
    for (const sp of spellMap.values()) { if (sp.ref_spellduration > 0) durIds.add(sp.ref_spellduration); }
    const durMap = new Map<number, number>();
    if (durIds.size > 0) {
      const durPh = [...durIds].map(() => "?").join(",");
      const durRows = await queryAll<DurationRow>(
        patch, "char",
        `SELECT id, duration FROM \`${armory}\`.dbc_spellduration WHERE id IN (${durPh})`,
        [...durIds],
      ).catch(() => []);
      for (const d of durRows) durMap.set(d.id, d.duration);
    }

    // 9. Build response
    const result = tabs.map(tab => {
      const tabEntries = talentMeta.filter(e => e.t.ref_talenttab === tab.id);
      let totalPoints = 0;

      const talentList = tabEntries.map(({ t, maxRank, currentRank, displaySpellId }) => {
        totalPoints += currentRank;

        const displaySpell = spellInfoMap.get(displaySpellId);
        // Icon comes from rank1 (doesn't change between ranks)
        const rank1Spell = spellInfoMap.get(t.rank1);
        const iconName = ((rank1Spell?.icon_name) || "inv_misc_questionmark").toLowerCase().replace(/[^a-z0-9_]/g, "");
        const selfSpell = displaySpellId > 0 ? spellMap.get(displaySpellId) : undefined;

        return {
          id: t.id,
          row: t.row,
          col: t.col,
          maxRank,
          currentRank,
          name: displaySpell?.name || rank1Spell?.name || "Unknown",
          description: resolveDesc(displaySpell?.description || "", selfSpell, spellMap, durMap),
          icon: iconName,
        };
      });

      return {
        id: tab.id,
        name: tab.name,
        tabNumber: tab.tab_number,
        bgImage: `/talent-bg/${tab.id}.jpg`,
        totalPoints,
        talents: talentList,
      };
    });

    return NextResponse.json({ available: true, tabs: result }, {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
    });
  } catch (err) {
    return NextResponse.json({ error: "Database error", message: String(err) }, { status: 500 });
  }
}
