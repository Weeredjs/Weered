import Fastify from "fastify";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import { randomUUID, randomBytes, createHmac, timingSafeEqual } from "crypto";
import { AccessToken } from "livekit-server-sdk";
import { PrismaClient, RoomRole, GlobalRole, LobbyRole, ModuleType } from "@prisma/client";
import { OAuth2Client } from "google-auth-library";
import { syncManifest, enrichProfile, enrichMilestones, isLoaded as manifestLoaded, manifestVersion } from "./manifest";

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || "weered-dev-secret";
const HTTP_PORT = Number(process.env.PORT || 4000);
const WS_PORT = Number(process.env.WS_PORT || 4001);

const LIVEKIT_URL = process.env.LIVEKIT_URL || process.env.LIVEKIT_WS_URL || "ws://127.0.0.1:7880";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "";

type AuthedUser = { id: string; name: string; globalRole?: string; avatarColor?: string; avatar?: string };
type Sock = WebSocket & { user?: AuthedUser; roomId?: string; pendingRoomId?: string };

type Role = "owner" | "mod" | "member";
type RoomUser = { id: string; name: string; role?: Role; avatarColor?: string | null; avatar?: string | null };
type ChatMsg = { id: string; user: RoomUser; body: string; ts: number };
type Knock = { userId: string; name: string; ts: number };

type AuditItem = {
  id: string;
  ts: number;
  type: string;
  actorId: string;
  actorName: string;
  targetId?: string;
  targetName?: string;
  note?: string;
};

type RoomState = {
  roomId: string;
  name?: string;
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
};

const rooms = new Map<string, RoomState>();
// Title/thumbnail for article rooms — populated by feed worker, used in ensureRoomLoaded
const articleRoomMeta = new Map<string, { name: string; thumbnail?: string }>();
let wss: WebSocketServer;

// ── Pinned lobbies now seeded from DB via seedLobbies() on startup ────────────


// ── Global role helpers ───────────────────────────────────────────────────────

async function getGlobalRole(userId: string): Promise<GlobalRole> {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { globalRole: true } });
    return u?.globalRole ?? GlobalRole.USER;
  } catch { return GlobalRole.USER; }
}

function canAccessStaff(role: GlobalRole) {
  return role === GlobalRole.SUPPORT || role === GlobalRole.STAFF || role === GlobalRole.ADMIN || role === GlobalRole.GOD;
}

function canAssignRoles(role: GlobalRole) {
  return role === GlobalRole.STAFF || role === GlobalRole.ADMIN || role === GlobalRole.GOD;
}

// ── Lobby role helpers ────────────────────────────────────────────────────────

async function getLobbyRole(userId: string, lobbyId: string): Promise<LobbyRole | null> {
  try {
    const m = await prisma.lobbyMember.findUnique({ where: { lobbyId_userId: { lobbyId, userId } }, select: { role: true } });
    return m?.role ?? null;
  } catch { return null; }
}

async function canModLobby(userId: string, lobbyId: string, globalRole: GlobalRole): Promise<boolean> {
  if (canAccessStaff(globalRole)) return true;
  const lr = await getLobbyRole(userId, lobbyId);
  return lr === LobbyRole.OWNER || lr === LobbyRole.MOD;
}

// ── Seed pinned lobbies into DB on startup ────────────────────────────────────

const SEED_LOBBIES = [
  { id: "lobby",        name: "The Lobby",    description: "General hangout. Everyone starts here.", keywords: ["lobby","general","home"],              moduleType: ModuleType.REDDIT,  moduleConfig: { subreddit: "r/all" } },
  { id: "r/all",        name: "r/all",        description: "Reddit firehose. All topics welcome.",   keywords: ["reddit","all","general"],              moduleType: ModuleType.REDDIT,  moduleConfig: { subreddit: "r/all" } },
  { id: "r/gaming",     name: "r/gaming",     description: "Gamers of all kinds.",                   keywords: ["reddit","gaming","games","gamer"],     moduleType: ModuleType.REDDIT,  moduleConfig: { subreddit: "r/gaming" } },
  { id: "r/technology", name: "r/technology", description: "Tech news, discussion, builds.",         keywords: ["reddit","tech","technology","coding"],  moduleType: ModuleType.REDDIT,  moduleConfig: { subreddit: "r/technology" } },
  { id: "r/worldnews",  name: "r/worldnews",  description: "Global news and current events.",        keywords: ["reddit","news","world","worldnews"],   moduleType: ModuleType.REDDIT,  moduleConfig: { subreddit: "r/worldnews" } },
  { id: "weered.ca",    name: "Weered HQ",    description: "Meta, announcements, beta feedback.",    keywords: ["weered","meta","official","hq"],       moduleType: ModuleType.NONE,    moduleConfig: null },
  { id: "destiny2", name: "Destiny 2 | Bungie.net", description: "Guardians, strikes, raids and loot. Powered by the Bungie API.", keywords: ["destiny", "destiny2", "bungie", "guardian", "warlock", "titan", "hunter", "raid"], moduleType: ModuleType.BUNGIE, moduleConfig: { subreddits: ["r/DestinyTheGame", "r/destiny2"] }, accentColor: "#4F88C6", logoUrl: "https://www.bungie.net/img/logos/bungie-saber-logo.png", bannerUrl: null, websiteUrl: "https://www.bungie.net" },
];

async function seedLobbies() {
  for (const l of SEED_LOBBIES) {
    try {
      await (prisma as any).lobby.upsert({
        where: { id: l.id },
        update: { name: l.name, description: l.description, pinned: true, moduleType: l.moduleType, moduleConfig: l.moduleConfig as any, keywords: l.keywords },
        create:  { id: l.id, name: l.name, description: l.description, pinned: true, verified: true, moduleType: l.moduleType, moduleConfig: l.moduleConfig as any, keywords: l.keywords, accentColor: (l as any).accentColor ?? null, logoUrl: (l as any).logoUrl ?? null, bannerUrl: (l as any).bannerUrl ?? null, websiteUrl: (l as any).websiteUrl ?? null },
      });
    } catch (e) { console.warn("seedLobbies:", l.id, e); }
  }
  console.log("[weered] lobbies seeded");
}

async function globalAudit(actorId: string, actorName: string, action: string, targetId?: string, targetName?: string, meta?: any) {
  try {
    await prisma.globalAudit.create({
      data: { actorId, actorName, action, targetId: targetId ?? null, targetName: targetName ?? null, meta: meta ?? null },
    });
  } catch {}
}

// ── Room helpers ──────────────────────────────────────────────────────────────

function makeEmptyRoom(roomId: string): RoomState {
  return {
    roomId, name: "",
    users: new Map(), sockets: new Set(), msgs: [],
    ownerId: undefined, mods: new Set(), banned: new Set(), muted: new Set(),
    locked: false, knocks: [], pending: new Map(), audit: [],
  };
}

function normalizeRoomId(input: string): string {
  let s = String(input || "").trim();
  for (let i = 0; i < 3; i++) {
    if (s.indexOf("%") === -1) break;
    try { const d = decodeURIComponent(s); if (d === s) break; s = d; } catch { break; }
  }
  return s;
}

async function ensureRoomLoaded(roomId: string): Promise<RoomState> {
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
    r.locked = Boolean(dbRoom.locked);
    r.ownerId = dbRoom.ownerId || undefined;
    r.lobbyId = (dbRoom as any).lobbyId || undefined;
    for (const m of dbRoom.members) { if (m.role === "MOD") r.mods.add(m.userId); }
    for (const b of dbRoom.bans) r.banned.add(b.userId);
    r.msgs = dbRoom.messages.map((m) => ({
      id: m.id, user: { id: m.userId, name: m.userName || "?", role: "member" as Role },
      body: m.body, ts: new Date(m.ts).getTime(),
    }));
    r.audit = dbRoom.audit.map((a) => ({
      id: a.id, ts: new Date(a.ts).getTime(), type: a.type,
      actorId: a.actorId, actorName: a.actorName,
      targetId: a.targetId || undefined, note: a.note || undefined,
    }));
  }

  // Apply article room meta — in-memory map first, then DB fallback for fresh deploys
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
          for (let i = 0; i < item.url.length; i++) { h = ((h << 5) - h) + item.url.charCodeAt(i); h |= 0; }
          if (`article_${Math.abs(h).toString(36).slice(0, 10)}` === roomId) {
            const shortTitle = item.title.length > 60 ? item.title.slice(0, 57) + "…" : item.title;
            r.name = shortTitle;
            if (item.thumbnail) r.thumbnail = item.thumbnail;
            articleRoomMeta.set(roomId, { name: shortTitle, thumbnail: item.thumbnail ?? undefined });
            break;
          }
        }
      } catch {}
    }
  }

  // If this room IS a lobby, set lobbyId to itself
  if (!r.lobbyId) {
    try {
      const isLobby = await prisma.lobby.findUnique({ where: { id: roomId }, select: { id: true } });
      if (isLobby) r.lobbyId = roomId;
    } catch {}
  }

  rooms.set(roomId, r);
  return r;
}

function safeJson(raw: any): any | null {
  try {
    const s = typeof raw === "string" ? raw : raw?.toString?.("utf8");
    if (!s) return null;
    const o = JSON.parse(s);
    if (o && typeof o === "object" && (o as any).payload && typeof (o as any).payload === "object") {
      return { ...(o as any), ...((o as any).payload) };
    }
    return o;
  } catch { return null; }
}

function withPayload(msg: any) {
  try {
    if (!msg || typeof msg !== "object") return msg;
    if ((msg as any).payload) return msg;
    const { type, ...rest } = msg as any;
    if (!type) return msg;
    return { ...(msg as any), payload: rest };
  } catch { return msg; }
}

function send(ws: Sock, msg: any) {
  try { if (ws.readyState === 1) ws.send(JSON.stringify(withPayload(msg))); } catch {}
}

function broadcast(room: RoomState, msg: any) {
  for (const s of room.sockets) send(s, msg);
}

function isOwner(room: RoomState, userId?: string) {
  return Boolean(userId && room.ownerId && room.ownerId === userId);
}
function isMod(room: RoomState, userId?: string) {
  return Boolean(userId && room.mods.has(userId));
}
function isElevatedGlobal(globalRole?: string) {
  const r = String(globalRole || "").toUpperCase();
  return r === "GOD" || r === "STAFF" || r === "SUPPORT" || r === "ADMIN";
}
function isModOrOwner(room: RoomState, userId?: string, globalRole?: string) {
  return isElevatedGlobal(globalRole) || isOwner(room, userId) || isMod(room, userId);
}
function roleOf(room: RoomState, userId: string): Role {
  if (isOwner(room, userId)) return "owner";
  if (isMod(room, userId)) return "mod";
  return "member";
}

function audit(room: RoomState, item: Omit<AuditItem, "id" | "ts"> & { ts?: number }) {
  const a: AuditItem = { id: randomUUID(), ts: item.ts ?? Date.now(), ...item };
  room.audit.push(a);
  if (room.audit.length > 300) room.audit.splice(0, room.audit.length - 300);

  if (room.roomId !== "lobby") {
    void prisma.roomAudit.create({
      data: {
        id: a.id, roomId: room.roomId, type: a.type,
        actorId: a.actorId, actorName: a.actorName,
        targetId: a.targetId || null, note: a.note || null, ts: new Date(a.ts),
      },
    }).catch(() => {});
  }

  for (const s of room.sockets) {
    const uid = s.user?.id;
    if (!uid || !isModOrOwner(room, uid)) continue;
    send(s, { type: "room:audit", roomId: room.roomId, item: a });
  }
}

function buildStatePayload(room: RoomState) {
  const roleMap       = new Map<string, string>();
  const colorMap      = new Map<string, string>();
  const avatarMap     = new Map<string, string>();
  for (const s of room.sockets) {
    if (s.user?.id) {
      if (s.user.globalRole)  roleMap.set(s.user.id, s.user.globalRole);
      if (s.user.avatarColor) colorMap.set(s.user.id, s.user.avatarColor);
      if (s.user.avatar)      avatarMap.set(s.user.id, s.user.avatar);
    }
  }
  const users = Array.from(room.users.values()).map((u) => ({
    ...u,
    role:        u.id ? roleOf(room, u.id) : "member",
    globalRole:  (u.id ? roleMap.get(u.id) : undefined) ?? (u as any).globalRole ?? "USER",
    avatarColor: (u.id ? colorMap.get(u.id) : undefined) ?? (u as any).avatarColor ?? undefined,
    avatar:      (u.id ? avatarMap.get(u.id) : undefined) ?? (u as any).avatar ?? undefined,
  }));
  return {
    type: "presence:state", roomId: room.roomId, name: room.name || room.roomId,
    thumbnail: room.thumbnail || null, lobbyId: room.lobbyId || null,
    users, count: users.length, locked: Boolean(room.locked),
    ownerId: room.ownerId || "", mods: Array.from(room.mods.values()),
    muted: Array.from(room.muted.values()),
  };
}

// Send full state to a single socket only (used on join — don't overwrite others' incremental state)
function publishStateToSocket(ws: Sock, room: RoomState) {
  send(ws, buildStatePayload(room));
  const uid = ws.user?.id;
  if (uid && isModOrOwner(room, uid, ws.user?.globalRole)) {
    send(ws, {
      type: "room:adminState", roomId: room.roomId, name: room.name || room.roomId,
      locked: Boolean(room.locked), ownerId: room.ownerId || "",
      mods: Array.from(room.mods.values()), knocks: room.knocks.slice(-50),
      banned: Array.from(room.banned.values()), muted: Array.from(room.muted.values()),
      audit: room.audit.slice(-50),
    });
  }
}

function publishState(room: RoomState) {
  const payload = buildStatePayload(room);
  broadcast(room, payload);

  for (const s of room.sockets) {
    const uid = s.user?.id;
    if (!uid || !isModOrOwner(room, uid, s.user?.globalRole)) continue;
    send(s, {
      type: "room:adminState", roomId: room.roomId, name: room.name || room.roomId,
      locked: Boolean(room.locked), ownerId: room.ownerId || "",
      mods: Array.from(room.mods.values()), knocks: room.knocks.slice(-50),
      banned: Array.from(room.banned.values()), muted: Array.from(room.muted.values()),
      audit: room.audit.slice(-50),
    });
  }
}

function leaveRoom(ws: Sock) {
  const roomId = ws.roomId;
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (!room) return;

  room.sockets.delete(ws);
  if (ws.user) {
    // Only remove the user from the room if they have NO other sockets still connected.
    // During a page refresh the new socket joins before the old one fires "close",
    // so deleting by userId here would evict the user who already reconnected.
    let userHasOtherSocket = false;
    for (const s of room.sockets) {
      if (s.user?.id === ws.user.id) { userHasOtherSocket = true; break; }
    }
    if (!userHasOtherSocket) {
      const existed = room.users.delete(ws.user.id);
      if (existed) broadcast(room, { type: "presence:leave", roomId, userId: ws.user.id });
    }
  }
  ws.roomId = undefined;

  if (room.sockets.size === 0 && room.users.size === 0 && room.roomId !== "lobby") {
    rooms.delete(roomId);
  }
}
// ── Notoriety system ──────────────────────────────────────────────────────────
// Point values per action (idempotent where flagged)
const NOTORIETY_ACTIONS: Record<string, { points: number; once?: boolean }> = {
  BIO_COMPLETE:        { points: 50,   once: true  },
  FIRST_ROOM_HOSTED:   { points: 100,  once: true  },
  ROOM_25_USERS:       { points: 250,  once: false },  // per occurrence
  SUBREDDIT_LINKED:    { points: 75,   once: true  },
  DAILY_ACTIVE:        { points: 10,   once: false },
};

// Track one-time awards in a simple DB table — for now use a JSON field on User
// or a separate NotorietyEvent table. Using NotorietyEvent for auditability.
async function awardNotoriety(userId: string, action: string): Promise<void> {
  const cfg = NOTORIETY_ACTIONS[action];
  if (!cfg) return;

  try {
    if (cfg.once) {
      // Check if already awarded
      const existing = await prisma.notorietyEvent.findFirst({
        where: { userId, action },
      });
      
      if (existing) return;
    }

    await prisma.$transaction([
      prisma.notorietyEvent.create({ data: { userId, action, points: cfg.points } }),
      prisma.user.update({
        where: { id: userId },
        data: { notoriety: { increment: cfg.points } },
      }),
    ]);

    // Recalculate tier after award
    await recalcTier(userId);
  } catch (e) {
    console.error("[notoriety] award failed", action, userId, e);
  }
}

async function recalcTier(userId: string): Promise<void> {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { notoriety: true } });
    if (!u) return;
    const n = u.notoriety ?? 0;
    // Tier thresholds — Kingpin is staff-granted only (not earned by score)
    const tier = n >= 2000 ? "FELON" : n >= 500 ? "INDICTED" : "INNOCENT";
    await prisma.user.update({ where: { id: userId }, data: { tier } });
  } catch {}
}

// DM delivery — push to all sockets belonging to a user
function dmDeliver(toUserId: string, payload: object) {
  for (const sock of wss.clients) {
    if ((sock as any).user?.id === toUserId) {
      send(sock as any, payload);
    }
  }
}

function send_to_user(userId: string, payload: object) {
  dmDeliver(userId, payload);
}

function removePending(room: RoomState, userId: string) {
  const set = room.pending.get(userId);
  if (set) { for (const s of set) { try { s.pendingRoomId = undefined; } catch {} } }
  room.pending.delete(userId);
}

function removeKnock(room: RoomState, userId: string) {
  room.knocks = room.knocks.filter((k) => k.userId !== userId);
}

// Hydrate globalRole onto AuthedUser from DB (called once per WS connection)
async function hydrateGlobalRole(user: AuthedUser): Promise<AuthedUser> {
  try {
    const u = await prisma.user.findUnique({ where: { id: user.id }, select: { globalRole: true, avatarColor: true, avatar: true } });
    return { ...user, globalRole: String(u?.globalRole ?? "USER"), avatarColor: u?.avatarColor ?? undefined, avatar: u?.avatar ?? undefined };
  } catch { return user; }
}

function verifyToken(token?: string): AuthedUser | null {
  if (!token) return null;
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const id = String(decoded?.sub || decoded?.id || "");
    const name = String(decoded?.name || decoded?.username || "");
    if (!id || !name) return null;
    return { id, name };
  } catch { return null; }
}

