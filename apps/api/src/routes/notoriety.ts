import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

// Notoriety read endpoints (extracted from index.ts). Pure reads; no shared
// mutable state. getNotorietyRank + NOTORIETY_RANKS are shared with other
// index.ts code and awardNotoriety, so they are injected (never moved).
type Opts = {
  authFromHeader: (h?: string) => { id: string; name?: string } | null;
  getNotorietyRank: (n: number) => { title: string; min: number; next: { title: string; min: number } | null };
  NOTORIETY_RANKS: { title: string; min: number }[];
};

export default async function notorietyRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, getNotorietyRank, NOTORIETY_RANKS } = opts;

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
}
