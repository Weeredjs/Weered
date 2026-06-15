import { log, swallow } from "../lib/logger";
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  broadcastToRoom: (roomId: string, event: any) => void;
};

const MAP_PUBLIC_DIR = join(process.cwd(), "..", "web", "public", "maps");
const MAP_MAX_BYTES = 8 * 1024 * 1024;
const PUBLIC_BASE = "/maps";

function ensureDir() {
  if (!existsSync(MAP_PUBLIC_DIR)) mkdirSync(MAP_PUBLIC_DIR, { recursive: true });
}

async function isRoomDM(roomId: string, userId: string): Promise<boolean> {
  const m = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
    select: { role: true },
  });
  return m?.role === "OWNER" || m?.role === "MOD";
}

async function isRoomMember(roomId: string, userId: string): Promise<boolean> {
  const m = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
    select: { id: true },
  });
  return !!m;
}

export default async function mapsRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, broadcastToRoom } = opts;

  app.addContentTypeParser(
    "application/json",
    { bodyLimit: 12 * 1024 * 1024 },
    (_req: any, body: any, done: any) => {
      try {
        const txt = typeof body === "string" ? body : body.toString("utf8");
        done(null, txt ? JSON.parse(txt) : {});
      } catch (e) {
        done(e as Error, undefined);
      }
    },
  );

  app.post("/maps/:roomId/upload", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "unauthorized" });

    const roomId = String((req as any).params?.roomId || "");
    if (!roomId) return reply.code(400).send({ error: "missing_room" });
    if (!(await isRoomDM(roomId, u.id))) return reply.code(403).send({ error: "dm_only" });

    const body: any = (req as any).body || {};
    const dataUrl = String(body.image || "");
    const name = String(body.name || "Untitled Map").slice(0, 80);
    const widthPx = Math.max(64, Math.min(8192, Number(body.widthPx) || 0));
    const heightPx = Math.max(64, Math.min(8192, Number(body.heightPx) || 0));
    if (!widthPx || !heightPx) return reply.code(400).send({ error: "missing_dimensions" });

    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
    if (!match) return reply.code(400).send({ error: "invalid_format" });
    const ext = match[1] === "jpeg" ? "jpg" : match[1];
    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length > MAP_MAX_BYTES) return reply.code(400).send({ error: "too_large" });

    ensureDir();

    const map = await prisma.tacticalMap.create({
      data: {
        roomId,
        name,
        imageUrl: "",
        widthPx,
        heightPx,
        createdById: u.id,
      },
    });
    const filename = `${map.id}.${ext}`;
    const filepath = join(MAP_PUBLIC_DIR, filename);
    try {
      writeFileSync(filepath, buffer);
    } catch (e) {
      await prisma.tacticalMap.delete({ where: { id: map.id } }).catch(swallow);
      log.error("[map upload]", e);
      return reply.code(500).send({ error: "write_failed" });
    }
    const imageUrl = `${PUBLIC_BASE}/${filename}`;
    const updated = await prisma.tacticalMap.update({ where: { id: map.id }, data: { imageUrl } });

    broadcastToRoom(roomId, { type: "map:created", roomId, map: updated });
    return reply.send({ ok: true, map: updated, tokens: [], fogReveals: [] });
  });

  app.get("/maps/:roomId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "unauthorized" });
    const roomId = String((req as any).params?.roomId || "");
    if (!roomId) return reply.code(400).send({ error: "missing_room" });
    if (!(await isRoomMember(roomId, u.id))) return reply.code(403).send({ error: "not_a_member" });

    const map = await prisma.tacticalMap.findFirst({
      where: { roomId },
      orderBy: { createdAt: "desc" },
    });
    if (!map) return reply.send({ ok: true, map: null });

    const isDM = await isRoomDM(roomId, u.id);
    const [tokensRaw, fogReveals] = await Promise.all([
      prisma.mapToken.findMany({
        where: { mapId: map.id },
        orderBy: [{ z: "asc" }, { createdAt: "asc" }],
      }),
      prisma.mapFogReveal.findMany({ where: { mapId: map.id }, select: { x: true, y: true } }),
    ]);
    const tokens = isDM ? tokensRaw : tokensRaw.filter((t) => !t.hidden);

    return reply.send({ ok: true, map, tokens, fogReveals, isDM });
  });

  app.patch("/maps/:mapId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "unauthorized" });
    const mapId = String((req as any).params?.mapId || "");
    const map = await prisma.tacticalMap.findUnique({ where: { id: mapId } });
    if (!map) return reply.code(404).send({ error: "not_found" });
    if (!(await isRoomDM(map.roomId, u.id))) return reply.code(403).send({ error: "dm_only" });

    const b: any = (req as any).body || {};
    const data: any = {};
    if (typeof b.name === "string") data.name = b.name.slice(0, 80);
    if (Number.isFinite(b.gridSize)) data.gridSize = Math.max(8, Math.min(500, Number(b.gridSize)));
    if (typeof b.gridColor === "string" && /^#[0-9a-fA-F]{6}$/.test(b.gridColor))
      data.gridColor = b.gridColor;
    if (Number.isFinite(b.gridOpacity))
      data.gridOpacity = Math.max(0, Math.min(1, Number(b.gridOpacity)));
    if (typeof b.gridEnabled === "boolean") data.gridEnabled = b.gridEnabled;
    if (typeof b.fogEnabled === "boolean") data.fogEnabled = b.fogEnabled;

    const updated = await prisma.tacticalMap.update({ where: { id: mapId }, data });
    broadcastToRoom(map.roomId, { type: "map:updated", roomId: map.roomId, map: updated });
    return reply.send({ ok: true, map: updated });
  });

  app.delete("/maps/:mapId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "unauthorized" });
    const mapId = String((req as any).params?.mapId || "");
    const map = await prisma.tacticalMap.findUnique({ where: { id: mapId } });
    if (!map) return reply.code(404).send({ error: "not_found" });
    if (!(await isRoomDM(map.roomId, u.id))) return reply.code(403).send({ error: "dm_only" });
    if (map.imageUrl) {
      const fname = map.imageUrl.split("/").pop();
      if (fname)
        try {
          unlinkSync(join(MAP_PUBLIC_DIR, fname));
        } catch (e) {
          swallow(e);
        }
    }
    await prisma.tacticalMap.delete({ where: { id: mapId } });
    broadcastToRoom(map.roomId, { type: "map:deleted", roomId: map.roomId, mapId });
    return reply.send({ ok: true });
  });

  app.post("/maps/:mapId/tokens", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "unauthorized" });
    const mapId = String((req as any).params?.mapId || "");
    const map = await prisma.tacticalMap.findUnique({
      where: { id: mapId },
      select: { id: true, roomId: true },
    });
    if (!map) return reply.code(404).send({ error: "not_found" });
    if (!(await isRoomDM(map.roomId, u.id))) return reply.code(403).send({ error: "dm_only" });

    const b: any = (req as any).body || {};
    const kind = ["PC", "NPC", "MONSTER"].includes(b.kind) ? b.kind : "NPC";
    const sizeCells = [1, 2, 3].includes(Number(b.sizeCells)) ? Number(b.sizeCells) : 1;
    const token = await prisma.mapToken.create({
      data: {
        mapId,
        name: String(b.name || "Token").slice(0, 40),
        color:
          typeof b.color === "string" && /^#[0-9a-fA-F]{6}$/.test(b.color) ? b.color : "#C4A55A",
        imageUrl: typeof b.imageUrl === "string" ? b.imageUrl.slice(0, 500) : null,
        sizeCells,
        x: Number.isFinite(b.x) ? Number(b.x) : 0,
        y: Number.isFinite(b.y) ? Number(b.y) : 0,
        z: kind === "PC" ? 10 : kind === "NPC" ? 5 : 0,
        hp: Number.isFinite(b.hp) ? Number(b.hp) : 0,
        hpMax: Number.isFinite(b.hpMax) ? Number(b.hpMax) : 0,
        hpVisible: typeof b.hpVisible === "boolean" ? b.hpVisible : true,
        ownerId: typeof b.ownerId === "string" ? b.ownerId : null,
        hidden: typeof b.hidden === "boolean" ? b.hidden : false,
        kind,
        combatantId: typeof b.combatantId === "string" ? b.combatantId : null,
      },
    });
    broadcastToRoom(map.roomId, { type: "map:token-add", roomId: map.roomId, token });
    return reply.send({ ok: true, token });
  });

  app.patch("/maps/tokens/:tokenId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "unauthorized" });
    const tokenId = String((req as any).params?.tokenId || "");
    const token = await prisma.mapToken.findUnique({
      where: { id: tokenId },
      include: { map: { select: { roomId: true } } },
    });
    if (!token) return reply.code(404).send({ error: "not_found" });
    const isDM = await isRoomDM(token.map.roomId, u.id);
    const isOwner = token.ownerId === u.id;
    if (!isDM && !isOwner) return reply.code(403).send({ error: "forbidden" });

    const b: any = (req as any).body || {};
    const data: any = {};
    if (Number.isFinite(b.x)) data.x = Number(b.x);
    if (Number.isFinite(b.y)) data.y = Number(b.y);
    if (isDM) {
      if (typeof b.name === "string") data.name = b.name.slice(0, 40);
      if (typeof b.color === "string" && /^#[0-9a-fA-F]{6}$/.test(b.color)) data.color = b.color;
      if (typeof b.imageUrl === "string" || b.imageUrl === null)
        data.imageUrl = b.imageUrl ? b.imageUrl.slice(0, 500) : null;
      if ([1, 2, 3].includes(Number(b.sizeCells))) data.sizeCells = Number(b.sizeCells);
      if (Number.isFinite(b.hp)) data.hp = Number(b.hp);
      if (Number.isFinite(b.hpMax)) data.hpMax = Number(b.hpMax);
      if (typeof b.hpVisible === "boolean") data.hpVisible = b.hpVisible;
      if (typeof b.hidden === "boolean") data.hidden = b.hidden;
      if (typeof b.ownerId === "string" || b.ownerId === null) data.ownerId = b.ownerId;
      if (["PC", "NPC", "MONSTER"].includes(b.kind)) data.kind = b.kind;
      if (typeof b.combatantId === "string" || b.combatantId === null)
        data.combatantId = b.combatantId;
    }
    const updated = await prisma.mapToken.update({ where: { id: tokenId }, data });
    broadcastToRoom(token.map.roomId, {
      type: "map:token-update",
      roomId: token.map.roomId,
      token: updated,
    });
    return reply.send({ ok: true, token: updated });
  });

  app.delete("/maps/tokens/:tokenId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "unauthorized" });
    const tokenId = String((req as any).params?.tokenId || "");
    const token = await prisma.mapToken.findUnique({
      where: { id: tokenId },
      include: { map: { select: { roomId: true } } },
    });
    if (!token) return reply.code(404).send({ error: "not_found" });
    if (!(await isRoomDM(token.map.roomId, u.id)))
      return reply.code(403).send({ error: "dm_only" });

    await prisma.mapToken.delete({ where: { id: tokenId } });
    broadcastToRoom(token.map.roomId, {
      type: "map:token-remove",
      roomId: token.map.roomId,
      tokenId,
    });
    return reply.send({ ok: true });
  });

  app.post("/maps/:mapId/fog/reveal", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "unauthorized" });
    const mapId = String((req as any).params?.mapId || "");
    const map = await prisma.tacticalMap.findUnique({
      where: { id: mapId },
      select: { id: true, roomId: true },
    });
    if (!map) return reply.code(404).send({ error: "not_found" });
    if (!(await isRoomDM(map.roomId, u.id))) return reply.code(403).send({ error: "dm_only" });

    const cells: { x: number; y: number }[] = Array.isArray((req as any).body?.cells)
      ? (req as any).body.cells
      : [];
    const clean = cells
      .map((c) => ({ x: Math.round(Number(c.x)), y: Math.round(Number(c.y)) }))
      .filter(
        (c) =>
          Number.isFinite(c.x) &&
          Number.isFinite(c.y) &&
          c.x >= 0 &&
          c.y >= 0 &&
          c.x < 1000 &&
          c.y < 1000,
      )
      .slice(0, 5000);
    if (!clean.length) return reply.send({ ok: true, added: 0 });

    await prisma.$transaction(
      clean.map((c) =>
        prisma.mapFogReveal.upsert({
          where: { mapId_x_y: { mapId, x: c.x, y: c.y } },
          create: { mapId, x: c.x, y: c.y },
          update: {},
        }),
      ),
    );
    broadcastToRoom(map.roomId, {
      type: "map:fog-reveal",
      roomId: map.roomId,
      mapId,
      cells: clean,
    });
    return reply.send({ ok: true, added: clean.length });
  });

  app.post("/maps/:mapId/fog/clear", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "unauthorized" });
    const mapId = String((req as any).params?.mapId || "");
    const map = await prisma.tacticalMap.findUnique({
      where: { id: mapId },
      select: { id: true, roomId: true },
    });
    if (!map) return reply.code(404).send({ error: "not_found" });
    if (!(await isRoomDM(map.roomId, u.id))) return reply.code(403).send({ error: "dm_only" });

    const b: any = (req as any).body || {};
    if (b.all === true) {
      await prisma.mapFogReveal.deleteMany({ where: { mapId } });
      broadcastToRoom(map.roomId, { type: "map:fog-clear", roomId: map.roomId, mapId, all: true });
      return reply.send({ ok: true });
    }
    const cells: { x: number; y: number }[] = Array.isArray(b.cells) ? b.cells : [];
    const clean = cells
      .map((c) => ({ x: Math.round(Number(c.x)), y: Math.round(Number(c.y)) }))
      .filter((c) => Number.isFinite(c.x) && Number.isFinite(c.y))
      .slice(0, 5000);
    if (!clean.length) return reply.send({ ok: true, removed: 0 });

    await prisma.mapFogReveal.deleteMany({
      where: { mapId, OR: clean.map((c) => ({ x: c.x, y: c.y })) },
    });
    broadcastToRoom(map.roomId, { type: "map:fog-clear", roomId: map.roomId, mapId, cells: clean });
    return reply.send({ ok: true, removed: clean.length });
  });
}
