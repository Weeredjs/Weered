"use client";
import { useEffect } from "react";

// Public read-only launch lobbies: anon are allowed in (see RequireAuth) and
// should see the interactive app, not the SEO slab. Keep in sync with
// PUBLIC_LAUNCH_LOBBIES in GuestLaunchBar / the lobby layout.
const PUBLIC_LAUNCH_LOBBIES = new Set(["helldivers2", "cowork", "windrose"]);

export default function SyncAuthedAttribute() {
  useEffect(() => {
    try {
      const el = document.documentElement;
      const has = !!localStorage.getItem("weered_user");
      if (has) el.setAttribute("data-weered-authed", "1");
      else el.removeAttribute("data-weered-authed");

      // Reveal the app (hide the SEO slab) for anon on a public launch lobby.
      // Re-evaluated on every render so client-side navigation clears it.
      const m = window.location.pathname.match(/^\/lobby\/([^/]+)\/?$/);
      const lobbyId = m ? decodeURIComponent(m[1]) : "";
      if (lobbyId && PUBLIC_LAUNCH_LOBBIES.has(lobbyId)) {
        el.setAttribute("data-weered-public-lobby", "1");
      } else {
        el.removeAttribute("data-weered-public-lobby");
      }
    } catch {}
  });
  return null;
}
