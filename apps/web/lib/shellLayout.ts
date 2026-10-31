// The viewer's own Weered: which sections sit in the left sidebar, the right
// panel and Home, in what order, plus blocks from the same catalog a lobby's
// Design mode offers. Built 2026-10-29 ("build your own Weered, then your own
// lobby"). Stored on the account as uiPrefs.shell; without one the viewer
// gets the stock layout, or the sidebar order they picked in the first setup.
//
// Everything read back goes through sanitizeShell(), so an old or hand-edited
// blob can never break the shell: unknown sections and blocks are dropped, and
// a section added to Weered later turns up in its stock place.

import { sanitizeProps, type BlockSize, type BlockType } from "./lobbyLayout";

export type ShellRegion = "left" | "right" | "home";
export const REGIONS: ShellRegion[] = ["left", "right", "home"];
export const REGION_LABEL: Record<ShellRegion, string> = {
  left: "Left sidebar",
  right: "Right panel",
  home: "Home",
};

export const LEFT_CORES = ["card", "nav", "presence", "favs", "recent"] as const;
export const PANEL_CORES = ["whoshere", "rooms", "friends", "crew", "discover"] as const;
export const HOME_CORES = [
  "build",
  "ticker",
  "pulse",
  "hero",
  "live",
  "featured",
  "news",
  "upgrade",
  "popular",
  "dms",
  "activity",
  "visited",
] as const;
export type LeftCore = (typeof LEFT_CORES)[number];
export type PanelCore = (typeof PANEL_CORES)[number];
export type HomeCore = (typeof HOME_CORES)[number];
export type CoreId = LeftCore | PanelCore | HomeCore;
export const CORE_IDS: CoreId[] = [...LEFT_CORES, ...PANEL_CORES, ...HOME_CORES];

/** Every lobby block but the game integration, which needs a lobby's module,
 *  and the front desk, which rings a lobby's staff. */
export type ShellBlockType = Exclude<BlockType, "game" | "frontdesk">;
export const SHELL_BLOCK_TYPES: ShellBlockType[] = [
  "welcome",
  "links",
  "rules",
  "countdown",
  "image",
  "stream",
  "video",
  "music",
  "web",
  "rooms",
  "events",
  "stats",
  "feed",
  "requests",
];

export type ShellBlock = {
  id: string;
  type: ShellBlockType;
  size: BlockSize;
  props: Record<string, any>;
};
/** A built-in section is its id; a block is an object. */
export type ShellItem = CoreId | ShellBlock;

export type ShellLayout = {
  v: 1;
  /** The preset it came from, until the first edit. */
  preset?: string;
  left: ShellItem[];
  right: ShellItem[];
  home: ShellItem[];
  /** Sections switched off. Every section is in one region or here. */
  hidden: CoreId[];
};

export type CoreMeta = {
  name: string;
  blurb: string;
  icon: string;
  regions: ShellRegion[];
  /** Can't be switched off. */
  locked?: boolean;
};

