import type { FastifyInstance } from "fastify";
import { log, swallow } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { isStaffUser } from "../lib/isStaffUser";
import { rconRead, HllvRconError } from "../lib/hllvRcon";

// Hell Let Loose: Vietnam.
//
// Vietnam is cross-platform and lives behind Team17's own backend, so unlike
// base HLL there is no public master list to build a browser from. What every
// Vietnam server DOES have is an RCON port, and the protocol is open. So the
// Vietnam data plane is bottom-up: a unit links its own server (or the public
// server it plays on, with the owner's RCON details) and gets, for that box:
//
//   live match     map, mode, US v NVA count, score, clock, queue
//   live roster    who is on, by team and squad, with role and score
//   rhythm         what the box normally does at this hour — polled into the
//                  same GameServer aggregate the WWII lobby reads, so the
//                  history component works unchanged
//
// Plus the two things Steam still gives Vietnam: global player count and the
// game's own news feed.
//
// The RCON password is stored in CommunityServer.apiKey, which no route has
// ever serialised. host:port lives in `host`. Both stay on the server.

type Opts = {
  authFromHeader?: (h?: string) => { id: string; name?: string } | null;
};

export const HLLV_APP_ID = 3079210;
const FRAMEWORK = "hllv-rcon";
const MAX_LINKED = 6;
const SESSION_TTL = 45_000;
const ROSTER_TTL = 20_000;
const POLL_MS = 10 * 60_000;
const RCON_TIMEOUT = 8000;

// ---- game vocabulary ---------------------------------------------------------

/** Layer ids are `<mapcode>_<mode>_<time>`; the codes are the dev's own. */
const MAPS: Record<string, { name: string; year: number }> = {
  wdeva: { name: "Vạn Tường", year: 1965 },
  wdevb: { name: "Quảng Ngãi", year: 1965 },
  wdevc: { name: "Huế Outskirts", year: 1968 },
  wdevd: { name: "Đăk Tô Airfield", year: 1967 },
  wdeve: { name: "Cam Ranh Port", year: 1969 },
  wdevf: { name: "Thanh Hòa Bridge", year: 1965 },
};

const MODES: Record<string, { mode: string; attacker: string | null }> = {
  warfare: { mode: "Warfare", attacker: null },
  offensivenva: { mode: "Offensive", attacker: "NVA" },
  offensiveus: { mode: "Offensive", attacker: "US" },
  domination: { mode: "Domination", attacker: null },
  conquest: { mode: "Conquest", attacker: null },
};

export function parseLayer(id: string): {
  map: string | null;
  mode: string | null;
  attacker: string | null;
  timeOfDay: string | null;
} {
  const m = /^([a-z]+)_([a-z]+)_([a-z]+)$/i.exec(
    String(id || "")
      .trim()
      .toLowerCase(),
  );
  if (!m) return { map: null, mode: null, attacker: null, timeOfDay: null };
  const map = MAPS[m[1]]?.name ?? null;
  const mode = MODES[m[2]];
  const t = m[3];
  return {
    map,
    mode: mode?.mode ?? null,
    attacker: mode?.attacker ?? null,
    timeOfDay: t ? t.charAt(0).toUpperCase() + t.slice(1) : null,
  };
}

/** Role ids as the server reports them (GetServerInformation players.role). */
const ROLES: Record<number, { name: string; type: string; lead?: boolean }> = {
  0: { name: "Rifleman", type: "Infantry" },
  3: { name: "Medic", type: "Infantry" },
  4: { name: "Spotter", type: "Recon", lead: true },
  5: { name: "Specialist", type: "Infantry" },
  6: { name: "Machine Gunner", type: "Infantry" },
  7: { name: "Grenadier", type: "Infantry" },
  8: { name: "Engineer", type: "Infantry" },
  9: { name: "Squad Leader", type: "Infantry", lead: true },
  10: { name: "Sniper", type: "Recon" },
  11: { name: "Crewman", type: "Armor" },
  12: { name: "Tank Commander", type: "Armor", lead: true },
  13: { name: "Support", type: "Mortar" },
  14: { name: "Observer", type: "Mortar", lead: true },
  15: { name: "Gunner", type: "Mortar" },
  16: { name: "Pilot", type: "Helicopter", lead: true },
  17: { name: "Logistics Officer", type: "Helicopter" },
  20: { name: "Commander", type: "Command", lead: true },
};

