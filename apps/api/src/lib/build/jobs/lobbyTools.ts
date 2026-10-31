import { prisma } from "../../prisma";
import { VOICE, E, N, S, arr, clip, clipBody, int, obj, oneOf, when } from "../common";
import type { BuildJob } from "../job";

// Describe-it for a lobby's everyday tools: events, rooms, role names and
// chat rules. Each returns a proposal the lobby's staff see and then save
// through the feature's own route.

// ── Events ──────────────────────────────────────────────────────────────────

export type EventPlan = {
  title: string;
  startsAt: string;
  endsAt: string | null;
  details: string;
  category: string;
  repeatWeeks: number;
};

const EVENT_SYSTEM = `You plan an event for a lobby on Weered from what someone who runs it said. Call the plan_event tool exactly once. Do not reply with text.

- title: short (80 characters at most), in their words.
- startsAt: ISO 8601 with their UTC offset, worked out from "Now" (so "Friday at 8" is this coming Friday at 20:00 their time). Mind daylight saving changes between now and then. If they gave no time, pick a sensible evening one and say so in the summary.
- endsAt: only if they gave an end or a length, else leave it out.
- details: one or two sentences: what it is, who it's for, what to bring. Weered events don't count spots or check roles yet, so put limits they mention ("six spots", "Warlocks only") in the details.
- category: one or two words (Raid, Movie night, Tournament, Meeting), or empty.
- repeatWeeks: 1, unless they said it happens every week: then how many weeks to post (2 to 8; 4 if they didn't say).
- summary: one short plain sentence (20 words at most).

${VOICE}`;

export const eventJob: BuildJob<EventPlan> = {
  id: "event",
  scope: "lobby",
  minLevel: 4,
  system: EVENT_SYSTEM,
  tool: {
    name: "plan_event",
    description: "The event.",
    input_schema: {
      type: "object",
      properties: {
        title: S(),
        startsAt: S("ISO 8601 with offset"),
        endsAt: S("ISO 8601 with offset"),
        details: S(),
        category: S(),
        repeatWeeks: N(),
        summary: S(),
      },
      required: ["title", "startsAt", "details", "summary"],
    },
  },
  maxTokens: 2500,
  context: (c) => `The lobby: ${clip(c.lobby?.name, 100)} (${c.lobby?.moduleType || "NONE"}).`,
  clean: (raw) => {
    const r = obj(raw);
    const startsAt =
      when(r.startsAt) || new Date(Date.now() + 86_400_000).toISOString();
    const end = when(r.endsAt);
    return {
      title: clip(r.title, 120) || "Event",
      startsAt,
      endsAt: end && Date.parse(end) > Date.parse(startsAt) ? end : null,
      details: clipBody(r.details, 1000),
      category: clip(r.category, 40),
      repeatWeeks: int(r.repeatWeeks, 1, 8) ?? 1,
    };
  },
};

// ── Rooms ───────────────────────────────────────────────────────────────────

/** What a room can open with (api lib/roomModules.ts), the everyday ones first. */
export const ROOM_OPENS = [
  "text",
  "voice",
  "video",
  "screen",
  "youtube",
  "twitch",
  "browser",
  "article",
  "poker",
  "chess",
  "dnd",
  "study",
  "fakeout",
] as const;
const WHO = { anyone: 0, members: 1, crew: 2, staff: 4 } as const;
export type RoomPlan = { name: string; opens: string; who: keyof typeof WHO; minLevel: number };

const ROOM_SYSTEM = `You set up a room in a lobby on Weered from what someone said. Call the plan_room tool exactly once. Do not reply with text.

- name: short (40 characters at most), in their words, not already taken in this lobby.
- opens: what the room opens with: voice (talk), video (cams on), screen (show a game or a doc), youtube (watch together), twitch (watch a stream), browser (browse together), article (read together), poker, chess, dnd (a tabletop session), study (a focus timer), fakeout (the trading game), or text (chat only).
- who: anyone (everyone who visits), members (members of this lobby), crew (trusted members and up), staff (admins only).
- summary: one short plain sentence (20 words at most).

${VOICE}`;

