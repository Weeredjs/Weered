import type { FastifyInstance } from "fastify";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";

export default async function tenorRoutes(app: FastifyInstance) {
  const GIPHY_KEY = process.env.GIPHY_API_KEY || "";
  const gifCache = new Map<string, { data: any; expiresAt: number }>();

  async function giphyFetch(endpoint: "trending" | "search", params: Record<string, string>) {
    if (!GIPHY_KEY) return { data: [] };
    const qs = new URLSearchParams({ api_key: GIPHY_KEY, limit: "20", rating: "pg-13", ...params }).toString();
    const cacheKey = `${endpoint}?${qs}`;
    const hit = gifCache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) return hit.data;
    try {
      const res = await fetchWithTimeout(`https://api.giphy.com/v1/gifs/${endpoint}?${qs}`);
      const j = await res.json();
      gifCache.set(cacheKey, { data: j, expiresAt: Date.now() + 10 * 60 * 1000 });
      return j;
    } catch (e) {
      return { data: [] };
    }
  }

  function normalizeGiphy(items: any[]) {
    return items.map((g: any) => {
      const tiny = g.images?.fixed_width_small || g.images?.fixed_height_small || g.images?.preview_gif;
      const full = g.images?.original || g.images?.fixed_height || tiny;
      return {
        id: g.id,
        media_formats: {
          tinygif: { url: tiny?.url, dims: [Number(tiny?.width) || 200, Number(tiny?.height) || 200] },
          gif: { url: full?.url },
        },
      };
    });
  }

  app.get("/tenor/featured", async (_req, reply) => {
    const data = await giphyFetch("trending", {});
    return reply.send({ ok: true, results: normalizeGiphy(data.data || []) });
  });

  app.get("/tenor/search", {
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const q = String((req as any).query?.q || "").trim();
    if (!q) return reply.send({ ok: true, results: [] });
    const data = await giphyFetch("search", { q });
    return reply.send({ ok: true, results: normalizeGiphy(data.data || []) });
  });
}
