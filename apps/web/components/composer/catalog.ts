// What the create-lobby composer offers ("What are you doing here?"). Entries
// are use cases: a work space, a community, or a game. `module` is the
// ModuleType sent when it differs from the entry id (several work and
// community entries are plain NONE lobbies with their own rooms). Game types are the ones whose Modules
// panel works for a brand-new lobby with no moduleConfig (POST /lobbies only
// lets staff set moduleConfig). Each blurb describes what that panel actually
// shows today; keep them honest when a panel changes.

export type GameEntry = {
  /** ModuleType sent to POST /lobbies. */
  id: string;
  name: string;
  blurb: string;
  /** CSS background for the card when there is no image. */
  art: string;
  /** Real art under /public, used over `art` where we have it. */
  image?: string;
  /** The official lobby whose hero banner the card wears when there is no
   *  `image` (fetched live, so a new banner shows here too). */
  lobby?: string;
  /** One or two characters drawn on the card when there is no image. */
  glyph: string;
  tint: string;
  tags: string[];
  /** Theme preset applied on pick, until the owner touches the theme. */
  preset: string;
  group: "work" | "community" | "games";
  /** ModuleType for POST /lobbies when it isn't the id. */
  module?: string;
  /** Starter rooms (ROOM_PRESETS ids) applied on pick. */
  rooms?: string[];
  /** "meeting" opens the custom-build meeting request instead of picking. */
  action?: "meeting";
};

export const GROUPS: { id: GameEntry["group"] | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "work", label: "Work" },
  { id: "community", label: "Community" },
  { id: "games", label: "Games" },
];

/** The ModuleType an entry creates. */
export function moduleOf(g: GameEntry): string {
  return g.module || g.id;
}

