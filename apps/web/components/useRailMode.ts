"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export type RailState = "full" | "icons" | "hidden";

export interface RailMode {
  left: RailState;
  right: RailState;
  /** Which rail overlay panel is currently open (null = none) */
  overlay: "left" | "right" | null;
  setOverlay: (v: "left" | "right" | null) => void;
  /** Current viewport tier */
  tier: "wide" | "mid" | "narrow";
}

// ── Context-aware priority ──────────────────────────────────────────────────
// Lobby/Room → right rail is primary (controls, rooms, members)
// Home/Browse/Settings/Ops → left rail is primary (nav, presence)
function routePriority(pathname: string): "left" | "right" {
  if (pathname.startsWith("/lobby") || pathname.startsWith("/room")) return "right";
  return "left";
}

function getTier(w: number): "wide" | "mid" | "narrow" {
  if (w >= 1400) return "wide";
  if (w >= 1100) return "mid";
  return "narrow";
}

export function useRailMode(): RailMode {
  const pathname = usePathname() || "";
  const [width, setWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1600
  );
  const [overlay, setOverlay] = useState<"left" | "right" | null>(null);

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Close overlay on route change
  useEffect(() => { setOverlay(null); }, [pathname]);

  const tier = getTier(width);
  const priority = routePriority(pathname);

  let left: RailState = "full";
  let right: RailState = "full";

  if (tier === "wide") {
    // Both rails fully open — big desktop
    left = "full";
    right = "full";
  } else if (tier === "mid") {
    // Priority rail stays full, other collapses to icon strip
    if (priority === "right") {
      left = "icons";
      right = "full";
    } else {
      left = "full";
      right = "icons";
    }
  } else {
    // Narrow — both collapse to icon strips
    left = "icons";
    right = "icons";
  }

  return { left, right, overlay, setOverlay, tier };
}