function authFromHeader(authHeader?: string): AuthedUser | null {
  if (!authHeader) return null;
  const raw = String(authHeader).trim();
  const m = raw.match(/^Bearer\s+(.+)$/i);
  if (m) return verifyToken(m[1]);
  // Fallback: try raw token directly (for query param auth)
  return verifyToken(raw);
}

async function resolveUserId(raw: string): Promise<string> {
  console.log("[resolveUserId] raw=", JSON.stringify(raw));
  // If it looks like a cuid already, use it directly
  if (raw.length > 20 && !raw.includes(" ")) return raw;
  const found = await prisma.user.findFirst({
    where: { OR: [{ usernameKey: raw.toLowerCase() }, { name: raw }] },
    select: { id: true },
  });
  console.log("[resolveUserId] found=", JSON.stringify(found));
  return found?.id ?? raw;
}

const ROOM_ALPH = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function shortRoomId(len = 6): string {
  const b = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ROOM_ALPH[b[i] % ROOM_ALPH.length];
  return out;
}

function findSocketsByUser(room: RoomState, userId: string): Sock[] {
  const out: Sock[] = [];
  for (const s of room.sockets) { if (s.user?.id === userId) out.push(s); }
  return out;
}

async function persistMember(room: RoomState, user: AuthedUser) {
  if (room.roomId === "lobby") return;
  const role = roleOf(room, user.id);
  const dbRole = role === "owner" ? RoomRole.OWNER : role === "mod" ? RoomRole.MOD : RoomRole.MEMBER;
  await prisma.roomMember.upsert({
    where: { roomId_userId: { roomId: room.roomId, userId: user.id } },
    update: { name: user.name, role: dbRole },
    create: { roomId: room.roomId, userId: user.id, name: user.name, role: dbRole },
  });
}

async function persistRoomBasics(room: RoomState) {
  if (room.roomId === "lobby") return;
  await prisma.room.update({
    where: { id: room.roomId },
    data: { name: room.name || "", locked: Boolean(room.locked), ownerId: room.ownerId || null },
  });
}

async function doJoin(ws: Sock, roomId: string) {
  roomId = normalizeRoomId(roomId);
  const room = await ensureRoomLoaded(roomId);
  if (roomId === "lobby" && !room.name) room.name = "Home Lobby";

  if (!room.ownerId && ws.user) {
    room.ownerId = ws.user.id;
    if (room.roomId !== "lobby") {
      await prisma.room.update({ where: { id: room.roomId }, data: { ownerId: room.ownerId } });
    }
  }

  if (ws.user && room.banned.has(ws.user.id)) {
    send(ws, { type: "room:banned", roomId });
    return false;
  }

  // Already in this room on this socket — just republish state to this socket only, not everyone
  if (ws.roomId === roomId) { publishStateToSocket(ws, room); return true; }
  if (ws.roomId) leaveRoom(ws);

  ws.roomId = roomId;
  ws.pendingRoomId = undefined;
  room.sockets.add(ws);
  if (ws.user) room.pending.delete(ws.user.id);

  if (ws.user && !room.users.has(ws.user.id)) {
    const userEntry = { id: ws.user.id, name: ws.user.name, globalRole: ws.user.globalRole || "USER", avatarColor: ws.user.avatarColor ?? undefined, avatar: ws.user.avatar ?? undefined };
    room.users.set(ws.user.id, userEntry);
    broadcast(room, { type: "presence:join", roomId, user: userEntry });
  }

  if (ws.user) { try { await persistMember(room, ws.user); } catch {} }

  // Only send full state to the joining socket — everyone else already got presence:join
  publishStateToSocket(ws, room);

  if (room.msgs.length) {
    send(ws, { type: "chat:history", roomId, msgs: room.msgs.slice(-80) });
  }

  return true;
}

// ── HTTP server ───────────────────────────────────────────────────────────────


// ── Content Ingestion Worker ──────────────────────────────────────────────────
// Fetches from 6 sources every 20 min, normalises into FeedItem, stores in DB.
// Heat = recency score (0-70) + room presence bonus (0-30)

interface RawItem {
  url: string;
  title: string;
  thumbnail?: string;
  domain: string;
  sourceName: string;
  category: string;
  postedAt: Date;
}

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function roomIdFromUrl(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i++) { h = ((h << 5) - h) + url.charCodeAt(i); h |= 0; }
  return `article_${Math.abs(h).toString(36).slice(0, 10)}`;
}

function recencyScore(postedAt: Date): number {
  const ageHours = (Date.now() - postedAt.getTime()) / 3600000;
  if (ageHours < 1)  return 70;
  if (ageHours < 3)  return 60;
  if (ageHours < 6)  return 50;
  if (ageHours < 12) return 38;
  if (ageHours < 24) return 25;
  if (ageHours < 48) return 12;
  return 5;
}

async function fetchHackerNews(): Promise<RawItem[]> {
  try {
    const res  = await fetch("https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=15&numericFilters=points>50");
    const data = await res.json() as any;
    return (data.hits || []).filter((h: any) => h.url).map((h: any) => ({
      url:        h.url,
      title:      h.title,
      domain:     domainOf(h.url),
      sourceName: "Hacker News",
      category:   "tech",
      postedAt:   new Date(h.created_at),
    }));
  } catch (e) { console.warn("[feed] HN fetch failed:", e); return []; }
}

async function fetchESPNRss(feedUrl: string, category: string, sourceName: string): Promise<RawItem[]> {
  try {
    const res  = await fetch(feedUrl, { headers: { "User-Agent": "Mozilla/5.0 (compatible; Weered/1.0)" } });
    const xml  = await res.text();
    const items: RawItem[] = [];
    const itemRx  = /<item>([\s\S]*?)<\/item>/g;
    const titleRx = /<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/;
    const linkRx  = /<link>(?:<!\[CDATA\[)?(https?[^<]+?)(?:\]\]>)?<\/link>/;
    const dateRx  = /<pubDate>(.*?)<\/pubDate>/;
    const imgRx   = /<media:thumbnail[^>]+url=\"([^"]+)\"/;
    let m: RegExpExecArray | null;
    while ((m = itemRx.exec(xml)) !== null) {
      const block  = m[1];
      const title  = titleRx.exec(block)?.[1]?.trim();
      const link   = linkRx.exec(block)?.[1]?.trim();
      const dateStr = dateRx.exec(block)?.[1];
      const thumb  = imgRx.exec(block)?.[1];
      if (!title || !link) continue;
      items.push({ url: link, title, thumbnail: thumb, domain: domainOf(link), sourceName, category, postedAt: dateStr ? new Date(dateStr) : new Date() });
    }
    return items.slice(0, 12);
  } catch (e) { console.warn(`[feed] ESPN RSS ${feedUrl} failed:`, e); return []; }
}

async function fetchItunesPodcasts(): Promise<RawItem[]> {
  try {
    const terms = ["true+crime", "comedy", "news", "sports", "technology"];
    const term  = terms[Math.floor(Math.random() * terms.length)];
    const res   = await fetch(`https://itunes.apple.com/search?media=podcast&entity=podcastEpisode&term=${term}&limit=10&sort=recent`);
    const data  = await res.json() as any;
    return (data.results || []).map((r: any) => ({
      url:        r.trackViewUrl || r.collectionViewUrl,
      title:      r.trackName || r.collectionName,
      thumbnail:  r.artworkUrl100,
      domain:     "podcasts.apple.com",
      sourceName: r.collectionName || "Apple Podcasts",
      category:   "podcasts",
      postedAt:   r.releaseDate ? new Date(r.releaseDate) : new Date(),
    })).filter((r: any) => r.url && r.title);
  } catch (e) { console.warn("[feed] iTunes fetch failed:", e); return []; }
}

async function fetchYouTubeRss(channelId: string, sourceName: string, category: string): Promise<RawItem[]> {
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
    const xml = await res.text();
    const items: RawItem[] = [];
    const entryRx = /<entry>([\s\S]*?)<\/entry>/g;
    const titleRx = /<title>(.*?)<\/title>/;
    const linkRx  = /<link rel=\"alternate\" href=\"([^"]+)\"/;
    const dateRx  = /<published>(.*?)<\/published>/;
    const thumbRx = /<media:thumbnail url=\"([^"]+)\"/;
    let m: RegExpExecArray | null;
    while ((m = entryRx.exec(xml)) !== null) {
      const block   = m[1];
      const title   = titleRx.exec(block)?.[1]?.trim();
      const link    = linkRx.exec(block)?.[1]?.trim();
      const dateStr = dateRx.exec(block)?.[1];
      const thumb   = thumbRx.exec(block)?.[1];
      if (!title || !link) continue;
      items.push({ url: link, title, thumbnail: thumb, domain: "youtube.com", sourceName, category, postedAt: dateStr ? new Date(dateStr) : new Date() });
    }
    return items.slice(0, 8);
  } catch (e) { console.warn(`[feed] YouTube RSS ${channelId} failed:`, e); return []; }
}

async function runFeedWorker() {
  console.log("[feed] worker starting fetch...");
  try {
    const [hn, espnUfc, espnNfl, espnNba, podcasts, ign, gamespot] = await Promise.all([
      fetchHackerNews(),
      fetchESPNRss("https://www.espn.com/espn/rss/mma/news",  "ufc",    "ESPN MMA"),
      fetchESPNRss("https://www.espn.com/espn/rss/nfl/news",  "sports", "ESPN NFL"),
      fetchESPNRss("https://www.espn.com/espn/rss/nba/news",  "sports", "ESPN NBA"),
      fetchItunesPodcasts(),
      fetchYouTubeRss("UCKy1dAqELo0zrOtPkf0eTMw", "IGN",      "gaming"),
      fetchYouTubeRss("UCbu2SsF-Or3Rsn3NxqODImQ", "GameSpot", "gaming"),
    ]);

    const all: RawItem[] = [...hn, ...espnUfc, ...espnNfl, ...espnNba, ...podcasts, ...ign, ...gamespot];
    const seen = new Set<string>();
    const deduped = all.filter(i => { if (!i.url || seen.has(i.url)) return false; seen.add(i.url); return true; });

    let upserted = 0;
    for (const item of deduped) {
      const roomId      = roomIdFromUrl(item.url);
      const roomState   = rooms.get(roomId);
      const usersInRoom = roomState ? roomState.users.size : 0;
      const heat        = Math.min(100, recencyScore(item.postedAt) + Math.min(30, usersInRoom * 5));

      await prisma.feedItem.upsert({
        where: { url: item.url },
        update: { heat, usersInRoom, fetchedAt: new Date(), title: item.title, thumbnail: item.thumbnail ?? null },
        create: { url: item.url, title: item.title, thumbnail: item.thumbnail ?? null, domain: item.domain, sourceName: item.sourceName, category: item.category, heat, usersInRoom, postedAt: item.postedAt },
      }).catch((e: any) => console.warn("[feed] upsert failed:", e?.message));
      // Seed in-memory article room meta — title + thumbnail for header display
      const shortTitle = item.title.length > 60 ? item.title.slice(0, 57) + "…" : item.title;
      articleRoomMeta.set(roomId, { name: shortTitle, thumbnail: item.thumbnail || undefined });
      if (roomState) {
        roomState.name = shortTitle;
        if (item.thumbnail) roomState.thumbnail = item.thumbnail;
      }
      upserted++;
    }
    console.log(`[feed] worker done — ${upserted} items upserted`);
  } catch (e) { console.error("[feed] worker error:", e); }
}

