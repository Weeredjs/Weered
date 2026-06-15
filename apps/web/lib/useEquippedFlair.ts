"use client";

import { useEffect, useState } from "react";

export interface EquippedFlair {
  id: string;
  slug: string;
  name: string;
  kind: "BADGE" | "BANNER" | "NAMEPLATE";
  imageUrl: string | null;
  color: string | null;
  rarity: string;
}

const TTL_MS = 5 * 60 * 1000;
type Entry = { at: number; flair: EquippedFlair | null; promise?: Promise<EquippedFlair | null> };
const cache = new Map<string, Entry>();
const subs = new Map<string, Set<(f: EquippedFlair | null) => void>>();

function notify(userId: string, flair: EquippedFlair | null) {
  const set = subs.get(userId);
  if (!set) return;
  for (const cb of set)
    try {
      cb(flair);
    } catch {}
}

async function fetchFlair(apiBase: string, userId: string): Promise<EquippedFlair | null> {
  try {
    const r = await fetch(`${apiBase}/flair/equipped/${encodeURIComponent(userId)}`, {
      cache: "no-store",
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.flair || null;
  } catch {
    return null;
  }
}

export function invalidateEquippedFlair(userId: string) {
  cache.delete(userId);
}

export function useEquippedFlair(
  userId: string | null | undefined,
  apiBase?: string,
): EquippedFlair | null {
  const base = apiBase || (process.env.NEXT_PUBLIC_API_BASE as string) || "http://127.0.0.1:4000";
  const [flair, setFlair] = useState<EquippedFlair | null>(() => {
    if (!userId) return null;
    const e = cache.get(userId);
    if (e && Date.now() - e.at < TTL_MS) return e.flair;
    return null;
  });

  useEffect(() => {
    if (!userId) {
      setFlair(null);
      return;
    }
    let alive = true;

    let set = subs.get(userId);
    if (!set) {
      set = new Set();
      subs.set(userId, set);
    }
    const cb = (f: EquippedFlair | null) => {
      if (alive) setFlair(f);
    };
    set.add(cb);

    const e = cache.get(userId);
    if (e && Date.now() - e.at < TTL_MS) {
      setFlair(e.flair);
    } else if (e?.promise) {
      e.promise.then((f) => {
        if (alive) setFlair(f);
      });
    } else {
      const p = fetchFlair(base, userId).then((f) => {
        cache.set(userId, { at: Date.now(), flair: f });
        notify(userId, f);
        return f;
      });
      cache.set(userId, { at: Date.now(), flair: null, promise: p });
      p.then((f) => {
        if (alive) setFlair(f);
      });
    }

    return () => {
      alive = false;
      const s = subs.get(userId);
      if (s) {
        s.delete(cb);
        if (s.size === 0) subs.delete(userId);
      }
    };
  }, [userId, base]);

  return flair;
}
