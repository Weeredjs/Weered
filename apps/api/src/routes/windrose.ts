import { log } from "../lib/logger";
import type { FastifyInstance } from "fastify";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import { z } from "zod";
import { prisma } from "../lib/prisma";

type Opts = {
  authFromHeader: (h?: string) => { id: string; name?: string; globalRole?: string } | null;
  sendPush: (
    userId: string,
    payload: { title: string; body: string; url?: string; tag?: string },
  ) => Promise<void>;
  awardPaper: (
    userId: string,
    kind: string,
    amount: number,
    note: string,
    ref?: string,
  ) => Promise<{ balance: number } | null>;
  isAIAvailable: () => boolean;
  getAI: () => Promise<any | null>;
  broadcastToLobby?: (lobbyId: string, event: any) => void;
};

export default async function windroseRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, sendPush, awardPaper, isAIAvailable, getAI, broadcastToLobby } = opts;
  const STEAM_API_KEY = process.env.STEAM_API_KEY || "";

  const WINDROSE_APPID = "3041230";
  const wrCache = new Map<string, { data: any; expiresAt: number }>();
  function wrCacheGet(key: string) {
    const c = wrCache.get(key);
    if (c && c.expiresAt > Date.now()) return c.data;
    return null;
  }
  function wrCacheSet(key: string, data: any, ttlMs: number) {
    wrCache.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  app.get("/windrose/live-players", async (req, reply) => {
    const cacheKey = "wr:live";
    const cached = wrCacheGet(cacheKey);
    if (cached) return reply.send(cached);
    try {
      const url = `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${WINDROSE_APPID}`;
      const res = await fetchWithTimeout(url);
      if (!res.ok) return reply.send({ ok: false, error: "steam_fetch_failed" });
      const j: any = await res.json();
      const count = j?.response?.player_count;
      if (typeof count !== "number") return reply.send({ ok: false, error: "no_count" });
      const result = {
        ok: true,
        players: count,
        appid: WINDROSE_APPID,
        checkedAt: new Date().toISOString(),
      };
      wrCacheSet(cacheKey, result, 60 * 1000);
      return reply.send(result);
    } catch (e) {
      log.error("[windrose/live-players]", e);
      return reply.send({ ok: false, error: "fetch_failed" });
    }
  });

  app.get("/windrose/public-servers", async (req, reply) => {
    const cacheKey = "wr:public-servers";
    const cached = wrCacheGet(cacheKey);
    if (cached) return reply.send(cached);
    try {
      if (!STEAM_API_KEY) return reply.send({ ok: false, error: "steam_key_missing", servers: [] });
      const filter = encodeURIComponent(`\\appid\\${WINDROSE_APPID}`);
      const url = `https://api.steampowered.com/IGameServersService/GetServerList/v1/?key=${STEAM_API_KEY}&filter=${filter}&limit=200`;
      const res = await fetchWithTimeout(url);
      if (!res.ok) {
        return reply.send({ ok: false, error: `steam_status_${res.status}`, servers: [] });
      }
      const j: any = await res.json();
      const raw: any[] = Array.isArray(j?.response?.servers) ? j.response.servers : [];
      const servers = raw
        .filter((s) => s && typeof s.addr === "string")
        .map((s: any) => ({
          addr: String(s.addr),
          steamId: String(s.steamid || ""),
          name: String(s.name || "").trim(),
          players: Number(s.players ?? 0),
          maxPlayers: Number(s.max_players ?? 0),
          bots: Number(s.bots ?? 0),
          map: String(s.map || "").trim(),
          gameType: String(s.gametype || "").trim(),
          version: String(s.version || "").trim(),
          dedicated: Boolean(s.dedicated),
          os: String(s.os || "").trim(),
          secure: Boolean(s.secure),
          passworded: Boolean(s.passworded ?? false),
          region: Number.isFinite(s.region) ? Number(s.region) : null,
        }))
        .sort((a, b) => b.players - a.players || a.name.localeCompare(b.name));
      const result = {
        ok: true,
        count: servers.length,
        servers,
        checkedAt: new Date().toISOString(),
      };
      wrCacheSet(cacheKey, result, 60 * 1000);
      return reply.send(result);
    } catch (e) {
      log.error("[windrose/public-servers]", e);
      return reply.send({ ok: false, error: "fetch_failed", servers: [] });
    }
  });

  app.get("/windrose/hunter/:userId", async (req, reply) => {
    const userId = String((req.params as any).userId || "");
    if (!userId) return reply.code(400).send({ ok: false, error: "userId_required" });
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          avatar: true,
          avatarColor: true,
          tier: true,
          globalRole: true,
        },
      });
      if (!user) return reply.code(404).send({ ok: false, error: "not_found" });

      const all = await prisma.windroseBounty.findMany({
        where: { lobbyId: "windrose" },
        take: 5000,
      });

      const claimedSettled = all.filter(
        (b: any) => b.claimantId === userId && b.status === "SETTLED",
      );
      const claimedPending = all.filter(
        (b: any) => b.claimantId === userId && b.status === "CLAIMED",
      );
      const kills = claimedSettled.length;
      const totalEarned = claimedSettled.reduce(
        (s: number, b: any) => s + (Number(b.amount) || 0),
        0,
      );
      const biggestHit = claimedSettled.reduce(
        (m: any, b: any) => (!m || b.amount > m.amount ? b : m),
        null,
      );

      const posted = all.filter((b: any) => b.posterId === userId);
      const postedCount = posted.length;
      const totalPosted = posted.reduce((s: number, b: any) => s + (Number(b.amount) || 0), 0);
      const postedOpen = posted.filter(
        (b: any) => b.status === "OPEN" || b.status === "CLAIMED",
      ).length;
      const postedSettled = posted.filter((b: any) => b.status === "SETTLED").length;

      const hunterMap = new Map<string, number>();
      for (const b of all) {
        if (b.status !== "SETTLED" || !b.claimantId) continue;
        hunterMap.set(b.claimantId, (hunterMap.get(b.claimantId) || 0) + (Number(b.amount) || 0));
      }
      const sortedHunters = Array.from(hunterMap.entries()).sort((a, b) => b[1] - a[1]);
      const rankIndex = sortedHunters.findIndex(([uid]) => uid === userId);
      const hunterRank = rankIndex === -1 ? null : rankIndex + 1;
      const totalHunters = sortedHunters.length;

      const posterMap = new Map<string, number>();
      for (const b of all) {
        posterMap.set(b.posterId, (posterMap.get(b.posterId) || 0) + (Number(b.amount) || 0));
      }
      const sortedPosters = Array.from(posterMap.entries()).sort((a, b) => b[1] - a[1]);
      const posterRankIdx = sortedPosters.findIndex(([uid]) => uid === userId);
      const posterRank = posterRankIdx === -1 ? null : posterRankIdx + 1;

      const recentKills = claimedSettled
        .sort(
          (a: any, b: any) =>
            new Date(b.settledAt || 0).getTime() - new Date(a.settledAt || 0).getTime(),
        )
        .slice(0, 5)
        .map((b: any) => ({
          id: b.id,
          target: b.targetHandle,
          amount: b.amount,
          at: b.settledAt,
        }));
      const recentPosts = posted
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
        .map((b: any) => ({
          id: b.id,
          target: b.targetHandle,
          amount: b.amount,
          status: b.status,
          at: b.createdAt,
        }));

      return reply.send({
        ok: true,
        user: {
          id: user.id,
          name: user.name,
          avatar: user.avatar,
          avatarColor: user.avatarColor,
          tier: user.tier,
          globalRole: user.globalRole,
        },
        hunter: {
          kills,
          totalEarned,
          biggestHit: biggestHit
            ? {
                target: biggestHit.targetHandle,
                amount: biggestHit.amount,
                at: biggestHit.settledAt,
              }
            : null,
          pendingClaims: claimedPending.length,
          rank: hunterRank,
          totalHunters,
          recentKills,
        },
        poster: {
          postedCount,
          totalPosted,
          open: postedOpen,
          settled: postedSettled,
          rank: posterRank,
          totalPosters: sortedPosters.length,
          recentPosts,
        },
      });
    } catch (e) {
      log.error("[windrose/hunter]", e);
      return reply.code(500).send({ ok: false, error: "fetch_failed" });
    }
  });

  app.get("/windrose/activity", async (_req, reply) => {
    const cacheKey = "wr:activity";
    const cached = wrCacheGet(cacheKey);
    if (cached) return reply.send(cached);
    try {
      const DAYS_BACK = 14;
      const since = new Date(Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000);
      type Event = {
        id: string;
        kind:
          | "bounty_post"
          | "bounty_settle"
          | "bounty_cancel"
          | "crew_publish"
          | "server_list"
          | "lfg_raise";
        ts: string | Date;
        actor?: string | null;
        subject?: string | null;
        amount?: number | null;
        meta?: Record<string, any>;
      };
      const [bounties, crews, servers, lfg] = await Promise.all([
        prisma.windroseBounty
          .findMany({
            where: {
              lobbyId: "windrose",
              OR: [
                { createdAt: { gte: since } },
                { settledAt: { gte: since } },
                { cancelledAt: { gte: since } },
              ],
            },
            orderBy: { createdAt: "desc" },
            take: 80,
          })
          .catch(() => []),
        prisma.crew
          .findMany({
            where: { publicInLobbies: { has: "windrose" }, updatedAt: { gte: since } },
            select: { id: true, name: true, tag: true, recruiting: true, updatedAt: true },
            take: 30,
          })
          .catch(() => []),
        prisma.communityServer
          .findMany({
            where: { lobbyId: "windrose", createdAt: { gte: since } },
            select: {
              id: true,
              name: true,
              region: true,
              framework: true,
              owner: { select: { name: true } },
              createdAt: true,
            },
            take: 30,
          })
          .catch(() => []),
        prisma.lfgPost
          .findMany({
            where: { lobbyId: "windrose", createdAt: { gte: since } },
            orderBy: { createdAt: "desc" },
            select: { id: true, userName: true, gameMode: true, maxPlayers: true, createdAt: true },
            take: 30,
          })
          .catch(() => []),
      ]);

      const events: Event[] = [];

      for (const b of bounties) {
        events.push({
          id: `b:post:${b.id}`,
          kind: "bounty_post",
          ts: b.createdAt,
          actor: b.posterName,
          subject: b.targetHandle,
          amount: b.amount,
        });
        if (b.status === "SETTLED" && b.settledAt) {
          events.push({
            id: `b:settle:${b.id}`,
            kind: "bounty_settle",
            ts: b.settledAt,
            actor: b.claimantName,
            subject: b.targetHandle,
            amount: b.amount,
          });
        }
        if (b.status === "CANCELLED" && b.cancelledAt) {
          events.push({
            id: `b:cancel:${b.id}`,
            kind: "bounty_cancel",
            ts: b.cancelledAt,
            actor: b.posterName,
            subject: b.targetHandle,
            amount: b.amount,
          });
        }
      }

      for (const c of crews) {
        events.push({
          id: `c:pub:${c.id}:${new Date(c.updatedAt).getTime()}`,
          kind: "crew_publish",
          ts: c.updatedAt,
          actor: null,
          subject: c.name,
          meta: { tag: c.tag, recruiting: c.recruiting },
        });
      }

      for (const s of servers) {
        events.push({
          id: `s:list:${s.id}`,
          kind: "server_list",
          ts: s.createdAt,
          actor: s.owner?.name || null,
          subject: s.name,
          meta: { region: s.region, framework: s.framework },
        });
      }

      for (const p of lfg) {
        events.push({
          id: `l:raise:${p.id}`,
          kind: "lfg_raise",
          ts: p.createdAt,
          actor: p.userName,
          subject: p.gameMode || "a run",
          meta: { slots: p.maxPlayers },
        });
      }

      events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
      const trimmed = events.slice(0, 50);

      const result = { ok: true, events: trimmed, generatedAt: new Date().toISOString() };
      wrCacheSet(cacheKey, result, 30 * 1000);
      return reply.send(result);
    } catch (e) {
      log.error("[windrose/activity]", e);
      return reply.send({ ok: false, error: "fetch_failed", events: [] });
    }
  });

  app.get("/windrose/captains-log", async (_req, reply) => {
    const cacheKey = "wr:captains-log";
    const cached = wrCacheGet(cacheKey);
    if (cached) return reply.send(cached);
    try {
      if (!isAIAvailable())
        return reply.send({ ok: false, error: "ai_unavailable", summary: null });

      const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
      const since = new Date(Date.now() - WEEK_MS);

      const [bountiesAll, crews, servers, lfg] = await Promise.all([
        prisma.windroseBounty
          .findMany({
            where: { lobbyId: "windrose", createdAt: { gte: since } },
            take: 500,
          })
          .catch(() => []),
        prisma.crew
          .findMany({
            where: { publicInLobbies: { has: "windrose" }, updatedAt: { gte: since } },
            select: {
              name: true,
              tag: true,
              recruiting: true,
              updatedAt: true,
              members: { select: { userId: true } },
            },
            take: 50,
          })
          .catch(() => []),
        prisma.communityServer
          .findMany({
            where: { lobbyId: "windrose", createdAt: { gte: since } },
            select: { name: true, region: true, framework: true, createdAt: true },
            take: 50,
          })
          .catch(() => []),
        prisma.lfgPost
          .findMany({
            where: { lobbyId: "windrose", createdAt: { gte: since } },
            select: { gameMode: true, region: true, createdAt: true },
            take: 200,
          })
          .catch(() => []),
      ]);

      const posted = bountiesAll.length;
      const settled = bountiesAll.filter((b: any) => b.status === "SETTLED").length;
      const hottestOpen = bountiesAll
        .filter((b: any) => b.status === "OPEN" || b.status === "CLAIMED")
        .sort((a: any, b: any) => b.amount - a.amount)
        .slice(0, 3)
        .map((b: any) => ({ target: b.targetHandle, amount: b.amount }));
      const biggestSettle = bountiesAll
        .filter((b: any) => b.status === "SETTLED")
        .sort((a: any, b: any) => b.amount - a.amount)
        .slice(0, 3)
        .map((b: any) => ({ target: b.targetHandle, hunter: b.claimantName, amount: b.amount }));

      const newCrews = crews
        .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5)
        .map((c: any) => ({
          name: c.name,
          tag: c.tag,
          recruiting: c.recruiting,
          members: (c.members || []).length,
        }));
      const newServers = servers
        .slice(0, 5)
        .map((s: any) => ({ name: s.name, region: s.region, framework: s.framework }));
      const lfgCount = lfg.length;
      const lfgModes = Array.from(new Set(lfg.map((p: any) => p.gameMode).filter(Boolean))).slice(
        0,
        5,
      );

      const payload = {
        period: "last 7 days",
        bounties: { posted, settled, hottestOpen, biggestSettle },
        crews: { newOrUpdated: newCrews.length, featured: newCrews },
        servers: { new: newServers.length, featured: newServers },
        lfg: { posts: lfgCount, modes: lfgModes },
      };

      const ai = await getAI();
      if (!ai) return reply.send({ ok: false, error: "ai_unavailable", summary: null });

      const system = `You are The Operator — a gold-robot AI concierge on Weered, with a GTA/mafia aesthetic flavour. The context is WINDROSE, a pirate SURVIVAL CO-OP game (PvE — no player-vs-player combat in the base game). Your job: write a sharp, punchy weekly recap of what's gone down in the Windrose community hub.

Voice: street-smart, laconic, a little dangerous, dry humour. Pirate-flavoured phrasing where it lands but never forced. You're running the joint, not a tour guide.

IMPORTANT about bounties: Windrose bounties are NOT about hunting other players. They are Paper-escrowed OBJECTIVES — delivery runs, item fetches, speedruns, boss takedowns, seed locations, cargo hauls, dares. Someone posts, a hunter delivers the proof, Paper settles. Frame bounties as "what the mark was" and "who delivered on it," not as kills or assassinations.

Rules:
- 140-220 words total. No more.
- Structure: an opening line (set the tone), 3-5 short bullets (•), a closing line (a hook).
- No markdown headings. No emojis. No hashtags. No quotes around bullets.
- Use real specifics from the data (names, amounts, counts). Never make numbers up.
- If there's very little activity, say so honestly — don't pad.
- Numbers use commas ("25,000 Paper", not "25000").
- Never break character or mention "AI", "assistant", or "Claude".
- The reader is a Windrose player on Weered. Talk to them, not about them.`;

      const user = `Here's this week's data. Write the recap.\n\n${JSON.stringify(payload, null, 2)}`;

      const res = await ai.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system,
        messages: [{ role: "user", content: user }],
      });
      const summary = res?.content?.[0]?.text?.trim() || "";
      if (!summary) return reply.send({ ok: false, error: "empty_summary", summary: null });

      const result = {
        ok: true,
        summary,
        period: payload.period,
        stats: {
          bountiesPosted: posted,
          bountiesSettled: settled,
          crewsActive: newCrews.length,
          serversNew: newServers.length,
          lfgPosts: lfgCount,
        },
        generatedAt: new Date().toISOString(),
      };
      wrCacheSet(cacheKey, result, 6 * 60 * 60 * 1000);
      return reply.send(result);
    } catch (e) {
      log.error("[windrose/captains-log]", e);
      return reply.send({ ok: false, error: "generation_failed", summary: null });
    }
  });

  app.get("/windrose/news", async (req, reply) => {
    const cacheKey = "wr:news";
    const cached = wrCacheGet(cacheKey);
    if (cached) return reply.send(cached);
    try {
      const url = `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${WINDROSE_APPID}&count=12&maxlength=600&format=json`;
      const res = await fetchWithTimeout(url);
      if (!res.ok) return reply.send({ ok: false, error: "steam_fetch_failed" });
      const j: any = await res.json();
      const items: any[] = j?.appnews?.newsitems || [];
      const news = items.map((n: any) => ({
        id: String(n.gid || ""),
        title: String(n.title || ""),
        author: String(n.author || "Kraken Express"),
        url: String(n.url || ""),
        date: n.date ? new Date(n.date * 1000).toISOString() : null,
        feedlabel: String(n.feedlabel || ""),
        contents: String(n.contents || "").slice(0, 600),
        tags: Array.isArray(n.tags) ? n.tags.slice(0, 6) : [],
      }));
      const result = { ok: true, news };
      wrCacheSet(cacheKey, result, 10 * 60 * 1000);
      return reply.send(result);
    } catch (e) {
      log.error("[windrose/news]", e);
      return reply.send({ ok: false, error: "fetch_failed" });
    }
  });

  app.get("/windrose/launch", async (req, reply) => {
    return reply.send({
      ok: true,
      releasedAt: "2026-04-14",
      milestones: [
        { label: "Units sold (48h)", value: "500,000", sub: "Early Access" },
        { label: "Peak CCU", value: "~100,000", sub: "Launch week" },
        { label: "Steam review score", value: "89%", sub: "Positive" },
      ],
      publisher: { name: "Pocketpair", note: "Palworld studio" },
      platform: {
        steam: `https://store.steampowered.com/app/${WINDROSE_APPID}/`,
        site: "https://playwindrose.com/",
      },
    });
  });

  app.get("/windrose/servers", async (req, reply) => {
    try {
      const servers = await prisma.communityServer.findMany({
        where: { lobbyId: "windrose" },
        orderBy: [{ status: "desc" }, { lastSeenAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          name: true,
          host: true,
          dashboardUrl: true,
          queryUrl: true,
          region: true,
          description: true,
          tags: true,
          maxSlots: true,
          framework: true,
          status: true,
          lastSeenAt: true,
          lastState: true,
          createdAt: true,
          owner: { select: { id: true, name: true, avatar: true, avatarColor: true } },
        },
        take: 100,
      });
      return reply.send({ ok: true, servers });
    } catch (e) {
      log.error("[windrose/servers GET]", e);
      return reply.code(500).send({ ok: false, error: "server_error" });
    }
  });

  app.post(
    "/windrose/servers",
    {
      schema: { tags: ["windrose"] },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const body: any = (req as any).body || {};
      const name = String(body.name || "")
        .trim()
        .slice(0, 60);
      const host = String(body.host || "")
        .trim()
        .slice(0, 120);
      if (!name || !host)
        return reply.code(400).send({ ok: false, error: "name_and_host_required" });
      const dashboardUrl = body.dashboardUrl ? String(body.dashboardUrl).trim() : null;
      const queryUrl = body.queryUrl ? String(body.queryUrl).trim() : null;
      const region = body.region ? String(body.region).trim().slice(0, 24) : null;
      const description = body.description ? String(body.description).trim().slice(0, 500) : null;
      const framework = body.framework ? String(body.framework).trim().slice(0, 40) : null;
      const maxSlots = body.maxSlots ? Math.max(1, Math.min(64, Number(body.maxSlots) || 8)) : null;
      const tags = Array.isArray(body.tags)
        ? body.tags.map((t: any) => String(t).slice(0, 24)).slice(0, 10)
        : [];
      const existing = await prisma.communityServer.count({
        where: { ownerId: u.id, lobbyId: "windrose" },
      });
      if (existing >= 5)
        return reply
          .code(400)
          .send({ ok: false, error: "limit_reached", message: "Max 5 servers per user." });
      try {
        const created = await prisma.communityServer.create({
          data: {
            lobbyId: "windrose",
            ownerId: u.id,
            name,
            host,
            dashboardUrl,
            queryUrl,
            region,
            description,
            framework,
            maxSlots,
            tags,
            status: "pending",
          },
        });
        return reply.send({ ok: true, server: created });
      } catch (e) {
        log.error("[windrose/servers POST]", e);
        return reply.code(500).send({ ok: false, error: "create_failed" });
      }
    },
  );

  app.patch(
    "/windrose/servers/:id",
    {
      schema: { tags: ["windrose"], params: z.object({ id: z.string().min(1) }) },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const id = (req.params as any).id as string;
      const existing = await prisma.communityServer.findUnique({ where: { id } });
      if (!existing) return reply.code(404).send({ ok: false, error: "not_found" });
      const isOwner = existing.ownerId === u.id;
      const isStaff = ["GOD", "STAFF", "SUPPORT"].includes(u.globalRole || "");
      if (!isOwner && !isStaff) return reply.code(403).send({ ok: false, error: "forbidden" });
      const body: any = (req as any).body || {};
      const data: any = {};
      if (typeof body.name === "string") data.name = body.name.trim().slice(0, 60);
      if (typeof body.host === "string") data.host = body.host.trim().slice(0, 120);
      if (typeof body.dashboardUrl === "string")
        data.dashboardUrl = body.dashboardUrl.trim() || null;
      if (typeof body.queryUrl === "string") data.queryUrl = body.queryUrl.trim() || null;
      if (typeof body.region === "string") data.region = body.region.trim().slice(0, 24) || null;
      if (typeof body.description === "string")
        data.description = body.description.trim().slice(0, 500) || null;
      if (typeof body.framework === "string")
        data.framework = body.framework.trim().slice(0, 40) || null;
      if (body.maxSlots != null)
        data.maxSlots = Math.max(1, Math.min(64, Number(body.maxSlots) || 8));
      if (Array.isArray(body.tags))
        data.tags = body.tags.map((t: any) => String(t).slice(0, 24)).slice(0, 10);
      try {
        const updated = await prisma.communityServer.update({ where: { id }, data });
        return reply.send({ ok: true, server: updated });
      } catch (e) {
        log.error("[windrose/servers PATCH]", e);
        return reply.code(500).send({ ok: false, error: "update_failed" });
      }
    },
  );

  app.delete(
    "/windrose/servers/:id",
    {
      schema: { tags: ["windrose"], params: z.object({ id: z.string().min(1) }) },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const id = (req.params as any).id as string;
      const existing = await prisma.communityServer.findUnique({ where: { id } });
      if (!existing) return reply.code(404).send({ ok: false, error: "not_found" });
      const isOwner = existing.ownerId === u.id;
      const isStaff = ["GOD", "STAFF", "SUPPORT"].includes(u.globalRole || "");
      if (!isOwner && !isStaff) return reply.code(403).send({ ok: false, error: "forbidden" });
      try {
        await prisma.communityServer.delete({ where: { id } });
        return reply.send({ ok: true });
      } catch (e) {
        log.error("[windrose/servers DELETE]", e);
        return reply.code(500).send({ ok: false, error: "delete_failed" });
      }
    },
  );

  const BOUNTY_MIN = 100;
  const BOUNTY_MAX = 500_000;
  const BOUNTY_CAP_OPEN_PER_USER = 10;

  app.get("/windrose/bounties", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    const q: any = (req as any).query || {};
    const status = typeof q.status === "string" ? q.status.toUpperCase() : "";
    const mine = q.mine === "1" || q.mine === "true";
    const target = typeof q.target === "string" ? q.target.trim() : "";
    const where: any = { lobbyId: "windrose" };
    if (["OPEN", "CLAIMED", "SETTLED", "CANCELLED"].includes(status)) where.status = status;
    if (mine && u) where.OR = [{ posterId: u.id }, { claimantId: u.id }];
    if (target) where.targetHandle = { equals: target, mode: "insensitive" };
    try {
      const rows = await prisma.windroseBounty.findMany({
        where,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 200,
      });
      return reply.send({ ok: true, bounties: rows, target: target || null });
    } catch (e) {
      log.error("[windrose/bounties GET]", e);
      return reply.code(500).send({ ok: false, error: "fetch_failed" });
    }
  });

  app.get("/windrose/bounties/:id", async (req, reply) => {
    const id = String((req.params as any).id || "");
    if (!id) return reply.code(400).send({ ok: false, error: "id_required" });
    try {
      const b = await prisma.windroseBounty.findUnique({ where: { id } });
      if (!b) return reply.code(404).send({ ok: false, error: "not_found" });
      return reply.send({ ok: true, bounty: b });
    } catch (e) {
      log.error("[windrose/bounties/:id GET]", e);
      return reply.code(500).send({ ok: false, error: "fetch_failed" });
    }
  });

  app.post(
    "/windrose/bounties",
    {
      schema: { tags: ["windrose"] },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const body: any = (req as any).body || {};
      const targetHandle = String(body.targetHandle || "")
        .trim()
        .slice(0, 60);
      const targetServer = body.targetServer
        ? String(body.targetServer).trim().slice(0, 120)
        : null;
      const reason = String(body.reason || "")
        .trim()
        .slice(0, 400);
      const amount = Math.floor(Number(body.amount) || 0);
      if (!targetHandle) return reply.code(400).send({ ok: false, error: "target_required" });
      if (amount < BOUNTY_MIN)
        return reply.code(400).send({
          ok: false,
          error: "amount_too_low",
          message: `Minimum bounty is ${BOUNTY_MIN} Paper.`,
        });
      if (amount > BOUNTY_MAX)
        return reply.code(400).send({
          ok: false,
          error: "amount_too_high",
          message: `Maximum bounty is ${BOUNTY_MAX.toLocaleString()} Paper.`,
        });

      const openCount = await prisma.windroseBounty.count({
        where: { posterId: u.id, status: { in: ["OPEN", "CLAIMED"] } },
      });
      if (openCount >= BOUNTY_CAP_OPEN_PER_USER) {
        return reply.code(400).send({
          ok: false,
          error: "limit_reached",
          message: `You already have ${BOUNTY_CAP_OPEN_PER_USER} bounties in flight. Settle or cancel one first.`,
        });
      }

      const debit = await awardPaper(
        u.id,
        "SPEND_UNLOCK",
        -amount,
        `Bounty escrow · ${targetHandle}`,
      );
      if (!debit) return reply.code(400).send({ ok: false, error: "insufficient_paper" });

      try {
        const posterName =
          (await prisma.user.findUnique({ where: { id: u.id }, select: { name: true } }))?.name ||
          u.id;
        const created = await prisma.windroseBounty.create({
          data: {
            lobbyId: "windrose",
            posterId: u.id,
            posterName,
            targetHandle,
            targetServer: targetServer || null,
            amount,
            reason,
            status: "OPEN",
          },
        });
        wrCache.delete("wr:bounties:leaderboard");
        wrCache.delete("wr:activity");
        wrCache.delete("wr:captains-log");

        const MOST_WANTED_THRESHOLD = 50_000;
        if (amount >= MOST_WANTED_THRESHOLD) {
          void (async () => {
            try {
              const members = await prisma.lobbyMember.findMany({
                where: { lobbyId: "windrose" },
                select: { userId: true },
                take: 2000,
              });
              const memberIds = new Set<string>(
                members.map((m: any) => m.userId).filter((id: string) => id && id !== u.id),
              );
              const body = `${amount.toLocaleString()} Paper on ${targetHandle}. ${reason ? `"${reason.slice(0, 80)}${reason.length > 80 ? "…" : ""}"` : "It's on the board."}`;
              const data = {
                title: "Most Wanted",
                body,
                url: "/lobby/windrose",
                tag: `windrose:bounty:${created.id}`,
              };
              for (const uid of memberIds) {
                sendPush(uid, data).catch(() => {});
              }
            } catch (e) {
              log.error("[windrose/bounties most-wanted push]", e);
            }
          })();
        }

        try {
          broadcastToLobby?.("windrose", {
            type: "windrose:bounty:posted",
            userId: u.id,
            lobbyId: "windrose",
            bountyId: created.id,
            amount: created.amount,
          });
        } catch {}
        return reply.send({ ok: true, bounty: created, balance: debit.balance });
      } catch (e) {
        await awardPaper(u.id, "ADJUSTMENT", amount, `Bounty escrow refund (create failed)`);
        log.error("[windrose/bounties POST]", e);
        return reply.code(500).send({ ok: false, error: "create_failed" });
      }
    },
  );

  app.post(
    "/windrose/bounties/:id/claim",
    {
      schema: { tags: ["windrose"], params: z.object({ id: z.string().min(1) }) },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const id = (req.params as any).id as string;
      const body: any = (req as any).body || {};
      const proofNote = String(body.proofNote || "")
        .trim()
        .slice(0, 500);
      const proofImageUrl = body.proofImageUrl
        ? String(body.proofImageUrl).trim().slice(0, 300)
        : null;
      if (!proofNote) return reply.code(400).send({ ok: false, error: "proof_required" });

      const b = await prisma.windroseBounty.findUnique({ where: { id } });
      if (!b) return reply.code(404).send({ ok: false, error: "not_found" });
      if (b.status !== "OPEN")
        return reply
          .code(400)
          .send({ ok: false, error: "not_claimable", message: "This bounty is no longer open." });
      if (b.posterId === u.id)
        return reply.code(400).send({
          ok: false,
          error: "cannot_self_claim",
          message: "You can't claim your own bounty.",
        });

      try {
        const claimantName =
          (await prisma.user.findUnique({ where: { id: u.id }, select: { name: true } }))?.name ||
          u.id;
        const updated = await prisma.windroseBounty.update({
          where: { id },
          data: {
            status: "CLAIMED",
            claimantId: u.id,
            claimantName,
            proofNote,
            proofImageUrl,
            claimedAt: new Date(),
          },
        });
        wrCache.delete("wr:activity");
        try {
          broadcastToLobby?.("windrose", {
            type: "windrose:bounty:claimed",
            userId: u.id,
            userName: claimantName,
            lobbyId: "windrose",
            bountyId: b.id,
            amount: b.amount,
          });
        } catch {}
        sendPush(b.posterId, {
          title: "Claim on your bounty",
          body: `${claimantName} claims ${b.amount.toLocaleString()} Paper on ${b.targetHandle}. Review the proof.`,
          url: "/lobby/windrose",
          tag: `windrose:bounty:${b.id}`,
        }).catch(() => {});
        return reply.send({ ok: true, bounty: updated });
      } catch (e) {
        log.error("[windrose/bounties claim]", e);
        return reply.code(500).send({ ok: false, error: "claim_failed" });
      }
    },
  );

  app.post(
    "/windrose/bounties/:id/settle",
    {
      schema: { tags: ["windrose"], params: z.object({ id: z.string().min(1) }) },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const id = (req.params as any).id as string;
      const b = await prisma.windroseBounty.findUnique({ where: { id } });
      if (!b) return reply.code(404).send({ ok: false, error: "not_found" });
      if (b.posterId !== u.id) return reply.code(403).send({ ok: false, error: "forbidden" });
      if (b.status !== "CLAIMED" || !b.claimantId)
        return reply.code(400).send({ ok: false, error: "not_claimed" });
      const credit = await awardPaper(
        b.claimantId,
        "EARN_GIFT",
        b.amount,
        `Bounty claim · ${b.targetHandle}`,
        b.id,
      );
      if (!credit) return reply.code(500).send({ ok: false, error: "payout_failed" });
      try {
        const updated = await prisma.windroseBounty.update({
          where: { id },
          data: { status: "SETTLED", settledAt: new Date() },
        });
        wrCache.delete("wr:bounties:leaderboard");
        wrCache.delete("wr:activity");
        if (b.claimantId) {
          sendPush(b.claimantId, {
            title: "Bounty paid",
            body: `${b.amount.toLocaleString()} Paper just hit your wallet. ${b.targetHandle} is settled.`,
            url: "/store",
            tag: `windrose:bounty:${b.id}:settled`,
          }).catch(() => {});
        }
        return reply.send({ ok: true, bounty: updated });
      } catch (e) {
        log.error("[windrose/bounties settle]", e);
        return reply.code(500).send({ ok: false, error: "settle_failed" });
      }
    },
  );

  app.post(
    "/windrose/bounties/:id/reject",
    {
      schema: { tags: ["windrose"], params: z.object({ id: z.string().min(1) }) },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const id = (req.params as any).id as string;
      const b = await prisma.windroseBounty.findUnique({ where: { id } });
      if (!b) return reply.code(404).send({ ok: false, error: "not_found" });
      if (b.posterId !== u.id) return reply.code(403).send({ ok: false, error: "forbidden" });
      if (b.status !== "CLAIMED") return reply.code(400).send({ ok: false, error: "not_claimed" });
      try {
        const rejectedClaimantId = b.claimantId;
        const updated = await prisma.windroseBounty.update({
          where: { id },
          data: {
            status: "OPEN",
            claimantId: null,
            claimantName: null,
            proofNote: null,
            proofImageUrl: null,
            claimedAt: null,
          },
        });
        wrCache.delete("wr:activity");
        if (rejectedClaimantId) {
          sendPush(rejectedClaimantId, {
            title: "Claim rejected",
            body: `Your claim on ${b.targetHandle} was rejected. The bounty's back on the board.`,
            url: "/lobby/windrose",
            tag: `windrose:bounty:${b.id}:rejected`,
          }).catch(() => {});
        }
        return reply.send({ ok: true, bounty: updated });
      } catch (e) {
        log.error("[windrose/bounties reject]", e);
        return reply.code(500).send({ ok: false, error: "reject_failed" });
      }
    },
  );

  app.post(
    "/windrose/bounties/:id/cancel",
    {
      schema: { tags: ["windrose"], params: z.object({ id: z.string().min(1) }) },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const id = (req.params as any).id as string;
      const b = await prisma.windroseBounty.findUnique({ where: { id } });
      if (!b) return reply.code(404).send({ ok: false, error: "not_found" });
      if (b.posterId !== u.id) return reply.code(403).send({ ok: false, error: "forbidden" });
      if (b.status !== "OPEN")
        return reply.code(400).send({
          ok: false,
          error: "not_open",
          message: "Can only cancel while open (uncclaimed).",
        });
      const refund = await awardPaper(
        u.id,
        "ADJUSTMENT",
        b.amount,
        `Bounty cancelled · refund`,
        b.id,
      );
      if (!refund) return reply.code(500).send({ ok: false, error: "refund_failed" });
      try {
        const updated = await prisma.windroseBounty.update({
          where: { id },
          data: { status: "CANCELLED", cancelledAt: new Date() },
        });
        wrCache.delete("wr:bounties:leaderboard");
        wrCache.delete("wr:activity");
        return reply.send({ ok: true, bounty: updated, balance: refund.balance });
      } catch (e) {
        log.error("[windrose/bounties cancel]", e);
        return reply.code(500).send({ ok: false, error: "cancel_failed" });
      }
    },
  );

  const BOUNTY_EXPIRY_DAYS = 21;
  async function sweepExpiredBounties() {
    try {
      const cutoff = new Date(Date.now() - BOUNTY_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      const stale = await prisma.windroseBounty.findMany({
        where: { lobbyId: "windrose", status: "OPEN", createdAt: { lt: cutoff } },
        take: 100,
      });
      if (stale.length === 0) return;
      for (const b of stale) {
        const refund = await awardPaper(
          b.posterId,
          "ADJUSTMENT",
          b.amount,
          `Bounty expired · refund`,
          b.id,
        );
        if (!refund) continue;
        try {
          await prisma.windroseBounty.update({
            where: { id: b.id },
            data: { status: "CANCELLED", cancelledAt: new Date() },
          });
          sendPush(b.posterId, {
            title: "Bounty expired",
            body: `Your ${b.amount.toLocaleString()} Paper on ${b.targetHandle} went unclaimed. Refunded to your wallet.`,
            url: "/lobby/windrose",
            tag: `windrose:bounty:${b.id}:expired`,
          }).catch(() => {});
        } catch (e) {
          await awardPaper(
            b.posterId,
            "ADJUSTMENT",
            -b.amount,
            `Bounty expire rollback`,
            b.id,
          ).catch(() => {});
          log.error("[windrose/bounties expire]", e);
        }
      }
      wrCache.delete("wr:bounties:leaderboard");
      wrCache.delete("wr:activity");
      log.log(`[windrose] auto-expired ${stale.length} bounty(ies)`);
    } catch (e) {
      log.error("[windrose/bounties sweep]", e);
    }
  }
  setInterval(
    () => {
      void sweepExpiredBounties();
    },
    60 * 60 * 1000,
  );
  setTimeout(() => {
    void sweepExpiredBounties();
  }, 30 * 1000);

  app.get("/windrose/bounties/leaderboard", async (_req, reply) => {
    const cacheKey = "wr:bounties:leaderboard";
    const cached = wrCacheGet(cacheKey);
    if (cached) return reply.send(cached);
    try {
      const rows: any[] = await prisma.windroseBounty.findMany({
        where: { lobbyId: "windrose" },
        take: 5000,
      });

      const wantedMap = new Map<string, { count: number; amount: number }>();
      for (const r of rows) {
        if (r.status !== "OPEN" && r.status !== "CLAIMED") continue;
        const key = String(r.targetHandle || "").trim();
        if (!key) continue;
        const slot = wantedMap.get(key) || { count: 0, amount: 0 };
        slot.count += 1;
        slot.amount += Number(r.amount) || 0;
        wantedMap.set(key, slot);
      }
      const mostWanted = Array.from(wantedMap.entries())
        .map(([targetHandle, v]) => ({ targetHandle, openCount: v.count, totalAmount: v.amount }))
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, 10);

      const hunterMap = new Map<string, { name: string; kills: number; earned: number }>();
      for (const r of rows) {
        if (r.status !== "SETTLED" || !r.claimantId) continue;
        const slot = hunterMap.get(r.claimantId) || {
          name: String(r.claimantName || r.claimantId),
          kills: 0,
          earned: 0,
        };
        slot.kills += 1;
        slot.earned += Number(r.amount) || 0;
        hunterMap.set(r.claimantId, slot);
      }
      const topHunters = Array.from(hunterMap.entries())
        .map(([userId, v]) => ({ userId, userName: v.name, kills: v.kills, totalEarned: v.earned }))
        .sort((a, b) => b.totalEarned - a.totalEarned)
        .slice(0, 10);

      const posterMap = new Map<string, { name: string; posted: number; total: number }>();
      for (const r of rows) {
        if (!r.posterId) continue;
        const slot = posterMap.get(r.posterId) || {
          name: String(r.posterName || r.posterId),
          posted: 0,
          total: 0,
        };
        slot.posted += 1;
        slot.total += Number(r.amount) || 0;
        posterMap.set(r.posterId, slot);
      }
      const biggestPosters = Array.from(posterMap.entries())
        .map(([userId, v]) => ({
          userId,
          userName: v.name,
          postedCount: v.posted,
          totalPosted: v.total,
        }))
        .sort((a, b) => b.totalPosted - a.totalPosted)
        .slice(0, 10);

      const openCount = rows.filter((r) => r.status === "OPEN" || r.status === "CLAIMED").length;
      const openTotal = rows
        .filter((r) => r.status === "OPEN" || r.status === "CLAIMED")
        .reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const settled = rows.filter((r) => r.status === "SETTLED");
      const settledCount = settled.length;
      const settledTotal = settled.reduce((s, r) => s + (Number(r.amount) || 0), 0);

      const result = {
        ok: true,
        mostWanted,
        topHunters,
        biggestPosters,
        stats: { openCount, openTotal, settledCount, settledTotal },
        checkedAt: new Date().toISOString(),
      };
      wrCacheSet(cacheKey, result, 5 * 60 * 1000);
      return reply.send(result);
    } catch (e) {
      log.error("[windrose/bounties leaderboard]", e);
      return reply.code(500).send({ ok: false, error: "fetch_failed" });
    }
  });

  async function pollWindroseServers() {
    try {
      const servers = await prisma.communityServer.findMany({
        where: { lobbyId: "windrose", queryUrl: { not: null } },
        select: { id: true, queryUrl: true },
        take: 200,
      });
      for (const s of servers) {
        if (!s.queryUrl) continue;
        try {
          const res = await fetchWithTimeout(s.queryUrl, { signal: AbortSignal.timeout(5000) });
          if (!res.ok) {
            await prisma.communityServer
              .update({ where: { id: s.id }, data: { status: "offline" } })
              .catch(() => {});
            continue;
          }
          const json: any = await res.json().catch(() => null);
          await prisma.communityServer
            .update({
              where: { id: s.id },
              data: { status: "online", lastSeenAt: new Date(), lastState: json as any },
            })
            .catch(() => {});
        } catch {
          await prisma.communityServer
            .update({ where: { id: s.id }, data: { status: "offline" } })
            .catch(() => {});
        }
      }
    } catch (e) {
      log.error("[windrose server poller]", e);
    }
  }
  setInterval(() => {
    void pollWindroseServers();
  }, 90_000);
  setTimeout(() => {
    void pollWindroseServers();
  }, 20_000);
}
