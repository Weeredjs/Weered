"use client";

// Join, from the card or from an invite. A signed-out visitor goes to make an
// account and comes back with ?join=1, and that return joins them without a
// second click. The card's button used to call the API signed out, get a 401
// and do nothing at all: the invite path's main button was dead (found in the
// 2026-11-12 review). Out of page.tsx, which sits at its 1,500-line limit.

import { useCallback, useEffect, useRef } from "react";
import { joinSignupPath } from "../../../lib/afterAuth";

export function useJoinLobby(o: {
  api: string;
  lobbyId: string;
  meId: string;
  headers: () => Record<string, string>;
  /** Membership is known and the lobby has loaded. */
  ready: boolean;
  isMember: boolean;
  /** An open lobby with no front door: the only kind that joins by itself. */
  open: boolean;
  /** ?join= from the address. */
  joinParam: string | null | undefined;
  onJoined: (membership: any) => void;
}): () => Promise<void> {
  const { api, lobbyId, meId, headers, ready, isMember, open, joinParam, onJoined } = o;

  const joinNow = useCallback(async () => {
    if (!meId) {
      window.location.assign(joinSignupPath(lobbyId));
      return;
    }
    try {
      const r = await fetch(`${api}/lobbies/${encodeURIComponent(lobbyId)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify({}),
      });
      const j = await r.json();
      if (j.ok && j.membership) onJoined(j.membership);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps -- headers and onJoined are stable enough
  }, [api, meId, lobbyId]);

  const done = useRef(false);
  useEffect(() => {
    if (done.current || joinParam !== "1" || !meId || !ready) return;
    done.current = true;
    // The address is cleaned either way; a door, approval or a password shows
    // its own way in.
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete("join");
      window.history.replaceState(null, "", u.pathname + u.search + u.hash);
    } catch {}
    if (!isMember && open) void joinNow();
  }, [joinParam, meId, ready, isMember, open, joinNow]);

  return joinNow;
}