// Your card, the navigation, Presence, Favorites and Recent are built into
// the left sidebar (they share its state), so they move within it. The
// panel sections live in either sidebar. Home's sections stay on Home.
export const CORE_META: Record<CoreId, CoreMeta> = {
  card: {
    name: "Your card",
    blurb: "Avatar, name, status and rank.",
    icon: "🪪",
    regions: ["left"],
  },
  nav: {
    name: "Navigation",
    blurb: "Lobby, Home, Forum, Paper. Always on.",
    icon: "🧭",
    regions: ["left"],
    locked: true,
  },
  presence: {
    name: "Presence",
    blurb: "Who's in the room or lobby you're in.",
    icon: "👥",
    regions: ["left"],
  },
  favs: { name: "Favorites", blurb: "The places you starred.", icon: "⭐", regions: ["left"] },
  recent: { name: "Recent", blurb: "Where you've been lately.", icon: "🕘", regions: ["left"] },
  whoshere: {
    name: "Who's here",
    blurb: "Faces in this lobby. Shows until you have friends or a crew.",
    icon: "👋",
    regions: ["left", "right"],
  },
  rooms: {
    name: "Rooms",
    blurb: "The rooms where you are, with who's in them.",
    icon: "🎙",
    regions: ["left", "right"],
  },
  friends: {
    name: "Friends",
    blurb: "Your friends, where they are, Join and Invite.",
    icon: "🤝",
    regions: ["left", "right"],
  },
  crew: { name: "Crew", blurb: "Your crew, online first.", icon: "🛡", regions: ["left", "right"] },
  discover: {
    name: "Discover",
    blurb: "Hot lobbies. Shows until you have friends or a crew.",
    icon: "🔭",
    regions: ["left", "right"],
  },
  build: {
    name: "Build your own",
    blurb: "Build a lobby, change your drip, and the lobbies you run.",
    icon: "🛠",
    regions: ["home"],
  },
  ticker: {
    name: "Activity ticker",
    blurb: "Live rooms and lobbies, scrolling past.",
    icon: "📣",
    regions: ["home"],
  },
  pulse: {
    name: "Friends & crew",
    blurb: "Friends and crew who are on, where they are, one click to join them.",
    icon: "💫",
    regions: ["home"],
  },
  hero: { name: "Featured lobby", blurb: "The big banner up top.", icon: "🏟", regions: ["home"] },
  live: {
    name: "Live now",
    blurb: "The featured stream and rooms with people in them.",
    icon: "🔴",
    regions: ["home"],
  },
  featured: {
    name: "Featured lobbies",
    blurb: "Verified communities, browse, build your own.",
    icon: "✦",
    regions: ["home"],
  },
  news: {
    name: "Pinned news",
    blurb: "Announcements and headlines.",
    icon: "📰",
    regions: ["home"],
  },
  upgrade: {
    name: "Upgrade",
    blurb: "Shown to free accounts.",
    icon: "👑",
    regions: ["home"],
    locked: true,
  },
  popular: {
    name: "Popular rooms",
    blurb: "The busiest rooms right now.",
    icon: "🔥",
    regions: ["home"],
  },
  dms: { name: "Messages", blurb: "Your latest conversations.", icon: "💬", regions: ["home"] },
  activity: { name: "Activity", blurb: "What's been happening.", icon: "📈", regions: ["home"] },
  visited: {
    name: "Recently visited",
    blurb: "Places you were in lately.",
    icon: "🧳",
    regions: ["home"],
  },
};

export type ShellBlockMeta = {
  type: ShellBlockType;
  name: string;
  blurb: string;
  icon: string;
  group: "Essentials" | "Media" | "From a lobby";
  /** Reads from a lobby the viewer picks (Weered's own when none). */
  lobbyBound?: boolean;
  /** The paid-plan candidates, for when SHELL_GATE is switched on. */
  plan?: "plus";
};

export const SHELL_BLOCKS: ShellBlockMeta[] = [
  {
    type: "welcome",
    name: "Banner",
    blurb: "A headline, a line, a button.",
    icon: "✦",
    group: "Essentials",
  },
  {
    type: "links",
    name: "Links",
    blurb: "Your sites, socials, tools.",
    icon: "🔗",
    group: "Essentials",
  },
  {
    type: "rules",
    name: "List",
    blurb: "Goals, rules, a to-do. One per line.",
    icon: "📜",
    group: "Essentials",
  },
  {
    type: "countdown",
    name: "Countdown",
    blurb: "Ticks down to the big night.",
    icon: "⏳",
    group: "Essentials",
  },
  { type: "image", name: "Image", blurb: "Art, a poster, a map.", icon: "🖼", group: "Essentials" },
  {
    type: "stream",
    name: "Twitch stream",
    blurb: "A live channel, right in your sidebar.",
    icon: "📺",
    group: "Media",
    plan: "plus",
  },
  {
    type: "video",
    name: "YouTube",
    blurb: "A video or a playlist.",
    icon: "▶",
    group: "Media",
    plan: "plus",
  },
  {
    type: "music",
    name: "Soundtrack",
    blurb: "A Spotify or YouTube playlist that plays on.",
    icon: "🎵",
    group: "Media",
    plan: "plus",
  },
  {
    type: "web",
    name: "Webpage",
    blurb: "Any site that allows it, live. The rest as a link card.",
    icon: "🌐",
    group: "Media",
    plan: "plus",
  },
  {
    type: "rooms",
    name: "Rooms",
    blurb: "Live rooms in a lobby you pick.",
    icon: "🎙",
    group: "From a lobby",
    lobbyBound: true,
  },
  {
    type: "events",
    name: "Up next",
    blurb: "The next events in a lobby you pick.",
    icon: "📅",
    group: "From a lobby",
    lobbyBound: true,
  },
  {
    type: "stats",
    name: "Pulse",
    blurb: "Members, online now, rooms live.",
    icon: "📊",
    group: "From a lobby",
    lobbyBound: true,
  },
  {
    type: "feed",
    name: "Latest posts",
    blurb: "The newest posts in a lobby you pick.",
    icon: "🗞",
    group: "From a lobby",
    lobbyBound: true,
  },
  {
    type: "requests",
    name: "Request board",
    blurb: "What people want built next.",
    icon: "🗳",
    group: "From a lobby",
    lobbyBound: true,
  },
];
export const BLOCK_META: Record<ShellBlockType, ShellBlockMeta> = Object.fromEntries(
  SHELL_BLOCKS.map((b) => [b.type, b]),
) as Record<ShellBlockType, ShellBlockMeta>;

