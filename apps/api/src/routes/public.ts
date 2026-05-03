import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { getActivity } from "../lib/publicActivity";

// /public/* — read-only endpoints for the logged-out landing page.
// No auth, cached briefly, no PII.

type Opts = {
  rooms: Map<string, { users: Set<string>; sockets: Set<any>; [k: string]: any }>;
  applyWindroseReel?: (lobby: any) => any;
};

// Curated featured order — top of the wall on the landing page. Anything
// outside this list still ships if pinned, but ordered after.
const FEATURED_ORDER = [
  "dnd", "fakeout", "windrose", "destiny", "poker", "study",
  "league", "cs2", "dota2", "fortnite", "pubg", "poe",
  "mlb", "nhl", "pga", "marathon", "hq", "news",
];

export default async function publicRoutes(app: FastifyInstance, opts: Opts) {
  const { rooms, applyWindroseReel } = opts;

  app.get("/public/lobbies/featured", async (_req, reply) => {
    const lobbies = await (prisma as any).lobby.findMany({
      where: { OR: [{ pinned: true }, { id: { in: FEATURED_ORDER } }] },
      select: {
        id: true, name: true, description: true, verified: true, pinned: true,
        moduleType: true, accentColor: true, logoUrl: true, bannerUrl: true,
        keywords: true,
        _count: { select: { rooms: true, members: true } },
      },
      take: 60,
    });
    const order = new Map(FEATURED_ORDER.map((id, i) => [id, i]));
    const sorted = (lobbies as any[]).slice().sort((a, b) => {
      const ai = order.has(a.id) ? (order.get(a.id) as number) : 999;
      const bi = order.has(b.id) ? (order.get(b.id) as number) : 999;
      if (ai !== bi) return ai - bi;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
    const enriched = sorted.map((l: any) => {
      const liveCount = rooms.get(l.id)?.users?.size ?? 0;
      const reeled = applyWindroseReel ? applyWindroseReel({ ...l, onlineCount: liveCount }) : { ...l, onlineCount: liveCount };
      return {
        id: l.id,
        name: l.name,
        description: l.description,
        moduleType: l.moduleType,
        accentColor: l.accentColor || "#D9A942",
        logoUrl: l.logoUrl || null,
        bannerUrl: reeled.bannerUrl || l.bannerUrl || null,
        memberCount: l._count?.members ?? 0,
        roomCount: l._count?.rooms ?? 0,
        liveCount,
        verified: !!l.verified,
        keywords: Array.isArray(l.keywords) ? l.keywords.slice(0, 6) : [],
      };
    });
    reply.header("Cache-Control", "public, max-age=20, s-maxage=20");
    return reply.send({ ok: true, lobbies: enriched.slice(0, 18) });
  });

  app.get("/public/activity", async (_req, reply) => {
    const events = getActivity(30);
    reply.header("Cache-Control", "public, max-age=5, s-maxage=5");
    return reply.send({ ok: true, events });
  });
}
