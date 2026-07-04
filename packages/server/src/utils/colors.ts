const PALETTE = [
  '#10b981', // teal/emerald
  '#f97316', // orange
  '#8b5cf6', // purple
  '#3b82f6', // blue
  '#ec4899', // pink
  '#64748b', // slate
  '#eab308', // amber
  '#06b6d4', // cyan
];

export function pickColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index] as string;
}
