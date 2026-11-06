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
//
// Light effects (<html data-weered-light>, lib/displaySettings.ts) holds the
// same loops all the time, all but a loading wheel, which still turns.

const IDLE_MS = 2 * 60_000;
const AWAY_MS = 15_000;

let resting = false;
let light = false;
const held = new Set<Animation>();
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

/** A loading wheel turns by transform alone, so Light effects lets it turn. */
function spinner(a: Animation): boolean {
  try {
    let turns = false;
    for (const f of (a.effect as KeyframeEffect).getKeyframes()) {
      for (const [k, v] of Object.entries(f)) {
        if (k === "offset" || k === "computedOffset" || k === "easing" || k === "composite")
          continue;
        if (k !== "transform") return false;
        if (/rotate/.test(String(v))) turns = true;
      }
    }
    return turns;
  } catch {
    return false;
  }
}

function holds(a: Animation): boolean {
  return resting || (light && !spinner(a));
}

/** Pause the endless loops that should hold, play those that no longer
 *  should; one-off animations are always left to finish. */
function applyLoops() {
  try {
    for (const a of document.getAnimations()) {
      const t = (a.effect as KeyframeEffect | null)?.getTiming?.();
      if (t?.iterations !== Infinity || a.playState !== "running" || !holds(a)) continue;
      a.pause();
      held.add(a);
    }
  } catch {}
  for (const a of [...held]) {
    if (holds(a)) continue;
    held.delete(a);
    try {
      a.play();
    } catch {}
  }
}

function set(next: boolean) {
  if (next === resting) {
    // Anything that started looping since (a new card, a new pulse) holds too.
    if (next || light) applyLoops();
    return;
  }
  resting = next;
  const html = document.documentElement;
  if (next) html.setAttribute("data-weered-rest", "1");
  else html.removeAttribute("data-weered-rest");
  applyLoops();
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
  // A loop that starts while resting or under Light effects holds at once.
  const onStart = () => {
    if (resting || light) applyLoops();
  };
  const html = document.documentElement;
  const readLight = () => {
    const next = html.getAttribute("data-weered-light") === "1";
    if (next === light) return;
    light = next;
    applyLoops();
  };
  readLight();
  const lightWatch = new MutationObserver(readLight);
  lightWatch.observe(html, { attributes: true, attributeFilter: ["data-weered-light"] });
  const inputs = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"];
  for (const e of inputs) window.addEventListener(e, wake, { passive: true, capture: true });
  window.addEventListener("focus", onFocus);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVisible);
  document.addEventListener("animationstart", onStart, true);
  const timer = window.setInterval(check, 5000);
  return () => {
    for (const e of inputs) window.removeEventListener(e, wake, { capture: true });
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("blur", onBlur);
    document.removeEventListener("visibilitychange", onVisible);
    document.removeEventListener("animationstart", onStart, true);
    lightWatch.disconnect();
    window.clearInterval(timer);
    light = false;
    set(false);
    applyLoops();
  };
}
