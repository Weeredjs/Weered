import { describe, it, expect, beforeEach, vi } from "vitest";

// The handlers save in the background; no database here.
vi.mock("../../src/lib/prisma", () => {
  const model = new Proxy({}, { get: () => async () => ({}) });
  return { prisma: new Proxy({}, { get: () => model }) };
});
import { handleRoomMod, KICK_MS } from "../../src/sockets/roomMod";
import { handleChat } from "../../src/sockets/messaging";
import { adminStatePayload, isModOrOwner, rankIn, roleOf } from "../../src/lib/roomState";

// The mod controls James tested on 2026-10-31: a kick that holds and tells the
// person, rank rules (a mod can't kick a mod), the chat lock and slow mode that
// actually stop messages (and say why), and a lobby's staff moderating its rooms.

let sent: any[];
let broadcasts: any[];
let rooms: Map<string, any>;

function mkRoom(roomId = "r1", extra: Record<string, any> = {}) {
  return {
    roomId,
    name: "War Room",
    lobbyId: null as string | null,
    ownerId: undefined as string | undefined,
    users: new Map<string, any>(),
    mods: new Set<string>(),
    banned: new Set<string>(),
    muted: new Set<string>(),
    sockets: new Set<any>(),
    msgs: [] as any[],
    ...extra,
  };
}
const modOpts = (over: any = {}) =>
  ({
    publishState: () => {},
    broadcast: (_r: any, m: any) => broadcasts.push(m),
    persistRoomBasics: async () => {},
    audit: () => {},
    removeKnock: () => {},
    removePending: () => {},
    doJoin: async () => {},
    send: (_ws: any, m: any) => sent.push(m),
    getGlobalRole: async () => "USER",
    canAccessStaff: () => false,
    findSocketsByUser: (room: any, uid: string) =>
      [...room.sockets].filter((s: any) => s.user?.id === uid),
    isOwner: (room: any, uid?: string) => !!uid && room.ownerId === uid,
    rooms: new Map(),
    wss: { clients: new Set() },
    ...over,
  }) as any;
const ctxFor = (room: any, actorId: string, over: any = {}) => ({
  room,
  roomId: room.roomId,
  actorId,
  actorName: actorId,
  actorIsMod: true,
  actorIsOwner: false,
  ...over,
});
const chatOpts = (over: any = {}) =>
  ({
    normalizeRoomId: (x: string) => x,
    loadExistingRoom: async (id: string) => rooms.get(id) ?? null,
    rooms,
    send: (_ws: any, payload: any) => sent.push(payload),
    broadcast: (_room: any, payload: any) => broadcasts.push(payload),
    isModOrOwner,
    checkUrlSpam: () => ({ ok: true }),
    checkChatRateLimit: () => ({ ok: true }),
    roleOf: () => "member",
    awardNotoriety: async () => null,
    resolveMentions: async () => [],
    createNotification: async () => {},
    getAI: async () => null,
    buildOperatorSystemPrompt: () => "",
    ...over,
  }) as any;

beforeEach(() => {
  sent = [];
  broadcasts = [];
  rooms = new Map();
});

describe("kick", () => {
  it("keeps them out for a while and tells them who and how long", async () => {
    const room = mkRoom();
    room.mods.add("mod1");
    room.users.set("victim", { id: "victim" });
    room.sockets.add({ user: { id: "victim" }, roomId: "r1" });
    await handleRoomMod(
      { user: { id: "mod1", name: "Mod" } },
      { type: "mod:kick", userId: "victim" },
      ctxFor(room, "mod1"),
      modOpts(),
    );
    const until = (room as any).kickedUntil?.get("victim");
    expect(until).toBeGreaterThan(Date.now() + KICK_MS - 5000);
    const note = sent.find((m) => m.type === "mod:kicked");
    expect(note).toMatchObject({ roomId: "r1", roomName: "War Room", by: "mod1", minutes: 10 });
  });

  it("a mod can't kick another mod, or themselves", async () => {
    const room = mkRoom();
    room.mods.add("mod1");
    room.mods.add("mod2");
    room.users.set("mod2", { id: "mod2" });
    await handleRoomMod(
      { user: { id: "mod1" } },
      { type: "mod:kick", userId: "mod2" },
      ctxFor(room, "mod1"),
      modOpts(),
    );
    expect(room.users.has("mod2")).toBe(true);
    expect(sent.find((m) => m.type === "mod:error")?.reason).toMatch(/rank/);
    await handleRoomMod(
      { user: { id: "mod1" } },
      { type: "mod:kick", userId: "mod1" },
      ctxFor(room, "mod1"),
      modOpts(),
    );
    expect((room as any).kickedUntil?.has("mod1")).toBeFalsy();
  });

  it("the owner can kick a mod", async () => {
    const room = mkRoom("r1", { ownerId: "boss" });
    room.mods.add("mod2");
    room.users.set("mod2", { id: "mod2" });
    await handleRoomMod(
      { user: { id: "boss" } },
      { type: "mod:kick", userId: "mod2" },
      ctxFor(room, "boss", { actorIsOwner: true }),
      modOpts(),
    );
    expect(room.users.has("mod2")).toBe(false);
  });
});

