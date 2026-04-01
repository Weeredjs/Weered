import Fastify from "fastify";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import { randomUUID, randomBytes, createHmac, timingSafeEqual } from "crypto";
import { AccessToken } from "livekit-server-sdk";
import { PrismaClient, RoomRole, GlobalRole, LobbyRole, ModuleType } from "@prisma/client";
import { OAuth2Client } from "google-auth-library";
import { syncManifest, enrichProfile, enrichMilestones, enrichVendorSales, resolveItem, resolveBucket, resolveDamageType, isLoaded as manifestLoaded, manifestVersion, WEAPON_BUCKETS, ARMOR_BUCKETS, ARMOR_STAT_HASHES } from "./manifest";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import webpush from "web-push";

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || "weered-dev-secret";

// ── Web Push (VAPID) ──────────────────────────────────────────────────────
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT     || "mailto:support@weered.ca";
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}
const HTTP_PORT = Number(process.env.PORT || 4000);
const WS_PORT = Number(process.env.WS_PORT || 4001);

const LIVEKIT_URL = process.env.LIVEKIT_URL || process.env.LIVEKIT_WS_URL || "ws://127.0.0.1:7880";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "";

type AuthedUser = { id: string; name: string; globalRole?: string; tier?: string; avatarColor?: string; avatar?: string };
type Sock = WebSocket & { user?: AuthedUser; roomId?: string; pendingRoomId?: string };

type Role = "owner" | "mod" | "member";
type RoomUser = { id: string; name: string; role?: Role; globalRole?: string; tier?: string; avatarColor?: string | null; avatar?: string | null };
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

type ModuleState = {
  mode: string;
  url?: string;
  channel?: string;
  setBy?: string;
  setAt?: number;
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
  activeModule: ModuleState | null;
  ytState: { videoId: string; playing: boolean; position: number; updatedAt: number } | null;
  lastActiveAt: number;
  pinned: boolean;
  passwordHash?: string;
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
async function isGloballyBanned(userId: string): Promise<boolean> {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { banned: true } });
    return u?.banned === true;
  } catch { return false; }
}

