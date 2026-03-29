import { NextRequest, NextResponse } from "next/server";
import { queryAll, queryOne } from "@/lib/db";
import { VALID_PATCHES, type PatchId } from "@/lib/wow-constants";
import type { RowDataPacket } from "mysql2/promise";

const MAX_LEVEL: Record<PatchId, number> = { classic: 60, tbc: 70, wotlk: 80 };

function buildLevelBucketsSQL(maxLvl: number): string {
  const buckets = [
    "WHEN level BETWEEN 1 AND 9 THEN '1-9'",
    "WHEN level BETWEEN 10 AND 19 THEN '10-19'",
    "WHEN level BETWEEN 20 AND 29 THEN '20-29'",
    "WHEN level BETWEEN 30 AND 39 THEN '30-39'",
    "WHEN level BETWEEN 40 AND 49 THEN '40-49'",
    "WHEN level BETWEEN 50 AND 59 THEN '50-59'",
  ];
  if (maxLvl >= 70) buckets.push("WHEN level BETWEEN 60 AND 69 THEN '60-69'");
  if (maxLvl >= 80) buckets.push("WHEN level BETWEEN 70 AND 79 THEN '70-79'");
  const topBucket = `'${maxLvl}'`;
  return `
    SELECT
      CASE ${buckets.join(" ")} ELSE ${topBucket} END AS bucket,
      COUNT(*) AS count
    FROM characters
    GROUP BY bucket
    ORDER BY MIN(level) ASC
  `;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ patch: string }> }) {
  const { patch } = await params;
  if (!VALID_PATCHES.includes(patch as PatchId)) {
    return NextResponse.json({ error: "Invalid patch" }, { status: 400 });
  }
  const p = patch as PatchId;
  const maxLvl = MAX_LEVEL[p];

  try {
    const [raceCounts, classCounts, levelBuckets, accountRow, charCountRow] = await Promise.all([
      queryAll<RowDataPacket>(p, "char",  "SELECT race, COUNT(*) AS count FROM characters GROUP BY race"),
      queryAll<RowDataPacket>(p, "char",  "SELECT class, COUNT(*) AS count FROM characters GROUP BY class"),
      queryAll<RowDataPacket>(p, "char",  buildLevelBucketsSQL(maxLvl)),
      queryOne<RowDataPacket>(p, "realm", "SELECT COUNT(*) AS total FROM account"),
      queryOne<RowDataPacket>(p, "char",  "SELECT COUNT(*) AS total FROM characters"),
    ]);

    return NextResponse.json({
      raceCounts:    raceCounts.map(r => ({ race: r.race, count: Number(r.count) })),
      classCounts:   classCounts.map(r => ({ class: r.class, count: Number(r.count) })),
      levelBuckets:  levelBuckets.map(r => ({ bucket: r.bucket, count: Number(r.count) })),
      totalAccounts: Number(accountRow?.total ?? 0),
      totalChars:    Number(charCountRow?.total ?? 0),
      patch: p,
      maxLevel: maxLvl,
    });
  } catch (err) {
    console.error("[api/stats] Error:", err);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
