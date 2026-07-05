import { WebSocket, WebSocketServer } from "ws";
import { prisma } from "./prisma";
import { swallow } from "./logger";
import { randomUUID } from "node:crypto";
import { type ReactionAgg } from "./chatHelpers";

// In-memory room/WS state engine extracted from index.ts. wss is injected
// once from main() so the lobby-activity ping can still reach all clients.
let _wss: WebSocketServer | null = null;
let _isAIAvailable: () => boolean = () => false;
export function setRoomStateDeps(deps: { wss?: WebSocketServer; isAIAvailable?: () => boolean }) {
  if (deps.wss) _wss = deps.wss;
  if (deps.isAIAvailable) _isAIAvailable = deps.isAIAvailable;
}

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
  isEvent: boolean;
  passwordHash?: string;
  launch?: LaunchState;
  voiceMode?: "OPEN" | "QUEUED" | "LISTEN_ONLY";
  voiceQueue?: Set<string>;
  voiceSpeakers?: Set<string>;
  disabledModules?: string[];
};

export const rooms = new Map<string, RoomState>();
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

export function normalizeRoomId(input: string): string {
  let s = String(input || "").trim();
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
  return s;
}

export async function ensureRoomLoaded(roomId: string): Promise<RoomState> {
  roomId = normalizeRoomId(roomId);
  const cached = rooms.get(roomId);
  if (cached) return cached;

  if (roomId === "lobby") {
    const r = makeEmptyRoom(roomId);
    r.name = "Home Lobby";
    rooms.set(roomId, r);
    return r;
  }

  const dbRoom = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      members: true,
      bans: true,
      messages: { orderBy: { ts: "asc" }, take: 80 },
      audit: { orderBy: { ts: "asc" }, take: 80 },
    },
  });

  const r = makeEmptyRoom(roomId);

  if (!dbRoom) {
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
    r.pinned = Boolean((dbRoom as any).pinned);
    r.isEvent = Boolean((dbRoom as any).isEvent);
    r.ownerId = dbRoom.ownerId || undefined;
    r.lobbyId = (dbRoom as any).lobbyId || undefined;
    r.passwordHash = (dbRoom as any).passwordHash || undefined;
    (r as any).disabledModules = Array.isArray((dbRoom as any).disabledModules)
      ? (dbRoom as any).disabledModules
      : [];
    const vm = String((dbRoom as any).voiceMode || "OPEN").toUpperCase();
    r.voiceMode = vm === "QUEUED" || vm === "LISTEN_ONLY" ? vm : "OPEN";
    for (const m of dbRoom.members) {
      if (m.role === "MOD") r.mods.add(m.userId);
    }
    for (const b of dbRoom.bans) r.banned.add(b.userId);
    r.msgs = dbRoom.messages.map((m) => ({
      id: m.id,
      user: { id: m.userId, name: m.userName || "?", role: "member" },
      body: m.body,
      ts: new Date(m.ts).getTime(),
      editedAt: (m as any).editedAt ? new Date((m as any).editedAt).getTime() : undefined,
      deletedAt: (m as any).deletedAt ? new Date((m as any).deletedAt).getTime() : undefined,
      replyTo: (m as any).replyToId
        ? {
            id: (m as any).replyToId,
            userId: (m as any).replyToUserId || "",
            userName: (m as any).replyToUserName || "?",
            body: (m as any).replyToBody || "",
          }
        : undefined,
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
  if (roomId.startsWith("mtg-") && !roomId.endsWith("-foyer") && !r.locked) {
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

export function broadcast(room: RoomState, msg: any) {
  for (const s of room.sockets) send(s, msg);
  // Room occupancy changed: ping everyone so lobby rails refresh on push
  // instead of polling. Tiny payload, throttled to 1/2s per room.
  if (msg && (msg.type === "presence:join" || msg.type === "presence:leave")) {
    const now = Date.now();
    const last = _lobbyActivityAt.get(room.roomId) || 0;
    if (now - last > 2000) {
      _lobbyActivityAt.set(room.roomId, now);
      const ping = JSON.stringify({
        type: "lobby:activity",
        lobbyId: room.lobbyId || null,
        roomId: room.roomId,
      });
      for (const sock of (_wss as any)?.clients ?? []) {
        try {
          if (sock.readyState === 1) sock.send(ping);
        } catch (e) {
          swallow(e);
        }
      }
    }
  }
}
export const _lobbyActivityAt = new Map<string, number>();

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
export function isModOrOwner(room: RoomState, userId?: string, globalRole?: string) {
  return isElevatedGlobal(globalRole) || isOwner(room, userId) || isMod(room, userId);
}
export function roleOf(room: RoomState, userId: string): Role {
  if (isOwner(room, userId)) return "owner";
  if (isMod(room, userId)) return "mod";
  return "member";
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

export function buildStatePayload(room: RoomState) {
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
  const users = Array.from(room.users.values()).map((u) => ({
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
      avatarColor: "#D4A017",
      avatar: "/brand/roles/operator.svg",
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
    count: users.length - (_isAIAvailable() ? 1 : 0),
    locked: Boolean(room.locked),
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
    pinned: Array.from(((room as any).pinned as Set<string> | undefined) || []),
  };
}

export function publishStateToSocket(ws: Sock, room: RoomState) {
  send(ws, buildStatePayload(room));
  const uid = ws.user?.id;
  if (uid && isModOrOwner(room, uid, ws.user?.globalRole)) {
    send(ws, {
      type: "room:adminState",
      roomId: room.roomId,
      name: room.name || room.roomId,
      locked: Boolean(room.locked),
      ownerId: room.ownerId || "",
      mods: Array.from(room.mods.values()),
      knocks: room.knocks.slice(-50),
      banned: Array.from(room.banned.values()),
      muted: Array.from(room.muted.values()),
      audit: room.audit.slice(-50),
    });
  }
}

export function publishState(room: RoomState) {
  const payload = buildStatePayload(room);
  broadcast(room, payload);

  for (const s of room.sockets) {
    const uid = s.user?.id;
    if (!uid || !isModOrOwner(room, uid, s.user?.globalRole)) continue;
    send(s, {
      type: "room:adminState",
      roomId: room.roomId,
      name: room.name || room.roomId,
      locked: Boolean(room.locked),
      ownerId: room.ownerId || "",
      mods: Array.from(room.mods.values()),
      knocks: room.knocks.slice(-50),
      banned: Array.from(room.banned.values()),
      muted: Array.from(room.muted.values()),
      audit: room.audit.slice(-50),
    });
  }
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
      if (existed) broadcast(room, { type: "presence:leave", roomId, userId: ws.user.id });
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
