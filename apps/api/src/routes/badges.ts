import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

// /badges/* — global badge definitions and per-user earned badges.
// Badges are awarded by the challenge worker; this module just exposes
// read endpoints + admin create.
type Opts = {
  authFromHeader: (h?: string) => { id: string; globalRole?: string } | null;
};

export default async function badgesRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader } = opts;

  app.get("/badges", async (_req, reply) => {
    const badges = await prisma.challengeBadge.findMany({ orderBy: { rarity: "desc" } });
    return reply.send({ ok: true, badges });
  });

  app.get("/badges/user/:userId", async (req, reply) => {
    const uid = String((req as any).params?.userId || "");
    const userBadges = await prisma.userBadge.findMany({
      where: { userId: uid },
      orderBy: { earnedAt: "desc" },
    });
    const badgeIds = userBadges.map(ub => ub.badgeId);
    const badges = badgeIds.length > 0
      ? await prisma.challengeBadge.findMany({ where: { id: { in: badgeIds } } })
      : [];
    const badgeMap = new Map(badges.map(b => [b.id, b]));
    const result = userBadges.map(ub => ({
      ...badgeMap.get(ub.badgeId),
      earnedAt: ub.earnedAt,
    }));
    return reply.send({ ok: true, badges: result });
  });

  app.post("/badges", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!["GOD", "ADMIN", "STAFF"].includes(u.globalRole || "")) {
      return reply.code(403).send({ ok: false, error: "forbidden" });
    }
    const body = req.body as any;
    const badge = await prisma.challengeBadge.create({
      data: {
        name: String(body.name || "").trim(),
        description: String(body.description || "").trim(),
        iconUrl: String(body.iconUrl || "").trim(),
        rarity: parseInt(body.rarity) || 1,
      },
    });
    return reply.send({ ok: true, badge });
  });
}