async function main() {
  const app = Fastify({ logger: true });

  // Store raw body for Stripe webhook signature verification
  app.addHook("preParsing", async (req, _reply, payload) => {
    if (req.url === "/subscribe/webhook") {
      const chunks: Buffer[] = [];
      for await (const chunk of payload as any) chunks.push(Buffer.from(chunk));
      const raw = Buffer.concat(chunks);
      (req as any).rawBody = raw;
      // Return a new readable stream so Fastify can still parse it
      const { Readable } = require("stream");
      const copy = new Readable();
      copy.push(raw);
      copy.push(null);
      return copy;
    }
    return payload;
  });

  // Health
  app.get("/health", async () => {
    try { await prisma.$queryRaw`SELECT 1`; return { ok: true, db: "ok" }; }
    catch { return { ok: true, db: "down" }; }
  });

  // Auth: dev-login
  app.post("/auth/dev-login", async (req, reply) => {
    const body: any = (req as any).body || {};
    const raw = typeof body.username === "string" ? body.username : "";
    let name = (raw || "").trim().slice(0, 32);
    if (!name) { const suf = Math.floor(Math.random() * 9000 + 1000); name = `Guest-${suf}`; }
    const usernameKey = name.toLowerCase();
    const u = await prisma.user.upsert({
      where: { usernameKey }, update: { name }, create: { usernameKey, name },
    });
    const user = { id: u.id, name: u.name || name };
    const token = jwt.sign({ sub: user.id, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
    return reply.send({ token, user });
  });

  app.post("/dev-login", async (req, reply) => {
    const r = await (app as any).inject({ method: "POST", url: "/auth/dev-login", payload: (req as any).body || {} });
    reply.code(r.statusCode).headers(r.headers).send(r.json());
  });

  // Auth: register
  app.post("/auth/register", async (req, reply) => {
    const body: any = (req as any).body || {};
    const rawU = typeof body.username === "string" ? body.username : "";
    const rawP = typeof body.password === "string" ? body.password : "";
    const username = (rawU || "").trim().toLowerCase().slice(0, 32);
    const password = (rawP || "").trim();
    if (!username || !password) return reply.code(400).send({ error: "Missing username/password" });
    if (password.length < 6) return reply.code(400).send({ error: "Password too short" });
    const existing = await prisma.localAuth.findUnique({ where: { username } }).catch(() => null);
    if (existing) return reply.code(409).send({ error: "Username already exists" });
    const user = await prisma.user.create({ data: { name: username, usernameKey: username } });
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.localAuth.create({ data: { username, passwordHash, userId: user.id } });
    const token = jwt.sign({ sub: user.id, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
    return reply.send({ token, user });
  });

  // Auth: login
  app.post("/auth/login", async (req, reply) => {
    const body: any = (req as any).body || {};
    const rawU = typeof body.username === "string" ? body.username : "";
    const rawP = typeof body.password === "string" ? body.password : "";
    const username = (rawU || "").trim().toLowerCase().slice(0, 32);
    const password = (rawP || "").trim();
    if (!username || !password) return reply.code(400).send({ error: "Missing username/password" });
    const la = await prisma.localAuth.findUnique({ where: { username } }).catch(() => null);
    if (!la) return reply.code(401).send({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, la.passwordHash);
    if (!ok) return reply.code(401).send({ error: "Invalid credentials" });
    const user = await prisma.user.findUnique({ where: { id: la.userId } });
    if (!user) return reply.code(401).send({ error: "Invalid credentials" });
    const token = jwt.sign({ sub: user.id, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
    return reply.send({ token, user });
  });


  // Auth: Google OAuth
  const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || "";
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
  const GOOGLE_CALLBACK_URL  = process.env.GOOGLE_CALLBACK_URL  || "https://api.weered.ca/auth/google/callback";
  const WEB_URL              = process.env.APP_URL               || "https://weered.ca";

  app.get("/auth/google", async (req, reply) => {
    const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL);
    const url = client.generateAuthUrl({ access_type: "offline", scope: ["profile", "email"], prompt: "select_account" });
    return reply.redirect(url);
  });

  app.get("/auth/google/callback", async (req, reply) => {
    const { code } = (req as any).query as { code?: string };
    if (!code) return reply.redirect(`${WEB_URL}/login?error=no_code`);
    try {
      const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL);
      const { tokens } = await client.getToken(code);
      client.setCredentials(tokens);
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token!, audience: GOOGLE_CLIENT_ID });
      const payload = ticket.getPayload();
      if (!payload) return reply.redirect(`${WEB_URL}/login?error=no_payload`);
      const googleId = payload.sub;
      const email = payload.email || null;
      const avatar = payload.picture || null;
      const displayName = payload.name || `g_${googleId.slice(0, 12)}`;

      // 1. Find by googleId
      let user = await prisma.user.findFirst({ where: { googleId } });

      // 2. Find by email and link
      if (!user && email) {
        user = await prisma.user.findFirst({ where: { email } });
        if (user) {
          await prisma.user.update({ where: { id: user.id }, data: { googleId, avatar: avatar || undefined } });
        }
      }

      // 3. Create new user
      const isNew = !user;
      if (!user) {
        const tempName = `g_${googleId.slice(0, 12)}`;
        user = await prisma.user.create({ data: { name: displayName, usernameKey: tempName, googleId, email, avatar } });
      }
      const token = jwt.sign({ sub: user.id, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
      const userParam = encodeURIComponent(JSON.stringify({ id: user.id, name: user.name }));
      if (isNew) {
        return reply.redirect(`${WEB_URL}/onboarding?token=${token}&user=${userParam}`);
      }
      return reply.redirect(`${WEB_URL}/auth/google/finish?token=${token}&user=${userParam}`);
    } catch (e) {
      console.error("[google callback]", e);
      return reply.redirect(`${WEB_URL}/login?error=oauth_failed`);
    }
  });

  // Auth: username availability check
  app.get("/auth/username-check", async (req, reply) => {
    const { username } = (req as any).query as { username?: string };
    const clean = (username || "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32);
    if (clean.length < 2) return reply.send({ available: false, reason: "too_short" });
    const existing = await prisma.user.findUnique({ where: { usernameKey: clean } }).catch(() => null);
    return reply.send({ available: !existing });
  });

  // Auth: onboarding — set username after Google login
  app.post("/auth/onboarding", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const body: any = (req as any).body || {};
    const raw = typeof body.username === "string" ? body.username : "";
    const usernameKey = raw.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32);
    if (usernameKey.length < 2) return reply.code(400).send({ error: "Username too short" });
    const existing = await prisma.user.findUnique({ where: { usernameKey } }).catch(() => null);
    if (existing && existing.id !== u.id) return reply.code(409).send({ error: "Username taken" });
    const updated = await prisma.user.update({
      where: { id: u.id },
      data: { name: usernameKey, usernameKey },
    });
    const token = jwt.sign({ sub: updated.id, name: updated.name }, JWT_SECRET, { expiresIn: "7d" });
    return reply.send({ token, user: { id: updated.id, name: updated.name } });
  });

  // Voice token (LiveKit)
  app.post("/voice/token", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) return reply.code(500).send({ ok: false, error: "livekit_not_configured" });
    const body: any = (req as any).body || {};
    const roomId = String(body.roomId || body.room || "").trim().slice(0, 64);
    if (!roomId) return reply.code(400).send({ ok: false, error: "missing_roomId" });
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity: u.id, name: u.name });
    at.addGrant({ roomJoin: true, room: roomId, canPublish: true, canSubscribe: true, canPublishData: true });
    const token = await at.toJwt();
    return reply.send({ ok: true, url: LIVEKIT_URL, token });
  });

  // Rooms
  // GET /lobbies — all lobbies with live counts

  // GET /lobbies/:lobbyId/rooms — rooms scoped to a lobby
  app.get("/lobbies/:lobbyId/rooms", async (req, reply) => {
    const lobbyId = String((req as any).params?.lobbyId || "");
    const lobby = await prisma.lobby.findUnique({ where: { id: lobbyId } });
    if (!lobby) return reply.code(404).send({ ok: false, error: "lobby_not_found" });
    const list = await prisma.room.findMany({
      where: { lobbyId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, locked: true, _count: { select: { members: true } } },
    });
    const out = list.map(r => ({
      id: r.id, roomId: r.id, name: r.name || r.id,
      onlineCount: rooms.get(r.id)?.users.size ?? 0,
      locked: Boolean(r.locked), lobbyId,
    }));
    return { ok: true, rooms: out };
  });

  // POST /lobbies/:lobbyId/claim — lobby owner claim (verified users)
  app.post("/lobbies/:lobbyId/claim", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const lobbyId = String((req as any).params?.lobbyId || "");
    const lobby = await prisma.lobby.findUnique({ where: { id: lobbyId } });
    if (!lobby) return reply.code(404).send({ ok: false, error: "lobby_not_found" });
    if (lobby.ownerId && lobby.ownerId !== u.id) {
      const actorRole = await getGlobalRole(u.id);
      if (!canAccessStaff(actorRole)) return reply.code(403).send({ ok: false, error: "already_claimed" });
    }
    await prisma.lobby.update({ where: { id: lobbyId }, data: { ownerId: u.id, verified: true } });
    await prisma.lobbyMember.upsert({
      where: { lobbyId_userId: { lobbyId, userId: u.id } },
      update: { role: LobbyRole.OWNER },
      create: { lobbyId, userId: u.id, name: u.name, role: LobbyRole.OWNER },
    });
    return reply.send({ ok: true, lobbyId, claimed: true });
  });

  // GET /rooms — all rooms (lobbies + active user rooms) for Home page
  app.get("/rooms", async () => {
    // Lobbies from DB
    const lobbyList = await prisma.lobby.findMany({
      where: { pinned: true },
      select: { id: true, name: true, description: true, verified: true, pinned: true, moduleType: true },
    });
    const lobbyOut = lobbyList.map(l => ({
      id: l.id, roomId: l.id, name: l.name, description: l.description,
      verified: l.verified, pinned: true, moduleType: l.moduleType,
      onlineCount: rooms.get(l.id)?.users.size ?? 0,
      locked: false,
    }));

    // Active user-created rooms (non-lobby)
    const lobbyIds = new Set(lobbyList.map(l => l.id));
    const roomList = await prisma.room.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, locked: true, lobbyId: true, _count: { select: { members: true } } },
      take: 100,
    });
    const roomOut = roomList
      .filter(r => !r.id.includes("%") && !lobbyIds.has(r.id))
      .map(r => ({
        id: r.id, roomId: r.id, name: r.name || r.id,
        onlineCount: rooms.get(r.id)?.users.size ?? 0,
        locked: Boolean(r.locked), pinned: false,
        lobbyId: r.lobbyId ?? null,
      }));

    return { ok: true, rooms: [...lobbyOut, ...roomOut] };
  });

  app.post("/rooms", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    const body: any = (req as any).body || {};
    const name = (typeof body.name === "string" ? body.name : "").trim().slice(0, 64);
    const lobbyId = typeof body.lobbyId === "string" ? body.lobbyId.trim() : null;

    if (!name) return reply.code(400).send({ ok: false, error: "name_required" });
    if (!lobbyId) return reply.code(400).send({ ok: false, error: "lobbyId_required" });

    // Verify lobby exists
    const lobby = await prisma.lobby.findUnique({ where: { id: lobbyId } });
    if (!lobby) return reply.code(404).send({ ok: false, error: "lobby_not_found" });

    // Enforce unique name within lobby
    const existing = await prisma.room.findFirst({ where: { lobbyId, name: { equals: name, mode: "insensitive" } } });
    if (existing) return reply.code(409).send({ ok: false, error: "room_name_taken", message: `A room named "${name}" already exists in this lobby.` });

    let wanted = (typeof body.roomId === "string" ? body.roomId : "").trim();
    if (wanted) wanted = wanted.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
    let id = wanted || shortRoomId(6);
    let tries = 0;
    while (tries < 10) {
      const exists = await prisma.room.findUnique({ where: { id } });
      if (!exists) break;
      id = shortRoomId(6); tries++;
    }

    const ownerId = u?.id ?? null;
    await prisma.room.create({ data: { id, name, locked: false, ownerId, lobbyId } });

    // Make creator the owner in RoomMember
    if (ownerId) {
      await prisma.roomMember.upsert({
        where: { roomId_userId: { roomId: id, userId: ownerId } },
        update: { role: RoomRole.OWNER },
        create: { roomId: id, userId: ownerId, name: u?.name ?? "", role: RoomRole.OWNER },
      });
    }

    const r = await ensureRoomLoaded(id);
    r.name = name;
    if (ownerId) r.ownerId = ownerId;
    rooms.set(id, r);
    return reply.send({ ok: true, id, roomId: id, room: { id, roomId: id, name, locked: false, lobbyId } });
  });

  app.get("/rooms/:roomId", async (req, reply) => {
    const roomId = String((req as any).params?.roomId || "");
    const r = await prisma.room.findUnique({ where: { id: roomId } });
    if (!r) return reply.code(404).send({ ok: false, error: "not_found" });
    return reply.send({ ok: true, room: { id: r.id, roomId: r.id, name: r.name || r.id, locked: Boolean(r.locked) } });
  });

  // ── Staff API ───────────────────────────────────────────────────────────────

  // GET /staff/me
  app.get("/staff/me", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    return reply.send({ ok: true, globalRole: role });
  });

  // GET /staff/users?q=
  app.get("/staff/users", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const q = String((req as any).query?.q || "").trim().toLowerCase();
    const users = await prisma.user.findMany({
      where: q ? { OR: [{ usernameKey: { contains: q } }, { name: { contains: q, mode: "insensitive" } }] } : {},
      select: { id: true, name: true, usernameKey: true, globalRole: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return reply.send({ ok: true, users });
  });

  // POST /staff/users/:userId/role
  app.post("/staff/users/:userId/role", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const actorRole = await getGlobalRole(u.id);
    if (!canAssignRoles(actorRole)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const targetId = String((req as any).params?.userId || "");
    const body: any = (req as any).body || {};
    const newRole = String(body.role || "USER").toUpperCase() as GlobalRole;
    if (!Object.values(GlobalRole).includes(newRole)) return reply.code(400).send({ ok: false, error: "invalid_role" });
    if (actorRole !== GlobalRole.GOD && (newRole === GlobalRole.STAFF || newRole === GlobalRole.GOD)) {
      return reply.code(403).send({ ok: false, error: "insufficient_rank" });
    }
    const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, name: true, globalRole: true } });
    if (!target) return reply.code(404).send({ ok: false, error: "user_not_found" });
    if (target.globalRole === GlobalRole.GOD && actorRole !== GlobalRole.GOD) {
      return reply.code(403).send({ ok: false, error: "cannot_modify_god" });
    }
    await prisma.user.update({ where: { id: targetId }, data: { globalRole: newRole } });
    await globalAudit(u.id, u.name, "role_change", targetId, target.name, { from: target.globalRole, to: newRole });
    return reply.send({ ok: true, userId: targetId, globalRole: newRole });
  });

  // POST /staff/users/:userId/note
  app.post("/staff/users/:userId/note", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const targetId = String((req as any).params?.userId || "");
    const body: any = (req as any).body || {};
    const text = String(body.body || "").trim().slice(0, 2000);
    if (!text) return reply.code(400).send({ ok: false, error: "empty_note" });
    const target = await prisma.user.findUnique({ where: { id: targetId }, select: { name: true } });
    if (!target) return reply.code(404).send({ ok: false, error: "user_not_found" });
    const note = await prisma.staffNote.create({
      data: { targetId, authorId: u.id, authorName: u.name, body: text },
    });
    await globalAudit(u.id, u.name, "staff_note", targetId, target.name, { noteId: note.id });
    return reply.send({ ok: true, note });
  });

  // GET /staff/users/:userId/notes
  app.get("/staff/users/:userId/notes", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const targetId = String((req as any).params?.userId || "");
    const notes = await prisma.staffNote.findMany({
      where: { targetId }, orderBy: { createdAt: "desc" }, take: 50,
    });
    return reply.send({ ok: true, notes });
  });

  // GET /staff/audit
  app.get("/staff/audit", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const logs = await prisma.globalAudit.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    return reply.send({ ok: true, logs });
  });
// POST /staff/lobby/lock — lock lobby chat (SUPPORT+)
app.post("/staff/lobby/lock", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const lid = String((req.body as any)?.lobbyId || "lobby");
    const room = rooms.get(lid);
    if (room) room.locked = true;
    await globalAudit(u.id, u.name, "lobby_lock", lid);
    if (room) broadcast(room, { type: "room:locked", roomId: lid });
    return reply.send({ ok: true });
  });

  // POST /staff/lobby/unlock — unlock lobby chat (SUPPORT+)
app.post("/staff/lobby/unlock", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const lid = String((req.body as any)?.lobbyId || "lobby");
    const room = rooms.get(lid);
    if (room) room.locked = false;
    await globalAudit(u.id, u.name, "lobby_unlock", lid);
    if (room) broadcast(room, { type: "room:unlocked", roomId: lid });
    return reply.send({ ok: true });
  });

  // POST /staff/lobby/clear-chat — clear lobby messages (STAFF+)
app.post("/staff/lobby/clear-chat", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const lid = String((req.body as any)?.lobbyId || "lobby");
    const room = rooms.get(lid);
    if (room) room.msgs = []; // clear in-memory so rejoining clients get empty history
    await prisma.lobbyMessage.deleteMany({ where: { lobbyId: lid } });
    await globalAudit(u.id, u.name, "lobby_clear_chat", lid);
    if (room) broadcast(room, { type: "chat:cleared", roomId: lid });
    return reply.send({ ok: true });
  });

  // POST /staff/room/clear-chat — clear room messages (room owner/mod or STAFF+)
  app.post("/staff/room/clear-chat", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const rid = String((req.body as any)?.roomId || "");
    if (!rid) return reply.code(400).send({ ok: false, error: "roomId required" });
    const globalRole = await getGlobalRole(u.id);
    const room = rooms.get(rid);
    if (!room) return reply.code(404).send({ ok: false, error: "room not found" });
    if (!isModOrOwner(room, u.id, globalRole)) return reply.code(403).send({ ok: false, error: "forbidden" });
    // Clear in-memory msgs
    room.msgs = [];
    // Clear persisted messages
    await prisma.roomMessage.deleteMany({ where: { roomId: rid } });
    audit(room, { type: "chat_clear", actorId: u.id, actorName: u.name });
    broadcast(room, { type: "chat:cleared", roomId: rid });
    return reply.send({ ok: true });
  });
  // POST /staff/users/:userId/kick
  app.post("/staff/users/:userId/kick", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const targetId = String((req as any).params?.userId || "");
    if (targetId === u.id) return reply.code(400).send({ ok: false, error: "cannot_kick_self" });
    const target = await prisma.user.findUnique({ where: { id: targetId }, select: { name: true, globalRole: true } });
    if (!target) return reply.code(404).send({ ok: false, error: "user_not_found" });
    if (target.globalRole === GlobalRole.GOD) return reply.code(403).send({ ok: false, error: "cannot_kick_god" });
    for (const room of rooms.values()) {
      if (room.users.has(targetId) || room.mods.has(targetId)) {
        room.users.delete(targetId);
        room.mods.delete(targetId);
        for (const s of findSocketsByUser(room, targetId)) {
          send(s, { type: "staff:kicked", roomId: room.roomId });
          try { (s as any).close(4001, "staff:kick"); } catch {}
        }
        broadcast(room, { type: "presence:leave", roomId: room.roomId, userId: targetId });
        publishState(room);
      }
    }
    await globalAudit(u.id, u.name, "global_kick", targetId, target.name);
    return reply.send({ ok: true });
  });

  // ── Start HTTP ────────────────────────────────────────────────────────────────

  await 
    app.get("/staff/rooms", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const list = await prisma.room.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, locked: true, createdAt: true, _count: { select: { members: true } } },
    });

    const rooms = list.map(r => ({
      id: r.id, name: r.name || "", locked: Boolean(r.locked),
      members: r._count.members, createdAt: r.createdAt.toISOString(),
    }));

    return reply.send({ ok: true, rooms });
  });
  app.get("/profile/:userId", async (req, reply) => {
    const { userId } = req.params as any;
    if (!userId) return reply.code(400).send({ error: "Missing userId" });

    const authHeader = (req.headers as any).authorization;
    const viewer = authFromHeader(authHeader);

    try {
      const isId = userId.length > 20 && !userId.includes(" ");
      const u = await prisma.user.findFirst({
        where: isId
          ? { id: userId }
          : { OR: [{ usernameKey: userId.toLowerCase() }, { name: userId }] },
        select: {
          id: true,
          name: true,
          bio: true,
          notoriety: true,
          tier: true,
          globalRole: true,
          createdAt: true,
          updatedAt: true,
          avatar: true,
          avatarColor: true,
        },
      });

      if (!u) return reply.code(404).send({ error: "User not found" });

      // Count rooms hosted (owned)
      const roomsHosted = await prisma.room.count({ where: { ownerId: u.id } });

      return reply.send({
        id: u.id,
        name: u.name,
        bio: u.bio || "",
        notoriety: u.notoriety ?? 0,
        tier: u.tier ?? "INNOCENT",
        globalRole: String(u.globalRole ?? "USER"),
        joinedAt: u.createdAt.toISOString(),
        lastSeen: u.updatedAt.toISOString(),
        roomsHosted,
        avatar: u.avatar || null,
        avatarColor: u.avatarColor || null,
      });
    } catch (e) {
      console.error("[profile GET]", e);
      return reply.code(500).send({ error: "Server error" });
    }
  });

  // PATCH /profile/me  — update own bio / avatarColor
  app.patch("/profile/me", async (req, reply) => {
    const authHeader = (req.headers as any).authorization;
    const viewer = authFromHeader(authHeader);
    if (!viewer) return reply.code(401).send({ error: "Unauthorized" });

    const body: any = (req as any).body || {};
    const bio = typeof body.bio === "string" ? body.bio.trim().slice(0, 280) : undefined;
    const avatarColor = typeof body.avatarColor === "string" ? body.avatarColor.slice(0, 20) : undefined;
    const avatar = typeof body.avatar === "string" ? body.avatar.slice(0, 500) : undefined;
    if (bio === undefined && avatarColor === undefined && avatar === undefined) return reply.code(400).send({ error: "Nothing to update" });

    try {
      const u = await prisma.user.update({
        where: { id: viewer.id },
        data: { ...(bio !== undefined && { bio }), ...(avatarColor !== undefined && { avatarColor }), ...(avatar !== undefined && { avatar: avatar || null }) },
        select: { id: true, bio: true },
      });

      // Award notoriety for completing bio (one-time)
      if (bio !== undefined && bio.length >= 10) {
        await awardNotoriety(viewer.id, "BIO_COMPLETE");
      }

      // If avatarColor or avatar changed, update all live sockets for this user and re-broadcast
      // presence in every room they're in so other clients see the change instantly
      if (avatarColor !== undefined || avatar !== undefined) {
        for (const sock of wss.clients) {
          const s = sock as Sock;
          if (s.user?.id === viewer.id) {
            if (avatarColor !== undefined) s.user.avatarColor = avatarColor;
            if (avatar !== undefined) s.user.avatar = avatar || undefined;
            if (s.roomId) {
              const room = rooms.get(s.roomId);
              if (room) {
                const entry = room.users.get(viewer.id);
                if (entry) {
                  if (avatarColor !== undefined) (entry as any).avatarColor = avatarColor;
                  if (avatar !== undefined) (entry as any).avatar = avatar || undefined;
                }
                publishState(room);
              }
            }
          }
        }
      }

      return reply.send({ ok: true, bio: u.bio });
    } catch (e) {
      console.error("[profile PATCH]", e);
      return reply.code(500).send({ error: "Server error" });
    }
  });
  // DELETE /staff/rooms/:roomId — STAFF+ can delete rooms
  app.delete("/staff/rooms/:roomId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const roomId = String((req as any).params?.roomId || "");
    if (!roomId || roomId === "lobby") return reply.code(400).send({ ok: false, error: "invalid_room" });

    const room = await prisma.room.findUnique({ where: { id: roomId }, select: { name: true } });
    if (!room) return reply.code(404).send({ ok: false, error: "not_found" });

    // Kick anyone currently in the room
    const liveRoom = rooms.get(roomId);
    if (liveRoom) {
      for (const s of liveRoom.sockets) {
        send(s, { type: "room:deleted", roomId });
        try { (s as any).close(4000, "room:deleted"); } catch {}
      }
      rooms.delete(roomId);
    }

    await prisma.room.delete({ where: { id: roomId } });
    await globalAudit(u.id, u.name, "room_delete", roomId, room.name || roomId);

    return reply.send({ ok: true });
  });


