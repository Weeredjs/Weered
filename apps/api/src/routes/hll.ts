import { log, swallow } from "../lib/logger";
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { createNotification } from "../lib/notifications";
import { isStaffUser } from "../lib/isStaffUser";

// Hell Let Loose. There is no official Team17 API (servers are GSP-rented) —
// the data plane is BattleMetrics (public server list: name/players/map/region)
// plus Steam (news + global player count). Phase 2 adds per-community CRCON
// links via CommunityServer. The seeding rally board lives here too: HLL's
// existential community problem is getting a server from 0 to the ~40 players
// where the game comes alive, and the fix communities actually use is a ping
// people answer. Rallies are deliberately ephemeral (in-memory, hours-long) —
// a dead rally board is worse than none.

type Opts = {
  authFromHeader?: (h?: string) => { id: string; name?: string } | null;
};

const HLL_LOBBY_ID = "hll";
const BM_BASE = "https://api.battlemetrics.com";
const STEAM_APP_ID = 686810;

type BmServer = {
  id: string;
  name: string;
  players: number;
  maxPlayers: number;
  map: string | null;
  country: string | null;
  rank: number | null;
  status: string;
};

type Rally = {
  id: string;
  bmServerId: string;
  serverName: string;
  note: string;
  target: number;
  armedById: string;
  armedByName: string;
  createdAt: number;
  expiresAt: number;
  joiners: Map<string, { name: string; at: number }>;
};

