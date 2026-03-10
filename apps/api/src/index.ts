import "dotenv/config";

import Fastify from "fastify";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import { randomUUID, randomBytes } from "crypto";
import { AccessToken } from "livekit-server-sdk";
import { PrismaClient, RoomRole, GlobalRole, LobbyRole, ModuleType } from "@prisma/client";

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || "weered-dev-secret";
const HTTP_PORT = Number(process.env.PORT || 4000);
const WS_PORT = Number(process.env.WS_PORT || 4001);

const LIVEKIT_URL = process.env.LIVEKIT_URL || process.env.LIVEKIT_WS_URL || "ws://127.0.0.1:7880";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "";

type AuthedUser = { id: string; name: string; globalRole?: string };
type Sock = WebSocket & { user?: AuthedUser; roomId?: string; pendingRoomId?: string };

type Role = "owner" | "mod" | "member";
type RoomUser = { id: string; name: string; role?: Role };
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
  { id: "lobby",        name: "The Lobby",    description: "General hangout. Everyone starts here.", tags: ["general"],          moduleType: ModuleType.REDDIT,  moduleConfig: { subreddit: "r/all" } },
  { id: "r/all",        name: "r/all",        description: "Reddit firehose. All topics welcome.",   tags: ["reddit","general"],  moduleType: ModuleType.REDDIT,  moduleConfig: { subreddit: "r/all" } },
  { id: "r/gaming",     name: "r/gaming",     description: "Gamers of all kinds.",                   tags: ["reddit","gaming"],   moduleType: ModuleType.REDDIT,  moduleConfig: { subreddit: "r/gaming" } },
  { id: "r/technology", name: "r/technology", description: "Tech news, discussion, builds.",         tags: ["reddit","tech"],     moduleType: ModuleType.REDDIT,  moduleConfig: { subreddit: "r/technology" } },
  { id: "r/worldnews",  name: "r/worldnews",  description: "Global news and current events.",        tags: ["reddit","news"],     moduleType: ModuleType.REDDIT,  moduleConfig: { subreddit: "r/worldnews" } },
  { id: "weered.ca",    name: "Weered HQ",    description: "Meta, announcements, beta feedback.",    tags: ["meta","official"],   moduleType: ModuleType.NONE,    moduleConfig: null },
];

