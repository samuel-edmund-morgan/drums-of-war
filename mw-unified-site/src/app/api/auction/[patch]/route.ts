import { NextRequest, NextResponse } from "next/server";
import { withConnection, type Patch } from "@/lib/db";
import { VALID_PATCHES, type PatchId } from "@/lib/wow-constants";
import type { RowDataPacket } from "mysql2/promise";

const PAGE_SIZE = 25;

const WORLD_DBS: Record<Patch, string> = {
  classic: process.env.CLASSIC_WORLDDB || "mangos",
  tbc:     process.env.TBC_WORLDDB     || "tbcmangos",
  wotlk:   process.env.WOTLK_WORLDDB   || "acore_world",
};

const SORT_COLUMNS: Record<string, string> = {
  name:    "itemName",
  quality: "quality",
  qty:     "quantity",
  seller:  "seller",
  buyout:  "buyout",
  bid:     "currentBid",
  expiry:  "expireTime",
};

function buildHouseFilter(patch: Patch, house: string): string {
  const col = patch === "wotlk" ? "ah.houseId" : "ah.houseid";
  if (house === "alliance") return `AND ${col} IN (1,2,3)`;
  if (house === "horde")    return `AND ${col} IN (4,5,6)`;
  if (house === "neutral")  return `AND ${col} = 7`;
  return "";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ patch: string }> }
) {
  const { patch } = await params;
  if (!VALID_PATCHES.includes(patch as PatchId)) {
    return NextResponse.json({ error: "Invalid patch" }, { status: 400 });
  }
  const p = patch as Patch;

  const page    = Math.max(1, Number(req.nextUrl.searchParams.get("page")  ?? 1));
  const search  = (req.nextUrl.searchParams.get("search") || "").trim().slice(0, 64);
  const house   = req.nextUrl.searchParams.get("house") || "all";
  const sortKey = req.nextUrl.searchParams.get("sort")  || "name";
  const dir     = req.nextUrl.searchParams.get("dir")   === "desc" ? "DESC" : "ASC";
  const offset  = (page - 1) * PAGE_SIZE;

  const sortCol = SORT_COLUMNS[sortKey] || "itemName";
  const worldDb = WORLD_DBS[p];
  const houseFilter = buildHouseFilter(p, house);
  const searchFilter = search ? "AND itm.name LIKE ?" : "";
  const searchParam: string[] = search ? [`%${search}%`] : [];

  try {
    let rows: RowDataPacket[];
    let countRow: RowDataPacket | null;

    if (p === "wotlk") {
      const sql = `
        SELECT
          iins.itemEntry AS itemEntry,
          itm.name       AS itemName,
          itm.Quality    AS quality,
          COALESCE(iins.count, 1) AS quantity,
          IF(ah.buyoutprice > 0, ah.buyoutprice, NULL) AS buyout,
          IF(ah.lastbid    > 0, ah.lastbid, ah.startbid) AS currentBid,
          sell.name       AS seller,
          ah.etime        AS expireTime,
          ah.houseId      AS houseid
        FROM auctionhouse ah
        LEFT JOIN item_instance iins ON ah.itemguid = iins.guid
        LEFT JOIN \`${worldDb}\`.item_template itm ON iins.itemEntry = itm.entry
        LEFT JOIN characters sell ON ah.itemowner = sell.guid
        WHERE iins.guid IS NOT NULL
          ${houseFilter}
          ${searchFilter}
        ORDER BY ${sortCol} ${dir}
        LIMIT ? OFFSET ?`;

      const countSql = `
        SELECT COUNT(*) AS total
        FROM auctionhouse ah
        LEFT JOIN item_instance iins ON ah.itemguid = iins.guid
        LEFT JOIN \`${worldDb}\`.item_template itm ON iins.itemEntry = itm.entry
        WHERE iins.guid IS NOT NULL
          ${houseFilter}
          ${searchFilter}`;

      [rows, [countRow]] = await Promise.all([
        withConnection(p, "char", async (conn) => {
          const [r] = await conn.execute<RowDataPacket[]>(sql, [...searchParam, PAGE_SIZE, offset]);
          return r;
        }),
        withConnection(p, "char", async (conn) => {
          const [r] = await conn.execute<RowDataPacket[]>(countSql, [...searchParam]);
          return r;
        }),
      ]);
    } else {
      const sql = `
        SELECT
          ah.item_template AS itemEntry,
          itm.name         AS itemName,
          itm.Quality      AS quality,
          COALESCE(iins.count, 1) AS quantity,
          IF(ah.buyoutprice > 0, ah.buyoutprice, NULL) AS buyout,
          IF(ah.lastbid    > 0, ah.lastbid, ah.startbid) AS currentBid,
          sell.name        AS seller,
          ah.time          AS expireTime,
          ah.houseid       AS houseid
        FROM auction ah
        LEFT JOIN \`${worldDb}\`.item_template itm ON ah.item_template = itm.entry
        LEFT JOIN characters sell ON ah.itemowner = sell.guid
        LEFT JOIN item_instance iins ON ah.itemguid = iins.guid
        WHERE ah.item_template > 0
          ${houseFilter}
          ${searchFilter}
        ORDER BY ${sortCol} ${dir}
        LIMIT ? OFFSET ?`;

      const countSql = `
        SELECT COUNT(*) AS total
        FROM auction ah
        LEFT JOIN \`${worldDb}\`.item_template itm ON ah.item_template = itm.entry
        WHERE ah.item_template > 0
          ${houseFilter}
          ${searchFilter}`;

      [rows, [countRow]] = await Promise.all([
        withConnection(p, "char", async (conn) => {
          const [r] = await conn.execute<RowDataPacket[]>(sql, [...searchParam, PAGE_SIZE, offset]);
          return r;
        }),
        withConnection(p, "char", async (conn) => {
          const [r] = await conn.execute<RowDataPacket[]>(countSql, [...searchParam]);
          return r;
        }),
      ]);
    }

    return NextResponse.json({
      items: rows.map((r) => ({
        itemEntry:  Number(r.itemEntry  ?? 0),
        itemName:   r.itemName   ?? "Unknown",
        quality:    Number(r.quality    ?? 0),
        quantity:   Number(r.quantity   ?? 1),
        buyout:     r.buyout    != null ? Number(r.buyout)     : null,
        currentBid: r.currentBid != null ? Number(r.currentBid) : null,
        seller:     r.seller    ?? "Unknown",
        expireTime: r.expireTime != null ? Number(r.expireTime) : null,
        houseid:    Number(r.houseid ?? 0),
      })),
      total:    Number(countRow?.total ?? 0),
      page,
      pageSize: PAGE_SIZE,
      patch:    p,
    });
  } catch (err) {
    console.error("[api/auction] Error:", err);
    return NextResponse.json({ error: "Failed to load auction data" }, { status: 500 });
  }
}
