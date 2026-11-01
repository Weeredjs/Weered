import { parseBarLaunch } from "../lib/barLaunch";
import { mayAct, withinBudget } from "../lib/roomGate";

// Room-media WS handlers extracted from the index.ts main message handler.
// launch:* (the synchronized "launch" mini-game). Void handler: the dispatcher
// keeps the msg.type check + returns, so every bare `return;` here (incl. the
// launch:fire setTimeout callback's) is preserved verbatim. Deps injected by
// reference; rooms is the SAME live Map the rest of the WS layer mutates. The
// dispatcher guarantees this is only called for launch:* messages.
type Opts = {
  rooms: Map<string, any>;
  ensureLaunch: (room: any) => any;
  isOwner: (room: any, userId: string) => boolean;
  isElevatedGlobal: (role?: string) => boolean;
  broadcastLaunch: (room: any) => void;
};

export function handleLaunch(ws: any, msg: any, opts: Opts): void {
  const { rooms, ensureLaunch, isOwner, isElevatedGlobal, broadcastLaunch } = opts;

  if (!ws.user || !ws.roomId) return;
  const room = rooms.get(ws.roomId);
  if (!room) return;
  if (!room.users.has(ws.user.id)) return;
  const launch = ensureLaunch(room);
  const userIsOwner = isOwner(room, ws.user.id) || isElevatedGlobal(ws.user.globalRole);

  if (msg.type === "launch:set") {
    if (!userIsOwner) return;
    // Beyond All Reason: no Steam appid or connect string; the map, mode and
    // host are validated server-side and the room password is minted here.
    if (msg.kind === "bar") {
      const bar = parseBarLaunch(msg.bar, room);
      if (!bar) return;
      launch.target = {
        appid: 0,
        connect: bar.hostAddress || "local",
        display: String(msg.display || bar.map)
          .trim()
          .slice(0, 80),
        note: msg.note ? String(msg.note).trim().slice(0, 300) : undefined,
        kind: "bar",
        bar,
        setBy: ws.user.id,
        setAt: Date.now(),
      };
      launch.ready.clear();
      launch.firedAt = null;
      launch.firedBy = null;
      broadcastLaunch(room);
      return;
    }
    const appid = Number(msg.appid);
    const connect = String(msg.connect || "")
      .trim()
      .slice(0, 200);
    const display = String(msg.display || connect || "")
      .trim()
      .slice(0, 80);
    const note = msg.note ? String(msg.note).trim().slice(0, 300) : undefined;
    if (!appid || !connect) return;
    launch.target = { appid, connect, display, note, setBy: ws.user.id, setAt: Date.now() };
    launch.ready.clear();
    launch.firedAt = null;
    launch.firedBy = null;
    broadcastLaunch(room);
    return;
  }

  if (msg.type === "launch:clear") {
    if (!userIsOwner) return;
    launch.target = null;
    launch.ready.clear();
    launch.slots.clear();
    launch.firedAt = null;
    launch.firedBy = null;
    broadcastLaunch(room);
    return;
  }

  if (msg.type === "launch:slot") {
    const slot = msg.slot === "player" ? "player" : "observer";
    launch.slots.set(ws.user.id, slot);
    if (slot === "observer") launch.ready.delete(ws.user.id);
    broadcastLaunch(room);
    return;
  }

  if (msg.type === "launch:ready") {
    if (launch.slots.get(ws.user.id) !== "player") return;
    const ready = Boolean(msg.ready);
    if (ready) launch.ready.add(ws.user.id);
    else launch.ready.delete(ws.user.id);
    broadcastLaunch(room);
    return;
  }

  if (msg.type === "launch:fire") {
    if (!userIsOwner || !launch.target) return;
    const anyPlayer = Array.from(launch.slots.values()).some((s) => s === "player");
    if (!anyPlayer) return;
    launch.firedAt = Date.now();
    launch.firedBy = ws.user.id;
    broadcastLaunch(room);
    setTimeout(() => {
      const r = rooms.get(room.roomId);
      if (!r?.launch) return;
      if (r.launch.firedAt === launch.firedAt) {
        r.launch.firedAt = null;
        r.launch.firedBy = null;
        r.launch.ready.clear();
        broadcastLaunch(r);
      }
    }, 60_000);
    return;
  }

  if (msg.type === "launch:abort") {
    if (!userIsOwner) return;
    launch.firedAt = null;
    launch.firedBy = null;
    broadcastLaunch(room);
    return;
  }
  return;
}

export function handleYoutube(
  ws: any,
  msg: any,
  snap: { room: any; roomId: string },
  opts: { send: (ws: any, m: any) => void },
): void {
  const { room, roomId } = snap;
  const { send } = opts;
  // The four watch-together moves only, from someone allowed to act, at most
  // 12 every 2 seconds, and relayed as their own small frame. It used to pass
  // any youtube:* message on whole, up to 256 KB, to everyone, unthrottled
  // (red team 2026-11-01, findings 11 and 12).
  if (!["youtube:load", "youtube:play", "youtube:pause", "youtube:stop"].includes(msg.type)) return;
  if (!mayAct(room, ws.user) || !withinBudget(ws, "youtube", 12, 2000)) return;
  const videoId = typeof msg.videoId === "string" ? msg.videoId.slice(0, 64) : undefined;
  const position = Number.isFinite(Number(msg.position)) ? Number(msg.position) : 0;
  if (msg.type === "youtube:load" && !videoId) return;
  if (msg.type === "youtube:load" && videoId) {
    room.ytState = {
      videoId,
      playing: false,
      position: 0,
      updatedAt: Date.now(),
    };
    if (room.activeModule && room.activeModule.mode === "youtube") {
      room.activeModule.url = videoId;
    }
  } else if (msg.type === "youtube:play") {
    if (room.ytState) {
      room.ytState.playing = true;
      room.ytState.position = position;
      room.ytState.updatedAt = Date.now();
    }
  } else if (msg.type === "youtube:pause") {
    if (room.ytState) {
      room.ytState.playing = false;
      room.ytState.position = position;
      room.ytState.updatedAt = Date.now();
    }
  } else if (msg.type === "youtube:stop") {
    room.ytState = null;
  }
  const frame = {
    type: msg.type,
    roomId,
    _from: ws.user.id,
    ...(videoId ? { videoId } : {}),
    ...(msg.type === "youtube:play" || msg.type === "youtube:pause" ? { position } : {}),
  };
  for (const s of room.sockets) {
    if (s === ws) continue;
    send(s, frame);
  }
  return;
}
