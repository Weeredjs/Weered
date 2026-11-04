import type { FastifyInstance } from "fastify";
import { gameNews } from "../lib/gameNews";

// GET /news/game/:key — a game's news stage (lib/gameNews.ts): its own Steam
// announcements and the press that names it, newest first. Public, cached.
export default async function gameNewsRoutes(app: FastifyInstance) {
  app.get(
    "/news/game/:key",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const key = String((req.params as any)?.key || "").toLowerCase();
      const items = await gameNews(key);
      if (!items) return reply.code(404).send({ ok: false, error: "unknown_game" });
      reply.header("Cache-Control", "public, max-age=300");
      return reply.send({ ok: true, items });
    },
  );
}
