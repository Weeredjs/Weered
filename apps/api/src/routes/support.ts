import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { APPEAL_COOLDOWN_MS } from "../lib/banAppeal";
import { createNotification } from "../lib/notifications";
import { cleanContact, takeContactMessage } from "../lib/contactMessage";

type Opts = {
  authFromHeader: (h: any) => any;
  getGlobalRole: (id: string) => Promise<string>;
  canAccessStaff: (role: string) => boolean;
  globalAudit: (
    actorId: string,
    actorName: string,
    action: string,
    targetId?: string,
    targetName?: string,
    meta?: any,
  ) => Promise<void>;
};

export default async function supportRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, getGlobalRole, canAccessStaff, globalAudit } = opts;

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
        select: { id: true, banned: true, banReason: true },
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

      // A denied appeal waits 30 days before the next (it could be refiled at once).
      const denied = await prisma.banAppeal.findFirst({
        where: {
          userId: user.id,
          status: "DENIED",
          reviewedAt: { gt: new Date(Date.now() - APPEAL_COOLDOWN_MS) },
        },
        orderBy: { reviewedAt: "desc" },
        select: { reviewedAt: true },
      });
      if (denied?.reviewedAt) {
        const after = new Date(denied.reviewedAt.getTime() + APPEAL_COOLDOWN_MS);
        return reply.code(429).send({
          ok: false,
          error: "recently_denied",
          retryAfter: after.toISOString(),
          message: `Your last appeal was denied. You can appeal again after ${after.toDateString()}.`,
        });
      }

      const created = await prisma.banAppeal.create({
        // The ban's reason as it stood, so the history keeps it after an unban.
        data: { userId: user.id, reason, status: "PENDING", banReason: user.banReason },
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

    const appeal = await prisma.banAppeal.findUnique({
      where: { id: appealId },
      include: { user: { select: { name: true, banReason: true } } },
    });
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
          banReason: appeal.banReason ?? appeal.user?.banReason ?? null,
        },
      });
      if (decision === "APPROVED") {
        await tx.user.update({
          where: { id: appeal.userId },
          data: { banned: false, banReason: null, bannedAt: null, bannedBy: null },
        });
      }
    });
    await globalAudit(
      u.id,
      u.name,
      decision === "APPROVED" ? "appeal_approved" : "appeal_denied",
      appeal.userId,
      appeal.user?.name,
      { note: note || undefined, banReason: appeal.banReason ?? appeal.user?.banReason },
    );
    // The person is told: a denial at their next sign-in (lib/banAppeal.ts),
    // an approval here, with the note "shown to the user" that never was.
    if (decision === "APPROVED")
      await createNotification({
        userId: appeal.userId,
        type: "SYSTEM",
        title: "Your appeal was approved. Welcome back.",
        body: note,
      });
    return reply.send({ ok: true });
  });

  // The contact form (weered.ca/contact): anyone, signed in or not. Kept in
  // Ops as kind CONTACT and emailed with the sender as reply-to
  // (lib/contactMessage.ts). "website" is a field people never see: a bot
  // that fills it is told "sent" and nothing is kept.
  app.post<{ Body: { name?: string; email?: string; message?: string; website?: string } }>(
    "/contact",
    { config: { rateLimit: { max: 5, timeWindow: "1 hour" } } },
    async (req, reply) => {
      if (String(req.body?.website || "").trim()) return reply.send({ ok: true });
      const c = cleanContact(req.body);
      if ("error" in c) return reply.code(400).send({ ok: false, error: c.error });
      const u = authFromHeader(req.headers?.authorization);
      const r = await takeContactMessage(c, {
        userId: u?.id || null,
        userAgent: String(req.headers?.["user-agent"] || ""),
      });
      return reply.send({ ok: true, id: r.id });
    },
  );

  const VALID_CATEGORIES = new Set(["BUG", "LOBBY_MODULE_REQUEST", "FEEDBACK"]);
  // Ops lists the contact form's messages too; members can't file one as a bug.
  const LISTED_CATEGORIES = new Set([...VALID_CATEGORIES, "CONTACT"]);
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
      if (cat && LISTED_CATEGORIES.has(cat)) where.category = cat;
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
    await globalAudit(u.id, u.name, "bug_close", id, existing.body.slice(0, 80), {
      note: note || undefined,
    });
    return reply.send({ ok: true });
  });

  // A closed report could never be reopened (ops audit 2026-11-01).
  app.post<{ Params: { id: string } }>("/staff/bugs/:id/reopen", async (req, reply) => {
    const u = authFromHeader(req.headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const existing = await prisma.bugReport.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.code(404).send({ ok: false, error: "not_found" });
    await prisma.bugReport.update({
      where: { id: existing.id },
      data: { status: "OPEN", closedAt: null, closedBy: null },
    });
    await globalAudit(u.id, u.name, "bug_reopen", existing.id, existing.body.slice(0, 80));
    return reply.send({ ok: true });
  });
}
