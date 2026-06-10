import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  getGlobalRole: (userId: string) => Promise<string | null>;
  canAccessStaff: (role: string | null) => boolean;
  broadcastToLobby?: (lobbyId: string, event: any) => void;
  awardNotoriety?: (userId: string, action: string) => Promise<number | null>;
  createNotification?: (opts: any) => Promise<any>;
};

export default async function lfgRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, getGlobalRole, canAccessStaff, broadcastToLobby, awardNotoriety, createNotification } = opts;

  function reliabilityTier(completed: number): string {
    if (completed >= 50) return "Veteran";
    if (completed >= 20) return "Trusted";
    if (completed >= 5)  return "Reliable";
    if (completed >= 1)  return "Proven";
    return "New";
  }
  async function completionCounts(userIds: string[]): Promise<Record<string, number>> {
    const ids = Array.from(new Set(userIds.filter(Boolean)));
    if (ids.length === 0) return {};
    const rows = await (prisma as any).notorietyEvent.groupBy({
      by: ["userId"],
      where: { userId: { in: ids }, action: "LFG_COMPLETED" },
      _count: { _all: true },
    });
    const out: Record<string, number> = {};
    for (const r of rows) out[r.userId] = r._count?._all ?? 0;
    return out;
  }

  app.get("/lfg/:lobbyId", async (req, reply) => {
    const lobbyId = String((req as any).params?.lobbyId || "");
    const posts = await (prisma as any).lfgPost.findMany({
      where: { lobbyId, status: { not: "CLOSED" } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const counts = await completionCounts(posts.map((p: any) => p.userId));
    return reply.send({
      ok: true,
      posts: posts.map((p: any) => ({
        ...p,
        createdAt: p.createdAt?.toISOString(),
        updatedAt: p.updatedAt?.toISOString(),
        scheduledFor: p.scheduledFor?.toISOString() ?? null,
        hostCompleted: counts[p.userId] ?? 0,
        hostTier: reliabilityTier(counts[p.userId] ?? 0),
      })),
    });
  });

  app.get("/users/:userId/reliability", async (req, reply) => {
    const userId = String((req as any).params?.userId || "");
    const counts = await completionCounts([userId]);
    const completed = counts[userId] ?? 0;
    return reply.send({ ok: true, completed, tier: reliabilityTier(completed) });
  });

  app.post("/lfg/:lobbyId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const lobbyId = String((req as any).params?.lobbyId || "");
    const body: any = (req as any).body || {};

    const roleSlots: string[] = Array.isArray(body.roleSlots)
      ? body.roleSlots.map((r: any) => String(r).slice(0, 24)).filter(Boolean).slice(0, 12)
      : [];
    const hasRoles = roleSlots.length > 0;
    const roleClaims = hasRoles ? roleSlots.map((_, i) => (i === 0 ? u.id : "")) : [];
    const roleClaimNames = hasRoles ? roleSlots.map((_, i) => (i === 0 ? u.name : "")) : [];

    const post = await (prisma as any).lfgPost.create({
      data: {
        lobbyId,
        userId: u.id,
        userName: u.name,
        activity: String(body.activity || "").slice(0, 100),
        description: String(body.description || "").slice(0, 300),
        maxPlayers: hasRoles ? roleSlots.length : Math.min(Math.max(Number(body.maxPlayers) || 4, 2), 12),
        platform: String(body.platform || "crossplay").slice(0, 20),
        gameMode: body.gameMode ? String(body.gameMode).slice(0, 30) : null,
        rankTier: body.rankTier ? String(body.rankTier).slice(0, 30) : null,
        region: body.region ? String(body.region).slice(0, 10) : null,
        tags: Array.isArray(body.tags) ? body.tags.map((t: any) => String(t).slice(0, 30)).slice(0, 6) : [],
        metadata: body.metadata || null,
        roleSlots,
        roleClaims,
        roleClaimNames,
        scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
        scheduledTz: String(body.scheduledTz || "").slice(0, 12),
        players: [u.id],
        playerNames: [u.name],
        status: hasRoles && roleSlots.length === 1 ? "FULL" : "OPEN",
      },
    });
    try {
      broadcastToLobby?.(lobbyId, { type: "tavern:posted", lobbyId, postId: post.id, userId: u.id, userName: u.name, activity: post.activity });
    } catch {}
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

  app.post("/lfg/:postId/roles/:index/claim", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const postId = String((req as any).params?.postId || "");
    const index = Number((req as any).params?.index);
    const post = await (prisma as any).lfgPost.findUnique({ where: { id: postId } });
    if (!post) return reply.code(404).send({ ok: false, error: "not_found" });
    if (!Array.isArray(post.roleSlots) || post.roleSlots.length === 0) return reply.code(400).send({ ok: false, error: "not_a_role_post" });
    if (post.status === "CLOSED" || post.status === "COMPLETED") return reply.code(400).send({ ok: false, error: "post_closed" });
    if (index < 0 || index >= post.roleSlots.length) return reply.code(400).send({ ok: false, error: "bad_slot" });
    const claims: string[] = [...post.roleClaims];
    const names: string[] = [...post.roleClaimNames];
    if (claims.includes(u.id)) return reply.code(400).send({ ok: false, error: "already_in", message: "You already hold a slot." });
    if (claims[index]) return reply.code(400).send({ ok: false, error: "slot_taken", message: "That slot is taken." });
    claims[index] = u.id;
    names[index] = u.name;
    const players = claims.filter(Boolean);
    const status = players.length >= post.roleSlots.length ? "FULL" : "OPEN";
    await (prisma as any).lfgPost.update({
      where: { id: postId },
      data: { roleClaims: claims, roleClaimNames: names, players, playerNames: names.filter(Boolean), status },
    });
    if (post.userId !== u.id) {
      createNotification?.({ userId: post.userId, type: "LOBBY_EVENT", title: `${u.name} claimed ${post.roleSlots[index]}`, body: post.activity, actorId: u.id, actorName: u.name, actionUrl: `/lobby/${post.lobbyId}`, meta: { postId } }).catch(() => {});
    }
    return reply.send({ ok: true, status, roleClaims: claims, roleClaimNames: names });
  });

  app.post("/lfg/:postId/roles/release", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const postId = String((req as any).params?.postId || "");
    const post = await (prisma as any).lfgPost.findUnique({ where: { id: postId } });
    if (!post) return reply.code(404).send({ ok: false, error: "not_found" });
    const claims: string[] = [...(post.roleClaims || [])];
    const names: string[] = [...(post.roleClaimNames || [])];
    const idx = claims.indexOf(u.id);
    if (idx === -1) return reply.code(400).send({ ok: false, error: "not_in_post" });
    claims[idx] = "";
    names[idx] = "";
    const players = claims.filter(Boolean);
    const status = players.length === 0 ? "CLOSED" : "OPEN";
    await (prisma as any).lfgPost.update({
      where: { id: postId },
      data: { roleClaims: claims, roleClaimNames: names, players, playerNames: names.filter(Boolean), status },
    });
    return reply.send({ ok: true, status });
  });

  app.post("/lfg/:postId/complete", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const postId = String((req as any).params?.postId || "");
    const post = await (prisma as any).lfgPost.findUnique({ where: { id: postId } });
    if (!post) return reply.code(404).send({ ok: false, error: "not_found" });
    if (post.userId !== u.id) return reply.code(403).send({ ok: false, error: "host_only" });
    await (prisma as any).lfgPost.update({ where: { id: postId }, data: { status: "COMPLETED" } });
    for (const uid of (post.players || [])) awardNotoriety?.(uid, "LFG_COMPLETED").catch(() => {});
    return reply.send({ ok: true, status: "COMPLETED" });
  });
}
