import { prisma } from "../../prisma";
import { B, E, N, S, VOICE, arr, bool, clip, clipBody, givenUrl, hex, int, obj, oneOf } from "../common";
import type { BuildJob } from "../job";

// Describe-it for people's own things and a lobby's voice: the crew's look,
// the stream overlay, and the lobby's AI host.

// ── Crew look ───────────────────────────────────────────────────────────────

export type CrewPlan = {
  name: string;
  tag: string;
  tagShape: "rounded" | "square" | "pill";
  accentColor: string;
  description: string;
  recruiting: boolean;
  recruitingNote: string;
};

const CREW_SYSTEM = `You set a crew's look on Weered: its name, its tag (the short badge shown beside every member's name), the tag's shape, its colour, and its description. Call the set_crew tool exactly once. Do not reply with text.

- name: 60 characters at most. Keep their current name unless they ask for a new one.
- tag: 2 to 6 letters or numbers, uppercase, fitting the name or the vibe.
- tagShape: rounded, square or pill.
- accentColor: #rrggbb for the vibe they describe.
- description: two or three sentences in their voice (800 characters at most).
- recruiting: true if they say they're looking for people; recruitingNote says who and how (400 characters at most).
- summary: one short plain sentence (20 words at most).

${VOICE}`;

export const crewJob: BuildJob<CrewPlan> = {
  id: "crew",
  scope: "user",
  system: CREW_SYSTEM,
  tool: {
    name: "set_crew",
    description: "The crew's look.",
    input_schema: {
      type: "object",
      properties: {
        name: S(),
        tag: S(),
        tagShape: E(["rounded", "square", "pill"]),
        accentColor: S("#rrggbb"),
        description: S(),
        recruiting: B,
        recruitingNote: S(),
        summary: S(),
      },
      required: ["name", "tag", "tagShape", "accentColor", "description", "summary"],
    },
  },
  maxTokens: 3000,
  context: async (c) => {
    const crew = await prisma.crew
      .findFirst({
        where: { id: String(c.body?.crewId || ""), ownerId: c.user.id },
        select: { name: true, tag: true, tagShape: true, accentColor: true, description: true },
      })
      .catch(() => null);
    return crew ? `The crew now: ${JSON.stringify(crew).slice(0, 2000)}` : "";
  },
  clean: (raw) => {
    const r = obj(raw);
    return {
      name: clip(r.name, 60) || "Crew",
      tag: clip(r.tag, 12)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6),
      tagShape: oneOf(r.tagShape, ["rounded", "square", "pill"] as const) || "rounded",
      accentColor: hex(r.accentColor) || "#7c3aed",
      description: clipBody(r.description, 800),
      recruiting: bool(r.recruiting) ?? false,
      recruitingNote: clipBody(r.recruitingNote, 400),
    };
  },
};

// ── Stream overlay ──────────────────────────────────────────────────────────

export type OverlayConfig = {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  size: "s" | "m" | "l";
  style: "glass" | "solid" | "minimal" | "neon";
  accent: string;
  show: {
    avatar: boolean;
    tier: boolean;
    place: boolean;
    count: boolean;
    join: boolean;
    status: boolean;
    /** Who else is in the room (up to 8 names). Off unless they turn it on. */
    people: boolean;
    /** The room's last few chat lines. Off unless they turn it on. */
    chat: boolean;
  };
  tagline: string;
  hideOffline: boolean;
};

export const OVERLAY_DEFAULT: OverlayConfig = {
  position: "top-left",
  size: "m",
  style: "glass",
  accent: "#7c3aed",
  show: {
    avatar: true,
    tier: true,
    place: true,
    count: true,
    join: true,
    status: true,
    people: false,
    chat: false,
  },
  tagline: "",
  hideOffline: false,
};

/** Any stored or proposed overlay config, made safe. */
export function cleanOverlay(raw: unknown): OverlayConfig {
  const r = obj(raw);
  const show = obj(r.show);
  const pick = (k: keyof OverlayConfig["show"]) => bool(show[k]) ?? OVERLAY_DEFAULT.show[k];
  return {
    position:
      oneOf(r.position, ["top-left", "top-right", "bottom-left", "bottom-right"] as const) ||
      OVERLAY_DEFAULT.position,
    size: oneOf(r.size, ["s", "m", "l"] as const) || OVERLAY_DEFAULT.size,
    style: oneOf(r.style, ["glass", "solid", "minimal", "neon"] as const) || OVERLAY_DEFAULT.style,
    accent: hex(r.accent) || OVERLAY_DEFAULT.accent,
    show: {
      avatar: pick("avatar"),
      tier: pick("tier"),
      place: pick("place"),
      count: pick("count"),
      join: pick("join"),
      status: pick("status"),
      people: pick("people"),
      chat: pick("chat"),
    },
    tagline: clip(r.tagline, 60),
    hideOffline: bool(r.hideOffline) ?? false,
  };
}

