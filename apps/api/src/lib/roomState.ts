import { WebSocket, WebSocketServer } from "ws";
import { prisma } from "./prisma";
import { displayName, resolveUserProfiles, namesOf } from "./userNames";
import { swallow } from "./logger";
import { isOfficeRoom } from "./officeRooms";
import { randomUUID } from "node:crypto";
import { type ReactionAgg } from "./chatHelpers";
import { hostAvatar } from "./hostAvatar";
import { lobbyLevelOf } from "./lobbyAccess";
import { floodOn } from "./flood";

// In-memory room/WS state engine extracted from index.ts. wss is injected
// once from main() so the lobby-activity ping can still reach all clients.
let _wss: WebSocketServer | null = null;
let _isAIAvailable: () => boolean = () => false;
export function setRoomStateDeps(deps: { wss?: WebSocketServer; isAIAvailable?: () => boolean }) {
  if (deps.wss) _wss = deps.wss;
  if (deps.isAIAvailable) _isAIAvailable = deps.isAIAvailable;
}

// Whether The Operator (AI) is live. Read at call time so DI order doesn't matter.
export function isAIAvailable(): boolean {
  return _isAIAvailable();
}

// The Operator's face: a gold robot drawn on a transparent ground, on a dark
// disc. Since 2026-11-01 avatarColor is the disc behind a picture, and its old
// gold hid the gold robot (James 11-02: "fix the poor operator's face").
export const OPERATOR_FACE = {
  avatar: "/brand/roles/operator.svg",
  avatarColor: "#2a2110",
} as const;

// The Operator's presence shape — shared by the WS presence:state and the HTTP
// lobby-presence snapshot so anon and authed viewers see the same entry.
export const OPERATOR_PRESENCE = {
  id: "operator",
  name: "The Operator",
  usernameKey: "operator",
  role: "SYSTEM",
  globalRole: "GOD",
  ...OPERATOR_FACE,
} as const;

export type AuthedUser = {
  id: string;
  name: string;
  usernameKey?: string;
  globalRole?: string;
  tier?: string;
  avatarColor?: string;
  avatar?: string;
};

export type Sock = WebSocket & {
  user?: AuthedUser;
  roomId?: string;
  pendingRoomId?: string;
  joinedRoomId?: string;
};

export type Role = "owner" | "mod" | "member";
export type RoomUser = {
  id: string;
  name: string;
  role?: Role;
  globalRole?: string;
  tier?: string;
  avatarColor?: string | null;
  avatar?: string | null;
  /** This member's rank in the LOBBY that owns the room (1..5) — distinct from
   *  `role`, which is their standing in this room. Surfaces resolve the title and
   *  icon for it from the lobby's roleNames/roleIcons maps rather than carrying
   *  copies here, so an owner editing an icon changes it everywhere at once.
   *  Absent for guests and for rooms that belong to no lobby. */
  lobbyRoleLevel?: number;
};
export type ReplyTo = { id: string; userId: string; userName: string; body: string };
export type ChatAttachmentRef = {
  id: string;
  url: string;
  thumbUrl: string;
  w: number;
  h: number;
  trusted: boolean;
  expiresAt?: string | null;
};
/** A ChatAttachment row as a message carries it: the live send and the
 *  reload (loadRoom) both build it here, so a reloaded picture looks the same. */
export function chatAttachmentRef(att: {
  id: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  trusted: boolean;
  expiresAt: Date | string | null;
}): ChatAttachmentRef {
  return {
    id: att.id,
    url: att.url,
    thumbUrl: att.thumbUrl,
    w: att.width,
    h: att.height,
    trusted: att.trusted,
    expiresAt: att.expiresAt ? new Date(att.expiresAt).toISOString() : null,
  };
}
export type ChatMsg = {
  id: string;
  user: RoomUser;
  body: string;
  ts: number;
  editedAt?: number;
  deletedAt?: number;
  reactions?: ReactionAgg[];
  replyTo?: ReplyTo;
  attachment?: ChatAttachmentRef;
};
export type Knock = { userId: string; name: string; ts: number };

export type AuditItem = {
  id: string;
  ts: number;
  type: string;
  actorId: string;
  actorName: string;
  targetId?: string;
  targetName?: string;
  note?: string;
};

export type ModuleState = {
  mode: string;
  url?: string;
  channel?: string;
  setBy?: string;
  setAt?: number;
};

export type LaunchTarget = {
  appid: number;
  connect: string;
  /** Absent on targets set before BAR existed; treat as "steam". */
  kind?: "steam" | "bar";
  bar?: import("./barLaunch").BarLaunchConfig;
  display: string;
  note?: string;
  setBy: string;
  setAt: number;
};

export type LaunchSlot = "player" | "observer";

export type LaunchState = {
  target: LaunchTarget | null;
  slots: Map<string, LaunchSlot>;
  ready: Set<string>;
  firedAt: number | null;
  firedBy: string | null;
};

