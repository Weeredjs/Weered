import { log, swallow } from "../lib/logger";
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { accountCount } from "../lib/registration";
import { paidThroughStripe } from "../lib/stripeTier";
import { mayActOn, mayGiveRole } from "../lib/roleLadder";
import { isProtectedRoom } from "../lib/roomKinds";
import { sendToEveryone } from "../lib/notifications";
import { cutoffNow } from "../lib/sessionCutoff";
import { refreshFlood } from "../lib/flood";
import { GlobalRole, ReportStatus, SubTier } from "@prisma/client";

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
    broadcastEvent: _broadcastEvent,
    rooms,
    send,
    getWss,
    shortRoomId: _shortRoomId,
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
    // Support sees who people are, not their email addresses.
    if (!canAssignRoles(role))
      return reply.send({ ok: true, users: users.map(({ email: _e, ...rest }: any) => rest) });
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
    if (targetId === u.id) return reply.code(400).send({ ok: false, error: "cannot_change_self" });
    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, name: true, globalRole: true },
    });
    if (!target) return reply.code(404).send({ ok: false, error: "user_not_found" });
    // Only on someone below you, and only a role below yours: STAFF and ADMIN
    // make or remove SUPPORT; only GOD makes or removes staff.
    if (!mayGiveRole(actorRole, target.globalRole, newRole))
      return reply.code(403).send({ ok: false, error: "insufficient_rank" });
    await prisma.user.update({ where: { id: targetId }, data: { globalRole: newRole } });
    await globalAudit(u.id, u.name, "role_change", targetId, target.name, {
      from: target.globalRole,
      to: newRole,
    });
    for (const sock of getWss()?.clients ?? []) {
      if (sock.user?.id === targetId) sock.user.globalRole = newRole;
    }
    for (const [, room] of rooms) {
      const entry = room.users.get(targetId);
      if (entry) {
        entry.globalRole = newRole;
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
    // ?before= pages back through older entries, 100 at a time.
    const before = new Date(String((req as any).query?.before || ""));
    const logs = await prisma.globalAudit.findMany({
      where: Number.isNaN(before.getTime()) ? {} : { createdAt: { lt: before } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return reply.send({ ok: true, logs, more: logs.length === 100 });
  });

  // The Control Panel's lobby controls: lock and unlock its chat, and clear it.
  // Weered's staff, or the lobby's own moderators and up.
  //
  // Lock used to flip the lobby chat's DOOR (room.locked): chat stayed open,
  // and anyone arriving was queued at a knock nobody could answer from a lobby
  // page. Clear deleted from a table nothing writes to (lobbyMessage), so the
  // messages came back on the next load. Both fixed 2026-10-31.
  async function lobbyModerator(userId: string, lobbyId: string): Promise<boolean> {
    if (canAccessStaff(await getGlobalRole(userId))) return true;
    if (lobbyId === "lobby") return false;
    const m = await prisma.lobbyMember
      .findUnique({ where: { lobbyId_userId: { lobbyId, userId } }, select: { roleLevel: true } })
      .catch(() => null);
    return (m?.roleLevel ?? 0) >= 3;
  }

  async function setLobbyChatLock(req: any, reply: any, locked: boolean) {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const lid = String((req.body as any)?.lobbyId || "lobby");
    if (!(await lobbyModerator(u.id, lid)))
      return reply.code(403).send({ ok: false, error: "forbidden" });
    // It said it locked lobbies that don't exist.
    if (
      lid !== "lobby" &&
      !(await prisma.lobby.findUnique({ where: { id: lid }, select: { id: true } }))
    )
      return reply.code(404).send({ ok: false, error: "lobby_not_found" });
    await prisma.room
      .updateMany({ where: { id: lid }, data: { chatLocked: locked } as any })
      .catch(swallow);
    const room = rooms.get(lid);
    if (room) {
      room.chatLocked = locked;
      broadcast(room, { type: locked ? "room:chat:disable" : "room:chat:enable", roomId: lid });
      publishState(room);
    }
    await globalAudit(u.id, u.name, locked ? "lobby_chat_lock" : "lobby_chat_unlock", lid);
    return reply.send({ ok: true, locked });
  }

  app.post("/staff/lobby/lock", (req, reply) => setLobbyChatLock(req, reply, true));
  app.post("/staff/lobby/unlock", (req, reply) => setLobbyChatLock(req, reply, false));

  app.post("/staff/lobby/clear-chat", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const lid = String((req.body as any)?.lobbyId || "lobby");
    if (!(await lobbyModerator(u.id, lid)))
      return reply.code(403).send({ ok: false, error: "forbidden" });
    // A lobby's chat is the room whose id is the lobby's.
    const gone = await prisma.roomMessage.deleteMany({ where: { roomId: lid } });
    const room = rooms.get(lid);
    if (room) {
      room.msgs = [];
      room.pinnedMsgs?.clear();
      broadcast(room, { type: "chat:cleared", roomId: lid });
      broadcast(room, { type: "chat:pins", roomId: lid, pinned: [] });
    }
    await globalAudit(u.id, u.name, "lobby_clear_chat", lid);
    return reply.send({ ok: true, removed: gone.count });
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
    room.pinnedMsgs?.clear();
    await prisma.roomMessage.deleteMany({ where: { roomId: rid } });
    audit(room, { type: "chat_clear", actorId: u.id, actorName: u.name });
    broadcast(room, { type: "chat:cleared", roomId: rid });
    broadcast(room, { type: "chat:pins", roomId: rid, pinned: [] });
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
    const sent = sendToEveryone(payload);
    await globalAudit(u.id, u.name, "system_broadcast", undefined, undefined, {
      message,
      level,
      sent,
    });
    return reply.send({ ok: true, sent });
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
    if (!mayActOn(role, target.globalRole))
      return reply.code(403).send({ ok: false, error: "insufficient_rank" });
    for (const room of rooms.values()) {
      if (room.users.has(targetId) || room.mods.has(targetId)) {
        // Kept out of these rooms for ten minutes, as a room kick does.
        (room.kickedUntil ||= new Map()).set(targetId, Date.now() + 10 * 60_000);
        room.users.delete(targetId);
        room.mods.delete(targetId);
        for (const s of findSocketsByUser(room, targetId)) {
          send(s, { type: "staff:kicked", roomId: room.roomId });
          try {
            s.close(4001, "staff:kick");
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
    if (!mayActOn(role, target.globalRole))
      return reply.code(403).send({ ok: false, error: "insufficient_rank" });
    if (target.banned) return reply.code(400).send({ ok: false, error: "already_banned" });

    const body: any = (req as any).body || {};
    const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : "";

    await prisma.user.update({
      where: { id: targetId },
      // tokensValidAfter: sessions from before the ban stay dead after an unban.
      data: {
        banned: true,
        banReason: reason || null,
        bannedAt: new Date(),
        bannedBy: u.id,
        tokensValidAfter: cutoffNow(),
      },
    });

    for (const room of rooms.values()) {
      if (room.users.has(targetId) || room.mods.has(targetId)) {
        room.users.delete(targetId);
        room.mods.delete(targetId);
        for (const s of findSocketsByUser(room, targetId)) {
          send(s, { type: "staff:banned", roomId: room.roomId, reason });
          try {
            s.close(4002, "staff:ban");
          } catch (e) {
            swallow(e);
          }
        }
        broadcast(room, { type: "presence:leave", roomId: room.roomId, userId: targetId });
        publishState(room);
      }
    }
    // Every connection, not only those inside a room: a banned member sitting on
    // /home with the dock open kept a live socket and could still DM.
    for (const sock of getWss()?.clients ?? []) {
      if ((sock as any).user?.id !== targetId) continue;
      (sock as any).user = undefined;
      try {
        send(sock, { type: "staff:banned", reason });
        sock.close(4002, "staff:ban");
      } catch (e) {
        swallow(e);
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
    // A lobby's own chat, its admin chat and ops chat go with their lobby,
    // never one at a time from here: one click erased a lobby's history.
    if (await isProtectedRoom(roomId))
      return reply.code(400).send({ ok: false, error: "protected_room" });

    const room = await prisma.room.findUnique({ where: { id: roomId }, select: { name: true } });
    if (!room) return reply.code(404).send({ ok: false, error: "not_found" });

    const liveRoom = rooms.get(roomId);
    if (liveRoom) {
      for (const s of liveRoom.sockets) {
        send(s, { type: "room:deleted", roomId });
        try {
          s.close(4000, "room:deleted");
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
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const roomId = String((req as any).params?.roomId || "");
    const body: any = (req as any).body || {};
    const pinned = body.pinned !== false;

    // A room that isn't there can't be pinned (it said it was).
    const saved = await prisma.room
      .update({ where: { id: roomId }, data: { pinned } })
      .catch(() => null);
    if (!saved) return reply.code(404).send({ ok: false, error: "not_found" });
    const room = rooms.get(roomId);
    if (room) {
      room.pinned = pinned;
    }

    await globalAudit(u.id, u.name, pinned ? "room_pin" : "room_unpin", roomId);
    return reply.send({ ok: true, pinned });
  });

  app.post("/staff/rooms/:roomId/event", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

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
    // Closing deletes the room and its history: the same guard as DELETE below
    // (staff, not support), and never the Home Lobby (finding 9).
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const roomId = String((req as any).params?.roomId || "");
    if (!roomId || roomId === "lobby")
      return reply.code(400).send({ ok: false, error: "cannot_close_lobby" });
    if (await isProtectedRoom(roomId))
      return reply.code(400).send({ ok: false, error: "protected_room" });
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
    const about = await reportTargets(rows);
    return reply.send({
      reports: rows.map((r: any) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
        reporterName: nameMap.get(r.reporterId) || r.reporterId,
        targetName: r.targetType === "USER" ? nameMap.get(r.targetId) || r.targetId : null,
        reviewerName: r.reviewedById ? nameMap.get(r.reviewedById) || r.reviewedById : null,
        target: about.get(r.id) || null,
      })),
    });
  });

  /**
   * What each report is about, so the desk can link to it and offer the right
   * tool (ops audit 2026-11-01: only lobby reports had a button). A message
   * report names its author and room, so staff can act on the person too.
   */
  async function reportTargets(rows: any[]) {
    const ids = (t: string) => rows.filter((r) => r.targetType === t).map((r) => r.targetId);
    const [msgs, people, lobbies, roomRows] = await Promise.all([
      prisma.roomMessage.findMany({
        where: { id: { in: ids("MESSAGE") } },
        select: { id: true, roomId: true, userId: true, userName: true, deletedAt: true },
      }),
      prisma.user.findMany({
        where: { id: { in: ids("USER") } },
        select: { id: true, name: true, usernameKey: true, globalRole: true, banned: true },
      }),
      prisma.lobby.findMany({
        where: { id: { in: ids("LOBBY") } },
        select: { id: true, name: true },
      }),
      prisma.room.findMany({
        where: { id: { in: ids("ROOM") } },
        select: { id: true, name: true, lobbyId: true },
      }),
    ]);
    const authors = await prisma.user.findMany({
      where: { id: { in: msgs.map((m) => m.userId) } },
      select: { id: true, usernameKey: true, globalRole: true, banned: true },
    });
    const authorOf = new Map(authors.map((a) => [a.id, a]));
    // A lobby's own chat is the room keyed by the lobby's id: link to the lobby.
    const chatLobbies = new Set(
      (
        await prisma.lobby.findMany({
          where: { id: { in: [...msgs.map((m) => m.roomId), ...ids("ROOM")] } },
          select: { id: true },
        })
      ).map((l) => l.id),
    );
    const msgOf = new Map(msgs.map((m) => [m.id, m]));
    const personOf = new Map(people.map((p) => [p.id, p]));
    const lobbyOf = new Map(lobbies.map((l) => [l.id, l]));
    const roomOf = new Map(roomRows.map((x) => [x.id, x]));
    const out = new Map<string, any>();
    for (const r of rows) {
      if (r.targetType === "MESSAGE") {
        const m = msgOf.get(r.targetId);
        const a = m && authorOf.get(m.userId);
        out.set(
          r.id,
          m
            ? {
                exists: true,
                name: m.userName,
                roomId: m.roomId,
                lobbyId: chatLobbies.has(m.roomId) ? m.roomId : null,
                deleted: !!m.deletedAt,
                person: a
                  ? { id: a.id, usernameKey: a.usernameKey, role: a.globalRole, banned: a.banned }
                  : null,
              }
            : { exists: false },
        );
      } else if (r.targetType === "USER") {
        const p = personOf.get(r.targetId);
        out.set(
          r.id,
          p
            ? {
                exists: true,
                name: p.name,
                person: {
                  id: p.id,
                  usernameKey: p.usernameKey,
                  role: p.globalRole,
                  banned: p.banned,
                },
              }
            : { exists: false },
        );
      } else if (r.targetType === "LOBBY") {
        const l = lobbyOf.get(r.targetId);
        out.set(r.id, l ? { exists: true, name: l.name, lobbyId: l.id } : { exists: false });
      } else {
        const x = roomOf.get(r.targetId);
        const live = rooms.get(r.targetId);
        out.set(
          r.id,
          x || live
            ? {
                exists: true,
                name: x?.name || live?.name || r.targetId,
                roomId: r.targetId,
                lobbyId: chatLobbies.has(r.targetId) ? r.targetId : (x?.lobbyId ?? null),
              }
            : { exists: false },
        );
      }
    }
    return out;
  }

  // Remove a reported room message, as a room moderator's delete does
  // (sockets/messaging.ts chat:delete), from the Reports desk.
  app.post("/staff/messages/:id/delete", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
    const id = String((req as any).params?.id || "");
    const m = await prisma.roomMessage.findUnique({
      where: { id },
      select: { id: true, roomId: true, userId: true, userName: true, body: true, deletedAt: true },
    });
    if (!m) return reply.code(404).send({ ok: false, error: "not_found" });
    if (m.deletedAt) return reply.send({ ok: true, already: true });
    const deletedAt = Date.now();
    await prisma.roomMessage.update({
      where: { id },
      data: { body: "", deletedAt: new Date(deletedAt) },
    });
    const room = rooms.get(m.roomId);
    const live = room?.msgs?.find((x: any) => x.id === id);
    if (live) {
      live.deletedAt = deletedAt;
      live.body = "";
    }
    if (room) broadcast(room, { type: "chat:deleted", roomId: m.roomId, msgId: id, deletedAt });
    await globalAudit(u.id, u.name, "message_delete", id, m.userName, {
      roomId: m.roomId,
      body: m.body.slice(0, 200),
    });
    return reply.send({ ok: true });
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
    const did = typeof body.did === "string" ? body.did.slice(0, 40) : undefined;
    try {
      await prisma.report.update({
        where: { id },
        data: { status: status as ReportStatus, reviewedAt: new Date(), reviewedById: u.id },
      });
      await globalAudit(u.id, u.name, `report_${status.toLowerCase()}`, id, undefined, { did });
      return reply.send({ ok: true });
    } catch {
      return reply.code(500).send({ ok: false, error: "update_failed" });
    }
  });

  app.get("/staff/reserved", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
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
      .replaceAll(/[^a-z0-9]/g, "");
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
        // The cap, and where things stand against it (lib/registration.ts).
        registrationCap: Number(config.registrationCap) || 0,
        accounts: await accountCount().catch(() => 0),
        waitlist: await prisma.waitlistEntry.count().catch(() => 0),
        maintenanceMode: config.maintenanceMode === "true",
        aiEnabled: config.aiEnabled !== "false",
        defaultTier: config.defaultTier || "INNOCENT",
        // The flood switches (lib/flood.ts): "off" | "on" | "auto".
        floodMode: ["on", "auto"].includes(config.floodMode) ? config.floodMode : "off",
        capacityMode: config.capacityMode === "true",
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
    if (body.registrationCap !== undefined) {
      const cap = Math.floor(Number(body.registrationCap));
      if (!Number.isFinite(cap) || cap < 0)
        return reply
          .code(400)
          .send({ ok: false, error: "The account cap is a whole number, 0 for none." });
      updates.push({ key: "registrationCap", value: String(cap) });
    }
    if (body.maintenanceMode !== undefined)
      updates.push({ key: "maintenanceMode", value: String(body.maintenanceMode) });
    if (body.aiEnabled !== undefined)
      updates.push({ key: "aiEnabled", value: String(body.aiEnabled) });
    if (body.defaultTier !== undefined)
      updates.push({ key: "defaultTier", value: String(body.defaultTier) });
    if (body.floodMode !== undefined)
      updates.push({ key: "floodMode", value: body.floodMode === "on" ? "on" : "off" });
    if (body.capacityMode !== undefined)
      updates.push({ key: "capacityMode", value: String(body.capacityMode === true) });

    for (const { key, value } of updates) {
      await setSiteConfig(key, value);
    }
    // The door, flood mode and the AI switch take effect now, not in 15 s.
    await refreshFlood(true);

    await globalAudit(u.id, u.name, "config_update", undefined, undefined, {
      keys: updates.map((u) => u.key),
    });
    return reply.send({ ok: true });
  });

  app.post("/staff/featured", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const body: any = (req as any).body || {};
    const lobbyId = String(body.lobbyId || "").trim();

    if (lobbyId) {
      const lobby = await prisma.lobby.findUnique({
        where: { id: lobbyId },
        select: { id: true, name: true, unlisted: true },
      });
      if (!lobby) return reply.code(404).send({ ok: false, error: "lobby_not_found" });
      // Unlisted means kept off every listing; featuring it would list it on Home.
      if (lobby.unlisted) return reply.code(400).send({ ok: false, error: "lobby_unlisted" });
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
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const featuredId = await getSiteConfig("featuredLobbyId");
    return reply.send({ ok: true, featuredLobbyId: featuredId || "" });
  });

  app.get("/staff/lobbies", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    const list = await prisma.lobby.findMany({
      // Deleted ones are listed apart, with their restore (routes/lobbyDelete.ts).
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        description: true,
        verified: true,
        pinned: true,
        moduleType: true,
        accentColor: true,
        logoUrl: true,
        unlisted: true,
        _count: { select: { rooms: true, members: true } },
      },
      orderBy: [{ pinned: "desc" }, { name: "asc" }],
    });
    // A lobby's chat lock lives on its own room (keyed by the lobby's id).
    const lockedRooms = await prisma.room.findMany({
      where: { id: { in: list.map((l: any) => l.id) }, chatLocked: true },
      select: { id: true },
    });
    const locked = new Set(lockedRooms.map((r) => r.id));
    // Online is who is in the lobby's rooms now; it reported the member count.
    const online = new Map<string, Set<string>>();
    for (const [rid, room] of rooms) {
      const lid = room.lobbyId || rid;
      if (!room.users?.size) continue;
      const set = online.get(lid) || new Set<string>();
      for (const uid of room.users.keys()) set.add(uid);
      online.set(lid, set);
    }

    const lobbies = list.map((l: any) => ({
      id: l.id,
      name: l.name,
      description: l.description || "",
      verified: l.verified,
      pinned: l.pinned,
      moduleType: l.moduleType,
      members: l._count.members,
      onlineCount: online.get(l.id)?.size || 0,
      locked: locked.has(l.id),
      unlisted: l.unlisted,
    }));

    return reply.send({ ok: true, lobbies });
  });

  app.post("/staff/lobbies/:id/pin", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAssignRoles(role)) return reply.code(403).send({ ok: false, error: "forbidden" });
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

    // Serving staff only: not deleted or banned accounts (ops audit 2026-11-01).
    const staff = await prisma.user.findMany({
      where: {
        globalRole: { in: ["SUPPORT", "STAFF", "ADMIN", "GOD"] },
        deletedAt: null,
        banned: false,
      },
      select: {
        id: true,
        name: true,
        usernameKey: true,
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
    await globalAudit(u.id, u.name, "board_post", post.id, text.slice(0, 80));
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
    await globalAudit(
      u.id,
      u.name,
      updated.pinned ? "board_pin" : "board_unpin",
      postId,
      post.body.slice(0, 80),
    );
    return reply.send({ ok: true, post: updated });
  });

  app.delete("/staff/board/:id", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const role = await getGlobalRole(u.id);
    if (!canAccessStaff(role)) return reply.code(403).send({ ok: false, error: "forbidden" });

    // Your own post, or anyone's if you're STAFF and up (SUPPORT could delete
    // anyone's through the server, though the page hid the button: ops audit).
    const postId = (req as any).params.id;
    const post = await prisma.staffPost.findUnique({ where: { id: postId } });
    if (!post) return reply.code(404).send({ ok: false, error: "not_found" });
    if (post.authorId !== u.id && !canAssignRoles(role))
      return reply.code(403).send({ ok: false, error: "forbidden" });
    await prisma.staffPost.delete({ where: { id: postId } }).catch(swallow);
    await globalAudit(u.id, u.name, "board_delete", postId, post.body.slice(0, 80), {
      author: post.authorName,
    });
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

    if (!["INNOCENT", "INDICTED", "FELON", "CONDEMNED", "KINGPIN"].includes(tier)) {
      return reply.code(400).send({ ok: false, error: "invalid_tier" });
    }
    const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!target) return reply.code(404).send({ ok: false, error: "user_not_found" });
    if (await paidThroughStripe(targetId))
      return reply.code(409).send({ ok: false, error: "paid_through_stripe" });

    const userTier = tier as "INNOCENT" | "INDICTED" | "FELON" | "CONDEMNED" | "KINGPIN";
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
