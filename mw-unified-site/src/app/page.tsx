import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import ServerCards from "../components/ServerCards";
import NewsFeed from "../components/NewsFeed";
import Footer from "../components/Footer";
import VerifyToast from "../components/VerifyToast";

export default function Home() {
  return (
    <>
      <Navbar />
      <VerifyToast />

      {/* Hero */}
      <Hero />

      {/* Server Cards */}
      <section id="servers" className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-extrabold text-center tracking-wider uppercase bg-gradient-to-b from-yellow-300 to-orange-500 bg-clip-text text-transparent mb-3">
            Choose Your Expansion
          </h2>
          <p className="text-center text-[#9a9a9a] mb-12 text-sm">
            One account works across all servers. Login once, play everywhere.
          </p>

          <ServerCards />
        </div>
      </section>

      {/* News */}
      <NewsFeed />

      {/* Features */}
      <section className="py-16 px-4 border-t border-[#1a1a20]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-3xl mb-3">&#x1F511;</div>
              <h3 className="text-lg font-bold text-[#e8e6e3] mb-2">One Account</h3>
              <p className="text-sm text-[#9a9a9a]">
                Single login across all three expansions. Change your password once, it updates everywhere.
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-3">&#x2694;&#xFE0F;</div>
              <h3 className="text-lg font-bold text-[#e8e6e3] mb-2">Character Transfer</h3>
              <p className="text-sm text-[#9a9a9a]">
                Progress through expansions. Transfer your character from Classic to TBC to WotLK.
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-3">&#x1F310;</div>
              <h3 className="text-lg font-bold text-[#e8e6e3] mb-2">Always Free</h3>
              <p className="text-sm text-[#9a9a9a]">
                No donations, no pay-to-win. Pure vanilla experience across all expansions.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
