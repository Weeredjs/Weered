"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { hydrateLobbyLang, clearLobbyLang } from "./lobbyLang";
import { TIMBOS_LOBBY_ID } from "./timbosCopy";

/**
 * Everything the lobby page needs to know about Timbo's, kept out of
 * app/lobby/[id]/page.tsx — that file sits just under the 1500-line tripwire in
 * scripts/check.sh, and a demo room is not a good reason to push it over.
 */

/** Lobbies whose reskin is FORCED for every viewer, member or not, ignoring
 *  settings.keepDefaultThemeInLobbies.
 *
 *  These are the rooms we put in front of a prospect. A prospect is a
 *  non-member on default settings, which is exactly the viewer the opt-in gate
 *  hides the theme from — they would open the link and get flagship purple.
 *  Keep this to demo lobbies: a real community's room should honour whatever
 *  its members chose for themselves. */
export const FORCED_THEME_LOBBIES: string[] = [TIMBOS_LOBBY_ID];

/**
 * Lobbies that get a SCOPED left rail.
 *
 * The default rail is platform navigation — Home, Forum, Store, Map. That is
 * right for someone browsing Weered, and wrong inside a community's own branded
 * room: every one of those links walks their member out of the room and, via
 * the map, straight to a rival community. That is the thing they are leaving
 * Discord to escape, so shipping it inside a paid room sells them the problem
 * back.
 *
 * Scoped means the rail carries THIS lobby's sections instead, so every link
 * keeps the member inside. Weered stays present as a small mark rather than as
 * a menu. Discovery is not lost, it just lives on the platform surfaces outside
 * a branded lobby, which is where someone browsing actually is.
 *
 * Note this is NOT the same as hiding the rail. The rail is how the room is
 * navigated; the question was only ever whose destinations it lists.
 */
export const SCOPED_RAIL_LOBBIES: string[] = [TIMBOS_LOBBY_ID];

export function isScopedRailLobby(lobbyId: string): boolean {
  return SCOPED_RAIL_LOBBIES.includes(lobbyId);
}

/** Views the lobby page understands, as used by ?view= on scoped rail links. */
const VIEWS = ["rooms", "feed", "modules", "events", "lfg", "reddit"] as const;
export type LobbyView = (typeof VIEWS)[number];

/**
 * Which view a lobby should open on.
 *
 * `?view=` lets the scoped rail use real links rather than click handlers, so
 * a member can bookmark or share a section of the room. Falls back to Modules
 * for preview lobbies (they have no rooms yet, so the default Rooms tab shows a
 * prospect an empty hall) and Rooms everywhere else.
 */
export function initialLobbyView(lobbyId: string, view?: string | null): LobbyView {
  if (view && (VIEWS as readonly string[]).includes(view)) return view as LobbyView;
  return isForcedThemeLobby(lobbyId) ? "modules" : "rooms";
}

/**
 * The lobby's current view, and a setter.
 *
 * Owns the state so the page does not have to import the type or the initial
 * helper. Scoped rail links are real hrefs and Next keeps the page mounted
 * across them, so nothing would otherwise re-run to change the view — this
 * watches `?view=` instead. Only acts when the param is present, so it never
 * fights the tab buttons.
 */
export function useLobbyView(lobbyId: string): [LobbyView, (v: LobbyView) => void] {
  const sp = useSearchParams();
  const v = sp?.get("view") || null;
  const [view, setView] = useState<LobbyView>(() => initialLobbyView(lobbyId, v));
  useEffect(() => {
    if (v) setView(initialLobbyView(lobbyId, v));
  }, [v, lobbyId]);
  // Publish the view the same way the theme and language layers publish theirs.
  // LeftRail observes this attribute rather than calling useSearchParams: the
  // rail renders in the ROOT layout, so it is on /_not-found too, and that hook
  // forces dynamic rendering and breaks the static export of that page.
  useEffect(() => {
    document.documentElement.setAttribute("data-weered-view", view);
    return () => document.documentElement.removeAttribute("data-weered-view");
  }, [view]);
  return [view, setView];
}

/**
 * These rooms also suppress the JoinLobbyOverlay.
 *
 * A preview lobby exists to be handed to one person who has not signed up and
 * may never sign up. Confronting them with "Join to unlock the full experience"
 * before they can see anything is the opposite of a demo — it asks for the
 * commitment before showing the thing the commitment is for. The join path
 * stays available in GuestLaunchBar for anyone who does want it.
 *
 * Caught on the live Timbo's room: the theme applied correctly but a logged-out
 * visitor saw only the join modal over a blurred page.
 *
 * They also open on the Modules tab rather than Rooms. "Rooms" is the right
 * default for a live community, but a preview room has no rooms yet, so a
 * prospect lands on "No rooms open here. Be the first to start one." — which
 * reads as an empty product. Modules is where the room we actually built lives.
 */

export function isForcedThemeLobby(lobbyId: string): boolean {
  return FORCED_THEME_LOBBIES.includes(lobbyId);
}

/** Restore the viewer's last language on entry to a bilingual lobby and drop
 *  the attribute on the way out, so no other surface is left in a language it
 *  has no copy for. No-op everywhere else. */
export function useBilingualLobby(lobbyId: string): void {
  useEffect(() => {
    if (lobbyId !== TIMBOS_LOBBY_ID) return;
    hydrateLobbyLang();
    return () => clearLobbyLang();
  }, [lobbyId]);
}