export const GAMES: GameEntry[] = [
  {
    id: "NONE",
    name: "Just a community",
    blurb: "No game attached. Rooms, chat, events and a Home page of your own.",
    art: "radial-gradient(80% 90% at 20% 10%, #7c3aed66 0%, transparent 60%), radial-gradient(70% 80% at 100% 100%, #0ea5e955 0%, transparent 60%), #0b0b14",
    glyph: "✦",
    tint: "#a78bfa",
    tags: ["community", "chat", "friends", "club", "none"],
    preset: "midnight",
    group: "community",
  },
  {
    id: "TEAM",
    module: "COWORK",
    image: "/brand/lobbies/hq-banner.webp",
    name: "Team HQ",
    blurb: "Who's in today, sprint timer, the day board. Meeting and focus rooms.",
    art: "radial-gradient(90% 90% at 15% 15%, #7fa89b55 0%, transparent 60%), radial-gradient(70% 80% at 100% 100%, #38bdf833 0%, transparent 60%), #0a1012",
    glyph: "HQ",
    tint: "#9fd3c3",
    tags: ["team", "work", "office", "remote", "company", "staff", "business", "cowork"],
    preset: "frostbite",
    group: "work",
    rooms: ["general", "meet", "focus"],
  },
  {
    id: "CLIENTS",
    module: "NONE",
    name: "Client meetings",
    blurb: "A front desk and private video rooms. Put it on your own domain.",
    art: "radial-gradient(80% 90% at 80% 10%, #f5d08a44 0%, transparent 60%), linear-gradient(160deg, #15130f, #0a0a0c)",
    glyph: "◈",
    tint: "#f5d08a",
    tags: [
      "clients",
      "meetings",
      "video",
      "consulting",
      "agency",
      "business",
      "office",
      "appointments",
    ],
    preset: "gold-rush",
    group: "work",
    rooms: ["desk", "meet"],
  },
  {
    id: "CLUB",
    module: "NONE",
    name: "Club or association",
    blurb: "Members, an events calendar and rooms for meets. Leagues, clubs, chapters.",
    art: "radial-gradient(80% 90% at 20% 90%, #60a5fa44 0%, transparent 60%), radial-gradient(60% 70% at 90% 10%, #a78bfa44 0%, transparent 60%), #0b0c16",
    glyph: "♣",
    tint: "#93c5fd",
    tags: ["club", "association", "league", "chapter", "members", "bridge", "nonprofit", "church"],
    preset: "high-seas",
    group: "community",
    rooms: ["general", "meet", "hangout"],
  },
  {
    id: "CUSTOM_BUILD",
    module: "NONE",
    name: "Something custom",
    blurb: "Your data, your workflow, built into your space. Book a meeting.",
    art: "repeating-linear-gradient(90deg, #ffffff08 0 1px, transparent 1px 22px), repeating-linear-gradient(0deg, #ffffff08 0 1px, transparent 1px 22px), radial-gradient(70% 80% at 50% 50%, #7c3aed55 0%, transparent 65%), #08080f",
    glyph: "{ }",
    tint: "#c4b5fd",
    tags: ["custom", "business", "enterprise", "build", "integration", "portal", "meeting"],
    preset: "midnight",
    group: "work",
    action: "meeting",
  },
  {
    id: "BUNGIE",
    name: "Destiny 2",
    blurb: "Fireteam finder, weekly reset, challenges, Guardian lookup, streams.",
    art: "linear-gradient(135deg, #1b2a3a, #0a0f16)",
    image: "/brand/lobbies/destiny2-banner.jpg",
    glyph: "D2",
    tint: "#cfd8e3",
    tags: ["destiny", "bungie", "fps", "raid", "guardian"],
    preset: "deep-space",
    group: "games",
  },
  {
    id: "MARATHON",
    lobby: "marathon",
    name: "Marathon",
    blurb: "Maps, runner shells, rank ladder, squad finder and live streams.",
    art: "repeating-linear-gradient(-45deg, #c6ff0014 0 10px, transparent 10px 20px), radial-gradient(70% 70% at 80% 20%, #c6ff0055 0%, transparent 60%), #0b0d06",
    glyph: "M",
    tint: "#c6ff00",
    tags: ["marathon", "bungie", "extraction", "shooter"],
    preset: "toxic",
    group: "games",
  },
  {
    id: "RIOT",
    lobby: "league-of-legends",
    name: "League of Legends",
    blurb: "Summoner lookup, free champion rotation, ranked ladder, find team.",
    art: "radial-gradient(80% 80% at 50% 0%, #c89b3c66 0%, transparent 60%), linear-gradient(#0a1428, #010a13)",
    glyph: "LoL",
    tint: "#c89b3c",
    tags: ["league", "lol", "riot", "moba"],
    preset: "gold-rush",
    group: "games",
  },
  {
    id: "FORTNITE",
    lobby: "fortnite",
    name: "Fortnite",
    blurb: "Player stats, ranked, today's item shop, new cosmetics, news.",
    art: "radial-gradient(70% 70% at 20% 20%, #00c3ff88 0%, transparent 60%), radial-gradient(70% 70% at 90% 90%, #ffe60066 0%, transparent 60%), linear-gradient(135deg, #3d1a8c, #1b0b45)",
    glyph: "FN",
    tint: "#ffe600",
    tags: ["fortnite", "epic", "battle royale", "br", "item shop"],
    preset: "neon-arcade",
    group: "games",
  },
  {
    id: "CS2",
    lobby: "counter-strike-2",
    name: "Counter-Strike 2",
    blurb: "Squad finder, Premier rank bands, the map pool, live streams.",
    art: "radial-gradient(70% 70% at 80% 20%, #de9b3566 0%, transparent 60%), linear-gradient(#1b2838, #0b1118)",
    glyph: "CS",
    tint: "#de9b35",
    tags: ["cs2", "csgo", "counter-strike", "valve", "fps"],
    preset: "ironclad",
    group: "games",
  },
  {
    id: "DOTA2",
    lobby: "dota-2",
    name: "Dota 2",
    blurb: "Stack finder, player lookup, live pro matches, hero browser.",
    art: "radial-gradient(80% 70% at 50% 110%, #a32a1b99 0%, transparent 60%), linear-gradient(#180606, #070202)",
    glyph: "D",
    tint: "#e5452f",
    tags: ["dota", "valve", "moba"],
    preset: "inferno",
    group: "games",
  },
  {
    id: "PUBG",
    lobby: "pubg",
    name: "PUBG: Battlegrounds",
    blurb: "Player stats, recent matches, leaderboards, weapons, find team.",
    art: "repeating-linear-gradient(45deg, #f2a90012 0 14px, transparent 14px 28px), radial-gradient(70% 70% at 30% 20%, #f2a90055 0%, transparent 60%), #15130c",
    glyph: "PG",
    tint: "#f2a900",
    tags: ["pubg", "battlegrounds", "battle royale", "br"],
    preset: "ironclad",
    group: "games",
  },
  {
    id: "POE",
    lobby: "poe",
    name: "Path of Exile",
    blurb: "League economy, ladder, skill tree, div cards, item bases.",
    art: "radial-gradient(70% 70% at 50% 100%, #af602566 0%, transparent 60%), linear-gradient(#120c08, #050302)",
    glyph: "PoE",
    tint: "#d8a25e",
    tags: ["poe", "path of exile", "arpg", "ggg"],
    preset: "inferno",
    group: "games",
  },
  {
    id: "POE2",
    lobby: "poe2",
    name: "Path of Exile 2",
    blurb: "PoE2 league economy, ladder and item bases, find team.",
    art: "radial-gradient(70% 70% at 70% 10%, #8a1c1c88 0%, transparent 60%), linear-gradient(#140707, #050202)",
    glyph: "II",
    tint: "#c9a46b",
    tags: ["poe2", "path of exile 2", "arpg", "ggg"],
    preset: "inferno",
    group: "games",
  },
  {
    id: "DIVISION2",
    lobby: "division2",
    name: "The Division 2",
    blurb: "Ops board for raids and incursions, squad finder, server status.",
    art: "radial-gradient(70% 70% at 80% 20%, #ff6d1066 0%, transparent 60%), linear-gradient(#1a1a1a, #0a0a0a)",
    glyph: "◐",
    tint: "#ff6d10",
    tags: ["division", "tom clancy", "ubisoft", "looter shooter"],
    preset: "ironclad",
    group: "games",
  },
  {
    id: "HELLDIVERS2",
    lobby: "helldivers2",
    name: "Helldivers 2",
    blurb: "Live galactic war map, Major Order, stratagems, squad finder.",
    art: "repeating-linear-gradient(-45deg, #ffe81f10 0 12px, transparent 12px 24px), radial-gradient(70% 70% at 50% 0%, #ffe81f44 0%, transparent 60%), #0d0d0a",
    glyph: "HD",
    tint: "#ffe81f",
    tags: ["helldivers", "democracy", "arrowhead", "co-op"],
    preset: "ironclad",
    group: "games",
  },
  {
    id: "EVE",
    lobby: "eve",
    name: "EVE Online",
    blurb: "Killboard, sovereignty, market signals, capsuleer lookup.",
    art: "radial-gradient(50% 50% at 70% 30%, #00b4ff55 0%, transparent 70%), radial-gradient(40% 40% at 20% 80%, #6d28d944 0%, transparent 70%), #03060c",
    glyph: "E",
    tint: "#00b4ff",
    tags: ["eve", "ccp", "space", "mmo"],
    preset: "deep-space",
    group: "games",
  },
  {
    id: "BAR",
    lobby: "beyond-all-reason",
    name: "Beyond All Reason",
    blurb: "Live battles, match history, the map browser, a room launcher.",
    art: "radial-gradient(70% 70% at 30% 30%, #3fa9f555 0%, transparent 60%), radial-gradient(60% 60% at 90% 90%, #f9731644 0%, transparent 60%), #08111a",
    glyph: "BAR",
    tint: "#3fa9f5",
    tags: ["bar", "beyond all reason", "rts", "strategy"],
    preset: "deep-space",
    group: "games",
  },
  {
    id: "CHESS",
    lobby: "chess",
    name: "Chess",
    blurb: "Lobby challenges, tournaments, your chess profile, streams.",
    art: "repeating-conic-gradient(#769656 0 25%, #eeeed2 0 50%) 0 0 / 28px 28px",
    glyph: "♞",
    tint: "#9fc46b",
    tags: ["chess", "board game", "lichess", "chess.com"],
    preset: "felt-table",
    group: "community",
  },
  {
    id: "DND",
    name: "Dungeons & Dragons",
    blurb: "Compendium, bestiary, spells, dice tower, tavern board.",
    art: "linear-gradient(#2a0a0a, #0d0303)",
    image: "/brand/lobbies/dnd-banner.png",
    glyph: "d20",
    tint: "#e11d48",
    tags: ["dnd", "d&d", "ttrpg", "tabletop", "rpg"],
    preset: "midnight",
    group: "community",
  },
  {
    id: "MTG",
    lobby: "mtg",
    name: "Magic: The Gathering",
    blurb: "Card search, ban lists, deckbuilder and EDHREC shortcuts.",
    art: "conic-gradient(from 90deg at 50% 50%, #f9faf455, #0e68ab88, #150b00, #d3202a88, #00733e88, #f9faf455)",
    glyph: "✺",
    tint: "#d3a54a",
    tags: ["mtg", "magic", "commander", "edh", "tcg"],
    preset: "midnight",
    group: "community",
  },
  {
    id: "POKER",
    name: "Poker night",
    blurb: "A live hold'em table, right in the lobby.",
    art: "radial-gradient(80% 70% at 50% 40%, #1f6b43, #08261a)",
    image: "/brand/lobbies/poker-banner.png",
    glyph: "♠",
    tint: "#c9a227",
    tags: ["poker", "cards", "holdem", "casino"],
    preset: "felt-table",
    group: "community",
  },
  {
    id: "TRADING",
    name: "FakeOut",
    blurb: "Paper-trade crypto with fake money: live charts, a leaderboard.",
    art: "linear-gradient(#04130a, #010603)",
    image: "/brand/lobbies/fakeout-banner.png",
    glyph: "↗",
    tint: "#22c55e",
    tags: ["trading", "crypto", "stocks", "paper", "fakeout"],
    preset: "terminal",
    group: "community",
  },
  {
    id: "STUDY",
    name: "Study hall",
    blurb: "Focus timer, practice tests, study rooms, ambient sound.",
    art: "linear-gradient(#141018, #08060a)",
    image: "/brand/lobbies/study-banner-1.png",
    glyph: "✎",
    tint: "#f472b6",
    tags: ["study", "school", "focus", "pomodoro", "homework"],
    preset: "sakura",
    group: "work",
  },
  {
    id: "NEWS",
    lobby: "news",
    name: "News desk",
    blurb: "Live headlines: world, Canada, tech, business, science, sports.",
    art: "repeating-linear-gradient(0deg, #ffffff08 0 1px, transparent 1px 9px), radial-gradient(70% 70% at 80% 10%, #7dd3fc44 0%, transparent 60%), #071019",
    glyph: "¶",
    tint: "#7dd3fc",
    tags: ["news", "headlines", "current events"],
    preset: "frostbite",
    group: "community",
  },
  {
    id: "MLB",
    lobby: "mlb",
    name: "Baseball",
    blurb: "Scoreboard, matchups, standings, highlights, player search.",
    art: "radial-gradient(70% 70% at 80% 20%, #d5003255 0%, transparent 60%), linear-gradient(#002d72, #00163a)",
    glyph: "⚾",
    tint: "#ef4444",
    tags: ["mlb", "baseball", "sports"],
    preset: "high-seas",
    group: "community",
  },
  {
    id: "PGA",
    name: "Golf",
    blurb: "Live tour leaderboard, the field, props and picks, news.",
    art: "linear-gradient(#0b2a17, #04140a)",
    image: "/brand/lobbies/pga-banner.png",
    glyph: "⛳",
    tint: "#4ade80",
    tags: ["golf", "pga", "sports"],
    preset: "felt-table",
    group: "community",
  },
];

