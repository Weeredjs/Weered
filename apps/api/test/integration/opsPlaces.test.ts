import { describe, it, expect, beforeAll, afterAll } from "vitest";
import staffRoutes from "../../src/routes/staff";
import staffContentRoutes from "../../src/routes/staffContent";
import modsRoutes from "../../src/routes/mods";
import { prisma } from "../../src/lib/prisma";
import { canAccessStaff, canAssignRoles } from "../../src/lib/lobbyAuth";
import { buildTestApp, testAuthFromHeader, testToken } from "../helpers/buildTestApp";

// Ops rebuild, part 3 (2026-11-02): Rooms, Lobbies and Mods do what they say.
const stamp = Date.now().toString(36);
const LOBBY = `itest-pl-${stamp}`;
const HIDDEN = `itest-unl-${stamp}`;
const ROOM = `itest-pl-room-${stamp}`;
const id: Record<string, string> = {};
let modId = "";
let app: any;

beforeAll(async () => {
  for (const [k, globalRole] of [
    ["admin", "ADMIN"],
    ["member", "USER"],
  ] as const) {
    id[k] = (
      await prisma.user.create({
        data: { usernameKey: `itest_pl_${k}_${stamp}`, name: `pl ${k}`, globalRole },
        select: { id: true },
      })
    ).id;
  }
  await prisma.lobby.create({ data: { id: LOBBY, name: "Places Test", ownerId: id.admin } });
  await prisma.lobby.create({
    data: { id: HIDDEN, name: "Unlisted Test", ownerId: id.admin, unlisted: true } as any,
  });
  // A lobby's own chat: a nameless room keyed by the lobby's id.
  await prisma.room.create({ data: { id: LOBBY, name: "", pinned: true } });
  await prisma.room.create({
    data: { id: ROOM, name: "Plain room", lobbyId: LOBBY, pinned: true },
  });
  modId = (
    await prisma.mod.create({
      data: {
        sourceId: `itest-${stamp}`,
        gameSlug: "itest",
        name: `Hidden mod ${stamp}`,
        excluded: true,
      } as any,
      select: { id: true },
    })
  ).id;

  const live = new Map<string, any>([
    [
      ROOM,
      {
        name: "Plain room",
        lobbyId: LOBBY,
        users: new Map([[id.member, {}]]),
        sockets: new Set(),
        msgs: [],
      },
    ],
  ]);
  const opts = new Proxy(
    {
      authFromHeader: testAuthFromHeader,
      getGlobalRole: async (uid: string) =>
        (await prisma.user.findUnique({ where: { id: uid }, select: { globalRole: true } }))
          ?.globalRole ?? "USER",
      canAccessStaff,
      canAssignRoles,
      rooms: live,
      send: () => {},
      broadcast: () => {},
      publishState: () => {},
      getWss: () => ({ clients: new Set() }),
      verifyToken: (t: string) => testAuthFromHeader(`Bearer ${t}`),
    } as any,
    { get: (t: any, p: string) => (p in t ? t[p] : () => Promise.resolve()) },
  );
  app = await buildTestApp(async (a: any) => {
    await staffRoutes(a, opts);
    await staffContentRoutes(a, opts);
    await modsRoutes(a, opts);
  });
});

afterAll(async () => {
  await app?.close();
  await prisma.userModInstall.deleteMany({ where: { modId } }).catch(() => {});
  await prisma.mod.deleteMany({ where: { id: modId } }).catch(() => {});
  await prisma.room.deleteMany({ where: { id: { in: [LOBBY, ROOM] } } }).catch(() => {});
  await prisma.lobby.deleteMany({ where: { id: { in: [LOBBY, HIDDEN] } } }).catch(() => {});
  await prisma.globalAudit
    .deleteMany({ where: { actorId: { in: Object.values(id) } } })
    .catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: Object.values(id) } } }).catch(() => {});
  await prisma.$disconnect();
});

const as = (who: string) => ({ authorization: `Bearer ${testToken(id[who])}` });
const call = (who: string, method: string, url: string, payload?: any) =>
  app.inject({ method, url, headers: as(who), ...(payload ? { payload } : {}) });

describe("ops Rooms", () => {
  it("names a lobby's own chat, and reads pins from the database", async () => {
    const list = (await call("admin", "GET", "/staff/rooms")).json().rooms;
    const own = list.find((r: any) => r.id === LOBBY);
    expect(own).toMatchObject({ kind: "lobby", name: "Places Test: lobby chat", pinned: true });
    expect(list.find((r: any) => r.id === ROOM)).toMatchObject({
      kind: "room",
      pinned: true,
      liveUsers: 1,
    });
  });

  it("won't close or delete a lobby's own chat", async () => {
    expect((await call("admin", "POST", `/staff/rooms/${LOBBY}/close`)).json().error).toBe(
      "protected_room",
    );
    expect((await call("admin", "DELETE", `/staff/rooms/${LOBBY}`)).json().error).toBe(
      "protected_room",
    );
    expect((await call("admin", "POST", "/staff/rooms/@admin-anything/close")).statusCode).toBe(
      400,
    );
    expect(await prisma.room.findUnique({ where: { id: LOBBY } })).toBeTruthy();
  });

  it("says when a room to pin isn't there", async () => {
    expect(
      (await call("admin", "POST", "/staff/rooms/no-such-room/pin", { pinned: true })).statusCode,
    ).toBe(404);
  });
});

describe("ops Lobbies", () => {
  it("counts who is in now, apart from members, and shows the lock", async () => {
    await call("admin", "POST", "/staff/lobby/lock", { lobbyId: LOBBY });
    const l = (await call("admin", "GET", "/staff/lobbies"))
      .json()
      .lobbies.find((x: any) => x.id === LOBBY);
    expect(l).toMatchObject({ onlineCount: 1, locked: true, unlisted: false });
    await call("admin", "POST", "/staff/lobby/unlock", { lobbyId: LOBBY });
  });

  it("won't lock a lobby that doesn't exist or feature an unlisted one", async () => {
    expect(
      (await call("admin", "POST", "/staff/lobby/lock", { lobbyId: "no-such-lobby" })).statusCode,
    ).toBe(404);
    expect((await call("admin", "POST", "/staff/featured", { lobbyId: HIDDEN })).json().error).toBe(
      "lobby_unlisted",
    );
  });
});

describe("hidden mods", () => {
  it("can't be installed", async () => {
    const r = await app.inject({
      method: "POST",
      url: `/mods/${modId}/install`,
      headers: as("member"),
      payload: { version: "1" },
    });
    expect(r.statusCode).toBe(404);
    expect(await prisma.userModInstall.count({ where: { modId } })).toBe(0);
  });
});
