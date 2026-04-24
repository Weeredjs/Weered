import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { LobbyRole, RoomRole } from "@prisma/client";
import bcrypt from "bcryptjs";

// /rooms/* — room CRUD, owner appearance edits, and the AI-NPC subsystem
// (D&D-flavored characters that chat via Claude Haiku). Rooms are tightly
// coupled to the WS layer in main(): live presence, message broadcast,
// and the rooms Map are passed in via opts. The NPC routes use Anthropic
// directly with a small per-user cooldown.
type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  verifyToken: (token: string) => { id: string; name: string; globalRole?: string } | null;
  getGlobalRole: (userId: string) => Promise<string | null>;
  canAccessStaff: (role: string | null) => boolean;
  rooms: Map<string, any>;
  ensureRoomLoaded: (roomId: string) => Promise<any>;
  normalizeRoomId: (id: string) => string;
  buildStatePayload: (room: any) => any;
  send: (sock: any, payload: any) => void;
  shortRoomId: (n: number) => string;
};

export default async function roomsRoutes(app: FastifyInstance, opts: Opts) {
  const {
    authFromHeader, verifyToken, getGlobalRole, canAccessStaff,
    rooms, ensureRoomLoaded, normalizeRoomId, buildStatePayload, send, shortRoomId,
  } = opts;

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

// ── Room creation rate limit (anti-spam) ────────────────────────────
// Sliding window per user + active-room ceiling.
const roomCreateWindow = new Map<string, number[]>();
const ROOM_CREATE_WINDOW_MS   = 60 * 60 * 1000; // 1h window
const ROOM_CREATE_MAX_PER_HR  = 8;              // 8 rooms / user / hour
const ROOM_USER_ACTIVE_CAP    = 25;             // 25 active user-owned rooms
const ROOM_LOBBY_CEILING      = 500;            // hard ceiling per lobby (excl. pinned)

app.post("/rooms", async (req, reply) => {
  const u = authFromHeader((req as any).headers?.authorization);
  if (!u) return reply.code(401).send({ ok: false, error: "unauthorized", message: "Sign in to create rooms." });
  const body: any = (req as any).body || {};
  const name = (typeof body.name === "string" ? body.name : "").trim().slice(0, 64);
  const lobbyId = typeof body.lobbyId === "string" ? body.lobbyId.trim() : null;

  if (!name) return reply.code(400).send({ ok: false, error: "name_required" });
  if (!lobbyId) return reply.code(400).send({ ok: false, error: "lobbyId_required" });

  // Staff bypass all rate/count limits
  const actorRole = await getGlobalRole(u.id);
  const isStaff = canAccessStaff(actorRole);

  if (!isStaff) {
    // 1. Sliding-window rate limit
    const now = Date.now();
    const userWindow = (roomCreateWindow.get(u.id) || []).filter(t => now - t < ROOM_CREATE_WINDOW_MS);
    if (userWindow.length >= ROOM_CREATE_MAX_PER_HR) {
      const oldest = userWindow[0];
      const waitMs = ROOM_CREATE_WINDOW_MS - (now - oldest);
      return reply.code(429).send({
        ok: false, error: "rate_limited",
        message: `Too many rooms. Try again in ${Math.ceil(waitMs / 60000)} min.`,
        retryAfterMs: waitMs,
      });
    }

    // 2. Active-room ceiling per user (counts only user-owned, non-pinned)
    const activeCount = await prisma.room.count({
      where: { ownerId: u.id, pinned: false },
    });
    if (activeCount >= ROOM_USER_ACTIVE_CAP) {
      return reply.code(400).send({
        ok: false, error: "room_cap_reached",
        message: `You already own ${activeCount} rooms. Clean some up before creating more.`,
      });
    }

    // 3. Per-lobby ceiling
    const lobbyCount = await prisma.room.count({
      where: { lobbyId, pinned: false },
    });
    if (lobbyCount >= ROOM_LOBBY_CEILING) {
      return reply.code(400).send({
        ok: false, error: "lobby_full",
        message: "This lobby has hit its room cap. Try a different lobby.",
      });
    }

    userWindow.push(now);
    roomCreateWindow.set(u.id, userWindow);
  }

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

  // Event rooms: only staff or lobby owner may create
  let isEvent = Boolean(body.isEvent);
  if (isEvent) {
    const actorRole = u ? await getGlobalRole(u.id) : "USER";
    const isStaff = canAccessStaff(actorRole);
    const isLobbyOwner = !!u && !!lobby.ownerId && lobby.ownerId === u.id;
    if (!isStaff && !isLobbyOwner) isEvent = false;
  }

  // Optional: creator can pre-pick which stage module the room opens with.
  const VALID_MODULES = ["voice", "youtube", "twitch", "browser", "article", "video", "screen", "fakeout", "poker", "destiny", "league", "fortnite", "pubg", "hq", "cs2", "dota2", "study", "dnd"];
  const rawDM = typeof body.defaultModule === "string" ? body.defaultModule.trim().toLowerCase() : "";
  const defaultModule = VALID_MODULES.includes(rawDM) ? rawDM : null;
  await prisma.room.create({ data: { id, name, locked: false, ownerId, lobbyId, isEvent, defaultModule } as any });

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
  r.isEvent = isEvent;
  if (ownerId) r.ownerId = ownerId;
  if (passwordHash) r.passwordHash = passwordHash;
  rooms.set(id, r);
  return reply.send({ ok: true, id, roomId: id, room: { id, roomId: id, name, locked: false, lobbyId, hasPassword: !!passwordHash, isEvent, defaultModule } });
});

app.get("/rooms/:roomId", async (req, reply) => {
  const roomId = String((req as any).params?.roomId || "");
  const r: any = await prisma.room.findUnique({ where: { id: roomId } });
  if (!r) return reply.code(404).send({ ok: false, error: "not_found" });
  return reply.send({
    ok: true,
    room: {
      id: r.id,
      roomId: r.id,
      name: r.name || r.id,
      description: r.description || "",
      locked: Boolean(r.locked),
      pinned: Boolean(r.pinned),
      isEvent: Boolean(r.isEvent),
      ownerId: r.ownerId || null,
      lobbyId: r.lobbyId || null,
      iconUrl: r.iconUrl || null,
      bannerUrl: r.bannerUrl || null,
      accentColor: r.accentColor || null,
      defaultModule: r.defaultModule || null,
    },
  });
});

// PATCH /rooms/:roomId — owner / staff edit room appearance + description.
// Kept narrow on purpose: name / password / lobby moves stay with the
// existing room admin flow. This is just "make the room look yours".
app.patch("/rooms/:roomId", async (req, reply) => {
  const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
  const u = verifyToken(token);
  if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
  const roomId = String((req.params as any).roomId || "");
  const r: any = await prisma.room.findUnique({ where: { id: roomId } });
  if (!r) return reply.code(404).send({ ok: false, error: "not_found" });

  const isOwner = r.ownerId && r.ownerId === u.id;
  const globalRole = String((u as any).globalRole || "USER").toUpperCase();
  const isStaff = ["GOD", "STAFF", "SUPPORT"].includes(globalRole);
  if (!isOwner && !isStaff) return reply.code(403).send({ ok: false, error: "not_authorized" });

  const body: any = (req as any).body || {};
  const data: any = {};
  if (typeof body.description === "string") data.description = body.description.slice(0, 500);
  if (typeof body.iconUrl === "string" || body.iconUrl === null) data.iconUrl = body.iconUrl ? String(body.iconUrl).slice(0, 600) : null;
  if (typeof body.bannerUrl === "string" || body.bannerUrl === null) data.bannerUrl = body.bannerUrl ? String(body.bannerUrl).slice(0, 600) : null;
  if (typeof body.accentColor === "string" || body.accentColor === null) {
    const v = body.accentColor ? String(body.accentColor).trim() : null;
    if (v && !/^#[0-9a-f]{6}$/i.test(v)) return reply.code(400).send({ ok: false, error: "bad_accent" });
    data.accentColor = v;
  }
  if (Object.keys(data).length === 0) return reply.code(400).send({ ok: false, error: "no_changes" });

  const updated: any = await (prisma as any).room.update({ where: { id: roomId }, data });

  // Push the new appearance into any live in-memory room state and
  // rebroadcast so every connected socket sees the change immediately.
  const live = rooms.get(normalizeRoomId(roomId));
  if (live) {
    if ("description" in data) live.description = updated.description || undefined;
    if ("iconUrl" in data) live.iconUrl = updated.iconUrl || undefined;
    if ("bannerUrl" in data) live.bannerUrl = updated.bannerUrl || undefined;
    if ("accentColor" in data) live.accentColor = updated.accentColor || undefined;
    const payload = buildStatePayload(live);
    for (const sock of live.sockets) send(sock as any, payload);
  }

  return reply.send({
    ok: true,
    room: {
      id: updated.id,
      name: updated.name,
      description: updated.description || "",
      iconUrl: updated.iconUrl || null,
      bannerUrl: updated.bannerUrl || null,
      accentColor: updated.accentColor || null,
    },
  });
});

// ── NPC API (AI-driven NPCs in rooms) ───────────────────────────────────────

function buildNpcSystemPrompt(name: string, cfg: any): string {
  return [
    `You are ${name}, a character in a Dungeons & Dragons world.`,
    `\nPERSONALITY: ${cfg.personality || "A friendly NPC."}`,
    `APPEARANCE: ${cfg.appearance || "An ordinary person."}`,
    `WHAT YOU KNOW: ${cfg.knowledge || "Common knowledge of the local area."}`,
    `SECRETS (do NOT reveal these easily — only hint if pressed hard, and never all at once): ${cfg.secrets || "None."}`,
    `\nRULES:`,
    `- Stay in character at ALL times. You ARE ${name}.`,
    `- Be conversational and concise — 1 to 3 sentences. Longer only if asked for a story or explanation.`,
    `- Show emotion, suspicion, humor, or fear as ${name} would.`,
    `- You do NOT know you are an AI. You live in this fantasy world.`,
    `- If asked about things outside your knowledge, say you don't know.`,
    `- If players try to get your secrets, be evasive, nervous, or change the subject. Never just hand them over.`,
    `- Address the speaker as "adventurer," "traveler," or by name if they introduced themselves.`,
    `- You may use *asterisks* for actions like *leans in* or *glances around nervously*.`,
  ].join("\n");
}

// List NPCs in a room
app.get("/rooms/:roomId/npcs", async (req, reply) => {
  const roomId = String((req as any).params?.roomId || "");
  const npcs = await prisma.roomNpc.findMany({ where: { roomId }, orderBy: { createdAt: "asc" } });
  return reply.send({ ok: true, npcs });
});

// Create NPC
app.post("/rooms/:roomId/npcs", async (req, reply) => {
  const u = authFromHeader((req as any).headers?.authorization);
  if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
  const roomId = String((req as any).params?.roomId || "");
  const body: any = (req as any).body || {};
  const name = (typeof body.name === "string" ? body.name : "").trim().slice(0, 64);
  if (!name) return reply.code(400).send({ ok: false, error: "name_required" });

  const config = body.config || {};
  const npc = await prisma.roomNpc.create({
    data: { roomId, name, portrait: (typeof body.portrait === "string" ? body.portrait : "🧙").slice(0, 10), config, createdBy: u.id },
  });

  // Save greeting as the first message
  if (config.greeting) {
    await prisma.npcMessage.create({ data: { npcId: npc.id, role: "assistant", content: config.greeting } });
  }
  return reply.send({ ok: true, npc });
});

// Update NPC
app.put("/rooms/:roomId/npcs/:npcId", async (req, reply) => {
  const u = authFromHeader((req as any).headers?.authorization);
  if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
  const npcId = String((req as any).params?.npcId || "");
  const body: any = (req as any).body || {};
  const data: any = {};
  if (typeof body.name === "string") data.name = body.name.trim().slice(0, 64);
  if (typeof body.portrait === "string") data.portrait = body.portrait.slice(0, 10);
  if (body.config) data.config = body.config;
  const npc = await prisma.roomNpc.update({ where: { id: npcId }, data });
  return reply.send({ ok: true, npc });
});

// Delete NPC
app.delete("/rooms/:roomId/npcs/:npcId", async (req, reply) => {
  const u = authFromHeader((req as any).headers?.authorization);
  if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
  const npcId = String((req as any).params?.npcId || "");
  await prisma.roomNpc.delete({ where: { id: npcId } }).catch(() => {});
  return reply.send({ ok: true });
});

// Get NPC chat history
app.get("/rooms/:roomId/npcs/:npcId/messages", async (req, reply) => {
  const npcId = String((req as any).params?.npcId || "");
  const messages = await prisma.npcMessage.findMany({ where: { npcId }, orderBy: { createdAt: "asc" }, take: 100 });
  return reply.send({ ok: true, messages });
});

// Chat with NPC — sends to Claude, returns AI response
const npcCooldowns = new Map<string, number>();
app.post("/rooms/:roomId/npcs/:npcId/messages", async (req, reply) => {
  const u = authFromHeader((req as any).headers?.authorization);
  if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

  // Rate limit: 1 msg per 3s per user
  const cdKey = u.id;
  const now = Date.now();
  if ((npcCooldowns.get(cdKey) || 0) > now - 3000) return reply.code(429).send({ ok: false, error: "slow_down" });
  npcCooldowns.set(cdKey, now);

  const npcId = String((req as any).params?.npcId || "");
  const body: any = (req as any).body || {};
  const content = (typeof body.content === "string" ? body.content : "").trim().slice(0, 1000);
  if (!content) return reply.code(400).send({ ok: false, error: "content_required" });

  const npc = await prisma.roomNpc.findUnique({ where: { id: npcId } });
  if (!npc) return reply.code(404).send({ ok: false, error: "npc_not_found" });

  const cfg = (npc.config as any) || {};

  // Save user message
  await prisma.npcMessage.create({ data: { npcId, userId: u.id, userName: u.name || "", role: "user", content } });

  // Get recent conversation (last 30 messages for context window)
  const history = await prisma.npcMessage.findMany({ where: { npcId }, orderBy: { createdAt: "asc" }, take: 30 });
  const claudeMessages = history.map((m: any) => ({
    role: m.role as "user" | "assistant",
    content: m.role === "user" ? `[${m.userName || "Adventurer"}]: ${m.content}` : m.content,
  }));

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return reply.code(500).send({ ok: false, error: "ai_not_configured" });

  try {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system: buildNpcSystemPrompt(npc.name, cfg),
        messages: claudeMessages,
      }),
    });
    const aiData: any = await aiRes.json();
    const aiText = aiData?.content?.[0]?.text || "*says nothing*";

    const saved = await prisma.npcMessage.create({ data: { npcId, role: "assistant", content: aiText } });
    return reply.send({ ok: true, message: saved });
  } catch (e: any) {
    console.error("NPC chat error:", e?.message || e);
    return reply.code(500).send({ ok: false, error: "ai_error" });
  }
});
}
