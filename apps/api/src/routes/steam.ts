import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";

type Opts = {
  authFromHeader: (h?: string) => { id: string; name?: string } | null;
};

const STEAM_API_KEY = process.env.STEAM_API_KEY || "";

// ── Caches ────────────────────────────────────────────────────────────────
// Player count cache: per-app, 60s TTL.
const playersCache = new Map<string, { count: number; ts: number }>();
const PLAYERS_TTL_MS = 60_000;

// Owned cache: per (userId, appId), 1h TTL.
type OwnedRow = { owned: boolean; hoursPlayed: number; lastPlayed: number | null; ts: number };
const ownedCache = new Map<string, OwnedRow>();
const OWNED_TTL_MS = 60 * 60 * 1000;

// Achievement schema cache: per app, 24h (the schema is static).
const schemaCache = new Map<string, { schema: any; ts: number }>();
const SCHEMA_TTL_MS = 24 * 60 * 60 * 1000;

// Per-user achievements: per (userId, appId), 30min.
type AchievementsRow = { achievements: any[]; gameName: string | null; total: number; unlocked: number; ts: number };
const achievementsCache = new Map<string, AchievementsRow>();
const ACHIEVEMENTS_TTL_MS = 30 * 60 * 1000;

const prisma = new PrismaClient();

function isValidAppId(s: string): boolean {
  return /^\d{1,8}$/.test(s);
}

export default async function steamRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader } = opts;

  // GET /steam/players/:appId — public; live concurrent player count.
  // Cached 60s in-process. Public Steam endpoint requires no API key.
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
      const r = await fetch(url);
      if (!r.ok) throw new Error(String(r.status));
      const j: any = await r.json();
      const count = Number(j?.response?.player_count ?? 0);
      playersCache.set(appId, { count, ts: now });
      reply.header("Cache-Control", "public, max-age=30");
      return reply.send({ ok: true, count, ts: now });
    } catch (e) {
      // Fall back to last cached value if any, even if stale
      if (cached) {
        return reply.send({ ok: true, count: cached.count, ts: cached.ts, stale: true });
      }
      return reply.code(502).send({ ok: false, error: "steam_unavailable" });
    }
  });

  // GET /steam/owned/:appId — auth required. Returns ownership + playtime
  // for the currently-authenticated user, derived from their linked Steam ID.
  // Cached per-user for 1h.
  app.get("/steam/owned/:appId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const appId = String((req as any).params?.appId || "");
    if (!isValidAppId(appId)) return reply.code(400).send({ ok: false, error: "bad_appid" });
    if (!STEAM_API_KEY) return reply.send({ ok: true, linked: false, owned: false, hoursPlayed: 0, lastPlayed: null });

    // Look up the user's linked Steam ID
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
      const r = await fetch(url);
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
      // If we have stale cache, serve it; otherwise return a soft "linked but unknown"
      if (cached) {
        return reply.send({ ok: true, linked: true, owned: cached.owned, hoursPlayed: cached.hoursPlayed, lastPlayed: cached.lastPlayed, stale: true });
      }
      return reply.send({ ok: true, linked: true, owned: false, hoursPlayed: 0, lastPlayed: null, error: "steam_unavailable" });
    }
  });

  // GET /steam/achievements/:appId — auth required. Returns the user's
  // achievements for the given app, joined with the game's schema (icons +
  // names). Cached per-user 30min, schema 24h.
  app.get("/steam/achievements/:appId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const appId = String((req as any).params?.appId || "");
    if (!isValidAppId(appId)) return reply.code(400).send({ ok: false, error: "bad_appid" });
    if (!STEAM_API_KEY) return reply.send({ ok: true, linked: false, achievements: [] });

    const dbUser = await prisma.user.findUnique({
      where: { id: u.id },
      select: { steamId: true } as any,
    });
    const steamId = (dbUser as any)?.steamId || "";
    if (!steamId) return reply.send({ ok: true, linked: false, achievements: [] });

    const key = `${u.id}:${appId}`;
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
      // Schema: cached 24h, language=english.
      const schemaKey = `${appId}:en`;
      const cs = schemaCache.get(schemaKey);
      let schema: any = cs && now - cs.ts < SCHEMA_TTL_MS ? cs.schema : null;
      if (!schema) {
        const sUrl = `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${STEAM_API_KEY}&appid=${appId}&l=english`;
        const sr = await fetch(sUrl);
        if (sr.ok) {
          schema = await sr.json();
          schemaCache.set(schemaKey, { schema, ts: now });
        }
      }
      const schemaList: any[] = schema?.game?.availableGameStats?.achievements || [];
      const schemaByName = new Map(schemaList.map((s: any) => [String(s.name), s]));

      // Player achievements
      const aUrl = `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?key=${STEAM_API_KEY}&steamid=${steamId}&appid=${appId}&l=english`;
      const ar = await fetch(aUrl);
      if (!ar.ok) throw new Error(String(ar.status));
      const aj: any = await ar.json();
      const playerStats = aj?.playerstats;
      if (!playerStats?.success) {
        // success=false means no permission OR appid has no achievements OR profile private
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
}
