// Deterministic color + initial for a channel or user, so the same
// name/email always renders the same "avatar" without needing real images.
const PALETTE = ["#2f6fe0", "#7c5cf0", "#ef6c8e", "#2fb3a3", "#f0a83c", "#5b8def"];

export function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function initialFor(seed: string): string {
  const trimmed = seed.trim();
  return trimmed ? trimmed[0].toUpperCase() : "?";
}