const OVERLAY_SYSTEM = `You set up someone's stream overlay on Weered: the small card OBS shows on their stream with where they are on Weered right now (the lobby and room, how many are in it, a join link). Call the set_overlay tool exactly once. Do not reply with text.

- position: top-left, top-right, bottom-left or bottom-right. size: s, m or l.
- style: glass (frosted), solid, minimal (text only, no card) or neon (glowing edge).
- accent: #rrggbb.
- show: avatar, tier (their Weered rank), place (the lobby and room), count (how many are in it), join (the join link), status (LIVE or away), people (the names of who's in the room with them: their squad), chat (the room's last few chat lines).
- tagline: a short line under their name (60 characters at most), or empty.
- hideOffline: true if they want it to vanish when they're not on Weered.
- If you're given the current setup, change what they ask for and keep the rest.
- summary: one short plain sentence (20 words at most).

${VOICE}`;

export const overlayJob: BuildJob<OverlayConfig> = {
  id: "overlay",
  scope: "user",
  system: OVERLAY_SYSTEM,
  tool: {
    name: "set_overlay",
    description: "The overlay.",
    input_schema: {
      type: "object",
      properties: {
        position: E(["top-left", "top-right", "bottom-left", "bottom-right"]),
        size: E(["s", "m", "l"]),
        style: E(["glass", "solid", "minimal", "neon"]),
        accent: S("#rrggbb"),
        show: {
          type: "object",
          properties: { avatar: B, tier: B, place: B, count: B, join: B, status: B, people: B, chat: B },
        },
        tagline: S(),
        hideOffline: B,
        summary: S(),
      },
      required: ["position", "size", "style", "accent", "show", "summary"],
    },
  },
  maxTokens: 2000,
  context: async (c) => {
    const u = await prisma.user
      .findUnique({ where: { id: c.user.id }, select: { overlayConfig: true } as any })
      .catch(() => null);
    return `The overlay now: ${JSON.stringify(cleanOverlay((u as any)?.overlayConfig))}`;
  },
  clean: (raw) => cleanOverlay(raw),
};

// ── The lobby's AI host ─────────────────────────────────────────────────────

export type HostConfig = {
  on: boolean;
  name: string;
  emoji: string;
  persona: string;
  welcome: boolean;
  welcomeLines: string[];
};

export const HOST_OFF: HostConfig = {
  on: false,
  name: "",
  emoji: "",
  persona: "",
  welcome: false,
  welcomeLines: [],
};

/** Any stored or proposed host, made safe. */
export function cleanHost(raw: unknown): HostConfig {
  const r = obj(raw);
  const name = clip(r.name, 32);
  return {
    on: (bool(r.on) ?? true) && !!name,
    name,
    emoji: Array.from(clip(r.emoji, 16)).slice(0, 2).join(""),
    persona: clipBody(r.persona, 800),
    welcome: bool(r.welcome) ?? true,
    welcomeLines: arr(r.welcomeLines)
      .map((l) => clip(l, 160))
      .filter((l) => l.includes("{name}"))
      .slice(0, 6),
  };
}

const HOST_SYSTEM = `You create a lobby's host on Weered: a character who lives in the lobby's chat, welcomes people as they arrive and answers when someone mentions it by name. Call the set_host tool exactly once. Do not reply with text.

- name: what people call it (32 characters at most), like "Sarge" or "The Barkeep". People mention it with @ and that name.
- emoji: one emoji for its face.
- persona: who it is and how it talks, in a few sentences (800 characters at most), written as instructions to an actor ("You are Sarge, a drill sergeant who…"). Keep it friendly underneath any gruffness; it never insults people for real, never swears at them, and never pretends to be a real person.
- welcome: true if it should greet people as they come in.
- welcomeLines: 3 to 6 short greetings in its voice (160 characters at most), each with {name} where the newcomer's name goes.
- If you're given the current host, change what they ask for and keep the rest.
- summary: one short plain sentence (20 words at most).

${VOICE}`;

