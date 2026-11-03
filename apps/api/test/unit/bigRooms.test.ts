import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  announcePresence,
  BIG_ROOM,
  publishState,
  rooms,
  setRoomStateDeps,
} from "../../src/lib/roomState";
import { _setFloodStateForTest } from "../../src/lib/flood";

// Flood readiness 2026-11-02: everyone on Home sits in one room, and every
// arrival went to every person in it. A big room now sends its head count and
// a sample at most once a second; a small room is unchanged.
type Got = { type: string; [k: string]: any };
const sock = (id: string, room: string) => {
  const got: Got[] = [];
  return {
    readyState: 1,
    roomId: room,
    user: { id, name: id, globalRole: "USER" },
    send: (raw: string) => got.push(JSON.parse(raw)),
    got,
  };
};

function makeRoom(roomId: string, people: number, lobbyId: string | null = null) {
  const room: any = {
    roomId,
    lobbyId,
    name: roomId,
    ownerId: "",
    users: new Map(),
    sockets: new Set(),
    mods: new Set(),
    muted: new Set(),
    banned: new Set(),
    msgs: [],
  };
  const socks = [];
  for (let i = 0; i < people; i++) {
    const s = sock(`u${i}`, roomId);
    room.users.set(s.user.id, { id: s.user.id, name: s.user.id });
    room.sockets.add(s);
    socks.push(s);
  }
  rooms.set(roomId, room);
  return { room, socks };
}

const wss = { clients: new Set<any>() };
beforeEach(() => {
  vi.useFakeTimers();
  _setFloodStateForTest({ flood: "off", door: "open" });
  wss.clients.clear();
  setRoomStateDeps({ wss: wss as any });
});
afterEach(() => {
  vi.useRealTimers();
  rooms.clear();
});

const arrive = (room: any, id: string) => {
  const user = { id, name: id };
  room.users.set(id, user);
  announcePresence(room, { type: "presence:join", roomId: room.roomId, user });
};

describe("a small room", () => {
  it("tells everyone about each arrival at once, as before", () => {
    const { room, socks } = makeRoom("small", 5);
    arrive(room, "new1");
    expect(socks[0].got.map((m) => m.type)).toEqual(["presence:join"]);
  });
});

describe("a big room", () => {
  it("folds arrivals into one update a second: a sample and the real head count", () => {
    const { room, socks } = makeRoom("big", BIG_ROOM + 20);
    for (let i = 0; i < 25; i++) arrive(room, `new${i}`);
    expect(socks[0].got).toHaveLength(0);
    vi.advanceTimersByTime(1_000);
    const states = socks[0].got.filter((m) => m.type === "presence:state");
    expect(states).toHaveLength(1);
    expect(states[0].count).toBe(BIG_ROOM + 45);
    expect(states[0].sampled).toBe(true);
    expect(states[0].users.length).toBeLessThanOrEqual(61);
    expect(states[0].payload).toBeUndefined();
  });

  it("sends only the count while the sample hasn't moved, and everything after a room change", () => {
    const { room, socks } = makeRoom("big2", BIG_ROOM + 20);
    arrive(room, "a");
    vi.advanceTimersByTime(1_000);
    socks[0].got.length = 0;
    arrive(room, "b");
    vi.advanceTimersByTime(1_000);
    expect(socks[0].got).toEqual([
      { type: "presence:count", roomId: "big2", count: BIG_ROOM + 22 },
    ]);
    socks[0].got.length = 0;
    room.locked = true;
    publishState(room);
    vi.advanceTimersByTime(1_000);
    expect(socks[0].got[0]).toMatchObject({ type: "presence:state", locked: true });
  });

  it("goes back to single arrivals once it's small again, after one full list", () => {
    const { room, socks } = makeRoom("shrink", BIG_ROOM + 1);
    arrive(room, "x");
    vi.advanceTimersByTime(1_000);
    for (const id of [...room.users.keys()].slice(0, 10)) room.users.delete(id);
    socks[0].got.length = 0;
    announcePresence(room, { type: "presence:leave", roomId: "shrink", userId: "gone" });
    const full = socks[0].got.find((m) => m.type === "presence:state");
    expect(full?.sampled).toBeUndefined();
    expect(full?.users.length).toBe(room.users.size);
    socks[0].got.length = 0;
    arrive(room, "y");
    expect(socks[0].got.map((m) => m.type)).toEqual(["presence:join"]);
  });

  it("in flood mode a room is big sooner and updates every 3 s", () => {
    _setFloodStateForTest({ flood: "on" });
    const { room, socks } = makeRoom("flood", 40);
    arrive(room, "f1");
    vi.advanceTimersByTime(1_000);
    arrive(room, "f2");
    vi.advanceTimersByTime(1_000);
    expect(socks[0].got.filter((m) => m.type === "presence:state")).toHaveLength(1);
    vi.advanceTimersByTime(3_000);
    expect(socks[0].got.length).toBeGreaterThan(1);
  });
});

describe("the lobby activity ping", () => {
  it("reaches people in the same lobby only, not the whole site", () => {
    const { room } = makeRoom("lobbyA-room", 3, "lobbyA");
    makeRoom("lobbyA", 0, "lobbyA");
    const here = sock("here", "lobbyA");
    const elsewhere = sock("elsewhere", "somewhere-else");
    makeRoom("somewhere-else", 0, "lobbyB");
    wss.clients.add(here);
    wss.clients.add(elsewhere);
    arrive(room, "z");
    expect(here.got.map((m) => m.type)).toContain("lobby:activity");
    expect(elsewhere.got).toHaveLength(0);
  });
});
