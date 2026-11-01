import { describe, it, expect, beforeAll, afterAll } from "vitest";
import waitlistRoutes from "../../src/routes/waitlist";
import { prisma } from "../../src/lib/prisma";
import { buildTestApp, testAuthFromHeader, testToken } from "../helpers/buildTestApp";

// The waitlist behind the account cap (routes/waitlist.ts): anyone turned away
// can leave an address once; only GOD reads the list.
const users: Record<string, string> = {};
const stamp = Date.now().toString(36);
const EMAIL = `itest-wait-${stamp}@example.com`;
let app: any;

beforeAll(async () => {
  for (const [k, role] of [
    ["god", "GOD"],
    ["user", "USER"],
  ]) {
    const u = await prisma.user.create({
      data: { usernameKey: `itest_wl_${k}_${stamp}`, name: k, globalRole: role as any },
      select: { id: true },
    });
    users[k] = u.id;
  }
  app = await buildTestApp((a: any) =>
    waitlistRoutes(a, {
      authFromHeader: testAuthFromHeader,
      getGlobalRole: async (id: string) =>
        (await prisma.user.findUnique({ where: { id }, select: { globalRole: true } }))?.globalRole,
    }),
  );
});

afterAll(async () => {
  await app?.close();
  await prisma.waitlistEntry.deleteMany({ where: { email: EMAIL } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } }).catch(() => {});
  await prisma.$disconnect();
});

describe("the waitlist", () => {
  it("keeps one address once, however often it's left", async () => {
    for (const email of [EMAIL, `  ${EMAIL.toUpperCase()} `]) {
      const r = await app.inject({ method: "POST", url: "/waitlist", payload: { email } });
      expect(r.statusCode).toBe(200);
    }
    expect(await prisma.waitlistEntry.count({ where: { email: EMAIL } })).toBe(1);
  });

  it("turns away what isn't an address", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/waitlist",
      payload: { email: "not an email" },
    });
    expect(r.statusCode).toBe(400);
  });

  it("only GOD reads the list", async () => {
    const as = (who: string) => ({ authorization: `Bearer ${testToken(users[who])}` });
    expect((await app.inject({ method: "GET", url: "/staff/waitlist" })).statusCode).toBe(401);
    expect(
      (await app.inject({ method: "GET", url: "/staff/waitlist", headers: as("user") })).statusCode,
    ).toBe(403);
    const r = await app.inject({ method: "GET", url: "/staff/waitlist", headers: as("god") });
    expect(r.statusCode).toBe(200);
    expect(r.json().entries.map((e: any) => e.email)).toContain(EMAIL);
  });
});
