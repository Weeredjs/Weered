import { log, swallow } from "../lib/logger";
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { GlobalRole, ReportStatus, SubTier } from "@prisma/client";
import { randomUUID } from "crypto";

type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  getGlobalRole: (userId: string) => Promise<string | null>;
  canAccessStaff: (role: string | null) => boolean;
  canAssignRoles: (role: string | null) => boolean;
  globalAudit: (
    actorId: string,
    actorName: string,
    type: string,
    targetId?: string,
    note?: string,
    meta?: any,
  ) => Promise<void>;
  broadcast: (room: any, payload: any) => void;
  broadcastEvent: (title: string, when: Date) => void;
  rooms: Map<string, any>;
  send: (sock: any, payload: any) => void;
  getWss: () => any;
  shortRoomId: (n: number) => string;
  getAllSiteConfig: () => Promise<Record<string, any>>;
  setSiteConfig: (key: string, value: any) => Promise<void>;
  SITE_CONFIG_DEFAULTS: Record<string, any>;
  getSiteConfig: (key: string) => Promise<any>;
  isModOrOwner: (room: any, userId?: string, globalRole?: string | null) => boolean;
  audit: (room: any, item: any) => void;
  publishState: (room: any) => void;
  findSocketsByUser: (room: any, userId: string) => any[];
};

