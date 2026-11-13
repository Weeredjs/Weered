import { log } from "../lib/logger";
import type { FastifyInstance } from "fastify";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import { BoundedMap } from "../lib/boundedMap";

export default async function youtubeRoutes(app: FastifyInstance) {
  // YT Data API default quota is ~100 search calls/day TOTAL. Cache aggressively
  // and rate-limit per IP so one client can't exhaust the daily quota.
  const ytCache = new BoundedMap<string, { results: any[]; expiresAt: number }>(300);
  const YT_TTL = 60 * 60 * 1000;

  app.get(
    "/youtube/search",
    {
      config: { rateLimit: { max: 15, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const q = String((req.query as any).q || "")
        .trim()
        .slice(0, 100)
        .toLowerCase();
      if (!q) return reply.send({ results: [] });

      const hit = ytCache.get(q);
      if (hit && hit.expiresAt > Date.now())
        return reply.send({ results: hit.results, cached: true });

      const ytKey = process.env.YOUTUBE_API_KEY;
      if (!ytKey) {
        return reply.send({ results: [], hint: "YOUTUBE_API_KEY not configured" });
      }

      try {
        const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=8&q=${encodeURIComponent(q)}&key=${ytKey}`;
        const res = await fetchWithTimeout(apiUrl);
        const data = await res.json();
        if (data.error) {
          log.error("[yt-search] API error:", data.error.message);
          // Google's own words stay in the log: they name the project and the
          // quota (fan-out audit, 2026-11-13).
          return reply.code(503).send({ results: [], error: "search_unavailable" });
        }
        const results = (data.items || []).map((item: any) => ({
          videoId: item.id?.videoId,
          title: item.snippet?.title,
          channel: item.snippet?.channelTitle,
          thumbnail:
            item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url,
          publishedAt: item.snippet?.publishedAt,
        }));
        ytCache.set(q, { results, expiresAt: Date.now() + YT_TTL });
        return reply.send({ results });
      } catch (e: any) {
        log.error("[yt-search]", e);
        return reply.code(500).send({ results: [], error: "Search failed" });
      }
    },
  );
}
