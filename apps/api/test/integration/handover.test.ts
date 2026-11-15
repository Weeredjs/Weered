import { describe, it, expect, beforeAll, afterAll } from "vitest";
import handoverRoutes from "../../src/routes/handover";
import { prisma } from "../../src/lib/prisma";
import { buildTestApp, testAuthFromHeader, testToken } from "../helpers/buildTestApp";

// Handing a prebuilt lobby to its person (James 2026-11-15, the streamer campaign):
// staff make a one-time link, which hides the lobby; the person who opens it,
// signed in, becomes the owner of the lobby and its rooms, and the builder steps out.
const s = Date.now().toString(36);
const id: Record<string, string> = {};
const roles: Record<string, string> = {};
const L = `itest-ho-${s}`;
const rooms = new Map<string, any>();
let app: any;

async function user(k: string, globalRole = "USER", data: any = {}) {
  id[k] = (
    await prisma.user.create({
      data: {
        usernameKey: `itest_ho_${k}_${s}`,
        name: `ho ${k}`,
        globalRole: globalRole as any,
        ...data,
      },
      select: { id: true },
    })
  ).id;
  roles[id[k]] = globalRole;
}
const call = (who: string | null, method: "GET" | "POST", url: string) =>
  app.inject({
    method,
    url,
    headers: who ? { authorization: `Bearer ${testToken(id[who])}` } : {},
    ...(method === "POST" ? { payload: {} } : {}),
  });

beforeAll(async () => {
  await user("staff", "STAFF");
  await user("streamer");
  await user("other");
  await user("guest", "USER", { isGuest: true });
  await prisma.lobby.create({ data: { id: L, name: "Night Owls", ownerId: id.staff } });
  await prisma.lobbyMember.create({
    data: { lobbyId: L, userId: id.staff, role: "OWNER", roleLevel: 5 },
  });
  await prisma.room.create({
    data: { id: `${L}-main`, name: "Main", ownerId: id.staff, lobbyId: L },
  });
  rooms.set(`${L}-main`, { lobbyId: L, ownerId: id.staff });
  app = await buildTestApp((a: any) =>
    handoverRoutes(a, {
      authFromHeader: testAuthFromHeader,
      getGlobalRole: async (uid: string) => roles[uid] || "USER",
      rooms,
    }),
  );
});

afterAll(async () => {
  await app?.close();
  await prisma.siteConfig.deleteMany({ where: { value: { contains: L } } }).catch(() => {});
  await prisma.lobbyMember.deleteMany({ where: { lobbyId: L } }).catch(() => {});
  await prisma.room.deleteMany({ where: { lobbyId: L } }).catch(() => {});
  await prisma.lobby.deleteMany({ where: { id: L } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: Object.values(id) } } }).catch(() => {});
  await prisma.$disconnect();
});

describe("handing a lobby over", () => {
  let token = "";

  it("only staff make the link, and it hides the lobby", async () => {
    expect((await call("streamer", "POST", `/staff/lobbies/${L}/handover`)).statusCode).toBe(403);
    const first = (await call("staff", "POST", `/staff/lobbies/${L}/handover`)).json();
    const r = await call("staff", "POST", `/staff/lobbies/${L}/handover`);
    expect(r.statusCode).toBe(200);
    token = String(r.json().url).split("/").pop() as string;
    // The older link died when the new one was made.
    expect(
      (await call(null, "GET", `/handover/${String(first.url).split("/").pop()}`)).statusCode,
    ).toBe(404);
    const l = await prisma.lobby.findUnique({ where: { id: L }, select: { unlisted: true } });
    expect(l?.unlisted).toBe(true);
  });

  it("anyone can see what it is; taking it needs a real account", async () => {
    const info = await call(null, "GET", `/handover/${token}`);
    expect(info.statusCode).toBe(200);
    expect(info.json().lobby.name).toBe("Night Owls");
    expect((await call(null, "POST", `/handover/${token}/accept`)).statusCode).toBe(401);
    expect((await call("guest", "POST", `/handover/${token}/accept`)).statusCode).toBe(403);
  });

  it("the person who takes it owns it, its rooms and the town listing; the builder is gone", async () => {
    const r = await call("streamer", "POST", `/handover/${token}/accept`);
    expect(r.statusCode).toBe(200);
    const l = await prisma.lobby.findUnique({
      where: { id: L },
      select: { ownerId: true, unlisted: true },
    });
    expect(l).toEqual({ ownerId: id.streamer, unlisted: false });
    const room = await prisma.room.findUnique({
      where: { id: `${L}-main` },
      select: { ownerId: true },
    });
    expect(room?.ownerId).toBe(id.streamer);
    expect(rooms.get(`${L}-main`).ownerId).toBe(id.streamer);
    const members = await prisma.lobbyMember.findMany({
      where: { lobbyId: L },
      select: { userId: true, roleLevel: true },
    });
    expect(members).toEqual([{ userId: id.streamer, roleLevel: 5 }]);
  });

  it("the link works once", async () => {
    expect((await call("other", "POST", `/handover/${token}/accept`)).statusCode).toBe(404);
    const l = await prisma.lobby.findUnique({ where: { id: L }, select: { ownerId: true } });
    expect(l?.ownerId).toBe(id.streamer);
  });
});
