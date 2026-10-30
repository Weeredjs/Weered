// Per-account UI preferences: the site theme and its colour, the sidebar's
// section order, the viewer's own layout ("Design your Weered"), and whether
// first-run setup has been done or skipped. Kept on the account so the
// browser and the desktop app agree. Everything a client sends is
// whitelisted here; unknown keys and bad values are dropped.

export const UI_THEMES = [
  "nebula",
  "press",
  "broadcast",
  "ishimura",
  "slate",
  "zinc",
  "stone",
  "gray",
] as const;
export const UI_PALETTES = [
  "violet",
  "ocean",
  "ember",
  "aurora",
  "graphite",
  "void",
  "custom",
] as const;
export const UI_FONTS = ["default", "condensed", "serif", "stencil", "clean", "mono"] as const;
export const RAIL_SECTIONS = ["card", "nav", "presence", "favs", "recent"] as const;
export const UI_INTERESTS = ["work", "community", "games", "place"] as const;

// The viewer's own layout (apps/web/lib/shellLayout.ts): which built-in
// section sits in which region, and blocks. The web client cleans every
// block's settings again when it reads them; here the shape is checked and
// the size bounded.
const SHELL_CORES: Record<string, readonly string[]> = {
  card: ["left"],
  nav: ["left"],
  presence: ["left"],
  favs: ["left"],
  recent: ["left"],
  whoshere: ["left", "right"],
  rooms: ["left", "right"],
  friends: ["left", "right"],
  crew: ["left", "right"],
  discover: ["left", "right"],
  ticker: ["home"],
  pulse: ["home"],
  hero: ["home"],
  live: ["home"],
  featured: ["home"],
  news: ["home"],
  upgrade: ["home"],
  popular: ["home"],
  dms: ["home"],
  activity: ["home"],
  visited: ["home"],
};
export const SHELL_BLOCK_TYPES = [
  "welcome",
  "links",
  "rules",
  "countdown",
  "image",
  "stream",
  "video",
  "music",
  "rooms",
  "events",
  "stats",
  "feed",
  "requests",
] as const;
const SHELL_REGIONS = ["left", "right", "home"] as const;
export const SHELL_MAX_BYTES = 24_000;
const SHELL_MAX_PER_REGION = 24;
const SHELL_MAX_BLOCKS = 30;

type ShellBlock = { id: string; type: string; size: string; props: Record<string, unknown> };
type ShellItem = string | ShellBlock;
export type ShellPrefs = {
  v: 1;
  preset?: string;
  left: ShellItem[];
  right: ShellItem[];
  home: ShellItem[];
  hidden: string[];
};

export type RailSection = (typeof RAIL_SECTIONS)[number];
export type UiPrefs = {
  theme?: (typeof UI_THEMES)[number];
  palette?: (typeof UI_PALETTES)[number];
  accent?: string;
  font?: (typeof UI_FONTS)[number];
  stars?: boolean;
  density?: "comfortable" | "compact";
  rail?: { order: RailSection[]; hidden: RailSection[] };
  shell?: ShellPrefs;
  setup?: "done" | "skipped";
  setupAt?: string;
  interests?: (typeof UI_INTERESTS)[number][];
};

const oneOf = <T extends string>(list: readonly T[], v: unknown): T | undefined =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : undefined;

const listOf = <T extends string>(list: readonly T[], v: unknown): T[] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const out: T[] = [];
  for (const x of v) {
    const ok = oneOf(list, x);
    if (ok && !out.includes(ok)) out.push(ok);
  }
  return out;
};

/** JSON-safe and bounded: short strings, finite numbers, shallow objects. */
function cleanValue(v: unknown, depth: number): unknown {
  if (typeof v === "string") return v.slice(0, 2000);
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "boolean") return v;
  if (depth >= 3 || !v || typeof v !== "object") return undefined;
  if (Array.isArray(v))
    return v
      .slice(0, 12)
      .map((x) => cleanValue(x, depth + 1))
      .filter((x) => x !== undefined);
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v).slice(0, 16)) {
    if (!/^[a-zA-Z]{1,20}$/.test(k)) continue;
    const c = cleanValue(x, depth + 1);
    if (c !== undefined) out[k] = c;
  }
  return out;
}

