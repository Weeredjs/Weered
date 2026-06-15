import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { z } from "zod";

type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  resolveUserId: (raw: string) => Promise<string>;
  fetchReactionsForTargets: (targetType: string, ids: string[]) => Promise<Record<string, any[]>>;
  dmDeliver: (peerId: string, payload: any) => void;
  isUserOnline: (userId: string) => boolean;
  sendPush: (userId: string, payload: { title: string; body: string; url?: string; tag?: string }) => Promise<void>;
};

export default async function dmRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, resolveUserId, fetchReactionsForTargets, dmDeliver, isUserOnline, sendPush } = opts;

app.get("/dm/conversations", async (req, reply) => {
  const viewer = authFromHeader((req.headers as any).authorization);
  if (!viewer) return reply.code(401).send({ error: "Unauthorized" });
  const msgs = await prisma.directMessage.findMany({
    where: { OR: [{ fromId: viewer.id }, { toId: viewer.id }] },
    orderBy: { createdAt: "desc" },
    select: { fromId: true, toId: true, body: true, createdAt: true, readAt: true },
  });
  const peers = new Map<string, any>();
  for (const m of msgs) {
    const peerId = m.fromId === viewer.id ? m.toId : m.fromId;
    if (!peers.has(peerId)) peers.set(peerId, { peerId, lastMessage: m.body, lastAt: m.createdAt, unread: 0 });
    if (m.toId === viewer.id && !m.readAt) peers.get(peerId).unread++;
  }
  const peerIds = Array.from(peers.keys());
  const users = await prisma.user.findMany({ where: { id: { in: peerIds } }, select: { id: true, name: true, usernameKey: true, avatar: true, avatarColor: true } as any });
  const result = users.map((u: any) => ({ ...u, online: isUserOnline(u.id), ...peers.get(u.id) }));
  return reply.send({ ok: true, conversations: result });
});

app.get("/dm/unread", async (req, reply) => {
  const viewer = authFromHeader((req.headers as any).authorization);
  if (!viewer) return reply.code(401).send({ error: "Unauthorized" });
  try {
    const unread = await prisma.directMessage.groupBy({
      by: ["fromId"],
      where: { toId: viewer.id, readAt: null },
      _count: { id: true },
    });
    const counts: Record<string, number> = {};
    for (const row of unread) counts[row.fromId] = row._count.id;
    return reply.send({ counts });
  } catch (e) {
    console.error("[dm/unread]", e);
    return reply.code(500).send({ error: "Server error" });
  }
});

app.get("/dm/previews", async (req, reply) => {
  const u = authFromHeader(req.headers.authorization);
  if (!u) return reply.code(401).send({ ok: false });

  const recentDms = await (prisma as any).directMessage.findMany({
    where: { OR: [{ fromId: u.id }, { toId: u.id }] },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, fromId: true, toId: true, body: true, createdAt: true, readAt: true },
  });

  const byPeer = new Map<string, any>();
  for (const dm of recentDms) {
    const peerId = dm.fromId === u.id ? dm.toId : dm.fromId;
    if (!byPeer.has(peerId)) {
      byPeer.set(peerId, {
        peerId,
        lastMessage: dm.body?.slice(0, 100),
        lastTs: dm.createdAt,
        isFromMe: dm.fromId === u.id,
        unread: dm.toId === u.id && !dm.readAt,
      });
    }
  }

  const peers = [...byPeer.values()].slice(0, 5);

  const peerIds = peers.map((p: any) => p.peerId);
  const users = peerIds.length > 0 ? await (prisma as any).user.findMany({
    where: { id: { in: peerIds } },
    select: { id: true, name: true, avatar: true },
  }) : [];
  const userMap = new Map<string, any>(users.map((u: any) => [u.id, u]));

  const previews = peers.map(p => ({
    ...p,
    peerName: userMap.get(p.peerId)?.name || "Unknown",
    peerAvatar: userMap.get(p.peerId)?.avatar || null,
  }));

  return reply.send({ ok: true, previews });
});