describe("chat lock and slow mode", () => {
  it("a mod locks the room's chat; members are told, mods still post", async () => {
    const room = mkRoom();
    room.mods.add("mod1");
    await handleRoomMod(
      { user: { id: "mod1" } },
      { type: "room:chat:lock" },
      ctxFor(room, "mod1"),
      modOpts(),
    );
    expect((room as any).chatLocked).toBe(true);
    expect(broadcasts.find((b) => b.type === "room:chat:disable")).toBeTruthy();

    rooms.set("r1", room);
    room.users.set("alice", {});
    sent = [];
    await handleChat(
      { user: { id: "alice", name: "Alice" }, roomId: "r1" },
      { type: "chat:send", roomId: "r1", body: "hi" },
      chatOpts(),
    );
    expect(sent.find((m) => m.type === "chat:rejected")?.reason).toMatch(/locked/);
  });

  it("slow mode turns away a second message too soon", async () => {
    const room = mkRoom();
    room.mods.add("mod1");
    await handleRoomMod(
      { user: { id: "mod1" } },
      { type: "room:slow", seconds: 30 },
      ctxFor(room, "mod1"),
      modOpts(),
    );
    expect((room as any).slowSec).toBe(30);
    (room as any).lastSaid = new Map([["alice", Date.now()]]);
    rooms.set("r1", room);
    room.users.set("alice", {});
    await handleChat(
      { user: { id: "alice", name: "Alice" }, roomId: "r1" },
      { type: "chat:send", roomId: "r1", body: "again" },
      chatOpts(),
    );
    expect(sent.find((m) => m.type === "chat:rejected")?.reason).toMatch(/Slow mode/);
  });

  it("only allowed slow-mode steps are taken", async () => {
    const room = mkRoom();
    await handleRoomMod(
      { user: { id: "mod1" } },
      { type: "room:slow", seconds: 7 },
      ctxFor(room, "mod1"),
      modOpts(),
    );
    expect((room as any).slowSec).toBe(0);
  });

  it("a moderator's own update carries the lock and slow mode (it used to say open)", () => {
    const room = mkRoom("r1", { knocks: [], audit: [], chatLocked: true, slowSec: 30 }) as any;
    expect(adminStatePayload(room)).toMatchObject({
      type: "room:adminState",
      chatDisabled: true,
      slowSec: 30,
    });
  });

  it("a muted member is told, not silently dropped", async () => {
    const room = mkRoom();
    room.users.set("alice", {});
    room.muted.add("alice");
    rooms.set("r1", room);
    await handleChat(
      { user: { id: "alice", name: "Alice" }, roomId: "r1" },
      { type: "chat:send", roomId: "r1", body: "hi" },
      chatOpts(),
    );
    expect(sent.find((m) => m.type === "chat:rejected")?.reason).toMatch(/muted/);
    expect(broadcasts.length).toBe(0);
  });
});

describe("a lobby's staff in its rooms", () => {
  it("level 3 moderates, level 5 owns, a member doesn't", () => {
    const room = mkRoom("r1", { lobbyId: "lob" }) as any;
    room.users.set("m3", { id: "m3", lobbyRoleLevel: 3 });
    room.users.set("m5", { id: "m5", lobbyRoleLevel: 5 });
    room.users.set("m1", { id: "m1", lobbyRoleLevel: 1 });
    expect(isModOrOwner(room, "m3")).toBe(true);
    expect(roleOf(room, "m3")).toBe("mod");
    expect(roleOf(room, "m5")).toBe("owner");
    expect(isModOrOwner(room, "m1")).toBe(false);
    expect(rankIn(room, "m5")).toBeGreaterThan(rankIn(room, "m3"));
    expect(rankIn(room, "m3")).toBeGreaterThan(rankIn(room, "m1"));
  });

  it("Weered's staff outrank a lobby's owner", () => {
    const room = mkRoom("r1", { lobbyId: "lob" }) as any;
    room.users.set("m5", { id: "m5", lobbyRoleLevel: 5 });
    room.users.set("staff", { id: "staff", globalRole: "STAFF" });
    expect(rankIn(room, "staff")).toBeGreaterThan(rankIn(room, "m5"));
  });
});
