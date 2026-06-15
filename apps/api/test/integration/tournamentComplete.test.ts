import { describe, it, expect, afterEach, afterAll } from "vitest";
import { completeTournament } from "../../src/lib/tournamentComplete";
import { prisma } from "../../src/lib/prisma";

// Exercises the REAL completeTournament against the test DB. Regression guard for
// the bug found while removing prisma casts: notorietyEvent.create passed a
// `refId` the schema lacked, so the create threw, the catch swallowed it, and the
// following user.update (the actual notoriety credit) was skipped — tournament
// winners silently got 0 notoriety. With refId added to the schema, the champion
// is credited AND the ledger row is linked to the tournament.
describe("completeTournament — leaderboard payout + refId-linked notoriety ledger", () => {
  const users: string[] = [];
  const tournaments: string[] = [];
  const badgeNames: string[] = [];

  afterEach(async () => {
    if (users.length) {
      await prisma.notorietyEvent.deleteMany({ where: { userId: { in: users } } }).catch(() => {});
      await prisma.userBadge.deleteMany({ where: { userId: { in: users } } }).catch(() => {});
    }
    if (tournaments.length) {
      // tournamentEntry rows cascade from the tournament delete
      await prisma.tournament.deleteMany({ where: { id: { in: tournaments } } }).catch(() => {});
    }
    if (badgeNames.length) {
      await prisma.challengeBadge
        .deleteMany({ where: { name: { in: badgeNames } } })
        .catch(() => {});
    }
    if (users.length) {
      await prisma.user.deleteMany({ where: { id: { in: users } } }).catch(() => {});
    }
    users.length = 0;
    tournaments.length = 0;
    badgeNames.length = 0;
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("credits the champion notoriety and writes a refId-linked ledger row", async () => {
    const stamp = Date.now() + "_" + Math.floor(performance.now());
    const champ = await prisma.user.create({
      data: { usernameKey: "itest_tc_champ_" + stamp, name: "champ", notoriety: 0 },
      select: { id: true },
    });
    const second = await prisma.user.create({
      data: { usernameKey: "itest_tc_2_" + stamp, name: "second", notoriety: 0 },
      select: { id: true },
    });
    users.push(champ.id, second.id);

    const now = new Date();
    const t = await prisma.tournament.create({
      data: {
        title: "ITest Cup " + stamp,
        createdById: champ.id,
        format: "LEADERBOARD",
        scoringRule: { type: "manual" },
        registrationOpensAt: now,
        startsAt: now,
        endsAt: now,
      },
      select: { id: true, title: true },
    });
    tournaments.push(t.id);
    badgeNames.push(t.title + " · Champion", t.title + " · Runner-Up");

    await prisma.tournamentEntry.create({
      data: { tournamentId: t.id, userId: champ.id, displayName: "champ", score: 100 },
    });
    await prisma.tournamentEntry.create({
      data: { tournamentId: t.id, userId: second.id, displayName: "second", score: 50 },
    });

    const res = await completeTournament(prisma, t.id);
    expect(res.ok).toBe(true);
    expect(res.tournament?.status).toBe("COMPLETED");

    // Champion notoriety credited (was 0 before the refId fix).
    const champAfter = await prisma.user.findUnique({
      where: { id: champ.id },
      select: { notoriety: true },
    });
    expect(champAfter!.notoriety).toBeGreaterThan(0);

    // Ledger row written AND linked to the tournament via refId.
    const ev = await prisma.notorietyEvent.findFirst({
      where: { userId: champ.id, refId: t.id },
    });
    expect(ev).not.toBeNull();
    expect(ev!.action).toBe("TOURNAMENT_CHAMPION");
    expect(ev!.points).toBe(champAfter!.notoriety);

    // Ranks were assigned by score.
    const champEntry = await prisma.tournamentEntry.findFirst({
      where: { tournamentId: t.id, userId: champ.id },
      select: { rank: true },
    });
    expect(champEntry!.rank).toBe(1);
  });
});
