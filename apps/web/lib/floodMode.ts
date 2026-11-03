// The server's flood mode (api lib/flood.ts) as this page knows it: set from
// auth:ok and site:flood by components/WeeredProvider.tsx (flood readiness
// 2026-11-02). Timed refreshes go through poll(): four times further apart in
// flood mode, skipped in a tab nobody is looking at, and spread out so a
// thousand open tabs don't all ask in the same second.
let flood = false;

export function setFloodFlag(on: boolean) {
  if (on === flood) return;
  flood = on;
  try {
    window.dispatchEvent(new CustomEvent("weered:flood", { detail: { on } }));
  } catch {}
}

export const floodOn = () => flood;

/** The wait between refreshes: four times as long in flood mode. */
export const refreshEvery = (ms: number) => (flood ? ms * 4 : ms);

/** A hidden tab skips its timed refreshes (it catches up when looked at). */
export function hiddenTab(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

/** Run fn every ms (as above), and once again when the tab comes back into
 *  view after skipping. Returns the stop function, for an effect's cleanup. */
export function poll(fn: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let missed = false;
  const next = () => {
    timer = setTimeout(tick, refreshEvery(ms) * (0.85 + Math.random() * 0.3));
  };
  const tick = () => {
    if (stopped) return;
    if (hiddenTab()) missed = true;
    else fn();
    next();
  };
  const onVisible = () => {
    if (!stopped && missed && !hiddenTab()) {
      missed = false;
      fn();
    }
  };
  document.addEventListener("visibilitychange", onVisible);
  next();
  return () => {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
