import { describe, it, expect, beforeEach } from "vitest";
import { handleChat } from "../../src/sockets/messaging";

// WS-handler test harness: the extracted handlers take (ws, msg, opts), so we
// drive them with a mock socket + capture the frames they emit via the `send`
// and `broadcast` opts. The pin/typing/ban/mute/spam/rate paths return before
// any DB write, so these are pure (no DB).

type Frame = { ws: any; payload: any };
let sent: Frame[];
let broadcasts: any[];
let rooms: Map<string, any>;

function mkRoom(roomId: string) {
  return {
    roomId,
    lobbyId: null,
    users: new Map<string, any>(),
    banned: new Set<string>(),
    muted: new Set<string>(),
    msgs: [] as any[],
  };
}
function mkWs(userId: string, roomId: string, globalRole?: string) {
  return { user: { id: userId, name: "u_" + userId, globalRole }, roomId };
}
function baseOpts(over: any = {}) {
  return {
    normalizeRoomId: (x: string) => x,
    ensureRoomLoaded: async (id: string) => rooms.get(id),
    rooms,
    send: (ws: any, payload: any) => sent.push({ ws, payload }),
    broadcast: (_room: any, payload: any) => broadcasts.push(payload),
    isModOrOwner: () => false,
    checkUrlSpam: () => ({ ok: true }),
    checkChatRateLimit: () => ({ ok: true }),
    roleOf: () => "MEMBER",
    awardNotoriety: async () => null,
    resolveMentions: async () => [],
    createNotification: async () => {},
    getAI: async () => null,
    buildOperatorSystemPrompt: () => "",
    ...over,
  } as any;
}

beforeEach(() => {
  sent = [];
  broadcasts = [];
  rooms = new Map();
});

describe("ws handleChat - typing + pin gates", () => {
  it("chat:typing broadcasts to the room when the user is a member", async () => {
    const room = mkRoom("r1");
    room.users.set("alice", {});
    rooms.set("r1", room);
    await handleChat(mkWs("alice", "r1"), { type: "chat:typing" }, baseOpts());
    expect(broadcasts.find((b) => b.type === "chat:typing")?.user.id).toBe("alice");
  });

  it("chat:typing is silent for a non-member", async () => {
    const room = mkRoom("r1");
    rooms.set("r1", room); // alice NOT in room.users
    await handleChat(mkWs("alice", "r1"), { type: "chat:typing" }, baseOpts());
    expect(broadcasts.length).toBe(0);
  });

  it("chat:pin is rejected for a non-mod (no broadcast)", async () => {
    const room = mkRoom("r1");
    rooms.set("r1", room);
    await handleChat(
      mkWs("alice", "r1"),
      { type: "chat:pin", msgId: "m1" },
      baseOpts({ isModOrOwner: () => false }),
    );
    expect(broadcasts.length).toBe(0);
    expect((room as any).pinned?.has?.("m1")).toBeFalsy();
  });

  it("chat:pin by a mod pins the message + broadcasts chat:pins", async () => {
    const room = mkRoom("r1");
    rooms.set("r1", room);
    await handleChat(
      mkWs("mod", "r1", "ADMIN"),
      { type: "chat:pin", msgId: "m1" },
      baseOpts({ isModOrOwner: () => true }),
    );
    expect((room as any).pinned.has("m1")).toBe(true);
    expect(broadcasts.find((b) => b.type === "chat:pins")?.pinned).toContain("m1");
  });

  it("chat:pin enforces the 10-pin cap", async () => {
    const room = mkRoom("r1");
    (room as any).pinned = new Set(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]);
    rooms.set("r1", room);
    await handleChat(
      mkWs("mod", "r1", "ADMIN"),
      { type: "chat:pin", msgId: "k" },
      baseOpts({ isModOrOwner: () => true }),
    );
    expect(sent.find((f) => f.payload.type === "chat:pin:error")).toBeTruthy();
    expect((room as any).pinned.has("k")).toBe(false);
  });
});

describe("ws handleChat - chat:send guards (pre-DB)", () => {
  function roomWithMember(uid: string) {
    const room = mkRoom("r1");
    room.users.set(uid, {});
    rooms.set("r1", room);
    return room;
  }

  it("drops a message from a banned user (no broadcast)", async () => {
    const room = roomWithMember("alice");
    room.banned.add("alice");
    await handleChat(
      mkWs("alice", "r1"),
      { type: "chat:send", roomId: "r1", body: "hi" },
      baseOpts(),
    );
    expect(broadcasts.length).toBe(0);
    expect(sent.length).toBe(0);
  });

  it("drops a message from a muted user (no broadcast)", async () => {
    const room = roomWithMember("alice");
    room.muted.add("alice");
    await handleChat(
      mkWs("alice", "r1"),
      { type: "chat:send", roomId: "r1", body: "hi" },
      baseOpts(),
    );
    expect(broadcasts.length).toBe(0);
  });

  it("rejects URL spam with chat:rejected", async () => {
    roomWithMember("alice");
    await handleChat(
      mkWs("alice", "r1"),
      { type: "chat:send", roomId: "r1", body: "buy now http://x" },
      baseOpts({ checkUrlSpam: () => ({ ok: false, reason: "no_links" }) }),
    );
    const rej = sent.find((f) => f.payload.type === "chat:rejected");
    expect(rej?.payload.reason).toBe("no_links");
  });

  it("rejects when rate-limited with chat:rejected + retryInMs", async () => {
    roomWithMember("alice");
    await handleChat(
      mkWs("alice", "r1"),
      { type: "chat:send", roomId: "r1", body: "spam" },
      baseOpts({ checkChatRateLimit: () => ({ ok: false, reason: "slow_down", retryInMs: 5000 }) }),
    );
    const rej = sent.find((f) => f.payload.type === "chat:rejected");
    expect(rej?.payload.reason).toBe("slow_down");
    expect(rej?.payload.retryInMs).toBe(5000);
  });
});