export default async function staffRoutes(app: FastifyInstance, opts: Opts) {
  const {
    authFromHeader,
    getGlobalRole,
    canAccessStaff,
    canAssignRoles,
    globalAudit,
    broadcast,
    broadcastEvent,
    rooms,
    send,
    getWss,
    shortRoomId,
    getAllSiteConfig,
    setSiteConfig,
    SITE_CONFIG_DEFAULTS,
    getSiteConfig,
    isModOrOwner,
    audit,
    publishState,
    findSocketsByUser,
  } = opts;

  app.get("/staff/me", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    return reply.send({ ok: true, globalRole: role });
  });

  app.get("/staff/users", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const q = String((req as any).query?.q || "")
      .trim()
      .toLowerCase();
    const users = await prisma.user.findMany({
      where: q
        ? { OR: [{ usernameKey: { contains: q } }, { name: { contains: q, mode: "insensitive" } }] }
        : {},
      select: {
        id: true,
        name: true,
        usernameKey: true,
        globalRole: true,
        tier: true,
        notoriety: true,
        email: true,
        banned: true,
        banReason: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return reply.send({ ok: true, users });
  });

  app.post("/staff/users/:userId/role", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const actorRole = await getGlobalRole(u.id);
    if (!canAssignRoles(actorRole)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const targetId = String((req as any).params?.userId || "");
    const body: any = (req as any).body || {};
    const newRole = String(body.role || "USER").toUpperCase() as GlobalRole;
    if (!Object.values(GlobalRole).includes(newRole))
      return reply.code(400).send({ ok: false, error: "invalid_role" });
    if (
      actorRole !== GlobalRole.GOD &&
      (newRole === GlobalRole.STAFF || newRole === GlobalRole.GOD)
    ) {
      return reply.code(403).send({ ok: false, error: "insufficient_rank" });
    }
    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, name: true, globalRole: true },
    });
    if (!target) return reply.code(404).send({ ok: false, error: "user_not_found" });
    if (target.globalRole === GlobalRole.GOD && actorRole !== GlobalRole.GOD) {
      return reply.code(403).send({ ok: false, error: "cannot_modify_god" });
    }
    await prisma.user.update({ where: { id: targetId }, data: { globalRole: newRole } });
    await globalAudit(u.id, u.name, "role_change", targetId, target.name, {
      from: target.globalRole,
      to: newRole,
    });
    for (const sock of (getWss()?.clients ?? []) as any) {
      if ((sock as any).user?.id === targetId) (sock as any).user.globalRole = newRole;
    }
    for (const [, room] of rooms) {
      const entry = room.users.get(targetId);
      if (entry) {
        (entry as any).globalRole = newRole;
        broadcast(room, { type: "presence:join", roomId: room.roomId, user: entry });
      }
    }
    return reply.send({ ok: true, userId: targetId, globalRole: newRole });
  });

  app.post("/staff/users/:userId/note", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const targetId = String((req as any).params?.userId || "");
    const body: any = (req as any).body || {};
    const text = String(body.body || "")
      .trim()
      .slice(0, 2000);
    if (!text) return reply.code(400).send({ ok: false, error: "empty_note" });
    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { name: true },
    });
    if (!target) return reply.code(404).send({ ok: false, error: "user_not_found" });
    const note = await prisma.staffNote.create({
      data: { targetId, authorId: u.id, authorName: u.name, body: text },
    });
    await globalAudit(u.id, u.name, "staff_note", targetId, target.name, { noteId: note.id });
    return reply.send({ ok: true, note });
  });

  app.get("/staff/users/:userId/notes", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const targetId = String((req as any).params?.userId || "");
    const notes = await prisma.staffNote.findMany({
      where: { targetId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return reply.send({ ok: true, notes });
  });

  app.get("/staff/audit", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const logs = await prisma.globalAudit.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    return reply.send({ ok: true, logs });
  });

  app.post("/staff/lobby/lock", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const lid = String((req.body as any)?.lobbyId || "lobby");
    const room = rooms.get(lid);
    if (room) room.locked = true;
    await globalAudit(u.id, u.name, "lobby_lock", lid);
    if (room) broadcast(room, { type: "room:locked", roomId: lid });
    return reply.send({ ok: true });
  });

  app.post("/staff/lobby/unlock", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const lid = String((req.body as any)?.lobbyId || "lobby");
    const room = rooms.get(lid);
    if (room) room.locked = false;
    await globalAudit(u.id, u.name, "lobby_unlock", lid);
    if (room) broadcast(room, { type: "room:unlocked", roomId: lid });
    return reply.send({ ok: true });
  });

  app.post("/staff/lobby/clear-chat", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const lid = String((req.body as any)?.lobbyId || "lobby");
    const room = rooms.get(lid);
    if (room) room.msgs = [];
    await prisma.lobbyMessage.deleteMany({ where: { lobbyId: lid } });
    await globalAudit(u.id, u.name, "lobby_clear_chat", lid);
    if (room) broadcast(room, { type: "chat:cleared", roomId: lid });
    return reply.send({ ok: true });
  });

  app.post("/staff/room/clear-chat", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const rid = String((req.body as any)?.roomId || "");
    if (!rid) return reply.code(400).send({ ok: false, error: "roomId required" });
    const globalRole = await getGlobalRole(u.id);
    const room = rooms.get(rid);
    if (!room) return reply.code(404).send({ ok: false, error: "room not found" });
    if (!isModOrOwner(room, u.id, globalRole))
      return reply.code(403).send({ ok: false, error: "forbidden" });
    room.msgs = [];
    await prisma.roomMessage.deleteMany({ where: { roomId: rid } });
    audit(room, { type: "chat_clear", actorId: u.id, actorName: u.name });
    broadcast(room, { type: "chat:cleared", roomId: rid });
    return reply.send({ ok: true });
  });

  app.post("/staff/broadcast", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const body: any = (req as any).body || {};
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 500) : "";
    const level = ["info", "warning", "urgent"].includes(body.level) ? body.level : "info";
    if (!message) return reply.code(400).send({ ok: false, error: "message required" });
    const payload = { type: "system:broadcast", message, level, from: u.name, ts: Date.now() };
    const sent = new Set<string>();
    for (const room of rooms.values()) {
      for (const s of room.sockets) {
        const sid = s.user?.id;
        if (!sid || sent.has(sid)) continue;
        sent.add(sid);
        send(s, payload);
      }
    }
    await globalAudit(u.id, u.name, "system_broadcast", undefined, undefined, { message, level });
    return reply.send({ ok: true, sent: sent.size });
  });

  app.post("/staff/users/:userId/kick", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const targetId = String((req as any).params?.userId || "");
    if (targetId === u.id) return reply.code(400).send({ ok: false, error: "cannot_kick_self" });
    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { name: true, globalRole: true },
    });
    if (!target) return reply.code(404).send({ ok: false, error: "user_not_found" });
    if (target.globalRole === GlobalRole.GOD)
      return reply.code(403).send({ ok: false, error: "cannot_kick_god" });
    for (const room of rooms.values()) {
      if (room.users.has(targetId) || room.mods.has(targetId)) {
        room.users.delete(targetId);
        room.mods.delete(targetId);
        for (const s of findSocketsByUser(room, targetId)) {
          send(s, { type: "staff:kicked", roomId: room.roomId });
          try {
            (s as any).close(4001, "staff:kick");
          } catch (e) {
            swallow(e);
          }
        }
        broadcast(room, { type: "presence:leave", roomId: room.roomId, userId: targetId });
        publishState(room);
      }
    }
    await globalAudit(u.id, u.name, "global_kick", targetId, target.name);
    return reply.send({ ok: true });
  });

  app.post("/staff/users/:userId/ban", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const targetId = String((req as any).params?.userId || "");
    if (targetId === u.id) return reply.code(400).send({ ok: false, error: "cannot_ban_self" });

    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { name: true, globalRole: true, banned: true },
    });
    if (!target) return reply.code(404).send({ ok: false, error: "user_not_found" });
    if (target.globalRole === GlobalRole.GOD)
      return reply.code(403).send({ ok: false, error: "cannot_ban_god" });
    if (target.banned) return reply.code(400).send({ ok: false, error: "already_banned" });

    const body: any = (req as any).body || {};
    const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : "";

    await prisma.user.update({
      where: { id: targetId },
      data: { banned: true, banReason: reason || null, bannedAt: new Date(), bannedBy: u.id },
    });

    for (const room of rooms.values()) {
      if (room.users.has(targetId) || room.mods.has(targetId)) {
        room.users.delete(targetId);
        room.mods.delete(targetId);
        for (const s of findSocketsByUser(room, targetId)) {
          send(s, { type: "staff:banned", roomId: room.roomId, reason });
          try {
            (s as any).close(4002, "staff:ban");
          } catch (e) {
            swallow(e);
          }
        }
        broadcast(room, { type: "presence:leave", roomId: room.roomId, userId: targetId });
        publishState(room);
      }
    }

    await globalAudit(u.id, u.name, "global_ban", targetId, target.name, { reason });
    return reply.send({ ok: true });
  });

  app.delete("/staff/users/:userId/ban", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const targetId = String((req as any).params?.userId || "");
    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { name: true, banned: true },
    });
    if (!target) return reply.code(404).send({ ok: false, error: "user_not_found" });
    if (!target.banned) return reply.code(400).send({ ok: false, error: "not_banned" });

    await prisma.user.update({
      where: { id: targetId },
      data: { banned: false, banReason: null, bannedAt: null, bannedBy: null },
    });

    await globalAudit(u.id, u.name, "global_unban", targetId, target.name);
    return reply.send({ ok: true });
  });

  app.delete("/staff/rooms/:roomId", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const roomId = String((req as any).params?.roomId || "");
    if (!roomId || roomId === "lobby")
      return reply.code(400).send({ ok: false, error: "invalid_room" });

    const room = await prisma.room.findUnique({ where: { id: roomId }, select: { name: true } });
    if (!room) return reply.code(404).send({ ok: false, error: "not_found" });

    const liveRoom = rooms.get(roomId);
    if (liveRoom) {
      for (const s of liveRoom.sockets) {
        send(s, { type: "room:deleted", roomId });
        try {
          (s as any).close(4000, "room:deleted");
        } catch (e) {
          swallow(e);
        }
      }
      rooms.delete(roomId);
    }

    await prisma.room.delete({ where: { id: roomId } });
    await globalAudit(u.id, u.name, "room_delete", roomId, room.name || roomId);

    return reply.send({ ok: true });
  });

  app.post("/staff/rooms/:roomId/rename", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const roomId = String((req as any).params?.roomId || "");
    const body: any = (req as any).body || {};
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
    if (!name) return reply.code(400).send({ ok: false, error: "name required" });

    try {
      await prisma.room.update({ where: { id: roomId }, data: { name } });
    } catch {
      return reply.code(404).send({ ok: false, error: "room_not_found" });
    }

    const room = rooms.get(roomId);
    if (room) {
      room.name = name;
      publishState(room);
    }

    await globalAudit(u.id, u.name, "room_rename", roomId, undefined, { name });
    return reply.send({ ok: true, name });
  });

  app.post("/staff/rooms/:roomId/pin", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const roomId = String((req as any).params?.roomId || "");
    const body: any = (req as any).body || {};
    const pinned = body.pinned !== false;

    const room = rooms.get(roomId);
    if (room) {
      room.pinned = pinned;
    }

    try {
      await prisma.room.update({ where: { id: roomId }, data: { pinned } });
    } catch (e) {
      log.error("[staff pin] db update failed", e);
    }

    await globalAudit(u.id, u.name, pinned ? "room_pin" : "room_unpin", roomId);
    return reply.send({ ok: true, pinned });
  });

  app.post("/staff/rooms/:roomId/event", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const roomId = String((req as any).params?.roomId || "");
    const body: any = (req as any).body || {};
    const isEvent = body.isEvent !== false;

    const room = rooms.get(roomId);
    if (room) room.isEvent = isEvent;

    try {
      await prisma.room.update({ where: { id: roomId }, data: { isEvent } });
    } catch (e) {
      log.error("[staff event] db update failed", e);
    }

    await globalAudit(u.id, u.name, isEvent ? "room_event_on" : "room_event_off", roomId);
    return reply.send({ ok: true, isEvent });
  });

  app.post("/staff/rooms/:roomId/close", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const roomId = String((req as any).params?.roomId || "");
    const room = rooms.get(roomId);

    if (room) {
      for (const s of room.sockets) {
        send(s, { type: "room:closed", roomId, by: u.name });
        try {
          s.close(4004, "room:closed");
        } catch (e) {
          swallow(e);
        }
      }
      room.users.clear();
      room.sockets.clear();
      rooms.delete(roomId);
    }

    try {
      await prisma.roomMessage.deleteMany({ where: { roomId } }).catch(swallow);
      await prisma.roomMember.deleteMany({ where: { roomId } }).catch(swallow);
      await prisma.room.delete({ where: { id: roomId } }).catch(swallow);
    } catch (e) {
      swallow(e);
    }

    await globalAudit(u.id, u.name, "room_close", roomId);
    return reply.send({ ok: true });
  });

  app.get("/staff/reports", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const statusFilter = String((req.query as any)?.status || "OPEN").toUpperCase();
    const where: any = {};
    if (statusFilter !== "ALL") where.status = statusFilter;
    const rows = await prisma.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const userIds = new Set<string>();
    for (const r of rows) {
      userIds.add(r.reporterId);
      if (r.targetType === "USER") userIds.add(r.targetId);
      if (r.reviewedById) userIds.add(r.reviewedById);
    }
    const users = userIds.size
      ? await prisma.user.findMany({
          where: { id: { in: Array.from(userIds) } },
          select: { id: true, name: true },
        })
      : [];
    const nameMap = new Map(users.map((x) => [x.id, x.name]));
    return reply.send({
      reports: rows.map((r: any) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
        reporterName: nameMap.get(r.reporterId) || r.reporterId,
        targetName: r.targetType === "USER" ? nameMap.get(r.targetId) || r.targetId : null,
        reviewerName: r.reviewedById ? nameMap.get(r.reviewedById) || r.reviewedById : null,
      })),
    });
  });

  app.post("/staff/reports/:id/action", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const id = String((req as any).params?.id || "");
    const body: any = (req as any).body || {};
    const status = String(body.status || "").toUpperCase();
    if (!["REVIEWED", "ACTIONED", "DISMISSED"].includes(status))
      return reply.code(400).send({ ok: false, error: "invalid_status" });
    try {
      await prisma.report.update({
        where: { id },
        data: { status: status as ReportStatus, reviewedAt: new Date(), reviewedById: u.id },
      });
      await globalAudit(u.id, u.name, `report_${status.toLowerCase()}`, id);
      return reply.send({ ok: true });
    } catch {
      return reply.code(500).send({ ok: false, error: "update_failed" });
    }
  });

  app.get("/staff/reserved", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const list = await prisma.reservedName.findMany({ orderBy: { name: "asc" } });
    return reply.send({ ok: true, reserved: list });
  });

  app.post("/staff/reserved", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const body: any = (req as any).body || {};
    const name = String(body.name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const scope = ["BOTH", "LOBBY", "USERNAME"].includes(body.scope) ? body.scope : "BOTH";
    const reason = String(body.reason || "").slice(0, 200);
    if (!name || name.length < 2)
      return reply.code(400).send({ ok: false, error: "Name too short (min 2 chars)" });
    try {
      const entry = await prisma.reservedName.create({
        data: { name, scope, reason, addedBy: u.id },
      });
      await globalAudit(u.id, u.name, "reserved_name_add", undefined, undefined, {
        name,
        scope,
        reason,
      });
      return reply.send({ ok: true, entry });
    } catch (e: any) {
      if (e?.code === "P2002")
        return reply.code(409).send({ ok: false, error: "Name already reserved" });
      throw e;
    }
  });

  app.delete("/staff/reserved/:id", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const id = String((req as any).params?.id || "");
    try {
      const deleted = await prisma.reservedName.delete({ where: { id } });
      await globalAudit(u.id, u.name, "reserved_name_remove", undefined, undefined, {
        name: deleted.name,
      });
      return reply.send({ ok: true });
    } catch {
      return reply.code(404).send({ ok: false, error: "Not found" });
    }
  });

  app.get("/staff/config", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (role !== GlobalRole.GOD) return reply.code(403).send({ ok: false, error: "forbidden" });

    const stored = await getAllSiteConfig();
    const config = { ...SITE_CONFIG_DEFAULTS, ...stored };
    return reply.send({
      ok: true,
      config: {
        featuredLobbyId: config.featuredLobbyId || "",
        registrationOpen: config.registrationOpen !== "false",
        maintenanceMode: config.maintenanceMode === "true",
        aiEnabled: config.aiEnabled !== "false",
        defaultTier: config.defaultTier || "INNOCENT",
        maxRoomsPerLobby: Number(config.maxRoomsPerLobby) || 50,
        chatRateLimit: Number(config.chatRateLimit) || 30,
      },
    });
  });

  app.post("/staff/config", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (role !== GlobalRole.GOD) return reply.code(403).send({ ok: false, error: "forbidden" });

    const body: any = (req as any).body || {};
    const updates: Array<{ key: string; value: string }> = [];

    if (body.featuredLobbyId !== undefined)
      updates.push({ key: "featuredLobbyId", value: String(body.featuredLobbyId) });
    if (body.registrationOpen !== undefined)
      updates.push({ key: "registrationOpen", value: String(body.registrationOpen) });
    if (body.maintenanceMode !== undefined)
      updates.push({ key: "maintenanceMode", value: String(body.maintenanceMode) });
    if (body.aiEnabled !== undefined)
      updates.push({ key: "aiEnabled", value: String(body.aiEnabled) });
    if (body.defaultTier !== undefined)
      updates.push({ key: "defaultTier", value: String(body.defaultTier) });
    if (body.maxRoomsPerLobby !== undefined)
      updates.push({ key: "maxRoomsPerLobby", value: String(body.maxRoomsPerLobby) });
    if (body.chatRateLimit !== undefined)
      updates.push({ key: "chatRateLimit", value: String(body.chatRateLimit) });

    for (const { key, value } of updates) {
      await setSiteConfig(key, value);
    }

    await globalAudit(u.id, u.name, "config_update", undefined, undefined, {
      keys: updates.map((u) => u.key),
    });
    return reply.send({ ok: true });
  });

  app.post("/staff/featured", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const body: any = (req as any).body || {};
    const lobbyId = String(body.lobbyId || "").trim();

    if (lobbyId) {
      const lobby = await prisma.lobby.findUnique({
        where: { id: lobbyId },
        select: { id: true, name: true },
      });
      if (!lobby) return reply.code(404).send({ ok: false, error: "lobby_not_found" });
      await setSiteConfig("featuredLobbyId", lobbyId);
      await globalAudit(u.id, u.name, "set_featured", lobbyId, lobby.name);
      return reply.send({ ok: true, featuredLobbyId: lobbyId });
    } else {
      await setSiteConfig("featuredLobbyId", "");
      await globalAudit(u.id, u.name, "clear_featured");
      return reply.send({ ok: true, featuredLobbyId: "" });
    }
  });

  app.get("/staff/featured", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const featuredId = await getSiteConfig("featuredLobbyId");
    return reply.send({ ok: true, featuredLobbyId: featuredId || "" });
  });

  app.get("/staff/lobbies", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const list = await prisma.lobby.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        verified: true,
        pinned: true,
        moduleType: true,
        accentColor: true,
        logoUrl: true,
        _count: { select: { rooms: true, members: true } },
      },
      orderBy: [{ pinned: "desc" }, { name: "asc" }],
    });

    const lobbies = list.map((l: any) => ({
      id: l.id,
      name: l.name,
      description: l.description || "",
      verified: l.verified,
      pinned: l.pinned,
      moduleType: l.moduleType,
      onlineCount: l._count.members,
    }));

    return reply.send({ ok: true, lobbies });
  });

  app.post("/staff/lobbies/:id/pin", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const lobbyId = (req.params as any).id;
    const { pinned } = req.body as any;
    await prisma.lobby.update({
      where: { id: lobbyId },
      data: { pinned: Boolean(pinned) },
    });
    return reply.send({ ok: true, pinned: Boolean(pinned) });
  });

  app.post("/staff/lobbies/:id/clear-branding", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const lobbyId = String((req.params as any).id || "");
    try {
      await prisma.lobby.update({
        where: { id: lobbyId },
        data: { logoUrl: null, bannerUrl: null },
      });
      await globalAudit(u.id, u.name, "lobby_clear_branding", lobbyId);
      return reply.send({ ok: true });
    } catch {
      return reply.code(500).send({ ok: false, error: "clear_failed" });
    }
  });

  app.get("/staff/roster", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const staff = await prisma.user.findMany({
      where: { globalRole: { in: ["SUPPORT", "STAFF", "ADMIN", "GOD"] } },
      select: {
        id: true,
        name: true,
        globalRole: true,
        avatar: true,
        avatarColor: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
    return reply.send({ ok: true, staff });
  });

  app.get("/staff/board", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const posts = await prisma.staffPost.findMany({
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 100,
    });
    return reply.send({ ok: true, posts });
  });

  app.post("/staff/board", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const body: any = (req as any).body || {};
    const text = String(body.body || "").trim();
    if (!text || text.length > 2000)
      return reply.code(400).send({ ok: false, error: "body required (max 2000 chars)" });

    const post = await prisma.staffPost.create({
      data: { authorId: u.id, authorName: u.name, body: text, pinned: !!body.pinned },
    });
    return reply.send({ ok: true, post });
  });

  app.post("/staff/board/:id/pin", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const postId = (req as any).params.id;
    const post = await prisma.staffPost.findUnique({ where: { id: postId } });
    if (!post) return reply.code(404).send({ ok: false, error: "not_found" });

    const updated = await prisma.staffPost.update({
      where: { id: postId },
      data: { pinned: !post.pinned },
    });
    return reply.send({ ok: true, post: updated });
  });

  app.delete("/staff/board/:id", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const postId = (req as any).params.id;
    try {
      await prisma.staffPost.delete({ where: { id: postId } });
    } catch {
      return reply.code(404).send({ ok: false, error: "not_found" });
    }
    return reply.send({ ok: true });
  });

  app.post("/staff/users/:userId/tier", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const targetId = String((req as any).params?.userId || "");
    const body: any = (req as any).body || {};
    const tier = String(body.tier || "").toUpperCase();

    if (!["INNOCENT", "INDICTED", "FELON", "KINGPIN"].includes(tier)) {
      return reply.code(400).send({ ok: false, error: "invalid_tier" });
    }

    const userTier = tier as "INNOCENT" | "INDICTED" | "FELON" | "KINGPIN";
    await prisma.user.update({ where: { id: targetId }, data: { tier: userTier } });

    const subTier = tier === "INNOCENT" ? "FREE" : tier;
    await prisma.subscription.upsert({
      where: { userId: targetId },
      update: { tier: subTier as SubTier, status: tier === "INNOCENT" ? "inactive" : "active" },
      create: {
        userId: targetId,
        tier: subTier as SubTier,
        status: tier === "INNOCENT" ? "inactive" : "active",
      },
    });

    await globalAudit(u.id, u.name, "tier_change", targetId, undefined, { tier });
    return reply.send({ ok: true, tier });
  });

  app.get("/staff/mods", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const q: any = (req as any).query || {};
    const gameSlug = String(q.gameSlug || "windrose").toLowerCase();
    const search = String(q.search || "").trim();
    const showExcluded = q.excluded === "1" || q.excluded === "true";
    const where: any = { gameSlug };
    if (showExcluded) where.excluded = true;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { author: { contains: search, mode: "insensitive" } },
      ];
    }
    const mods = await prisma.mod.findMany({
      where,
      orderBy: showExcluded ? { excludedAt: "desc" } : { endorsements: "desc" },
      take: 200,
      select: {
        id: true,
        name: true,
        author: true,
        summary: true,
        sourceUrl: true,
        thumbnailUrl: true,
        endorsements: true,
        downloads: true,
        excluded: true,
        excludedNote: true,
        excludedAt: true,
      },
    });
    return reply.send({ ok: true, mods });
  });

  app.patch("/staff/mods/:id", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const id = String((req.params as any).id || "");
    const b: any = (req as any).body || {};
    if (typeof b.excluded !== "boolean") {
      return reply.code(400).send({ ok: false, error: "missing_excluded" });
    }
    const existing = await prisma.mod.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ ok: false, error: "not_found" });
    const note = typeof b.note === "string" ? String(b.note).slice(0, 500) : null;
    const updated = await prisma.mod.update({
      where: { id },
      data: {
        excluded: b.excluded,
        excludedNote: b.excluded ? (note ?? existing.excludedNote ?? null) : null,
        excludedAt: b.excluded ? new Date() : null,
      },
    });
    await globalAudit(u.id, u.name, "mod_exclude", id, b.excluded ? note || "" : "restored", {
      name: existing.name,
      author: existing.author,
      excluded: b.excluded,
    });
    return reply.send({ ok: true, mod: updated });
  });
}
