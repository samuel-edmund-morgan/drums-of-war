interface ServerCardProps {
  name: string;
  expansion: "classic" | "tbc" | "wotlk";
  description: string;
  patchVersion: string;
  emulator: string;
  serverIp: string;
  isOnline?: boolean;
  playersOnline?: number;
}

const expansionStyles = {
  classic: {
    badge: "bg-gradient-to-r from-yellow-700 to-yellow-500 text-yellow-950",
    label: "Classic",
    border: "border-yellow-600/20",
  },
  tbc: {
    badge: "bg-gradient-to-r from-green-800 to-green-600 text-green-100",
    label: "The Burning Crusade",
    border: "border-green-600/20",
  },
  wotlk: {
    badge: "bg-gradient-to-r from-blue-800 to-blue-600 text-blue-100",
    label: "Wrath of the Lich King",
    border: "border-blue-500/20",
  },
};

export default function ServerCard({
  name,
  expansion,
  description,
  patchVersion,
  emulator,
  serverIp,
  isOnline = false,
  playersOnline = 0,
}: ServerCardProps) {
  const style = expansionStyles[expansion];

  return (
    <div className={`bg-[#141418] border border-[#2a2a32] ${style.border} rounded-xl p-6`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <span className={`inline-block px-2.5 py-1 text-xs font-bold rounded-md ${style.badge} mb-2`}>
            {style.label}
          </span>
          <h3 className="text-lg font-bold text-[#e8e6e3]">{name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isOnline
                ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
                : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
            }`}
          />
          <span className={`text-xs font-medium ${isOnline ? "text-green-400" : "text-red-400"}`}>
            {isOnline ? "Online" : "Offline"}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-[#9a9a9a] mb-4 leading-relaxed">{description}</p>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-[#0a0a0c] rounded-lg px-3 py-2">
          <span className="text-[#666] block">Patch</span>
          <span className="text-[#e8e6e3] font-mono">{patchVersion}</span>
        </div>
        <div className="bg-[#0a0a0c] rounded-lg px-3 py-2">
          <span className="text-[#666] block">Players</span>
          <span className={`font-mono ${isOnline ? "text-green-400" : "text-[#666]"}`}>
            {isOnline ? playersOnline : "-"}
          </span>
        </div>
        <div className="bg-[#0a0a0c] rounded-lg px-3 py-2">
          <span className="text-[#666] block">Core</span>
          <span className="text-[#e8e6e3] font-mono text-[11px]">{emulator}</span>
        </div>
        <div className="bg-[#0a0a0c] rounded-lg px-3 py-2">
          <span className="text-[#666] block">Server IP</span>
          <span className="text-[#e8e6e3] font-mono text-[11px]">{serverIp}</span>
        </div>
      </div>
    </div>
  );
}
