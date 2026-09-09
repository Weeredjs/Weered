import type { FastifyInstance } from "fastify";
import { log, swallow } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { isStaffUser } from "../lib/isStaffUser";
import { rconRead, HllvRconError } from "../lib/hllvRcon";
import {
  type Game,
  STEAM_APP_ID,
  COMMANDER_ROLE,
  roleOf,
  factionOf,
  sideOf,
  parseLayer,
} from "../lib/hllVocab";

// Hell Let Loose, linked over RCON — both games.
//
// Vietnam is cross-platform and lives behind Team17's own backend, so unlike
// base HLL there is no public master list to build a browser from. What every
// Hell Let Loose server DOES have — WWII or Vietnam, the protocol is the same —
// is an RCON port. So a unit links its own box (or the public server it plays
// on, with the owner's RCON details) and gets, for that box:
//
//   live match     map, mode, the two sides by the numbers, score, clock, queue
//   live roster    who is on, by team and squad, with role and score
//   rhythm         what the box normally does at this hour — polled into the
//                  same GameServer aggregate the WWII browser reads, so the
//                  history component works unchanged. A WWII box that Steam's
//                  list already knows is matched to its existing row, so its
//                  rhythm is confident from day one.
//
// The routes keep the /hllv prefix they were born with; `game` on each link
// says which vocabulary applies. The RCON password is stored in
// CommunityServer.apiKey, which no route has ever serialised. host:port lives
// in `host`. Both stay on the server.

type Opts = {
  authFromHeader?: (h?: string) => { id: string; name?: string } | null;
};

const FRAMEWORKS: Record<Game, string> = { hll: "hll-rcon", hllv: "hllv-rcon" };
const GAME_OF_FRAMEWORK: Record<string, Game> = { "hll-rcon": "hll", "hllv-rcon": "hllv" };
const MAX_LINKED = 6;
const SESSION_TTL = 45_000;
const ROSTER_TTL = 20_000;
const POLL_MS = 10 * 60_000;
const RCON_TIMEOUT = 8000;

// ---- normalisers -------------------------------------------------------------

export type Session = {
  serverName: string;
  mapId: string;
  mapName: string;
  map: string | null;
  mode: string | null;
  attacker: string | null;
  timeOfDay: string | null;
  remaining: number;
  matchTime: number;
  players: number;
  maxPlayers: number;
  allied: number;
  axis: number;
  alliedScore: number;
  axisScore: number;
  alliedFaction: { short: string; name: string } | null;
  axisFaction: { short: string; name: string } | null;
  queue: number;
  maxQueue: number;
  vipQueue: number;
  alliedMorale: number;
  axisMorale: number;
  initialMorale: number;
};

function normSession(game: Game, s: any): Session {
  const mapId = String(s?.mapId || "").slice(0, 60);
  const layer = parseLayer(game, mapId);
  const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const fac = (v: any) => {
    const f = factionOf(game, Number(v));
    return f ? { short: f.short, name: f.name } : null;
  };
  return {
    serverName: String(s?.serverName || "").slice(0, 120),
    mapId,
    mapName: String(s?.mapName || "").slice(0, 80),
    ...layer,
    remaining: n(s?.remainingMatchTime),
    matchTime: n(s?.matchTime),
    players: n(s?.playerCount),
    maxPlayers: n(s?.maxPlayerCount) || 100,
    allied: n(s?.alliedPlayerCount),
    axis: n(s?.axisPlayerCount),
    alliedScore: n(s?.alliedScore),
    axisScore: n(s?.axisScore),
    alliedFaction: fac(s?.alliedFaction),
    axisFaction: fac(s?.axisFaction),
    queue: n(s?.queueCount),
    maxQueue: n(s?.maxQueueCount),
    vipQueue: n(s?.vipQueueCount),
    alliedMorale: n(s?.alliedMorale),
    axisMorale: n(s?.axisMorale),
    initialMorale: n(s?.initialMorale),
  };
}

function normRotation(game: Game, r: any): { current: number; maps: any[] } {
  const rows: any[] = Array.isArray(r?.mAPS) ? r.mAPS : Array.isArray(r?.maps) ? r.maps : [];
  return {
    current: Number(r?.currentIndex) || 0,
    maps: rows.slice(0, 24).map((m: any) => {
      const id = String(m?.iD ?? m?.id ?? "")
        .split("/")
        .pop()!
        .slice(0, 60);
      return {
        id,
        name: String(m?.name || "").slice(0, 80),
        position: Number(m?.position) || 0,
        ...parseLayer(game, id),
      };
    }),
  };
}

