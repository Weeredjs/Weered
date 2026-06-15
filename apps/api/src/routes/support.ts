import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

type Opts = {
  authFromHeader: (h: any) => any;
  getGlobalRole: (id: string) => Promise<string>;
  canAccessStaff: (role: string) => boolean;
};

export default async function supportRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, getGlobalRole, canAccessStaff } = opts;

  app.get<{ Querystring: { take?: string; skip?: string } }>("/bans/public", async (req, reply) => {
    const take = Math.min(Math.max(Number(req.query?.take || 50), 1), 100);
    const skip = Math.max(Number(req.query?.skip || 0), 0);
    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where: { banned: true },
        select: { id: true, name: true, banReason: true, bannedAt: true },
        orderBy: { bannedAt: "desc" },
        skip,
        take,
      }),
      prisma.user.count({ where: { banned: true } }),
    ]);
    return reply.send({ ok: true, total, rows });
  });

  app.post<{
    Body: { username?: string; password?: string; reason?: string };
  }>(
    "/bans/appeal",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
    },
    async (req, reply) => {
      const body = req.body || {};
      const username = (body.username || "").trim().toLowerCase().slice(0, 32);
      const password = (body.password || "").trim();
      const reason = (body.reason || "").trim().slice(0, 2000);
      if (!username || !password)
        return reply.code(400).send({ ok: false, error: "missing_credentials" });
      if (reason.length < 20)
        return reply.code(400).send({
          ok: false,
          error: "reason_too_short",
          message: "Tell us at least 20 characters of context.",
        });

      const la = await prisma.localAuth.findUnique({ where: { username } }).catch(() => null);
      if (!la) return reply.code(401).send({ ok: false, error: "invalid_credentials" });
      const ok = await bcrypt.compare(password, la.passwordHash);
      if (!ok) return reply.code(401).send({ ok: false, error: "invalid_credentials" });

      const user = await prisma.user.findUnique({
        where: { id: la.userId },
        select: { id: true, banned: true },
      });
      if (!user) return reply.code(401).send({ ok: false, error: "invalid_credentials" });
      if (!user.banned)
        return reply
          .code(400)
          .send({ ok: false, error: "not_banned", message: "Your account is not banned." });

      const open = await prisma.banAppeal.findFirst({
        where: { userId: user.id, status: "PENDING" },
        select: { id: true, createdAt: true },
      });
      if (open)
        return reply.code(409).send({
          ok: false,
          error: "already_pending",
          appealId: open.id,
          submittedAt: open.createdAt,
        });

      const created = await prisma.banAppeal.create({
        data: { userId: user.id, reason, status: "PENDING" },
        select: { id: true, createdAt: true },
      });
      return reply.send({ ok: true, appealId: created.id, submittedAt: created.createdAt });
    },
  );

  app.get<{ Querystring: { status?: string; take?: string } }>(
    "/staff/ban-appeals",
    async (req, reply) => {
      const u = authFromHeader(req.headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const role = await getGlobalRole(u.id);
      if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

      const status = String(req.query?.status || "PENDING").toUpperCase();
      const take = Math.min(Math.max(Number(req.query?.take || 100), 1), 200);
      const where = status === "ALL" ? {} : { status };
      const rows = await prisma.banAppeal.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        include: {
          user: {
            select: { id: true, name: true, banReason: true, bannedAt: true, bannedBy: true },
          },
        },
      });
      return reply.send({ ok: true, rows });
    },
  );

  app.post<{
    Params: { id: string };
    Body: { decision?: string; note?: string };
  }>("/staff/ban-appeals/:id/review", async (req, reply) => {
    const u = authFromHeader(req.headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const decision = String(req.body?.decision || "").toUpperCase();
    if (decision !== "APPROVED" && decision !== "DENIED") {
      return reply.code(400).send({
        ok: false,
        error: "decision_required",
        message: "decision must be APPROVED or DENIED",
      });
    }
    const note = (req.body?.note || "").slice(0, 1000);
    const appealId = req.params.id;

    const appeal = await prisma.banAppeal.findUnique({ where: { id: appealId } });
    if (!appeal) return reply.code(404).send({ ok: false, error: "not_found" });
    if (appeal.status !== "PENDING")
      return reply.code(400).send({ ok: false, error: "already_reviewed" });

    await prisma.$transaction(async (tx) => {
      await tx.banAppeal.update({
        where: { id: appealId },
        data: {
          status: decision,
          reviewedBy: u.id,
          reviewerNote: note || null,
          reviewedAt: new Date(),
        },
      });
      if (decision === "APPROVED") {
        await tx.user.update({
          where: { id: appeal.userId },
          data: { banned: false, banReason: null, bannedAt: null, bannedBy: null },
        });
      }
    });
    return reply.send({ ok: true });
  });

  const VALID_CATEGORIES = new Set(["BUG", "LOBBY_MODULE_REQUEST", "FEEDBACK"]);
  app.post<{
    Body: { body?: string; page?: string; category?: string };
  }>(
    "/bugs",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 hour" } },
    },
    async (req, reply) => {
      const u = authFromHeader(req.headers?.authorization);
      const body = (req.body?.body || "").trim().slice(0, 4000);
      const page = (req.body?.page || "").slice(0, 200);
      const userAgent = String(req.headers?.["user-agent"] || "").slice(0, 500);
      const rawCat = String(req.body?.category || "BUG").toUpperCase();
      const category = VALID_CATEGORIES.has(rawCat) ? rawCat : "BUG";
      if (body.length < 10)
        return reply.code(400).send({
          ok: false,
          error: "body_too_short",
          message: "Tell us at least 10 characters of context.",
        });
      const created = await prisma.bugReport.create({
        data: { userId: u?.id || null, body, page, userAgent, category },
        select: { id: true, createdAt: true },
      });
      return reply.send({ ok: true, id: created.id, submittedAt: created.createdAt });
    },
  );

  app.get<{ Querystring: { status?: string; take?: string; category?: string } }>(
    "/staff/bugs",
    async (req, reply) => {
      const u = authFromHeader(req.headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const role = await getGlobalRole(u.id);
      if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

      const status = String(req.query?.status || "OPEN").toUpperCase();
      const take = Math.min(Math.max(Number(req.query?.take || 100), 1), 200);
      const cat = String(req.query?.category || "").toUpperCase();
      const where: any = {};
      if (status !== "ALL") where.status = status;
      if (cat && VALID_CATEGORIES.has(cat)) where.category = cat;
      const rows = await prisma.bugReport.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        include: {
          user: { select: { id: true, name: true } },
        },
      });
      return reply.send({ ok: true, rows });
    },
  );

  app.post<{
    Params: { id: string };
    Body: { note?: string };
  }>("/staff/bugs/:id/close", async (req, reply) => {
    const u = authFromHeader(req.headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const note = (req.body?.note || "").slice(0, 1000);
    const id = req.params.id;
    const existing = await prisma.bugReport.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ ok: false, error: "not_found" });
    await prisma.bugReport.update({
      where: { id },
      data: { status: "CLOSED", closedAt: new Date(), closedBy: u.id, staffNote: note || null },
    });
    return reply.send({ ok: true });
  });
}
