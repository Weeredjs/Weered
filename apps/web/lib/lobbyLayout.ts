// A lobby's own arrangement, set in Design mode (2026-10-29) and stored as
// Lobby.layout. Null means the stock layout: a lobby nobody designed renders
// exactly as it did before Design mode existed.
//
// Everything read from the server goes through sanitizeLayout(), so a bad or
// old blob can never break the page; unknown fields are dropped, unknown tabs
// and blocks are skipped.

export type TabId =
  | "home"
  | "rooms"
  | "modules"
  | "feed"
  | "events"
  | "lfg"
  | "reddit"
  | "brackets"
  | "requests";

export const TAB_DEFAULT_LABEL: Record<TabId, string> = {
  home: "Home",
  rooms: "Lobby",
  modules: "Modules",
  feed: "Feed",
  events: "Events",
  lfg: "LFG",
  reddit: "Reddit",
  brackets: "Brackets",
  requests: "Requests",
};

export const TAB_BLURB: Record<TabId, string> = {
  home: "Your canvas. Blocks you place in Design mode.",
  rooms: "Voice and video rooms, with the lobby chat.",
  modules: "The game integration: live stats, data, tools.",
  feed: "Posts, news and announcements.",
  events: "The calendar: sessions, tournaments, nights.",
  lfg: "Looking for group.",
  reddit: "The game's subreddit, inline.",
  brackets: "Live start.gg brackets.",
  requests: "What your members want next.",
};

export type HeroMode = "full" | "compact" | "hidden";
export type BlockSize = "s" | "m" | "l" | "full";

export type BlockType =
  | "welcome"
  | "rooms"
  | "events"
  | "feed"
  | "game"
  | "stream"
  | "video"
  | "music"
  | "links"
  | "image"
  | "countdown"
  | "stats"
  | "requests"
  | "rules"
  | "web"
  | "frontdesk";

export type Block = {
  id: string;
  type: BlockType;
  size: BlockSize;
  props: Record<string, any>;
};

export type EffectId =
  | "none"
  | "stars"
  | "snow"
  | "embers"
  | "rain"
  | "petals"
  | "bubbles"
  | "fireflies"
  | "matrix"
  | "blizzard"
  | "symbol";
export type FontId = "default" | "display" | "serif" | "mono" | "rounded" | "stencil";
export type EntranceId = "none" | "fade" | "rise" | "glitch";

export type LobbyTheme = {
  preset?: string;
  accent?: string;
  effect?: EffectId;
  intensity?: number; // 0.2 .. 1.5
  font?: FontId;
  entrance?: EntranceId;
  sparkle?: boolean;
  /** What floats by when the effect is "symbol": an emoji or a few characters. */
  symbol?: string;
  /** The effect and sparkle show even for visitors who turned animations
   *  off (James 2026-10-30: "users can't opt out"). Their system's
   *  reduce-motion setting still wins; see lib/motion.ts. */
  fxForced?: boolean;
};

export type TabEntry = { id: TabId; label?: string; hidden?: boolean };

// ── The front door ──────────────────────────────────────────────────────────
// What a visitor gets through before joining (James 2026-10-30: "the entry
// overlays for lobbies, rules, other questions, gates"): a welcome, the
// rules to accept, a few questions, and gates (18+, account age). Owners set
// it in Admin → Front door; components/lobby/LobbyDoor.tsx draws it. Joining
// is checked by the API (apps/api/src/lib/lobbyDoor.ts), which keeps the
// answers with the membership or the join request.
export type DoorQuestion = {
  id: string;
  q: string;
  /** "text": a short answer; "choice": pick one of `options`. */
  kind: "text" | "choice";
  options: string[];
  required: boolean;
};

export type LobbyDoor = {
  on: boolean;
  /** Empty: "Welcome to <lobby name>". */
  title: string;
  body: string;
  /** https image across the top; empty: the lobby's banner. */
  image: string;
  /** The join button's words; empty: "Come in". */
  button: string;
  rules: string[];
  questions: DoorQuestion[];
  /** Visitors confirm they're 18 or older. */
  age18: boolean;
  /** Accounts younger than this many days can't join (0 = any). */
  minAccountDays: number;
  /** Visitors can't look around until they're through. */
  lock: boolean;
};

export const DOOR_MAX = {
  title: 80,
  body: 600,
  button: 24,
  rules: 12,
  rule: 200,
  questions: 5,
  q: 140,
  options: 8,
  option: 40,
} as const;

