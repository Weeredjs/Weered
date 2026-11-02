import { describe, it, expect, afterAll, afterEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import authRoutes from "../../src/routes/auth";
import { buildTestApp, testAuthFromHeader } from "../helpers/buildTestApp";
import { prisma } from "../../src/lib/prisma";

// Red team 2026-11-01, finding 24: whether a name or address has an account
// showed in how fast the answer came, not just in what it said.
delete process.env.TURNSTILE_SECRET;

const makeApp = () =>
  buildTestApp((app: any) =>
    authRoutes(app, {
      authFromHeader: testAuthFromHeader,
      JWT_SECRET: "weered-integration-test-secret",
      isNameReserved: async () => false,
      getSiteConfig: async () => null,
      seedWelcomeDM: async () => {},
    } as any),
  );

const stamp = Date.now().toString(36);
const names: string[] = [];

afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await prisma.localAuth.deleteMany({ where: { username: { in: names } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { usernameKey: { in: names } } }).catch(() => {});
  await prisma.$disconnect();
});

describe("account enumeration", () => {
  it("a name with no account still pays for a password check", async () => {
    const app = await makeApp();
    const compare = vi.spyOn(bcrypt, "compare");
    const r = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: `itest_noone_${stamp}`, password: "whatever123" },
    });
    expect(r.statusCode).toBe(401);
    expect(r.json().error).toBe("Invalid credentials");
    expect(compare).toHaveBeenCalledTimes(1);
  });

  it("a reset request answers without waiting on the account's write", async () => {
    const app = await makeApp();
    const username = `itest_reset_${stamp}`;
    names.push(username);
    const reg = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { username, password: "secret123", email: `${username}@example.com` },
    });
    expect(reg.statusCode).toBe(200);
    // A write that never finishes: the old route waited on it before answering.
    vi.spyOn(prisma.localAuth, "update").mockReturnValue(new Promise(() => {}) as any);
    const r = await Promise.race([
      app.inject({ method: "POST", url: "/auth/forgot-password", payload: { username } }),
      new Promise<null>((res) => setTimeout(() => res(null), 3000)),
    ]);
    expect(r).not.toBeNull();
    expect(r!.statusCode).toBe(200);
    expect(r!.json()).toEqual({ ok: true });
  });
});
