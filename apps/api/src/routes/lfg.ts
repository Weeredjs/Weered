import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

// /lfg/* — Looking-For-Group / fireteam board, scoped per lobby. Posts
// have a max party size and join/leave semantics; status flips OPEN →
// FULL → CLOSED based on roster size and explicit close.
type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  getGlobalRole: (userId: string) => Promise<string | null>;
  canAccessStaff: (role: string | null) => boolean;
};

export default async function lfgRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, getGlobalRole, canAccessStaff } = opts;

  app.get("/lfg/:lobbyId", async (req, reply) => {
    const lobbyId = String((req as any).params?.lobbyId || "");
    const posts = await (prisma as any).lfgPost.findMany({
      where: { lobbyId, status: { not: "CLOSED" } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return reply.send({
      ok: true,
      posts: posts.map((p: any) => ({
        ...p,
        createdAt: p.createdAt?.toISOString(),
        updatedAt: p.updatedAt?.toISOString(),
      })),
    });
  });

  app.post("/lfg/:lobbyId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const lobbyId = String((req as any).params?.lobbyId || "");
    const body: any = (req as any).body || {};

    const post = await (prisma as any).lfgPost.create({
      data: {
        lobbyId,
        userId: u.id,
        userName: u.name,
        activity: String(body.activity || "").slice(0, 100),
        description: String(body.description || "").slice(0, 300),
        maxPlayers: Math.min(Math.max(Number(body.maxPlayers) || 4, 2), 12),
        platform: String(body.platform || "crossplay").slice(0, 20),
        gameMode: body.gameMode ? String(body.gameMode).slice(0, 30) : null,
        rankTier: body.rankTier ? String(body.rankTier).slice(0, 30) : null,
        region: body.region ? String(body.region).slice(0, 10) : null,
        tags: Array.isArray(body.tags) ? body.tags.map((t: any) => String(t).slice(0, 30)).slice(0, 6) : [],
        metadata: body.metadata || null,
        players: [u.id],
        playerNames: [u.name],
        status: "OPEN",
      },
    });
    return reply.send({ ok: true, post });
  });

  app.post("/lfg/:postId/join", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const postId = String((req as any).params?.postId || "");

    const post = await (prisma as any).lfgPost.findUnique({ where: { id: postId } });
    if (!post) return reply.code(404).send({ ok: false, error: "not_found" });
    if (post.status !== "OPEN") return reply.code(400).send({ ok: false, error: "post_not_open", message: "This fireteam is no longer open." });
    if (post.players.includes(u.id)) return reply.code(400).send({ ok: false, error: "already_joined", message: "You're already in this fireteam." });
    if (post.players.length >= post.maxPlayers) return reply.code(400).send({ ok: false, error: "full", message: "This fireteam is full." });

    const players = [...post.players, u.id];
    const playerNames = [...post.playerNames, u.name];
    const status = players.length >= post.maxPlayers ? "FULL" : "OPEN";

    await (prisma as any).lfgPost.update({
      where: { id: postId },
      data: { players, playerNames, status },
    });
    return reply.send({ ok: true, players, playerNames, status });
  });

  app.post("/lfg/:postId/leave", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const postId = String((req as any).params?.postId || "");

    const post = await (prisma as any).lfgPost.findUnique({ where: { id: postId } });
    if (!post) return reply.code(404).send({ ok: false, error: "not_found" });

    const idx = post.players.indexOf(u.id);
    if (idx === -1) return reply.code(400).send({ ok: false, error: "not_in_post" });

    const players = post.players.filter((p: string) => p !== u.id);
    const playerNames = [...post.playerNames];
    playerNames.splice(idx, 1);
    const status = players.length === 0 ? "CLOSED" : "OPEN";

    await (prisma as any).lfgPost.update({
      where: { id: postId },
      data: { players, playerNames, status },
    });
    return reply.send({ ok: true, status });
  });

  app.delete("/lfg/:postId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const postId = String((req as any).params?.postId || "");

    const post = await (prisma as any).lfgPost.findUnique({ where: { id: postId } });
    if (!post) return reply.code(404).send({ ok: false, error: "not_found" });

    const gr = await getGlobalRole(u.id);
    if (post.userId !== u.id && !canAccessStaff(gr)) {
      return reply.code(403).send({ ok: false, error: "not_owner" });
    }

    await (prisma as any).lfgPost.update({ where: { id: postId }, data: { status: "CLOSED" } });
    return reply.send({ ok: true });
  });
}
