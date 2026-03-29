"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getSession, type AuthSession } from "@/lib/auth";

const CLASS_COLORS: Record<number, string> = {
  1: "#C79C6E",  // Warrior
  2: "#F58CBA",  // Paladin
  3: "#ABD473",  // Hunter
  4: "#FFF569",  // Rogue
  5: "#FFFFFF",  // Priest
  6: "#C41F3B",  // Death Knight
  7: "#0070DE",  // Shaman
  8: "#40C7EB",  // Mage
  9: "#8787ED",  // Warlock
  11: "#FF7D0A", // Druid
};

const EXPANSION_CONFIG: Record<string, { label: string; short: string; badge: string; dot: string }> = {
  classic: { label: "Classic", short: "Classic", badge: "bg-yellow-700/80 text-yellow-200", dot: "bg-yellow-400" },
  tbc: { label: "The Burning Crusade", short: "TBC", badge: "bg-green-800/80 text-green-200", dot: "bg-green-400" },
  wotlk: { label: "Wrath of the Lich King", short: "WotLK", badge: "bg-blue-800/80 text-blue-200", dot: "bg-blue-400" },
};

const NEXT_EXPANSION: Record<string, string> = {
  classic: "tbc",
  tbc: "wotlk",
};

interface RosterChar {
  guid: number;
  name: string;
  level: number;
  race: string;
  raceId: number;
  className: string;
  classId: number;
  gender: number;
  online: boolean;
  playedTime: number;
}

interface TransferHistoryEntry {
  requestId: string;
  characterName: string;
  characterLevel: number;
  characterClass: string;
  characterRace: string;
  sourceRealm: string;
  targetRealm: string;
  status: "queued" | "processing" | "completed" | "failed";
  createdAt: string;
}

const STATUS_STYLES: Record<string, { label: string; classes: string }> = {
  queued: { label: "Queued", classes: "bg-yellow-900/60 text-yellow-300 border border-yellow-700/50" },
  processing: { label: "Processing", classes: "bg-blue-900/60 text-blue-300 border border-blue-700/50" },
  completed: { label: "Completed", classes: "bg-green-900/60 text-green-300 border border-green-700/50" },
  failed: { label: "Failed", classes: "bg-red-900/60 text-red-300 border border-red-700/50" },
};

