import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

// The people the registration cap turned away who asked to hear when there's
// room (lib/registration.ts). One address each; staff copy them from Config.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function waitlistRoutes(app: FastifyInstance, opts: any) {
  const { authFromHeader, getGlobalRole } = opts;

  app.post(
    "/waitlist",
    { config: { rateLimit: { max: 20, timeWindow: "1 hour" } } },
    async (req, reply) => {
      const email = String((req.body as any)?.email || "")
        .trim()
        .toLowerCase()
        .slice(0, 254);
      if (!EMAIL.test(email)) return reply.code(400).send({ ok: false, error: "Invalid email" });
      await prisma.waitlistEntry.upsert({ where: { email }, update: {}, create: { email } });
      return reply.send({ ok: true });
    },
  );

  app.get("/staff/waitlist", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    if ((await getGlobalRole(u.id)) !== "GOD")
      return reply.code(403).send({ ok: false, error: "forbidden" });
    const entries = await prisma.waitlistEntry.findMany({
      orderBy: { createdAt: "asc" },
      select: { email: true, createdAt: true },
    });
    return reply.send({ ok: true, entries });
  });
}
