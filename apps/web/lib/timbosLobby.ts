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
