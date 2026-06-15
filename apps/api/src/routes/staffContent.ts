import { swallow } from "../lib/logger";
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

// Staff content management (extracted from index.ts): room dashboard +
// announcement/banner CRUD. Staff-gated. rooms is injected by reference
// (read-only here). annDb is a local prisma cast; the announcement seed IIFE
// stays in index.ts.
type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  getGlobalRole: (userId: string) => Promise<any>;
  canAccessStaff: (role: any) => boolean;
  globalAudit: (
    actorId: string,
    actorName: string,
    action: string,
    targetId?: string,
    targetName?: string,
    meta?: any,
  ) => Promise<void>;
  rooms: Map<string, any>;
};

export default async function staffContentRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, getGlobalRole, canAccessStaff, globalAudit, rooms } = opts;
  const annDb = prisma as any;

  app.get("/staff/rooms", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const list = await prisma.room.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        locked: true,
        createdAt: true,
        lobbyId: true,
        _count: { select: { members: true } },
      },
    });
    const roomsMem = new Map([...rooms.entries()]);
    const enriched = list.map((r) => {
      const mem = roomsMem.get(r.id);
      return {
        id: r.id,
        name: r.name || "",
        locked: Boolean(r.locked),
        members: r._count.members,
        createdAt: r.createdAt.toISOString(),
        lobbyId: r.lobbyId || null,
        pinned: mem?.pinned || false,
        liveUsers: mem?.users.size || 0,
        lastActiveAt: mem?.lastActiveAt || null,
      };
    });
    return reply.send({ ok: true, rooms: enriched });
  });

  app.get("/staff/announcements", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false });
    if (!canAccessStaff(await getGlobalRole(u.id))) return reply.code(403).send({ ok: false });
    const items = await annDb.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    return reply.send({
      ok: true,
      announcements: items.map((a: any) => ({ ...a, createdAt: a.createdAt?.toISOString?.() })),
    });
  });

  app.post("/staff/announcements", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false });
    if (!canAccessStaff(await getGlobalRole(u.id))) return reply.code(403).send({ ok: false });
    const b: any = (req as any).body || {};
    const message = String(b.message || "")
      .trim()
      .slice(0, 500);
    if (!message) return reply.code(400).send({ ok: false, error: "message required" });
    const level = ["info", "warning", "urgent"].includes(b.level) ? b.level : "info";
    const a = await annDb.announcement.create({
      data: {
        message,
        level,
        pinned: !!b.pinned,
        sticky: !!b.pinned && !!b.sticky,
        createdById: u.id,
        createdByName: u.name,
      },
    });
    await globalAudit(u.id, u.name, "announcement_create", a.id, undefined, {
      message,
      level,
      pinned: !!b.pinned,
    });
    return reply.send({
      ok: true,
      announcement: { ...a, createdAt: a.createdAt?.toISOString?.() },
    });
  });

  app.patch("/staff/announcements/:id", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false });
    if (!canAccessStaff(await getGlobalRole(u.id))) return reply.code(403).send({ ok: false });
    const id = String((req as any).params?.id || "");
    const b: any = (req as any).body || {};
    const data: any = {};
    if (b.pinned !== undefined) data.pinned = !!b.pinned;
    if (b.sticky !== undefined) data.sticky = !!b.sticky;
    if (data.pinned === false) data.sticky = false;
    const a = await annDb.announcement.update({ where: { id }, data });
    await globalAudit(u.id, u.name, "announcement_update", id, undefined, data);
    return reply.send({
      ok: true,
      announcement: { ...a, createdAt: a.createdAt?.toISOString?.() },
    });
  });

  app.delete("/staff/announcements/:id", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false });
    if (!canAccessStaff(await getGlobalRole(u.id))) return reply.code(403).send({ ok: false });
    const id = String((req as any).params?.id || "");
    await annDb.announcement.delete({ where: { id } }).catch(swallow);
    await globalAudit(u.id, u.name, "announcement_delete", id);
    return reply.send({ ok: true });
  });

  app.post("/staff/banner", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false });
    if (!canAccessStaff(await getGlobalRole(u.id))) return reply.code(403).send({ ok: false });
    const { message, level, clear } = (req as any).body || {};
    if (clear) {
      await annDb.announcement.updateMany({
        where: { pinned: true },
        data: { pinned: false, sticky: false },
      });
      return reply.send({ ok: true, banner: null });
    }
    if (!message) return reply.code(400).send({ ok: false, error: "message required" });
    const a = await annDb.announcement.create({
      data: {
        message: String(message).slice(0, 500),
        level: level || "info",
        pinned: true,
        sticky: true,
        createdById: u.id,
        createdByName: u.name,
      },
    });
    return reply.send({
      ok: true,
      banner: { id: a.id, message: a.message, level: a.level, sticky: true, from: u.name, ts: 1 },
    });
  });
}
