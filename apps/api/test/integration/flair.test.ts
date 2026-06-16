import { describe, it, expect, afterEach, afterAll } from "vitest";
import { grantFlairToUser, getEquippedFlair, getEquippedFlairBatch } from "../../src/lib/flair";
import { prisma } from "../../src/lib/prisma";

// Flair economy (challenge/tournament rewards). grantFlairToUser auto-equips
// the first flair a user receives; getEquippedFlairBatch is the null-index path
// fixed during the cast strip.
const users: string[] = [];
const flairs: string[] = [];
async function newUser() {
  const stamp = Date.now() + "_" + Math.floor(performance.now()) + Math.floor(Math.random() * 1e6);
  const u = await prisma.user.create({
    data: { usernameKey: "itest_flair_" + stamp, name: "f" },
    select: { id: true },
  });
  users.push(u.id);
  return u.id;
}
async function newFlair(tag: string) {
  const stamp = Date.now() + "_" + Math.floor(performance.now()) + Math.floor(Math.random() * 1e6);
  const f = await prisma.flairItem.create({
    data: { slug: "itest_" + tag + "_" + stamp, name: tag, kind: "BADGE" },
    select: { id: true },
  });
  flairs.push(f.id);
  return f.id;
}

describe("flair economy - grant / equip / batch", () => {
  afterEach(async () => {
    if (users.length) {
      await prisma.userFlair.deleteMany({ where: { userId: { in: users } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: users } } }).catch(() => {});
    }
    if (flairs.length)
      await prisma.flairItem.deleteMany({ where: { id: { in: flairs } } }).catch(() => {});
    users.length = 0;
    flairs.length = 0;
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("grants a first flair and auto-equips it", async () => {
    const uid = await newUser();
    const fid = await newFlair("first");
    const r = await grantFlairToUser(prisma, uid, fid, "tournament:x");
    expect(r).toMatchObject({ granted: true, alreadyOwned: false, equipped: true });
    expect(
      (await prisma.user.findUnique({ where: { id: uid }, select: { equippedFlairId: true } }))
        ?.equippedFlairId,
    ).toBe(fid);

    const eq = await getEquippedFlair(prisma, uid);
    expect(eq?.id).toBe(fid);
  });

  it("is idempotent on re-grant, and a 2nd flair is NOT auto-equipped", async () => {
    const uid = await newUser();
    const f1 = await newFlair("a");
    const f2 = await newFlair("b");
    await grantFlairToUser(prisma, uid, f1);
    const again = await grantFlairToUser(prisma, uid, f1);
    expect(again).toMatchObject({ granted: false, alreadyOwned: true });

    const second = await grantFlairToUser(prisma, uid, f2);
    expect(second).toMatchObject({ granted: true, equipped: false }); // f1 already equipped
    expect(
      (await prisma.user.findUnique({ where: { id: uid }, select: { equippedFlairId: true } }))
        ?.equippedFlairId,
    ).toBe(f1);
  });

  it("getEquippedFlairBatch maps users to their equipped flair (and skips the unequipped)", async () => {
    const withFlair = await newUser();
    const without = await newUser(); // never granted -> equippedFlairId null
    const fid = await newFlair("batch");
    await grantFlairToUser(prisma, withFlair, fid);

    const map = await getEquippedFlairBatch(prisma, [withFlair, without]);
    expect(map[withFlair]?.id).toBe(fid);
    expect(map[without]).toBeUndefined();
  });
});
