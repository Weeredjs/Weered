import { describe, it, expect, afterEach, afterAll } from "vitest";
import challengesRoutes from "../../src/routes/challenges";
import { buildTestApp, testToken, testAuthFromHeader } from "../helpers/buildTestApp";
import { prisma } from "../../src/lib/prisma";

function makeApp() {
  return buildTestApp((app: any) =>
    challengesRoutes(app, {
      authFromHeader: testAuthFromHeader,
      getGlobalRole: async () => "USER",
      canAccessStaff: () => false,
      getLobbyRole: async () => null,
    } as any),
  );
}

const defs: string[] = [];
const users: string[] = [];
async function newUser(tag: string, bungie = false) {
  const stamp = Date.now() + "_" + Math.floor(performance.now()) + Math.floor(Math.random() * 1e6);
  const u = await prisma.user.create({
    data: { usernameKey: "itest_chl_" + tag + "_" + stamp, name: tag },
    select: { id: true },
  });
  users.push(u.id);
  if (bungie)
    await prisma.userGameAccount.create({
      data: { userId: u.id, gameType: "BUNGIE", externalId: "b1" } as any,
    });
  return u.id;
}
async function newInstance(o?: { status?: string; endsAt?: Date | null }) {
  const creator = await newUser("creator");
  const def = await prisma.challengeDefinition.create({
    data: { title: "C", createdById: creator, objectives: [{ id: "kills", target: 100 }] },
    select: { id: true },
  });
  defs.push(def.id);
  const inst = await prisma.challengeInstance.create({
    data: {
      definitionId: def.id,
      status: (o?.status as any) ?? "ACTIVE",
      startsAt: new Date(Date.now() - 1000),
      endsAt: o?.endsAt === undefined ? null : o.endsAt,
    },
    select: { id: true },
  });
  return inst.id;
}

describe("challenges - enroll", () => {
  afterEach(async () => {
    if (users.length)
      await prisma.challengeEnrollment
        .deleteMany({ where: { userId: { in: users } } })
        .catch(() => {});
    for (const d of defs)
      await prisma.challengeInstance.deleteMany({ where: { definitionId: d } }).catch(() => {});
    if (defs.length)
      await prisma.challengeDefinition.deleteMany({ where: { id: { in: defs } } }).catch(() => {});
    if (users.length) {
      await prisma.userGameAccount.deleteMany({ where: { userId: { in: users } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: users } } }).catch(() => {});
    }
    defs.length = 0;
    users.length = 0;
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("requires a linked Bungie account (400 bungie_not_linked)", async () => {
    const app = await makeApp();
    const noBungie = await newUser("nb"); // no game account
    const inst = await newInstance();
    const r = await app.inject({
      method: "POST",
      url: `/challenges/${inst}/enroll`,
      headers: { authorization: `Bearer ${testToken(noBungie)}` },
    });
    expect(r.json().error).toBe("bungie_not_linked");
    await app.close();
  });

  it("enrolls a Bungie-linked user, seeding progress from objectives (idempotent)", async () => {
    const app = await makeApp();
    const uid = await newUser("e", true);
    const inst = await newInstance();
    const auth = { authorization: `Bearer ${testToken(uid)}` };

    const r = await app.inject({
      method: "POST",
      url: `/challenges/${inst}/enroll`,
      headers: auth,
    });
    expect(r.statusCode).toBe(200);
    const enr = await prisma.challengeEnrollment.findFirst({
      where: { instanceId: inst, userId: uid },
    });
    expect((enr?.progress as any).kills).toEqual({ current: 0, target: 100, completed: false });

    // enrolling again is idempotent (no duplicate)
    const again = await app.inject({
      method: "POST",
      url: `/challenges/${inst}/enroll`,
      headers: auth,
    });
    expect(again.json().error).toBe("already_enrolled");
    expect(
      await prisma.challengeEnrollment.count({ where: { instanceId: inst, userId: uid } }),
    ).toBe(1);

    // abandon
    const del = await app.inject({
      method: "DELETE",
      url: `/challenges/${inst}/enroll`,
      headers: auth,
    });
    expect(del.statusCode).toBe(200);
    expect(
      (await prisma.challengeEnrollment.findFirst({ where: { instanceId: inst, userId: uid } }))
        ?.status,
    ).toBe("ABANDONED");
    await app.close();
  });

  it("rejects an inactive instance, an expired one, and no-auth", async () => {
    const app = await makeApp();
    const uid = await newUser("x", true);
    const auth = { authorization: `Bearer ${testToken(uid)}` };
    expect(
      (await app.inject({ method: "POST", url: "/challenges/nope/enroll", headers: auth })).json()
        .error,
    ).toBe("challenge_not_active");
    const expired = await newInstance({ endsAt: new Date(Date.now() - 60000) });
    expect(
      (
        await app.inject({ method: "POST", url: `/challenges/${expired}/enroll`, headers: auth })
      ).json().error,
    ).toBe("challenge_expired");
    expect(
      (await app.inject({ method: "POST", url: `/challenges/${expired}/enroll` })).statusCode,
    ).toBe(401);
    await app.close();
  });
});
