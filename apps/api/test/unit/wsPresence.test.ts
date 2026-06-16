import { describe, it, expect, beforeEach } from "vitest";
import { handlePresence } from "../../src/sockets/presence";

// presence:join gate paths (banned / password / locked-knock / clean) + idle +
// leave, via the extracted handler with a mock socket and spied doJoin/leaveRoom.

let sent: any[];
let broadcasts: any[];
let joined: string[];
let leftCount: number;
let rooms: Map<string, any>;

function mkRoom(roomId = "r1", over: any = {}) {
  return {
    roomId,
    banned: new Set<string>(),
    passwordHash: null as string | null,
    locked: false,
    knocks: [] as any[],
    pending: new Map<string, Set<any>>(),
    sockets: new Set<any>(),
    users: new Map<string, any>(),
    ...over,
  };
}
function mkWs(uid = "alice") {
  return { user: { id: uid, name: "u_" + uid } };
}
function mkOpts(over: any = {}) {
  return {
    rooms,
    send: (_ws: any, m: any) => sent.push(m),
    broadcast: (_room: any, m: any) => broadcasts.push(m),
    normalizeRoomId: (x: string) => x,
    ensureRoomLoaded: async (id: string) => rooms.get(id),
    isModOrOwner: () => false,
    doJoin: async (_ws: any, rid: string) => {
      joined.push(rid);
    },
    publishState: () => {},
    leaveRoom: () => {
      leftCount++;
    },
    ...over,
  } as any;
}

beforeEach(() => {
  sent = [];
  broadcasts = [];
  joined = [];
  leftCount = 0;
  rooms = new Map();
});

describe("ws handlePresence - join gates + idle/leave", () => {
  it("a banned user is rejected with room:banned (no join)", async () => {
    const room = mkRoom();
    room.banned.add("alice");
    rooms.set("r1", room);
    await handlePresence(mkWs(), { type: "presence:join", roomId: "r1" }, mkOpts());
    expect(sent.find((m) => m.type === "room:banned")).toBeTruthy();
    expect(joined).toEqual([]);
  });

  it("a password-protected room asks for a password when none is supplied", async () => {
    const room = mkRoom("r1", { passwordHash: "$2a$10$fakehashfakehashfakeha" });
    rooms.set("r1", room);
    await handlePresence(mkWs(), { type: "presence:join", roomId: "r1" }, mkOpts());
    expect(sent.find((m) => m.type === "room:password:required")).toBeTruthy();
    expect(joined).toEqual([]);
  });

  it("a locked room queues a knock instead of joining", async () => {
    const room = mkRoom("r1", { locked: true });
    rooms.set("r1", room);
    await handlePresence(mkWs(), { type: "presence:join", roomId: "r1" }, mkOpts());
    expect(sent.find((m) => m.type === "room:knock:queued")).toBeTruthy();
    expect(room.knocks.some((k: any) => k.userId === "alice")).toBe(true);
    expect(joined).toEqual([]);
  });

  it("a clean unlocked room joins via doJoin", async () => {
    rooms.set("r1", mkRoom());
    await handlePresence(mkWs(), { type: "presence:join", roomId: "r1" }, mkOpts());
    expect(joined).toEqual(["r1"]);
  });

  it("presence:idle marks the user away and broadcasts to their rooms", async () => {
    const room = mkRoom();
    room.users.set("alice", { id: "alice", name: "Alice" });
    rooms.set("r1", room);
    const ws = mkWs();
    await handlePresence(ws, { type: "presence:idle", away: true }, mkOpts());
    expect((ws.user as any).isAway).toBe(true);
    expect((room.users.get("alice") as any).isAway).toBe(true);
    expect(broadcasts.find((m) => m.type === "presence:join")).toBeTruthy();
  });

  it("presence:leave calls leaveRoom", async () => {
    const ws: any = mkWs();
    ws.roomId = "r1";
    rooms.set("r1", mkRoom());
    await handlePresence(ws, { type: "presence:leave", roomId: "r1" }, mkOpts());
    expect(leftCount).toBe(1);
  });
});
