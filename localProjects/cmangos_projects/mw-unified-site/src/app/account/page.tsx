"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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

const EXPANSION_CONFIG: Record<string, { label: string; badge: string }> = {
  classic: { label: "Classic", badge: "bg-yellow-700/80 text-yellow-200" },
  tbc: { label: "The Burning Crusade", badge: "bg-green-800/80 text-green-200" },
  wotlk: { label: "Wrath of the Lich King", badge: "bg-blue-800/80 text-blue-200" },
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

function formatPlayedTime(seconds: number): string {
  if (!seconds || seconds <= 0) return "0h";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function AccountPage() {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [roster, setRoster] = useState<Record<string, RosterChar[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [rosterLoading, setRosterLoading] = useState(true);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwError, setPwError] = useState("");

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
    }
    load();
  }, [router]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwSuccess("");
    setPwError("");

    if (newPassword.length < 4) {
      setPwError("New password must be at least 4 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match");
      return;
    }

    setPwLoading(true);
    try {
      const res = await fetch("/auth/password/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (data.status === "ok") {
        setPwSuccess("Password changed successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPwError(data.error || "Failed to change password");
      }
    } catch {
      setPwError("Connection error");
    } finally {
      setPwLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-[#0a0a0c] pt-24 px-4">
          <div className="max-w-4xl mx-auto text-center text-[#9a9a9a]">
            Loading...
          </div>
        </main>
      </>
    );
  }

  if (!session?.authenticated) return null;

  const identityUuid = session.identity_uuid || "—";

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0a0a0c] pt-24 pb-16 px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Page title */}
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-wider uppercase bg-gradient-to-b from-yellow-300 to-orange-500 bg-clip-text text-transparent">
            Account Management
          </h1>

          {/* Account Info Card */}
          <section className="bg-[#141418] border border-[#2a2a32] rounded-xl p-6">
            <h2 className="text-lg font-bold mb-4 bg-gradient-to-b from-yellow-400 to-orange-500 bg-clip-text text-transparent">
              Account Info
            </h2>
            <div className="mb-4">
              <p className="text-2xl font-bold text-[#ffa500]">
                {session.username}
              </p>
              <p className="text-xs text-[#666] mt-1 font-mono">
                {identityUuid}
              </p>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#666] border-b border-[#2a2a32]">
                  <th className="pb-2 font-medium">Server</th>
                  <th className="pb-2 font-medium">Account ID</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(["classic", "tbc", "wotlk"] as const).map((patch) => {
                  const id = session.accounts?.[patch];
                  const linked = id != null;
                  return (
                    <tr key={patch} className="border-b border-[#1a1a1e]">
                      <td className="py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-semibold ${EXPANSION_CONFIG[patch].badge}`}
                        >
                          {EXPANSION_CONFIG[patch].label}
                        </span>
                      </td>
                      <td className="py-2.5 text-[#e8e6e3] font-mono">
                        {linked ? id : "—"}
                      </td>
                      <td className="py-2.5">
                        {linked ? (
                          <span className="text-green-400 font-semibold text-xs">
                            Linked
                          </span>
                        ) : (
                          <span className="text-[#666] text-xs">
                            Not linked
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {/* Character Roster */}
          <section className="bg-[#141418] border border-[#2a2a32] rounded-xl p-6">
            <h2 className="text-lg font-bold mb-4 bg-gradient-to-b from-yellow-400 to-orange-500 bg-clip-text text-transparent">
              Character Roster
            </h2>

            {rosterLoading ? (
              <p className="text-[#9a9a9a] text-sm">Loading characters...</p>
            ) : !roster ? (
              <p className="text-[#9a9a9a] text-sm">
                Failed to load characters.
              </p>
            ) : (
              <div className="space-y-6">
                {(["classic", "tbc", "wotlk"] as const).map((patch) => {
                  const chars = roster[patch] || [];
                  const config = EXPANSION_CONFIG[patch];
                  return (
                    <div key={patch}>
                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-semibold ${config.badge}`}
                        >
                          {config.label}
                        </span>
                        <span className="text-xs text-[#666]">
                          {chars.length} character{chars.length !== 1 ? "s" : ""}
                        </span>
                      </div>

                      {chars.length === 0 ? (
                        <p className="text-[#666] text-sm ml-2 mb-2">
                          No characters on this server
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-[#666] border-b border-[#2a2a32]">
                                <th className="pb-2 font-medium">Name</th>
                                <th className="pb-2 font-medium">Level</th>
                                <th className="pb-2 font-medium">Race</th>
                                <th className="pb-2 font-medium">Class</th>
                                <th className="pb-2 font-medium">Played</th>
                              </tr>
                            </thead>
                            <tbody>
                              {chars.map((c) => (
                                <tr
                                  key={c.guid}
                                  className="border-b border-[#1a1a1e] hover:bg-[#1a1a20] transition-colors"
                                >
                                  <td className="py-2">
                                    <Link
                                      href={`/armory/character/${patch}/${c.guid}`}
                                      className="font-semibold hover:underline"
                                      style={{
                                        color:
                                          CLASS_COLORS[c.classId] || "#e8e6e3",
                                      }}
                                    >
                                      {c.name}
                                    </Link>
                                    {c.online && (
                                      <span className="ml-2 inline-block w-2 h-2 rounded-full bg-green-400" title="Online" />
                                    )}
                                  </td>
                                  <td className="py-2 text-[#e8e6e3]">
                                    {c.level}
                                  </td>
                                  <td className="py-2 text-[#e8e6e3]">
                                    {c.race}
                                  </td>
                                  <td
                                    className="py-2"
                                    style={{
                                      color:
                                        CLASS_COLORS[c.classId] || "#e8e6e3",
                                    }}
                                  >
                                    {c.className}
                                  </td>
                                  <td className="py-2 text-[#9a9a9a]">
                                    {formatPlayedTime(c.playedTime)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Change Password Card */}
          <section className="bg-[#141418] border border-[#2a2a32] rounded-xl p-6">
            <h2 className="text-lg font-bold mb-4 bg-gradient-to-b from-yellow-400 to-orange-500 bg-clip-text text-transparent">
              Change Password
            </h2>
            <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm text-[#9a9a9a] mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-[#0a0a0c] border border-[#2a2a32] text-[#e8e6e3] focus:border-[#ff6b00] focus:outline-none transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-[#9a9a9a] mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-[#0a0a0c] border border-[#2a2a32] text-[#e8e6e3] focus:border-[#ff6b00] focus:outline-none transition-colors"
                  required
                  minLength={4}
                />
              </div>
              <div>
                <label className="block text-sm text-[#9a9a9a] mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-[#0a0a0c] border border-[#2a2a32] text-[#e8e6e3] focus:border-[#ff6b00] focus:outline-none transition-colors"
                  required
                  minLength={4}
                />
              </div>

              {pwError && (
                <p className="text-sm text-[#cc3333]">{pwError}</p>
              )}
              {pwSuccess && (
                <p className="text-sm text-green-400">{pwSuccess}</p>
              )}

              <button
                type="submit"
                disabled={pwLoading}
                className="px-6 py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-[#ff6b00] to-[#ffa500] text-[#0a0a0c] hover:from-[#ff8c00] hover:to-[#ffb732] transition-all disabled:opacity-50"
              >
                {pwLoading ? "Changing..." : "Change Password"}
              </button>
            </form>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
