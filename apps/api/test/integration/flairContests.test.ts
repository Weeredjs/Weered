import { describe, it, expect, afterEach, afterAll } from "vitest";
import flairContestRoutes from "../../src/routes/flair-contests";
import { buildTestApp, testToken, testAuthFromHeader } from "../helpers/buildTestApp";
import { prisma } from "../../src/lib/prisma";

function makeApp(staffId: string) {
  return buildTestApp((app: any) =>
    flairContestRoutes(app, {
      authFromHeader: testAuthFromHeader,
      getGlobalRole: async (uid: string) => (uid === staffId ? "ADMIN" : "USER"),
      canAccessStaff: (r?: string | null) => r === "ADMIN" || r === "STAFF" || r === "GOD",
      awardNotoriety: async () => null,
      getLobbyRole: async () => null,
      broadcastToLobby: () => {},
      createNotification: async () => {},
    } as any),
  );
}

const contests: string[] = [];
const users: string[] = [];
async function newUser(tag: string) {
  const stamp = Date.now() + "_" + Math.floor(performance.now()) + Math.floor(Math.random() * 1e6);
  const u = await prisma.user.create({
    data: { usernameKey: "itest_flc_" + tag + "_" + stamp, name: tag },
    select: { id: true },
  });
  users.push(u.id);
  return u.id;
}
function validDates() {
  const base = Date.now();
  const d = (ms: number) => new Date(base + ms).toISOString();
  return {
    submissionOpensAt: d(0),
    submissionClosesAt: d(3600e3),
    voteOpensAt: d(3600e3),
    voteClosesAt: d(7200e3),
  };
}

describe("flair-contests - create (staff/mod gate + validation)", () => {
  afterEach(async () => {
    if (contests.length)
      await prisma.flairContest.deleteMany({ where: { id: { in: contests } } }).catch(() => {});
    if (users.length)
      await prisma.user.deleteMany({ where: { id: { in: users } } }).catch(() => {});
    contests.length = 0;
    users.length = 0;
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("a staff user creates a contest; the payload persists", async () => {
    const staff = await newUser("staff");
    const app = await makeApp(staff);
    const r = await app.inject({
      method: "POST",
      url: "/flair-contests",
      headers: { authorization: `Bearer ${testToken(staff)}` },
      payload: { title: "Best Banner", kind: "BANNER", ...validDates() },
    });
    expect(r.statusCode).toBe(200);
    const c = await prisma.flairContest.findFirst({
      where: { title: "Best Banner" },
      select: { id: true },
    });
    expect(c).toBeTruthy();
    if (c) contests.push(c.id);
    await app.close();
  });

  it("blocks no-auth (401) and a non-staff non-mod user (403)", async () => {
    const staff = await newUser("s2");
    const app = await makeApp(staff);
    const regular = await newUser("reg");
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/flair-contests",
          payload: { title: "x", ...validDates() },
        })
      ).statusCode,
    ).toBe(401);
    const r = await app.inject({
      method: "POST",
      url: "/flair-contests",
      headers: { authorization: `Bearer ${testToken(regular)}` },
      payload: { title: "Nope", kind: "BANNER", ...validDates() },
    });
    expect(r.statusCode).toBe(403);
    await app.close();
  });

  it("validates title length, kind, and date order (400s)", async () => {
    const staff = await newUser("s3");
    const app = await makeApp(staff);
    const auth = { authorization: `Bearer ${testToken(staff)}` };

    const shortTitle = await app.inject({
      method: "POST",
      url: "/flair-contests",
      headers: auth,
      payload: { title: "ab", kind: "BANNER", ...validDates() },
    });
    expect(shortTitle.json().error).toBe("title_too_short");

    const badKind = await app.inject({
      method: "POST",
      url: "/flair-contests",
      headers: auth,
      payload: { title: "Valid Title", kind: "WAT", ...validDates() },
    });
    expect(badKind.json().error).toBe("bad_kind");

    const d = validDates();
    const badOrder = await app.inject({
      method: "POST",
      url: "/flair-contests",
      headers: auth,
      payload: { title: "Valid Title", kind: "BANNER", ...d, voteClosesAt: d.submissionOpensAt },
    });
    expect(badOrder.json().error).toBe("bad_date_order");
    await app.close();
  });
});