export const hostJob: BuildJob<HostConfig> = {
  id: "host",
  scope: "lobby",
  minLevel: 4,
  perm: "edit_branding",
  system: HOST_SYSTEM,
  tool: {
    name: "set_host",
    description: "The lobby's host.",
    input_schema: {
      type: "object",
      properties: {
        name: S(),
        emoji: S(),
        persona: S(),
        welcome: B,
        welcomeLines: { type: "array", items: S("a greeting with {name}") },
        summary: S(),
      },
      required: ["name", "emoji", "persona", "welcome", "welcomeLines", "summary"],
    },
  },
  maxTokens: 3000,
  context: (c) => {
    const h = c.lobby?.hostConfig ? cleanHost(c.lobby.hostConfig) : null;
    return `The lobby: ${clip(c.lobby?.name, 100)} (${c.lobby?.moduleType || "NONE"}).${h?.name ? ` The host now: ${JSON.stringify(h)}` : ""}`;
  },
  clean: (raw) => ({ ...cleanHost(raw), on: true }),
};

// ── Scheduled posts, alerts and feeds (lobby automations) ────────────────────

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type PostSpec = {
  cadence: "once" | "daily" | "weekly";
  days: (typeof DAYS)[number][];
  time: string; // HH:MM, in tz
  tz: string;
  date: string | null; // YYYY-MM-DD, for once
  message: string;
  pingLevel: number; // 0 no ping; else mention everyone at this lobby level and up
};
export type AlertSpec = { roomId: string; roomName: string; threshold: number };
export type FeedSpec = {
  source: "youtube" | "twitch" | "rss";
  target: string; // channel id/handle URL, Twitch login, or feed URL
  message: string; // template: {title} {link} {name}
};

function cleanTz(v: unknown): string {
  const z = String(v ?? "");
  if (!/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(z)) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: z });
    return z;
  } catch {
    return "UTC";
  }
}

export function cleanPost(raw: unknown, tz: unknown): PostSpec {
  const r = obj(raw);
  const cadence = oneOf(r.cadence, ["once", "daily", "weekly"] as const) || "weekly";
  const days = arr(r.days)
    .map((d) => String(d).toLowerCase().slice(0, 3))
    .filter((d): d is (typeof DAYS)[number] => (DAYS as readonly string[]).includes(d));
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(r.time)) ? String(r.time) : "19:00";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(r.date)) ? String(r.date) : null;
  return {
    cadence,
    days: cadence === "weekly" ? (days.length ? Array.from(new Set(days)) : ["mon"]) : [],
    time,
    tz: cleanTz(r.tz || tz),
    date: cadence === "once" ? date : null,
    message: clipBody(r.message, 500) || "…",
    pingLevel: int(r.pingLevel, 0, 5) ?? 0,
  };
}

const POST_SYSTEM = `You schedule a post in a lobby's chat on Weered from what someone who runs it said. The lobby's host (or Weered, if there's no host) posts it. Call the plan_post tool exactly once. Do not reply with text.

- cadence: once, daily or weekly. days (weekly): which days, as mon tue wed thu fri sat sun. time: HH:MM, 24-hour, in their time zone. date (once): YYYY-MM-DD.
- tz: their time zone (from "Now", unless they named another).
- message: what gets posted (500 characters at most), in their voice. It can't fetch live data (resets, scores, the weather): write it as a reminder.
- pingLevel: 0 to ping nobody; 1 pings every member; 2 trusted and up; 3 moderators and up; 4 admins. Use it when they say "ping the team" or "tag everyone".
- summary: one short plain sentence (20 words at most).

${VOICE}`;

export const postJob: BuildJob<PostSpec> = {
  id: "post",
  scope: "lobby",
  minLevel: 4,
  perm: "edit_branding",
  system: POST_SYSTEM,
  tool: {
    name: "plan_post",
    description: "The scheduled post.",
    input_schema: {
      type: "object",
      properties: {
        cadence: E(["once", "daily", "weekly"]),
        days: { type: "array", items: E(DAYS) },
        time: S("HH:MM"),
        date: S("YYYY-MM-DD"),
        tz: S(),
        message: S(),
        pingLevel: N(),
        summary: S(),
      },
      required: ["cadence", "time", "tz", "message", "summary"],
    },
  },
  maxTokens: 2000,
  context: (c) => `The lobby: ${clip(c.lobby?.name, 100)}.`,
  clean: (raw, c) => cleanPost(raw, c.body?.tz),
};

