import { log, swallow } from "../lib/logger";
import type { FastifyInstance } from "fastify";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import { z } from "zod";
import { prisma } from "../lib/prisma";

type Opts = {
  authFromHeader: (h?: string) => { id: string } | null;
  sendPush: (
    userId: string,
    payload: { title: string; body: string; url?: string; tag?: string },
  ) => Promise<void>;
};

export default async function fortniteRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, sendPush } = opts;
  const FN_API_BASE = "https://fortnite-api.com";
  const FN_API_KEY = process.env.FORTNITE_API_KEY || "";
  const fnCache = new Map<string, { data: any; expiresAt: number }>();

  function fnCacheGet(key: string) {
    const c = fnCache.get(key);
    if (c && c.expiresAt > Date.now()) return c.data;
    return null;
  }
  function fnCacheSet(key: string, data: any, ttlMs: number) {
    fnCache.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  async function fnGet(path: string) {
    const headers: Record<string, string> = {};
    if (FN_API_KEY) headers["Authorization"] = FN_API_KEY;
    const res = await fetchWithTimeout(`${FN_API_BASE}${path}`, { headers });
    if (res.status === 429) {
      log.warn("[fortnite] Rate limited");
      return null;
    }
    if (res.status === 404) return null;
    if (!res.ok) {
      log.error(`[fortnite] ${res.status} — ${path}`);
      return null;
    }
    return res.json();
  }

  app.get("/fortnite/stats/:name", async (req, reply) => {
    const name = String((req as any).params?.name || "").trim();
    if (!name) return reply.code(400).send({ ok: false, error: "name_required" });
    const q = (req as any).query || {};
    const platform = String(q.platform || "").toLowerCase() || null;
    const timeWindow = String(q.timeWindow || "") || null;

    const cacheKey = `fn:stats:${name}:${platform || "all"}:${timeWindow || "lifetime"}`;
    const cached = fnCacheGet(cacheKey);
    if (cached) return reply.send(cached);

    try {
      let url = `/v2/stats/br/v2?name=${encodeURIComponent(name)}`;
      if (platform) url += `&accountType=${platform}`;
      if (timeWindow) url += `&timeWindow=${timeWindow}`;
      url += "&image=all";

      const data = await fnGet(url);
      if (!data || data.status !== 200) {
        return reply.send({ ok: false, error: data?.error || "player_not_found" });
      }

      const s = data.data;
      const result = {
        ok: true,
        account: { id: s.account?.id, name: s.account?.name },
        battlePass: s.battlePass,
        image: s.image,
        stats: {
          all: s.stats?.all?.overall || null,
          solo: s.stats?.all?.solo || null,
          duo: s.stats?.all?.duo || null,
          squad: s.stats?.all?.squad || null,
          ltm: s.stats?.all?.ltm || null,
        },
      };

      fnCacheSet(cacheKey, result, 5 * 60 * 1000);
      return reply.send(result);
    } catch (e) {
      log.error("[fortnite/stats]", e);
      return reply.send({ ok: false, error: "stats_fetch_failed" });
    }
  });

  app.get("/fortnite/shop", async (req, reply) => {
    const cacheKey = "fn:shop";
    const cached = fnCacheGet(cacheKey);
    if (cached) return reply.send(cached);

    try {
      const data = await fnGet("/v2/shop");
      if (!data || data.status !== 200) {
        return reply.send({ ok: false, error: "shop_fetch_failed" });
      }

      const sections: any[] = [];
      for (const entry of data.data?.entries || []) {
        const item = entry.brItems?.[0] || entry.items?.[0];
        if (!item) continue;
        sections.push({
          id: item.id,
          name: item.name,
          description: item.description,
          type: item.type?.displayValue || item.type?.value,
          rarity: item.rarity?.displayValue || item.rarity?.value,
          rarityColor: item.rarity?.value,
          price: entry.finalPrice ?? entry.regularPrice,
          regularPrice: entry.regularPrice,
          banner: entry.banner?.value,
          image: item.images?.icon || item.images?.smallIcon || item.images?.featured,
          featured: item.images?.featured,
          added: item.added,
          shopHistory: item.shopHistory?.length || 0,
          set: item.set?.value || null,
        });
      }

      const result = { ok: true, date: data.data?.date, sections };
      fnCacheSet(cacheKey, result, 15 * 60 * 1000);
      return reply.send(result);
    } catch (e) {
      log.error("[fortnite/shop]", e);
      return reply.send({ ok: false, error: "shop_fetch_failed" });
    }
  });

  app.get("/fortnite/news", async (req, reply) => {
    const cacheKey = "fn:news";
    const cached = fnCacheGet(cacheKey);
    if (cached) return reply.send(cached);

    try {
      const data = await fnGet("/v2/news/br");
      if (!data || data.status !== 200) {
        return reply.send({ ok: false, error: "news_fetch_failed" });
      }

      const motds = (data.data?.motds || []).map((m: any) => ({
        id: m.id,
        title: m.title,
        body: m.body,
        image: m.image,
        tileImage: m.tileImage,
        sortingPriority: m.sortingPriority,
      }));

      const result = { ok: true, news: motds };
      fnCacheSet(cacheKey, result, 30 * 60 * 1000);
      return reply.send(result);
    } catch (e) {
      log.error("[fortnite/news]", e);
      return reply.send({ ok: false, error: "news_fetch_failed" });
    }
  });

  app.get("/fortnite/map", async (req, reply) => {
    const cacheKey = "fn:map";
    const cached = fnCacheGet(cacheKey);
    if (cached) return reply.send(cached);

    try {
      const data = await fnGet("/v1/map");
      if (!data || data.status !== 200) {
        return reply.send({ ok: false, error: "map_fetch_failed" });
      }

      const result = {
        ok: true,
        images: data.data?.images || {},
        pois: (data.data?.pois || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          x: p.location?.x,
          y: p.location?.y,
        })),
      };
      fnCacheSet(cacheKey, result, 60 * 60 * 1000);
      return reply.send(result);
    } catch (e) {
      log.error("[fortnite/map]", e);
      return reply.send({ ok: false, error: "map_fetch_failed" });
    }
  });

  app.get("/fortnite/cosmetics/search", async (req, reply) => {
    const q = String(((req as any).query || {}).query || "").trim();
    if (!q || q.length < 2) return reply.code(400).send({ ok: false, error: "query_too_short" });

    const cacheKey = `fn:cosm:${q.toLowerCase()}`;
    const cached = fnCacheGet(cacheKey);
    if (cached) return reply.send(cached);

    try {
      const data = await fnGet(
        `/v2/cosmetics/br/search/all?name=${encodeURIComponent(q)}&matchMethod=contains&language=en`,
      );
      if (!data || data.status !== 200) {
        return reply.send({ ok: true, items: [] });
      }

      const items = (data.data || []).slice(0, 30).map((i: any) => ({
        id: i.id,
        name: i.name,
        description: i.description,
        type: i.type?.displayValue,
        rarity: i.rarity?.displayValue,
        rarityColor: i.rarity?.value,
        image: i.images?.icon || i.images?.smallIcon,
        set: i.set?.value || null,
        introduction: i.introduction?.text || null,
        shopHistory: i.shopHistory?.length || 0,
        lastSeen: i.shopHistory?.[0] || null,
      }));

      const result = { ok: true, items };
      fnCacheSet(cacheKey, result, 60 * 60 * 1000);
      return reply.send(result);
    } catch (e) {
      log.error("[fortnite/cosmetics]", e);
      return reply.send({ ok: true, items: [] });
    }
  });

  app.get("/fortnite/cosmetics/new", async (req, reply) => {
    const cacheKey = "fn:cosm:new";
    const cached = fnCacheGet(cacheKey);
    if (cached) return reply.send(cached);

    try {
      const data = await fnGet("/v2/cosmetics/new");
      if (!data || data.status !== 200) return reply.send({ ok: true, items: [] });

      const raw = Array.isArray(data.data?.items) ? data.data.items : data.data?.items?.br || [];
      const items = raw.slice(0, 24).map((i: any) => ({
        id: i.id,
        name: i.name,
        description: i.description,
        type: i.type?.displayValue,
        rarity: i.rarity?.displayValue,
        rarityColor: i.rarity?.value,
        image: i.images?.icon || i.images?.smallIcon,
        set: i.set?.value || null,
        shopHistory: i.shopHistory?.length || 0,
        lastSeen: i.shopHistory?.[0] || null,
      }));

      const result = { ok: true, items };
      fnCacheSet(cacheKey, result, 60 * 60 * 1000);
      return reply.send(result);
    } catch (e) {
      log.error("[fortnite/cosmetics/new]", e);
      return reply.send({ ok: true, items: [] });
    }
  });

  app.get("/fortnite/wishlist", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const items = await prisma.fortniteWishlist.findMany({
      where: { userId: u.id },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ ok: true, items });
  });

  app.post(
    "/fortnite/wishlist",
    {
      schema: { tags: ["fortnite"] },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const body: any = (req as any).body || {};
      const cosmeticId = String(body.cosmeticId || "").trim();
      if (!cosmeticId) return reply.code(400).send({ ok: false, error: "cosmetic_id_required" });

      const count = await prisma.fortniteWishlist.count({ where: { userId: u.id } });
      if (count >= 50)
        return reply
          .code(400)
          .send({ ok: false, error: "wishlist_full", message: "Maximum 50 items." });

      try {
        const item = await prisma.fortniteWishlist.upsert({
          where: { userId_cosmeticId: { userId: u.id, cosmeticId } },
          update: { notified: false, notifiedAt: null },
          create: {
            userId: u.id,
            cosmeticId,
            name: String(body.name || "").slice(0, 100),
            type: String(body.type || "").slice(0, 50),
            rarity: String(body.rarity || "").slice(0, 30),
            image: body.image ? String(body.image).slice(0, 500) : null,
          },
        });
        return reply.send({ ok: true, item });
      } catch (e: any) {
        log.error("[fortnite/wishlist] add", e);
        return reply.send({ ok: false, error: "failed" });
      }
    },
  );

  app.delete(
    "/fortnite/wishlist/:cosmeticId",
    {
      schema: { tags: ["fortnite"], params: z.object({ cosmeticId: z.string().min(1) }) },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const cosmeticId = String((req as any).params?.cosmeticId || "");
      try {
        await prisma.fortniteWishlist.delete({
          where: { userId_cosmeticId: { userId: u.id, cosmeticId } },
        });
      } catch (e) {
        swallow(e);
      }
      return reply.send({ ok: true });
    },
  );

  app.get("/fortnite/wishlist/friends/:cosmeticId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.send({ ok: true, count: 0, friends: [] });
    const cosmeticId = String((req as any).params?.cosmeticId || "");

    const friendRows = await prisma.friendRequest.findMany({
      where: {
        OR: [
          { fromId: u.id, status: "ACCEPTED" },
          { toId: u.id, status: "ACCEPTED" },
        ],
      },
      select: { fromId: true, toId: true },
    });
    const friendIds = friendRows.map((f: any) => (f.fromId === u.id ? f.toId : f.fromId));
    if (friendIds.length === 0) return reply.send({ ok: true, count: 0, friends: [] });

    const matches = await prisma.fortniteWishlist.findMany({
      where: { cosmeticId, userId: { in: friendIds } },
      select: { userId: true },
    });
    const matchedIds = matches.map((m: any) => m.userId);

    const users = matchedIds.length
      ? await prisma.user.findMany({
          where: { id: { in: matchedIds } },
          select: { id: true, name: true },
        })
      : [];

    return reply.send({
      ok: true,
      count: matchedIds.length,
      friends: users.map((u) => ({ id: u.id, name: u.name })),
    });
  });

  let lastShopCheck = 0;
  const SHOP_CHECK_INTERVAL = 15 * 60 * 1000;

  async function checkFortniteShopWishlist() {
    try {
      const data = await fnGet("/v2/shop");
      if (!data || data.status !== 200) return;

      const shopIds = new Set<string>();
      const shopNames = new Map<string, string>();
      for (const entry of data.data?.entries || []) {
        for (const item of [...(entry.brItems || []), ...(entry.items || [])]) {
          if (item.id) {
            shopIds.add(item.id);
            shopNames.set(item.id, item.name || item.id);
          }
        }
      }
      if (shopIds.size === 0) return;

      const matches = await prisma.fortniteWishlist.findMany({
        where: {
          cosmeticId: { in: Array.from(shopIds) },
          notified: false,
        },
      });

      if (matches.length === 0) return;
      log.log(`[fortnite] Shop check: ${matches.length} wishlist matches found`);

      const byUser = new Map<string, any[]>();
      for (const m of matches) {
        const list = byUser.get(m.userId) || [];
        list.push(m);
        byUser.set(m.userId, list);
      }

      for (const [userId, items] of byUser) {
        const names = items.map((i: any) => shopNames.get(i.cosmeticId) || i.name).slice(0, 3);
        const extra = items.length > 3 ? ` +${items.length - 3} more` : "";
        await sendPush(userId, {
          title: "Wishlist Alert!",
          body: `${names.join(", ")}${extra} ${items.length === 1 ? "is" : "are"} in the Item Shop now!`,
          url: "/lobby/fortnite",
          tag: "fn-shop-wishlist",
        });

        await prisma.fortniteWishlist.updateMany({
          where: { userId, cosmeticId: { in: items.map((i: any) => i.cosmeticId) } },
          data: { notified: true, notifiedAt: new Date() },
        });
      }
    } catch (e) {
      log.error("[fortnite] Shop wishlist check error:", e);
    }
  }

  setInterval(() => {
    const now = Date.now();
    if (now - lastShopCheck < SHOP_CHECK_INTERVAL) return;
    lastShopCheck = now;
    checkFortniteShopWishlist();
  }, 60_000);

  app.get("/fortnite/stats/:name/ranked", async (req, reply) => {
    const name = String((req as any).params?.name || "").trim();
    if (!name) return reply.code(400).send({ ok: false, error: "name_required" });

    const cacheKey = `fn:ranked:${name}`;
    const cached = fnCacheGet(cacheKey);
    if (cached) return reply.send(cached);

    try {
      const [lifetimeData, seasonData] = await Promise.all([
        fnGet(`/v2/stats/br/v2?name=${encodeURIComponent(name)}`),
        fnGet(`/v2/stats/br/v2?name=${encodeURIComponent(name)}&timeWindow=season`),
      ]);

      if (!lifetimeData || lifetimeData.status !== 200) {
        return reply.send({ ok: false, error: "player_not_found" });
      }

      const lifetime = lifetimeData.data?.stats?.all;
      const season = seasonData?.data?.stats?.all;

      const result = {
        ok: true,
        account: { id: lifetimeData.data?.account?.id, name: lifetimeData.data?.account?.name },
        battlePass: lifetimeData.data?.battlePass,
        lifetime: {
          overall: lifetime?.overall || null,
          solo: lifetime?.solo || null,
          duo: lifetime?.duo || null,
          squad: lifetime?.squad || null,
        },
        season: {
          overall: season?.overall || null,
          solo: season?.solo || null,
          duo: season?.duo || null,
          squad: season?.squad || null,
        },
      };

      fnCacheSet(cacheKey, result, 5 * 60 * 1000);
      return reply.send(result);
    } catch (e) {
      log.error("[fortnite/ranked]", e);
      return reply.send({ ok: false, error: "ranked_fetch_failed" });
    }
  });
}
