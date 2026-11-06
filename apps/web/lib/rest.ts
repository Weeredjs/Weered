"use client";

// Rest: the moving decoration stops while nobody is looking and starts again
// at the first touch. The desktop app, left open, burned most of a core for
// four days (2026-11-06): on an idle Home the sky, the snow, the carousel and
// the looping glows together kept ~120% of a core busy in a software-drawn
// browser, and 3% with them stopped.
//
// Looking means: the page is visible, and there was input in the last two
// minutes, and the window has focus or the pointer moved over it lately.
// Resting pauses every endlessly repeating CSS animation through the Web
// Animations API; animations that run once (a message sliding in) carry on, so
// nothing new is left stuck half drawn. Canvas and script loops (the snow, the
// carousel) ask isResting() and listen with onRestChange(). <html
// data-weered-rest> shows it.

const IDLE_MS = 2 * 60_000;
const AWAY_MS = 15_000;

let resting = false;
let held: Animation[] = [];
const listeners = new Set<(resting: boolean) => void>();

export function isResting(): boolean {
  return resting;
}

export function onRestChange(fn: (resting: boolean) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Pause what loops forever; one-off animations are left to finish. */
function holdLoops() {
  try {
    for (const a of document.getAnimations()) {
      const t = (a.effect as KeyframeEffect | null)?.getTiming?.();
      if (t?.iterations === Infinity && a.playState === "running") {
        a.pause();
        held.push(a);
      }
    }
  } catch {}
}

function releaseLoops() {
  for (const a of held) {
    try {
      a.play();
    } catch {}
  }
  held = [];
}

function set(next: boolean) {
  if (next === resting) {
    // Anything that started looping since (a new card, a new pulse) rests too.
    if (next) holdLoops();
    return;
  }
  resting = next;
  const html = document.documentElement;
  if (next) {
    html.setAttribute("data-weered-rest", "1");
    holdLoops();
  } else {
    html.removeAttribute("data-weered-rest");
    releaseLoops();
  }
  listeners.forEach((fn) => fn(next));
}

/** Watch for someone looking; mounted once (RootFrame). Returns the stop. */
export function watchRest(): () => void {
  let lastInput = Date.now();
  let awaySince: number | null = document.hasFocus() ? null : Date.now();
  const wake = () => {
    lastInput = Date.now();
    // A pointer over a window that isn't focused counts as looking a while.
    if (awaySince !== null) awaySince = Date.now();
    set(false);
  };
  const check = () => {
    const now = Date.now();
    const away = awaySince !== null && !document.hasFocus() && now - awaySince > AWAY_MS;
    set(document.hidden || away || now - lastInput > IDLE_MS);
  };
  const onFocus = () => {
    awaySince = null;
    wake();
  };
  const onBlur = () => {
    awaySince = Date.now();
  };
  const onVisible = () => (document.hidden ? set(true) : wake());
  const inputs = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"];
  for (const e of inputs) window.addEventListener(e, wake, { passive: true, capture: true });
  window.addEventListener("focus", onFocus);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVisible);
  const timer = window.setInterval(check, 5000);
  return () => {
    for (const e of inputs) window.removeEventListener(e, wake, { capture: true });
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("blur", onBlur);
    document.removeEventListener("visibilitychange", onVisible);
    window.clearInterval(timer);
    set(false);
  };
}
