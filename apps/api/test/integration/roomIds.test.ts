import { describe, it, expect, beforeAll, afterAll } from "vitest";
import roomsRoutes from "../../src/routes/rooms";
import { buildTestApp, testAuthFromHeader, testToken } from "../helpers/buildTestApp";
import { prisma } from "../../src/lib/prisma";
import { lobbyIdFree } from "../../src/lib/lobbyAccess";

// A lobby's chat is the Room whose id is the lobby's own (red team 2026-11-01,
// finding 3). A member who could name a room used to name it after someone
// else's lobby and own that lobby's chat, password, gate and all.
const stamp = Date.now().toString(36);
const VICTIM = `itest-rid-victim-${stamp}`;
const MINE = `itest-rid-mine-${stamp}`;
const FUTURE = `itest-rid-future-${stamp}`;
const id: Record<string, string> = {};
const made: string[] = [];
let n = 0;

const makeApp = (staff: boolean) =>
  buildTestApp((app: any) =>
    roomsRoutes(app, {
      authFromHeader: testAuthFromHeader,
      verifyToken: () => null,
      getGlobalRole: async () => (staff ? "ADMIN" : "USER"),
      canAccessStaff: () => staff,
      rooms: new Map(),
      ensureRoomLoaded: async () => ({}) as any,
      normalizeRoomId: (x: string) => x,
      buildStatePayload: () => ({}),
      send: () => {},
      shortRoomId: () => `itest-rid-rand-${stamp}-${++n}`,
      broadcastToLobby: () => {},
    } as any),
  );

beforeAll(async () => {
  for (const k of ["owner", "member"]) {
    const u = await prisma.user.create({
      data: { usernameKey: `itest_rid_${k}_${stamp}`, name: k },
      select: { id: true },
    });
    id[k] = u.id;
  }
  await prisma.lobby.create({ data: { id: VICTIM, name: "victim", ownerId: id.owner } });
  await prisma.lobby.create({ data: { id: MINE, name: "mine", ownerId: id.member } });
});

afterAll(async () => {
  await prisma.room
    .deleteMany({
      where: {
        OR: [
          { id: { in: [VICTIM, MINE, FUTURE] } },
          { id: { startsWith: `itest-rid-rand-${stamp}` } },
        ],
      },
    })
    .catch(() => {});
  await prisma.lobby.deleteMany({ where: { id: { in: [VICTIM, MINE] } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: Object.values(id) } } }).catch(() => {});
  await prisma.$disconnect();
});

const create = (app: any, payload: any) =>
  app.inject({
    method: "POST",
    url: "/rooms",
    headers: { authorization: `Bearer ${testToken(id.member)}` },
    payload,
  });

describe("room ids", () => {
  it("a member can't name a room after someone else's lobby", async () => {
    const app = await makeApp(false);
    const r = await create(app, { name: "squat", lobbyId: MINE, roomId: VICTIM, password: "mine" });
    expect(r.statusCode).toBe(200);
    const victimChat = await prisma.room.findUnique({ where: { id: VICTIM } });
    expect(victimChat?.ownerId ?? null).not.toBe(id.member);
    await app.close();
  });

  it("nor after a lobby nobody has made yet", async () => {
    const app = await makeApp(false);
    await create(app, { name: "early", lobbyId: MINE, roomId: FUTURE });
    expect(await prisma.room.findUnique({ where: { id: FUTURE } })).toBeNull();
    await app.close();
  });

  it("staff may choose an id, but never a lobby's", async () => {
    const app = await makeApp(true);
    const r = await create(app, { name: "ops", lobbyId: MINE, roomId: VICTIM });
    expect(r.statusCode).toBe(409);
    await app.close();
  });

  it("a lobby or place can't be made on an id a room already holds", async () => {
    await prisma.room.create({ data: { id: FUTURE, name: "held", ownerId: id.member } });
    expect(await lobbyIdFree(FUTURE)).toBe(false);
    expect(await lobbyIdFree(VICTIM)).toBe(false);
    expect(await lobbyIdFree(`itest-rid-free-${stamp}`)).toBe(true);
  });
});
