import { describe, it, expect, beforeAll, afterAll } from "vitest";
import groupsRoutes from "../../src/routes/groups";
import invitesRoutes from "../../src/routes/invites";
import { prisma } from "../../src/lib/prisma";
import { canAssignRoles, getGlobalRole } from "../../src/lib/lobbyAuth";
import { buildTestApp, testAuthFromHeader, testToken } from "../helpers/buildTestApp";

// A block holds in group threads and invites too (red team 2026-11-01, finding 13).
const stamp = Date.now().toString(36);
const id: Record<string, string> = {};
let app: any;

beforeAll(async () => {
  for (const k of ["a", "blocker", "friend"]) {
    const u = await prisma.user.create({
      data: { usernameKey: `itest_blk_${k}_${stamp}`, name: `blk_${k}_${stamp}` },
      select: { id: true },
    });
    id[k] = u.id;
  }
  // "blocker" blocked "a".
  await prisma.userBlock.create({ data: { blockerId: id.blocker, blockedId: id.a } });
  app = await buildTestApp(async (x: any) => {
    await groupsRoutes(x, {
      authFromHeader: testAuthFromHeader,
      dmDeliver: () => {},
      isUserOnline: () => false,
      sendPush: async () => {},
    } as any);
    await invitesRoutes(x, {
      authFromHeader: testAuthFromHeader,
      awardNotoriety: async () => null,
      getGlobalRole,
      canAssignRoles,
      WEB_URL: "https://weered.ca",
    } as any);
  });
});

afterAll(async () => {
  await app?.close();
  const users = Object.values(id);
  await prisma.groupThread.deleteMany({ where: { createdById: { in: users } } }).catch(() => {});
  await prisma.invite.deleteMany({ where: { createdBy: { in: users } } }).catch(() => {});
  await prisma.directMessage
    .deleteMany({ where: { OR: [{ fromId: { in: users } }, { toId: { in: users } }] } })
    .catch(() => {});
  await prisma.userBlock.deleteMany({ where: { blockerId: id.blocker } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: users } } }).catch(() => {});
  await prisma.$disconnect();
});

const as = (who: string) => ({ authorization: `Bearer ${testToken(id[who])}` });

describe("blocks beyond direct messages", () => {
  it("a group can't pull in someone who blocked you", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/groups",
      headers: as("a"),
      payload: { memberIds: [id.blocker] },
    });
    expect(r.statusCode).toBe(400);
    const ok = await app.inject({
      method: "POST",
      url: "/groups",
      headers: as("a"),
      payload: { memberIds: [id.blocker, id.friend] },
    });
    expect(ok.statusCode).toBe(200);
    const thread = await prisma.groupThread.findFirst({
      where: { createdById: id.a },
      include: { members: true },
    });
    expect(thread?.members.map((m: any) => m.userId).sort()).toEqual([id.a, id.friend].sort());
  });

  it("an invite can't be sent to someone who blocked you", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/invites/send",
      headers: as("a"),
      payload: { type: "PLATFORM", username: `itest_blk_blocker_${stamp}` },
    });
    expect(r.statusCode).toBe(403);
    expect(await prisma.directMessage.count({ where: { fromId: id.a, toId: id.blocker } })).toBe(0);
  });
});
