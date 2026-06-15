import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { z } from "zod";

type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  resolveUserId: (raw: string) => Promise<string>;
  dmDeliver: (peerId: string, payload: any) => void;
  isUserOnline: (userId: string) => boolean;
  sendPush: (userId: string, payload: { title: string; body: string; url?: string; tag?: string }) => Promise<void>;
  resolveMentions?: (text: string, actorId: string) => Promise<{ id: string; name: string }[]>;
  createNotification?: (opts: any) => Promise<void>;
};

const MAX_MEMBERS = 24;
const MAX_BODY    = 2000;
const MAX_NAME    = 60;

export default async function groupRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, dmDeliver, isUserOnline, sendPush, resolveMentions, createNotification } = opts;

  async function activeMemberIds(threadId: string): Promise<string[]> {
    const rows = await (prisma as any).groupMember.findMany({
      where: { threadId, leftAt: null },
      select: { userId: true },
    });
    return rows.map((r: any) => r.userId);
  }

  async function requireMember(threadId: string, userId: string) {
    const m = await (prisma as any).groupMember.findUnique({
      where: { threadId_userId: { threadId, userId } },
    });
    if (!m || m.leftAt) return null;
    return m;
  }

  function deliverToMembers(memberIds: string[], payload: any) {
    for (const id of memberIds) {
      try { dmDeliver(id, payload); } catch {}
    }
  }

  app.get("/groups", async (req, reply) => {
    const viewer = authFromHeader((req.headers as any).authorization);
    if (!viewer) return reply.code(401).send({ error: "Unauthorized" });
    try {
      const memberships = await (prisma as any).groupMember.findMany({
        where: { userId: viewer.id, leftAt: null },
        include: {
          thread: {
            include: {
              members: {
                where: { leftAt: null },
                select: {
                  userId: true,
                  user: { select: { id: true, name: true, avatar: true, usernameKey: true } },
                },
              },
              messages: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { id: true, senderId: true, body: true, createdAt: true, deletedAt: true },
              },
            },
          },
        },
      });

      const threadIds = memberships.map((m: any) => m.threadId);
      const unreadCounts: Record<string, number> = {};
      if (threadIds.length) {
        const grouped = await (prisma as any).groupMessage.groupBy({
          by: ["threadId"],
          where: {
            threadId: { in: threadIds },
            deletedAt: null,
            NOT: { senderId: viewer.id },
            createdAt: { gt: undefined as any },
          },
          _count: { id: true },
        }).catch(() => [] as any[]);
        for (const m of memberships) {
          const c = await (prisma as any).groupMessage.count({
            where: {
              threadId: m.threadId,
              deletedAt: null,
              NOT: { senderId: viewer.id },
              createdAt: { gt: m.lastReadAt },
            },
          });
          unreadCounts[m.threadId] = c;
        }
        void grouped;
      }

      const threads = memberships.map((m: any) => {
        const t = m.thread;
        const last = t.messages[0] || null;
        return {
          id: t.id,
          name: t.name || null,
          createdById: t.createdById,
          createdAt: t.createdAt.toISOString(),
          lastMessageAt: t.lastMessageAt.toISOString(),
          role: m.role,
          unread: unreadCounts[t.id] || 0,
          members: t.members.map((mm: any) => ({
            id: mm.user.id,
            name: mm.user.name,
            avatar: mm.user.avatar,
            usernameKey: mm.user.usernameKey,
          })),
          lastMessage: last ? {
            id: last.id,
            senderId: last.senderId,
            body: last.deletedAt ? "" : (last.body || "").slice(0, 200),
            createdAt: last.createdAt.toISOString(),
            deleted: !!last.deletedAt,
          } : null,
        };
      });
      threads.sort((a: any, b: any) => (b.lastMessageAt > a.lastMessageAt ? 1 : -1));
      return reply.send({ ok: true, threads });
    } catch (e) {
      console.error("[groups GET]", e);
      return reply.code(500).send({ error: "Server error" });
    }
  });

  app.post("/groups", {
  schema: { tags: ["groups"], body: z.object({ name: z.string().optional(), memberIds: z.array(z.string()).optional() }).passthrough() },
}, async (req, reply) => {
    const viewer = authFromHeader((req.headers as any).authorization);
    if (!viewer) return reply.code(401).send({ error: "Unauthorized" });
    const body: any = (req as any).body || {};
    const name = typeof body.name === "string" ? body.name.trim().slice(0, MAX_NAME) : "";
    const rawMembers: string[] = Array.isArray(body.memberIds) ? body.memberIds : [];
    const memberIds = Array.from(new Set(rawMembers.filter(x => typeof x === "string" && x && x !== viewer.id)));
    if (memberIds.length === 0) return reply.code(400).send({ error: "At least one other member required" });
    if (memberIds.length + 1 > MAX_MEMBERS) {
      return reply.code(400).send({ error: `Group capped at ${MAX_MEMBERS} members` });
    }

    try {
      const users = await (prisma as any).user.findMany({
        where: { id: { in: memberIds } },
        select: { id: true },
      });
      const validIds = users.map((u: any) => u.id);
      if (validIds.length === 0) return reply.code(400).send({ error: "No valid members" });

      const thread = await (prisma as any).groupThread.create({
        data: {
          name: name || null,
          createdById: viewer.id,
          members: {
            create: [
              { userId: viewer.id, role: "OWNER" },
              ...validIds.map((id: string) => ({ userId: id, role: "MEMBER" })),
            ],
          },
        },
        include: {
          members: {
            select: {
              userId: true,
              role: true,
              user: { select: { id: true, name: true, avatar: true, usernameKey: true } },
            },
          },
        },
      });

      const allMemberIds = [viewer.id, ...validIds];
      const payload = {
        type: "group:created",
        thread: {
          id: thread.id,
          name: thread.name,
          createdById: thread.createdById,
          createdAt: thread.createdAt.toISOString(),
          lastMessageAt: thread.lastMessageAt.toISOString(),
          members: thread.members.map((m: any) => ({
            id: m.user.id,
            name: m.user.name,
            avatar: m.user.avatar,
            usernameKey: m.user.usernameKey,
          })),
        },
      };
      deliverToMembers(allMemberIds, payload);

      return reply.send({ ok: true, thread: payload.thread });
    } catch (e) {
      console.error("[groups POST]", e);
      return reply.code(500).send({ error: "Server error" });
    }
  });

  app.get("/groups/:id/messages", async (req, reply) => {
    const viewer = authFromHeader((req.headers as any).authorization);
    if (!viewer) return reply.code(401).send({ error: "Unauthorized" });
    const { id } = req.params as any;
    const m = await requireMember(id, viewer.id);
    if (!m) return reply.code(403).send({ error: "Not a member" });
    try {
      const latest = await (prisma as any).groupMessage.findMany({
        where: { threadId: id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true, threadId: true, senderId: true, body: true,
          createdAt: true, editedAt: true, deletedAt: true,
          replyToId: true, replyToUserId: true, replyToUserName: true, replyToBody: true,
        },
      });
      const messages = latest.reverse();
      await (prisma as any).groupMember.update({
        where: { threadId_userId: { threadId: id, userId: viewer.id } },
        data: { lastReadAt: new Date() },
      });
      return reply.send({
        ok: true,
        messages: messages.map((mm: any) => ({
          ...mm,
          createdAt: mm.createdAt.toISOString(),
          editedAt: mm.editedAt?.toISOString() ?? null,
          deletedAt: mm.deletedAt?.toISOString() ?? null,
        })),
      });
    } catch (e) {
      console.error("[groups/messages GET]", e);
      return reply.code(500).send({ error: "Server error" });
    }
  });

  app.post("/groups/:id/messages", {
  schema: { tags: ["groups"], params: z.object({ id: z.string().min(1) }), body: z.object({ body: z.string().min(1) }).passthrough() },
}, async (req, reply) => {
    const viewer = authFromHeader((req.headers as any).authorization);
    if (!viewer) return reply.code(401).send({ error: "Unauthorized" });
    const { id } = req.params as any;
    const body: any = (req as any).body || {};
    const text = typeof body.body === "string" ? body.body.trim().slice(0, MAX_BODY) : "";
    if (!text) return reply.code(400).send({ error: "Empty message" });

    const m = await requireMember(id, viewer.id);
    if (!m) return reply.code(403).send({ error: "Not a member" });

    let replyData: any = {};
    const rawReplyToId = typeof body.replyToId === "string" ? body.replyToId : "";
    if (rawReplyToId) {
      try {
        const parent = await (prisma as any).groupMessage.findUnique({
          where: { id: rawReplyToId },
          select: { id: true, threadId: true, senderId: true, body: true, deletedAt: true },
        });
        if (parent && !parent.deletedAt && parent.threadId === id) {
          const parentUser = await (prisma as any).user.findUnique({
            where: { id: parent.senderId }, select: { name: true },
          });
          replyData = {
            replyToId: parent.id,
            replyToUserId: parent.senderId,
            replyToUserName: parentUser?.name || "?",
            replyToBody: String(parent.body || "").slice(0, 120),
          };
        }
      } catch {}
    }

    try {
      const msg = await (prisma as any).groupMessage.create({
        data: { threadId: id, senderId: viewer.id, body: text, ...replyData },
        select: {
          id: true, threadId: true, senderId: true, body: true, createdAt: true,
          replyToId: true, replyToUserId: true, replyToUserName: true, replyToBody: true,
        },
      });
      await (prisma as any).groupThread.update({
        where: { id },
        data: { lastMessageAt: msg.createdAt },
      });
      await (prisma as any).groupMember.update({
        where: { threadId_userId: { threadId: id, userId: viewer.id } },
        data: { lastReadAt: msg.createdAt },
      });

      const memberIds = await activeMemberIds(id);
      const payload = {
        type: "group:message",
        message: {
          ...msg,
          createdAt: msg.createdAt.toISOString(),
          senderName: viewer.name,
        },
      };
      deliverToMembers(memberIds, payload);

      const offlinePushes = memberIds
        .filter(uid => uid !== viewer.id && !isUserOnline(uid))
        .map(uid => sendPush(uid, {
          title: `Group from ${viewer.name}`,
          body: text.slice(0, 120),
          url: "/home",
          tag: `group:${id}`,
        }).catch(() => {}));
      Promise.all(offlinePushes).catch(() => {});

      if (resolveMentions && createNotification) {
        (async () => {
          try {
            const mentioned = await resolveMentions(text, viewer.id);
            if (!mentioned.length) return;
            const memberSet = new Set(memberIds);
            for (const u of mentioned) {
              if (!memberSet.has(u.id)) continue;
              if (u.id === viewer.id) continue;
              createNotification({
                userId: u.id,
                type: "MENTION",
                title: `${viewer.name} mentioned you in a group`,
                body: text.slice(0, 120),
                actorId: viewer.id,
                actorName: viewer.name,
                actionUrl: "/home",
                meta: { groupId: id },
              }).catch(() => {});
            }
          } catch {}
        })();
      }

      return reply.send({ ok: true, message: payload.message });
    } catch (e) {
      console.error("[groups/messages POST]", e);
      return reply.code(500).send({ error: "Server error" });
    }
  });

  app.patch("/groups/:id/messages/:msgId", {
  schema: { tags: ["groups"], params: z.object({ id: z.string().min(1), msgId: z.string().min(1) }) },
}, async (req, reply) => {
    const viewer = authFromHeader((req.headers as any).authorization);
    if (!viewer) return reply.code(401).send({ error: "Unauthorized" });
    const { id, msgId } = req.params as any;
    const m = await requireMember(id, viewer.id);
    if (!m) return reply.code(403).send({ error: "Not a member" });
    const body: any = (req as any).body || {};
    const text = typeof body.body === "string" ? body.body.trim().slice(0, MAX_BODY) : "";
    if (!text) return reply.code(400).send({ error: "Empty message" });
    try {
      const existing = await (prisma as any).groupMessage.findUnique({
        where: { id: msgId },
        select: { id: true, threadId: true, senderId: true, body: true, createdAt: true, deletedAt: true },
      });
      if (!existing || existing.threadId !== id) return reply.code(404).send({ error: "Not found" });
      if (existing.deletedAt) return reply.code(400).send({ error: "Deleted" });
      if (existing.senderId !== viewer.id) return reply.code(403).send({ error: "Not your message" });
      if (Date.now() - new Date(existing.createdAt).getTime() > 15 * 60 * 1000) {
        return reply.code(400).send({ error: "Too old to edit" });
      }
      const updated = await (prisma as any).groupMessage.update({
        where: { id: msgId },
        data: { body: text, editedAt: new Date() },
        select: { id: true, threadId: true, body: true, editedAt: true },
      });
      const memberIds = await activeMemberIds(id);
      deliverToMembers(memberIds, {
        type: "group:edited",
        threadId: id,
        msgId,
        body: updated.body,
        editedAt: updated.editedAt.toISOString(),
      });
      return reply.send({ ok: true });
    } catch (e) {
      console.error("[groups/messages PATCH]", e);
      return reply.code(500).send({ error: "Server error" });
    }
  });

  app.delete("/groups/:id/messages/:msgId", {
  schema: { tags: ["groups"], params: z.object({ id: z.string().min(1), msgId: z.string().min(1) }) },
}, async (req, reply) => {
    const viewer = authFromHeader((req.headers as any).authorization);
    if (!viewer) return reply.code(401).send({ error: "Unauthorized" });
    const { id, msgId } = req.params as any;
    const m = await requireMember(id, viewer.id);
    if (!m) return reply.code(403).send({ error: "Not a member" });
    try {
      const existing = await (prisma as any).groupMessage.findUnique({
        where: { id: msgId },
        select: { id: true, threadId: true, senderId: true, deletedAt: true },
      });
      if (!existing || existing.threadId !== id) return reply.code(404).send({ error: "Not found" });
      if (existing.deletedAt) return reply.send({ ok: true });
      const isOwn = existing.senderId === viewer.id;
      if (!isOwn && m.role !== "OWNER") return reply.code(403).send({ error: "Not allowed" });
      const now = new Date();
      await (prisma as any).groupMessage.update({
        where: { id: msgId },
        data: { deletedAt: now, body: "" },
      });
      const memberIds = await activeMemberIds(id);
      deliverToMembers(memberIds, {
        type: "group:deleted",
        threadId: id,
        msgId,
        deletedAt: now.toISOString(),
      });
      return reply.send({ ok: true });
    } catch (e) {
      console.error("[groups/messages DELETE]", e);
      return reply.code(500).send({ error: "Server error" });
    }
  });

  app.patch("/groups/:id/read", {
  schema: { tags: ["groups"], params: z.object({ id: z.string().min(1) }) },
}, async (req, reply) => {
    const viewer = authFromHeader((req.headers as any).authorization);
    if (!viewer) return reply.code(401).send({ error: "Unauthorized" });
    const { id } = req.params as any;
    const m = await requireMember(id, viewer.id);
    if (!m) return reply.code(403).send({ error: "Not a member" });
    try {
      await (prisma as any).groupMember.update({
        where: { threadId_userId: { threadId: id, userId: viewer.id } },
        data: { lastReadAt: new Date() },
      });
      return reply.send({ ok: true });
    } catch (e) {
      console.error("[groups/read PATCH]", e);
      return reply.code(500).send({ error: "Server error" });
    }
  });

  app.patch("/groups/:id", {
  schema: { tags: ["groups"], params: z.object({ id: z.string().min(1) }) },
}, async (req, reply) => {
    const viewer = authFromHeader((req.headers as any).authorization);
    if (!viewer) return reply.code(401).send({ error: "Unauthorized" });
    const { id } = req.params as any;
    const m = await requireMember(id, viewer.id);
    if (!m) return reply.code(403).send({ error: "Not a member" });
    if (m.role !== "OWNER") return reply.code(403).send({ error: "Owner only" });
    const body: any = (req as any).body || {};
    const name = typeof body.name === "string" ? body.name.trim().slice(0, MAX_NAME) : "";
    try {
      const updated = await (prisma as any).groupThread.update({
        where: { id },
        data: { name: name || null },
        select: { id: true, name: true },
      });
      const memberIds = await activeMemberIds(id);
      deliverToMembers(memberIds, { type: "group:renamed", threadId: id, name: updated.name });
      return reply.send({ ok: true, name: updated.name });
    } catch (e) {
      console.error("[groups PATCH]", e);
      return reply.code(500).send({ error: "Server error" });
    }
  });

  app.post("/groups/:id/members", {
  schema: { tags: ["groups"], params: z.object({ id: z.string().min(1) }) },
}, async (req, reply) => {
    const viewer = authFromHeader((req.headers as any).authorization);
    if (!viewer) return reply.code(401).send({ error: "Unauthorized" });
    const { id } = req.params as any;
    const m = await requireMember(id, viewer.id);
    if (!m) return reply.code(403).send({ error: "Not a member" });
    if (m.role !== "OWNER") return reply.code(403).send({ error: "Owner only" });
    const body: any = (req as any).body || {};
    const ids: string[] = Array.isArray(body.memberIds) ? body.memberIds : [];
    const cleaned = Array.from(new Set(ids.filter(x => typeof x === "string" && x)));
    if (cleaned.length === 0) return reply.code(400).send({ error: "No members to add" });

    try {
      const existing = await (prisma as any).groupMember.findMany({
        where: { threadId: id, userId: { in: cleaned } },
      });
      const existingMap = new Map(existing.map((r: any) => [r.userId, r]));

      const activeCount = await (prisma as any).groupMember.count({ where: { threadId: id, leftAt: null } });
      const room = MAX_MEMBERS - activeCount;
      if (room <= 0) return reply.code(400).send({ error: "Group full" });

      const adds: string[] = [];
      const reactivations: string[] = [];
      for (const uid of cleaned) {
        if (adds.length + reactivations.length >= room) break;
        const row: any = existingMap.get(uid);
        if (!row) adds.push(uid);
        else if (row.leftAt) reactivations.push(uid);
      }

      if (adds.length) {
        await (prisma as any).groupMember.createMany({
          data: adds.map(userId => ({ threadId: id, userId, role: "MEMBER" })),
          skipDuplicates: true,
        });
      }
      if (reactivations.length) {
        await (prisma as any).groupMember.updateMany({
          where: { threadId: id, userId: { in: reactivations } },
          data: { leftAt: null, joinedAt: new Date(), lastReadAt: new Date() },
        });
      }

      const memberIds = await activeMemberIds(id);
      deliverToMembers(memberIds, { type: "group:members:added", threadId: id, added: [...adds, ...reactivations] });
      return reply.send({ ok: true, added: [...adds, ...reactivations] });
    } catch (e) {
      console.error("[groups/members POST]", e);
      return reply.code(500).send({ error: "Server error" });
    }
  });

  app.delete("/groups/:id/members/:userId", {
  schema: { tags: ["groups"], params: z.object({ id: z.string().min(1), userId: z.string().min(1) }) },
}, async (req, reply) => {
    const viewer = authFromHeader((req.headers as any).authorization);
    if (!viewer) return reply.code(401).send({ error: "Unauthorized" });
    const { id, userId } = req.params as any;
    const me = await requireMember(id, viewer.id);
    if (!me) return reply.code(403).send({ error: "Not a member" });
    const target = await requireMember(id, userId);
    if (!target) return reply.code(404).send({ error: "Target not in group" });
    const isSelf = userId === viewer.id;
    if (!isSelf && me.role !== "OWNER") return reply.code(403).send({ error: "Owner only" });

    try {
      await (prisma as any).groupMember.update({
        where: { threadId_userId: { threadId: id, userId } },
        data: { leftAt: new Date() },
      });
      const memberIds = await activeMemberIds(id);
      deliverToMembers([...memberIds, userId], { type: "group:members:removed", threadId: id, userId });
      return reply.send({ ok: true });
    } catch (e) {
      console.error("[groups/members DELETE]", e);
      return reply.code(500).send({ error: "Server error" });
    }
  });
}