// ── Invites ──────────────────────────────────────────────────────────────────

  // POST /invites — create an invite link
  app.post("/invites", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const body: any = (req.body as any) || {};
    const type     = String(body.type || "PLATFORM").toUpperCase();
    const targetId = body.targetId ? String(body.targetId) : null;
    const maxUses  = Math.min(Math.max(Number(body.maxUses) || 1, 1), 100);
    const note     = body.note ? String(body.note).slice(0, 200) : null;
    const ttlHours = Number(body.ttlHours) || 0;
    const expiresAt = ttlHours > 0 ? new Date(Date.now() + ttlHours * 3600 * 1000) : null;
    const validTypes = ["PLATFORM", "ROOM", "LOBBY", "CREW"];
    if (!validTypes.includes(type)) return reply.code(400).send({ ok: false, error: "invalid_type" });
    const invite = await prisma.invite.create({
      data: { type: type as any, targetId, createdBy: u.id, note, maxUses, expiresAt },
    });
    return reply.send({ ok: true, invite: { token: invite.token, type: invite.type, targetId: invite.targetId, maxUses, expiresAt, url: `${WEB_URL}/invite/${invite.token}` } });
  });

  // GET /invites/mine — list my created invites
  app.get("/invites/mine", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const invites = await prisma.invite.findMany({
      where: { createdBy: u.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return reply.send({ ok: true, invites: invites.map((i: { token: any; }) => ({ ...i, url: `${WEB_URL}/invite/${i.token}` })) });
  });

  // GET /invites/:token — resolve invite (public)
  app.get("/invites/:token", async (req, reply) => {
    const token = String((req as any).params?.token || "");
    const invite = await prisma.invite.findUnique({ where: { token } });
    if (!invite) return reply.code(404).send({ ok: false, error: "not_found" });
    if (invite.expiresAt && invite.expiresAt < new Date()) return reply.code(410).send({ ok: false, error: "expired" });
    if (invite.uses >= invite.maxUses) return reply.code(410).send({ ok: false, error: "exhausted" });
    // Resolve target name
    let targetName = "";
    if (invite.targetId) {
      if (invite.type === "ROOM") {
        const r = await prisma.room.findUnique({ where: { id: invite.targetId }, select: { name: true } }).catch(() => null);
        targetName = r?.name || invite.targetId;
      } else if (invite.type === "LOBBY") {
        const l = await prisma.lobby.findUnique({ where: { id: invite.targetId }, select: { name: true } }).catch(() => null);
        targetName = l?.name || invite.targetId;
      } else if (invite.type === "CREW") {
        const c = await prisma.crew.findUnique({ where: { id: invite.targetId }, select: { name: true, tag: true } }).catch(() => null);
        targetName = c ? `${c.name} [${c.tag}]` : invite.targetId;
      }
    }
    const creator = await prisma.user.findUnique({ where: { id: invite.createdBy }, select: { name: true, usernameKey: true } }).catch(() => null);
    return reply.send({ ok: true, invite: { ...invite, targetName, creatorName: creator?.name || creator?.usernameKey || "unknown" } });
  });

  // POST /invites/:token/accept — accept invite
  app.post("/invites/:token/accept", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const token = String((req as any).params?.token || "");
    const invite = await prisma.invite.findUnique({ where: { token } });
    if (!invite) return reply.code(404).send({ ok: false, error: "not_found" });
    if (invite.expiresAt && invite.expiresAt < new Date()) return reply.code(410).send({ ok: false, error: "expired" });
    if (invite.uses >= invite.maxUses) return reply.code(410).send({ ok: false, error: "exhausted" });

    // Increment uses
    await prisma.invite.update({ where: { token }, data: { uses: { increment: 1 } } });

    // Perform join action
    let redirect = "/lobby";
    if (invite.type === "ROOM" && invite.targetId) {
      // Add as room member
      await prisma.roomMember.upsert({
        where: { roomId_userId: { roomId: invite.targetId, userId: u.id } },
        create: { roomId: invite.targetId, userId: u.id, name: u.name, role: "MEMBER" },
        update: {},
      }).catch(() => {});
      redirect = `/room/${encodeURIComponent(invite.targetId)}`;
    } else if (invite.type === "LOBBY" && invite.targetId) {
      await prisma.lobbyMember.upsert({
        where: { lobbyId_userId: { lobbyId: invite.targetId, userId: u.id } },
        create: { lobbyId: invite.targetId, userId: u.id, name: u.name, role: "MEMBER" },
        update: {},
      }).catch(() => {});
      redirect = `/lobby/${encodeURIComponent(invite.targetId)}`;
    } else if (invite.type === "CREW" && invite.targetId) {
      await prisma.crewMember.upsert({
        where: { crewId_userId: { crewId: invite.targetId, userId: u.id } },
        create: { crewId: invite.targetId, userId: u.id, name: u.name, role: "MEMBER" },
        update: {},
      }).catch(() => {});
      redirect = "/lobby";
    }

    // Send DM notification to invite creator
    if (invite.createdBy !== u.id) {
      const msg = invite.type === "PLATFORM"
        ? `${u.name} joined Weered using your invite!`
        : `${u.name} joined via your ${invite.type.toLowerCase()} invite${invite.targetId ? ` (${invite.targetId})` : ""}.`;
      await prisma.directMessage.create({
        data: { fromId: u.id, toId: invite.createdBy, body: msg },
      }).catch(() => {});
    }

    return reply.send({ ok: true, redirect, type: invite.type, targetId: invite.targetId });
  });

  // POST /invites/send — send invite to a user by username (creates invite + DM)
  app.post("/invites/send", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const body: any = (req.body as any) || {};
    const username = String(body.username || "").toLowerCase().trim();
    const type     = String(body.type || "PLATFORM").toUpperCase();
    const targetId = body.targetId ? String(body.targetId) : null;
    if (!username) return reply.code(400).send({ ok: false, error: "username_required" });
    const target = await prisma.user.findFirst({ where: { OR: [{ usernameKey: username }, { name: { equals: username, mode: "insensitive" } }] }, select: { id: true, name: true } });
    if (!target) return reply.code(404).send({ ok: false, error: "user_not_found" });
    if (target.id === u.id) return reply.code(400).send({ ok: false, error: "cannot_invite_self" });
    // Create single-use invite
    const invite = await prisma.invite.create({
      data: { type: type as any, targetId, createdBy: u.id, maxUses: 1, expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000) },
    });
    const inviteUrl = `${WEB_URL}/invite/${invite.token}`;
    const msg = type === "PLATFORM"
      ? `${u.name} invited you to join Weered! ${inviteUrl}`
      : `${u.name} invited you to join a ${type.toLowerCase()}. ${inviteUrl}`;
    await prisma.directMessage.create({ data: { fromId: u.id, toId: target.id, body: msg } });
    return reply.send({ ok: true, token: invite.token, url: inviteUrl, sentTo: target.name });
  });

  // DELETE /invites/:token — revoke invite
  app.delete("/invites/:token", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const token = String((req as any).params?.token || "");
    const invite = await prisma.invite.findUnique({ where: { token } });
    if (!invite) return reply.code(404).send({ ok: false, error: "not_found" });
    const role = await getGlobalRole(u.id);
    if (invite.createdBy !== u.id && !canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    await prisma.invite.delete({ where: { token } });
    return reply.send({ ok: true });
  });

 "dotenv/config";
  // ── DM Routes ──────────────────────────────────────────────────────────────

  // GET /dm/conversations — all peers with message history
  app.get("/dm/conversations", async (req, reply) => {
    const viewer = authFromHeader((req.headers as any).authorization);
    if (!viewer) return reply.code(401).send({ error: "Unauthorized" });
    const msgs = await prisma.directMessage.findMany({
      where: { OR: [{ fromId: viewer.id }, { toId: viewer.id }] },
      orderBy: { createdAt: "desc" },
      select: { fromId: true, toId: true, body: true, createdAt: true, readAt: true },
    });
    const peers = new Map<string, any>();
    for (const m of msgs) {
      const peerId = m.fromId === viewer.id ? m.toId : m.fromId;
      if (!peers.has(peerId)) peers.set(peerId, { peerId, lastMessage: m.body, lastAt: m.createdAt, unread: 0 });
      if (m.toId === viewer.id && !m.readAt) peers.get(peerId).unread++;
    }
    const peerIds = Array.from(peers.keys());
    const users = await prisma.user.findMany({ where: { id: { in: peerIds } }, select: { id: true, name: true, usernameKey: true } });
    const result = users.map(u => ({ ...u, ...peers.get(u.id) }));
    return reply.send({ ok: true, conversations: result });
  });

  // GET /dm/unread — unread counts per peer
  app.get("/dm/unread", async (req, reply) => {
    const viewer = authFromHeader((req.headers as any).authorization);
    if (!viewer) return reply.code(401).send({ error: "Unauthorized" });
    try {
      const unread = await prisma.directMessage.groupBy({
        by: ["fromId"],
        where: { toId: viewer.id, readAt: null },
        _count: { id: true },
      });
      const counts: Record<string, number> = {};
      for (const row of unread) counts[row.fromId] = row._count.id;
      return reply.send({ counts });
    } catch (e) {
      console.error("[dm/unread]", e);
      return reply.code(500).send({ error: "Server error" });
    }
  });

  // GET /dm/:peerId — fetch thread history (last 50, oldest first)
app.get("/dm/:peerId", async (req, reply) => {
    const viewer = authFromHeader((req.headers as any).authorization);
    if (!viewer) return reply.code(401).send({ error: "Unauthorized" });
    const { peerId: rawPeerId } = req.params as any;
    if (!rawPeerId) return reply.code(400).send({ error: "Missing peerId" });
    const peerId = await resolveUserId(rawPeerId);
    try {
      const messages = await prisma.directMessage.findMany({
        where: { OR: [{ fromId: viewer.id, toId: peerId }, { fromId: peerId, toId: viewer.id }] },
        orderBy: { createdAt: "asc" },
        take: 50,
        select: { id: true, fromId: true, toId: true, body: true, createdAt: true, readAt: true },
      });
      await prisma.directMessage.updateMany({
        where: { fromId: peerId, toId: viewer.id, readAt: null },
        data: { readAt: new Date() },
      });
      return reply.send({ messages: messages.map(m => ({ ...m, createdAt: m.createdAt.toISOString(), readAt: m.readAt?.toISOString() ?? null })) });
    } catch (e) {
      console.error("[dm GET]", e);
      return reply.code(500).send({ error: "Server error" });
    }
  });

  // POST /dm/:peerId — send a DM (REST fallback)
