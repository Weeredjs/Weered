import { describe, it, expect, afterEach, afterAll } from "vitest";
import authRoutes from "../../src/routes/auth";
import { buildTestApp, testAuthFromHeader } from "../helpers/buildTestApp";
import { prisma } from "../../src/lib/prisma";

// Must match buildTestApp's TEST_JWT_SECRET so issued tokens verify.
const JWT_SECRET = "weered-integration-test-secret";

// Captcha is config-gated; with no TURNSTILE_SECRET verifyCaptcha is a no-op.
// Clear it so these tests are deterministic regardless of a loaded .env.
delete process.env.TURNSTILE_SECRET;

// Exercises the REAL authRoutes (register + login) against the test DB: bcrypt
// hashing, username/email dedup, reserved-name + registration-gate, and the
// login credential check. No TURNSTILE_SECRET in test => captcha is a no-op.
async function makeApp(o?: { reserved?: boolean; registrationOpen?: string | null }) {
  return buildTestApp((app: any) =>
    authRoutes(app, {
      authFromHeader: testAuthFromHeader,
      JWT_SECRET,
      isNameReserved: async () => Boolean(o?.reserved),
      getSiteConfig: async (k: string) =>
        k === "registrationOpen" ? (o?.registrationOpen ?? null) : null,
      seedWelcomeDM: async () => {},
    } as any),
  );
}

const usernames: string[] = [];
function uname(tag: string) {
  const u = ("itest_" + tag + "_" + Date.now() + Math.floor(performance.now())).toLowerCase();
  usernames.push(u);
  return u;
}

describe("authRoutes - register + login", () => {
  afterEach(async () => {
    if (usernames.length) {
      await prisma.localAuth.deleteMany({ where: { username: { in: usernames } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { usernameKey: { in: usernames } } }).catch(() => {});
      usernames.length = 0;
    }
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("registers a new account (bcrypt hash stored, token returned)", async () => {
    const app = await makeApp();
    const u = uname("reg");
    const r = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { username: u, password: "secret123" },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(body.token).toBeTruthy();
    expect(body.user?.id).toBeTruthy();
    const la = await prisma.localAuth.findUnique({ where: { username: u } });
    expect(la?.passwordHash?.startsWith("$2")).toBe(true); // bcrypt, never plaintext
    await app.close();
  });

  it("rejects a duplicate username (409) and a short password (400)", async () => {
    const app = await makeApp();
    const u = uname("dup");
    const first = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { username: u, password: "secret123" },
    });
    expect(first.statusCode).toBe(200);
    const dup = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { username: u, password: "secret123" },
    });
    expect(dup.statusCode).toBe(409);
    const short = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { username: uname("short"), password: "123" },
    });
    expect(short.statusCode).toBe(400);
    await app.close();
  });

  it("blocks reserved usernames (403) and closed registration (403)", async () => {
    const reservedApp = await makeApp({ reserved: true });
    const r1 = await reservedApp.inject({
      method: "POST",
      url: "/auth/register",
      payload: { username: uname("resv"), password: "secret123" },
    });
    expect(r1.statusCode).toBe(403);
    await reservedApp.close();

    const closedApp = await makeApp({ registrationOpen: "false" });
    const r2 = await closedApp.inject({
      method: "POST",
      url: "/auth/register",
      payload: { username: uname("closed"), password: "secret123" },
    });
    expect(r2.statusCode).toBe(403);
    await closedApp.close();
  });

  it("login: correct password 200, wrong password 401, unknown user 401", async () => {
    const app = await makeApp();
    const u = uname("login");
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { username: u, password: "secret123" },
    });

    const good = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: u, password: "secret123" },
    });
    expect(good.statusCode).toBe(200);
    expect(good.json().token).toBeTruthy();

    const bad = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: u, password: "wrongpass" },
    });
    expect(bad.statusCode).toBe(401);

    const ghost = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: uname("ghost"), password: "secret123" },
    });
    expect(ghost.statusCode).toBe(401);
    await app.close();
  });
});
