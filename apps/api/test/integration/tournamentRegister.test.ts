import { describe, it, expect, afterEach, afterAll } from "vitest";
import tournamentsRoutes from "../../src/routes/tournaments";
import { buildTestApp, testToken, testAuthFromHeader } from "../helpers/buildTestApp";
import { prisma } from "../../src/lib/prisma";

// The register/unregister routes only use authFromHeader; the other ~19 opts are
// never hit by these handlers, so a noop Proxy satisfies the module signature.
async function makeApp() {
  const opts: any = new Proxy(
    { authFromHeader: testAuthFromHeader },
    { get: (t: any, p: string) => (p in t ? t[p] : () => {}) },
  );
  return buildTestApp((app: any) => tournamentsRoutes(app, opts));
}

const tournaments: string[] = [];
const users: string[] = [];

async function newUser(tag: string) {
  const stamp = Date.now() + "_" + Math.floor(performance.now());
  const u = await prisma.user.create({
    data: { usernameKey: "itest_treg_" + tag + "_" + stamp, name: tag },
    select: { id: true },
  });
  users.push(u.id);
  return u.id;
}
async function newTournament(o?: { status?: string; maxEntries?: number }) {
  const stamp = Date.now() + "_" + Math.floor(performance.now());
  const now = new Date();
  const creator = await newUser("creator");
  const t = await prisma.tournament.create({
    data: {
      title: "ITest Reg " + stamp,
      createdById: creator,
      format: "LEADERBOARD",
      status: (o?.status as any) ?? "REGISTRATION",
      maxEntries: o?.maxEntries ?? 100,
      scoringRule: { type: "manual" },
      registrationOpensAt: now,
      startsAt: now,
      endsAt: now,
    },
    select: { id: true },
  });
  tournaments.push(t.id);
  return t.id;
}

describe("tournament register/unregister", () => {
  afterEach(async () => {
    if (tournaments.length)
      await prisma.tournament.deleteMany({ where: { id: { in: tournaments } } }).catch(() => {});
    if (users.length)
      await prisma.user.deleteMany({ where: { id: { in: users } } }).catch(() => {});
    tournaments.length = 0;
    users.length = 0;
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("registers an entrant, is idempotent on re-register, and unregisters", async () => {
    const app = await makeApp();
    const tid = await newTournament();
    const uid = await newUser("entrant");
    const auth = { authorization: `Bearer ${testToken(uid)}` };

    const r1 = await app.inject({
      method: "POST",
      url: `/tournaments/${tid}/register`,
      headers: auth,
    });
    expect(r1.statusCode).toBe(200);
    expect(r1.json().ok).toBe(true);
    expect(await prisma.tournamentEntry.count({ where: { tournamentId: tid, userId: uid } })).toBe(
      1,
    );

    // re-register => idempotent, still exactly one entry
    const r2 = await app.inject({
      method: "POST",
      url: `/tournaments/${tid}/register`,
      headers: auth,
    });
    expect(r2.statusCode).toBe(200);
    expect(r2.json().error).toBe("already_registered");
    expect(await prisma.tournamentEntry.count({ where: { tournamentId: tid, userId: uid } })).toBe(
      1,
    );

    const del = await app.inject({
      method: "DELETE",
      url: `/tournaments/${tid}/register`,
      headers: auth,
    });
    expect(del.statusCode).toBe(200);
    expect(await prisma.tournamentEntry.count({ where: { tournamentId: tid, userId: uid } })).toBe(
      0,
    );
    await app.close();
  });

  it("401 unauthenticated, 404 unknown tournament", async () => {
    const app = await makeApp();
    const tid = await newTournament();
    expect(
      (await app.inject({ method: "POST", url: `/tournaments/${tid}/register` })).statusCode,
    ).toBe(401);
    const uid = await newUser("e404");
    const r = await app.inject({
      method: "POST",
      url: "/tournaments/does_not_exist/register",
      headers: { authorization: `Bearer ${testToken(uid)}` },
    });
    expect(r.statusCode).toBe(404);
    await app.close();
  });

  it("rejects a closed tournament (400) and a full one (400)", async () => {
    const app = await makeApp();
    const closed = await newTournament({ status: "COMPLETED" });
    const u1 = await newUser("closed");
    const rc = await app.inject({
      method: "POST",
      url: `/tournaments/${closed}/register`,
      headers: { authorization: `Bearer ${testToken(u1)}` },
    });
    expect(rc.statusCode).toBe(400);
    expect(rc.json().error).toBe("registration_closed");

    const full = await newTournament({ maxEntries: 1 });
    const a = await newUser("fa");
    const b = await newUser("fb");
    const ra = await app.inject({
      method: "POST",
      url: `/tournaments/${full}/register`,
      headers: { authorization: `Bearer ${testToken(a)}` },
    });
    expect(ra.statusCode).toBe(200);
    const rb = await app.inject({
      method: "POST",
      url: `/tournaments/${full}/register`,
      headers: { authorization: `Bearer ${testToken(b)}` },
    });
    expect(rb.statusCode).toBe(400);
    expect(rb.json().error).toBe("tournament_full");
    await app.close();
  });
});
