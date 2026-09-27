import { describe, it, expect, beforeEach } from "vitest";
import { handleRoomMod } from "../../src/sockets/roomMod";

// WS moderation gates via handleRoomMod(ws, msg, ctx, opts). The actor mod/owner
// status arrives through ctx, so the actorIsMod gate is directly exercisable.
// In-memory room state is the observable; the ban DB upsert is fire-and-forget.

let sent: any[];
let broadcasts: any[];
function mkRoom(roomId = "r1") {
  return {
    roomId,
    users: new Map<string, any>(),
    mods: new Set<string>(),
    banned: new Set<string>(),
    muted: new Set<string>(),
    sockets: new Set<any>(),
  };
}
function mkCtx(room: any, over: any = {}) {
  return {
    room,
    roomId: room.roomId,
    actorId: "mod1",
    actorName: "Mod",
    actorIsMod: true,
    actorIsOwner: false,
    ...over,
  };
}
function mkOpts(over: any = {}) {
  return {
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
    // The target's sockets, taken from room.sockets like the real helper, so a
    // test can prove a kicked or banned socket is actually removed from the room.
    findSocketsByUser: (room: any, uid: string) =>
      [...(room.sockets || [])].filter((s: any) => s.user?.id === uid),
    isOwner: (_room: any, uid?: string) => uid === "owner1",
    rooms: new Map(),
    wss: { clients: new Set() },
    ...over,
  } as any;
}
const ws = { user: { id: "mod1", name: "Mod" } };

beforeEach(() => {
  sent = [];
  broadcasts = [];
});

describe("ws handleRoomMod - mute/ban gates", () => {
  it("mod:mute is a no-op for a non-mod actor", async () => {
    const room = mkRoom();
    await handleRoomMod(
      ws,
      { type: "mod:mute", userId: "victim" },
      mkCtx(room, { actorIsMod: false }),
      mkOpts(),
    );
    expect(room.muted.has("victim")).toBe(false);
  });

  it("a mod mutes a target (added to room.muted + mod:muted sent)", async () => {
    const room = mkRoom();
    room.sockets.add({ user: { id: "victim" }, roomId: room.roomId });
    await handleRoomMod(ws, { type: "mod:mute", userId: "victim" }, mkCtx(room), mkOpts());
    expect(room.muted.has("victim")).toBe(true);
    expect(sent.find((m) => m.type === "mod:muted")).toBeTruthy();
  });

  it("the room owner cannot be muted", async () => {
    const room = mkRoom();
    await handleRoomMod(ws, { type: "mod:mute", userId: "owner1" }, mkCtx(room), mkOpts());
    expect(room.muted.has("owner1")).toBe(false);
  });

  it("a mod unmutes a target", async () => {
    const room = mkRoom();
    room.muted.add("victim");
    await handleRoomMod(ws, { type: "mod:unmute", userId: "victim" }, mkCtx(room), mkOpts());
    expect(room.muted.has("victim")).toBe(false);
  });

  it("a mod bans a target: banned set, removed from users, presence:leave broadcast", async () => {
    const room = mkRoom();
    room.users.set("victim", { id: "victim" });
    const victimSocket = { user: { id: "victim" }, roomId: room.roomId };
    room.sockets.add(victimSocket);
    await handleRoomMod(ws, { type: "mod:ban", userId: "victim" }, mkCtx(room), mkOpts());
    expect(room.banned.has("victim")).toBe(true);
    expect(room.users.has("victim")).toBe(false);
    // 2026-09-26: the banned socket used to stay in room.sockets and keep
    // receiving every broadcast in the room.
    expect(room.sockets.has(victimSocket)).toBe(false);
    expect(
      broadcasts.find((m) => m.type === "presence:leave" && m.userId === "victim"),
    ).toBeTruthy();
    expect(sent.find((m) => m.type === "mod:banned")).toBeTruthy();
  });

  it("mod:ban is a no-op for a non-mod, and cannot target the owner", async () => {
    const room = mkRoom();
    room.users.set("victim", { id: "victim" });
    await handleRoomMod(
      ws,
      { type: "mod:ban", userId: "victim" },
      mkCtx(room, { actorIsMod: false }),
      mkOpts(),
    );
    expect(room.banned.has("victim")).toBe(false);
    await handleRoomMod(ws, { type: "mod:ban", userId: "owner1" }, mkCtx(room), mkOpts());
    expect(room.banned.has("owner1")).toBe(false);
  });
});
