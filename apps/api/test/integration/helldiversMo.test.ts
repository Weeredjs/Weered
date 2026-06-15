import { describe, it, expect, afterEach, afterAll } from "vitest";
import helldiversMoRoutes from "../../src/routes/helldivers-mo";
import { buildTestApp, testToken, testAuthFromHeader } from "../helpers/buildTestApp";
import { prisma } from "../../src/lib/prisma";

function makeApp(awarded: string[]) {
  return buildTestApp((app: any) =>
    helldiversMoRoutes(app, {
      authFromHeader: testAuthFromHeader,
      awardPaper: async () => ({ balance: 0 }),
      awardNotoriety: async (_uid: string, action: string) => {
        awarded.push(action);
        return 50;
      },
    } as any),
  );
}

const defs: string[] = [];
const users: string[] = [];
async function newUser(tag: string, steamId?: string) {
  const stamp = Date.now() + "_" + Math.floor(performance.now()) + Math.floor(Math.random() * 1e6);
  const u = await prisma.user.create({
    data: { usernameKey: "itest_hdmo_" + tag + "_" + stamp, name: tag, steamId: steamId ?? null },
    select: { id: true },
  });
  users.push(u.id);
  return u.id;
}

describe("helldivers MO claim - steam-gate anti-cheat + idempotent payout", () => {
  afterEach(async () => {
    if (users.length)
      await prisma.challengeEnrollment
        .deleteMany({ where: { userId: { in: users } } })
        .catch(() => {});
    for (const d of defs)
      await prisma.challengeInstance.deleteMany({ where: { definitionId: d } }).catch(() => {});
    if (defs.length)
      await prisma.challengeDefinition.deleteMany({ where: { id: { in: defs } } }).catch(() => {});
    if (users.length)
      await prisma.user.deleteMany({ where: { id: { in: users } } }).catch(() => {});
    defs.length = 0;
    users.length = 0;
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("401 unauthenticated; 403 steam_required for a non-Steam account", async () => {
    const app = await makeApp([]);
    const noSteam = await newUser("nosteam"); // no steamId
    expect(
      (await app.inject({ method: "POST", url: "/helldivers/major-orders/100/claim" })).statusCode,
    ).toBe(401);
    const r = await app.inject({
      method: "POST",
      url: "/helldivers/major-orders/100/claim",
      headers: { authorization: `Bearer ${testToken(noSteam)}` },
    });
    expect(r.statusCode).toBe(403);
    expect(r.json().error).toBe("steam_required");
    await app.close();
  });

  it("steam-linked account passes the gate (404 when no challenge exists)", async () => {
    const app = await makeApp([]);
    const steamUser = await newUser("steam", "76561198000000001");
    const r = await app.inject({
      method: "POST",
      url: "/helldivers/major-orders/999/claim",
      headers: { authorization: `Bearer ${testToken(steamUser)}` },
    });
    expect(r.statusCode).toBe(404);
    expect(r.json().error).toBe("challenge_not_found");
    await app.close();
  });

  it("happy path credits notoriety exactly once (idempotent per MO)", async () => {
    const awarded: string[] = [];
    const app = await makeApp(awarded);
    const moId = "mo_" + Math.floor(Math.random() * 1e9);
    const steamUser = await newUser("claimant", "76561198000000002");
    const def = await prisma.challengeDefinition.create({
      data: {
        title: "HD2 MO",
        createdById: steamUser,
        objectives: [],
        kind: "MAJOR_ORDER",
        externalRef: `hd2:mo:${moId}`,
        notorietyReward: 50,
        paperReward: 0,
      },
      select: { id: true },
    });
    defs.push(def.id);
    await prisma.challengeInstance.create({
      data: { definitionId: def.id, status: "ACTIVE", startsAt: new Date() },
    });

    const first = await app.inject({
      method: "POST",
      url: `/helldivers/major-orders/${moId}/claim`,
      headers: { authorization: `Bearer ${testToken(steamUser)}` },
    });
    expect(first.statusCode).toBe(200);
    expect(awarded).toEqual(["HD2_MAJOR_ORDER"]);
    const enr = await prisma.challengeEnrollment.findFirst({ where: { userId: steamUser } });
    expect(enr?.status).toBe("COMPLETED");

    // re-claim: idempotent, NO second award
    const second = await app.inject({
      method: "POST",
      url: `/helldivers/major-orders/${moId}/claim`,
      headers: { authorization: `Bearer ${testToken(steamUser)}` },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().alreadyClaimed).toBe(true);
    expect(awarded).toEqual(["HD2_MAJOR_ORDER"]); // still exactly one
    await app.close();
  });
});