export function emptyDoor(): LobbyDoor {
  return {
    on: false,
    title: "",
    body: "",
    image: "",
    button: "",
    rules: [],
    questions: [],
    age18: false,
    minAccountDays: 0,
    lock: false,
  };
}

export type LobbyLayout = {
  v: 1;
  tabs: TabEntry[];
  landing: TabId;
  hero: HeroMode;
  theme: LobbyTheme;
  blocks: Block[];
  roomOrder: string[];
  door?: LobbyDoor;
};

const TAB_IDS = Object.keys(TAB_DEFAULT_LABEL) as TabId[];
const BLOCK_TYPES: BlockType[] = [
  "welcome",
  "rooms",
  "events",
  "feed",
  "game",
  "stream",
  "video",
  "music",
  "links",
  "image",
  "countdown",
  "stats",
  "requests",
  "rules",
  "web",
  "frontdesk",
];
const EFFECTS: EffectId[] = [
  "none",
  "stars",
  "snow",
  "embers",
  "rain",
  "petals",
  "bubbles",
  "fireflies",
  "matrix",
  "blizzard",
  "symbol",
];
const FONTS: FontId[] = ["default", "display", "serif", "mono", "rounded", "stencil"];
const ENTRANCES: EntranceId[] = ["none", "fade", "rise", "glitch"];
const SIZES: BlockSize[] = ["s", "m", "l", "full"];

/** The stock tab order, the one the page used before Design mode. */
export const STOCK_TABS: TabId[] = [
  "home",
  "rooms",
  "lfg",
  "reddit",
  "modules",
  "brackets",
  "feed",
  "events",
  "requests",
];

export function stockLayout(): LobbyLayout {
  return {
    v: 1,
    tabs: STOCK_TABS.map((id) => ({ id, hidden: id === "home" || id === "requests" })),
    landing: "rooms",
    hero: "full",
    theme: {},
    blocks: [],
    roomOrder: [],
  };
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);
const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
const safeUrl = (v: unknown): string | undefined => {
  const s = str(v, 600);
  if (!s) return undefined;
  try {
    const u = new URL(s);
    return u.protocol === "https:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
};

/** One block's settings, cleaned. Also used by the viewer's own layout
 *  (lib/shellLayout.ts), which offers the same blocks. */
export function sanitizeProps(type: BlockType, p: any): Record<string, any> {
  p = p && typeof p === "object" ? p : {};
  switch (type) {
    case "welcome":
      return {
        title: str(p.title, 120) ?? "",
        body: str(p.body, 1200) ?? "",
        cta: str(p.cta, 40) ?? "",
        ctaTab: TAB_IDS.includes(p.ctaTab) ? p.ctaTab : "rooms",
        align: p.align === "center" ? "center" : "left",
      };
    case "rules":
      return { title: str(p.title, 80) ?? "House rules", body: str(p.body, 2000) ?? "" };
    case "frontdesk":
      return {
        title: str(p.title, 80) ?? "Front desk",
        note: str(p.note, 300) ?? "",
        // The room visitors wait in; its id, as the API makes them.
        roomId: (str(p.roomId, 64) ?? "").replace(/[^A-Za-z0-9_-]/g, ""),
      };
    case "web":
      return {
        url: safeUrl(p.url) ?? "",
        title: str(p.title, 80) ?? "",
        height: p.height === "s" || p.height === "l" ? p.height : "m",
      };
    case "stream":
      return { channel: (str(p.channel, 40) ?? "").replace(/[^a-zA-Z0-9_]/g, "") };
    case "video":
    case "music":
      return { url: safeUrl(p.url) ?? "", title: str(p.title, 80) ?? "" };
    case "image":
      return {
        url: safeUrl(p.url) ?? "",
        caption: str(p.caption, 160) ?? "",
        link: safeUrl(p.link) ?? "",
      };
    case "links":
      return {
        title: str(p.title, 80) ?? "Links",
        items: (Array.isArray(p.items) ? p.items : [])
          .slice(0, 12)
          .map((it: any) => ({ label: str(it?.label, 60) ?? "", url: safeUrl(it?.url) ?? "" }))
          .filter((it: any) => it.label || it.url),
      };
    case "countdown":
      return {
        label: str(p.label, 80) ?? "Next big night",
        at: typeof p.at === "string" && !Number.isNaN(Date.parse(p.at)) ? p.at : "",
      };
    case "rooms":
    case "events":
    case "feed":
    case "requests":
      return {
        title: str(p.title, 80) ?? "",
        limit: Math.max(1, Math.min(12, Number(p.limit) || 6)),
      };
    default:
      return { title: str(p.title, 80) ?? "" };
  }
}

/** The floating symbol: an emoji or a few characters, no control codes. */
export function cleanSymbol(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!t) return undefined;
  // Up to three characters as people see them (an emoji family is one).
  const Seg = (Intl as any).Segmenter;
  const parts: string[] = Seg
    ? Array.from(new Seg(undefined, { granularity: "grapheme" }).segment(t), (x: any) => x.segment)
    : Array.from(t);
  return parts.slice(0, 3).join("").slice(0, 24) || undefined;
}

