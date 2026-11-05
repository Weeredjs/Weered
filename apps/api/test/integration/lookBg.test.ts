import { describe, it, expect, afterAll } from "vitest";
import profileRoutes from "../../src/routes/profile";
import { cleanLookBg, shownLookBg } from "../../src/lib/lookBg";
import { buildTestApp, testToken, testAuthFromHeader } from "../helpers/buildTestApp";
import { prisma } from "../../src/lib/prisma";

// A paid member's background (James 2026-11-02): their card, profile, the card
// people open from their name, and their row in lists. Every paid plan.
const makeApp = () =>
  buildTestApp((app: any) =>
    profileRoutes(app, {
      authFromHeader: testAuthFromHeader,
      getNotorietyRank: () => ({ title: "Innocent", min: 0, next: null }),
      awardNotoriety: async () => null,
      rooms: new Map(),
      publishState: () => {},
      getWss: () => ({ clients: new Set() }),
    } as any),
  );

const stamp = Date.now().toString(36);
const ids: string[] = [];
async function member(tag: string, tier = "INNOCENT", bannerUrl: string | null = null) {
  const u = await prisma.user.create({
    data: { usernameKey: `itest_lbg_${tag}_${stamp}`, name: tag, tier: tier as any, bannerUrl },
    select: { id: true },
  });
  ids.push(u.id);
  return u.id;
}
const patch = (app: any, uid: string, lookBg: unknown) =>
  app.inject({
    method: "PATCH",
    url: "/profile/me",
    headers: { authorization: `Bearer ${testToken(uid)}` },
    payload: { lookBg },
  });

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
  await prisma.$disconnect();
});

describe("the rules", () => {
  it("takes a colour, two colours or the banner, and nothing else", () => {
    expect(cleanLookBg("c:#7C3AED")).toBe("c:#7c3aed");
    expect(cleanLookBg("g:#7c3aed,#22d3ee")).toBe("g:#7c3aed,#22d3ee");
    expect(cleanLookBg("banner")).toBe("banner");
    expect(cleanLookBg("none")).toBeNull();
    expect(cleanLookBg("url(https://evil.example/x.png)")).toBeUndefined();
    expect(cleanLookBg("c:red")).toBeUndefined();
  });

  it("shows only while a plan (or staff) covers it, and a banner only if there is one", () => {
    expect(shownLookBg({ lookBg: "c:#112233", tier: "INDICTED" })).toEqual({ lookBg: "c:#112233" });
    expect(shownLookBg({ lookBg: "c:#112233", tier: "INNOCENT" })).toEqual({});
    expect(shownLookBg({ lookBg: "c:#112233", tier: "INNOCENT", globalRole: "STAFF" })).toEqual({
      lookBg: "c:#112233",
    });
    // Medics (SUPPORT) wear one: a look, not a power (2026-11-05).
    expect(
      shownLookBg({
        lookBg: "banner",
        tier: "INNOCENT",
        globalRole: "SUPPORT",
        bannerUrl: "/b.webp",
      }),
    ).toEqual({ lookBg: "banner", bannerUrl: "/b.webp" });
    expect(shownLookBg({ lookBg: "banner", tier: "FELON", bannerUrl: "/uploads/b.webp" })).toEqual({
      lookBg: "banner",
      bannerUrl: "/uploads/b.webp",
    });
    expect(shownLookBg({ lookBg: "banner", tier: "FELON", bannerUrl: null })).toEqual({});
  });
});

describe("PATCH /profile/me", () => {
  it("is a paid feature", async () => {
    const app = await makeApp();
    const free = await member("free");
    const r = await patch(app, free, "c:#7c3aed");
    expect(r.statusCode).toBe(402);
    expect(r.json().error).toBe("paid_feature");
  });

  it("saves for a paid member; the banner needs a banner; nonsense is refused", async () => {
    const app = await makeApp();
    const six = await member("six", "INDICTED");
    expect((await patch(app, six, "g:#7c3aed,#22d3ee")).statusCode).toBe(200);
    expect((await prisma.user.findUnique({ where: { id: six } }))?.lookBg).toBe(
      "g:#7c3aed,#22d3ee",
    );
    expect((await patch(app, six, "banner")).json().error).toBe("no_banner");
    expect((await patch(app, six, "javascript:alert(1)")).statusCode).toBe(400);
    expect((await patch(app, six, "none")).statusCode).toBe(200);
    expect((await prisma.user.findUnique({ where: { id: six } }))?.lookBg).toBeNull();
  });
});

describe("GET /profile/:id", () => {
  it("others see it while the plan lasts; the owner always sees their own setting", async () => {
    const app = await makeApp();
    const owner = await member("lapsed", "INDICTED", "/uploads/banner-x.webp");
    const viewer = await member("viewer");
    await patch(app, owner, "banner");
    const seen = (uid: string) =>
      app
        .inject({
          method: "GET",
          url: `/profile/${owner}`,
          headers: { authorization: `Bearer ${testToken(uid)}` },
        })
        .then((r: any) => r.json().lookBg);
    expect(await seen(viewer)).toBe("banner");
    await prisma.user.update({ where: { id: owner }, data: { tier: "INNOCENT" as any } });
    expect(await seen(viewer)).toBeNull();
    expect(await seen(owner)).toBe("banner");
  });
});
