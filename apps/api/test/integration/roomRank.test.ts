import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../src/lib/prisma";
import { makeEmptyRoom, rankOf, banExempt, isOwner } from "../../src/lib/roomState";
import { handleRoomMod } from "../../src/sockets/roomMod";

// Rank against people who aren't in the room (red team 2026-11-01, finding 7).
// An absent person used to rank as a plain member, so a lobby moderator could
// ban the lobby's owner or Weered's staff from a room while they were away, and
// the ban held when they came back.
const stamp = Date.now().toString(36);
const LOBBY = `itest-rank-${stamp}`;
const ROOM = `itest-rank-room-${stamp}`;
const id: Record<string, string> = {};

beforeAll(async () => {
  for (const [k, role] of [
    ["owner", "USER"],
    ["mod", "USER"],
    ["staff", "ADMIN"],
    ["member", "USER"],
  ] as const) {
    const u = await prisma.user.create({
      data: { usernameKey: `itest_rank_${k}_${stamp}`, name: k, globalRole: role },
      select: { id: true },
    });
    id[k] = u.id;
  }
  await prisma.lobby.create({ data: { id: LOBBY, name: "rank", ownerId: id.owner } });
  await prisma.room.create({ data: { id: ROOM, name: "rank room", lobbyId: LOBBY } });
  await prisma.lobbyMember.createMany({
    data: [
      { lobbyId: LOBBY, userId: id.mod, roleLevel: 3 },
      { lobbyId: LOBBY, userId: id.member, roleLevel: 1 },
    ],
  });
});

afterAll(async () => {
  await prisma.roomBan.deleteMany({ where: { roomId: ROOM } }).catch(() => {});
  await prisma.room.deleteMany({ where: { id: ROOM } }).catch(() => {});
  await prisma.lobby.deleteMany({ where: { id: LOBBY } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: Object.values(id) } } }).catch(() => {});
  await prisma.$disconnect();
});

function setup() {
  const room: any = makeEmptyRoom(ROOM);
  room.lobbyId = LOBBY;
  // Only the moderator is here.
  room.users.set(id.mod, { id: id.mod, name: "mod", lobbyRoleLevel: 3 });
  const sent: any[] = [];
  const noop = () => {};
  const run = (userId: string) =>
    handleRoomMod(
      { user: { id: id.mod, name: "mod" } },
      { type: "mod:ban", roomId: ROOM, userId },
      {
        room,
        roomId: ROOM,
        actorId: id.mod,
        actorName: "mod",
        actorIsMod: true,
        actorIsOwner: false,
      },
      {
        publishState: noop,
        broadcast: noop,
        persistRoomBasics: async () => {},
        audit: noop,
        removeKnock: noop,
        removePending: noop,
        doJoin: async () => {},
        send: (_ws: any, m: any) => sent.push(m),
        getGlobalRole: async () => "USER",
        canAccessStaff: () => false,
        findSocketsByUser: () => [],
        isOwner,
        rooms: new Map(),
        wss: { clients: [] },
      } as any,
    );
  return { room, sent, run };
}

describe("a moderator and people who aren't in the room", () => {
  it("ranks the absent from who they are, not from where they stand", async () => {
    const { room } = setup();
    expect(await rankOf(room, id.owner)).toBe(4);
    expect(await rankOf(room, id.staff)).toBe(5);
    expect(await rankOf(room, id.member)).toBe(1);
  });

  it("can't ban the lobby's owner or staff while they're away", async () => {
    const { room, sent, run } = setup();
    await run(id.owner);
    await run(id.staff);
    expect(room.banned.has(id.owner)).toBe(false);
    expect(room.banned.has(id.staff)).toBe(false);
    expect(sent.filter((m) => m.type === "mod:error")).toHaveLength(2);
  });

  it("lets staff and the owner through a ban set below them", async () => {
    const { room } = setup();
    expect(await banExempt(room, id.owner)).toBe(true);
    expect(await banExempt(room, id.staff)).toBe(true);
    expect(await banExempt(room, id.member)).toBe(false);
  });

  it("still bans a member who isn't here", async () => {
    const { room, run } = setup();
    await run(id.member);
    expect(room.banned.has(id.member)).toBe(true);
  });
});
