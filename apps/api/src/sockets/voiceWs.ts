import { VoiceRoomMode } from "@prisma/client";
import { prisma } from "../lib/prisma";

// Voice WS handlers extracted from the index.ts main message handler:
// voice:mode/raise/lower/approve/revoke + the two voice-exclusive helpers
// (broadcastVoiceState/pushVoicePermission). Void handler: the dispatcher
// matches the "voice:" prefix + returns, so every bare `return;` is preserved
// verbatim. rooms injected by reference (the SAME live Map the WS layer mutates).
type Opts = {
  broadcast: (room: any, msg: any) => void;
  send: (ws: any, msg: any) => void;
  normalizeRoomId: (input: string) => string;
  rooms: Map<string, any>;
  isModOrOwner: (room: any, userId?: string, globalRole?: string) => boolean;
};

export function handleVoice(ws: any, msg: any, opts: Opts): void {
  const { broadcast, send, normalizeRoomId, rooms, isModOrOwner } = opts;
  function broadcastVoiceState(room: any) {
    broadcast(room, {
      type: "voice:state",
      roomId: room.roomId,
      mode: room.voiceMode || "OPEN",
      queue: Array.from(room.voiceQueue || []),
      speakers: Array.from(room.voiceSpeakers || []),
    });
  }
  function pushVoicePermission(room: any, userId: string) {
    for (const sock of room.sockets) {
      if ((sock as any).user?.id === userId) {
        try {
          send(sock as any, { type: "voice:permission", roomId: room.roomId, userId });
        } catch {}
      }
    }
  }

  if (msg.type === "voice:mode") {
    const roomId = normalizeRoomId(String(msg.roomId || ws.roomId || ""));
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    if (!isModOrOwner(room, ws.user.id, ws.user?.globalRole)) return;
    const next = String(msg.mode || "").toUpperCase();
    if (!["OPEN", "QUEUED", "LISTEN_ONLY"].includes(next)) return;
    room.voiceMode = next as any;
    if (next === "LISTEN_ONLY" || next === "OPEN") {
      const dropped = new Set([...(room.voiceSpeakers || []), ...(room.voiceQueue || [])]);
      room.voiceQueue = new Set();
      room.voiceSpeakers = new Set();
      for (const uid of dropped) pushVoicePermission(room, uid);
    }
    prisma.room
      .update({ where: { id: roomId }, data: { voiceMode: next as VoiceRoomMode } })
      .catch(() => {});
    broadcastVoiceState(room);
    return;
  }

  if (msg.type === "voice:raise") {
    const roomId = normalizeRoomId(String(msg.roomId || ws.roomId || ""));
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    if (!room.users.has(ws.user.id)) return;
    if ((room.voiceMode || "OPEN") !== "QUEUED") return;
    if (!room.voiceQueue) room.voiceQueue = new Set();
    if (room.voiceSpeakers?.has(ws.user.id)) return;
    room.voiceQueue.add(ws.user.id);
    broadcastVoiceState(room);
    return;
  }

  if (msg.type === "voice:lower") {
    const roomId = normalizeRoomId(String(msg.roomId || ws.roomId || ""));
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    if (!room.voiceQueue?.has(ws.user.id)) return;
    room.voiceQueue.delete(ws.user.id);
    broadcastVoiceState(room);
    return;
  }

  if (msg.type === "voice:approve") {
    const roomId = normalizeRoomId(String(msg.roomId || ws.roomId || ""));
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    if (!isModOrOwner(room, ws.user.id, ws.user?.globalRole)) return;
    const target = String(msg.userId || "").trim();
    if (!target) return;
    if (!room.voiceSpeakers) room.voiceSpeakers = new Set();
    room.voiceQueue?.delete(target);
    room.voiceSpeakers.add(target);
    broadcastVoiceState(room);
    pushVoicePermission(room, target);
    return;
  }

  if (msg.type === "voice:revoke") {
    const roomId = normalizeRoomId(String(msg.roomId || ws.roomId || ""));
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    if (!isModOrOwner(room, ws.user.id, ws.user?.globalRole)) return;
    const target = String(msg.userId || "").trim();
    if (!target) return;
    const removed = room.voiceSpeakers?.delete(target) || false;
    room.voiceQueue?.delete(target);
    if (removed) pushVoicePermission(room, target);
    broadcastVoiceState(room);
    return;
  }
}