/** Paid-plan switch. Everything is open to everyone until it's on; then the
 *  blocks marked `plan: "plus"` need a paid tier. */
export const SHELL_GATE = false;
export function canUseBlock(type: ShellBlockType, tier?: string | null): boolean {
  if (!SHELL_GATE || !BLOCK_META[type]?.plan) return true;
  return String(tier || "INNOCENT").toUpperCase() !== "INNOCENT";
}

export const isCore = (it: ShellItem): it is CoreId => typeof it === "string";
export const keyOf = (it: ShellItem): string => (isCore(it) ? it : it.id);
export const regionsFor = (it: ShellItem): ShellRegion[] =>
  isCore(it) ? CORE_META[it].regions : REGIONS;
export const canPlace = (it: ShellItem, region: ShellRegion) => regionsFor(it).includes(region);
export const itemName = (it: ShellItem): string =>
  isCore(it) ? CORE_META[it].name : BLOCK_META[it.type]?.name || it.type;
export const itemIcon = (it: ShellItem): string =>
  isCore(it) ? CORE_META[it].icon : BLOCK_META[it.type]?.icon || "▪";

// Home, re-arranged 2026-10-30 (James: "lose staff pics", "a focus on build
// your own. Right at the top", "this entire section needs a re-arrangement"):
// build first, then who's on and what's live, the lobbies, the news. The
// rest repeated something already on screen (the ticker and the big banner
// list lobbies the grid shows; Recently visited and Messages are in the
// sidebar and the dock; Activity was an XP log), so they start switched off,
// one click away in Design.
const STOCK: Record<ShellRegion, CoreId[]> = {
  left: ["card", "nav", "presence", "favs", "recent"],
  right: ["whoshere", "rooms", "friends", "crew", "discover"],
  home: ["build", "pulse", "live", "featured", "news", "upgrade"],
};
/** Sections that start switched off. */
const STOCK_OFF: CoreId[] = ["ticker", "hero", "popular", "dms", "activity", "visited"];
/** Home as it came before 2026-10-30. A saved Home still in exactly this order
 *  was never arranged by hand, so it follows the new one; the office desk
 *  (components/useOfficeSkin.ts) keeps it. */
export const LEGACY_HOME: CoreId[] = [
  "ticker",
  "pulse",
  "hero",
  "live",
  "featured",
  "news",
  "upgrade",
  "popular",
  "dms",
  "activity",
  "visited",
];

export function stockShell(): ShellLayout {
  return {
    v: 1,
    left: [...STOCK.left],
    right: [...STOCK.right],
    home: [...STOCK.home],
    hidden: [...STOCK_OFF],
  };
}

const SIZES: BlockSize[] = ["s", "m", "l", "full"];
const BLOCK_ID_RE = /^[a-z0-9_-]{1,40}$/i;
const LOBBY_ID_RE = /^[a-z0-9][a-z0-9._/-]{0,79}$/i;
// A region holds its own sections plus every block (Home: 11 + 30); the
// real limit is the block total.
const MAX_PER_REGION = 48;
/** The most the account keeps for a layout (apps/api/src/lib/uiPrefs.ts). */
export const SHELL_MAX_CHARS = 24_000;
const MAX_BLOCKS = 30;