type RosterPlayer = {
  name: string;
  clan: string | null;
  level: number;
  team: "allied" | "axis" | "none";
  roleId: number;
  role: string;
  roleType: string;
  lead: boolean;
  squad: string | null;
  squadIndex: number;
  score: { combat: number; offense: number; defense: number; support: number };
  kills: number;
  deaths: number;
  teamKills: number;
};

/** Names, roles and scores only. Player ids (EOS / Steam) never leave here —
 *  a roster board does not need them and a public page must not carry them. */
function normRoster(game: Game, r: any, session: Session | null) {
  const rows: any[] = Array.isArray(r?.players) ? r.players : [];
  const commanderId = COMMANDER_ROLE[game];
  const players: RosterPlayer[] = rows.map((p: any) => {
    const roleId = Number(p?.role);
    const role = roleOf(game, roleId);
    const sd = p?.scoreData || {};
    const st = p?.stats || {};
    return {
      name: String(p?.name || "").slice(0, 40),
      clan: p?.clanTag ? String(p.clanTag).slice(0, 12) : null,
      level: Number(p?.level) || 0,
      team: sideOf(game, Number(p?.team)),
      roleId,
      role: role.name,
      roleType: role.type,
      lead: !!role.lead,
      squad: p?.platoon ? String(p.platoon).slice(0, 24) : null,
      squadIndex: Number(p?.platoonIndex) || 0,
      score: {
        combat: Number(sd.cOMBAT ?? sd.combat) || 0,
        offense: Number(sd.offense) || 0,
        defense: Number(sd.defense) || 0,
        support: Number(sd.support) || 0,
      },
      kills: (Number(st.infantryKills) || 0) + (Number(st.vehicleKills) || 0),
      deaths: Number(st.deaths) || 0,
      teamKills: Number(st.teamKills) || 0,
    };
  });

  const total = (p: RosterPlayer) =>
    p.score.combat + p.score.offense + p.score.defense + p.score.support;
  const byLead = (a: RosterPlayer, b: RosterPlayer) =>
    Number(b.lead) - Number(a.lead) || total(b) - total(a);

  function team(side: "allied" | "axis") {
    const mine = players.filter((p) => p.team === side);
    const commander = mine.filter((p) => p.roleId === commanderId);
    const squadsMap = new Map<string, RosterPlayer[]>();
    const loose: RosterPlayer[] = [];
    for (const p of mine) {
      if (p.roleId === commanderId) continue;
      if (!p.squad) {
        loose.push(p);
        continue;
      }
      const k = `${p.squadIndex}:${p.squad}`;
      if (!squadsMap.has(k)) squadsMap.set(k, []);
      squadsMap.get(k)!.push(p);
    }
    const squads = Array.from(squadsMap.values())
      .map((ps) => {
        ps.sort(byLead);
        // A squad's type is what most of it is doing; armour, recon and
        // mortar crews are all-of-a-kind so the majority is the whole squad.
        const counts = new Map<string, number>();
        for (const p of ps) counts.set(p.roleType, (counts.get(p.roleType) || 0) + 1);
        const type = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "Infantry";
        return { name: ps[0].squad!, index: ps[0].squadIndex, type, players: ps };
      })
      .sort((a, b) => a.index - b.index || a.name.localeCompare(b.name));
    loose.sort(byLead);
    const faction = side === "allied" ? session?.alliedFaction : session?.axisFaction;
    return {
      faction: faction || null,
      count: mine.length,
      commander: commander[0] || null,
      squads,
      unassigned: loose,
    };
  }

  return {
    total: players.length,
    allied: team("allied"),
    axis: team("axis"),
    unassigned: players.filter((p) => p.team === "none").sort(byLead),
  };
}

// ---- plugin ------------------------------------------------------------------

type Linked = {
  id: string;
  lobbyId: string;
  game: Game;
  name: string;
  host: string;
  port: number;
  password: string;
  note: string;
  status: string;
  lastSeenAt: Date | null;
  /** For a WWII box Steam's list already tracks: the aggregate row's id, so
   *  the rhythm reads weeks of existing history instead of starting over. */
  aggregateId: string | null;
};

function splitHost(stored: string): { host: string; port: number } {
  const m = /^(.*):(\d+)$/.exec(stored || "");
  return m ? { host: m[1], port: Number(m[2]) } : { host: stored, port: 0 };
}

