import { describe, it, expect, afterEach, afterAll } from "vitest";
import profileRoutes from "../../src/routes/profile";
import { buildTestApp, testToken, testAuthFromHeader } from "../helpers/buildTestApp";
import { prisma } from "../../src/lib/prisma";

async function makeApp() {
  return buildTestApp((app: any) =>
    profileRoutes(app, {
      authFromHeader: testAuthFromHeader,
      getNotorietyRank: () => ({ title: "Innocent", min: 0, next: null }),
      awardNotoriety: async () => null,
      rooms: new Map(),
      publishState: () => {},
    } as any),
  );
}

const users: string[] = [];
async function newUser(tag: string) {
  const stamp = Date.now() + "_" + Math.floor(performance.now()) + Math.floor(Math.random() * 1e6);
  const u = await prisma.user.create({
    data: { usernameKey: "itest_prof_" + tag + "_" + stamp, name: tag },
    select: { id: true },
  });
  users.push(u.id);
  return u.id;
}

describe("profile - PATCH /profile/me", () => {
  afterEach(async () => {
    if (users.length)
      await prisma.user.deleteMany({ where: { id: { in: users } } }).catch(() => {});
    users.length = 0;
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("updates bio + status + joinPolicy and persists them", async () => {
    const app = await makeApp();
    const uid = await newUser("u");
    const r = await app.inject({
      method: "PATCH",
      url: "/profile/me",
      headers: { authorization: `Bearer ${testToken(uid)}` },
      payload: { bio: "  hello world  ", statusText: "vibing", joinPolicy: "FRIENDS" },
    });
    expect(r.statusCode).toBe(200);
    const u = await prisma.user.findUnique({
      where: { id: uid },
      select: { bio: true, statusText: true, joinPolicy: true },
    });
    expect(u?.bio).toBe("hello world"); // trimmed
    expect(u?.statusText).toBe("vibing");
    expect(u?.joinPolicy).toBe("FRIENDS");
    await app.close();
  });

  it("ignores an invalid joinPolicy while still applying a valid field", async () => {
    const app = await makeApp();
    const uid = await newUser("u2");
    const r = await app.inject({
      method: "PATCH",
      url: "/profile/me",
      headers: { authorization: `Bearer ${testToken(uid)}` },
      payload: { bio: "kept", joinPolicy: "WAT" },
    });
    expect(r.statusCode).toBe(200);
    const u = await prisma.user.findUnique({
      where: { id: uid },
      select: { bio: true, joinPolicy: true },
    });
    expect(u?.bio).toBe("kept");
    expect(u?.joinPolicy).not.toBe("WAT"); // invalid -> not written
    await app.close();
  });

  it("401 unauthenticated, 400 when there is nothing to update", async () => {
    const app = await makeApp();
    const uid = await newUser("u3");
    expect(
      (await app.inject({ method: "PATCH", url: "/profile/me", payload: { bio: "x" } })).statusCode,
    ).toBe(401);
    const none = await app.inject({
      method: "PATCH",
      url: "/profile/me",
      headers: { authorization: `Bearer ${testToken(uid)}` },
      payload: {},
    });
    expect(none.statusCode).toBe(400);
    await app.close();
  });
});
