import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";

type Opts = {
  authFromHeader: (h?: string) => { id: string; name?: string } | null;
  createNotification?: (opts: {
    userId: string; type: string; title: string;
    body?: string; actionUrl?: string;
    actorId?: string; actorName?: string; meta?: any;
  }) => Promise<any>;
};

const STEAM_API_KEY = process.env.STEAM_API_KEY || "";

const playersCache = new Map<string, { count: number; ts: number }>();
const PLAYERS_TTL_MS = 60_000;

type OwnedRow = { owned: boolean; hoursPlayed: number; lastPlayed: number | null; ts: number };
const ownedCache = new Map<string, OwnedRow>();
const OWNED_TTL_MS = 60 * 60 * 1000;

const schemaCache = new Map<string, { schema: any; ts: number }>();
const SCHEMA_TTL_MS = 24 * 60 * 60 * 1000;

type AchievementsRow = { achievements: any[]; gameName: string | null; total: number; unlocked: number; ts: number };
const achievementsCache = new Map<string, AchievementsRow>();
const ACHIEVEMENTS_TTL_MS = 30 * 60 * 1000;

const prisma = new PrismaClient();

function isValidAppId(s: string): boolean {
  return /^\d{1,8}$/.test(s);
}

export default async function steamRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, createNotification } = opts;
  const inviteWindow = new Map<string, number[]>();
  const INVITE_LIMIT = 3;
  const INVITE_WINDOW_MS = 60_000;

  app.get("/steam/players/:appId", async (req, reply) => {
    const appId = String((req as any).params?.appId || "");
    if (!isValidAppId(appId)) return reply.code(400).send({ ok: false, error: "bad_appid" });

    const cached = playersCache.get(appId);
    const now = Date.now();
    if (cached && now - cached.ts < PLAYERS_TTL_MS) {
      reply.header("Cache-Control", "public, max-age=30");
      return reply.send({ ok: true, count: cached.count, ts: cached.ts, cached: true });
    }

    try {
      const url = `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appId}`;
      const r = await fetchWithTimeout(url);
      if (!r.ok) throw new Error(String(r.status));
      const j: any = await r.json();
      const count = Number(j?.response?.player_count ?? 0);
      playersCache.set(appId, { count, ts: now });
      reply.header("Cache-Control", "public, max-age=30");
      return reply.send({ ok: true, count, ts: now });
    } catch (e) {
      if (cached) {
        return reply.send({ ok: true, count: cached.count, ts: cached.ts, stale: true });
      }
      return reply.code(502).send({ ok: false, error: "steam_unavailable" });
    }
  });

  app.get("/steam/owned/:appId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const appId = String((req as any).params?.appId || "");
    if (!isValidAppId(appId)) return reply.code(400).send({ ok: false, error: "bad_appid" });
    if (!STEAM_API_KEY) return reply.send({ ok: true, linked: false, owned: false, hoursPlayed: 0, lastPlayed: null });

    const dbUser = await prisma.user.findUnique({
      where: { id: u.id },
      select: { steamId: true } as any,
    });
    const steamId = (dbUser as any)?.steamId || "";
    if (!steamId) return reply.send({ ok: true, linked: false, owned: false, hoursPlayed: 0, lastPlayed: null });

    const key = `${u.id}:${appId}`;
    const cached = ownedCache.get(key);
    const now = Date.now();
    if (cached && now - cached.ts < OWNED_TTL_MS) {
      return reply.send({ ok: true, linked: true, owned: cached.owned, hoursPlayed: cached.hoursPlayed, lastPlayed: cached.lastPlayed, cached: true });
    }

    try {
      const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${STEAM_API_KEY}&steamid=${steamId}&include_played_free_games=1&appids_filter[0]=${appId}&format=json`;
      const r = await fetchWithTimeout(url);
      if (!r.ok) throw new Error(String(r.status));
      const j: any = await r.json();
      const games: any[] = j?.response?.games || [];
      const match = games.find(g => String(g.appid) === appId);
      const owned = !!match;
      const minutes = Number(match?.playtime_forever || 0);
      const hoursPlayed = Math.round(minutes / 60);
      const lastPlayed = match?.rtime_last_played ? Number(match.rtime_last_played) * 1000 : null;
      const row: OwnedRow = { owned, hoursPlayed, lastPlayed, ts: now };
      ownedCache.set(key, row);
      return reply.send({ ok: true, linked: true, owned, hoursPlayed, lastPlayed });
    } catch (e) {
      if (cached) {
        return reply.send({ ok: true, linked: true, owned: cached.owned, hoursPlayed: cached.hoursPlayed, lastPlayed: cached.lastPlayed, stale: true });
      }
      return reply.send({ ok: true, linked: true, owned: false, hoursPlayed: 0, lastPlayed: null, error: "steam_unavailable" });
    }
  });

  app.get("/steam/achievements/:appId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const appId = String((req as any).params?.appId || "");
    if (!isValidAppId(appId)) return reply.code(400).send({ ok: false, error: "bad_appid" });
    if (!STEAM_API_KEY) return reply.send({ ok: true, linked: false, achievements: [] });

    const targetUserId = String(((req as any).query?.userId || u.id));
    const dbUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { steamId: true } as any,
    });
    const steamId = (dbUser as any)?.steamId || "";
    if (!steamId) return reply.send({ ok: true, linked: false, achievements: [] });

    const key = `${targetUserId}:${appId}`;
    const cached = achievementsCache.get(key);
    const now = Date.now();
    if (cached && now - cached.ts < ACHIEVEMENTS_TTL_MS) {
      return reply.send({
        ok: true, linked: true, gameName: cached.gameName,
        total: cached.total, unlocked: cached.unlocked,
        achievements: cached.achievements, cached: true,
      });
    }

    try {
      const schemaKey = `${appId}:en`;
      const cs = schemaCache.get(schemaKey);
      let schema: any = cs && now - cs.ts < SCHEMA_TTL_MS ? cs.schema : null;
      if (!schema) {
        const sUrl = `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${STEAM_API_KEY}&appid=${appId}&l=english`;
        const sr = await fetchWithTimeout(sUrl);
        if (sr.ok) {
          schema = await sr.json();
          schemaCache.set(schemaKey, { schema, ts: now });
        }
      }
      const schemaList: any[] = schema?.game?.availableGameStats?.achievements || [];
      const schemaByName = new Map(schemaList.map((s: any) => [String(s.name), s]));

      const aUrl = `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?key=${STEAM_API_KEY}&steamid=${steamId}&appid=${appId}&l=english`;
      const ar = await fetchWithTimeout(aUrl);
      if (!ar.ok) throw new Error(String(ar.status));
      const aj: any = await ar.json();
      const playerStats = aj?.playerstats;
      if (!playerStats?.success) {
        const row: AchievementsRow = { achievements: [], gameName: null, total: 0, unlocked: 0, ts: now };
        achievementsCache.set(key, row);
        return reply.send({ ok: true, linked: true, gameName: null, total: 0, unlocked: 0, achievements: [], reason: playerStats?.error || "no_data" });
      }
      const list: any[] = playerStats.achievements || [];
      const merged = list.map(a => {
        const meta = schemaByName.get(String(a.apiname || a.name));
        return {
          name: String(a.apiname || a.name),
          displayName: meta?.displayName || a.apiname || a.name,
          description: meta?.description || a.description || "",
          icon: a.achieved ? meta?.icon : meta?.icongray,
          achieved: !!a.achieved,
          unlockTime: Number(a.unlocktime || 0) * 1000 || null,
          hidden: !!meta?.hidden,
        };
      });
      const total = merged.length;
      const unlocked = merged.filter(a => a.achieved).length;
      const row: AchievementsRow = {
        achievements: merged,
        gameName: playerStats.gameName || null,
        total, unlocked, ts: now,
      };
      achievementsCache.set(key, row);
      return reply.send({ ok: true, linked: true, gameName: row.gameName, total, unlocked, achievements: merged });
    } catch (e: any) {
      if (cached) {
        return reply.send({
          ok: true, linked: true, gameName: cached.gameName,
          total: cached.total, unlocked: cached.unlocked,
          achievements: cached.achievements, stale: true,
        });
      }
      return reply.send({ ok: true, linked: true, gameName: null, total: 0, unlocked: 0, achievements: [], error: "steam_unavailable" });
    }
  });

  type PlayingRow = { items: any[]; ts: number };
  const playingCache = new Map<string, PlayingRow>();
  const PLAYING_TTL_MS = 30_000;

  app.get("/steam/playing/:appId", async (req, reply) => {
    const appId = String((req as any).params?.appId || "");
    if (!isValidAppId(appId)) return reply.code(400).send({ ok: false, error: "bad_appid" });
    const cached = playingCache.get(appId);
    const now = Date.now();
    if (cached && now - cached.ts < PLAYING_TTL_MS) {
      return reply.send({ ok: true, items: cached.items, cached: true });
    }
    try {
      const candidates = await prisma.user.findMany({
        where: { steamId: { not: null } } as any,
        select: { id: true, name: true, avatar: true, avatarColor: true, livePresence: true } as any,
      });
      const items = candidates
        .filter((u: any) => {
          const lp = u.livePresence;
          if (!lp || typeof lp !== "object") return false;
          return String(lp.appId || "") === appId;
        })
        .map((u: any) => ({
          id: u.id,
          name: u.name,
          avatar: u.avatar,
          avatarColor: u.avatarColor,
          gameName: u.livePresence?.gameName || u.livePresence?.activity?.replace(/^Playing /, "") || null,
          detail: u.livePresence?.detail || null,
          since: u.livePresence?.updatedAt || null,
        }));
      playingCache.set(appId, { items, ts: now });
      return reply.send({ ok: true, items });
    } catch (e) {
      if (cached) return reply.send({ ok: true, items: cached.items, stale: true });
      return reply.code(500).send({ ok: false, error: "playing_lookup_failed" });
    }
  });

  app.post("/steam/squad-invite", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if (!createNotification) return reply.code(500).send({ ok: false, error: "notifications_unavailable" });

    const body: any = (req as any).body || {};
    const targetUserId = String(body.targetUserId || "").trim();
    const lobbyId = String(body.lobbyId || "").trim();
    const appId = String(body.appId || "").trim();
    const note = String(body.message || "").slice(0, 120);
    if (!targetUserId || !lobbyId) return reply.code(400).send({ ok: false, error: "missing_fields" });
    if (targetUserId === u.id) return reply.code(400).send({ ok: false, error: "self_invite" });
    if (appId && !isValidAppId(appId)) return reply.code(400).send({ ok: false, error: "bad_appid" });

    const now = Date.now();
    const window = (inviteWindow.get(u.id) || []).filter(t => now - t < INVITE_WINDOW_MS);
    if (window.length >= INVITE_LIMIT) {
      const oldest = window[0];
      return reply.code(429).send({
        ok: false, error: "rate_limited",
        retryAfterMs: INVITE_WINDOW_MS - (now - oldest),
      });
    }
    window.push(now);
    inviteWindow.set(u.id, window);

    const [target, lobby] = await Promise.all([
      prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, livePresence: true } as any }),
      prisma.lobby.findUnique({ where: { id: lobbyId }, select: { id: true, name: true, moduleConfig: true } }),
    ]);
    if (!target) return reply.code(404).send({ ok: false, error: "target_not_found" });
    if (!lobby) return reply.code(404).send({ ok: false, error: "lobby_not_found" });

    const lp: any = (target as any).livePresence;
    const targetAppId = lp?.appId ? String(lp.appId) : "";
    const expectedAppId = appId || (lobby.moduleConfig as any)?.steamAppId || "";
    const inGame = !!expectedAppId && targetAppId === expectedAppId;

    const lobbyName = lobby.name || lobbyId;
    const inviterName = u.name || "A Helldiver";

    await createNotification({
      userId: targetUserId,
      type: "LOBBY_EVENT",
      title: `${inviterName} wants to squad up in ${lobbyName}`,
      body: note || `Drop into the Weered ${lobbyName} lobby to coordinate.`,
      actionUrl: `/lobby/${encodeURIComponent(lobbyId)}`,
      actorId: u.id,
      actorName: u.name,
      meta: { kind: "squad_invite", lobbyId, appId: expectedAppId, inGame },
    });

    return reply.send({ ok: true, sent: true, inGame });
  });
}
