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
  if (!room.users.has(ws.user.id)) return;
  if (msg.type === "youtube:load" && msg.videoId) {
    room.ytState = {
      videoId: String(msg.videoId),
      playing: false,
      position: 0,
      updatedAt: Date.now(),
    };
    if (room.activeModule && room.activeModule.mode === "youtube") {
      room.activeModule.url = String(msg.videoId);
    }
  } else if (msg.type === "youtube:play") {
    if (room.ytState) {
      room.ytState.playing = true;
      room.ytState.position = Number(msg.position ?? 0);
      room.ytState.updatedAt = Date.now();
    }
  } else if (msg.type === "youtube:pause") {
    if (room.ytState) {
      room.ytState.playing = false;
      room.ytState.position = Number(msg.position ?? 0);
      room.ytState.updatedAt = Date.now();
    }
  } else if (msg.type === "youtube:stop") {
    room.ytState = null;
  }
  for (const s of room.sockets) {
    if (s === ws) continue;
    send(s, { ...msg, roomId, _from: ws.user.id });
  }
  return;
}