export type RoomState = {
  roomId: string;
  name?: string;
  description?: string;
  iconUrl?: string;
  bannerUrl?: string;
  accentColor?: string;
  thumbnail?: string;
  lobbyId?: string;
  users: Map<string, RoomUser>;
  sockets: Set<Sock>;
  msgs: ChatMsg[];
  ownerId?: string;
  mods: Set<string>;
  banned: Set<string>;
  muted: Set<string>;
  locked: boolean;
  knocks: Knock[];
  pending: Map<string, Set<Sock>>;
  audit: AuditItem[];
  activeModule: ModuleState | null;
  ytState: { videoId: string; playing: boolean; position: number; updatedAt: number } | null;
  lastActiveAt: number;
  pinned: boolean;
  /** Pinned chat messages (chat:pin), not to be confused with a pinned room. */
  pinnedMsgs?: Set<string>;
  /** Chat lock: only moderators may post (Room.chatLocked). */
  chatLocked?: boolean;
  /** Who was kicked, until when (ms): they can't walk straight back in. */
  kickedUntil?: Map<string, number>;
  /** Slow mode: seconds between one person's messages (moderators exempt). */
  slowSec?: number;
  /** When each person last posted, for slow mode. */
  lastSaid?: Map<string, number>;
  isEvent: boolean;
  passwordHash?: string;
  launch?: LaunchState;
  voiceMode?: "OPEN" | "QUEUED" | "LISTEN_ONLY";
  voiceQueue?: Set<string>;
  voiceSpeakers?: Set<string>;
  disabledModules?: string[];
};

export const rooms = new Map<string, RoomState>();

/** The lobby host's and Weered's posts (lib/lobbyPost.ts) come back from the
 *  database in the shape they were broadcast in, not as a member. The host's
 *  face is its current emoji (looked up once per load). */
const isServerAuthor = (userId: string) => userId === "weered" || userId.startsWith("host:");
function serverAuthorOf(userId: string, userName: string, hostFace?: string) {
  return userId === "weered"
    ? {
        id: "weered",
        name: "Weered",
        role: "SYSTEM" as any,
        avatar: "/brand/logo/weered-logo-128.png",
        avatarColor: "#7c3aed",
      }
    : {
        id: userId,
        name: userName || "Host",
        role: "SYSTEM" as any,
        avatar: hostFace,
        avatarColor: "#6d28d9",
      };
}
export const articleRoomMeta = new Map<string, { name: string; thumbnail?: string }>();

export function makeEmptyRoom(roomId: string): RoomState {
  return {
    roomId,
    name: "",
    users: new Map(),
    sockets: new Set(),
    msgs: [],
    ownerId: undefined,
    mods: new Set(),
    banned: new Set(),
    muted: new Set(),
    locked: false,
    knocks: [],
    pending: new Map(),
    audit: [],
    activeModule: null,
    ytState: null,
    lastActiveAt: Date.now(),
    pinned: false,
    isEvent: false,
    voiceMode: "OPEN",
    voiceQueue: new Set<string>(),
    voiceSpeakers: new Set<string>(),
    disabledModules: [],
  };
}

/** Real room ids are slugs and cuids, well under this. An id is also a Room row
 *  and an entry in every rooms:list reply, so an unbounded one (the audit sent
 *  ~250KB) is refused: callers treat "" as no room. So is the retired
 *  `lobby:<id>` form: no client uses it and no room has it, but a room by that
 *  name skipped its password and lock and heard that lobby's broadcasts (red
 *  team 2026-11-01, finding 28). */
export const ROOM_ID_MAX = 128;

export function normalizeRoomId(input: string): string {
  let s = String(input || "").trim();
  if (s.length > ROOM_ID_MAX * 3) return ""; // even fully %-encoded, too long
  for (let i = 0; i < 3; i++) {
    if (s.indexOf("%") === -1) break;
    try {
      const d = decodeURIComponent(s);
      if (d === s) break;
      s = d;
    } catch {
      break;
    }
  }
  if (s.startsWith("lobby:")) return "";
  return s.length > ROOM_ID_MAX ? "" : s;
}

/**
 * The room, loaded, if it already exists; null if it does not. Unlike
 * ensureRoomLoaded this never creates a Room row, so it is what message
 * handlers use: only a join may bring a new room into being.
 */
export async function loadExistingRoom(roomId: string): Promise<RoomState | null> {
  roomId = normalizeRoomId(roomId);
  if (!roomId) return null;
  const cached = rooms.get(roomId);
  if (cached) return cached;
  const row = await prisma.room
    .findUnique({ where: { id: roomId }, select: { id: true } })
    .catch(() => null);
  return row ? ensureRoomLoaded(roomId) : null;
}

// One load per room. People arriving together at a room that isn't in
// memory (everyone reconnecting after a deploy) each built their own copy,
// and the last copy stored replaced the others: whoever joined an earlier
// copy sat in a room nobody else was in, and never saw anyone arrive
// (found 2026-10-31). Everyone now waits on the one load.
const loadingRooms = new Map<string, Promise<RoomState>>();

