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
    data: { usernameKey: "itest_rep_" + tag + "_" + stamp, name: tag },
    select: { id: true },
  });
  users.push(u.id);
  return u.id;
}

describe("reports - POST /reports (moderation intake)", () => {
  afterEach(async () => {
    if (users.length) {
      await prisma.report.deleteMany({ where: { reporterId: { in: users } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: users } } }).catch(() => {});
    }
    users.length = 0;
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("files a valid report (persisted with reporter + target + reason)", async () => {
    const app = await makeApp();
    const reporter = await newUser("rep");
    const target = await newUser("tgt");
    const r = await app.inject({
      method: "POST",
      url: "/reports",
      headers: { authorization: `Bearer ${testToken(reporter)}` },
      payload: { targetType: "USER", targetId: target, reason: "SPAM", note: "spamming" },
    });
    expect(r.statusCode).toBe(200);
    const row = await prisma.report.findFirst({
      where: { reporterId: reporter, targetId: target },
    });
    expect(row?.reason).toBe("SPAM");
    expect(row?.targetType).toBe("USER");
    await app.close();
  });

  it("rejects no-auth (401), bad target type + bad reason + missing target (400)", async () => {
    const app = await makeApp();
    const reporter = await newUser("rep2");
    const target = await newUser("tgt2");
    const auth = { authorization: `Bearer ${testToken(reporter)}` };
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/reports",
          payload: { targetType: "USER", targetId: target, reason: "SPAM" },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/reports",
          headers: auth,
          payload: { targetType: "WAT", targetId: target, reason: "SPAM" },
        })
      ).json().error,
    ).toBe("invalid_target_type");
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/reports",
          headers: auth,
          payload: { targetType: "USER", targetId: target, reason: "WAT" },
        })
      ).json().error,
    ).toBe("invalid_reason");
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/reports",
          headers: auth,
          payload: { targetType: "USER", targetId: "", reason: "SPAM" },
        })
      ).json().error,
    ).toBe("missing_target_id");
    await app.close();
  });
});
