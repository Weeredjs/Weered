import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

// /notifications/* + /push/* — in-app notification list + web push
// (VAPID) + Expo push tokens for the mobile app. Push subscribes/
// unsubscribes write to prisma.pushSubscription; Expo tokens write to
// prisma.expoPushToken. Delivery happens elsewhere (sendPush in main).
//
// Note: the original /push/subscribe and /push/subscribe DELETE
// referenced an undefined extractViewer — swapped to authFromHeader,
// same shape, silently unbreaks web-push sub/unsub.
type Opts = {
  authFromHeader: (h?: string) => { id: string } | null;
  VAPID_PUBLIC: string;
  sendPush: (userId: string, data: { title: string; body: string; url?: string; tag?: string }) => Promise<void>;
};

export default async function notificationsRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, VAPID_PUBLIC, sendPush } = opts;

  // ── Web push (VAPID) ────────────────────────────────────────────────

  app.post("/push/subscribe", async (req, reply) => {
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

  app.delete("/push/subscribe", async (req, reply) => {
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

  // ── Expo push (mobile) ─────────────────────────────────────────────

  app.post("/push/expo-register", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const body = (req as any).body || {};
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const platform = typeof body.platform === "string" ? body.platform.slice(0, 10) : null;
    if (!token || !/^ExponentPushToken\[[^\]]+\]$/.test(token)) {
      return reply.code(400).send({ ok: false, error: "invalid_token" });
    }
    await (prisma as any).expoPushToken.upsert({
      where: { token },
      update: { userId: u.id, platform, lastUsedAt: new Date() },
      create: { userId: u.id, token, platform },
    });
    return reply.send({ ok: true });
  });

  app.delete("/push/expo-register", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const body = (req as any).body || {};
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) return reply.code(400).send({ ok: false, error: "invalid_token" });
    await (prisma as any).expoPushToken.deleteMany({ where: { token, userId: u.id } }).catch(() => {});
    return reply.send({ ok: true });
  });

  // Self-test: fires a push to every registered transport for the caller.
  // Returns counts of web-push subs + Expo tokens it tried to deliver to so
  // the client can tell the difference between "no tokens registered" and
  // "tokens exist but Expo dropped them."
  app.post("/push/test", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const [webSubs, expoTokens] = await Promise.all([
      prisma.pushSubscription.count({ where: { userId: u.id } }),
      (prisma as any).expoPushToken.count({ where: { userId: u.id } }),
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

  // ── In-app notifications ────────────────────────────────────────────

  app.get("/notifications", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

    const limit = Math.min(Number((req as any).query?.limit) || 50, 100);
    const cursor = (req as any).query?.cursor || undefined;

    const where: any = { userId: u.id };
    if (cursor) where.createdAt = { lt: new Date(cursor) };

    const [notifications, unreadCount] = await Promise.all([
      (prisma as any).notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      (prisma as any).notification.count({ where: { userId: u.id, read: false } }),
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

  app.patch("/notifications/read", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

    const body = (req as any).body || {};

    if (body.all) {
      await (prisma as any).notification.updateMany({
        where: { userId: u.id, read: false },
        data: { read: true },
      });
    } else if (Array.isArray(body.ids) && body.ids.length > 0) {
      await (prisma as any).notification.updateMany({
        where: { id: { in: body.ids }, userId: u.id },
        data: { read: true },
      });
    }

    return reply.send({ ok: true });
  });

  app.delete("/notifications/:id", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

    try {
      await (prisma as any).notification.deleteMany({
        where: { id: (req as any).params.id, userId: u.id },
      });
    } catch {}
    return reply.send({ ok: true });
  });

  app.get("/notifications/unread-count", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

    const count = await (prisma as any).notification.count({ where: { userId: u.id, read: false } });
    return reply.send({ ok: true, count });
  });
}
