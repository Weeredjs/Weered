import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "jsonwebtoken";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import { randomUUID, randomBytes } from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "weered-dev-secret";
const HTTP_PORT = Number(process.env.PORT || 4000);
const WS_PORT = Number(process.env.WS_PORT || 4001);

type AuthedUser = { id: string; name: string };
type Sock = WebSocket & { user?: AuthedUser; roomId?: string };

type RoomUser = { id: string; name: string; role?: "owner" | "mod" | "member" };
type ChatMsg = { id: string; user: RoomUser; body: string; ts: number };
type Knock = { userId: string; name: string; ts: number };

type RoomState = {
  roomId: string;
  name?: string;

  users: Map<string, RoomUser>;
  sockets: Set<Sock>;
  msgs: ChatMsg[];

  ownerId?: string;
  mods: Set<string>;
  banned: Set<string>;
  locked: boolean;

  knocks: Knock[];
};

const rooms = new Map<string, RoomState>();

function getRoom(roomId: string): RoomState {
  let r = rooms.get(roomId);
  if (!r) {
    r = {
      roomId,
      name: "",
      users: new Map(),
      sockets: new Set(),
      msgs: [],
      ownerId: undefined,
      mods: new Set(),
      banned: new Set(),
      locked: false,
      knocks: [],
    };
    rooms.set(roomId, r);
  }
  return r;
}

function safeJson(raw: any): any | null {
  try {
    const s = typeof raw === "string" ? raw : raw?.toString?.("utf8");
    if (!s) return null;
    const o = JSON.parse(s);
    // Accept BOTH formats: {type, roomId,...} and {type, payload:{...}}
    if (o && typeof o === "object" && (o as any).payload && typeof (o as any).payload === "object") {
      return { ...(o as any), ...((o as any).payload) };
    }
    return o;
  } catch {
    return null;
  }
}

function withPayload(msg: any) {
  // Emit BOTH formats
  try {
    if (!msg || typeof msg !== "object") return msg;
    if ((msg as any).payload) return msg;
    const { type, ...rest } = msg as any;
    if (!type) return msg;
    return { ...(msg as any), payload: rest };
  } catch {
    return msg;
  }
}

