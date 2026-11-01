import { describe, it, expect, beforeAll, afterAll } from "vitest";
import staffRoutes from "../../src/routes/staff";
import staffContentRoutes from "../../src/routes/staffContent";
import { prisma } from "../../src/lib/prisma";
import { canAccessStaff, canAssignRoles } from "../../src/lib/lobbyAuth";
import { buildTestApp, testAuthFromHeader, testToken } from "../helpers/buildTestApp";

// SUPPORT moderates; it doesn't curate, broadcast or read emails (James
// 2026-11-01: "only mod tools through the entire platform... just help and support").
const stamp = Date.now().toString(36);
const id: Record<string, string> = {};
let app: any;

beforeAll(async () => {
  for (const [k, role] of [
    ["support", "SUPPORT"],
    ["admin", "ADMIN"],
  ] as const) {
    const u = await prisma.user.create({
      data: {
        usernameKey: `itest_scope_${k}_${stamp}`,
        name: k,
        globalRole: role,
        email: `scope-${k}-${stamp}@example.com`,
      },
      select: { id: true },
    });
    id[k] = u.id;
  }
  const target: any = {
    authFromHeader: testAuthFromHeader,
    getGlobalRole: async (uid: string) =>
      (await prisma.user.findUnique({ where: { id: uid }, select: { globalRole: true } }))
        ?.globalRole ?? "USER",
    canAccessStaff,
    canAssignRoles,
    rooms: new Map(),
    send: () => {},
  };
  const opts = new Proxy(target, {
    get: (t: any, p: string) => (p in t ? t[p] : () => Promise.resolve()),
  });
  app = await buildTestApp(async (a: any) => {
    await staffRoutes(a, opts);
    await staffContentRoutes(a, opts);
  });
});

afterAll(async () => {
  await app?.close();
  await prisma.user.deleteMany({ where: { id: { in: Object.values(id) } } }).catch(() => {});
  await prisma.$disconnect();
});

const as = (who: string) => ({ authorization: `Bearer ${testToken(id[who])}` });
const get = (who: string, url: string) => app.inject({ method: "GET", url, headers: as(who) });

describe("what support can do", () => {
  it("keeps the moderation queues", async () => {
    expect((await get("support", "/staff/reports")).statusCode).toBe(200);
    expect((await get("support", "/staff/mods")).statusCode).toBe(200);
  });

  it("sees users but not their emails", async () => {
    const r = await get("support", `/staff/users?q=itest_scope_admin_${stamp}`);
    expect(r.statusCode).toBe(200);
    expect(r.json().users[0]?.email).toBeUndefined();
    const s = await get("admin", `/staff/users?q=itest_scope_admin_${stamp}`);
    expect(s.json().users[0]?.email).toBe(`scope-admin-${stamp}@example.com`);
  });

  it("doesn't curate or broadcast", async () => {
    expect((await get("support", "/staff/featured")).statusCode).toBe(403);
    expect((await get("support", "/staff/reserved")).statusCode).toBe(403);
    expect((await get("support", "/staff/announcements")).statusCode).toBe(403);
    expect((await get("admin", "/staff/featured")).statusCode).toBe(200);
  });
});
