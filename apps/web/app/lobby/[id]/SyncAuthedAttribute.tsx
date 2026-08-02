"use client";
import { useEffect } from "react";

// Every lobby page is public read-only: anon are allowed in (see RequireAuth)
// and should see the interactive app, not the SEO slab.

export default function SyncAuthedAttribute() {
  useEffect(() => {
    try {
      const el = document.documentElement;
      const has = !!localStorage.getItem("weered_user");
      if (has) el.setAttribute("data-weered-authed", "1");
      else el.removeAttribute("data-weered-authed");

      // Reveal the app (hide the SEO slab) for anon on any lobby root page.
      // Re-evaluated on every render so client-side navigation clears it.
      const onLobbyPage = /^\/lobby\/[^/]+\/?$/.test(window.location.pathname);
      if (onLobbyPage) {
        el.setAttribute("data-weered-public-lobby", "1");
      } else {
        el.removeAttribute("data-weered-public-lobby");
      }
    } catch {}
  });
  return null;
}
