// Small, pure functions only: no React, no state, no side effects.
// Keeping these separate means they're trivial to reuse anywhere and easy
// to unit-test on their own later (a pure function's output only depends
// on its input, so there's nothing to "mock" to test it).

let idCounter = 1000;

// Generates a reasonably-unique id for mock records (channels, messages,
// users). A real backend would assign these itself.
export function nextId(prefix) {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

// Turns "Farida Samuel" into "FS" for avatar initials -- used everywhere we'd
// otherwise need a profile photo, since user profiles aren't in this
// sprint's scope yet.
export function initials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// A small palette cycled through for channel icons and avatar backgrounds,
// matching the colored square icons in the mockups.
export const ACCENTS = ["#7C3AED", "#EC4899", "#2563EB", "#F59E0B", "#0D9488"];

// Deterministic color per id, so the same person or channel always gets the
// same color across the app (based on a hash of their id) instead of a
// random one that changes on every render.
export function colorForId(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return ACCENTS[Math.abs(hash) % ACCENTS.length];
}
