"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { applyChrome, currentChrome } from "../lib/lobbyThemes";

const VALID_THEMES = ["slate", "zinc", "stone", "gray", "ishimura", "broadcast", "press"];

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
      const theme =
        v2 && VALID_THEMES.includes(v2)
          ? v2
          : s && VALID_THEMES.includes(s.theme)
            ? s.theme
            : "press";
      d.setAttribute("data-weered-theme", theme);
      if (s && s.density) d.setAttribute("data-weered-density", s.density);
      if (s && s.reduceMotion) d.setAttribute("data-weered-reduce-motion", "1");
      if (localStorage.getItem("weered_user")) d.setAttribute("data-weered-authed", "1");
      // Skin + chrome from the same rule as the pre-paint script, so this never
      // fights it; the lobby page and the room refine it once they know more.
      const [skin, min] = currentChrome(location.pathname, location.search);
      applyChrome(skin, min);
    } catch {}
  }, [pathname]);
  return null;
}
