export function scoreForClear(tileCount: number, chain: number): number {
  const base = tileCount * 60;
  const multiplier = 1 + Math.max(0, chain - 1) * 0.5;
  return Math.round(base * multiplier);
}
