import { describe, it, expect, beforeEach } from "vitest";
import { handleLaunch } from "../../src/sockets/roomMedia";

// Coordinated game-launch WS handler: set/clear/fire/abort are owner-gated;
// slot/ready are self-service. In-memory launch state is the observable.
let launchBroadcasts: number;
let rooms: Map<string, any>;
function mkLaunch() {
  return {
    target: null as any,
    ready: new Set<string>(),
    slots: new Map<string, string>(),
    firedAt: null as any,
    firedBy: null as any,
  };
}
function mkRoom() {
  const room: any = { roomId: "r1", users: new Map<string, any>(), launch: mkLaunch() };
  return room;
}
function mkOpts(over: any = {}) {
  return {
    rooms,
    ensureLaunch: (room: any) => room.launch,
    isOwner: () => false,
    isElevatedGlobal: () => false,
    broadcastLaunch: () => {
      launchBroadcasts++;
    },
    ...over,
  } as any;
}
const ws = (uid = "alice") => ({ user: { id: uid }, roomId: "r1" });

beforeEach(() => {
  launchBroadcasts = 0;
  rooms = new Map();
});

describe("ws handleLaunch - coordinated launch", () => {
  it("launch:set is owner-gated", () => {
    const room = mkRoom();
    room.users.set("alice", {});
    rooms.set("r1", room);
    handleLaunch(
      ws(),
      { type: "launch:set", appid: 730, connect: "1.2.3.4:27015" },
      mkOpts({ isOwner: () => false }),
    );
    expect(room.launch.target).toBeNull();

    handleLaunch(
      ws(),
      { type: "launch:set", appid: 730, connect: "1.2.3.4:27015", display: "CS2" },
      mkOpts({ isOwner: () => true }),
    );
    expect(room.launch.target?.appid).toBe(730);
    expect(room.launch.target?.connect).toBe("1.2.3.4:27015");
  });

  it("a member picks a slot and toggles ready (player only)", () => {
    const room = mkRoom();
    room.users.set("alice", {});
    rooms.set("r1", room);
    handleLaunch(ws(), { type: "launch:slot", slot: "player" }, mkOpts());
    expect(room.launch.slots.get("alice")).toBe("player");
    handleLaunch(ws(), { type: "launch:ready", ready: true }, mkOpts());
    expect(room.launch.ready.has("alice")).toBe(true);

    // an observer cannot ready up
    const obs = mkRoom();
    obs.users.set("bob", {});
    obs.launch.slots.set("bob", "observer");
    rooms.set("r2", obs);
    handleLaunch(
      { user: { id: "bob" }, roomId: "r2" },
      { type: "launch:ready", ready: true },
      mkOpts(),
    );
    expect(obs.launch.ready.has("bob")).toBe(false);
  });

  it("launch:clear (owner) resets the target", () => {
    const room = mkRoom();
    room.users.set("alice", {});
    room.launch.target = { appid: 730, connect: "x" };
    rooms.set("r1", room);
    handleLaunch(ws(), { type: "launch:clear" }, mkOpts({ isOwner: () => true }));
    expect(room.launch.target).toBeNull();
  });

  it("a non-member is ignored entirely", () => {
    const room = mkRoom(); // alice not in users
    rooms.set("r1", room);
    handleLaunch(ws(), { type: "launch:slot", slot: "player" }, mkOpts({ isOwner: () => true }));
    expect(room.launch.slots.size).toBe(0);
  });
});