export default async function hllvRoutes(app: FastifyInstance, opts: Opts = {}) {
  const authFromHeader = opts.authFromHeader;

  const cache = new Map<string, { data: any; expiresAt: number }>();
  const cacheGet = (k: string) => {
    const c = cache.get(k);
    return c && c.expiresAt > Date.now() ? c.data : null;
  };
  const cacheSet = (k: string, data: any, ttl: number) =>
    cache.set(k, { data, expiresAt: Date.now() + ttl });
  const cacheDrop = (prefix: string) => {
    for (const k of Array.from(cache.keys())) if (k.startsWith(prefix)) cache.delete(k);
  };

  async function jget(url: string, timeoutMs = 8000): Promise<any | null> {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "Weered/1.0 (https://weered.ca)" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      swallow(e);
      return null;
    }
  }

  async function canManage(userId: string, lobbyId: string): Promise<boolean> {
    try {
      if (await isStaffUser(userId)) return true;
      const lobby = await prisma.lobby.findUnique({
        where: { id: lobbyId },
        select: { ownerId: true },
      });
      if (lobby?.ownerId === userId) return true;
      const m = await prisma.lobbyMember.findUnique({
        where: { lobbyId_userId: { lobbyId, userId } },
        select: { roleLevel: true },
      });
      return (m?.roleLevel || 0) >= 3;
    } catch (e) {
      swallow(e);
      return false;
    }
  }

  function toLinked(row: any): Linked {
    const { host, port } = splitHost(String(row.host || ""));
    return {
      id: row.id,
      lobbyId: row.lobbyId,
      game: GAME_OF_FRAMEWORK[String(row.framework)] || "hllv",
      name: row.name,
      host,
      port,
      password: String(row.apiKey || ""),
      note: row.description || "",
      status: row.status,
      lastSeenAt: row.lastSeenAt,
      aggregateId: row.bmServerId ? String(row.bmServerId) : null,
    };
  }

  async function loadLinked(lobbyId?: string, game?: Game): Promise<Linked[]> {
    try {
      const rows = await prisma.communityServer.findMany({
        where: {
          framework: game ? FRAMEWORKS[game] : { in: Object.values(FRAMEWORKS) },
          ...(lobbyId ? { lobbyId } : {}),
        },
        orderBy: { createdAt: "asc" },
        take: lobbyId ? MAX_LINKED * 2 : 400,
      });
      return rows.map(toLinked);
    } catch (e) {
      swallow(e);
      return [];
    }
  }

  /** Session + rotation for one linked box, cached briefly. `null` session
   *  means unreachable this time; the caller shows the last known state. */
  async function liveOf(
    l: Linked,
  ): Promise<{ session: Session | null; rotation: any; error: string | null }> {
    const key = `live:${l.id}`;
    const hit = cacheGet(key);
    if (hit) return hit;
    let out: { session: Session | null; rotation: any; error: string | null };
    try {
      out = await rconRead(
        l.host,
        l.port,
        l.password,
        async (c) => {
          const session = normSession(l.game, await c.info("session"));
          let rotation: any = null;
          try {
            rotation = normRotation(l.game, await c.info("maprotation"));
          } catch (e) {
            swallow(e);
          }
          return { session, rotation, error: null };
        },
        RCON_TIMEOUT,
      );
      prisma.communityServer
        .update({
          where: { id: l.id },
          data: { lastSeenAt: new Date(), status: "connected", lastState: out.session as any },
        })
        .catch(swallow);
    } catch (e: any) {
      const code = e instanceof HllvRconError ? e.code : "error";
      out = { session: null, rotation: null, error: code };
      prisma.communityServer
        .update({ where: { id: l.id }, data: { status: "unreachable" } })
        .catch(swallow);
    }
    cacheSet(key, out, SESSION_TTL);
    return out;
  }

  // ---- the rhythm feed --------------------------------------------------------
  // Same tables the WWII worker fills from Steam's list. A Vietnam box (or a
  // WWII box Steam does not list) is sampled here under `<game>:<id>`; a WWII
  // box Steam already tracks is matched by name to its existing row and left
  // to the worker, which has been sampling it for weeks.

  const ownRhythmId = (l: Linked) => `${l.game}:${l.id}`;
  const rhythmIdOf = (l: Linked) => l.aggregateId || ownRhythmId(l);

  async function matchAggregate(l: Linked, s: Session): Promise<string | null> {
    if (l.game !== "hll" || !s.serverName) return null;
    try {
      const row = await prisma.gameServer.findFirst({
        where: { appId: STEAM_APP_ID.hll, name: s.serverName, NOT: { id: { startsWith: "hll:" } } },
        orderBy: { lastSeenAt: "desc" },
        select: { id: true },
      });
      if (!row) return null;
      await prisma.communityServer.update({ where: { id: l.id }, data: { bmServerId: row.id } });
      l.aggregateId = row.id;
      return row.id;
    } catch (e) {
      swallow(e);
      return null;
    }
  }

  async function recordSample(l: Linked, s: Session | null) {
    if (l.aggregateId) return; // Steam's list is sampling it already
    const id = ownRhythmId(l);
    try {
      if (s) {
        const data = {
          appId: STEAM_APP_ID[l.game],
          name: (s.serverName || l.name).slice(0, 200),
          addr: "",
          map: s.mapId || null,
          maxPlayers: s.maxPlayers,
          players: s.players,
          online: true,
          lastSeenAt: new Date(),
        };
        await prisma.gameServer.upsert({ where: { id }, create: { id, ...data }, update: data });
        await prisma.gameServerSample.create({
          data: { serverId: id, players: s.players, map: s.mapId || null },
        });
      } else {
        // Unreachable is not "zero players"; it is no reading. Mark offline,
        // write nothing, and the rhythm stays honest.
        await prisma.gameServer.updateMany({ where: { id }, data: { online: false, players: 0 } });
      }
    } catch (e) {
      swallow(e);
    }
  }

  let polling = false;
  async function pollAll() {
    if (polling) return;
    polling = true;
    try {
      const all = await loadLinked();
      for (const l of all) {
        cacheDrop(`live:${l.id}`);
        const live = await liveOf(l);
        // A WWII box that was offline (or renamed) at link time gets another
        // chance to find its Steam row every poll.
        if (live.session && !l.aggregateId) await matchAggregate(l, live.session);
        await recordSample(l, live.session);
      }
      if (all.length) log.info(`[hllv] polled ${all.length} linked server(s)`);
    } catch (e) {
      swallow(e);
    } finally {
      polling = false;
    }
  }
  setTimeout(() => void pollAll(), 120_000);
  setInterval(() => void pollAll(), POLL_MS);

  // ---- routes -------------------------------------------------------------

  function gameParam(q: any): Game | undefined {
    const g = String(q?.game || "");
    return g === "hll" || g === "hllv" ? g : undefined;
  }

  // Steam still knows two things about Vietnam: how many are playing and
  // what the studio said last. Both come straight off the game's own appid.
  app.get("/hllv/intel", { schema: { tags: ["hllv"] } }, async (req, reply) => {
    const game = gameParam((req as any).query) || "hllv";
    const appId = STEAM_APP_ID[game];
    const key = `intel:${game}`;
    const hit = cacheGet(key);
    if (hit) return reply.send(hit);
    const [playersJ, newsJ] = await Promise.all([
      jget(
        `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appId}`,
      ),
      jget(
        `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${appId}&count=8&maxlength=400&format=json`,
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
            .replace(/\[[^\]]*\]/g, " ")
            .replace(/https?:\/\/\S+/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 220),
        }))
      : [];
    const out = { ok: true, game, playingNow, news };
    if (playingNow != null || news.length) cacheSet(key, out, 10 * 60_000);
    return reply.send(out);
  });

  app.get(
    "/hllv/:lobbyId/servers",
    { schema: { tags: ["hllv"] }, config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const lobbyId = String((req as any).params?.lobbyId || "").slice(0, 64);
      const game = gameParam((req as any).query);
      const u = authFromHeader?.((req as any).headers?.authorization);
      const manage = u ? await canManage(u.id, lobbyId) : false;
      const linked = await loadLinked(lobbyId, game);
      const servers = await Promise.all(
        linked.map(async (l) => {
          const live = await liveOf(l);
          if (live.session && !l.aggregateId) await matchAggregate(l, live.session);
          return {
            id: l.id,
            game: l.game,
            name: l.name,
            note: l.note,
            status: live.session ? "connected" : l.status,
            error: live.error,
            lastSeenAt: l.lastSeenAt,
            live: live.session,
            rotation: live.rotation,
            rhythmId: rhythmIdOf(l),
            aggregate: !!l.aggregateId,
          };
        }),
      );
      return reply.send({
        ok: true,
        canManage: manage,
        max: MAX_LINKED,
        servers,
        fetchedAt: Date.now(),
      });
    },
  );

  app.get(
    "/hllv/:lobbyId/servers/:id/roster",
    { schema: { tags: ["hllv"] }, config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const lobbyId = String((req as any).params?.lobbyId || "").slice(0, 64);
      const id = String((req as any).params?.id || "").slice(0, 64);
      const l = (await loadLinked(lobbyId)).find((x) => x.id === id);
      if (!l) return reply.code(404).send({ ok: false, error: "not_found" });
      const key = `roster:${l.id}`;
      const hit = cacheGet(key);
      if (hit) return reply.send(hit);
      try {
        const out = await rconRead(
          l.host,
          l.port,
          l.password,
          async (c) => {
            const [sessionRaw, players] = await Promise.all([c.info("session"), c.info("players")]);
            const session = normSession(l.game, sessionRaw);
            return {
              ok: true,
              game: l.game,
              session,
              roster: normRoster(l.game, players, session),
              fetchedAt: Date.now(),
            };
          },
          RCON_TIMEOUT,
        );
        cacheSet(key, out, ROSTER_TTL);
        return reply.send(out);
      } catch (e: any) {
        const code = e instanceof HllvRconError ? e.code : "error";
        return reply.send({ ok: false, error: code });
      }
    },
  );

  app.post(
    "/hllv/:lobbyId/server/link",
    { schema: { tags: ["hllv"] }, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const lobbyId = String((req as any).params?.lobbyId || "").slice(0, 64);
      const u = authFromHeader?.((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      if (!(await canManage(u.id, lobbyId)))
        return reply.code(403).send({ ok: false, error: "mods_only" });

      const body: any = (req as any).body || {};
      const game: Game = body.game === "hll" ? "hll" : "hllv";
      const name = String(body.name || "")
        .trim()
        .slice(0, 80);
      const host = String(body.host || "")
        .trim()
        .toLowerCase()
        .slice(0, 253);
      const port = Number(body.port);
      const password = String(body.password || "").slice(0, 200);
      const note = String(body.note || "")
        .trim()
        .slice(0, 140);
      if (!name || !host || !port || !password)
        return reply.code(400).send({ ok: false, error: "missing_fields" });

      // The probe IS the validation: if the box answers session and config
      // with this password, it is a Hell Let Loose server and the link is real.
      let probe: { session: Session; config: any };
      try {
        probe = await rconRead(
          host,
          port,
          password,
          async (c) => {
            const [session, config] = await Promise.all([
              c.info("session"),
              c.info("serverconfig"),
            ]);
            return { session: normSession(game, session), config };
          },
          RCON_TIMEOUT,
        );
      } catch (e: any) {
        const code = e instanceof HllvRconError ? e.code : "error";
        return reply.code(422).send({ ok: false, error: code });
      }

      const platforms: string[] = Array.isArray(probe.config?.supportedPlatforms)
        ? probe.config.supportedPlatforms.map((p: any) => String(p).slice(0, 40)).slice(0, 8)
        : [];
      const build = Number(probe.config?.buildNumber) || null;

      const all = await loadLinked(lobbyId, game);
      const existing = all.find((l) => l.host === host && l.port === port);
      if (!existing && all.length >= MAX_LINKED)
        return reply.code(409).send({ ok: false, error: "full" });

      const data: any = {
        lobbyId,
        ownerId: u.id,
        name,
        host: `${host}:${port}`,
        queryUrl: null,
        description: note,
        framework: FRAMEWORKS[game],
        status: "connected",
        lastSeenAt: new Date(),
        lastState: { session: probe.session, platforms, build },
        apiKey: password,
        bmServerId: existing?.aggregateId ?? null,
      };
      const row = existing
        ? await prisma.communityServer.update({ where: { id: existing.id }, data })
        : await prisma.communityServer.create({ data });
      cacheDrop(`live:${row.id}`);
      cacheDrop(`roster:${row.id}`);
      const linked = toLinked(row);
      // A WWII box Steam already lists inherits its history on the spot;
      // otherwise take a first reading now, so the rhythm route answers
      // "still building" rather than 404 the moment the card renders.
      const matched = await matchAggregate(linked, probe.session);
      if (!matched) await recordSample(linked, probe.session);

      return reply.send({
        ok: true,
        id: row.id,
        game,
        live: probe.session,
        platforms,
        build,
        rhythmId: rhythmIdOf(linked),
        aggregate: !!matched,
      });
    },
  );

  app.post(
    "/hllv/:lobbyId/servers/:id/unlink",
    { schema: { tags: ["hllv"] }, config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const lobbyId = String((req as any).params?.lobbyId || "").slice(0, 64);
      const id = String((req as any).params?.id || "").slice(0, 64);
      const u = authFromHeader?.((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      if (!(await canManage(u.id, lobbyId)))
        return reply.code(403).send({ ok: false, error: "mods_only" });
      await prisma.communityServer
        .deleteMany({ where: { id, lobbyId, framework: { in: Object.values(FRAMEWORKS) } } })
        .catch(swallow);
      // The history stays. A unit that re-links the same box next month
      // should not start its pattern from zero.
      cacheDrop(`live:${id}`);
      cacheDrop(`roster:${id}`);
      return reply.send({ ok: true });
    },
  );
}
