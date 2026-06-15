import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";

type Opts = {
  authFromHeader: (h?: string) => { id: string } | null;
  VAPID_PUBLIC: string;
  sendPush: (userId: string, data: { title: string; body: string; url?: string; tag?: string }) => Promise<void>;
};

export default async function notificationsRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, VAPID_PUBLIC, sendPush } = opts;

  app.post("/push/subscribe", {
  schema: { tags: ["notifications"] },
}, async (req, reply) => {
    const viewer = authFromHeader((req as any).headers?.authorization);
    if (!viewer) return reply.code(401).send({ ok: false, error: "auth" });
    const { endpoint, keys } = req.body as any;
    if (!endpoint || !keys?.p256dh || !keys?.auth) return reply.code(400).send({ ok: false, error: "missing fields" });
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId: viewer.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      update: { userId: viewer.id, p256dh: keys.p256dh, auth: keys.auth },
    });
    return reply.send({ ok: true });
  });

  app.delete("/push/subscribe", {
  schema: { tags: ["notifications"] },
}, async (req, reply) => {
    const viewer = authFromHeader((req as any).headers?.authorization);
    if (!viewer) return reply.code(401).send({ ok: false, error: "auth" });
    const { endpoint } = req.body as any;
    if (!endpoint) return reply.code(400).send({ ok: false, error: "missing endpoint" });
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: viewer.id } });
    return reply.send({ ok: true });
  });

  app.get("/push/vapid-key", async (_req, reply) => {
    return reply.send({ ok: true, key: VAPID_PUBLIC });
  });

  app.post("/push/expo-register", {
  schema: { tags: ["notifications"] },
}, async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const body = (req as any).body || {};
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const platform = typeof body.platform === "string" ? body.platform.slice(0, 10) : null;
    if (!token || !/^ExponentPushToken\[[^\]]+\]$/.test(token)) {
      return reply.code(400).send({ ok: false, error: "invalid_token" });
    }
    await prisma.expoPushToken.upsert({
      where: { token },
      update: { userId: u.id, platform, lastUsedAt: new Date() },
      create: { userId: u.id, token, platform },
    });
    return reply.send({ ok: true });
  });

  app.post("/push/debug", {
  schema: { tags: ["notifications"] },
}, async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    const body = (req as any).body || {};
    console.log('[push/debug]', { userId: u?.id || null, stage: body.stage, error: body.error, info: body.info });
    return reply.send({ ok: true });
  });

  app.delete("/push/expo-register", {
  schema: { tags: ["notifications"] },
}, async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const body = (req as any).body || {};
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) return reply.code(400).send({ ok: false, error: "invalid_token" });
    await prisma.expoPushToken.deleteMany({ where: { token, userId: u.id } }).catch(() => {});
    return reply.send({ ok: true });
  });

  app.post("/push/test", {
  schema: { tags: ["notifications"] },
}, async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const [webSubs, expoTokens] = await Promise.all([
      prisma.pushSubscription.count({ where: { userId: u.id } }),
      prisma.expoPushToken.count({ where: { userId: u.id } }),
    ]);
    if (webSubs === 0 && expoTokens === 0) {
      return reply.send({ ok: false, error: "no_tokens", webSubs, expoTokens });
    }
    await sendPush(u.id, {
      title: "Weered test push",
      body: "If you can see this, your device is wired up.",
      url: "/home",
      tag: "test",
    });
    return reply.send({ ok: true, webSubs, expoTokens });
  });

  app.get("/notifications", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

    const limit = Math.min(Number((req as any).query?.limit) || 50, 100);
    const cursor = (req as any).query?.cursor || undefined;

    const where: any = { userId: u.id };
    if (cursor) where.createdAt = { lt: new Date(cursor) };

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.notification.count({ where: { userId: u.id, read: false } }),
    ]);

    return reply.send({
      ok: true,
      notifications: notifications.map((n: any) => ({
        ...n,
        createdAt: n.createdAt?.toISOString?.() || n.createdAt,
      })),
      unreadCount,
    });
  });

  app.patch("/notifications/read", {
  schema: { tags: ["notifications"] },
}, async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

    const body = (req as any).body || {};

    if (body.all) {
      await prisma.notification.updateMany({
        where: { userId: u.id, read: false },
        data: { read: true },
      });
    } else if (Array.isArray(body.ids) && body.ids.length > 0) {
      await prisma.notification.updateMany({
        where: { id: { in: body.ids }, userId: u.id },
        data: { read: true },
      });
    }

    return reply.send({ ok: true });
  });

  app.delete("/notifications/:id", {
  schema: { tags: ["notifications"], params: z.object({ id: z.string().min(1) }) },
}, async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

    try {
      await prisma.notification.deleteMany({
        where: { id: (req as any).params.id, userId: u.id },
      });
    } catch {}
    return reply.send({ ok: true });
  });

  app.get("/notifications/unread-count", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

    const count = await prisma.notification.count({ where: { userId: u.id, read: false } });
    return reply.send({ ok: true, count });
  });
}
