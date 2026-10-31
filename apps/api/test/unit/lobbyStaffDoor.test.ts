import { describe, it, expect, beforeEach, vi } from "vitest";

// A lobby's moderators pass its rooms' lock and password on the way in. Their
// rank is on their entry in the room only once they're in, so the door looks it
// up (sockets/presence.ts). Before 2026-10-31 a lobby moderator knocked at their
// own lobby's locked room like a stranger.
const levels: Record<string, number> = {};
vi.mock("../../src/lib/lobbyAccess", async (orig) => ({
  ...(await orig<typeof import("../../src/lib/lobbyAccess")>()),
  lobbyLevelOf: vi.fn(async (uid: string) => levels[uid] ?? 0),
}));
const { handlePresence } = await import("../../src/sockets/presence");

let sent: any[];
let joined: string[];
let rooms: Map<string, any>;
const mkRoom = (over: any = {}) => ({
  roomId: "r1",
  lobbyId: "lob",
  banned: new Set<string>(),
  passwordHash: null as string | null,
  locked: true,
  knocks: [] as any[],
  pending: new Map<string, Set<any>>(),
  sockets: new Set<any>(),
  users: new Map<string, any>(),
  ...over,
});
const opts = () =>
  ({
    rooms,
    send: (_ws: any, m: any) => sent.push(m),
    broadcast: () => {},
    normalizeRoomId: (x: string) => x,
    ensureRoomLoaded: async (id: string) => rooms.get(id),
    isModOrOwner: () => false,
    doJoin: async (_ws: any, rid: string) => {
      joined.push(rid);
    },
    publishState: () => {},
    leaveRoom: () => {},
  }) as any;
const join = (uid: string, extra: any = {}) =>
  handlePresence(
    { user: { id: uid, name: uid, ...extra } },
    { type: "presence:join", roomId: "r1" },
    opts(),
  );

beforeEach(() => {
  sent = [];
  joined = [];
  rooms = new Map();
  for (const k of Object.keys(levels)) delete levels[k];
});

describe("a lobby's staff at its rooms' doors", () => {
  it("a lobby moderator walks into a locked room", async () => {
    levels.mod = 3;
    rooms.set("r1", mkRoom());
    await join("mod");
    expect(joined).toEqual(["r1"]);
    expect(sent.find((m) => m.type === "room:knock:queued")).toBeFalsy();
  });

  it("a lobby member still knocks", async () => {
    levels.member = 1;
    const room = mkRoom();
    rooms.set("r1", room);
    await join("member");
    expect(joined).toEqual([]);
    expect(room.knocks.some((k: any) => k.userId === "member")).toBe(true);
  });

  it("the lobby's owner skips a room's password", async () => {
    levels.boss = 5;
    rooms.set("r1", mkRoom({ locked: false, passwordHash: "$2a$10$fakehashfakehashfakeha" }));
    await join("boss");
    expect(joined).toEqual(["r1"]);
  });

  it("a guest is never looked up as staff", async () => {
    levels.g = 5;
    rooms.set("r1", mkRoom());
    await join("g", { guest: true });
    expect(joined).toEqual([]);
  });

  it("a room outside any lobby keeps its lock", async () => {
    levels.mod = 3;
    rooms.set("r1", mkRoom({ lobbyId: undefined }));
    await join("mod");
    expect(joined).toEqual([]);
  });
});
