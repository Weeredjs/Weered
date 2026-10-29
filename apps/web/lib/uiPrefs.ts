// The viewer's UI preferences: site theme and colour, sidebar order, and the
// first-run setup state. Stored in this browser for instant paint (the boot
// script in app/layout.tsx reads it before first paint) and on the account
// (GET/PATCH /profile/me/ui) so the browser and the desktop app agree.
// The API whitelists the same fields: apps/api/src/lib/uiPrefs.ts.

/** Every site theme id. The boot script, ThemeRestore, the dock and the
 *  settings sheets all validate against this one list. */
export const SITE_THEME_IDS = [
  "nebula",
  "press",
  "broadcast",
  "ishimura",
  "slate",
  "zinc",
  "stone",
  "gray",
] as const;
export type SiteThemeId = (typeof SITE_THEME_IDS)[number];
export const isSiteTheme = (v: unknown): v is SiteThemeId =>
  typeof v === "string" && (SITE_THEME_IDS as readonly string[]).includes(v);

export type Palette = "violet" | "ocean" | "ember" | "aurora" | "graphite" | "void";
export type RailSection = "card" | "nav" | "presence" | "favs" | "recent";
export type Interest = "work" | "community" | "games" | "place";

export type UiPrefs = {
  theme?: SiteThemeId;
  palette?: Palette;
  stars?: boolean;
  density?: "comfortable" | "compact";
  rail?: { order: RailSection[]; hidden: RailSection[] };
  setup?: "done" | "skipped";
  setupAt?: string;
  interests?: Interest[];
};

export const PREFS_KEY = "weered:ui-prefs:v1";
export const PREFS_EVENT = "weered:ui-prefs";
const THEME_KEY = "weered_theme_v2";
const SETTINGS_KEY = "weered:settings:v0";
const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

export const RAIL_ORDER: RailSection[] = ["card", "nav", "presence", "favs", "recent"];
export const RAIL_LABEL: Record<RailSection, string> = {
  card: "Your card",
  nav: "Navigation",
  presence: "Who's around",
  favs: "Favorites",
  recent: "Recent",
};
export const RAIL_BLURB: Record<RailSection, string> = {
  card: "Avatar, name, status and rank.",
  nav: "Lobby, Home, Forum, Paper. Always on.",
  presence: "Who's online where you are.",
  favs: "The places you starred.",
  recent: "Where you've been lately.",
};

/** The Nebula colourways. `a` is the accent, `b` the deep accent, `c` the
 *  second glow, `ink` the glass cards sit on, `on` the text on an accent fill;
 *  the stylesheet (styles/95-nebula.css) carries the same values. */
export type PaletteColours = {
  name: string;
  tagline: string;
  a: string;
  b: string;
  c: string;
  hi: string;
  bg: string;
  ink: string;
  on: string;
};
export const PALETTES: Record<Palette, PaletteColours> = {
  violet: {
    name: "Violet",
    tagline: "Weered's own. Deep space purple.",
    a: "#8b5cf6",
    b: "#7c3aed",
    c: "#312e81",
    hi: "#c4b5fd",
    bg: "#07060f",
    ink: "#0d0b1c",
    on: "#ffffff",
  },
  ocean: {
    name: "Ocean",
    tagline: "Cold blue, open water.",
    a: "#38bdf8",
    b: "#0284c7",
    c: "#1e3a8a",
    hi: "#bae6fd",
    bg: "#040a12",
    ink: "#080f1c",
    on: "#ffffff",
  },
  ember: {
    name: "Ember",
    tagline: "Warm coals, late nights.",
    a: "#fb923c",
    b: "#ea580c",
    c: "#7f1d1d",
    hi: "#fed7aa",
    bg: "#0d0705",
    ink: "#180d0a",
    on: "#ffffff",
  },
  aurora: {
    name: "Aurora",
    tagline: "Green sky, violet edge.",
    a: "#34d399",
    b: "#059669",
    c: "#4c1d95",
    hi: "#a7f3d0",
    bg: "#040d0b",
    ink: "#081513",
    on: "#ffffff",
  },
  graphite: {
    name: "Graphite",
    tagline: "Mid grey, no colour.",
    a: "#d6dae2",
    b: "#8a909c",
    c: "#606572",
    hi: "#f1f3f6",
    bg: "#2c2e34",
    ink: "#42454e",
    on: "#15161a",
  },
  void: {
    name: "Void",
    tagline: "Near black. Lights low.",
    a: "#e2e4e9",
    b: "#787c86",
    c: "#2c2e36",
    hi: "#f4f5f7",
    bg: "#040405",
    ink: "#111114",
    on: "#0b0b0d",
  },
};
export const PALETTE_IDS = Object.keys(PALETTES) as Palette[];

export function readUiPrefs(): UiPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const p = raw ? JSON.parse(raw) : null;
    return p && typeof p === "object" ? (p as UiPrefs) : {};
  } catch {
    return {};
  }
}

/** The order to draw the sidebar in, with any section a stored order lacks
 *  appended in its default slot. */
export function railOrder(p: UiPrefs): RailSection[] {
  const order = (p.rail?.order || []).filter((s) => RAIL_ORDER.includes(s));
  for (const s of RAIL_ORDER) if (!order.includes(s)) order.push(s);
  return order;
}

/** Paint the prefs onto <html>. The office host keeps its forced theme. */
export function applyUiPrefs(p: UiPrefs) {
  if (typeof document === "undefined") return;
  const d = document.documentElement;
  const pro = d.hasAttribute("data-pro-host");
  if (p.theme && !pro) {
    d.setAttribute("data-weered-theme", p.theme);
    try {
      localStorage.setItem(THEME_KEY, p.theme);
      const raw = localStorage.getItem(SETTINGS_KEY);
      const cur = raw ? JSON.parse(raw) : {};
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({ ...cur, theme: p.theme, ...(p.density ? { density: p.density } : {}) }),
      );
    } catch {}
  }
  d.setAttribute("data-weered-palette", p.palette || "violet");
  if (p.stars === false) d.setAttribute("data-weered-stars", "off");
  else d.removeAttribute("data-weered-stars");
  if (p.density) d.setAttribute("data-weered-density", p.density);
}

/** Merge a change into the stored prefs, paint it, tell listeners, and save
 *  it to the account unless `local` is set. Returns the merged prefs. */
export function saveUiPrefs(patch: UiPrefs, opts: { local?: boolean } = {}): UiPrefs {
  const next = { ...readUiPrefs(), ...patch };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {}
  applyUiPrefs(next);
  try {
    window.dispatchEvent(new CustomEvent(PREFS_EVENT, { detail: next }));
  } catch {}
  if (!opts.local) {
    fetch(`${API}/profile/me/ui`, {
      credentials: "include",
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefs: patch }),
    }).catch(() => {});
  }
  return next;
}

/** Pull the account's prefs and lay them over this browser's. Returns the
 *  merged prefs, or null when signed out or offline. */
export async function pullUiPrefs(): Promise<UiPrefs | null> {
  try {
    const r = await fetch(`${API}/profile/me/ui`, { credentials: "include" });
    if (!r.ok) return null;
    const j = await r.json();
    const local = readUiPrefs();
    if (!j?.prefs) {
      // Nothing on the account yet: seed it from this browser, if anything.
      if (Object.keys(local).length) {
        fetch(`${API}/profile/me/ui`, {
          credentials: "include",
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prefs: local }),
        }).catch(() => {});
      }
      return local;
    }
    return saveUiPrefs(j.prefs as UiPrefs, { local: true });
  } catch {
    return null;
  }
}
