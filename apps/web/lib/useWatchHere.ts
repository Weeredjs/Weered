"use client";

import { useEffect } from "react";

const PENDING_KEY = "__weeredPendingStream" as const;
const TTL_MS = 3000;

interface PendingStash {
  channel: string;
  ts: number;
}

export function useWatchHere(handler: (channel: string) => void) {
  useEffect(() => {
    const listener = (e: Event) => {
      const ch = (e as CustomEvent).detail?.channel;
      if (typeof ch === "string" && ch) {
        try {
          (window as any)[PENDING_KEY] = { channel: ch, ts: Date.now() } as PendingStash;
        } catch {}
        handler(ch);
      }
    };
    window.addEventListener("weered:stream:watchhere", listener);
    return () => window.removeEventListener("weered:stream:watchhere", listener);
  }, [handler]);
}

export function consumePendingStream(): string | null {
  try {
    const v = (window as any)[PENDING_KEY] as PendingStash | undefined;
    if (v && typeof v.channel === "string" && v.channel) {
      delete (window as any)[PENDING_KEY];
      if (typeof v.ts === "number" && Date.now() - v.ts > TTL_MS) return null;
      return v.channel;
    }
  } catch {}
  return null;
}

export function clearPendingStream() {
  try { delete (window as any)[PENDING_KEY]; } catch {}
}