export async function ensureRoomLoaded(roomId: string): Promise<RoomState> {
  roomId = normalizeRoomId(roomId);
  const cached = rooms.get(roomId);
  if (cached) return cached;
  let loading = loadingRooms.get(roomId);
  if (!loading) {
    loading = loadRoom(roomId).finally(() => loadingRooms.delete(roomId));
    loadingRooms.set(roomId, loading);
  }
  return loading;
}

async function loadRoom(roomId: string): Promise<RoomState> {
  // The Home Lobby used to be built here as an empty in-memory room with no
  // Room row, and every persistence path skipped it. Its chat therefore lived
  // exactly as long as the API process, which restarts on every deploy. Give
  // it a row (idempotently) and let it load like any other room so its
  // messages and reactions come back. Name and pinned are re-asserted after
  // load so nothing about its identity depends on what the row says.
  if (roomId === "lobby") {
    await prisma.room
      .upsert({
        where: { id: roomId },
        update: {},
        create: { id: roomId, name: "Home Lobby", pinned: true, locked: false, ownerId: null },
      })
      .catch(swallow);
  }

  const dbRoom = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      members: true,
      bans: true,
      // The newest 80, put back in order below. Taken oldest-first, a busy
      // room came back from every restart showing its first 80 messages ever.
      messages: { orderBy: { ts: "desc" }, take: 80 },
      audit: { orderBy: { ts: "desc" }, take: 80 },
    },
  });

  const r = makeEmptyRoom(roomId);

  if (!dbRoom) {
    // The Room row is created on first join for ANY id, including a lobby's own
    // id: that row is the lobby-level chat container (RoomMessage has an FK to
    // Room), so it must exist before the first message. Do not gate this on
    // "is this id a lobby" -- it is, by design, for lobby chat.
    try {
      await prisma.room.create({ data: { id: roomId, name: "", locked: false, ownerId: null } });
    } catch (e: any) {
      if (e?.code !== "P2002") throw e;
    }
  } else {
    r.name = dbRoom.name || "";
    r.description = (dbRoom as any).description || undefined;
    r.iconUrl = (dbRoom as any).iconUrl || undefined;
    r.bannerUrl = (dbRoom as any).bannerUrl || undefined;
    r.accentColor = (dbRoom as any).accentColor || undefined;
    r.locked = Boolean(dbRoom.locked);
    r.chatLocked = Boolean((dbRoom as any).chatLocked);
    r.slowSec = Number((dbRoom as any).slowSec) || 0;
    for (const id of (dbRoom as any).mutedUserIds || []) r.muted.add(String(id));
    r.pinned = Boolean((dbRoom as any).pinned);
    r.isEvent = Boolean((dbRoom as any).isEvent);
    r.ownerId = dbRoom.ownerId || undefined;
    r.lobbyId = (dbRoom as any).lobbyId || undefined;
    r.passwordHash = (dbRoom as any).passwordHash || undefined;
    // Lobby-level entry gate (Room.minLevel). Cached with the room like the
    // password is; a change takes effect when the room next loads from the DB.
    (r as any).minLevel = Math.max(0, Number((dbRoom as any).minLevel) || 0);
    (r as any).disabledModules = Array.isArray((dbRoom as any).disabledModules)
      ? (dbRoom as any).disabledModules
      : [];
    const vm = String((dbRoom as any).voiceMode || "OPEN").toUpperCase();
    r.voiceMode = vm === "QUEUED" || vm === "LISTEN_ONLY" ? vm : "OPEN";
    if (roomId === "lobby") {
      r.name = "Home Lobby";
      r.pinned = true;
    }
    for (const m of dbRoom.members) {
      if (m.role === "MOD") r.mods.add(m.userId);
    }
    for (const b of dbRoom.bans) r.banned.add(b.userId);
    dbRoom.messages.reverse();
    dbRoom.audit.reverse();
    // The room's pins (chat:pin saves pinnedAt). A pinned message older than
    // the backlog loads with it: the pins bar shows pins from loaded messages.
    const pinnedRows = await prisma.roomMessage
      .findMany({
        where: { roomId, pinnedAt: { not: null } } as any,
        orderBy: { pinnedAt: "asc" } as any,
        take: 10,
      })
      .catch(() => [] as typeof dbRoom.messages);
    const inBacklog = new Set(dbRoom.messages.map((m) => m.id));
    const olderPins = pinnedRows
      .filter((m) => !inBacklog.has(m.id))
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    dbRoom.messages.unshift(...olderPins);
    r.pinnedMsgs = new Set(pinnedRows.map((m) => m.id));
    // Each message's picture, while it's still up: not expired, hidden by
    // reports or removed by staff (routes/chatMedia.ts).
    const attIds = dbRoom.messages.map((m) => (m as any).attachmentId).filter(Boolean);
    const pictures = new Map<string, ChatAttachmentRef>();
    if (attIds.length) {
      const atts = await prisma.chatAttachment
        .findMany({ where: { id: { in: attIds }, status: "ACTIVE" } })
        .catch(() => []);
      for (const a of atts) pictures.set(a.id, chatAttachmentRef(a));
    }
    // Author names come from the User record, not the copy stored on each
    // message. That copy is the name at send time, so without this a rename
    // leaves every past message showing the old name. One batched lookup for
    // the whole backlog, authors and reply targets together.
    const nameIds = new Set<string>();
    for (const m of dbRoom.messages) {
      if (m.userId && m.userId !== "operator" && !isServerAuthor(m.userId)) nameIds.add(m.userId);
      const rid = (m as any).replyToUserId;
      if (rid) nameIds.add(String(rid));
    }
    // One query for the whole backlog: live name AND avatar/avatarColor, so a
    // reload shows the same avatars the live broadcast did.
    const liveProfiles = await resolveUserProfiles(nameIds);
    const liveNames = namesOf(liveProfiles);

    // The operator's replies are persisted with userId "operator" (no User row
    // behind it). Rebuild the exact shape the live broadcast used, or a reload
    // turns The Operator into a plain member called "operator" with no avatar.
    const OPERATOR_USER = {
      id: "operator",
      name: "The Operator",
      role: "SYSTEM" as any,
      ...OPERATOR_FACE,
    };
    // The host's face, when any of its messages are in the backlog.
    let hostFace: string | undefined;
    const hostMsg = dbRoom.messages.find((m) => String(m.userId || "").startsWith("host:"));
    if (hostMsg) {
      const hl = await prisma.lobby
        .findUnique({
          where: { id: String(hostMsg.userId).slice(5) },
          select: { hostConfig: true } as any,
        })
        .catch(() => null);
      hostFace = hostAvatar(String((hl as any)?.hostConfig?.emoji || ""));
    }
    r.msgs = dbRoom.messages.map((m) => ({
      id: m.id,
      user:
        m.userId === "operator"
          ? OPERATOR_USER
          : isServerAuthor(m.userId)
            ? serverAuthorOf(m.userId, m.userName, hostFace)
            : {
                id: m.userId,
                name: displayName(liveNames, m.userId, m.userName),
                role: "member" as const,
                avatar: liveProfiles.get(m.userId)?.avatar ?? undefined,
                avatarColor: liveProfiles.get(m.userId)?.avatarColor ?? undefined,
              },
      body: m.body,
      ts: new Date(m.ts).getTime(),
      editedAt: (m as any).editedAt ? new Date((m as any).editedAt).getTime() : undefined,
      deletedAt: (m as any).deletedAt ? new Date((m as any).deletedAt).getTime() : undefined,
      replyTo: (m as any).replyToId
        ? {
            id: (m as any).replyToId,
            userId: (m as any).replyToUserId || "",
            userName: displayName(liveNames, (m as any).replyToUserId, (m as any).replyToUserName),
            body: (m as any).replyToBody || "",
          }
        : undefined,
      attachment: pictures.get((m as any).attachmentId),
    }));

    try {
      const msgIds = r.msgs.map((m) => m.id);
      if (msgIds.length > 0) {
        const rxRows = await prisma.reaction.findMany({
          where: { targetType: "ROOM_MESSAGE", targetId: { in: msgIds } },
          select: { targetId: true, emoji: true, userId: true },
        });
        const byMsg: Record<string, Record<string, { count: number; users: string[] }>> = {};
        for (const rx of rxRows) {
          if (!byMsg[rx.targetId]) byMsg[rx.targetId] = {};
          if (!byMsg[rx.targetId][rx.emoji]) byMsg[rx.targetId][rx.emoji] = { count: 0, users: [] };
          byMsg[rx.targetId][rx.emoji].count++;
          if (byMsg[rx.targetId][rx.emoji].users.length < 12)
            byMsg[rx.targetId][rx.emoji].users.push(rx.userId);
        }
        for (const m of r.msgs) {
          const agg = byMsg[m.id];
          if (agg) {
            m.reactions = Object.entries(agg).map(([emoji, v]) => ({
              emoji,
              count: v.count,
              users: v.users,
            }));
          }
        }
      }
    } catch (e) {
      swallow(e);
    }
    r.audit = dbRoom.audit.map((a) => ({
      id: a.id,
      ts: new Date(a.ts).getTime(),
      type: a.type,
      actorId: a.actorId,
      actorName: a.actorName,
      targetId: a.targetId || undefined,
      note: a.note || undefined,
    }));
  }

  // OFFICE INVARIANT: consult rooms (mtg-*, except the -foyer waiting room) are
  // born locked and cannot drift unlocked. Admission — a mod letting a knocker
  // in — IS the privacy boundary for presented plans; an unlocked office lets a
  // scoped guest walk straight into another client's meeting. The original foyer
  // host flow re-locked per session; the wormhole path must not depend on that.
  if (isOfficeRoom(roomId) && !roomId.endsWith("-foyer") && !r.locked) {
    r.locked = true;
    try {
      await prisma.room.update({ where: { id: roomId }, data: { locked: true } });
    } catch (e) {
      swallow(e);
    }
  }

  if (!r.name) {
    const meta = articleRoomMeta.get(roomId);
    if (meta) {
      r.name = meta.name;
      if (meta.thumbnail) r.thumbnail = meta.thumbnail;
    } else if (roomId.startsWith("article_")) {
      try {
        const items = await prisma.feedItem.findMany({ orderBy: { fetchedAt: "desc" }, take: 500 });
        for (const item of items) {
          let h = 0;
          for (let i = 0; i < item.url.length; i++) {
            h = (h << 5) - h + item.url.charCodeAt(i);
            h |= 0;
          }
          if (`article_${Math.abs(h).toString(36).slice(0, 10)}` === roomId) {
            const shortTitle = item.title.length > 60 ? item.title.slice(0, 57) + "…" : item.title;
            r.name = shortTitle;
            if (item.thumbnail) r.thumbnail = item.thumbnail;
            articleRoomMeta.set(roomId, {
              name: shortTitle,
              thumbnail: item.thumbnail ?? undefined,
            });
            break;
          }
        }
      } catch (e) {
        swallow(e);
      }
    }
  }

  if (!r.lobbyId) {
    try {
      const isLobby = await prisma.lobby.findUnique({
        where: { id: roomId },
        select: { id: true },
      });
      if (isLobby) r.lobbyId = roomId;
    } catch (e) {
      swallow(e);
    }
  }

  const raced = rooms.get(roomId);
  if (raced) return raced;
  rooms.set(roomId, r);
  return r;
}

