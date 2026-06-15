import { describe, it, expect, afterEach, afterAll } from "vitest";
import socialRoutes from "../../src/routes/social";
import { buildTestApp, testToken, testAuthFromHeader } from "../helpers/buildTestApp";
import { prisma } from "../../src/lib/prisma";

const noop = async () => null as any;
async function makeApp() {
  return buildTestApp((a: any) =>
    socialRoutes(a, {
      authFromHeader: testAuthFromHeader,
      verifyToken: (t: string) => testAuthFromHeader("Bearer " + t),
      awardNotoriety: noop,
      createNotification: noop,
      rooms: new Map(),
    } as any),
  );
}

const users: string[] = [];
async function newUser(tag: string) {
  const stamp = Date.now() + "_" + Math.floor(performance.now()) + Math.floor(Math.random() * 1e6);
  const u = await prisma.user.create({
    data: { usernameKey: "itest_fr_" + tag + "_" + stamp, name: tag },
    select: { id: true },
  });
  users.push(u.id);
  return u.id;
}

describe("friends - request / accept", () => {
  afterEach(async () => {
    if (users.length) {
      await prisma.friendRequest
        .deleteMany({ where: { OR: [{ fromId: { in: users } }, { toId: { in: users } }] } })
        .catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: users } } }).catch(() => {});
    }
    users.length = 0;
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("sends a PENDING request; rejects self (400), unknown target (404), no-auth (401)", async () => {
    const app = await makeApp();
    const a = await newUser("a");
    const b = await newUser("b");
    const r = await app.inject({
      method: "POST",
      url: `/friends/request/${b}`,
      headers: { authorization: `Bearer ${testToken(a)}` },
    });
    expect(r.statusCode).toBe(200);
    const fr = await prisma.friendRequest.findUnique({
      where: { fromId_toId: { fromId: a, toId: b } },
    });
    expect(fr?.status).toBe("PENDING");

    expect(
      (
        await app.inject({
          method: "POST",
          url: `/friends/request/${a}`,
          headers: { authorization: `Bearer ${testToken(a)}` },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/friends/request/ghost_id",
          headers: { authorization: `Bearer ${testToken(a)}` },
        })
      ).statusCode,
    ).toBe(404);
    expect((await app.inject({ method: "POST", url: `/friends/request/${b}` })).statusCode).toBe(
      401,
    );
    await app.close();
  });

  it("recipient accepts (-> ACCEPTED both ways); a third party cannot accept (403)", async () => {
    const app = await makeApp();
    const a = await newUser("ra");
    const b = await newUser("rb");
    const c = await newUser("rc");
    const sent = await app.inject({
      method: "POST",
      url: `/friends/request/${b}`,
      headers: { authorization: `Bearer ${testToken(a)}` },
    });
    const reqId = sent.json().request.id;

    // c (not the recipient) tries to accept -> 403
    const byC = await app.inject({
      method: "POST",
      url: `/friends/accept/${reqId}`,
      headers: { authorization: `Bearer ${testToken(c)}` },
    });
    expect(byC.statusCode).toBe(403);

    // b (the recipient) accepts -> 200, ACCEPTED both directions
    const byB = await app.inject({
      method: "POST",
      url: `/friends/accept/${reqId}`,
      headers: { authorization: `Bearer ${testToken(b)}` },
    });
    expect(byB.statusCode).toBe(200);
    const fwd = await prisma.friendRequest.findUnique({
      where: { fromId_toId: { fromId: a, toId: b } },
    });
    const back = await prisma.friendRequest.findUnique({
      where: { fromId_toId: { fromId: b, toId: a } },
    });
    expect(fwd?.status).toBe("ACCEPTED");
    expect(back?.status).toBe("ACCEPTED");

    // a now sees b in their friends list
    const list = await app.inject({
      method: "GET",
      url: "/friends",
      headers: { authorization: `Bearer ${testToken(a)}` },
    });
    expect(list.statusCode).toBe(200);
    expect(JSON.stringify(list.json())).toContain(b);
    await app.close();
  });
});
