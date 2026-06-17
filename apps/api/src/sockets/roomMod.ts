import { swallow } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { RoomRole } from "@prisma/client";

// Room lifecycle + moderation WS handlers extracted from the index.ts main
// message handler. handleRoomClose (room:close) is dispatched PRE-preamble: it
// self-resolves via rooms.get (it only closes already-loaded in-memory rooms,
// never DB-loads), so it must NOT go through the ensureRoomLoaded preamble.
// handleRoomMod covers the POST-preamble permission surface
// (room:getAdminState/rename/lock/unlock/admit/deny + staff:kick + mod:*) and
// receives the preamble snapshot (room/roomId/actor*) via ctx, so the
// actorIsMod / actorIsOwner gates evaluate exactly as before. Void handlers --
// every bare return; preserved verbatim. rooms + wss injected by reference.

export async function handleRoomClose(
  ws: any,
  msg: any,
  opts: {
    normalizeRoomId: (input: string) => string;
    rooms: Map<string, any>;
    isModOrOwner: (room: any, userId?: string, globalRole?: string) => boolean;
    send: (ws: any, msg: any) => void;
    globalAudit: (
      actorId: string,
      actorName: string,
      action: string,
      targetId?: string,
      targetName?: string,
      meta?: any,
    ) => Promise<any>;
  },
): Promise<void> {
  const { normalizeRoomId, rooms, isModOrOwner, send, globalAudit } = opts;

  if (msg.type === "room:close") {
    const roomId = normalizeRoomId(String(msg.roomId || ws.roomId || ""));
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    if (!isModOrOwner(room, ws.user.id, ws.user?.globalRole)) return;

    if (room.pinned) {
      for (const s of room.sockets) {
        send(s, { type: "room:closed", roomId, by: ws.user.name });
        try {
          s.close(4004, "room:closed");
        } catch (e) {
          swallow(e);
        }
      }
      room.users.clear();
      room.sockets.clear();
      room.msgs = [];
      room.activeModule = null;
      return;
    }

    for (const s of room.sockets) {
      send(s, { type: "room:closed", roomId, by: ws.user.name });
      try {
        s.close(4004, "room:closed");
      } catch (e) {
        swallow(e);
      }
    }

    room.users.clear();
    room.sockets.clear();
    room.msgs = [];
    room.activeModule = null;

    try {
      await prisma.roomMessage.deleteMany({ where: { roomId } }).catch(swallow);
      await prisma.roomMember.deleteMany({ where: { roomId } }).catch(swallow);
      await prisma.room.delete({ where: { id: roomId } }).catch(swallow);
    } catch (e) {
      swallow(e);
    }

    rooms.delete(roomId);

    await globalAudit(ws.user.id, ws.user.name, "room_close", roomId);
    return;
  }
}

