import type { FastifyInstance } from "fastify";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";

export default async function pgaRoutes(app: FastifyInstance) {
  const ESPN_PGA = "https://site.api.espn.com/apis/site/v2/sports/golf/pga";

  app.get("/pga/leaderboard", async (req, reply) => {
    try {
      const res = await fetchWithTimeout(`${ESPN_PGA}/scoreboard`);
      const data = await res.json();
      const event = data?.events?.[0];
      if (!event) return reply.send({ ok: true, event: null, players: [] });

      const comp = event.competitions?.[0];
      const broadcasts = (comp?.broadcasts || []).flatMap((b: any) => b.names || []);
      const players = (comp?.competitors || []).map((c: any, i: number) => ({
        position: i + 1,
        name: c.athlete?.displayName || "Unknown",
        country: c.athlete?.flag?.alt || "",
        score: c.score || "E",
        rounds: (c.linescores || []).map((l: any) => l.value),
        today: c.linescores?.length ? c.linescores[c.linescores.length - 1]?.value : null,
        todayDisplay: c.linescores?.length ? c.linescores[c.linescores.length - 1]?.displayValue : null,
        thru: c.status?.thru || c.status?.displayValue || "",
        status: c.status?.type?.description || "",
        holeByHole: c.linescores?.length ? (c.linescores[c.linescores.length - 1]?.linescores || []).map((h: any, hi: number) => ({
          hole: hi + 1,
          score: h.value,
          display: h.displayValue,
          toPar: h.scoreType?.displayValue || "E",
        })) : [],
      }));

      return reply.send({
        ok: true,
        event: {
          name: event.name || event.shortName,
          date: event.date,
          status: event.status?.type?.description || "",
          round: event.status?.period || null,
          venue: comp?.venue?.fullName || "",
          location: event.location || "",
          purse: event.purse || event.displayPurse || null,
          broadcasts,
        },
        players,
      });
    } catch (e) {
      console.error("[pga leaderboard]", e);
      return reply.send({ ok: true, event: null, players: [], error: "fetch_failed" });
    }
  });

  app.get("/pga/news", async (req, reply) => {
    try {
      const limit = Math.min(Number((req as any).query?.limit) || 15, 30);
      const res = await fetchWithTimeout(`${ESPN_PGA}/news?limit=${limit}`);
      const data = await res.json();
      const articles = (data?.articles || []).map((a: any) => ({
        headline: a.headline,
        description: a.description || "",
        published: a.published,
        image: a.images?.[0]?.url || "",
        link: a.links?.web?.href || a.links?.api?.href || "",
        premium: a.premium || false,
      }));
      return reply.send({ ok: true, articles });
    } catch (e) {
      console.error("[pga news]", e);
      return reply.send({ ok: true, articles: [], error: "fetch_failed" });
    }
  });

  app.get("/pga/schedule", async (req, reply) => {
    try {
      const year = new Date().getFullYear();
      const calRes = await fetchWithTimeout(`https://site.api.espn.com/apis/site/v2/sports/golf/pga/calendar?dates=${year}`);
      const calData = await calRes.json();

      let events: any[] = [];
      if (calData?.events) {
        events = calData.events;
      } else if (calData?.leagues?.[0]?.calendar) {
        const cal = calData.leagues[0].calendar;
        events = (Array.isArray(cal) ? cal : []).flatMap((c: any) => c.entries || [c]).filter((e: any) => e.label || e.detail);
      }

      const schedule = events.slice(0, 30).map((e: any) => ({
        name: e.label || e.name || e.alternateLabel || "",
        startDate: e.startDate || e.date || "",
        endDate: e.endDate || "",
        detail: e.detail || "",
        value: e.value || "",
      }));

      return reply.send({ ok: true, schedule });
    } catch (e) {
      console.error("[pga schedule]", e);
      return reply.send({ ok: true, schedule: [], error: "fetch_failed" });
    }
  });

  app.get("/pga/field", async (req, reply) => {
    try {
      const res = await fetchWithTimeout(`${ESPN_PGA}/scoreboard`);
      const data = await res.json();
      const event = data?.events?.[0];
      if (!event) return reply.send({ ok: true, event: null, field: [] });

      const comp = event.competitions?.[0];
      const field = (comp?.competitors || []).map((c: any, i: number) => ({
        position: i + 1,
        name: c.athlete?.displayName || "Unknown",
        id: c.athlete?.id,
        country: c.athlete?.flag?.alt || "",
        score: c.score || "E",
        today: c.linescores?.length ? c.linescores[c.linescores.length - 1]?.value : null,
        rounds: (c.linescores || []).map((l: any) => l.value),
        thru: c.status?.thru || c.status?.displayValue || "",
        status: c.status?.type?.description || "",
        roundScores: (c.linescores || []).map((l: any, ri: number) => ({
          round: ri + 1,
          score: l.value,
        })),
      }));

      return reply.send({
        ok: true,
        event: {
          name: event.name,
          status: event.status?.type?.description,
          round: event.status?.period,
        },
        field,
      });
    } catch (e) {
      console.error("[pga field]", e);
      return reply.send({ ok: true, event: null, field: [], error: "fetch_failed" });
    }
  });
}
