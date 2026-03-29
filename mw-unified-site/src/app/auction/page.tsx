"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import { PATCH_INFO, VALID_PATCHES } from "@/lib/wow-constants";

export default function AuctionLanding() {
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-[#e8e6e3]">
      <Navbar />
      <main className="pt-24 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-extrabold text-center tracking-wider uppercase bg-gradient-to-b from-yellow-300 to-orange-500 bg-clip-text text-transparent mb-2">
            Auction House
          </h1>
          <p className="text-center text-[#9a9a9a] mb-10">
            Browse live auction listings on each realm
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {VALID_PATCHES.map((patch) => {
              const info = PATCH_INFO[patch];
              return (
                <Link key={patch} href={`/auction/${patch}`}>
                  <div className="bg-[#141418] border border-[#2a2a32] rounded-xl p-6 hover:bg-[#1a1a20] transition-colors cursor-pointer group">
                    <div
                      className="text-xs font-bold uppercase tracking-widest mb-2"
                      style={{ color: info.color }}
                    >
                      {info.label}
                    </div>
                    <div className="text-xl font-bold text-[#e8e6e3] group-hover:text-white transition-colors mb-1">
                      {patch === "classic" ? "Classic" : patch === "tbc" ? "TBC" : "WotLK"}
                    </div>
                    <div className="text-sm text-[#666]">{info.desc}</div>
                    <div
                      className="mt-4 text-sm font-semibold"
                      style={{ color: info.color }}
                    >
                      Browse AH →
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
