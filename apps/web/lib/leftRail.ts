// Pure helpers for the left rail (components/LeftRail.tsx): room keys, where
// a favourite or recent links to, presence sort order, and room accents.

export function pickFirstString(...vals: any[]): string {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  return "";
}

export function normRoomKey(x: any): string {
  let s = String(x || "").trim();
  if (!s) return "";
  if (s.startsWith("room:")) s = s.slice(5);
  try {
    s = decodeURIComponent(s);
  } catch {}
  return String(s || "").trim();
}

export function lobbyHref(id: string, knownLobby = false): string {
  let clean = id || "";
  if (clean.startsWith("room:")) clean = clean.slice(5);
  try {
    clean = decodeURIComponent(clean);
  } catch {}
  if (!clean) return "/lobby";
  const ROOM_PREFIXES = [
    "mtg-", // meeting/office rooms (the consult namespace)
    "stream-",
    "news-",
    "article-",
    "watch-",
    "fakeout-",
    "destiny2-",
    "dnd-",
    "windrose-",
    "mlb-",
    "league-",
    "fortnite-",
    "cs2-",
    "dota2-",
    "pubg-",
    "hq-",
    "poker-",
    "study-",
    "marathon-",
  ];
  if (ROOM_PREFIXES.some((p) => clean.startsWith(p))) return `/room/${encodeURIComponent(clean)}`;
  // A slug the caller has resolved as a lobby is a lobby, whatever it looks like.
  // Lobby slugs may start with a digit ("16thir"): the old /^[a-z]/ test sent
  // those to /room/, and the socket then minted a nameless Room row with the
  // lobby's id, which made the mistake look permanent.
  if (knownLobby) return `/lobby/${encodeURIComponent(clean)}`;
  const isLobbySlug =
    /^[a-z0-9][a-z0-9._/-]*$/.test(clean) || clean.includes(".") || clean.includes("/");
  if (isLobbySlug) return `/lobby/${encodeURIComponent(clean)}`;
  return `/room/${encodeURIComponent(clean)}`;
}

export function normRole(x: any) {
  const s = String(x || "")
    .trim()
    .toUpperCase();
  if (!s) return "";
  if (s === "GOD") return "GOD";
  if (s === "SUPPORT") return "SUPPORT";
  if (s === "STAFF") return "STAFF";
  if (s === "ADMIN") return "ADMIN";
  if (s === "MOD") return "MOD";
  if (s === "OWNER") return "OWNER";
  if (s === "MEMBER") return "MEMBER";
  return s.slice(0, 18);
}

export function groupRank(u: any): number {
  const g = normRole(pickFirstString(u?.globalRole, u?.global_role, u?.global));
  const rr = normRole(pickFirstString(u?.role, u?.roomRole, u?.room_role));
  if (g === "GOD") return 0;
  if (rr === "OWNER") return 1;
  if (g === "ADMIN") return 2;
  if (g === "STAFF" || g === "SUPPORT") return 3;
  if (g === "MOD" || rr === "MOD") return 4;
  return 5;
}

export const ROOM_ACCENTS = [
  "#7c6af7",
  "#22c55e",
  "#f97316",
  "#60a5fa",
  "#ef4444",
  "#eab308",
  "#ec4899",
  "#14b8a6",
  "#a78bfa",
  "#fb923c",
];

export function accentForRoom(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return ROOM_ACCENTS[Math.abs(h) % ROOM_ACCENTS.length];
}
