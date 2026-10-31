"use client";

// A designed lobby's look reaches its whole space (James 2026-10-31: "The theme
// should change for the entire space, both rails and rooms as well."). Inside a
// lobby whose Design theme sets a colour or a preset, and inside its rooms, the
// page wears Nebula in that colour, with the lobby's corners, surface, backdrop
// and type; leaving puts the viewer's own look back. Lobbies with a hand-made
// skin (lib/lobbyThemes.ts) keep theirs, and a viewer who chose to keep their
// own theme in lobbies (Settings) keeps it.
import { useEffect, useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useWeered } from "./WeeredProvider";
import { THEMEABLE_LOBBY_IDS } from "../lib/lobbyThemes";
import { keepsDefaultTheme } from "../lib/lobbyChrome";
import { sanitizeLayout, type LobbyTheme } from "../lib/lobbyLayout";
import { PRESET_BY_ID } from "../lib/lobbyThemePresets";
import { PREFS_EVENT, customPalette, nebulaVars, paintUiPrefs, readUiPrefs } from "../lib/uiPrefs";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
/** The lobby's type, in Nebula's faces. */
const FONT: Record<string, string> = {
  display: "condensed",
  serif: "serif",
  mono: "mono",
  rounded: "clean",
  stencil: "stencil",
};
const cache = new Map<string, LobbyTheme | null>();
const worth = (t: LobbyTheme | null | undefined) => (t && (t.accent || t.preset) ? t : null);

export default function SpaceTheme() {
  const pathname = usePathname() || "";
  const ctx: any = useWeered();
  const lobbyId = pathname.startsWith("/lobby/")
    ? decodeURIComponent(pathname.split("/")[2] || "")
    : pathname.startsWith("/room/")
      ? String(ctx?.currentLobbyId || "")
      : "";
  const [theme, setTheme] = useState<LobbyTheme | null>(null);
  const [repaint, setRepaint] = useState(0);

  useEffect(() => {
    if (!lobbyId || lobbyId === "lobby" || THEMEABLE_LOBBY_IDS.includes(lobbyId)) {
      setTheme(null);
      return;
    }
    if (cache.has(lobbyId)) {
      setTheme(cache.get(lobbyId) ?? null);
      return;
    }
    let dead = false;
    fetch(`${API}/lobbies/${encodeURIComponent(lobbyId)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        const t = worth(sanitizeLayout(j?.lobby?.layout)?.theme);
        cache.set(lobbyId, t);
        if (!dead) setTheme(t);
      })
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, [lobbyId]);

  // Design mode shows its draft across the space as it's edited, and a publish
  // keeps it (app/lobby/[id]/page.tsx sends these).
  useEffect(() => {
    const onDraft = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (!d || d.lobbyId !== lobbyId) return;
      const t = worth(d.theme);
      cache.set(lobbyId, t);
      setTheme(t);
    };
    // Something repainted the viewer's own look (a prefs sync): put the space back.
    const onPrefs = () => setRepaint((n) => n + 1);
    window.addEventListener("weered:space-theme", onDraft);
    window.addEventListener(PREFS_EVENT, onPrefs);
    return () => {
      window.removeEventListener("weered:space-theme", onDraft);
      window.removeEventListener(PREFS_EVENT, onPrefs);
    };
  }, [lobbyId]);

  // After ThemeRestore (mounted before this), on every page of the space.
  useLayoutEffect(() => {
    const d = document.documentElement;
    if (!theme || d.hasAttribute("data-pro-host") || keepsDefaultTheme()) return;
    const accent =
      theme.accent || (theme.preset ? PRESET_BY_ID[theme.preset]?.accent : "") || "#8b5cf6";
    d.setAttribute("data-weered-space", lobbyId);
    d.setAttribute("data-weered-theme", "nebula");
    d.setAttribute("data-weered-palette", "custom");
    for (const [k, v] of Object.entries(nebulaVars(customPalette(accent))))
      d.style.setProperty(k, v);
    // What the lobby chose; what it didn't choose stays the viewer's own.
    const set = (name: string, v: string | undefined, dflt: string) => {
      if (!v) return;
      if (v !== dflt) d.setAttribute(name, v);
      else d.removeAttribute(name);
    };
    set("data-weered-shape", theme.shape, "round");
    set("data-weered-texture", theme.texture, "glass");
    set("data-weered-backdrop", theme.backdrop, "sky");
    set(
      "data-weered-font",
      theme.font === "default" ? "default" : FONT[theme.font || ""],
      "default",
    );
    return () => {
      d.removeAttribute("data-weered-space");
      // The viewer's own look back (lib/uiPrefs.ts paints every field it owns).
      const own = readUiPrefs();
      paintUiPrefs(own);
      if (!own.theme) {
        try {
          const v2 = localStorage.getItem("weered_theme_v2");
          d.setAttribute("data-weered-theme", v2 || "nebula");
        } catch {}
      }
    };
  }, [theme, lobbyId, pathname, repaint]);

  return null;
}
