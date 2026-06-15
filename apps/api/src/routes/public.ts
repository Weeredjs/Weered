import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { getActivity } from "../lib/publicActivity";

type Opts = {
  rooms: Map<string, { users: Set<string>; sockets: Set<any>; [k: string]: any }>;
  applyWindroseReel?: (lobby: any) => any;
  authFromHeader?: (h?: string) => { id: string; name: string } | null;
};

const LOBBY_NAME_TTL_MS = 60_000;
let _lobbyNameCache: { ts: number; map: Map<string, string> } | null = null;
async function getLobbyNameMap(): Promise<Map<string, string>> {
  const now = Date.now();
  if (_lobbyNameCache && now - _lobbyNameCache.ts < LOBBY_NAME_TTL_MS) {
    return _lobbyNameCache.map;
  }
  const rows = await prisma.lobby.findMany({ select: { id: true, name: true } });
  const map = new Map<string, string>();
  for (const r of rows) map.set(String(r.id), String(r.name || r.id));
  _lobbyNameCache = { ts: now, map };
  return map;
}

const FEATURED_ORDER = [
  "dnd", "fakeout", "windrose", "destiny", "poker", "study",
  "league", "cs2", "dota2", "fortnite", "pubg", "poe",
  "mlb", "nhl", "pga", "marathon", "hq", "news",
];

export default async function publicRoutes(app: FastifyInstance, opts: Opts) {
  const { rooms, applyWindroseReel, authFromHeader } = opts;

  app.get("/public/lobbies/featured", async (_req, reply) => {
    const lobbies = await prisma.lobby.findMany({
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

  app.get("/activity/recent", async (req, reply) => {
    const u = authFromHeader ? authFromHeader((req as any).headers?.authorization) : null;
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const raw = getActivity(30);
    const lobbyNames = await getLobbyNameMap();
    const events = raw.map(e => ({
      id: e.id,
      ts: e.ts,
      kind: e.kind,
      lobbyId: e.lobbyId || null,
      lobbyName: e.lobbyId ? (lobbyNames.get(e.lobbyId) || e.lobbyId) : null,
      userId: e.userId || null,
      userName: e.userName || null,
      text: e.textReal || e.text,
      accent: e.accent || null,
    }));
    reply.header("Cache-Control", "private, max-age=5");
    return reply.send({ ok: true, events });
  });
}
