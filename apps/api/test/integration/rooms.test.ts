import { describe, it, expect, afterEach, afterAll } from "vitest";
import jwt from "jsonwebtoken";
import roomsRoutes from "../../src/routes/rooms";
import { buildTestApp, testToken, testAuthFromHeader } from "../helpers/buildTestApp";
import { prisma } from "../../src/lib/prisma";

const SECRET = "weered-integration-test-secret";
function rid() {
  return "itroom_" + Math.random().toString(36).slice(2, 9);
}
async function makeApp() {
  return buildTestApp((app: any) =>
    roomsRoutes(app, {
      authFromHeader: testAuthFromHeader,
      verifyToken: (t: string) => {
        try {
          const d: any = jwt.verify(t, SECRET);
          return d?.sub ? { id: String(d.sub), name: String(d.name || d.sub) } : null;
        } catch {
          return null;
        }
      },
      getGlobalRole: async () => "USER",
      canAccessStaff: () => false,
      rooms: new Map(),
      ensureRoomLoaded: async () => ({}) as any,
      normalizeRoomId: (x: string) => x,
      buildStatePayload: () => ({}),
      send: () => {},
      shortRoomId: () => rid(),
      broadcastToLobby: () => {},
    } as any),
  );
}

const lobbies: string[] = [];
const users: string[] = [];
async function newUser(tag: string) {
  const stamp = Date.now() + "_" + Math.floor(performance.now()) + Math.floor(Math.random() * 1e6);
  const u = await prisma.user.create({
    data: { usernameKey: "itest_rooms_" + tag + "_" + stamp, name: tag },
    select: { id: true },
  });
  users.push(u.id);
  return u.id;
}
async function newLobby(ownerId: string) {
  const id = "itest_rlobby_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
  await prisma.lobby.create({ data: { id, name: "rlobby", ownerId } });
  lobbies.push(id);
  return id;
}

describe("rooms - create", () => {
  afterEach(async () => {
    if (lobbies.length) {
      await prisma.room.deleteMany({ where: { lobbyId: { in: lobbies } } }).catch(() => {});
      await prisma.lobby.deleteMany({ where: { id: { in: lobbies } } }).catch(() => {});
    }
    if (users.length)
      await prisma.user.deleteMany({ where: { id: { in: users } } }).catch(() => {});
    lobbies.length = 0;
    users.length = 0;
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("lobby owner creates a room (persisted, owner is RoomMember OWNER)", async () => {
    const app = await makeApp();
    const owner = await newUser("owner");
    const lobbyId = await newLobby(owner);
    const r = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${testToken(owner)}` },
      payload: { name: "My Room", lobbyId },
    });
    expect(r.statusCode).toBe(200);
    const room = await prisma.room.findFirst({ where: { lobbyId, name: "My Room" } });
    expect(room).toBeTruthy();
    const rm = await prisma.roomMember.findFirst({ where: { roomId: room!.id, userId: owner } });
    expect(rm?.role).toBe("OWNER");
    await app.close();
  });

  it("404 unknown lobby, 401 no-auth", async () => {
    const app = await makeApp();
    const owner = await newUser("e");
    expect(
      (await app.inject({ method: "POST", url: "/rooms", payload: { name: "X", lobbyId: "nope" } }))
        .statusCode,
    ).toBe(401);
    const r = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${testToken(owner)}` },
      payload: { name: "X", lobbyId: "does_not_exist" },
    });
    expect(r.statusCode).toBe(404);
    await app.close();
  });

  it("403 for a non-member stranger, 409 on a duplicate room name", async () => {
    const app = await makeApp();
    const owner = await newUser("o2");
    const lobbyId = await newLobby(owner);
    const stranger = await newUser("stranger");
    const bad = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${testToken(stranger)}` },
      payload: { name: "Z", lobbyId },
    });
    expect(bad.statusCode).toBe(403);

    const first = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${testToken(owner)}` },
      payload: { name: "Dup", lobbyId },
    });
    expect(first.statusCode).toBe(200);
    const dup = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${testToken(owner)}` },
      payload: { name: "Dup", lobbyId },
    });
    expect(dup.statusCode).toBe(409);
    await app.close();
  });
});