export const roomJob: BuildJob<RoomPlan> = {
  id: "room",
  scope: "lobby",
  minLevel: 1,
  system: ROOM_SYSTEM,
  tool: {
    name: "plan_room",
    description: "The room.",
    input_schema: {
      type: "object",
      properties: {
        name: S(),
        opens: E(ROOM_OPENS),
        who: E(Object.keys(WHO)),
        summary: S(),
      },
      required: ["name", "opens", "who", "summary"],
    },
  },
  maxTokens: 1500,
  context: async (c) => {
    const rooms = await prisma.room
      .findMany({ where: { lobbyId: c.lobby?.id }, select: { name: true }, take: 60 })
      .catch(() => []);
    return `The lobby: ${clip(c.lobby?.name, 100)}. Rooms it has: ${rooms.map((r) => r.name).join(", ") || "none"}.`;
  },
  clean: (raw, c) => {
    const r = obj(raw);
    const place = String(c.lobby?.id || "").startsWith("u-");
    const who = oneOf(r.who, Object.keys(WHO) as (keyof typeof WHO)[]) || "anyone";
    return {
      name: clip(r.name, 40) || "New room",
      // A member's place is text only (routes/places.ts).
      opens: place ? "text" : oneOf(r.opens, ROOM_OPENS) || "voice",
      who,
      minLevel: WHO[who],
    };
  },
};

// ── Role names, icons and perks ──────────────────────────────────────────────

export type RolesPlan = {
  names: Record<"1" | "2" | "3" | "4" | "5", string>;
  icons: Record<"1" | "2" | "3" | "4" | "5", string>;
  perks: string[];
};
const LEVELS = ["1", "2", "3", "4", "5"] as const;
const ROLE_DEFAULTS = { "5": "Owner", "4": "Admin", "3": "Moderator", "2": "Trusted", "1": "Member" };

const ROLES_SYSTEM = `You name the roles in a lobby on Weered. Every lobby has five levels with fixed powers:
5 Owner: everything, including roles.
4 Admin: kick, ban, rooms, the lobby's look, pins, the staff chat.
3 Moderator: kick, ban, rooms, pins, the staff chat.
2 Trusted: kick, the staff chat.
1 Member: no powers.
Call the name_roles tool exactly once. Do not reply with text.

- names: a name for each level that fits their theme (24 characters at most).
- icons: one emoji for each level.
- perks: up to 5 short lines (80 characters at most) on what members get here, only if they mentioned perks; else none.
- Powers can't change yet: if they want different powers, name the closest level for it and say so. For a waiting period ("Recruits for their first week"), say the chat rule "brand-new accounts wait before chatting" can do that.
- If you're given the current names, change what they asked for and keep the rest.
- summary: one short plain sentence (20 words at most).

${VOICE}`;

const LEVEL_MAP = {
  type: "object",
  properties: Object.fromEntries(LEVELS.map((l) => [l, S()])),
};

export const rolesJob: BuildJob<RolesPlan> = {
  id: "roles",
  scope: "lobby",
  minLevel: 5,
  perm: "manage_roles",
  system: ROLES_SYSTEM,
  tool: {
    name: "name_roles",
    description: "The roles.",
    input_schema: {
      type: "object",
      properties: {
        names: LEVEL_MAP,
        icons: LEVEL_MAP,
        perks: { type: "array", items: S() },
        summary: S(),
      },
      required: ["names", "icons", "summary"],
    },
  },
  maxTokens: 3000,
  context: (c) =>
    `The lobby: ${clip(c.lobby?.name, 100)}. Current names: ${JSON.stringify(c.lobby?.roleNames || ROLE_DEFAULTS)}. Current icons: ${JSON.stringify(c.lobby?.roleIcons || {})}.`,
  clean: (raw, c) => {
    const r = obj(raw);
    const cur = obj(c.lobby?.roleNames);
    const curIcons = obj(c.lobby?.roleIcons);
    const names = {} as RolesPlan["names"];
    const icons = {} as RolesPlan["icons"];
    for (const l of LEVELS) {
      names[l] = clip(obj(r.names)[l], 24) || clip(cur[l], 24) || ROLE_DEFAULTS[l];
      icons[l] = Array.from(clip(obj(r.icons)[l], 16)).slice(0, 4).join("") || clip(curIcons[l], 8);
    }
    return {
      names,
      icons,
      perks: arr(r.perks)
        .map((p) => clip(p, 80))
        .filter(Boolean)
        .slice(0, 5),
    };
  },
};

