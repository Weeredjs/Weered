import type { FastifyInstance } from "fastify";

// PUBG vertical: player stats lookup, single match details, season
// leaderboard. Wraps PUBG's official API (api.pubg.com), which requires
// PUBG_API_KEY. Tight rate limits → aggressive in-memory caching.
export default async function pubgRoutes(app: FastifyInstance) {
  const PUBG_API_BASE = "https://api.pubg.com";
  const PUBG_API_KEY  = process.env.PUBG_API_KEY || "";
  const pubgCache = new Map<string, { data: any; expiresAt: number }>();

  function pubgCacheGet(key: string) {
    const c = pubgCache.get(key);
    if (c && c.expiresAt > Date.now()) return c.data;
    return null;
  }
  function pubgCacheSet(key: string, data: any, ttlMs: number) {
    pubgCache.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  async function pubgGet(path: string) {
    if (!PUBG_API_KEY) { console.warn("[pubg] No API key configured"); return null; }
    const res = await fetch(`${PUBG_API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${PUBG_API_KEY}`, Accept: "application/vnd.api+json" },
    });
    if (res.status === 429) { console.warn("[pubg] Rate limited on", path); return null; }
    if (res.status === 404) return null;
    if (!res.ok) { console.error(`[pubg] ${res.status} — ${path}`); return null; }
    return res.json();
  }

  async function pubgGetCurrentSeason(shard = "steam"): Promise<string | null> {
    const cacheKey = `pubg:season:${shard}`;
    const cached = pubgCacheGet(cacheKey);
    if (cached) return cached;
    const seasonsData = await pubgGet(`/shards/${shard}/seasons`);
    const cur = seasonsData?.data?.find((s: any) => s.attributes?.isCurrentSeason) || seasonsData?.data?.[seasonsData.data.length - 1];
    if (!cur?.id) return null;
    pubgCacheSet(cacheKey, cur.id, 60 * 60 * 1000);
    return cur.id;
  }

  app.get("/pubg/stats/:name", async (req, reply) => {
    const name = String((req as any).params?.name || "").trim();
    if (!name) return reply.code(400).send({ ok: false, error: "name_required" });
    const platform = String((req as any).query?.platform || "steam").toLowerCase();

    const cacheKey = `pubg:stats:${platform}:${name}`;
    const cached = pubgCacheGet(cacheKey);
    if (cached) return reply.send(cached);

    try {
      const playerData = await pubgGet(`/shards/${platform}/players?filter[playerNames]=${encodeURIComponent(name)}`);
      if (!playerData?.data?.length) return reply.send({ ok: false, error: "player_not_found" });

      const player = playerData.data[0];
      const accountId = player.id;
      const playerName = player.attributes?.name || name;

      const seasonId = await pubgGetCurrentSeason(platform);

      let seasonStats: any = null;
      if (seasonId) {
        const statsData = await pubgGet(`/shards/${platform}/players/${accountId}/seasons/${seasonId}`);
        seasonStats = statsData?.data?.attributes?.gameModeStats || null;
      }

      const lifetimeData = await pubgGet(`/shards/${platform}/players/${accountId}/seasons/lifetime`);
      const lifetimeStats = lifetimeData?.data?.attributes?.gameModeStats || null;

      const weaponData = await pubgGet(`/shards/${platform}/players/${accountId}/weapon_mastery`);
      const weaponSummaries: any[] = [];
      if (weaponData?.data?.attributes?.weaponSummaries) {
        const ws = weaponData.data.attributes.weaponSummaries;
        const sorted = Object.entries(ws)
          .map(([weaponId, d]: [string, any]) => ({
            weapon: weaponId.replace("Item_Weapon_", "").replace("_C", ""),
            kills: d.StatsTotal?.Kills || 0,
            damage: Math.round(d.StatsTotal?.DamagePlayer || 0),
            headshots: d.StatsTotal?.HeadShots || 0,
            longestKill: Math.round(d.StatsTotal?.LongestDefeat || 0),
            level: d.LevelCurrent || 0,
            xp: d.XPTotal || 0,
          }))
          .filter(w => w.kills > 0)
          .sort((a, b) => b.kills - a.kills)
          .slice(0, 20);
        weaponSummaries.push(...sorted);
      }

      function modeStats(stats: any, mode: string) {
        if (!stats?.[mode]) return null;
        const s = stats[mode];
        return {
          wins: s.wins || 0, kills: s.kills || 0, assists: s.assists || 0,
          losses: s.losses || 0, rounds: s.roundsPlayed || 0,
          top10s: s.top10s || 0, kd: s.roundsPlayed > 0 ? +(s.kills / Math.max(s.roundsPlayed - s.wins, 1)).toFixed(2) : 0,
          avgDmg: s.roundsPlayed > 0 ? Math.round(s.damageDealt / s.roundsPlayed) : 0,
          longestKill: Math.round(s.longestKill || 0),
          headshotKills: s.headshotKills || 0,
          timeSurvived: Math.round((s.timeSurvived || 0) / 60),
          winRate: s.roundsPlayed > 0 ? +(s.wins / s.roundsPlayed).toFixed(4) : 0,
        };
      }

      const MODES = ["solo", "solo-fpp", "duo", "duo-fpp", "squad", "squad-fpp"];

      // NOTE preserved-as-is: original code references undeclared `currentSeason`;
      // expression always evaluates to the cached seasonId. Don't fix here.
      const result: any = {
        ok: true,
        account: { id: accountId, name: playerName, platform },
        season: seasonId ? { id: seasonId, name: seasonId } : null,
        stats: { season: {} as any, lifetime: {} as any },
        weapons: weaponSummaries,
        recentMatchIds: (player.relationships?.matches?.data || []).slice(0, 5).map((m: any) => m.id),
      };

      for (const mode of MODES) {
        result.stats.season[mode] = modeStats(seasonStats, mode);
        result.stats.lifetime[mode] = modeStats(lifetimeStats, mode);
      }

      pubgCacheSet(cacheKey, result, 10 * 60 * 1000);
      return reply.send(result);
    } catch (e) {
      console.error("[pubg/stats]", e);
      return reply.send({ ok: false, error: "stats_fetch_failed" });
    }
  });

  app.get("/pubg/match/:platform/:matchId", async (req, reply) => {
    const platform = String((req as any).params?.platform || "steam");
    const matchId = String((req as any).params?.matchId || "");
    if (!matchId) return reply.code(400).send({ ok: false, error: "match_id_required" });

    const cacheKey = `pubg:match:${platform}:${matchId}`;
    const cached = pubgCacheGet(cacheKey);
    if (cached) return reply.send(cached);

    try {
      const data = await pubgGet(`/shards/${platform}/matches/${matchId}`);
      if (!data?.data) return reply.send({ ok: false, error: "match_not_found" });

      const match = data.data;
      const rosters = (data.included || []).filter((i: any) => i.type === "roster");
      const participants = (data.included || []).filter((i: any) => i.type === "participant");

      const participantMap = new Map<string, any>();
      for (const p of participants) {
        participantMap.set(p.id, {
          name: p.attributes?.stats?.name,
          kills: p.attributes?.stats?.kills || 0,
          damage: Math.round(p.attributes?.stats?.damageDealt || 0),
          place: p.attributes?.stats?.winPlace || 0,
          timeSurvived: Math.round((p.attributes?.stats?.timeSurvived || 0) / 60),
          deathType: p.attributes?.stats?.deathType,
          headshotKills: p.attributes?.stats?.headshotKills || 0,
          assists: p.attributes?.stats?.assists || 0,
          revives: p.attributes?.stats?.revives || 0,
          boosts: p.attributes?.stats?.boosts || 0,
          heals: p.attributes?.stats?.heals || 0,
          walkDistance: Math.round(p.attributes?.stats?.walkDistance || 0),
          rideDistance: Math.round(p.attributes?.stats?.rideDistance || 0),
        });
      }

      const teams = rosters.map((r: any) => {
        const members = (r.relationships?.participants?.data || [])
          .map((ref: any) => participantMap.get(ref.id))
          .filter(Boolean);
        return {
          rank: r.attributes?.stats?.rank || 0,
          teamId: r.attributes?.stats?.teamId,
          won: r.attributes?.won === "true",
          members,
        };
      }).sort((a: any, b: any) => a.rank - b.rank);

      const result = {
        ok: true,
        match: {
          id: match.id,
          mode: match.attributes?.gameMode,
          map: match.attributes?.mapName,
          duration: Math.round((match.attributes?.duration || 0) / 60),
          createdAt: match.attributes?.createdAt,
          playerCount: participants.length,
          isCustomMatch: match.attributes?.isCustomMatch,
        },
        teams: teams.slice(0, 20),
      };

      pubgCacheSet(cacheKey, result, 60 * 60 * 1000);
      return reply.send(result);
    } catch (e) {
      console.error("[pubg/match]", e);
      return reply.send({ ok: false, error: "match_fetch_failed" });
    }
  });

  const LEADERBOARD_SHARD_MAP: Record<string, string> = {
    steam: "pc-na", pc: "pc-na", xbox: "xbox-na", psn: "psn-na",
    "pc-na": "pc-na", "pc-eu": "pc-eu", "pc-as": "pc-as", "pc-oc": "pc-oc",
    "xbox-na": "xbox-na", "xbox-eu": "xbox-eu", "psn-na": "psn-na", "psn-eu": "psn-eu",
  };

  app.get("/pubg/leaderboard/:platform/:mode", async (req, reply) => {
    const rawPlatform = String((req as any).params?.platform || "steam");
    const mode = String((req as any).params?.mode || "squad-fpp");
    const lbShard = LEADERBOARD_SHARD_MAP[rawPlatform] || "pc-na";

    const cacheKey = `pubg:lb:${lbShard}:${mode}`;
    const cached = pubgCacheGet(cacheKey);
    if (cached) return reply.send(cached);

    try {
      const seasonId = await pubgGetCurrentSeason("steam");
      if (!seasonId) return reply.send({ ok: false, error: "no_season" });

      const data = await pubgGet(`/shards/${lbShard}/leaderboards/${seasonId}/${mode}`);
      if (!data?.included) return reply.send({ ok: false, error: "leaderboard_unavailable" });

      const players = (data.included || [])
        .filter((i: any) => i.type === "player")
        .map((p: any) => ({
          name: p.attributes?.name,
          rank: p.attributes?.rank,
          stats: {
            wins: p.attributes?.stats?.wins || 0,
            kills: p.attributes?.stats?.kills || 0,
            kd: p.attributes?.stats?.kda ? +p.attributes.stats.kda.toFixed(2) : 0,
            avgDmg: p.attributes?.stats?.averageDamage ? Math.round(p.attributes.stats.averageDamage) : 0,
            games: p.attributes?.stats?.games || 0,
            winRate: p.attributes?.stats?.winRatio ? +(p.attributes.stats.winRatio).toFixed(4) : 0,
            tier: p.attributes?.stats?.tier || null,
            subTier: p.attributes?.stats?.subTier || null,
            rankPoints: p.attributes?.stats?.rankPoints || 0,
          },
        }))
        .sort((a: any, b: any) => (a.rank || 999) - (b.rank || 999))
        .slice(0, 50);

      const result = {
        ok: true,
        season: seasonId,
        mode,
        platform: lbShard,
        players,
      };

      pubgCacheSet(cacheKey, result, 15 * 60 * 1000);
      return reply.send(result);
    } catch (e) {
      console.error("[pubg/leaderboard]", e);
      return reply.send({ ok: false, error: "leaderboard_fetch_failed" });
    }
  });
}
