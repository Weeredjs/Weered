// The server's flood mode (api lib/flood.ts) as this page knows it: set from
// auth:ok and site:flood by components/WeeredProvider.tsx (flood readiness
// 2026-11-02). Timed refreshes go through poll(): four times further apart in
// flood mode, skipped in a tab nobody is looking at, and spread out so a
// thousand open tabs don't all ask in the same second.
import { isResting, onRestChange } from "./rest";

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

/** A page left open that nobody has touched for a while (lib/rest.ts) asks a
 *  third as often. Measured 2026-11-12: two tabs left open made most of the
 *  300,000 API calls of a quiet week. Chat, messages and alerts arrive by the
 *  socket as they always did; this is only the timed re-asking. */
export const REST_SLOWDOWN = 3;

/** Run fn every ms (as above), and once again when the tab comes back into
 *  view after skipping, or when someone touches a page that had been resting
 *  past its usual turn. Returns the stop function, for an effect's cleanup.
 *
 *  For what sits around the page: counts, lists, a balance. */
export const poll = (fn: () => void, ms: number): (() => void) => timed(fn, ms, true);

/** The same for something a person may sit and watch without touching: a
 *  score, a price, a war map, who's in the room. Never slowed while the page
 *  is in view; a hidden tab still skips, and flood mode still spaces it out.
 *  Every timed refresh in the site is one of these two (2026-11-12: 62 panels
 *  ran on bare timers, hidden tabs and all). */
export const pollLive = (fn: () => void, ms: number): (() => void) => timed(fn, ms, false);

function timed(fn: () => void, ms: number, slowsAtRest: boolean): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let missed = false;
  let last = Date.now();
  const run = () => {
    last = Date.now();
    fn();
  };
  const next = () => {
    const every = refreshEvery(ms) * (slowsAtRest && isResting() ? REST_SLOWDOWN : 1);
    timer = setTimeout(tick, every * (0.85 + Math.random() * 0.3));
  };
  const tick = () => {
    if (stopped) return;
    if (hiddenTab()) missed = true;
    else run();
    next();
  };
  const onVisible = () => {
    if (!stopped && missed && !hiddenTab()) {
      missed = false;
      run();
    }
  };
  // Someone's back: what they see is brought up to date at once, and the
  // usual pace resumes from there.
  const offRest = !slowsAtRest
    ? () => {}
    : onRestChange((resting) => {
        if (stopped || resting || hiddenTab()) return;
        if (Date.now() - last < refreshEvery(ms)) return;
        clearTimeout(timer);
        run();
        next();
      });
  document.addEventListener("visibilitychange", onVisible);
  next();
  return () => {
    stopped = true;
    clearTimeout(timer);
    offRest();
    document.removeEventListener("visibilitychange", onVisible);
  };
}
