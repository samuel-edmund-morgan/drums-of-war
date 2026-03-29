export function formatGold(copper: number): string {
  const g = Math.floor(copper / 10000);
  const s = Math.floor((copper % 10000) / 100);
  const c = copper % 100;
  return `${g}g ${s}s ${c}c`;
}

export function formatGoldParts(copper: number): { g: number; s: number; c: number } {
  return {
    g: Math.floor(copper / 10000),
    s: Math.floor((copper % 10000) / 100),
    c: copper % 100,
  };
}
