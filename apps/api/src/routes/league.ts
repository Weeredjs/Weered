import type { FastifyInstance } from "fastify";

export default async function leagueRoutes(app: FastifyInstance) {
  const RIOT_API_KEY = process.env.RIOT_API_KEY || "";
  const RIOT_REGION  = "na1";
  const RIOT_CLUSTER = "americas";
  const DDRAGON_VER_URL = "https://ddragon.leagueoflegends.com/api/versions.json";

  let ddragonVersion = "14.24.1";
  (async () => {
    try {
      const res = await fetch(DDRAGON_VER_URL);
      const versions: string[] = await res.json() as string[];
      if (versions?.[0]) { ddragonVersion = versions[0]; console.log(`[league] Data Dragon version: ${ddragonVersion}`); }
    } catch (e) { console.warn("[league] Failed to fetch DDragon version, using fallback"); }
  })();

  function riotPlatformUrl(region: string = RIOT_REGION) { return `https://${region}.api.riotgames.com`; }
  function riotClusterUrl(cluster: string = RIOT_CLUSTER) { return `https://${cluster}.api.riotgames.com`; }
  function ddragonImg(path: string) { return `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/${path}`; }

  async function riotGet(url: string) {
    const res = await fetch(url, { headers: { "X-Riot-Token": RIOT_API_KEY } });
    if (res.status === 429) { console.warn("[riot] Rate limited"); return null; }
    if (res.status === 404) return null;
    if (!res.ok) { console.error(`[riot] ${res.status} ${res.statusText} — ${url}`); return null; }
    return res.json();
  }

  const leagueCache = new Map<string, { data: any; expiresAt: number }>();
  function leagueCacheGet(key: string) {
    const c = leagueCache.get(key);
    if (c && c.expiresAt > Date.now()) return c.data;
    return null;
  }
  function leagueCacheSet(key: string, data: any, ttlMs: number) {
    leagueCache.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  app.get("/league/summoner/:gameName/:tagLine", async (req, reply) => {
    if (!RIOT_API_KEY) return reply.send({ ok: false, error: "riot_not_configured" });

    const gameName = decodeURIComponent(String((req as any).params.gameName));
    const tagLine  = decodeURIComponent(String((req as any).params.tagLine));
    const region   = String((req as any).query?.region || RIOT_REGION);
    const cluster  = region === "kr" || region === "jp1" ? "asia" : region.startsWith("eu") ? "europe" : RIOT_CLUSTER;

    const cacheKey = `summoner:${gameName}#${tagLine}:${region}`;
    const cached = leagueCacheGet(cacheKey);
    if (cached) return reply.send(cached);

    const account = await riotGet(`${riotClusterUrl(cluster)}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`);
    if (!account?.puuid) return reply.send({ ok: false, error: "player_not_found" });

    const summoner = await riotGet(`${riotPlatformUrl(region)}/lol/summoner/v4/summoners/by-puuid/${account.puuid}`);
    if (!summoner) return reply.send({ ok: false, error: "summoner_not_found" });

    const ranked = await riotGet(`${riotPlatformUrl(region)}/lol/league/v4/entries/by-summoner/${summoner.id}`) || [];

    const masteries = await riotGet(`${riotPlatformUrl(region)}/lol/champion-mastery/v4/champion-masteries/by-puuid/${account.puuid}/top?count=5`) || [];

    const matchIds = await riotGet(`${riotClusterUrl(cluster)}/lol/match/v5/matches/by-puuid/${account.puuid}/ids?start=0&count=10`) || [];
    const matches: any[] = [];
    for (const mid of (matchIds as string[]).slice(0, 5)) {
      const m = await riotGet(`${riotClusterUrl(cluster)}/lol/match/v5/matches/${mid}`);
      if (m?.info) {
        const me = m.info.participants?.find((p: any) => p.puuid === account.puuid);
        if (me) {
          matches.push({
            matchId: mid,
            championId: me.championId,
            championName: me.championName,
            kills: me.kills, deaths: me.deaths, assists: me.assists,
            cs: (me.totalMinionsKilled || 0) + (me.neutralMinionsKilled || 0),
            win: me.win,
            gameDuration: m.info.gameDuration,
            queueId: m.info.queueId,
            gameCreation: m.info.gameCreation,
            items: [me.item0, me.item1, me.item2, me.item3, me.item4, me.item5, me.item6],
            summonerSpells: [me.summoner1Id, me.summoner2Id],
            goldEarned: me.goldEarned,
            visionScore: me.visionScore,
            level: me.champLevel,
          });
        }
      }
    }

    const soloQ  = (ranked as any[]).find((r: any) => r.queueType === "RANKED_SOLO_5x5");
    const flexQ  = (ranked as any[]).find((r: any) => r.queueType === "RANKED_FLEX_SR");

    const result = {
      ok: true,
      summoner: {
        gameName: account.gameName,
        tagLine: account.tagLine,
        puuid: account.puuid,
        summonerLevel: summoner.summonerLevel,
        profileIconId: summoner.profileIconId,
        profileIconUrl: ddragonImg(`img/profileicon/${summoner.profileIconId}.png`),
      },
      ranked: {
        solo: soloQ ? { tier: soloQ.tier, rank: soloQ.rank, lp: soloQ.leaguePoints, wins: soloQ.wins, losses: soloQ.losses, winRate: soloQ.wins + soloQ.losses > 0 ? Math.round(soloQ.wins / (soloQ.wins + soloQ.losses) * 100) : 0 } : null,
        flex: flexQ ? { tier: flexQ.tier, rank: flexQ.rank, lp: flexQ.leaguePoints, wins: flexQ.wins, losses: flexQ.losses, winRate: flexQ.wins + flexQ.losses > 0 ? Math.round(flexQ.wins / (flexQ.wins + flexQ.losses) * 100) : 0 } : null,
      },
      topChampions: (masteries as any[]).map((m: any) => ({
        championId: m.championId,
        championLevel: m.championLevel,
        championPoints: m.championPoints,
      })),
      recentMatches: matches,
      ddragonVersion,
    };

    leagueCacheSet(cacheKey, result, 5 * 60 * 1000);
    return reply.send(result);
  });

  app.get("/league/rotation", async (req, reply) => {
    if (!RIOT_API_KEY) return reply.send({ ok: false, error: "riot_not_configured" });
    const region = String((req as any).query?.region || RIOT_REGION);
    const cacheKey = `rotation:${region}`;
    const cached = leagueCacheGet(cacheKey);
    if (cached) return reply.send(cached);

    const rotation = await riotGet(`${riotPlatformUrl(region)}/lol/platform/v3/champion-rotations`);
    if (!rotation) return reply.send({ ok: false, error: "rotation_unavailable" });

    const result = { ok: true, freeChampionIds: rotation.freeChampionIds, freeChampionIdsForNewPlayers: rotation.freeChampionIdsForNewPlayers, ddragonVersion };
    leagueCacheSet(cacheKey, result, 60 * 60 * 1000);
    return reply.send(result);
  });

  app.get("/league/leaderboard", async (req, reply) => {
    if (!RIOT_API_KEY) return reply.send({ ok: false, error: "riot_not_configured" });
    const region = String((req as any).query?.region || RIOT_REGION);
    const queue  = String((req as any).query?.queue || "RANKED_SOLO_5x5");
    const cacheKey = `leaderboard:${region}:${queue}`;
    const cached = leagueCacheGet(cacheKey);
    if (cached) return reply.send(cached);

    const challenger = await riotGet(`${riotPlatformUrl(region)}/lol/league/v4/challengerleagues/by-queue/${queue}`);
    if (!challenger?.entries) return reply.send({ ok: false, error: "leaderboard_unavailable" });

    const sorted = (challenger.entries as any[])
      .sort((a: any, b: any) => b.leaguePoints - a.leaguePoints)
      .slice(0, 50);

    const cluster = region === "kr" || region === "jp1" ? "asia" : region.startsWith("eu") ? "europe" : RIOT_CLUSTER;
    const entries: any[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const e = sorted[i];
      let gameName = e.summonerName || "";
      let tagLine = "";
      if (i < 25 && e.puuid) {
        const acct = await riotGet(`${riotClusterUrl(cluster)}/riot/account/v1/accounts/by-puuid/${e.puuid}`);
        if (acct?.gameName) { gameName = acct.gameName; tagLine = acct.tagLine || ""; }
      }
      entries.push({
        rank: i + 1,
        gameName: gameName || `Player ${i + 1}`,
        tagLine,
        puuid: e.puuid,
        lp: e.leaguePoints,
        wins: e.wins,
        losses: e.losses,
        winRate: e.wins + e.losses > 0 ? Math.round(e.wins / (e.wins + e.losses) * 100) : 0,
      });
    }

    const result = { ok: true, tier: "CHALLENGER", queue, region, entries };
    leagueCacheSet(cacheKey, result, 15 * 60 * 1000);
    return reply.send(result);
  });

  app.get("/league/live/:summonerId", async (req, reply) => {
    if (!RIOT_API_KEY) return reply.send({ ok: false, error: "riot_not_configured" });
    const summonerId = String((req as any).params.summonerId);
    const region = String((req as any).query?.region || RIOT_REGION);

    const game = await riotGet(`${riotPlatformUrl(region)}/lol/spectator/v4/active-games/by-summoner/${summonerId}`);
    if (!game) return reply.send({ ok: true, inGame: false });

    return reply.send({
      ok: true,
      inGame: true,
      gameId: game.gameId,
      gameMode: game.gameMode,
      gameType: game.gameType,
      mapId: game.mapId,
      gameLength: game.gameLength,
      participants: (game.participants || []).map((p: any) => ({
        summonerName: p.summonerName,
        summonerId: p.summonerId,
        championId: p.championId,
        teamId: p.teamId,
        spell1Id: p.spell1Id,
        spell2Id: p.spell2Id,
      })),
      bannedChampions: game.bannedChampions || [],
    });
  });

  app.get("/league/champions", async (req, reply) => {
    const cacheKey = `champions:${ddragonVersion}`;
    const cached = leagueCacheGet(cacheKey);
    if (cached) return reply.send(cached);

    try {
      const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/data/en_US/champion.json`);
      const data: any = await res.json();
      const champions = Object.values(data.data || {}).map((c: any) => ({
        id: c.id,
        key: Number(c.key),
        name: c.name,
        title: c.title,
        tags: c.tags,
        image: ddragonImg(`img/champion/${c.image?.full || c.id + ".png"}`),
      }));
      const result = { ok: true, champions, version: ddragonVersion };
      leagueCacheSet(cacheKey, result, 24 * 60 * 60 * 1000);
      return reply.send(result);
    } catch (e) {
      console.error("[league/champions]", e);
      return reply.send({ ok: false, error: "ddragon_fetch_failed" });
    }
  });
}