// ── Reserved name check ─────────────────────────────────────────────────────
async function isNameReserved(name: string, scope: "LOBBY" | "USERNAME" | "BOTH"): Promise<boolean> {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!normalized) return false;
  const match = await (prisma as any).reservedName.findFirst({
    where: {
      name: normalized,
      scope: { in: scope === "BOTH" ? ["BOTH", "LOBBY", "USERNAME"] : ["BOTH", scope] },
    },
  });
  return Boolean(match);
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
  { id: "lobby",        name: "The Lobby",    description: "General hangout. Everyone starts here.", keywords: ["lobby","general","home"],              moduleType: ModuleType.FEED,  moduleConfig: { subreddit: "r/all" } },
  { id: "r/all",        name: "r/all",        description: "Reddit firehose. All topics welcome.",   keywords: ["reddit","all","general"],              moduleType: ModuleType.FEED,  moduleConfig: { subreddit: "r/all" } },
  { id: "r/gaming",     name: "r/gaming",     description: "Gamers of all kinds.",                   keywords: ["reddit","gaming","games","gamer"],     moduleType: ModuleType.FEED,  moduleConfig: { subreddit: "r/gaming" } },
  { id: "r/technology", name: "r/technology", description: "Tech news, discussion, builds.",         keywords: ["reddit","tech","technology","coding"],  moduleType: ModuleType.FEED,  moduleConfig: { subreddit: "r/technology" } },
  { id: "r/worldnews",  name: "r/worldnews",  description: "Global news and current events.",        keywords: ["reddit","news","world","worldnews"],   moduleType: ModuleType.FEED,  moduleConfig: { subreddit: "r/worldnews" } },
  { id: "weered.ca",    name: "Weered HQ",    description: "Meta, announcements, beta feedback.",    keywords: ["weered","meta","official","hq"],       moduleType: ModuleType.NONE,    moduleConfig: null },
  { id: "destiny2", name: "Destiny 2 | Bungie.net", description: "Guardians, strikes, raids and loot. Powered by the Bungie API.", keywords: ["destiny", "destiny2", "bungie", "guardian", "warlock", "titan", "hunter", "raid"], moduleType: ModuleType.BUNGIE, moduleConfig: { subreddits: ["r/DestinyTheGame", "r/destiny2"] }, accentColor: "#4F88C6", logoUrl: "https://www.bungie.net/img/logos/bungie-saber-logo.png", bannerUrl: null, websiteUrl: "https://www.bungie.net" },
  { id: "news", name: "News", description: "Breaking news and headlines from around the world. CBC, BBC, Reuters, and more.", keywords: ["news","breaking","headlines","world","canada","politics","tech","business","science"], moduleType: ModuleType.NEWS, moduleConfig: {}, accentColor: "#DC2626" },
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
async function getSiteConfig(key: string): Promise<string | null> {
  const row = await (prisma as any).siteConfig.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function setSiteConfig(key: string, value: string): Promise<void> {
  await (prisma as any).siteConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

async function getAllSiteConfig(): Promise<Record<string, string>> {
  const rows = await (prisma as any).siteConfig.findMany();
  const config: Record<string, string> = {};
  for (const r of rows) config[r.key] = r.value;
  return config;
}

// Default config values — used when keys don't exist in DB yet
const SITE_CONFIG_DEFAULTS: Record<string, string> = {
  featuredLobbyId: "",
  registrationOpen: "true",
  maintenanceMode: "false",
  defaultTier: "INNOCENT",
  maxRoomsPerLobby: "50",
  chatRateLimit: "30",
};
// ── Room helpers ──────────────────────────────────────────────────────────────

function makeEmptyRoom(roomId: string): RoomState {
  return {
    roomId, name: "",
    users: new Map(), sockets: new Set(), msgs: [],
    ownerId: undefined, mods: new Set(), banned: new Set(), muted: new Set(),
    locked: false, knocks: [], pending: new Map(), audit: [], activeModule: null, ytState: null, lastActiveAt: Date.now(), pinned: false,
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
    r.passwordHash = (dbRoom as any).passwordHash || undefined;
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
    activeModule: room.activeModule || null,
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

  // Mark last activity so dissolution timer knows when the room went idle
  room.lastActiveAt = Date.now();
  // Don't delete immediately — let the dissolution interval handle cleanup after TTL
}
// ── Notoriety system ──────────────────────────────────────────────────────────
// Point values per action (idempotent where flagged)
const NOTORIETY_ACTIONS: Record<string, { points: number; once?: boolean; cooldown?: number }> = {
  BIO_COMPLETE:        { points: 50,   once: true  },
  FIRST_ROOM_HOSTED:   { points: 100,  once: true  },
  ROOM_25_USERS:       { points: 250,  once: false },
  SUBREDDIT_LINKED:    { points: 75,   once: true  },
  DAILY_ACTIVE:        { points: 10,   once: false, cooldown: 86400000 },  // 24h
  CHAT_MESSAGE:        { points: 2,    once: false, cooldown: 30000   },   // 30s cooldown
  ROOM_JOINED:         { points: 5,    once: false, cooldown: 60000   },   // 1min cooldown
  VOICE_JOINED:        { points: 15,   once: false, cooldown: 300000  },   // 5min cooldown
  CREW_CREATED:        { points: 100,  once: true  },
  CREW_JOINED:         { points: 25,   once: false },
  FRIEND_ADDED:        { points: 15,   once: false },
  LOBBY_CREATED:       { points: 200,  once: false },
  AVATAR_SET:          { points: 30,   once: true  },
  BUNGIE_LINKED:       { points: 75,   once: true  },
};

// Notoriety rank titles (cosmetic only — does NOT affect Stripe tier)
const NOTORIETY_RANKS = [
  { title: "Street Rat",   min: 0    },
  { title: "Corner Boy",   min: 100  },
  { title: "Hustler",      min: 300  },
  { title: "Shot Caller",  min: 500  },
  { title: "Enforcer",     min: 1000 },
  { title: "Made Man",     min: 1500 },
  { title: "Underboss",    min: 3000 },
  { title: "Crime Lord",   min: 5000 },
  { title: "Kingpin",      min: 10000},
];

function getNotorietyRank(n: number): { title: string; min: number; next: { title: string; min: number } | null } {
  let rank = NOTORIETY_RANKS[0];
  for (const r of NOTORIETY_RANKS) {
    if (n >= r.min) rank = r;
  }
  const idx = NOTORIETY_RANKS.indexOf(rank);
  const next = idx < NOTORIETY_RANKS.length - 1 ? NOTORIETY_RANKS[idx + 1] : null;
  return { ...rank, next };
}

// Cooldown tracking (in-memory, resets on restart — good enough for rate limiting XP)
const notorietyCooldowns = new Map<string, number>();

// Track one-time awards in a simple DB table — for now use a JSON field on User
// or a separate NotorietyEvent table. Using NotorietyEvent for auditability.
async function awardNotoriety(userId: string, action: string): Promise<number | null> {
  const cfg = NOTORIETY_ACTIONS[action];
  if (!cfg) return null;

  try {
    // Check cooldown
    if (cfg.cooldown) {
      const key = `${userId}:${action}`;
      const last = notorietyCooldowns.get(key) || 0;
      if (Date.now() - last < cfg.cooldown) return null;
      notorietyCooldowns.set(key, Date.now());
    }

    if (cfg.once) {
      // Check if already awarded
      const existing = await prisma.notorietyEvent.findFirst({
        where: { userId, action },
      });
      
      if (existing) return null;
    }

    await prisma.$transaction([
      prisma.notorietyEvent.create({ data: { userId, action, points: cfg.points } }),
      prisma.user.update({
        where: { id: userId },
        data: { notoriety: { increment: cfg.points } },
      }),
    ]);

    // Send realtime XP notification via WebSocket
    for (const sock of wss.clients) {
      if ((sock as any).user?.id === userId) {
        send(sock as any, { type: "notoriety:award", action, points: cfg.points });
      }
    }

    return cfg.points;
  } catch (e) {
    console.error("[notoriety] award failed", action, userId, e);
    return null;
  }
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

function isUserOnline(userId: string): boolean {
  for (const sock of wss.clients) {
    if ((sock as any).user?.id === userId) return true;
  }
  return false;
}

async function sendPush(userId: string, data: { title: string; body: string; url?: string; tag?: string }) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(data)
      );
    } catch (e: any) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      }
    }
  }
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
    const u = await prisma.user.findUnique({ where: { id: user.id }, select: { globalRole: true, tier: true, avatarColor: true, avatar: true } });
    return { ...user, globalRole: String(u?.globalRole ?? "USER"), tier: String(u?.tier ?? "INNOCENT"), avatarColor: u?.avatarColor ?? undefined, avatar: u?.avatar ?? undefined };
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
  room.lastActiveAt = Date.now();
  if (ws.user) room.pending.delete(ws.user.id);

  if (ws.user && !room.users.has(ws.user.id)) {
    const userEntry = { id: ws.user.id, name: ws.user.name, globalRole: ws.user.globalRole || "USER", tier: ws.user.tier || "INNOCENT", avatarColor: ws.user.avatarColor ?? undefined, avatar: ws.user.avatar ?? undefined };
    room.users.set(ws.user.id, userEntry);
    broadcast(room, { type: "presence:join", roomId, user: userEntry });
  }

  if (ws.user) { try { await persistMember(room, ws.user); } catch {} }

  // Award notoriety for joining a room (cooldown-gated)
  if (ws.user) awardNotoriety(ws.user.id, "ROOM_JOINED").catch(() => {});

  // Only send full state to the joining socket — everyone else already got presence:join
  publishStateToSocket(ws, room);

  if (room.msgs.length) {
    send(ws, { type: "chat:history", roomId, msgs: room.msgs.slice(-80) });
  }

  // Send current YouTube state so late joiners see what everyone is watching
  if (room.ytState) {
    send(ws, { type: "youtube:state", roomId, ...room.ytState });
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
      const { Readable } = await import("stream");
      const copy = new Readable();
      copy.push(raw);
      copy.push(null);
      return copy;
    }
    return payload;
  });
  // GET /featured — public endpoint returning featured lobby for homepage hero
  app.get("/featured", async (_req, reply) => {
    const featuredId = await getSiteConfig("featuredLobbyId");
    if (!featuredId) {
      // Fallback: return first pinned lobby by name
      const fallback = await (prisma as any).lobby.findFirst({
        where: { pinned: true },
        select: {
          id: true, name: true, description: true, verified: true, pinned: true,
          moduleType: true, moduleConfig: true, keywords: true,
          accentColor: true, logoUrl: true, bannerUrl: true, websiteUrl: true,
          _count: { select: { rooms: true, members: true } },
        },
        orderBy: { name: "asc" },
      });
      return reply.send({ ok: true, lobby: fallback || null, source: "fallback" });
    }

    const lobby = await (prisma as any).lobby.findUnique({
      where: { id: featuredId },
      select: {
        id: true, name: true, description: true, verified: true, pinned: true,
        moduleType: true, moduleConfig: true, keywords: true,
        accentColor: true, logoUrl: true, bannerUrl: true, websiteUrl: true,
        _count: { select: { rooms: true, members: true } },
      },
    });

    if (!lobby) {
      return reply.send({ ok: true, lobby: null, source: "missing" });
    }

    return reply.send({ ok: true, lobby, source: "config" });
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
    const reserved = await isNameReserved(username, "USERNAME");
    if (reserved) return reply.code(403).send({ error: "This username is reserved and cannot be used." });
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
    if (user.banned) return reply.code(403).send({ ok: false, error: "banned", message: "Your account has been suspended." });
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
      if (user.banned) return reply.redirect(`${WEB_URL}/login?error=account_suspended`);
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
    const reserved = await isNameReserved(usernameKey, "USERNAME");
    if (reserved) return reply.code(403).send({ error: "This username is reserved and cannot be used." });
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
    awardNotoriety(u.id, "VOICE_JOINED").catch(() => {});
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
      select: { id: true, name: true, description: true, locked: true, ownerId: true, _count: { select: { members: true } } },
    });
    const out = list.map(r => {
      const wsRoom = rooms.get(r.id);
      const onlineUsers: { id: string; name: string; avatar?: string }[] = [];
      if (wsRoom?.users) {
        for (const [uid, u] of wsRoom.users) {
          if (onlineUsers.length >= 4) break;
          onlineUsers.push({ id: uid, name: u?.name || uid, avatar: u?.avatar || undefined });
        }
      }
      return {
        id: r.id, roomId: r.id, name: r.name || r.id, description: r.description || "",
        onlineCount: wsRoom?.users?.size ?? 0, onlineUsers,
        locked: Boolean(r.locked), lobbyId, ownerId: r.ownerId,
        hasPassword: !!(wsRoom?.passwordHash || (r as any).passwordHash),
        _count: r._count,
      };
    });
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
    const rawPassword = typeof body.password === "string" ? body.password.trim() : "";
    const passwordHash = rawPassword ? await bcrypt.hash(rawPassword, 10) : null;
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
    if (passwordHash) r.passwordHash = passwordHash;
    rooms.set(id, r);
    return reply.send({ ok: true, id, roomId: id, room: { id, roomId: id, name, locked: false, lobbyId, hasPassword: !!passwordHash } });
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
      select: { id: true, name: true, usernameKey: true, globalRole: true, tier: true, notoriety: true, email: true, banned: true, banReason: true, createdAt: true },
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
  // POST /staff/broadcast — send a system message to all connected users
  app.post("/staff/broadcast", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const body: any = (req as any).body || {};
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 500) : "";
    const level = ["info", "warning", "urgent"].includes(body.level) ? body.level : "info";
    if (!message) return reply.code(400).send({ ok: false, error: "message required" });
    const payload = { type: "system:broadcast", message, level, from: u.name, ts: Date.now() };
    const sent = new Set<string>();
    for (const room of rooms.values()) {
      for (const s of room.sockets) {
        const sid = s.user?.id;
        if (!sid || sent.has(sid)) continue;
        sent.add(sid);
        send(s, payload);
      }
    }
    await globalAudit(u.id, u.name, "system_broadcast", undefined, undefined, { message, level });
    return reply.send({ ok: true, sent: sent.size });
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

  // POST /staff/users/:userId/ban — global platform ban
  app.post("/staff/users/:userId/ban", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const targetId = String((req as any).params?.userId || "");
    if (targetId === u.id) return reply.code(400).send({ ok: false, error: "cannot_ban_self" });

    const target = await prisma.user.findUnique({ where: { id: targetId }, select: { name: true, globalRole: true, banned: true } });
    if (!target) return reply.code(404).send({ ok: false, error: "user_not_found" });
    if (target.globalRole === GlobalRole.GOD) return reply.code(403).send({ ok: false, error: "cannot_ban_god" });
    if (target.banned) return reply.code(400).send({ ok: false, error: "already_banned" });

    const body: any = (req as any).body || {};
    const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : "";

    // Set banned flag on user
    await prisma.user.update({
      where: { id: targetId },
      data: { banned: true, banReason: reason || null, bannedAt: new Date(), bannedBy: u.id },
    });

    // Kick from all rooms (same as global kick)
    for (const room of rooms.values()) {
      if (room.users.has(targetId) || room.mods.has(targetId)) {
        room.users.delete(targetId);
        room.mods.delete(targetId);
        for (const s of findSocketsByUser(room, targetId)) {
          send(s, { type: "staff:banned", roomId: room.roomId, reason });
          try { (s as any).close(4002, "staff:ban"); } catch {}
        }
        broadcast(room, { type: "presence:leave", roomId: room.roomId, userId: targetId });
        publishState(room);
      }
    }

    await globalAudit(u.id, u.name, "global_ban", targetId, target.name, { reason });
    return reply.send({ ok: true });
  });

  // DELETE /staff/users/:userId/ban — unban user
  app.delete("/staff/users/:userId/ban", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const targetId = String((req as any).params?.userId || "");
    const target = await prisma.user.findUnique({ where: { id: targetId }, select: { name: true, banned: true } });
    if (!target) return reply.code(404).send({ ok: false, error: "user_not_found" });
    if (!target.banned) return reply.code(400).send({ ok: false, error: "not_banned" });

    await prisma.user.update({
      where: { id: targetId },
      data: { banned: false, banReason: null, bannedAt: null, bannedBy: null },
    });

    await globalAudit(u.id, u.name, "global_unban", targetId, target.name);
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
      select: { id: true, name: true, locked: true, createdAt: true, lobbyId: true, _count: { select: { members: true } } },
    });
    const roomsMem = new Map([...rooms.entries()]);
    const enriched = list.map(r => {
    const mem = roomsMem.get(r.id);
    return {
      id: r.id, name: r.name || "", locked: Boolean(r.locked),
      members: r._count.members, createdAt: r.createdAt.toISOString(),
      lobbyId: r.lobbyId || null,
      pinned: mem?.pinned || false,
      liveUsers: mem?.users.size || 0,
      lastActiveAt: mem?.lastActiveAt || null,
    };
  });
  return reply.send({ ok: true, rooms: enriched });
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

      // Linked game accounts (public info only)
      const gameAccounts = await prisma.userGameAccount.findMany({
        where: { userId: u.id },
        select: { gameType: true, displayName: true, platform: true, createdAt: true },
      });

      const nRank = getNotorietyRank(u.notoriety ?? 0);
      return reply.send({
        id: u.id,
        name: u.name,
        bio: u.bio || "",
        notoriety: u.notoriety ?? 0,
        notorietyRank: nRank.title,
        notorietyNext: nRank.next ? { title: nRank.next.title, min: nRank.next.min } : null,
        tier: u.tier ?? "INNOCENT",
        globalRole: String(u.globalRole ?? "USER"),
        joinedAt: u.createdAt.toISOString(),
        lastSeen: u.updatedAt.toISOString(),
        roomsHosted,
        avatar: u.avatar || null,
        avatarColor: u.avatarColor || null,
        gameAccounts: gameAccounts.map(a => ({
          gameType: a.gameType,
          displayName: a.displayName,
          platform: a.platform,
          linkedAt: a.createdAt.toISOString(),
        })),
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
        if (avatar !== undefined && avatar) awardNotoriety(viewer.id, "AVATAR_SET").catch(() => {});
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

  // ── Avatar upload (Indicted+ only) ────────────────────────────────────────
  const AVATAR_DIR = join(process.cwd(), "uploads", "avatars");
  if (!existsSync(AVATAR_DIR)) mkdirSync(AVATAR_DIR, { recursive: true });
  const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2MB
  const SITE_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

  app.post("/profile/avatar/upload", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "unauthorized" });

    // Tier gate — Indicted+ only
    const dbUser = await prisma.user.findUnique({ where: { id: u.id }, select: { tier: true } });
    const tier = String(dbUser?.tier ?? "INNOCENT").toUpperCase();
    if (tier === "INNOCENT") {
      return reply.code(403).send({ error: "tier_required", message: "Custom avatar uploads require Indicted tier or higher." });
    }

    const body: any = (req as any).body || {};
    const dataUrl = body.image;
    if (!dataUrl || typeof dataUrl !== "string") {
      return reply.code(400).send({ error: "missing_image" });
    }

    // Validate data URL format
    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/);
    if (!match) {
      return reply.code(400).send({ error: "invalid_format", message: "Image must be PNG, JPEG, WebP, or GIF." });
    }

    const ext = match[1] === "jpeg" || match[1] === "jpg" ? "jpg" : match[1];
    const buffer = Buffer.from(match[2], "base64");

    if (buffer.length > AVATAR_MAX_BYTES) {
      return reply.code(400).send({ error: "too_large", message: "Image must be under 2MB." });
    }

    try {
      const filename = `${u.id}-${Date.now()}.${ext}`;
      const filepath = join(AVATAR_DIR, filename);
      writeFileSync(filepath, buffer);

      const avatarUrl = `${SITE_BASE}/avatars/${filename}`;

      // Update user record
      await prisma.user.update({
        where: { id: u.id },
        data: { avatar: avatarUrl },
      });

      // Award notoriety for setting avatar
      awardNotoriety(u.id, "AVATAR_SET").catch(() => {});

      // Update live WS presence
      for (const sock of wss.clients) {
        const s = sock as Sock;
        if (s.user?.id === u.id) {
          s.user.avatar = avatarUrl;
          if (s.roomId) {
            const room = rooms.get(s.roomId);
            if (room) {
              const entry = room.users.get(u.id);
              if (entry) (entry as any).avatar = avatarUrl;
              publishState(room);
            }
          }
        }
      }

      return reply.send({ ok: true, avatar: avatarUrl });
    } catch (e) {
      console.error("[avatar upload]", e);
      return reply.code(500).send({ error: "upload_failed" });
    }
  });

  // Serve uploaded avatars as static files
  app.get("/avatars/:filename", async (req, reply) => {
    const filename = String((req as any).params?.filename || "").replace(/[^a-zA-Z0-9._-]/g, "");
    if (!filename) return reply.code(400).send("bad request");
    const filepath = join(AVATAR_DIR, filename);
    if (!existsSync(filepath)) return reply.code(404).send("not found");

    const ext = filename.split(".").pop()?.toLowerCase();
    const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg";

    const { readFileSync } = await import("fs");
    const data = readFileSync(filepath);
    reply.header("Content-Type", mime);
    reply.header("Cache-Control", "public, max-age=31536000, immutable");
    return reply.send(data);
  });

  // GET /notoriety/me — current user's notoriety score, rank, recent events, next milestone
  app.get("/notoriety/me", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "unauthorized" });

    const dbUser = await prisma.user.findUnique({
      where: { id: u.id },
      select: { notoriety: true },
    });
    const score = dbUser?.notoriety ?? 0;
    const rank = getNotorietyRank(score);

    const recentEvents = await prisma.notorietyEvent.findMany({
      where: { userId: u.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { action: true, points: true, createdAt: true },
    });

    return reply.send({
      ok: true,
      score,
      rank: rank.title,
      rankMin: rank.min,
      nextRank: rank.next ? { title: rank.next.title, min: rank.next.min, pointsNeeded: rank.next.min - score } : null,
      recentEvents,
      ranks: NOTORIETY_RANKS,
    });
  });

  // GET /notoriety/leaderboard — top users by notoriety
  app.get("/notoriety/leaderboard", async (req, reply) => {
    const limit = Math.min(Number((req as any).query?.limit || 25), 50);
    const leaders = await prisma.user.findMany({
      orderBy: { notoriety: "desc" },
      take: limit,
      select: { id: true, name: true, notoriety: true, tier: true, avatar: true, avatarColor: true },
    });
    const ranked = leaders.map((u, i) => ({
      position: i + 1,
      id: u.id,
      name: u.name,
      score: u.notoriety,
      rank: getNotorietyRank(u.notoriety).title,
      tier: u.tier,
      avatar: u.avatar,
      avatarColor: u.avatarColor,
    }));
    return reply.send({ ok: true, leaders: ranked });
  });

  // GET /crews/leaderboard — top crews by aggregate member notoriety
  app.get("/crews/leaderboard", async (req, reply) => {
    const limit = Math.min(Number((req as any).query?.limit || 25), 50);
    const db = prisma as any;
    const crews = await db.crew.findMany({
      include: { members: { select: { userId: true } } },
      take: 100,
    });
    // Aggregate scores
    const crewScores: { id: string; name: string; tag: string; memberCount: number; totalScore: number }[] = [];
    for (const crew of crews) {
      const userIds = crew.members.map((m: any) => m.userId);
      if (!userIds.length) continue;
      const agg = await prisma.user.aggregate({
        where: { id: { in: userIds } },
        _sum: { notoriety: true },
      });
      crewScores.push({
        id: crew.id,
        name: crew.name,
        tag: crew.tag,
        memberCount: userIds.length,
        totalScore: agg._sum.notoriety ?? 0,
      });
    }
    crewScores.sort((a, b) => b.totalScore - a.totalScore);
    const ranked = crewScores.slice(0, limit).map((c, i) => ({
      position: i + 1,
      ...c,
      rank: getNotorietyRank(Math.floor(c.totalScore / c.memberCount)).title,
    }));
    return reply.send({ ok: true, leaders: ranked });
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
  // POST /staff/rooms/:roomId/rename — rename a room
  app.post("/staff/rooms/:roomId/rename", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const roomId = String((req as any).params?.roomId || "");
    const body: any = (req as any).body || {};
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
    if (!name) return reply.code(400).send({ ok: false, error: "name required" });

    // Update DB
    try {
      await prisma.room.update({ where: { id: roomId }, data: { name } });
    } catch {
      return reply.code(404).send({ ok: false, error: "room_not_found" });
    }

    // Update in-memory
    const room = rooms.get(roomId);
    if (room) {
      room.name = name;
      publishState(room);
    }

    await globalAudit(u.id, u.name, "room_rename", roomId, undefined, { name });
    return reply.send({ ok: true, name });
  });

  // POST /staff/rooms/:roomId/pin — pin/unpin a room (pinned rooms don't dissolve)
  app.post("/staff/rooms/:roomId/pin", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const roomId = String((req as any).params?.roomId || "");
    const body: any = (req as any).body || {};
    const pinned = body.pinned !== false; // default to pinning

    // Update in-memory
    const room = rooms.get(roomId);
    if (room) {
      room.pinned = pinned;
    }

    await globalAudit(u.id, u.name, pinned ? "room_pin" : "room_unpin", roomId);
    return reply.send({ ok: true, pinned });
  });

  // POST /staff/rooms/:roomId/close — staff force-close a room
  app.post("/staff/rooms/:roomId/close", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const roomId = String((req as any).params?.roomId || "");
    const room = rooms.get(roomId);

    if (room) {
      // Kick everyone
      for (const s of room.sockets) {
        send(s, { type: "room:closed", roomId, by: u.name });
        try { s.close(4004, "room:closed"); } catch {}
      }
      room.users.clear();
      room.sockets.clear();
      rooms.delete(roomId);
    }

    // Delete from DB
    try {
      await prisma.roomMessage.deleteMany({ where: { roomId } }).catch(() => {});
      await prisma.roomMember.deleteMany({ where: { roomId } }).catch(() => {});
      await prisma.room.delete({ where: { id: roomId } }).catch(() => {});
    } catch {}

    await globalAudit(u.id, u.name, "room_close", roomId);
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
      awardNotoriety(u.id, "CREW_JOINED").catch(() => {});
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
      // Push notification if peer is offline
      if (!isUserOnline(peerId)) {
        sendPush(peerId, { title: `DM from ${viewer.name}`, body: text.slice(0, 120), url: "/home", tag: `dm:${viewer.id}` }).catch(() => {});
      }
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

  // ── Forum ─────────────────────────────────────────────────────────────────

  async function enrichForumAuthors(authorIds: string[]): Promise<Record<string, any>> {
    if (!authorIds.length) return {};
    const users = await prisma.user.findMany({
      where: { id: { in: [...new Set(authorIds)] } },
      select: { id: true, name: true, avatar: true, avatarColor: true, tier: true, globalRole: true },
    });
    const map: Record<string, any> = {};
    for (const u of users) map[u.id] = u;
    return map;
  }

  // Forum mod check: global staff OR lobby owner/mod
  async function canModForumPost(userId: string, post: { lobbyId: string | null; authorId: string }): Promise<{ canDelete: boolean; canLock: boolean; canPin: boolean; canAnnounce: boolean }> {
    const globalRole = await getGlobalRole(userId);
    if (canAccessStaff(globalRole)) return { canDelete: true, canLock: true, canPin: true, canAnnounce: true };
    // Author can delete own posts
    const isAuthor = post.authorId === userId;
    if (!post.lobbyId) return { canDelete: isAuthor, canLock: false, canPin: false, canAnnounce: false };
    // Check lobby role
    const lobbyRole = await getLobbyRole(userId, post.lobbyId);
    const isOwner = lobbyRole === LobbyRole.OWNER;
    const isMod = lobbyRole === LobbyRole.MOD || isOwner;
    return {
      canDelete: isAuthor || isMod,
      canLock: isMod,
      canPin: isOwner || canAccessStaff(globalRole),
      canAnnounce: isOwner || canAccessStaff(globalRole),
    };
  }

  // GET /forum/posts — list posts (paginated, sorted, filtered)
  app.get("/forum/posts", async (req, reply) => {
    const sort = String((req as any).query?.sort || "hot").toLowerCase();
    const cat = String((req as any).query?.category || "").toUpperCase();
    const limit = Math.min(Number((req as any).query?.limit) || 25, 50);
    const cursor = String((req as any).query?.cursor || "");

    const u = authFromHeader((req as any).headers?.authorization);

    const lobbyId = String((req as any).query?.lobbyId || "").trim() || undefined;

    const where: any = {};
    if (lobbyId) where.lobbyId = lobbyId;
    if (cat && ["BUG_REPORT", "FEATURE_REQUEST", "DISCUSSION", "ANNOUNCEMENT"].includes(cat)) {
      where.category = cat;
    }
    if (cursor) where.createdAt = { lt: new Date(cursor) };

    let posts: any[];
    if (sort === "top") {
      posts = await prisma.forumPost.findMany({ where, orderBy: [{ pinned: "desc" }, { score: "desc" }, { createdAt: "desc" }], take: limit });
    } else if (sort === "new") {
      posts = await prisma.forumPost.findMany({ where, orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: limit });
    } else {
      // Hot: fetch recent, score in JS
      posts = await prisma.forumPost.findMany({ where, orderBy: [{ createdAt: "desc" }], take: 100 });
      posts.sort((a: any, b: any) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        const ha = a.score / Math.pow((Date.now() - new Date(a.createdAt).getTime()) / 3600000 + 2, 1.5);
        const hb = b.score / Math.pow((Date.now() - new Date(b.createdAt).getTime()) / 3600000 + 2, 1.5);
        return hb - ha;
      });
      posts = posts.slice(0, limit);
    }

    const authorMap = await enrichForumAuthors(posts.map((p: any) => p.authorId));
    let myVotes: Record<string, number> = {};
    if (u) {
      const votes = await prisma.forumVote.findMany({ where: { userId: u.id, postId: { in: posts.map((p: any) => p.id) } } });
      for (const v of votes) if (v.postId) myVotes[v.postId] = v.value;
    }

    const out = posts.map((p: any) => ({
      ...p,
      body: p.body.slice(0, 200),
      author: authorMap[p.authorId] || null,
      myVote: myVotes[p.id] || 0,
    }));

    const nextCursor = posts.length === limit ? posts[posts.length - 1].createdAt.toISOString() : null;
    return reply.send({ ok: true, posts: out, nextCursor });
  });

  // POST /forum/posts — create post
  app.post("/forum/posts", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const { title, body, category, lobbyId } = (req as any).body || {};
    if (!title?.trim() || !body?.trim()) return reply.code(400).send({ error: "Title and body required" });
    if (title.trim().length > 200) return reply.code(400).send({ error: "Title too long" });
    if (body.trim().length > 10000) return reply.code(400).send({ error: "Body too long" });

    let cat = String(category || "DISCUSSION").toUpperCase();
    if (!["BUG_REPORT", "FEATURE_REQUEST", "DISCUSSION", "ANNOUNCEMENT"].includes(cat)) cat = "DISCUSSION";
    if (cat === "ANNOUNCEMENT") {
      const globalRole = await getGlobalRole(u.id);
      let canAnnounce = canAccessStaff(globalRole);
      if (!canAnnounce && lobbyId) {
        const lr = await getLobbyRole(u.id, String(lobbyId).trim());
        canAnnounce = lr === LobbyRole.OWNER;
      }
      if (!canAnnounce) cat = "DISCUSSION";
    }

    const user = await prisma.user.findUnique({ where: { id: u.id }, select: { name: true } });
    const validLobbyId = lobbyId ? String(lobbyId).trim() : null;
    const post = await prisma.forumPost.create({
      data: { title: title.trim(), body: body.trim(), category: cat as any, authorId: u.id, authorName: user?.name || "Unknown", lobbyId: validLobbyId },
    });
    return reply.send({ ok: true, post });
  });

  // GET /forum/posts/:postId — single post + comments
  app.get("/forum/posts/:postId", async (req, reply) => {
    const postId = String((req as any).params?.postId || "");
    const u = authFromHeader((req as any).headers?.authorization);

    const post = await prisma.forumPost.findUnique({ where: { id: postId }, include: { comments: { orderBy: { createdAt: "asc" } } } });
    if (!post) return reply.code(404).send({ error: "Post not found" });

    const allAuthorIds = [post.authorId, ...post.comments.map(c => c.authorId)];
    const authorMap = await enrichForumAuthors(allAuthorIds);

    let myPostVote = 0;
    let myCommentVotes: Record<string, number> = {};
    if (u) {
      const pv = await prisma.forumVote.findFirst({ where: { userId: u.id, postId } });
      if (pv) myPostVote = pv.value;
      const cvs = await prisma.forumVote.findMany({ where: { userId: u.id, commentId: { in: post.comments.map(c => c.id) } } });
      for (const v of cvs) if (v.commentId) myCommentVotes[v.commentId] = v.value;
    }

    // Check mod permissions (global staff + lobby owner/mod)
    const modPerms = u ? await canModForumPost(u.id, post) : { canDelete: false, canLock: false, canPin: false, canAnnounce: false };
    const isMod = modPerms.canLock || modPerms.canPin;

    return reply.send({
      ok: true,
      post: { ...post, comments: undefined, author: authorMap[post.authorId] || null, myVote: myPostVote },
      comments: post.comments.map(c => ({ ...c, author: authorMap[c.authorId] || null, myVote: myCommentVotes[c.id] || 0 })),
      isMod,
      modPerms,
    });
  });

  // POST /forum/posts/:postId/vote — upvote/downvote post
  app.post("/forum/posts/:postId/vote", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const postId = String((req as any).params?.postId || "");
    const value = Number((req as any).body?.value || 0);
    if (![1, -1, 0].includes(value)) return reply.code(400).send({ error: "Invalid vote" });

    const existing = await prisma.forumVote.findFirst({ where: { userId: u.id, postId } });
    const oldValue = existing?.value || 0;
    const diff = value - oldValue;

    if (value === 0 && existing) {
      await prisma.forumVote.delete({ where: { id: existing.id } });
    } else if (existing) {
      await prisma.forumVote.update({ where: { id: existing.id }, data: { value } });
    } else if (value !== 0) {
      await prisma.forumVote.create({ data: { userId: u.id, postId, value } });
    }
    if (diff !== 0) {
      await prisma.forumPost.update({ where: { id: postId }, data: { score: { increment: diff } } });
    }

    const post = await prisma.forumPost.findUnique({ where: { id: postId }, select: { score: true } });
    return reply.send({ ok: true, score: post?.score || 0 });
  });

  // POST /forum/posts/:postId/comments — add comment
  app.post("/forum/posts/:postId/comments", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const postId = String((req as any).params?.postId || "");
    const { body } = (req as any).body || {};
    if (!body?.trim()) return reply.code(400).send({ error: "Comment body required" });
    if (body.trim().length > 5000) return reply.code(400).send({ error: "Comment too long" });

    const post = await prisma.forumPost.findUnique({ where: { id: postId } });
    if (!post) return reply.code(404).send({ error: "Post not found" });
    if (post.locked) return reply.code(403).send({ error: "Post is locked" });

    const user = await prisma.user.findUnique({ where: { id: u.id }, select: { name: true } });
    const comment = await prisma.forumComment.create({
      data: { postId, authorId: u.id, authorName: user?.name || "Unknown", body: body.trim() },
    });
    await prisma.forumPost.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } });

    const authorMap = await enrichForumAuthors([u.id]);
    return reply.send({ ok: true, comment: { ...comment, author: authorMap[u.id] || null, myVote: 0 } });
  });

  // POST /forum/comments/:commentId/vote — upvote/downvote comment
  app.post("/forum/comments/:commentId/vote", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const commentId = String((req as any).params?.commentId || "");
    const value = Number((req as any).body?.value || 0);
    if (![1, -1, 0].includes(value)) return reply.code(400).send({ error: "Invalid vote" });

    const existing = await prisma.forumVote.findFirst({ where: { userId: u.id, commentId } });
    const oldValue = existing?.value || 0;
    const diff = value - oldValue;

    if (value === 0 && existing) {
      await prisma.forumVote.delete({ where: { id: existing.id } });
    } else if (existing) {
      await prisma.forumVote.update({ where: { id: existing.id }, data: { value } });
    } else if (value !== 0) {
      await prisma.forumVote.create({ data: { userId: u.id, commentId, value } });
    }
    if (diff !== 0) {
      await prisma.forumComment.update({ where: { id: commentId }, data: { score: { increment: diff } } });
    }

    const comment = await prisma.forumComment.findUnique({ where: { id: commentId }, select: { score: true } });
    return reply.send({ ok: true, score: comment?.score || 0 });
  });

  // PATCH /forum/posts/:postId — pin/lock (lobby mod/owner or global staff)
  app.patch("/forum/posts/:postId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });

    const postId = String((req as any).params?.postId || "");
    const existing = await prisma.forumPost.findUnique({ where: { id: postId } });
    if (!existing) return reply.code(404).send({ error: "Post not found" });

    const perms = await canModForumPost(u.id, existing);
    const { pinned, locked } = (req as any).body || {};
    const data: any = {};
    if (typeof pinned === "boolean") {
      if (!perms.canPin) return reply.code(403).send({ error: "Only lobby owners and staff can pin" });
      data.pinned = pinned;
    }
    if (typeof locked === "boolean") {
      if (!perms.canLock) return reply.code(403).send({ error: "Forbidden" });
      data.locked = locked;
    }

    const post = await prisma.forumPost.update({ where: { id: postId }, data });
    return reply.send({ ok: true, post });
  });

  // DELETE /forum/posts/:postId — delete post (mod or author)
  app.delete("/forum/posts/:postId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const postId = String((req as any).params?.postId || "");
    const post = await prisma.forumPost.findUnique({ where: { id: postId } });
    if (!post) return reply.code(404).send({ error: "Post not found" });

    const perms = await canModForumPost(u.id, post);
    if (!perms.canDelete) return reply.code(403).send({ error: "Forbidden" });

    await prisma.forumPost.delete({ where: { id: postId } });
    return reply.send({ ok: true });
  });

  // DELETE /forum/comments/:commentId — delete comment (lobby mod/owner, global staff, or author)
  app.delete("/forum/comments/:commentId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const commentId = String((req as any).params?.commentId || "");
    const comment = await prisma.forumComment.findUnique({ where: { id: commentId } });
    if (!comment) return reply.code(404).send({ error: "Comment not found" });

    // Check via the parent post's lobbyId
    const parentPost = await prisma.forumPost.findUnique({ where: { id: comment.postId }, select: { lobbyId: true, authorId: true } });
    const perms = await canModForumPost(u.id, { lobbyId: parentPost?.lobbyId || null, authorId: comment.authorId });
    if (!perms.canDelete) return reply.code(403).send({ error: "Forbidden" });

    await prisma.forumComment.delete({ where: { id: commentId } });
    await prisma.forumPost.update({ where: { id: comment.postId }, data: { commentCount: { decrement: 1 } } });
    return reply.send({ ok: true });
  });

  // ── News RSS ingestion worker ─────────────────────────────────────────────
  const NEWS_FEEDS = [
    // CBC (top + world work; others blocked from server)
    { url: "https://www.cbc.ca/webfeed/rss/rss-topstories",  category: "top",            source: "CBC News",    icon: "https://www.cbc.ca/favicon.ico" },
    { url: "https://www.cbc.ca/webfeed/rss/rss-world",       category: "world",           source: "CBC News",    icon: "https://www.cbc.ca/favicon.ico" },
    { url: "https://www.cbc.ca/webfeed/rss/rss-canada",      category: "canada",          source: "CBC News",    icon: "https://www.cbc.ca/favicon.ico" },
    { url: "https://www.cbc.ca/webfeed/rss/rss-technology",   category: "tech",            source: "CBC News",    icon: "https://www.cbc.ca/favicon.ico" },
    { url: "https://www.cbc.ca/webfeed/rss/rss-business",    category: "business",        source: "CBC News",    icon: "https://www.cbc.ca/favicon.ico" },
    { url: "https://www.cbc.ca/webfeed/rss/rss-sports",      category: "sports",          source: "CBC News",    icon: "https://www.cbc.ca/favicon.ico" },
    { url: "https://www.cbc.ca/webfeed/rss/rss-entertainment",category: "entertainment",  source: "CBC News",    icon: "https://www.cbc.ca/favicon.ico" },
    // BBC (reliable, always works)
    { url: "https://feeds.bbci.co.uk/news/world/rss.xml",    category: "world",           source: "BBC World",   icon: "https://www.bbc.co.uk/favicon.ico" },
    { url: "https://feeds.bbci.co.uk/news/technology/rss.xml",category: "tech",           source: "BBC Tech",    icon: "https://www.bbc.co.uk/favicon.ico" },
    { url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", category: "science", source: "BBC Science", icon: "https://www.bbc.co.uk/favicon.ico" },
    { url: "https://feeds.bbci.co.uk/news/business/rss.xml", category: "business",        source: "BBC Business",icon: "https://www.bbc.co.uk/favicon.ico" },
    { url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml", category: "entertainment", source: "BBC Arts", icon: "https://www.bbc.co.uk/favicon.ico" },
    { url: "https://feeds.bbci.co.uk/sport/rss.xml",         category: "sports",          source: "BBC Sport",   icon: "https://www.bbc.co.uk/favicon.ico" },
    // BBC Top Stories + Canada-relevant (these include <media:thumbnail>)
    { url: "https://feeds.bbci.co.uk/news/rss.xml",              category: "top",            source: "BBC News",    icon: "https://www.bbc.co.uk/favicon.ico" },
    // CTV + Global (Canadian sources with images)
    { url: "https://www.ctvnews.ca/rss/ctvnews-ca-top-stories-public-rss-1.822009", category: "canada", source: "CTV News", icon: "https://www.ctvnews.ca/favicon.ico" },
    { url: "https://globalnews.ca/feed/",                         category: "canada",         source: "Global News", icon: "https://globalnews.ca/favicon.ico" },
    // Google News (no images but good for headlines)
    { url: "https://news.google.com/rss?hl=en-CA&gl=CA&ceid=CA:en", category: "top",        source: "Google News", icon: "https://news.google.com/favicon.ico" },
    { url: "https://news.google.com/rss/search?q=canada+when:1d&hl=en-CA&gl=CA&ceid=CA:en", category: "canada", source: "Google News", icon: "https://news.google.com/favicon.ico" },
  ];

  async function fetchNewsRss(feedUrl: string, category: string, source: string, sourceIcon: string): Promise<any[]> {
    try {
      const res = await fetch(feedUrl, { headers: { "User-Agent": "Mozilla/5.0 (compatible; Weered/1.0)" } });
      const xml = await res.text();
      const items: any[] = [];
      const itemRx  = /<item[^>]*>([\s\S]*?)<\/item>/g;
      const titleRx = /<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/;
      const linkRx  = /<link>\s*(?:<!\[CDATA\[)?\s*(https?:\/\/[^<\s]+?)\s*(?:\]\]>)?\s*<\/link>/;
      const dateRx  = /<pubDate>(.*?)<\/pubDate>/;
      const descRx  = /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/;
      const imgRx1  = /<media:content[^>]+url=["']([^"']+)["']/;
      const imgRx2  = /<media:thumbnail[^>]+url=["']([^"']+)["']/;
      const imgRx3  = /<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image/;
      const imgRx4  = /<img[^>]+src=["']([^"']+)["']/;
      let m: RegExpExecArray | null;
      while ((m = itemRx.exec(xml)) !== null) {
        const block = m[1];
        const title = titleRx.exec(block)?.[1]?.trim();
        const link  = linkRx.exec(block)?.[1]?.trim();
        const dateStr = dateRx.exec(block)?.[1];
        const rawDesc = descRx.exec(block)?.[1] || "";
        const desc  = rawDesc
          .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&#x27;/g, "'")
          .replace(/<[^>]+>/g, " ")
          .replace(/https?:\/\/\S+/g, "")
          .replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, 250);
        const img   = imgRx4.exec(rawDesc)?.[1] || imgRx1.exec(block)?.[1] || imgRx2.exec(block)?.[1] || imgRx3.exec(block)?.[1] || null;
        if (!title || !link) continue;
        const publishedAt = dateStr ? new Date(dateStr) : new Date();
        items.push({
          guid: `${category}::${link}`,
          url: link,
          title,
          description: desc,
          imageUrl: img,
          source,
          sourceIcon,
          category,
          publishedAt,
          heat: recencyScore(publishedAt),
        });
      }
      return items.slice(0, 20);
    } catch (e) { console.warn(`[news] RSS ${feedUrl} failed:`, e); return []; }
  }

  const newsCache = new Map<string, { articles: any[]; cachedAt: number }>();
  const NEWS_CACHE_TTL = 5 * 60 * 1000;

  async function runNewsWorker() {
    console.log("[news] worker starting fetch...");
    try {
      const results = await Promise.allSettled(
        NEWS_FEEDS.map(f => fetchNewsRss(f.url, f.category, f.source, f.icon))
      );
      const all = results.flatMap(r => r.status === "fulfilled" ? r.value : []);
      const seen = new Set<string>();
      const deduped = all.filter(a => { if (!a.guid || seen.has(a.guid)) return false; seen.add(a.guid); return true; });

      let upserted = 0;
      for (const a of deduped) {
        try {
          await prisma.newsArticle.upsert({
            where: { guid: a.guid },
            update: { heat: a.heat, title: a.title, description: a.description, imageUrl: a.imageUrl },
            create: a,
          });
          upserted++;
        } catch {}
      }

      // Purge articles older than 72 hours
      await prisma.newsArticle.deleteMany({
        where: { publishedAt: { lt: new Date(Date.now() - 72 * 3600 * 1000) } },
      });

      newsCache.clear();
      console.log(`[news] worker done: ${upserted} upserted from ${deduped.length} articles`);
    } catch (e) { console.error("[news] worker error:", e); }
  }

  // GET /news/feed?category=top&limit=30
  app.get("/news/feed", async (req, reply) => {
    const category = String((req as any).query?.category || "top").toLowerCase();
    const limit = Math.min(Number((req as any).query?.limit) || 30, 60);
    const cacheKey = `feed:${category}:${limit}`;
    const cached = newsCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < NEWS_CACHE_TTL) {
      return reply.send({ ok: true, articles: cached.articles, updatedAt: new Date(cached.cachedAt).toISOString() });
    }
    const articles = await prisma.newsArticle.findMany({
      where: { category },
      orderBy: { heat: "desc" },
      take: limit,
    });
    newsCache.set(cacheKey, { articles, cachedAt: Date.now() });
    return reply.send({ ok: true, articles, updatedAt: new Date().toISOString() });
  });

  // GET /news/trending — top 10 across all categories
  app.get("/news/trending", async (_req, reply) => {
    const cached = newsCache.get("trending");
    if (cached && Date.now() - cached.cachedAt < NEWS_CACHE_TTL) {
      return reply.send({ ok: true, articles: cached.articles });
    }
    const articles = await prisma.newsArticle.findMany({
      orderBy: { heat: "desc" },
      take: 10,
    });
    newsCache.set("trending", { articles, cachedAt: Date.now() });
    return reply.send({ ok: true, articles });
  });

  // GET /news/reader?url=... — server-side article extraction (reader mode)
  const readerCache = new Map<string, { data: any; cachedAt: number }>();
  const READER_CACHE_TTL = 30 * 60 * 1000; // 30 min

  app.get("/news/reader", async (req, reply) => {
    const url = String((req as any).query?.url || "").trim();
    if (!url || !url.startsWith("http")) return reply.code(400).send({ ok: false, error: "url required" });

    // Check cache
    const cached = readerCache.get(url);
    if (cached && Date.now() - cached.cachedAt < READER_CACHE_TTL) {
      return reply.send(cached.data);
    }

    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Weered/1.0; +https://weered.ca)" },
        redirect: "follow",
      });
      if (!res.ok) return reply.code(502).send({ ok: false, error: "fetch_failed" });
      const html = await res.text();

      // Extract metadata
      const ogTitle    = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1]
                      || html.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i)?.[1] || "";
      const ogImage    = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1]
                      || html.match(/<meta[^>]+name="twitter:image"[^>]+content="([^"]+)"/i)?.[1] || null;
      const ogDesc     = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)?.[1]
                      || html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)?.[1] || "";
      const ogSiteName = html.match(/<meta[^>]+property="og:site_name"[^>]+content="([^"]+)"/i)?.[1] || "";
      const pubDate    = html.match(/<meta[^>]+property="article:published_time"[^>]+content="([^"]+)"/i)?.[1]
                      || html.match(/<time[^>]+datetime="([^"]+)"/i)?.[1] || null;
      const author     = html.match(/<meta[^>]+name="author"[^>]+content="([^"]+)"/i)?.[1]
                      || html.match(/<meta[^>]+property="article:author"[^>]+content="([^"]+)"/i)?.[1] || null;

      // Extract article body — try <article>, then <main>, then largest content block
      let body = "";
      const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
      const mainMatch    = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
      const rawBody      = articleMatch?.[1] || mainMatch?.[1] || "";

      if (rawBody) {
        // Extract paragraphs and headers from the article body
        const blocks: string[] = [];
        const blockRx = /<(h[1-6]|p|figcaption|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi;
        let bm: RegExpExecArray | null;
        while ((bm = blockRx.exec(rawBody)) !== null) {
          const tag  = bm[1].toLowerCase();
          let text = bm[2]
            .replace(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2')
            .replace(/<[^>]+>/g, "")
            .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
            .replace(/&#x27;/g, "'").replace(/&#x2F;/g, "/")
            .replace(/&#(\d+);/g, (_: string, n: string) => String.fromCharCode(Number(n)))
            .replace(/&#x([0-9a-fA-F]+);/g, (_: string, h: string) => String.fromCharCode(parseInt(h, 16)))
            .replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
          if (!text || text.length < 10) continue;
          if (tag.startsWith("h")) {
            blocks.push(`## ${text}`);
          } else if (tag === "blockquote") {
            blocks.push(`> ${text}`);
          } else {
            blocks.push(text);
          }
        }
        body = blocks.join("\n\n");

        // Extract inline images — aggressively filter ads/trackers
        const AD_PATTERNS = [
          "logo", "icon", "avatar", "1x1", "tracking", "pixel", "beacon",
          "doubleclick", "googlesyndication", "googleads", "adsystem", "adservice",
          "amazon-adsystem", "facebook.com/tr", "chartbeat", "scorecardresearch",
          "taboola", "outbrain", "sharethrough", "sponsor", "promo", "badge",
          "widget", "button", "banner", "advert", "newsletter", "signup",
          "data:image", "base64", ".gif", "spacer", "blank", "transparent",
          "tinyimg", "placeholder", "lazy", "emoji", "smiley",
        ];
        const imgRx = /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*?)["'])?[^>]*>/gi;
        const images: { src: string; alt: string }[] = [];
        let im: RegExpExecArray | null;
        while ((im = imgRx.exec(rawBody)) !== null) {
          const src = im[1];
          if (!src || src.length < 20) continue;
          const srcLower = src.toLowerCase();
          if (AD_PATTERNS.some(p => srcLower.includes(p))) continue;
          // Must be a proper image URL
          if (!srcLower.startsWith("http") && !srcLower.startsWith("//")) continue;
          // Skip tiny dimension hints in URL (e.g. 1x1, 2x2)
          if (/\b[12]x[12]\b/.test(src)) continue;
          images.push({ src, alt: im[2] || "" });
        }
        // Inject up to 2 images between paragraphs
        if (images.length && body) {
          const paras = body.split("\n\n");
          for (let i = 0; i < Math.min(images.length, 2); i++) {
            const pos = Math.min(2 + i * 4, paras.length);
            if (pos < paras.length) {
              paras.splice(pos, 0, `![${images[i].alt}](${images[i].src})`);
            }
          }
          body = paras.join("\n\n");
        }
      }

      // Decode HTML entities in extracted fields
      const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&#x27;/g, "'").replace(/&#x2F;/g, "/").replace(/&#(\d+);/g, (_,n) => String.fromCharCode(Number(n))).replace(/&#x([0-9a-fA-F]+);/g, (_,h) => String.fromCharCode(parseInt(h,16))).replace(/&nbsp;/g, " ").trim();

      const data = {
        ok: true,
        title: decode(ogTitle),
        description: decode(ogDesc),
        image: ogImage,
        siteName: decode(ogSiteName),
        author: author ? decode(author) : null,
        publishedAt: pubDate,
        body: body || decode(ogDesc),
        url,
      };

      readerCache.set(url, { data, cachedAt: Date.now() });
      return reply.send(data);
    } catch (e) {
      console.warn("[news] reader failed:", url, e);
      return reply.code(502).send({ ok: false, error: "extraction_failed" });
    }
  });

  // Start news worker on startup then every 15 minutes
  runNewsWorker();
  setInterval(runNewsWorker, 15 * 60 * 1000);

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
          // Block globally banned users from connecting
          if (await isGloballyBanned(ws.user.id)) {
            send(ws, { type: "auth:fail", reason: "Your account has been suspended." });
            try { ws.close(4003, "banned"); } catch {}
            return;
          }
          send(ws, { type: "auth:ok", user: { id: ws.user.id, name: ws.user.name, globalRole: ws.user.globalRole, tier: ws.user.tier || "INNOCENT", avatarColor: ws.user.avatarColor, avatar: ws.user.avatar } });
          // Award daily active notoriety (cooldown-gated, fires at most once per 24h)
          awardNotoriety(ws.user.id, "DAILY_ACTIVE").catch(() => {});
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

          // Password-protected rooms: check password before allowing entry
          if (room.passwordHash && !isLobby && !isModOrOwner(room, uid, ws.user?.globalRole)) {
            const suppliedPassword = typeof msg.password === "string" ? msg.password : "";
            if (!suppliedPassword) {
              send(ws, { type: "room:password:required", roomId });
              return;
            }
            const passwordOk = await bcrypt.compare(suppliedPassword, room.passwordHash);
            if (!passwordOk) {
              send(ws, { type: "room:password:wrong", roomId });
              return;
            }
            // Password correct — fall through to normal join
          }

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
          // ── module:set — user sets the active module for the room
        if (msg.type === "module:set") {
          const roomId = normalizeRoomId(String(msg.roomId || ws.roomId || ""));
          if (!roomId) return;
          const room = rooms.get(roomId);
          if (!room) return;
          if (!room.users.has(ws.user.id)) return;
          const mode = String(msg.mode || "").trim() || null;
          if (!mode) {
            room.activeModule = null;
            room.ytState = null;
            broadcast(room, { type: "module:state", roomId, activeModule: null });
            return;
          }
          // Clear YouTube state when switching away from YouTube
          if (mode !== "youtube") room.ytState = null;
          const moduleState: ModuleState = {
            mode,
            url: typeof msg.url === "string" ? msg.url.slice(0, 2000) : undefined,
            channel: typeof msg.channel === "string" ? msg.channel.slice(0, 100).toLowerCase() : undefined,
            setBy: ws.user.id,
            setAt: Date.now(),
          };
          room.activeModule = moduleState;
          broadcast(room, { type: "module:state", roomId, activeModule: moduleState });
          return;
        }

        if (msg.type === "module:clear") {
          const roomId = normalizeRoomId(String(msg.roomId || ws.roomId || ""));
          if (!roomId) return;
          const room = rooms.get(roomId);
          if (!room) return;
          if (!room.users.has(ws.user.id)) return;
          room.activeModule = null;
          room.ytState = null;
          broadcast(room, { type: "module:state", roomId, activeModule: null });
          return;
        }
                // ── room:close — owner/mod force-closes the room ─────────────────
        if (msg.type === "room:close") {
          const roomId = normalizeRoomId(String(msg.roomId || ws.roomId || ""));
          if (!roomId) return;
          const room = rooms.get(roomId);
          if (!room) return;
          // Only owner, mods, or staff can close
          if (!isModOrOwner(room, ws.user.id, ws.user?.globalRole)) return;

          // Kick everyone
          for (const s of room.sockets) {
            send(s, { type: "room:closed", roomId, by: ws.user.name });
            try { s.close(4004, "room:closed"); } catch {}
          }

          // Clean up in-memory state
          room.users.clear();
          room.sockets.clear();
          room.msgs = [];
          room.activeModule = null;

          // Delete from DB
          try {
            await prisma.roomMessage.deleteMany({ where: { roomId } }).catch(() => {});
            await prisma.roomMember.deleteMany({ where: { roomId } }).catch(() => {});
            await prisma.room.delete({ where: { id: roomId } }).catch(() => {});
          } catch {}

          // Remove from in-memory map
          rooms.delete(roomId);

          await globalAudit(ws.user.id, ws.user.name, "room_close", roomId);
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
          room.lastActiveAt = Date.now();
          awardNotoriety(ws.user.id, "CHAT_MESSAGE").catch(() => {});
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
          // Store YouTube state so late joiners can catch up
          if (msg.type === "youtube:load" && msg.videoId) {
            room.ytState = { videoId: String(msg.videoId), playing: false, position: 0, updatedAt: Date.now() };
            // Also store videoId in activeModule for completeness
            if (room.activeModule && room.activeModule.mode === "youtube") {
              room.activeModule.url = String(msg.videoId);
            }
          } else if (msg.type === "youtube:play") {
            if (room.ytState) { room.ytState.playing = true; room.ytState.position = Number(msg.position ?? 0); room.ytState.updatedAt = Date.now(); }
          } else if (msg.type === "youtube:pause") {
            if (room.ytState) { room.ytState.playing = false; room.ytState.position = Number(msg.position ?? 0); room.ytState.updatedAt = Date.now(); }
          } else if (msg.type === "youtube:stop") {
            room.ytState = null;
          }
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
          if (!isUserOnline(toId)) {
            sendPush(toId, { title: `DM from ${ws.user?.name || "Someone"}`, body: body.slice(0, 120), url: "/home", tag: `dm:${fromId}` }).catch(() => {});
          }
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
  app.get("/recents", async (req, reply) => {
    const user = authFromHeader((req as any).headers?.authorization);
    if (!user) return reply.code(401).send({ error: "unauthorized" });

    const visits = await prisma.recentVisit.findMany({
      where: { userId: user.id },
      orderBy: { visitedAt: "desc" },
      take: 10,
    });

    // Enrich with lobby data for lobby visits
    const lobbyIds = visits.filter(v => v.lobbyId).map(v => v.lobbyId!);
    const lobbies = lobbyIds.length
      ? await prisma.lobby.findMany({
          where: { id: { in: lobbyIds } },
          select: {
            id: true, name: true, description: true,
            logoUrl: true, bannerUrl: true, accentColor: true, pinned: true,
          },
        })
      : [];
    const lobbyMap = new Map(lobbies.map(l => [l.id, l]));

    // Enrich with room data for room visits (get parent lobby info)
    const roomIds = visits.filter(v => v.roomId && !v.lobbyId).map(v => v.roomId!);
    const roomRows = roomIds.length
      ? await prisma.room.findMany({
          where: { id: { in: roomIds } },
          select: {
            id: true, name: true, lobbyId: true,
            lobby: { select: { id: true, name: true, logoUrl: true, accentColor: true } },
          },
        })
      : [];
    const roomMap = new Map(roomRows.map(r => [r.id, r]));

    const recents = visits.map(v => {
      if (v.lobbyId) {
        const lobby = lobbyMap.get(v.lobbyId);
        return {
          lobbyId: v.lobbyId,
          roomId: null,
          name: lobby?.name || v.name || v.lobbyId,
          logoUrl: lobby?.logoUrl || null,
          bannerUrl: lobby?.bannerUrl || null,
          accentColor: lobby?.accentColor || null,
          pinned: lobby?.pinned ?? true,
          visitedAt: v.visitedAt,
        };
      }
      if (v.roomId) {
        const room = roomMap.get(v.roomId);
        return {
          lobbyId: room?.lobbyId || null,
          lobbyName: room?.lobby?.name || null,
          roomId: v.roomId,
          name: room?.name || v.name || v.roomId,
          logoUrl: room?.lobby?.logoUrl || null,
          accentColor: room?.lobby?.accentColor || null,
          pinned: false,
          visitedAt: v.visitedAt,
        };
      }
      return null;
    }).filter(Boolean);

    return reply.send({ ok: true, recents });
  });
  

  // ── POST /recents — record a visit ──────────────────────────────────────────
  // Body: { roomId?: string, lobbyId?: string }
  // Upserts so we only keep one entry per user+target, updates timestamp
  app.post("/recents", async (req, reply) => {
    const user = authFromHeader((req as any).headers?.authorization);
    if (!user) return reply.code(401).send({ error: "unauthorized" });

    const { roomId, lobbyId } = req.body as any;
    if (!roomId && !lobbyId) return reply.code(400).send({ error: "roomId or lobbyId required" });

    try {
      if (lobbyId) {
        const lobby = await prisma.lobby.findUnique({ where: { id: lobbyId }, select: { name: true } });
        const existing = await prisma.recentVisit.findFirst({ where: { userId: user.id, lobbyId } });
        if (existing) {
          await prisma.recentVisit.update({ where: { id: existing.id }, data: { visitedAt: new Date(), name: lobby?.name || lobbyId } });
        } else {
          await prisma.recentVisit.create({ data: { userId: user.id, lobbyId, name: lobby?.name || lobbyId } });
        }
      } else if (roomId) {
        const room = await prisma.room.findUnique({ where: { id: roomId }, select: { name: true, lobbyId: true } });
        const existing = await prisma.recentVisit.findFirst({ where: { userId: user.id, roomId } });
        if (existing) {
          await prisma.recentVisit.update({ where: { id: existing.id }, data: { visitedAt: new Date(), name: room?.name || roomId } });
        } else {
          await prisma.recentVisit.create({ data: { userId: user.id, roomId, lobbyId: room?.lobbyId || null, name: room?.name || roomId } });
        }
      }
      return reply.send({ ok: true });
    } catch (e: any) {
      console.error("[recents POST]", e.message);
      return reply.code(500).send({ error: e.message });
    }
  });


  // ── DELETE /recents/:id — remove a specific recent ──────────────────────────
  app.delete("/recents/:id", async (req, reply) => {
    const user = authFromHeader((req as any).headers?.authorization);
    if (!user) return reply.code(401).send({ error: "unauthorized" });

    const { id } = req.params as any;
    try {
      await prisma.recentVisit.deleteMany({ where: { id, userId: user.id } });
      return reply.send({ ok: true });
    } catch (e: any) {
      return reply.code(500).send({ error: e.message });
    }
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
    awardNotoriety(u.id, "FRIEND_ADDED").catch(() => {});
    awardNotoriety(fr.fromId, "FRIEND_ADDED").catch(() => {});
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
    awardNotoriety(u.id, "CREW_CREATED").catch(() => {});
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
    awardNotoriety(userId, "CREW_JOINED").catch(() => {});
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
          accentColor: true, logoUrl: true, bannerUrl: true, websiteUrl: true, ownerId: true,
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
          select: { id: true, name: true, description: true, locked: true, ownerId: true, _count: { select: { members: true } },},
          orderBy: { name: "asc" },
        },
        _count: { select: { rooms: true, members: true } },
      },
    });
    if (!lobby) return reply.code(404).send({ ok: false, error: "not_found" });

    // Enrich rooms with live presence data + avatar stack (up to 4 users)
    const enrichedRooms = lobby.rooms.map((r: any) => {
      const wsRoom = rooms.get(r.id);
      const onlineUsers: { id: string; name: string; avatar?: string }[] = [];
      if (wsRoom?.users) {
        for (const [uid, u] of wsRoom.users) {
          if (onlineUsers.length >= 4) break;
          onlineUsers.push({ id: uid, name: u?.name || uid, avatar: u?.avatar || undefined });
        }
      }
      return { ...r, onlineCount: wsRoom?.users?.size ?? 0, onlineUsers };
    });

    return reply.send({ ok: true, lobby: { ...lobby, rooms: enrichedRooms } });
  });

  app.post("/lobbies", async (req, reply) => {
    const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
    const u = verifyToken(token);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const role = await getGlobalRole(u.id);
    const isStaff = canAccessStaff(role);

    // Non-staff: check tier (Indicted=1, Felon=3, Kingpin=unlimited)
    if (!isStaff) {
      const dbUser = await prisma.user.findUnique({ where: { id: u.id }, select: { tier: true } });
      const tier = String(dbUser?.tier ?? "INNOCENT");
      if (tier === "INNOCENT") {
        return reply.code(403).send({ ok: false, error: "tier_required", message: "Indicted tier or higher required to create lobbies." });
      }
      // Count existing lobbies owned by this user
      const ownedCount = await (prisma as any).lobby.count({ where: { ownerId: u.id } });
      const maxLobbies = tier === "KINGPIN" ? 999 : tier === "FELON" ? 3 : 1;
      if (ownedCount >= maxLobbies) {
        return reply.code(403).send({ ok: false, error: "lobby_limit", message: `You can own up to ${maxLobbies} lobbies on the ${tier} tier.` });
      }
    }

    const { id, name, description = "", pinned = false, moduleType = "NONE",
            moduleConfig, keywords = [], accentColor, logoUrl, bannerUrl, websiteUrl } = req.body as any;
    if (!id || !name) return reply.code(400).send({ ok: false, error: "id and name required" });

    // Check reserved names (staff can bypass)
    if (!isStaff) {
      const reserved = await isNameReserved(String(id), "LOBBY");
      if (reserved) return reply.code(403).send({ ok: false, error: "name_reserved", message: "This lobby name is reserved and cannot be used." });
    }

    // Non-staff can't pin lobbies
    const shouldPin = isStaff ? Boolean(pinned) : false;

    const lobby = await (prisma as any).lobby.upsert({
      where: { id: String(id) },
      update: { name: String(name), description: String(description), pinned: shouldPin,
        moduleType, moduleConfig: moduleConfig ?? undefined,
        keywords: Array.isArray(keywords) ? keywords.map(String) : [],
        accentColor: accentColor ?? null, logoUrl: logoUrl ?? null,
        bannerUrl: bannerUrl ?? null, websiteUrl: websiteUrl ?? null },
      create: { id: String(id), name: String(name), description: String(description),
        pinned: shouldPin, verified: true, ownerId: u.id, moduleType, moduleConfig: moduleConfig ?? undefined,
        keywords: Array.isArray(keywords) ? keywords.map(String) : [],
        accentColor: accentColor ?? null, logoUrl: logoUrl ?? null,
        bannerUrl: bannerUrl ?? null, websiteUrl: websiteUrl ?? null },
    });
    awardNotoriety(u.id, "LOBBY_CREATED").catch(() => {});
    return reply.send({ ok: true, lobby });
  });

  // GET /lobbies/:lobbyId/presence — all online users across rooms in this lobby
  app.get("/lobbies/:lobbyId/presence", async (req, reply) => {
    const lobbyId = String((req as any).params?.lobbyId || "");
    if (!lobbyId) return reply.code(400).send({ ok: false, error: "missing lobbyId" });

    const seen = new Map<string, any>();
    for (const [, room] of rooms) {
      if (room.lobbyId !== lobbyId) continue;
      for (const [uid, u] of room.users) {
        if (!seen.has(uid)) {
          seen.set(uid, {
            id: uid,
            name: u.name,
            role: u.role,
            globalRole: u.globalRole,
            tier: u.tier,
            avatarColor: u.avatarColor,
            avatar: u.avatar,
            roomId: room.roomId,
            roomName: room.name || room.roomId,
          });
        }
      }
    }

    return reply.send({ ok: true, users: Array.from(seen.values()) });
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
    if (lobby.moduleType === "NONE" || lobby.moduleType === "FEED") {
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
  // ── LOBBY PAID TIERS ───────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════════

  // GET /lobbies/:id/tiers — public, returns active tiers for a lobby
  app.get("/lobbies/:id/tiers", async (req, reply) => {
    const lobbyId = String((req as any).params?.id || "");
    const lobby = await prisma.lobby.findUnique({ where: { id: lobbyId } });
    if (!lobby) return reply.code(404).send({ ok: false, error: "lobby_not_found" });
    const tiers = await (prisma as any).lobbyTier.findMany({
      where: { lobbyId, active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, description: true, priceMonthly: true, grantLevel: true, color: true, sortOrder: true },
    });
    return reply.send({ ok: true, tiers, roleNames: lobby.roleNames });
  });

  // GET /lobbies/:id/my-tier — get current user's tier sub for this lobby
  app.get("/lobbies/:id/my-tier", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const lobbyId = String((req as any).params?.id || "");
    const sub = await (prisma as any).lobbyTierSub.findUnique({
      where: { lobbyId_userId: { lobbyId, userId: u.id } },
      include: { tier: { select: { id: true, name: true, color: true, grantLevel: true, priceMonthly: true } } },
    });
    if (!sub || sub.status === "canceled") return reply.send({ ok: true, tier: null, sub: null });
    return reply.send({ ok: true, tier: sub.tier, sub: { status: sub.status, currentPeriodEnd: sub.currentPeriodEnd?.toISOString() || null, cancelAtPeriodEnd: sub.cancelAtPeriodEnd } });
  });

  // GET /lobbies/:id/admin/tiers — admin view of all tiers with subscriber counts
  app.get("/lobbies/:id/admin/tiers", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 5);
    if (!ctx) return;
    const tiers = await (prisma as any).lobbyTier.findMany({
      where: { lobbyId: ctx.lobby.id },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { subscribers: true } } },
    });
    return reply.send({ ok: true, tiers, revenueSharePct: ctx.lobby.revenueSharePct ?? 0 });
  });

  // GET /lobbies/:id/admin/tier-stats — subscriber details for owner
  app.get("/lobbies/:id/admin/tier-stats", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 5);
    if (!ctx) return;
    const subs = await (prisma as any).lobbyTierSub.findMany({
      where: { lobbyId: ctx.lobby.id, status: "active" },
      include: { tier: { select: { id: true, name: true, priceMonthly: true } } },
    });
    const userIds = subs.map((s: any) => s.userId);
    const users = userIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, usernameKey: true, avatar: true } })
      : [];
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));
    const enriched = subs.map((s: any) => ({ ...s, user: userMap[s.userId] || null }));
    return reply.send({ ok: true, subscribers: enriched });
  });

  // POST /lobbies/:id/admin/tiers — create a new paid tier
  app.post("/lobbies/:id/admin/tiers", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 5);
    if (!ctx) return;
    const body: any = (req as any).body || {};
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const priceMonthly = Math.max(Number(body.priceMonthly) || 0, 100); // minimum $1.00
    const grantLevel = Math.min(Math.max(Number(body.grantLevel) || 2, 1), 4); // 1-4, never 5
    const color = body.color ? String(body.color).trim() : null;
    const sortOrder = Number(body.sortOrder) || 0;
    if (!name) return reply.code(400).send({ ok: false, error: "name_required" });
    if (priceMonthly < 100) return reply.code(400).send({ ok: false, error: "min_price_100_cents" });

    // Create Stripe Product + Price dynamically
    const product = await stripeReq("POST", "/products", {
      name: `${ctx.lobby.name || ctx.lobby.id} — ${name}`,
      "metadata[lobby_id]": ctx.lobby.id,
      "metadata[tier_type]": "lobby_tier",
    });
    if (product.error) return reply.code(500).send({ ok: false, error: "stripe_product_failed" });

    const price = await stripeReq("POST", "/prices", {
      product: product.id,
      unit_amount: String(priceMonthly),
      currency: "usd",
      "recurring[interval]": "month",
    });
    if (price.error) return reply.code(500).send({ ok: false, error: "stripe_price_failed" });

    const tier = await (prisma as any).lobbyTier.create({
      data: { lobbyId: ctx.lobby.id, name, description, priceMonthly, grantLevel, color, sortOrder, stripePriceId: price.id, stripeProductId: product.id },
    });

    await (prisma as any).lobbyAudit.create({
      data: { id: randomUUID(), lobbyId: ctx.lobby.id, type: "tier_created", actorId: ctx.user.id, actorName: ctx.user.name, note: `${name} — $${(priceMonthly / 100).toFixed(2)}/mo` },
    });

    return reply.send({ ok: true, tier });
  });

  // PATCH /lobbies/:id/admin/tiers/:tierId — update tier metadata (not price)
  app.patch("/lobbies/:id/admin/tiers/:tierId", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 5);
    if (!ctx) return;
    const tierId = String((req as any).params?.tierId || "");
    const existing = await (prisma as any).lobbyTier.findFirst({ where: { id: tierId, lobbyId: ctx.lobby.id } });
    if (!existing) return reply.code(404).send({ ok: false, error: "tier_not_found" });

    const body: any = (req as any).body || {};
    const data: any = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.description !== undefined) data.description = String(body.description).trim();
    if (body.grantLevel !== undefined) data.grantLevel = Math.min(Math.max(Number(body.grantLevel) || 2, 1), 4);
    if (body.color !== undefined) data.color = body.color ? String(body.color).trim() : null;
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0;
    if (body.active !== undefined) data.active = Boolean(body.active);

    const tier = await (prisma as any).lobbyTier.update({ where: { id: tierId }, data });

    await (prisma as any).lobbyAudit.create({
      data: { id: randomUUID(), lobbyId: ctx.lobby.id, type: "tier_updated", actorId: ctx.user.id, actorName: ctx.user.name, note: existing.name },
    });

    return reply.send({ ok: true, tier });
  });

  // PATCH /lobbies/:id/admin/revenue-share — set revenue share percentage
  app.patch("/lobbies/:id/admin/revenue-share", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 5);
    if (!ctx) return;
    const body: any = (req as any).body || {};
    const pct = Math.min(Math.max(Number(body.revenueSharePct) || 0, 0), 100);
    await prisma.lobby.update({ where: { id: ctx.lobby.id }, data: { revenueSharePct: pct } });
    return reply.send({ ok: true, revenueSharePct: pct });
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
      const clean: Record<string,string> = {}; for (const [k,v] of Object.entries(body)) { if (v !== undefined && v !== null && v !== '') clean[k] = String(v); } opts.body = new URLSearchParams(clean).toString();
    }
    const res = await fetch(url, opts);
    const j = await res.json(); if (j.error) console.error("[stripeReq]", path, JSON.stringify(j.error)); return j;
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

    if (!customerId || customerId === "") {
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

  // ── LOBBY TIER CHECKOUT / PORTAL ─────────────────────────────────────────

  // POST /lobbies/:id/tiers/:tierId/checkout — start Stripe checkout for a lobby tier
  app.post("/lobbies/:id/tiers/:tierId/checkout", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!STRIPE_SK) return reply.code(500).send({ ok: false, error: "stripe_not_configured" });

    const lobbyId = String((req as any).params?.id || "");
    const tierId = String((req as any).params?.tierId || "");

    const tier = await (prisma as any).lobbyTier.findFirst({ where: { id: tierId, lobbyId, active: true } });
    if (!tier || !tier.stripePriceId) return reply.code(404).send({ ok: false, error: "tier_not_found" });

    // Check for existing active lobby tier sub
    const existingSub = await (prisma as any).lobbyTierSub.findUnique({ where: { lobbyId_userId: { lobbyId, userId: u.id } } });
    if (existingSub && existingSub.status === "active") {
      return reply.code(400).send({ ok: false, error: "already_subscribed" });
    }

    // Find or create Stripe customer — reuse from platform subscription if possible
    let customerId: string | null = null;
    const platformSub = await (prisma as any).subscription.findUnique({ where: { userId: u.id } });
    customerId = platformSub?.stripeCustomerId || null;

    if (!customerId) {
      const dbUser = await prisma.user.findUnique({ where: { id: u.id }, select: { name: true, email: true } });
      const customer = await stripeReq("POST", "/customers", {
        email: dbUser?.email || undefined,
        name: dbUser?.name || u.name,
        "metadata[weered_user_id]": u.id,
      });
      customerId = customer.id;
      // Store customer ID in platform subscription record
      await (prisma as any).subscription.upsert({
        where: { userId: u.id },
        update: { stripeCustomerId: customerId },
        create: { userId: u.id, stripeCustomerId: customerId, tier: "FREE" },
      });
    }

    const session = await stripeReq("POST", "/checkout/sessions", {
      customer: customerId,
      "line_items[0][price]": tier.stripePriceId,
      "line_items[0][quantity]": "1",
      mode: "subscription",
      success_url: `${SITE_URL}/lobby/${encodeURIComponent(lobbyId)}?tier_success=true`,
      cancel_url: `${SITE_URL}/lobby/${encodeURIComponent(lobbyId)}`,
      "metadata[weered_user_id]": u.id,
      "metadata[lobby_id]": lobbyId,
      "metadata[lobby_tier_id]": tierId,
      "metadata[sub_type]": "lobby_tier",
    });

    return reply.send({ ok: true, url: session.url, sessionId: session.id });
  });

  // POST /lobbies/:id/tiers/portal — Stripe billing portal for lobby tier management
  app.post("/lobbies/:id/tiers/portal", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const lobbyId = String((req as any).params?.id || "");

    const sub = await (prisma as any).lobbyTierSub.findUnique({ where: { lobbyId_userId: { lobbyId, userId: u.id } } });
    if (!sub?.stripeCustomerId) return reply.code(400).send({ ok: false, error: "no_subscription" });

    const session = await stripeReq("POST", "/billing_portal/sessions", {
      customer: sub.stripeCustomerId,
      return_url: `${SITE_URL}/lobby/${encodeURIComponent(lobbyId)}`,
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
        const subId = session?.subscription;

        if (session?.metadata?.sub_type === "lobby_tier") {
          // ── Lobby tier checkout ──
          const lobbyId = session?.metadata?.lobby_id;
          const lobbyTierId = session?.metadata?.lobby_tier_id;
          if (userId && subId && lobbyId && lobbyTierId) {
            const stripeSub = await stripeReq("GET", `/subscriptions/${subId}`);
            await (prisma as any).lobbyTierSub.upsert({
              where: { lobbyId_userId: { lobbyId, userId } },
              update: { lobbyTierId, stripeSubId: subId, status: "active", stripeCustomerId: session.customer, currentPeriodEnd: stripeSub?.current_period_end ? new Date(stripeSub.current_period_end * 1000) : null },
              create: { lobbyTierId, lobbyId, userId, stripeSubId: subId, status: "active", stripeCustomerId: session.customer, currentPeriodEnd: stripeSub?.current_period_end ? new Date(stripeSub.current_period_end * 1000) : null },
            });
            // Auto-promote member roleLevel
            const lobbyTier = await (prisma as any).lobbyTier.findUnique({ where: { id: lobbyTierId } });
            if (lobbyTier) {
              const member = await prisma.lobbyMember.findUnique({ where: { lobbyId_userId: { lobbyId, userId } } });
              if (member) {
                if ((member.roleLevel ?? 1) < lobbyTier.grantLevel) {
                  const lobbyRole = lobbyTier.grantLevel >= 4 ? "OWNER" : lobbyTier.grantLevel >= 3 ? "MOD" : "MEMBER";
                  await prisma.lobbyMember.update({ where: { lobbyId_userId: { lobbyId, userId } }, data: { roleLevel: lobbyTier.grantLevel, role: lobbyRole } });
                }
              } else {
                // Create membership if not already a member
                await prisma.lobbyMember.create({ data: { lobbyId, userId, roleLevel: lobbyTier.grantLevel, role: "MEMBER", name: "" } });
              }
            }
            await (prisma as any).lobbyAudit.create({
              data: { id: randomUUID(), lobbyId, type: "tier_subscribed", actorId: userId, actorName: "system", note: lobbyTier?.name || lobbyTierId },
            });
          }
        } else {
          // ── Platform subscription checkout ──
          const tier = session?.metadata?.tier || "INDICTED";
          if (userId && subId) {
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
            const userTier = tier === "FELON" ? "FELON" : "INDICTED";
            await prisma.user.update({ where: { id: userId }, data: { tier: userTier } });
            await globalAudit("system", "Stripe", "subscription_activated", userId, undefined, { tier, subId });
          }
        }
      }

      if (event.type === "customer.subscription.updated") {
        const stripeSub = event.data?.object;
        const subId = stripeSub?.id;
        if (subId) {
          // Check platform subscription first
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
          // Also check lobby tier subscription
          const lobbyTierSub = await (prisma as any).lobbyTierSub.findUnique({ where: { stripeSubId: subId } });
          if (lobbyTierSub) {
            await (prisma as any).lobbyTierSub.update({
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
          // Check platform subscription
          const dbSub = await (prisma as any).subscription.findUnique({ where: { stripeSubId: subId } });
          if (dbSub) {
            await (prisma as any).subscription.update({
              where: { stripeSubId: subId },
              data: { status: "canceled", tier: "FREE" },
            });
            await prisma.user.update({ where: { id: dbSub.userId }, data: { tier: "INNOCENT" } });
            await globalAudit("system", "Stripe", "subscription_canceled", dbSub.userId);
          }
          // Check lobby tier subscription — smart demotion
          const lobbyTierSub = await (prisma as any).lobbyTierSub.findUnique({ where: { stripeSubId: subId } });
          if (lobbyTierSub) {
            await (prisma as any).lobbyTierSub.update({
              where: { stripeSubId: subId },
              data: { status: "canceled" },
            });
            // Only demote if their current roleLevel matches the tier's grantLevel
            // (preserves manual promotions by admins)
            const lobbyTier = await (prisma as any).lobbyTier.findUnique({ where: { id: lobbyTierSub.lobbyTierId } });
            if (lobbyTier) {
              const member = await prisma.lobbyMember.findUnique({
                where: { lobbyId_userId: { lobbyId: lobbyTierSub.lobbyId, userId: lobbyTierSub.userId } },
              });
              if (member && member.roleLevel === lobbyTier.grantLevel) {
                await prisma.lobbyMember.update({
                  where: { lobbyId_userId: { lobbyId: lobbyTierSub.lobbyId, userId: lobbyTierSub.userId } },
                  data: { roleLevel: 1, role: "MEMBER" },
                });
              }
            }
            await (prisma as any).lobbyAudit.create({
              data: { id: randomUUID(), lobbyId: lobbyTierSub.lobbyId, type: "tier_canceled", actorId: lobbyTierSub.userId, actorName: "system", note: lobbyTier?.name || "" },
            });
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

  // ── Reserved Names (staff-managed blocklist) ────────────────────────────────

  app.get("/staff/reserved", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const list = await (prisma as any).reservedName.findMany({ orderBy: { name: "asc" } });
    return reply.send({ ok: true, reserved: list });
  });

  app.post("/staff/reserved", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const body: any = (req as any).body || {};
    const name = String(body.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const scope = ["BOTH", "LOBBY", "USERNAME"].includes(body.scope) ? body.scope : "BOTH";
    const reason = String(body.reason || "").slice(0, 200);
    if (!name || name.length < 2) return reply.code(400).send({ ok: false, error: "Name too short (min 2 chars)" });
    try {
      const entry = await (prisma as any).reservedName.create({
        data: { name, scope, reason, addedBy: u.id },
      });
      await globalAudit(u.id, u.name, "reserved_name_add", undefined, undefined, { name, scope, reason });
      return reply.send({ ok: true, entry });
    } catch (e: any) {
      if (e?.code === "P2002") return reply.code(409).send({ ok: false, error: "Name already reserved" });
      throw e;
    }
  });

  app.delete("/staff/reserved/:id", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const id = String((req as any).params?.id || "");
    try {
      const deleted = await (prisma as any).reservedName.delete({ where: { id } });
      await globalAudit(u.id, u.name, "reserved_name_remove", undefined, undefined, { name: deleted.name });
      return reply.send({ ok: true });
    } catch {
      return reply.code(404).send({ ok: false, error: "Not found" });
    }
  });
  // ══════════════════════════════════════════════════════════════════════════════
  // ── EVENT MANAGER ──────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════════

  // Helper: broadcast an event announcement to all connected users
  function broadcastEvent(title: string, startsAt: Date) {
    const timeStr = startsAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    const payload = { type: "system:broadcast", message: `Event: ${title} — ${timeStr}`, level: "info", from: "Events", ts: Date.now() };
    const sent = new Set<string>();
    for (const room of rooms.values()) {
      for (const s of room.sockets) {
        const sid = s.user?.id;
        if (!sid || sent.has(sid)) continue;
        sent.add(sid);
        send(s, payload);
      }
    }
    return sent.size;
  }

  // ── Staff Event Endpoints ─────────────────────────────────────────────────

  // GET /staff/events — list all events with filters
  app.get("/staff/events", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const q: any = (req as any).query || {};
    const where: any = {};
    if (q.status) where.status = String(q.status).toUpperCase();
    if (q.scope === "global") where.lobbyId = null;
    else if (q.scope === "lobby") where.lobbyId = { not: null };
    if (q.q) where.title = { contains: String(q.q), mode: "insensitive" };
    const events = await (prisma as any).event.findMany({
      where,
      orderBy: { startsAt: "desc" },
      take: Math.min(Number(q.limit) || 50, 200),
      skip: Number(q.offset) || 0,
      include: { lobby: { select: { id: true, name: true } } },
    });
    return reply.send({ ok: true, events });
  });

  // GET /staff/events/promotions — pending promotion requests
  app.get("/staff/events/promotions", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const events = await (prisma as any).event.findMany({
      where: { promotionStatus: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: { lobby: { select: { id: true, name: true } } },
    });
    return reply.send({ ok: true, events });
  });

  // POST /staff/events — create a global event
  app.post("/staff/events", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const body: any = (req as any).body || {};
    const title = String(body.title || "").trim();
    if (!title) return reply.code(400).send({ ok: false, error: "title_required" });
    const event = await (prisma as any).event.create({
      data: {
        title,
        description: String(body.description || "").trim(),
        category: String(body.category || "").trim(),
        coverImageUrl: body.coverImageUrl ? String(body.coverImageUrl).trim() : null,
        startsAt: new Date(body.startsAt || Date.now()),
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        timezone: String(body.timezone || "UTC"),
        status: ["DRAFT", "PUBLISHED"].includes(String(body.status || "").toUpperCase()) ? String(body.status).toUpperCase() : "DRAFT",
        broadcastOnPublish: Boolean(body.broadcastOnPublish),
        createdById: u.id,
        createdByName: u.name,
        lobbyId: null, // global
      },
    });
    // Broadcast if publishing immediately
    if (event.status === "PUBLISHED" && event.broadcastOnPublish) {
      broadcastEvent(event.title, event.startsAt);
    }
    await globalAudit(u.id, u.name, "event_create", event.id, event.title, { category: event.category, status: event.status });
    return reply.send({ ok: true, event });
  });

  // PATCH /staff/events/:id — update any event
  app.patch("/staff/events/:id", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const eventId = String((req as any).params?.id || "");
    const existing = await (prisma as any).event.findUnique({ where: { id: eventId } });
    if (!existing) return reply.code(404).send({ ok: false, error: "event_not_found" });
    const body: any = (req as any).body || {};
    const data: any = {};
    if (body.title !== undefined) data.title = String(body.title).trim();
    if (body.description !== undefined) data.description = String(body.description).trim();
    if (body.category !== undefined) data.category = String(body.category).trim();
    if (body.coverImageUrl !== undefined) data.coverImageUrl = body.coverImageUrl ? String(body.coverImageUrl).trim() : null;
    if (body.startsAt !== undefined) data.startsAt = new Date(body.startsAt);
    if (body.endsAt !== undefined) data.endsAt = body.endsAt ? new Date(body.endsAt) : null;
    if (body.timezone !== undefined) data.timezone = String(body.timezone);
    if (body.status !== undefined) data.status = String(body.status).toUpperCase();
    if (body.broadcastOnPublish !== undefined) data.broadcastOnPublish = Boolean(body.broadcastOnPublish);
    const event = await (prisma as any).event.update({ where: { id: eventId }, data });
    // Broadcast if just published with flag
    if (data.status === "PUBLISHED" && existing.status !== "PUBLISHED" && event.broadcastOnPublish) {
      broadcastEvent(event.title, event.startsAt);
    }
    await globalAudit(u.id, u.name, "event_update", event.id, event.title, { changes: Object.keys(data) });
    return reply.send({ ok: true, event });
  });

  // DELETE /staff/events/:id — hard-delete an event
  app.delete("/staff/events/:id", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const eventId = String((req as any).params?.id || "");
    const event = await (prisma as any).event.findUnique({ where: { id: eventId } });
    if (!event) return reply.code(404).send({ ok: false, error: "event_not_found" });
    await (prisma as any).event.delete({ where: { id: eventId } });
    await globalAudit(u.id, u.name, "event_delete", eventId, event.title);
    return reply.send({ ok: true });
  });

  // POST /staff/events/:id/promotion-review — approve or deny a promotion request
  app.post("/staff/events/:id/promotion-review", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const eventId = String((req as any).params?.id || "");
    const event = await (prisma as any).event.findUnique({ where: { id: eventId } });
    if (!event) return reply.code(404).send({ ok: false, error: "event_not_found" });
    if (event.promotionStatus !== "PENDING") return reply.code(400).send({ ok: false, error: "not_pending" });
    const body: any = (req as any).body || {};
    const decision = String(body.decision || "").toUpperCase();
    if (!["APPROVED", "DENIED"].includes(decision)) return reply.code(400).send({ ok: false, error: "invalid_decision" });
    const updated = await (prisma as any).event.update({
      where: { id: eventId },
      data: {
        promotionStatus: decision,
        promotionReviewedById: u.id,
        promotionReviewedByName: u.name,
        promotionReviewedAt: new Date(),
        promotionDenyReason: decision === "DENIED" ? String(body.reason || "").trim() || null : null,
      },
    });
    await globalAudit(u.id, u.name, "event_promotion_review", eventId, event.title, { decision, reason: body.reason });
    return reply.send({ ok: true, event: updated });
  });

  // ── Lobby Event Endpoints ─────────────────────────────────────────────────

  // GET /lobbies/:id/events — list events for a lobby
  app.get("/lobbies/:id/events", async (req, reply) => {
    const lobbyId = String((req as any).params?.id || "");
    const lobby = await prisma.lobby.findUnique({ where: { id: lobbyId } });
    if (!lobby) return reply.code(404).send({ ok: false, error: "lobby_not_found" });
    const q: any = (req as any).query || {};
    // If admin auth provided, show all statuses; otherwise only PUBLISHED
    const u = authFromHeader((req as any).headers?.authorization);
    let showAll = false;
    if (u) {
      const member = await prisma.lobbyMember.findUnique({ where: { lobbyId_userId: { lobbyId, userId: u.id } } });
      if (member && (member.roleLevel ?? 1) >= 4) showAll = true;
      const gr = await getGlobalRole(u.id);
      if (canAccessStaff(gr)) showAll = true;
    }
    const where: any = { lobbyId };
    if (!showAll) where.status = "PUBLISHED";
    const events = await (prisma as any).event.findMany({
      where,
      orderBy: { startsAt: "asc" },
      take: Math.min(Number(q.limit) || 50, 200),
    });
    return reply.send({ ok: true, events });
  });

  // POST /lobbies/:id/events — create a lobby event
  app.post("/lobbies/:id/events", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 4);
    if (!ctx) return;
    const body: any = (req as any).body || {};
    const title = String(body.title || "").trim();
    if (!title) return reply.code(400).send({ ok: false, error: "title_required" });
    const event = await (prisma as any).event.create({
      data: {
        title,
        description: String(body.description || "").trim(),
        category: String(body.category || "").trim(),
        coverImageUrl: body.coverImageUrl ? String(body.coverImageUrl).trim() : null,
        startsAt: new Date(body.startsAt || Date.now()),
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        timezone: String(body.timezone || "UTC"),
        status: ["DRAFT", "PUBLISHED"].includes(String(body.status || "").toUpperCase()) ? String(body.status).toUpperCase() : "DRAFT",
        createdById: ctx.user.id,
        createdByName: ctx.user.name,
        lobbyId: ctx.lobby.id,
      },
    });
    await (prisma as any).lobbyAudit.create({
      data: { id: randomUUID(), lobbyId: ctx.lobby.id, type: "event_create", actorId: ctx.user.id, actorName: ctx.user.name, note: title },
    });
    return reply.send({ ok: true, event });
  });

  // PATCH /lobbies/:id/events/:eventId — update a lobby event
  app.patch("/lobbies/:id/events/:eventId", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 4);
    if (!ctx) return;
    const eventId = String((req as any).params?.eventId || "");
    const existing = await (prisma as any).event.findFirst({ where: { id: eventId, lobbyId: ctx.lobby.id } });
    if (!existing) return reply.code(404).send({ ok: false, error: "event_not_found" });
    const body: any = (req as any).body || {};
    const data: any = {};
    if (body.title !== undefined) data.title = String(body.title).trim();
    if (body.description !== undefined) data.description = String(body.description).trim();
    if (body.category !== undefined) data.category = String(body.category).trim();
    if (body.coverImageUrl !== undefined) data.coverImageUrl = body.coverImageUrl ? String(body.coverImageUrl).trim() : null;
    if (body.startsAt !== undefined) data.startsAt = new Date(body.startsAt);
    if (body.endsAt !== undefined) data.endsAt = body.endsAt ? new Date(body.endsAt) : null;
    if (body.timezone !== undefined) data.timezone = String(body.timezone);
    if (body.status !== undefined) data.status = String(body.status).toUpperCase();
    const event = await (prisma as any).event.update({ where: { id: eventId }, data });
    await (prisma as any).lobbyAudit.create({
      data: { id: randomUUID(), lobbyId: ctx.lobby.id, type: "event_update", actorId: ctx.user.id, actorName: ctx.user.name, targetId: eventId, note: existing.title },
    });
    return reply.send({ ok: true, event });
  });

  // DELETE /lobbies/:id/events/:eventId — delete a lobby event
  app.delete("/lobbies/:id/events/:eventId", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 4);
    if (!ctx) return;
    const eventId = String((req as any).params?.eventId || "");
    const event = await (prisma as any).event.findFirst({ where: { id: eventId, lobbyId: ctx.lobby.id } });
    if (!event) return reply.code(404).send({ ok: false, error: "event_not_found" });
    await (prisma as any).event.delete({ where: { id: eventId } });
    await (prisma as any).lobbyAudit.create({
      data: { id: randomUUID(), lobbyId: ctx.lobby.id, type: "event_delete", actorId: ctx.user.id, actorName: ctx.user.name, note: event.title },
    });
    return reply.send({ ok: true });
  });

  // POST /lobbies/:id/events/:eventId/promote — request global promotion (owner only)
  app.post("/lobbies/:id/events/:eventId/promote", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 5);
    if (!ctx) return;
    const eventId = String((req as any).params?.eventId || "");
    const event = await (prisma as any).event.findFirst({ where: { id: eventId, lobbyId: ctx.lobby.id } });
    if (!event) return reply.code(404).send({ ok: false, error: "event_not_found" });
    if (event.status !== "PUBLISHED") return reply.code(400).send({ ok: false, error: "must_be_published" });
    if (event.promotionStatus !== "NONE") return reply.code(400).send({ ok: false, error: "already_requested" });
    const body: any = (req as any).body || {};
    const updated = await (prisma as any).event.update({
      where: { id: eventId },
      data: { promotionStatus: "PENDING", promotionNote: String(body.note || "").trim().slice(0, 500) || null },
    });
    await (prisma as any).lobbyAudit.create({
      data: { id: randomUUID(), lobbyId: ctx.lobby.id, type: "event_promote_request", actorId: ctx.user.id, actorName: ctx.user.name, note: event.title },
    });
    return reply.send({ ok: true, event: updated });
  });

  // ── Public Event Endpoints ────────────────────────────────────────────────

  // GET /events/upcoming — upcoming published events (global + promoted-approved lobby events)
  app.get("/events/upcoming", async (req, reply) => {
    const q: any = (req as any).query || {};
    const events = await (prisma as any).event.findMany({
      where: {
        status: "PUBLISHED",
        startsAt: { gte: new Date() },
        OR: [
          { lobbyId: null },
          { promotionStatus: "APPROVED" },
        ],
      },
      orderBy: { startsAt: "asc" },
      take: Math.min(Number(q.limit) || 20, 100),
      include: { lobby: { select: { id: true, name: true, logoUrl: true } } },
    });
    return reply.send({ ok: true, events });
  });

  // GET /events/:id — single event detail
  app.get("/events/:id", async (req, reply) => {
    const eventId = String((req as any).params?.id || "");
    const event = await (prisma as any).event.findUnique({
      where: { id: eventId },
      include: { lobby: { select: { id: true, name: true, logoUrl: true } } },
    });
    if (!event) return reply.code(404).send({ ok: false, error: "event_not_found" });
    return reply.send({ ok: true, event });
  });

  // GET /staff/config — returns all site config values
  app.get("/staff/config", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (role !== GlobalRole.GOD) return reply.code(403).send({ ok: false, error: "forbidden" });

    const stored = await getAllSiteConfig();
    // Merge defaults with stored values
    const config = { ...SITE_CONFIG_DEFAULTS, ...stored };
    // Parse types for frontend
    return reply.send({
      ok: true,
      config: {
        featuredLobbyId: config.featuredLobbyId || "",
        registrationOpen: config.registrationOpen !== "false",
        maintenanceMode: config.maintenanceMode === "true",
        defaultTier: config.defaultTier || "INNOCENT",
        maxRoomsPerLobby: Number(config.maxRoomsPerLobby) || 50,
        chatRateLimit: Number(config.chatRateLimit) || 30,
      },
    });
  });

  // POST /staff/config — update site config values
  app.post("/staff/config", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (role !== GlobalRole.GOD) return reply.code(403).send({ ok: false, error: "forbidden" });

    const body: any = (req as any).body || {};
    const updates: Array<{ key: string; value: string }> = [];

    if (body.featuredLobbyId !== undefined) updates.push({ key: "featuredLobbyId", value: String(body.featuredLobbyId) });
    if (body.registrationOpen !== undefined) updates.push({ key: "registrationOpen", value: String(body.registrationOpen) });
    if (body.maintenanceMode !== undefined) updates.push({ key: "maintenanceMode", value: String(body.maintenanceMode) });
    if (body.defaultTier !== undefined) updates.push({ key: "defaultTier", value: String(body.defaultTier) });
    if (body.maxRoomsPerLobby !== undefined) updates.push({ key: "maxRoomsPerLobby", value: String(body.maxRoomsPerLobby) });
    if (body.chatRateLimit !== undefined) updates.push({ key: "chatRateLimit", value: String(body.chatRateLimit) });

    for (const { key, value } of updates) {
      await setSiteConfig(key, value);
    }

    await globalAudit(u.id, u.name, "config_update", undefined, undefined, { keys: updates.map(u => u.key) });
    return reply.send({ ok: true });
  });
  // POST /staff/featured — set the featured lobby for the homepage hero
  app.post("/staff/featured", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const body: any = (req as any).body || {};
    const lobbyId = String(body.lobbyId || "").trim();

    if (lobbyId) {
      // Verify lobby exists
      const lobby = await (prisma as any).lobby.findUnique({ where: { id: lobbyId }, select: { id: true, name: true } });
      if (!lobby) return reply.code(404).send({ ok: false, error: "lobby_not_found" });
      await setSiteConfig("featuredLobbyId", lobbyId);
      await globalAudit(u.id, u.name, "set_featured", lobbyId, lobby.name);
      return reply.send({ ok: true, featuredLobbyId: lobbyId });
    } else {
      // Clear featured
      await setSiteConfig("featuredLobbyId", "");
      await globalAudit(u.id, u.name, "clear_featured");
      return reply.send({ ok: true, featuredLobbyId: "" });
    }
  });

  // GET /staff/featured — get current featured lobby ID
  app.get("/staff/featured", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const featuredId = await getSiteConfig("featuredLobbyId");
    return reply.send({ ok: true, featuredLobbyId: featuredId || "" });
  });


  // GET /staff/lobbies — list all lobbies for staff management
  app.get("/staff/lobbies", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const list = await (prisma as any).lobby.findMany({
      select: {
        id: true, name: true, description: true, verified: true, pinned: true,
        moduleType: true, accentColor: true, logoUrl: true,
        _count: { select: { rooms: true, members: true } },
      },
      orderBy: [{ pinned: "desc" }, { name: "asc" }],
    });

    const lobbies = list.map((l: any) => ({
      id: l.id, name: l.name, description: l.description || "",
      verified: l.verified, pinned: l.pinned,
      moduleType: l.moduleType, onlineCount: l._count.members,
    }));

    return reply.send({ ok: true, lobbies });
  });
  // ── Push notification subscription endpoints ────────────────────────────
  app.post("/push/subscribe", async (req, reply) => {
    const viewer = extractViewer(req);
    if (!viewer) return reply.code(401).send({ ok: false, error: "auth" });
    const { endpoint, keys } = req.body as any;
    if (!endpoint || !keys?.p256dh || !keys?.auth) return reply.code(400).send({ ok: false, error: "missing fields" });
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId: viewer.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      update: { userId: viewer.id, p256dh: keys.p256dh, auth: keys.auth },
    });
    return reply.send({ ok: true });
  });

  app.delete("/push/subscribe", async (req, reply) => {
    const viewer = extractViewer(req);
    if (!viewer) return reply.code(401).send({ ok: false, error: "auth" });
    const { endpoint } = req.body as any;
    if (!endpoint) return reply.code(400).send({ ok: false, error: "missing endpoint" });
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: viewer.id } });
    return reply.send({ ok: true });
  });

  app.get("/push/vapid-key", async (_req, reply) => {
    return reply.send({ ok: true, key: VAPID_PUBLIC });
  });

  // GET /staff/roster — list all staff members with roles
  app.get("/staff/roster", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const staff = await prisma.user.findMany({
      where: { globalRole: { in: ["SUPPORT", "STAFF", "ADMIN", "GOD"] } },
      select: { id: true, name: true, globalRole: true, avatar: true, avatarColor: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return reply.send({ ok: true, staff });
  });

  // GET /staff/board — list staff board posts
  app.get("/staff/board", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const posts = await (prisma as any).staffPost.findMany({
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 100,
    });
    return reply.send({ ok: true, posts });
  });

  // POST /staff/board — create a board post
  app.post("/staff/board", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const body: any = (req as any).body || {};
    const text = String(body.body || "").trim();
    if (!text || text.length > 2000) return reply.code(400).send({ ok: false, error: "body required (max 2000 chars)" });

    const post = await (prisma as any).staffPost.create({
      data: { authorId: u.id, authorName: u.name, body: text, pinned: !!body.pinned },
    });
    return reply.send({ ok: true, post });
  });

  // POST /staff/board/:id/pin — toggle pin on a board post
  app.post("/staff/board/:id/pin", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const postId = (req as any).params.id;
    const post = await (prisma as any).staffPost.findUnique({ where: { id: postId } });
    if (!post) return reply.code(404).send({ ok: false, error: "not_found" });

    const updated = await (prisma as any).staffPost.update({
      where: { id: postId },
      data: { pinned: !post.pinned },
    });
    return reply.send({ ok: true, post: updated });
  });

  // DELETE /staff/board/:id — delete a board post
  app.delete("/staff/board/:id", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const postId = (req as any).params.id;
    try {
      await (prisma as any).staffPost.delete({ where: { id: postId } });
    } catch { return reply.code(404).send({ ok: false, error: "not_found" }); }
    return reply.send({ ok: true });
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
  // ── MLB STATS API INTEGRATION ───────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════════

  const MLB_API = "https://statsapi.mlb.com/api/v1";

  // GET /mlb/scoreboard — today's games with live scores
  app.get("/mlb/scoreboard", async (req, reply) => {
    try {
      const date = String((req as any).query?.date || new Date().toISOString().slice(0, 10));
      const res = await fetch(`${MLB_API}/schedule?sportId=1&date=${date}&hydrate=linescore,team,probablePitcher`);
      const data = await res.json();
      const games = (data?.dates?.[0]?.games || []).map((g: any) => ({
        gameId: g.gamePk,
        status: g.status?.detailedState || g.status?.abstractGameState || "Unknown",
        statusCode: g.status?.statusCode,
        startTime: g.gameDate,
        venue: g.venue?.name,
        away: {
          id: g.teams?.away?.team?.id,
          name: g.teams?.away?.team?.name,
          abbr: g.teams?.away?.team?.abbreviation,
          score: g.teams?.away?.score ?? null,
          wins: g.teams?.away?.leagueRecord?.wins,
          losses: g.teams?.away?.leagueRecord?.losses,
          probablePitcher: g.teams?.away?.probablePitcher ? {
            id: g.teams.away.probablePitcher.id,
            name: g.teams.away.probablePitcher.fullName,
            era: g.teams.away.probablePitcher.stats?.[0]?.stats?.era,
          } : null,
        },
        home: {
          id: g.teams?.home?.team?.id,
          name: g.teams?.home?.team?.name,
          abbr: g.teams?.home?.team?.abbreviation,
          score: g.teams?.home?.score ?? null,
          wins: g.teams?.home?.leagueRecord?.wins,
          losses: g.teams?.home?.leagueRecord?.losses,
          probablePitcher: g.teams?.home?.probablePitcher ? {
            id: g.teams.home.probablePitcher.id,
            name: g.teams.home.probablePitcher.fullName,
            era: g.teams.home.probablePitcher.stats?.[0]?.stats?.era,
          } : null,
        },
        linescore: g.linescore ? {
          currentInning: g.linescore.currentInning,
          inningHalf: g.linescore.inningHalf,
          balls: g.linescore.balls,
          strikes: g.linescore.strikes,
          outs: g.linescore.outs,
          innings: (g.linescore.innings || []).map((inn: any) => ({
            num: inn.num,
            away: inn.away?.runs ?? null,
            home: inn.home?.runs ?? null,
          })),
        } : null,
      }));
      return reply.send({ ok: true, date, games });
    } catch (e) {
      console.error("[mlb scoreboard]", e);
      return reply.send({ ok: true, date: "", games: [], error: "fetch_failed" });
    }
  });

  // GET /mlb/standings — division standings
  app.get("/mlb/standings", async (req, reply) => {
    try {
      const season = String((req as any).query?.season || new Date().getFullYear());
      const res = await fetch(`${MLB_API}/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason&hydrate=team`);
      const data = await res.json();
      const divisions = (data?.records || []).map((div: any) => ({
        divisionId: div.division?.id,
        divisionName: div.division?.name,
        teams: (div.teamRecords || []).map((t: any) => ({
          id: t.team?.id,
          name: t.team?.name,
          abbr: t.team?.abbreviation,
          wins: t.wins,
          losses: t.losses,
          pct: t.winningPercentage,
          gb: t.gamesBack,
          streak: t.streak?.streakCode,
          last10: `${t.records?.splitRecords?.find((s: any) => s.type === "lastTen")?.wins || 0}-${t.records?.splitRecords?.find((s: any) => s.type === "lastTen")?.losses || 0}`,
          runsScored: t.runsScored,
          runsAllowed: t.runsAllowed,
          runDiff: t.runDifferential,
        })),
      }));
      return reply.send({ ok: true, season, divisions });
    } catch (e) {
      console.error("[mlb standings]", e);
      return reply.send({ ok: true, divisions: [], error: "fetch_failed" });
    }
  });

  // GET /mlb/leaders — stat leaders
  app.get("/mlb/leaders", async (req, reply) => {
    try {
      const season = String((req as any).query?.season || new Date().getFullYear());
      const categories = [
        { stat: "homeRuns", label: "Home Runs" },
        { stat: "battingAverage", label: "Batting Avg" },
        { stat: "runsBattedIn", label: "RBI" },
        { stat: "stolenBases", label: "Stolen Bases" },
        { stat: "earnedRunAverage", label: "ERA" },
        { stat: "strikeouts", label: "Strikeouts" },
        { stat: "wins", label: "Pitcher Wins" },
        { stat: "saves", label: "Saves" },
      ];
      const results: any[] = [];
      for (const cat of categories) {
        const res = await fetch(`${MLB_API}/stats/leaders?leaderCategories=${cat.stat}&season=${season}&sportId=1&limit=10`);
        const data = await res.json();
        const leaders = (data?.leagueLeaders?.[0]?.leaders || []).map((l: any) => ({
          rank: l.rank,
          playerId: l.person?.id,
          name: l.person?.fullName,
          team: l.team?.name,
          teamAbbr: l.team?.abbreviation,
          value: l.value,
        }));
        results.push({ stat: cat.stat, label: cat.label, leaders });
      }
      return reply.send({ ok: true, season, categories: results });
    } catch (e) {
      console.error("[mlb leaders]", e);
      return reply.send({ ok: true, categories: [], error: "fetch_failed" });
    }
  });

  // GET /mlb/player/search?q=ohtani — search players
  app.get("/mlb/player/search", async (req, reply) => {
    try {
      const q = String((req as any).query?.q || "");
      if (!q) return reply.send({ ok: true, players: [] });
      const res = await fetch(`${MLB_API}/people/search?names=${encodeURIComponent(q)}&sportId=1&active=true&hydrate=currentTeam`);
      const data = await res.json();
      const players = (data?.people || []).slice(0, 15).map((p: any) => ({
        id: p.id,
        name: p.fullName,
        number: p.primaryNumber,
        position: p.primaryPosition?.abbreviation,
        team: p.currentTeam?.name,
        teamAbbr: p.currentTeam?.abbreviation,
        teamId: p.currentTeam?.id,
        bats: p.batSide?.code,
        throws: p.pitchHand?.code,
        age: p.currentAge,
        height: p.height,
        weight: p.weight,
        birthCountry: p.birthCountry,
        mlbDebutDate: p.mlbDebutDate,
        headshot: `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${p.id}/headshot/67/current`,
      }));
      return reply.send({ ok: true, players });
    } catch (e) {
      console.error("[mlb player search]", e);
      return reply.send({ ok: true, players: [], error: "fetch_failed" });
    }
  });

  // GET /mlb/player/:id/stats — season stats for a player
  app.get("/mlb/player/:id/stats", async (req, reply) => {
    try {
      const id = (req as any).params.id;
      const season = String((req as any).query?.season || new Date().getFullYear());
      const [bioRes, statsRes] = await Promise.all([
        fetch(`${MLB_API}/people/${id}`),
        fetch(`${MLB_API}/people/${id}/stats?stats=season,career&group=hitting,pitching,fielding&season=${season}`),
      ]);
      const bio = await bioRes.json();
      const stats = await statsRes.json();
      const person = bio?.people?.[0];
      if (!person) return reply.send({ ok: false, error: "player_not_found" });

      const statGroups: any = {};
      for (const s of stats?.stats || []) {
        const key = `${s.group?.displayName}_${s.type?.displayName}`;
        statGroups[key] = (s.splits || []).map((sp: any) => ({
          season: sp.season,
          team: sp.team?.name,
          stats: sp.stat,
        }));
      }

      return reply.send({
        ok: true,
        player: {
          id: person.id,
          name: person.fullName,
          number: person.primaryNumber,
          position: person.primaryPosition?.abbreviation,
          positionName: person.primaryPosition?.name,
          team: person.currentTeam?.name,
          teamId: person.currentTeam?.id,
          bats: person.batSide?.description,
          throws: person.pitchHand?.description,
          age: person.currentAge,
          height: person.height,
          weight: person.weight,
          birthDate: person.birthDate,
          birthCity: person.birthCity,
          birthCountry: person.birthCountry,
          mlbDebutDate: person.mlbDebutDate,
          headshot: `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${person.id}/headshot/67/current`,
        },
        stats: statGroups,
      });
    } catch (e) {
      console.error("[mlb player stats]", e);
      return reply.send({ ok: false, error: "fetch_failed" });
    }
  });

  // GET /mlb/game/:id/boxscore — game box score
  app.get("/mlb/game/:id/boxscore", async (req, reply) => {
    try {
      const id = (req as any).params.id;
      const res = await fetch(`${MLB_API.replace("/v1", "/v1.1")}/game/${id}/feed/live`);
      const data = await res.json();
      const gd = data?.gameData;
      const ld = data?.liveData;
      if (!gd || !ld) return reply.send({ ok: false, error: "game_not_found" });

      const mapBatters = (team: any) => (team?.batters || []).map((pid: number) => {
        const p = team.players?.[`ID${pid}`];
        if (!p) return null;
        const s = p.stats?.batting || {};
        return {
          id: pid, name: p.person?.fullName, position: p.position?.abbreviation,
          ab: s.atBats, r: s.runs, h: s.hits, rbi: s.rbi, bb: s.baseOnBalls,
          so: s.strikeOuts, avg: s.avg, ops: s.ops, hr: s.homeRuns,
        };
      }).filter(Boolean);

      const mapPitchers = (team: any) => (team?.pitchers || []).map((pid: number) => {
        const p = team.players?.[`ID${pid}`];
        if (!p) return null;
        const s = p.stats?.pitching || {};
        return {
          id: pid, name: p.person?.fullName,
          ip: s.inningsPitched, h: s.hits, r: s.runs, er: s.earnedRuns,
          bb: s.baseOnBalls, so: s.strikeOuts, hr: s.homeRuns, era: s.era,
          pitches: s.numberOfPitches, strikes: s.strikes,
        };
      }).filter(Boolean);

      return reply.send({
        ok: true,
        game: {
          status: gd.status?.detailedState,
          venue: gd.venue?.name,
          weather: gd.weather ? `${gd.weather.temp}°F, ${gd.weather.condition}` : null,
          away: {
            name: gd.teams?.away?.name, abbr: gd.teams?.away?.abbreviation,
            runs: ld.linescore?.teams?.away?.runs, hits: ld.linescore?.teams?.away?.hits, errors: ld.linescore?.teams?.away?.errors,
            batters: mapBatters(ld.boxscore?.teams?.away),
            pitchers: mapPitchers(ld.boxscore?.teams?.away),
          },
          home: {
            name: gd.teams?.home?.name, abbr: gd.teams?.home?.abbreviation,
            runs: ld.linescore?.teams?.home?.runs, hits: ld.linescore?.teams?.home?.hits, errors: ld.linescore?.teams?.home?.errors,
            batters: mapBatters(ld.boxscore?.teams?.home),
            pitchers: mapPitchers(ld.boxscore?.teams?.home),
          },
          innings: (ld.linescore?.innings || []).map((inn: any) => ({
            num: inn.num,
            away: inn.away?.runs ?? null,
            home: inn.home?.runs ?? null,
          })),
        },
      });
    } catch (e) {
      console.error("[mlb boxscore]", e);
      return reply.send({ ok: false, error: "fetch_failed" });
    }
  });

  // GET /mlb/highlights — video highlights from today's games
  app.get("/mlb/highlights", async (req, reply) => {
    try {
      const date = String((req as any).query?.date || new Date().toISOString().slice(0, 10));
      const schedRes = await fetch(`${MLB_API}/schedule?sportId=1&date=${date}`);
      const schedData = await schedRes.json();
      const gameIds = (schedData?.dates?.[0]?.games || []).map((g: any) => g.gamePk);

      const allHighlights: any[] = [];
      // Fetch highlights from up to 6 games to keep response fast
      const subset = gameIds.slice(0, 6);
      await Promise.all(subset.map(async (gid: number) => {
        try {
          const res = await fetch(`${MLB_API}/game/${gid}/content`);
          const data = await res.json();
          const items = data?.highlights?.highlights?.items || [];
          for (const item of items) {
            const mp4 = item.playbacks?.find((p: any) => p.name === "mp4Avc") || item.playbacks?.find((p: any) => p.url?.includes(".mp4"));
            if (!mp4) continue;
            allHighlights.push({
              id: item.id,
              headline: item.headline || item.title || "",
              description: item.description || "",
              duration: item.duration || "",
              thumbnailUrl: item.image?.cuts?.find((c: any) => c.width >= 320 && c.width <= 640)?.src
                || item.image?.cuts?.[0]?.src || "",
              videoUrl: mp4.url,
              gameId: gid,
              date: item.date || date,
            });
          }
        } catch {}
      }));

      // Sort by most recent first
      allHighlights.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      return reply.send({ ok: true, date, highlights: allHighlights.slice(0, 30) });
    } catch (e) {
      console.error("[mlb highlights]", e);
      return reply.send({ ok: true, highlights: [], error: "fetch_failed" });
    }
  });

  // GET /mlb/matchups — enriched game matchup data (pitcher stats, weather, trends)
  app.get("/mlb/matchups", async (req, reply) => {
    try {
      const date = String((req as any).query?.date || new Date().toISOString().slice(0, 10));
      const schedRes = await fetch(`${MLB_API}/schedule?sportId=1&date=${date}&hydrate=probablePitcher(stats(type=season)),team,linescore,weather`);
      const schedData = await schedRes.json();
      const games = schedData?.dates?.[0]?.games || [];

      const matchups = await Promise.all(games.map(async (g: any) => {
        // Get detailed game feed for weather
        let weather: any = null;
        try {
          const feedRes = await fetch(`https://statsapi.mlb.com/api/v1.1/game/${g.gamePk}/feed/live`);
          const feed = await feedRes.json();
          const w = feed?.gameData?.weather;
          if (w) weather = { temp: w.temp, condition: w.condition, wind: w.wind };
        } catch {}

        const mapPitcher = (team: any) => {
          const pp = team?.probablePitcher;
          if (!pp) return null;
          const seasonStats = pp.stats?.find((s: any) => s.type?.displayName === "statsSingleSeason")?.stats || {};
          return {
            id: pp.id,
            name: pp.fullName,
            era: seasonStats.era || pp.stats?.[0]?.stats?.era || "-",
            whip: seasonStats.whip || "-",
            wins: seasonStats.wins || 0,
            losses: seasonStats.losses || 0,
            strikeouts: seasonStats.strikeOuts || 0,
            inningsPitched: seasonStats.inningsPitched || "-",
            kPer9: seasonStats.strikeoutsPer9Inn || "-",
            bbPer9: seasonStats.walksPer9Inn || "-",
            homeRunsPer9: seasonStats.homeRunsPer9 || "-",
            record: `${seasonStats.wins || 0}-${seasonStats.losses || 0}`,
            gamesStarted: seasonStats.gamesStarted || 0,
          };
        };

        return {
          gameId: g.gamePk,
          startTime: g.gameDate,
          status: g.status?.detailedState || "Scheduled",
          venue: g.venue?.name,
          weather,
          away: {
            id: g.teams?.away?.team?.id,
            name: g.teams?.away?.team?.name,
            abbr: g.teams?.away?.team?.abbreviation,
            wins: g.teams?.away?.leagueRecord?.wins,
            losses: g.teams?.away?.leagueRecord?.losses,
            score: g.teams?.away?.score ?? null,
            probablePitcher: mapPitcher(g.teams?.away),
          },
          home: {
            id: g.teams?.home?.team?.id,
            name: g.teams?.home?.team?.name,
            abbr: g.teams?.home?.team?.abbreviation,
            wins: g.teams?.home?.leagueRecord?.wins,
            losses: g.teams?.home?.leagueRecord?.losses,
            score: g.teams?.home?.score ?? null,
            probablePitcher: mapPitcher(g.teams?.home),
          },
        };
      }));

      return reply.send({ ok: true, date, matchups });
    } catch (e) {
      console.error("[mlb matchups]", e);
      return reply.send({ ok: true, matchups: [], error: "fetch_failed" });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // ── PGA TOUR API INTEGRATION ────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════════

  const ESPN_PGA = "https://site.api.espn.com/apis/site/v2/sports/golf/pga";

  // GET /pga/leaderboard — current tournament leaderboard
  app.get("/pga/leaderboard", async (req, reply) => {
    try {
      const res = await fetch(`${ESPN_PGA}/scoreboard`);
      const data = await res.json();
      const event = data?.events?.[0];
      if (!event) return reply.send({ ok: true, event: null, players: [] });

      const comp = event.competitions?.[0];
      const broadcasts = (comp?.broadcasts || []).flatMap((b: any) => b.names || []);
      const players = (comp?.competitors || []).map((c: any, i: number) => ({
        position: i + 1,
        name: c.athlete?.displayName || "Unknown",
        country: c.athlete?.flag?.alt || "",
        score: c.score || "E",
        rounds: (c.linescores || []).map((l: any) => l.value),
        today: c.linescores?.length ? c.linescores[c.linescores.length - 1]?.value : null,
        todayDisplay: c.linescores?.length ? c.linescores[c.linescores.length - 1]?.displayValue : null,
        thru: c.status?.thru || c.status?.displayValue || "",
        status: c.status?.type?.description || "",
        holeByHole: c.linescores?.length ? (c.linescores[c.linescores.length - 1]?.linescores || []).map((h: any, hi: number) => ({
          hole: hi + 1,
          score: h.value,
          display: h.displayValue,
          toPar: h.scoreType?.displayValue || "E",
        })) : [],
      }));

      return reply.send({
        ok: true,
        event: {
          name: event.name || event.shortName,
          date: event.date,
          status: event.status?.type?.description || "",
          round: event.status?.period || null,
          venue: comp?.venue?.fullName || "",
          location: event.location || "",
          purse: event.purse || event.displayPurse || null,
          broadcasts,
        },
        players,
      });
    } catch (e) {
      console.error("[pga leaderboard]", e);
      return reply.send({ ok: true, event: null, players: [], error: "fetch_failed" });
    }
  });

  // GET /pga/news — latest PGA Tour news from ESPN
  app.get("/pga/news", async (req, reply) => {
    try {
      const limit = Math.min(Number((req as any).query?.limit) || 15, 30);
      const res = await fetch(`${ESPN_PGA}/news?limit=${limit}`);
      const data = await res.json();
      const articles = (data?.articles || []).map((a: any) => ({
        headline: a.headline,
        description: a.description || "",
        published: a.published,
        image: a.images?.[0]?.url || "",
        link: a.links?.web?.href || a.links?.api?.href || "",
        premium: a.premium || false,
      }));
      return reply.send({ ok: true, articles });
    } catch (e) {
      console.error("[pga news]", e);
      return reply.send({ ok: true, articles: [], error: "fetch_failed" });
    }
  });

  // GET /pga/schedule — upcoming PGA Tour events
  app.get("/pga/schedule", async (req, reply) => {
    try {
      const year = new Date().getFullYear();
      // Use the scoreboard to get current event, then fetch calendar
      const calRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/golf/pga/calendar?dates=${year}`);
      const calData = await calRes.json();

      // ESPN calendar structure varies — try multiple paths
      let events: any[] = [];
      if (calData?.events) {
        events = calData.events;
      } else if (calData?.leagues?.[0]?.calendar) {
        // Calendar is flat list of date ranges with event refs
        const cal = calData.leagues[0].calendar;
        events = (Array.isArray(cal) ? cal : []).flatMap((c: any) => c.entries || [c]).filter((e: any) => e.label || e.detail);
      }

      const schedule = events.slice(0, 30).map((e: any) => ({
        name: e.label || e.name || e.alternateLabel || "",
        startDate: e.startDate || e.date || "",
        endDate: e.endDate || "",
        detail: e.detail || "",
        value: e.value || "",
      }));

      return reply.send({ ok: true, schedule });
    } catch (e) {
      console.error("[pga schedule]", e);
      return reply.send({ ok: true, schedule: [], error: "fetch_failed" });
    }
  });

  // GET /pga/field — tournament field with player details for gambling context
  app.get("/pga/field", async (req, reply) => {
    try {
      const res = await fetch(`${ESPN_PGA}/scoreboard`);
      const data = await res.json();
      const event = data?.events?.[0];
      if (!event) return reply.send({ ok: true, event: null, field: [] });

      const comp = event.competitions?.[0];
      const field = (comp?.competitors || []).map((c: any, i: number) => ({
        position: i + 1,
        name: c.athlete?.displayName || "Unknown",
        id: c.athlete?.id,
        country: c.athlete?.flag?.alt || "",
        score: c.score || "E",
        today: c.linescores?.length ? c.linescores[c.linescores.length - 1]?.value : null,
        rounds: (c.linescores || []).map((l: any) => l.value),
        thru: c.status?.thru || c.status?.displayValue || "",
        status: c.status?.type?.description || "",
        // For props/DFS context
        roundScores: (c.linescores || []).map((l: any, ri: number) => ({
          round: ri + 1,
          score: l.value,
        })),
      }));

      return reply.send({
        ok: true,
        event: {
          name: event.name,
          status: event.status?.type?.description,
          round: event.status?.period,
        },
        field,
      });
    } catch (e) {
      console.error("[pga field]", e);
      return reply.send({ ok: true, event: null, field: [], error: "fetch_failed" });
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
    const j = await res.json(); if (j.error) console.error("[stripeReq]", path, JSON.stringify(j.error)); return j;
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

  // Authenticated cache helper — for endpoints that require OAuth but cache the result
  async function bungieGetCachedAuth(key: string, path: string, ttlMinutes: number, accessToken: string) {
    try {
      const cached = await (prisma as any).bungieCache.findUnique({ where: { key } });
      if (cached && new Date(cached.expiresAt) > new Date()) return cached.data;
    } catch {}
    try {
      const data = await bungieGet(path, accessToken);
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
      await (prisma as any).bungieCache.upsert({
        where: { key },
        update: { data, fetchedAt: new Date(), expiresAt },
        create: { key, data, fetchedAt: new Date(), expiresAt },
      });
      return data;
    } catch (e) {
      console.error(`[bungie cache auth] ${key}`, e);
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

  // GET /bungie/xur — Xur's full inventory with perks (cached 60 min)
  app.get("/bungie/xur", async (req, reply) => {
    if (!BUNGIE_API_KEY) return reply.send({ ok: true, available: false, error: "bungie_not_configured" });

    // Quick milestone check for Xur presence
    const milestoneData = await bungieGetCached("xur_milestone", "/Destiny2/Milestones/", 30);
    const xurMilestone = milestoneData?.Response?.["534869653"];
    if (!xurMilestone) {
      return reply.send({ ok: true, available: false });
    }

    // Xur is here — try to get full vendor inventory
    // Check if we have a cached vendor inventory first (any authenticated user's fetch works)
    try {
      const cached = await (prisma as any).bungieCache.findUnique({ where: { key: "xur_vendor_inventory" } });
      if (cached && new Date(cached.expiresAt) > new Date() && cached.data?.items) {
        return reply.send({ ok: true, available: true, items: cached.data.items, cachedAt: cached.fetchedAt });
      }
    } catch {}

    // No cache — need an authenticated user to fetch vendor data
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) {
      return reply.send({ ok: true, available: true, items: null, message: "Link your Bungie account to see Xur's inventory" });
    }

    const account = await (prisma as any).userGameAccount.findUnique({
      where: { userId_gameType: { userId: u.id, gameType: "BUNGIE" } },
    });
    if (!account?.accessToken) {
      return reply.send({ ok: true, available: true, items: null, message: "Link your Bungie account to see Xur's inventory" });
    }

    const accessToken = await refreshBungieToken(account);
    if (!accessToken) {
      return reply.send({ ok: true, available: true, items: null, error: "token_expired" });
    }

    try {
      // Get a characterId (quick profile fetch)
      const profileRes = await bungieGet(`/Destiny2/${account.platform}/Profile/${account.externalId}/?components=200`, accessToken);
      const chars = profileRes?.Response?.characters?.data || {};
      const charIds = Object.keys(chars);
      if (charIds.length === 0) return reply.send({ ok: true, available: true, items: null, error: "no_characters" });

      // Pick most recently played character
      const sortedChars = charIds.sort((a, b) => new Date(chars[b].dateLastPlayed).getTime() - new Date(chars[a].dateLastPlayed).getTime());
      const charId = sortedChars[0];

      // Fetch Xur vendor (hash 2190858386) with sales + sockets
      const vendorData = await bungieGetCachedAuth(
        "xur_vendor_inventory",
        `/Destiny2/${account.platform}/Profile/${account.externalId}/Character/${charId}/Vendors/2190858386/?components=402,304`,
        60, accessToken
      );

      const sales = vendorData?.Response?.sales?.data || {};
      const sockets = vendorData?.Response?.itemComponents?.sockets?.data || {};

      if (Object.keys(sales).length === 0) {
        return reply.send({ ok: true, available: true, items: [] });
      }

      const items = manifestLoaded() ? enrichVendorSales(sales, sockets) : [];

      // Re-cache with enriched items for non-authenticated users
      if (items.length > 0) {
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await (prisma as any).bungieCache.upsert({
          where: { key: "xur_vendor_inventory" },
          update: { data: { items }, fetchedAt: new Date(), expiresAt },
          create: { key: "xur_vendor_inventory", data: { items }, fetchedAt: new Date(), expiresAt },
        });
      }

      return reply.send({ ok: true, available: true, items, cachedAt: new Date() });
    } catch (e) {
      console.error("[bungie/xur vendor]", e);
      return reply.send({ ok: true, available: true, items: null, error: "vendor_fetch_failed" });
    }
  });
  // POST /staff/users/:userId/tier — update user tier (alias for subscription grant)
  app.post("/staff/users/:userId/tier", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const targetId = String((req as any).params?.userId || "");
    const body: any = (req as any).body || {};
    const tier = String(body.tier || "").toUpperCase();

    if (!["INNOCENT", "INDICTED", "FELON", "KINGPIN"].includes(tier)) {
      return reply.code(400).send({ ok: false, error: "invalid_tier" });
    }

    const userTier = tier as "INNOCENT" | "INDICTED" | "FELON" | "KINGPIN";
    await prisma.user.update({ where: { id: targetId }, data: { tier: userTier } });

    // Also update subscription record if it exists
    const subTier = tier === "INNOCENT" ? "FREE" : tier;
    await (prisma as any).subscription.upsert({
      where: { userId: targetId },
      update: { tier: subTier, status: tier === "INNOCENT" ? "inactive" : "active" },
      create: { userId: targetId, tier: subTier, status: tier === "INNOCENT" ? "inactive" : "active" },
    });

    await globalAudit(u.id, u.name, "tier_change", targetId, undefined, { tier });
    return reply.send({ ok: true, tier });
  });

  // POST /bungie/manifest/sync — Force re-sync manifest
  app.post("/bungie/manifest/sync", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!BUNGIE_API_KEY) return reply.send({ ok: false, error: "bungie_not_configured" });
    const result = await syncManifest(BUNGIE_API_KEY);
    return reply.send(result);
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

      // Fetch profile: characters, equipment, sockets, stats
      const profile = await bungieGet(
        `/Destiny2/${memberType}/Profile/${memberId}/?components=100,200,205,300,302,304`
      );

      const profileData = profile?.Response;
      const characters = profileData?.characters?.data || {};
      const equipment = profileData?.characterEquipment?.data || {};
      const instances = profileData?.itemComponents?.instances?.data || {};
      const socketData = profileData?.itemComponents?.sockets?.data || {};
      const statData = profileData?.itemComponents?.stats?.data || {};

      // Check privacy
      const privacyRestricted = profileData?.characterEquipment?.privacy === 2;

      const charSummary = Object.values(characters).map((c: any) => {
        const charId = c.characterId;
        const base: any = {
          characterId: charId,
          classType: c.classType,
          className: ["Titan", "Hunter", "Warlock"][c.classType] || "Unknown",
          light: c.light,
          raceType: c.raceType,
          raceName: ["Human", "Awoken", "Exo"][c.raceType] || "Unknown",
          emblemPath: c.emblemPath ? `https://www.bungie.net${c.emblemPath}` : null,
          emblemBackgroundPath: c.emblemBackgroundPath ? `https://www.bungie.net${c.emblemBackgroundPath}` : null,
          dateLastPlayed: c.dateLastPlayed,
          minutesPlayedTotal: c.minutesPlayedTotal,
          titleRecordHash: c.titleRecordHash,
        };

        // Include enriched equipment if not privacy-restricted and manifest loaded
        if (!privacyRestricted && manifestLoaded()) {
          const equippedItems = (equipment[charId]?.items || []).map((item: any) => {
            const def = resolveItem(item.itemHash);
            const inst = instances[item.itemInstanceId] || {};
            const bucket = resolveBucket(item.bucketHash || def?.bucketHash || 0);
            const damage = resolveDamageType(inst.damageTypeHash || def?.damageTypeHash || 0);
            const bHash = item.bucketHash || def?.bucketHash || 0;

            // Perks from sockets
            let perks: any[] = [];
            const itemSockets = socketData[item.itemInstanceId]?.sockets;
            if (itemSockets && Array.isArray(itemSockets)) {
              perks = itemSockets
                .filter((s: any) => s.plugHash && s.plugHash !== 0)
                .map((s: any) => { const pd = resolveItem(s.plugHash); return pd ? { hash: s.plugHash, name: pd.name, icon: pd.icon ? `https://www.bungie.net${pd.icon}` : "" } : null; })
                .filter(Boolean);
            }

            // Armor stats
            let armorStats: any = undefined;
            if (ARMOR_BUCKETS.has(bHash) && statData[item.itemInstanceId]?.stats) {
              const stats = statData[item.itemInstanceId].stats;
              const m = Number(stats[ARMOR_STAT_HASHES.MOBILITY]?.value || 0);
              const r = Number(stats[ARMOR_STAT_HASHES.RESILIENCE]?.value || 0);
              const rc = Number(stats[ARMOR_STAT_HASHES.RECOVERY]?.value || 0);
              const d = Number(stats[ARMOR_STAT_HASHES.DISCIPLINE]?.value || 0);
              const i = Number(stats[ARMOR_STAT_HASHES.INTELLECT]?.value || 0);
              const s = Number(stats[ARMOR_STAT_HASHES.STRENGTH]?.value || 0);
              armorStats = { mobility: m, resilience: r, recovery: rc, discipline: d, intellect: i, strength: s, total: m + r + rc + d + i + s };
            }

            return {
              itemHash: item.itemHash, itemInstanceId: item.itemInstanceId,
              bucketHash: bHash, name: def?.name || `Unknown`, icon: def?.icon ? `https://www.bungie.net${def.icon}` : "",
              tierName: def?.tierName || "Unknown", tierType: def?.tierType || 0,
              watermark: def?.watermark ? `https://www.bungie.net${def.watermark}` : "",
              primaryStat: inst.primaryStat?.value || null,
              damageType: damage?.name || null, damageIcon: damage?.icon ? `https://www.bungie.net${damage.icon}` : null,
              slotName: bucket?.name || "", perks, armorStats,
            };
          });

          const weapons = equippedItems.filter((i: any) => WEAPON_BUCKETS.has(i.bucketHash));
          const armor = equippedItems.filter((i: any) => ARMOR_BUCKETS.has(i.bucketHash));
          base.equipped = equippedItems;
          base.weapons = weapons;
          base.armor = armor;
        }

        return base;
      });

      return reply.send({
        ok: true,
        found: true,
        privacyRestricted,
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

  // GET /bungie/card/:userId — Guardian card data for a Weered user (by their linked account)
  app.get("/bungie/card/:userId", async (req, reply) => {
    if (!BUNGIE_API_KEY) return reply.send({ ok: false });
    const userId = String((req as any).params?.userId || "");
    if (!userId) return reply.code(400).send({ ok: false });

    try {
      const acct = await prisma.userGameAccount.findFirst({
        where: { userId, gameType: "BUNGIE" },
        select: { displayName: true, platform: true, externalId: true, cardData: true, cardCachedAt: true },
      });
      if (!acct || !acct.displayName) return reply.send({ ok: false });

      // Return cached card if fresh (5 min)
      if (acct.cardData && acct.cardCachedAt && Date.now() - acct.cardCachedAt.getTime() < 300_000) {
        return reply.send({ ok: true, ...(acct.cardData as any) });
      }

      // Use stored membershipId + platform directly (no search needed)
      if (!acct.externalId || !acct.platform) return reply.send({ ok: false });
      const memberType = acct.platform;
      const memberId = acct.externalId;

      // Fetch profile (characters + guardian rank + commendations)
      const profileRes = await bungieGet(`/Destiny2/${memberType}/Profile/${memberId}/?components=100,200,1400`);
      const profileData = profileRes?.Response?.profile?.data;
      const chars = profileRes?.Response?.characters?.data || {};
      const commendations = profileRes?.Response?.profileCommendations?.data;

      // Guardian Rank
      const RANK_NAMES: Record<number, string> = {
        1: "New Light", 2: "Explorer", 3: "Seeker", 4: "Pathfinder",
        5: "Brave", 6: "Heroic", 7: "Fabled", 8: "Mythic",
        9: "Vanquisher", 10: "Conqueror", 11: "Paragon",
      };
      const guardianRank = profileData?.currentGuardianRank ?? null;
      const guardianRankName = guardianRank ? (RANK_NAMES[guardianRank] || `Rank ${guardianRank}`) : null;

      // Commendations
      const commendationScore = commendations?.totalScore ?? null;

      // Characters — most recently played first
      const characters = Object.values(chars).map((c: any) => ({
        characterId: c.characterId,
        className: ["","Titan","Hunter","Warlock"][c.classType + 1] || "Unknown",
        light: c.light,
        raceName: ["","Human","Awoken","Exo"][c.raceType + 1] || "Unknown",
        emblemBackgroundPath: c.emblemBackgroundPath ? `https://www.bungie.net${c.emblemBackgroundPath}` : null,
        dateLastPlayed: c.dateLastPlayed,
        minutesPlayedTotal: parseInt(c.minutesPlayedTotal) || 0,
      }));
      characters.sort((a: any, b: any) => new Date(b.dateLastPlayed).getTime() - new Date(a.dateLastPlayed).getTime());

      // Last activity — fetch for most recent character only
      let lastActivity: { name: string; mode: string; when: string } | null = null;
      const mainChar = characters[0];
      if (mainChar?.characterId) {
        try {
          const actRes = await bungieGet(`/Destiny2/${memberType}/Account/${memberId}/Character/${mainChar.characterId}/Stats/Activities/?count=1&mode=0`);
          const act = actRes?.Response?.activities?.[0];
          if (act) {
            const { resolveActivity } = require("./manifest");
            const actDef = resolveActivity(act.activityDetails?.referenceId);
            const MODE_NAMES: Record<number, string> = {
              0: "None", 2: "Story", 3: "Strike", 4: "Raid", 5: "PvP", 6: "Patrol",
              7: "PvE", 10: "Control", 12: "Clash", 16: "Nightfall", 18: "Heroic",
              19: "Mayhem", 25: "Rumble", 31: "Supremacy", 37: "Survival",
              38: "Countdown", 39: "Trials", 43: "Iron Banner", 46: "Scorched",
              48: "Gambit", 63: "Reckoning", 69: "Dungeon", 73: "Offensive",
              75: "Dares", 84: "Quickplay",
            };
            const modeId = act.activityDetails?.mode || 0;
            lastActivity = {
              name: actDef?.name || "Unknown Activity",
              mode: MODE_NAMES[modeId] || `Mode ${modeId}`,
              when: act.period || "",
            };
          }
        } catch {}
      }

      const card = {
        displayName: acct.displayName,
        characters,
        guardianRank,
        guardianRankName,
        commendationScore,
        lastActivity,
      };

      // Cache it
      await prisma.userGameAccount.update({
        where: { userId_gameType: { userId, gameType: "BUNGIE" } },
        data: { cardData: card as any, cardCachedAt: new Date() },
      }).catch(() => {});

      return reply.send({ ok: true, ...card });
    } catch (e) {
      console.error("[bungie card]", e);
      return reply.send({ ok: false });
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
        return reply.redirect(`${SITE_URL}/lobby/destiny2?bungie=error`);
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

      awardNotoriety(userId, "BUNGIE_LINKED").catch(() => {});
      return reply.redirect(`${SITE_URL}/lobby/destiny2?bungie=success`);
    } catch (e) {
      console.error("[bungie oauth callback]", e);
      return reply.redirect(`${SITE_URL}/lobby/destiny2?bungie=error`);
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
      // Fetch full profile: characters, equipment, inventories, vault, item instances, sockets, stats
      const profile = await bungieGet(
        `/Destiny2/${account.platform}/Profile/${account.externalId}/?components=100,102,200,201,205,300,302,304`,
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

  // POST /bungie/equip — Equip an item on a character
  app.post("/bungie/equip", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

    const account = await (prisma as any).userGameAccount.findUnique({
      where: { userId_gameType: { userId: u.id, gameType: "BUNGIE" } },
    });
    if (!account?.accessToken) return reply.code(400).send({ ok: false, error: "not_linked" });

    const accessToken = await refreshBungieToken(account);
    if (!accessToken) return reply.code(401).send({ ok: false, error: "token_expired" });

    const { itemId, characterId } = (req as any).body || {};
    if (!itemId || !characterId) return reply.code(400).send({ ok: false, error: "missing_fields" });

    try {
      const result = await fetch(`${BUNGIE_ROOT}/Destiny2/Actions/Items/EquipItem/`, {
        method: "POST",
        headers: { "X-API-Key": BUNGIE_API_KEY, "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, characterId, membershipType: Number(account.platform) }),
      });
      const data = await result.json();
      return reply.send({ ok: !data.ErrorCode || data.ErrorCode === 1, data });
    } catch (e) {
      console.error("[bungie/equip]", e);
      return reply.code(500).send({ ok: false, error: "equip_failed" });
    }
  });

  // POST /bungie/transfer — Transfer an item to/from vault
  app.post("/bungie/transfer", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

    const account = await (prisma as any).userGameAccount.findUnique({
      where: { userId_gameType: { userId: u.id, gameType: "BUNGIE" } },
    });
    if (!account?.accessToken) return reply.code(400).send({ ok: false, error: "not_linked" });

    const accessToken = await refreshBungieToken(account);
    if (!accessToken) return reply.code(401).send({ ok: false, error: "token_expired" });

    const { itemReferenceHash, stackSize, transferToVault, itemId, characterId } = (req as any).body || {};
    if (!itemId || !characterId || !itemReferenceHash) return reply.code(400).send({ ok: false, error: "missing_fields" });

    try {
      const result = await fetch(`${BUNGIE_ROOT}/Destiny2/Actions/Items/TransferItem/`, {
        method: "POST",
        headers: { "X-API-Key": BUNGIE_API_KEY, "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          itemReferenceHash, stackSize: stackSize || 1,
          transferToVault: transferToVault ?? false,
          itemId, characterId, membershipType: Number(account.platform),
        }),
      });
      const data = await result.json();
      return reply.send({ ok: !data.ErrorCode || data.ErrorCode === 1, data });
    } catch (e) {
      console.error("[bungie/transfer]", e);
      return reply.code(500).send({ ok: false, error: "transfer_failed" });
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
    // ── Room dissolution: clean up empty unpinned rooms after 1 hour ──────────
  const ROOM_TTL_MS = 60 * 60 * 1000; // 1 hour
  const DISSOLUTION_INTERVAL_MS = 5 * 60 * 1000; // check every 5 minutes

  setInterval(async () => {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [roomId, room] of rooms.entries()) {
      // Skip pinned rooms
      if (room.pinned) continue;
      // Skip lobby rooms
      if (roomId.startsWith("lobby:") || roomId === "lobby" || roomId === "@ops") continue;
      // Skip rooms with users
      if (room.users.size > 0 || room.sockets.size > 0) continue;
      // Skip rooms that haven't been empty long enough
      if (now - room.lastActiveAt < ROOM_TTL_MS) continue;

      toDelete.push(roomId);
    }

    for (const roomId of toDelete) {
      rooms.delete(roomId);
      // Also delete from DB (soft — just remove the room record)
      try {
        await prisma.room.delete({ where: { id: roomId } }).catch(() => {});
        // Clean up related records
        await prisma.roomMessage.deleteMany({ where: { roomId } }).catch(() => {});
        await prisma.roomMember.deleteMany({ where: { roomId } }).catch(() => {});
      } catch {}
      console.log(`[dissolution] Room "${roomId}" dissolved after ${ROOM_TTL_MS / 60000}min empty`);
    }

    if (toDelete.length > 0) {
      console.log(`[dissolution] Cleaned up ${toDelete.length} empty room(s)`);
    }
  }, DISSOLUTION_INTERVAL_MS);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