export default function TransferPage() {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [roster, setRoster] = useState<Record<string, RosterChar[]> | null>(null);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [history, setHistory] = useState<TransferHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Transfer form state
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<RosterChar | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Eligibility state
  const [eligibilityCheck, setEligibilityCheck] = useState<string | null>(null);

  const targetRealm = selectedSource ? NEXT_EXPANSION[selectedSource] : null;

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/transfer/history", {
        credentials: "include",
        cache: "no-store",
      });
      if (res.ok) {
        setHistory(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    async function load() {
      const sess = await getSession();
      if (!sess.authenticated) {
        router.replace("/");
        return;
      }
      setSession(sess);
      setLoading(false);

      // Fetch roster
      try {
        const res = await fetch("/api/account/roster", {
          credentials: "include",
          cache: "no-store",
        });
        if (res.ok) {
          setRoster(await res.json());
        }
      } catch {
        // ignore
      } finally {
        setRosterLoading(false);
      }

      // Fetch history
      fetchHistory();
    }
    load();
  }, [router, fetchHistory]);

  // Check eligibility when character is selected
  useEffect(() => {
    if (!selectedCharacter || !selectedSource || !targetRealm || !roster) {
      setEligibilityCheck(null);
      return;
    }

    const targetChars = roster[targetRealm] || [];
    const nameExists = targetChars.some(
      (c) => c.name.toLowerCase() === selectedCharacter.name.toLowerCase()
    );

    if (nameExists) {
      setEligibilityCheck(
        `Character "${selectedCharacter.name}" already exists on ${EXPANSION_CONFIG[targetRealm].short}. Transfer is not possible.`
      );
    } else {
      setEligibilityCheck(null);
    }
  }, [selectedCharacter, selectedSource, targetRealm, roster]);

  const refreshRoster = async () => {
    try {
      const res = await fetch("/api/account/roster", {
        credentials: "include",
        cache: "no-store",
      });
      if (res.ok) {
        setRoster(await res.json());
      }
    } catch {
      // ignore
    }
  };

  const handleSubmit = async () => {
    if (!selectedCharacter || !selectedSource || !targetRealm) return;

    setSubmitting(true);
    setSubmitResult(null);

    try {
      const res = await fetch("/api/transfer/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          characterGuid: selectedCharacter.guid,
          sourceRealm: selectedSource,
          targetRealm,
        }),
      });

      const data = await res.json();

      if (res.ok && data.status === "ok") {
        const newGuidMsg = data.newGuid ? ` New character ID: ${data.newGuid}` : "";
        setSubmitResult({ ok: true, message: `Character transferred successfully!${newGuidMsg}` });
        setSelectedCharacter(null);
        setSelectedSource(null);
        // Refresh both roster and history
        refreshRoster();
        fetchHistory();
      } else {
        setSubmitResult({ ok: false, message: data.error || "Transfer failed" });
      }
    } catch {
      setSubmitResult({ ok: false, message: "Connection error" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-[#0a0a0c] pt-24 px-4">
          <div className="max-w-4xl mx-auto text-center text-[#9a9a9a]">Loading...</div>
        </main>
      </>
    );
  }

  if (!session?.authenticated) return null;

  const sourceOptions = (["classic", "tbc"] as const).filter(
    (patch) => roster && (roster[patch]?.length ?? 0) > 0
  );

  const sourceChars = selectedSource && roster ? roster[selectedSource] || [] : [];
  const canSubmit = selectedCharacter && !eligibilityCheck && !submitting;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0a0a0c] pt-24 pb-16 px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Page title */}
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-wider uppercase bg-gradient-to-b from-yellow-300 to-orange-500 bg-clip-text text-transparent">
            Character Transfer
          </h1>

          {/* Transfer Path Visualization */}
          <section className="bg-[#141418] border border-[#2a2a32] rounded-xl p-6">
            <h2 className="text-lg font-bold mb-4 bg-gradient-to-b from-yellow-400 to-orange-500 bg-clip-text text-transparent">
              Transfer Path
            </h2>
            <div className="flex items-center justify-center gap-2 sm:gap-4 py-4">
              {(["classic", "tbc", "wotlk"] as const).map((patch, idx) => {
                const config = EXPANSION_CONFIG[patch];
                const hasChars = roster && (roster[patch]?.length ?? 0) > 0;
                return (
                  <div key={patch} className="flex items-center gap-2 sm:gap-4">
                    <div className="flex flex-col items-center gap-2">
                      <div
                        className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 ${
                          hasChars
                            ? `${config.dot} border-transparent shadow-lg`
                            : "bg-[#1a1a1e] border-[#3a3a42]"
                        }`}
                        title={hasChars ? "You have characters here" : "No characters"}
                      />
                      <span
                        className={`text-xs sm:text-sm font-semibold ${
                          hasChars ? "text-[#e8e6e3]" : "text-[#555]"
                        }`}
                      >
                        {config.short}
                      </span>
                      {hasChars && (
                        <span className="text-[10px] text-[#888]">
                          {roster![patch].length} char{roster![patch].length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    {idx < 2 && (
                      <div className="flex items-center pb-6">
                        <svg
                          className="w-6 h-6 sm:w-8 sm:h-8 text-[#ffa500]"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M13 7l5 5m0 0l-5 5m5-5H6"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-center text-xs text-[#666] mt-2">
              Transfers are one-directional: Classic → TBC → WotLK
            </p>
          </section>

          {/* New Transfer Request */}
          <section className="bg-[#141418] border border-[#2a2a32] rounded-xl p-6">
            <h2 className="text-lg font-bold mb-4 bg-gradient-to-b from-yellow-400 to-orange-500 bg-clip-text text-transparent">
              New Transfer Request
            </h2>

            {rosterLoading ? (
              <p className="text-[#9a9a9a] text-sm">Loading characters...</p>
            ) : !roster ? (
              <p className="text-[#9a9a9a] text-sm">Failed to load characters.</p>
            ) : sourceOptions.length === 0 ? (
              <p className="text-[#9a9a9a] text-sm">
                No characters available for transfer. You need characters on Classic or TBC to initiate a transfer.
              </p>
            ) : (
              <div className="space-y-6">
                {/* Step 1: Select Source Expansion */}
                <div>
                  <label className="block text-sm text-[#9a9a9a] mb-2 font-medium">
                    Step 1: Select source expansion
                  </label>
                  <div className="flex gap-3">
                    {sourceOptions.map((patch) => {
                      const config = EXPANSION_CONFIG[patch];
                      const isSelected = selectedSource === patch;
                      return (
                        <button
                          key={patch}
                          onClick={() => {
                            setSelectedSource(patch);
                            setSelectedCharacter(null);
                            setSubmitResult(null);
                          }}
                          className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all border ${
                            isSelected
                              ? "border-[#ffa500] bg-[#ffa500]/10 text-[#ffa500]"
                              : "border-[#2a2a32] bg-[#0a0a0c] text-[#9a9a9a] hover:border-[#444] hover:text-[#ccc]"
                          }`}
                        >
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold mr-2 ${config.badge}`}>
                            {config.short}
                          </span>
                          {roster[patch]?.length ?? 0} characters
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 2: Select Character */}
                {selectedSource && (
                  <div>
                    <label className="block text-sm text-[#9a9a9a] mb-2 font-medium">
                      Step 2: Select character to transfer
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {sourceChars.map((c) => {
                        const isSelected = selectedCharacter?.guid === c.guid;
                        return (
                          <button
                            key={c.guid}
                            onClick={() => {
                              setSelectedCharacter(c);
                              setSubmitResult(null);
                            }}
                            className={`text-left p-3 rounded-lg border transition-all ${
                              isSelected
                                ? "border-[#ffa500] bg-[#ffa500]/5"
                                : "border-[#2a2a32] bg-[#0a0a0c] hover:border-[#444]"
                            }`}
                          >
                            <div
                              className="font-semibold text-sm"
                              style={{ color: CLASS_COLORS[c.classId] || "#e8e6e3" }}
                            >
                              {c.name}
                            </div>
                            <div className="text-xs text-[#888] mt-1">
                              Level {c.level} {c.race} {c.className}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Step 3: Target (auto-selected) */}
                {selectedCharacter && targetRealm && (
                  <div>
                    <label className="block text-sm text-[#9a9a9a] mb-2 font-medium">
                      Step 3: Target expansion
                    </label>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1.5 rounded text-xs font-semibold ${EXPANSION_CONFIG[selectedSource!].badge}`}>
                        {EXPANSION_CONFIG[selectedSource!].short}
                      </span>
                      <svg
                        className="w-5 h-5 text-[#ffa500]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      <span className={`px-3 py-1.5 rounded text-xs font-semibold ${EXPANSION_CONFIG[targetRealm].badge}`}>
                        {EXPANSION_CONFIG[targetRealm].short}
                      </span>
                    </div>
                  </div>
                )}

                {/* Eligibility warning */}
                {eligibilityCheck && (
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-red-950/30 border border-red-800/50">
                    <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-sm text-red-300">{eligibilityCheck}</p>
                  </div>
                )}

                {/* Step 4: Warning + Submit */}
                {selectedCharacter && targetRealm && !eligibilityCheck && (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-[#ffa500]/5 border border-[#ffa500]/20">
                      <svg className="w-5 h-5 text-[#ffa500] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-[#ccc]">
                        This will <strong className="text-[#ffa500]">copy</strong> your character{" "}
                        <strong style={{ color: CLASS_COLORS[selectedCharacter.classId] || "#e8e6e3" }}>
                          {selectedCharacter.name}
                        </strong>{" "}
                        to <strong className="text-[#e8e6e3]">{EXPANSION_CONFIG[targetRealm].label}</strong>.
                        The original will remain on{" "}
                        <strong className="text-[#e8e6e3]">{EXPANSION_CONFIG[selectedSource!].label}</strong>.
                        The character must be logged out. Transfer is instant.
                      </p>
                    </div>

                    <button
                      onClick={handleSubmit}
                      disabled={!canSubmit}
                      className="px-6 py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-[#ff6b00] to-[#ffa500] text-[#0a0a0c] hover:from-[#ff8c00] hover:to-[#ffb732] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? "Transferring character..." : "Transfer Now"}
                    </button>
                  </div>
                )}

                {/* Submit result */}
                {submitResult && (
                  <div
                    className={`p-4 rounded-lg text-sm ${
                      submitResult.ok
                        ? "bg-green-950/30 border border-green-800/50 text-green-300"
                        : "bg-red-950/30 border border-red-800/50 text-red-300"
                    }`}
                  >
                    {submitResult.message}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Transfer History */}
          <section className="bg-[#141418] border border-[#2a2a32] rounded-xl p-6">
            <h2 className="text-lg font-bold mb-4 bg-gradient-to-b from-yellow-400 to-orange-500 bg-clip-text text-transparent">
              Transfer History
            </h2>

            {historyLoading ? (
              <p className="text-[#9a9a9a] text-sm">Loading history...</p>
            ) : history.length === 0 ? (
              <p className="text-[#666] text-sm">No transfer requests yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[#666] border-b border-[#2a2a32]">
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium">Character</th>
                      <th className="pb-2 font-medium">From</th>
                      <th className="pb-2 font-medium">To</th>
                      <th className="pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((entry) => {
                      const statusStyle = STATUS_STYLES[entry.status] || STATUS_STYLES.queued;
                      return (
                        <tr key={entry.requestId} className="border-b border-[#1a1a1e]">
                          <td className="py-2.5 text-[#9a9a9a]">
                            {new Date(entry.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </td>
                          <td className="py-2.5">
                            <div className="text-[#e8e6e3] font-semibold">{entry.characterName}</div>
                            <div className="text-xs text-[#666]">
                              Lv.{entry.characterLevel} {entry.characterRace} {entry.characterClass}
                            </div>
                          </td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${EXPANSION_CONFIG[entry.sourceRealm]?.badge || ""}`}>
                              {EXPANSION_CONFIG[entry.sourceRealm]?.short || entry.sourceRealm}
                            </span>
                          </td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${EXPANSION_CONFIG[entry.targetRealm]?.badge || ""}`}>
                              {EXPANSION_CONFIG[entry.targetRealm]?.short || entry.targetRealm}
                            </span>
                          </td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusStyle.classes}`}>
                              {statusStyle.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
