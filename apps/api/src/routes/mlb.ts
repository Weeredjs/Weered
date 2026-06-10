import type { FastifyInstance } from "fastify";

export default async function mlbRoutes(app: FastifyInstance) {
  const MLB_API = "https://statsapi.mlb.com/api/v1";

  app.get("/mlb/scoreboard", async (req, reply) => {
    try {
      const date = String((req as any).query?.date || new Date().toISOString().slice(0, 10));
      const res = await fetch(`${MLB_API}/schedule?sportId=1&date=${date}&hydrate=linescore,team,probablePitcher`);
      const data = await res.json();
      const games = (data?.dates?.[0]?.games || []).map((g: any) => ({
        gameId: g.gamePk,
        status: g.status?.detailedState || g.status?.abstractGameState || "Unknown",
        statusCode: g.status?.statusCode,
        startTime: g.gameDate,
        venue: g.venue?.name,
        away: {
          id: g.teams?.away?.team?.id,
          name: g.teams?.away?.team?.name,
          abbr: g.teams?.away?.team?.abbreviation,
          score: g.teams?.away?.score ?? null,
          wins: g.teams?.away?.leagueRecord?.wins,
          losses: g.teams?.away?.leagueRecord?.losses,
          probablePitcher: g.teams?.away?.probablePitcher ? {
            id: g.teams.away.probablePitcher.id,
            name: g.teams.away.probablePitcher.fullName,
            era: g.teams.away.probablePitcher.stats?.[0]?.stats?.era,
          } : null,
        },
        home: {
          id: g.teams?.home?.team?.id,
          name: g.teams?.home?.team?.name,
          abbr: g.teams?.home?.team?.abbreviation,
          score: g.teams?.home?.score ?? null,
          wins: g.teams?.home?.leagueRecord?.wins,
          losses: g.teams?.home?.leagueRecord?.losses,
          probablePitcher: g.teams?.home?.probablePitcher ? {
            id: g.teams.home.probablePitcher.id,
            name: g.teams.home.probablePitcher.fullName,
            era: g.teams.home.probablePitcher.stats?.[0]?.stats?.era,
          } : null,
        },
        linescore: g.linescore ? {
          currentInning: g.linescore.currentInning,
          inningHalf: g.linescore.inningHalf,
          balls: g.linescore.balls,
          strikes: g.linescore.strikes,
          outs: g.linescore.outs,
          innings: (g.linescore.innings || []).map((inn: any) => ({
            num: inn.num,
            away: inn.away?.runs ?? null,
            home: inn.home?.runs ?? null,
          })),
        } : null,
      }));
      return reply.send({ ok: true, date, games });
    } catch (e) {
      console.error("[mlb scoreboard]", e);
      return reply.send({ ok: true, date: "", games: [], error: "fetch_failed" });
    }
  });

  app.get("/mlb/standings", async (req, reply) => {
    try {
      const season = String((req as any).query?.season || new Date().getFullYear());
      const res = await fetch(`${MLB_API}/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason&hydrate=team`);
      const data = await res.json();
      const divisions = (data?.records || []).map((div: any) => ({
        divisionId: div.division?.id,
        divisionName: div.division?.name,
        teams: (div.teamRecords || []).map((t: any) => ({
          id: t.team?.id,
          name: t.team?.name,
          abbr: t.team?.abbreviation,
          wins: t.wins,
          losses: t.losses,
          pct: t.winningPercentage,
          gb: t.gamesBack,
          streak: t.streak?.streakCode,
          last10: `${t.records?.splitRecords?.find((s: any) => s.type === "lastTen")?.wins || 0}-${t.records?.splitRecords?.find((s: any) => s.type === "lastTen")?.losses || 0}`,
          runsScored: t.runsScored,
          runsAllowed: t.runsAllowed,
          runDiff: t.runDifferential,
        })),
      }));
      return reply.send({ ok: true, season, divisions });
    } catch (e) {
      console.error("[mlb standings]", e);
      return reply.send({ ok: true, divisions: [], error: "fetch_failed" });
    }
  });

  app.get("/mlb/leaders", async (req, reply) => {
    try {
      const season = String((req as any).query?.season || new Date().getFullYear());
      const categories = [
        { stat: "homeRuns", label: "Home Runs" },
        { stat: "battingAverage", label: "Batting Avg" },
        { stat: "runsBattedIn", label: "RBI" },
        { stat: "stolenBases", label: "Stolen Bases" },
        { stat: "earnedRunAverage", label: "ERA" },
        { stat: "strikeouts", label: "Strikeouts" },
        { stat: "wins", label: "Pitcher Wins" },
        { stat: "saves", label: "Saves" },
      ];
      const results: any[] = [];
      for (const cat of categories) {
        const res = await fetch(`${MLB_API}/stats/leaders?leaderCategories=${cat.stat}&season=${season}&sportId=1&limit=10`);
        const data = await res.json();
        const leaders = (data?.leagueLeaders?.[0]?.leaders || []).map((l: any) => ({
          rank: l.rank,
          playerId: l.person?.id,
          name: l.person?.fullName,
          team: l.team?.name,
          teamAbbr: l.team?.abbreviation,
          value: l.value,
        }));
        results.push({ stat: cat.stat, label: cat.label, leaders });
      }
      return reply.send({ ok: true, season, categories: results });
    } catch (e) {
      console.error("[mlb leaders]", e);
      return reply.send({ ok: true, categories: [], error: "fetch_failed" });
    }
  });

  app.get("/mlb/player/search", async (req, reply) => {
    try {
      const q = String((req as any).query?.q || "");
      if (!q) return reply.send({ ok: true, players: [] });
      const res = await fetch(`${MLB_API}/people/search?names=${encodeURIComponent(q)}&sportId=1&active=true&hydrate=currentTeam`);
      const data = await res.json();
      const players = (data?.people || []).slice(0, 15).map((p: any) => ({
        id: p.id,
        name: p.fullName,
        number: p.primaryNumber,
        position: p.primaryPosition?.abbreviation,
        team: p.currentTeam?.name,
        teamAbbr: p.currentTeam?.abbreviation,
        teamId: p.currentTeam?.id,
        bats: p.batSide?.code,
        throws: p.pitchHand?.code,
        age: p.currentAge,
        height: p.height,
        weight: p.weight,
        birthCountry: p.birthCountry,
        mlbDebutDate: p.mlbDebutDate,
        headshot: `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${p.id}/headshot/67/current`,
      }));
      return reply.send({ ok: true, players });
    } catch (e) {
      console.error("[mlb player search]", e);
      return reply.send({ ok: true, players: [], error: "fetch_failed" });
    }
  });

  app.get("/mlb/player/:id/stats", async (req, reply) => {
    try {
      const id = (req as any).params.id;
      const season = String((req as any).query?.season || new Date().getFullYear());
      const [bioRes, statsRes] = await Promise.all([
        fetch(`${MLB_API}/people/${id}`),
        fetch(`${MLB_API}/people/${id}/stats?stats=season,career&group=hitting,pitching,fielding&season=${season}`),
      ]);
      const bio = await bioRes.json();
      const stats = await statsRes.json();
      const person = bio?.people?.[0];
      if (!person) return reply.send({ ok: false, error: "player_not_found" });

      const statGroups: any = {};
      for (const s of stats?.stats || []) {
        const key = `${s.group?.displayName}_${s.type?.displayName}`;
        statGroups[key] = (s.splits || []).map((sp: any) => ({
          season: sp.season,
          team: sp.team?.name,
          stats: sp.stat,
        }));
      }

      return reply.send({
        ok: true,
        player: {
          id: person.id,
          name: person.fullName,
          number: person.primaryNumber,
          position: person.primaryPosition?.abbreviation,
          positionName: person.primaryPosition?.name,
          team: person.currentTeam?.name,
          teamId: person.currentTeam?.id,
          bats: person.batSide?.description,
          throws: person.pitchHand?.description,
          age: person.currentAge,
          height: person.height,
          weight: person.weight,
          birthDate: person.birthDate,
          birthCity: person.birthCity,
          birthCountry: person.birthCountry,
          mlbDebutDate: person.mlbDebutDate,
          headshot: `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${person.id}/headshot/67/current`,
        },
        stats: statGroups,
      });
    } catch (e) {
      console.error("[mlb player stats]", e);
      return reply.send({ ok: false, error: "fetch_failed" });
    }
  });

  app.get("/mlb/game/:id/boxscore", async (req, reply) => {
    try {
      const id = (req as any).params.id;
      const res = await fetch(`${MLB_API.replace("/v1", "/v1.1")}/game/${id}/feed/live`);
      const data = await res.json();
      const gd = data?.gameData;
      const ld = data?.liveData;
      if (!gd || !ld) return reply.send({ ok: false, error: "game_not_found" });

      const mapBatters = (team: any) => (team?.batters || []).map((pid: number) => {
        const p = team.players?.[`ID${pid}`];
        if (!p) return null;
        const s = p.stats?.batting || {};
        return {
          id: pid, name: p.person?.fullName, position: p.position?.abbreviation,
          ab: s.atBats, r: s.runs, h: s.hits, rbi: s.rbi, bb: s.baseOnBalls,
          so: s.strikeOuts, avg: s.avg, ops: s.ops, hr: s.homeRuns,
        };
      }).filter(Boolean);

      const mapPitchers = (team: any) => (team?.pitchers || []).map((pid: number) => {
        const p = team.players?.[`ID${pid}`];
        if (!p) return null;
        const s = p.stats?.pitching || {};
        return {
          id: pid, name: p.person?.fullName,
          ip: s.inningsPitched, h: s.hits, r: s.runs, er: s.earnedRuns,
          bb: s.baseOnBalls, so: s.strikeOuts, hr: s.homeRuns, era: s.era,
          pitches: s.numberOfPitches, strikes: s.strikes,
        };
      }).filter(Boolean);

      return reply.send({
        ok: true,
        game: {
          status: gd.status?.detailedState,
          venue: gd.venue?.name,
          weather: gd.weather ? `${gd.weather.temp}°F, ${gd.weather.condition}` : null,
          away: {
            name: gd.teams?.away?.name, abbr: gd.teams?.away?.abbreviation,
            runs: ld.linescore?.teams?.away?.runs, hits: ld.linescore?.teams?.away?.hits, errors: ld.linescore?.teams?.away?.errors,
            batters: mapBatters(ld.boxscore?.teams?.away),
            pitchers: mapPitchers(ld.boxscore?.teams?.away),
          },
          home: {
            name: gd.teams?.home?.name, abbr: gd.teams?.home?.abbreviation,
            runs: ld.linescore?.teams?.home?.runs, hits: ld.linescore?.teams?.home?.hits, errors: ld.linescore?.teams?.home?.errors,
            batters: mapBatters(ld.boxscore?.teams?.home),
            pitchers: mapPitchers(ld.boxscore?.teams?.home),
          },
          innings: (ld.linescore?.innings || []).map((inn: any) => ({
            num: inn.num,
            away: inn.away?.runs ?? null,
            home: inn.home?.runs ?? null,
          })),
        },
      });
    } catch (e) {
      console.error("[mlb boxscore]", e);
      return reply.send({ ok: false, error: "fetch_failed" });
    }
  });

  app.get("/mlb/highlights", async (req, reply) => {
    try {
      const date = String((req as any).query?.date || new Date().toISOString().slice(0, 10));
      const schedRes = await fetch(`${MLB_API}/schedule?sportId=1&date=${date}`);
      const schedData = await schedRes.json();
      const gameIds = (schedData?.dates?.[0]?.games || []).map((g: any) => g.gamePk);

      const allHighlights: any[] = [];
      const subset = gameIds.slice(0, 6);
      await Promise.all(subset.map(async (gid: number) => {
        try {
          const res = await fetch(`${MLB_API}/game/${gid}/content`);
          const data = await res.json();
          const items = data?.highlights?.highlights?.items || [];
          for (const item of items) {
            const mp4 = item.playbacks?.find((p: any) => p.name === "mp4Avc") || item.playbacks?.find((p: any) => p.url?.includes(".mp4"));
            if (!mp4) continue;
            allHighlights.push({
              id: item.id,
              headline: item.headline || item.title || "",
              description: item.description || "",
              duration: item.duration || "",
              thumbnailUrl: item.image?.cuts?.find((c: any) => c.width >= 320 && c.width <= 640)?.src
                || item.image?.cuts?.[0]?.src || "",
              videoUrl: mp4.url,
              gameId: gid,
              date: item.date || date,
            });
          }
        } catch {}
      }));

      allHighlights.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      return reply.send({ ok: true, date, highlights: allHighlights.slice(0, 30) });
    } catch (e) {
      console.error("[mlb highlights]", e);
      return reply.send({ ok: true, highlights: [], error: "fetch_failed" });
    }
  });

  app.get("/mlb/matchups", async (req, reply) => {
    try {
      const date = String((req as any).query?.date || new Date().toISOString().slice(0, 10));
      const schedRes = await fetch(`${MLB_API}/schedule?sportId=1&date=${date}&hydrate=probablePitcher(stats(type=season)),team,linescore,weather`);
      const schedData = await schedRes.json();
      const games = schedData?.dates?.[0]?.games || [];

      const matchups = await Promise.all(games.map(async (g: any) => {
        let weather: any = null;
        try {
          const feedRes = await fetch(`https://statsapi.mlb.com/api/v1.1/game/${g.gamePk}/feed/live`);
          const feed = await feedRes.json();
          const w = feed?.gameData?.weather;
          if (w) weather = { temp: w.temp, condition: w.condition, wind: w.wind };
        } catch {}

        const mapPitcher = (team: any) => {
          const pp = team?.probablePitcher;
          if (!pp) return null;
          const seasonStats = pp.stats?.find((s: any) => s.type?.displayName === "statsSingleSeason")?.stats || {};
          return {
            id: pp.id,
            name: pp.fullName,
            era: seasonStats.era || pp.stats?.[0]?.stats?.era || "-",
            whip: seasonStats.whip || "-",
            wins: seasonStats.wins || 0,
            losses: seasonStats.losses || 0,
            strikeouts: seasonStats.strikeOuts || 0,
            inningsPitched: seasonStats.inningsPitched || "-",
            kPer9: seasonStats.strikeoutsPer9Inn || "-",
            bbPer9: seasonStats.walksPer9Inn || "-",
            homeRunsPer9: seasonStats.homeRunsPer9 || "-",
            record: `${seasonStats.wins || 0}-${seasonStats.losses || 0}`,
            gamesStarted: seasonStats.gamesStarted || 0,
          };
        };

        return {
          gameId: g.gamePk,
          startTime: g.gameDate,
          status: g.status?.detailedState || "Scheduled",
          venue: g.venue?.name,
          weather,
          away: {
            id: g.teams?.away?.team?.id,
            name: g.teams?.away?.team?.name,
            abbr: g.teams?.away?.team?.abbreviation,
            wins: g.teams?.away?.leagueRecord?.wins,
            losses: g.teams?.away?.leagueRecord?.losses,
            score: g.teams?.away?.score ?? null,
            probablePitcher: mapPitcher(g.teams?.away),
          },
          home: {
            id: g.teams?.home?.team?.id,
            name: g.teams?.home?.team?.name,
            abbr: g.teams?.home?.team?.abbreviation,
            wins: g.teams?.home?.leagueRecord?.wins,
            losses: g.teams?.home?.leagueRecord?.losses,
            score: g.teams?.home?.score ?? null,
            probablePitcher: mapPitcher(g.teams?.home),
          },
        };
      }));

      return reply.send({ ok: true, date, matchups });
    } catch (e) {
      console.error("[mlb matchups]", e);
      return reply.send({ ok: true, matchups: [], error: "fetch_failed" });
    }
  });
}