function sanitizeShell(raw: unknown): ShellPrefs | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  let size = 0;
  try {
    size = JSON.stringify(raw).length;
  } catch {
    return undefined;
  }
  if (size > SHELL_MAX_BYTES) return undefined;
  const r = raw as any;
  const placed = new Set<string>();
  const ids = new Set<string>();
  let blocks = 0;
  const take = (list: unknown, region: (typeof SHELL_REGIONS)[number]): ShellItem[] => {
    const out: ShellItem[] = [];
    for (const x of Array.isArray(list) ? list : []) {
      if (out.length >= SHELL_MAX_PER_REGION) break;
      if (typeof x === "string") {
        if (!SHELL_CORES[x]?.includes(region) || placed.has(x)) continue;
        placed.add(x);
        out.push(x);
        continue;
      }
      if (!x || typeof x !== "object" || blocks >= SHELL_MAX_BLOCKS) continue;
      const b = x as any;
      if (!(SHELL_BLOCK_TYPES as readonly string[]).includes(b.type)) continue;
      if (typeof b.id !== "string" || !/^[a-z0-9_-]{1,40}$/i.test(b.id) || ids.has(b.id)) continue;
      ids.add(b.id);
      blocks++;
      out.push({
        id: b.id,
        type: b.type,
        size: ["s", "m", "l", "full"].includes(b.size) ? b.size : "m",
        props: (cleanValue(b.props && typeof b.props === "object" ? b.props : {}, 0) ||
          {}) as Record<string, unknown>,
      });
    }
    return out;
  };
  const left = take(r.left, "left");
  const right = take(r.right, "right");
  const home = take(r.home, "home");
  const hidden = (Array.isArray(r.hidden) ? r.hidden : []).filter(
    (h: unknown, i: number, a: unknown[]) =>
      typeof h === "string" &&
      SHELL_CORES[h] &&
      h !== "nav" &&
      h !== "upgrade" &&
      !placed.has(h) &&
      a.indexOf(h) === i,
  ) as string[];
  const preset =
    typeof r.preset === "string" && /^[a-z0-9-]{1,40}$/.test(r.preset) ? r.preset : undefined;
  return { v: 1, ...(preset ? { preset } : {}), left, right, home, hidden };
}

/** Only the known fields, each validated. Never throws. */
export function sanitizeUiPrefs(raw: unknown): UiPrefs {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as any) : {};
  const out: UiPrefs = {};
  const theme = oneOf(UI_THEMES, src.theme);
  if (theme) out.theme = theme;
  const palette = oneOf(UI_PALETTES, src.palette);
  if (palette) out.palette = palette;
  if (typeof src.accent === "string" && /^#[0-9a-f]{6}$/i.test(src.accent)) out.accent = src.accent;
  const font = oneOf(UI_FONTS, src.font);
  if (font) out.font = font;
  if (typeof src.stars === "boolean") out.stars = src.stars;
  const density = oneOf(["comfortable", "compact"] as const, src.density);
  if (density) out.density = density;
  if (src.rail && typeof src.rail === "object") {
    const order = listOf(RAIL_SECTIONS, src.rail.order) || [];
    // Every section appears exactly once: missing ones keep their default slot
    // at the end, so a client that predates a section can't lose it.
    for (const s of RAIL_SECTIONS) if (!order.includes(s)) order.push(s);
    const hidden = (listOf(RAIL_SECTIONS, src.rail.hidden) || []).filter((s) => s !== "nav");
    out.rail = { order, hidden };
  }
  const shell = sanitizeShell(src.shell);
  if (shell) out.shell = shell;
  const setup = oneOf(["done", "skipped"] as const, src.setup);
  if (setup) out.setup = setup;
  if (typeof src.setupAt === "string" && !Number.isNaN(Date.parse(src.setupAt)))
    out.setupAt = new Date(src.setupAt).toISOString();
  const interests = listOf(UI_INTERESTS, src.interests);
  if (interests) out.interests = interests;
  return out;
}

/** The stored prefs with a patch laid over them, field by field. */
export function mergeUiPrefs(prev: unknown, patch: unknown): UiPrefs {
  return { ...sanitizeUiPrefs(prev), ...sanitizeUiPrefs(patch) };
}
