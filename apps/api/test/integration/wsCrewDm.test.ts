import { describe, it, expect, afterEach, afterAll } from "vitest";
import { handleCrewDm } from "../../src/sockets/messaging";
import { prisma } from "../../src/lib/prisma";

// crew:send is membership-gated: only members of a crew can post to its channel.
// DB-backed handler driven via the mock-socket harness.
let sent: any[];
function mkOpts(over: any = {}) {
  sent = [];
  return {
    checkUrlSpam: () => ({ ok: true }),
    checkChatRateLimit: () => ({ ok: true }),
    createNotification: async () => {},
    dmDeliver: () => {},
    isUserOnline: () => false,
    resolveMentions: async () => [],
    resolveUserId: async (x: string) => x,
    send: (_ws: any, m: any) => sent.push(m),
    sendPush: async () => {},
    toggleReactionOnTarget: async () => {},
    awardNotoriety: async () => null,
    wss: { clients: new Set() },
    ...over,
  } as any;
}

const crews: string[] = [];
const users: string[] = [];
async function newUser(tag: string) {
  const stamp = Date.now() + "_" + Math.floor(performance.now()) + Math.floor(Math.random() * 1e6);
  const u = await prisma.user.create({
    data: { usernameKey: "itest_cd_" + tag + "_" + stamp, name: tag },
    select: { id: true },
  });
  users.push(u.id);
  return u.id;
}
async function newCrew(ownerId: string, members: string[]) {
  const stamp = Date.now() + "_" + Math.floor(performance.now()) + Math.floor(Math.random() * 1e6);
  const crew = await (prisma as any).crew.create({
    data: { name: "C" + stamp, tag: "CD", ownerId },
    select: { id: true },
  });
  crews.push(crew.id);
  for (const m of members)
    await (prisma as any).crewMember.create({
      data: { crewId: crew.id, userId: m, name: "m", role: m === ownerId ? "LEADER" : "MEMBER" },
    });
  return crew.id;
}

describe("ws handleCrewDm - membership-gated crew channel", () => {
  afterEach(async () => {
    for (const c of crews) {
      await (prisma as any).crewMessage.deleteMany({ where: { crewId: c } }).catch(() => {});
      await (prisma as any).crewMember.deleteMany({ where: { crewId: c } }).catch(() => {});
    }
    if (crews.length)
      await (prisma as any).crew.deleteMany({ where: { id: { in: crews } } }).catch(() => {});
    if (users.length)
      await prisma.user.deleteMany({ where: { id: { in: users } } }).catch(() => {});
    crews.length = 0;
    users.length = 0;
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("a crew member can post; a non-member is silently dropped", async () => {
    const owner = await newUser("owner");
    const crewId = await newCrew(owner, [owner]);
    const ws = { user: { id: owner, name: "Owner" } };

    await handleCrewDm(ws, { type: "crew:send", crewId, body: "gm crew" }, mkOpts());
    expect(await (prisma as any).crewMessage.count({ where: { crewId } })).toBe(1);

    const stranger = await newUser("stranger");
    await handleCrewDm(
      { user: { id: stranger, name: "S" } },
      { type: "crew:send", crewId, body: "let me in" },
      mkOpts(),
    );
    expect(await (prisma as any).crewMessage.count({ where: { crewId } })).toBe(1); // unchanged
  });

  it("rejects URL spam with crew:rejected (no message written)", async () => {
    const owner = await newUser("o2");
    const crewId = await newCrew(owner, [owner]);
    await handleCrewDm(
      { user: { id: owner, name: "O" } },
      { type: "crew:send", crewId, body: "spam http://x" },
      mkOpts({ checkUrlSpam: () => ({ ok: false, reason: "no_links" }) }),
    );
    expect(sent.find((m) => m.type === "crew:rejected")?.reason).toBe("no_links");
    expect(await (prisma as any).crewMessage.count({ where: { crewId } })).toBe(0);
  });
});