const ALERT_SYSTEM = `You set up an alert for someone in a lobby on Weered: Weered pings them when enough people are in a room. Call the plan_alert tool exactly once. Do not reply with text.

- room: the name of the lobby's room they mean, exactly as it is in the list. If none of the rooms is the one they named (a different name, not just different spelling), set room to "" and say in the summary which rooms there are.
- threshold: how many people (2 to 50).
- summary: one short plain sentence (20 words at most).

${VOICE}`;

export const alertJob: BuildJob<AlertSpec | null> = {
  id: "alert",
  scope: "lobby",
  minLevel: 1,
  system: ALERT_SYSTEM,
  tool: {
    name: "plan_alert",
    description: "The alert.",
    input_schema: {
      type: "object",
      properties: { room: S(), threshold: N(), summary: S() },
      required: ["room", "threshold", "summary"],
    },
  },
  maxTokens: 1500,
  context: async (c) => {
    const rooms = await prisma.room
      .findMany({ where: { lobbyId: c.lobby?.id }, select: { name: true }, take: 60 })
      .catch(() => []);
    return `The lobby's rooms: ${rooms.map((r) => r.name).join(", ") || "none"} (the lobby's own chat is "${clip(c.lobby?.name, 80)}").`;
  },
  clean: async (raw, c) => {
    const r = obj(raw);
    const want = clip(r.room, 80).toLowerCase();
    if (!want) return null;
    const rooms = await prisma.room
      .findMany({ where: { lobbyId: c.lobby?.id }, select: { id: true, name: true }, take: 200 })
      .catch(() => []);
    const all = [{ id: String(c.lobby?.id), name: String(c.lobby?.name || "Lobby chat") }, ...rooms];
    const room =
      all.find((x) => x.name.toLowerCase() === want) ||
      all.find((x) => x.name.toLowerCase().includes(want) || want.includes(x.name.toLowerCase()));
    if (!room) return null;
    return { roomId: room.id, roomName: room.name, threshold: int(r.threshold, 2, 50) ?? 4 };
  },
};

const FEED_SYSTEM = `You hook a lobby's chat up to another site on Weered: when there's something new there, the lobby's host (or Weered) posts it in the chat. Call the plan_feed tool exactly once. Do not reply with text.

- source: youtube (new uploads on a channel), twitch (when a channel goes live) or rss (new items on any site's feed).
- target: exactly what they gave: the YouTube channel link or @handle, the Twitch channel name, or the feed's address. Never make one up; if they didn't give one, leave target empty.
- message: what gets posted, with {title}, {link} and {name} (the channel's name) where they go (200 characters at most).
- summary: one short plain sentence (20 words at most). If target is empty, say what you need.

${VOICE}`;

export const feedJob: BuildJob<FeedSpec | null> = {
  id: "feed",
  scope: "lobby",
  minLevel: 4,
  perm: "edit_branding",
  system: FEED_SYSTEM,
  tool: {
    name: "plan_feed",
    description: "The feed.",
    input_schema: {
      type: "object",
      properties: {
        source: E(["youtube", "twitch", "rss"]),
        target: S(),
        message: S(),
        summary: S(),
      },
      required: ["source", "target", "message", "summary"],
    },
  },
  maxTokens: 1500,
  clean: (raw, c) => {
    const r = obj(raw);
    const source = oneOf(r.source, ["youtube", "twitch", "rss"] as const);
    if (!source) return null;
    let target = "";
    if (source === "twitch") {
      const s = String(r.target ?? "")
        .slice(0, 200)
        .trim()
        .replace(/^@/, "")
        .replace(/^https?:\/\/(www\.)?twitch\.tv\//i, "")
        .split("/", 1)[0];
      if (/^[a-z0-9_]{3,25}$/i.test(s) && c.given.toLowerCase().includes(s.toLowerCase()))
        target = s.toLowerCase();
    } else if (source === "youtube" && /^@[A-Za-z0-9._-]{3,30}$/.test(String(r.target ?? "").trim())) {
      const h = String(r.target).trim();
      if (c.given.toLowerCase().includes(h.toLowerCase())) target = h;
    } else {
      target = givenUrl(r.target, c.given) || "";
    }
    if (!target) return null;
    return {
      source,
      target,
      message: clip(r.message, 200) || (source === "twitch" ? "{name} is live: {link}" : "New: {title} {link}"),
    };
  },
};
