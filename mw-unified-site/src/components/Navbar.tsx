"use client";

import { useState, useEffect, useRef } from "react";
import { getSession, logout, type AuthSession } from "../lib/auth";

const WORLD_LINKS = [
  { href: "/stats",   label: "Statistics" },
  { href: "/online",  label: "Players Online" },
  { href: "/honor",   label: "Honor" },
  { href: "/auction", label: "Auction House" },
];

const CLASS_COLORS: Record<number, string> = {
  1: "#C79C6E", 2: "#F58CBA", 3: "#ABD473", 4: "#FFF569",
  5: "#FFFFFF", 6: "#C41F3B", 7: "#0070DE", 8: "#40C7EB",
  9: "#8787ED", 10: "#00FF96", 11: "#FF7D0A",
};

const EXPANSION_LABELS: Record<string, { name: string; color: string }> = {
  classic: { name: "Classic", color: "#d4a017" },
  tbc: { name: "TBC", color: "#1eff00" },
  wotlk: { name: "WotLK", color: "#0070dd" },
};

interface RosterChar {
  guid: number;
  name: string;
  level: number;
  className: string;
  classId: number;
  race: string;
}

export default function Navbar() {
  const [session, setSession] = useState<AuthSession>({ authenticated: false });
  const [showLogin, setShowLogin] = useState(false);
  const [showChars, setShowChars] = useState(false);
  const [showWorld, setShowWorld] = useState(false);
  const [roster, setRoster] = useState<Record<string, RosterChar[]> | null>(null);
  const charsRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getSession().then(setSession);
  }, []);

  // Fetch roster when dropdown opens
  useEffect(() => {
    if (showChars && !roster && session.authenticated) {
      fetch("/api/account/roster", { credentials: "include" })
        .then((r) => r.json())
        .then((data) => {
          if (!data.error) setRoster(data);
        })
        .catch(() => {});
    }
  }, [showChars, roster, session.authenticated]);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!showChars && !showWorld) return;
    const handler = (e: MouseEvent) => {
      if (charsRef.current && !charsRef.current.contains(e.target as Node)) setShowChars(false);
      if (worldRef.current && !worldRef.current.contains(e.target as Node)) setShowWorld(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showChars, showWorld]);

  const handleLogout = async () => {
    await logout();
    setSession({ authenticated: false });
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0c]/90 backdrop-blur-md border-b border-[#2a2a32]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <a href="/" className="flex items-center gap-3">
              <span className="text-2xl font-extrabold tracking-wider uppercase bg-gradient-to-b from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                Drums of War
              </span>
            </a>

            {/* Nav links */}
            <div className="hidden md:flex items-center gap-6">
              <a href="/#servers" className="text-sm text-[#9a9a9a] hover:text-[#ffa500] transition-colors">
                Servers
              </a>
              <a href="/guide" className="text-sm text-[#9a9a9a] hover:text-[#ffa500] transition-colors">
                Guide
              </a>
              <a href="/armory" className="text-sm text-[#ffa500] hover:text-[#ffb833] transition-colors font-semibold">
                Armory
              </a>
              {/* World dropdown */}
              <div className="relative" ref={worldRef}>
                <button
                  onClick={() => setShowWorld(!showWorld)}
                  className="text-sm text-[#9a9a9a] hover:text-[#ffa500] transition-colors"
                >
                  World ▾
                </button>
                {showWorld && (
                  <div className="absolute top-full left-0 mt-2 w-44 bg-[#141418] border border-[#2a2a32] rounded-xl shadow-2xl overflow-hidden z-[60]">
                    {WORLD_LINKS.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        onClick={() => setShowWorld(false)}
                        className="block px-4 py-2.5 text-sm text-[#9a9a9a] hover:bg-[#1e1e24] hover:text-[#ffa500] transition-colors"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              {session.authenticated && (
                <>
                  <div className="relative" ref={charsRef}>
                    <button
                      onClick={() => setShowChars(!showChars)}
                      className="text-sm text-[#ffa500] hover:text-[#ffb833] transition-colors font-semibold"
                    >
                      Characters ▾
                    </button>
                    {showChars && (
                      <div className="absolute top-full right-0 mt-2 w-72 bg-[#141418] border border-[#2a2a32] rounded-xl shadow-2xl overflow-hidden z-[60]">
                        {!roster ? (
                          <div className="px-4 py-3 text-sm text-[#666]">Loading...</div>
                        ) : (
                          Object.entries(EXPANSION_LABELS).map(([patch, info]) => {
                            const chars = roster[patch] || [];
                            if (chars.length === 0) return null;
                            return (
                              <div key={patch}>
                                <div className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: info.color, borderBottom: "1px solid #2a2a32", background: "#0e0e12" }}>
                                  {info.name}
                                </div>
                                {chars.map((c) => (
                                  <a
                                    key={`${patch}-${c.guid}`}
                                    href={`/armory/character/${patch}/${c.guid}`}
                                    className="flex items-center justify-between px-4 py-2.5 hover:bg-[#1e1e24] transition-colors"
                                    onClick={() => setShowChars(false)}
                                  >
                                    <span className="text-sm font-semibold" style={{ color: CLASS_COLORS[c.classId] || "#e8e6e3" }}>
                                      {c.name}
                                    </span>
                                    <span className="text-xs text-[#666]">
                                      {c.level} {c.race} {c.className}
                                    </span>
                                  </a>
                                ))}
                              </div>
                            );
                          })
                        )}
                        {roster && Object.values(roster).every((arr) => arr.length === 0) && (
                          <div className="px-4 py-3 text-sm text-[#666]">No characters</div>
                        )}
                      </div>
                    )}
                  </div>
                  <a href="/transfer" className="text-sm text-[#ffa500] hover:text-[#ffb833] transition-colors font-semibold">
                    Transfer
                  </a>
                  {(session.gmlevel ?? 0) >= 3 && (
                    <a href="/admin" className="text-sm text-[#cc2222] hover:text-[#ff4444] transition-colors font-semibold">
                      Admin
                    </a>
                  )}
                </>
              )}
            </div>

            {/* Auth */}
            <div className="flex items-center gap-4">
              {session.authenticated ? (
                <div className="flex items-center gap-3">
                  <a
                    href="/account"
                    className="text-sm text-[#ffa500] font-semibold hover:text-[#ffb833] transition-colors"
                  >
                    {session.username}
                  </a>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-[#9a9a9a] hover:text-white transition-colors"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowLogin(true)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-[#ff6b00] to-[#ffa500] text-[#0a0a0c] hover:from-[#ff8c00] hover:to-[#ffb732] transition-all"
                >
                  Login
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Auth Modal */}
      {showLogin && (
        <AuthModal
          onClose={() => setShowLogin(false)}
          onSuccess={(s) => {
            setSession(s);
            setShowLogin(false);
          }}
        />
      )}
    </>
  );
}

function AuthModal({
  onClose,
  onSuccess,
  initialTab = "login",
}: {
  onClose: () => void;
  onSuccess: (s: AuthSession) => void;
  initialTab?: "login" | "register";
}) {
  const [tab, setTab] = useState<"login" | "register">(initialTab);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setEmail("");
    setError("");
    setSuccess("");
  };

  const switchTab = (t: "login" | "register") => {
    resetForm();
    setTab(t);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (data.status === "ok") {
        onSuccess({
          authenticated: true,
          username: data.username,
          identity_uuid: data.identity_uuid,
          accounts: data.accounts,
          gmlevel: data.gmlevel,
        });
      } else {
        setError(data.error || "Login failed");
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, email }),
      });
      const data = await res.json();

      if (data.status === "ok") {
        setSuccess(data.message || "Verification email sent! Check your inbox.");
      } else {
        setError(data.error || "Registration failed");
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full px-4 py-2.5 rounded-lg bg-[#0a0a0c] border border-[#2a2a32] text-[#e8e6e3] focus:border-[#ff6b00] focus:outline-none transition-colors";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#141418] border border-[#2a2a32] rounded-xl p-8 w-full max-w-md shadow-2xl">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[#0a0a0c] rounded-lg p-1">
          <button
            onClick={() => switchTab("login")}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
              tab === "login"
                ? "bg-gradient-to-r from-[#ff6b00] to-[#ffa500] text-[#0a0a0c]"
                : "text-[#9a9a9a] hover:text-white"
            }`}
          >
            Login
          </button>
          <button
            onClick={() => switchTab("register")}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
              tab === "register"
                ? "bg-gradient-to-r from-[#ff6b00] to-[#ffa500] text-[#0a0a0c]"
                : "text-[#9a9a9a] hover:text-white"
            }`}
          >
            Register
          </button>
        </div>

        {tab === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-[#9a9a9a] mb-1">Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} autoFocus />
            </div>
            <div>
              <label className="block text-sm text-[#9a9a9a] mb-1">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            </div>
            {error && <p className="text-sm text-[#cc3333]">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-[#ff6b00] to-[#ffa500] text-[#0a0a0c] hover:from-[#ff8c00] hover:to-[#ffb732] transition-all disabled:opacity-50">
                {loading ? "..." : "Login"}
              </button>
              <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm rounded-lg border border-[#2a2a32] text-[#9a9a9a] hover:text-white hover:border-[#444] transition-colors">
                Cancel
              </button>
            </div>
          </form>
        ) : success ? (
          <div className="text-center py-4 space-y-4">
            <div className="text-4xl">&#9993;</div>
            <p className="text-[#4ade80] font-semibold">{success}</p>
            <p className="text-sm text-[#9a9a9a]">
              Click the link in the email to activate your account on all three servers.
            </p>
            <button onClick={onClose} className="px-6 py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-[#ff6b00] to-[#ffa500] text-[#0a0a0c]">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm text-[#9a9a9a] mb-1">Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} autoFocus />
              <p className="text-xs text-[#666] mt-1">3-16 characters, letters and numbers only</p>
            </div>
            <div>
              <label className="block text-sm text-[#9a9a9a] mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm text-[#9a9a9a] mb-1">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm text-[#9a9a9a] mb-1">Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} />
            </div>
            {error && <p className="text-sm text-[#cc3333]">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-[#ff6b00] to-[#ffa500] text-[#0a0a0c] hover:from-[#ff8c00] hover:to-[#ffb732] transition-all disabled:opacity-50">
                {loading ? "..." : "Create Account"}
              </button>
              <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm rounded-lg border border-[#2a2a32] text-[#9a9a9a] hover:text-white hover:border-[#444] transition-colors">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
