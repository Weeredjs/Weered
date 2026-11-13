import { describe, it, expect, afterEach, afterAll } from "vitest";
import tournamentsRoutes from "../../src/routes/tournaments";
import { buildTestApp, testToken, testAuthFromHeader } from "../helpers/buildTestApp";
import { prisma } from "../../src/lib/prisma";
import { canAccessStaff } from "../../src/lib/lobbyAuth";

// A match belongs to the two entries playing it, and to staff: reporting a
// result, disputing one and marking a match live all ask that (hardening pass,
// 2026-11-13).

async function makeApp() {
  const opts: any = new Proxy(
    {
      authFromHeader: testAuthFromHeader,
      canAccessStaff,
      getGlobalRole: async (id: string) =>
        (await prisma.user.findUnique({ where: { id }, select: { globalRole: true } }))
          ?.globalRole ?? "USER",
    },
    { get: (t: any, p: string) => (p in t ? t[p] : () => {}) },
  );
  return buildTestApp((app: any) => tournamentsRoutes(app, opts));
}

const tournaments: string[] = [];
const users: string[] = [];

async function newUser(tag: string, globalRole?: "STAFF") {
  const stamp = Date.now() + "_" + Math.floor(performance.now()) + Math.floor(Math.random() * 1e6);
  const u = await prisma.user.create({
    data: {
      usernameKey: "itest_tmr_" + tag + "_" + stamp,
      name: tag,
      ...(globalRole ? { globalRole } : {}),
    },
    select: { id: true },
  });
  users.push(u.id);
  return u.id;
}

/** A bracket match between two players, in the given state. */
async function newMatch(status: "READY" | "REPORTED") {
  const stamp = Date.now() + "_" + Math.floor(performance.now());
  const now = new Date();
  const a = await newUser("a");
  const b = await newUser("b");
  const t = await prisma.tournament.create({
    data: {
      title: "ITest Match " + stamp,
      createdById: a,
      format: "BRACKET",
      scoringRule: { type: "manual" },
      registrationOpensAt: now,
      startsAt: now,
      endsAt: now,
    },
    select: { id: true },
  });
  tournaments.push(t.id);
  const ea = await prisma.tournamentEntry.create({
    data: { tournamentId: t.id, userId: a, displayName: "a" },
    select: { id: true },
  });
  const eb = await prisma.tournamentEntry.create({
    data: { tournamentId: t.id, userId: b, displayName: "b" },
    select: { id: true },
  });
  const m = await prisma.tournamentMatch.create({
    data: {
      tournamentId: t.id,
      round: 1,
      bracketPosition: 0,
      entryAId: ea.id,
      entryBId: eb.id,
      status,
      ...(status === "REPORTED" ? { winnerEntryId: ea.id, reportedById: a, reportedAt: now } : {}),
    },
    select: { id: true },
  });
  return { tournamentId: t.id, matchId: m.id, a, b };
}

const post = (app: any, url: string, userId: string) =>
  app.inject({
    method: "POST",
    url,
    headers: { authorization: "Bearer " + testToken(userId) },
    payload: {},
  });
const statusOf = async (matchId: string) =>
  (await prisma.tournamentMatch.findUnique({ where: { id: matchId }, select: { status: true } }))
    ?.status;

describe("tournament matches: only the players in one, or staff, act on it", () => {
  afterEach(async () => {
    if (tournaments.length) {
      await prisma.tournamentMatch
        .deleteMany({ where: { tournamentId: { in: tournaments } } })
        .catch(() => {});
      await prisma.tournament.deleteMany({ where: { id: { in: tournaments } } }).catch(() => {});
    }
    if (users.length)
      await prisma.user.deleteMany({ where: { id: { in: users } } }).catch(() => {});
    tournaments.length = 0;
    users.length = 0;
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("a member who is not in the match cannot dispute its result", async () => {
    const app = await makeApp();
    const { tournamentId, matchId } = await newMatch("REPORTED");
    const stranger = await newUser("stranger");
    const r = await post(app, `/tournaments/${tournamentId}/matches/${matchId}/dispute`, stranger);
    expect(r.statusCode).toBe(403);
    expect(await statusOf(matchId)).toBe("REPORTED");
    await app.close();
  });

  it("the opponent can dispute it", async () => {
    const app = await makeApp();
    const { tournamentId, matchId, b } = await newMatch("REPORTED");
    const r = await post(app, `/tournaments/${tournamentId}/matches/${matchId}/dispute`, b);
    expect(r.statusCode).toBe(200);
    expect(await statusOf(matchId)).toBe("DISPUTED");
    await app.close();
  });

  it("a member who is not in the match cannot mark it live", async () => {
    const app = await makeApp();
    const { tournamentId, matchId } = await newMatch("READY");
    const stranger = await newUser("stranger");
    const r = await post(app, `/tournaments/${tournamentId}/matches/${matchId}/live`, stranger);
    expect(r.statusCode).toBe(403);
    expect(await statusOf(matchId)).toBe("READY");
    await app.close();
  });

  it("a player in it can, and so can staff", async () => {
    const app = await makeApp();
    const first = await newMatch("READY");
    const r1 = await post(
      app,
      `/tournaments/${first.tournamentId}/matches/${first.matchId}/live`,
      first.a,
    );
    expect(r1.statusCode).toBe(200);
    expect(await statusOf(first.matchId)).toBe("LIVE");

    const second = await newMatch("READY");
    const staff = await newUser("staff", "STAFF");
    const r2 = await post(
      app,
      `/tournaments/${second.tournamentId}/matches/${second.matchId}/live`,
      staff,
    );
    expect(r2.statusCode).toBe(200);
    expect(await statusOf(second.matchId)).toBe("LIVE");
    await app.close();
  });
});
