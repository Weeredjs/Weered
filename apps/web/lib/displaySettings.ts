// Two switches that belong to this device, not the account: no animations, and
// Weered's own theme inside lobbies that have their own. They lived in Settings
// → Display; since 2026-11-02 they sit in Change your drip with the rest of
// "how Weered looks to you" (James: the appearance settings were doubled up).
// Same store as before, so nothing anyone set is lost; WeeredProvider and
// lib/lobbyChrome.ts listen for the events.
const KEY = "weered:settings:v0";

export type DisplaySwitches = { reduceMotion: boolean; keepDefaultTheme: boolean };

function readAll(): Record<string, any> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") || {};
  } catch {
    return {};
  }
}

export function readDisplay(): DisplaySwitches {
  const s = readAll();
  return { reduceMotion: s.reduceMotion === true, keepDefaultTheme: s.keepDefaultTheme === true };
}

export function setDisplay(patch: Partial<DisplaySwitches>): DisplaySwitches {
  const next = { ...readAll(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("weered:settings"));
    window.dispatchEvent(new CustomEvent("weered:settings:changed", { detail: next }));
  } catch {}
  return {
    reduceMotion: next.reduceMotion === true,
    keepDefaultTheme: next.keepDefaultTheme === true,
  };
}
