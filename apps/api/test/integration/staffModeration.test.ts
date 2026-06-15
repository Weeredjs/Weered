import { describe, it, expect, afterEach, afterAll } from "vitest";
import staffRoutes from "../../src/routes/staff";
import { buildTestApp, testToken, testAuthFromHeader } from "../helpers/buildTestApp";
import { prisma } from "../../src/lib/prisma";

// staff has ~15 opts; the tested routes only use authFromHeader + role checks +
// globalAudit + (empty) rooms, so a noop-Proxy covers the rest.
function makeApp(staffId: string) {
  const target: any = {
    authFromHeader: testAuthFromHeader,
    getGlobalRole: async (uid: string) => (uid === staffId ? "ADMIN" : "USER"),
    canAccessStaff: (r: string | null) => ["ADMIN", "STAFF", "GOD", "SUPPORT"].includes(String(r)),
    canAssignRoles: (r: string | null) => ["ADMIN", "STAFF", "GOD"].includes(String(r)),
    globalAudit: async () => {},
    rooms: new Map(),
  };
  const opts = new Proxy(target, {
    get: (t: any, p: string) => (p in t ? t[p] : () => Promise.resolve()),
  });
  return buildTestApp((app: any) => staffRoutes(app, opts));
}

const users: string[] = [];
async function newUser(tag: string, globalRole?: string) {
  const stamp = Date.now() + "_" + Math.floor(performance.now()) + Math.floor(Math.random() * 1e6);
  const u = await prisma.user.create({
    data: {
      usernameKey: "itest_sm_" + tag + "_" + stamp,
      name: tag,
      globalRole: (globalRole as any) ?? "USER",
    },
    select: { id: true },
  });
  users.push(u.id);
  return u.id;
}

describe("staff moderation - ban / unban / report action", () => {
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

  it("a staff user bans + unbans a target; non-staff is 403", async () => {
    const staff = await newUser("staff");
    const app = await makeApp(staff);
    const target = await newUser("target");
    const auth = { authorization: `Bearer ${testToken(staff)}` };

    const ban = await app.inject({
      method: "POST",
      url: `/staff/users/${target}/ban`,
      headers: auth,
      payload: { reason: "spam" },
    });
    expect(ban.statusCode).toBe(200);
    expect(
      (await prisma.user.findUnique({ where: { id: target }, select: { banned: true } }))?.banned,
    ).toBe(true);

    const unban = await app.inject({
      method: "DELETE",
      url: `/staff/users/${target}/ban`,
      headers: auth,
    });
    expect(unban.statusCode).toBe(200);
    expect(
      (await prisma.user.findUnique({ where: { id: target }, select: { banned: true } }))?.banned,
    ).toBe(false);

    // a non-staff caller cannot ban
    const nonstaff = await newUser("ns");
    const forbidden = await app.inject({
      method: "POST",
      url: `/staff/users/${target}/ban`,
      headers: { authorization: `Bearer ${testToken(nonstaff)}` },
      payload: {},
    });
    expect(forbidden.statusCode).toBe(403);
    await app.close();
  });

  it("ban guards: self 400, unknown 404, no-auth 401", async () => {
    const staff = await newUser("s2");
    const app = await makeApp(staff);
    const auth = { authorization: `Bearer ${testToken(staff)}` };
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/staff/users/${staff}/ban`,
          headers: auth,
          payload: {},
        })
      ).json().error,
    ).toBe("cannot_ban_self");
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/staff/users/ghost/ban",
          headers: auth,
          payload: {},
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: "POST", url: `/staff/users/x/ban`, payload: {} })).statusCode,
    ).toBe(401);
    await app.close();
  });

  it("staff actions a report (status updated); non-staff 403, bad status 400", async () => {
    const staff = await newUser("s3");
    const app = await makeApp(staff);
    const reporter = await newUser("rep");
    const report = await prisma.report.create({
      data: {
        reporterId: reporter,
        targetType: "USER",
        targetId: reporter,
        reason: "SPAM",
        status: "OPEN",
      } as any,
      select: { id: true },
    });

    const bad = await app.inject({
      method: "POST",
      url: `/staff/reports/${report.id}/action`,
      headers: { authorization: `Bearer ${testToken(staff)}` },
      payload: { status: "WAT" },
    });
    expect(bad.json().error).toBe("invalid_status");

    const nonstaff = await newUser("ns3");
    const forbidden = await app.inject({
      method: "POST",
      url: `/staff/reports/${report.id}/action`,
      headers: { authorization: `Bearer ${testToken(nonstaff)}` },
      payload: { status: "DISMISSED" },
    });
    expect(forbidden.statusCode).toBe(403);

    const ok = await app.inject({
      method: "POST",
      url: `/staff/reports/${report.id}/action`,
      headers: { authorization: `Bearer ${testToken(staff)}` },
      payload: { status: "DISMISSED" },
    });
    expect(ok.statusCode).toBe(200);
    const row = await prisma.report.findUnique({
      where: { id: report.id },
      select: { status: true, reviewedById: true },
    });
    expect(row?.status).toBe("DISMISSED");
    expect(row?.reviewedById).toBe(staff);
    await app.close();
  });
});
