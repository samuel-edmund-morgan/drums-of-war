import Image from "next/image";

export default function Hero() {
  return (
    <section className="relative w-full h-[70vh] min-h-[500px] overflow-hidden">
      {/* Background image */}
      <Image
        src="/art/ragnaros-hero.webp"
        alt="Ragnaros"
        fill
        className="object-cover object-center"
        priority
        quality={90}
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0c]/40 via-[#0a0a0c]/60 to-[#0a0a0c]" />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-wider uppercase bg-gradient-to-b from-yellow-300 via-yellow-400 to-orange-500 bg-clip-text text-transparent drop-shadow-2xl mb-4">
          Drums of War
        </h1>
        <p className="text-lg md:text-xl text-[#ccc] max-w-2xl mb-2" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.8)" }}>
          One account. Three expansions. Your adventure begins here.
        </p>
        <p className="text-sm text-[#888] mb-8" style={{ textShadow: "0 2px 4px rgba(0,0,0,0.8)" }}>
          Classic &bull; The Burning Crusade &bull; Wrath of the Lich King
        </p>
        <a
          href="#servers"
          className="px-8 py-3 text-sm font-bold uppercase tracking-widest rounded-lg bg-gradient-to-r from-[#ff6b00] to-[#ffa500] text-[#0a0a0c] hover:from-[#ff8c00] hover:to-[#ffb732] transition-all shadow-[0_0_20px_rgba(255,107,0,0.3)] hover:shadow-[0_0_30px_rgba(255,107,0,0.5)]"
        >
          Explore Servers
        </a>
      </div>
    </section>
  );
}
