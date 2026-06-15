import { describe, it, expect, afterEach, afterAll } from "vitest";
import groupsRoutes from "../../src/routes/groups";
import { buildTestApp, testToken, testAuthFromHeader } from "../helpers/buildTestApp";
import { prisma } from "../../src/lib/prisma";

async function makeApp() {
  return buildTestApp((app: any) =>
    groupsRoutes(app, {
      authFromHeader: testAuthFromHeader,
      resolveUserId: async (x: string) => x,
      dmDeliver: () => {},
      isUserOnline: () => false,
      sendPush: async () => {},
      resolveMentions: async () => [],
      createNotification: async () => {},
    } as any),
  );
}

const threads: string[] = [];
const users: string[] = [];
async function newUser(tag: string) {
  const stamp = Date.now() + "_" + Math.floor(performance.now()) + Math.floor(Math.random() * 1e6);
  const u = await prisma.user.create({
    data: { usernameKey: "itest_grp_" + tag + "_" + stamp, name: tag },
    select: { id: true },
  });
  users.push(u.id);
  return u.id;
}

describe("groups - create + message", () => {
  afterEach(async () => {
    if (threads.length)
      await prisma.groupThread.deleteMany({ where: { id: { in: threads } } }).catch(() => {});
    if (users.length)
      await prisma.user.deleteMany({ where: { id: { in: users } } }).catch(() => {});
    threads.length = 0;
    users.length = 0;
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createGroup(owner: string, members: string[]) {
    const app = await makeApp();
    const r = await app.inject({
      method: "POST",
      url: "/groups",
      headers: { authorization: `Bearer ${testToken(owner)}` },
      payload: { name: "G", memberIds: members },
    });
    const thread = await prisma.groupThread.findFirst({
      where: { createdById: owner },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (thread) threads.push(thread.id);
    return { app, r, threadId: thread?.id };
  }

  it("creates a thread with the creator as OWNER and the invitee as MEMBER", async () => {
    const owner = await newUser("owner");
    const m1 = await newUser("m1");
    const { app, r, threadId } = await createGroup(owner, [m1]);
    expect(r.statusCode).toBe(200);
    expect(threadId).toBeTruthy();
    const members = await prisma.groupMember.findMany({
      where: { threadId },
      select: { userId: true, role: true },
    });
    expect(members.find((x) => x.userId === owner)?.role).toBe("OWNER");
    expect(members.find((x) => x.userId === m1)?.role).toBe("MEMBER");
    await app.close();
  });

  it("rejects a group with no other members (400) and no-auth (401)", async () => {
    const app = await makeApp();
    const owner = await newUser("solo");
    expect(
      (await app.inject({ method: "POST", url: "/groups", payload: { memberIds: [owner] } }))
        .statusCode,
    ).toBe(401);
    const r = await app.inject({
      method: "POST",
      url: "/groups",
      headers: { authorization: `Bearer ${testToken(owner)}` },
      payload: { memberIds: [] },
    });
    expect(r.statusCode).toBe(400);
    await app.close();
  });

  it("members can post; a non-member is 403", async () => {
    const owner = await newUser("powner");
    const m1 = await newUser("pm1");
    const { app, threadId } = await createGroup(owner, [m1]);

    const byOwner = await app.inject({
      method: "POST",
      url: `/groups/${threadId}/messages`,
      headers: { authorization: `Bearer ${testToken(owner)}` },
      payload: { body: "hi team" },
    });
    expect(byOwner.statusCode).toBe(200);
    const byMember = await app.inject({
      method: "POST",
      url: `/groups/${threadId}/messages`,
      headers: { authorization: `Bearer ${testToken(m1)}` },
      payload: { body: "hey" },
    });
    expect(byMember.statusCode).toBe(200);

    const stranger = await newUser("pstr");
    const byStranger = await app.inject({
      method: "POST",
      url: `/groups/${threadId}/messages`,
      headers: { authorization: `Bearer ${testToken(stranger)}` },
      payload: { body: "intruder" },
    });
    expect(byStranger.statusCode).toBe(403);
    expect(await prisma.groupMessage.count({ where: { threadId } })).toBe(2);
    await app.close();
  });
});
