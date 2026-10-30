import type { FastifyInstance } from "fastify";
import { checkEmbed } from "../lib/embedCheck";

// GET /embed/check?url=https://…  Can the Webpage block show this page live,
// or should it show a link card? See lib/embedCheck.ts. Open to visitors (a
// lobby's Home can carry the block), so it is held to a tight rate.
export default async function embedCheckRoutes(app: FastifyInstance) {
  app.get(
    "/embed/check",
    { config: { rateLimit: { max: 40, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const raw = String((req.query as any)?.url || "");
      const res = await checkEmbed(raw);
      reply.header("Cache-Control", "public, max-age=3600");
      return reply.send(res);
    },
  );
}
