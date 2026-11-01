import { describe, it, expect, beforeAll, afterAll } from "vitest";
import staffRoutes from "../../src/routes/staff";
import { prisma } from "../../src/lib/prisma";
import { canAccessStaff, canAssignRoles } from "../../src/lib/lobbyAuth";
import { buildTestApp, testAuthFromHeader, testToken } from "../helpers/buildTestApp";

// SUPPORT is not staff for destruction (red team 2026-11-01, finding 9):
// closing a room deletes it and its history, so it takes staff, and the Home
// Lobby is never closed.
const stamp = Date.now().toString(36);
const ROOM = `itest-close-${stamp}`;
const id: Record<string, string> = {};
let app: any;

beforeAll(async () => {
  for (const [k, role] of [
    ["support", "SUPPORT"],
    ["admin", "ADMIN"],
  ] as const) {
    const u = await prisma.user.create({
      data: { usernameKey: `itest_sup_${k}_${stamp}`, name: k, globalRole: role },
      select: { id: true },
    });
    id[k] = u.id;
  }
  await prisma.room.create({ data: { id: ROOM, name: "to close" } });
  const target: any = {
    authFromHeader: testAuthFromHeader,
    getGlobalRole: async (uid: string) =>
      (await prisma.user.findUnique({ where: { id: uid }, select: { globalRole: true } }))
        ?.globalRole ?? "USER",
    canAccessStaff,
    canAssignRoles,
    rooms: new Map(),
    send: () => {},
  };
  const opts = new Proxy(target, {
    get: (t: any, p: string) => (p in t ? t[p] : () => Promise.resolve()),
  });
  app = await buildTestApp((a: any) => staffRoutes(a, opts));
});

afterAll(async () => {
  await app?.close();
  await prisma.room.deleteMany({ where: { id: ROOM } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: Object.values(id) } } }).catch(() => {});
  await prisma.$disconnect();
});

const close = (who: string, roomId: string) =>
  app.inject({
    method: "POST",
    url: `/staff/rooms/${roomId}/close`,
    headers: { authorization: `Bearer ${testToken(id[who])}` },
  });

describe("closing a room", () => {
  it("is refused to support", async () => {
    expect((await close("support", ROOM)).statusCode).toBe(403);
    expect(await prisma.room.findUnique({ where: { id: ROOM } })).toBeTruthy();
  });

  it("never takes the Home Lobby, even for staff", async () => {
    expect((await close("admin", "lobby")).statusCode).toBe(400);
  });

  it("works for staff", async () => {
    expect((await close("admin", ROOM)).statusCode).toBe(200);
  });
});
