import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { prisma } from "../lib/prisma";

function randomToken(len = 32): string {
  return crypto.randomBytes(len).toString("base64url");
}

function randomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[crypto.randomInt(0, alphabet.length)];
  return out;
}

type Opts = {
  authFromHeader: (h?: string) => { id: string } | null;
};

async function userFromModToken(
  authHeader: string | undefined,
): Promise<{ userId: string; mcUuid: string | null } | null> {
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/);
  if (!m) return null;
  const token = m[1].trim();
  if (!token) return null;
  const acct = await prisma.userGameAccount.findFirst({
    where: { gameType: "MINECRAFT", accessToken: token },
  });
  if (!acct) return null;
  return { userId: acct.userId, mcUuid: acct.externalId || null };
}

export default async function mcRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader } = opts;

  app.post(
    "/mc/pair/start",
    {
      schema: { tags: ["mc"] },
    },
    async (_req, reply) => {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = randomCode();
        try {
          await prisma.mcPairingCode.create({
            data: { code, expiresAt },
          });
          return reply.send({ ok: true, code, expiresAt });
        } catch (e: any) {
          if (e?.code === "P2002") continue;
          throw e;
        }
      }
      return reply.code(500).send({ ok: false, error: "could_not_generate_code" });
    },
  );

  app.post(
    "/mc/pair/confirm",
    {
      schema: { tags: ["mc"] },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const body = req.body as any;
      const code = String(body?.code || "")
        .trim()
        .toUpperCase();
      if (!code) return reply.code(400).send({ ok: false, error: "missing_code" });

      const row = await prisma.mcPairingCode.findUnique({ where: { code } });
      if (!row) return reply.code(404).send({ ok: false, error: "code_not_found" });
      if (row.consumedAt) return reply.code(400).send({ ok: false, error: "code_already_used" });
      if (row.expiresAt && row.expiresAt < new Date()) {
        return reply.code(400).send({ ok: false, error: "code_expired" });
      }

      const mcUuid = body?.mcUuid ? String(body.mcUuid) : null;
      const mcUsername = body?.mcUsername ? String(body.mcUsername) : null;

      const token = randomToken(32);
      await prisma.userGameAccount.upsert({
        where: { userId_gameType: { userId: u.id, gameType: "MINECRAFT" } },
        update: {
          accessToken: token,
          externalId: mcUuid,
          displayName: mcUsername || "",
          platform: "java",
        },
        create: {
          userId: u.id,
          gameType: "MINECRAFT",
          accessToken: token,
          externalId: mcUuid,
          displayName: mcUsername || "",
          platform: "java",
        },
      });

      await prisma.mcPairingCode.update({
        where: { code },
        data: { userId: u.id, token, mcUuid, mcUsername, consumedAt: new Date() },
      });

      return reply.send({ ok: true });
    },
  );

  app.post(
    "/mc/pair/poll",
    {
      schema: { tags: ["mc"] },
    },
    async (req, reply) => {
      const body = req.body as any;
      const code = String(body?.code || "")
        .trim()
        .toUpperCase();
      if (!code) return reply.code(400).send({ ok: false, error: "missing_code" });

      const row = await prisma.mcPairingCode.findUnique({ where: { code } });
      if (!row) return reply.code(404).send({ ok: false, error: "code_not_found" });
      if (row.expiresAt && row.expiresAt < new Date()) {
        return reply.code(400).send({ ok: false, error: "code_expired" });
      }

      if (!row.consumedAt || !row.token || !row.userId) {
        return reply.send({ ok: true, confirmed: false });
      }

      const user = await prisma.user.findUnique({
        where: { id: row.userId },
        select: { id: true, name: true },
      });
      return reply.send({
        ok: true,
        confirmed: true,
        token: row.token,
        userId: row.userId,
        displayName: user?.name || null,
      });
    },
  );

  app.post(
    "/mc/presence",
    {
      schema: { tags: ["mc"] },
    },
    async (req, reply) => {
      const auth = await userFromModToken((req as any).headers?.authorization);
      if (!auth) return reply.code(401).send({ ok: false, error: "unauthorized" });

      const body = req.body as any;
      const serverAddress = String(body?.serverAddress || "").trim();
      if (!serverAddress) return reply.code(400).send({ ok: false, error: "missing_server" });

      const mcUuid = body?.mcUuid ? String(body.mcUuid) : auth.mcUuid || "";
      const mcUsername = body?.mcUsername ? String(body.mcUsername) : "";

      await prisma.mcPresence.upsert({
        where: { userId_serverAddress: { userId: auth.userId, serverAddress } },
        update: {
          lastSeenAt: new Date(),
          serverName: body?.serverName || null,
          isRealm: !!body?.isRealm,
          worldName: body?.worldName || null,
          mcUuid,
          mcUsername,
        },
        create: {
          userId: auth.userId,
          mcUuid,
          mcUsername,
          serverAddress,
          serverName: body?.serverName || null,
          isRealm: !!body?.isRealm,
          worldName: body?.worldName || null,
        },
      });

      if (mcUsername || mcUuid) {
        await prisma.userGameAccount.updateMany({
          where: { userId: auth.userId, gameType: "MINECRAFT" },
          data: {
            ...(mcUuid ? { externalId: mcUuid } : {}),
            ...(mcUsername ? { displayName: mcUsername } : {}),
          },
        });
      }

      return reply.send({ ok: true });
    },
  );

  app.get("/mc/presence/server", async (req, reply) => {
    const auth = await userFromModToken((req as any).headers?.authorization);
    if (!auth) return reply.code(401).send({ ok: false, error: "unauthorized" });

    const q: any = (req as any).query || {};
    const serverAddress = String(q.serverAddress || "").trim();
    if (!serverAddress) return reply.code(400).send({ ok: false, error: "missing_server" });

    const fresh = new Date(Date.now() - 3 * 60 * 1000);
    const rows = await prisma.mcPresence.findMany({
      where: { serverAddress, lastSeenAt: { gte: fresh } },
      orderBy: { lastSeenAt: "desc" },
      take: 50,
    });

    const userIds = Array.from(new Set(rows.map((r: any) => r.userId))) as string[];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, avatar: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));

    const players = rows.map((r: any) => {
      const u = byId.get(r.userId);
      return {
        userId: r.userId,
        weeredName: u?.name || null,
        weeredAvatar: u?.avatar || null,
        mcUsername: r.mcUsername,
        mcUuid: r.mcUuid,
        worldName: r.worldName,
        lastSeenAt: r.lastSeenAt,
      };
    });

    return reply.send({ ok: true, players });
  });

  app.post(
    "/mc/presence/leave",
    {
      schema: { tags: ["mc"] },
    },
    async (req, reply) => {
      const auth = await userFromModToken((req as any).headers?.authorization);
      if (!auth) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const body = req.body as any;
      const serverAddress = String(body?.serverAddress || "").trim();
      if (!serverAddress) return reply.send({ ok: true });
      await prisma.mcPresence.deleteMany({
        where: { userId: auth.userId, serverAddress },
      });
      return reply.send({ ok: true });
    },
  );

  app.get("/mc/me", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const acct = await prisma.userGameAccount.findFirst({
      where: { userId: u.id, gameType: "MINECRAFT" },
    });
    if (!acct) return reply.send({ ok: true, linked: false });
    return reply.send({
      ok: true,
      linked: true,
      mcUuid: acct.externalId,
      mcUsername: acct.displayName,
      linkedAt: acct.createdAt,
    });
  });

  app.post(
    "/mc/unlink",
    {
      schema: { tags: ["mc"] },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      await prisma.userGameAccount.deleteMany({
        where: { userId: u.id, gameType: "MINECRAFT" },
      });
      await prisma.mcPresence.deleteMany({ where: { userId: u.id } });
      return reply.send({ ok: true });
    },
  );
}
