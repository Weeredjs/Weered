import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../src/lib/prisma";
import {
  addressProblem,
  forgetWeeredHosts,
  subdomainLobby,
  weeredHostLobby,
} from "../../src/lib/weeredHosts";
import { placeIdForHost } from "../../src/routes/places";

// Hardening 2026-11-02: a paid weered.ca address must not pass for Weered's own
// pages. A member's place can hold blocks that look like a sign-in box, so
// billing.weered.ca or weered-support.weered.ca would finish the costume.
const s = Date.now().toString(36);
const id: Record<string, string> = {};
const lobbies: string[] = [];

beforeAll(async () => {
  for (const [k, tier, globalRole] of [
    ["paid", "CONDEMNED", "USER"],
    ["staff", "INDICTED", "STAFF"],
  ] as const) {
    id[k] = (
      await prisma.user.create({
        data: { usernameKey: `itoa_weered_${k}_${s}`, name: `oa ${k}`, tier, globalRole },
        select: { id: true },
      })
    ).id;
  }
  for (const [lid, owner, extra] of [
    [`itoaweered${s}`, id.paid, { subdomain: true }],
    [`itoaweeredstaff${s}`, id.staff, { subdomain: true }],
    [`u-itoapaid${s}`, id.paid, { unlisted: true, moduleConfig: { code: true } }],
    [`u-itoastaff${s}`, id.staff, { unlisted: true, moduleConfig: { code: true } }],
  ] as const) {
    await prisma.lobby.create({ data: { id: lid, name: lid, ownerId: owner, ...extra } as any });
    lobbies.push(lid);
  }
  forgetWeeredHosts();
});

afterAll(async () => {
  await prisma.lobby.deleteMany({ where: { id: { in: lobbies } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: Object.values(id) } } }).catch(() => {});
  await prisma.$disconnect();
});

describe("addresses that read as Weered's own", () => {
  it("no one gets the account, money or moderation words", () => {
    for (const w of ["billing", "verify", "sign-in", "account", "password", "moderator", "legal"])
      expect(placeIdForHost(`${w}.weered.ca`)).toBeNull();
    expect(placeIdForHost("fundy.weered.ca")).toBe("u-fundy");
  });

  it("a paying member's yourname.weered.ca can't carry Weered in it", async () => {
    expect(await weeredHostLobby(`itoa-weered-paid-${s}.weered.ca`)).toBeNull();
    expect(await weeredHostLobby(`itoa-weered-staff-${s}.weered.ca`)).toBe(`u-itoastaff${s}`);
  });

  it("nor can a paying owner's lobby address; staff's can", async () => {
    expect(await addressProblem(`itoaweered${s}`, id.paid)).toBe("official");
    expect(await subdomainLobby(`itoaweered${s}`)).toBeNull();
    expect(await addressProblem(`itoaweeredstaff${s}`, id.staff)).toBeNull();
    expect(await subdomainLobby(`itoaweeredstaff${s}`)).toBe(`itoaweeredstaff${s}`);
  });
});
