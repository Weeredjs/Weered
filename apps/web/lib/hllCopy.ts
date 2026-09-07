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
