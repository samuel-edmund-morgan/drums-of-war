"use client";

import { useState, useEffect } from "react";
import ServerCard from "./ServerCard";

interface ServerStatus {
  online: boolean;
  players: number;
}

const SERVERS = [
  { name: "Classic Realm", expansion: "classic" as const, description: "Relive the original World of Warcraft experience. Explore Azeroth, conquer Molten Core, and face Onyxia.", patchVersion: "1.12.1", emulator: "VMaNGOS" },
  { name: "TBC Realm", expansion: "tbc" as const, description: "Step through the Dark Portal into Outland. Raid Karazhan, battle Illidan, and soar through Nagrand.", patchVersion: "2.4.3", emulator: "CMaNGOS" },
  { name: "WotLK Realm", expansion: "wotlk" as const, description: "Journey to Northrend and confront the Lich King. Storm Icecrown Citadel and claim your destiny.", patchVersion: "3.3.5a", emulator: "AzerothCore" },
];

export default function ServerCards() {
  const [status, setStatus] = useState<Record<string, ServerStatus>>({});

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/status");
        if (res.ok) setStatus(await res.json());
      } catch { /* ignore */ }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {SERVERS.map((srv) => (
        <ServerCard
          key={srv.expansion}
          name={srv.name}
          expansion={srv.expansion}
          description={srv.description}
          patchVersion={srv.patchVersion}
          emulator={srv.emulator}
          serverIp="wow.morgan-dev.com"
          isOnline={status[srv.expansion]?.online ?? false}
          playersOnline={status[srv.expansion]?.players ?? 0}
        />
      ))}
    </div>
  );
}