app.post("/dm/:peerId", async (req, reply) => {
    const viewer = authFromHeader((req.headers as any).authorization);
    if (!viewer) return reply.code(401).send({ error: "Unauthorized" });
    const { peerId: rawPeerId } = req.params as any;
    const peerId = await resolveUserId(rawPeerId);
    const body: any = (req as any).body || {};
    const text = typeof body.body === "string" ? body.body.trim().slice(0, 2000) : "";
    if (!text) return reply.code(400).send({ error: "Empty message" });
    try {
      const dm = await prisma.directMessage.create({
        data: { fromId: viewer.id, toId: peerId, body: text },
        select: { id: true, fromId: true, toId: true, body: true, createdAt: true },
      });
      const payload = { type: "dm:message", message: { ...dm, createdAt: dm.createdAt.toISOString() } };
      dmDeliver(peerId, payload);
      return reply.send({ ok: true, message: { ...dm, createdAt: dm.createdAt.toISOString() } });
    } catch (e) {
      console.error("[dm POST]", e);
      return reply.code(500).send({ error: "Server error" });
    }
  });

  // PATCH /dm/:peerId/read — mark thread as read
  app.patch("/dm/:peerId/read", async (req, reply) => {
    const viewer = authFromHeader((req.headers as any).authorization);
    if (!viewer) return reply.code(401).send({ error: "Unauthorized" });
    const { peerId } = req.params as any;
    try {
      await prisma.directMessage.updateMany({
        where: { fromId: peerId, toId: viewer.id, readAt: null },
        data: { readAt: new Date() },
      });
      return reply.send({ ok: true });
    } catch (e) {
      console.error("[dm/read PATCH]", e);
      return reply.code(500).send({ error: "Server error" });
    }
  });


  // ── Feed API ────────────────────────────────────────────────────────────────

  // GET /feed/hot — returns top 50 items sorted by heat
  app.get("/feed/hot", async (req, reply) => {
    const qs       = (req as any).query as any;
    const category = qs?.category && qs.category !== "all" ? String(qs.category) : undefined;
    const domain   = qs?.domain ? String(qs.domain) : undefined;
    const sort     = qs?.sort === "new" ? { postedAt: "desc" as const } : { heat: "desc" as const };
    const where: any = {};
    if (category) where.category = category;
    if (domain)   where.domain   = domain;
    const items    = await prisma.feedItem.findMany({
      where:   Object.keys(where).length ? where : undefined,
      orderBy: sort,
      take:    50,
    });
    return reply.send({ items, updatedAt: new Date().toISOString() });
  });

  // Run worker on startup then every 20 minutes
  runFeedWorker();
  setInterval(runFeedWorker, 20 * 60 * 1000);

  await seedLobbies();

  app.listen({ host: "0.0.0.0", port: HTTP_PORT });
  app.log.info(`HTTP listening at http://127.0.0.1:${HTTP_PORT}`);

  // ── WebSocket server ──────────────────────────────────────────────────────────

  wss = new WebSocketServer({ port: WS_PORT });
  app.log.info(`WS listening on ws://127.0.0.1:${WS_PORT}`);

  wss.on("connection", (rawWs) => {
    const ws = rawWs as Sock;

    ws.on("message", (raw) => {
      void (async () => {
        const msg = safeJson(raw);
        if (!msg || typeof msg.type !== "string") return;

        if (msg.type === "auth:hello") {
          const u = verifyToken(msg.token);
          if (!u) { send(ws, { type: "auth:fail", reason: "Invalid token" }); return; }
          ws.user = await hydrateGlobalRole(u);
          send(ws, { type: "auth:ok", user: { id: ws.user.id, name: ws.user.name, globalRole: ws.user.globalRole, avatarColor: ws.user.avatarColor, avatar: ws.user.avatar } });
          return;
        }

        if (!ws.user) { send(ws, { type: "auth:fail", reason: "Not authenticated" }); return; }


        // ── rooms:list — return lobby directory from DB ───────────────────
        if (msg.type === "rooms:list" || msg.type === "lobby:rooms" || msg.type === "room:list") {
          const [lobbyList, roomList] = await Promise.all([
            (prisma as any).lobby.findMany({
            where: { pinned: true },
            select: { id: true, name: true, description: true, verified: true, pinned: true, moduleType: true },
            }),
            prisma.room.findMany({
              orderBy: { updatedAt: "desc" },
              select: { id: true, name: true, locked: true, lobbyId: true, _count: { select: { members: true } } },
              take: 100,
            }),
          ]);
            const lobbyIds = new Set(lobbyList.map((l: any) => l.id));
            const lobbyOut = lobbyList.map((l: any) => ({
            id: l.id, roomId: l.id, name: l.name, description: l.description,
            verified: l.verified, pinned: true, moduleType: l.moduleType,
            onlineCount: rooms.get(l.id)?.users.size ?? 0, locked: false,
          }));
          const roomOut = roomList
            .filter(r => !r.id.includes("%") && !lobbyIds.has(r.id))
            .map(r => ({
              id: r.id, roomId: r.id, name: r.name || r.id,
              onlineCount: rooms.get(r.id)?.users.size ?? 0,
              locked: Boolean(r.locked), pinned: false, lobbyId: r.lobbyId ?? null,
            }));
          send(ws, { type: "rooms", rooms: [...lobbyOut, ...roomOut] });
          return;
        }

        if (msg.type === "presence:join") {
          const roomId = normalizeRoomId(String(msg.roomId || ""));
          if (!roomId) return;
          const room = await ensureRoomLoaded(roomId);
          if (room.banned.has(ws.user.id)) { send(ws, { type: "room:banned", roomId }); return; }
          const uid = ws.user.id;
          const isLobby = String(roomId || "").startsWith("lobby:");
          if (isLobby) room.locked = false;
          if (room.locked && !isLobby && !isModOrOwner(room, uid, ws.user?.globalRole)) {
            if (!room.knocks.some((k) => k.userId === uid)) {
              room.knocks.push({ userId: uid, name: ws.user.name, ts: Date.now() });
              if (room.knocks.length > 200) room.knocks.splice(0, room.knocks.length - 200);
            }
            let p = room.pending.get(uid);
            if (!p) { p = new Set<Sock>(); room.pending.set(uid, p); }
            p.add(ws);
            ws.pendingRoomId = roomId;
            send(ws, { type: "room:knock:queued", roomId });
            for (const s of room.sockets) {
              const sid = s.user?.id;
              if (!sid || !isModOrOwner(room, sid)) continue;
              send(s, { type: "room:knock", roomId, user: { id: uid, name: ws.user.name } });
            }
            publishState(room);
            return;
          }
          await doJoin(ws, roomId);
          return;
        }

        if (msg.type === "presence:leave") {
          if (ws.pendingRoomId) {
            const rid = ws.pendingRoomId;
            const r = rooms.get(rid);
            if (r) {
              const set = r.pending.get(ws.user.id);
              if (set) set.delete(ws);
              if (set && set.size === 0) r.pending.delete(ws.user.id);
              ws.pendingRoomId = undefined;
              publishState(r);
            }
            return;
          }
          // Only leave if the roomId in the message matches where this socket currently is.
          // Stale presence:leave messages (sent by client after navigating away) must not
          // kick the socket out of the room it has already joined.
          const leaveRid = normalizeRoomId(String(msg.roomId || ""));
          if (leaveRid && ws.roomId && leaveRid !== ws.roomId) return;
          leaveRoom(ws);
          return;
        }

        if (msg.type === "chat:send") {
          const roomId = normalizeRoomId(String(msg.roomId || ""));
          const body = String(msg.body || "").trim();
          if (!roomId || !body) return;
          const room = await ensureRoomLoaded(roomId);
          if (!room.users.has(ws.user.id)) return;
          if (room.banned.has(ws.user.id)) return;
          if (room.muted.has(ws.user.id)) return;
          const u = room.users.get(ws.user.id)!;
          const m: ChatMsg = { id: randomUUID(), user: { id: u.id, name: u.name, role: roleOf(room, u.id), avatarColor: (u as any).avatarColor, avatar: (u as any).avatar }, body, ts: Date.now() };
          room.msgs.push(m);
          if (room.msgs.length > 200) room.msgs.splice(0, room.msgs.length - 200);
          if (room.roomId !== "lobby") {
            void prisma.roomMessage.create({
              data: { id: m.id, roomId: room.roomId, userId: m.user.id, userName: m.user.name, body: m.body, ts: new Date(m.ts) },
            }).catch(() => {});
          }
          broadcast(room, { type: "chat:new", roomId, msg: m });
          return;
        }

        const roomId = normalizeRoomId(String(msg.roomId || ws.roomId || ws.pendingRoomId || ""));
        if (!roomId) return;
        const room = await ensureRoomLoaded(roomId);

        const actorId = ws.user.id;
        const actorName = ws.user.name;
        const actorGlobalRole = ws.user.globalRole || "USER";
        const actorIsMod = isModOrOwner(room, actorId, actorGlobalRole);
        const actorIsOwner = isOwner(room, actorId) || isElevatedGlobal(actorGlobalRole);

        if (msg.type === "room:getAdminState") {
          // Allow any user to request presence state; admin state only goes to mods
          publishState(room);
          return;
        }

        if (msg.type === "room:rename") {
          if (!actorIsMod) return;
          const nextName = String(msg.name || "").trim().slice(0, 64);
          if (!nextName) return;
          room.name = nextName;
          await persistRoomBasics(room);
          audit(room, { type: "room:rename", actorId, actorName, note: nextName });
          publishState(room);
          broadcast(room, { type: "room:renamed", roomId, name: room.name });
          return;
        }

        if (msg.type === "room:lock") {
          if (!actorIsMod) return;
          room.locked = true;
          await persistRoomBasics(room);
          audit(room, { type: "room:lock", actorId, actorName });
          publishState(room);
          broadcast(room, { type: "room:locked", roomId, locked: true });
          return;
        }

        if (msg.type === "room:unlock") {
          if (!actorIsMod) return;
          room.locked = false;
          await persistRoomBasics(room);
          audit(room, { type: "room:unlock", actorId, actorName });
          publishState(room);
          broadcast(room, { type: "room:locked", roomId, locked: false });
          return;
        }

        if (msg.type === "room:admit") {
          if (!actorIsMod) return;
          const targetId = String(msg.userId || "");
          if (!targetId) return;
          removeKnock(room, targetId);
          const set = room.pending.get(targetId);
          if (set && set.size) {
            for (const s of set) {
              if (!s.user || s.user.id !== targetId) continue;
              await doJoin(s, roomId);
              send(s, { type: "room:admitted", roomId });
            }
          }
          removePending(room, targetId);
          audit(room, { type: "room:admit", actorId, actorName, targetId });
          publishState(room);
          return;
        }

        if (msg.type === "room:deny") {
          if (!actorIsMod) return;
          const targetId = String(msg.userId || "");
          if (!targetId) return;
          removeKnock(room, targetId);
          const set = room.pending.get(targetId);
          if (set && set.size) {
            for (const s of set) { send(s, { type: "room:denied", roomId }); try { s.pendingRoomId = undefined; } catch {} }
          }
          removePending(room, targetId);
          audit(room, { type: "room:deny", actorId, actorName, targetId });
          publishState(room);
          return;
        }

        if (msg.type === "staff:kick") {
          const kickActorId = ws.user?.id || "";
          const kickActorName = ws.user?.name || "staff";
          if (!kickActorId) return;
          const kickRole = await getGlobalRole(kickActorId);
          if (!canAccessStaff(kickRole)) return;
          const targetId = String(msg.userId || "");
          if (!targetId || targetId === kickActorId) return;
          for (const r of rooms.values()) {
            if (r.users.has(targetId) || r.mods.has(targetId)) {
              r.users.delete(targetId);
              r.mods.delete(targetId);
              try {
                for (const s of findSocketsByUser(r, targetId)) {
                  send(s, { type: "staff:kicked", roomId: r.roomId });
                  try { (s as any).roomId = undefined; } catch {}
                  try { (s as any).pendingRoomId = undefined; } catch {}
                  try { (s as any).close(4001, "staff:kick"); } catch {}
                }
              } catch {}
              broadcast(r, { type: "presence:leave", roomId: r.roomId, userId: targetId });
              audit(r, { type: "staff:kick", actorId: kickActorId, actorName: kickActorName, targetId });
              publishState(r);
            }
          }
          try {
            for (const c of wss.clients) {
              const s = c as any;
              if (s?.user?.id && String(s.user.id) === targetId) {
                send(s, { type: "staff:kicked" });
                try { s.close(4001, "staff:kick"); } catch {}
              }
            }
          } catch {}
          return;
        }

        if (msg.type === "mod:mute") {
          if (!actorIsMod) return;
          const targetId = String(msg.userId || "");
          if (!targetId || isOwner(room, targetId)) return;
          room.muted.add(targetId);
          for (const s of findSocketsByUser(room, targetId)) send(s, { type: "mod:muted", roomId });
          audit(room, { type: "mod:mute", actorId, actorName, targetId });
          publishState(room);
          return;
        }

        if (msg.type === "mod:unmute") {
          if (!actorIsMod) return;
          const targetId = String(msg.userId || "");
          if (!targetId) return;
          room.muted.delete(targetId);
          for (const s of findSocketsByUser(room, targetId)) send(s, { type: "mod:unmuted", roomId });
          audit(room, { type: "mod:unmute", actorId, actorName, targetId });
          publishState(room);
          return;
        }

        if (msg.type === "mod:kick") {
          if (!actorIsMod) return;
          const targetId = String(msg.userId || "");
          if (!targetId || isOwner(room, targetId)) return;
          room.users.delete(targetId);
          room.mods.delete(targetId);
          if (room.roomId !== "lobby") {
            void prisma.roomMember.updateMany({ where: { roomId: room.roomId, userId: targetId }, data: { role: RoomRole.MEMBER } }).catch(() => {});
          }
          for (const s of findSocketsByUser(room, targetId)) {
            send(s, { type: "mod:kicked", roomId });
            try { (s as any).roomId = undefined; } catch {}
          }
          broadcast(room, { type: "presence:leave", roomId, userId: targetId });
          audit(room, { type: "mod:kick", actorId, actorName, targetId });
          publishState(room);
          return;
        }

        if (msg.type === "mod:ban") {
          if (!actorIsMod) return;
          const targetId = String(msg.userId || "");
          if (!targetId || isOwner(room, targetId)) return;
          room.banned.add(targetId);
          room.users.delete(targetId);
          room.mods.delete(targetId);
          if (room.roomId !== "lobby") {
            void prisma.roomBan.upsert({
              where: { roomId_userId: { roomId: room.roomId, userId: targetId } },
              update: {}, create: { roomId: room.roomId, userId: targetId },
            }).catch(() => {});
          }
          for (const s of findSocketsByUser(room, targetId)) {
            send(s, { type: "mod:banned", roomId });
            try { (s as any).roomId = undefined; } catch {}
          }
          broadcast(room, { type: "presence:leave", roomId, userId: targetId });
          audit(room, { type: "mod:ban", actorId, actorName, targetId });
          publishState(room);
          return;
        }

        if (msg.type === "mod:unban") {
          if (!actorIsMod) return;
          const targetId = String(msg.userId || "");
          if (!targetId) return;
          room.banned.delete(targetId);
          if (room.roomId !== "lobby") {
            void prisma.roomBan.deleteMany({ where: { roomId: room.roomId, userId: targetId } }).catch(() => {});
          }
          audit(room, { type: "mod:unban", actorId, actorName, targetId });
          publishState(room);
          return;
        }

        if (msg.type === "mod:promote") {
          if (!actorIsOwner) return;
          const targetId = String(msg.userId || "");
          if (!targetId || isOwner(room, targetId)) return;
          room.mods.add(targetId);
          if (room.roomId !== "lobby") {
            void prisma.roomMember.upsert({
              where: { roomId_userId: { roomId: room.roomId, userId: targetId } },
              update: { role: RoomRole.MOD },
              create: { roomId: room.roomId, userId: targetId, name: "", role: RoomRole.MOD },
            }).catch(() => {});
          }
          audit(room, { type: "mod:promote", actorId, actorName, targetId });
          publishState(room);
          return;
        }

        if (msg.type === "mod:demote") {
          if (!actorIsOwner) return;
          const targetId = String(msg.userId || "");
          if (!targetId || isOwner(room, targetId)) return;
          room.mods.delete(targetId);
          if (room.roomId !== "lobby") {
            void prisma.roomMember.updateMany({ where: { roomId: room.roomId, userId: targetId }, data: { role: RoomRole.MEMBER } }).catch(() => {});
          }
          audit(room, { type: "mod:demote", actorId, actorName, targetId });
          publishState(room);
          return;
        }

        // ── YouTube / media sync ──────────────────────────────────────────────
        // Relay any youtube: message to every OTHER socket in the same room.
        // The client sends: { type: "youtube:load"|"youtube:sync"|"youtube:play"|"youtube:pause"|"youtube:stop", roomId, url?, ts?, playing? }
        if (msg.type === "youtube:load" || msg.type === "youtube:sync" ||
            msg.type === "youtube:play" || msg.type === "youtube:pause" || msg.type === "youtube:stop") {
          if (!room.users.has(ws.user.id)) return;
          for (const s of room.sockets) {
            if (s === ws) continue;
            send(s, { ...msg, roomId, _from: ws.user.id });
          }
          return;
        }

        // ── DM via WebSocket ──────────────────────────────────────────────────
        if (msg.type === "dm:send") {
          const rawToId = String(msg.toId  || "").trim();
          const body    = String(msg.body  || "").trim().slice(0, 2000);
          const fromId  = ws.user?.id;
          if (!fromId || !rawToId || !body) return;
          const toId = await resolveUserId(rawToId);
          try {
            const dm = await prisma.directMessage.create({
              data: { fromId, toId, body },
              select: { id: true, fromId: true, toId: true, body: true, createdAt: true },
            });
          const payload = { type: "dm:message", message: { ...dm, createdAt: dm.createdAt.toISOString() } };
          dmDeliver(toId, payload);
          } catch (e) { console.error("[dm:send]", e); }
          return;
        }

        if (msg.type === "dm:read") {
          const fromId = String(msg.fromId || "").trim();
          const toId   = ws.user?.id;
          if (!fromId || !toId) return;
          try {
            await prisma.directMessage.updateMany({
              where: { fromId, toId, readAt: null },
              data: { readAt: new Date() },
            });
            send(ws, { type: "dm:read:ack", fromId });
          } catch (e) { console.error("[dm:read]", e); }
          return;
        }
      })();
    });

    ws.on("close", () => {
      if (ws.pendingRoomId && ws.user) {
        const r = rooms.get(ws.pendingRoomId);
        if (r) {
          const set = r.pending.get(ws.user.id);
          if (set) set.delete(ws);
          if (set && set.size === 0) r.pending.delete(ws.user.id);
        }
      }
      leaveRoom(ws);
    });
  });

  // ── Friends ───────────────────────────────────────────────────────────────

  app.get("/friends", async (req, reply) => {
    const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
    const u = verifyToken(token);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const db = prisma as any;
    const links = await db.friendRequest.findMany({
      where: { status: "ACCEPTED", OR: [{ fromId: u.id }, { toId: u.id }] },
    });
    const peerIds = (links as any[]).map((l: any) => l.fromId === u.id ? l.toId : l.fromId);
    const profiles = peerIds.length
      ? await prisma.user.findMany({ where: { id: { in: peerIds } }, select: { id: true, name: true, avatarColor: true, avatar: true } })
      : [];
  const presenceMap = new Map<string, { roomId: string; roomName: string }>();
      for (const p of profiles) {
        for (const [rid, rs] of rooms) {
          if (rs.users.has(p.id)) { presenceMap.set(p.id, { roomId: rid, roomName: rs.name || rid }); break; }
        }
      }
      const activeRoomIds = [...new Set([...presenceMap.values()].map(v => v.roomId))];
      const lobbySet = activeRoomIds.length
        ? new Set((await prisma.lobby.findMany({ where: { id: { in: activeRoomIds } }, select: { id: true } })).map(l => l.id))
        : new Set<string>();
      const out = profiles.map(p => {
        const pres = presenceMap.get(p.id);
        const roomId = pres?.roomId ?? null;
        const roomName = pres?.roomName ?? null;
        return { ...p, online: roomId !== null, roomId, roomName, roomIsLobby: roomId ? lobbySet.has(roomId) : false };
      });
      return reply.send({ friends: out });
  });

  app.get("/friends/requests", async (req, reply) => {
    const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
    const u = verifyToken(token);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const db = prisma as any;
    const reqs = await db.friendRequest.findMany({ where: { toId: u.id, status: "PENDING" }, orderBy: { createdAt: "desc" } });
    const fromIds = (reqs as any[]).map((r: any) => r.fromId);
    const senders = fromIds.length ? await prisma.user.findMany({ where: { id: { in: fromIds } }, select: { id: true, name: true } }) : [];
    const senderMap = new Map(senders.map(s => [s.id, s.name]));
    return reply.send({ requests: (reqs as any[]).map((r: any) => ({ ...r, fromName: senderMap.get(r.fromId) ?? r.fromId })) });
  });

  app.post("/friends/request/:userId", async (req, reply) => {
    const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
    const u = verifyToken(token);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const toId = String((req.params as any).userId || "").trim();
    if (!toId || toId === u.id) return reply.code(400).send({ error: "Invalid target" });
    const target = await prisma.user.findUnique({ where: { id: toId }, select: { id: true } });
    if (!target) return reply.code(404).send({ error: "User not found" });
    const db = prisma as any;
    const fr = await db.friendRequest.upsert({
      where: { fromId_toId: { fromId: u.id, toId } },
      update: { status: "PENDING", updatedAt: new Date() },
      create: { fromId: u.id, toId, status: "PENDING" },
    });
    return reply.send({ ok: true, request: fr });
  });

  app.post("/friends/accept/:requestId", async (req, reply) => {
    const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
    const u = verifyToken(token);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const id = String((req.params as any).requestId || "").trim();
    const db = prisma as any;
    const fr = await db.friendRequest.findUnique({ where: { id } });
    if (!fr || fr.toId !== u.id) return reply.code(403).send({ error: "Not your request" });
    await db.friendRequest.update({ where: { id }, data: { status: "ACCEPTED" } });
    await db.friendRequest.upsert({
      where: { fromId_toId: { fromId: u.id, toId: fr.fromId } },
      update: { status: "ACCEPTED" },
      create: { fromId: u.id, toId: fr.fromId, status: "ACCEPTED" },
    });
    return reply.send({ ok: true });
  });

  app.post("/friends/decline/:requestId", async (req, reply) => {
    const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
    const u = verifyToken(token);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const id = String((req.params as any).requestId || "").trim();
    const db = prisma as any;
    const fr = await db.friendRequest.findUnique({ where: { id } });
    if (!fr || fr.toId !== u.id) return reply.code(403).send({ error: "Not your request" });
    await db.friendRequest.update({ where: { id }, data: { status: "DECLINED" } });
    return reply.send({ ok: true });
  });

  app.delete("/friends/:userId", async (req, reply) => {
    const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
    const u = verifyToken(token);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const peerId = String((req.params as any).userId || "").trim();
    const db = prisma as any;
    await db.friendRequest.deleteMany({ where: { OR: [{ fromId: u.id, toId: peerId }, { fromId: peerId, toId: u.id }] } });
    return reply.send({ ok: true });
  });

  // ── Crews / Dojo ──────────────────────────────────────────────────────────

  app.get("/crews/mine", async (req, reply) => {
    const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
    const u = verifyToken(token);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const db = prisma as any;
    const memberships = await db.crewMember.findMany({
      where: { userId: u.id },
      include: { crew: { include: { members: { select: { userId: true, name: true, role: true } } } } },
    });
    const crews = await Promise.all((memberships as any[]).map(async (m: any) => {
      // Hydrate avatars from User table
      const memberIds = (m.crew.members || []).map((cm: any) => cm.userId);
      const userAvatars = memberIds.length
        ? await prisma.user.findMany({ where: { id: { in: memberIds } }, select: { id: true, avatar: true, avatarColor: true } })
        : [];
      const avatarMap = new Map(userAvatars.map(u => [u.id, u]));

      const memberPresence = (m.crew.members || []).map((cm: any) => {
        let roomId: string | null = null; let roomName: string | null = null;
        for (const [rid, rs] of rooms) { if (rs.users.has(cm.userId)) { roomId = rid; roomName = rs.name || rid; break; } }
        const ua = avatarMap.get(cm.userId);
        return { userId: cm.userId, name: cm.name, role: cm.role, online: roomId !== null, roomId, roomName, avatar: ua?.avatar || null, avatarColor: ua?.avatarColor || null };
      });
      return { ...m.crew, myRole: m.role, members: memberPresence };
    }));
    return reply.send({ crews });
  });

  app.post("/crews", async (req, reply) => {
    const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
    const u = verifyToken(token);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const { name, tag, description } = req.body as any;
    if (!name?.trim()) return reply.code(400).send({ error: "Name required" });
    const db = prisma as any;
    const crew = await db.crew.create({
      data: {
        name: String(name).trim().slice(0, 40),
        tag: String(tag || "").trim().slice(0, 6).toUpperCase(),
        description: String(description || "").trim().slice(0, 200),
        ownerId: u.id,
        members: { create: { userId: u.id, name: u.name, role: "LEADER" } },
      },
      include: { members: true },
    });
    return reply.send({ ok: true, crew });
  });

  app.post("/crews/:crewId/invite/:userId", async (req, reply) => {
    const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
    const u = verifyToken(token);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const { crewId, userId } = req.params as any;
    const db = prisma as any;
    const myMembership = await db.crewMember.findUnique({ where: { crewId_userId: { crewId, userId: u.id } } });
    if (!myMembership || myMembership.role === "MEMBER") return reply.code(403).send({ error: "Not an officer" });
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
    if (!target) return reply.code(404).send({ error: "User not found" });
    await db.crewMember.upsert({
      where: { crewId_userId: { crewId, userId } },
      update: {},
      create: { crewId, userId, name: target.name, role: "MEMBER" },
    });
    return reply.send({ ok: true });
  });

  app.delete("/crews/:crewId/members/:userId", async (req, reply) => {
    const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
    const u = verifyToken(token);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const { crewId, userId } = req.params as any;
    const db = prisma as any;
    const crew = await db.crew.findUnique({ where: { id: crewId } });
    if (!crew) return reply.code(404).send({ error: "Crew not found" });
    const myMembership = await db.crewMember.findUnique({ where: { crewId_userId: { crewId, userId: u.id } } });
    const isSelf = userId === u.id;
    const isLeader = myMembership?.role === "LEADER" || crew.ownerId === u.id;
    if (!isSelf && !isLeader) return reply.code(403).send({ error: "Forbidden" });
    await db.crewMember.deleteMany({ where: { crewId, userId } });
    return reply.send({ ok: true });
  });

  app.delete("/crews/:crewId", async (req, reply) => {
    const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
    const u = verifyToken(token);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const { crewId } = req.params as any;
    const db = prisma as any;
    const crew = await db.crew.findUnique({ where: { id: crewId } });
    if (!crew || crew.ownerId !== u.id) return reply.code(403).send({ error: "Leader only" });
    await db.crew.delete({ where: { id: crewId } });
    return reply.send({ ok: true });
  });
