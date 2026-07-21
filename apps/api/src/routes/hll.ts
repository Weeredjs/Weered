import { log, swallow } from "../lib/logger";
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { createNotification } from "../lib/notifications";
import { isStaffUser } from "../lib/isStaffUser";
import { assertSafeUrl } from "../lib/ssrfGuard";
import { awardNotoriety } from "../lib/notoriety";

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
  region: string | null;
  rank: number | null;
  status: string;
};

// HLL servers do not set Steam's region field, so region comes from the way
// communities actually signal it: the server name. EU tokens first (they are
// the most distinctive); NA last because "east/west" are generic.
function guessRegion(name: string): string | null {
  const n = ` ${name.toLowerCase()} `;
  if (
    /[\s\W](eu|ger|german|uk|fr|french|pol|polski|polish|nl|dutch|esp|spain|ita|scand|nord)[\s\W]/.test(
      n,
    )
  )
    return "EU";
  if (/[\s\W](aus?|anz|oce|oceania|sydney|nz)[\s\W]/.test(n)) return "OCE";
  if (/[\s\W](asia|sea|jpn?|kr|kor|cn|chn|sgp?|hk|tha?i)[\s\W]/.test(n)) return "ASIA";
  if (/[\s\W](usa?|na|east|west|central|dallas|chicago|texas|nyc?|cali|canada|can)[\s\W]/.test(n))
    return "NA";
  return null;
}

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
  // Verified seeding — armed only when the rally's server has a linked CRCON.
  // seen counts poll hits per user; two sightings ≥1 poll apart = present, not
  // a drive-by. awarded is the in-memory mirror of the refId-deduped ledger.
  verify?: {
    seen: Map<string, number>;
    awarded: Set<string>;
    timer: ReturnType<typeof setInterval>;
  };
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
    const name = String(a.name).slice(0, 120);
    return {
      id: String(row.id),
      name,
      players: Number(a.players) || 0,
      maxPlayers: Number(a.maxPlayers) || 100,
      map: a.details?.map ? String(a.details.map) : null,
      country: a.country ? String(a.country) : null,
      region: guessRegion(name),
      rank: typeof a.rank === "number" ? a.rank : null,
      status: String(a.status || "online"),
    };
  }

  // Primary source: Steam's own server browser (first-party, same API key that
  // already serves the player-count chip). BattleMetrics 403s datacenter IPs
  // anonymously, so it is the fallback now, not the front door.
  async function fetchSteamServers(): Promise<BmServer[]> {
    const key = process.env.STEAM_API_KEY || "";
    if (!key) return [];
    const j = await jget(
      `https://api.steampowered.com/IGameServersService/GetServerList/v1/?key=${key}&filter=%5Cappid%5C${STEAM_APP_ID}&limit=1000`,
    );
    const rows: any[] = Array.isArray(j?.response?.servers) ? j.response.servers : [];
    return rows
      .map((s: any): BmServer | null => {
        if (!s?.name) return null;
        const name = String(s.name).slice(0, 120);
        return {
          id: String(s.steamid || s.addr || ""),
          name,
          players: Number(s.players) || 0,
          maxPlayers: Number(s.max_players) || 100,
          map: s.map ? String(s.map) : null,
          country: null,
          region: guessRegion(name),
          rank: null,
          status: "online",
        };
      })
      .filter((s): s is BmServer => !!s && !!s.id)
      .sort((a, b) => b.players - a.players)
      .slice(0, 120);
  }

  // Top HLL servers by population. One upstream call per 60s serves everyone.
  async function getServers(): Promise<BmServer[]> {
    const hit = cacheGet("servers");
    if (hit) return hit;
    let rows = await fetchSteamServers();
    if (!rows.length) {
      const j = await jget(
        `${BM_BASE}/servers?filter[game]=hll&filter[status]=online&sort=-players&page[size]=100`,
      );
      rows = Array.isArray(j?.data) ? j.data.map(mapBmServer).filter(Boolean) : [];
    }
    if (rows.length) cacheSet("servers", rows, 60_000);
    return rows.length ? rows : cacheGet("servers-stale") || [];
  }

  // A rally can point at a server outside the cached window: check the live
  // list first (refreshing it if stale), then fall back to a BM point lookup.
  async function getServerById(bmId: string): Promise<BmServer | null> {
    const key = `server:${bmId}`;
    const hit = cacheGet(key);
    if (hit) return hit;
    const listed = (await getServers()).find((s) => s.id === bmId);
    if (listed) return listed;
    if (/^\d+$/.test(bmId) && bmId.length < 12) {
      const j = await jget(`${BM_BASE}/servers/${encodeURIComponent(bmId)}`);
      const s = j?.data ? mapBmServer(j.data) : null;
      if (s) cacheSet(key, s, 60_000);
      return s;
    }
    return null;
  }

  // ---- linked community server (CRCON) ---------------------------------------
  // A community links its CRCON instance (the de-facto HLL admin tool). Keyless
  // link = status board only (get_public_info is CRCON's one public endpoint);
  // an API key unlocks player lists + match history → verified seeding. The
  // base URL and key NEVER leave the server.

  type Linked = {
    id: string;
    name: string;
    baseUrl: string;
    apiKey: string | null;
    bmServerId: string | null;
    status: string;
    lastSeenAt: Date | null;
  };
  let linkedCache: { row: Linked | null; expiresAt: number } | null = null;

  async function loadLinkedServer(): Promise<Linked | null> {
    if (linkedCache && linkedCache.expiresAt > Date.now()) return linkedCache.row;
    try {
      const row = await prisma.communityServer.findFirst({
        where: { lobbyId: HLL_LOBBY_ID, framework: "crcon" },
        orderBy: { createdAt: "asc" },
      });
      const mapped: Linked | null = row
        ? {
            id: row.id,
            name: row.name,
            baseUrl: row.host,
            apiKey: (row as any).apiKey ?? null,
            bmServerId: (row as any).bmServerId ?? null,
            status: row.status,
            lastSeenAt: row.lastSeenAt,
          }
        : null;
      linkedCache = { row: mapped, expiresAt: Date.now() + 5 * 60_000 };
      return mapped;
    } catch (e) {
      swallow(e);
      return null;
    }
  }
  function invalidateLinked() {
    linkedCache = null;
    cache.delete("crcon:live");
    cache.delete("crcon:warrecord");
  }

  // CRCON wraps every response as { result, command, failed, error }.
  async function crconGet(linked: Linked, cmd: string): Promise<any | null> {
    try {
      const base = linked.baseUrl.replace(/\/+$/, "");
      const headers: Record<string, string> = { Accept: "application/json" };
      if (linked.apiKey) headers.Authorization = `Bearer ${linked.apiKey}`;
      const res = await fetch(`${base}/api/${cmd}`, {
        headers,
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const j = await res.json();
      if (j && typeof j === "object" && "result" in j) {
        if (j.failed) return null;
        return j.result;
      }
      return j;
    } catch (e) {
      swallow(e);
      return null;
    }
  }

  // get_public_info (CRCON's public read): current_map.map, player_count,
  // max_player_count, player_count_by_team{allied,axis}, score{allied,axis},
  // time_remaining, name.name — with fallbacks for older/newer variants.
  function normalizePublicInfo(r: any): any | null {
    if (!r || typeof r !== "object") return null;
    const mapRaw =
      (typeof r.current_map === "object"
        ? r.current_map?.map?.pretty_name || r.current_map?.map?.id || r.current_map?.map
        : r.current_map) ||
      r.map ||
      null;
    const name = (typeof r.name === "object" ? r.name?.name : r.name) || r.server_name || null;
    return {
      serverName: name ? String(name).slice(0, 120) : null,
      map: mapRaw ? String(mapRaw) : null,
      players: Number(r.player_count ?? r.nb_players ?? 0) || 0,
      maxPlayers: Number(r.max_player_count ?? r.max_players ?? 100) || 100,
      allied: Number(r.player_count_by_team?.allied ?? 0) || 0,
      axis: Number(r.player_count_by_team?.axis ?? 0) || 0,
      scoreAllied: Number(r.score?.allied ?? 0) || 0,
      scoreAxis: Number(r.score?.axis ?? 0) || 0,
      timeRemaining: Number(r.time_remaining ?? r.raw_time_remaining ?? 0) || 0,
    };
  }

  // Player-id extraction across CRCON versions: get_playerids returns
  // [name, id] pairs; get_players returns rich objects. Accept both.
  function extractPlayerIds(r: any): Set<string> {
    const out = new Set<string>();
    const rows = Array.isArray(r) ? r : Array.isArray(r?.players) ? r.players : [];
    for (const row of rows) {
      if (Array.isArray(row) && row[1]) out.add(String(row[1]));
      else if (row && typeof row === "object") {
        const id = row.player_id || row.steam_id_64 || row.steamId || row.id;
        if (id) out.add(String(id));
      }
    }
    return out;
  }

  async function fetchLivePlayerIds(linked: Linked): Promise<Set<string> | null> {
    const a = await crconGet(linked, "get_playerids");
    if (a) {
      const ids = extractPlayerIds(a);
      if (ids.size) return ids;
    }
    const b = await crconGet(linked, "get_players");
    if (b) return extractPlayerIds(b);
    return a ? new Set<string>() : null; // null = endpoint unreachable (don't count a miss)
  }

  // ---- rallies (in-memory; ephemeral by design) ------------------------------
  const rallies = new Map<string, Rally>();
  let lastArmAt = 0; // lobby-wide arm cooldown (staff exempt)
  let _raSeq = 0;

  function stopVerify(r: Rally) {
    if (r.verify) {
      clearInterval(r.verify.timer);
      r.verify.timer = undefined as any;
    }
  }

  function sweepRallies() {
    const now = Date.now();
    for (const [id, r] of rallies)
      if (r.expiresAt < now) {
        stopVerify(r);
        rallies.delete(id);
      }
  }

  // The verification loop: every 3 minutes during a rally, read who is actually
  // on the server and credit joiners whose linked SteamID64 shows up twice.
  function armVerification(rally: Rally, linked: Linked) {
    const seen = new Map<string, number>();
    const awarded = new Set<string>();
    const timer = setInterval(async () => {
      try {
        if (rally.expiresAt < Date.now()) {
          stopVerify(rally);
          return;
        }
        const ids = await fetchLivePlayerIds(linked);
        if (!ids) return; // upstream unreachable this cycle — no penalty, no credit
        const joinerIds = Array.from(rally.joiners.keys());
        if (!joinerIds.length) return;
        const users = await prisma.user.findMany({
          where: { id: { in: joinerIds } },
          select: { id: true, steamId: true } as any,
        });
        for (const u of users as any[]) {
          if (!u.steamId || !ids.has(String(u.steamId))) continue;
          const n = (seen.get(u.id) || 0) + 1;
          seen.set(u.id, n);
          if (n >= 2 && !awarded.has(u.id)) {
            awarded.add(u.id);
            awardNotoriety(u.id, "HLL_SEEDED", rally.id).catch(swallow);
          }
        }
      } catch (e) {
        swallow(e);
      }
    }, 3 * 60_000);
    rally.verify = { seen, awarded, timer };
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
      verifiedMode: !!r.verify,
      joiners: Array.from(r.joiners.entries()).map(([id, v]) => ({
        id,
        name: v.name,
        verified: r.verify ? r.verify.awarded.has(id) : false,
      })),
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
    let meSteamLinked = false;
    if (u) {
      canArm = await canArmRally(u.id);
      joinedIds = views.filter((v) => rallies.get(v.id)?.joiners.has(u.id)).map((v) => v.id);
      const row = await prisma.user
        .findUnique({ where: { id: u.id }, select: { steamId: true } as any })
        .catch(() => null);
      meSteamLinked = !!(row as any)?.steamId;
    }
    return reply.send({ ok: true, rallies: views, canArm, joinedIds, meSteamLinked });
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

    // Verified seeding: if this rally's server is the linked community server,
    // start the presence loop — joiners with a linked SteamID64 who actually
    // show up get credited (refId-deduped, once per rally).
    const linked = await loadLinkedServer();
    if (linked && linked.bmServerId && linked.bmServerId === bmServerId) {
      armVerification(rally, linked);
    }

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
    stopVerify(rally);
    rallies.delete(rally.id);
    return reply.send({ ok: true });
  });

  // ---- the Garrison: linked-server routes ------------------------------------

  app.get("/hll/server", { schema: { tags: ["hll"] } }, async (req, reply) => {
    const u = authFromHeader?.((req as any).headers?.authorization);
    const canManage = u ? await canArmRally(u.id) : false;
    const linked = await loadLinkedServer();
    if (!linked) return reply.send({ ok: true, linked: false, canManage });

    let live = cacheGet("crcon:live");
    if (!live) {
      const [info, rotation] = await Promise.all([
        crconGet(linked, "get_public_info"),
        linked.apiKey ? crconGet(linked, "get_map_rotation") : Promise.resolve(null),
      ]);
      const norm = normalizePublicInfo(info);
      live = {
        info: norm,
        rotation: Array.isArray(rotation)
          ? rotation
              .slice(0, 12)
              .map((m: any) =>
                String(typeof m === "object" ? m?.pretty_name || m?.id || m?.map || "" : m),
              )
              .filter(Boolean)
          : [],
        reachable: !!norm,
        at: Date.now(),
      };
      cacheSet("crcon:live", live, 60_000);
      if (norm) {
        prisma.communityServer
          .update({
            where: { id: linked.id },
            data: { lastSeenAt: new Date(), status: "connected", lastState: live.info },
          })
          .catch(swallow);
      }
    }

    return reply.send({
      ok: true,
      linked: true,
      canManage,
      server: {
        name: linked.name,
        bmServerId: linked.bmServerId,
        status: live.reachable ? "connected" : linked.status,
        lastSeenAt: linked.lastSeenAt,
        hasKey: !!linked.apiKey,
        live: live.info,
        rotation: live.rotation,
      },
    });
  });

  app.post("/hll/server/link", { schema: { tags: ["hll"] } }, async (req, reply) => {
    const u = authFromHeader?.((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!(await canArmRally(u.id))) return reply.code(403).send({ ok: false, error: "mods_only" });

    const body: any = (req as any).body || {};
    const name = String(body.name || "")
      .trim()
      .slice(0, 80);
    const baseUrlRaw = String(body.baseUrl || "")
      .trim()
      .slice(0, 200);
    const apiKey =
      String(body.apiKey || "")
        .trim()
        .slice(0, 200) || null;
    const bmServerId = /^\d+$/.test(String(body.bmServerId || "").trim())
      ? String(body.bmServerId).trim()
      : null;
    if (!name || !baseUrlRaw) return reply.code(400).send({ ok: false, error: "missing_fields" });

    // User-supplied URL → SSRF guard (resolves DNS, blocks private ranges).
    let baseUrl: string;
    try {
      const parsed = await assertSafeUrl(baseUrlRaw);
      baseUrl = `${parsed.protocol}//${parsed.host}`;
    } catch {
      return reply.code(400).send({ ok: false, error: "bad_url" });
    }

    // Probe: public info (keyless), then authed reads if a key was given.
    const probeLinked: Linked = {
      id: "probe",
      name,
      baseUrl,
      apiKey,
      bmServerId,
      status: "pending",
      lastSeenAt: null,
    };
    const [info, version, playersProbe] = await Promise.all([
      crconGet(probeLinked, "get_public_info"),
      crconGet(probeLinked, "get_version"),
      apiKey ? fetchLivePlayerIds(probeLinked) : Promise.resolve(null),
    ]);
    const norm = normalizePublicInfo(info);
    if (!norm)
      return reply
        .code(422)
        .send({ ok: false, error: "not_crcon", detail: "get_public_info did not respond" });

    const capabilities = {
      publicInfo: true,
      version: version ? String(version).slice(0, 40) : null,
      authedReads: !!(apiKey && playersProbe),
    };

    const existing = await prisma.communityServer.findFirst({
      where: { lobbyId: HLL_LOBBY_ID, framework: "crcon" },
    });
    const data: any = {
      lobbyId: HLL_LOBBY_ID,
      ownerId: u.id,
      name,
      host: baseUrl,
      queryUrl: baseUrl,
      framework: "crcon",
      status: "connected",
      lastSeenAt: new Date(),
      lastState: { info: norm, capabilities },
      apiKey,
      bmServerId,
    };
    if (existing) await prisma.communityServer.update({ where: { id: existing.id }, data });
    else await prisma.communityServer.create({ data });
    invalidateLinked();

    return reply.send({ ok: true, capabilities, live: norm });
  });

  app.post("/hll/server/unlink", { schema: { tags: ["hll"] } }, async (req, reply) => {
    const u = authFromHeader?.((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!(await canArmRally(u.id))) return reply.code(403).send({ ok: false, error: "mods_only" });
    await prisma.communityServer
      .deleteMany({ where: { lobbyId: HLL_LOBBY_ID, framework: "crcon" } })
      .catch(swallow);
    invalidateLinked();
    return reply.send({ ok: true });
  });

  // War Record — recent completed matches off the linked CRCON's history.
  // Endpoint names vary by CRCON version; try the known ones, normalize hard.
  app.get("/hll/server/warrecord", { schema: { tags: ["hll"] } }, async (_req, reply) => {
    const linked = await loadLinkedServer();
    if (!linked) return reply.send({ ok: true, linked: false, matches: [] });
    if (!linked.apiKey) return reply.send({ ok: true, linked: true, needsKey: true, matches: [] });

    const hit = cacheGet("crcon:warrecord");
    if (hit) return reply.send(hit);

    const raw =
      (await crconGet(linked, "get_scoreboard_maps")) ??
      (await crconGet(linked, "get_map_history"));
    const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.maps) ? raw.maps : [];
    const matches = rows
      .slice(0, 15)
      .map((m: any) => {
        const mapRaw =
          (typeof m?.map === "object" ? m.map?.pretty_name || m.map?.id : m?.map) ||
          m?.map_name ||
          m?.name ||
          null;
        const allied = Number(m?.result?.allied ?? m?.allied_score ?? m?.score?.allied ?? NaN);
        const axis = Number(m?.result?.axis ?? m?.axis_score ?? m?.score?.axis ?? NaN);
        const start = m?.start ? new Date(m.start).getTime() : null;
        const end = m?.end ? new Date(m.end).getTime() : null;
        if (!mapRaw) return null;
        return {
          map: String(mapRaw),
          allied: Number.isFinite(allied) ? allied : null,
          axis: Number.isFinite(axis) ? axis : null,
          start,
          end,
        };
      })
      .filter(Boolean);

    const out = { ok: true, linked: true, matches };
    if (matches.length) cacheSet("crcon:warrecord", out, 5 * 60_000);
    return reply.send(out);
  });
}
