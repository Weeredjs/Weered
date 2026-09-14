"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

export type BarMapRow = {
  scriptName: string;
  fileName: string;
  description: string;
  width: number | null;
  height: number | null;
  minWind: number | null;
  maxWind: number | null;
  maxMetal: number | null;
  tidal: number | null;
  startPositions: number;
};

// One catalogue per page load, shared by the lobby panel and the room launcher.
let cache: BarMapRow[] | null = null;
let inflight: Promise<BarMapRow[]> | null = null;

export function loadBarMaps(): Promise<BarMapRow[]> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetch(`${API}/bar/maps`)
      .then((r) => r.json())
      .then((j) => {
        cache = Array.isArray(j?.maps) ? j.maps : [];
        return cache as BarMapRow[];
      })
      .catch(() => [] as BarMapRow[])
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useBarMaps(): BarMapRow[] | null {
  const [maps, setMaps] = useState<BarMapRow[] | null>(cache);
  useEffect(() => {
    if (cache) return;
    let alive = true;
    loadBarMaps().then((m) => {
      if (alive) setMaps(m);
    });
    return () => {
      alive = false;
    };
  }, []);
  return maps;
}

/** Served by BAR's API; verified 200 image/jpeg on 2026-09-14. */
export function barMapThumb(fileName: string): string {
  return `https://api.bar-rts.com/maps/${encodeURIComponent(fileName)}/texture-thumb.jpg`;
}
