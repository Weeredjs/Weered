"use client";

// Join, from the bar, the tab strip or an invite. A signed-out visitor goes to
// make an account and comes back with ?join=1, and that return joins them
// without a second click. The old card's button used to call the API signed
// out, get a 401 and do nothing at all: the invite path's main button was dead
// (found in the 2026-11-12 review). Out of page.tsx, which sits at its
// 1,500-line limit.

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
  /** Joined: the page reads the lobby again, and with it the membership. */
  onJoined: () => void;
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
        credentials: "include",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify({}),
      });
      const j = await r.json();
      // The reply is { ok, role, roleLevel }, with no membership in it. This
      // waited for one since the first join button was written, so joining
      // worked and the page never showed it: the button stayed, asking again
      // (found 2026-11-12 by e2e/bringPeople.spec.ts).
      if (j?.ok) onJoined();
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