export function safeJson(raw: any): any | null {
  try {
    const s = typeof raw === "string" ? raw : raw?.toString?.("utf8");
    if (!s) return null;
    const o = JSON.parse(s);
    if (o && typeof o === "object" && o.payload && typeof o.payload === "object") {
      return { ...o, ...o.payload };
    }
    return o;
  } catch {
    return null;
  }
}

export function withPayload(msg: any) {
  try {
    if (!msg || typeof msg !== "object") return msg;
    if (msg.payload) return msg;
    const { type, ...rest } = msg;
    if (!type) return msg;
    return { ...msg, payload: rest };
  } catch {
    return msg;
  }
}

export function send(ws: Sock, msg: any) {
  try {
    if (ws.readyState === 1) ws.send(JSON.stringify(withPayload(msg)));
  } catch (e) {
    swallow(e);
  }
}

/** One message, already packaged, to one socket. */
export function sendRaw(ws: Sock, raw: string) {
  try {
    if (ws.readyState === 1) ws.send(raw);
  } catch (e) {
    swallow(e);
  }
}

/** To everyone in the room. Packaged once, not once per person: a crowd of n
 *  made every message n packagings (flood readiness 2026-11-02). */
export function broadcast(room: RoomState, msg: any) {
  const raw = JSON.stringify(withPayload(msg));
  for (const s of room.sockets) sendRaw(s, raw);
  if (msg && (msg.type === "presence:join" || msg.type === "presence:leave"))
    pingLobbyActivity(room);
}