app.get("/dm/:peerId", async (req, reply) => {
  const viewer = authFromHeader((req.headers as any).authorization);
  if (!viewer) return reply.code(401).send({ error: "Unauthorized" });
  const { peerId: rawPeerId } = req.params as any;
  if (!rawPeerId) return reply.code(400).send({ error: "Missing peerId" });
  const peerId = await resolveUserId(rawPeerId);
  try {
    const latest = await prisma.directMessage.findMany({
      where: { OR: [{ fromId: viewer.id, toId: peerId }, { fromId: peerId, toId: viewer.id }] },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, fromId: true, toId: true, body: true, createdAt: true, readAt: true, editedAt: true, deletedAt: true, replyToId: true, replyToUserId: true, replyToUserName: true, replyToBody: true } as any,
    });
    const messages = latest.reverse();
    await prisma.directMessage.updateMany({
      where: { fromId: peerId, toId: viewer.id, readAt: null },
      data: { readAt: new Date() },
    });
    const reactionsByMsg = await fetchReactionsForTargets("DIRECT_MESSAGE", messages.map(m => m.id));
    return reply.send({ messages: messages.map((m: any) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
      readAt: m.readAt?.toISOString() ?? null,
      editedAt: (m as any).editedAt?.toISOString() ?? null,
      deletedAt: (m as any).deletedAt?.toISOString() ?? null,
      reactions: reactionsByMsg[m.id] || [],
    })) });
  } catch (e) {
    console.error("[dm GET]", e);
    return reply.code(500).send({ error: "Server error" });
  }
});

app.post("/dm/:peerId", {
  schema: { tags: ["dm"], params: z.object({ peerId: z.string().min(1) }), body: z.object({ body: z.string().min(1) }).passthrough() },
}, async (req, reply) => {
  const viewer = authFromHeader((req.headers as any).authorization);
  if (!viewer) return reply.code(401).send({ error: "Unauthorized" });
  const { peerId: rawPeerId } = req.params as any;
  const peerId = await resolveUserId(rawPeerId);
  const body: any = (req as any).body || {};
  const text = typeof body.body === "string" ? body.body.trim().slice(0, 2000) : "";
  if (!text) return reply.code(400).send({ error: "Empty message" });

  let replyData: any = {};
  const rawReplyToId = typeof body.replyToId === "string" ? body.replyToId : "";
  if (rawReplyToId) {
    try {
      const parent = await prisma.directMessage.findUnique({ where: { id: rawReplyToId } });
      if (parent && !(parent as any).deletedAt) {
        const sameThread =
          (parent.fromId === viewer.id && parent.toId === peerId) ||
          (parent.fromId === peerId && parent.toId === viewer.id);
        if (sameThread) {
          const parentUser = await prisma.user.findUnique({ where: { id: parent.fromId }, select: { name: true } });
          replyData = {
            replyToId: parent.id,
            replyToUserId: parent.fromId,
            replyToUserName: parentUser?.name || "?",
            replyToBody: String(parent.body || "").slice(0, 120),
          };
        }
      }
    } catch {}
  }

  try {
    const dm = await prisma.directMessage.create({
      data: { fromId: viewer.id, toId: peerId, body: text, ...replyData },
      select: { id: true, fromId: true, toId: true, body: true, createdAt: true, replyToId: true, replyToUserId: true, replyToUserName: true, replyToBody: true } as any,
    });
    const payload = { type: "dm:message", message: { ...dm, createdAt: (dm as any).createdAt.toISOString() } };
    dmDeliver(peerId, payload);
    if (!isUserOnline(peerId)) {
      sendPush(peerId, { title: `DM from ${viewer.name}`, body: text.slice(0, 120), url: "/home", tag: `dm:${viewer.id}` }).catch(() => {});
    }
    return reply.send({ ok: true, message: { ...dm, createdAt: (dm as any).createdAt.toISOString() } });
  } catch (e) {
    console.error("[dm POST]", e);
    return reply.code(500).send({ error: "Server error" });
  }
});

app.patch("/dm/:peerId/read", {
  schema: { tags: ["dm"], params: z.object({ peerId: z.string().min(1) }) },
}, async (req, reply) => {
  const viewer = authFromHeader((req.headers as any).authorization);
  if (!viewer) return reply.code(401).send({ error: "Unauthorized" });
  const { peerId } = req.params as any;
  try {
    await prisma.directMessage.updateMany({
      where: { fromId: peerId, toId: viewer.id, readAt: null },
      data: { readAt: new Date() },
    });
    return reply.send({ ok: true });
  } catch (e) {
    console.error("[dm/read PATCH]", e);
    return reply.code(500).send({ error: "Server error" });
  }
});
}
