"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { getSession, type AuthSession } from "@/lib/auth";
import Navbar from "@/components/Navbar";

interface ServerInfo {
  name: string;
  patch: string;
  status: "online" | "offline" | "unknown";
  playersOnline: number;
  totalAccounts: number;
  totalCharacters: number;
  uptime: number;
}

interface RecentLogin {
  username: string;
  server: string;
  last_login: string;
  last_ip: string;
}

interface AccountEntry {
  id: number;
  username: string;
  server: string;
  gmlevel: number;
  last_login: string;
  last_ip: string;
  online: boolean;
}

interface DashboardData {
  servers: ServerInfo[];
  recentLogins: RecentLogin[];
}

const GM_LABELS: Record<number, string> = {
  0: "Player",
  1: "Moderator",
  2: "Game Master",
  3: "Administrator",
};

function formatUptime(seconds: number): string {
  if (!seconds) return "N/A";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "Never";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export default function AdminPage() {
  const [session, setSession] = useState<AuthSession>({ authenticated: false });
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [accounts, setAccounts] = useState<AccountEntry[]>([]);
  const [accountPage, setAccountPage] = useState(1);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getSession().then((s) => {
      setSession(s);
      setLoading(false);
    });
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/dashboard", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setDashboard(data);
    } catch {
      setError("Failed to load dashboard data");
    }
  }, []);

  const fetchAccounts = useCallback(async (page: number) => {
    setAccountsLoading(true);
    try {
      const res = await fetch(`/api/admin/accounts?page=${page}`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      setAccounts(data.accounts);
      setAccountPage(page);
    } catch {
      // ignore
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session.authenticated && (session.gmlevel ?? 0) >= 3) {
      fetchDashboard();
      fetchAccounts(1);
    }
  }, [session, fetchDashboard, fetchAccounts]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c]">
        <Navbar />
        <div className="flex items-center justify-center" style={{ minHeight: "calc(100vh - 64px)" }}>
          <div className="text-[#666] text-lg">Loading...</div>
        </div>
      </div>
    );
  }

  if (!session.authenticated || (session.gmlevel ?? 0) < 3) {
    return (
      <div className="min-h-screen bg-[#0a0a0c]">
        <Navbar />
        <div className="flex items-center justify-center" style={{ minHeight: "calc(100vh - 64px)" }}>
        <div className="text-center">
          <h1 className="text-3xl font-bold text-[#cc3333] mb-4">
            Access Denied
          </h1>
          <p className="text-[#9a9a9a]">
            You must be logged in as an Administrator (GM Level 3) to access
            this panel.
          </p>
          <Link
            href="/"
            className="inline-block mt-6 px-6 py-2 rounded-lg bg-[#1e1e24] border border-[#2a2a32] text-[#9a9a9a] hover:text-white hover:border-[#444] transition-colors"
          >
            Return Home
          </Link>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c]">
      <Navbar />
      <div className="pt-20 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-extrabold tracking-wider uppercase bg-gradient-to-r from-[#ff6b00] to-[#ffa500] bg-clip-text text-transparent">
            Admin Panel
          </h1>
          <p className="text-[#9a9a9a] mt-2">
            Logged in as{" "}
            <span className="text-[#ffa500] font-semibold">
              {session.username}
            </span>{" "}
            — {GM_LABELS[session.gmlevel ?? 0] ?? `GM Level ${session.gmlevel}`}
          </p>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-lg bg-[#331111] border border-[#cc3333] text-[#cc3333] text-sm">
            {error}
          </div>
        )}

        {/* Server Overview */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-[#e8e6e3] mb-4">
            Server Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {dashboard?.servers.map((srv) => (
              <div
                key={srv.patch}
                className="rounded-xl bg-[#141418] border border-[#2a2a32] p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-[#e8e6e3]">
                    {srv.name}
                  </h3>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      srv.status === "online"
                        ? "bg-[#0a2a0a] text-[#33cc33] border border-[#1a4a1a]"
                        : srv.status === "offline"
                          ? "bg-[#2a0a0a] text-[#cc3333] border border-[#4a1a1a]"
                          : "bg-[#2a2a0a] text-[#cccc33] border border-[#4a4a1a]"
                    }`}
                  >
                    {srv.status}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#666]">Players Online</span>
                    <span className="text-[#e8e6e3] font-semibold">
                      {srv.playersOnline}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#666]">Total Accounts</span>
                    <span className="text-[#e8e6e3]">{srv.totalAccounts}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#666]">Total Characters</span>
                    <span className="text-[#e8e6e3]">
                      {srv.totalCharacters}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#666]">Uptime</span>
                    <span className="text-[#e8e6e3]">
                      {formatUptime(srv.uptime)}
                    </span>
                  </div>
                </div>
              </div>
            )) ?? (
              <div className="col-span-3 text-center text-[#666] py-8">
                Loading server data...
              </div>
            )}
          </div>
        </section>

        {/* Server Management */}
        <ServerManagement />

        {/* Config Management */}
        <ConfigManager />

        {/* Remote Console */}
        <RemoteConsole />

        {/* Server Logs */}
        <LogViewer />

        {/* News Management */}
        <NewsManager />

        {/* Quick Actions */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-[#e8e6e3] mb-4">
            Quick Actions
          </h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowAnnounceModal(true)}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#ff6b00] to-[#ffa500] text-[#0a0a0c] font-semibold text-sm hover:from-[#ff8c00] hover:to-[#ffb732] transition-all"
            >
              Send Announcement
            </button>
            <button
              onClick={() => {
                fetchDashboard();
                fetchAccounts(accountPage);
              }}
              className="px-5 py-2.5 rounded-lg border border-[#2a2a32] text-[#9a9a9a] hover:text-white hover:border-[#444] transition-colors text-sm"
            >
              Refresh Data
            </button>
          </div>
        </section>

        {/* Recent Account Activity */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-[#e8e6e3] mb-4">
            Recent Account Activity
          </h2>
          <div className="rounded-xl bg-[#141418] border border-[#2a2a32] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2a2a32] bg-[#0e0e12]">
                    <th className="text-left px-4 py-3 text-[#666] font-semibold uppercase tracking-wider text-xs">
                      Username
                    </th>
                    <th className="text-left px-4 py-3 text-[#666] font-semibold uppercase tracking-wider text-xs">
                      Server
                    </th>
                    <th className="text-left px-4 py-3 text-[#666] font-semibold uppercase tracking-wider text-xs">
                      Last Login
                    </th>
                    <th className="text-left px-4 py-3 text-[#666] font-semibold uppercase tracking-wider text-xs">
                      Last IP
                    </th>
                    <th className="text-left px-4 py-3 text-[#666] font-semibold uppercase tracking-wider text-xs">
                      GM Level
                    </th>
                    <th className="text-left px-4 py-3 text-[#666] font-semibold uppercase tracking-wider text-xs">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {accountsLoading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-[#666]"
                      >
                        Loading...
                      </td>
                    </tr>
                  ) : accounts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-[#666]"
                      >
                        No accounts found
                      </td>
                    </tr>
                  ) : (
                    accounts.map((acc, idx) => (
                      <tr
                        key={`${acc.server}-${acc.id}-${idx}`}
                        className="border-b border-[#1e1e24] hover:bg-[#1a1a1e] transition-colors"
                      >
                        <td className="px-4 py-3 text-[#e8e6e3] font-semibold">
                          {acc.username}
                        </td>
                        <td className="px-4 py-3 text-[#9a9a9a]">
                          {acc.server}
                        </td>
                        <td className="px-4 py-3 text-[#9a9a9a]">
                          {formatDate(acc.last_login)}
                        </td>
                        <td className="px-4 py-3 text-[#666] font-mono text-xs">
                          {acc.last_ip}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              acc.gmlevel > 0
                                ? "text-[#ffa500] font-semibold"
                                : "text-[#666]"
                            }
                          >
                            {acc.gmlevel}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {acc.online ? (
                            <span className="text-[#33cc33] text-xs font-bold">
                              ONLINE
                            </span>
                          ) : (
                            <span className="text-[#666] text-xs">
                              offline
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#2a2a32] bg-[#0e0e12]">
              <button
                disabled={accountPage <= 1}
                onClick={() => fetchAccounts(accountPage - 1)}
                className="px-3 py-1.5 text-xs rounded border border-[#2a2a32] text-[#9a9a9a] hover:text-white hover:border-[#444] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-xs text-[#666]">Page {accountPage}</span>
              <button
                disabled={accounts.length === 0}
                onClick={() => fetchAccounts(accountPage + 1)}
                className="px-3 py-1.5 text-xs rounded border border-[#2a2a32] text-[#9a9a9a] hover:text-white hover:border-[#444] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </section>

        {/* Recent Logins (from dashboard data) */}
        {dashboard?.recentLogins && dashboard.recentLogins.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-bold text-[#e8e6e3] mb-4">
              Recent Logins (All Servers)
            </h2>
            <div className="rounded-xl bg-[#141418] border border-[#2a2a32] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#2a2a32] bg-[#0e0e12]">
                      <th className="text-left px-4 py-3 text-[#666] font-semibold uppercase tracking-wider text-xs">
                        Username
                      </th>
                      <th className="text-left px-4 py-3 text-[#666] font-semibold uppercase tracking-wider text-xs">
                        Server
                      </th>
                      <th className="text-left px-4 py-3 text-[#666] font-semibold uppercase tracking-wider text-xs">
                        Last Login
                      </th>
                      <th className="text-left px-4 py-3 text-[#666] font-semibold uppercase tracking-wider text-xs">
                        Last IP
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.recentLogins.map((login, idx) => (
                      <tr
                        key={`${login.server}-${login.username}-${idx}`}
                        className="border-b border-[#1e1e24] hover:bg-[#1a1a1e] transition-colors"
                      >
                        <td className="px-4 py-2.5 text-[#e8e6e3] font-semibold">
                          {login.username}
                        </td>
                        <td className="px-4 py-2.5 text-[#9a9a9a]">
                          {login.server}
                        </td>
                        <td className="px-4 py-2.5 text-[#9a9a9a]">
                          {formatDate(login.last_login)}
                        </td>
                        <td className="px-4 py-2.5 text-[#666] font-mono text-xs">
                          {login.last_ip}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Announcement Modal */}
      {showAnnounceModal && (
        <AnnounceModal onClose={() => setShowAnnounceModal(false)} />
      )}
      </div>
    </div>
  );
}

const SERVER_LABELS: Record<string, { name: string; color: string }> = {
  classic: { name: "Classic (VMaNGOS)", color: "#d4a017" },
  tbc: { name: "TBC (CMaNGOS)", color: "#1eff00" },
  wotlk: { name: "WotLK (AzerothCore)", color: "#0070dd" },
};

interface DeployLog {
  status: "idle" | "running" | "done" | "error";
  log?: string[];
  finishedAt?: string;
}

function ServerManagement() {
  const [confirm, setConfirm] = useState<{
    server: string;
    action: string;
  } | null>(null);
  const [deployLogs, setDeployLogs] = useState<Record<string, DeployLog>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const pollRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const stopPolling = (server: string) => {
    if (pollRef.current[server]) {
      clearInterval(pollRef.current[server]);
      delete pollRef.current[server];
    }
  };

  const startPolling = useCallback((server: string) => {
    stopPolling(server);
    pollRef.current[server] = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/server-action?server=${server}`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data: DeployLog = await res.json();
        setDeployLogs((prev) => ({ ...prev, [server]: data }));
        if (data.status === "done" || data.status === "error") {
          stopPolling(server);
          setLoading((prev) => ({ ...prev, [server]: false }));
        }
      } catch {
        // ignore
      }
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      Object.keys(pollRef.current).forEach(stopPolling);
    };
  }, []);

  const triggerAction = async (server: string, action: string) => {
    setLoading((prev) => ({ ...prev, [server]: true }));
    setDeployLogs((prev) => ({
      ...prev,
      [server]: { status: "running", log: [`Starting ${action}...`] },
    }));

    try {
      const res = await fetch("/api/admin/server-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ server, action }),
      });
      const data = await res.json();

      if (!res.ok) {
        setDeployLogs((prev) => ({
          ...prev,
          [server]: {
            status: "error",
            log: [data.error || "Request failed"],
          },
        }));
        setLoading((prev) => ({ ...prev, [server]: false }));
        return;
      }

      if (action === "update") {
        // Poll for async progress
        startPolling(server);
      } else {
        setDeployLogs((prev) => ({
          ...prev,
          [server]: { status: data.status, log: data.log },
        }));
        setLoading((prev) => ({ ...prev, [server]: false }));
      }
    } catch {
      setDeployLogs((prev) => ({
        ...prev,
        [server]: { status: "error", log: ["Connection error"] },
      }));
      setLoading((prev) => ({ ...prev, [server]: false }));
    }
  };

  const handleAction = (server: string, action: string) => {
    if (action === "stop" || action === "update" || action === "restart") {
      setConfirm({ server, action });
    } else {
      triggerAction(server, action);
    }
  };

  const confirmAction = () => {
    if (!confirm) return;
    triggerAction(confirm.server, confirm.action);
    setConfirm(null);
  };

  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-[#e8e6e3] mb-4">
        Server Management
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(SERVER_LABELS).map(([server, info]) => {
          const log = deployLogs[server];
          const isLoading = loading[server] ?? false;
          return (
            <div
              key={server}
              className="rounded-xl bg-[#141418] border border-[#2a2a32] p-5"
            >
              <h3
                className="text-base font-bold mb-4"
                style={{ color: info.color }}
              >
                {info.name}
              </h3>
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  disabled={isLoading}
                  onClick={() => handleAction(server, "start")}
                  className="px-3 py-1.5 text-xs rounded-lg border border-[#1a4a1a] text-[#55cc55] hover:text-[#66ff66] hover:border-[#2a6a2a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Start
                </button>
                <button
                  disabled={isLoading}
                  onClick={() => handleAction(server, "restart")}
                  className="px-3 py-1.5 text-xs rounded-lg border border-[#2a2a32] text-[#9a9a9a] hover:text-white hover:border-[#444] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Restart
                </button>
                <button
                  disabled={isLoading}
                  onClick={() => handleAction(server, "stop")}
                  className="px-3 py-1.5 text-xs rounded-lg border border-[#4a1a1a] text-[#cc5555] hover:text-[#ff6666] hover:border-[#6a2a2a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Stop
                </button>
                <button
                  disabled={isLoading}
                  onClick={() => handleAction(server, "update")}
                  className="px-3 py-1.5 text-xs rounded-lg bg-gradient-to-r from-[#ff6b00]/20 to-[#ffa500]/20 border border-[#ff6b00]/40 text-[#ffa500] hover:border-[#ff6b00] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isLoading && log?.status === "running" ? "Updating..." : "Update"}
                </button>
                <button
                  disabled={isLoading}
                  onClick={() => handleAction(server, "status")}
                  className="px-3 py-1.5 text-xs rounded-lg bg-[#0a0a0c] border border-[#2a2a32] text-[#666] hover:text-[#9a9a9a] hover:border-[#444] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Status
                </button>
              </div>

              {log && log.log && log.log.length > 0 && (
                <div className="mt-2">
                  <div
                    className={`text-xs font-bold uppercase tracking-wider mb-1 ${
                      log.status === "done"
                        ? "text-[#33cc33]"
                        : log.status === "error"
                          ? "text-[#cc3333]"
                          : "text-[#ffa500]"
                    }`}
                  >
                    {log.status === "running"
                      ? "● Running"
                      : log.status === "done"
                        ? "✓ Done"
                        : log.status === "error"
                          ? "✗ Error"
                          : ""}
                  </div>
                  <div className="bg-[#0a0a0c] rounded-lg p-3 max-h-40 overflow-y-auto font-mono text-xs text-[#9a9a9a] space-y-0.5">
                    {log.log.map((line, i) => (
                      <div key={i} className="leading-snug">
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirm dialog */}
      {confirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#141418] border border-[#2a2a32] rounded-xl p-8 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold mb-4 text-[#e8e6e3]">
              Confirm:{" "}
              <span className="text-[#cc5555] capitalize">{confirm.action}</span>{" "}
              <span style={{ color: SERVER_LABELS[confirm.server]?.color }}>
                {SERVER_LABELS[confirm.server]?.name}
              </span>
            </h2>
            <p className="text-sm text-[#9a9a9a] mb-6">
              {confirm.action === "stop"
                ? "This will stop the game server. Players will be disconnected."
                : confirm.action === "restart"
                  ? "This will restart the game server. Players will be briefly disconnected."
                  : "This will stop the server, pull the latest image, and restart. Downtime expected."}
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmAction}
                className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg bg-[#cc3333] hover:bg-[#dd4444] text-white transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirm(null)}
                className="px-4 py-2.5 text-sm rounded-lg border border-[#2a2a32] text-[#9a9a9a] hover:text-white hover:border-[#444] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

const PATCH_OPTIONS = [
  { value: "general", label: "All Servers", color: "#ffa500" },
  { value: "classic", label: "Classic", color: "#d4a017" },
  { value: "tbc", label: "TBC", color: "#1eff00" },
  { value: "wotlk", label: "WotLK", color: "#0070dd" },
];
const TAG_OPTIONS = [
  { value: "feature", label: "Feature" },
  { value: "improvement", label: "Improvement" },
  { value: "announcement", label: "Announcement" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "bugfix", label: "Bugfix" },
];

interface NewsEntry {
  id: number; title: string; author: string; date: string;
  preview: string; patch: string; tag: string;
}

function NewsManager() {
  const [news, setNews] = useState<NewsEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [preview, setPreview] = useState("");
  const [patch, setPatch] = useState("general");
  const [tag, setTag] = useState("announcement");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const fetchNews = async () => {
    try {
      const res = await fetch("/api/admin/news", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setNews(data.news || []);
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchNews(); }, []);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title, preview, patch, tag }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg("News published!");
        setTitle(""); setPreview(""); setPatch("general"); setTag("announcement");
        setShowForm(false);
        fetchNews();
      } else {
        setMsg(data.error || "Failed");
      }
    } catch { setMsg("Connection error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this news entry?")) return;
    try {
      const res = await fetch(`/api/admin/news?id=${id}`, {
        method: "DELETE", credentials: "include",
      });
      if (res.ok) fetchNews();
    } catch { /* ignore */ }
  };

  const inputClass = "w-full px-4 py-2.5 rounded-lg bg-[#0a0a0c] border border-[#2a2a32] text-[#e8e6e3] focus:border-[#ff6b00] focus:outline-none transition-colors";

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-[#e8e6e3]">News Management</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-[#ff6b00] to-[#ffa500] text-[#0a0a0c] hover:from-[#ff8c00] hover:to-[#ffb732] transition-all"
        >
          {showForm ? "Cancel" : "Publish News"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handlePublish} className="rounded-xl bg-[#141418] border border-[#2a2a32] p-6 mb-4 space-y-4">
          <div>
            <label className="block text-sm text-[#9a9a9a] mb-1">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="What changed?" />
          </div>
          <div>
            <label className="block text-sm text-[#9a9a9a] mb-1">Preview text</label>
            <textarea value={preview} onChange={(e) => setPreview(e.target.value)} rows={3} className={inputClass + " resize-none"} placeholder="1-2 sentence description..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#9a9a9a] mb-1">Patch</label>
              <div className="flex flex-wrap gap-2">
                {PATCH_OPTIONS.map((p) => (
                  <button key={p.value} type="button" onClick={() => setPatch(p.value)}
                    className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition-all ${patch === p.value ? "border-2" : "border border-[#2a2a32] text-[#666]"}`}
                    style={patch === p.value ? { borderColor: p.color, color: p.color } : {}}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-[#9a9a9a] mb-1">Tag</label>
              <div className="flex flex-wrap gap-2">
                {TAG_OPTIONS.map((t) => (
                  <button key={t.value} type="button" onClick={() => setTag(t.value)}
                    className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition-all ${tag === t.value ? "bg-[#ff6b00]/20 border border-[#ff6b00] text-[#ffa500]" : "border border-[#2a2a32] text-[#666]"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {msg && <p className={`text-sm ${msg.includes("published") ? "text-[#4ade80]" : "text-[#cc3333]"}`}>{msg}</p>}
          <button type="submit" disabled={saving} className="px-6 py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-[#ff6b00] to-[#ffa500] text-[#0a0a0c] disabled:opacity-50">
            {saving ? "Publishing..." : "Publish"}
          </button>
        </form>
      )}

      <div className="rounded-xl bg-[#141418] border border-[#2a2a32] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a32] bg-[#0e0e12]">
                <th className="text-left px-4 py-3 text-[#666] font-semibold uppercase tracking-wider text-xs">Title</th>
                <th className="text-left px-4 py-3 text-[#666] font-semibold uppercase tracking-wider text-xs">Patch</th>
                <th className="text-left px-4 py-3 text-[#666] font-semibold uppercase tracking-wider text-xs">Tag</th>
                <th className="text-left px-4 py-3 text-[#666] font-semibold uppercase tracking-wider text-xs">Date</th>
                <th className="text-left px-4 py-3 text-[#666] font-semibold uppercase tracking-wider text-xs w-16"></th>
              </tr>
            </thead>
            <tbody>
              {news.slice(0, 10).map((n) => (
                <tr key={n.id} className="border-b border-[#1e1e24] hover:bg-[#1a1a1e] transition-colors">
                  <td className="px-4 py-2.5 text-[#e8e6e3]">{n.title}</td>
                  <td className="px-4 py-2.5 text-[#9a9a9a] text-xs">{n.patch}</td>
                  <td className="px-4 py-2.5 text-[#9a9a9a] text-xs">{n.tag}</td>
                  <td className="px-4 py-2.5 text-[#666] text-xs">{formatDate(n.date)}</td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => handleDelete(n.id)} className="text-[#666] hover:text-[#cc3333] text-xs transition-colors">Delete</button>
                  </td>
                </tr>
              ))}
              {news.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-[#666]">No news entries</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

const CONFIG_FILES: Record<string, string[]> = {
  classic: ["mangosd.conf", "realmd.conf"],
  tbc: ["mangosd.conf", "realmd.conf", "ahbot.conf"],
  wotlk: ["worldserver.conf", "authserver.conf"],
};

function ConfigManager() {
  const [uploadMsg, setUploadMsg] = useState<Record<string, string>>({});

  const handleDownload = (server: string) => {
    window.open(`/api/admin/config?server=${server}&action=download`, "_blank");
  };

  const handleUpload = async (server: string, filename: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".conf";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      // Rename file to expected name
      const renamedFile = new File([file], filename, { type: file.type });
      const form = new FormData();
      form.append("server", server);
      form.append("file", renamedFile);

      setUploadMsg({ ...uploadMsg, [`${server}-${filename}`]: "Uploading..." });

      try {
        const res = await fetch("/api/admin/config", {
          method: "POST",
          credentials: "include",
          body: form,
        });
        const data = await res.json();
        setUploadMsg(prev => ({
          ...prev,
          [`${server}-${filename}`]: res.ok ? data.message : data.error,
        }));
      } catch {
        setUploadMsg(prev => ({ ...prev, [`${server}-${filename}`]: "Upload failed" }));
      }
    };
    input.click();
  };

  const handleRestore = async (server: string, filename: string) => {
    if (!confirm(`Restore ${filename} to defaults on ${server}?`)) return;
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ server, action: "restore", filename }),
      });
      const data = await res.json();
      setUploadMsg(prev => ({
        ...prev,
        [`${server}-${filename}`]: res.ok ? data.message : data.error,
      }));
    } catch {
      setUploadMsg(prev => ({ ...prev, [`${server}-${filename}`]: "Restore failed" }));
    }
  };

  const handleRestart = async (server: string) => {
    if (!confirm(`Restart ${server} server with new config?`)) return;
    try {
      await fetch("/api/admin/server-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ server, action: "restart" }),
      });
      setUploadMsg(prev => ({ ...prev, [`${server}-restart`]: "Server restarting..." }));
    } catch {
      setUploadMsg(prev => ({ ...prev, [`${server}-restart`]: "Restart failed" }));
    }
  };

  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-[#e8e6e3] mb-4">Server Configuration</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(CONFIG_FILES).map(([server, files]) => (
          <div key={server} className="rounded-xl bg-[#141418] border border-[#2a2a32] p-5">
            <h3 className="text-base font-bold mb-4" style={{
              color: server === "classic" ? "#d4a017" : server === "tbc" ? "#1eff00" : "#0070dd"
            }}>
              {server === "classic" ? "Classic" : server === "tbc" ? "TBC" : "WotLK"}
            </h3>

            {/* Download archive */}
            <button onClick={() => handleDownload(server)}
              className="w-full mb-3 px-3 py-2 text-xs rounded-lg border border-[#2a2a32] text-[#9a9a9a] hover:text-white hover:border-[#444] transition-colors text-left">
              Download config archive
            </button>

            {/* Upload buttons for each file */}
            {files.map((file) => (
              <div key={file} className="mb-1">
                <div className="flex gap-2">
                  <button onClick={() => handleUpload(server, file)}
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-[#2a2a32] text-[#9a9a9a] hover:text-white hover:border-[#444] transition-colors text-left truncate">
                    Upload {file}
                  </button>
                  <button onClick={() => handleRestore(server, file)}
                    className="px-2 py-1.5 text-[10px] rounded-lg border border-[#2a2a32] text-[#666] hover:text-[#ffa500] hover:border-[#444] transition-colors"
                    title="Restore defaults">
                    Reset
                  </button>
                </div>
                {uploadMsg[`${server}-${file}`] && (
                  <p className={`text-[10px] mt-0.5 ${uploadMsg[`${server}-${file}`].includes("success") || uploadMsg[`${server}-${file}`].includes("restored") ? "text-[#4ade80]" : "text-[#ffa500]"}`}>
                    {uploadMsg[`${server}-${file}`]}
                  </p>
                )}
              </div>
            ))}

            {/* Separator + Restart */}
            <div className="border-t border-[#2a2a32] my-3" />
            <button onClick={() => handleRestart(server)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-gradient-to-r from-[#ff6b00]/20 to-[#ffa500]/20 border border-[#ff6b00]/40 text-[#ffa500] hover:border-[#ff6b00] transition-colors">
              Restart server with new config
            </button>
            {uploadMsg[`${server}-restart`] && (
              <p className="text-[10px] mt-1 text-[#ffa500]">{uploadMsg[`${server}-restart`]}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function RemoteConsole() {
  const [server, setServer] = useState("classic");
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<Array<{ cmd: string; output: string; server: string; error?: boolean }>>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || loading) return;

    const cmd = command.trim();
    setLoading(true);
    setCommand("");

    try {
      const res = await fetch("/api/admin/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ server, command: cmd }),
      });
      const data = await res.json();

      setHistory((prev) => [
        { cmd, output: data.output || data.error || "No response", server: data.server || server, error: !res.ok },
        ...prev.slice(0, 49),
      ]);
    } catch {
      setHistory((prev) => [
        { cmd, output: "Connection error", server, error: true },
        ...prev.slice(0, 49),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-2.5 rounded-lg bg-[#0a0a0c] border border-[#2a2a32] text-[#e8e6e3] focus:border-[#ff6b00] focus:outline-none transition-colors font-mono text-sm";

  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-[#e8e6e3] mb-4">Remote Console</h2>
      <div className="rounded-xl bg-[#141418] border border-[#2a2a32] overflow-hidden">
        <form onSubmit={handleSubmit} className="p-4 border-b border-[#2a2a32] flex gap-3 items-end">
          <div className="flex gap-1 bg-[#0a0a0c] rounded-lg p-1">
            {(["classic", "tbc", "wotlk"] as const).map((srv) => (
              <button key={srv} type="button" onClick={() => setServer(srv)}
                className={`px-3 py-1.5 text-xs rounded-md font-semibold transition-all ${
                  server === srv ? "bg-[#ff6b00]/20 border border-[#ff6b00] text-[#ffa500]" : "text-[#666] hover:text-[#9a9a9a]"
                }`}>
                {srv === "classic" ? "Classic" : srv === "tbc" ? "TBC" : "WotLK"}
              </button>
            ))}
          </div>
          <div className="flex-1">
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className={inputClass}
              placeholder=".server info"
              disabled={loading}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <button type="submit" disabled={loading || !command.trim()}
            className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-[#ff6b00] to-[#ffa500] text-[#0a0a0c] disabled:opacity-50">
            {loading ? "..." : "Execute"}
          </button>
        </form>

        <div className="p-4 max-h-80 overflow-y-auto bg-[#0a0a0c] font-mono text-xs space-y-3">
          {history.length === 0 ? (
            <div className="text-[#444] text-center py-4">Type a command above (e.g. .server info, .lookup spell Fire)</div>
          ) : (
            history.map((entry, i) => (
              <div key={i}>
                <div className="text-[#ffa500]">
                  <span className="text-[#666]">[{entry.server}]</span> &gt; {entry.cmd}
                </div>
                <pre className={`mt-1 whitespace-pre-wrap ${entry.error ? "text-[#cc3333]" : "text-[#9a9a9a]"}`}>
                  {entry.output}
                </pre>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function LogViewer() {
  const [server, setServer] = useState("classic");
  const [lines, setLines] = useState<string[]>([]);
  const [logLoading, setLogLoading] = useState(false);

  const fetchLogs = async (srv: string) => {
    setLogLoading(true);
    setServer(srv);
    try {
      const res = await fetch(`/api/admin/logs?server=${srv}&lines=50`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      setLines(data.lines || []);
    } catch {
      setLines(["Failed to fetch logs"]);
    } finally {
      setLogLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs("classic");
  }, []);

  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-[#e8e6e3] mb-4">Server Logs</h2>
      <div className="rounded-xl bg-[#141418] border border-[#2a2a32] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2a2a32] bg-[#0e0e12]">
          {["classic", "tbc", "wotlk", "website"].map((srv) => (
            <button
              key={srv}
              onClick={() => fetchLogs(srv)}
              className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition-all ${
                server === srv
                  ? "bg-[#ff6b00]/20 border border-[#ff6b00] text-[#ffa500]"
                  : "border border-[#2a2a32] text-[#666] hover:text-[#9a9a9a]"
              }`}
            >
              {srv === "classic" ? "Classic" : srv === "tbc" ? "TBC" : srv === "wotlk" ? "WotLK" : "Website"}
            </button>
          ))}
          <button
            onClick={() => fetchLogs(server)}
            className="ml-auto px-3 py-1.5 text-xs rounded-lg border border-[#2a2a32] text-[#666] hover:text-white transition-colors"
          >
            Refresh
          </button>
        </div>
        <div className="p-4 max-h-80 overflow-y-auto bg-[#0a0a0c] font-mono text-xs text-[#9a9a9a] space-y-0.5">
          {logLoading ? (
            <div className="text-[#666] text-center py-4">Loading...</div>
          ) : lines.length === 0 ? (
            <div className="text-[#666] text-center py-4">No log entries</div>
          ) : (
            lines.map((line, i) => (
              <div
                key={i}
                className={`leading-snug ${
                  line.includes("ERROR") || line.includes("error")
                    ? "text-[#cc5555]"
                    : line.includes("WARNING") || line.includes("warning")
                      ? "text-[#cccc55]"
                      : ""
                }`}
              >
                {line}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function AnnounceModal({ onClose }: { onClose: () => void }) {
  const [message, setMessage] = useState("");
  const [servers, setServers] = useState<Record<string, boolean>>({
    classic: true,
    tbc: true,
    wotlk: true,
  });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const toggleServer = (srv: string) => {
    setServers((prev) => ({ ...prev, [srv]: !prev[srv] }));
  };

  const handleSend = async () => {
    const selectedServers = Object.entries(servers)
      .filter(([, v]) => v)
      .map(([k]) => k);

    if (!message.trim()) {
      setResult("Please enter a message");
      return;
    }
    if (selectedServers.length === 0) {
      setResult("Select at least one server");
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/announce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: message.trim(), servers: selectedServers }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult("Announcement saved successfully");
        setMessage("");
      } else {
        setResult(data.error || "Failed to save announcement");
      }
    } catch {
      setResult("Connection error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#141418] border border-[#2a2a32] rounded-xl p-8 w-full max-w-lg shadow-2xl">
        <h2 className="text-xl font-bold mb-6 bg-gradient-to-r from-[#ff6b00] to-[#ffa500] bg-clip-text text-transparent">
          Send Announcement
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-[#9a9a9a] mb-2">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full px-4 py-2.5 rounded-lg bg-[#0a0a0c] border border-[#2a2a32] text-[#e8e6e3] focus:border-[#ff6b00] focus:outline-none transition-colors resize-none"
              placeholder="Enter announcement text..."
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-[#9a9a9a] mb-2">
              Target Servers
            </label>
            <div className="flex gap-3">
              {(["classic", "tbc", "wotlk"] as const).map((srv) => (
                <button
                  key={srv}
                  onClick={() => toggleServer(srv)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    servers[srv]
                      ? "bg-[#ff6b00]/20 border border-[#ff6b00] text-[#ffa500]"
                      : "bg-[#0a0a0c] border border-[#2a2a32] text-[#666] hover:text-[#9a9a9a]"
                  }`}
                >
                  {srv === "classic"
                    ? "Classic"
                    : srv === "tbc"
                      ? "TBC"
                      : "WotLK"}
                </button>
              ))}
            </div>
          </div>

          {result && (
            <p
              className={`text-sm ${
                result.includes("success")
                  ? "text-[#33cc33]"
                  : "text-[#cc3333]"
              }`}
            >
              {result}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-[#ff6b00] to-[#ffa500] text-[#0a0a0c] hover:from-[#ff8c00] hover:to-[#ffb732] transition-all disabled:opacity-50"
            >
              {sending ? "Sending..." : "Send"}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-sm rounded-lg border border-[#2a2a32] text-[#9a9a9a] hover:text-white hover:border-[#444] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