/** Room occupancy changed: lobby rails refresh on push instead of polling. It
 *  went to every socket on the site for any arrival anywhere; now only to
 *  people in the same lobby (or in Weered's own rooms, for those), at most
 *  every 2 s per room, 10 s for a big room, 30 s in flood mode. */
function pingLobbyActivity(room: RoomState) {
  const now = Date.now();
  const every = floodOn() ? 30_000 : isBigRoom(room) ? 10_000 : 2_000;
  if (now - (_lobbyActivityAt.get(room.roomId) || 0) <= every) return;
  _lobbyActivityAt.set(room.roomId, now);
  const lobbyId = room.lobbyId || null;
  const ping = JSON.stringify({ type: "lobby:activity", lobbyId, roomId: room.roomId });
  for (const sock of (_wss as any)?.clients ?? []) {
    const rid = (sock as Sock).roomId;
    if (!rid) continue;
    const there = rooms.get(rid);
    const sameLobby = lobbyId ? rid === lobbyId || there?.lobbyId === lobbyId : !there?.lobbyId;
    if (sameLobby) sendRaw(sock as Sock, ping);
  }
}
export const _lobbyActivityAt = new Map<string, number>();

/**
 * Big rooms (flood readiness, 2026-11-02). Everyone on Home sits in one room,
 * and each arrival went to every person in it, so a crowd's cost grew with
 * the crowd times its arrivals: the local load test choked at about 500.
 * Above BIG_ROOM people (30 in flood mode) a room stops announcing each
 * arrival and departure; it sends its head count and a sample of names at
 * most once a second (every 3 s in flood mode). Smaller rooms are unchanged.
 */