export default async function hllRoutes(app: FastifyInstance, opts: Opts = {}) {
  const authFromHeader = opts.authFromHeader;

  const cache = new Map<string, { data: any; expiresAt: number }>();
  function cacheGet(key: string) {
    const c = cache.get(key);
    if (c && c.expiresAt > Date.now()) return c.data;
    return null;
  }
  function cacheSet(key: string, data: any, ttlMs: number) {
    cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  async function jget(url: string, headers: Record<string, string> = {}): Promise<any | null> {
    try {
      // Bounded upstream call; expected failures (rate-limit / 5xx / network)
      // degrade to null and the route serves stale/empty cache.
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Weered/1.0 (https://weered.ca)",
          ...headers,
        },
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 429) {
        log.warn("[hll] rate limited", url.split("?")[0]);
        return null;
      }
      if (!res.ok) {
        if (res.status !== 404) log.warn(`[hll] upstream ${res.status} ${url.split("?")[0]}`);
        return null;
      }
      return await res.json();
    } catch (e) {
      log.warn(`[hll] fetch failed: ${(e as any)?.message || e}`);
      return null;
    }
  }

  function mapBmServer(row: any): BmServer | null {
    const a = row?.attributes;
    if (!row?.id || !a?.name) return null;
    return {
      id: String(row.id),
      name: String(a.name).slice(0, 120),
      players: Number(a.players) || 0,
      maxPlayers: Number(a.maxPlayers) || 100,
      map: a.details?.map ? String(a.details.map) : null,
      country: a.country ? String(a.country) : null,
      rank: typeof a.rank === "number" ? a.rank : null,
      status: String(a.status || "online"),
    };
  }

  // Top ~100 HLL servers by population. One upstream call per 60s serves everyone.
  async function getServers(): Promise<BmServer[]> {
    const hit = cacheGet("servers");
    if (hit) return hit;
    const j = await jget(
      `${BM_BASE}/servers?filter[game]=hll&filter[status]=online&sort=-players&page[size]=100`,
    );
    const rows: BmServer[] = Array.isArray(j?.data) ? j.data.map(mapBmServer).filter(Boolean) : [];
    if (rows.length) cacheSet("servers", rows, 60_000);
    return rows.length ? rows : cacheGet("servers-stale") || [];
  }

  // A rally can point at a server outside the top-100 window — fetch it solo.
  async function getServerById(bmId: string): Promise<BmServer | null> {
    const key = `server:${bmId}`;
    const hit = cacheGet(key);
    if (hit) return hit;
    const listed = (cacheGet("servers") as BmServer[] | null)?.find((s) => s.id === bmId);
    if (listed) return listed;
    const j = await jget(`${BM_BASE}/servers/${encodeURIComponent(bmId)}`);
    const s = j?.data ? mapBmServer(j.data) : null;
    if (s) cacheSet(key, s, 60_000);
    return s;
  }

  // ---- rallies (in-memory; ephemeral by design) ------------------------------
  const rallies = new Map<string, Rally>();
  let lastArmAt = 0; // lobby-wide arm cooldown (staff exempt)
  let _raSeq = 0;

  function sweepRallies() {
    const now = Date.now();
    for (const [id, r] of rallies) if (r.expiresAt < now) rallies.delete(id);
  }

  async function canArmRally(userId: string): Promise<boolean> {
    try {
      if (await isStaffUser(userId)) return true;
      const lobby = await prisma.lobby.findUnique({
        where: { id: HLL_LOBBY_ID },
        select: { ownerId: true },
      });
      if (lobby?.ownerId === userId) return true;
      const m = await prisma.lobbyMember.findUnique({
        where: { lobbyId_userId: { lobbyId: HLL_LOBBY_ID, userId } },
        select: { roleLevel: true },
      });
      return (m?.roleLevel || 0) >= 3; // Moderator+
    } catch (e) {
      swallow(e);
      return false;
    }
  }

  async function rallyView(r: Rally): Promise<any> {
    const server = await getServerById(r.bmServerId);
    return {
      id: r.id,
      bmServerId: r.bmServerId,
      serverName: r.serverName,
      note: r.note,
      target: r.target,
      armedByName: r.armedByName,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      players: server?.players ?? null,
      maxPlayers: server?.maxPlayers ?? null,
      map: server?.map ?? null,
      joiners: Array.from(r.joiners.entries()).map(([id, v]) => ({ id, name: v.name })),
    };
  }

  // ---- routes ----------------------------------------------------------------

  app.get("/hll/servers", { schema: { tags: ["hll"] } }, async (_req, reply) => {
    const servers = await getServers();
    // keep a long-lived stale copy so a BM outage degrades instead of blanks
    if (servers.length) cacheSet("servers-stale", servers, 30 * 60_000);
    return reply.send({ ok: true, servers, fetchedAt: Date.now() });
  });

  app.get("/hll/intel", { schema: { tags: ["hll"] } }, async (_req, reply) => {
    const hit = cacheGet("intel");
    if (hit) return reply.send(hit);
    const [playersJ, newsJ] = await Promise.all([
      jget(
        `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${STEAM_APP_ID}`,
      ),
      jget(
        `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${STEAM_APP_ID}&count=8&maxlength=400&format=json`,
      ),
    ]);
    const playingNow =
      playersJ?.response?.result === 1 ? Number(playersJ.response.player_count) : null;
    const news = Array.isArray(newsJ?.appnews?.newsitems)
      ? newsJ.appnews.newsitems.map((n: any) => ({
          id: String(n.gid || n.url),
          title: String(n.title || "").slice(0, 200),
          url: String(n.url || ""),
          date: Number(n.date) * 1000 || null,
          feed: String(n.feedlabel || ""),
          snippet: String(n.contents || "")
            .replace(/\[[^\]]*\]/g, " ") // strip bbcode
            .replace(/https?:\/\/\S+/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 220),
        }))
      : [];
    const out = { ok: true, playingNow, news };
    cacheSet("intel", out, 10 * 60_000);
    return reply.send(out);
  });

  app.get("/hll/rallies", { schema: { tags: ["hll"] } }, async (req, reply) => {
    sweepRallies();
    const u = authFromHeader?.((req as any).headers?.authorization);
    const views = await Promise.all(Array.from(rallies.values()).map(rallyView));
    views.sort((a, b) => b.createdAt - a.createdAt);
    let canArm = false;
    let joinedIds: string[] = [];
    if (u) {
      canArm = await canArmRally(u.id);
      joinedIds = views.filter((v) => rallies.get(v.id)?.joiners.has(u.id)).map((v) => v.id);
    }
    return reply.send({ ok: true, rallies: views, canArm, joinedIds });
  });

  app.post("/hll/rallies", { schema: { tags: ["hll"] } }, async (req, reply) => {
    const u = authFromHeader?.((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!(await canArmRally(u.id))) return reply.code(403).send({ ok: false, error: "mods_only" });

    const body: any = (req as any).body || {};
    const bmServerId = String(body.bmServerId || "")
      .trim()
      .slice(0, 32);
    if (!/^\d+$/.test(bmServerId)) return reply.code(400).send({ ok: false, error: "bad_server" });
    const note = String(body.note || "")
      .trim()
      .slice(0, 180);
    const target = Math.min(100, Math.max(10, Number(body.target) || 45));

    sweepRallies();
    for (const r of rallies.values())
      if (r.bmServerId === bmServerId)
        return reply.code(409).send({ ok: false, error: "rally_exists" });

    const staff = await isStaffUser(u.id).catch(() => false);
    if (!staff && Date.now() - lastArmAt < 60 * 60_000)
      return reply.code(429).send({ ok: false, error: "cooldown" });

    const server = await getServerById(bmServerId);
    if (!server) return reply.code(404).send({ ok: false, error: "server_not_found" });

    const armer = await prisma.user.findUnique({
      where: { id: u.id },
      select: { name: true },
    });
    const armedByName = armer?.name || "A moderator";

    const rally: Rally = {
      id: `ra_${Date.now().toString(36)}_${++_raSeq}`,
      bmServerId,
      serverName: server.name,
      note,
      target,
      armedById: u.id,
      armedByName,
      createdAt: Date.now(),
      expiresAt: Date.now() + 3 * 60 * 60_000,
      joiners: new Map([[u.id, { name: armedByName, at: Date.now() }]]),
    };
    rallies.set(rally.id, rally);
    lastArmAt = Date.now();

    // Ping the lobby: the whole point is a call people actually receive.
    // In-app notification + (via createNotification) web/Expo push if offline.
    // Capped fan-out; fire-and-forget so the armer isn't held on N writes.
    void (async () => {
      try {
        const members = await prisma.lobbyMember.findMany({
          where: { lobbyId: HLL_LOBBY_ID, userId: { not: u.id } },
          select: { userId: true },
          take: 300,
        });
        await Promise.allSettled(
          members.map((m) =>
            createNotification({
              userId: m.userId,
              type: "SYSTEM",
              title: `Seeding rally: ${server.name.slice(0, 60)}`,
              body: note || `Help seed to ${target} players — the fight starts when you show up.`,
              actionUrl: "/lobby/hll",
              actorId: u.id,
              actorName: armedByName,
              meta: { kind: "hll_seed_rally", rallyId: rally.id, bmServerId },
            }),
          ),
        );
      } catch (e) {
        swallow(e);
      }
    })();

    return reply.send({ ok: true, rally: await rallyView(rally) });
  });

  app.post("/hll/rallies/:id/join", { schema: { tags: ["hll"] } }, async (req, reply) => {
    const u = authFromHeader?.((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    sweepRallies();
    const rally = rallies.get(String((req as any).params?.id || ""));
    if (!rally) return reply.code(404).send({ ok: false, error: "not_found" });
    if (!rally.joiners.has(u.id)) {
      const row = await prisma.user.findUnique({ where: { id: u.id }, select: { name: true } });
      rally.joiners.set(u.id, { name: row?.name || "Someone", at: Date.now() });
    }
    return reply.send({ ok: true, rally: await rallyView(rally) });
  });

  app.post("/hll/rallies/:id/leave", { schema: { tags: ["hll"] } }, async (req, reply) => {
    const u = authFromHeader?.((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const rally = rallies.get(String((req as any).params?.id || ""));
    if (!rally) return reply.code(404).send({ ok: false, error: "not_found" });
    rally.joiners.delete(u.id);
    return reply.send({ ok: true, rally: await rallyView(rally) });
  });

  app.post("/hll/rallies/:id/cancel", { schema: { tags: ["hll"] } }, async (req, reply) => {
    const u = authFromHeader?.((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const rally = rallies.get(String((req as any).params?.id || ""));
    if (!rally) return reply.code(404).send({ ok: false, error: "not_found" });
    if (rally.armedById !== u.id && !(await canArmRally(u.id)))
      return reply.code(403).send({ ok: false, error: "forbidden" });
    rallies.delete(rally.id);
    return reply.send({ ok: true });
  });
}
