"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export type RailState = "full" | "icons" | "hidden";

export interface RailMode {
  left: RailState;
  right: RailState;
  overlay: "left" | "right" | null;
  setOverlay: (v: "left" | "right" | null) => void;
  tier: "wide" | "mid" | "narrow";
}

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
  const [mounted, setMounted] = useState(false);
  const [width, setWidth] = useState(1600);
  const [overlay, setOverlay] = useState<"left" | "right" | null>(null);

  useEffect(() => {
    setMounted(true);
    setWidth(window.innerWidth);
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => { setOverlay(null); }, [pathname]);

  if (!mounted) {
    return { left: "full", right: "full", overlay: null, setOverlay, tier: "wide" };
  }

  const tier = getTier(width);
  const priority = routePriority(pathname);

  let left: RailState = "full";
  let right: RailState = "full";

  if (tier === "wide") {
    left = "full";
    right = "full";
  } else if (tier === "mid") {
    if (priority === "right") {
      left = "icons";
      right = "full";
    } else {
      left = "full";
      right = "icons";
    }
  } else {
    left = "icons";
    right = "icons";
  }

  return { left, right, overlay, setOverlay, tier };
}
