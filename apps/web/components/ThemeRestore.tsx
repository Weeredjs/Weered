"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

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
      if (
        location.pathname.indexOf("/lobby/") === 0 &&
        location.search.indexOf("chrome=full") < 0
      ) {
        d.setAttribute("data-weered-chrome", "min");
      }
    } catch {}
  }, [pathname]);
  return null;
}
