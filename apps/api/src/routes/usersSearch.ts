import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

// Public user search (extracted from index.ts). Stateless, unauthenticated.
export default async function usersSearchRoutes(app: FastifyInstance) {
  app.get("/users/search", async (req, reply) => {
    const q = String((req.query as any).q ?? "").trim();
    if (!q || q.length < 2) return reply.send({ ok: true, users: [] });
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { usernameKey: { contains: q.toLowerCase() } },
        ],
        banned: false,
      },
      select: {
        id: true,
        name: true,
        usernameKey: true,
        avatar: true,
        avatarColor: true,
        tier: true,
        notoriety: true,
      },
      orderBy: { notoriety: "desc" },
      take: 25,
    });
    return reply.send({ ok: true, users });
  });
}