export const GAME_BY_ID: Record<string, GameEntry> = Object.fromEntries(
  GAMES.map((g) => [g.id, g]),
);

// ── What's inside ─────────────────────────────────────────────────────────
export type FeatureId =
  | "voice"
  | "video"
  | "screen"
  | "youtube"
  | "twitch"
  | "events"
  | "requests"
  | "home";

export type FeatureMeta = { id: FeatureId; name: string; blurb: string; icon: string };

export const FEATURES: FeatureMeta[] = [
  { id: "voice", name: "Voice rooms", blurb: "Drop in, talk, leave.", icon: "🎙" },
  { id: "video", name: "Video", blurb: "Cameras on in any room.", icon: "📹" },
  { id: "screen", name: "Screen share", blurb: "Show the run, the build, the doc.", icon: "🖥" },
  { id: "youtube", name: "YouTube watch parties", blurb: "One video, synced.", icon: "▶" },
  { id: "twitch", name: "Twitch", blurb: "Watch a channel together.", icon: "📺" },
  { id: "events", name: "Events calendar", blurb: "Raid nights, sessions, cups.", icon: "📅" },
  { id: "requests", name: "Request board", blurb: "Members vote on what's next.", icon: "🗳" },
  { id: "home", name: "Home canvas", blurb: "A landing page of blocks.", icon: "✦" },
];

