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
      // A visible change (picture, colour) is pushed to the person's open sockets.
      getWss: () => ({ clients: new Set() }),
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

  it("keeps an avatar colour only when it is a colour: set, cleared, or left alone", async () => {
    const app = await makeApp();
    const uid = await newUser("u4");
    const patch = (avatarColor: string) =>
      app.inject({
        method: "PATCH",
        url: "/profile/me",
        headers: { authorization: `Bearer ${testToken(uid)}` },
        payload: { avatarColor, bio: "" },
      });
    const color = async () =>
      (await prisma.user.findUnique({ where: { id: uid }, select: { avatarColor: true } }))
        ?.avatarColor;

    expect((await patch("#14B8A6")).statusCode).toBe(200);
    expect(await color()).toBe("#14B8A6");
    // Drawn straight into styles: a url() would be fetched by every viewer.
    await patch("url(//x.io/a)");
    await patch("red;top:0");
    expect(await color()).toBe("#14B8A6");
    // Empty is "no colour" (Background: None).
    await patch("");
    expect(await color()).toBeNull();
    await app.close();
  });

  it("brings their messages in rooms' memory up to date with the new colour", async () => {
    const uid = await newUser("u5");
    const room = {
      users: new Map(),
      msgs: [
        { id: "m1", user: { id: uid, name: "u5", avatarColor: "#14b8a6" }, body: "hi", ts: 1 },
        { id: "m2", user: { id: "someone", name: "x", avatarColor: "#22c55e" }, body: "yo", ts: 2 },
      ],
    };
    const app = await buildTestApp((a: any) =>
      profileRoutes(a, {
        authFromHeader: testAuthFromHeader,
        getNotorietyRank: () => ({ title: "Innocent", min: 0, next: null }),
        awardNotoriety: async () => null,
        rooms: new Map([["r1", room]]),
        publishState: () => {},
        getWss: () => ({ clients: new Set() }),
      } as any),
    );
    const r = await app.inject({
      method: "PATCH",
      url: "/profile/me",
      headers: { authorization: `Bearer ${testToken(uid)}` },
      payload: { avatarColor: "" },
    });
    expect(r.statusCode).toBe(200);
    // A reload is served from here: theirs has no colour now; others' are untouched.
    expect(room.msgs[0].user.avatarColor).toBeUndefined();
    expect(room.msgs[1].user.avatarColor).toBe("#22c55e");
    await app.close();
  });
});
