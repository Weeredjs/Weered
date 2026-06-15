import { describe, it, expect, afterEach, afterAll } from "vitest";
import jwt from "jsonwebtoken";
import crewsRoutes from "../../src/routes/crews";
import { buildTestApp, testToken } from "../helpers/buildTestApp";
import { prisma } from "../../src/lib/prisma";

const SECRET = "weered-integration-test-secret";
const verifyToken = (token: string) => {
  try {
    const d: any = jwt.verify(token, SECRET);
    return d?.sub ? { id: String(d.sub), name: String(d.name || d.sub) } : null;
  } catch {
    return null;
  }
};

async function makeApp() {
  return buildTestApp((app: any) =>
    crewsRoutes(app, {
      authFromHeader: (h?: string) => verifyToken(String(h || "").replace(/^Bearer\s+/i, "")),
      verifyToken,
      awardNotoriety: async () => null,
      createNotification: async () => {},
      rooms: new Map(),
      fetchReactionsForTargets: async () => ({}),
      getNotorietyRank: () => ({ title: "Unknown" }),
    } as any),
  );
}

const crews: string[] = [];
const users: string[] = [];
async function newUser(tag: string) {
  const stamp = Date.now() + "_" + Math.floor(performance.now());
  const u = await prisma.user.create({
    data: { usernameKey: "itest_crew_" + tag + "_" + stamp, name: tag },
    select: { id: true },
  });
  users.push(u.id);
  return u.id;
}

describe("crews - create / invite / join-request", () => {
  afterEach(async () => {
    for (const c of crews) {
      await (prisma as any).crewJoinRequest.deleteMany({ where: { crewId: c } }).catch(() => {});
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

  it("creates a crew with the creator as LEADER", async () => {
    const app = await makeApp();
    const owner = await newUser("owner");
    const r = await app.inject({
      method: "POST",
      url: "/crews",
      headers: { authorization: `Bearer ${testToken(owner)}` },
      payload: { name: "Test Crew", tag: "TST" },
    });
    expect(r.statusCode).toBe(200);
    const crew = r.json().crew;
    crews.push(crew.id);
    const lead = await (prisma as any).crewMember.findUnique({
      where: { crewId_userId: { crewId: crew.id, userId: owner } },
    });
    expect(lead.role).toBe("LEADER");
    await app.close();
  });

  it("rejects no-auth (401) and empty name (400)", async () => {
    const app = await makeApp();
    const owner = await newUser("noauth");
    expect(
      (await app.inject({ method: "POST", url: "/crews", payload: { name: "X" } })).statusCode,
    ).toBe(401);
    const r = await app.inject({
      method: "POST",
      url: "/crews",
      headers: { authorization: `Bearer ${testToken(owner)}` },
      payload: { name: "" },
    });
    expect(r.statusCode).toBe(400);
    await app.close();
  });

  it("leader can invite; a plain member cannot (403)", async () => {
    const app = await makeApp();
    const owner = await newUser("ldr");
    const target = await newUser("tgt");
    const created = await app.inject({
      method: "POST",
      url: "/crews",
      headers: { authorization: `Bearer ${testToken(owner)}` },
      payload: { name: "Inv Crew" },
    });
    const crewId = created.json().crew.id;
    crews.push(crewId);

    const inv = await app.inject({
      method: "POST",
      url: `/crews/${crewId}/invite/${target}`,
      headers: { authorization: `Bearer ${testToken(owner)}` },
    });
    expect(inv.statusCode).toBe(200);
    const m = await (prisma as any).crewMember.findUnique({
      where: { crewId_userId: { crewId, userId: target } },
    });
    expect(m.role).toBe("MEMBER");

    // target (a MEMBER) tries to invite someone else -> 403
    const other = await newUser("oth");
    const bad = await app.inject({
      method: "POST",
      url: `/crews/${crewId}/invite/${other}`,
      headers: { authorization: `Bearer ${testToken(target)}` },
    });
    expect(bad.statusCode).toBe(403);
    await app.close();
  });

  it("join-request: 404 unknown crew, 409 when already a member", async () => {
    const app = await makeApp();
    const owner = await newUser("jrldr");
    const created = await app.inject({
      method: "POST",
      url: "/crews",
      headers: { authorization: `Bearer ${testToken(owner)}` },
      payload: { name: "JR Crew" },
    });
    const crewId = created.json().crew.id;
    crews.push(crewId);

    const unknown = await app.inject({
      method: "POST",
      url: "/crews/does_not_exist/requests",
      headers: { authorization: `Bearer ${testToken(owner)}` },
      payload: {},
    });
    expect(unknown.statusCode).toBe(404);
    // owner is already a member -> 409
    const already = await app.inject({
      method: "POST",
      url: `/crews/${crewId}/requests`,
      headers: { authorization: `Bearer ${testToken(owner)}` },
      payload: {},
    });
    expect(already.statusCode).toBe(409);
    await app.close();
  });
});
