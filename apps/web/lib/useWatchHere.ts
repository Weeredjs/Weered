"use client";

import { useEffect } from "react";

const PENDING_KEY = "__weeredPendingStream" as const;

/**
 * Subscribe to the banner-area "Watch Here" event. LobbyHeroBar dispatches
 * `weered:stream:watchhere` with `{ channel }` when a user picks Watch Here
 * from the stream prompt. The lobby page uses this to switch its view to
 * Modules; each modules panel uses it to switch its own sub-tab to Streams.
 *
 * The channel is also stashed on the window so the streams sub-component
 * (which mounts after the panel switches tabs) can read and consume it on
 * its own mount, avoiding a race between the event and the late mount.
 */
export function useWatchHere(handler: (channel: string) => void) {
  useEffect(() => {
    const listener = (e: Event) => {
      const ch = (e as CustomEvent).detail?.channel;
      if (typeof ch === "string" && ch) {
        try { (window as any)[PENDING_KEY] = ch; } catch {}
        handler(ch);
      }
    };
    window.addEventListener("weered:stream:watchhere", listener);
    return () => window.removeEventListener("weered:stream:watchhere", listener);
  }, [handler]);
}

/**
 * Streams sub-components call this on mount to consume any pending channel
 * left by a banner Watch Here click. Returns the channel and clears the
 * stash so subsequent mounts don't re-trigger.
 */
export function consumePendingStream(): string | null {
  try {
    const v = (window as any)[PENDING_KEY];
    if (typeof v === "string" && v) {
      delete (window as any)[PENDING_KEY];
      return v;
    }
  } catch {}
  return null;
}
