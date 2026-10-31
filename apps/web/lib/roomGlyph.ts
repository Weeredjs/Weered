// A room's face when it has no icon of its own (James 2026-10-31: "Can we use
// something other than the diamond... I just never liked it"): what it opens
// with, when that says something, else its initials, so every room in a list
// looks like itself instead of the same diamond.

const BY_MODULE: Record<string, string> = {
  voice: "🎙️",
  video: "📹",
  screen: "🖥️",
  youtube: "📺",
  twitch: "📡",
  browser: "🌐",
  article: "📖",
  poker: "🃏",
  chess: "♟️",
  dnd: "🎲",
  study: "⏱️",
  fakeout: "📈",
};

/** The emoji for what a room opens with, or "". */
export function moduleGlyph(defaultModule?: string | null): string {
  return BY_MODULE[String(defaultModule || "").toLowerCase()] || "";
}

/** "Clip Share" → "CS", "The Tower" → "T", "Raid Night 2" → "RN". */
export function roomMonogram(name: string): string {
  const words = String(name || "")
    .replace(/^(the|a|an)\s+/i, "")
    .split(/[\s_\-/]+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  const letters = words
    .slice(0, 2)
    .map((w) => Array.from(w)[0] || "")
    .join("");
  return (letters || "#").toUpperCase();
}
