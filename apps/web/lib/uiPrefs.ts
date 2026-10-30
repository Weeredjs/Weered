// The viewer's UI preferences: site theme and colour, their own layout, and
// the first-run setup state. Stored in this browser for instant paint (the boot
// script in app/layout.tsx reads it before first paint) and on the account
// (GET/PATCH /profile/me/ui) so the browser and the desktop app agree.
// The API whitelists the same fields: apps/api/src/lib/uiPrefs.ts.
import type { ShellLayout } from "./shellLayout";

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

export type NamedPalette =
  | "violet"
  | "ocean"
  | "ember"
  | "aurora"
  | "graphite"
  | "void"
  | "blizzard";
/** A named colourway, or "custom": one colour the viewer picked (`accent`). */
export type Palette = NamedPalette | "custom";
export type RailSection = "card" | "nav" | "presence" | "favs" | "recent";
/** Nebula's display face: titles, labels and buttons. */
export type NebulaFont = "default" | "condensed" | "serif" | "stencil" | "clean" | "mono";
/** Corners: round (Nebula's own), soft, square (all corners), cut (chamfered). */
export type ShellShape = "round" | "soft" | "square" | "cut";
/** Line weight: soft glow hairlines, or hard crisp edges. */
export type ShellLines = "soft" | "hard";
/** What the cards are made of. */
export type ShellTexture = "glass" | "grid" | "lines" | "dots" | "solid";
/** What's behind the glass. */
export type ShellBackdrop = "sky" | "grid" | "plain";
/** A moving effect behind everything (components/LobbyAmbient.tsx). */
export type ShellFx =
  | "none"
  | "snow"
  | "blizzard"
  | "embers"
  | "rain"
  | "petals"
  | "bubbles"
  | "fireflies"
  | "matrix"
  | "symbol";

export type UiPrefs = {
  theme?: SiteThemeId;
  palette?: Palette;
  stars?: boolean;
  density?: "comfortable" | "compact";
  rail?: { order: RailSection[]; hidden: RailSection[] };
  /** The viewer's own layout (lib/shellLayout.ts); absent = stock. */
  shell?: ShellLayout;
  /** The custom colourway's colour, when palette is "custom". */
  accent?: string;
  font?: NebulaFont;
  shape?: ShellShape;
  lines?: ShellLines;
  texture?: ShellTexture;
  backdrop?: ShellBackdrop;
  fx?: ShellFx;
  fxIntensity?: number;
  fxSymbol?: string;
  /** The effect floats over the page instead of behind the glass. */
  fxFront?: boolean;
  setup?: "done" | "skipped";
  setupAt?: string;
};

export const PREFS_KEY = "weered:ui-prefs:v1";
export const PREFS_EVENT = "weered:ui-prefs";
const THEME_KEY = "weered_theme_v2";
const SETTINGS_KEY = "weered:settings:v0";
const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

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
  /** A light colourway: dark text on white glass (styles/99-nebula-blizzard.css). */
  light?: boolean;
};
export const PALETTES: Record<NamedPalette, PaletteColours> = {
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
  blizzard: {
    name: "Blizzard",
    tagline: "White out. Hard lines.",
    a: "#0284c7",
    b: "#0369a1",
    c: "#bfdbfe",
    hi: "#0c4a6e",
    bg: "#e9eff5",
    ink: "#ffffff",
    on: "#ffffff",
    light: true,
  },
};
/** Blizzard (the white one) is offered once its stylesheet is in. */
export const BLIZZARD_READY = false;
export const PALETTE_IDS = (Object.keys(PALETTES) as NamedPalette[]).filter(
  (id) => id !== "blizzard" || BLIZZARD_READY,
);

export const NEBULA_FONTS: Record<NebulaFont, { name: string; stack: string }> = {
  default: { name: "Weered", stack: "var(--font-rajdhani), 'Rajdhani', system-ui, sans-serif" },
  condensed: { name: "Condensed", stack: "var(--font-barlow), 'Barlow Condensed', sans-serif" },
  serif: { name: "Serif", stack: "var(--font-cormorant), Georgia, serif" },
  stencil: { name: "Stencil", stack: "var(--font-saira-stencil), Bahnschrift, sans-serif" },
  clean: { name: "Clean", stack: "'Inter', 'Segoe UI', system-ui, sans-serif" },
  mono: { name: "Terminal", stack: "'Cascadia Code', 'JetBrains Mono', Consolas, monospace" },
};
export const NEBULA_FONT_IDS = Object.keys(NEBULA_FONTS) as NebulaFont[];

export const isHexColour = (v: unknown): v is string =>
  typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);

function hexRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslHex(h: number, s: number, l: number): string {
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return (
    "#" +
    [f(0), f(8), f(4)]
      .map((x) =>
        Math.round(x * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
function luminance(hex: string): number {
  const [r, g, b] = hexRgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** A whole colourway from one colour: deep accent, second glow, light tint,
 *  and a near-black sky tinted with the same hue. */
export function customPalette(accent: string): PaletteColours {
  const [h, s, l] = rgbHsl(...hexRgb(isHexColour(accent) ? accent : "#8b5cf6"));
  const a = hslHex(h, s, Math.min(0.74, Math.max(0.52, l)));
  return {
    name: "Custom",
    tagline: "Your own colour.",
    a,
    b: hslHex(h, Math.min(1, s * 1.05), Math.max(0.3, Math.min(0.62, l) - 0.12)),
    c: hslHex((h + 330) % 360, s * 0.75, 0.22),
    hi: hslHex(h, Math.min(1, s * 0.9 + 0.1), 0.86),
    bg: hslHex(h, s * 0.45, 0.035),
    ink: hslHex(h, s * 0.4, 0.075),
    on: luminance(a) > 0.5 ? "#111114" : "#ffffff",
  };
}

/** The colours for any colourway, custom included. */
export function paletteColours(palette?: Palette | null, accent?: string | null): PaletteColours {
  if (palette === "custom") return customPalette(accent || "");
  return PALETTES[(palette && palette in PALETTES ? palette : "violet") as NamedPalette];
}

const NB_VARS = [
  "--nb-a",
  "--nb-b",
  "--nb-c",
  "--nb-hi",
  "--nb-bg",
  "--nb-ink",
  "--nb-ink-2",
  "--nb-on",
  "--nb-mute",
];
/** Where the boot script (app/layout.tsx) finds a custom colourway's tokens. */
export const NB_CUSTOM_KEY = "weered:nb-custom";

/** The Nebula tokens for a colourway, written the way the stylesheet writes
 *  them (channels as "r g b"). */
export function nebulaVars(c: PaletteColours): Record<string, string> {
  const ch = (hex: string) => hexRgb(hex).join(" ");
  const [h, s] = rgbHsl(...hexRgb(c.a));
  return {
    "--nb-a": ch(c.a),
    "--nb-b": ch(c.b),
    "--nb-c": ch(c.c),
    "--nb-hi": c.hi,
    "--nb-bg": c.bg,
    "--nb-ink": ch(c.ink),
    "--nb-ink-2": ch(hslHex(h, s * 0.4, 0.05)),
    "--nb-on": c.on,
    "--nb-mute": ch(hslHex(h, 0.25, 0.85)),
  };
}

export function readUiPrefs(): UiPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const p = raw ? JSON.parse(raw) : null;
    return p && typeof p === "object" ? (p as UiPrefs) : {};
  } catch {
    return {};
  }
}

/** Paint the prefs onto <html> and nothing else: Design mode previews a look
 *  with this before it is saved. The office host keeps its forced theme. */
export function paintUiPrefs(p: UiPrefs) {
  if (typeof document === "undefined") return;
  const d = document.documentElement;
  if (p.theme && !d.hasAttribute("data-pro-host")) d.setAttribute("data-weered-theme", p.theme);
  d.setAttribute("data-weered-palette", p.palette || "violet");
  for (const k of NB_VARS) d.style.removeProperty(k);
  if (p.palette === "custom") {
    const vars = nebulaVars(customPalette(p.accent || ""));
    for (const [k, v] of Object.entries(vars)) d.style.setProperty(k, v);
  }
  if (p.font && p.font !== "default") d.setAttribute("data-weered-font", p.font);
  else d.removeAttribute("data-weered-font");
  // Structure: only the non-default choices are written.
  const attr = (name: string, v: string | undefined, dflt: string) => {
    if (v && v !== dflt) d.setAttribute(name, v);
    else d.removeAttribute(name);
  };
  attr("data-weered-shape", p.shape, "round");
  attr("data-weered-lines", p.lines, "soft");
  attr("data-weered-texture", p.texture, "glass");
  attr("data-weered-backdrop", p.backdrop, "sky");
  if (p.stars === false) d.setAttribute("data-weered-stars", "off");
  else d.removeAttribute("data-weered-stars");
  if (p.density) d.setAttribute("data-weered-density", p.density);
}

/** Paint the prefs onto <html> and remember the look where the boot script
 *  and the older settings read it. */
export function applyUiPrefs(p: UiPrefs) {
  if (typeof document === "undefined") return;
  paintUiPrefs(p);
  try {
    if (p.palette === "custom")
      localStorage.setItem(
        NB_CUSTOM_KEY,
        JSON.stringify(nebulaVars(customPalette(p.accent || ""))),
      );
    else localStorage.removeItem(NB_CUSTOM_KEY);
  } catch {}
  const pro = document.documentElement.hasAttribute("data-pro-host");
  if (p.theme && !pro) {
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
}

export type AccountSave = "ok" | "too_large" | "failed";

function pushToAccount(patch: UiPrefs): Promise<AccountSave> {
  return fetch(`${API}/profile/me/ui`, {
    credentials: "include",
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefs: patch }),
  })
    .then((r) => (r.ok ? "ok" : r.status === 413 ? "too_large" : "failed") as AccountSave)
    .catch(() => "failed" as AccountSave);
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
  if (!opts.local) void pushToAccount(patch);
  return next;
}

/** Save to the account first and, once it has confirmed, here too: a change
 *  the account refused must not show as saved in this browser only, to be
 *  undone by the next sync. */
export async function saveUiPrefsToAccount(patch: UiPrefs): Promise<AccountSave> {
  const res = await pushToAccount(patch);
  if (res === "ok") saveUiPrefs(patch, { local: true });
  return res;
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
