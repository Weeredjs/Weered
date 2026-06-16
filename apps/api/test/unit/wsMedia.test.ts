import { describe, it, expect, beforeEach } from "vitest";
import { handleCanvas } from "../../src/sockets/canvas";
import { handleYoutube } from "../../src/sockets/roomMedia";

let broadcasts: any[];
let sent: any[];
let rooms: Map<string, any>;
function mkRoom(over: any = {}) {
  return {
    roomId: "r1",
    users: new Map<string, any>(),
    sockets: new Set<any>(),
    activeModule: null as any,
    ytState: null as any,
    disabledModules: [] as string[],
    ...over,
  };
}
function canvasOpts(over: any = {}) {
  return {
    normalizeRoomId: (x: string) => x,
    rooms,
    broadcast: (_r: any, m: any) => broadcasts.push(m),
    isModOrOwner: () => false,
    send: (_ws: any, m: any) => sent.push(m),
    ...over,
  } as any;
}
const ws = (uid = "alice") => ({ user: { id: uid }, roomId: "r1" });

beforeEach(() => {
  broadcasts = [];
  sent = [];
  rooms = new Map();
});

describe("ws handleCanvas - module switching", () => {
  it("a member sets the active module + broadcasts module:state", () => {
    const room = mkRoom();
    room.users.set("alice", {});
    rooms.set("r1", room);
    handleCanvas(ws(), { type: "module:set", roomId: "r1", mode: "poker" }, canvasOpts());
    expect(room.activeModule?.mode).toBe("poker");
    expect(broadcasts.find((m) => m.type === "module:state")?.activeModule?.mode).toBe("poker");
  });

  it("a non-member cannot set the module", () => {
    rooms.set("r1", mkRoom()); // alice not in room.users
    handleCanvas(ws(), { type: "module:set", roomId: "r1", mode: "poker" }, canvasOpts());
    expect(broadcasts.length).toBe(0);
  });

  it("a disabled module is rejected for a non-mod but allowed for a mod", () => {
    const room = mkRoom({ disabledModules: ["poker"] });
    room.users.set("alice", {});
    rooms.set("r1", room);
    handleCanvas(
      ws(),
      { type: "module:set", roomId: "r1", mode: "poker" },
      canvasOpts({ isModOrOwner: () => false }),
    );
    expect(sent.find((m) => m.type === "module:rejected")?.reason).toBe("module_disabled");
    expect(room.activeModule).toBeNull();

    handleCanvas(
      ws(),
      { type: "module:set", roomId: "r1", mode: "poker" },
      canvasOpts({ isModOrOwner: () => true }),
    );
    expect(room.activeModule?.mode).toBe("poker");
  });

  it("module:clear resets the active module", () => {
    const room = mkRoom({ activeModule: { mode: "poker" } });
    room.users.set("alice", {});
    rooms.set("r1", room);
    handleCanvas(ws(), { type: "module:clear", roomId: "r1" }, canvasOpts());
    expect(room.activeModule).toBeNull();
  });
});

describe("ws handleYoutube - watch-together sync", () => {
  it("youtube:load sets ytState and relays to other sockets (not the sender)", () => {
    const room = mkRoom();
    room.users.set("alice", {});
    const peer = { user: { id: "bob" } };
    const me = ws();
    room.sockets.add(me);
    room.sockets.add(peer);
    handleYoutube(
      me,
      { type: "youtube:load", videoId: "abc123" },
      { room, roomId: "r1" },
      { send: (_ws: any, m: any) => sent.push({ to: _ws, m }) },
    );
    expect(room.ytState?.videoId).toBe("abc123");
    const relayed = sent.filter((x) => x.m.type === "youtube:load");
    expect(relayed.length).toBe(1); // only to the peer, not self
    expect(relayed[0].to).toBe(peer);
  });

  it("youtube:play flips ytState.playing; a non-member is ignored", () => {
    const room = mkRoom({ ytState: { videoId: "abc", playing: false, position: 0 } });
    room.users.set("alice", {});
    handleYoutube(
      ws(),
      { type: "youtube:play", position: 42 },
      { room, roomId: "r1" },
      { send: () => {} },
    );
    expect(room.ytState.playing).toBe(true);
    expect(room.ytState.position).toBe(42);

    const room2 = mkRoom({ ytState: { videoId: "abc", playing: false } }); // stranger not in users
    handleYoutube(
      { user: { id: "stranger" } },
      { type: "youtube:play" },
      { room: room2, roomId: "r1" },
      { send: () => {} },
    );
    expect(room2.ytState.playing).toBe(false);
  });
});