/** Features that map straight onto Lobby.enabledModules. */
export const MODULE_FEATURES: FeatureId[] = ["voice", "video", "screen", "youtube", "twitch"];

export const DEFAULT_FEATURES: Record<FeatureId, boolean> = {
  voice: true,
  video: true,
  screen: true,
  youtube: true,
  twitch: false,
  events: true,
  requests: false,
  home: true,
};

// ── Starter rooms ─────────────────────────────────────────────────────────
export type RoomPreset = {
  id: string;
  label: string;
  /** Rooms this chip creates (Team rooms makes two). */
  names: string[];
  /** Room.defaultModule, or null for a plain chat room. */
  module: "voice" | "video" | "youtube" | "screen" | null;
  icon: string;
  hint: string;
};

export const ROOM_PRESETS: RoomPreset[] = [
  {
    id: "general",
    label: "General chat",
    names: ["General"],
    module: null,
    icon: "💬",
    hint: "Text first",
  },
  {
    id: "hangout",
    label: "Hangout",
    names: ["Hangout"],
    module: "voice",
    icon: "🎙",
    hint: "Voice",
  },
  {
    id: "watch",
    label: "Watch party",
    names: ["Watch Party"],
    module: "youtube",
    icon: "🍿",
    hint: "YouTube",
  },
  {
    id: "teams",
    label: "Team rooms ×2",
    names: ["Team 1", "Team 2"],
    module: "voice",
    icon: "⚔",
    hint: "Voice",
  },
  {
    id: "stage",
    label: "Show & tell",
    names: ["Show & Tell"],
    module: "screen",
    icon: "🖥",
    hint: "Screen share",
  },
  {
    id: "cams",
    label: "Cams on",
    names: ["Cams On"],
    module: "video",
    icon: "📹",
    hint: "Video",
  },
];

export const WORK_ROOM_PRESETS: RoomPreset[] = [
  {
    id: "meet",
    label: "Meeting room",
    names: ["Meeting Room"],
    module: "video",
    icon: "🤝",
    hint: "Video",
  },
  {
    id: "desk",
    label: "Front desk",
    names: ["Front Desk"],
    module: null,
    icon: "🛎",
    hint: "Text first",
  },
  {
    id: "focus",
    label: "Focus room",
    names: ["Focus"],
    module: "voice",
    icon: "🎧",
    hint: "Voice",
  },
];
ROOM_PRESETS.push(...WORK_ROOM_PRESETS);

export const DEFAULT_ROOMS = ["general", "hangout", "watch"];
