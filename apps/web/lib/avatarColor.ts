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

/** Where this browser keeps the signed-in person's own colour, so their avatar
 *  shows it before the server answers. Only their own profile writes it, and
 *  it goes when another account signs in here (lib/uiPrefs.ts). */
export const MY_COLOR_KEY = "weered:avatarColor";

/** Behind a picture when no colour is chosen: a faint fill, so a see-through
 *  picture still reads as a circle. */
export const PICTURE_FILL = "rgba(255,255,255,.08)";

function myColor(): string | null {
  try {
    return localStorage.getItem(MY_COLOR_KEY);
  } catch {
    return null;
  }
}

export function avatarBg(name: string, isMe?: boolean, chosenColor?: string | null): string {
  if (chosenColor) return chosenColor;
  if (isMe) {
    const stored = myColor();
    if (stored) return stored;
  }
  void name;
  return AVATAR_DEFAULT_BG;
}

/** What sits behind an avatar, the same everywhere (James 2026-11-01: "that
 *  centre fill in the frames is actually a background. Can we make that
 *  changeable"). The colour its owner picked in Your look shows behind a
 *  see-through picture just as it fills behind an initial. With none picked, a
 *  picture gets a faint fill and an initial the default colour. */
export function avatarFill(
  picture: boolean,
  name: string,
  isMe?: boolean,
  chosenColor?: string | null,
): string {
  if (!picture) return avatarBg(name, isMe, chosenColor);
  return chosenColor || (isMe && myColor()) || PICTURE_FILL;
}
