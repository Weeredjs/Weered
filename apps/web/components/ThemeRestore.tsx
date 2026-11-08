"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { applyChrome, currentChrome } from "../lib/lobbyThemes";
import { isSiteTheme, readUiPrefs } from "../lib/uiPrefs";
import { markGuest } from "../lib/guestSession";

export default function ThemeRestore() {
  const pathname = usePathname();
  useLayoutEffect(() => {
    try {
      const d = document.documentElement;
      let s: any = null;
      try {
        const raw = localStorage.getItem("weered:settings:v0");
        s = raw ? JSON.parse(raw) : null;
      } catch {}
      const v2 = localStorage.getItem("weered_theme_v2");
      const theme = isSiteTheme(v2) ? v2 : s && isSiteTheme(s.theme) ? s.theme : "nebula";
      // The office host keeps the theme the boot script forced on it.
      if (!d.hasAttribute("data-pro-host")) d.setAttribute("data-weered-theme", theme);
      const up = readUiPrefs();
      d.setAttribute("data-weered-palette", up.palette || "custom");
      if (up.stars === false) d.setAttribute("data-weered-stars", "off");
      else d.removeAttribute("data-weered-stars");
      if (up.skyMotion === true) d.setAttribute("data-weered-sky-motion", "on");
      else d.removeAttribute("data-weered-sky-motion");
      if (s && s.density) d.setAttribute("data-weered-density", s.density);
      if (s && s.reduceMotion) d.setAttribute("data-weered-reduce-motion", "1");
      if (localStorage.getItem("weered_user")) d.setAttribute("data-weered-authed", "1");
      markGuest();
      // Skin + chrome from the same rule as the pre-paint script, so this never
      // fights it; the lobby page and the room refine it once they know more.
      const [skin, min] = currentChrome(location.pathname, location.search);
      applyChrome(skin, min);
    } catch {}
  }, [pathname]);
  return null;
}
