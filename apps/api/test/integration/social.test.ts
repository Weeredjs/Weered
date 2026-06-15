import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import socialRoutes from "../../src/routes/social";
import { prisma } from "../../src/lib/prisma";
import { buildTestApp, testToken, testAuthFromHeader } from "../helpers/buildTestApp";

// Verifies the live-critical /recents route + its new Zod schema: valid bodies
// pass through to the handler (200), malformed bodies are rejected by Zod (400),
// and the read path returns what was written. Drives the real socialRoutes via
// inject against the test DB. (social opts unused by /recents are noop'd.)
const noop = async () => null as any;
function registerSocial(a: any) {
  return socialRoutes(a, {
    authFromHeader: testAuthFromHeader,
    verifyToken: (t: string) => testAuthFromHeader("Bearer " + t),
    awardNotoriety: noop,
    createNotification: noop,
    rooms: new Map(),
  } as any);
}

describe("social /recents — Zod schema + round-trip", () => {
  let app: any;
  let userId: string;

  beforeEach(async () => {
    const stamp = Date.now() + "_" + Math.floor(performance.now());
    const u = await prisma.user.create({ data: { usernameKey: "itest_soc_" + stamp, name: "soc" }, select: { id: true } });
    userId = u.id;
    app = await buildTestApp(registerSocial);
  });
  afterEach(async () => {
    try { await app?.close(); } catch {}
    try { await prisma.recentVisit.deleteMany({ where: { userId } }); } catch {}
    try { await prisma.user.deleteMany({ where: { id: userId } }); } catch {}
  });
  afterAll(async () => { await prisma.$disconnect(); });

  it("records + returns a recent visit (valid body -> 200)", async () => {
    const token = testToken(userId);
    const post = await app.inject({
      method: "POST", url: "/recents",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      payload: { lobbyId: "destiny2" },
    });
    expect(post.statusCode).toBe(200);
    expect(post.json()?.ok).toBe(true);

    const get = await app.inject({ method: "GET", url: "/recents", headers: { authorization: `Bearer ${token}` } });
    expect(get.statusCode).toBe(200);
    const recents = get.json()?.recents;
    expect(Array.isArray(recents)).toBe(true);
    expect(recents.some((r: any) => r.lobbyId === "destiny2")).toBe(true);
  });

  it("rejects a malformed body via Zod (roomId not a string -> 400)", async () => {
    const res = await app.inject({
      method: "POST", url: "/recents",
      headers: { authorization: `Bearer ${testToken(userId)}`, "content-type": "application/json" },
      payload: { roomId: 12345 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("401s an unauthenticated recents write", async () => {
    const res = await app.inject({ method: "POST", url: "/recents", payload: { lobbyId: "x" } });
    expect(res.statusCode).toBe(401);
  });
});