function teamOf(id: number): "us" | "nva" | "none" {
  if (id === 1) return "us";
  if (id === 6) return "nva";
  return "none";
}

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
  us: number;
  nva: number;
  usScore: number;
  nvaScore: number;
  queue: number;
  maxQueue: number;
  vipQueue: number;
  usMorale: number;
  nvaMorale: number;
  initialMorale: number;
};

function normSession(s: any): Session {
  const mapId = String(s?.mapId || "").slice(0, 60);
  const layer = parseLayer(mapId);
  const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return {
    serverName: String(s?.serverName || "").slice(0, 120),
    mapId,
    mapName: String(s?.mapName || "").slice(0, 80),
    ...layer,
    remaining: n(s?.remainingMatchTime),
    matchTime: n(s?.matchTime),
    players: n(s?.playerCount),
    maxPlayers: n(s?.maxPlayerCount) || 100,
    us: n(s?.alliedPlayerCount),
    nva: n(s?.axisPlayerCount),
    usScore: n(s?.alliedScore),
    nvaScore: n(s?.axisScore),
    queue: n(s?.queueCount),
    maxQueue: n(s?.maxQueueCount),
    vipQueue: n(s?.vipQueueCount),
    usMorale: n(s?.alliedMorale),
    nvaMorale: n(s?.axisMorale),
    initialMorale: n(s?.initialMorale),
  };
}

function normRotation(r: any): { current: number; maps: any[] } {
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
        ...parseLayer(id),
      };
    }),
  };
}