/** The door, cleaned: trimmed, capped, https images only, a choice question
 *  needs two options. Undefined when there is nothing to keep. */
export function sanitizeDoor(raw: unknown): LobbyDoor | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const d = raw as any;
  const t = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const questions: DoorQuestion[] = (Array.isArray(d.questions) ? d.questions : [])
    .slice(0, DOOR_MAX.questions)
    .map((q: any) => ({
      id: t(q?.id, 40) || `q${Math.random().toString(36).slice(2, 8)}`,
      q: t(q?.q, DOOR_MAX.q),
      kind: q?.kind === "choice" ? ("choice" as const) : ("text" as const),
      options: (Array.isArray(q?.options) ? q.options : [])
        .map((o: unknown) => t(o, DOOR_MAX.option))
        .filter(Boolean)
        .slice(0, DOOR_MAX.options),
      required: q?.required === true,
    }))
    .filter((q: DoorQuestion) => q.q && (q.kind === "text" || q.options.length >= 2));
  const days = Math.floor(Number(d.minAccountDays));
  return {
    on: d.on === true,
    title: t(d.title, DOOR_MAX.title),
    body: t(d.body, DOOR_MAX.body),
    image: safeUrl(t(d.image, 600)) || "",
    button: t(d.button, DOOR_MAX.button),
    rules: (Array.isArray(d.rules) ? d.rules : [])
      .map((r: unknown) => t(r, DOOR_MAX.rule))
      .filter(Boolean)
      .slice(0, DOOR_MAX.rules),
    questions,
    age18: d.age18 === true,
    minAccountDays: Number.isFinite(days) ? Math.max(0, Math.min(365, days)) : 0,
    lock: d.lock === true,
  };
}

export function sanitizeLayout(raw: unknown): LobbyLayout | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as any;
  const base = stockLayout();

  const seen = new Set<TabId>();
  const tabs: TabEntry[] = [];
  for (const t of Array.isArray(r.tabs) ? r.tabs : []) {
    if (!t || !TAB_IDS.includes(t.id) || seen.has(t.id)) continue;
    seen.add(t.id);
    tabs.push({ id: t.id, label: str(t.label, 24) || undefined, hidden: !!t.hidden });
  }
  // A tab added to the platform later appears, hidden, at the end.
  for (const id of STOCK_TABS) if (!seen.has(id)) tabs.push({ id, hidden: true });

  const blocks: Block[] = [];
  for (const b of Array.isArray(r.blocks) ? r.blocks.slice(0, 40) : []) {
    if (!b || !BLOCK_TYPES.includes(b.type)) continue;
    blocks.push({
      id: str(b.id, 40) || `b${Math.random().toString(36).slice(2, 9)}`,
      type: b.type,
      size: SIZES.includes(b.size) ? b.size : "m",
      props: sanitizeProps(b.type, b.props),
    });
  }

  const th = r.theme && typeof r.theme === "object" ? r.theme : {};
  const theme: LobbyTheme = {
    preset: str(th.preset, 40),
    accent: isHex(th.accent) ? th.accent : undefined,
    effect: EFFECTS.includes(th.effect) ? th.effect : undefined,
    intensity:
      typeof th.intensity === "number" ? Math.max(0.2, Math.min(1.5, th.intensity)) : undefined,
    font: FONTS.includes(th.font) ? th.font : undefined,
    entrance: ENTRANCES.includes(th.entrance) ? th.entrance : undefined,
    sparkle: !!th.sparkle,
    symbol: cleanSymbol(th.symbol),
    fxForced: th.fxForced === true ? true : undefined,
  };

  return {
    v: 1,
    tabs,
    landing: TAB_IDS.includes(r.landing) ? r.landing : base.landing,
    hero: r.hero === "compact" || r.hero === "hidden" ? r.hero : "full",
    theme,
    blocks,
    roomOrder: (Array.isArray(r.roomOrder) ? r.roomOrder : []).map(String).slice(0, 200),
    door: sanitizeDoor(r.door),
  };
}

