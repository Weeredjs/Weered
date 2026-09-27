import type { Bi } from "./lobbyLang";

/**
 * vOCN Crew Hub vocabulary: the lobby speaks like an airline's crew portal.
 *
 * vOCN is German but runs its public site in English, so the chrome is English;
 * the `fr` slot the Bi type carries is left equal to it rather than guessed.
 */

export const VOCN_LOBBY_ID = "vocn";

/** vOCN's rank badges (public/brand/vocn/badges), offered as role icons. */
export const VOCN_BADGE_ICONS = [
  "/brand/vocn/badges/badge-cadet.svg",
  "/brand/vocn/badges/badge-second-officer.svg",
  "/brand/vocn/badges/badge-first-officer.svg",
  "/brand/vocn/badges/badge-senior-first-officer.svg",
  "/brand/vocn/badges/badge-captain.svg",
  "/brand/vocn/badges/badge-senior-captain.svg",
  "/brand/vocn/badges/badge-staff.svg",
];

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
