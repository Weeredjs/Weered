import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { fetchAndUpsertMod } from "../nexusPoller";

// /mods/* + /crews/:crewId/mods + /users/:userId/mods + /crews/:crewId/loadout
// Mod browser (Windrose-first), self-reported user installs, and crew-scoped
// loadouts. Read endpoints are public; writes are auth-gated. The Nexus poller
// keeps the prisma.mod table fresh in the background; this module just exposes
// reads + lazy-loads any nexus:<id> we haven't seen yet.
type Opts = {
  verifyToken: (token: string) => { id: string } | null;
};

export default async function modsRoutes(app: FastifyInstance, opts: Opts) {
  const { verifyToken } = opts;

  app.get("/mods", async (req, reply) => {
    const q: any = (req as any).query || {};
    const gameSlug = String(q.gameSlug || "windrose").toLowerCase();
    const search = String(q.search || "").trim();
    const sort = String(q.sort || "endorsed").toLowerCase();
    const limit = Math.min(100, Math.max(1, Number(q.limit || 50)));
    const offset = Math.max(0, Number(q.offset || 0));

    const where: any = { gameSlug, excluded: false };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { author: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } },
      ];
    }
    const orderBy: any =
      sort === "updated" ? { sourceUpdatedAt: "desc" } :
      sort === "downloads" ? { downloads: "desc" } :
      sort === "new" ? { fetchedAt: "desc" } :
      { endorsements: "desc" };

    const rows = await (prisma as any).mod.findMany({ where, orderBy, take: limit, skip: offset });
    const total = await (prisma as any).mod.count({ where });
    return reply.send({ mods: rows, total });
  });

  app.get("/mods/:id", async (req, reply) => {
    const id = String((req.params as any).id || "");
    if (!id) return reply.code(400).send({ error: "missing_id" });

    let mod: any = null;
    if (id.startsWith("nexus:")) {
      const sourceId = id.slice("nexus:".length);
      mod = await (prisma as any).mod.findUnique({ where: { source_sourceId: { source: "NEXUS", sourceId } } });
      if (!mod) {
        try { await fetchAndUpsertMod(prisma as any, Number(sourceId)); } catch {}
        mod = await (prisma as any).mod.findUnique({ where: { source_sourceId: { source: "NEXUS", sourceId } } });
      }
    } else {
      mod = await (prisma as any).mod.findUnique({ where: { id } });
    }
    if (!mod || mod.excluded) return reply.code(404).send({ error: "not_found" });

    const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
    const u = verifyToken(token);
    let crewCount = 0;
    let crewInstallers: Array<{ userId: string; name: string }> = [];
    if (u?.id) {
      const myCrews = await (prisma as any).crewMember.findMany({ where: { userId: u.id }, select: { crewId: true } });
      const crewIds = (myCrews as any[]).map((m: any) => m.crewId);
      if (crewIds.length > 0) {
        const crewMemberships = await (prisma as any).crewMember.findMany({ where: { crewId: { in: crewIds } }, select: { userId: true, name: true } });
        const memberIds = Array.from(new Set((crewMemberships as any[]).map((m: any) => m.userId)));
        const installs = await (prisma as any).userModInstall.findMany({
          where: { modId: mod.id, userId: { in: memberIds } },
          select: { userId: true },
        });
        const installSet = new Set((installs as any[]).map((i: any) => i.userId));
        crewCount = installSet.size;
        crewInstallers = (crewMemberships as any[])
          .filter((m: any) => installSet.has(m.userId))
          .slice(0, 8)
          .map((m: any) => ({ userId: m.userId, name: m.name }));
      }
    }

    return reply.send({ mod, crewCount, crewInstallers });
  });

  app.get("/users/:userId/mods", async (req, reply) => {
    const userId = String((req.params as any).userId || "");
    if (!userId) return reply.code(400).send({ error: "missing_userId" });
    const installs = await (prisma as any).userModInstall.findMany({
      where: { userId },
      include: { mod: { select: { id: true, name: true, thumbnailUrl: true, sourceUrl: true, endorsements: true } } },
      orderBy: { installedAt: "desc" },
      take: 100,
    });
    return reply.send({ installs });
  });

  app.get("/crews/:crewId/loadout", async (req, reply) => {
    const crewId = String((req.params as any).crewId || "");
    if (!crewId) return reply.code(400).send({ error: "missing_crewId" });
    const [crewMods, loadouts] = await Promise.all([
      (prisma as any).crewMod.findMany({
        where: { crewId },
        include: { mod: { select: { id: true, name: true, thumbnailUrl: true, sourceUrl: true, endorsements: true, author: true } } },
        orderBy: { addedAt: "desc" },
      }),
      (prisma as any).crewModLoadout.findMany({ where: { crewId }, orderBy: { updatedAt: "desc" } }),
    ]);
    return reply.send({ crewMods, loadouts });
  });

  app.post("/mods/:id/install", async (req, reply) => {
    const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
    const u = verifyToken(token);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const id = String((req.params as any).id || "");
    const b: any = (req as any).body || {};
    const version = String(b.version || "").slice(0, 64);
    const mod = await (prisma as any).mod.findUnique({ where: { id } });
    if (!mod) return reply.code(404).send({ error: "not_found" });
    await (prisma as any).userModInstall.upsert({
      where: { userId_modId: { userId: u.id, modId: mod.id } },
      update: { version, installedAt: new Date() },
      create: { userId: u.id, modId: mod.id, version },
    });
    return reply.send({ ok: true });
  });

  app.post("/mods/:id/uninstall", async (req, reply) => {
    const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
    const u = verifyToken(token);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const id = String((req.params as any).id || "");
    try {
      await (prisma as any).userModInstall.delete({ where: { userId_modId: { userId: u.id, modId: id } } });
    } catch {}
    return reply.send({ ok: true });
  });

  app.post("/crews/:crewId/mods", async (req, reply) => {
    const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
    const u = verifyToken(token);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const crewId = String((req.params as any).crewId || "");
    const b: any = (req as any).body || {};
    const modId = String(b.modId || "");
    const role = String(b.role || "RECOMMENDED").toUpperCase();
    const note = String(b.note || "").slice(0, 280);
    if (!crewId || !modId) return reply.code(400).send({ error: "missing_fields" });

    const membership = await (prisma as any).crewMember.findUnique({ where: { crewId_userId: { crewId, userId: u.id } } });
    if (!membership || !["LEADER", "OFFICER"].includes(String(membership.role))) {
      return reply.code(403).send({ error: "not_authorized" });
    }
    if (!["RECOMMENDED", "REQUIRED", "BANNED"].includes(role)) {
      return reply.code(400).send({ error: "bad_role" });
    }
    const mod = await (prisma as any).mod.findUnique({ where: { id: modId } });
    if (!mod) return reply.code(404).send({ error: "mod_not_found" });

    await (prisma as any).crewMod.upsert({
      where: { crewId_modId: { crewId, modId } },
      update: { role: role as any, note, addedById: u.id },
      create: { crewId, modId, role: role as any, note, addedById: u.id },
    });
    return reply.send({ ok: true });
  });

  app.delete("/crews/:crewId/mods/:modId", async (req, reply) => {
    const token = String((req.headers.authorization || "").replace("Bearer ", "").trim());
    const u = verifyToken(token);
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    const { crewId, modId } = (req.params as any) || {};
    const membership = await (prisma as any).crewMember.findUnique({ where: { crewId_userId: { crewId, userId: u.id } } });
    if (!membership || !["LEADER", "OFFICER"].includes(String(membership.role))) {
      return reply.code(403).send({ error: "not_authorized" });
    }
    try { await (prisma as any).crewMod.delete({ where: { crewId_modId: { crewId, modId } } }); } catch {}
    return reply.send({ ok: true });
  });
}