export function newBlock(type: BlockType): Block {
  const id = `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const size: BlockSize =
    type === "game" || type === "stream" || type === "welcome"
      ? "full"
      : type === "stats" || type === "countdown"
        ? "s"
        : "m";
  return { id, type, size, props: sanitizeProps(type, BLOCK_DEFAULTS[type] || {}) };
}

const BLOCK_DEFAULTS: Partial<Record<BlockType, any>> = {
  welcome: {
    title: "Welcome in",
    body: "Pull up a chair. Rooms are open, the calendar is below.",
    cta: "Jump in",
    ctaTab: "rooms",
  },
  rules: { title: "House rules", body: "Be decent.\nNo spam.\nHave fun." },
  links: { title: "Links", items: [] },
  countdown: { label: "Next big night" },
  frontdesk: { title: "Front desk", note: "Ring and someone will be right with you." },
};

export type BlockMeta = {
  type: BlockType;
  name: string;
  blurb: string;
  icon: string;
  group: "Essentials" | "Media" | "Community" | "Game";
};

export const BLOCK_CATALOG: BlockMeta[] = [
  {
    type: "welcome",
    name: "Welcome banner",
    blurb: "A headline, a line of copy, a button.",
    icon: "✦",
    group: "Essentials",
  },
  {
    type: "rooms",
    name: "Rooms",
    blurb: "Live voice and video rooms with who's in them.",
    icon: "🎙",
    group: "Essentials",
  },
  {
    type: "events",
    name: "Up next",
    blurb: "The next events on your calendar.",
    icon: "📅",
    group: "Essentials",
  },
  {
    type: "frontdesk",
    name: "Front desk",
    blurb: "Visitors ring; your staff get a ping.",
    icon: "🛎",
    group: "Essentials",
  },
  {
    type: "stats",
    name: "Pulse",
    blurb: "Members, online now, rooms live.",
    icon: "📈",
    group: "Essentials",
  },
  {
    type: "game",
    name: "Game integration",
    blurb: "Your game's live module, right on the page.",
    icon: "🎮",
    group: "Game",
  },
  {
    type: "stream",
    name: "Twitch stream",
    blurb: "A live channel, embedded.",
    icon: "📺",
    group: "Media",
  },
  { type: "video", name: "YouTube", blurb: "A video or a playlist.", icon: "▶", group: "Media" },
  {
    type: "music",
    name: "Lobby soundtrack",
    blurb: "A Spotify or YouTube playlist on the wall.",
    icon: "🎵",
    group: "Media",
  },
  { type: "image", name: "Image", blurb: "Art, a poster, a map.", icon: "🖼", group: "Media" },
  {
    type: "feed",
    name: "Latest posts",
    blurb: "The newest from your feed.",
    icon: "📰",
    group: "Community",
  },
  {
    type: "requests",
    name: "Request board",
    blurb: "Members vote on what's next.",
    icon: "🗳",
    group: "Community",
  },
  {
    type: "countdown",
    name: "Countdown",
    blurb: "Ticks down to the big night.",
    icon: "⏳",
    group: "Community",
  },
  {
    type: "links",
    name: "Links",
    blurb: "Your site, socials, sign-ups.",
    icon: "🔗",
    group: "Community",
  },
  {
    type: "rules",
    name: "House rules",
    blurb: "The ground rules, pinned.",
    icon: "📜",
    group: "Community",
  },
  {
    type: "web",
    name: "Webpage",
    blurb: "Any site that allows it, live. The rest as a link card.",
    icon: "🌐",
    group: "Media",
  },
];

export const SIZE_SPAN: Record<BlockSize, number> = { s: 4, m: 6, l: 8, full: 12 };
export const SIZE_LABEL: Record<BlockSize, string> = {
  s: "Third",
  m: "Half",
  l: "Two-thirds",
  full: "Full",
};

/** A starter Home canvas for a lobby that switches Home on for the first time. */
export function starterBlocks(hasGame: boolean): Block[] {
  const b = [newBlock("welcome"), newBlock("rooms"), newBlock("events"), newBlock("stats")];
  if (hasGame) b.splice(1, 0, newBlock("game"));
  return b;
}
