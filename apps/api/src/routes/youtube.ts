import type { FastifyInstance } from "fastify";

export default async function youtubeRoutes(app: FastifyInstance) {
  app.get("/youtube/search", async (req, reply) => {
    const q = String((req.query as any).q || "").trim();
    if (!q) return reply.send({ results: [] });

    const ytKey = process.env.YOUTUBE_API_KEY;
    if (!ytKey) {
      return reply.send({ results: [], hint: "YOUTUBE_API_KEY not configured" });
    }

    try {
      const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=8&q=${encodeURIComponent(q)}&key=${ytKey}`;
      const res = await fetch(apiUrl);
      const data = await res.json();
      if (data.error) {
        console.error("[yt-search] API error:", data.error.message);
        return reply.code(500).send({ results: [], error: data.error.message });
      }
      const results = (data.items || []).map((item: any) => ({
        videoId: item.id?.videoId,
        title: item.snippet?.title,
        channel: item.snippet?.channelTitle,
        thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url,
        publishedAt: item.snippet?.publishedAt,
      }));
      return reply.send({ results });
    } catch (e: any) {
      console.error("[yt-search]", e);
      return reply.code(500).send({ results: [], error: "Search failed" });
    }
  });
}
