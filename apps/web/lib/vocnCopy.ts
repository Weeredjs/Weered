import type { Bi } from "./lobbyLang";

/**
 * vOCN Crew Hub vocabulary: the lobby speaks like an airline's crew portal.
 *
 * vOCN is German but runs its public site in English, so the chrome is English;
 * the `fr` slot the Bi type carries is left equal to it rather than guessed.
 */

export const VOCN_LOBBY_ID = "vocn";

const same = (s: string): Bi => ({ en: s, fr: s });

/** Scoped-rail section names (lib/lobbySections.ts). */
export const VOCN_SECTIONS: Record<string, Bi> = {
  modules: same("Crew Hub"),
  rooms: same("Crew Rooms"),
  events: same("Events"),
  feed: same("Crew Notices"),
};

export const VOCN_SECTION_ICONS: Record<string, string> = {
  modules: "✈️",
  rooms: "🛫",
  events: "🗓",
  feed: "📋",
};