export const freshBlockId = () =>
  `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** A path on Weered: one leading slash, URL characters only (no backslash,
 *  which browsers read as "//" and leave the site by). */
export const isSitePath = (s: string) => /^\/(?![/\\])[A-Za-z0-9._~!$&'()*+,;=:@%/?#-]*$/.test(s);

/** Where a Banner's button goes: an https link or a path on Weered. */
function safeHref(v: unknown): string {
  const s = typeof v === "string" ? v.trim().slice(0, 600) : "";
  if (!s) return "";
  if (s.startsWith("/")) return isSitePath(s) ? s : "";
  try {
    const u = new URL(s);
    return u.protocol === "https:" ? u.toString() : "";
  } catch {
    return "";
  }
}

function defaultSize(type: ShellBlockType): BlockSize {
  if (type === "welcome" || type === "stream" || type === "video" || type === "web") return "full";
  if (type === "stats") return "s";
  return "m";
}

export function sanitizeShellBlock(raw: unknown): ShellBlock | null {
  const b = raw as any;
  if (!b || typeof b !== "object" || !SHELL_BLOCK_TYPES.includes(b.type)) return null;
  const type = b.type as ShellBlockType;
  const src = b.props && typeof b.props === "object" ? b.props : {};
  const props = sanitizeProps(type, src);
  if (type === "welcome") {
    delete props.ctaTab;
    props.href = safeHref(src.href);
  }
  if (BLOCK_META[type].lobbyBound) {
    props.lobbyId =
      typeof src.lobbyId === "string" && LOBBY_ID_RE.test(src.lobbyId) ? src.lobbyId : "";
  }
  return {
    id: typeof b.id === "string" && BLOCK_ID_RE.test(b.id) ? b.id : freshBlockId(),
    type,
    size: SIZES.includes(b.size) ? b.size : defaultSize(type),
    props,
  };
}

const BLOCK_DEFAULTS: Partial<Record<ShellBlockType, Record<string, any>>> = {
  welcome: { title: "Welcome back", body: "Your space. Make it yours.", cta: "", href: "" },
  rules: { title: "This week", body: "One thing per line." },
  links: { title: "Links", items: [] },
  countdown: { label: "Next big night" },
  web: { height: "m" },
  rooms: { limit: 4 },
  events: { limit: 3 },
  feed: { limit: 3 },
  requests: { limit: 3 },
};

export function newShellBlock(type: ShellBlockType, props: Record<string, any> = {}): ShellBlock {
  return sanitizeShellBlock({
    id: freshBlockId(),
    type,
    size: defaultSize(type),
    props: { ...(BLOCK_DEFAULTS[type] || {}), ...props },
  })!;
}

/** Put any section that is neither placed nor switched off (one added to
 *  Weered after this layout was saved, or a locked one) back in its stock
 *  place: right after the section that comes before it in the stock order. */
function restoreMissing(l: ShellLayout): ShellLayout {
  const has = (id: CoreId) =>
    l.left.includes(id) || l.right.includes(id) || l.home.includes(id) || l.hidden.includes(id);
  for (const id of STOCK_OFF) if (!has(id) && !CORE_META[id].locked) l.hidden.push(id);
  for (const region of REGIONS) {
    const stock = STOCK[region];
    stock.forEach((id, i) => {
      if (has(id)) return;
      const list = l[region];
      const prev = stock
        .slice(0, i)
        .reverse()
        .find((p) => list.includes(p));
      list.splice(prev ? list.indexOf(prev) + 1 : 0, 0, id);
    });
  }
  return l;
}

export function sanitizeShell(raw: unknown): ShellLayout | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as any;
  const placed = new Set<CoreId>();
  const blockIds = new Set<string>();
  let blocks = 0;
  const take = (list: unknown, region: ShellRegion): ShellItem[] => {
    const out: ShellItem[] = [];
    for (const x of Array.isArray(list) ? list : []) {
      if (out.length >= MAX_PER_REGION) break;
      if (typeof x === "string") {
        const id = x as CoreId;
        const meta = CORE_META[id];
        if (!meta || placed.has(id) || !meta.regions.includes(region)) continue;
        placed.add(id);
        out.push(id);
      } else if (blocks < MAX_BLOCKS) {
        const b = sanitizeShellBlock(x);
        if (!b) continue;
        if (blockIds.has(b.id)) b.id = freshBlockId();
        blockIds.add(b.id);
        blocks++;
        out.push(b);
      }
    }
    return out;
  };
  const left = take(r.left, "left");
  const right = take(r.right, "right");
  const legacy =
    Array.isArray(r.home) &&
    r.home.length === LEGACY_HOME.length &&
    r.home.every((x: unknown, i: number) => x === LEGACY_HOME[i]);
  const home = take(legacy ? STOCK.home : r.home, "home");
  const hidden: CoreId[] = [];
  for (const x of Array.isArray(r.hidden) ? r.hidden : []) {
    const id = x as CoreId;
    if (CORE_META[id] && !CORE_META[id].locked && !placed.has(id) && !hidden.includes(id))
      hidden.push(id);
  }
  const preset = typeof r.preset === "string" && PRESET_IDS.has(r.preset) ? r.preset : undefined;
  return restoreMissing({ v: 1, ...(preset ? { preset } : {}), left, right, home, hidden });
}

/** The viewer's layout: the saved one, else the sidebar order from the first
 *  setup (prefs.rail), else stock. */
export function shellFromPrefs(p: {
  shell?: unknown;
  rail?: { order?: string[]; hidden?: string[] };
}): ShellLayout {
  const saved = sanitizeShell(p?.shell);
  if (saved) return saved;
  const base = stockShell();
  const rail = p?.rail;
  if (rail && Array.isArray(rail.order)) {
    const off = new Set((Array.isArray(rail.hidden) ? rail.hidden : []).filter((h) => h !== "nav"));
    const order = rail.order.filter((x): x is LeftCore =>
      (LEFT_CORES as readonly string[]).includes(x),
    );
    for (const s of LEFT_CORES) if (!order.includes(s)) order.push(s);
    base.left = order.filter((s) => !off.has(s));
    base.hidden = [...base.hidden, ...order.filter((s) => off.has(s))];
  }
  return base;
}

/** The first setup's sidebar prefs, kept in step for anything still reading them. */
export function railFromShell(l: ShellLayout): { order: LeftCore[]; hidden: LeftCore[] } {
  const order = l.left.filter((x): x is LeftCore =>
    (LEFT_CORES as readonly string[]).includes(x as string),
  );
  const hidden = LEFT_CORES.filter((s) => !order.includes(s));
  return { order: [...order, ...hidden], hidden };
}

export type Found = { region: ShellRegion | "hidden"; index: number; item: ShellItem };
export function findItem(l: ShellLayout, key: string): Found | null {
  for (const region of REGIONS) {
    const index = l[region].findIndex((x) => keyOf(x) === key);
    if (index >= 0) return { region, index, item: l[region][index] };
  }
  const h = l.hidden.indexOf(key as CoreId);
  return h >= 0 ? { region: "hidden", index: h, item: l.hidden[h] } : null;
}

const without = (list: ShellItem[], key: string) => list.filter((x) => keyOf(x) !== key);

/** Move an item (or bring a switched-off section back) to `region`, before
 *  whatever is at `index` in that region right now. */
export function placeItem(
  l: ShellLayout,
  item: ShellItem,
  region: ShellRegion,
  index: number,
): ShellLayout {
  if (!canPlace(item, region)) return l;
  const key = keyOf(item);
  const cur = findItem(l, key);
  let at = index;
  if (cur && cur.region === region && cur.index < index) at -= 1;
  const next: ShellLayout = {
    v: 1,
    left: without(l.left, key),
    right: without(l.right, key),
    home: without(l.home, key),
    hidden: l.hidden.filter((h) => h !== key),
  };
  const list = next[region];
  list.splice(Math.max(0, Math.min(at, list.length)), 0, item);
  return next;
}

/** Switch a section off, or delete a block. Locked sections stay. */
export function hideItem(l: ShellLayout, key: string): ShellLayout {
  const cur = findItem(l, key);
  if (!cur || cur.region === "hidden") return l;
  if (isCore(cur.item) && CORE_META[cur.item].locked) return l;
  return {
    v: 1,
    left: without(l.left, key),
    right: without(l.right, key),
    home: without(l.home, key),
    hidden: isCore(cur.item) ? [...l.hidden, cur.item] : [...l.hidden],
  };
}

/** One step earlier (-1) or later (1) within its region. */
export function nudgeItem(l: ShellLayout, key: string, dir: -1 | 1): ShellLayout {
  const cur = findItem(l, key);
  if (!cur || cur.region === "hidden") return l;
  const list = [...l[cur.region]];
  const j = cur.index + dir;
  if (j < 0 || j >= list.length) return l;
  [list[cur.index], list[j]] = [list[j], list[cur.index]];
  const { preset: _p, ...rest } = l;
  return { ...rest, [cur.region]: list };
}

/** Change one block. Its settings are kept as typed (a half-written link
 *  must survive the next keystroke); sanitizeShell cleans them on save and
 *  on every read, and ShellBlockView checks links before it draws them. */
export function patchBlock(
  l: ShellLayout,
  id: string,
  fn: (b: ShellBlock) => ShellBlock,
): ShellLayout {
  const map = (list: ShellItem[]) =>
    list.map((x) => (!isCore(x) && x.id === id ? { ...fn(x), id: x.id, type: x.type } : x));
  const { preset: _p, ...rest } = l;
  return { ...rest, left: map(l.left), right: map(l.right), home: map(l.home) };
}

/** Where something added or moved to a region lands: under your card and
 *  the navigation on the left, at the top elsewhere. */
export function entryIndex(l: ShellLayout, region: ShellRegion): number {
  if (region !== "left") return 0;
  let i = 0;
  l.left.forEach((x, j) => {
    if (x === "card" || x === "nav") i = j + 1;
  });
  return i;
}

export function blockCount(l: ShellLayout): number {
  return [...l.left, ...l.right, ...l.home].filter((x) => !isCore(x)).length;
}
export const SHELL_MAX_BLOCKS = MAX_BLOCKS;

// ── Presets ─────────────────────────────────────────────────────────────────
type PresetBody = Pick<ShellLayout, "left" | "right" | "home">;
export type ShellPreset = {
  id: string;
  name: string;
  blurb: string;
  /** Offered in first-run setup (no blocks to fill in). */
  setup?: boolean;
  build: () => PresetBody;
};

export const SHELL_PRESETS: ShellPreset[] = [
  {
    id: "weered",
    name: "Weered",
    blurb: "The standard. Places on the left, people in the panel.",
    setup: true,
    build: () => ({ left: [...STOCK.left], right: [...STOCK.right], home: [...STOCK.home] }),
  },
  {
    id: "social",
    name: "Social",
    blurb: "Friends and crew up in your sidebar, next to your places.",
    setup: true,
    build: () => ({
      left: ["card", "nav", "friends", "crew", "favs", "presence", "recent"],
      right: ["rooms", "whoshere", "discover"],
      home: ["build", "pulse", "dms", "activity", "live", "featured", "news", "upgrade", "visited"],
    }),
  },
  {
    id: "focus",
    name: "Focus",
    blurb: "Less on screen. Your places and your people.",
    setup: true,
    build: () => ({
      left: ["card", "nav", "favs", "friends"],
      right: ["rooms"],
      home: ["pulse", "featured", "upgrade", "news"],
    }),
  },
  {
    id: "everything",
    name: "Everything",
    blurb: "Every section on. Both sides full.",
    setup: true,
    build: () => ({
      left: ["card", "nav", "presence", "friends", "favs", "recent"],
      right: ["whoshere", "rooms", "crew", "discover"],
      home: [
        "build",
        "pulse",
        "ticker",
        "hero",
        "live",
        "featured",
        "news",
        "upgrade",
        "popular",
        "dms",
        "activity",
        "visited",
      ],
    }),
  },
  {
    id: "minimal",
    name: "Minimal",
    blurb: "Your card, your places. Nothing else.",
    setup: true,
    build: () => ({
      left: ["card", "nav", "favs"],
      right: ["friends"],
      home: ["featured", "upgrade"],
    }),
  },
  {
    id: "streamer",
    name: "Streamer",
    blurb: "A live channel in the panel, a soundtrack in the sidebar.",
    build: () => ({
      left: ["card", "nav", "friends", "favs", newShellBlock("music", { title: "Soundtrack" })],
      right: [newShellBlock("stream"), "rooms", "crew"],
      home: [...STOCK.home],
    }),
  },
  {
    id: "organizer",
    name: "Organizer",
    blurb: "The countdown, your links and the calendar in view.",
    build: () => ({
      left: ["card", "nav", "crew", "friends", "favs"],
      right: [newShellBlock("countdown"), newShellBlock("events"), "rooms", newShellBlock("links")],
      home: [
        newShellBlock("welcome", { title: "Game night", body: "Rooms open at eight." }),
        "pulse",
        "featured",
        "upgrade",
        "news",
        "activity",
      ],
    }),
  },
  {
    id: "lounge",
    name: "Lounge",
    blurb: "Something on the big screen, friends beside it.",
    build: () => ({
      left: ["card", "nav", "friends", "presence", "favs"],
      right: ["rooms", "crew"],
      home: [newShellBlock("video"), "pulse", "live", "featured", "upgrade"],
    }),
  },
];
const PRESET_IDS = new Set(SHELL_PRESETS.map((p) => p.id));

/** A preset as a whole layout: anything it doesn't list is switched off. */
export function presetLayout(id: string): ShellLayout | null {
  const p = SHELL_PRESETS.find((x) => x.id === id);
  if (!p) return null;
  return sanitizeShell({ ...p.build(), hidden: CORE_IDS, preset: id });
}
