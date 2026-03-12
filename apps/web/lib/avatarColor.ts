// ─── Canonical avatar color palette ──────────────────────────────────────────
// This is the ONE palette used everywhere. Do not redefine locally in components.
export const AVATAR_PALETTE = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#3b82f6", // blue
];

/**
 * Returns the display color for a user's avatar.
 *
 * Priority:
 *  1. `chosenColor` — the value stored on the user record (from presence broadcast)
 *  2. localStorage "weered:avatarColor" — own client only, used before first presence
 *  3. Name hash fallback
 *
 * @param name        Display name — used for hash fallback
 * @param isMe        True when rendering the local user's own avatar
 * @param chosenColor avatarColor from the presence/user record, if available
 */
export function avatarBg(name: string, isMe?: boolean, chosenColor?: string): string {
  // Server-stored color takes priority for everyone
  if (chosenColor) return chosenColor;
  // For self, fall back to localStorage (covers the gap before first presence arrives)
  if (isMe) {
    try {
      const stored = localStorage.getItem("weered:avatarColor");
      if (stored) return stored;
    } catch {}
  }
  // Name hash fallback
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}