export const BIG_ROOM = 80;
const BIG_ROOM_FLOOD = 30;
export const isBigRoom = (room: RoomState) =>
  room.users.size > (floodOn() ? BIG_ROOM_FLOOD : BIG_ROOM);
const sampleSize = () => (floodOn() ? 40 : 60);

/** A join, leave or away change: to everyone at once in a small room; folded
 *  into the next state update in a big one. */
export function announcePresence(room: RoomState, msg: any) {
  if (isBigRoom(room)) {
    pingLobbyActivity(room);
    scheduleState(room, "people");
  } else if ((room as any)._sampleSig) {
    // Just back under the line: screens hold a sample, so everyone gets the
    // whole list once, then single joins and leaves again.
    pingLobbyActivity(room);
    sendStateNow(room);
  } else broadcast(room, msg);
}

/** "people": only who's here changed. "all": the room itself did too (a lock,
 *  a mute, the voice queue), so the next send must carry the whole state. */
function scheduleState(room: RoomState, what: "people" | "all") {
  const r = room as any;
  if (what === "all") r._stateAll = true;
  if (r._stateTimer) return;
  const every = floodOn() ? 3_000 : 1_000;
  const wait = Math.max(0, (r._stateAt || 0) + every - Date.now());
  r._stateTimer = setTimeout(() => {
    r._stateTimer = null;
    r._stateAt = Date.now();
    if (rooms.get(room.roomId) === room) sendStateNow(room);
  }, wait);
}

function sendStateNow(room: RoomState) {
  const r = room as any;
  const big = isBigRoom(room);
  const payload = buildStatePayload(room, big ? { sample: sampleSize() } : undefined);
  // In a big room the sample hardly moves once it's full (staff, then the
  // earliest arrivals): when it hasn't and the room is as it was, the head
  // count alone goes out, a few dozen bytes instead of the sample.
  const sig = payload.users.map((u: any) => u.id).join(",");
  if (big && !r._stateAll && r._sampleSig === sig) {
    const raw = JSON.stringify({
      type: "presence:count",
      roomId: room.roomId,
      count: payload.count,
    });
    for (const s of room.sockets) sendRaw(s, raw);
    return;
  }
  r._stateAll = false;
  r._sampleSig = big ? sig : null;
  const raw = JSON.stringify(payload);
  let admin: string | null = null;
  for (const s of room.sockets) {
    sendRaw(s, raw);
    const uid = s.user?.id;
    if (!uid || !isModOrOwner(room, uid, s.user?.globalRole)) continue;
    admin ??= JSON.stringify(withPayload(adminStatePayload(room)));
    sendRaw(s, admin);
  }
}

export function isOwner(room: RoomState, userId?: string) {
  return Boolean(userId && room.ownerId && room.ownerId === userId);
}
export function isMod(room: RoomState, userId?: string) {
  return Boolean(userId && room.mods.has(userId));
}
export function isElevatedGlobal(globalRole?: string) {
  const r = String(globalRole || "").toUpperCase();
  return r === "GOD" || r === "STAFF" || r === "SUPPORT" || r === "ADMIN";
}
/** Their rank in the lobby this room belongs to (5 owner … 1 member), as
 *  read when they joined; 0 outside a lobby. */
export function lobbyLevelIn(room: RoomState, userId?: string): number {
  if (!userId || !room.lobbyId) return 0;
  return Number((room.users.get(userId) as any)?.lobbyRoleLevel || 0);
}
/** A lobby's moderators and up moderate every room in it, its own chat
 *  included; its owner runs them. Before this, a lobby's staff had no powers
 *  in their own lobby's rooms (found 2026-10-31). */
export function isModOrOwner(room: RoomState, userId?: string, globalRole?: string) {
  return (
    isElevatedGlobal(globalRole) ||
    isOwner(room, userId) ||
    isMod(room, userId) ||
    lobbyLevelIn(room, userId) >= 3
  );
}
export function roleOf(room: RoomState, userId: string): Role {
  if (isOwner(room, userId) || lobbyLevelIn(room, userId) >= 5) return "owner";
  if (isMod(room, userId) || lobbyLevelIn(room, userId) >= 3) return "mod";
  return "member";
}
/** Who outranks whom in a room: Weered's staff, then the room's (or lobby's)
 *  owner, then its moderators, then everyone else. A moderator acts only on
 *  people below them. */
export function rankIn(room: RoomState, userId: string, globalRole?: string): number {
  const g = String(globalRole || (room.users.get(userId) as any)?.globalRole || "").toUpperCase();
  if (g === "GOD") return 6;
  if (g === "ADMIN" || g === "STAFF") return 5;
  const role = roleOf(room, userId);
  if (role === "owner") return 4;
  if (g === "SUPPORT") return 3;
  if (role === "mod") return 2;
  return 1;
}

