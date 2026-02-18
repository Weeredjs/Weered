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

type RoomUser = { id: string; name: string };
type ChatMsg = { id: string; user: RoomUser; body: string; ts: number };

type RoomState = {
  roomId: string;
  name?: string;
  users: Map<string, RoomUser>;
  sockets: Set<Sock>;
  msgs: ChatMsg[];
};

const rooms = new Map<string, RoomState>();

function getRoom(roomId: string): RoomState {
  let r = rooms.get(roomId);
  if (!r) {
    r = { roomId, name: "", users: new Map(), sockets: new Set(), msgs: [] };
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
    if (o && typeof o === "object" && o.payload && typeof o.payload === "object") {
      return { ...o, ...o.payload };
    }
    return o;
  } catch {
    return null;
  }
}

function withPayload(msg: any) {
  // Emit BOTH formats: top-level + payload (payload for older/newer clients)
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

function send(ws: Sock, msg: any) {
  try {
    if (ws.readyState === 1) ws.send(JSON.stringify(withPayload(msg)));
  } catch {}
}

function broadcast(room: RoomState, msg: any) {
  for (const s of room.sockets) send(s, msg);
}

function publishState(room: RoomState) {
  const users = Array.from(room.users.values());
  broadcast(room, { type: "presence:state", roomId: room.roomId, users, count: users.length });
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

  // clean up empty rooms
  if (room.sockets.size === 0 && room.users.size === 0) {
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

  // Rooms (in-memory)
  app.get("/rooms", async () => {
    const list = Array.from(rooms.values()).map((r) => ({
      id: r.roomId,
      roomId: r.roomId,
      name: r.name || r.roomId,
      users: r.users.size,
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
    while (rooms.has(id) && tries < 10) { id = shortRoomId(6); tries++; }

    const r = getRoom(id);
    r.name = name || r.name || "";

    return reply.send({ ok: true, id: r.roomId, roomId: r.roomId, room: { id: r.roomId, roomId: r.roomId, name: r.name || r.roomId } });
  });

  app.get("/rooms/:roomId", async (req, reply) => {
    const roomId = String((req as any).params?.roomId || "");
    const r = rooms.get(roomId);
    if (!r) return reply.code(404).send({ ok: false, error: "not_found" });
    return reply.send({ ok: true, room: { id: r.roomId, roomId: r.roomId, name: r.name || r.roomId, users: r.users.size } });
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
        if (!u) { send(ws, { type: "auth:fail", reason: "Invalid token" }); try { ws.close(); } catch {} ; return; }
        ws.user = u;
        send(ws, { type: "auth:ok", user: { id: u.id, name: u.name } });
        return;
      }

      if (!ws.user) { send(ws, { type: "auth:fail", reason: "Not authenticated" }); try { ws.close(); } catch {} ; return; }

      if (msg.type === "presence:join") {
        const roomId = String(msg.roomId || "");
        if (!roomId) return;

        if (ws.roomId && ws.roomId !== roomId) leaveRoom(ws);

        const room = getRoom(roomId);
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

      if (msg.type === "chat:send") {
        const roomId = String(msg.roomId || "");
        const body = String(msg.body || "").trim();
        if (!roomId || !body) return;

        const room = rooms.get(roomId);
        if (!room) return;
        if (!room.users.has(ws.user.id)) return;

        const u = room.users.get(ws.user.id)!;
        const m: ChatMsg = { id: randomUUID(), user: { id: u.id, name: u.name }, body, ts: Date.now() };
        room.msgs.push(m);
        if (room.msgs.length > 200) room.msgs.splice(0, room.msgs.length - 200);
        broadcast(room, { type: "chat:new", roomId, msg: m });
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
