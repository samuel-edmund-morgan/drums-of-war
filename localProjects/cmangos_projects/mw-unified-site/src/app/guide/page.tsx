import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CopyButton from "@/components/CopyButton";

export const metadata = {
  title: "How To Play — Drums of War",
  description:
    "Connection guide for Drums of War WoW private server. Download a client, set the realmlist, and start playing Classic, TBC, or WotLK.",
};

const REALMLIST = "set realmlist wow.morgan-dev.com";

export default function GuidePage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0a0a0c] pt-24 pb-16 px-4">
        <div className="max-w-5xl mx-auto space-y-12">
          {/* ── Hero ── */}
          <header className="text-center space-y-3">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-wider uppercase bg-gradient-to-b from-yellow-300 to-orange-500 bg-clip-text text-transparent">
              How To Play
            </h1>
            <p className="text-[#9a9a9a] text-lg">
              Join the adventure in three clicks
            </p>
          </header>

          {/* ── Quick Start — 3 Steps ── */}
          <section>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Step 1 */}
              <div className="relative bg-[#141418] border border-[#2a2a32] rounded-xl p-6">
                <div className="absolute -top-4 left-5 w-8 h-8 rounded-full bg-gradient-to-br from-[#ff6b00] to-[#ffa500] flex items-center justify-center text-[#0a0a0c] text-sm font-extrabold">
                  1
                </div>
                <h3 className="text-lg font-bold text-[#e8e6e3] mt-2 mb-2">
                  Download a WoW Client
                </h3>
                <p className="text-sm text-[#9a9a9a]">
                  Get the original game client for the expansion you want to
                  play.
                </p>
              </div>

              {/* Step 2 */}
              <div className="relative bg-[#141418] border border-[#2a2a32] rounded-xl p-6">
                <div className="absolute -top-4 left-5 w-8 h-8 rounded-full bg-gradient-to-br from-[#ff6b00] to-[#ffa500] flex items-center justify-center text-[#0a0a0c] text-sm font-extrabold">
                  2
                </div>
                <h3 className="text-lg font-bold text-[#e8e6e3] mt-2 mb-2">
                  Set the Realmlist
                </h3>
                <p className="text-sm text-[#9a9a9a]">
                  Point your client to our server.
                </p>
              </div>

              {/* Step 3 */}
              <div className="relative bg-[#141418] border border-[#2a2a32] rounded-xl p-6">
                <div className="absolute -top-4 left-5 w-8 h-8 rounded-full bg-gradient-to-br from-[#ff6b00] to-[#ffa500] flex items-center justify-center text-[#0a0a0c] text-sm font-extrabold">
                  3
                </div>
                <h3 className="text-lg font-bold text-[#e8e6e3] mt-2 mb-2">
                  Create an Account &amp; Login
                </h3>
                <p className="text-sm text-[#9a9a9a]">
                  Register on our website, then login in-game.
                </p>
              </div>
            </div>
          </section>

          {/* ── Realmlist Configuration ── */}
          <section className="bg-[#141418] border border-[#2a2a32] rounded-xl p-6 md:p-8">
            <h2 className="text-2xl font-extrabold tracking-wider uppercase bg-gradient-to-b from-yellow-300 to-orange-500 bg-clip-text text-transparent mb-6">
              Realmlist Configuration
            </h2>

            {/* Big realmlist card */}
            <div className="bg-[#0a0a0c] border border-[#3a3a42] rounded-lg p-5 flex flex-col sm:flex-row items-center gap-4 mb-6">
              <code className="flex-1 text-lg md:text-xl font-mono text-[#ffa500] select-all text-center sm:text-left">
                {REALMLIST}
              </code>
              <CopyButton text={REALMLIST} />
            </div>

            <div className="space-y-4 text-sm text-[#ccc]">
              <p>
                Edit your{" "}
                <code className="px-1.5 py-0.5 bg-[#1e1e24] rounded text-[#ffa500] font-mono text-xs">
                  realmlist.wtf
                </code>{" "}
                file in the WoW client folder. Replace everything in the file
                with the line above.
              </p>

              <div className="bg-[#0e0e12] border border-[#2a2a32] rounded-lg p-4 space-y-2">
                <p className="text-xs text-[#888] font-semibold uppercase tracking-wider mb-2">
                  File location
                </p>
                <p>
                  <span className="text-[#888]">Windows:</span>{" "}
                  <code className="font-mono text-xs text-[#e8e6e3]">
                    C:\World of Warcraft\realmlist.wtf
                  </code>
                </p>
                <p className="text-xs text-[#666] pl-[72px]">
                  (or{" "}
                  <code className="font-mono">Data\enUS\realmlist.wtf</code> for
                  some versions)
                </p>
                <p>
                  <span className="text-[#888]">Mac:</span>{" "}
                  <code className="font-mono text-xs text-[#e8e6e3]">
                    /Applications/World of Warcraft/realmlist.wtf
                  </code>
                </p>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-[#ffa500]/5 border border-[#ffa500]/20">
                <svg
                  className="w-5 h-5 text-[#ffa500] flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm text-[#ccc]">
                  Same realmlist works for Classic, TBC, and WotLK — each client
                  connects to the right server automatically.
                </p>
              </div>
            </div>
          </section>

          {/* ── Game Clients ── */}
          <section>
            <h2 className="text-2xl font-extrabold tracking-wider uppercase bg-gradient-to-b from-yellow-300 to-orange-500 bg-clip-text text-transparent mb-6">
              Game Clients
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Classic */}
              <div className="bg-[#141418] border border-[#2a2a32] rounded-xl p-6 flex flex-col">
                <span className="self-start px-3 py-1 rounded text-xs font-bold bg-yellow-700/80 text-yellow-200 mb-4">
                  Classic
                </span>
                <h3 className="text-lg font-bold text-[#e8e6e3] mb-1">
                  Classic (1.12.1)
                </h3>
                <p className="text-xs text-[#888] mb-3">Build 5875</p>
                <p className="text-sm text-[#9a9a9a] mb-4">
                  Original vanilla WoW experience.
                </p>
                <a
                  href="https://www.dkpminus.com/blog/vanilla-wow-download-1-12-1-client/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-700/30 border border-yellow-600/40 text-yellow-200 text-sm font-semibold hover:bg-yellow-700/50 transition-colors"
                >
                  Download Client
                  <span className="text-xs opacity-60">&#8599;</span>
                </a>
              </div>

              {/* TBC */}
              <div className="bg-[#141418] border border-[#2a2a32] rounded-xl p-6 flex flex-col">
                <span className="self-start px-3 py-1 rounded text-xs font-bold bg-green-800/80 text-green-200 mb-4">
                  TBC
                </span>
                <h3 className="text-lg font-bold text-[#e8e6e3] mb-1">
                  The Burning Crusade (2.4.3)
                </h3>
                <p className="text-xs text-[#888] mb-3">Build 8606</p>
                <p className="text-sm text-[#9a9a9a] mb-4">
                  Step through the Dark Portal.
                </p>
                <a
                  href="https://www.dkpminus.com/blog/wow-2-4-3-download/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-800/30 border border-green-600/40 text-green-200 text-sm font-semibold hover:bg-green-800/50 transition-colors"
                >
                  Download Client
                  <span className="text-xs opacity-60">&#8599;</span>
                </a>
              </div>

              {/* WotLK */}
              <div className="bg-[#141418] border border-[#2a2a32] rounded-xl p-6 flex flex-col">
                <span className="self-start px-3 py-1 rounded text-xs font-bold bg-blue-800/80 text-blue-200 mb-4">
                  WotLK
                </span>
                <h3 className="text-lg font-bold text-[#e8e6e3] mb-1">
                  Wrath of the Lich King (3.3.5a)
                </h3>
                <p className="text-xs text-[#888] mb-3">Build 12340</p>
                <p className="text-sm text-[#9a9a9a] mb-4">
                  Face the Lich King.
                </p>
                <a
                  href="https://www.dkpminus.com/blog/wow-wotlk-3-3-5a-download-wrath-of-the-lich-king-client/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-800/30 border border-blue-600/40 text-blue-200 text-sm font-semibold hover:bg-blue-800/50 transition-colors"
                >
                  Download Client
                  <span className="text-xs opacity-60">&#8599;</span>
                </a>
              </div>
            </div>
          </section>

          {/* ── Account Registration ── */}
          <section className="bg-[#141418] border border-[#2a2a32] rounded-xl p-6 md:p-8 text-center">
            <h2 className="text-2xl font-extrabold tracking-wider uppercase bg-gradient-to-b from-yellow-300 to-orange-500 bg-clip-text text-transparent mb-4">
              Account Registration
            </h2>
            <p className="text-[#ccc] text-sm mb-2">
              Register on our website — one account works on all three servers!
            </p>
            <p className="text-[#9a9a9a] text-sm mb-6">
              Click the <strong className="text-[#ffa500]">Login</strong> button
              in the top-right corner to create an account or sign in. Your
              username and password are the same for Classic, TBC, and WotLK.
            </p>
            <a
              href="/"
              className="inline-block px-6 py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-[#ff6b00] to-[#ffa500] text-[#0a0a0c] hover:from-[#ff8c00] hover:to-[#ffb732] transition-all"
            >
              Go to Homepage
            </a>
          </section>

          {/* ── Troubleshooting / FAQ ── */}
          <section>
            <h2 className="text-2xl font-extrabold tracking-wider uppercase bg-gradient-to-b from-yellow-300 to-orange-500 bg-clip-text text-transparent mb-6">
              Troubleshooting
            </h2>

            <div className="space-y-4">
              <FaqItem
                question="Unable to connect"
                answer="Check your realmlist.wtf file and make sure it contains exactly: set realmlist wow.morgan-dev.com. Verify you are using the correct client version. You can check if the server is online on our homepage."
              />
              <FaqItem
                question="Disconnected from server"
                answer="Make sure you have the correct game client version — 1.12.1 for Classic, 2.4.3 for TBC, or 3.3.5a for WotLK. Using the wrong version will cause disconnects."
              />
              <FaqItem
                question="Account not found"
                answer="You need to register on the website first at world-of-warcraft.morgan-dev.com. Click the Login button and create your account."
              />
              <FaqItem
                question="Can I transfer my character between expansions?"
                answer="Yes! Use the Transfer page after logging in on the website. Transfers go Classic → TBC → WotLK."
              />
              <FaqItem
                question="Is the server free to play?"
                answer="Yes, completely free. No donations or pay-to-win."
              />
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="bg-[#141418] border border-[#2a2a32] rounded-xl p-5">
      <h3 className="text-[#e8e6e3] font-semibold mb-2">&quot;{question}&quot;</h3>
      <p className="text-sm text-[#9a9a9a]">{answer}</p>
    </div>
  );
}
