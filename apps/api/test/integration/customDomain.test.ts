import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "../../src/lib/prisma";
import { buildTestApp, testAuthFromHeader, testToken } from "../helpers/buildTestApp";

// A lobby's own domain goes live only when it points here AND a TXT record
// proves the lobby's admin runs it; until then Caddy's gate and the middleware
// don't honour it (red team 2026-11-01, finding 18). DNS is stubbed.
const net = vi.hoisted(() => ({
  a: {} as Record<string, string[]>,
  txt: {} as Record<string, string[][]>,
}));
vi.mock("dns", () => ({
  promises: {
    resolve4: async (h: string) => (h === "weered.ca" ? ["203.0.113.7"] : net.a[h] || []),
    resolveTxt: async (n: string) => net.txt[n] || [],
  },
}));
import lobbyDesignRoutes, { domainProof } from "../../src/routes/lobbyDesign";

const stamp = Date.now().toString(36);
const LOBBY = `itest-dom-${stamp}`;
const OTHER = `itest-dom2-${stamp}`;
const HOST = `club-${stamp}.example.com`;
let owner = "";
let app: any;

beforeAll(async () => {
  owner = (
    await prisma.user.create({
      data: { usernameKey: `itest_dom_${stamp}`, name: "owner" },
      select: { id: true },
    })
  ).id;
  for (const id of [LOBBY, OTHER])
    await prisma.lobby.create({ data: { id, name: id, ownerId: owner } });
  app = await buildTestApp((a: any) =>
    lobbyDesignRoutes(a, {
      authFromHeader: testAuthFromHeader,
      getGlobalRole: async () => "USER",
      canAccessStaff: () => false,
      lobbyAdminAccess: async (req: any) => ({
        lobby: await prisma.lobby.findUnique({ where: { id: req.params.id } }),
        member: { roleLevel: 5 },
        overrideRole: null,
        user: { id: owner, name: "owner" },
      }),
    } as any),
  );
});

afterAll(async () => {
  await app?.close();
  await prisma.lobby.deleteMany({ where: { id: { in: [LOBBY, OTHER] } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: owner } }).catch(() => {});
  await prisma.$disconnect();
});

const as = { authorization: `Bearer ${testToken("x")}` };
const put = (lobby: string) =>
  app.inject({
    method: "PUT",
    url: `/lobbies/${lobby}/admin/domain`,
    headers: as,
    payload: { domain: HOST },
  });
const verify = () =>
  app.inject({ method: "POST", url: `/lobbies/${LOBBY}/admin/domain/verify`, headers: as });
const check = () => app.inject({ method: "GET", url: `/domains/check?domain=${HOST}` });
const resolve = () => app.inject({ method: "GET", url: `/domains/resolve?host=${HOST}` });

describe("a lobby's own domain", () => {
  it("is not served while it's pending", async () => {
    const r = await put(LOBBY);
    expect(r.json().status).toBe("pending");
    expect(r.json().txt.value).toBe(domainProof(LOBBY, HOST));
    expect((await check()).statusCode).toBe(404);
    expect((await resolve()).statusCode).toBe(404);
  });

  it("stays pending when it points here but nothing proves it's theirs", async () => {
    net.a[HOST] = ["203.0.113.7"];
    const r = await verify();
    expect(r.json()).toMatchObject({ status: "pending", pointing: true, owned: false });
    expect((await check()).statusCode).toBe(404);
  });

  it("a proof made for another lobby doesn't count", async () => {
    net.txt[`_weered.${HOST}`] = [[domainProof(OTHER, HOST)]];
    expect((await verify()).json().status).toBe("pending");
  });

  it("goes live with its own proof, and only then is served", async () => {
    net.txt[`_weered.${HOST}`] = [[domainProof(LOBBY, HOST)]];
    expect((await verify()).json().status).toBe("live");
    expect((await check()).statusCode).toBe(200);
    expect((await resolve()).json().lobbyId).toBe(LOBBY);
  });

  it("can't be taken by another lobby", async () => {
    expect((await put(OTHER)).statusCode).toBe(409);
  });
});
