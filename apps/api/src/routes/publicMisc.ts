import { log } from "../lib/logger";
import type { FastifyInstance } from "fastify";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import { prisma } from "../lib/prisma";

// Public, unauthenticated read endpoints extracted from index.ts.
// getSiteConfig + applyWindroseReel are shared (injected). The feed-ingestion
// worker (runFeedWorker/setInterval) stays in index.ts — /feed/hot is decoupled
// from it via the feedItem DB table, not memory. The announcement seed IIFE also
// stays in index.ts; here annDb is just a local prisma cast.
type Opts = {
  getSiteConfig: (key: string) => Promise<string | null>;
  applyWindroseReel: <T extends { id?: string; bannerUrl?: string | null } | null>(lobby: T) => T;
};

export default async function publicMiscRoutes(app: FastifyInstance, opts: Opts) {
  const { getSiteConfig, applyWindroseReel } = opts;
  const annDb = prisma as any;

  app.get("/featured", async (_req, reply) => {
    const featuredId = await getSiteConfig("featuredLobbyId");
    if (!featuredId) {
      const fallback = await prisma.lobby.findFirst({
        where: { pinned: true },
        select: {
          id: true,
          name: true,
          description: true,
          verified: true,
          pinned: true,
          moduleType: true,
          moduleConfig: true,
          keywords: true,
          accentColor: true,
          logoUrl: true,
          bannerUrl: true,
          websiteUrl: true,
          _count: { select: { rooms: true, members: true } },
        },
        orderBy: { name: "asc" },
      });
      return reply.send({ ok: true, lobby: applyWindroseReel(fallback), source: "fallback" });
    }

    const lobby = await prisma.lobby.findUnique({
      where: { id: featuredId },
      select: {
        id: true,
        name: true,
        description: true,
        verified: true,
        pinned: true,
        moduleType: true,
        moduleConfig: true,
        keywords: true,
        accentColor: true,
        logoUrl: true,
        bannerUrl: true,
        websiteUrl: true,
        _count: { select: { rooms: true, members: true } },
      },
    });

    if (!lobby) {
      return reply.send({ ok: true, lobby: null, source: "missing" });
    }

    return reply.send({ ok: true, lobby: applyWindroseReel(lobby), source: "config" });
  });

  app.get("/feed/hot", async (req, reply) => {
    const qs = (req as any).query as any;
    const category = qs?.category && qs.category !== "all" ? String(qs.category) : undefined;
    const domain = qs?.domain ? String(qs.domain) : undefined;
    const sort = qs?.sort === "new" ? { postedAt: "desc" as const } : { heat: "desc" as const };
    const where: any = {};
    if (category) where.category = category;
    if (domain) where.domain = domain;
    const items = await prisma.feedItem.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: sort,
      take: 50,
    });
    return reply.send({ items, updatedAt: new Date().toISOString() });
  });

  app.get("/banner", async (_req, reply) => {
    const pinned = await annDb.announcement.findMany({
      where: { pinned: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    const banners = pinned.map((a: any) => ({
      id: a.id,
      message: a.message,
      level: a.level,
      sticky: a.sticky,
      from: a.createdByName,
      ts: a.createdAt?.getTime?.() ?? 1,
    }));
    return reply.send({ ok: true, banner: banners[0] ?? null, banners });
  });

  const DESTINY2_APPID = "1085660";
  const d2Cache = new Map<string, { data: any; expiresAt: number }>();
  function d2CacheGet(key: string) {
    const c = d2Cache.get(key);
    if (c && c.expiresAt > Date.now()) return c.data;
    return null;
  }
  function d2CacheSet(key: string, data: any, ttlMs: number) {
    d2Cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  app.get("/destiny/live-players", async (req, reply) => {
    const cacheKey = "d2:live";
    const cached = d2CacheGet(cacheKey);
    if (cached) return reply.send(cached);
    try {
      const url = `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${DESTINY2_APPID}`;
      const res = await fetchWithTimeout(url);
      if (!res.ok) return reply.send({ ok: false, error: "steam_fetch_failed" });
      const j: any = await res.json();
      const count = j?.response?.player_count;
      if (typeof count !== "number") return reply.send({ ok: false, error: "no_count" });
      const result = {
        ok: true,
        players: count,
        appid: DESTINY2_APPID,
        checkedAt: new Date().toISOString(),
      };
      d2CacheSet(cacheKey, result, 60 * 1000);
      return reply.send(result);
    } catch (e) {
      log.error("[destiny/live-players]", e);
      return reply.send({ ok: false, error: "fetch_failed" });
    }
  });

  app.get("/presence/users", async (req, reply) => {
    const ids = String((req.query as any)?.ids || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 60);
    if (ids.length === 0) return reply.send({ ok: true, presence: {} });
    const rows = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, livePresence: true },
    });
    const out: Record<string, any> = {};
    for (const r of rows) if (r.livePresence) out[r.id] = r.livePresence;
    return reply.send({ ok: true, presence: out });
  });
}
