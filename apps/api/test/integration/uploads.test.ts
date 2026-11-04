import { describe, it, expect, afterAll } from "vitest";
import sharp from "sharp";
import uploadsRoutes from "../../src/routes/uploads";
import { buildTestApp, testToken, testAuthFromHeader } from "../helpers/buildTestApp";
import { prisma } from "../../src/lib/prisma";
import { sanitizeUiPrefs } from "../../src/lib/uiPrefs";

const created: string[] = [];

async function newUser(tag: string, extra: any = {}): Promise<string> {
  const stamp =
    Date.now() + "_" + Math.floor(performance.now()) + "_" + Math.floor(Math.random() * 1e6);
  const u = await prisma.user.create({
    data: { usernameKey: "itest_up_" + tag + "_" + stamp, name: tag, ...extra },
    select: { id: true },
  });
  created.push(u.id);
  return u.id;
}

async function pngDataUrl(): Promise<string> {
  const buf = await sharp({
    create: { width: 48, height: 48, channels: 3, background: { r: 12, g: 34, b: 56 } },
  })
    .png()
    .toBuffer();
  return "data:image/png;base64," + buf.toString("base64");
}

function makeApp() {
  return buildTestApp((app: any) =>
    uploadsRoutes(app, {
      authFromHeader: testAuthFromHeader,
      awardNotoriety: async () => 50,
      canAccessStaff: () => false,
      onAvatarChanged: () => {},
    } as any),
  );
}

afterAll(async () => {
  if (created.length)
    await prisma.user.deleteMany({ where: { id: { in: created } } }).catch(() => {});
});

describe("uploads - POST /profile/avatar/upload (free tier + moderation)", () => {
  it("lets an INNOCENT user upload a custom avatar, stored as sanitized webp", async () => {
    const app = await makeApp();
    const uid = await newUser("innocent"); // default tier is INNOCENT
    const r = await app.inject({
      method: "POST",
      url: "/profile/avatar/upload",
      headers: { authorization: "Bearer " + testToken(uid) },
      payload: { image: await pngDataUrl() },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(body.ok).toBe(true);
    expect(body.avatar).toMatch(/\/avatars\/.*\.webp$/);
    const row = await prisma.user.findUnique({ where: { id: uid }, select: { avatar: true } });
    expect(row?.avatar).toBe(body.avatar);
    await app.close();
  });

  it("rejects a media-banned user", async () => {
    const app = await makeApp();
    const uid = await newUser("banned", { mediaBannedUntil: new Date(Date.now() + 86400_000) });
    const r = await app.inject({
      method: "POST",
      url: "/profile/avatar/upload",
      headers: { authorization: "Bearer " + testToken(uid) },
      payload: { image: await pngDataUrl() },
    });
    expect(r.statusCode).toBe(403);
    expect(r.json().error).toBe("media_banned");
    await app.close();
  });

  it("rejects missing and non-image payloads", async () => {
    const app = await makeApp();
    const tok = "Bearer " + testToken(await newUser("bad"));
    const miss = await app.inject({
      method: "POST",
      url: "/profile/avatar/upload",
      headers: { authorization: tok },
      payload: {},
    });
    expect(miss.statusCode).toBe(400);
    const bad = await app.inject({
      method: "POST",
      url: "/profile/avatar/upload",
      headers: { authorization: tok },
      payload: { image: "data:text/plain;base64,aGk=" },
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error).toBe("invalid_format");
    await app.close();
  });

  it("requires auth", async () => {
    const app = await makeApp();
    const r = await app.inject({
      method: "POST",
      url: "/profile/avatar/upload",
      payload: { image: await pngDataUrl() },
    });
    expect(r.statusCode).toBe(401);
    await app.close();
  });

  it("replacing a custom avatar swaps the file (deletes the previous one)", async () => {
    const app = await makeApp();
    const uid = await newUser("replace");
    const tok = "Bearer " + testToken(uid);
    const first = await app.inject({
      method: "POST",
      url: "/profile/avatar/upload",
      headers: { authorization: tok },
      payload: { image: await pngDataUrl() },
    });
    expect(first.statusCode).toBe(200);
    const firstUrl = first.json().avatar;
    await new Promise((r) => setTimeout(r, 5)); // distinct Date.now() → distinct filename
    const second = await app.inject({
      method: "POST",
      url: "/profile/avatar/upload",
      headers: { authorization: tok },
      payload: { image: await pngDataUrl() },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().avatar).not.toBe(firstUrl); // new file, prior one swapped out
    await app.close();
  });
});

describe("uploads - POST /profile/banner/upload (moderated)", () => {
  // A banner is account flair, free for everyone since 2026-11-02 (was Indicted+).
  it("lets a free account upload one (and stores webp)", async () => {
    const app = await makeApp();
    const innocent = await newUser("binno");
    const ok = await app.inject({
      method: "POST",
      url: "/profile/banner/upload",
      headers: { authorization: "Bearer " + testToken(innocent) },
      payload: { image: await pngDataUrl() },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().bannerUrl).toMatch(/\/banners\/.*\.webp$/);
    await app.close();
  });

  it("rejects a media-banned INDICTED user, and bad payloads", async () => {
    const app = await makeApp();
    const banned = await newUser("bban", {
      tier: "INDICTED",
      mediaBannedUntil: new Date(Date.now() + 86400_000),
    });
    const bannedRes = await app.inject({
      method: "POST",
      url: "/profile/banner/upload",
      headers: { authorization: "Bearer " + testToken(banned) },
      payload: { image: await pngDataUrl() },
    });
    expect(bannedRes.statusCode).toBe(403);
    expect(bannedRes.json().error).toBe("media_banned");

    const tok = "Bearer " + testToken(await newUser("bbad", { tier: "INDICTED" }));
    const miss = await app.inject({
      method: "POST",
      url: "/profile/banner/upload",
      headers: { authorization: tok },
      payload: {},
    });
    expect(miss.statusCode).toBe(400);
    const bad = await app.inject({
      method: "POST",
      url: "/profile/banner/upload",
      headers: { authorization: tok },
      payload: { image: "data:text/plain;base64,aGk=" },
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error).toBe("invalid_format");
    await app.close();
  });
});

describe("uploads - POST /profile/symbol/upload (your own floating picture)", () => {
  it("is Indicted and up, and the address it returns is one the look will keep", async () => {
    const app = await makeApp();
    const free = await app.inject({
      method: "POST",
      url: "/profile/symbol/upload",
      headers: { authorization: "Bearer " + testToken(await newUser("sym_free")) },
      payload: { image: await pngDataUrl() },
    });
    expect(free.statusCode).toBe(402);
    expect(free.json().error).toBe("plan_required");

    const paid = await app.inject({
      method: "POST",
      url: "/profile/symbol/upload",
      headers: {
        authorization: "Bearer " + testToken(await newUser("sym_paid", { tier: "INDICTED" })),
      },
      payload: { image: await pngDataUrl() },
    });
    expect(paid.statusCode).toBe(200);
    const url = paid.json().url;
    expect(url).toMatch(/\/symbols\/[A-Za-z0-9_]+-\d+\.webp$/);
    expect(sanitizeUiPrefs({ fxImage: url, fxPicture: true })).toEqual({
      fxImage: url,
      fxPicture: true,
    });
    const served = await app.inject({ method: "GET", url: "/symbols/" + url.split("/").pop() });
    expect(served.statusCode).toBe(200);
    expect(served.headers["content-type"]).toBe("image/webp");
    await app.close();
  });
});
