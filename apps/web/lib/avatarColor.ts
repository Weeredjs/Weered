export const AVATAR_PALETTE = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
];

export const AVATAR_DEFAULT_BG = "#c8860b";

export function avatarBg(name: string, isMe?: boolean, chosenColor?: string): string {
  if (chosenColor) return chosenColor;
  if (isMe) {
    try {
      const stored = localStorage.getItem("weered:avatarColor");
      if (stored) return stored;
    } catch {}
  }
  void name;
  return AVATAR_DEFAULT_BG;
}