/**
 * rankIn for anyone, here or not. Someone who isn't in the room has no entry in
 * room.users, so their site role and lobby level come from the database; before
 * this they ranked as a plain member, and a moderator could ban a lobby's owner
 * or Weered's staff from a room while they were away (red team 2026-11-01,
 * finding 7). Someone with a socket in the room counts as here. A failed lookup
 * answers `ifUnknown`: out of reach (6) when deciding whether a moderator may
 * act on them, and a plain member (1) when deciding whether a ban holds.
 */
export async function rankOf(room: RoomState, userId: string, ifUnknown = 6): Promise<number> {
  let here = room.users.has(userId);
  if (!here) for (const s of room.sockets as Set<any>) if (s?.user?.id === userId) here = true;
  if (here) return rankIn(room, userId);
  try {
    const [u, level] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { globalRole: true } }),
      room.lobbyId ? lobbyLevelOf(userId, room.lobbyId) : Promise.resolve(0),
    ]);
    const g = String(u?.globalRole || "").toUpperCase();
    if (g === "GOD") return 6;
    if (g === "ADMIN" || g === "STAFF") return 5;
    if (isOwner(room, userId) || level >= 5) return 4;
    if (g === "SUPPORT") return 3;
    if (isMod(room, userId) || level >= 3) return 2;
    return 1;
  } catch (e) {
    swallow(e);
    return ifUnknown;
  }
}

/** A room ban never keeps out the people above the moderators who set it:
 *  Weered's staff and the room's or lobby's owner (finding 7). */
export async function banExempt(room: RoomState, userId: string): Promise<boolean> {
  return (await rankOf(room, userId, 1)) >= 4;
}

export function ensureLaunch(room: RoomState): LaunchState {
  if (!room.launch) {
    room.launch = {
      target: null,
      slots: new Map(),
      ready: new Set(),
      firedAt: null,
      firedBy: null,
    };
  }
  return room.launch;
}

export function serializeLaunch(room: RoomState) {
  const l = ensureLaunch(room);
  return {
    target: l.target,
    slots: Array.from(l.slots.entries()).map(([userId, slot]) => ({ userId, slot })),
    ready: Array.from(l.ready.values()),
    firedAt: l.firedAt,
    firedBy: l.firedBy,
  };
}

export function broadcastLaunch(room: RoomState) {
  broadcast(room, { type: "launch:state", roomId: room.roomId, launch: serializeLaunch(room) });
}

export function audit(room: RoomState, item: Omit<AuditItem, "id" | "ts"> & { ts?: number }) {
  const a: AuditItem = { id: randomUUID(), ts: item.ts ?? Date.now(), ...item };
  room.audit.push(a);
  if (room.audit.length > 300) room.audit.splice(0, room.audit.length - 300);

  if (room.roomId !== "lobby") {
    void prisma.roomAudit
      .create({
        data: {
          id: a.id,
          roomId: room.roomId,
          type: a.type,
          actorId: a.actorId,
          actorName: a.actorName,
          targetId: a.targetId || null,
          note: a.note || null,
          ts: new Date(a.ts),
        },
      })
      .catch(swallow);
  }

  for (const s of room.sockets) {
    const uid = s.user?.id;
    if (!uid || !isModOrOwner(room, uid)) continue;
    send(s, { type: "room:audit", roomId: room.roomId, item: a });
  }
}

/** Everything about the room for the people in it. With `sample`, a big
 *  room's list is its moderators and staff, then the earliest arrivals, up to
 *  that many (plus `include`, the person it's for); `count` is everyone. */
