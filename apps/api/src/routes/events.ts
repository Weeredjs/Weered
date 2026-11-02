import { EventStatus } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { randomUUID } from "crypto";

type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  getGlobalRole: (userId: string) => Promise<string | null>;
  canAccessStaff: (role: string | null) => boolean;
  lobbyAdminAccess: (
    req: any,
    reply: any,
    requiredLevel: number,
  ) => Promise<{ user: { id: string; name: string }; lobby: { id: string } } | null>;
};

export default async function eventsRoutes(app: FastifyInstance, opts: Opts) {
  // Site-wide events and the staff tab that made them were cut 2026-11-02
  // (James: they never showed anywhere on the site); lobby events stay.
  const { authFromHeader, getGlobalRole, canAccessStaff, lobbyAdminAccess } = opts;

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
    // ?from=<ISO date>: only events starting then or later.
    const from = typeof q.from === "string" ? new Date(q.from) : null;
    if (from && !Number.isNaN(from.getTime())) where.startsAt = { gte: from };
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
