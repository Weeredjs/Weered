import { EventStatus, PromotionStatus } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { randomUUID } from "crypto";

type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  getGlobalRole: (userId: string) => Promise<string | null>;
  canAssignRoles: (role: string | null) => boolean;
  canAccessStaff: (role: string | null) => boolean;
  broadcastEvent: (title: string, when: Date) => void;
  globalAudit: (
    actorId: string,
    actorName: string,
    type: string,
    targetId?: string,
    note?: string,
    meta?: any,
  ) => Promise<void>;
  lobbyAdminAccess: (
    req: any,
    reply: any,
    requiredLevel: number,
  ) => Promise<{ user: { id: string; name: string }; lobby: { id: string } } | null>;
};

export default async function eventsRoutes(app: FastifyInstance, opts: Opts) {
  const {
    authFromHeader,
    getGlobalRole,
    canAssignRoles,
    canAccessStaff,
    broadcastEvent,
    globalAudit,
    lobbyAdminAccess,
  } = opts;

  app.get("/staff/events", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const q: any = (req as any).query || {};
    const where: any = {};
    if (q.status) where.status = String(q.status).toUpperCase();
    if (q.scope === "global") where.lobbyId = null;
    else if (q.scope === "lobby") where.lobbyId = { not: null };
    if (q.q) where.title = { contains: String(q.q), mode: "insensitive" };
    const events = await prisma.event.findMany({
      where,
      orderBy: { startsAt: "desc" },
      take: Math.min(Number(q.limit) || 50, 200),
      skip: Number(q.offset) || 0,
      include: { lobby: { select: { id: true, name: true } } },
    });
    return reply.send({ ok: true, events });
  });

  app.get("/staff/events/promotions", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const events = await prisma.event.findMany({
      where: { promotionStatus: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: { lobby: { select: { id: true, name: true } } },
    });
    return reply.send({ ok: true, events });
  });

  app.post("/staff/events", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const body: any = (req as any).body || {};
    const title = String(body.title || "").trim();
    if (!title) return reply.code(400).send({ ok: false, error: "title_required" });
    const event = await prisma.event.create({
      data: {
        title,
        description: String(body.description || "").trim(),
        category: String(body.category || "").trim(),
        coverImageUrl: body.coverImageUrl ? String(body.coverImageUrl).trim() : null,
        startsAt: new Date(body.startsAt || Date.now()),
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        timezone: String(body.timezone || "UTC"),
        status: (["DRAFT", "PUBLISHED"].includes(String(body.status || "").toUpperCase())
          ? String(body.status).toUpperCase()
          : "DRAFT") as EventStatus,
        broadcastOnPublish: Boolean(body.broadcastOnPublish),
        createdById: u.id,
        createdByName: u.name,
        lobbyId: null,
      },
    });
    if (event.status === "PUBLISHED" && event.broadcastOnPublish) {
      broadcastEvent(event.title, event.startsAt);
    }
    await globalAudit(u.id, u.name, "event_create", event.id, event.title, {
      category: event.category,
      status: event.status,
    });
    return reply.send({ ok: true, event });
  });

  app.patch("/staff/events/:id", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const eventId = String((req as any).params?.id || "");
    const existing = await prisma.event.findUnique({ where: { id: eventId } });
    if (!existing) return reply.code(404).send({ ok: false, error: "event_not_found" });
    const body: any = (req as any).body || {};
    const data: any = {};
    if (body.title !== undefined) data.title = String(body.title).trim();
    if (body.description !== undefined) data.description = String(body.description).trim();
    if (body.category !== undefined) data.category = String(body.category).trim();
    if (body.coverImageUrl !== undefined)
      data.coverImageUrl = body.coverImageUrl ? String(body.coverImageUrl).trim() : null;
    if (body.startsAt !== undefined) data.startsAt = new Date(body.startsAt);
    if (body.endsAt !== undefined) data.endsAt = body.endsAt ? new Date(body.endsAt) : null;
    if (body.timezone !== undefined) data.timezone = String(body.timezone);
    if (body.status !== undefined) data.status = String(body.status).toUpperCase();
    if (body.broadcastOnPublish !== undefined)
      data.broadcastOnPublish = Boolean(body.broadcastOnPublish);
    const event = await prisma.event.update({ where: { id: eventId }, data });
    if (
      data.status === "PUBLISHED" &&
      existing.status !== "PUBLISHED" &&
      event.broadcastOnPublish
    ) {
      broadcastEvent(event.title, event.startsAt);
    }
    await globalAudit(u.id, u.name, "event_update", event.id, event.title, {
      changes: Object.keys(data),
    });
    return reply.send({ ok: true, event });
  });

  app.delete("/staff/events/:id", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const eventId = String((req as any).params?.id || "");
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return reply.code(404).send({ ok: false, error: "event_not_found" });
    await prisma.event.delete({ where: { id: eventId } });
    await globalAudit(u.id, u.name, "event_delete", eventId, event.title);
    return reply.send({ ok: true });
  });

  app.post("/staff/events/:id/promotion-review", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const eventId = String((req as any).params?.id || "");
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return reply.code(404).send({ ok: false, error: "event_not_found" });
    if (event.promotionStatus !== "PENDING")
      return reply.code(400).send({ ok: false, error: "not_pending" });
    const body: any = (req as any).body || {};
    const decision = String(body.decision || "").toUpperCase();
    if (!["APPROVED", "DENIED"].includes(decision))
      return reply.code(400).send({ ok: false, error: "invalid_decision" });
    const updated = await prisma.event.update({
      where: { id: eventId },
      data: {
        promotionStatus: decision as PromotionStatus,
        promotionReviewedById: u.id,
        promotionReviewedByName: u.name,
        promotionReviewedAt: new Date(),
        promotionDenyReason:
          decision === "DENIED" ? String(body.reason || "").trim() || null : null,
      },
    });
    await globalAudit(u.id, u.name, "event_promotion_review", eventId, event.title, {
      decision,
      reason: body.reason,
    });
    return reply.send({ ok: true, event: updated });
  });

  app.get("/lobbies/:id/events", async (req, reply) => {
    const lobbyId = String((req as any).params?.id || "");
    const lobby = await prisma.lobby.findUnique({ where: { id: lobbyId } });
    if (!lobby) return reply.code(404).send({ ok: false, error: "lobby_not_found" });
    const q: any = (req as any).query || {};
    const u = authFromHeader((req as any).headers?.authorization);
    let showAll = false;
    if (u) {
      const member = await prisma.lobbyMember.findUnique({
        where: { lobbyId_userId: { lobbyId, userId: u.id } },
      });
      if (member && (member.roleLevel ?? 1) >= 4) showAll = true;
      const gr = await getGlobalRole(u.id);
      if (canAccessStaff(gr)) showAll = true;
    }
    const where: any = { lobbyId };
    if (!showAll) where.status = "PUBLISHED";
    const events = await prisma.event.findMany({
      where,
      orderBy: { startsAt: "asc" },
      take: Math.min(Number(q.limit) || 50, 200),
    });
    return reply.send({ ok: true, events });
  });

  app.post("/lobbies/:id/events", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 4);
    if (!ctx) return;
    const body: any = (req as any).body || {};
    const title = String(body.title || "").trim();
    if (!title) return reply.code(400).send({ ok: false, error: "title_required" });
    const event = await prisma.event.create({
      data: {
        title,
        description: String(body.description || "").trim(),
        category: String(body.category || "").trim(),
        coverImageUrl: body.coverImageUrl ? String(body.coverImageUrl).trim() : null,
        startsAt: new Date(body.startsAt || Date.now()),
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        timezone: String(body.timezone || "UTC"),
        status: (["DRAFT", "PUBLISHED"].includes(String(body.status || "").toUpperCase())
          ? String(body.status).toUpperCase()
          : "DRAFT") as EventStatus,
        createdById: ctx.user.id,
        createdByName: ctx.user.name,
        lobbyId: ctx.lobby.id,
      },
    });
    await prisma.lobbyAudit.create({
      data: {
        id: randomUUID(),
        lobbyId: ctx.lobby.id,
        type: "event_create",
        actorId: ctx.user.id,
        actorName: ctx.user.name,
        note: title,
      },
    });
    return reply.send({ ok: true, event });
  });

  app.patch("/lobbies/:id/events/:eventId", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 4);
    if (!ctx) return;
    const eventId = String((req as any).params?.eventId || "");
    const existing = await prisma.event.findFirst({
      where: { id: eventId, lobbyId: ctx.lobby.id },
    });
    if (!existing) return reply.code(404).send({ ok: false, error: "event_not_found" });
    const body: any = (req as any).body || {};
    const data: any = {};
    if (body.title !== undefined) data.title = String(body.title).trim();
    if (body.description !== undefined) data.description = String(body.description).trim();
    if (body.category !== undefined) data.category = String(body.category).trim();
    if (body.coverImageUrl !== undefined)
      data.coverImageUrl = body.coverImageUrl ? String(body.coverImageUrl).trim() : null;
    if (body.startsAt !== undefined) data.startsAt = new Date(body.startsAt);
    if (body.endsAt !== undefined) data.endsAt = body.endsAt ? new Date(body.endsAt) : null;
    if (body.timezone !== undefined) data.timezone = String(body.timezone);
    if (body.status !== undefined) data.status = String(body.status).toUpperCase();
    const event = await prisma.event.update({ where: { id: eventId }, data });
    await prisma.lobbyAudit.create({
      data: {
        id: randomUUID(),
        lobbyId: ctx.lobby.id,
        type: "event_update",
        actorId: ctx.user.id,
        actorName: ctx.user.name,
        targetId: eventId,
        note: existing.title,
      },
    });
    return reply.send({ ok: true, event });
  });

  app.delete("/lobbies/:id/events/:eventId", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 4);
    if (!ctx) return;
    const eventId = String((req as any).params?.eventId || "");
    const event = await prisma.event.findFirst({
      where: { id: eventId, lobbyId: ctx.lobby.id },
    });
    if (!event) return reply.code(404).send({ ok: false, error: "event_not_found" });
    await prisma.event.delete({ where: { id: eventId } });
    await prisma.lobbyAudit.create({
      data: {
        id: randomUUID(),
        lobbyId: ctx.lobby.id,
        type: "event_delete",
        actorId: ctx.user.id,
        actorName: ctx.user.name,
        note: event.title,
      },
    });
    return reply.send({ ok: true });
  });

  app.post("/lobbies/:id/events/:eventId/promote", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 5);
    if (!ctx) return;
    const eventId = String((req as any).params?.eventId || "");
    const event = await prisma.event.findFirst({
      where: { id: eventId, lobbyId: ctx.lobby.id },
    });
    if (!event) return reply.code(404).send({ ok: false, error: "event_not_found" });
    if (event.status !== "PUBLISHED")
      return reply.code(400).send({ ok: false, error: "must_be_published" });
    if (event.promotionStatus !== "NONE")
      return reply.code(400).send({ ok: false, error: "already_requested" });
    const body: any = (req as any).body || {};
    const updated = await prisma.event.update({
      where: { id: eventId },
      data: {
        promotionStatus: "PENDING",
        promotionNote:
          String(body.note || "")
            .trim()
            .slice(0, 500) || null,
      },
    });
    await prisma.lobbyAudit.create({
      data: {
        id: randomUUID(),
        lobbyId: ctx.lobby.id,
        type: "event_promote_request",
        actorId: ctx.user.id,
        actorName: ctx.user.name,
        note: event.title,
      },
    });
    return reply.send({ ok: true, event: updated });
  });

  app.get("/events/upcoming", async (req, reply) => {
    const q: any = (req as any).query || {};
    const events = await prisma.event.findMany({
      where: {
        status: "PUBLISHED",
        startsAt: { gte: new Date() },
        OR: [{ lobbyId: null }, { promotionStatus: "APPROVED" }],
      },
      orderBy: { startsAt: "asc" },
      take: Math.min(Number(q.limit) || 20, 100),
      include: { lobby: { select: { id: true, name: true, logoUrl: true } } },
    });
    return reply.send({ ok: true, events });
  });

  app.get("/events/:id", async (req, reply) => {
    const eventId = String((req as any).params?.id || "");
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { lobby: { select: { id: true, name: true, logoUrl: true } } },
    });
    if (!event) return reply.code(404).send({ ok: false, error: "event_not_found" });
    return reply.send({ ok: true, event });
  });
}
