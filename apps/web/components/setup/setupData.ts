// Data for first-run setup (/setup): what people come for, how a lobby in the
// directory maps to one of those, and the art each lobby tile wears.
import { GAMES, moduleOf, type GameEntry } from "../composer/catalog";
import type { Interest } from "../../lib/uiPrefs";

export type DirLobby = {
  id: string;
  name: string;
  description?: string | null;
  verified?: boolean;
  pinned?: boolean;
  moduleType?: string | null;
  accentColor?: string | null;
  onlineCount?: number;
  _count?: { members?: number };
};

export const INTERESTS: { id: Interest; icon: string; name: string; blurb: string }[] = [
  { id: "work", icon: "💼", name: "Work", blurb: "Team rooms, client calls, focus time." },
  { id: "community", icon: "🏛", name: "Community", blurb: "Clubs, leagues, tables, the news." },
  { id: "games", icon: "🎮", name: "Games", blurb: "Squads, raids, ranked nights." },
  {
    id: "place",
    icon: "✦",
    name: "I need a place",
    blurb: "A lobby of your own. Your domain if you want.",
  },
];

export const STATUS_EMOJI = ["🎮", "💼", "🎧", "☕", "🔥", "🌙", "🎲", "📚", "🏁", "🛠"];

// Lobbies whose ModuleType says nothing about what they are (feeds, Twitch
// lobbies, plain NONE). Everything else goes by its composer catalog group.
const GROUP_BY_ID: Record<string, Exclude<Interest, "place">> = {
  lobby: "community",
  hq: "community",
  news: "community",
  nhl: "community",
  crypto: "community",
  "r/all": "community",
  "r/technology": "community",
  cowork: "work",
  "study-hall": "work",
  "paper-trading": "work",
  fakeout: "work",
};
const GROUP_BY_MODULE: Record<string, Exclude<Interest, "place">> = {
  COWORK: "work",
  STUDY: "work",
  TRADING: "work",
  HEADQUARTERS: "community",
};

export function catalogEntry(l: DirLobby): GameEntry | null {
  const m = String(l.moduleType || "");
  if (!m || m === "NONE" || m === "FEED" || m === "TWITCH") return null;
  return GAMES.find((g) => g.id === m || moduleOf(g) === m) || null;
}

export function groupOf(l: DirLobby): Exclude<Interest, "place"> {
  if (GROUP_BY_ID[l.id]) return GROUP_BY_ID[l.id];
  const m = String(l.moduleType || "");
  if (GROUP_BY_MODULE[m]) return GROUP_BY_MODULE[m];
  const g = catalogEntry(l);
  if (g && g.group !== "games") return g.group;
  return "games";
}

/** Card art for a directory lobby: the catalog's when the type has one, else
 *  a glow in the lobby's own accent with its initial. */
export function lobbyArt(l: DirLobby): GameEntry {
  const g = catalogEntry(l);
  if (g) return g;
  const tint = /^#[0-9a-f]{6}$/i.test(String(l.accentColor)) ? String(l.accentColor) : "#a78bfa";
  return {
    id: l.id,
    name: l.name,
    blurb: "",
    art: `radial-gradient(90% 100% at 20% 0%, ${tint}66 0%, transparent 65%), radial-gradient(80% 80% at 100% 100%, ${tint}33 0%, transparent 60%), #0b0b14`,
    glyph: (l.name.trim()[0] || "?").toUpperCase(),
    tint,
    tags: [],
    preset: "midnight",
    group: "community",
  };
}
