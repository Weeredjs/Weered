import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../src/lib/prisma";
import { buildTestApp } from "../helpers/buildTestApp";

// Sign in with Discord (routes/discordAuth.ts). Discord itself is stubbed: the
// token exchange and /users/@me answer from \`me\` below.
process.env.DISCORD_CLIENT_ID = "itest-client";
process.env.DISCORD_CLIENT_SECRET = "itest-secret";
delete process.env.TURNSTILE_SECRET;
import discordAuthRoutes from "../../src/routes/discordAuth";

const JWT_SECRET = "weered-integration-test-secret";
const stamp = Date.now().toString(36);
let me: any = null;
const made = new Set<string>();
let app: any;

const fakeDiscord = async (url: any) => {
  const u = String(url);
  if (u.includes("/oauth2/token")) return new Response(JSON.stringify({ access_token: "x" }));
  if (u.includes("/users/@me")) return new Response(JSON.stringify(me));
  return new Response("{}", { status: 404 });
};

beforeAll(async () => {
  app = await buildTestApp((a: any) =>
    discordAuthRoutes(a, {
      JWT_SECRET,
      getSiteConfig: async () => null,
      seedWelcomeDM: async () => {},
      fetchImpl: fakeDiscord as any,
    }),
  );
});

afterAll(async () => {
  await app?.close();
  const ids = [...made];
  await prisma.localAuth.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
  await prisma.$disconnect();
});

/** Out to Discord and back, in one browser (or, with \`cookie: false\`, another). */
async function signIn(who: any, opts: { cookie?: boolean } = {}) {
  me = who;
  const out = await app.inject({ method: "GET", url: "/auth/discord" });
  expect(out.statusCode).toBe(302);
  const state = new URL(String(out.headers.location)).searchParams.get("state") || "";
  const nonce = /weered_oauth=([^;]+)/.exec(String(out.headers["set-cookie"]))?.[1] || "";
  const back = await app.inject({
    method: "GET",
    url: `/auth/discord/callback?code=c&state=${encodeURIComponent(state)}`,
    headers: opts.cookie === false ? {} : { cookie: `weered_oauth=${nonce}` },
  });
  expect(back.statusCode).toBe(302);
  const to = new URL(String(back.headers.location));
  const user = JSON.parse(to.searchParams.get("user") || "null");
  if (user?.id) made.add(user.id);
  return { to, user };
}

describe("sign in with Discord", () => {
  it("says it's on", async () => {
    const r = await app.inject({ method: "GET", url: "/auth/providers" });
    expect(r.json().discord).toBe(true);
  });

  it("makes a new account and sends it to pick a username", async () => {
    const id = `1${stamp.replace(/\D/g, "").padEnd(8, "7")}1`;
    const { to, user } = await signIn({
      id,
      username: "raider",
      global_name: "Raider",
      email: `d1-${stamp}@example.com`,
      verified: true,
    });
    expect(to.pathname).toBe("/onboarding");
    const row = await prisma.user.findUnique({ where: { id: user.id } });
    expect(row?.discordId).toBe(id);
    expect(row?.email).toBe(`d1-${stamp}@example.com`);
    // The second time is the same account.
    const again = await signIn({
      id,
      username: "raider",
      email: `d1-${stamp}@example.com`,
      verified: true,
    });
    expect(again.user.id).toBe(user.id);
    expect(again.to.pathname).toBe("/auth/discord/finish");
  });

  it("only finishes in the browser that started it", async () => {
    const { to } = await signIn(
      { id: `2${stamp.replace(/\D/g, "").padEnd(8, "7")}2`, username: "x", verified: false },
      { cookie: false },
    );
    expect(to.pathname).toBe("/login");
    expect(to.searchParams.get("error")).toBe("oauth_state");
  });

  it("never links on an address Discord hasn't verified", async () => {
    const email = `held-${stamp}@example.com`;
    const holder = await prisma.user.create({
      data: { name: "held", usernameKey: `itest_dh_${stamp}`, email },
    });
    made.add(holder.id);
    const { user } = await signIn({
      id: `3${stamp.replace(/\D/g, "").padEnd(8, "7")}3`,
      username: "sq",
      email,
      verified: false,
    });
    expect(user.id).not.toBe(holder.id);
    expect((await prisma.user.findUnique({ where: { id: user.id } }))?.email).toBeNull();
    expect((await prisma.user.findUnique({ where: { id: holder.id } }))?.discordId).toBeNull();
  });
});