// ── Chat rules ──────────────────────────────────────────────────────────────

export type RulesPlan = {
  blockedWords: string[];
  blockedDomains: string[];
  newAccountChatHours: number;
  newAccountLinkHours: number;
};

const RULES_SYSTEM = `You set a lobby's chat rules on Weered. There are three:
- blockedWords: words or phrases that can't be posted (case-insensitive, matched anywhere in a message).
- blockedDomains: sites links can't point to (example.com).
- newAccountChatHours: how long a brand-new account waits before it can chat here (0 is off, up to 720).
- newAccountLinkHours: how long a brand-new account waits before it can post links here; it can still chat (0 is off, up to 720). "No links from new accounts" with no length given is 72.
Everyone already has: messages up to 4,000 characters, at most 3 links per message, 6 messages per 10 seconds.
Call the set_rules tool exactly once with the whole new set. Do not reply with text.

- Keep the current rules unless they ask to change them.
- Add only words they name, or plain spam phrases. Never write slurs or hateful words yourself: if they ask to block slurs, keep their list as it is and say in the summary they can type the exact words to block.
- If they ask for something these rules can't do (slow mode, a caps filter), say so in the summary.
- summary: one short plain sentence (20 words at most).

${VOICE}`;

const HOST_RE = /^(?=.{3,60}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

export const rulesJob: BuildJob<RulesPlan> = {
  id: "rules",
  scope: "lobby",
  minLevel: 4,
  perm: "edit_branding",
  system: RULES_SYSTEM,
  tool: {
    name: "set_rules",
    description: "The lobby's chat rules.",
    input_schema: {
      type: "object",
      properties: {
        blockedWords: { type: "array", items: S() },
        blockedDomains: { type: "array", items: S() },
        newAccountChatHours: N(),
        newAccountLinkHours: N(),
        summary: S(),
      },
      required: ["blockedWords", "blockedDomains", "newAccountChatHours", "newAccountLinkHours", "summary"],
    },
  },
  maxTokens: 3000,
  context: (c) =>
    `Current rules: ${JSON.stringify({
      blockedWords: c.lobby?.blockedWords || [],
      blockedDomains: c.lobby?.blockedDomains || [],
      newAccountChatHours: c.lobby?.newAccountChatHours || 0,
      newAccountLinkHours: c.lobby?.newAccountLinkHours || 0,
    }).slice(0, 4000)}`,
  clean: (raw) => {
    const r = obj(raw);
    const words = Array.from(
      new Set(
        arr(r.blockedWords)
          .map((w) => clip(w, 60).toLowerCase())
          .filter((w) => w.length >= 1),
      ),
    ).slice(0, 100);
    const domains = Array.from(
      new Set(
        arr(r.blockedDomains)
          .map((d) =>
            clip(d, 80)
              .toLowerCase()
              .replace(/^https?:\/\//, "")
              .replace(/^www\./, "")
              .replace(/[/?#].*$/, ""),
          )
          .filter((d) => HOST_RE.test(d)),
      ),
    ).slice(0, 100);
    return {
      blockedWords: words,
      blockedDomains: domains,
      newAccountChatHours: int(r.newAccountChatHours, 0, 720) ?? 0,
      newAccountLinkHours: int(r.newAccountLinkHours, 0, 720) ?? 0,
    };
  },
};