export function buildStatePayload(room: RoomState, opts?: { sample?: number; include?: string }) {
  const roleMap = new Map<string, string>();
  const colorMap = new Map<string, string>();
  const avatarMap = new Map<string, string>();
  const pillBgMap = new Map<string, string>();
  const pillAccentMap = new Map<string, string>();
  for (const s of room.sockets) {
    if (s.user?.id) {
      if (s.user.globalRole) roleMap.set(s.user.id, s.user.globalRole);
      if (s.user.avatarColor) colorMap.set(s.user.id, s.user.avatarColor);
      if (s.user.avatar) avatarMap.set(s.user.id, s.user.avatar);
      if ((s.user as any).pillBgColor) pillBgMap.set(s.user.id, (s.user as any).pillBgColor);
      if ((s.user as any).pillAccentColor)
        pillAccentMap.set(s.user.id, (s.user as any).pillAccentColor);
    }
  }
  let present = Array.from(room.users.values());
  const total = present.length;
  if (opts?.sample && total > opts.sample) {
    const first = (u: any) =>
      u.id === opts.include ||
      u.id === room.ownerId ||
      room.mods.has(u.id) ||
      Number(u.lobbyRoleLevel) >= 3 ||
      ["STAFF", "ADMIN", "GOD", "SUPPORT"].includes(String(u.globalRole || ""));
    present = [...present.filter(first), ...present.filter((u) => !first(u))].slice(
      0,
      Math.max(opts.sample, present.filter(first).length),
    );
  }
  const users = present.map((u) => ({
    ...u,
    role: u.id ? roleOf(room, u.id) : "member",
    globalRole: (u.id ? roleMap.get(u.id) : undefined) ?? (u as any).globalRole ?? "USER",
    avatarColor: (u.id ? colorMap.get(u.id) : undefined) ?? (u as any).avatarColor ?? undefined,
    avatar: (u.id ? avatarMap.get(u.id) : undefined) ?? (u as any).avatar ?? undefined,
    pillBgColor: (u.id ? pillBgMap.get(u.id) : undefined) ?? (u as any).pillBgColor ?? undefined,
    pillAccentColor:
      (u.id ? pillAccentMap.get(u.id) : undefined) ?? (u as any).pillAccentColor ?? undefined,
  }));
  if (_isAIAvailable()) {
    users.push({
      id: "operator",
      name: "The Operator",
      usernameKey: "operator",
      role: "SYSTEM",
      globalRole: "GOD",
      ...OPERATOR_FACE,
    } as any);
  }
  return {
    type: "presence:state",
    roomId: room.roomId,
    name: room.name || room.roomId,
    thumbnail: room.thumbnail || null,
    lobbyId: room.lobbyId || null,
    description: room.description || "",
    iconUrl: room.iconUrl || null,
    bannerUrl: room.bannerUrl || null,
    accentColor: room.accentColor || null,
    users,
    count: total,
    ...(users.length - (_isAIAvailable() ? 1 : 0) < total ? { sampled: true } : {}),
    locked: Boolean(room.locked),
    chatDisabled: Boolean(room.chatLocked),
    slowSec: room.slowSec || 0,
    ownerId: room.ownerId || "",
    mods: Array.from(room.mods.values()),
    muted: Array.from(room.muted.values()),
    activeModule: room.activeModule || null,
    disabledModules: Array.isArray((room as any).disabledModules)
      ? (room as any).disabledModules
      : [],
    voiceMode: room.voiceMode || "OPEN",
    voiceQueue: Array.from(room.voiceQueue || []),
    voiceSpeakers: Array.from(room.voiceSpeakers || []),
    launch: room.launch ? serializeLaunch(room) : null,
    pinned: Array.from(room.pinnedMsgs || []),
  };
}

/** What a room's moderators see besides everyone's state. It follows the
 *  state message, so it carries the chat lock and slow mode too: without
 *  them a moderator's screen showed the chat open again a moment after
 *  locking it (2026-10-31). */
export function adminStatePayload(room: RoomState) {
  return {
    type: "room:adminState",
    roomId: room.roomId,
    name: room.name || room.roomId,
    locked: Boolean(room.locked),
    chatDisabled: Boolean(room.chatLocked),
    slowSec: room.slowSec || 0,
    ownerId: room.ownerId || "",
    mods: Array.from(room.mods.values()),
    knocks: room.knocks.slice(-50),
    banned: Array.from(room.banned.values()),
    muted: Array.from(room.muted.values()),
    audit: room.audit.slice(-50),
  };
}

export function publishStateToSocket(ws: Sock, room: RoomState) {
  const big = isBigRoom(room);
  sendRaw(
    ws,
    JSON.stringify(
      buildStatePayload(room, big ? { sample: sampleSize(), include: ws.user?.id } : undefined),
    ),
  );
  const uid = ws.user?.id;
  if (uid && isModOrOwner(room, uid, ws.user?.globalRole)) send(ws, adminStatePayload(room));
}

/** The room's state to everyone in it: at once in a small room, folded into
 *  at most one a second in a big one. */
export function publishState(room: RoomState) {
  if (isBigRoom(room)) scheduleState(room, "all");
  else sendStateNow(room);
}

export function leaveRoom(ws: Sock) {
  const roomId = ws.roomId;
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (!room) return;

  room.sockets.delete(ws);
  if (ws.user) {
    let userHasOtherSocket = false;
    for (const s of room.sockets) {
      if (s.user?.id === ws.user.id) {
        userHasOtherSocket = true;
        break;
      }
    }
    if (!userHasOtherSocket) {
      const existed = room.users.delete(ws.user.id);
      if (existed) announcePresence(room, { type: "presence:leave", roomId, userId: ws.user.id });
      const userId = ws.user.id;
      const location = (room as any).name || roomId;
      prisma.user
        .update({
          where: { id: userId },
          data: { lastSeenAt: new Date(), lastSeenLocation: location },
        })
        .catch(swallow);
      if (room.launch) {
        const hadSlot = room.launch.slots.delete(ws.user.id);
        const hadReady = room.launch.ready.delete(ws.user.id);
        if (hadSlot || hadReady) broadcastLaunch(room);
      }
    }
  }
  ws.roomId = undefined;

  room.lastActiveAt = Date.now();
}
