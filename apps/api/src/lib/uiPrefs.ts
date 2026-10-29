// Per-account UI preferences: the site theme and its colour, the sidebar's
// section order, and whether first-run setup has been done or skipped. Kept on
// the account so the browser and the desktop app agree. Everything a client
// sends is whitelisted here; unknown keys and bad values are dropped.

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
export const UI_PALETTES = ["violet", "ocean", "ember", "aurora", "graphite", "void"] as const;
export const RAIL_SECTIONS = ["card", "nav", "presence", "favs", "recent"] as const;
export const UI_INTERESTS = ["work", "community", "games", "place"] as const;

export type RailSection = (typeof RAIL_SECTIONS)[number];
export type UiPrefs = {
  theme?: (typeof UI_THEMES)[number];
  palette?: (typeof UI_PALETTES)[number];
  stars?: boolean;
  density?: "comfortable" | "compact";
  rail?: { order: RailSection[]; hidden: RailSection[] };
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

/** Only the known fields, each validated. Never throws. */
export function sanitizeUiPrefs(raw: unknown): UiPrefs {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as any) : {};
  const out: UiPrefs = {};
  const theme = oneOf(UI_THEMES, src.theme);
  if (theme) out.theme = theme;
  const palette = oneOf(UI_PALETTES, src.palette);
  if (palette) out.palette = palette;
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
