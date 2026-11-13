import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { prisma } from "../lib/prisma";
import { sizeProblem } from "../lib/fieldSize";
import { swallow } from "../lib/logger";

// What the mod sends, and how long each may be. A Minecraft name is 16
// characters and a UUID 36; a server address is a host name and a port. These
// were stored at any length (hardening pass, 2026-11-13).
const MC_LIMITS = {
  code: 16,
  mcUuid: 64,
  mcUsername: 32,
  serverAddress: 255,
  serverName: 100,
  worldName: 100,
} as const;
const text = (v: unknown): string =>
  typeof v === "string" || typeof v === "number" ? String(v) : "";

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
  if (!/^Bearer\s/.test(authHeader)) return null;
  const token = authHeader.replace(/^Bearer\s+/, "").trim();
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
      // No account yet at this step, so the limit is by address: each code is
      // a row.
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (_req, reply) => {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      // Codes live five minutes; day-old ones are swept here so the table
      // holds what is in use, not every code ever handed out.
      await prisma.mcPairingCode
        .deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 24 * 3600_000) } } })
        .catch(swallow);
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
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const body = req.body as any;
      const big = sizeProblem(body, MC_LIMITS);
      if (big) return reply.code(400).send({ ok: false, ...big });
      const code = text(body?.code).trim().toUpperCase();
      if (!code) return reply.code(400).send({ ok: false, error: "missing_code" });

      const row = await prisma.mcPairingCode.findUnique({ where: { code } });
      if (!row) return reply.code(404).send({ ok: false, error: "code_not_found" });
      if (row.consumedAt) return reply.code(400).send({ ok: false, error: "code_already_used" });
      if (row.expiresAt && row.expiresAt < new Date()) {
        return reply.code(400).send({ ok: false, error: "code_expired" });
      }

      const mcUuid = text(body?.mcUuid) || null;
      const mcUsername = text(body?.mcUsername) || null;

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
      // The mod asks every couple of seconds for the code's five minutes.
      config: { rateLimit: { max: 120, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const body = req.body as any;
      const code = text(body?.code).trim().toUpperCase().slice(0, MC_LIMITS.code);
      if (!code) return reply.code(400).send({ ok: false, error: "missing_code" });

      const row = await prisma.mcPairingCode.findUnique({ where: { code } });
      if (!row) return reply.code(404).send({ ok: false, error: "code_not_found" });
      if (row.expiresAt && row.expiresAt < new Date()) {
        return reply.code(400).send({ ok: false, error: "code_expired" });
      }

      if (!row.consumedAt || !row.userId) {
        return reply.send({ ok: true, confirmed: false });
      }

      // The token goes out once. Polling needs no auth (the mod has no session),
      // so anyone who saw the code on screen could collect the same token for
      // the code's whole five minutes (audit 2026-09-27). Clearing it here,
      // atomically, means only the first poll after confirm (normally the mod's
      // own) receives it; the credential itself lives on the game account.
      const taken = await prisma.mcPairingCode.updateMany({
        where: { code, token: { not: null } },
        data: { token: null },
      });
      if (taken.count !== 1 || !row.token) {
        return reply.code(410).send({ ok: false, error: "already_delivered" });
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
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const auth = await userFromModToken((req as any).headers?.authorization);
      if (!auth) return reply.code(401).send({ ok: false, error: "unauthorized" });

      const body = req.body as any;
      const big = sizeProblem(body, MC_LIMITS);
      if (big) return reply.code(400).send({ ok: false, ...big });
      const serverAddress = text(body?.serverAddress).trim();
      if (!serverAddress) return reply.code(400).send({ ok: false, error: "missing_server" });

      const mcUuid = text(body?.mcUuid) || auth.mcUuid || "";
      const mcUsername = text(body?.mcUsername);
      const serverName = text(body?.serverName) || null;
      const worldName = text(body?.worldName) || null;

      // A player is on one server at a time. Rows for the servers they have
      // left were kept for good (only "leave" removed one, and a crash or a
      // closed laptop never sends it): one per address ever reported.
      await prisma.mcPresence
        .deleteMany({
          where: {
            userId: auth.userId,
            serverAddress: { not: serverAddress },
            lastSeenAt: { lt: new Date(Date.now() - 10 * 60_000) },
          },
        })
        .catch(swallow);

      await prisma.mcPresence.upsert({
        where: { userId_serverAddress: { userId: auth.userId, serverAddress } },
        update: {
          lastSeenAt: new Date(),
          serverName,
          isRealm: !!body?.isRealm,
          worldName,
          mcUuid,
          mcUsername,
        },
        create: {
          userId: auth.userId,
          mcUuid,
          mcUsername,
          serverAddress,
          serverName,
          isRealm: !!body?.isRealm,
          worldName,
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
    const serverAddress = text(q.serverAddress).trim().slice(0, MC_LIMITS.serverAddress);
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
      const serverAddress = text(body?.serverAddress).trim().slice(0, MC_LIMITS.serverAddress);
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
