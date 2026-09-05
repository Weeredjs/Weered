"use client";
import { useEffect } from "react";
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