type RosterPlayer = {
  name: string;
  clan: string | null;
  level: number;
  team: "us" | "nva" | "none";
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
function normRoster(r: any) {
  const rows: any[] = Array.isArray(r?.players) ? r.players : [];
  const players: RosterPlayer[] = rows.map((p: any) => {
    const roleId = Number(p?.role);
    const role = ROLES[roleId] || { name: "Unassigned", type: "None" };
    const sd = p?.scoreData || {};
    const st = p?.stats || {};
    return {
      name: String(p?.name || "").slice(0, 40),
      clan: p?.clanTag ? String(p.clanTag).slice(0, 12) : null,
      level: Number(p?.level) || 0,
      team: teamOf(Number(p?.team)),
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

  const byLead = (a: RosterPlayer, b: RosterPlayer) =>
    Number(b.lead) - Number(a.lead) ||
    b.score.combat +
      b.score.offense +
      b.score.defense +
      b.score.support -
      (a.score.combat + a.score.offense + a.score.defense + a.score.support);

  function team(t: "us" | "nva") {
    const mine = players.filter((p) => p.team === t);
    const commander = mine.filter((p) => p.roleId === 20);
    const squadsMap = new Map<string, RosterPlayer[]>();
    const loose: RosterPlayer[] = [];
    for (const p of mine) {
      if (p.roleId === 20) continue;
      if (!p.squad) {
        loose.push(p);
        continue;
      }
      const k = `${p.squadIndex}:${p.squad}`;
      if (!squadsMap.has(k)) squadsMap.set(k, []);
      squadsMap.get(k)!.push(p);
    }
    const squads = Array.from(squadsMap.entries())
      .map(([, ps]) => {
        ps.sort(byLead);
        // A squad's type is what most of it is doing; armour and mortar and
        // air crews are all-of-a-kind so the majority is the whole squad.
        const counts = new Map<string, number>();
        for (const p of ps) counts.set(p.roleType, (counts.get(p.roleType) || 0) + 1);
        const type = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "Infantry";
        return { name: ps[0].squad!, index: ps[0].squadIndex, type, players: ps };
      })
      .sort((a, b) => a.index - b.index || a.name.localeCompare(b.name));
    loose.sort(byLead);
    return { count: mine.length, commander: commander[0] || null, squads, unassigned: loose };
  }

  return {
    total: players.length,
    us: team("us"),
    nva: team("nva"),
    unassigned: players.filter((p) => p.team === "none").sort(byLead),
  };
}

// ---- plugin ------------------------------------------------------------------

type Linked = {
  id: string;
  lobbyId: string;
  name: string;
  host: string;
  port: number;
  password: string;
  note: string;
  status: string;
  lastSeenAt: Date | null;
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
      name: row.name,
      host,
      port,
      password: String(row.apiKey || ""),
      note: row.description || "",
      status: row.status,
      lastSeenAt: row.lastSeenAt,
    };
  }

  async function loadLinked(lobbyId?: string): Promise<Linked[]> {
    try {
      const rows = await prisma.communityServer.findMany({
        where: { framework: FRAMEWORK, ...(lobbyId ? { lobbyId } : {}) },
        orderBy: { createdAt: "asc" },
        take: lobbyId ? MAX_LINKED : 200,
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
          const session = normSession(await c.info("session"));
          let rotation: any = null;
          try {
            rotation = normRotation(await c.info("maprotation"));
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
  // Same tables the WWII worker fills from Steam's list, filled here from the
  // unit's own box. /gs/servers/hllv:<id>/rhythm then answers "what does our
  // server normally do on a Thursday at 20:00" with no Vietnam-specific code.

  const rhythmId = (id: string) => `hllv:${id}`;

  async function recordSample(l: Linked, s: Session | null) {
    const id = rhythmId(l.id);
    try {
      if (s) {
        const data = {
          appId: HLLV_APP_ID,
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

  // Steam still knows two things about Vietnam: how many are playing and
  // what the studio said last. Both come straight off the game's own appid.
  app.get("/hllv/intel", { schema: { tags: ["hllv"] } }, async (_req, reply) => {
    const hit = cacheGet("intel");
    if (hit) return reply.send(hit);
    const [playersJ, newsJ] = await Promise.all([
      jget(
        `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${HLLV_APP_ID}`,
      ),
      jget(
        `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${HLLV_APP_ID}&count=8&maxlength=400&format=json`,
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
    const out = { ok: true, playingNow, news };
    if (playingNow != null || news.length) cacheSet("intel", out, 10 * 60_000);
    return reply.send(out);
  });

  app.get(
    "/hllv/:lobbyId/servers",
    { schema: { tags: ["hllv"] }, config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const lobbyId = String((req as any).params?.lobbyId || "").slice(0, 64);
      const u = authFromHeader?.((req as any).headers?.authorization);
      const manage = u ? await canManage(u.id, lobbyId) : false;
      const linked = await loadLinked(lobbyId);
      const servers = await Promise.all(
        linked.map(async (l) => {
          const live = await liveOf(l);
          return {
            id: l.id,
            name: l.name,
            note: l.note,
            status: live.session ? "connected" : l.status,
            error: live.error,
            lastSeenAt: l.lastSeenAt,
            live: live.session,
            rotation: live.rotation,
            rhythmId: rhythmId(l.id),
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
            const [session, players] = await Promise.all([c.info("session"), c.info("players")]);
            return {
              ok: true,
              session: normSession(session),
              roster: normRoster(players),
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
      // with this password, it is a Vietnam (or HLL) server and the link is real.
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
            return { session: normSession(session), config };
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

      const all = await loadLinked(lobbyId);
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
        framework: FRAMEWORK,
        status: "connected",
        lastSeenAt: new Date(),
        lastState: { session: probe.session, platforms, build },
        apiKey: password,
        bmServerId: null,
      };
      const row = existing
        ? await prisma.communityServer.update({ where: { id: existing.id }, data })
        : await prisma.communityServer.create({ data });
      cacheDrop(`live:${row.id}`);
      cacheDrop(`roster:${row.id}`);
      // First reading now, so the rhythm route answers "still building"
      // rather than 404 the moment the card renders.
      await recordSample(toLinked(row), probe.session);

      return reply.send({
        ok: true,
        id: row.id,
        live: probe.session,
        platforms,
        build,
        rhythmId: rhythmId(row.id),
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
        .deleteMany({ where: { id, lobbyId, framework: FRAMEWORK } })
        .catch(swallow);
      // The history stays. A unit that re-links the same box next month
      // should not start its pattern from zero.
      cacheDrop(`live:${id}`);
      cacheDrop(`roster:${id}`);
      return reply.send({ ok: true });
    },
  );
}
