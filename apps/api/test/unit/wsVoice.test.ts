import { describe, it, expect, beforeEach } from "vitest";
import { handleVoice } from "../../src/sockets/voiceWs";

// Voice-queue WS handler: mode changes + approve/revoke are mod-gated; raise/
// lower are self-service. In-memory room state is the observable.
let broadcasts: any[];
function mkRoom(over: any = {}) {
  return {
    roomId: "r1",
    users: new Map<string, any>(),
    sockets: new Set<any>(),
    voiceMode: "OPEN",
    voiceQueue: new Set<string>(),
    voiceSpeakers: new Set<string>(),
    ...over,
  };
}
let rooms: Map<string, any>;
function mkOpts(over: any = {}) {
  return {
    broadcast: (_r: any, m: any) => broadcasts.push(m),
    send: () => {},
    normalizeRoomId: (x: string) => x,
    rooms,
    isModOrOwner: () => false,
    ...over,
  } as any;
}
const ws = (uid = "alice") => ({ user: { id: uid }, roomId: "r1" });

beforeEach(() => {
  broadcasts = [];
  rooms = new Map();
});

describe("ws handleVoice - queue + mod gates", () => {
  it("voice:mode is mod-gated (non-mod no-op; mod sets the mode + broadcasts)", () => {
    const room = mkRoom();
    rooms.set("r1", room);
    handleVoice(
      ws("alice"),
      { type: "voice:mode", roomId: "r1", mode: "QUEUED" },
      mkOpts({ isModOrOwner: () => false }),
    );
    expect(room.voiceMode).toBe("OPEN");

    handleVoice(
      ws("mod"),
      { type: "voice:mode", roomId: "r1", mode: "QUEUED" },
      mkOpts({ isModOrOwner: () => true }),
    );
    expect(room.voiceMode).toBe("QUEUED");
    expect(broadcasts.find((m) => m.type === "voice:state")).toBeTruthy();
  });

  it("voice:raise queues a member only in QUEUED mode", () => {
    const room = mkRoom({ voiceMode: "QUEUED" });
    room.users.set("alice", {});
    rooms.set("r1", room);
    handleVoice(ws("alice"), { type: "voice:raise", roomId: "r1" }, mkOpts());
    expect(room.voiceQueue.has("alice")).toBe(true);

    // in OPEN mode a raise is a no-op
    const open = mkRoom({ voiceMode: "OPEN" });
    open.users.set("bob", {});
    rooms.set("r2", open);
    handleVoice(
      { user: { id: "bob" }, roomId: "r2" },
      { type: "voice:raise", roomId: "r2" },
      mkOpts(),
    );
    expect(open.voiceQueue.has("bob")).toBe(false);
  });

  it("a mod approves a raised hand (queue -> speakers); non-mod cannot", () => {
    const room = mkRoom({ voiceMode: "QUEUED" });
    room.voiceQueue.add("alice");
    rooms.set("r1", room);
    handleVoice(
      ws("x"),
      { type: "voice:approve", roomId: "r1", userId: "alice" },
      mkOpts({ isModOrOwner: () => false }),
    );
    expect(room.voiceSpeakers.has("alice")).toBe(false);

    handleVoice(
      ws("mod"),
      { type: "voice:approve", roomId: "r1", userId: "alice" },
      mkOpts({ isModOrOwner: () => true }),
    );
    expect(room.voiceSpeakers.has("alice")).toBe(true);
    expect(room.voiceQueue.has("alice")).toBe(false);
  });

  it("a mod revokes a speaker", () => {
    const room = mkRoom();
    room.voiceSpeakers.add("alice");
    rooms.set("r1", room);
    handleVoice(
      ws("mod"),
      { type: "voice:revoke", roomId: "r1", userId: "alice" },
      mkOpts({ isModOrOwner: () => true }),
    );
    expect(room.voiceSpeakers.has("alice")).toBe(false);
  });
});