export async function handleRoomMod(
  ws: any,
  msg: any,
  ctx: {
    room: any;
    roomId: string;
    actorId: string;
    actorName: string;
    actorIsMod: boolean;
    actorIsOwner: boolean;
  },
  opts: {
    publishState: (room: any) => void;
    broadcast: (room: any, msg: any) => void;
    persistRoomBasics: (room: any) => Promise<any>;
    audit: (room: any, item: any) => void;
    removeKnock: (room: any, userId: string) => void;
    removePending: (room: any, userId: string) => void;
    doJoin: (ws: any, roomId: string) => Promise<any>;
    send: (ws: any, msg: any) => void;
    getGlobalRole: (userId: string) => Promise<any>;
    canAccessStaff: (role: any) => boolean;
    findSocketsByUser: (room: any, userId: string) => any[];
    isOwner: (room: any, userId?: string) => boolean;
    rooms: Map<string, any>;
    wss: any;
  },
): Promise<void> {
  const { room, roomId, actorId, actorName, actorIsMod, actorIsOwner } = ctx;
  const {
    publishState,
    broadcast,
    persistRoomBasics,
    audit,
    removeKnock,
    removePending,
    doJoin,
    send,
    getGlobalRole,
    canAccessStaff,
    findSocketsByUser,
    isOwner,
    rooms,
    wss,
  } = opts;

  if (msg.type === "room:getAdminState") {
    publishState(room);
    return;
  }

  if (msg.type === "room:rename") {
    if (!actorIsMod) return;
    const nextName = String(msg.name || "")
      .trim()
      .slice(0, 64);
    if (!nextName) return;
    room.name = nextName;
    await persistRoomBasics(room);
    audit(room, { type: "room:rename", actorId, actorName, note: nextName });
    publishState(room);
    broadcast(room, { type: "room:renamed", roomId, name: room.name });
    return;
  }

  if (msg.type === "room:lock") {
    if (!actorIsMod) return;
    room.locked = true;
    await persistRoomBasics(room);
    audit(room, { type: "room:lock", actorId, actorName });
    publishState(room);
    broadcast(room, { type: "room:locked", roomId, locked: true });
    return;
  }

  if (msg.type === "room:unlock") {
    if (!actorIsMod) return;
    room.locked = false;
    await persistRoomBasics(room);
    audit(room, { type: "room:unlock", actorId, actorName });
    publishState(room);
    broadcast(room, { type: "room:locked", roomId, locked: false });
    return;
  }

  if (msg.type === "room:admit") {
    if (!actorIsMod) return;
    const targetId = String(msg.userId || "");
    if (!targetId) return;
    removeKnock(room, targetId);
    const set = room.pending.get(targetId);
    if (set && set.size) {
      for (const s of set) {
        if (!s.user || s.user.id !== targetId) continue;
        await doJoin(s, roomId);
        send(s, { type: "room:admitted", roomId });
      }
    }
    removePending(room, targetId);
    audit(room, { type: "room:admit", actorId, actorName, targetId });
    publishState(room);
    return;
  }

  if (msg.type === "room:deny") {
    if (!actorIsMod) return;
    const targetId = String(msg.userId || "");
    if (!targetId) return;
    removeKnock(room, targetId);
    const set = room.pending.get(targetId);
    if (set && set.size) {
      for (const s of set) {
        send(s, { type: "room:denied", roomId });
        try {
          s.pendingRoomId = undefined;
        } catch (e) {
          swallow(e);
        }
      }
    }
    removePending(room, targetId);
    audit(room, { type: "room:deny", actorId, actorName, targetId });
    publishState(room);
    return;
  }

  if (msg.type === "staff:kick") {
    const kickActorId = ws.user?.id || "";
    const kickActorName = ws.user?.name || "staff";
    if (!kickActorId) return;
    const kickRole = await getGlobalRole(kickActorId);
    if (!canAccessStaff(kickRole)) return;
    const targetId = String(msg.userId || "");
    if (!targetId || targetId === kickActorId) return;
    for (const r of rooms.values()) {
      if (r.users.has(targetId) || r.mods.has(targetId)) {
        r.users.delete(targetId);
        r.mods.delete(targetId);
        try {
          for (const s of findSocketsByUser(r, targetId)) {
            send(s, { type: "staff:kicked", roomId: r.roomId });
            try {
              s.roomId = undefined;
            } catch (e) {
              swallow(e);
            }
            try {
              s.pendingRoomId = undefined;
            } catch (e) {
              swallow(e);
            }
            try {
              s.close(4001, "staff:kick");
            } catch (e) {
              swallow(e);
            }
          }
        } catch (e) {
          swallow(e);
        }
        broadcast(r, { type: "presence:leave", roomId: r.roomId, userId: targetId });
        audit(r, { type: "staff:kick", actorId: kickActorId, actorName: kickActorName, targetId });
        publishState(r);
      }
    }
    try {
      for (const c of wss.clients) {
        const s = c;
        if (s?.user?.id && String(s.user.id) === targetId) {
          send(s, { type: "staff:kicked" });
          try {
            s.close(4001, "staff:kick");
          } catch (e) {
            swallow(e);
          }
        }
      }
    } catch (e) {
      swallow(e);
    }
    return;
  }

  if (msg.type === "mod:mute") {
    if (!actorIsMod) return;
    const targetId = String(msg.userId || "");
    if (!targetId || isOwner(room, targetId)) return;
    room.muted.add(targetId);
    for (const s of findSocketsByUser(room, targetId)) send(s, { type: "mod:muted", roomId });
    audit(room, { type: "mod:mute", actorId, actorName, targetId });
    publishState(room);
    return;
  }

  if (msg.type === "mod:unmute") {
    if (!actorIsMod) return;
    const targetId = String(msg.userId || "");
    if (!targetId) return;
    room.muted.delete(targetId);
    for (const s of findSocketsByUser(room, targetId)) send(s, { type: "mod:unmuted", roomId });
    audit(room, { type: "mod:unmute", actorId, actorName, targetId });
    publishState(room);
    return;
  }

  if (msg.type === "mod:kick") {
    if (!actorIsMod) return;
    const targetId = String(msg.userId || "");
    if (!targetId || isOwner(room, targetId)) return;
    room.users.delete(targetId);
    room.mods.delete(targetId);
    if (room.roomId !== "lobby") {
      void prisma.roomMember
        .updateMany({
          where: { roomId: room.roomId, userId: targetId },
          data: { role: RoomRole.MEMBER },
        })
        .catch(swallow);
    }
    for (const s of findSocketsByUser(room, targetId)) {
      send(s, { type: "mod:kicked", roomId });
      try {
        s.roomId = undefined;
      } catch (e) {
        swallow(e);
      }
    }
    broadcast(room, { type: "presence:leave", roomId, userId: targetId });
    audit(room, { type: "mod:kick", actorId, actorName, targetId });
    publishState(room);
    return;
  }

  if (msg.type === "mod:ban") {
    if (!actorIsMod) return;
    const targetId = String(msg.userId || "");
    if (!targetId || isOwner(room, targetId)) return;
    room.banned.add(targetId);
    room.users.delete(targetId);
    room.mods.delete(targetId);
    if (room.roomId !== "lobby") {
      void prisma.roomBan
        .upsert({
          where: { roomId_userId: { roomId: room.roomId, userId: targetId } },
          update: {},
          create: { roomId: room.roomId, userId: targetId },
        })
        .catch(swallow);
    }
    for (const s of findSocketsByUser(room, targetId)) {
      send(s, { type: "mod:banned", roomId });
      try {
        s.roomId = undefined;
      } catch (e) {
        swallow(e);
      }
    }
    broadcast(room, { type: "presence:leave", roomId, userId: targetId });
    audit(room, { type: "mod:ban", actorId, actorName, targetId });
    publishState(room);
    return;
  }

  if (msg.type === "mod:unban") {
    if (!actorIsMod) return;
    const targetId = String(msg.userId || "");
    if (!targetId) return;
    room.banned.delete(targetId);
    if (room.roomId !== "lobby") {
      void prisma.roomBan
        .deleteMany({ where: { roomId: room.roomId, userId: targetId } })
        .catch(swallow);
    }
    audit(room, { type: "mod:unban", actorId, actorName, targetId });
    publishState(room);
    return;
  }

  if (msg.type === "mod:promote") {
    if (!actorIsOwner) return;
    const targetId = String(msg.userId || "");
    if (!targetId || isOwner(room, targetId)) return;
    room.mods.add(targetId);
    if (room.roomId !== "lobby") {
      void prisma.roomMember
        .upsert({
          where: { roomId_userId: { roomId: room.roomId, userId: targetId } },
          update: { role: RoomRole.MOD },
          create: { roomId: room.roomId, userId: targetId, name: "", role: RoomRole.MOD },
        })
        .catch(swallow);
    }
    audit(room, { type: "mod:promote", actorId, actorName, targetId });
    publishState(room);
    return;
  }

  if (msg.type === "mod:demote") {
    if (!actorIsOwner) return;
    const targetId = String(msg.userId || "");
    if (!targetId || isOwner(room, targetId)) return;
    room.mods.delete(targetId);
    if (room.roomId !== "lobby") {
      void prisma.roomMember
        .updateMany({
          where: { roomId: room.roomId, userId: targetId },
          data: { role: RoomRole.MEMBER },
        })
        .catch(swallow);
    }
    audit(room, { type: "mod:demote", actorId, actorName, targetId });
    publishState(room);
    return;
  }
}
