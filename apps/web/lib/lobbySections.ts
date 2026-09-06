import type { Bi } from "./lobbyLang";
import { TIMBOS_LOBBY_ID, TIMBOS_SECTIONS, TIMBOS_SECTION_ICONS } from "./timbosCopy";

/**
 * The left rail inside a lobby lists THAT LOBBY's sections, not the platform's.
 *
 * The default rail is Weered navigation — Home, Forum, Store, Map. That is
 * right while someone is browsing the platform, and wrong once they are inside
 * a community's room: every one of those links walks a member out, and the map
 * walks them to a rival community. It is the thing they are leaving Discord to
 * escape, so putting it inside their room sells them the problem back.
 *
 * So in a lobby the rail becomes the lobby, and there is exactly one way out:
 * a single "Weered · Home" link at the foot of it. Discovery has not gone
 * anywhere — Browse and the search bar are both still in the top bar, which is
 * where someone who wants to leave is already looking.
 *
 * Which sections exist varies per lobby (not every lobby has modules), so the
 * lobby page publishes its real tab list as `data-weered-views` and the rail
 * renders from that rather than guessing.
 */

/** Generic section names, used by every lobby that has no vocabulary of its own. */
const GENERIC: Record<string, Bi> = {
  rooms: { en: "Lobby", fr: "Salon" },
  modules: { en: "Modules", fr: "Modules" },
  feed: { en: "Feed", fr: "Fil" },
  events: { en: "Events", fr: "Événements" },
  lfg: { en: "Looking for Group", fr: "Recherche de groupe" },
  reddit: { en: "Reddit", fr: "Reddit" },
};

const GENERIC_ICONS: Record<string, string> = {
  rooms: "🏠",
  modules: "🧩",
  feed: "📰",
  events: "🗓",
  lfg: "🎯",
  reddit: "👽",
};

/** Lobbies that rename their own sections. Add a lobby here and its rail speaks
 *  its own language; leave it out and it gets the generic names above. */
const PER_LOBBY: Record<string, { labels: Record<string, Bi>; icons: Record<string, string> }> = {
  [TIMBOS_LOBBY_ID]: { labels: TIMBOS_SECTIONS, icons: TIMBOS_SECTION_ICONS },
};

/** Lobbies carrying an LFG board / a Reddit tab. Navigation config, so it lives
 *  with the rest of the navigation rather than in the page component. */
export const LFG_BOARD_LOBBIES = new Set(["gta6"]);
export const REDDIT_TAB_LOBBIES: Record<string, string> = { gta6: "gta6" };

/** Every section this lobby has, in rail order. */
export function lobbyViews(lobbyId: string, hasModules: boolean): string[] {
  return [
    "rooms",
    hasModules && "modules",
    "feed",
    "events",
    LFG_BOARD_LOBBIES.has(lobbyId) && "lfg",
    REDDIT_TAB_LOBBIES[lobbyId] && "reddit",
  ].filter(Boolean) as string[];
}

/** The order sections appear in, when present. */
export const SECTION_ORDER = ["rooms", "modules", "feed", "events", "lfg", "reddit"];

export function sectionLabel(lobbyId: string, key: string): Bi {
  return PER_LOBBY[lobbyId]?.labels?.[key] ?? GENERIC[key] ?? { en: key, fr: key };
}

export function sectionIcon(lobbyId: string, key: string): string {
  return PER_LOBBY[lobbyId]?.icons?.[key] ?? GENERIC_ICONS[key] ?? "•";
}

/** The one way out of a scoped rail. */
export const HOME_LINK: { href: string; label: Bi; icon: string } = {
  href: "/home",
  label: { en: "Weered · Home", fr: "Weered · Accueil" },
  icon: "⌂",
};
