import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import staffOpsRoutes from "../../src/routes/staffOps";
import { prisma } from "../../src/lib/prisma";
import { buildTestApp, testToken } from "../helpers/buildTestApp";

// Permission-gating coverage (audit P0: "0 tests for permission/isStaff/tier
// gating"). Drives the real staffOpsRoutes via inject; getGlobalRole/canAccessStaff
// faithfully mirror index.ts (real DB role lookup + the exact staff role set), so
// the route's authorization branch is exercised end to end against the test DB.
const getGlobalRole = async (userId: string) =>
  (await prisma.user.findUnique({ where: { id: userId }, select: { globalRole: true } }))?.globalRole ?? "USER";
const canAccessStaff = (role: any) => ["SUPPORT", "STAFF", "ADMIN", "GOD"].includes(String(role));

describe("staff route authorization gate (/staff/outreach)", () => {
  let app: any;
  const created: string[] = [];

  beforeEach(async () => {
    app = await buildTestApp((a, { authFromHeader }) =>
      staffOpsRoutes(a, { authFromHeader, getGlobalRole, canAccessStaff, rooms: new Map() } as any));
  });
  afterEach(async () => {
    try { await app?.close(); } catch {}
    if (created.length) { try { await prisma.user.deleteMany({ where: { id: { in: created } } }); } catch {} created.length = 0; }
  });
  afterAll(async () => { await prisma.$disconnect(); });

  async function mkUser(role: string): Promise<string> {
    const stamp = Date.now() + "_" + Math.floor(performance.now());
    const u = await prisma.user.create({
      data: { usernameKey: "itest_perm_" + stamp, name: "perm", globalRole: role as any },
      select: { id: true },
    });
    created.push(u.id);
    return u.id;
  }

  it("403s a non-staff (USER) caller", async () => {
    const id = await mkUser("USER");
    const res = await app.inject({ method: "GET", url: "/staff/outreach", headers: { authorization: `Bearer ${testToken(id)}` } });
    expect(res.statusCode).toBe(403);
    expect(res.json()?.error).toBe("forbidden");
  });

  it("allows an elevated (GOD) caller through the gate", async () => {
    const id = await mkUser("GOD");
    const res = await app.inject({ method: "GET", url: "/staff/outreach", headers: { authorization: `Bearer ${testToken(id)}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json()?.ok).toBe(true);
  });

  it("401s an unauthenticated caller", async () => {
    const res = await app.inject({ method: "GET", url: "/staff/outreach" });
    expect(res.statusCode).toBe(401);
  });
});