// ── Lobby search ──────────────────────────────────────────────────────────

  app.get("/lobbies/search", async (req, reply) => {
    const q = String((req.query as any).q ?? "").trim().toLowerCase();
    if (!q || q.length < 2) return reply.send({ ok: true, pinned: [], rooms: [] });

    const [allPinned, matchingRooms] = await Promise.all([
      (prisma as any).lobby.findMany({
        where: { pinned: true },
        select: {
          id: true, name: true, description: true, verified: true,
          moduleType: true, moduleConfig: true, keywords: true,
          accentColor: true, logoUrl: true, bannerUrl: true, websiteUrl: true,
          _count: { select: { rooms: true, members: true } },
        },
        take: 100,
      }),
      (prisma as any).room.findMany({
        where: { name: { contains: q, mode: "insensitive" } },
        select: {
          id: true, name: true, locked: true, lobbyId: true,
          lobby: { select: { id: true, name: true, accentColor: true, logoUrl: true } },
          _count: { select: { members: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
    ]);

    const pinned = (allPinned as any[]).filter((l: any) => {
      const kws: string[] = Array.isArray(l.keywords) ? l.keywords : [];
      return l.name.toLowerCase().includes(q) ||
        kws.some((kw: string) => kw.toLowerCase().includes(q) || q.includes(kw.toLowerCase()));
    }); 

    return reply.send({ ok: true, pinned, rooms: matchingRooms });
  });

 app.get("/lobbies", async (_req, reply) => {
    const lobbies = await (prisma as any).lobby.findMany({
      select: {
        id: true, name: true, description: true, verified: true, pinned: true,
        moduleType: true, accentColor: true, logoUrl: true, bannerUrl: true,
        _count: { select: { rooms: true, members: true } },
      },
      orderBy: [{ pinned: "desc" }, { name: "asc" }],
    });
    return reply.send({ ok: true, lobbies });
  });

  app.get("/lobbies/:id", async (req, reply) => {
    const id = (req.params as any).id as string;
    const lobby = await (prisma as any).lobby.findUnique({
      where: { id },
      select: {
        id: true, name: true, description: true, verified: true, pinned: true,
        moduleType: true, moduleConfig: true, keywords: true,
        accentColor: true, logoUrl: true, bannerUrl: true, websiteUrl: true,
        rooms: {
          select: { id: true, name: true, locked: true, _count: { select: { members: true } } },
          orderBy: { name: "asc" },
        },
        _count: { select: { rooms: true, members: true } },
      },
    });
    if (!lobby) return reply.code(404).send({ ok: false, error: "not_found" });
    return reply.send({ ok: true, lobby });
  });

  app.post("/lobbies", async (req, reply) => {
    const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
    const u = verifyToken(token);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ error: "Staff only" });

    const { id, name, description = "", pinned = false, moduleType = "NONE",
            moduleConfig, keywords = [], accentColor, logoUrl, bannerUrl, websiteUrl } = req.body as any;
    if (!id || !name) return reply.code(400).send({ ok: false, error: "id and name required" });

    const lobby = await (prisma as any).lobby.upsert({
      where: { id: String(id) },
      update: { name: String(name), description: String(description), pinned: Boolean(pinned),
        moduleType, moduleConfig: moduleConfig ?? undefined,
        keywords: Array.isArray(keywords) ? keywords.map(String) : [],
        accentColor: accentColor ?? null, logoUrl: logoUrl ?? null,
        bannerUrl: bannerUrl ?? null, websiteUrl: websiteUrl ?? null },
      create: { id: String(id), name: String(name), description: String(description),
        pinned: Boolean(pinned), moduleType, moduleConfig: moduleConfig ?? undefined,
        keywords: Array.isArray(keywords) ? keywords.map(String) : [],
        accentColor: accentColor ?? null, logoUrl: logoUrl ?? null,
        bannerUrl: bannerUrl ?? null, websiteUrl: websiteUrl ?? null },
    });
    return reply.send({ ok: true, lobby });
  });

  app.get("/lobbies/:lobbyId/presence/:userId/game-card", async (req, reply) => {
    const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
    const u = verifyToken(token);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });

    const { lobbyId, userId: targetUserId } = req.params as any;
    const lobby = await (prisma as any).lobby.findUnique({
      where: { id: lobbyId }, select: { moduleType: true },
    });
    if (!lobby) return reply.code(404).send({ ok: false, error: "not_found" });
    if (lobby.moduleType === "NONE" || lobby.moduleType === "REDDIT") {
      return reply.send({ ok: true, hasCard: false });
    }

    const account = await (prisma as any).userGameAccount.findUnique({
      where: { userId_gameType: { userId: targetUserId, gameType: lobby.moduleType } },
      select: { displayName: true, platform: true, cardData: true, cardCachedAt: true },
    });
    if (!account?.cardData) return reply.send({ ok: true, hasCard: false });

    const isStale = !account.cardCachedAt ||
      (Date.now() - new Date(account.cardCachedAt).getTime()) > 5 * 60 * 1000;

    return reply.send({
      ok: true, hasCard: true, gameType: lobby.moduleType,
      displayName: account.displayName, platform: account.platform,
      cardData: account.cardData, isStale,
    });
  });
  // ── Lobby Admin API ──────────────────────────────────────────────────────────
  // Access: lobby roleLevel >= 4, or GlobalRole STAFF/ADMIN/GOD

  async function lobbyAdminAccess(req: any, reply: any, minLevel = 4): Promise<{ user: AuthedUser; lobby: any; member: any; globalRole: GlobalRole; overrideRole: string | null } | null> {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) { reply.code(401).send({ ok: false, error: "unauthorized" }); return null; }
    const lobbyId = String((req as any).params?.id || (req as any).params?.lobbyId || "");
    const lobby = await (prisma as any).lobby.findUnique({ where: { id: lobbyId } });
    if (!lobby) { reply.code(404).send({ ok: false, error: "lobby_not_found" }); return null; }
    const gr = await getGlobalRole(u.id);
    // Staff+ always has access
    if (canAccessStaff(gr)) return { user: u, lobby, member: null, globalRole: gr, overrideRole: gr };
    // Check lobby membership level
    const member = await (prisma as any).lobbyMember.findUnique({ where: { lobbyId_userId: { lobbyId, userId: u.id } } });
    if (!member || (member.roleLevel ?? 1) < minLevel) { reply.code(403).send({ ok: false, error: "forbidden" }); return null; }
    return { user: u, lobby, member, globalRole: gr, overrideRole: null };
  }

  // Role level permission map (which level can do what)
  const LEVEL_PERMS: Record<number, string[]> = {
    5: ["kick", "ban", "manage_rooms", "edit_branding", "manage_roles", "pin_rooms", "admin_chat"],
    4: ["kick", "ban", "manage_rooms", "edit_branding", "pin_rooms", "admin_chat"],
    3: ["kick", "ban", "manage_rooms", "pin_rooms", "admin_chat"],
    2: ["kick", "admin_chat"],
    1: [],
  };

  const DEFAULT_ROLE_NAMES: Record<string, string> = { "5": "Owner", "4": "Admin", "3": "Moderator", "2": "Trusted", "1": "Member" };

  function hasLobbyPerm(level: number, perm: string, overrideRole: string | null): boolean {
    if (overrideRole && ["STAFF", "ADMIN", "GOD"].includes(overrideRole)) return true;
    return (LEVEL_PERMS[level] || []).includes(perm);
  }

  // GET /lobbies/:id/admin — full admin dashboard payload
  app.get("/lobbies/:id/admin", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 2); // level 2+ can view
    if (!ctx) return;
    const { lobby, member, overrideRole, globalRole } = ctx;
    const lobbyId = lobby.id;

    const [members, roomList, auditList, banList] = await Promise.all([
      (prisma as any).lobbyMember.findMany({
        where: { lobbyId },
        orderBy: [{ roleLevel: "desc" }, { name: "asc" }],
        select: { id: true, userId: true, name: true, role: true, roleLevel: true, createdAt: true },
      }),
      (prisma as any).room.findMany({
        where: { lobbyId },
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, locked: true, ownerId: true, _count: { select: { members: true } } },
      }),
      (prisma as any).lobbyAudit.findMany({
        where: { lobbyId },
        orderBy: { ts: "desc" },
        take: 100,
      }),
      (prisma as any).lobbyBan.findMany({
        where: { lobbyId },
        select: { id: true, userId: true, reason: true, createdAt: true },
      }),
    ]);

    const roleNames = lobby.roleNames || DEFAULT_ROLE_NAMES;
    const myLevel = overrideRole ? 5 : (member?.roleLevel ?? 1);

    return reply.send({
      ok: true,
      lobby: {
        id: lobby.id, name: lobby.name, description: lobby.description,
        verified: lobby.verified, pinned: lobby.pinned,
        moduleType: lobby.moduleType, moduleConfig: lobby.moduleConfig,
        accentColor: lobby.accentColor, logoUrl: lobby.logoUrl,
        bannerUrl: lobby.bannerUrl, websiteUrl: lobby.websiteUrl,
        keywords: lobby.keywords, enabledModules: lobby.enabledModules,
        roleNames,
      },
      members,
      rooms: roomList.map((r: any) => ({
        id: r.id, name: r.name || r.id, locked: Boolean(r.locked), ownerId: r.ownerId,
        onlineCount: rooms.get(r.id)?.users.size ?? 0,
        memberCount: r._count?.members ?? 0,
      })),
      audit: auditList,
      bans: banList,
      myLevel,
      overrideRole,
      globalRole: String(globalRole),
      perms: LEVEL_PERMS[myLevel] || [],
    });
  });

  // PATCH /lobbies/:id/admin/branding
  app.patch("/lobbies/:id/admin/branding", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 4);
    if (!ctx) return;
    if (!hasLobbyPerm(ctx.member?.roleLevel ?? (ctx.overrideRole ? 5 : 1), "edit_branding", ctx.overrideRole)) {
      return reply.code(403).send({ ok: false, error: "no_permission" });
    }
    const body: any = (req as any).body || {};
    const data: any = {};
    if (typeof body.name === "string")        data.name        = body.name.slice(0, 100);
    if (typeof body.description === "string") data.description = body.description.slice(0, 500);
    if (typeof body.accentColor === "string") data.accentColor = body.accentColor.slice(0, 20);
    if (typeof body.logoUrl === "string")     data.logoUrl     = body.logoUrl.slice(0, 500);
    if (typeof body.bannerUrl === "string")   data.bannerUrl   = body.bannerUrl.slice(0, 500);
    if (typeof body.websiteUrl === "string")  data.websiteUrl  = body.websiteUrl.slice(0, 500);
    if (Array.isArray(body.keywords))         data.keywords    = body.keywords.map(String).slice(0, 20);

    if (Object.keys(data).length === 0) return reply.code(400).send({ ok: false, error: "nothing_to_update" });

    await (prisma as any).lobby.update({ where: { id: ctx.lobby.id }, data });
    await (prisma as any).lobbyAudit.create({
      data: { id: randomUUID(), lobbyId: ctx.lobby.id, type: "branding_update", actorId: ctx.user.id, actorName: ctx.user.name, note: Object.keys(data).join(", ") },
    });
    return reply.send({ ok: true, updated: Object.keys(data) });
  });

  // PATCH /lobbies/:id/admin/modules
  app.patch("/lobbies/:id/admin/modules", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 4);
    if (!ctx) return;
    if (!hasLobbyPerm(ctx.member?.roleLevel ?? (ctx.overrideRole ? 5 : 1), "edit_branding", ctx.overrideRole)) {
      return reply.code(403).send({ ok: false, error: "no_permission" });
    }
    const body: any = (req as any).body || {};
    const valid = ["voice", "youtube", "video", "screen", "twitch", "custom", "reddit"];
    const enabledModules = Array.isArray(body.enabledModules)
      ? body.enabledModules.filter((m: string) => valid.includes(m))
      : null;
    if (!enabledModules) return reply.code(400).send({ ok: false, error: "enabledModules required" });

    await (prisma as any).lobby.update({ where: { id: ctx.lobby.id }, data: { enabledModules } });
    await (prisma as any).lobbyAudit.create({
      data: { id: randomUUID(), lobbyId: ctx.lobby.id, type: "modules_update", actorId: ctx.user.id, actorName: ctx.user.name, note: enabledModules.join(", ") },
    });
    return reply.send({ ok: true, enabledModules });
  });

  // PATCH /lobbies/:id/admin/roles
  app.patch("/lobbies/:id/admin/roles", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 5); // only owner/GOD
    if (!ctx) return;
    if (!hasLobbyPerm(ctx.member?.roleLevel ?? (ctx.overrideRole ? 5 : 1), "manage_roles", ctx.overrideRole)) {
      return reply.code(403).send({ ok: false, error: "no_permission" });
    }
    const body: any = (req as any).body || {};
    const roleNames = body.roleNames;
    if (!roleNames || typeof roleNames !== "object") return reply.code(400).send({ ok: false, error: "roleNames required" });
    // Validate: keys must be 1-5, values must be strings <= 24 chars
    const clean: Record<string, string> = {};
    for (const k of ["1","2","3","4","5"]) {
      clean[k] = typeof roleNames[k] === "string" ? roleNames[k].slice(0, 24) : DEFAULT_ROLE_NAMES[k];
    }

    await (prisma as any).lobby.update({ where: { id: ctx.lobby.id }, data: { roleNames: clean } });
    await (prisma as any).lobbyAudit.create({
      data: { id: randomUUID(), lobbyId: ctx.lobby.id, type: "roles_renamed", actorId: ctx.user.id, actorName: ctx.user.name, note: JSON.stringify(clean) },
    });
    return reply.send({ ok: true, roleNames: clean });
  });

  // GET /lobbies/:id/admin/members
  app.get("/lobbies/:id/admin/members", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 2);
    if (!ctx) return;
    const members = await (prisma as any).lobbyMember.findMany({
      where: { lobbyId: ctx.lobby.id },
      orderBy: [{ roleLevel: "desc" }, { name: "asc" }],
      select: { id: true, userId: true, name: true, role: true, roleLevel: true, createdAt: true },
    });
    return reply.send({ ok: true, members });
  });

  // POST /lobbies/:id/admin/members/:userId/role
  app.post("/lobbies/:id/admin/members/:userId/role", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 4);
    if (!ctx) return;
    const myLevel = ctx.overrideRole ? 5 : (ctx.member?.roleLevel ?? 1);
    if (!hasLobbyPerm(myLevel, "manage_roles", ctx.overrideRole)) {
      return reply.code(403).send({ ok: false, error: "no_permission" });
    }
    const targetUserId = String((req as any).params?.userId || "");
    const body: any = (req as any).body || {};
    const newLevel = Math.min(Math.max(Number(body.roleLevel) || 1, 1), 5);
    // Can't promote someone to your level or above (unless GOD)
    if (newLevel >= myLevel && !ctx.overrideRole) return reply.code(403).send({ ok: false, error: "cannot_promote_to_own_level" });
    // Can't change someone at or above your level
    const target = await (prisma as any).lobbyMember.findUnique({
      where: { lobbyId_userId: { lobbyId: ctx.lobby.id, userId: targetUserId } },
    });
    if (!target) return reply.code(404).send({ ok: false, error: "member_not_found" });
    if ((target.roleLevel ?? 1) >= myLevel && !ctx.overrideRole) return reply.code(403).send({ ok: false, error: "cannot_modify_peer_or_above" });

    const lobbyRole = newLevel >= 4 ? LobbyRole.OWNER : newLevel >= 3 ? LobbyRole.MOD : LobbyRole.MEMBER;
    await (prisma as any).lobbyMember.update({
      where: { lobbyId_userId: { lobbyId: ctx.lobby.id, userId: targetUserId } },
      data: { roleLevel: newLevel, role: lobbyRole },
    });
    await (prisma as any).lobbyAudit.create({
      data: { id: randomUUID(), lobbyId: ctx.lobby.id, type: "member_role_change", actorId: ctx.user.id, actorName: ctx.user.name, targetId: targetUserId, note: `level ${newLevel}` },
    });
    return reply.send({ ok: true, userId: targetUserId, roleLevel: newLevel });
  });

  // POST /lobbies/:id/admin/members/:userId/kick
  app.post("/lobbies/:id/admin/members/:userId/kick", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 2);
    if (!ctx) return;
    const myLevel = ctx.overrideRole ? 5 : (ctx.member?.roleLevel ?? 1);
    if (!hasLobbyPerm(myLevel, "kick", ctx.overrideRole)) return reply.code(403).send({ ok: false, error: "no_permission" });
    const targetUserId = String((req as any).params?.userId || "");
    const target = await (prisma as any).lobbyMember.findUnique({
      where: { lobbyId_userId: { lobbyId: ctx.lobby.id, userId: targetUserId } },
    });
    if (!target) return reply.code(404).send({ ok: false, error: "member_not_found" });
    if ((target.roleLevel ?? 1) >= myLevel && !ctx.overrideRole) return reply.code(403).send({ ok: false, error: "cannot_kick_peer_or_above" });
    await (prisma as any).lobbyMember.delete({ where: { lobbyId_userId: { lobbyId: ctx.lobby.id, userId: targetUserId } } });
    await (prisma as any).lobbyAudit.create({
      data: { id: randomUUID(), lobbyId: ctx.lobby.id, type: "member_kicked", actorId: ctx.user.id, actorName: ctx.user.name, targetId: targetUserId, note: target.name },
    });
    return reply.send({ ok: true });
  });

  // POST /lobbies/:id/admin/members/:userId/ban
  app.post("/lobbies/:id/admin/members/:userId/ban", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 3);
    if (!ctx) return;
    const myLevel = ctx.overrideRole ? 5 : (ctx.member?.roleLevel ?? 1);
    if (!hasLobbyPerm(myLevel, "ban", ctx.overrideRole)) return reply.code(403).send({ ok: false, error: "no_permission" });
    const targetUserId = String((req as any).params?.userId || "");
    const body: any = (req as any).body || {};
    const reason = typeof body.reason === "string" ? body.reason.slice(0, 200) : "";
    // Remove membership and add to ban list
    await (prisma as any).lobbyMember.deleteMany({ where: { lobbyId: ctx.lobby.id, userId: targetUserId } });
    await (prisma as any).lobbyBan.upsert({
      where: { lobbyId_userId: { lobbyId: ctx.lobby.id, userId: targetUserId } },
      update: { reason },
      create: { lobbyId: ctx.lobby.id, userId: targetUserId, reason },
    });
    await (prisma as any).lobbyAudit.create({
      data: { id: randomUUID(), lobbyId: ctx.lobby.id, type: "member_banned", actorId: ctx.user.id, actorName: ctx.user.name, targetId: targetUserId, note: reason || undefined },
    });
    return reply.send({ ok: true });
  });

  // DELETE /lobbies/:id/admin/members/:userId/ban
  app.delete("/lobbies/:id/admin/members/:userId/ban", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 3);
    if (!ctx) return;
    const myLevel = ctx.overrideRole ? 5 : (ctx.member?.roleLevel ?? 1);
    if (!hasLobbyPerm(myLevel, "ban", ctx.overrideRole)) return reply.code(403).send({ ok: false, error: "no_permission" });
    const targetUserId = String((req as any).params?.userId || "");
    await (prisma as any).lobbyBan.deleteMany({ where: { lobbyId: ctx.lobby.id, userId: targetUserId } });
    await (prisma as any).lobbyAudit.create({
      data: { id: randomUUID(), lobbyId: ctx.lobby.id, type: "member_unbanned", actorId: ctx.user.id, actorName: ctx.user.name, targetId: targetUserId },
    });
    return reply.send({ ok: true });
  });

  // POST /lobbies/:id/admin/rooms/:roomId/pin
  app.post("/lobbies/:id/admin/rooms/:roomId/pin", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 3);
    if (!ctx) return;
    const myLevel = ctx.overrideRole ? 5 : (ctx.member?.roleLevel ?? 1);
    if (!hasLobbyPerm(myLevel, "pin_rooms", ctx.overrideRole)) return reply.code(403).send({ ok: false, error: "no_permission" });
    const roomId = String((req as any).params?.roomId || "");
    // Pin is stored as a special field — for now we just audit it; pinning logic will be added to room display
    await (prisma as any).lobbyAudit.create({
      data: { id: randomUUID(), lobbyId: ctx.lobby.id, type: "room_pinned", actorId: ctx.user.id, actorName: ctx.user.name, targetId: roomId },
    });
    return reply.send({ ok: true, roomId });
  });

  // DELETE /lobbies/:id/admin/rooms/:roomId
  app.delete("/lobbies/:id/admin/rooms/:roomId", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 3);
    if (!ctx) return;
    const myLevel = ctx.overrideRole ? 5 : (ctx.member?.roleLevel ?? 1);
    if (!hasLobbyPerm(myLevel, "manage_rooms", ctx.overrideRole)) return reply.code(403).send({ ok: false, error: "no_permission" });
    const roomId = String((req as any).params?.roomId || "");
    const room = await (prisma as any).room.findUnique({ where: { id: roomId }, select: { lobbyId: true, name: true } });
    if (!room || room.lobbyId !== ctx.lobby.id) return reply.code(404).send({ ok: false, error: "room_not_found_in_lobby" });
    // Kick live users
    const liveRoom = rooms.get(roomId);
    if (liveRoom) {
      for (const s of liveRoom.sockets) {
        send(s, { type: "room:deleted", roomId });
        try { (s as any).close(4000, "room:deleted"); } catch {}
      }
      rooms.delete(roomId);
    }
    await (prisma as any).room.delete({ where: { id: roomId } });
    await (prisma as any).lobbyAudit.create({
      data: { id: randomUUID(), lobbyId: ctx.lobby.id, type: "room_deleted", actorId: ctx.user.id, actorName: ctx.user.name, targetId: roomId, note: room.name },
    });
    return reply.send({ ok: true });
  });

  // GET /lobbies/:id/admin/audit
  app.get("/lobbies/:id/admin/audit", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 3);
    if (!ctx) return;
    const logs = await (prisma as any).lobbyAudit.findMany({
      where: { lobbyId: ctx.lobby.id },
      orderBy: { ts: "desc" },
      take: 200,
    });
    return reply.send({ ok: true, logs });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // ── STRIPE SUBSCRIPTION SYSTEM ─────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════════

  const STRIPE_SK      = process.env.STRIPE_SECRET_KEY || "";
  const STRIPE_PK      = process.env.STRIPE_PUBLISHABLE_KEY || "";
  const STRIPE_WH_SEC  = process.env.STRIPE_WEBHOOK_SECRET || "";
  const SITE_URL       = process.env.SITE_URL || "https://weered.ca";

  // Price IDs — set these in env after creating products in Stripe dashboard
  const STRIPE_PRICES: Record<string, string> = {
    INDICTED: process.env.STRIPE_PRICE_INDICTED || "",
    FELON:    process.env.STRIPE_PRICE_FELON    || "",
  };

  async function stripeReq(method: string, path: string, body?: any) {
    const url = `https://api.stripe.com/v1${path}`;
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${STRIPE_SK}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };
    const opts: any = { method, headers };
    if (body) {
      opts.body = new URLSearchParams(body).toString();
    }
    const res = await fetch(url, opts);
    return res.json();
  }

  // GET /subscribe/config — publishable key + price IDs for frontend
  app.get("/subscribe/config", async (_req, reply) => {
    return reply.send({
      ok: true,
      publishableKey: STRIPE_PK,
      prices: {
        INDICTED: { id: STRIPE_PRICES.INDICTED, amount: 600, label: "Indicted — $6/mo" },
        FELON:    { id: STRIPE_PRICES.FELON,    amount: 1400, label: "Felon — $14/mo" },
      },
    });
  });

  // GET /subscribe/status — current user subscription status
  app.get("/subscribe/status", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const sub = await (prisma as any).subscription.findUnique({ where: { userId: u.id } });
    if (!sub) return reply.send({ ok: true, tier: "FREE", status: "inactive" });
    return reply.send({
      ok: true,
      tier: sub.tier,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() || null,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    });
  });

  // POST /subscribe/checkout — create Stripe checkout session
  app.post("/subscribe/checkout", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!STRIPE_SK) return reply.code(500).send({ ok: false, error: "stripe_not_configured" });

    const body: any = (req as any).body || {};
    const tier = String(body.tier || "").toUpperCase();
    const priceId = STRIPE_PRICES[tier];
    if (!priceId) return reply.code(400).send({ ok: false, error: "invalid_tier" });

    // Find or create Stripe customer
    let sub = await (prisma as any).subscription.findUnique({ where: { userId: u.id } });
    let customerId = sub?.stripeCustomerId;

    if (!customerId) {
      const dbUser = await prisma.user.findUnique({ where: { id: u.id }, select: { name: true, email: true } });
      const customer = await stripeReq("POST", "/customers", {
        email: dbUser?.email || undefined,
        name: dbUser?.name || u.name,
        "metadata[weered_user_id]": u.id,
      });
      customerId = customer.id;
      // Upsert subscription record
      sub = await (prisma as any).subscription.upsert({
        where: { userId: u.id },
        update: { stripeCustomerId: customerId },
        create: { userId: u.id, stripeCustomerId: customerId, tier: "FREE" },
      });
    }

    // Create checkout session
    const session = await stripeReq("POST", "/checkout/sessions", {
      customer: customerId,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      mode: "subscription",
      success_url: `${SITE_URL}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/subscribe`,
      "metadata[weered_user_id]": u.id,
      "metadata[tier]": tier,
    });

    return reply.send({ ok: true, url: session.url, sessionId: session.id });
  });

  // POST /subscribe/portal — Stripe customer portal for managing sub
  app.post("/subscribe/portal", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const sub = await (prisma as any).subscription.findUnique({ where: { userId: u.id } });
    if (!sub?.stripeCustomerId) return reply.code(400).send({ ok: false, error: "no_subscription" });

    const session = await stripeReq("POST", "/billing_portal/sessions", {
      customer: sub.stripeCustomerId,
      return_url: `${SITE_URL}/subscribe`,
    });
    return reply.send({ ok: true, url: session.url });
  });

  // POST /subscribe/webhook — Stripe webhook with signature verification
  app.post("/subscribe/webhook", async (req, reply) => {
    const sigHeader = (req.headers as any)["stripe-signature"] || "";
    const rawBody = (req as any).rawBody as Buffer | undefined;

    if (STRIPE_WH_SEC && rawBody) {
      // Parse Stripe signature header: t=timestamp,v1=signature
      const parts: Record<string, string> = {};
      for (const item of sigHeader.split(",")) {
        const [k, v] = item.split("=");
        if (k && v) parts[k.trim()] = v.trim();
      }
      const timestamp = parts["t"];
      const sig = parts["v1"];
      if (!timestamp || !sig) return reply.code(400).send({ ok: false, error: "missing_signature" });

      // Verify: HMAC-SHA256 of "timestamp.rawBody" using webhook secret
      const expected = createHmac("sha256", STRIPE_WH_SEC)
        .update(`${timestamp}.${rawBody.toString("utf8")}`)
        .digest("hex");
      const sigBuf = Buffer.from(sig, "hex");
      const expectedBuf = Buffer.from(expected, "hex");
      if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
        console.error("[stripe webhook] signature mismatch");
        return reply.code(400).send({ ok: false, error: "invalid_signature" });
      }

      // Optionally reject replays older than 5 minutes
      const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
      if (age > 300) {
        console.error("[stripe webhook] timestamp too old:", age, "seconds");
        return reply.code(400).send({ ok: false, error: "timestamp_expired" });
      }
    }

    const event: any = (req as any).body;
    if (!event?.type) return reply.code(400).send({ ok: false });

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data?.object;
        const userId = session?.metadata?.weered_user_id;
        const tier = session?.metadata?.tier || "INDICTED";
        const subId = session?.subscription;
        if (userId && subId) {
          // Fetch subscription details from Stripe
          const stripeSub = await stripeReq("GET", `/subscriptions/${subId}`);
          await (prisma as any).subscription.upsert({
            where: { userId },
            update: {
              tier, stripeSubId: subId, status: "active",
              stripePriceId: stripeSub?.items?.data?.[0]?.price?.id || null,
              currentPeriodEnd: stripeSub?.current_period_end ? new Date(stripeSub.current_period_end * 1000) : null,
            },
            create: {
              userId, tier, stripeSubId: subId, status: "active",
              stripeCustomerId: session.customer,
              stripePriceId: stripeSub?.items?.data?.[0]?.price?.id || null,
              currentPeriodEnd: stripeSub?.current_period_end ? new Date(stripeSub.current_period_end * 1000) : null,
            },
          });
          // Update user tier to match
          const userTier = tier === "FELON" ? "FELON" : "INDICTED";
          await prisma.user.update({ where: { id: userId }, data: { tier: userTier } });
          await globalAudit("system", "Stripe", "subscription_activated", userId, undefined, { tier, subId });
        }
      }

      if (event.type === "customer.subscription.updated") {
        const stripeSub = event.data?.object;
        const subId = stripeSub?.id;
        if (subId) {
          const dbSub = await (prisma as any).subscription.findUnique({ where: { stripeSubId: subId } });
          if (dbSub) {
            await (prisma as any).subscription.update({
              where: { stripeSubId: subId },
              data: {
                status: stripeSub.status,
                cancelAtPeriodEnd: Boolean(stripeSub.cancel_at_period_end),
                currentPeriodEnd: stripeSub.current_period_end ? new Date(stripeSub.current_period_end * 1000) : null,
              },
            });
          }
        }
      }

      if (event.type === "customer.subscription.deleted") {
        const stripeSub = event.data?.object;
        const subId = stripeSub?.id;
        if (subId) {
          const dbSub = await (prisma as any).subscription.findUnique({ where: { stripeSubId: subId } });
          if (dbSub) {
            await (prisma as any).subscription.update({
              where: { stripeSubId: subId },
              data: { status: "canceled", tier: "FREE" },
            });
            // Downgrade user tier
            await prisma.user.update({ where: { id: dbSub.userId }, data: { tier: "INNOCENT" } });
            await globalAudit("system", "Stripe", "subscription_canceled", dbSub.userId);
          }
        }
      }
    } catch (e) {
      console.error("[stripe webhook]", e);
    }

    return reply.send({ ok: true });
  });

  // POST /staff/subscriptions/grant — staff can manually grant tiers
  app.post("/staff/subscriptions/grant", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const body: any = (req as any).body || {};
    const targetId = String(body.userId || "");
    const tier = String(body.tier || "").toUpperCase();
    if (!targetId || !["FREE", "INDICTED", "FELON", "KINGPIN"].includes(tier)) {
      return reply.code(400).send({ ok: false, error: "invalid" });
    }
    await (prisma as any).subscription.upsert({
      where: { userId: targetId },
      update: { tier, status: tier === "FREE" ? "inactive" : "active" },
      create: { userId: targetId, tier, status: tier === "FREE" ? "inactive" : "active" },
    });
    const userTier = tier === "KINGPIN" ? "KINGPIN" : tier === "FELON" ? "FELON" : tier === "INDICTED" ? "INDICTED" : "INNOCENT";
    await prisma.user.update({ where: { id: targetId }, data: { tier: userTier } });
    await globalAudit(u.id, u.name, "subscription_grant", targetId, undefined, { tier });
    return reply.send({ ok: true, tier });
  });

  // GET /staff/subscriptions — list all subscriptions (staff)
  app.get("/staff/subscriptions", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const subs = await (prisma as any).subscription.findMany({
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    // Enrich with user names
    const userIds = subs.map((s: any) => s.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, usernameKey: true, tier: true, notoriety: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));
    const enriched = subs.map((s: any) => ({
      ...s,
      userName: userMap.get(s.userId)?.name || "",
      usernameKey: userMap.get(s.userId)?.usernameKey || "",
      userTier: userMap.get(s.userId)?.tier || "INNOCENT",
      currentPeriodEnd: s.currentPeriodEnd?.toISOString() || null,
      createdAt: s.createdAt?.toISOString() || null,
      updatedAt: s.updatedAt?.toISOString() || null,
    }));
    return reply.send({ ok: true, subscriptions: enriched });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // ── TWITCH INTEGRATION ─────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════════

  const TWITCH_CLIENT_ID     = process.env.TWITCH_CLIENT_ID || "";
  const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || "";
  let twitchAppToken = "";
  let twitchTokenExp = 0;

  async function getTwitchAppToken(): Promise<string> {
    if (twitchAppToken && Date.now() < twitchTokenExp) return twitchAppToken;
    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) return "";
    try {
      const res = await fetch("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: TWITCH_CLIENT_ID,
          client_secret: TWITCH_CLIENT_SECRET,
          grant_type: "client_credentials",
        }),
      });
      const data = await res.json();
      twitchAppToken = data.access_token || "";
      twitchTokenExp = Date.now() + ((data.expires_in || 3600) - 60) * 1000;
      console.log("[twitch] app token acquired");
      return twitchAppToken;
    } catch (e) {
      console.error("[twitch] token error", e);
      return "";
    }
  }

  // GET /twitch/streams?game=Destiny+2 — top live streams for a game
  app.get("/twitch/streams", async (req, reply) => {
    const token = await getTwitchAppToken();
    if (!token) return reply.send({ ok: true, streams: [], error: "twitch_not_configured" });

    const gameName = String((req as any).query?.game || "Destiny 2");

    try {
      // First get game ID
      const gameRes = await fetch(`https://api.twitch.tv/helix/games?name=${encodeURIComponent(gameName)}`, {
        headers: { "Client-ID": TWITCH_CLIENT_ID, "Authorization": `Bearer ${token}` },
      });
      const gameData = await gameRes.json();
      const gameId = gameData?.data?.[0]?.id;
      if (!gameId) return reply.send({ ok: true, streams: [] });

      // Get top streams
      const streamRes = await fetch(`https://api.twitch.tv/helix/streams?game_id=${gameId}&first=12&sort=viewers`, {
        headers: { "Client-ID": TWITCH_CLIENT_ID, "Authorization": `Bearer ${token}` },
      });
      const streamData = await streamRes.json();
      const streams = (streamData?.data || []).map((s: any) => ({
        id: s.id,
        userName: s.user_name,
        userLogin: s.user_login,
        title: s.title,
        viewerCount: s.viewer_count,
        thumbnailUrl: (s.thumbnail_url || "").replace("{width}", "320").replace("{height}", "180"),
        language: s.language,
        startedAt: s.started_at,
      }));

      return reply.send({ ok: true, streams, gameId, gameName });
    } catch (e) {
      console.error("[twitch streams]", e);
      return reply.send({ ok: true, streams: [], error: "fetch_failed" });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // ── BUNGIE API INTEGRATION ─────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════════

  const BUNGIE_API_KEY       = process.env.BUNGIE_API_KEY || "";
  const BUNGIE_CLIENT_ID     = process.env.BUNGIE_CLIENT_ID || "";
  const BUNGIE_CLIENT_SECRET = process.env.BUNGIE_CLIENT_SECRET || "";
  const BUNGIE_ROOT          = "https://www.bungie.net/Platform";

  // Auto-sync Bungie manifest on startup (non-blocking)
  if (BUNGIE_API_KEY) {
    syncManifest(BUNGIE_API_KEY).then(r => {
      console.log(`[manifest] Startup sync: ${r.ok ? "OK" : "FAILED"} — v${r.version}`, r.counts);
    }).catch(e => console.error("[manifest] Startup sync error:", e));
  }

  async function bungieGet(path: string, accessToken?: string) {
    const headers: Record<string, string> = { "X-API-Key": BUNGIE_API_KEY };
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
    const res = await fetch(`${BUNGIE_ROOT}${path}`, { headers });
    return res.json();
  }

  // Cache helper — reads from DB, fetches if stale
  async function bungieGetCached(key: string, path: string, ttlMinutes: number) {
    try {
      const cached = await (prisma as any).bungieCache.findUnique({ where: { key } });
      if (cached && new Date(cached.expiresAt) > new Date()) {
        return cached.data;
      }
    } catch {}

    if (!BUNGIE_API_KEY) return null;

    try {
      const data = await bungieGet(path);
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
      await (prisma as any).bungieCache.upsert({
        where: { key },
        update: { data, fetchedAt: new Date(), expiresAt },
        create: { key, data, fetchedAt: new Date(), expiresAt },
      });
      return data;
    } catch (e) {
      console.error(`[bungie cache] ${key}`, e);
      return null;
    }
  }

  // Refresh Bungie OAuth token if expired, returns fresh access token
  async function refreshBungieToken(account: any): Promise<string | null> {
    // If token is still valid, return it
    if (account.tokenExpiry && new Date(account.tokenExpiry) > new Date()) {
      return account.accessToken;
    }

    // No refresh token — can't refresh
    if (!account.refreshToken) {
      console.log("[bungie] No refresh token, user must re-link");
      return null;
    }

    console.log("[bungie] Access token expired, refreshing...");
    try {
      const tokenBody: Record<string, string> = {
        grant_type: "refresh_token",
        refresh_token: account.refreshToken,
        client_id: BUNGIE_CLIENT_ID,
      };
      if (BUNGIE_CLIENT_SECRET) {
        tokenBody.client_secret = BUNGIE_CLIENT_SECRET;
      }

      const tokenRes = await fetch("https://www.bungie.net/Platform/App/OAuth/Token/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "X-API-Key": BUNGIE_API_KEY },
        body: new URLSearchParams(tokenBody),
      });
      const tokens = await tokenRes.json();

      if (!tokens.access_token) {
        console.error("[bungie] Token refresh failed:", tokens);
        return null;
      }

      // Update stored tokens
      await (prisma as any).userGameAccount.update({
        where: { userId_gameType: { userId: account.userId, gameType: "BUNGIE" } },
        data: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || account.refreshToken,
          tokenExpiry: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
        },
      });

      console.log("[bungie] Token refreshed successfully");
      return tokens.access_token;
    } catch (e) {
      console.error("[bungie] Token refresh error:", e);
      return null;
    }
  }

  // GET /bungie/xur — Xur's inventory (cached 30 min)
  app.get("/bungie/xur", async (_req, reply) => {
    const data = await bungieGetCached("xur_inventory", "/Destiny2/Milestones/", 30);
    if (!data) return reply.send({ ok: true, available: false, error: "bungie_unavailable" });

    // Xur appears Friday reset to Tuesday reset
    // The milestones endpoint gives us active milestones — Xur is milestone hash 534869653
    const xurMilestone = data?.Response?.["534869653"];
    const isAvailable = !!xurMilestone;

    return reply.send({ ok: true, available: isAvailable, milestone: xurMilestone || null, raw: data?.Response ? undefined : data });
  });

  // POST /bungie/manifest/sync — Force re-sync manifest
  app.post("/bungie/manifest/sync", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!BUNGIE_API_KEY) return reply.send({ ok: false, error: "bungie_not_configured" });
    const result = await syncManifest(BUNGIE_API_KEY);
    return reply.send({ ok: true, ...result });
  });

  // GET /bungie/manifest/status — Check manifest cache status
  app.get("/bungie/manifest/status", async (_req, reply) => {
    return reply.send({ ok: true, loaded: manifestLoaded(), version: manifestVersion() });
  });

  // GET /bungie/weekly — Weekly reset info, enriched with manifest names
  app.get("/bungie/weekly", async (_req, reply) => {
    const data = await bungieGetCached("weekly_reset", "/Destiny2/Milestones/", 15);
    if (!data) return reply.send({ ok: true, milestones: [], error: "bungie_unavailable" });

    const milestonesRaw = data?.Response || {};

    if (manifestLoaded()) {
      const enriched = enrichMilestones(milestonesRaw);
      return reply.send({
        ok: true,
        milestones: enriched,
        totalMilestones: Object.keys(milestonesRaw).length,
        manifestVersion: manifestVersion(),
      });
    }

    // Fallback: hardcoded names when manifest not yet synced
    const KNOWN: Record<string, string> = {
      "2029743966": "Nightfall", "3603098564": "Crucible Playlist",
      "534869653": "Xur", "4253138191": "Raid", "1437935813": "Vanguard Ops",
    };
    const summary: any[] = [];
    for (const [hash, ms] of Object.entries(milestonesRaw) as [string, any][]) {
      if (KNOWN[hash]) {
        summary.push({
          hash, name: KNOWN[hash],
          activities: ms?.activities?.map((a: any) => ({ hash: a.activityHash, challenges: a.challengeObjectiveHashes, modifiers: a.modifierHashes, phases: a.phaseHashes })) || [],
          availableQuests: ms?.availableQuests?.length || 0, startDate: ms?.startDate, endDate: ms?.endDate,
        });
      }
    }
    return reply.send({ ok: true, milestones: summary, totalMilestones: Object.keys(milestonesRaw).length });
  });

  // GET /bungie/player/:name — Guardian stats lookup (platform search)
  app.get("/bungie/player/:name", async (req, reply) => {
    if (!BUNGIE_API_KEY) return reply.send({ ok: false, error: "bungie_not_configured" });

    const displayName = String((req as any).params?.name || "");
    if (!displayName) return reply.code(400).send({ ok: false, error: "name_required" });

    try {
      // Search for player across all platforms
      // Format: BungieName#1234 or just BungieName
      const parts = displayName.split("#");
      const name = parts[0];
      const code = parts[1] || "0";

      // POST endpoint for global search
      const searchRes = await fetch(`${BUNGIE_ROOT}/Destiny2/SearchDestinyPlayerByBungieName/-1/`, {
        method: "POST",
        headers: { "X-API-Key": BUNGIE_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name, displayNameCode: Number(code) }),
      });
      const searchResult = await searchRes.json();
      const players = searchResult?.Response || [];

      if (players.length === 0) {
        return reply.send({ ok: true, found: false, players: [] });
      }

      // Get profile for first result
      const player = players[0];
      const memberType = player.membershipType;
      const memberId = player.membershipId;

      // Fetch profile: characters, stats, equipment
      const profile = await bungieGet(
        `/Destiny2/${memberType}/Profile/${memberId}/?components=100,200,205,800`
      );

      const characters = profile?.Response?.characters?.data || {};
      const stats = profile?.Response?.profileRecords?.data || {};

      const charSummary = Object.values(characters).map((c: any) => ({
        characterId: c.characterId,
        classType: c.classType, // 0=Titan, 1=Hunter, 2=Warlock
        light: c.light,
        raceType: c.raceType,
        emblemPath: c.emblemPath ? `https://www.bungie.net${c.emblemPath}` : null,
        emblemBackgroundPath: c.emblemBackgroundPath ? `https://www.bungie.net${c.emblemBackgroundPath}` : null,
        dateLastPlayed: c.dateLastPlayed,
        minutesPlayedTotal: c.minutesPlayedTotal,
        titleRecordHash: c.titleRecordHash,
      }));

      return reply.send({
        ok: true,
        found: true,
        player: {
          membershipId: memberId,
          membershipType: memberType,
          displayName: player.bungieGlobalDisplayName || player.displayName,
          displayNameCode: player.bungieGlobalDisplayNameCode,
          iconPath: player.iconPath ? `https://www.bungie.net${player.iconPath}` : null,
        },
        characters: charSummary,
        totalCharacters: charSummary.length,
      });
    } catch (e) {
      console.error("[bungie player lookup]", e);
      return reply.code(500).send({ ok: false, error: "lookup_failed" });
    }
  });

  // GET /auth/bungie — redirect to Bungie OAuth
  app.get("/auth/bungie", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization || (req as any).query?.token);
    if (!u) return reply.code(401).send({ error: "Login first" });
    if (!BUNGIE_CLIENT_ID) return reply.code(500).send({ error: "Bungie OAuth not configured" });

    const state = Buffer.from(JSON.stringify({ userId: u.id })).toString("base64url");
    const url = `https://www.bungie.net/en/OAuth/Authorize?client_id=${BUNGIE_CLIENT_ID}&response_type=code&state=${state}`;
    return reply.redirect(url);
  });

  // GET /auth/bungie/callback — Bungie OAuth callback
  app.get("/auth/bungie/callback", async (req, reply) => {
    const code = String((req as any).query?.code || "");
    const state = String((req as any).query?.state || "");
    if (!code) return reply.code(400).send({ error: "Missing code" });

    let userId = "";
    try {
      const parsed = JSON.parse(Buffer.from(state, "base64url").toString());
      userId = parsed.userId;
    } catch { return reply.code(400).send({ error: "Invalid state" }); }

    try {
      // Exchange code for tokens
      const tokenBody: Record<string, string> = {
        grant_type: "authorization_code",
        code,
        client_id: BUNGIE_CLIENT_ID,
      };
      if (BUNGIE_CLIENT_SECRET) {
        tokenBody.client_secret = BUNGIE_CLIENT_SECRET;
      }

      const tokenRes = await fetch("https://www.bungie.net/Platform/App/OAuth/Token/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "X-API-Key": BUNGIE_API_KEY },
        body: new URLSearchParams(tokenBody),
      });
      const tokens = await tokenRes.json();

      if (!tokens.access_token) {
        console.error("[bungie oauth] token error", tokens);
        return reply.redirect(`${SITE_URL}/settings?bungie=error`);
      }

      // Get membership info
      const memberRes = await fetch("https://www.bungie.net/Platform/User/GetMembershipsForCurrentUser/", {
        headers: { "X-API-Key": BUNGIE_API_KEY, "Authorization": `Bearer ${tokens.access_token}` },
      });
      const memberData = await memberRes.json();
      const memberships = memberData?.Response?.destinyMemberships || [];
      const primary = memberships.find((m: any) => m.crossSaveOverride === m.membershipType) || memberships[0];

      // Store in UserGameAccount
      await (prisma as any).userGameAccount.upsert({
        where: { userId_gameType: { userId, gameType: "BUNGIE" } },
        update: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || null,
          tokenExpiry: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
          externalId: primary?.membershipId || tokens.membership_id || null,
          displayName: primary?.bungieGlobalDisplayName || primary?.displayName || "",
          platform: String(primary?.membershipType || ""),
        },
        create: {
          userId,
          gameType: "BUNGIE",
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || null,
          tokenExpiry: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
          externalId: primary?.membershipId || tokens.membership_id || null,
          displayName: primary?.bungieGlobalDisplayName || primary?.displayName || "",
          platform: String(primary?.membershipType || ""),
        },
      });

      return reply.redirect(`${SITE_URL}/settings?bungie=success`);
    } catch (e) {
      console.error("[bungie oauth callback]", e);
      return reply.redirect(`${SITE_URL}/settings?bungie=error`);
    }
  });

  // GET /bungie/me — Full enriched Bungie profile with inventory
  app.get("/bungie/me", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

    const account = await (prisma as any).userGameAccount.findUnique({
      where: { userId_gameType: { userId: u.id, gameType: "BUNGIE" } },
    });
    if (!account?.accessToken) return reply.send({ ok: true, linked: false });

    // Refresh token if expired
    const accessToken = await refreshBungieToken(account);
    if (!accessToken) {
      return reply.send({ ok: true, linked: true, error: "token_expired", displayName: account.displayName,
        message: "Your Bungie session expired. Please re-link your account." });
    }

    try {
      // Fetch full profile: characters, equipment, inventories, vault, item instances
      const profile = await bungieGet(
        `/Destiny2/${account.platform}/Profile/${account.externalId}/?components=100,102,200,201,205,300`,
        accessToken
      );

      const profileData = profile?.Response;
      if (!profileData) return reply.send({ ok: true, linked: true, error: "no_profile_data", displayName: account.displayName });

      // Enrich with manifest if loaded
      if (manifestLoaded()) {
        const enriched = enrichProfile(profileData);
        return reply.send({
          ok: true,
          linked: true,
          displayName: account.displayName,
          platform: account.platform,
          externalId: account.externalId,
          manifestVersion: manifestVersion(),
          ...enriched,
        });
      }

      // Fallback: raw data without manifest resolution
      const characters = profileData?.characters?.data || {};
      const charEquipment = profileData?.characterEquipment?.data || {};
      const instances = profileData?.itemComponents?.instances?.data || {};
      const vaultItems = profileData?.profileInventory?.data?.items || [];

      const charSummary = Object.entries(characters).map(([charId, c]: [string, any]) => {
        const equipped = (charEquipment[charId]?.items || []).map((item: any) => {
          const inst = instances[item.itemInstanceId] || {};
          return {
            itemHash: item.itemHash, itemInstanceId: item.itemInstanceId, bucketHash: item.bucketHash,
            primaryStat: inst.primaryStat?.value || null, name: null, icon: null,
          };
        });
        return {
          characterId: charId, classType: c.classType,
          className: ["Titan", "Hunter", "Warlock"][c.classType] || "Unknown",
          light: c.light, raceType: c.raceType,
          raceName: ["Human", "Awoken", "Exo"][c.raceType] || "Unknown",
          emblemPath: c.emblemPath, emblemBackgroundPath: c.emblemBackgroundPath,
          dateLastPlayed: c.dateLastPlayed, minutesPlayedTotal: c.minutesPlayedTotal,
          equipped, weapons: [], armor: [], inventory: [],
        };
      });

      return reply.send({
        ok: true, linked: true,
        displayName: account.displayName, platform: account.platform, externalId: account.externalId,
        characters: charSummary, vault: vaultItems.slice(0, 20), vaultCount: vaultItems.length,
      });
    } catch (e) {
      console.error("[bungie/me]", e);
      return reply.send({ ok: true, linked: true, error: "fetch_failed", displayName: account.displayName });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // ── LFG / FIRETEAM BOARD ───────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════════

  // GET /lfg/:lobbyId — list open LFG posts
  app.get("/lfg/:lobbyId", async (req, reply) => {
    const lobbyId = String((req as any).params?.lobbyId || "");
    const posts = await (prisma as any).lfgPost.findMany({
      where: { lobbyId, status: { not: "CLOSED" } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return reply.send({
      ok: true,
      posts: posts.map((p: any) => ({
        ...p,
        createdAt: p.createdAt?.toISOString(),
        updatedAt: p.updatedAt?.toISOString(),
      })),
    });
  });

  // POST /lfg/:lobbyId — create LFG post
  app.post("/lfg/:lobbyId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const lobbyId = String((req as any).params?.lobbyId || "");
    const body: any = (req as any).body || {};

    const post = await (prisma as any).lfgPost.create({
      data: {
        lobbyId,
        userId: u.id,
        userName: u.name,
        activity: String(body.activity || "").slice(0, 100),
        description: String(body.description || "").slice(0, 300),
        maxPlayers: Math.min(Math.max(Number(body.maxPlayers) || 6, 2), 12),
        platform: String(body.platform || "crossplay").slice(0, 20),
        players: [u.id],
        playerNames: [u.name],
        status: "OPEN",
      },
    });
    return reply.send({ ok: true, post });
  });

  // POST /lfg/:postId/join — join an LFG post
  app.post("/lfg/:postId/join", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const postId = String((req as any).params?.postId || "");

    const post = await (prisma as any).lfgPost.findUnique({ where: { id: postId } });
    if (!post) return reply.code(404).send({ ok: false, error: "not_found" });
    if (post.status !== "OPEN") return reply.code(400).send({ ok: false, error: "post_not_open", message: "This fireteam is no longer open." });
    if (post.players.includes(u.id)) return reply.code(400).send({ ok: false, error: "already_joined", message: "You're already in this fireteam." });
    if (post.players.length >= post.maxPlayers) return reply.code(400).send({ ok: false, error: "full", message: "This fireteam is full." });

    const players = [...post.players, u.id];
    const playerNames = [...post.playerNames, u.name];
    const status = players.length >= post.maxPlayers ? "FULL" : "OPEN";

    await (prisma as any).lfgPost.update({
      where: { id: postId },
      data: { players, playerNames, status },
    });
    return reply.send({ ok: true, players, playerNames, status });
  });

  // POST /lfg/:postId/leave — leave an LFG post
  app.post("/lfg/:postId/leave", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const postId = String((req as any).params?.postId || "");

    const post = await (prisma as any).lfgPost.findUnique({ where: { id: postId } });
    if (!post) return reply.code(404).send({ ok: false, error: "not_found" });

    const idx = post.players.indexOf(u.id);
    if (idx === -1) return reply.code(400).send({ ok: false, error: "not_in_post" });

    const players = post.players.filter((p: string) => p !== u.id);
    const playerNames = [...post.playerNames];
    playerNames.splice(idx, 1);
    const status = players.length === 0 ? "CLOSED" : "OPEN";

    await (prisma as any).lfgPost.update({
      where: { id: postId },
      data: { players, playerNames, status },
    });
    return reply.send({ ok: true, status });
  });

  // DELETE /lfg/:postId — close/delete (owner or mod only)
  app.delete("/lfg/:postId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const postId = String((req as any).params?.postId || "");

    const post = await (prisma as any).lfgPost.findUnique({ where: { id: postId } });
    if (!post) return reply.code(404).send({ ok: false, error: "not_found" });

    const gr = await getGlobalRole(u.id);
    if (post.userId !== u.id && !canAccessStaff(gr)) {
      return reply.code(403).send({ ok: false, error: "not_owner" });
    }

    await (prisma as any).lfgPost.update({ where: { id: postId }, data: { status: "CLOSED" } });
    return reply.send({ ok: true });
  });

  process.on("SIGINT", async () => {
    try { await prisma.$disconnect(); } catch {}
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
