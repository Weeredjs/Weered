import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";

// Presence WS handlers extracted from the index.ts main message handler:
// the rooms:list/lobby:rooms/room:list trio + presence:join/idle/leave. Void
// handler (dispatcher matches the type-set + returns), so every bare return; is
// preserved verbatim -- including the locked-room / password / knock branches.
// rooms injected by reference (the SAME live Map the WS layer mutates).
type Opts = {
  rooms: Map<string, any>;
  send: (ws: any, msg: any) => void;
  broadcast: (room: any, msg: any) => void;
  normalizeRoomId: (input: string) => string;
  ensureRoomLoaded: (roomId: string) => Promise<any>;
  isModOrOwner: (room: any, userId?: string, globalRole?: string) => boolean;
  doJoin: (ws: any, roomId: string) => Promise<any>;
  publishState: (room: any) => void;
  leaveRoom: (ws: any) => void;
};

export async function handlePresence(ws: any, msg: any, opts: Opts): Promise<void> {
  const {
    rooms,
    send,
    broadcast,
    normalizeRoomId,
    ensureRoomLoaded,
    isModOrOwner,
    doJoin,
    publishState,
    leaveRoom,
  } = opts;

  if (
    (ws.user as any)?.guest &&
    (msg.type === "rooms:list" || msg.type === "lobby:rooms" || msg.type === "room:list")
  ) {
    send(ws, { type: msg.type, rooms: [], lobbies: [] });
    return;
  }

  if (msg.type === "rooms:list" || msg.type === "lobby:rooms" || msg.type === "room:list") {
    const [lobbyList, roomList] = await Promise.all([
      prisma.lobby.findMany({
        where: { pinned: true },
        select: {
          id: true,
          name: true,
          description: true,
          verified: true,
          pinned: true,
          moduleType: true,
        },
      }),
      prisma.room.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          locked: true,
          lobbyId: true,
          iconUrl: true,
          bannerUrl: true,
          accentColor: true,
          pinned: true,
          isEvent: true,
          _count: { select: { members: true } },
        },
        take: 100,
      }),
    ]);
    const lobbyIds = new Set(lobbyList.map((l: any) => l.id));
    const lobbyOut = lobbyList.map((l: any) => ({
      id: l.id,
      roomId: l.id,
      name: l.name,
      description: l.description,
      verified: l.verified,
      pinned: true,
      moduleType: l.moduleType,
      onlineCount: rooms.get(l.id)?.users.size ?? 0,
      locked: false,
    }));
    const roomOut = roomList
      .filter((r) => !r.id.includes("%") && !lobbyIds.has(r.id) && !r.id.startsWith("mtg-"))
      .map((r: any) => ({
        id: r.id,
        roomId: r.id,
        name: r.name || r.id,
        onlineCount: rooms.get(r.id)?.users.size ?? 0,
        locked: Boolean(r.locked),
        pinned: Boolean(r.pinned),
        isEvent: Boolean(r.isEvent),
        iconUrl: r.iconUrl ?? null,
        bannerUrl: r.bannerUrl ?? null,
        accentColor: r.accentColor ?? null,
        lobbyId: r.lobbyId ?? null,
      }));
    send(ws, { type: "rooms", rooms: [...lobbyOut, ...roomOut] });
    return;
  }

  if (msg.type === "presence:join") {
    const roomId = normalizeRoomId(String(msg.roomId || ""));
    if (!roomId) return;
    {
      const _u = ws.user as any;
      if (_u?.guest || _u?.host) {
        const office = String(_u.scope?.office || "");
        const inScope = office && (roomId === office || roomId.startsWith(office + "-"));
        if (!inScope) {
          send(ws, { type: "room:denied", roomId, reason: "out_of_scope" });
          return;
        }
      } else if (roomId.startsWith("mtg-")) {
        send(ws, { type: "room:denied", roomId, reason: "private_meeting" });
        return;
      }
    }
    const room = await ensureRoomLoaded(roomId);
    if (room.banned.has(ws.user.id)) {
      send(ws, { type: "room:banned", roomId });
      return;
    }
    const uid = ws.user.id;
    const isLobby = String(roomId || "").startsWith("lobby:");

    if (room.passwordHash && !isLobby && !isModOrOwner(room, uid, ws.user?.globalRole)) {
      const suppliedPassword = typeof msg.password === "string" ? msg.password : "";
      if (!suppliedPassword) {
        send(ws, { type: "room:password:required", roomId });
        return;
      }
      const passwordOk = await bcrypt.compare(suppliedPassword, room.passwordHash);
      if (!passwordOk) {
        send(ws, { type: "room:password:wrong", roomId });
        return;
      }
    }

    if (isLobby) room.locked = false;
    if (room.locked && !isLobby && !isModOrOwner(room, uid, ws.user?.globalRole)) {
      if (!room.knocks.some((k: any) => k.userId === uid)) {
        room.knocks.push({ userId: uid, name: ws.user.name, ts: Date.now() });
        if (room.knocks.length > 200) room.knocks.splice(0, room.knocks.length - 200);
      }
      let p = room.pending.get(uid);
      if (!p) {
        p = new Set<any>();
        room.pending.set(uid, p);
      }
      p.add(ws);
      ws.pendingRoomId = roomId;
      send(ws, { type: "room:knock:queued", roomId });
      for (const s of room.sockets) {
        const sid = s.user?.id;
        if (!sid || !isModOrOwner(room, sid)) continue;
        send(s, { type: "room:knock", roomId, user: { id: uid, name: ws.user.name } });
      }
      publishState(room);
      return;
    }
    await doJoin(ws, roomId);
    return;
  }

  if (msg.type === "presence:idle") {
    if (!ws.user) return;
    const away = Boolean(msg.away);
    ws.user.isAway = away;
    for (const [, room] of rooms) {
      const entry = room.users.get(ws.user.id);
      if (entry) {
        entry.isAway = away;
        broadcast(room, { type: "presence:join", roomId: room.roomId, user: entry });
      }
    }
    return;
  }

  if (msg.type === "presence:leave") {
    if (ws.pendingRoomId) {
      const rid = ws.pendingRoomId;
      const r = rooms.get(rid);
      if (r) {
        const set = r.pending.get(ws.user.id);
        if (set) set.delete(ws);
        if (set && set.size === 0) r.pending.delete(ws.user.id);
        ws.pendingRoomId = undefined;
        publishState(r);
      }
      return;
    }
    const leaveRid = normalizeRoomId(String(msg.roomId || ""));
    if (leaveRid && ws.roomId && leaveRid !== ws.roomId) return;
    leaveRoom(ws);
    return;
  }
}
