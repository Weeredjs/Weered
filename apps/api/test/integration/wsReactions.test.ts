import { describe, it, expect, afterEach, afterAll } from "vitest";
import { handleReactionToggle } from "../../src/sockets/messaging";
import { prisma } from "../../src/lib/prisma";

// DB-backed WS handler: same mock-socket harness as the unit WS tests, but run
// in the integration suite so prisma.reaction toggles hit the test DB.
let broadcasts: any[];
let sent: any[];
function mkRoom(roomId: string, msgId: string) {
  return { roomId, banned: new Set<string>(), msgs: [{ id: msgId }] as any[] };
}
function mkOpts(room: any) {
  broadcasts = [];
  sent = [];
  return {
    normalizeRoomId: (x: string) => x,
    ensureRoomLoaded: async () => room,
    send: (_ws: any, m: any) => sent.push(m),
    broadcast: (_r: any, m: any) => broadcasts.push(m),
  } as any;
}

const users: string[] = [];
const msgIds: string[] = [];
async function newUser() {
  const stamp = Date.now() + "_" + Math.floor(performance.now()) + Math.floor(Math.random() * 1e6);
  const u = await prisma.user.create({
    data: { usernameKey: "itest_rx_" + stamp, name: "rx" },
    select: { id: true },
  });
  users.push(u.id);
  return u.id;
}

describe("ws handleReactionToggle - emoji reactions (DB-backed)", () => {
  afterEach(async () => {
    if (msgIds.length)
      await prisma.reaction.deleteMany({ where: { targetId: { in: msgIds } } }).catch(() => {});
    if (users.length)
      await prisma.user.deleteMany({ where: { id: { in: users } } }).catch(() => {});
    msgIds.length = 0;
    users.length = 0;
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("toggles a reaction on then off, broadcasting each time", async () => {
    const uid = await newUser();
    const msgId = "rxmsg_" + Math.floor(Math.random() * 1e9);
    msgIds.push(msgId);
    const room = mkRoom("r1", msgId);
    const ws = { user: { id: uid, name: "rx" } };

    await handleReactionToggle(
      ws,
      { type: "reaction:toggle", roomId: "r1", msgId, emoji: "🔥" },
      mkOpts(room),
    );
    expect(
      await prisma.reaction.count({ where: { targetId: msgId, userId: uid, emoji: "🔥" } }),
    ).toBe(1);
    expect(broadcasts.length).toBeGreaterThan(0);

    await handleReactionToggle(
      ws,
      { type: "reaction:toggle", roomId: "r1", msgId, emoji: "🔥" },
      mkOpts(room),
    );
    expect(
      await prisma.reaction.count({ where: { targetId: msgId, userId: uid, emoji: "🔥" } }),
    ).toBe(0);
  });

  it("ignores a banned user and an unknown message (no reaction written)", async () => {
    const uid = await newUser();
    const msgId = "rxmsg_" + Math.floor(Math.random() * 1e9);
    msgIds.push(msgId);
    const ws = { user: { id: uid, name: "rx" } };

    const banned = mkRoom("r1", msgId);
    banned.banned.add(uid);
    await handleReactionToggle(
      ws,
      { type: "reaction:toggle", roomId: "r1", msgId, emoji: "👍" },
      mkOpts(banned),
    );
    expect(await prisma.reaction.count({ where: { targetId: msgId } })).toBe(0);

    // target message not in the room
    const empty = { roomId: "r1", banned: new Set<string>(), msgs: [] as any[] };
    await handleReactionToggle(
      ws,
      { type: "reaction:toggle", roomId: "r1", msgId, emoji: "👍" },
      mkOpts(empty),
    );
    expect(await prisma.reaction.count({ where: { targetId: msgId } })).toBe(0);
  });
});
