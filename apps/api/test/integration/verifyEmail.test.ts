import { describe, it, expect, afterAll } from "vitest";
import authRoutes from "../../src/routes/auth";
import { buildTestApp, testAuthFromHeader, testToken } from "../helpers/buildTestApp";
import { prisma } from "../../src/lib/prisma";

// Red team 2026-11-01, finding 23: the email verification link signed in
// whoever opened it. That made it a 24-hour login link, and someone who
// registered with your address got you signed in to their account when you
// clicked. Now the link only proves the address.
delete process.env.TURNSTILE_SECRET;
const JWT_SECRET = "weered-integration-test-secret";

const makeApp = () =>
  buildTestApp((app: any) =>
    authRoutes(app, {
      authFromHeader: testAuthFromHeader,
      JWT_SECRET,
      isNameReserved: async () => false,
      getSiteConfig: async () => null,
      seedWelcomeDM: async () => {},
    } as any),
  );

const stamp = Date.now().toString(36);
const names: string[] = [];

async function registerWithEmail(tag: string) {
  const app = await makeApp();
  const username = `itest_ve_${tag}_${stamp}`;
  names.push(username);
  const r = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { username, password: "secret123", email: `${username}@example.com` },
  });
  expect(r.statusCode).toBe(200);
  const la = await prisma.localAuth.findUnique({ where: { username } });
  expect(la?.verifyToken).toBeTruthy();
  return { app, userId: la!.userId, token: la!.verifyToken! };
}

afterAll(async () => {
  await prisma.localAuth.deleteMany({ where: { username: { in: names } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { usernameKey: { in: names } } }).catch(() => {});
  await prisma.$disconnect();
});

describe("POST /auth/verify-email", () => {
  it("confirms the address but signs in nobody who opens the link", async () => {
    const { app, userId, token } = await registerWithEmail("open");
    const r = await app.inject({ method: "POST", url: "/auth/verify-email", payload: { token } });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ ok: true, signedIn: false });
    expect(r.headers["set-cookie"]).toBeUndefined();
    const la = await prisma.localAuth.findUnique({ where: { userId } });
    expect(la?.emailVerified).toBe(true);
    expect(la?.verifyToken).toBeNull();
  });

  it("keeps the account's own signed-in browser signed in", async () => {
    const { app, userId, token } = await registerWithEmail("mine");
    const r = await app.inject({
      method: "POST",
      url: "/auth/verify-email",
      payload: { token },
      headers: { authorization: `Bearer ${testToken(userId)}` },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(body.signedIn).toBe(true);
    expect(body.user?.id).toBe(userId);
    expect(body.token).toBeUndefined();
    expect(r.headers["set-cookie"]).toBeUndefined();
  });

  it("doesn't hand someone else's account to a different signed-in person", async () => {
    const { app, token } = await registerWithEmail("theirs");
    const other = await registerWithEmail("other");
    const r = await app.inject({
      method: "POST",
      url: "/auth/verify-email",
      payload: { token },
      headers: { authorization: `Bearer ${testToken(other.userId)}` },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ ok: true, signedIn: false });
    expect(r.headers["set-cookie"]).toBeUndefined();
  });
});
