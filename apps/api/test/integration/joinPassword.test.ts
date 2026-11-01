import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { registerLobbyJoin } from "../../src/routes/lobbyJoin";
import { prisma } from "../../src/lib/prisma";
import { buildTestApp, testAuthFromHeader, testToken } from "../helpers/buildTestApp";

// A lobby's join password is kept like any other password: hashed (James
// 2026-11-01, red team finding 21).
const stamp = Date.now().toString(36);
const LOBBY = `itest-jpw-${stamp}`;
const id: Record<string, string> = {};
let app: any;

beforeAll(async () => {
  for (const k of ["owner", "guest"]) {
    const u = await prisma.user.create({
      data: { usernameKey: `itest_jpw_${k}_${stamp}`, name: k },
      select: { id: true },
    });
    id[k] = u.id;
  }
  await prisma.lobby.create({ data: { id: LOBBY, name: "pw", ownerId: id.owner } });
  app = await buildTestApp((a: any) =>
    registerLobbyJoin(a, {
      authFromHeader: testAuthFromHeader,
      lobbyAdminAccess: async (req: any) => ({
        user: { id: id.owner, name: "owner" },
        lobby: await prisma.lobby.findUnique({ where: { id: req.params.id } }),
        member: { roleLevel: 5 },
        overrideRole: null,
      }),
    } as any),
  );
});

afterAll(async () => {
  await app?.close();
  await prisma.lobby.deleteMany({ where: { id: LOBBY } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: Object.values(id) } } }).catch(() => {});
  await prisma.$disconnect();
});

const as = (who: string) => ({ authorization: `Bearer ${testToken(id[who])}` });
const setMode = (payload: any) =>
  app.inject({
    method: "PATCH",
    url: `/lobbies/${LOBBY}/admin/join-mode`,
    headers: as("owner"),
    payload,
  });
const join = (password: string) =>
  app.inject({
    method: "POST",
    url: `/lobbies/${LOBBY}/join`,
    headers: as("guest"),
    payload: { password },
  });

describe("a lobby's join password", () => {
  it("is stored hashed, never as typed", async () => {
    expect((await setMode({ joinMode: "PASSWORD", password: "open sesame" })).statusCode).toBe(200);
    const row = await prisma.lobby.findUnique({ where: { id: LOBBY } });
    expect(row?.joinPassword?.startsWith("$2")).toBe(true);
    expect(row?.joinPassword).not.toContain("sesame");
  });

  it("keeps the saved one when the owner saves without typing a new one", async () => {
    const before = (await prisma.lobby.findUnique({ where: { id: LOBBY } }))?.joinPassword;
    expect((await setMode({ joinMode: "PASSWORD", password: "" })).statusCode).toBe(200);
    expect((await prisma.lobby.findUnique({ where: { id: LOBBY } }))?.joinPassword).toBe(before);
  });

  it("lets in the right password and refuses a wrong one", async () => {
    expect((await join("wrong")).statusCode).toBe(403);
    expect((await join("open sesame")).statusCode).toBe(200);
  });
});
