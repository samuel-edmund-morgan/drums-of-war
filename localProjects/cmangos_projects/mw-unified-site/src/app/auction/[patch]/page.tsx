"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { PATCH_INFO, VALID_PATCHES, type PatchId } from "@/lib/wow-constants";
import { formatGold } from "@/lib/gold";

const QUALITY_COLORS = ["#9d9d9d", "#ffffff", "#1eff00", "#0070dd", "#a335ee", "#ff8000", "#e6cc80"];
const QUALITY_NAMES  = ["Poor", "Common", "Uncommon", "Rare", "Epic", "Legendary", "Artifact"];

interface AHItem {
  itemEntry:  number;
  itemName:   string;
  quality:    number;
  quantity:   number;
  buyout:     number | null;
  currentBid: number | null;
  seller:     string;
  expireTime: number | null;
  houseid:    number;
}

type SortKey = "name" | "quality" | "qty" | "seller" | "buyout" | "bid" | "expiry";
type HouseFilter = "all" | "alliance" | "horde" | "neutral";

function GoldDisplay({ copper }: { copper: number | null }) {
  if (copper == null || copper === 0) return <span className="text-[#444]">—</span>;
  const g = Math.floor(copper / 10000);
  const s = Math.floor((copper % 10000) / 100);
  const c = copper % 100;
  return (
    <span className="font-mono text-xs whitespace-nowrap">
      {g > 0 && <span className="text-[#ffd100]">{g}<span className="text-[#888]">g</span> </span>}
      {s > 0 && <span className="text-[#aaa]">{s}<span className="text-[#888]">s</span> </span>}
      <span className="text-[#cd7f32]">{c}<span className="text-[#888]">c</span></span>
    </span>
  );
}

function TimeLeft({ expire }: { expire: number | null }) {
  if (!expire) return <span className="text-[#444]">—</span>;
  const now = Math.floor(Date.now() / 1000);
  const sec = expire - now;
  if (sec <= 0) return <span className="text-[#666]">Expired</span>;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const color = h < 1 ? "#cc2200" : h < 6 ? "#ffa500" : "#9a9a9a";
  return (
    <span className="text-xs" style={{ color }}>
      {h > 0 ? `${h}h ${m}m` : `${m}m`}
    </span>
  );
}

