export default function Footer() {
  return (
    <footer className="mt-auto border-t border-[#2a2a32] bg-[#0a0a0c]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-[#666]">
          <p>
            Drums of War &mdash; Private WoW Server Project
          </p>
          <div className="flex items-center gap-4">
            <a href="/classic/" className="hover:text-[#ffa500] transition-colors">Classic</a>
            <a href="/tbc/" className="hover:text-[#ffa500] transition-colors">TBC</a>
            <a href="/wotlk/" className="hover:text-[#ffa500] transition-colors">WotLK</a>
          </div>
          <p className="text-[#444]">
            Not affiliated with Blizzard Entertainment
          </p>
        </div>
      </div>
    </footer>
  );
}
