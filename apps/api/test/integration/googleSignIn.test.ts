import { describe, it, expect, vi, afterAll } from "vitest";
import authRoutes from "../../src/routes/auth";
import { buildTestApp, testAuthFromHeader } from "../helpers/buildTestApp";
import { prisma } from "../../src/lib/prisma";
import { issuedBeforeCutoff } from "../../src/lib/sessionCutoff";

// Google sign-in against the REAL callback (red team 2026-11-01, finding 1):
// an email match must never hand an account to whoever squatted the address.
// Google itself is stubbed: each test sets the ID token's payload.
const g = vi.hoisted(() => ({ payload: null as any }));
vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    generateAuthUrl(o: any) {
      return `https://accounts.google.com/o/oauth2/auth?state=${encodeURIComponent(o.state)}`;
    }
    async getToken() {
      return { tokens: { id_token: "stub" } };
    }
    setCredentials() {}
    async verifyIdToken() {
      return { getPayload: () => g.payload };
    }
  },
}));
delete process.env.TURNSTILE_SECRET;

const JWT_SECRET = "weered-integration-test-secret";
const stamp = Date.now().toString(36);
const made = new Set<string>();
let n = 0;
const fresh = (tag: string) => `itest_g${tag}_${stamp}_${++n}`;

async function makeApp() {
  return buildTestApp((app: any) =>
    authRoutes(app, {
      authFromHeader: testAuthFromHeader,
      JWT_SECRET,
      isNameReserved: async () => false,
      getSiteConfig: async () => null,
      seedWelcomeDM: async () => {},
    } as any),
  );
}

async function register(app: any, email: string) {
  const username = fresh("u");
  const r = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { username, password: "squatter-pass-1", email },
  });
  expect(r.statusCode).toBe(200);
  const la = await prisma.localAuth.findUnique({ where: { username } });
  made.add(la!.userId);
  return { username, userId: la!.userId };
}

async function googleSignIn(app: any, payload: any, opts: { cookie?: boolean } = {}) {
  g.payload = payload;
  // Out to Google and back in the same browser: the state's nonce and cookie.
  const out = await app.inject({ method: "GET", url: "/auth/google" });
  const state = new URL(String(out.headers.location)).searchParams.get("state") || "";
  const nonce = /weered_oauth_g=([^;]+)/.exec(String(out.headers["set-cookie"]))?.[1] || "";
  const r = await app.inject({
    method: "GET",
    url: `/auth/google/callback?code=stub&state=${encodeURIComponent(state)}`,
    headers: opts.cookie === false ? {} : { cookie: `weered_oauth_g=${nonce}` },
  });
  if (opts.cookie === false) return String(r.headers.location);
  expect(r.statusCode).toBe(302);
  const url = new URL(String(r.headers.location));
  expect(url.searchParams.get("error")).toBeNull();
  const user = JSON.parse(url.searchParams.get("user") || "null");
  if (user?.id) made.add(user.id);
  return user?.id as string | undefined;
}

const login = (app: any, username: string) =>
  app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { username, password: "squatter-pass-1" },
  });

afterAll(async () => {
  const ids = [...made];
  await prisma.localAuth.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
  await prisma.$disconnect();
});

describe("Google sign-in and an existing address", () => {
  it("locks out a password set on an address nobody verified", async () => {
    const app = await makeApp();
    const email = `${fresh("victim")}@example.com`;
    const squat = await register(app, email);
    expect((await login(app, squat.username)).statusCode).toBe(200);

    const id = await googleSignIn(app, {
      sub: `1g${stamp}`,
      email,
      email_verified: true,
    });
    expect(id).toBe(squat.userId);
    // The squatter's password no longer opens the account...
    expect((await login(app, squat.username)).statusCode).not.toBe(200);
    // ...and every session issued before the owner arrived is cut off.
    const row = await prisma.user.findUnique({ where: { id: squat.userId } });
    expect(row?.tokensValidAfter).toBeTruthy();
    expect(issuedBeforeCutoff(Math.floor(Date.now() / 1000) - 5, row!.tokensValidAfter)).toBe(true);
    await app.close();
  });

  it("never links on an address Google hasn't verified", async () => {
    const app = await makeApp();
    const email = `${fresh("unv")}@example.com`;
    const holder = await register(app, email);
    const id = await googleSignIn(app, { sub: `2g${stamp}`, email, email_verified: false });
    expect(id).toBeTruthy();
    expect(id).not.toBe(holder.userId);
    const made2 = await prisma.user.findUnique({ where: { id: id! } });
    expect(made2?.email).toBeNull();
    expect((await prisma.user.findUnique({ where: { id: holder.userId } }))?.googleId).toBeNull();
    expect((await login(app, holder.username)).statusCode).toBe(200);
    await app.close();
  });

  it("never takes over another Google identity's account", async () => {
    const app = await makeApp();
    const email = `${fresh("other")}@example.com`;
    const other = await prisma.user.create({
      data: { name: "other", usernameKey: fresh("o"), email, googleId: `xg${stamp}` },
    });
    made.add(other.id);
    const id = await googleSignIn(app, { sub: `3g${stamp}`, email, email_verified: true });
    expect(id).toBeTruthy();
    expect(id).not.toBe(other.id);
    expect((await prisma.user.findUnique({ where: { id: other.id } }))?.googleId).toBe(
      `xg${stamp}`,
    );
    await app.close();
  });

  it("links a verified password account and leaves its password alone", async () => {
    const app = await makeApp();
    const email = `${fresh("ok")}@example.com`;
    const owner = await register(app, email);
    await prisma.localAuth.update({
      where: { username: owner.username },
      data: { emailVerified: true },
    });
    const id = await googleSignIn(app, { sub: `4g${stamp}`, email, email_verified: true });
    expect(id).toBe(owner.userId);
    expect((await login(app, owner.username)).statusCode).toBe(200);
    expect(
      (await prisma.user.findUnique({ where: { id: owner.userId } }))?.tokensValidAfter,
    ).toBeNull();
    await app.close();
  });

  it("refuses a sign-up on an address a Google account holds with a 409, not a 500", async () => {
    const app = await makeApp();
    const email = `${fresh("held")}@example.com`;
    const held = await prisma.user.create({
      data: { name: "held", usernameKey: fresh("h"), email, googleId: `5g${stamp}` },
    });
    made.add(held.id);
    const r = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { username: fresh("u"), password: "squatter-pass-1", email },
    });
    expect(r.statusCode).toBe(409);
    await app.close();
  });

  it("only finishes in the browser that started it", async () => {
    const app = await makeApp();
    const to = await googleSignIn(
      app,
      { sub: `7g${stamp}`, email: null, email_verified: false },
      { cookie: false },
    );
    expect(String(to)).toContain("error=oauth_state");
    await app.close();
  });

  it("still works for the plain cases", async () => {
    const app = await makeApp();
    const email = `${fresh("new")}@example.com`;
    const first = await googleSignIn(app, { sub: `6g${stamp}`, email, email_verified: true });
    expect((await prisma.user.findUnique({ where: { id: first! } }))?.email).toBe(email);
    const again = await googleSignIn(app, { sub: `6g${stamp}`, email, email_verified: true });
    expect(again).toBe(first);
    await app.close();
  });
});