export default function AuctionPage() {
  const { patch } = useParams<{ patch: string }>();
  const [items, setItems]     = useState<AHItem[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [search, setSearch]   = useState("");
  const [house, setHouse]     = useState<HouseFilter>("all");
  const [sort, setSort]       = useState<SortKey>("name");
  const [dir, setDir]         = useState<"asc" | "desc">("asc");
  const searchInput = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const PAGE_SIZE = 25;

  const load = useCallback((pg: number, q: string, h: string, s: string, d: string) => {
    if (!VALID_PATCHES.includes(patch as PatchId)) {
      setError("Invalid patch");
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({
      page:   String(pg),
      search: q,
      house:  h,
      sort:   s,
      dir:    d,
    });
    fetch(`/api/auction/${patch}?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else { setItems(data.items ?? []); setTotal(data.total ?? 0); }
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [patch]);

  useEffect(() => { load(page, search, house, sort, dir); }, [page, house, sort, dir, load]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      load(1, val, house, sort, dir);
    }, 400);
  };

  const handleSort = (key: SortKey) => {
    if (sort === key) {
      setDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSort(key);
      setDir("asc");
    }
    setPage(1);
  };

  const info = PATCH_INFO[patch as PatchId];
  const patchColor = info?.color ?? "#ffa500";
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const SortHeader = ({ col, label }: { col: SortKey; label: string }) => (
    <th
      className="px-3 py-3 cursor-pointer hover:text-[#ccc] transition-colors select-none"
      onClick={() => handleSort(col)}
    >
      {label} {sort === col ? (dir === "asc" ? "↑" : "↓") : ""}
    </th>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-[#e8e6e3]">
      <Navbar />
      <main className="pt-24 pb-16 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <Link href="/auction" className="text-sm text-[#666] hover:text-[#999] transition-colors">
              ← All Realms
            </Link>
            <div className="flex items-center justify-between mt-2">
              <div>
                <h1 className="text-3xl font-extrabold tracking-wider uppercase" style={{ color: patchColor }}>
                  {info?.label ?? patch} — Auction House
                </h1>
                <p className="text-[#666] text-sm mt-1">{info?.desc}</p>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold" style={{ color: patchColor }}>
                  {total.toLocaleString()}
                </div>
                <div className="text-xs text-[#666]">listings</div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-5">
            <input
              ref={searchInput}
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search item name..."
              className="flex-1 min-w-48 bg-[#141418] border border-[#2a2a32] rounded-lg px-4 py-2 text-sm placeholder-[#555] focus:outline-none focus:border-orange-500"
            />
            <div className="flex gap-1">
              {(["all", "alliance", "horde", "neutral"] as HouseFilter[]).map((h) => (
                <button
                  key={h}
                  onClick={() => { setHouse(h); setPage(1); }}
                  className="px-3 py-2 text-xs font-semibold rounded-lg transition-colors capitalize"
                  style={
                    house === h
                      ? { background: patchColor + "22", color: patchColor, border: `1px solid ${patchColor}` }
                      : { background: "#141418", color: "#666", border: "1px solid #2a2a32" }
                  }
                >
                  {h === "all" ? "All" : h.charAt(0).toUpperCase() + h.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="text-center text-red-400 py-8">{error}</div>}

          {!error && (
            <>
              <div className="border border-[#2a2a32] rounded-xl overflow-hidden mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#141418] text-[#9a9a9a] text-left text-xs uppercase">
                      <SortHeader col="name"    label="Item" />
                      <SortHeader col="quality" label="Quality" />
                      <SortHeader col="qty"     label="Qty" />
                      <SortHeader col="seller"  label="Seller" />
                      <SortHeader col="bid"     label="Bid" />
                      <SortHeader col="buyout"  label="Buyout" />
                      <SortHeader col="expiry"  label="Time Left" />
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-[#666]">Loading...</td>
                      </tr>
                    )}
                    {!loading && items.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-[#666]">No listings found.</td>
                      </tr>
                    )}
                    {!loading && items.map((item, i) => {
                      const qualityColor = QUALITY_COLORS[item.quality] ?? "#ffffff";
                      return (
                        <tr
                          key={`${item.itemEntry}-${i}`}
                          className="border-t border-[#1a1a20] hover:bg-[#141418] transition-colors"
                        >
                          <td className="px-3 py-2.5 max-w-[220px]">
                            <span className="font-semibold truncate block" style={{ color: qualityColor }}>
                              {item.itemName}
                            </span>
                            <span className="text-[#444] text-xs">#{item.itemEntry}</span>
                          </td>
                          <td className="px-3 py-2.5 text-xs" style={{ color: qualityColor }}>
                            {QUALITY_NAMES[item.quality] ?? "?"}
                          </td>
                          <td className="px-3 py-2.5 text-[#9a9a9a]">{item.quantity}</td>
                          <td className="px-3 py-2.5 text-[#9a9a9a] text-xs">{item.seller}</td>
                          <td className="px-3 py-2.5"><GoldDisplay copper={item.currentBid} /></td>
                          <td className="px-3 py-2.5"><GoldDisplay copper={item.buyout} /></td>
                          <td className="px-3 py-2.5"><TimeLeft expire={item.expireTime} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-4 py-2 text-sm rounded-lg bg-[#141418] border border-[#2a2a32] disabled:opacity-40 hover:bg-[#1a1a20] transition-colors"
                  >
                    ← Prev
                  </button>
                  <span className="text-sm text-[#9a9a9a]">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-4 py-2 text-sm rounded-lg bg-[#141418] border border-[#2a2a32] disabled:opacity-40 hover:bg-[#1a1a20] transition-colors"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