async function seedLobbies() {
  for (const l of SEED_LOBBIES) {
    try {
      await prisma.lobby.upsert({
        where: { id: l.id },
        update: { name: l.name, description: l.description, pinned: true, moduleType: l.moduleType, moduleConfig: l.moduleConfig as any },
        create: { id: l.id, name: l.name, description: l.description, pinned: true, verified: true, moduleType: l.moduleType, moduleConfig: l.moduleConfig as any },
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
  const roleMap = new Map<string, string>();
  for (const s of room.sockets) {
    if (s.user?.id && s.user?.globalRole) roleMap.set(s.user.id, s.user.globalRole);
  }
  const users = Array.from(room.users.values()).map((u) => ({
    ...u,
    role: u.id ? roleOf(room, u.id) : "member",
    globalRole: (u.id ? roleMap.get(u.id) : undefined) ?? (u as any).globalRole ?? "USER",
  }));
  return {
    type: "presence:state", roomId: room.roomId, name: room.name || room.roomId,
    users, count: users.length, locked: Boolean(room.locked),
    ownerId: room.ownerId || "", mods: Array.from(room.mods.values()),
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
      banned: Array.from(room.banned.values()), audit: room.audit.slice(-50),
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
      banned: Array.from(room.banned.values()), audit: room.audit.slice(-50),
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
    const existed = room.users.delete(ws.user.id);
    if (existed) broadcast(room, { type: "presence:leave", roomId, userId: ws.user.id });
    // Do NOT call publishState here — presence:leave is the correct incremental update.
    // Broadcasting a full presence:state snapshot here overwrites other clients' local state
    // and causes the presence flicker bug when users navigate between rooms.
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
    const u = await prisma.user.findUnique({ where: { id: user.id }, select: { globalRole: true } });
    return { ...user, globalRole: String(u?.globalRole ?? "USER") };
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
  const m = String(authHeader).match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  return verifyToken(m[1]);
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
    const userEntry = { id: ws.user.id, name: ws.user.name, globalRole: ws.user.globalRole || "USER" };
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

async function main() {
  const app = Fastify({ logger: true });

  // Health
  app.get("/health", async () => {
    try { await prisma.$queryRaw`SELECT 1`; return { ok: true, db: "ok" }; }
    catch { return { ok: true, db: "down" }; }
  });

  // ── Google OAuth ─────────────────────────────────────────────────────────────
  // Step 1: redirect browser to Google's consent screen
  app.get("/auth/google", async (req, reply) => {
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
    const BASE_URL = process.env.BASE_URL || "https://weered.ca";
    const qs = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: `${BASE_URL}/auth/google/callback`,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "select_account",
    });
    return reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${qs}`);
  });

  // Step 2: Google redirects back here with ?code=...
  app.get("/auth/google/callback", async (req, reply) => {
    const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || "";
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
    const BASE_URL             = process.env.BASE_URL             || "https://weered.ca";
    const WEB_URL              = process.env.WEB_URL              || "https://weered.ca";

    const code = String((req as any).query?.code || "").trim();
    if (!code) return reply.redirect(`${WEB_URL}/login?error=no_code`);

    try {
      // Exchange code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id:     GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri:  `${BASE_URL}/auth/google/callback`,
          grant_type:    "authorization_code",
        }),
      });
      const tokenData: any = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.access_token) {
        console.error("[google/callback] token exchange failed", tokenData);
        return reply.redirect(`${WEB_URL}/login?error=token_exchange`);
      }

      // Fetch user profile from Google
      const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const profile: any = await profileRes.json();
      if (!profile.id) return reply.redirect(`${WEB_URL}/login?error=no_profile`);

      const googleId    = String(profile.id);
      const email       = String(profile.email       || "");
      const displayName = String(profile.name        || profile.email || "User");
      const avatar      = String(profile.picture     || "");

      // Upsert user — find by googleId first, then email, then create fresh
      // 1. Find by googleId
      let user = await prisma.user.findFirst({ where: { googleId } }).catch(() => null);

      // 2. Find by email and link
      if (!user && email) {
        user = await prisma.user.findFirst({ where: { email } }).catch(() => null);
        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: { googleId, avatar: avatar || undefined },
          }).catch(() => {});
        }
      }

      // 3. Create new user
      if (!user) {
        const baseKey = displayName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24) || "user";
        let usernameKey = baseKey;
        let suffix = 1;
        while (await prisma.user.findUnique({ where: { usernameKey } }).catch(() => null)) {
          usernameKey = `${baseKey}${suffix++}`;
        }
        user = await prisma.user.create({
          data: {
            name: displayName,
            usernameKey,
            email: email || null,
            googleId,
            avatar: avatar || null,
          },
        });
      }

      // Issue Weered JWT
      const token = jwt.sign({ sub: user.id, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
      const userJson = encodeURIComponent(JSON.stringify({ id: user.id, name: user.name, avatar }));
      const isNewUser = !user.onboardingComplete;

      // New users go to onboarding to pick a username, existing users go straight home
      const dest = isNewUser
        ? `${WEB_URL}/onboarding?token=${token}&user=${userJson}`
        : `${WEB_URL}/auth/google/finish?token=${token}&user=${userJson}`;
      return reply.redirect(dest);
    } catch (e: any) {
      console.error("[google/callback] error", e);
      return reply.redirect(`${WEB_URL}/login?error=server_error`);
    }
  });

  // Onboarding: check username availability
  app.get("/auth/username-check", async (req, reply) => {
    const username = String((req as any).query?.username || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!username || username.length < 2) return reply.send({ available: false, reason: "too_short" });
    if (username.length > 24) return reply.send({ available: false, reason: "too_long" });
    const existing = await prisma.user.findUnique({ where: { usernameKey: username } }).catch(() => null);
    return reply.send({ available: !existing, username });
  });

  // Onboarding: set username and mark complete
  app.post("/auth/onboarding", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "unauthorized" });
    const body: any = (req as any).body || {};
    const raw = String(body.username || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!raw || raw.length < 2) return reply.code(400).send({ error: "Username too short" });
    if (raw.length > 24) return reply.code(400).send({ error: "Username too long" });
    const existing = await prisma.user.findUnique({ where: { usernameKey: raw } }).catch(() => null);
    if (existing && existing.id !== u.id) return reply.code(409).send({ error: "Username taken" });
    const updated = await prisma.user.update({
      where: { id: u.id },
      data: { usernameKey: raw, name: raw, onboardingComplete: true },
    });
    const token = jwt.sign({ sub: updated.id, name: updated.name }, JWT_SECRET, { expiresIn: "7d" });
    return reply.send({ token, user: { id: updated.id, name: updated.name } });
  });

  // Reddit proxy — fetches server-side to avoid CORS + browser blocks
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
  app.get("/lobbies", async () => {
    const lobbyList = await prisma.lobby.findMany({
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      select: { id: true, name: true, description: true, verified: true, pinned: true, moduleType: true },
    });
    const out = lobbyList.map(l => ({
      id: l.id, lobbyId: l.id, name: l.name, description: l.description,
      verified: l.verified, pinned: l.pinned, moduleType: l.moduleType,
      onlineCount: rooms.get(l.id)?.users.size ?? 0,
    }));
    return { ok: true, lobbies: out };
  });

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
    const room = rooms.get("lobby");
    if (room) room.locked = true;
    await globalAudit(u.id, u.name, "lobby_lock");
    if (room) broadcast(room, { type: "room:locked", roomId: "lobby" });
    return reply.send({ ok: true });
  });

  // POST /staff/lobby/unlock — unlock lobby chat (SUPPORT+)
  app.post("/staff/lobby/unlock", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const room = rooms.get("lobby");
    if (room) room.locked = false;
    await globalAudit(u.id, u.name, "lobby_unlock");
    if (room) broadcast(room, { type: "room:unlocked", roomId: "lobby" });
    return reply.send({ ok: true });
  });

  // POST /staff/lobby/clear-chat — clear lobby messages (STAFF+)
  app.post("/staff/lobby/clear-chat", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const room = rooms.get("lobby");
    await prisma.roomMessage.deleteMany({ where: { roomId: "lobby" } });
    await globalAudit(u.id, u.name, "lobby_clear_chat");
    if (room) broadcast(room, { type: "chat:cleared", roomId: "lobby" });
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
      });
    } catch (e) {
      console.error("[profile GET]", e);
      return reply.code(500).send({ error: "Server error" });
    }
  });

  // PATCH /profile/me  — update own bio
  app.patch("/profile/me", async (req, reply) => {
    const authHeader = (req.headers as any).authorization;
    const viewer = authFromHeader(authHeader);
    if (!viewer) return reply.code(401).send({ error: "Unauthorized" });

    const body: any = (req as any).body || {};
    const bio = typeof body.bio === "string" ? body.bio.trim().slice(0, 280) : undefined;
    const avatarColor = typeof body.avatarColor === "string" ? body.avatarColor.slice(0, 20) : undefined;
    if (bio === undefined && avatarColor === undefined) return reply.code(400).send({ error: "Nothing to update" });

    try {
      const u = await prisma.user.update({
        where: { id: viewer.id },
        data: { ...(bio !== undefined && { bio }), ...(avatarColor !== undefined && { avatarColor }) },
        select: { id: true, bio: true },
      });

      // Award notoriety for completing bio (one-time)
      if (bio.length >= 10) {
        await awardNotoriety(viewer.id, "BIO_COMPLETE");
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
  // ── DM Routes ──────────────────────────────────────────────────────────────

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
          send(ws, { type: "auth:ok", user: { id: ws.user.id, name: ws.user.name, globalRole: ws.user.globalRole } });
          return;
        }

        if (!ws.user) { send(ws, { type: "auth:fail", reason: "Not authenticated" }); return; }


        // ── rooms:list — return lobby directory from DB ───────────────────
        if (msg.type === "rooms:list" || msg.type === "lobby:rooms" || msg.type === "room:list") {
          const [lobbyList, roomList] = await Promise.all([
            prisma.lobby.findMany({
              where: { pinned: true },
              select: { id: true, name: true, description: true, verified: true, pinned: true, moduleType: true },
            }),
            prisma.room.findMany({
              orderBy: { updatedAt: "desc" },
              select: { id: true, name: true, locked: true, lobbyId: true, _count: { select: { members: true } } },
              take: 100,
            }),
          ]);
          const lobbyIds = new Set(lobbyList.map(l => l.id));
          const lobbyOut = lobbyList.map(l => ({
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
          const m: ChatMsg = { id: randomUUID(), user: { id: u.id, name: u.name, role: roleOf(room, u.id) }, body, ts: Date.now() };
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

  process.on("SIGINT", async () => {
    try { await prisma.$disconnect(); } catch {}
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
