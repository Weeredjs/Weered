import { describe, it, expect, beforeAll, afterAll } from "vitest";
import profileRoutes from "../../src/routes/profile";
import { prisma } from "../../src/lib/prisma";
import { buildTestApp, testAuthFromHeader, testToken } from "../helpers/buildTestApp";

// Saving an avatar or banner by address (red team 2026-11-01, findings 16-17):
// someone else's upload or an outside image is refused; their own, ours, or
// clearing it goes through.
const stamp = Date.now().toString(36);
const id: Record<string, string> = {};
let app: any;
const SITE = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

beforeAll(async () => {
  for (const k of ["me", "other"]) {
    const u = await prisma.user.create({
      data: { usernameKey: `itest_pic_${k}_${stamp}`, name: k },
      select: { id: true },
    });
    id[k] = u.id;
  }
  app = await buildTestApp((a: any) =>
    profileRoutes(a, {
      authFromHeader: testAuthFromHeader,
      getNotorietyRank: () => ({ title: "Innocent", min: 0, next: null }),
      awardNotoriety: async () => null,
      rooms: new Map(),
      publishState: () => {},
      getWss: () => ({ clients: new Set() }),
    } as any),
  );
});

afterAll(async () => {
  await app?.close();
  await prisma.user.deleteMany({ where: { id: { in: Object.values(id) } } }).catch(() => {});
  await prisma.$disconnect();
});

const save = (payload: any) =>
  app.inject({
    method: "PATCH",
    url: "/profile/me",
    headers: { authorization: `Bearer ${testToken(id.me)}` },
    payload,
  });

describe("pictures by address", () => {
  it("refuses someone else's upload and outside images", async () => {
    expect(
      (await save({ avatar: `${SITE}/avatars/${id.other}-1793500000000.webp` })).statusCode,
    ).toBe(400);
    expect((await save({ avatar: "https://evil.example/x.png" })).statusCode).toBe(400);
    expect(
      (await save({ bannerUrl: `${SITE}/banners/${id.other}-1793500000000.webp` })).statusCode,
    ).toBe(400);
  });

  it("takes their own upload, one of ours, and clearing", async () => {
    expect((await save({ avatar: `${SITE}/avatars/${id.me}-1793500000000.webp` })).statusCode).toBe(
      200,
    );
    expect((await save({ avatar: "/brand/avatars/pilot.svg" })).statusCode).toBe(200);
    expect((await save({ avatar: "" })).statusCode).toBe(200);
  });
});
