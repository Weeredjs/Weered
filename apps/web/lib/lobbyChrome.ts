"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { hydrateLobbyLang, clearLobbyLang } from "./lobbyLang";
import { TIMBOS_LOBBY_ID } from "./timbosCopy";
import { lobbyViews } from "./lobbySections";

/**
 * How a lobby's chrome behaves: which lobbies are themed, which force their
 * theme, which are bilingual, and which section the page is showing.
 *
 * This started life as timbosLobby.ts for one demo room and grew into the
 * platform's lobby-navigation layer, which made the name actively misleading.
 * It is universal now. A lobby's participation is a list entry below, not a
 * file of its own — one copy of the logic, N lines of config.
 *
 * That matters: the themeable list previously existed in THREE places (the
 * lobby page's gate, that page's `themeable` prop, and RoomCanvas) and they had
 * already drifted apart, which is why themed lobbies silently lost their theme
 * the moment a member walked into one of their rooms.
 *
 * Everything here is published as an attribute on <html> — data-weered-lobby,
 * data-weered-lang, data-weered-view, data-weered-views — so CSS can key off it
 * and components can observe it without prop-drilling or a provider. LeftRail
 * in particular MUST read attributes rather than call useSearchParams: it
 * renders in the root layout, so it is on statically-exported pages like
 * /_not-found, and that hook forces dynamic rendering and fails the build.
 */

// ── Which lobbies have a reskin ──────────────────────────────────────────
export const THEMEABLE_LOBBY_IDS: string[] = [
  "windrose",
  "destiny2",
  "dnd",
  "hll",
  "16thir",
  "bandofbrothers",
  "helldivers2",
  TIMBOS_LOBBY_ID,
];

export function isThemeableLobby(lobbyId: string): boolean {
  return THEMEABLE_LOBBY_IDS.includes(lobbyId);
}

/**
 * Lobbies whose reskin is FORCED for every viewer, member or not, ignoring
 * settings.keepDefaultThemeInLobbies.
 *
 * These are the rooms we hand to a prospect. A prospect is a non-member on
 * default settings, which is exactly the viewer the opt-in gate hides the theme
 * from — they would open the link and get flagship purple. Keep this to demo
 * rooms: a real community's lobby should honour what its members chose.
 *
 * A forced lobby also suppresses the JoinLobbyOverlay and opens on Modules
 * rather than Rooms, because a preview room has no rooms yet and "No rooms open
 * here" reads as an empty product.
 */
// Forced: the theme applies to everyone, member or not, ignoring the personal
// "keep the default theme" setting. Reserved for lobbies whose URL goes to a
// prospect who has not joined anything — an unthemed lobby is the entire pitch
// failing to land at the only moment it gets to.
export const FORCED_THEME_LOBBIES: string[] = [
  TIMBOS_LOBBY_ID,
  "hll",
  // Prospect previews: the unit opening the link has joined nothing.
  "16thir",
  "bandofbrothers",
];

export function isForcedThemeLobby(lobbyId: string): boolean {
  return FORCED_THEME_LOBBIES.includes(lobbyId);
}

/** Lobbies whose chrome is offered in more than one language. */
export const BILINGUAL_LOBBIES: string[] = [TIMBOS_LOBBY_ID];

export function isBilingualLobby(lobbyId: string): boolean {
  return BILINGUAL_LOBBIES.includes(lobbyId);
}

/**
 * Inside a lobby the left rail lists THAT LOBBY's sections, not the platform's,
 * with one "Weered · Home" link out. Every lobby, not a list — being in a lobby
 * is the whole condition. See lib/lobbySections.ts for the reasoning.
 */
export function isScopedRailLobby(lobbyId: string): boolean {
  return !!lobbyId && lobbyId !== "lobby";
}

/**
 * Module types that give a lobby a Modules tab.
 *
 * Was a 27-arm `||` chain inside the lobby page, which meant a room could not
 * ask the same question — and a room needs to, or its scoped rail cannot offer
 * the section holding the lobby's actual content.
 */
const MODULE_TYPES = new Set([
  "BUNGIE",
  "TWITCH",
  "MARATHON",
  "MLB",
  "PGA",
  "NEWS",
  "RIOT",
  "FORTNITE",
  "TRADING",
  "POKER",
  "HEADQUARTERS",
  "CS2",
  "DOTA2",
  "STUDY",
  "PUBG",
  "DND",
  "POE",
  "POE2",
  "DIVISION2",
  "ASSETTOCORSA",
  "WINDROSE",
  "HELLDIVERS2",
  "CHESS",
  "EVE",
  "MTG",
  "HLL",
  "HLLV",
  "COWORK",
]);

/** Timbo's panel is keyed on the lobby id rather than a ModuleType, so it is
 *  named here too. See the render branch in the lobby page. */
export function lobbyHasModules(lobbyId: string, moduleType?: string | null): boolean {
  return lobbyId === TIMBOS_LOBBY_ID || MODULE_TYPES.has(String(moduleType || ""));
}

// ── Which section the lobby is showing ───────────────────────────────────
const VIEWS = ["rooms", "feed", "modules", "events", "lfg", "reddit", "brackets"] as const;
export type LobbyView = (typeof VIEWS)[number];

export function initialLobbyView(lobbyId: string, view?: string | null): LobbyView {
  if (view && (VIEWS as readonly string[]).includes(view)) return view as LobbyView;
  return isForcedThemeLobby(lobbyId) ? "modules" : "rooms";
}

/**
 * The lobby's current view, and a setter.
 *
 * Owns the state so the page needs neither the type nor the initial helper.
 * Scoped rail links are real hrefs so a member can bookmark or share a section,
 * but Next keeps the page mounted across them and nothing would otherwise
 * re-run — hence watching `?view=`. Only acts when the param is present, so it
 * never fights the tab buttons.
 */
export function useLobbyView(lobbyId: string): [LobbyView, (v: LobbyView) => void] {
  const sp = useSearchParams();
  const v = sp?.get("view") || null;
  const [view, setView] = useState<LobbyView>(() => initialLobbyView(lobbyId, v));
  useEffect(() => {
    if (v) setView(initialLobbyView(lobbyId, v));
  }, [v, lobbyId]);
  useEffect(() => {
    document.documentElement.setAttribute("data-weered-view", view);
    return () => document.documentElement.removeAttribute("data-weered-view");
  }, [view]);
  return [view, setView];
}

/**
 * Publish which sections this lobby actually has, so the scoped rail never
 * offers a tab that would render empty.
 */
export function usePublishLobbyViews(
  lobbyId: string,
  hasModules: boolean,
  hasStartgg = false,
): void {
  // Empty when there is no lobby — a standalone room must not advertise
  // sections that belong to nobody.
  const joined = lobbyId ? lobbyViews(lobbyId, hasModules, hasStartgg).join(",") : "";
  useEffect(() => {
    const d = document.documentElement;
    if (!joined) {
      d.removeAttribute("data-weered-views");
      return;
    }
    d.setAttribute("data-weered-views", joined);
    return () => d.removeAttribute("data-weered-views");
  }, [joined]);
}

/**
 * Restore the viewer's last language on entry to a bilingual lobby and drop the
 * attribute on the way out, so no other surface is left in a language it has no
 * copy for. No-op for every other lobby.
 */
export function useBilingualLobby(lobbyId: string): void {
  useEffect(() => {
    if (!isBilingualLobby(lobbyId)) return;
    hydrateLobbyLang();
    return () => clearLobbyLang();
  }, [lobbyId]);
}
