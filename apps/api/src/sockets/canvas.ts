import { swallow } from "../lib/logger";
// Canvas/tabletop WS handlers extracted from the index.ts main message handler.
// Pure in-memory room-module relays. Deps injected by reference (rooms is the
// SAME live Map the rest of the WS layer mutates). Returns true if it consumed
// msg.type (the dispatcher then returns), false to fall through to the next
// handler. The dispatcher guarantees ws.user is set (auth gate runs first).
type Opts = {
  normalizeRoomId: (input: string) => string;
  rooms: Map<string, any>;
  broadcast: (room: any, msg: any) => void;
  isModOrOwner: (room: any, userId?: string, globalRole?: string) => boolean;
  send: (ws: any, msg: any) => void;
};

export function handleCanvas(ws: any, msg: any, opts: Opts): boolean {
  const { normalizeRoomId, rooms, broadcast, isModOrOwner, send } = opts;

  if (msg.type === "module:set") {
    const roomId = normalizeRoomId(String(msg.roomId || ws.roomId || ""));
    if (!roomId) return true;
    const room = rooms.get(roomId);
    if (!room) return true;
    if (!room.users.has(ws.user.id)) return true;
    const mode = String(msg.mode || "").trim() || null;
    if (!mode) {
      room.activeModule = null;
      room.ytState = null;
      broadcast(room, { type: "module:state", roomId, activeModule: null });
      return true;
    }
    const disabled: string[] = Array.isArray(room.disabledModules) ? room.disabledModules : [];
    if (disabled.includes(mode) && !isModOrOwner(room, ws.user.id, ws.user?.globalRole)) {
      try {
        send(ws, { type: "module:rejected", roomId, mode, reason: "module_disabled" });
      } catch (e) {
        swallow(e);
      }
      return true;
    }
    if (mode !== "youtube") room.ytState = null;
    const moduleState = {
      mode,
      url: typeof msg.url === "string" ? msg.url.slice(0, 2000) : undefined,
      channel:
        typeof msg.channel === "string" ? msg.channel.slice(0, 100).toLowerCase() : undefined,
      setBy: ws.user.id,
      setAt: Date.now(),
    };
    room.activeModule = moduleState;
    broadcast(room, { type: "module:state", roomId, activeModule: moduleState });
    return true;
  }

  if (msg.type === "module:clear") {
    const roomId = normalizeRoomId(String(msg.roomId || ws.roomId || ""));
    if (!roomId) return true;
    const room = rooms.get(roomId);
    if (!room) return true;
    if (!room.users.has(ws.user.id)) return true;
    room.activeModule = null;
    room.ytState = null;
    broadcast(room, { type: "module:state", roomId, activeModule: null });
    return true;
  }

  return false;
}

export function handleCanvasRelay(
  ws: any,
  msg: any,
  snap: { room: any; roomId: string },
  opts: { send: (ws: any, m: any) => void },
): boolean {
  if (
    msg.type === "dnd:initiative" ||
    msg.type === "dnd:roll" ||
    msg.type === "dnd:combatant:damage" ||
    msg.type === "dnd:combatant:select" ||
    msg.type === "map:token-move" ||
    msg.type === "map:fog-reveal" ||
    msg.type === "map:fog-clear"
  ) {
    const { room, roomId } = snap;
    if (!room.users.has(ws.user.id)) return true;
    for (const s of room.sockets) {
      if (s === ws) continue;
      opts.send(s, { ...msg, roomId, _from: ws.user.id });
    }
    return true;
  }
  return false;
}
