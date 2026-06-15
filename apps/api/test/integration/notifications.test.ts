import { describe, it, expect, afterEach, afterAll } from "vitest";
import notificationsRoutes from "../../src/routes/notifications";
import { buildTestApp, testToken, testAuthFromHeader } from "../helpers/buildTestApp";
import { prisma } from "../../src/lib/prisma";

async function makeApp() {
  return buildTestApp((app: any) =>
    notificationsRoutes(app, {
      authFromHeader: testAuthFromHeader,
      VAPID_PUBLIC: "",
      sendPush: async () => {},
    } as any),
  );
}

const users: string[] = [];
async function newUser(tag: string) {
  const stamp = Date.now() + "_" + Math.floor(performance.now()) + Math.floor(Math.random() * 1e6);
  const u = await prisma.user.create({
    data: { usernameKey: "itest_ntf_" + tag + "_" + stamp, name: tag },
    select: { id: true },
  });
  users.push(u.id);
  return u.id;
}

describe("notifications - list / unread-count / mark-read", () => {
  afterEach(async () => {
    if (users.length) {
      await prisma.notification.deleteMany({ where: { userId: { in: users } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: users } } }).catch(() => {});
    }
    users.length = 0;
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("lists a user own notifications with the right unread count (isolated per user)", async () => {
    const app = await makeApp();
    const a = await newUser("a");
    const b = await newUser("b");
    await prisma.notification.createMany({
      data: [
        { userId: a, type: "FRIEND_REQUEST", title: "one", read: false },
        { userId: a, type: "FRIEND_ACCEPTED", title: "two", read: true },
        { userId: b, type: "FRIEND_REQUEST", title: "b-only", read: false },
      ],
    });

    const asA = await app.inject({
      method: "GET",
      url: "/notifications",
      headers: { authorization: `Bearer ${testToken(a)}` },
    });
    expect(asA.statusCode).toBe(200);
    expect(asA.json().notifications.length).toBe(2);
    expect(asA.json().unreadCount).toBe(1);

    // isolation: A never sees B's notification
    expect(JSON.stringify(asA.json())).not.toContain("b-only");
    await app.close();
  });

  it("marks all read -> unread-count drops to 0; 401 without auth", async () => {
    const app = await makeApp();
    const a = await newUser("m");
    await prisma.notification.createMany({
      data: [
        { userId: a, type: "MENTION", title: "x", read: false },
        { userId: a, type: "MENTION", title: "y", read: false },
      ],
    });
    const before = await app.inject({
      method: "GET",
      url: "/notifications/unread-count",
      headers: { authorization: `Bearer ${testToken(a)}` },
    });
    expect(before.json().count).toBe(2);

    const mark = await app.inject({
      method: "PATCH",
      url: "/notifications/read",
      headers: { authorization: `Bearer ${testToken(a)}` },
      payload: { all: true },
    });
    expect(mark.statusCode).toBe(200);

    const after = await app.inject({
      method: "GET",
      url: "/notifications/unread-count",
      headers: { authorization: `Bearer ${testToken(a)}` },
    });
    expect(after.json().count).toBe(0);

    expect((await app.inject({ method: "GET", url: "/notifications" })).statusCode).toBe(401);
    await app.close();
  });
});
