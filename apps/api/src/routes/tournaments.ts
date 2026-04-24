import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

// /tournaments/* — admin-created competitions (LEADERBOARD format only
// today; BRACKET + ROUND_ROBIN are on the roadmap). Registration gates
// on Bungie account link. On complete, top-3 receive notoriety.
type Opts = {
  authFromHeader: (h?: string) => { id: string; globalRole?: string } | null;
  awardNotoriety: (userId: string, action: string) => Promise<number | null>;
};

export default async function tournamentsRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, awardNotoriety } = opts;

  app.get("/tournaments", async (req, reply) => {
    const { lobbyId, status } = req.query as any;
    const where: any = {};
    if (lobbyId) where.lobbyId = lobbyId;
    if (status) where.status = status;
    else where.status = { in: ["REGISTRATION", "ACTIVE"] };
    const tournaments = await prisma.tournament.findMany({
      where,
      include: { _count: { select: { entries: true } } },
      orderBy: { startsAt: "asc" },
      take: 50,
    });
    return reply.send({ ok: true, tournaments });
  });

  app.get("/tournaments/:id", async (req, reply) => {
    const id = String((req as any).params?.id || "");
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        entries: { orderBy: { score: "desc" }, take: 100 },
        _count: { select: { entries: true } },
      },
    });
    if (!tournament) return reply.code(404).send({ ok: false, error: "not_found" });
    return reply.send({ ok: true, tournament });
  });

  app.post("/tournaments", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!["GOD", "ADMIN", "STAFF"].includes(u.globalRole || "")) {
      return reply.code(403).send({ ok: false, error: "forbidden" });
    }
    const body = req.body as any;
    const tournament = await prisma.tournament.create({
      data: {
        title: String(body.title || "").trim(),
        description: String(body.description || "").trim(),
        iconUrl: body.iconUrl || null,
        format: body.format || "LEADERBOARD",
        entryType: body.entryType || "SOLO",
        lobbyId: body.lobbyId || null,
        createdById: u.id,
        scoringRule: body.scoringRule || {},
        registrationOpensAt: new Date(body.registrationOpensAt || Date.now()),
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
        maxEntries: parseInt(body.maxEntries) || 100,
        minEntries: parseInt(body.minEntries) || 2,
        rewards: body.rewards || [],
      },
    });
    return reply.send({ ok: true, tournament });
  });

  app.post("/tournaments/:id/register", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const id = String((req as any).params?.id || "");
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: { _count: { select: { entries: true } } },
    });
    if (!tournament) return reply.code(404).send({ ok: false, error: "not_found" });
    if (tournament.status !== "REGISTRATION" && tournament.status !== "ACTIVE") {
      return reply.code(400).send({ ok: false, error: "registration_closed" });
    }
    if (tournament._count.entries >= tournament.maxEntries) {
      return reply.code(400).send({ ok: false, error: "tournament_full" });
    }

    const acct = await prisma.userGameAccount.findFirst({ where: { userId: u.id, gameType: "BUNGIE" } });
    if (!acct) return reply.code(400).send({ ok: false, error: "bungie_not_linked" });

    const userName = (await prisma.user.findUnique({ where: { id: u.id }, select: { name: true } }))?.name || "Unknown";

    try {
      const entry = await prisma.tournamentEntry.create({
        data: {
          tournamentId: id,
          userId: u.id,
          displayName: userName,
        },
      });
      return reply.send({ ok: true, entry });
    } catch (e: any) {
      if (e.code === "P2002") return reply.send({ ok: true, error: "already_registered" });
      throw e;
    }
  });

  app.delete("/tournaments/:id/register", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const id = String((req as any).params?.id || "");
    await prisma.tournamentEntry.deleteMany({
      where: { tournamentId: id, userId: u.id },
    });
    return reply.send({ ok: true });
  });

  app.get("/tournaments/:id/leaderboard", async (req, reply) => {
    const id = String((req as any).params?.id || "");
    const entries = await prisma.tournamentEntry.findMany({
      where: { tournamentId: id },
      orderBy: { score: "desc" },
      take: 100,
    });
    const ranked = entries.map((e, i) => ({ ...e, rank: i + 1 }));
    return reply.send({ ok: true, leaderboard: ranked });
  });

  app.post("/tournaments/:id/activate", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!["GOD", "ADMIN", "STAFF"].includes(u.globalRole || "")) {
      return reply.code(403).send({ ok: false, error: "forbidden" });
    }
    const id = String((req as any).params?.id || "");
    const tournament = await prisma.tournament.update({
      where: { id },
      data: { status: "ACTIVE" },
    });
    return reply.send({ ok: true, tournament });
  });

  app.post("/tournaments/:id/complete", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!["GOD", "ADMIN", "STAFF"].includes(u.globalRole || "")) {
      return reply.code(403).send({ ok: false, error: "forbidden" });
    }
    const id = String((req as any).params?.id || "");
    const entries = await prisma.tournamentEntry.findMany({
      where: { tournamentId: id },
      orderBy: { score: "desc" },
    });
    for (let i = 0; i < entries.length; i++) {
      await prisma.tournamentEntry.update({
        where: { id: entries[i].id },
        data: { rank: i + 1 },
      });
    }
    const tournament = await prisma.tournament.update({
      where: { id },
      data: { status: "COMPLETED" },
    });

    const top3 = entries.slice(0, 3);
    for (let i = 0; i < top3.length; i++) {
      if (top3[i].userId) {
        awardNotoriety(top3[i].userId!, "CHALLENGE_COMPLETED").catch(() => {});
      }
    }

    return reply.send({ ok: true, tournament });
  });
}
