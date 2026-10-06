import { TIMBOS_LOBBY_ID } from "./timbosCopy";

/**
 * Which page wears which skin, decided in ONE place.
 *
 * Five writers used to decide <html data-weered-lobby / data-weered-chrome>
 * with slightly different rules: the pre-paint script in app/layout.tsx,
 * ThemeRestore, ShellGate, the lobby page and RoomCanvas. Each corrected the
 * last one on every load, which James saw as themes flickering over each other
 * (2026-10-06). They now all call chromeFor(), and the pre-paint script runs
 * the same function (layout.tsx serialises it), so the first paint already
 * matches what the page settles on.
 *
 * This module is plain (no "use client", no React) so the server layout can
 * import it, and chromeFor() is self-contained ES5 so its source can be
 * inlined into the boot script.
 */

/** Lobbies with a reskin. Members see it unless they keep the default theme. */
export const THEMEABLE_LOBBY_IDS: string[] = [
  "windrose",
  "destiny2",
  "dnd",
  "hll",
  "16thir",
  "bandofbrothers",
  "helldivers2",
  TIMBOS_LOBBY_ID,
  "vocn",
];

/**
 * Lobbies whose reskin shows to every viewer, member or not (demo and
 * prospect rooms). Only the viewer's own "Keep default theme" turns it off.
 */
export const FORCED_THEME_LOBBIES: string[] = [
  TIMBOS_LOBBY_ID,
  "hll",
  "16thir",
  "bandofbrothers",
  "vocn",
];

/** Marketing and legal pages that render without the app shell. */
export const NO_SHELL_ROUTES: string[] = [
  "/",
  "/foyer",
  "/login",
  "/register",
  "/staff",
  "/about",
  "/premium",
  "/contact",
  "/mods",
  "/apply",
  "/desktop",
  "/why-not-discord",
  "/alternatives",
  "/alternativas",
  "/pricing",
  "/tournaments",
  "/play",
  "/compare",
  "/lfg",
  "/explore",
  "/overlay",
  "/terms",
  "/privacy",
  "/guidelines",
  "/forgot-password",
  "/reset-password",
];

/**
 * What the viewer saw last time, so the next load paints it before hydration:
 * `lobbies[id] = 1` when a member got that lobby's skin, `rooms[roomId] =
 * lobbyId` for rooms of a themed lobby.
 */
export const SKIN_CACHE_KEY = "weered:skin:v1";
export type SkinCache = { lobbies?: Record<string, 1>; rooms?: Record<string, string> };

/**
 * The skin and chrome for a path: [lobbyId or null, minimal chrome?].
 *
 * Pure and self-contained (no outer references, ES5 only): layout.tsx inlines
 * its source into the pre-paint script, so it must run as-is in a bare browser.
 */
export function chromeFor(
  path: string,
  search: string,
  keepDefault: boolean,
  cache: SkinCache | null,
  themeable: string[],
  forced: string[],
  bareRoutes: string[],
): [string | null, boolean] {
  if (search.indexOf("chrome=full") >= 0) return [null, false];
  if (path === "/overlay" || path.indexOf("/overlay/") === 0) return [null, false];
  for (let i = 0; i < bareRoutes.length; i++) {
    const r = bareRoutes[i];
    if (path === r || (r !== "/" && path.indexOf(r + "/") === 0)) return [null, false];
  }
  const parts = path.split("/");
  const lobbies = (cache && cache.lobbies) || {};
  const rooms = (cache && cache.rooms) || {};
  let skin: string | null = null;
  if (parts[1] === "lobby" && parts[2] && parts.length === 3) {
    const lid = decodeURIComponent(parts[2]);
    if (forced.indexOf(lid) >= 0 || (themeable.indexOf(lid) >= 0 && lobbies[lid] === 1)) skin = lid;
  } else if (parts[1] === "room" && parts[2]) {
    const rid = decodeURIComponent(parts[2]);
    let owner = rooms[rid] || null;
    if (!owner) {
      for (let j = 0; j < forced.length; j++) {
        if (rid.indexOf(forced[j] + "-") === 0) owner = forced[j];
      }
    }
    if (owner && themeable.indexOf(owner) >= 0) skin = owner;
  }
  if (keepDefault) skin = null;
  return [skin, !skin];
}

function readJson(key: string): any {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** The viewer's own decision for the current location (browser only). */
export function currentChrome(path: string, search: string): [string | null, boolean] {
  const s = readJson("weered:settings:v0");
  return chromeFor(
    path,
    search,
    !!(s && s.keepDefaultTheme === true),
    readJson(SKIN_CACHE_KEY),
    THEMEABLE_LOBBY_IDS,
    FORCED_THEME_LOBBIES,
    NO_SHELL_ROUTES,
  );
}

/** Write the decision to <html>, touching only attributes that differ. */
export function applyChrome(skin: string | null, min: boolean): void {
  const d = document.documentElement;
  if (skin) {
    if (d.getAttribute("data-weered-lobby") !== skin) d.setAttribute("data-weered-lobby", skin);
  } else if (d.hasAttribute("data-weered-lobby")) d.removeAttribute("data-weered-lobby");
  if (min) {
    if (d.getAttribute("data-weered-chrome") !== "min") d.setAttribute("data-weered-chrome", "min");
  } else if (d.hasAttribute("data-weered-chrome")) d.removeAttribute("data-weered-chrome");
}

/** Remember what this page settled on, so the next load paints it first. */
export function rememberSkin(kind: "lobby" | "room", id: string, lobbyId: string | null): void {
  if (!id) return;
  try {
    const c: SkinCache = readJson(SKIN_CACHE_KEY) || {};
    if (kind === "lobby") {
      const m = { ...(c.lobbies || {}) };
      if (lobbyId) m[id] = 1;
      else delete m[id];
      c.lobbies = m;
    } else {
      const m = { ...(c.rooms || {}) };
      if (lobbyId) m[id] = lobbyId;
      else delete m[id];
      // Bounded: the oldest rooms fall off past 200.
      const keys = Object.keys(m);
      for (let k = 0; k < keys.length - 200; k++) delete m[keys[k]];
      c.rooms = m;
    }
    localStorage.setItem(SKIN_CACHE_KEY, JSON.stringify(c));
  } catch {}
}