function send(ws: Sock, msg: any) {
  try {
    if (ws.readyState === 1) ws.send(JSON.stringify(withPayload(msg)));
  } catch {}
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
function isModOrOwner(room: RoomState, userId?: string) {
  return isOwner(room, userId) || isMod(room, userId);
}
function roleOf(room: RoomState, userId: string): "owner" | "mod" | "member" {
  if (isOwner(room, userId)) return "owner";
  if (isMod(room, userId)) return "mod";
  return "member";
}

function publishState(room: RoomState) {
  const users = Array.from(room.users.values()).map((u) => ({
    ...u,
    role: u.id ? roleOf(room, u.id) : "member",
  }));

  broadcast(room, {
    type: "presence:state",
    roomId: room.roomId,
    users,
    count: users.length,
    locked: Boolean(room.locked),
    ownerId: room.ownerId || "",
    mods: Array.from(room.mods.values()),
  });

  // Admin-only extra state (knocks + banned list)
  for (const s of room.sockets) {
    const uid = s.user?.id;
    if (!uid) continue;
    if (!isModOrOwner(room, uid)) continue;
    send(s, {
      type: "room:adminState",
      roomId: room.roomId,
      locked: Boolean(room.locked),
      ownerId: room.ownerId || "",
      mods: Array.from(room.mods.values()),
      knocks: room.knocks.slice(-50),
      banned: Array.from(room.banned.values()),
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
    publishState(room);
  }
  ws.roomId = undefined;

  if (room.sockets.size === 0 && room.users.size === 0 && room.roomId !== "lobby") {
    rooms.delete(roomId);
  }
}

function verifyToken(token?: string): AuthedUser | null {
  if (!token) return null;
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const id = String(decoded?.sub || decoded?.id || "");
    const name = String(decoded?.name || decoded?.username || "");
    if (!id || !name) return null;
    return { id, name };
  } catch {
    return null;
  }
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
  for (const s of room.sockets) {
    if (s.user?.id === userId) out.push(s);
  }
  return out;
}

function removeKnock(room: RoomState, userId: string) {
  room.knocks = room.knocks.filter((k) => k.userId !== userId);
}

async function main() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true, credentials: true });

  app.get("/health", async () => ({ ok: true }));

  app.post("/auth/dev-login", async (req, reply) => {
    const body: any = (req as any).body || {};
    const usernameRaw = typeof body.username === "string" ? body.username : "";
    const username = (usernameRaw || "Guest").trim().slice(0, 32);

    const user = { id: randomUUID(), name: username };
    const token = jwt.sign({ sub: user.id, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
    return reply.send({ token, user });
  });

  app.post("/dev-login", async (req, reply) => {
    const r = await (app as any).inject({
      method: "POST",
      url: "/auth/dev-login",
      payload: (req as any).body || {},
    });
    reply.code(r.statusCode).headers(r.headers).send(r.json());
  });

  // Rooms (in-memory) — hide lobby from list
  app.get("/rooms", async () => {
    const list = Array.from(rooms.values())
      .filter((r) => r.roomId !== "lobby")
      .map((r) => ({
        id: r.roomId,
        roomId: r.roomId,
        name: r.name || r.roomId,
        users: r.users.size,
        locked: Boolean(r.locked),
      }));
    return { ok: true, rooms: list };
  });

  app.post("/rooms", async (req, reply) => {
    const body: any = (req as any).body || {};
    const nameRaw = typeof body.name === "string" ? body.name : "";
    const name = (nameRaw || "").trim().slice(0, 64);

    let wanted = typeof body.roomId === "string" ? body.roomId : "";
    wanted = (wanted || "").trim();
    if (wanted) wanted = wanted.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);

    let id = wanted || shortRoomId(6);
    let tries = 0;
    while (rooms.has(id) && tries < 10) {
      id = shortRoomId(6);
      tries++;
    }

    const r = getRoom(id);
    r.name = name || r.name || "";

    return reply.send({
      ok: true,
      id: r.roomId,
      roomId: r.roomId,
      room: { id: r.roomId, roomId: r.roomId, name: r.name || r.roomId, locked: Boolean(r.locked) },
    });
  });

  app.get("/rooms/:roomId", async (req, reply) => {
    const roomId = String((req as any).params?.roomId || "");
    const r = rooms.get(roomId);
    if (!r) return reply.code(404).send({ ok: false, error: "not_found" });
    return reply.send({
      ok: true,
      room: {
        id: r.roomId,
        roomId: r.roomId,
        name: r.name || r.roomId,
        users: r.users.size,
        locked: Boolean(r.locked),
      },
    });
  });

  await app.listen({ host: "0.0.0.0", port: HTTP_PORT });
  app.log.info(`HTTP listening at http://127.0.0.1:${HTTP_PORT}`);

  const wss = new WebSocketServer({ port: WS_PORT });
  app.log.info(`WS listening on ws://127.0.0.1:${WS_PORT}`);

  wss.on("connection", (rawWs) => {
    const ws = rawWs as Sock;

    ws.on("message", (raw) => {
      const msg = safeJson(raw);
      if (!msg || typeof msg.type !== "string") return;

      if (msg.type === "auth:hello") {
        const u = verifyToken(msg.token);
        if (!u) {
          send(ws, { type: "auth:fail", reason: "Invalid token" });
          return;
        }
        ws.user = u;
        send(ws, { type: "auth:ok", user: { id: u.id, name: u.name } });
        return;
      }

      if (!ws.user) {
        send(ws, { type: "auth:fail", reason: "Not authenticated" });
        return;
      }

      // ---- Presence join/leave ----
      if (msg.type === "presence:join") {
        const roomId = String(msg.roomId || "");
        if (!roomId) return;

        const room = getRoom(roomId);
        if (roomId === "lobby" && !room.name) room.name = "Home Lobby";

        // first real user becomes owner
        if (!room.ownerId) room.ownerId = ws.user.id;

        // banned gate
        if (room.banned.has(ws.user.id)) {
          send(ws, { type: "room:banned", roomId });
          return;
        }

        // locked gate for non-mod
        const uid = ws.user.id;
        if (room.locked && !isModOrOwner(room, uid)) {
          // enqueue knock (dedupe)
          if (!room.knocks.some((k) => k.userId === uid)) {
            room.knocks.push({ userId: uid, name: ws.user.name, ts: Date.now() });
            if (room.knocks.length > 200) room.knocks.splice(0, room.knocks.length - 200);
          }
          send(ws, { type: "room:knock:queued", roomId });

          // notify mods/owner
          for (const s of room.sockets) {
            const sid = s.user?.id;
            if (!sid) continue;
            if (!isModOrOwner(room, sid)) continue;
            send(s, { type: "room:knock", roomId, user: { id: uid, name: ws.user.name } });
          }
          publishState(room);
          return;
        }

        // If switching rooms, leave old
        if (ws.roomId && ws.roomId !== roomId) leaveRoom(ws);

        ws.roomId = roomId;
        room.sockets.add(ws);

        if (!room.users.has(ws.user.id)) {
          room.users.set(ws.user.id, { id: ws.user.id, name: ws.user.name });
          broadcast(room, { type: "presence:join", roomId, user: { id: ws.user.id, name: ws.user.name } });
        }

        publishState(room);
        return;
      }

      if (msg.type === "presence:leave") {
        leaveRoom(ws);
        return;
      }

      // ---- Chat ----
      if (msg.type === "chat:send") {
        const roomId = String(msg.roomId || "");
        const body = String(msg.body || "").trim();
        if (!roomId || !body) return;

        const room = rooms.get(roomId);
        if (!room) return;

        if (!room.users.has(ws.user.id)) return;
        if (room.banned.has(ws.user.id)) return;

        const u = room.users.get(ws.user.id)!;
        const m: ChatMsg = {
          id: randomUUID(),
          user: { id: u.id, name: u.name, role: roleOf(room, u.id) },
          body,
          ts: Date.now(),
        };
        room.msgs.push(m);
        if (room.msgs.length > 200) room.msgs.splice(0, room.msgs.length - 200);
        broadcast(room, { type: "chat:new", roomId, msg: m });
        return;
      }

      // All admin/mod actions require being in a room
      const roomId = String(msg.roomId || ws.roomId || "");
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;

      const actorId = ws.user.id;
      const actorIsMod = isModOrOwner(room, actorId);
      const actorIsOwner = isOwner(room, actorId);

      // ---- Lock/Unlock ----
      if (msg.type === "room:lock") {
        if (!actorIsMod) return;
        room.locked = true;
        publishState(room);
        broadcast(room, { type: "room:locked", roomId, locked: true });
        return;
      }
      if (msg.type === "room:unlock") {
        if (!actorIsMod) return;
        room.locked = false;
        publishState(room);
        broadcast(room, { type: "room:locked", roomId, locked: false });
        return;
      }

      // ---- Admit/Deny knocks ----
      if (msg.type === "room:admit") {
        if (!actorIsMod) return;
        const targetId = String(msg.userId || "");
        if (!targetId) return;

        removeKnock(room, targetId);

        // allow join by sending a direct "admitted" hint (client will re-join)
        send(ws, { type: "room:admit:ok", roomId, userId: targetId });
        publishState(room);
        return;
      }

      if (msg.type === "room:deny") {
        if (!actorIsMod) return;
        const targetId = String(msg.userId || "");
        if (!targetId) return;
        removeKnock(room, targetId);
        publishState(room);
        return;
      }

      // ---- Kick ----
      if (msg.type === "mod:kick") {
        if (!actorIsMod) return;
        const targetId = String(msg.userId || "");
        if (!targetId) return;
        if (isOwner(room, targetId)) return; // don't kick owner

        // remove + disconnect their sockets
        room.users.delete(targetId);
        if (room.mods.has(targetId)) room.mods.delete(targetId);

        for (const s of findSocketsByUser(room, targetId)) {
          send(s, { type: "mod:kicked", roomId });
          try { (s as any).roomId = undefined; } catch {}
        }

        broadcast(room, { type: "presence:leave", roomId, userId: targetId });
        publishState(room);
        return;
      }

      // ---- Ban/Unban ----
      if (msg.type === "mod:ban") {
        if (!actorIsMod) return;
        const targetId = String(msg.userId || "");
        if (!targetId) return;
        if (isOwner(room, targetId)) return;

        room.banned.add(targetId);

        // kick
        room.users.delete(targetId);
        if (room.mods.has(targetId)) room.mods.delete(targetId);

        for (const s of findSocketsByUser(room, targetId)) {
          send(s, { type: "mod:banned", roomId });
          try { (s as any).roomId = undefined; } catch {}
        }

        broadcast(room, { type: "presence:leave", roomId, userId: targetId });
        publishState(room);
        return;
      }

      if (msg.type === "mod:unban") {
        if (!actorIsMod) return;
        const targetId = String(msg.userId || "");
        if (!targetId) return;
        room.banned.delete(targetId);
        publishState(room);
        return;
      }

      // ---- Promote/Demote (owner only) ----
      if (msg.type === "mod:promote") {
        if (!actorIsOwner) return;
        const targetId = String(msg.userId || "");
        if (!targetId) return;
        if (isOwner(room, targetId)) return;
        room.mods.add(targetId);
        publishState(room);
        return;
      }

      if (msg.type === "mod:demote") {
        if (!actorIsOwner) return;
        const targetId = String(msg.userId || "");
        if (!targetId) return;
        if (isOwner(room, targetId)) return;
        room.mods.delete(targetId);
        publishState(room);
        return;
      }
    });

    ws.on("close", () => {
      leaveRoom(ws);
    });
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
