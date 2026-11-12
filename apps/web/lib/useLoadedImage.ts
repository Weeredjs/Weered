"use client";

import { useEffect, useState } from "react";

/** The picture a card is showing: it keeps the one it has until the next has
 *  loaded. Windrose's banner is a reel that changes on every refresh, and a
 *  CSS background swapped to a picture still on its way paints nothing, so
 *  Downtown's card went blank every eight seconds (2026-11-12). */
export function useLoadedImage(src: string): string {
  const [shown, setShown] = useState(src);
  useEffect(() => {
    if (!src || src === shown) return;
    let alive = true;
    const img = new Image();
    img.onload = () => alive && setShown(src);
    // A picture that fails keeps the one before it, not a hole.
    img.onerror = () => {};
    img.src = src;
    return () => {
      alive = false;
    };
  }, [src, shown]);
  return shown;
}
