import { describe, it, expect, beforeAll, afterAll } from "vitest";
import lobbyDesignRoutes from "../../src/routes/lobbyDesign";
import { prisma } from "../../src/lib/prisma";
import {
  addressProblem,
  forgetWeeredHosts,
  subdomainLobby,
  vanityHostFor,
  weeredHostLobby,
} from "../../src/lib/weeredHosts";
import { ownerBuildsModules } from "../../src/lib/moduleGate";
import { canOwnDomain, subdomainAllowance, tierAtLeast } from "../../src/lib/tiers";
import { buildTestApp, testAuthFromHeader, testToken } from "../helpers/buildTestApp";

// The paid tiers (2026-11-02): $6 yourname.weered.ca, $14 one lobby address
// and AI-built modules, $25 three addresses and your own domain.
const s = Date.now().toString(36);
const id: Record<string, string> = {};
const lobbies: string[] = [];
let app: any;

async function lobby(lid: string, ownerId: string, subdomain = false) {
  await prisma.lobby.create({ data: { id: lid, name: lid, ownerId, subdomain } as any });
  lobbies.push(lid);
  return lid;
}

beforeAll(async () => {
  for (const [k, tier] of [
    ["free", "INNOCENT"],
    ["six", "INDICTED"],
    ["felon", "FELON"],
    ["condemned", "CONDEMNED"],
  ] as const) {
    id[k] = (
      await prisma.user.create({
        data: { usernameKey: `itpt_${k}_${s}`, name: `pt ${k}`, tier },
        select: { id: true },
      })
    ).id;
  }
  app = await buildTestApp(async (a: any) => {
    await lobbyDesignRoutes(a, {
      authFromHeader: testAuthFromHeader,
      getGlobalRole: async () => "USER",
      canAccessStaff: () => false,
      lobbyAdminAccess: async (req: any, reply: any) => {
        const u = testAuthFromHeader(req.headers?.authorization);
        const l = await prisma.lobby.findUnique({ where: { id: String(req.params?.id) } });
        if (!u || !l || l.ownerId !== u.id) {
          reply.code(403).send({ ok: false });
          return null;
        }
        return { user: u, lobby: l, member: { roleLevel: 5 }, overrideRole: null };
      },
    } as any);
  });
});

afterAll(async () => {
  await app?.close();
  const ids = Object.values(id);
  const owned = await prisma.lobby.findMany({
    where: { ownerId: { in: ids } },
    select: { id: true },
  });
  const all = [...new Set([...lobbies, ...owned.map((l) => l.id)])];
  await prisma.lobby.deleteMany({ where: { id: { in: all } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
  await prisma.$disconnect();
});

const put = (who: string, url: string, payload: any) =>
  app.inject({
    method: "PUT",
    url,
    headers: { authorization: `Bearer ${testToken(id[who])}` },
    payload,
  });

describe("the tier rules", () => {
  it("each tier includes the one below", () => {
    expect(tierAtLeast("CONDEMNED", "FELON")).toBe(true);
    expect(tierAtLeast("INDICTED", "FELON")).toBe(false);
    expect(subdomainAllowance("FELON")).toBe(1);
    expect(subdomainAllowance("CONDEMNED")).toBe(3);
    expect(subdomainAllowance("INDICTED")).toBe(0);
    expect(canOwnDomain("FELON")).toBe(false);
    expect(canOwnDomain("CONDEMNED")).toBe(true);
  });
});

describe("<lobby>.weered.ca", () => {
  it("answers for a Felon's first address only, and a Condemned's three", async () => {
    const f1 = await lobby(`ptf1${s}`, id.felon, true);
    const f2 = await lobby(`ptf2${s}`, id.felon, true);
    expect(await subdomainLobby(f1)).toBe(f1);
    expect(await subdomainLobby(f2)).toBeNull();
    const c1 = await lobby(`ptc1${s}`, id.condemned, true);
    const c2 = await lobby(`ptc2${s}`, id.condemned, true);
    expect(await subdomainLobby(c1)).toBe(c1);
    expect(await subdomainLobby(c2)).toBe(c2);
    const free = await lobby(`ptfree${s}`, id.free, true);
    expect(await subdomainLobby(free)).toBeNull();
    forgetWeeredHosts();
    expect(await weeredHostLobby(`${f1}.weered.ca`)).toBe(f1);
  });

  it("is switched on only within the owner's plan", async () => {
    const mine = await lobby(`ptsix${s}`, id.six);
    const r = await put("six", `/lobbies/${mine}/admin/subdomain`, { on: true });
    expect(r.statusCode).toBe(402);
    const c3 = await lobby(`ptc3${s}`, id.condemned);
    const ok = await put("condemned", `/lobbies/${c3}/admin/subdomain`, { on: true });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ on: true, live: true, allowance: 3, used: 3 });
    const c4 = await lobby(`ptc4${s}`, id.condemned);
    expect(
      (await put("condemned", `/lobbies/${c4}/admin/subdomain`, { on: true })).statusCode,
    ).toBe(402);
  });

  it("won't take a paying member's name", async () => {
    // itpt_six_<s> reads as itpt-six-<s>; a lobby by that name can't take it.
    const label = `itpt-six-${s}`;
    expect(await addressProblem(label, id.condemned)).toBe("taken");
    expect(await addressProblem(label, id.six)).toBeNull();
    expect(await addressProblem("Bad_Name", id.condemned)).toBe("bad_label");
  });
});

describe("yourname.weered.ca", () => {
  it("is the $6 tier's, for the member's place", async () => {
    const place = `u-ptsix${s}`;
    await prisma.lobby.create({
      data: {
        id: place,
        name: "six's place",
        ownerId: id.six,
        unlisted: true,
        moduleConfig: { code: true },
      } as any,
    });
    lobbies.push(place);
    forgetWeeredHosts();
    expect(await vanityHostFor(id.six, place)).toBe(`itpt-six-${s}.weered.ca`);
    expect(await weeredHostLobby(`itpt-six-${s}.weered.ca`)).toBe(place);
    const freePlace = `u-ptfree${s}`;
    await prisma.lobby.create({
      data: {
        id: freePlace,
        name: "free place",
        ownerId: id.free,
        unlisted: true,
        moduleConfig: { code: true },
      } as any,
    });
    lobbies.push(freePlace);
    expect(await vanityHostFor(id.free, freePlace)).toBeNull();
  });
});

describe("plan-only features", () => {
  it("a domain of your own is Condemned's", async () => {
    const fl = await lobby(`ptdomf${s}`, id.felon);
    const r = await put("felon", `/lobbies/${fl}/admin/domain`, {
      domain: `club-${s}.example.com`,
    });
    expect(r.statusCode).toBe(402);
    const cl = await lobby(`ptdomc${s}`, id.condemned);
    const ok = await put("condemned", `/lobbies/${cl}/admin/domain`, {
      domain: `club-${s}.example.com`,
    });
    expect(ok.statusCode).toBe(200);
  });

  it("AI-built modules need the owner's Felon plan", async () => {
    expect(await ownerBuildsModules(id.six)).toBe(false);
    expect(await ownerBuildsModules(id.felon)).toBe(true);
    expect(await ownerBuildsModules(id.condemned)).toBe(true);
  });
});
