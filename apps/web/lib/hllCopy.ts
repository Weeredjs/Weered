// Hell Let Loose lobby vocabulary.
//
// The rail speaks the game's own language rather than the platform's. A unit
// that already runs a Discord with #dispatches and #operations should not have
// to translate "Feed" and "Events" in their head to know where anything is.
//
// English only: unlike Timbo's, this lobby has no bilingual requirement, so the
// French side mirrors the English rather than pretending to a translation
// nobody has reviewed.
import type { Bi } from "./lobbyLang";

const en = (s: string): Bi => ({ en: s, fr: s });

export const HLL_LOBBY_ID = "hll";

export const HLL_SECTIONS: Record<string, Bi> = {
  rooms: en("The Line"), // where the platoon actually sits
  modules: en("Operations"), // server browser, seeding board, artillery
  feed: en("Dispatches"), // the lobby's own description already calls it this
  events: en("Muster"), // scheduled ops and training nights
  brackets: en("Ladder"),
  lfg: en("Reinforcements"),
  reddit: en("Reddit"),
};

export const HLL_SECTION_ICONS: Record<string, string> = {
  rooms: "🎖",
  modules: "🗺",
  feed: "📻",
  events: "🕭",
  brackets: "🏅",
  lfg: "🪖",
  reddit: "👽",
};

/* ── Prospect preview lobbies ────────────────────────────────────────────
   Unlisted lobbies handed to one unit. The rail uses THEIR words, lifted
   from their own site navigation, so the first thing they recognise is
   themselves rather than our product. */

export const IR16_LOBBY_ID = "16thir";

/** 16th Infantry Regiment — 16thir.org. Their nav: Home, About Us, Roster,
 *  Enlist, News, Ban Logs. They run weekly squad drills plus a full platoon
 *  meet, which is what "Drills" is doing in the events slot. */
export const IR16_SECTIONS: Record<string, Bi> = {
  rooms: en("The Regiment"),
  modules: en("Operations"),
  feed: en("News"),
  events: en("Drills"),
  brackets: en("Ladder"),
  lfg: en("Enlist"),
  reddit: en("Reddit"),
};

export const IR16_SECTION_ICONS: Record<string, string> = {
  rooms: "🎖",
  modules: "🗺",
  feed: "📰",
  events: "🎯",
  brackets: "🏅",
  lfg: "🪖",
  reddit: "👽",
};

export const BOB_LOBBY_ID = "bandofbrothers";

/** Band of Brothers — bandofbrothers.gg, the 5th Brigade Combat Team. Their
 *  nav: About, Servers, Events, Games, Discord. They run their own live EU
 *  public server, so "Servers" is the module slot rather than "Operations",
 *  and Operations is where their ops/bootcamps/R&R calendar goes. */
export const BOB_SECTIONS: Record<string, Bi> = {
  rooms: en("5th Brigade"),
  modules: en("Servers"),
  feed: en("Dispatches"),
  events: en("Operations"),
  brackets: en("Ladder"),
  lfg: en("Reinforcements"),
  reddit: en("Reddit"),
};

export const BOB_SECTION_ICONS: Record<string, string> = {
  rooms: "🎖",
  modules: "🖥",
  feed: "📻",
  events: "🗓",
  brackets: "🏅",
  lfg: "🪖",
  reddit: "👽",
};
